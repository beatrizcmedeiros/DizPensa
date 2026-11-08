import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export { ThemedText as AppText } from '@/components/themed-text';

/** Tela com fundo do tema, área segura e rolagem opcional. */
export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  style,
}: PropsWithChildren<{
  scroll?: boolean;
  edges?: ('top' | 'bottom')[];
  style?: ViewStyle;
}>) {
  const theme = useTheme();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.screenContent, style]}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, { flex: 1 }, style]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.background }}>
      {content}
    </SafeAreaView>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const bg = {
    primary: theme.primary,
    secondary: theme.backgroundElement,
    danger: theme.danger,
    ghost: 'transparent',
  }[variant];
  const fg = {
    primary: theme.onPrimary,
    secondary: theme.text,
    danger: '#FFFFFF',
    ghost: theme.primary,
  }[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function TextField({
  label,
  hint,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string; error?: string | null }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      {label ? <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.card,
            borderColor: error ? theme.danger : theme.border,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={[styles.hint, { color: theme.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.backgroundSelected : theme.card,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}>
      <Text style={{ color: selected ? theme.primary : theme.text, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{children}</Text>;
}

export function Loading({ message }: { message?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} size="large" />
      {message ? <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  button: {
    minHeight: 48,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
