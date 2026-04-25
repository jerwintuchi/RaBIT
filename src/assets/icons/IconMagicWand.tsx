import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconMagicWand({ size = 16, ...props }: IconProps): JSX.Element {
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
      <line x1="2" y1="14" x2="10" y2="6" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="14" y1="6" x2="12" y2="6" />
      <line x1="13.4" y1="2.6" x2="11.6" y2="4.4" />
      <line x1="10" y1="4" x2="10" y2="6" />
      <line x1="12" y1="8" x2="14" y2="8" />
    </svg>
  );
}
