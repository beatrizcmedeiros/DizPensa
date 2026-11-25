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
    // amarelo da tampa do pote na logo (um pouco mais escuro para ler no fundo claro)
    accent: '#D9962A',
    // Selos de situação do estoque: fundo claro + texto escuro da mesma cor
    successBg: '#E3F1E7',
    successText: '#1E6B3E',
    warningBg: '#FBEFD6',
    warningText: '#7F530A',
    dangerBg: '#FBE6E3',
    dangerText: '#9E2A1F',
    iconBg: '#E6F0E8',
    toast: '#1B1F1C',
    onToast: '#FFFFFF',
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
    accent: '#F2B544',
    successBg: '#1D3826',
    successText: '#8FD3A6',
    warningBg: '#3B2D10',
    warningText: '#F0C56B',
    dangerBg: '#3F1B18',
    dangerText: '#F59B91',
    iconBg: '#20322A',
    toast: '#ECEFEA',
    onToast: '#111412',
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
