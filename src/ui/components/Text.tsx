import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, Text as RNText, TextProps, TextStyle } from 'react-native';
import { color, spacing, typography } from '@/src/ui/tokens';
import { isUiFontEnabled } from '@/src/ui/fontState';

export type TextVariant = 'display' | 'h1' | 'h2' | 'body' | 'caption' | 'muted';
export type TextTone = 'default' | 'secondary' | 'accent' | 'danger' | 'success';

type Props = PropsWithChildren<
  TextProps & {
    variant?: TextVariant;
    tone?: TextTone;
    compact?: boolean;
    style?: StyleProp<TextStyle>;
  }
>;

const variantStyles: Record<TextVariant, TextStyle> = {
  display: {
    fontSize: typography.sizes[34] - 2,
    lineHeight: typography.sizes[34] + spacing[4] - 4,
    fontWeight: typography.weights[700],
    color: color.text,
    letterSpacing: 0.2,
  },
  h1: {
    fontSize: typography.sizes[24] - 2,
    lineHeight: typography.sizes[24] + spacing[4] - 2,
    fontWeight: typography.weights[700],
    color: color.text,
    letterSpacing: 0.15,
  },
  h2: {
    fontSize: typography.sizes[18] - 1,
    lineHeight: typography.sizes[18] + spacing[4],
    fontWeight: typography.weights[600],
    color: color.text,
  },
  body: {
    fontSize: typography.sizes[16] - 1,
    lineHeight: typography.sizes[16] + spacing[4],
    fontWeight: typography.weights[400],
    color: color.text,
  },
  caption: {
    fontSize: typography.sizes[13] - 1,
    lineHeight: typography.sizes[13] + spacing[4] - 1,
    fontWeight: typography.weights[500],
    color: color.text,
    letterSpacing: 0.35,
  },
  muted: {
    fontSize: typography.sizes[13] - 1,
    lineHeight: typography.sizes[13] + spacing[4] - 1,
    fontWeight: typography.weights[400],
    color: color.textSecondary,
  },
};

const toneStyles: Record<TextTone, TextStyle> = {
  default: { color: color.text },
  secondary: { color: color.textSecondary },
  accent: { color: color.accent },
  danger: { color: color.danger },
  success: { color: color.success },
};

export function Text({ variant = 'body', tone = 'default', compact = false, style, children, ...rest }: Props) {
  const useCustomFont = isUiFontEnabled();
  const weight = variantStyles[variant].fontWeight;

  const fontFamilyStyle: TextStyle | null = useCustomFont
    ? weight === typography.weights[700]
      ? { fontFamily: 'Quicksand_700Bold', fontWeight: undefined }
      : weight === typography.weights[600]
        ? { fontFamily: 'Quicksand_600SemiBold', fontWeight: undefined }
        : weight === typography.weights[500]
          ? { fontFamily: 'Quicksand_500Medium', fontWeight: undefined }
          : { fontFamily: 'Quicksand_400Regular', fontWeight: undefined }
    : null;

  const compactStyle = compact
    ? {
        lineHeight: Math.max(typography.sizes[13] + spacing[4], (variantStyles[variant].lineHeight ?? 0) - spacing[4]),
      }
    : null;

  return (
    <RNText
      {...rest}
      allowFontScaling={false}
      maxFontSizeMultiplier={1}
      style={[styles.base, variantStyles[variant], fontFamilyStyle, toneStyles[tone], compactStyle, style]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    color: color.text,
  },
});
