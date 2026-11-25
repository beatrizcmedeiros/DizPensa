import { useCallback } from 'react';

import { useToast } from '@/components/toast';
import { formatQuantity } from '@/lib/format';
import { useHousehold } from '@/lib/household';
import type { UnitType } from '@/lib/powersync/schema';
import { consume, undoConsume } from '@/lib/stock';

/**
 * Registra que alguém usou um produto e mostra o aviso com "Desfazer"
 * (um toque errado no "Usei 1" não pode ficar sem volta).
 */
export function useConsume() {
  const { household, userId } = useHousehold();
  const toast = useToast();

  return useCallback(
    async (product: { id: string; name: string; unit_type: UnitType }, quantity: number | 'all') => {
      const result = await consume({ householdId: household.id, userId, productId: product.id, quantity });
      if (result.consumed === 0) {
        toast({ message: `Não há ${product.name} em casa.` });
        return result;
      }
      toast({
        message:
          quantity === 'all'
            ? `${product.name} marcado como acabou`
            : `Usou ${formatQuantity(result.consumed, product.unit_type)} de ${product.name}`,
        actionLabel: 'Desfazer',
        onAction: () => undoConsume(result.undo),
      });
      return result;
    },
    [household.id, userId, toast],
  );
}
