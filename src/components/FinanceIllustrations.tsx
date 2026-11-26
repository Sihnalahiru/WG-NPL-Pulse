import { motion } from 'motion/react';

export function PulseLogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="32"
        height="32"
        rx="9"
        className="fill-blue-600 dark:fill-blue-500"
      />
      <motion.path
        d="M7 19H12L15 11L19.5 25L23 16L25.5 19H29"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0.2, opacity: 0.7 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

export function FinancePortfolioIllustration({
  className = 'w-full max-w-[260px] h-auto',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 320 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="16"
        y="20"
        width="288"
        height="160"
        rx="16"
        className="fill-slate-100/80 dark:fill-slate-800/60 stroke-slate-200 dark:stroke-slate-700"
        strokeWidth="1.5"
      />
      {/* Subtle Grid Lines */}
      <line
        x1="40"
        y1="62"
        x2="280"
        y2="62"
        className="stroke-slate-200 dark:stroke-slate-700"
        strokeDasharray="4 4"
      />
      <line
        x1="40"
        y1="100"
        x2="280"
        y2="100"
        className="stroke-slate-200 dark:stroke-slate-700"
        strokeDasharray="4 4"
      />
      <line
        x1="40"
        y1="138"
        x2="280"
        y2="138"
        className="stroke-slate-200 dark:stroke-slate-700"
      />

      {/* Animated Bars */}
      <motion.rect
        x="56"
        y="84"
        width="24"
        height="54"
        rx="4"
        className="fill-blue-500/80"
        initial={{ scaleY: 0, originY: 1 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5, delay: 0.05 }}
      />
      <motion.rect
        x="96"
        y="68"
        width="24"
        height="70"
        rx="4"
        className="fill-sky-500/80"
        initial={{ scaleY: 0, originY: 1 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5, delay: 0.12 }}
      />
      <motion.rect
        x="136"
        y="52"
        width="24"
        height="86"
        rx="4"
        className="fill-amber-500/90"
        initial={{ scaleY: 0, originY: 1 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5, delay: 0.19 }}
      />
      <motion.rect
        x="176"
        y="94"
        width="24"
        height="44"
        rx="4"
        className="fill-emerald-500/90"
        initial={{ scaleY: 0, originY: 1 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.5, delay: 0.26 }}
      />

      {/* Recovery Pulse Trajectory */}
      <motion.path
        d="M48 118C76 112 96 86 128 82C154 78 176 96 206 72C226 56 248 48 272 44"
        className="stroke-blue-600 dark:stroke-blue-400"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Shield Icon Accent */}
      <motion.g
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.3 }}
      >
        <rect
          x="224"
          y="78"
          width="54"
          height="54"
          rx="12"
          className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-700"
          strokeWidth="1.5"
        />
        <path
          d="M251 91L264 96.5V105.5C264 113.4 258.5 120.6 251 123C243.5 120.6 238 113.4 238 105.5V96.5L251 91Z"
          className="fill-emerald-500/15 stroke-emerald-600 dark:stroke-emerald-400"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M246 106.5L249.5 110L256.5 102.5"
          className="stroke-emerald-600 dark:stroke-emerald-400"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
    </svg>
  );
}

export function StrategyHeroIllustration({
  className = 'w-48 h-auto',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 260 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="10"
        y="12"
        width="240"
        height="126"
        rx="16"
        className="fill-blue-50/70 dark:fill-slate-800/70 stroke-blue-200/70 dark:stroke-slate-700"
        strokeWidth="1.5"
      />
      {/* Connecting Network Lines (Office Type -> RO hierarchy) */}
      <motion.path
        d="M130 44V64M130 64L68 88M130 64L130 88M130 64L192 88"
        className="stroke-blue-400 dark:stroke-blue-500"
        strokeWidth="1.8"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Top Main Node: Office Type */}
      <motion.g
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <rect
          x="84"
          y="24"
          width="92"
          height="24"
          rx="8"
          className="fill-blue-600 dark:fill-blue-500"
        />
        <rect x="94" y="33" width="46" height="6" rx="3" fill="#FFFFFF" fillOpacity="0.9" />
        <circle cx="160" cy="36" r="4" fill="#93C5FD" />
      </motion.g>

      {/* Nested RO Nodes */}
      {[
        { x: 34, accent: 'fill-emerald-500', bar: 'w-7' },
        { x: 96, accent: 'fill-amber-500', bar: 'w-9' },
        { x: 158, accent: 'fill-red-500', bar: 'w-6' },
      ].map((node, idx) => (
        <motion.g
          key={node.x}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 + idx * 0.08 }}
        >
          <rect
            x={node.x}
            y="88"
            width="68"
            height="34"
            rx="8"
            className="fill-white dark:fill-slate-900 stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="1.2"
          />
          <circle cx={node.x + 12} cy="100" r="4" className={node.accent} />
          <rect
            x={node.x + 21}
            y="97"
            width="36"
            height="5"
            rx="2.5"
            className="fill-slate-300 dark:fill-slate-600"
          />
          <rect
            x={node.x + 10}
            y="110"
            width="48"
            height="4"
            rx="2"
            className="fill-slate-200 dark:fill-slate-700"
          />
        </motion.g>
      ))}
    </svg>
  );
}

export function SecurityVaultIllustration({
  className = 'w-14 h-14',
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="16"
        className="fill-blue-50 dark:fill-blue-950/60 stroke-blue-200 dark:stroke-blue-800"
        strokeWidth="1.5"
      />
      <motion.path
        d="M32 14L46 20V31.5C46 40.3 39.8 48.2 32 50.8C24.2 48.2 18 40.3 18 31.5V20L32 14Z"
        className="fill-blue-600/15 stroke-blue-600 dark:stroke-blue-400"
        strokeWidth="2"
        strokeLinejoin="round"
        initial={{ scale: 0.9, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35 }}
      />
      <rect
        x="26"
        y="29"
        width="12"
        height="10"
        rx="2.5"
        className="fill-blue-600 dark:fill-blue-400"
      />
      <path
        d="M28.5 29V26C28.5 24.1 30.1 22.5 32 22.5C33.9 22.5 35.5 24.1 35.5 26V29"
        className="stroke-blue-600 dark:stroke-blue-400"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

