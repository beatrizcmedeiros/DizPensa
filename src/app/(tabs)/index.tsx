import { useQuery } from '@powersync/react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddSheet } from '@/components/add-sheet';
import { useToast } from '@/components/toast';
import {
  CategoryIcon,
  EmptyState,
  Icon,
  IconButton,
  OptionSheet,
  StatusBadge,
  type StockStatus,
} from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatQuantity } from '@/lib/format';
import { useHousehold } from '@/lib/household';
import type { UnitType } from '@/lib/powersync/schema';
import { addListItem } from '@/lib/shopping';
import { useConsume } from '@/lib/use-consume';

type PantryRow = {
  id: string;
  name: string;
  unit_type: UnitType;
  min_quantity: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  quantity: number;
  in_list: number;
};

function stockState(row: PantryRow): StockStatus {
  if (row.quantity <= 0) return 'acabou';
  if (row.min_quantity > 0 && row.quantity <= row.min_quantity) return 'acabando';
  return 'tem';
}

export default function PantryScreen() {
  const theme = useTheme();
  const { household, userId } = useHousehold();
  const toast = useToast();
  const consume = useConsume();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StockStatus | null>(null);
  const [categorySheet, setCategorySheet] = useState(false);
  const [addSheet, setAddSheet] = useState(false);

  const { data: products } = useQuery<PantryRow>(
    `SELECT p.id, p.name, p.unit_type, p.min_quantity, p.category_id,
            c.name AS category_name, c.icon AS category_icon, COALESCE(c.sort_order, 999) AS cat_order,
            COALESCE((SELECT SUM(l.quantity_remaining) FROM stock_lots l
                      WHERE l.product_id = p.id AND l.quantity_remaining > 0), 0) AS quantity,
            EXISTS (SELECT 1 FROM shopping_list_items s WHERE s.product_id = p.id AND s.checked = 0) AS in_list
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.household_id = ? AND p.archived = 0
     ORDER BY cat_order, c.name, p.name COLLATE NOCASE`,
    [household.id],
  );

  const { data: categories } = useQuery<{ id: string; name: string; icon: string | null }>(
    `SELECT id, name, icon FROM categories WHERE household_id = ? ORDER BY sort_order, name`,
    [household.id],
  );

  const counts = useMemo(() => {
    const c = { tem: 0, acabando: 0, acabou: 0 };
    for (const p of products) c[stockState(p)]++;
    return c;
  }, [products]);

  const sections = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (categoryId && p.category_id !== categoryId) return false;
      if (filter && stockState(p) !== filter) return false;
      return true;
    });
    const groups = new Map<string, PantryRow[]>();
    for (const p of filtered) {
      const key = p.category_name ?? 'Sem categoria';
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [products, search, categoryId, filter]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  async function addToList(item: PantryRow) {
    await addListItem({ householdId: household.id, userId, name: item.name, productId: item.id });
    toast({ message: `${item.name} foi para a lista de compras` });
  }

  const summary: { key: StockStatus; label: string; bg: string; fg: string }[] = [
    { key: 'tem', label: 'Em casa', bg: theme.successBg, fg: theme.successText },
    { key: 'acabando', label: 'Acabando', bg: theme.warningBg, fg: theme.warningText },
    { key: 'acabou', label: 'Acabou', bg: theme.dangerBg, fg: theme.dangerText },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.three, paddingBottom: BottomTabInset + 96 }}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: Spacing.three }}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{household.name}</Text>
                <Text style={[styles.title, { color: theme.text }]}>Sua despensa</Text>
              </View>
              <IconButton
                icon={searchOpen ? 'close' : 'search'}
                label={searchOpen ? 'Fechar busca' : 'Buscar produto'}
                onPress={() => {
                  if (searchOpen) setSearch('');
                  setSearchOpen(!searchOpen);
                }}
              />
            </View>

            {searchOpen ? (
              <TextInput
                autoFocus
                placeholder="Arroz, café, detergente"
                placeholderTextColor={theme.textSecondary}
                value={search}
                onChangeText={setSearch}
                style={[styles.search, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
              />
            ) : null}

            {products.length > 0 ? (
              <View style={styles.summary}>
                {summary.map((s) => {
                  const selected = filter === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${s.label}: ${counts[s.key]} produtos`}
                      onPress={() => setFilter(selected ? null : s.key)}
                      style={[
                        styles.summaryCard,
                        { backgroundColor: s.bg, borderColor: selected ? s.fg : 'transparent' },
                      ]}>
                      <Text style={[styles.summaryNumber, { color: s.fg }]}>{counts[s.key]}</Text>
                      <Text style={{ color: s.fg, fontSize: 14, fontWeight: '600' }}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {products.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setCategorySheet(true)}
                style={[styles.categoryPicker, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <Icon name="tune" size={20} color={theme.textSecondary} />
                <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>
                  {selectedCategory ? selectedCategory.name : 'Todas as categorias'}
                </Text>
                <Icon name="expand_more" size={22} color={theme.textSecondary} />
              </Pressable>
            ) : null}

            {filter ? (
              <Pressable onPress={() => setFilter(null)} hitSlop={8} accessibilityRole="button">
                <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 15 }}>
                  Mostrando só “{summary.find((s) => s.key === filter)?.label}” · ver todos
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <PantryItem
            item={item}
            onPress={() => router.push({ pathname: '/produto/[id]', params: { id: item.id } })}
            onUse={() =>
              item.unit_type === 'package'
                ? consume(item, 1)
                : router.push({ pathname: '/produto/[id]', params: { id: item.id } })
            }
            onAddToList={() => addToList(item)}
          />
        )}
        ListEmptyComponent={
          products.length === 0 ? (
            <EmptyState
              icon="kitchen"
              title="Monte sua despensa"
              body="Leia o QR code da nota do mercado ou adicione os produtos que você tem em casa."
              actionLabel="Adicionar produtos"
              onAction={() => setAddSheet(true)}
            />
          ) : (
            <EmptyState
              icon="search_off"
              title="Nada por aqui"
              body="Nenhum produto com esses filtros."
              actionLabel="Ver todos"
              onAction={() => {
                setFilter(null);
                setCategoryId(null);
                setSearch('');
              }}
            />
          )
        }
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => setAddSheet(true)}
        style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="add" size={24} color={theme.onPrimary} />
        <Text style={{ color: theme.onPrimary, fontSize: 16, fontWeight: '700' }}>Adicionar</Text>
      </Pressable>

      <OptionSheet
        visible={categorySheet}
        title="Categoria"
        onClose={() => setCategorySheet(false)}
        onSelect={(key) => setCategoryId(key === 'all' ? null : key)}
        options={[
          { key: 'all', label: 'Todas as categorias', icon: 'apps', selected: !categoryId },
          ...categories.map((c) => ({
            key: c.id,
            label: c.name,
            icon: c.icon ?? 'category',
            selected: c.id === categoryId,
          })),
        ]}
      />
      <AddSheet visible={addSheet} onClose={() => setAddSheet(false)} />
    </SafeAreaView>
  );
}

function PantryItem({
  item,
  onPress,
  onUse,
  onAddToList,
}: {
  item: PantryRow;
  onPress: () => void;
  onUse: () => void;
  onAddToList: () => void;
}) {
  const theme = useTheme();
  const state = stockState(item);
  const qty = formatQuantity(item.quantity, item.unit_type);

  let action: { label: string; onPress: () => void; filled?: boolean } | null = null;
  if (state === 'acabou') {
    action = item.in_list ? null : { label: '+ Lista', onPress: onAddToList, filled: true };
  } else if (item.unit_type === 'package' && item.quantity >= 1) {
    action = { label: 'Usei 1', onPress: onUse };
  } else {
    action = { label: 'Usei', onPress: onUse };
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${state === 'acabou' ? 'acabou' : qty}`}
      style={({ pressed }) => [
        styles.item,
        { backgroundColor: pressed ? theme.backgroundElement : theme.card, borderColor: theme.border },
      ]}>
      <CategoryIcon icon={item.category_icon} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        {state === 'tem' ? (
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{qty}</Text>
        ) : state === 'acabando' ? (
          <StatusBadge status="acabando" label={`Acabando · ${qty}`} />
        ) : (
          <StatusBadge status="acabou" label={item.in_list ? 'Acabou · na lista' : 'Acabou'} />
        )}
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action.label} ${item.name}`}
          onPress={action.onPress}
          hitSlop={6}
          style={({ pressed }) => [
            styles.action,
            action.filled
              ? { backgroundColor: theme.successBg }
              : { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background },
            { opacity: pressed ? 0.6 : 1 },
          ]}>
          <Text style={{ color: action.filled ? theme.successText : theme.text, fontWeight: '700', fontSize: 15 }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 24, fontWeight: '700' },
  search: { minHeight: 48, borderWidth: 1, borderRadius: Radius.medium, paddingHorizontal: Spacing.three, fontSize: 16 },
  summary: { flexDirection: 'row', gap: Spacing.two },
  summaryCard: { flex: 1, borderRadius: Radius.medium, padding: Spacing.three, borderWidth: 2, gap: 2 },
  summaryNumber: { fontSize: 24, fontWeight: '800' },
  categoryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  sectionHeader: { fontSize: 15, fontWeight: '700', marginTop: Spacing.four, marginBottom: Spacing.two },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  itemName: { fontSize: 17, fontWeight: '600' },
  action: {
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: Spacing.three,
    bottom: BottomTabInset + Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 56,
    paddingHorizontal: Spacing.four,
    borderRadius: 28,
    elevation: 4,
  },
});
