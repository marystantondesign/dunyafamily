/** The favorites star: outlined when off, filled gold when on. Never a heart; hearts are public reactions. */
export function Star({ on, size = 16, className }: { on: boolean; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={className}
      fill={on ? "#D9A93A" : "none"} stroke={on ? "#A87A1E" : "currentColor"} strokeWidth={on ? 1.6 : 1.7} strokeLinejoin="round">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  );
}
