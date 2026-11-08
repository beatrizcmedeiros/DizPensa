import { useQuery } from '@powersync/react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, Card, Chip, Loading } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatMoney, formatQuantity, parseNumber } from '@/lib/format';
import { useHousehold } from '@/lib/household';
import {
  defaultStockQuantity,
  getPendingReceipt,
  type ReviewedItem,
  saveReceipt,
  setPendingReceipt,
} from '@/lib/nfce';
import type { UnitType } from '@/lib/powersync/schema';

type Category = { id: string; name: string };
type ProductOption = { id: string; name: string; unit_type: UnitType; category_id: string | null };

type Row = ReviewedItem & { key: string; qtyText: string; source: string };

export default function ReviewReceiptScreen() {
  const theme = useTheme();
  const { household, userId } = useHousehold();
  const [receipt] = useState(getPendingReceipt);
  const [rows, setRows] = useState<Row[]>(() =>
    (receipt?.items ?? []).map((item) => {
      const s = item.suggestion;
      const stock = defaultStockQuantity(item.quantity, item.unit, s.unit_type);
      return {
        key: String(item.index),
        include: true,
        raw_description: item.raw_description,
        receipt_quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        product_id: s.product_id,
        product_name: s.product_name,
        brand: s.brand,
        category_id: s.category_id,
        unit_type: s.unit_type,
        stock_quantity: stock,
        qtyText: String(stock).replace('.', ','),
        source: s.source,
      };
    }),
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories } = useQuery<Category>(
    `SELECT id, name FROM categories WHERE household_id = ? ORDER BY sort_order, name`,
    [household.id],
  );
  const { data: products } = useQuery<ProductOption>(
    `SELECT id, name, unit_type, category_id FROM products WHERE household_id = ? ORDER BY name`,
    [household.id],
  );
  const productsByName = useMemo(
    () => new Map(products.map((p) => [p.name.toLowerCase(), p])),
    [products],
  );
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  if (!receipt) return <Loading message="Nenhuma nota para revisar." />;

  const included = rows.filter((r) => r.include);
  const total = included.reduce((s, r) => s + r.total_price, 0);

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function rename(row: Row, name: string) {
    // Se o nome digitado é de um produto que já existe, liga a ele.
    const match = productsByName.get(name.trim().toLowerCase());
    update(row.key, {
      product_name: name,
      product_id: match?.id ?? null,
      ...(match ? { category_id: match.category_id, unit_type: match.unit_type } : {}),
    });
  }

  async function save() {
    const invalid = included.find((r) => !r.product_name.trim() || !(r.stock_quantity > 0));
    if (invalid) {
      setExpanded(invalid.key);
      return;
    }
    setSaving(true);
    try {
      await saveReceipt({ receipt: receipt!, items: rows, householdId: household.id, userId });
      setPendingReceipt(null);
      router.back();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Card style={{ marginBottom: Spacing.two }}>
            <AppText type="smallBold">{receipt.store_name ?? 'Compra'}</AppText>
            <AppText type="small" themeColor="textSecondary">
              {formatDate(receipt.purchased_at)} · {receipt.items.length} itens na nota
              {receipt.total != null ? ` · ${formatMoney(receipt.total)}` : ''}
            </AppText>
            {!receipt.ai_available ? (
              <AppText type="small" themeColor="warning">
                A IA não estava disponível: os nomes vieram como estão na nota. Você pode editá-los.
              </AppText>
            ) : null}
            <AppText type="small" themeColor="textSecondary">
              Confira os itens. Toque em um item para trocar nome, categoria ou marca, ou tire o que
              não é da casa.
            </AppText>
          </Card>
        }
        renderItem={({ item: row }) => {
          const isOpen = expanded === row.key;
          const linked = row.product_id != null;
          return (
            <View
              style={[
                styles.item,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  opacity: row.include ? 1 : 0.5,
                },
              ]}>
              <Pressable onPress={() => setExpanded(isOpen ? null : row.key)} style={{ gap: 2 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                    {row.product_name || 'Sem nome'}
                  </Text>
                  <Text style={{ color: theme.text, fontWeight: '600' }}>{formatMoney(row.total_price)}</Text>
                </View>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {row.raw_description}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {formatQuantity(row.stock_quantity || 0, row.unit_type)}
                  {row.brand ? ` · ${row.brand}` : ''}
                  {row.category_id ? ` · ${categoryName.get(row.category_id) ?? ''}` : ''}
                  {' · '}
                  <Text style={{ color: linked ? theme.primary : theme.accent }}>
                    {linked ? 'já na despensa' : 'produto novo'}
                  </Text>
                </Text>
              </Pressable>

              {isOpen ? (
                <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
                  <LabeledInput label="Produto" value={row.product_name} onChangeText={(t) => rename(row, t)} />
                  <View style={styles.inline}>
                    <View style={{ flex: 1 }}>
                      <LabeledInput
                        label={row.unit_type === 'weight' ? 'Entra no estoque (kg)' : 'Entra no estoque (un)'}
                        value={row.qtyText}
                        keyboardType="decimal-pad"
                        onChangeText={(t) =>
                          update(row.key, { qtyText: t, stock_quantity: parseNumber(t) ?? 0 })
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <LabeledInput
                        label="Marca"
                        value={row.brand ?? ''}
                        onChangeText={(t) => update(row.key, { brand: t || null })}
                      />
                    </View>
                  </View>
                  {!linked ? (
                    <>
                      <AppText type="small" themeColor="textSecondary">
                        Como contar
                      </AppText>
                      <View style={styles.wrap}>
                        <Chip
                          label="Embalagem"
                          selected={row.unit_type === 'package'}
                          onPress={() => update(row.key, { unit_type: 'package' })}
                        />
                        <Chip
                          label="Peso (kg)"
                          selected={row.unit_type === 'weight'}
                          onPress={() => update(row.key, { unit_type: 'weight' })}
                        />
                      </View>
                      <AppText type="small" themeColor="textSecondary">
                        Categoria
                      </AppText>
                      <View style={styles.wrap}>
                        {categories.map((c) => (
                          <Chip
                            key={c.id}
                            label={c.name}
                            selected={row.category_id === c.id}
                            onPress={() => update(row.key, { category_id: c.id })}
                          />
                        ))}
                      </View>
                    </>
                  ) : null}
                  <Button
                    title={row.include ? 'Não é da casa — tirar da compra' : 'Incluir de volta'}
                    variant={row.include ? 'secondary' : 'primary'}
                    onPress={() => update(row.key, { include: !row.include })}
                  />
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <View style={[styles.footer, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Button
          title={`Adicionar ${included.length} ${included.length === 1 ? 'item' : 'itens'} · ${formatMoney(total)}`}
          onPress={save}
          loading={saving}
          disabled={included.length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

function LabeledInput({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: Radius.medium, padding: Spacing.three },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  inline: { flexDirection: 'row', gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  input: { minHeight: 44, borderWidth: 1, borderRadius: Radius.small, paddingHorizontal: Spacing.two, fontSize: 15 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.three, borderTopWidth: 1 },
});
