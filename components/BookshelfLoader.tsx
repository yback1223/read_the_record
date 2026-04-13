type Props = {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: 80,
  md: 120,
  lg: 160,
};

export default function BookshelfLoader({
  label = "잠깐만요…",
  size = "md",
  className = "",
}: Props) {
  const w = SIZE[size];
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <svg
        width={w}
        height={w * 0.75}
        viewBox="0 0 160 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="shelf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--rule-strong)" />
            <stop offset="100%" stopColor="var(--rule)" />
          </linearGradient>
        </defs>

        {/* shelf board */}
        <rect
          x="14"
          y="86"
          width="132"
          height="6"
          rx="1"
          fill="url(#shelf)"
        />
        <rect
          x="14"
          y="92"
          width="132"
          height="2"
          fill="var(--rule)"
          opacity="0.6"
        />

        {/* standing books */}
        <g className="bsl-stand">
          <rect
            x="22"
            y="48"
            width="10"
            height="38"
            rx="1.2"
            fill="var(--accent)"
            opacity="0.85"
          />
          <rect
            x="34"
            y="42"
            width="10"
            height="44"
            rx="1.2"
            fill="var(--ink)"
            opacity="0.78"
          />
          <rect
            x="46"
            y="50"
            width="10"
            height="36"
            rx="1.2"
            fill="var(--accent-soft)"
            opacity="0.85"
          />
          <rect
            x="58"
            y="44"
            width="10"
            height="42"
            rx="1.2"
            fill="var(--ink-muted)"
            opacity="0.7"
          />
          <rect
            x="70"
            y="52"
            width="10"
            height="34"
            rx="1.2"
            fill="var(--accent)"
            opacity="0.7"
          />
          <rect
            x="82"
            y="46"
            width="10"
            height="40"
            rx="1.2"
            fill="var(--ink)"
            opacity="0.65"
          />
          <rect
            x="94"
            y="50"
            width="10"
            height="36"
            rx="1.2"
            fill="var(--accent-soft)"
            opacity="0.7"
          />
        </g>

        {/* incoming book that slides in */}
        <g className="bsl-incoming">
          <rect
            x="0"
            y="0"
            width="10"
            height="40"
            rx="1.4"
            fill="var(--accent)"
          />
          <rect x="0" y="6" width="10" height="1.5" fill="var(--paper)" opacity="0.6" />
          <rect x="0" y="32" width="10" height="1.5" fill="var(--paper)" opacity="0.6" />
        </g>
      </svg>

      <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink-soft)]">
        {label}
      </p>

      <style>{`
        .bsl-incoming {
          transform: translate(118px, 80px);
          animation: bsl-slide 1.6s cubic-bezier(0.22, 1, 0.36, 1) infinite;
          transform-origin: center;
        }
        @keyframes bsl-slide {
          0%   { transform: translate(150px, 6px) rotate(-8deg); opacity: 0; }
          18%  { opacity: 1; }
          55%  { transform: translate(118px, 46px) rotate(0deg); opacity: 1; }
          72%  { transform: translate(106px, 46px) rotate(0deg); opacity: 1; }
          85%  { transform: translate(106px, 48px) rotate(0deg); opacity: 1; }
          100% { transform: translate(106px, 46px) rotate(0deg); opacity: 1; }
        }
        .bsl-stand rect {
          transform-origin: bottom center;
          animation: bsl-breathe 3.2s ease-in-out infinite;
        }
        .bsl-stand rect:nth-child(2) { animation-delay: 0.1s; }
        .bsl-stand rect:nth-child(3) { animation-delay: 0.2s; }
        .bsl-stand rect:nth-child(4) { animation-delay: 0.3s; }
        .bsl-stand rect:nth-child(5) { animation-delay: 0.4s; }
        .bsl-stand rect:nth-child(6) { animation-delay: 0.5s; }
        .bsl-stand rect:nth-child(7) { animation-delay: 0.6s; }
        @keyframes bsl-breathe {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(1.015); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bsl-incoming, .bsl-stand rect { animation: none; }
          .bsl-incoming { transform: translate(106px, 46px); }
        }
      `}</style>
    </div>
  );
}
