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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Pencil body outline: tip at bottom-left, eraser at top-right */}
      <path d="M3 13 L2 14 L4 14 L14 4 L12 2 Z" />
      {/* Eraser band separator */}
      <line x1="11" y1="3" x2="13" y2="5" />
      {/* Wood-to-lead separator near tip */}
      <line x1="3.5" y1="12.5" x2="5.5" y2="10.5" />
    </svg>
  );
}
