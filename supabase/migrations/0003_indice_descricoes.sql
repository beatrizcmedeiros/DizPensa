-- Leitura da nota fiscal: para cada descrição que vem na nota
-- ("LEITE UHT INT ITALAC 1L"), procuramos como a casa já classificou essa
-- mesma descrição antes. Assim só chamamos a IA para itens novos.
create index if not exists purchase_items_raw_description_idx
  on public.purchase_items (household_id, raw_description, created_at desc);
