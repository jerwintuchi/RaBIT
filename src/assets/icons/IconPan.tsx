import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconPan({ size = 16, ...props }: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Four fingers (index, middle, ring, pinky) */}
      <line x1="6" y1="10" x2="6" y2="2" />
      <line x1="8" y1="10" x2="8" y2="1" />
      <line x1="10" y1="10" x2="10" y2="2" />
      <line x1="12" y1="10" x2="12" y2="4" />
      {/* Thumb curving up from left */}
      <path d="M4 10 L4 7 Q4 5 5.5 5 Q6 5 6 6" />
      {/* Curved palm connecting all fingers at bottom */}
      <path d="M4 10 Q3 10 3 12 Q3 15 8 15 Q13 15 13 12 L13 10" />
    </svg>
  );
}
