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
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 2 L8 9 M5 4 L5 9 M11 4 L11 9 M3 7 L3 11 Q3 14 8 14 Q13 14 13 11 L13 7 M3 7 Q3 9 5 9 M13 7 Q13 9 11 9" />
    </svg>
  );
}
