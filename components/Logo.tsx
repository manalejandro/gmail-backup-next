import Image from 'next/image'

interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
}

export default function Logo({ size = 40, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/logo.svg"
        alt="Gmail Backup Next logo"
        width={size}
        height={size}
        priority
        className="shrink-0"
      />
      {showText && (
        <span
          className="font-semibold text-white leading-tight"
          style={{ fontSize: size * 0.4 }}
        >
          Gmail Backup
          <br />
          <span className="font-normal opacity-75">Next</span>
        </span>
      )}
    </div>
  )
}
