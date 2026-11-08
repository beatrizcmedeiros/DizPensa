import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoIcon } from '@/components/logo';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { authErrorMessage } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function signUp() {
    setError(null);
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não conferem.');

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);

    if (error) return setError(authErrorMessage(error));
    // Se o Supabase exigir confirmação de e-mail, não vem sessão ainda.
    if (!data.session) setNeedsConfirmation(true);
  }

  if (needsConfirmation) {
    return (
      <Screen style={styles.container}>
        <Card>
          <AppText type="smallBold">Confirme seu e-mail</AppText>
          <AppText themeColor="textSecondary">
            Enviamos um link para {email.trim()}. Depois de confirmar, volte e entre com sua senha.
          </AppText>
        </Card>
        <Button title="Ir para o login" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <LogoIcon size={64} />
        <AppText type="subtitle">Criar conta</AppText>
      </View>
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        hint="Pelo menos 8 caracteres"
      />
      <TextField
        label="Repita a senha"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        error={error}
      />
      <Button
        title="Criar conta"
        onPress={signUp}
        loading={loading}
        disabled={!email || !password || !confirm}
      />
      <Button title="Já tenho conta" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.three },
});
