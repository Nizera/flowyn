'use client'

export function FlowynIcon({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="flowyn-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path
        d="M16 48 C12 48, 8 44, 8 38 C8 28, 14 18, 22 14 L26 12 C30 10, 34 12, 34 16 L34 18 C34 20, 32 22, 30 22 L22 26 C18 28, 16 32, 16 36 L48 36 C52 36, 56 32, 56 28 L56 24 C56 20, 54 18, 50 18 L42 18"
        stroke="url(#flowyn-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M44 8 L56 18 L44 28"
        stroke="url(#flowyn-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
