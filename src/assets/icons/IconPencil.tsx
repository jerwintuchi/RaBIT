import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconPencil({ size = 16, ...props }: IconProps): JSX.Element {
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
      <line x1="12" y1="2" x2="4" y2="10" />
      <polygon points="2,12 4,10 6,12 4,14" />
      <line x1="12" y1="2" x2="14" y2="4" />
      <rect x="12" y="1" width="3" height="2" rx="0.5" transform="rotate(45 13.5 2)" />
    </svg>
  );
}
