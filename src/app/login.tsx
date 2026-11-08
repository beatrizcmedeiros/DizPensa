import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/logo';
import { Button, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { authErrorMessage } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) setError(authErrorMessage(error));
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Logo />
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
        autoComplete="password"
        error={error}
      />

      <Button title="Entrar" onPress={signIn} loading={loading} disabled={!email || !password} />
      <Button title="Criar conta" variant="ghost" onPress={() => router.push('/cadastro')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center' },
  header: { marginBottom: Spacing.four },
});
