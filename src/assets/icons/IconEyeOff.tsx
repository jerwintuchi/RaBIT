import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconEyeOff({ size = 16, ...props }: IconProps): JSX.Element {
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
      <path d="M2 8 Q5 3 8 3 Q11 3 14 8" />
      <path d="M14 8 Q11 13 8 13 Q5 13 2 8" />
      <line x1="2" y1="2" x2="14" y2="14" />
    </svg>
  );
}
