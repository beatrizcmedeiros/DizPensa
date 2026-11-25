import { useQuery } from '@powersync/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useToast } from '@/components/toast';
import {
  AppText,
  Button,
  Card,
  CategoryIcon,
  Icon,
  OptionSheet,
  Screen,
  Segmented,
  Stepper,
  TextField,
} from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatQuantity, parseNumber } from '@/lib/format';
import { useHousehold } from '@/lib/household';
import { db } from '@/lib/powersync/db';
import type { UnitType } from '@/lib/powersync/schema';
import { addEntry, createProduct } from '@/lib/stock';

type ExistingProduct = {
  id: string;
  name: string;
  unit_type: UnitType;
  category_name: string | null;
  category_icon: string | null;
};

/**
 * Adição manual. Serve para produto novo ou para colocar mais de um
 * produto que já existe (abrindo com ?productId=...).
 * Mostra só o essencial; o resto fica em "Mais detalhes".
 */
export default function NewProductScreen() {
  const theme = useTheme();
  const toast = useToast();
  const { household, userId } = useHousehold();
  const params = useLocalSearchParams<{ productId?: string }>();

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ExistingProduct | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unitType, setUnitType] = useState<UnitType>('package');
  const [count, setCount] = useState(1);
  const [weight, setWeight] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [minQty, setMinQty] = useState('');
  const [categorySheet, setCategorySheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories } = useQuery<{ id: string; name: string; icon: string | null }>(
    `SELECT id, name, icon FROM categories WHERE household_id = ? ORDER BY sort_order, name`,
    [household.id],
  );

  // Produto pré-selecionado (vindo da tela de detalhe)
  const { data: preselected } = useQuery<ExistingProduct>(
    `SELECT p.id, p.name, p.unit_type, c.name AS category_name, c.icon AS category_icon
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [params.productId ?? null],
  );
  const product = selected ?? preselected[0] ?? null;

  // Sugestões enquanto digita, para não criar o mesmo produto duas vezes
  const term = name.trim();
  const { data: suggestions } = useQuery<ExistingProduct>(
    `SELECT p.id, p.name, p.unit_type, c.name AS category_name, c.icon AS category_icon
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.household_id = ? AND p.archived = 0 AND ? <> '' AND p.name LIKE ?
     ORDER BY p.name LIMIT 4`,
    [household.id, term, `%${term}%`],
  );

  const effectiveUnit = product?.unit_type ?? unitType;
  const category = categories.find((c) => c.id === categoryId);
  const weightKg = parseNumber(weight);
  const quantity = effectiveUnit === 'weight' ? weightKg : count;

  async function save() {
    setError(null);
    if (!product && !term) return setError('Escreva o nome do produto.');
    if (quantity == null || quantity <= 0) return setError('Informe quanto você comprou.');
    const total = parseNumber(price);
    if (price.trim() && (total == null || total < 0)) return setError('Confira o valor pago.');

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
            quantity,
            brand: brand || null,
            totalPrice: total,
            storeName: store || null,
          },
          tx,
        );
      });
      toast({ message: `${product?.name ?? term} adicionado à despensa` });
      router.back();
    } catch (e) {
      console.error(e);
      setError('Não foi possível salvar. Tente de novo.');
      setSaving(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      {product ? (
        <Card style={styles.productCard}>
          <CategoryIcon icon={product.category_icon} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>{product.name}</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{product.category_name ?? 'Sem categoria'}</Text>
          </View>
          {!params.productId ? (
            <Pressable accessibilityRole="button" onPress={() => setSelected(null)} hitSlop={8} style={styles.link}>
              <Text style={{ color: theme.primary, fontWeight: '700' }}>Trocar</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : (
        <>
          <TextField
            label="O que você comprou?"
            placeholder="Arroz, leite, detergente"
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="sentences"
          />
          {suggestions.length > 0 ? (
            <View style={{ gap: Spacing.two }}>
              <AppText type="small" themeColor="textSecondary">
                Já tem na despensa — toque para usar:
              </AppText>
              {suggestions.map((s) => (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  onPress={() => setSelected(s)}
                  style={({ pressed }) => [
                    styles.suggestion,
                    { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.card },
                  ]}>
                  <CategoryIcon icon={s.category_icon} size={36} />
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16, flex: 1 }}>{s.name}</Text>
                  <Icon name="chevron_right" size={22} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={{ gap: Spacing.two }}>
            <AppText type="small" themeColor="textSecondary">
              Compro por
            </AppText>
            <Segmented
              value={unitType}
              onChange={setUnitType}
              options={[
                { value: 'package', label: 'Unidade' },
                { value: 'weight', label: 'Peso (kg)' },
              ]}
            />
          </View>
        </>
      )}

      <View style={{ gap: Spacing.two }}>
        <AppText type="small" themeColor="textSecondary">
          Quantidade
        </AppText>
        {effectiveUnit === 'package' ? (
          <Stepper value={count} onChange={setCount} min={1} format={(v) => formatQuantity(v, 'package')} />
        ) : (
          <TextField
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="0,500"
            hint={weightKg ? `= ${formatQuantity(weightKg, 'weight')}` : 'Em quilos. Ex.: 0,5 para meio quilo'}
          />
        )}
      </View>

      {!product ? (
        <View style={{ gap: Spacing.two }}>
          <AppText type="small" themeColor="textSecondary">
            Categoria
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCategorySheet(true)}
            style={[styles.picker, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <CategoryIcon icon={category?.icon ?? null} size={32} />
            <Text style={{ color: category ? theme.text : theme.textSecondary, fontSize: 16, flex: 1 }}>
              {category?.name ?? 'Escolher categoria'}
            </Text>
            <Icon name="expand_more" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showMore }}
        onPress={() => setShowMore(!showMore)}
        style={styles.moreToggle}>
        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Mais detalhes</Text>
        <Icon name={showMore ? 'expand_less' : 'expand_more'} size={22} color={theme.primary} />
        <Text style={{ color: theme.textSecondary, fontSize: 14, flex: 1, textAlign: 'right' }}>
          marca, preço, loja
        </Text>
      </Pressable>

      {showMore ? (
        <Card>
          <TextField label="Marca" placeholder="Tio João" value={brand} onChangeText={setBrand} />
          <TextField
            label="Quanto pagou no total"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="R$ 0,00"
            hint="Aparece no histórico de preço e nos gastos."
          />
          <TextField label="Loja" placeholder="Supermercado BH" value={store} onChangeText={setStore} />
          {!product ? (
            <TextField
              label="Avisar quando estiver acabando"
              value={minQty}
              onChangeText={setMinQty}
              keyboardType="decimal-pad"
              placeholder={effectiveUnit === 'weight' ? '0,2' : '1'}
              hint={
                effectiveUnit === 'weight'
                  ? 'Quando tiver esse peso (kg) ou menos, aparece como “Acabando”.'
                  : 'Quando tiver essa quantidade ou menos, aparece como “Acabando”.'
              }
            />
          ) : null}
        </Card>
      ) : null}

      {error ? <AppText themeColor="danger">{error}</AppText> : null}
      <Button title="Adicionar à despensa" icon="check" onPress={save} loading={saving} />

      <OptionSheet
        visible={categorySheet}
        title="Categoria"
        onClose={() => setCategorySheet(false)}
        onSelect={setCategoryId}
        options={categories.map((c) => ({
          key: c.id,
          label: c.name,
          icon: c.icon ?? 'category',
          selected: c.id === categoryId,
        }))}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  productCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.two },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 56,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
  },
  moreToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 48 },
});
