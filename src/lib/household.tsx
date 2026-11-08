import { useQuery } from '@powersync/react-native';
import { createContext, type PropsWithChildren, useContext, useState } from 'react';

import { useSession } from '@/lib/session';

export type CurrentHousehold = {
  id: string;
  name: string;
  invite_code: string;
  display_name: string;
  role: 'owner' | 'member';
};

/**
 * Casa atual do usuário, lida do banco local.
 * Se a pessoa participa de mais de uma, usamos a mais recente.
 */
export function useCurrentHouseholdQuery() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const { data, isLoading } = useQuery<CurrentHousehold>(
    `SELECT h.id, h.name, h.invite_code, m.display_name, m.role
     FROM household_members m
     JOIN households h ON h.id = m.household_id
     WHERE m.user_id = ?
     ORDER BY m.created_at DESC
     LIMIT 1`,
    [userId],
  );
  return { household: data[0] ?? null, isLoading };
}

type HouseholdContextValue = { household: CurrentHousehold; userId: string };

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({
  value,
  children,
}: PropsWithChildren<{ value: HouseholdContextValue | null }>) {
  // Guarda o último valor válido: ao sair da conta, as telas da casa ainda
  // renderizam uma última vez antes de serem desmontadas.
  const [last, setLast] = useState(value);
  if (value && value !== last) setLast(value);
  return <HouseholdContext.Provider value={value ?? last}>{children}</HouseholdContext.Provider>;
}

/** Use nas telas que só aparecem depois que a casa existe. */
export function useHousehold(): HouseholdContextValue {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('useHousehold usado fora do HouseholdProvider');
  return value;
}
