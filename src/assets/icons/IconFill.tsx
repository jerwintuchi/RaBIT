import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconFill({ size = 16, ...props }: IconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 6 L4 13 Q4 14 5 14 L11 14 Q12 14 12 13 L12 8 L9 6 Z" />
      <path d="M9 6 L9 8 L12 8" />
      <path d="M12 7 Q14 6 14 5 Q14 3 12.5 3 Q11 3 12 5" />
      <circle cx="13.5" cy="13.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
