import { useQuery } from '@powersync/react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText, Card, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney, formatQuantity } from '@/lib/format';
import type { UnitType } from '@/lib/powersync/schema';

type Purchase = {
  id: string;
  source: string;
  store_name: string | null;
  store_cnpj: string | null;
  purchased_at: string;
  total: number | null;
  who: string | null;
};

type Item = {
  id: string;
  product_id: string | null;
  product_name: string | null;
  unit_type: UnitType | null;
  brand: string | null;
  raw_description: string | null;
  quantity: number;
  total_price: number | null;
};

export default function PurchaseScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: purchases, isLoading } = useQuery<Purchase>(
    `SELECT p.id, p.source, p.store_name, p.store_cnpj, p.purchased_at, p.total, m.display_name AS who
     FROM purchases p
     LEFT JOIN household_members m ON m.user_id = p.created_by AND m.household_id = p.household_id
     WHERE p.id = ?`,
    [id],
  );
  const { data: items } = useQuery<Item>(
    `SELECT i.id, i.product_id, pr.name AS product_name, pr.unit_type, v.brand,
            i.raw_description, i.quantity, i.total_price
     FROM purchase_items i
     LEFT JOIN products pr ON pr.id = i.product_id
     LEFT JOIN product_variants v ON v.id = i.variant_id
     WHERE i.purchase_id = ?
     ORDER BY pr.name`,
    [id],
  );

  const purchase = purchases[0];
  if (!purchase) return <Loading message={isLoading ? undefined : 'Compra não encontrada.'} />;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: purchase.store_name ?? 'Compra' }} />
      <Card>
        <AppText type="smallBold">{purchase.store_name ?? 'Compra'}</AppText>
        <AppText type="small" themeColor="textSecondary">
          {formatDate(purchase.purchased_at)}
          {purchase.who ? ` · lançada por ${purchase.who}` : ''}
          {purchase.source === 'nfce' ? ' · nota fiscal' : ' · manual'}
        </AppText>
        <Text style={[styles.total, { color: theme.text }]}>{formatMoney(purchase.total)}</Text>
      </Card>

      <Card>
        {items.map((item) => (
          <Pressable
            key={item.id}
            disabled={!item.product_id}
            onPress={() =>
              item.product_id && router.push({ pathname: '/produto/[id]', params: { id: item.product_id } })
            }
            style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>
                {item.product_name ?? item.raw_description ?? 'Item'}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                {formatQuantity(item.quantity, item.unit_type ?? 'package')}
                {item.brand ? ` · ${item.brand}` : ''}
              </Text>
            </View>
            <Text style={{ color: theme.text }}>{formatMoney(item.total_price)}</Text>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { fontSize: 28, fontWeight: '700', marginTop: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
});
