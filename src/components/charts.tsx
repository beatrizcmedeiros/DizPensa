import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Gráficos simples feitos com View (sem biblioteca nativa).
 * Uma cor só (verde do app) porque cada gráfico mostra uma única medida;
 * a identidade de cada barra vem do rótulo em texto, nunca da cor.
 */

export type BarDatum = { key: string; label: string; value: number; detail?: string };

/** Barras horizontais com rótulo e valor — bom para comparar categorias ou produtos. */
export function BarList({
  data,
  format,
  onPressItem,
}: {
  data: BarDatum[];
  format: (v: number) => string;
  onPressItem?: (d: BarDatum) => void;
}) {
  const theme = useTheme();
  const max = Math.max(...data.map((d) => d.value), 0);

  return (
    <View style={{ gap: Spacing.three }}>
      {data.map((d) => {
        const pct = max > 0 ? d.value / max : 0;
        return (
          <Pressable
            key={d.key}
            disabled={!onPressItem}
            onPress={() => onPressItem?.(d)}
            accessibilityLabel={`${d.label}: ${format(d.value)}`}
            style={{ gap: 4 }}>
            <View style={styles.barLabelRow}>
              <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                {d.label}
              </Text>
              <Text style={[styles.value, { color: theme.text }]}>{format(d.value)}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.max(pct * 100, d.value > 0 ? 2 : 0)}%`, backgroundColor: theme.primary },
                ]}
              />
            </View>
            {d.detail ? <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{d.detail}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Colunas verticais (ex.: gasto por mês). Toque numa coluna para ver o valor;
 * a última começa selecionada.
 */
export function ColumnChart({
  data,
  format,
  height = 140,
}: {
  data: BarDatum[];
  format: (v: number) => string;
  height?: number;
}) {
  const theme = useTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const selected = data.find((d) => d.key === selectedKey) ?? data[data.length - 1];

  if (data.length === 0) return null;

  return (
    <View style={{ gap: Spacing.two }}>
      {selected ? (
        <View>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{selected.label}</Text>
          <Text style={[styles.selectedValue, { color: theme.text }]}>{format(selected.value)}</Text>
          {selected.detail ? <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{selected.detail}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.columns, { height, borderColor: theme.border }]}>
        {data.map((d) => {
          const isSelected = d.key === selected?.key;
          const h = max > 0 ? (d.value / max) * (height - 8) : 0;
          return (
            <Pressable
              key={d.key}
              onPress={() => setSelectedKey(d.key)}
              accessibilityLabel={`${d.label}: ${format(d.value)}`}
              style={styles.columnHit}>
              <View
                style={[
                  styles.column,
                  {
                    height: Math.max(h, d.value > 0 ? 3 : 0),
                    backgroundColor: theme.primary,
                    opacity: isSelected ? 1 : 0.45,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {data.map((d, i) => (
          <Text
            key={d.key}
            style={[styles.axisLabel, { color: theme.textSecondary }]}
            numberOfLines={1}>
            {/* Com muitas colunas, mostra um rótulo sim, outro não. */}
            {data.length <= 6 || i % 2 === (data.length - 1) % 2 ? shortLabel(d.label) : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

function shortLabel(label: string) {
  return label.split(' ')[0].slice(0, 3);
}

const styles = StyleSheet.create({
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  label: { flex: 1, fontSize: 14, fontWeight: '500' },
  value: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  selectedValue: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    gap: 2,
  },
  columnHit: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  column: { width: '70%', maxWidth: 28, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', gap: 2 },
  axisLabel: { flex: 1, fontSize: 11, textAlign: 'center' },
});
