/**
 * Chart + status palette for the Mekdela Amba University design system.
 *
 * Mirrors the CSS custom properties in src/styles/theme.css. Use these for
 * anything Chart.js needs (canvas cannot read CSS variables).
 *
 * Ramp rules:
 *  - Six categorical colours maximum, led by the primary #2563EB.
 *  - Every slot clears 3:1 against a white card (WCAG 1.4.11). The warning
 *    and info slots use their 600-weight steps: #F59E0B is 2.15:1 and
 *    #0EA5D9 is 2.84:1 on white, so neither works as a chart mark.
 *  - Grid lines are #E5E7EB.
 *  - Status always means the same colour: red is never used for anything
 *    other than danger.
 */

export const CHART_PALETTE = [
  '#2563EB', // 1 primary blue   5.17:1 on white
  '#D97706', // 2 warning amber  3.19:1
  '#6B7280', // 3 neutral        4.83:1
  '#16A34A', // 4 success green  3.30:1
  '#0E7490', // 5 info cyan      5.36:1
  '#DC2626'  // 6 danger red     4.83:1
];

export const CHART_GRID = '#E5E7EB';

export const CHART_TEXT = {
  primary: '#111827',
  secondary: '#4B5563',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  grid: CHART_GRID,
  fill: 'rgba(37, 99, 235, 0.16)'
};

/** Repeats the ramp in order — use when a series count exceeds six. */
export const cyclePalette = (length) =>
  Array.from({ length: Math.max(0, length) }, (_, index) => CHART_PALETTE[index % CHART_PALETTE.length]);

/** Soft KPI icon-square backgrounds. */
export const KPI_ICON_TONES = {
  primary: { background: '#DBEAFE', foreground: '#1D4ED8' },
  success: { background: '#DCFCE7', foreground: '#15803D' },
  warning: { background: '#FEF3C7', foreground: '#B45309' },
  danger:  { background: '#FEE2E2', foreground: '#B91C1C' }
};

/** Notification / alert tones: left rail + soft fill + readable text. */
export const NOTIFICATION_TONES = {
  danger:  { rail: '#991B1B', background: '#FEE2E2', text: '#991B1B' },
  warning: { rail: '#92400E', background: '#FEF3C7', text: '#92400E' },
  info:    { rail: '#075985', background: '#E0F2FE', text: '#075985' },
  success: { rail: '#166534', background: '#DCFCE7', text: '#166534' },
  neutral: { rail: '#374151', background: '#F3F4F6', text: '#374151' }
};
