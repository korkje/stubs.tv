// The stubs ticket mark. Canonical asset: assets/brand/stubs-mark.svg.
// Inlined as a component so the fills can use theme tokens: the ticket body
// follows the accent (amber-9) and the ink follows the accent's contrast
// color, so the mark tracks any future theme change.
export function StubsMark({ width = 120 }: { width?: number | string }) {
  const body = "var(--accent-9)";
  const ink = "var(--accent-contrast)";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 72"
      width={width}
      // A CSS width like "100%" scales with the container; the viewBox keeps
      // the aspect ratio when no explicit height is set.
      height={typeof width === "number" ? (width * 72) / 120 : undefined}
      aria-hidden="true"
    >
      <defs>
        <mask id="stubs-mark-ticket">
          <rect x="2" y="2" width="116" height="68" fill="white" />
          <circle cx="2" cy="36" r="8" fill="black" />
          <circle cx="118" cy="36" r="8" fill="black" />
          <circle cx="84" cy="2" r="2" fill="black" />
          <circle cx="84" cy="13.33" r="2" fill="black" />
          <circle cx="84" cy="24.67" r="2" fill="black" />
          <circle cx="84" cy="36" r="2" fill="black" />
          <circle cx="84" cy="47.33" r="2" fill="black" />
          <circle cx="84" cy="58.67" r="2" fill="black" />
          <circle cx="84" cy="70" r="2" fill="black" />
        </mask>
        {/* Radix Icons' StarFilled path (MIT), verbatim. It fills with
            currentColor, so the tint comes from `color` on each <use> — a
            `fill` there would lose to the path's own presentation attribute. */}
        <symbol id="stubs-mark-star" viewBox="0 0 15 15">
          <path
            d="M7.22303 0.665992C7.32551 0.419604 7.67454 0.419604 7.77702 0.665992L9.41343 4.60039C9.45663 4.70426 9.55432 4.77523 9.66645 4.78422L13.914 5.12475C14.18 5.14607 14.2878 5.47802 14.0852 5.65162L10.849 8.42374C10.7636 8.49692 10.7263 8.61176 10.7524 8.72118L11.7411 12.866C11.803 13.1256 11.5206 13.3308 11.2929 13.1917L7.6564 10.9705C7.5604 10.9119 7.43965 10.9119 7.34365 10.9705L3.70718 13.1917C3.47945 13.3308 3.19708 13.1256 3.25899 12.866L4.24769 8.72118C4.2738 8.61176 4.23648 8.49692 4.15105 8.42374L0.914889 5.65162C0.712228 5.47802 0.820086 5.14607 1.08608 5.12475L5.3336 4.78422C5.44573 4.77523 5.54342 4.70426 5.58662 4.60039L7.22303 0.665992Z"
            fill="currentColor"
          />
        </symbol>
      </defs>
      <g mask="url(#stubs-mark-ticket)">
        <rect x="2" y="2" width="116" height="68" rx="10" fill={body} />
        <use
          href="#stubs-mark-star"
          x="20"
          y="18"
          width="11"
          height="11"
          color={ink}
        />
        <use
          href="#stubs-mark-star"
          x="33"
          y="18"
          width="11"
          height="11"
          color={ink}
        />
        <use
          href="#stubs-mark-star"
          x="46"
          y="18"
          width="11"
          height="11"
          color={ink}
        />
        <rect x="20" y="34" width="46" height="4" rx="1" fill={ink} />
        <rect x="20" y="46" width="30" height="4" rx="1" fill={ink} />
      </g>
    </svg>
  );
}
