import { useQuery } from '@powersync/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText, Button, Card, Chip, Screen, SectionTitle, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatQuantity, parseNumber } from '@/lib/format';
import { useHousehold } from '@/lib/household';
import { db } from '@/lib/powersync/db';
import type { UnitType } from '@/lib/powersync/schema';
import { addEntry, createProduct } from '@/lib/stock';

type ExistingProduct = { id: string; name: string; unit_type: UnitType; category_name: string | null };

/**
 * Adição manual. Serve para produto novo ou para dar entrada
 * em um produto que já existe (abrindo com ?productId=...).
 */
export default function NewProductScreen() {
  const theme = useTheme();
  const { household, userId } = useHousehold();
  const params = useLocalSearchParams<{ productId?: string }>();

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ExistingProduct | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unitType, setUnitType] = useState<UnitType>('package');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [minQty, setMinQty] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories } = useQuery<{ id: string; name: string }>(
    `SELECT id, name FROM categories WHERE household_id = ? ORDER BY sort_order, name`,
    [household.id],
  );

  // Produto pré-selecionado (vindo da tela de detalhe)
  const { data: preselected } = useQuery<ExistingProduct>(
    `SELECT p.id, p.name, p.unit_type, c.name AS category_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [params.productId ?? null],
  );
  const product = selected ?? preselected[0] ?? null;

  // Sugestões enquanto digita, para não duplicar produtos
  const term = name.trim();
  const { data: suggestions } = useQuery<ExistingProduct>(
    `SELECT p.id, p.name, p.unit_type, c.name AS category_name
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.household_id = ? AND p.archived = 0 AND ? <> '' AND p.name LIKE ?
     ORDER BY p.name LIMIT 5`,
    [household.id, term, `%${term}%`],
  );

  const effectiveUnit = product?.unit_type ?? unitType;

  async function save() {
    setError(null);
    const qty = parseNumber(quantity);
    if (!product && !term) return setError('Informe o nome do produto.');
    if (qty == null || qty <= 0) return setError('Informe uma quantidade maior que zero.');
    const total = parseNumber(price);
    if (price.trim() && (total == null || total < 0)) return setError('Valor pago inválido.');

    setSaving(true);
    try {
      await db.writeTransaction(async (tx) => {
        const productId =
          product?.id ??
          (await createProduct(
            {
              householdId: household.id,
              name: term,
              categoryId,
              unitType,
              minQuantity: parseNumber(minQty) ?? 0,
            },
            tx,
          ));
        await addEntry(
          {
            householdId: household.id,
            userId,
            productId,
            quantity: qty,
            brand: brand || null,
            totalPrice: total,
            storeName: store || null,
          },
          tx,
        );
      });
      router.back();
    } catch (e) {
      console.error(e);
      setError('Não foi possível salvar.');
      setSaving(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      {product ? (
        <Card>
          <AppText type="smallBold">{product.name}</AppText>
          <AppText themeColor="textSecondary" type="small">
            {product.category_name ?? 'Sem categoria'} · entrada no estoque
          </AppText>
          {!params.productId ? (
            <Button title="Trocar produto" variant="ghost" onPress={() => setSelected(null)} />
          ) : null}
        </Card>
      ) : (
        <>
          <TextField
            label="Produto"
            placeholder="Ex.: Arroz branco, Leite integral"
            value={name}
            onChangeText={setName}
            autoFocus
          />
          {suggestions.length > 0 ? (
            <View style={{ gap: Spacing.one }}>
              <AppText type="small" themeColor="textSecondary">
                Já existe na despensa:
              </AppText>
              {suggestions.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSelected(s)}
                  style={[styles.suggestion, { borderColor: theme.border, backgroundColor: theme.card }]}>
                  <Text style={{ color: theme.text, fontWeight: '600' }}>{s.name}</Text>
                  <Text style={{ color: theme.textSecondary }}>{s.category_name ?? 'Sem categoria'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <SectionTitle>Categoria</SectionTitle>
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

          <SectionTitle>Como contar</SectionTitle>
          <View style={styles.wrap}>
            <Chip
              label="Por embalagem"
              selected={unitType === 'package'}
              onPress={() => {
                setUnitType('package');
                setQuantity('1');
              }}
            />
            <Chip
              label="Por peso (kg)"
              selected={unitType === 'weight'}
              onPress={() => {
                setUnitType('weight');
                setQuantity('');
              }}
            />
          </View>
        </>
      )}

      <TextField
        label={effectiveUnit === 'weight' ? 'Quantidade (kg)' : 'Quantidade (embalagens)'}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="decimal-pad"
        placeholder={effectiveUnit === 'weight' ? 'Ex.: 0,850' : '1'}
        hint={
          parseNumber(quantity) ? `Vai entrar: ${formatQuantity(parseNumber(quantity)!, effectiveUnit)}` : undefined
        }
      />
      <TextField label="Marca (opcional)" value={brand} onChangeText={setBrand} />
      <TextField
        label="Valor pago no total (opcional)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="R$ 0,00"
        hint="Usado no histórico de preço e nos relatórios de gasto."
      />
      {price.trim() ? (
        <TextField label="Loja (opcional)" value={store} onChangeText={setStore} />
      ) : null}
      {!product ? (
        <TextField
          label="Avisar quando tiver menos que (opcional)"
          value={minQty}
          onChangeText={setMinQty}
          keyboardType="decimal-pad"
          hint="Abaixo disso o produto aparece como “acabando”."
        />
      ) : null}

      {error ? <AppText themeColor="danger">{error}</AppText> : null}
      <Button title="Salvar" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  suggestion: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
