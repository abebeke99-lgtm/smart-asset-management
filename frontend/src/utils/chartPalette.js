/**
 * Chart + status palette for the Mekdela Amba University design system.
 *
 * Mirrors the CSS custom properties in src/styles/theme.css. Use these for
 * anything Chart.js needs (canvas cannot read CSS variables).
 *
 * Ramp rules:
 *  - Six categorical colours maximum, led by the primary #3074B3.
 *  - Every slot clears 3:1 against a white card (WCAG 1.4.11). The warning
 *    slot uses its 600-weight step: #D97706 (3.19:1) instead of a lighter
 *    amber that would fail contrast as a chart mark.
 *  - Grid lines are #E2E8F0.
 *  - Status always means the same colour: red is never used for anything
 *    other than danger.
 */

export const CHART_PALETTE = [
  '#3074B3', // 1 primary blue   4.91:1 on white
  '#D97706', // 2 warning amber  3.19:1
  '#64748B', // 3 neutral        4.76:1
  '#16A34A', // 4 success green  3.30:1
  '#0E7490', // 5 info cyan      5.36:1
  '#DC2626'  // 6 danger red     4.83:1
];

export const CHART_GRID = '#E2E8F0';

export const CHART_TEXT = {
  primary: '#1F2937',
  secondary: '#64748B',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  grid: CHART_GRID,
  fill: 'rgba(48, 116, 179, 0.16)'
};

/** Repeats the ramp in order — use when a series count exceeds six. */
export const cyclePalette = (length) =>
  Array.from({ length: Math.max(0, length) }, (_, index) => CHART_PALETTE[index % CHART_PALETTE.length]);

/** Soft KPI icon-square backgrounds. */
export const KPI_ICON_TONES = {
  primary: { background: '#EAF2FA', foreground: '#245783' },
  success: { background: '#DCFCE7', foreground: '#15803D' },
  warning: { background: '#FDF3E7', foreground: '#B45309' },
  danger:  { background: '#FEE2E2', foreground: '#B91C1C' }
};

/** Notification / alert tones: left rail + soft fill + readable text. */
export const NOTIFICATION_TONES = {
  danger:  { rail: '#991B1B', background: '#FEE2E2', text: '#991B1B' },
  warning: { rail: '#92400E', background: '#FEF3C7', text: '#92400E' },
  info:    { rail: '#075985', background: '#EAF2FA', text: '#075985' },
  success: { rail: '#166534', background: '#DCFCE7', text: '#166534' },
  neutral: { rail: '#374151', background: '#F5F7FA', text: '#374151' }
};
