interface SelykaiMarkProps {
  className?: string;
}

export function SelykaiMark({ className }: SelykaiMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M34.6 14.2C32 11.4 28.5 10 24.1 10c-5.8 0-9.7 2.7-9.7 6.8 0 9.2 19.2 4.4 19.2 14.1 0 4.4-4.2 7.1-10.1 7.1-4.7 0-8.6-1.7-11.2-5"
        stroke="currentColor"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <circle cx="36.5" cy="11.5" r="2.5" fill="currentColor" />
      <circle cx="10.5" cy="35.5" r="2.5" fill="currentColor" />
    </svg>
  );
}
