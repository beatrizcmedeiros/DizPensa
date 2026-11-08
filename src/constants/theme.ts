import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1B1F1C',
    textSecondary: '#5E665F',
    background: '#FAFAF7',
    backgroundElement: '#EFF1EC',
    backgroundSelected: '#DDE8DA',
    card: '#FFFFFF',
    border: '#DADFD6',
    primary: '#2F7D4F',
    onPrimary: '#FFFFFF',
    danger: '#C0392B',
    warning: '#B7791F',
  },
  dark: {
    text: '#ECEFEA',
    textSecondary: '#A3ABA4',
    background: '#111412',
    backgroundElement: '#1C211E',
    backgroundSelected: '#26402F',
    card: '#181C19',
    border: '#2C332E',
    primary: '#5DBB82',
    onPrimary: '#0B1A11',
    danger: '#F0776A',
    warning: '#E0B054',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 12,
  large: 20,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
