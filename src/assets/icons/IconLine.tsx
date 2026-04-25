import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconLine({ size = 16, ...props }: IconProps): JSX.Element {
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
      <line x1="2" y1="14" x2="14" y2="2" />
      <circle cx="2" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
