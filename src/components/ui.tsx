import { type AndroidSymbol, SymbolView } from 'expo-symbols';
import { type PropsWithChildren, type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
      {/* Encolhe a tela quando o teclado abre, para o campo em foco não ficar escondido. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {content}
      </KeyboardAvoidingView>
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
  /** Nome do ícone (Material Symbols) ou um elemento pronto. */
  icon?: string | ReactNode;
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
          {typeof icon === 'string' ? <Icon name={icon} size={22} color={fg} /> : icon}
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
  secureTextEntry,
  ...props
}: TextInputProps & { label?: string; hint?: string; error?: string | null }) {
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  return (
    <View style={{ gap: Spacing.one }}>
      {label ? <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text> : null}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: theme.card,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}>
        <TextInput
          placeholderTextColor={theme.textSecondary}
          style={[styles.inputText, { color: theme.text }, style]}
          secureTextEntry={secureTextEntry && !showPassword}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Esconder senha' : 'Mostrar senha'}
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
            style={styles.inputAction}>
            <Icon
              name={showPassword ? 'visibility_off' : 'visibility'}
              size={22}
              color={theme.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
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
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
}) {
  const theme = useTheme();
  const color = selected ? theme.primary : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.backgroundSelected : theme.card,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}>
      {icon ? <Icon name={icon} size={18} color={color} /> : null}
      <Text style={{ color, fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

/** Ícone do Material Symbols (Android). Nomes em https://fonts.google.com/icons */
export function Icon({ name, size = 24, color }: { name: string; size?: number; color?: string }) {
  const theme = useTheme();
  return (
    <SymbolView
      name={{ android: name as AndroidSymbol, web: name as AndroidSymbol }}
      size={size}
      tintColor={color ?? theme.text}
      style={{ width: size, height: size }}
    />
  );
}

/** Botão só com ícone, com área de toque de 48px. */
export function IconButton({
  icon,
  label,
  onPress,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={24} color={color} />
    </Pressable>
  );
}

export type StockStatus = 'tem' | 'acabando' | 'acabou';

/** Selo com a situação do estoque: cor + texto (nunca só cor). */
export function StatusBadge({ status, label }: { status: StockStatus; label: string }) {
  const theme = useTheme();
  const colors = {
    tem: { bg: theme.successBg, fg: theme.successText },
    acabando: { bg: theme.warningBg, fg: theme.warningText },
    acabou: { bg: theme.dangerBg, fg: theme.dangerText },
  }[status];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.fg, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Quadradinho com o ícone da categoria. */
export function CategoryIcon({ icon, size = 40 }: { icon: string | null; size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: theme.iconBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={icon || 'category'} size={size * 0.55} color={theme.primary} />
    </View>
  );
}

/** Escolha entre poucas opções lado a lado (ex.: Unidade / Peso). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: theme.card }]}>
            <Text style={{ color: selected ? theme.text : theme.textSecondary, fontWeight: '600', fontSize: 15 }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Quantidade com botões − e +. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  format = (v: number) => String(v),
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  format?: (v: number) => string;
}) {
  const theme = useTheme();
  const btn = (icon: string, label: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(Math.round(next * 1000) / 1000)}
      style={({ pressed }) => [
        styles.stepperBtn,
        { backgroundColor: theme.backgroundElement, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}>
      <Icon name={icon} size={24} color={theme.text} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn('remove', 'Diminuir', value - step, value - step < min)}
      <Text
        accessibilityLiveRegion="polite"
        style={{ color: theme.text, fontSize: 20, fontWeight: '700', minWidth: 72, textAlign: 'center' }}>
        {format(value)}
      </Text>
      {btn('add', 'Aumentar', value + step, false)}
    </View>
  );
}

/** Lista de opções que sobe de baixo da tela (ex.: escolher categoria). */
export function OptionSheet({
  visible,
  title,
  options,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { key: string; label: string; icon?: string; selected?: boolean; description?: string }[];
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.card }]}>
        <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: Spacing.two }}>{title}</Text>
        <ScrollView style={{ maxHeight: 420 }}>
          {options.map((o) => (
            <Pressable
              key={o.key}
              accessibilityRole="button"
              accessibilityState={{ selected: o.selected }}
              onPress={() => {
                onSelect(o.key);
                onClose();
              }}
              style={({ pressed }) => [
                styles.sheetRow,
                { backgroundColor: o.selected ? theme.backgroundSelected : pressed ? theme.backgroundElement : 'transparent' },
              ]}>
              {o.icon ? <CategoryIcon icon={o.icon} size={36} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: o.selected ? '700' : '500' }}>{o.label}</Text>
                {o.description ? (
                  <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{o.description}</Text>
                ) : null}
              </View>
              {o.selected ? <Icon name="check" size={22} color={theme.primary} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Tela vazia: um convite com a próxima ação, não um pedido de desculpas. */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.iconBg }]}>
        <Icon name={icon} size={36} color={theme.primary} />
      </View>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>{body}</Text>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={{ alignSelf: 'stretch' }} /> : null}
    </View>
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

export function Loading({ message, children }: PropsWithChildren<{ message?: string }>) {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} size="large" />
      {message ? <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>{message}</Text> : null}
      {children}
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
    fontSize: 14,
    fontWeight: '600',
  },
  inputRow: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.medium,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputText: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  inputAction: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    fontSize: 13,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
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
    fontSize: 16,
    fontWeight: '700',
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.medium,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    padding: Spacing.three,
    paddingTop: Spacing.two,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.three,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.medium,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
});
