import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const icon = require('@/assets/logo/icon-512.png');

/** Ícone do app com cantos arredondados. */
export function LogoIcon({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={icon}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, borderRadius: size * 0.24 }}
    />
  );
}

/** Nome "DizPensa" no estilo da logo: "Diz" na cor do texto e "Pensa" em amarelo. */
export function Wordmark({ size = 32 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{ fontSize: size, lineHeight: size * 1.2, fontWeight: '800', color: theme.text }}>
      Diz<Text style={{ color: theme.accent }}>Pensa</Text>
    </Text>
  );
}

/** Logo completa para as telas de entrada: ícone, nome e frase. */
export function Logo({ tagline = 'Sua despensa compartilhada' }: { tagline?: string | null }) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <LogoIcon size={88} />
      <Wordmark size={36} />
      {tagline ? <Text style={[styles.tagline, { color: theme.textSecondary }]}>{tagline}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8 },
  tagline: { fontSize: 16 },
});
