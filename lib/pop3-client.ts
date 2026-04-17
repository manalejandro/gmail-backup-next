import * as tls from 'tls'

interface QueueItem {
  resolve: (lines: string[]) => void
  reject: (err: Error) => void
  multiLine: boolean
}

/**
 * Lightweight POP3 client using native TLS.
 * Handles dot-unstuffing, multi-line responses and the full POP3 greeting flow.
 */
export class Pop3Client {
  private socket: tls.TLSSocket | null = null
  private buffer = ''
  private queue: QueueItem[] = []

  /** Open a TLS connection to the POP3 server */
  connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect(
        { host, port, rejectUnauthorized: false },
      )
      socket.setEncoding('binary')
      // Kill the socket if the server is unreachable or hangs
      socket.setTimeout(300_000, () => {
        socket.destroy(new Error('POP3 connection timed out (5 min)'))
      })

      socket.once('secureConnect', () => {
        this.socket = socket
        resolve()
      })

      socket.on('error', reject)

      socket.on('data', (chunk: string) => {
        this.buffer += chunk
        this.drain()
      })

      socket.on('close', () => {
        for (const item of this.queue) {
          item.reject(new Error('POP3 connection closed unexpectedly'))
        }
        this.queue = []
      })
    })
  }

  /** Process buffered data and resolve pending promises */
  private drain(): void {
    while (this.queue.length > 0) {
      const item = this.queue[0]

      if (item.multiLine) {
        // Multi-line response ends with CR LF DOT CR LF
        const termIdx = this.buffer.indexOf('\r\n.\r\n')
        if (termIdx < 0) return
        const raw = this.buffer.slice(0, termIdx)
        this.buffer = this.buffer.slice(termIdx + 5)
        this.queue.shift()
        const lines = raw.split('\r\n')
        if (lines[0].startsWith('-ERR')) {
          item.reject(new Error(lines[0].slice(5).trim()))
        } else {
          item.resolve(lines)
        }
      } else {
        // Single-line response ends with CR LF
        const lineEnd = this.buffer.indexOf('\r\n')
        if (lineEnd < 0) return
        const line = this.buffer.slice(0, lineEnd)
        this.buffer = this.buffer.slice(lineEnd + 2)
        this.queue.shift()
        if (line.startsWith('-ERR')) {
          item.reject(new Error(line.slice(5).trim()))
        } else {
          item.resolve([line])
        }
      }
    }
  }

  private expect(multiLine: boolean): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject, multiLine })
      // In case data already arrived before the promise was set up
      this.drain()
    })
  }

  private async send(cmd: string, multiLine: boolean): Promise<string[]> {
    const p = this.expect(multiLine)
    this.socket!.write(`${cmd}\r\n`, 'binary')
    return p
  }

  /**
   * Authenticate after connecting.
   * Must be called right after connect() to consume the server greeting.
   */
  async auth(user: string, pass: string): Promise<void> {
    await this.expect(false)           // consume server greeting
    await this.send(`USER ${user}`, false)
    await this.send(`PASS ${pass}`, false)
  }

  /** Returns mailbox statistics */
  async stat(): Promise<{ count: number; size: number }> {
    const [line] = await this.send('STAT', false)
    const parts = line.split(' ')
    return { count: Number(parts[1]), size: Number(parts[2]) }
  }

  /**
   * Returns a Map of message-number → unique-id.
   * Use UIDs to detect already-backed-up messages.
   */
  async uidl(): Promise<Map<number, string>> {
    const lines = await this.send('UIDL', true)
    const map = new Map<number, string>()
    for (let i = 1; i < lines.length; i++) {
      const [n, u] = lines[i].trim().split(/\s+/)
      if (n && u) map.set(Number(n), u)
    }
    return map
  }

  /**
   * Retrieve message content as raw RFC 2822 string.
   * Handles POP3 dot-unstuffing automatically.
   */
  async retr(msgNum: number): Promise<string> {
    const lines = await this.send(`RETR ${msgNum}`, true)
    // Skip status line; undo dot-stuffing (lines starting with '..' → '.')
    return lines
      .slice(1)
      .map(l => (l.startsWith('..') ? l.slice(1) : l))
      .join('\r\n')
  }

  /** Gracefully close the connection */
  async quit(): Promise<void> {
    try {
      await this.send('QUIT', false)
    } finally {
      this.socket?.destroy()
      this.socket = null
    }
  }
}
