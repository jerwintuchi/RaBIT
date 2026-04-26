import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconUpload({ size = 16, ...props }: IconProps): JSX.Element {
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
      <polyline points="4,6 8,2 12,6" />
      <line x1="8" y1="2" x2="8" y2="11" />
      <line x1="2" y1="14" x2="14" y2="14" />
    </svg>
  );
}
