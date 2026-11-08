import { useQuery } from '@powersync/react-native';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHousehold } from '@/lib/household';
import { db } from '@/lib/powersync/db';

type CategoryRow = { id: string; name: string; sort_order: number; products: number };

export default function CategoriesScreen() {
  const theme = useTheme();
  const { household } = useHousehold();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const { data: categories } = useQuery<CategoryRow>(
    `SELECT c.id, c.name, c.sort_order,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.archived = 0) AS products
     FROM categories c WHERE c.household_id = ?
     ORDER BY c.sort_order, c.name`,
    [household.id],
  );

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const maxOrder = categories.reduce((m, c) => (c.sort_order < 99 ? Math.max(m, c.sort_order) : m), 0);
    await db.execute(
      `INSERT INTO categories (id, household_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), household.id, name, maxOrder + 1, new Date().toISOString()],
    );
    setNewName('');
  }

  async function rename(id: string) {
    const name = editName.trim();
    if (name) await db.execute(`UPDATE categories SET name = ? WHERE id = ?`, [name, id]);
    setEditingId(null);
  }

  function remove(c: CategoryRow) {
    Alert.alert(
      `Apagar "${c.name}"?`,
      c.products > 0
        ? `${c.products} produto(s) ficarão sem categoria.`
        : 'Nenhum produto usa essa categoria.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () =>
            db.writeTransaction(async (tx) => {
              await tx.execute(`UPDATE products SET category_id = NULL WHERE category_id = ?`, [c.id]);
              await tx.execute(`DELETE FROM categories WHERE id = ?`, [c.id]);
            }),
        },
      ],
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Card>
        <TextField placeholder="Nova categoria" value={newName} onChangeText={setNewName} onSubmitEditing={add} />
        <Button title="Adicionar" onPress={add} disabled={!newName.trim()} />
      </Card>

      {categories.map((c) =>
        editingId === c.id ? (
          <Card key={c.id}>
            <TextField value={editName} onChangeText={setEditName} autoFocus onSubmitEditing={() => rename(c.id)} />
            <View style={styles.row}>
              <Button title="Salvar" onPress={() => rename(c.id)} style={{ flex: 1 }} />
              <Button title="Apagar" variant="danger" onPress={() => remove(c)} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <Pressable
            key={c.id}
            onPress={() => {
              setEditingId(c.id);
              setEditName(c.name);
            }}
            style={[styles.item, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', flex: 1 }}>{c.name}</Text>
            <AppText type="small" themeColor="textSecondary">
              {c.products} {c.products === 1 ? 'produto' : 'produtos'}
            </AppText>
          </Pressable>
        ),
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
});
