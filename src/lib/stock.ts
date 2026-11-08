import type { Transaction } from '@powersync/react-native';
import { randomUUID } from 'expo-crypto';

import { round } from '@/lib/format';
import { db } from '@/lib/powersync/db';
import type { UnitType } from '@/lib/powersync/schema';

const now = () => new Date().toISOString();

export type NewProductInput = {
  householdId: string;
  name: string;
  categoryId: string | null;
  unitType: UnitType;
  minQuantity: number;
};

export type EntryInput = {
  householdId: string;
  userId: string;
  productId: string;
  quantity: number;
  brand?: string | null;
  totalPrice?: number | null;
  storeName?: string | null;
  purchasedAt?: string;
};

export async function createProduct(input: NewProductInput, tx?: Transaction): Promise<string> {
  const id = randomUUID();
  const run = async (t: Transaction) => {
    await t.execute(
      `INSERT INTO products (id, household_id, name, category_id, unit_type, min_quantity, archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, input.householdId, input.name.trim(), input.categoryId, input.unitType, input.minQuantity, now()],
    );
  };
  if (tx) await run(tx);
  else await db.writeTransaction(run);
  return id;
}

/** Acha a variante (marca) do produto ou cria uma nova. */
async function findOrCreateVariant(
  tx: Transaction,
  householdId: string,
  productId: string,
  brand: string,
): Promise<string> {
  const existing = await tx.getOptional<{ id: string }>(
    `SELECT id FROM product_variants WHERE product_id = ? AND lower(brand) = lower(?) LIMIT 1`,
    [productId, brand],
  );
  if (existing) return existing.id;

  const id = randomUUID();
  await tx.execute(
    `INSERT INTO product_variants (id, household_id, product_id, brand, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, householdId, productId, brand, now()],
  );
  return id;
}

/**
 * Entrada no estoque: cria um lote novo e registra o movimento.
 * Se veio com valor pago, também registra a compra (para relatórios de preço).
 */
export async function addEntry(input: EntryInput, existingTx?: Transaction): Promise<void> {
  const run = async (tx: Transaction) => {
    const at = input.purchasedAt ?? now();
    const quantity = round(input.quantity);
    const brand = input.brand?.trim();
    const variantId = brand
      ? await findOrCreateVariant(tx, input.householdId, input.productId, brand)
      : null;

    let purchaseItemId: string | null = null;
    if (input.totalPrice != null && input.totalPrice > 0) {
      const purchaseId = randomUUID();
      purchaseItemId = randomUUID();
      await tx.execute(
        `INSERT INTO purchases (id, household_id, source, store_name, purchased_at, total, created_by, created_at)
         VALUES (?, ?, 'manual', ?, ?, ?, ?, ?)`,
        [purchaseId, input.householdId, input.storeName?.trim() || null, at, input.totalPrice, input.userId, now()],
      );
      await tx.execute(
        `INSERT INTO purchase_items (id, household_id, purchase_id, product_id, variant_id, quantity, unit_price, total_price, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseItemId,
          input.householdId,
          purchaseId,
          input.productId,
          variantId,
          quantity,
          round(input.totalPrice / quantity, 2),
          input.totalPrice,
          now(),
        ],
      );
    }

    const lotId = randomUUID();
    await tx.execute(
      `INSERT INTO stock_lots (id, household_id, product_id, variant_id, purchase_item_id, quantity_initial, quantity_remaining, entered_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lotId, input.householdId, input.productId, variantId, purchaseItemId, quantity, quantity, at, now()],
    );
    await tx.execute(
      `INSERT INTO stock_movements (id, household_id, product_id, lot_id, type, quantity, created_by, created_at)
       VALUES (?, ?, ?, ?, 'entrada', ?, ?, ?)`,
      [randomUUID(), input.householdId, input.productId, lotId, quantity, input.userId, at],
    );
  };

  if (existingTx) await run(existingTx);
  else await db.writeTransaction(run);
}

/**
 * Baixa no estoque. Consome primeiro o lote mais antigo.
 * Lotes que zeram ganham finished_at (é assim que medimos quanto tempo durou).
 * Passe quantity = 'all' para "acabou tudo".
 * Retorna quanto foi efetivamente baixado.
 */
export async function consume(params: {
  householdId: string;
  userId: string;
  productId: string;
  quantity: number | 'all';
  note?: string;
}): Promise<number> {
  return db.writeTransaction(async (tx) => {
    const lots = await tx.getAll<{ id: string; quantity_remaining: number }>(
      `SELECT id, quantity_remaining FROM stock_lots
       WHERE product_id = ? AND quantity_remaining > 0
       ORDER BY entered_at ASC, created_at ASC`,
      [params.productId],
    );

    let remaining = params.quantity === 'all' ? Infinity : round(params.quantity);
    let consumed = 0;
    const at = now();

    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = round(Math.min(lot.quantity_remaining, remaining));
      const left = round(lot.quantity_remaining - take);
      await tx.execute(
        `UPDATE stock_lots SET quantity_remaining = ?, finished_at = ? WHERE id = ?`,
        [left, left <= 0 ? at : null, lot.id],
      );
      await tx.execute(
        `INSERT INTO stock_movements (id, household_id, product_id, lot_id, type, quantity, note, created_by, created_at)
         VALUES (?, ?, ?, ?, 'baixa', ?, ?, ?, ?)`,
        [randomUUID(), params.householdId, params.productId, lot.id, take, params.note ?? null, params.userId, at],
      );
      remaining = round(remaining - take);
      consumed = round(consumed + take);
    }
    return consumed;
  });
}
