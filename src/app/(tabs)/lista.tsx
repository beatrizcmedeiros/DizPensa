import { useQuery } from '@powersync/react-native';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/toast';
import { AppText, Button, EmptyState, Icon, IconButton, TextField } from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatQuantity, parseNumber } from '@/lib/format';
import { useHousehold } from '@/lib/household';
import { db } from '@/lib/powersync/db';
import type { UnitType } from '@/lib/powersync/schema';
import { addListItem, addMissingToList } from '@/lib/shopping';

type ListItem = {
  id: string;
  name: string;
  quantity: number | null;
  checked: number;
  product_id: string | null;
  unit_type: UnitType | null;
  in_stock: number | null;
  category_name: string | null;
};

export default function ShoppingListScreen() {
  const theme = useTheme();
  const { household, userId } = useHousehold();
  const [newItem, setNewItem] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const toast = useToast();

  const { data: items } = useQuery<ListItem>(
    `SELECT s.id, s.name, s.quantity, s.checked, s.product_id, p.unit_type, c.name AS category_name,
            (SELECT SUM(l.quantity_remaining) FROM stock_lots l
             WHERE l.product_id = s.product_id AND l.quantity_remaining > 0) AS in_stock
     FROM shopping_list_items s
     LEFT JOIN products p ON p.id = s.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE s.household_id = ?
     ORDER BY s.checked, COALESCE(c.sort_order, 999), s.name COLLATE NOCASE`,
    [household.id],
  );

  const pending = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  async function generate() {
    const added = await addMissingToList(household.id, userId);
    setMessage(
      added === 0
        ? 'Nada novo: tudo que acabou já está na lista.'
        : `${added} ${added === 1 ? 'produto adicionado' : 'produtos adicionados'} à lista.`,
    );
  }

  async function add() {
    if (!newItem.trim()) return;
    await addListItem({ householdId: household.id, userId, name: newItem });
    setNewItem('');
  }

  function toggle(item: ListItem) {
    db.execute(`UPDATE shopping_list_items SET checked = ? WHERE id = ?`, [item.checked ? 0 : 1, item.id]);
  }

  async function remove(item: ListItem) {
    await db.execute(`DELETE FROM shopping_list_items WHERE id = ?`, [item.id]);
    toast({
      message: `${item.name} saiu da lista`,
      actionLabel: 'Desfazer',
      onAction: () =>
        db.execute(
          `INSERT INTO shopping_list_items (id, household_id, product_id, name, quantity, checked, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [item.id, household.id, item.product_id, item.name, item.quantity, item.checked, userId, new Date().toISOString()],
        ),
    });
  }

  function setQuantity(item: ListItem, text: string) {
    db.execute(`UPDATE shopping_list_items SET quantity = ? WHERE id = ?`, [parseNumber(text), item.id]);
  }

  function clearChecked() {
    Alert.alert('Limpar comprados?', `Tirar ${done.length} ${done.length === 1 ? 'item' : 'itens'} marcados da lista.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Limpar',
        onPress: () => db.execute(`DELETE FROM shopping_list_items WHERE household_id = ? AND checked = 1`, [household.id]),
      },
    ]);
  }

  function share() {
    const text = pending
      .map((i) => `• ${i.name}${i.quantity ? ` (${formatQuantity(i.quantity, i.unit_type ?? 'package')})` : ''}`)
      .join('\n');
    Share.share({ message: `Lista de compras — ${household.name}\n\n${text}` });
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={[...pending, ...done]}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, paddingBottom: BottomTabInset + Spacing.four }}
        ListHeaderComponent={
          <View style={{ gap: Spacing.three, marginBottom: Spacing.two }}>
            <View style={styles.headerRow}>
              <AppText type="subtitle" style={{ flex: 1 }}>
                Lista de compras
              </AppText>
              {pending.length > 0 ? <IconButton icon="share" label="Compartilhar lista" onPress={share} /> : null}
            </View>
            <Button title="Adicionar o que acabou" icon="playlist_add" onPress={generate} />
            {message ? (
              <AppText type="small" themeColor="textSecondary">
                {message}
              </AppText>
            ) : null}
            <View style={styles.addRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  placeholder="Escreva um item, ex.: sabão em pó"
                  value={newItem}
                  onChangeText={setNewItem}
                  onSubmitEditing={add}
                  returnKeyType="done"
                  accessibilityLabel="Novo item da lista"
                />
              </View>
              <Button title="" icon="add" onPress={add} disabled={!newItem.trim()} style={{ width: 52 }} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.item,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!item.checked }}
              accessibilityLabel={item.name}
              onPress={() => toggle(item)}
              style={styles.checkHit}>
              <View
                style={[
                  styles.check,
                  {
                    borderColor: item.checked ? theme.primary : theme.border,
                    backgroundColor: item.checked ? theme.primary : 'transparent',
                  },
                ]}>
                {item.checked ? <Icon name="check" size={18} color={theme.onPrimary} /> : null}
              </View>
            </Pressable>
            <View style={{ flex: 1, opacity: item.checked ? 0.55 : 1 }}>
              <Text
                style={[styles.name, { color: theme.text, textDecorationLine: item.checked ? 'line-through' : 'none' }]}>
                {item.name}
              </Text>
              {item.product_id ? (
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                  {item.in_stock ? `Tem ${formatQuantity(item.in_stock, item.unit_type ?? 'package')} em casa` : 'Acabou em casa'}
                </Text>
              ) : null}
            </View>
            <TextInput
              defaultValue={item.quantity ? String(item.quantity).replace('.', ',') : ''}
              onEndEditing={(e) => setQuantity(item, e.nativeEvent.text)}
              placeholder="Qtd."
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              accessibilityLabel={`Quantidade de ${item.name}`}
              style={[styles.qty, { color: theme.text, borderColor: theme.border }]}
            />
            <IconButton
              icon="close"
              label={`Tirar ${item.name} da lista`}
              color={theme.textSecondary}
              onPress={() => remove(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shopping_cart"
            title="Sua lista está vazia"
            body="Puxe o que acabou ou está acabando na despensa, ou escreva um item acima."
            actionLabel="Adicionar o que acabou"
            onAction={generate}
          />
        }
        ListFooterComponent={
          done.length > 0 ? (
            <Button title={`Limpar ${done.length} comprados`} variant="ghost" onPress={clearChecked} />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  addRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.one,
  },
  checkHit: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 17, fontWeight: '600' },
  qty: { width: 60, height: 44, borderWidth: 1, borderRadius: Radius.small, textAlign: 'center', fontSize: 15 },
});
