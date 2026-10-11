/** Line icons drawn the way the design files draw them: 24px grid, round caps and joins. */
const PATHS: Record<string, React.ReactNode> = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  family: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.8" /><path d="M16.5 14.6c2.6.2 4.4 2 5 5.4" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  photo: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M20.5 16l-5-5-8.5 8.5" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" /></>,
  cake: <><path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" /><path d="M4 15.5c1.3 1 2.7 1 4 0s2.7-1 4 0 2.7 1 4 0 2.7-1 4 0" /><path d="M8 11V8M12 11V8M16 11V8M8 5.5v.01M12 5.5v.01M16 5.5v.01" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  upload: <><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.8 8.5 4 4 0 0 1 17 18" /><path d="M12 21v-9M8.5 15l3.5-3.5 3.5 3.5" /></>,
  filters: <path d="M4 6h16M7 12h10M10 18h4" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, stroke = 1.6, className, style }: {
  name: IconName; size?: number; stroke?: number; className?: string; style?: React.CSSProperties;
}) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className} style={{ flex: "none", ...style }}>
      {PATHS[name]}
    </svg>
  );
}
