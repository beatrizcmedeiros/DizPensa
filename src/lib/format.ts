import type { UnitType } from '@/lib/powersync/schema';

/** Arredonda para evitar lixo de ponto flutuante (0.1 + 0.2). */
export function round(value: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function formatNumber(value: number, minDecimals: number, maxDecimals: number): string {
  const fixed = round(value, maxDecimals).toFixed(maxDecimals);
  let [int, dec = ''] = fixed.split('.');
  while (dec.length > minDecimals && dec.endsWith('0')) dec = dec.slice(0, -1);
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec ? `${int},${dec}` : int;
}

export function formatQuantity(value: number, unitType: UnitType | string | null): string {
  if (unitType === 'weight') {
    if (value > 0 && value < 1) return `${formatNumber(value * 1000, 0, 0)} g`;
    return `${formatNumber(value, 0, 3)} kg`;
  }
  return `${formatNumber(value, 0, 2)} un`;
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  return `R$ ${formatNumber(value, 2, 2)}`;
}

/** Converte texto digitado ("1,5", "2.000,50") em número. */
export function parseNumber(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '');
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function formatDays(days: number): string {
  if (days === 0) return 'menos de 1 dia';
  if (days === 1) return '1 dia';
  return `${days} dias`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
