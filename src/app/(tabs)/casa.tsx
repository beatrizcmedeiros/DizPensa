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
  const myRole = members.find((m) => m.user_id === userId)?.role;

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

  async function signOut() {
    // Sair apaga os dados do aparelho. Se ainda há alterações que não subiram
    // (ex.: sem internet), elas seriam perdidas.
    const pending = await db.getUploadQueueStats();
    if (pending.count > 0) {
      Alert.alert(
        'Alterações não enviadas',
        `Há ${pending.count} alteração(ões) que ainda não foram para a nuvem. Se sair agora, elas serão perdidas. Conecte-se à internet e espere sincronizar antes de sair.`,
        [
          { text: 'Esperar', style: 'cancel' },
          { text: 'Sair mesmo assim', style: 'destructive', onPress: () => supabase.auth.signOut() },
        ],
      );
      return;
    }
    Alert.alert('Sair da conta?', 'Os dados ficam salvos na nuvem e voltam quando você entrar de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  function leaveHousehold() {
    const others = members.filter((m) => m.user_id !== userId);
    const isOnlyOwner = myRole === 'owner' && !others.some((m) => m.role === 'owner');
    Alert.alert(
      'Sair da casa?',
      isOnlyOwner && others.length > 0
        ? 'Você criou esta casa. Os outros membros continuam com acesso, mas ninguém mais poderá remover membros.'
        : others.length === 0
          ? 'Você é a única pessoa da casa. Os dados ficam guardados, mas só voltam se alguém entrar com o código.'
          : 'Você deixa de ver esta despensa. Para voltar, precisa do código de convite.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair da casa',
          style: 'destructive',
          onPress: () =>
            db.execute(`DELETE FROM household_members WHERE household_id = ? AND user_id = ?`, [
              household.id,
              userId,
            ]),
        },
      ],
    );
  }

  function removeMember(member: Member) {
    Alert.alert(`Remover ${member.display_name}?`, 'A pessoa deixa de ver e editar esta despensa.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => db.execute(`DELETE FROM household_members WHERE id = ?`, [member.id]),
      },
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
            {myRole === 'owner' && m.user_id !== userId ? (
              <Button title="Remover" variant="ghost" onPress={() => removeMember(m)} />
            ) : (
              <AppText type="small" themeColor="textSecondary">
                {m.role === 'owner' ? 'criou a casa' : 'membro'}
              </AppText>
            )}
          </View>
        ))}
        <Button title="Sair da casa" variant="ghost" onPress={leaveHousehold} />
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
