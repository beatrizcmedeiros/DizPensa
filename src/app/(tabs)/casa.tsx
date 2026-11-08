import { useQuery, useStatus } from '@powersync/react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';

import { AppText, Button, Card, Screen, SectionTitle, TextField } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import { useHousehold } from '@/lib/household';
import { db } from '@/lib/powersync/db';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type Member = { id: string; user_id: string; display_name: string; role: string };

export default function HouseholdScreen() {
  const theme = useTheme();
  const status = useStatus();
  const { session } = useSession();
  const { household, userId } = useHousehold();
  const [editingName, setEditingName] = useState(false);
  const [houseName, setHouseName] = useState(household.name);
  const [regenerating, setRegenerating] = useState(false);

  const { data: members } = useQuery<Member>(
    `SELECT id, user_id, display_name, role FROM household_members
     WHERE household_id = ? ORDER BY role DESC, display_name`,
    [household.id],
  );

  async function saveName() {
    if (houseName.trim()) {
      await db.execute(`UPDATE households SET name = ? WHERE id = ?`, [houseName.trim(), household.id]);
    }
    setEditingName(false);
  }

  function shareCode() {
    Share.share({
      message: `Entre na nossa despensa "${household.name}" no app DizPensa com o código ${household.invite_code}`,
    });
  }

  async function regenerateCode() {
    setRegenerating(true);
    const { error } = await supabase.rpc('regenerate_invite_code', { p_household: household.id });
    setRegenerating(false);
    if (error) Alert.alert('Sem conexão', 'Para trocar o código é preciso estar com internet.');
  }

  function signOut() {
    Alert.alert('Sair da conta?', 'Os dados ficam salvos na nuvem e voltam quando você entrar de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  const syncLabel = !status.connected
    ? 'Offline — as alterações serão enviadas quando houver internet.'
    : status.dataFlowStatus.uploading || status.dataFlowStatus.downloading
      ? 'Sincronizando…'
      : `Sincronizado${status.lastSyncedAt ? ` em ${formatDate(status.lastSyncedAt.toISOString())}` : ''}`;

  return (
    <Screen edges={['top']} style={{ paddingBottom: BottomTabInset + Spacing.three }}>
      <AppText type="subtitle">Casa</AppText>

      <Card>
        {editingName ? (
          <>
            <TextField label="Nome da casa" value={houseName} onChangeText={setHouseName} autoFocus />
            <Button title="Salvar" onPress={saveName} />
          </>
        ) : (
          <View style={styles.row}>
            <Text style={[styles.houseName, { color: theme.text }]}>{household.name}</Text>
            <Button title="Renomear" variant="ghost" onPress={() => setEditingName(true)} />
          </View>
        )}
        <AppText type="small" themeColor="textSecondary">
          {syncLabel}
        </AppText>
      </Card>

      <Card>
        <SectionTitle>Convidar alguém</SectionTitle>
        <AppText themeColor="textSecondary" type="small">
          Quem entrar com este código vê e edita a mesma despensa.
        </AppText>
        <Text style={[styles.code, { color: theme.primary }]} selectable>
          {household.invite_code}
        </Text>
        <Button title="Compartilhar código" onPress={shareCode} />
        <Button title="Gerar novo código" variant="ghost" onPress={regenerateCode} loading={regenerating} />
      </Card>

      <Card>
        <SectionTitle>Membros</SectionTitle>
        {members.map((m) => (
          <View key={m.id} style={styles.row}>
            <AppText>
              {m.display_name}
              {m.user_id === userId ? ' (você)' : ''}
            </AppText>
            <AppText type="small" themeColor="textSecondary">
              {m.role === 'owner' ? 'criou a casa' : 'membro'}
            </AppText>
          </View>
        ))}
      </Card>

      <Button title="Categorias" variant="secondary" onPress={() => router.push('/categorias')} />

      <Card>
        <AppText type="small" themeColor="textSecondary">
          Conectado como {session?.user.email}
        </AppText>
        <Button title="Sair da conta" variant="danger" onPress={signOut} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  houseName: { fontSize: 20, fontWeight: '700', flex: 1 },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 6, textAlign: 'center', paddingVertical: Spacing.two },
});
