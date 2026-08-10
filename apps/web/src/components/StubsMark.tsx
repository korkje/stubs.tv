// The stubs ticket mark. Canonical asset: assets/brand/stubs-mark.svg.
// Inlined as a component so the fills can use theme tokens: the ticket body
// follows the accent (amber-9) and the ink follows the accent's contrast
// color, so the mark tracks any future theme change.
export function StubsMark({ width = 120 }: { width?: number }) {
  const body = "var(--accent-9)";
  const ink = "var(--accent-contrast)";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 72"
      width={width}
      height={(width * 72) / 120}
      aria-hidden="true"
    >
      <defs>
        <mask id="stubs-mark-ticket">
          <rect x="2" y="2" width="116" height="68" rx="10" fill="white" />
          <circle cx="2" cy="36" r="8" fill="black" />
          <circle cx="118" cy="36" r="8" fill="black" />
          <circle cx="84" cy="2" r="1.9" fill="black" />
          <circle cx="84" cy="13.33" r="1.9" fill="black" />
          <circle cx="84" cy="24.67" r="1.9" fill="black" />
          <circle cx="84" cy="36" r="1.9" fill="black" />
          <circle cx="84" cy="47.33" r="1.9" fill="black" />
          <circle cx="84" cy="58.67" r="1.9" fill="black" />
          <circle cx="84" cy="70" r="1.9" fill="black" />
        </mask>
      </defs>
      <g mask="url(#stubs-mark-ticket)">
        <rect x="2" y="2" width="116" height="68" rx="10" fill={body} />
        <polygon
          points="26,18.5 27.23,21.3 30.28,21.61 28,23.65 28.65,26.64 26,25.1 23.35,26.64 24,23.65 21.72,21.61 24.77,21.3"
          fill={ink}
          stroke={ink}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <polygon
          points="39,18.5 40.23,21.3 43.28,21.61 41,23.65 41.65,26.64 39,25.1 36.35,26.64 37,23.65 34.72,21.61 37.77,21.3"
          fill={ink}
          stroke={ink}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <polygon
          points="52,18.5 53.23,21.3 56.28,21.61 54,23.65 54.65,26.64 52,25.1 49.35,26.64 50,23.65 47.72,21.61 50.77,21.3"
          fill={ink}
          stroke={ink}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <rect x="20" y="34" width="46" height="4.5" rx="2.25" fill={ink} />
        <rect x="20" y="45.5" width="30" height="4.5" rx="2.25" fill={ink} />
      </g>
    </svg>
  );
}
