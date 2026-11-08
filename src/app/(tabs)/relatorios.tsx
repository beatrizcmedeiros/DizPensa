import { useQuery } from '@powersync/react-native';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarList, ColumnChart, type BarDatum } from '@/components/charts';
import { AppText, Card, Chip, Screen, SectionTitle } from '@/components/ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDays, formatMoney, formatQuantity } from '@/lib/format';
import { useHousehold } from '@/lib/household';
import type { UnitType } from '@/lib/powersync/schema';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type Period = { key: string; label: string; months: number | null };
const PERIODS: Period[] = [
  { key: '1', label: 'Este mês', months: 1 },
  { key: '3', label: '3 meses', months: 3 },
  { key: '6', label: '6 meses', months: 6 },
  { key: '12', label: '12 meses', months: 12 },
  { key: 'all', label: 'Tudo', months: null },
];

/** Primeiro dia do mês, N-1 meses atrás (N=1 → início deste mês). */
function periodStart(months: number | null): string {
  if (months == null) return '0000';
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - (months - 1), 1).toISOString();
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

type MonthRow = { month: string; total: number; purchases: number };
type GroupRow = { id: string | null; name: string | null; total: number };
type TopRow = { id: string; name: string; unit_type: UnitType; times: number; qty: number; spent: number };
type ConsumptionRow = { id: string; name: string; unit_type: UnitType; consumed: number; avg_days: number | null };

export default function ReportsScreen() {
  const theme = useTheme();
  const { household } = useHousehold();
  const [periodKey, setPeriodKey] = useState('6');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const period = PERIODS.find((p) => p.key === periodKey)!;
  const since = periodStart(period.months);
  // Parâmetros comuns: casa, início do período, filtro de categoria (2x por causa do "? IS NULL OR").
  const base = [household.id, since, categoryId, categoryId];
  const itemsFilter = `i.household_id = ? AND pu.purchased_at >= ? AND (? IS NULL OR p.category_id = ?)`;

  const { data: categories } = useQuery<{ id: string; name: string }>(
    `SELECT id, name FROM categories WHERE household_id = ? ORDER BY sort_order, name`,
    [household.id],
  );

  const { data: monthly } = useQuery<MonthRow>(
    `SELECT substr(pu.purchased_at, 1, 7) AS month, SUM(i.total_price) AS total, COUNT(DISTINCT pu.id) AS purchases
     FROM purchase_items i
     JOIN purchases pu ON pu.id = i.purchase_id
     LEFT JOIN products p ON p.id = i.product_id
     WHERE ${itemsFilter}
     GROUP BY month ORDER BY month`,
    base,
  );

  // Sem filtro: gasto por categoria. Com categoria escolhida: por produto dentro dela.
  const { data: groups } = useQuery<GroupRow>(
    categoryId
      ? `SELECT p.id, p.name, SUM(i.total_price) AS total
         FROM purchase_items i
         JOIN purchases pu ON pu.id = i.purchase_id
         LEFT JOIN products p ON p.id = i.product_id
         WHERE ${itemsFilter}
         GROUP BY p.id ORDER BY total DESC LIMIT 15`
      : `SELECT c.id, c.name, SUM(i.total_price) AS total
         FROM purchase_items i
         JOIN purchases pu ON pu.id = i.purchase_id
         LEFT JOIN products p ON p.id = i.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE ${itemsFilter}
         GROUP BY c.id ORDER BY total DESC`,
    base,
  );

  const { data: top } = useQuery<TopRow>(
    `SELECT p.id, p.name, p.unit_type, COUNT(DISTINCT pu.id) AS times, SUM(i.quantity) AS qty, SUM(i.total_price) AS spent
     FROM purchase_items i
     JOIN purchases pu ON pu.id = i.purchase_id
     JOIN products p ON p.id = i.product_id
     WHERE ${itemsFilter}
     GROUP BY p.id ORDER BY times DESC, spent DESC LIMIT 10`,
    base,
  );

  const { data: consumption } = useQuery<ConsumptionRow>(
    `SELECT p.id, p.name, p.unit_type, SUM(m.quantity) AS consumed,
            (SELECT AVG(julianday(l.finished_at) - julianday(l.entered_at))
             FROM stock_lots l WHERE l.product_id = p.id AND l.finished_at IS NOT NULL) AS avg_days
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     WHERE m.household_id = ? AND m.type = 'baixa' AND m.created_at >= ? AND (? IS NULL OR p.category_id = ?)
     GROUP BY p.id ORDER BY consumed DESC LIMIT 10`,
    base,
  );

  // Preenche meses sem compra com zero, para o gráfico não "pular" meses.
  const monthData: BarDatum[] = useMemo(() => {
    const byMonth = new Map(monthly.map((m) => [m.month, m]));
    const first = period.months == null ? monthly[0]?.month : monthKey(new Date(since));
    if (!first) return [];
    const out: BarDatum[] = [];
    const [fy, fm] = first.split('-').map(Number);
    const cursor = new Date(fy, fm - 1, 1);
    const end = monthKey(new Date());
    while (monthKey(cursor) <= end && out.length < 36) {
      const key = monthKey(cursor);
      const row = byMonth.get(key);
      out.push({
        key,
        label: monthLabel(key),
        value: row?.total ?? 0,
        detail: row ? `${row.purchases} ${row.purchases === 1 ? 'compra' : 'compras'}` : 'sem compras',
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }, [monthly, period.months, since]);

  const total = monthly.reduce((s, m) => s + m.total, 0);
  const monthsCount = Math.max(monthData.length, 1);
  const groupData: BarDatum[] = groups.map((g) => ({
    key: g.id ?? 'none',
    label: g.name ?? (categoryId ? 'Item sem produto' : 'Sem categoria'),
    value: g.total,
    detail: total > 0 ? `${Math.round((g.total / total) * 100)}% do gasto` : undefined,
  }));

  return (
    <Screen edges={['top']} style={{ paddingBottom: BottomTabInset + Spacing.three }}>
      <AppText type="subtitle">Relatórios</AppText>

      <View style={{ gap: Spacing.two }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {PERIODS.map((p) => (
            <Chip key={p.key} label={p.label} selected={p.key === periodKey} onPress={() => setPeriodKey(p.key)} />
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

      <Card>
        <SectionTitle>Gasto no período</SectionTitle>
        <Text style={[styles.hero, { color: theme.text }]}>{formatMoney(total)}</Text>
        {period.months !== 1 && total > 0 ? (
          <AppText type="small" themeColor="textSecondary">
            Média de {formatMoney(total / monthsCount)} por mês
          </AppText>
        ) : null}
        {total === 0 ? (
          <AppText type="small" themeColor="textSecondary">
            Nenhuma compra com valor neste período. Leia notas fiscais ou informe o valor pago ao lançar produtos.
          </AppText>
        ) : null}
      </Card>

      {total > 0 && monthData.length > 1 ? (
        <Card>
          <SectionTitle>Gasto por mês</SectionTitle>
          <ColumnChart data={monthData} format={formatMoney} />
        </Card>
      ) : null}

      {groupData.length > 0 ? (
        <Card>
          <SectionTitle>{categoryId ? 'Gasto por produto' : 'Gasto por categoria'}</SectionTitle>
          <BarList
            data={groupData}
            format={formatMoney}
            onPressItem={
              categoryId
                ? (d) => d.key !== 'none' && router.push({ pathname: '/produto/[id]', params: { id: d.key } })
                : (d) => d.key !== 'none' && setCategoryId(d.key)
            }
          />
          {!categoryId ? (
            <AppText type="small" themeColor="textSecondary">
              Toque numa categoria para ver os produtos dela.
            </AppText>
          ) : null}
        </Card>
      ) : null}

      {top.length > 0 ? (
        <Card>
          <SectionTitle>Mais comprados</SectionTitle>
          {top.map((t) => (
            <View key={t.id} style={styles.tableRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: theme.text, fontWeight: '600' }}
                  onPress={() => router.push({ pathname: '/produto/[id]', params: { id: t.id } })}>
                  {t.name}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {t.times} {t.times === 1 ? 'compra' : 'compras'} · {formatQuantity(t.qty, t.unit_type)} ·{' '}
                  média {formatMoney(t.qty > 0 ? t.spent / t.qty : null)}
                  {t.unit_type === 'weight' ? '/kg' : '/un'}
                </Text>
              </View>
              <Text style={[styles.num, { color: theme.text }]}>{formatMoney(t.spent)}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {consumption.length > 0 ? (
        <Card>
          <SectionTitle>Mais consumidos</SectionTitle>
          {consumption.map((c) => (
            <View key={c.id} style={styles.tableRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{c.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {c.avg_days != null ? `dura em média ${formatDays(Math.round(c.avg_days))}` : 'ainda sem duração medida'}
                </Text>
              </View>
              <Text style={[styles.num, { color: theme.text }]}>{formatQuantity(c.consumed, c.unit_type)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: Spacing.two, paddingVertical: Spacing.one },
  hero: { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  num: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
