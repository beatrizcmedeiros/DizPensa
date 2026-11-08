import { randomUUID } from 'expo-crypto';

import { db } from '@/lib/powersync/db';

/**
 * Adiciona à lista de compras os produtos que acabaram ou estão abaixo do
 * mínimo e que ainda não estão na lista. Retorna quantos foram adicionados.
 */
export async function addMissingToList(householdId: string, userId: string): Promise<number> {
  return db.writeTransaction(async (tx) => {
    const missing = await tx.getAll<{ id: string; name: string; min_quantity: number; quantity: number }>(
      `SELECT * FROM (
         SELECT p.id, p.name, p.min_quantity,
                COALESCE((SELECT SUM(l.quantity_remaining) FROM stock_lots l
                          WHERE l.product_id = p.id AND l.quantity_remaining > 0), 0) AS quantity
         FROM products p
         WHERE p.household_id = ? AND p.archived = 0
           AND NOT EXISTS (SELECT 1 FROM shopping_list_items s
                           WHERE s.product_id = p.id AND s.checked = 0)
       )
       WHERE quantity <= 0 OR (min_quantity > 0 AND quantity <= min_quantity)
       ORDER BY name`,
      [householdId],
    );
    const now = new Date().toISOString();
    for (const p of missing) {
      await tx.execute(
        `INSERT INTO shopping_list_items (id, household_id, product_id, name, quantity, checked, created_by, created_at)
         VALUES (?, ?, ?, ?, NULL, 0, ?, ?)`,
        [randomUUID(), householdId, p.id, p.name, userId, now],
      );
    }
    return missing.length;
  });
}

export async function addListItem(params: {
  householdId: string;
  userId: string;
  name: string;
  productId?: string | null;
}) {
  // Se já existe um produto com esse nome, liga o item a ele.
  const product =
    params.productId != null
      ? { id: params.productId }
      : await db.getOptional<{ id: string }>(
          `SELECT id FROM products WHERE household_id = ? AND lower(name) = lower(?) LIMIT 1`,
          [params.householdId, params.name.trim()],
        );
  await db.execute(
    `INSERT INTO shopping_list_items (id, household_id, product_id, name, quantity, checked, created_by, created_at)
     VALUES (?, ?, ?, ?, NULL, 0, ?, ?)`,
    [randomUUID(), params.householdId, product?.id ?? null, params.name.trim(), params.userId, new Date().toISOString()],
  );
}
