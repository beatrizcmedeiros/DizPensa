import { useQuery } from '@powersync/react-native';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney } from '@/lib/format';
import { useHousehold } from '@/lib/household';

type PurchaseRow = {
  id: string;
  source: 'manual' | 'nfce';
  store_name: string | null;
  purchased_at: string;
  total: number | null;
  items: number;
};

export default function PurchasesScreen() {
  const theme = useTheme();
  const { household } = useHousehold();

  const { data: purchases } = useQuery<PurchaseRow>(
    `SELECT p.id, p.source, p.store_name, p.purchased_at, p.total,
            (SELECT COUNT(*) FROM purchase_items i WHERE i.purchase_id = p.id) AS items
     FROM purchases p
     WHERE p.household_id = ?
     ORDER BY p.purchased_at DESC
     LIMIT 200`,
    [household.id],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={purchases}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.four }}
        ListHeaderComponent={
          <View style={{ gap: Spacing.three, marginBottom: Spacing.two }}>
            <AppText type="subtitle">Compras</AppText>
            <Button title="Ler nota fiscal (QR code)" onPress={() => router.push('/nota/ler')} />
            <Button title="Lançar produto manualmente" variant="secondary" onPress={() => router.push('/produto/novo')} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/compra/[id]', params: { id: item.id } })}
            style={({ pressed }) => [
              styles.item,
              { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
            ]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {item.store_name ?? (item.source === 'nfce' ? 'Nota fiscal' : 'Lançamento manual')}
              </Text>
              <Text style={{ color: theme.textSecondary }}>
                {formatDate(item.purchased_at)} · {item.items} {item.items === 1 ? 'item' : 'itens'}
              </Text>
            </View>
            <Text style={[styles.total, { color: theme.text }]}>{formatMoney(item.total)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <AppText themeColor="textSecondary" style={{ textAlign: 'center', padding: Spacing.four }}>
            Nenhuma compra ainda. Leia o QR code da próxima nota do mercado.
          </AppText>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
  },
  title: { fontSize: 16, fontWeight: '600' },
  total: { fontSize: 16, fontWeight: '700' },
});
