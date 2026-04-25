import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

export function IconTrash({ size = 16, ...props }: IconProps): JSX.Element {
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
      <line x1="2" y1="5" x2="14" y2="5" />
      <path d="M4 5 L4 13 Q4 14 5 14 L11 14 Q12 14 12 13 L12 5" />
      <line x1="7" y1="7" x2="7" y2="12" />
      <line x1="9" y1="7" x2="9" y2="12" />
      <path d="M6 5 L6 3.5 Q6 3 6.5 3 L9.5 3 Q10 3 10 3.5 L10 5" />
    </svg>
  );
}
