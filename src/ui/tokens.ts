export const spacing = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
} as const;

export const space = {
  pageX: spacing[16],
  pageTop: spacing[8],
  pageBottom: spacing[24],
  sectionGap: spacing[16],
  cardGap: spacing[12],
  controlGap: spacing[8],
  compactGap: spacing[4],
} as const;

export const radii = {
  10: 10,
  14: 14,
  18: 18,
  24: 24,
  32: 32,
} as const;

export const radius = {
  control: radii[10],
  card: radii[14],
  pill: radii[18],
  xl: radii[24],
  xxl: radii[32],
} as const;

export const typography = {
  sizes: {
    34: 34,
    24: 24,
    18: 18,
    16: 16,
    13: 13,
  },
  weights: {
    700: '700',
    600: '600',
    500: '500',
    400: '400',
  },
} as const;

export const colors = {
  bg: '#FFF9F2',
  surface: '#FEFEFE',
  text: '#423833',
  muted: '#8C7B72',
  border: '#F2E7DC',
  accent: '#FF7F50',
  danger: '#EF4444',
  success: '#16A34A',
} as const;

export const color = {
  bg: colors.bg,
  surface: colors.surface,
  surfaceSubtle: '#FFF4EA',
  text: colors.text,
  textSecondary: colors.muted,
  border: colors.border,
  accent: colors.accent,
  accentSoft: '#FFE7DC',
  accentStrong: '#FF6A32',
  danger: colors.danger,
  dangerSoft: '#FFE7E2',
  success: '#00796B',
  successSoft: '#E0F2F1',
  navShadow: '#000000',
} as const;

export const touchTarget = {
  min: 44,
} as const;

export const border = {
  width: 1,
} as const;

export const elevation = {
  shadowOpacity: 0.08,
  shadowRadius: spacing[16],
  shadowOffsetX: 0,
  shadowOffsetY: spacing[4],
  android: spacing[4],
  actionOpacity: 0.24,
  navOpacity: 0.12,
} as const;

export const motion = {
  pressDuration: 100,
  listEnterDuration: 220,
  easeScaleButton: 0.985,
  easeScaleCard: 0.992,
} as const;
