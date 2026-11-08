import { FunctionsHttpError } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import { round } from '@/lib/format';
import { db } from '@/lib/powersync/db';
import type { UnitType } from '@/lib/powersync/schema';
import { findOrCreateVariant } from '@/lib/stock';
import { supabase } from '@/lib/supabase';

/** Resposta da função nfce-import (supabase/functions/nfce-import). */
export type ReceiptItem = {
  index: number;
  raw_description: string;
  code: string | null;
  quantity: number;
  unit: string;
  total_price: number;
  unit_price: number | null;
  suggestion: {
    product_id: string | null;
    product_name: string;
    brand: string | null;
    category_id: string | null;
    unit_type: UnitType;
    source: 'memoria' | 'ia' | 'nota';
  };
};

export type Receipt = {
  access_key: string;
  store_name: string | null;
  store_cnpj: string | null;
  purchased_at: string | null;
  total: number | null;
  ai_available: boolean;
  items: ReceiptItem[];
};

export class ReceiptError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function fetchReceipt(url: string, householdId: string): Promise<Receipt> {
  const local = await db.getOptional<{ id: string }>(
    `SELECT id FROM purchases WHERE household_id = ? AND access_key = ? LIMIT 1`,
    [householdId, extractAccessKey(url)],
  );
  if (local) throw new ReceiptError('Essa nota já foi lançada na despensa.', 'duplicate');

  const { data, error } = await supabase.functions.invoke<Receipt>('nfce-import', {
    body: { url, household_id: householdId },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new ReceiptError(body?.error ?? 'Não foi possível ler a nota.', body?.code);
    }
    throw new ReceiptError('Sem conexão. Para ler a nota é preciso estar com internet.', 'offline');
  }
  if (!data) throw new ReceiptError('Não foi possível ler a nota.');
  return data;
}

function extractAccessKey(url: string): string {
  const p = url.match(/[?&]p=([^&]+)/)?.[1] ?? '';
  return decodeURIComponent(p).split('|')[0].replace(/\D/g, '');
}

/** Nota que está sendo revisada (passada da tela do leitor para a de revisão). */
let pending: Receipt | null = null;
export const setPendingReceipt = (r: Receipt | null) => {
  pending = r;
};
export const getPendingReceipt = () => pending;

/** Item como ficou depois da revisão. */
export type ReviewedItem = {
  include: boolean;
  raw_description: string;
  receipt_quantity: number;
  unit: string;
  unit_price: number | null;
  total_price: number;
  product_id: string | null;
  product_name: string;
  brand: string | null;
  category_id: string | null;
  unit_type: UnitType;
  /** Quanto entra no estoque (embalagens ou kg). */
  stock_quantity: number;
};

/** Quantidade sugerida para o estoque a partir da quantidade e unidade da nota. */
export function defaultStockQuantity(quantity: number, unit: string, unitType: UnitType): number {
  if (unitType === 'weight' && unit === 'G') return round(quantity / 1000);
  return round(quantity);
}

/**
 * Grava a compra revisada: compra, itens, produtos novos, marcas, lotes e
 * movimentos de entrada. Tudo numa transação local (funciona offline;
 * o PowerSync envia depois).
 */
export async function saveReceipt(params: {
  receipt: Receipt;
  items: ReviewedItem[];
  householdId: string;
  userId: string;
}): Promise<number> {
  const { receipt, householdId, userId } = params;
  const items = params.items.filter((i) => i.include && i.stock_quantity > 0);
  const now = new Date().toISOString();
  const purchasedAt = receipt.purchased_at ?? now;
  const total = round(items.reduce((s, i) => s + i.total_price, 0), 2);

  await db.writeTransaction(async (tx) => {
    const purchaseId = randomUUID();
    await tx.execute(
      `INSERT INTO purchases (id, household_id, source, access_key, store_name, store_cnpj, purchased_at, total, created_by, created_at)
       VALUES (?, ?, 'nfce', ?, ?, ?, ?, ?, ?, ?)`,
      [purchaseId, householdId, receipt.access_key, receipt.store_name, receipt.store_cnpj, purchasedAt, total, userId, now],
    );

    // Produtos criados nesta nota, para dois itens com o mesmo nome irem para o mesmo produto.
    const createdByName = new Map<string, string>();

    for (const item of items) {
      const name = item.product_name.trim();
      const key = name.toLowerCase();
      let productId = item.product_id;

      if (!productId) {
        const existing = await tx.getOptional<{ id: string }>(
          `SELECT id FROM products WHERE household_id = ? AND lower(name) = ? LIMIT 1`,
          [householdId, key],
        );
        productId = existing?.id ?? createdByName.get(key) ?? null;
      }
      if (!productId) {
        productId = randomUUID();
        createdByName.set(key, productId);
        await tx.execute(
          `INSERT INTO products (id, household_id, name, category_id, unit_type, min_quantity, archived, created_at)
           VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
          [productId, householdId, name, item.category_id, item.unit_type, now],
        );
      } else {
        // Se tinha sido removido da despensa, volta a aparecer.
        await tx.execute(`UPDATE products SET archived = 0 WHERE id = ? AND archived = 1`, [productId]);
      }

      const variantId = item.brand?.trim()
        ? await findOrCreateVariant(tx, householdId, productId, item.brand.trim())
        : null;

      const purchaseItemId = randomUUID();
      await tx.execute(
        `INSERT INTO purchase_items (id, household_id, purchase_id, product_id, variant_id, raw_description, quantity, unit, unit_price, total_price, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseItemId,
          householdId,
          purchaseId,
          productId,
          variantId,
          item.raw_description,
          item.stock_quantity,
          item.unit_type === 'weight' ? 'KG' : 'UN',
          round(item.total_price / item.stock_quantity, 2),
          item.total_price,
          now,
        ],
      );

      const lotId = randomUUID();
      await tx.execute(
        `INSERT INTO stock_lots (id, household_id, product_id, variant_id, purchase_item_id, quantity_initial, quantity_remaining, entered_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [lotId, householdId, productId, variantId, purchaseItemId, item.stock_quantity, item.stock_quantity, purchasedAt, now],
      );
      await tx.execute(
        `INSERT INTO stock_movements (id, household_id, product_id, lot_id, type, quantity, note, created_by, created_at)
         VALUES (?, ?, ?, ?, 'entrada', ?, ?, ?, ?)`,
        [randomUUID(), householdId, productId, lotId, item.stock_quantity, 'Nota fiscal', userId, purchasedAt],
      );
    }
  });

  return items.length;
}
