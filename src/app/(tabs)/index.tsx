import { useQuery } from '@powersync/react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Chip, TextField } from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatQuantity } from '@/lib/format';
import { useHousehold } from '@/lib/household';
import type { UnitType } from '@/lib/powersync/schema';
import { consume } from '@/lib/stock';

type PantryRow = {
  id: string;
  name: string;
  unit_type: UnitType;
  min_quantity: number;
  category_id: string | null;
  category_name: string | null;
  quantity: number;
};

type StockFilter = 'todos' | 'tem' | 'acabando' | 'acabou';

const FILTERS: { key: StockFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'tem', label: 'Em estoque' },
  { key: 'acabando', label: 'Acabando' },
  { key: 'acabou', label: 'Acabou' },
];

function stockState(row: PantryRow): 'tem' | 'acabando' | 'acabou' {
  if (row.quantity <= 0) return 'acabou';
  if (row.min_quantity > 0 && row.quantity <= row.min_quantity) return 'acabando';
  return 'tem';
}

export default function PantryScreen() {
  const theme = useTheme();
  const { household, userId } = useHousehold();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StockFilter>('todos');

  const { data: products } = useQuery<PantryRow>(
    `SELECT p.id, p.name, p.unit_type, p.min_quantity, p.category_id,
            c.name AS category_name, COALESCE(c.sort_order, 999) AS cat_order,
            COALESCE((SELECT SUM(l.quantity_remaining) FROM stock_lots l
                      WHERE l.product_id = p.id AND l.quantity_remaining > 0), 0) AS quantity
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.household_id = ? AND p.archived = 0
     ORDER BY cat_order, c.name, p.name COLLATE NOCASE`,
    [household.id],
  );

  const { data: categories } = useQuery<{ id: string; name: string }>(
    `SELECT id, name FROM categories WHERE household_id = ? ORDER BY sort_order, name`,
    [household.id],
  );

  const sections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (categoryId && p.category_id !== categoryId) return false;
      if (filter !== 'todos' && stockState(p) !== filter) return false;
      return true;
    });
    const groups = new Map<string, PantryRow[]>();
    for (const p of filtered) {
      const key = p.category_name ?? 'Sem categoria';
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [products, search, categoryId, filter]);

  const totalProducts = products.length;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.header}>
        <AppText type="subtitle">Despensa</AppText>
        <TextField placeholder="Buscar produto" value={search} onChangeText={setSearch} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Todas categorias" selected={!categoryId} onPress={() => setCategoryId(null)} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
        </ScrollView>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.three, paddingBottom: BottomTabInset + 96 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <PantryItem
            item={item}
            onPress={() => router.push({ pathname: '/produto/[id]', params: { id: item.id } })}
            onQuickConsume={() =>
              consume({ householdId: household.id, userId, productId: item.id, quantity: 1 })
            }
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText themeColor="textSecondary" style={{ textAlign: 'center' }}>
              {totalProducts === 0
                ? 'Sua despensa está vazia. Toque em + para adicionar o primeiro produto.'
                : 'Nenhum produto encontrado com esses filtros.'}
            </AppText>
          </View>
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adicionar produto"
        onPress={() => router.push('/produto/novo')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Text style={[styles.fabText, { color: theme.onPrimary }]}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function PantryItem({
  item,
  onPress,
  onQuickConsume,
}: {
  item: PantryRow;
  onPress: () => void;
  onQuickConsume: () => void;
}) {
  const theme = useTheme();
  const state = stockState(item);
  const qtyColor =
    state === 'acabou' ? theme.danger : state === 'acabando' ? theme.warning : theme.text;
  const canQuickConsume = item.unit_type === 'package' && item.quantity >= 1;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: qtyColor, fontWeight: '600' }}>
          {state === 'acabou' ? 'Acabou' : formatQuantity(item.quantity, item.unit_type)}
          {state === 'acabando' ? ' · acabando' : ''}
        </Text>
      </View>
      {canQuickConsume ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dar baixa de 1 ${item.name}`}
          onPress={onQuickConsume}
          hitSlop={8}
          style={({ pressed }) => [
            styles.minus,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
          ]}>
          <Text style={[styles.minusText, { color: theme.text }]}>−1</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  chips: { gap: Spacing.two, paddingVertical: Spacing.one },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  itemName: { fontSize: 16, fontWeight: '600' },
  minus: {
    minWidth: 48,
    height: 40,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusText: { fontSize: 16, fontWeight: '700' },
  empty: { padding: Spacing.five },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: BottomTabInset + Spacing.three,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { fontSize: 32, lineHeight: 36, fontWeight: '400' },
});
