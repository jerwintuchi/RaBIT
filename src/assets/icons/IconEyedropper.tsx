import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconEyedropper({ size = 16, ...props }: IconProps): JSX.Element {
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
      <path d="M10 2 L13 5 L7 11 L4 11 L4 8 Z" />
      <line x1="13" y1="5" x2="11" y2="3" />
      <circle cx="3" cy="13" r="1.5" fill="currentColor" stroke="none" />
      <line x1="4" y1="11" x2="3" y2="12" />
    </svg>
  );
}
