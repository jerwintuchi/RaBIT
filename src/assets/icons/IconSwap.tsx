import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconSwap({ size = 16, ...props }: IconProps): JSX.Element {
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
      <polyline points="4,4 10,4 10,7" />
      <polyline points="12,12 6,12 6,9" />
      <line x1="4" y1="4" x2="2" y2="6" />
      <line x1="12" y1="12" x2="14" y2="10" />
    </svg>
  );
}
