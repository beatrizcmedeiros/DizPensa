import { column, Schema, Table } from '@powersync/react-native';

// Espelho local (SQLite) das tabelas do Supabase.
// O PowerSync cria a coluna `id` automaticamente.
// Datas ficam como texto ISO; booleanos como inteiro (0/1).

const households = new Table({
  name: column.text,
  invite_code: column.text,
  created_by: column.text,
  created_at: column.text,
});

const household_members = new Table(
  {
    household_id: column.text,
    user_id: column.text,
    display_name: column.text,
    role: column.text,
    created_at: column.text,
  },
  { indexes: { household: ['household_id'], user: ['user_id'] } },
);

const categories = new Table(
  {
    household_id: column.text,
    name: column.text,
    icon: column.text,
    sort_order: column.integer,
    created_at: column.text,
  },
  { indexes: { household: ['household_id'] } },
);

const products = new Table(
  {
    household_id: column.text,
    name: column.text,
    category_id: column.text,
    unit_type: column.text,
    min_quantity: column.real,
    archived: column.integer,
    created_at: column.text,
  },
  { indexes: { household: ['household_id'], category: ['category_id'] } },
);

const product_variants = new Table(
  {
    household_id: column.text,
    product_id: column.text,
    brand: column.text,
    size_value: column.real,
    size_unit: column.text,
    gtin: column.text,
    created_at: column.text,
  },
  { indexes: { product: ['product_id'] } },
);

const purchases = new Table(
  {
    household_id: column.text,
    source: column.text,
    access_key: column.text,
    store_name: column.text,
    store_cnpj: column.text,
    purchased_at: column.text,
    total: column.real,
    created_by: column.text,
    created_at: column.text,
  },
  { indexes: { household: ['household_id'], date: ['purchased_at'] } },
);

const purchase_items = new Table(
  {
    household_id: column.text,
    purchase_id: column.text,
    product_id: column.text,
    variant_id: column.text,
    raw_description: column.text,
    quantity: column.real,
    unit: column.text,
    unit_price: column.real,
    total_price: column.real,
    created_at: column.text,
  },
  { indexes: { purchase: ['purchase_id'], product: ['product_id'] } },
);

const stock_lots = new Table(
  {
    household_id: column.text,
    product_id: column.text,
    variant_id: column.text,
    purchase_item_id: column.text,
    quantity_initial: column.real,
    quantity_remaining: column.real,
    entered_at: column.text,
    finished_at: column.text,
    created_at: column.text,
  },
  { indexes: { product: ['product_id'] } },
);

const stock_movements = new Table(
  {
    household_id: column.text,
    product_id: column.text,
    lot_id: column.text,
    type: column.text,
    quantity: column.real,
    note: column.text,
    created_by: column.text,
    created_at: column.text,
  },
  { indexes: { product: ['product_id'] } },
);

const shopping_list_items = new Table(
  {
    household_id: column.text,
    product_id: column.text,
    name: column.text,
    quantity: column.real,
    checked: column.integer,
    created_by: column.text,
    created_at: column.text,
  },
  { indexes: { household: ['household_id'] } },
);

export const AppSchema = new Schema({
  households,
  household_members,
  categories,
  products,
  product_variants,
  purchases,
  purchase_items,
  stock_lots,
  stock_movements,
  shopping_list_items,
});

export type Database = (typeof AppSchema)['types'];
export type HouseholdRecord = Database['households'];
export type MemberRecord = Database['household_members'];
export type CategoryRecord = Database['categories'];
export type ProductRecord = Database['products'];
export type LotRecord = Database['stock_lots'];
export type MovementRecord = Database['stock_movements'];

export type UnitType = 'package' | 'weight';
