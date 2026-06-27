/** Light-mode beige + forest green design tokens (charts, 3D, status). */

export const theme = {
  canvas: "#F4EDE4",
  surface: "#FAF7F2",
  surfaceElevated: "#FFFFFF",
  fg: "#1B3A2D",
  fgMuted: "#5A6F62",
  fgSubtle: "#8A9A8F",
  accent: "#2D6A4F",
  accentBright: "#40916C",
  accentLight: "#74C69D",
  accentGold: "#B8860B",
  accentTeal: "#2A9D8F",
  border: "#D4C9B8",
  borderStrong: "#B8A898",
  danger: "#C44D3F",
  warning: "#D4A017",
  success: "#2D6A4F",
  sceneBg: "#1A2E26",
} as const;

export const chartTheme = {
  grid: theme.border,
  axis: theme.fgMuted,
  tooltipBg: theme.surfaceElevated,
  tooltipBorder: theme.border,
  coverage: theme.accent,
  validation: theme.accentBright,
  reference: theme.fgSubtle,
  currentLine: theme.accentGold,
  manualDot: theme.accentTeal,
  policies: {
    coverage_greedy: theme.accentGold,
    uncertainty: theme.accentBright,
    thompson: theme.accentTeal,
    random: theme.danger,
  },
} as const;

export const sceneTheme = {
  background: theme.sceneBg,
  greedy: "#D4A017",
  manualAdded: "#52B788",
  manualRemoved: "#4A5D52",
  overlap: "#E8F5E9",
  connectionLine: "#D4A017",
  blindspot: "#C44D3F",
} as const;

export function blindspotStatusColor(fraction: number, selected: number): string {
  if (selected === 0) return theme.danger;
  if (fraction < 0.5) return theme.warning;
  return theme.accentBright;
}
