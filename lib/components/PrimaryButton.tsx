import { Pressable, StyleSheet, Text } from 'react-native';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function PrimaryButton({ label, onPress, disabled = false, variant = 'primary' }: PrimaryButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' ? styles.secondary : null,
        variant === 'danger' ? styles.danger : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.label, variant !== 'primary' ? styles.altLabel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#2f5aff',
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondary: {
    backgroundColor: '#edf1ff',
  },
  danger: {
    backgroundColor: '#ffeef0',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  label: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  altLabel: {
    color: '#1f2d5c',
  },
});
