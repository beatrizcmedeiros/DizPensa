import {
  type CommonPowerSyncDatabase,
  type PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';

import { supabase } from '@/lib/supabase';

// Erros do Postgres que nunca vão dar certo numa nova tentativa
// (dado inválido, violação de regra, sem permissão). Se a gente não
// descartar essas alterações, a fila de envio trava para sempre.
const FATAL_RESPONSE_CODES = [/^22...$/, /^23...$/, /^42501$/];

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const endpoint = process.env.EXPO_PUBLIC_POWERSYNC_URL;
    if (!endpoint) {
      throw new Error('Falta EXPO_PUBLIC_POWERSYNC_URL no arquivo .env');
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) return null;

    return { endpoint, token: data.session.access_token };
  }

  async uploadData(database: CommonPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    let lastOp: unknown = null;
    try {
      for (const op of transaction.crud) {
        lastOp = op;
        const table = supabase.from(op.table);
        let result;
        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData ?? {}).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            result = await table.delete().eq('id', op.id);
            break;
        }
        if (result?.error) {
          throw result.error;
        }
      }
      await transaction.complete();
    } catch (error: any) {
      const code = typeof error?.code === 'string' ? error.code : '';
      if (FATAL_RESPONSE_CODES.some((re) => re.test(code))) {
        console.error('Alteração descartada pelo servidor', lastOp, error);
        await transaction.complete();
      } else {
        // Erro temporário (sem internet etc.): o PowerSync tenta de novo depois.
        throw error;
      }
    }
  }
}
