import { PowerSyncDatabase } from '@powersync/react-native';

import { AppSchema } from './schema';

// Uma única instância por arquivo de banco.
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'dizpensa.db' },
});
