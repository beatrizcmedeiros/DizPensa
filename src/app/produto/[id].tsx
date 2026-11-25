import { useQuery } from '@powersync/react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ColumnChart } from '@/components/charts';
import { useToast } from '@/components/toast';
import {
  AppText,
  Button,
  Card,
  CategoryIcon,
  Chip,
  Loading,
  Screen,
  SectionTitle,
  StatusBadge,
  type StockStatus,
  TextField,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  daysBetween,
  formatDate,
  formatDays,
  formatMoney,
  formatQuantity,
  parseNumber,
  round,
} from '@/lib/format';
import { useHousehold } from '@/lib/household';
import { db } from '@/lib/powersync/db';
import type { UnitType } from '@/lib/powersync/schema';
import { addListItem } from '@/lib/shopping';
import { useConsume } from '@/lib/use-consume';

type ProductDetail = {
  id: string;
  name: string;
  unit_type: UnitType;
  min_quantity: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  in_list: number;
};

type Lot = {
  id: string;
  quantity_initial: number;
  quantity_remaining: number;
  entered_at: string;
  finished_at: string | null;
  brand: string | null;
};

type Movement = {
  id: string;
  type: 'entrada' | 'baixa' | 'ajuste';
  quantity: number;
  created_at: string;
  who: string | null;
};

export default function ProductScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household, userId } = useHousehold();
  const toast = useToast();
  const consumeWithUndo = useConsume();
  const [usedWeight, setUsedWeight] = useState('');
  const [editing, setEditing] = useState(false);

  const { data: products, isLoading } = useQuery<ProductDetail>(
    `SELECT p.id, p.name, p.unit_type, p.min_quantity, p.category_id, c.name AS category_name,
            c.icon AS category_icon,
            EXISTS (SELECT 1 FROM shopping_list_items s WHERE s.product_id = p.id AND s.checked = 0) AS in_list
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [id],
  );
  const { data: lots } = useQuery<Lot>(
    `SELECT l.id, l.quantity_initial, l.quantity_remaining, l.entered_at, l.finished_at, v.brand
     FROM stock_lots l LEFT JOIN product_variants v ON v.id = l.variant_id
     WHERE l.product_id = ?
     ORDER BY l.entered_at DESC`,
    [id],
  );
  const { data: movements } = useQuery<Movement>(
    `SELECT m.id, m.type, m.quantity, m.created_at, hm.display_name AS who
     FROM stock_movements m
     LEFT JOIN household_members hm ON hm.user_id = m.created_by AND hm.household_id = m.household_id
     WHERE m.product_id = ?
     ORDER BY m.created_at DESC
     LIMIT 30`,
    [id],
  );
  const { data: prices } = useQuery<{ last_price: number | null; avg_price: number | null; times: number }>(
    `SELECT
       (SELECT pi.unit_price FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id
        WHERE pi.product_id = ? ORDER BY pu.purchased_at DESC LIMIT 1) AS last_price,
       AVG(unit_price) AS avg_price,
       COUNT(*) AS times
     FROM purchase_items WHERE product_id = ?`,
    [id, id],
  );
  const { data: priceHistory } = useQuery<{
    id: string;
    purchased_at: string;
    store_name: string | null;
    brand: string | null;
    unit_price: number;
  }>(
    `SELECT pi.id, pu.purchased_at, pu.store_name, v.brand, pi.unit_price
     FROM purchase_items pi
     JOIN purchases pu ON pu.id = pi.purchase_id
     LEFT JOIN product_variants v ON v.id = pi.variant_id
     WHERE pi.product_id = ? AND pi.unit_price IS NOT NULL
     ORDER BY pu.purchased_at DESC
     LIMIT 12`,
    [id],
  );

  const product = products[0];
  if (!product) {
    return isLoading ? <Loading /> : <Loading message="Produto não encontrado." />;
  }

  const inStock = round(lots.reduce((sum, l) => sum + Math.max(0, l.quantity_remaining), 0));
  const finished = lots.filter((l) => l.finished_at);
  const avgDuration =
    finished.length > 0
      ? Math.round(
          finished.reduce((s, l) => s + daysBetween(l.entered_at, l.finished_at!), 0) / finished.length,
        )
      : null;
  const openLots = lots.filter((l) => l.quantity_remaining > 0);
  const oldestOpen = openLots[openLots.length - 1];
  const price = prices[0];
  const isWeight = product.unit_type === 'weight';
  const inList = !!product.in_list;

  const status: StockStatus =
    inStock <= 0 ? 'acabou' : product.min_quantity > 0 && inStock <= product.min_quantity ? 'acabando' : 'tem';

  async function use(quantity: number | 'all') {
    await consumeWithUndo(product, quantity);
    setUsedWeight('');
  }

  async function addToList() {
    await addListItem({ householdId: household.id, userId, name: product.name, productId: product.id });
    toast({ message: `${product.name} foi para a lista de compras` });
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: product.name }} />

      <Card style={styles.hero}>
        <CategoryIcon icon={product.category_icon} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{product.category_name ?? 'Sem categoria'}</Text>
          {status === 'tem' ? (
            <Text style={[styles.big, { color: theme.text }]}>{formatQuantity(inStock, product.unit_type)}</Text>
          ) : (
            <StatusBadge
              status={status}
              label={status === 'acabou' ? 'Acabou' : `Acabando · ${formatQuantity(inStock, product.unit_type)}`}
            />
          )}
          {product.min_quantity > 0 ? (
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
              Avisa quando tiver {formatQuantity(product.min_quantity, product.unit_type)} ou menos
            </Text>
          ) : null}
        </View>
      </Card>

      {inStock > 0 ? (
        <Card>
          <SectionTitle>Usou?</SectionTitle>
          {isWeight ? (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <TextField
                  value={usedWeight}
                  onChangeText={setUsedWeight}
                  keyboardType="decimal-pad"
                  placeholder="Quanto, em kg (ex.: 0,3)"
                  accessibilityLabel="Quanto usou, em quilos"
                />
              </View>
              <Button
                title="Usei"
                onPress={() => {
                  const q = parseNumber(usedWeight);
                  if (q && q > 0) use(q);
                }}
              />
            </View>
          ) : (
            <View style={styles.row}>
              <Button title="Usei 1" icon="remove" onPress={() => use(1)} style={{ flex: 1 }} />
              <Button title="Usei metade" variant="secondary" onPress={() => use(0.5)} style={{ flex: 1 }} />
            </View>
          )}
          <Button title="Acabou tudo" variant="ghost" onPress={() => use('all')} />
        </Card>
      ) : null}

      <View style={styles.row}>
        <Button
          title="Comprei mais"
          icon="add"
          variant={inStock > 0 ? 'secondary' : 'primary'}
          onPress={() => router.push({ pathname: '/produto/novo', params: { productId: product.id } })}
          style={{ flex: 1 }}
        />
        {status !== 'tem' && !inList ? (
          <Button title="Pôr na lista" icon="add_shopping_cart" variant="secondary" onPress={addToList} style={{ flex: 1 }} />
        ) : null}
      </View>

      <Card>
        <SectionTitle>Quanto tempo dura</SectionTitle>
        <AppText>
          {avgDuration != null
            ? `Em média, ${formatDays(avgDuration)} (medido ${finished.length} ${finished.length === 1 ? 'vez' : 'vezes'}).`
            : 'Ainda não acabou nenhuma vez. Quando acabar, o app mostra aqui quanto tempo durou.'}
        </AppText>
        {oldestOpen ? (
          <AppText themeColor="textSecondary" type="small">
            O que está em uso foi comprado há {formatDays(daysBetween(oldestOpen.entered_at, new Date().toISOString()))}.
          </AppText>
        ) : null}
      </Card>

      {price && price.times > 0 ? (
        <Card>
          <SectionTitle>Quanto você pagou</SectionTitle>
          <AppText>
            Último: {formatMoney(price.last_price)} {isWeight ? 'por kg' : 'por unidade'}
          </AppText>
          <AppText themeColor="textSecondary" type="small">
            Média de {price.times} {price.times === 1 ? 'compra' : 'compras'}: {formatMoney(price.avg_price)}
          </AppText>
          {priceHistory.length > 1 ? (
            <ColumnChart
              height={100}
              format={(v) => `${formatMoney(v)}${isWeight ? '/kg' : '/un'}`}
              data={[...priceHistory].reverse().map((p) => ({
                key: p.id,
                label: formatDate(p.purchased_at),
                value: p.unit_price,
                detail: [p.store_name, p.brand].filter(Boolean).join(' · ') || undefined,
              }))}
            />
          ) : null}
          {priceHistory.map((p) => (
            <View key={p.id} style={styles.movement}>
              <Text style={{ color: theme.textSecondary, flex: 1 }} numberOfLines={1}>
                {formatDate(p.purchased_at)}
                {p.store_name ? ` · ${p.store_name}` : ''}
                {p.brand ? ` · ${p.brand}` : ''}
              </Text>
              <Text style={{ color: theme.text, fontWeight: '600' }}>{formatMoney(p.unit_price)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Últimas movimentações</SectionTitle>
        {movements.length === 0 ? (
          <AppText themeColor="textSecondary">Nada registrado ainda.</AppText>
        ) : (
          movements.map((m) => (
            <View key={m.id} style={styles.movement}>
              <Text style={{ color: m.type === 'entrada' ? theme.primary : theme.text, fontWeight: '600', fontSize: 15 }}>
                {m.type === 'entrada' ? 'Comprou ' : 'Usou '}
                {formatQuantity(m.quantity, product.unit_type)}
              </Text>
              <Text style={{ color: theme.textSecondary, flex: 1, textAlign: 'right' }}>
                {formatDate(m.created_at)}
                {m.who ? ` · ${m.who}` : ''}
              </Text>
            </View>
          ))
        )}
      </Card>

      {editing ? (
        <EditProduct product={product} onDone={() => setEditing(false)} />
      ) : (
        <Button title="Editar produto" variant="ghost" onPress={() => setEditing(true)} />
      )}
    </Screen>
  );
}

function EditProduct({ product, onDone }: { product: ProductDetail; onDone: () => void }) {
  const { household } = useHousehold();
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState(product.category_id);
  const [minQty, setMinQty] = useState(product.min_quantity ? String(product.min_quantity).replace('.', ',') : '');

  const { data: categories } = useQuery<{ id: string; name: string }>(
    `SELECT id, name FROM categories WHERE household_id = ? ORDER BY sort_order, name`,
    [household.id],
  );

  async function save() {
    if (!name.trim()) return;
    await db.execute(`UPDATE products SET name = ?, category_id = ?, min_quantity = ? WHERE id = ?`, [
      name.trim(),
      categoryId,
      parseNumber(minQty) ?? 0,
      product.id,
    ]);
    onDone();
  }

  function archive() {
    Alert.alert(
      'Remover produto?',
      'Ele some da despensa, mas as compras dele continuam nos gastos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            await db.execute(`UPDATE products SET archived = 1 WHERE id = ?`, [product.id]);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <Card>
      <SectionTitle>Editar</SectionTitle>
      <TextField label="Nome" value={name} onChangeText={setName} />
      <AppText type="small" themeColor="textSecondary">
        Categoria
      </AppText>
      <View style={styles.wrap}>
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={categoryId === c.id}
            onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
          />
        ))}
      </View>
      <TextField
        label="Avisar quando estiver acabando"
        hint={`Com essa quantidade ou menos, aparece como “Acabando”${product.unit_type === 'weight' ? ' (em kg)' : ''}.`}
        value={minQty}
        onChangeText={setMinQty}
        keyboardType="decimal-pad"
      />
      <Button title="Salvar" onPress={save} />
      <Button title="Cancelar" variant="ghost" onPress={onDone} />
      <Button title="Remover produto" variant="danger" onPress={archive} />
    </Card>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 28, fontWeight: '800' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  movement: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.one },
});
