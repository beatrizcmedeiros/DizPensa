import { useStatus } from '@powersync/react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoIcon } from '@/components/logo';
import { AppText, Button, Card, Chip, Loading, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Mode = 'criar' | 'entrar';

/**
 * Primeira tela depois do login: criar uma casa nova ou entrar
 * na casa de alguém com o código de convite.
 */
export default function NewHouseholdScreen() {
  const status = useStatus();
  const [mode, setMode] = useState<Mode>('criar');
  const [displayName, setDisplayName] = useState('');
  const [houseName, setHouseName] = useState('Minha casa');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [waitingSync, setWaitingSync] = useState(false);

  // Logo após o login ainda não sabemos se a pessoa já tem casa:
  // esperamos a primeira sincronização.
  if (!status.hasSynced) {
    return (
      <Loading
        message={
          status.connected
            ? 'Sincronizando seus dados…'
            : 'Conectando… Na primeira vez é preciso estar com internet.'
        }
      />
    );
  }

  if (waitingSync) {
    return <Loading message="Preparando sua casa…" />;
  }

  async function submit() {
    setError(null);
    if (!displayName.trim()) return setError('Diga como quer ser chamado(a).');
    setLoading(true);

    const { error } =
      mode === 'criar'
        ? await supabase.rpc('create_household', {
            p_name: houseName.trim() || 'Minha casa',
            p_display_name: displayName.trim(),
          })
        : await supabase.rpc('join_household', {
            p_code: code.trim(),
            p_display_name: displayName.trim(),
          });

    setLoading(false);
    if (error) {
      if (error.message.includes('invalid invite code')) {
        setError('Código de convite não encontrado.');
      } else {
        setError('Não foi possível concluir. Verifique a internet e tente de novo.');
      }
      return;
    }
    // A casa chega pelo PowerSync em instantes; a navegação troca sozinha.
    setWaitingSync(true);
  }

  return (
    <Screen style={styles.container}>
      <View style={{ gap: Spacing.two }}>
        <LogoIcon size={64} />
        <AppText type="subtitle">Sua casa</AppText>
        <AppText themeColor="textSecondary">
          A despensa é compartilhada por todos da casa. Crie uma nova ou entre com o código que
          alguém da casa te passou.
        </AppText>
      </View>

      <View style={styles.row}>
        <Chip label="Criar casa" selected={mode === 'criar'} onPress={() => setMode('criar')} />
        <Chip label="Tenho um código" selected={mode === 'entrar'} onPress={() => setMode('entrar')} />
      </View>

      <Card>
        <TextField label="Seu nome" value={displayName} onChangeText={setDisplayName} />
        {mode === 'criar' ? (
          <TextField label="Nome da casa" value={houseName} onChangeText={setHouseName} />
        ) : (
          <TextField
            label="Código de convite"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            maxLength={6}
            placeholder="Ex.: K7M2QX"
          />
        )}
      </Card>

      {error ? <AppText themeColor="danger">{error}</AppText> : null}

      <Button
        title={mode === 'criar' ? 'Criar casa' : 'Entrar na casa'}
        onPress={submit}
        loading={loading}
        disabled={mode === 'entrar' && code.trim().length < 6}
      />
      <Button title="Sair da conta" variant="ghost" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', gap: Spacing.two },
});
