/** Light-mode beige + forest green design tokens (charts, 3D, status). */

export const theme = {
  canvas: "#F5EFE6",
  canvasDeep: "#E8DFD3",
  surface: "#FBF8F4",
  surfaceElevated: "#FFFFFF",
  fg: "#1A3328",
  fgMuted: "#4D6358",
  fgSubtle: "#7A8F82",
  accent: "#2F5E45",
  accentBright: "#3D7A5C",
  accentLight: "#6BA888",
  accentGold: "#A67C2E",
  accentTeal: "#2D7A6E",
  border: "#D9CEBC",
  borderStrong: "#C4B8A4",
  danger: "#B84A3C",
  warning: "#C4922A",
  success: "#2F5E45",
  sceneBg: "#162920",
  sceneGridPrimary: "#2A4A3A",
  sceneGridSecondary: "#1F3A2E",
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
    active_learner: theme.accent,
    greedy: theme.accentGold,
    coverage_greedy: theme.accentGold,
    uncertainty: theme.accentBright,
    thompson: theme.accentTeal,
    random: theme.danger,
  },
} as const;

export const sceneTheme = {
  background: theme.sceneBg,
  gridPrimary: theme.sceneGridPrimary,
  gridSecondary: theme.sceneGridSecondary,
  greedy: theme.accentGold,
  manualAdded: theme.accentLight,
  manualRemoved: "#5A6F62",
  overlap: "#D4EDDA",
  connectionLine: theme.accentGold,
  blindspot: theme.danger,
} as const;

export function blindspotStatusColor(fraction: number, selected: number): string {
  if (selected === 0) return theme.danger;
  if (fraction < 0.5) return theme.warning;
  return theme.accentBright;
}
