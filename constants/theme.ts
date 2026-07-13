export const colors = {
  primary: "#6ADA44",
  primaryDark: "#4FAE30",
  danger: "#DC3123",
  black: "#000000",
  white: "#FFFFFF",
  background: "#FFFFFF",
  textPrimary: "#000000",
  textSecondary: "#6B6B6B",
  textOnPrimary: "#000000",
  textOnDark: "#FFFFFF",
  border: "#E5E5E5",
  surface: "#F7F7F7",
  overlay: "rgba(0,0,0,0.2)",
  shadow: "rgba(0,0,0,0.08)",
} as const;

export const fonts = {
  display: "RubikMonoOne_400Regular",
  accent: "Ruluko_400Regular",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 28,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 15,
  lg: 20,
  xl: 27,
  pill: 100,
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

export const BOTTOM_NAV_HEIGHT = 78;
