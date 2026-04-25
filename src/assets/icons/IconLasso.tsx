import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconLasso({ size = 16, ...props }: IconProps): JSX.Element {
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
      <path d="M3 10 Q2 6 5 4 Q8 2 11 4 Q14 6 13 9 Q12 12 9 13 Q7 14 6 12 L5 10 Q4 9 3 10 Z" />
    </svg>
  );
}
