import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { SupabaseConnector } from '@/lib/powersync/connector';
import { db } from '@/lib/powersync/db';
import { supabase } from '@/lib/supabase';

type SessionState = {
  session: Session | null;
  /** true enquanto ainda estamos lendo a sessão salva no aparelho */
  loading: boolean;
};

const SessionContext = createContext<SessionState>({ session: null, loading: true });

const connector = new SupabaseConnector();

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });

      if (event === 'SIGNED_OUT') {
        // Apaga os dados locais para o próximo usuário do aparelho não ver nada.
        db.disconnectAndClear();
      } else if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        // Funciona offline: se não houver internet, o PowerSync tenta de novo sozinho.
        db.connect(connector);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
