// Recebe o link do QR code da NFC-e, lê a nota na SEFAZ de MG e devolve os
// itens com uma sugestão de produto para cada um. Não grava nada: quem grava
// é o app, depois que a pessoa revisa (assim funciona igual offline e online).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

import { normalizeItems, type Normalized } from './normalize.ts';
import { parseReceiptHtml, UserError, validateMgUrl } from './parse.ts';

type Suggestion = {
  product_id: string | null;
  product_name: string;
  brand: string | null;
  category_id: string | null;
  unit_type: 'package' | 'weight';
  source: 'memoria' | 'ia' | 'nota';
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
}

function unitTypeFromUnit(unit: string): 'package' | 'weight' {
  return unit === 'KG' || unit === 'G' ? 'weight' : 'package';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  try {
    const { url: rawUrl, household_id: householdId } = await req.json();
    if (typeof rawUrl !== 'string' || typeof householdId !== 'string') {
      return json({ error: 'Envie url e household_id.' }, 400);
    }

    // Cliente com o login de quem chamou: as regras de permissão do banco valem aqui.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );

    const { data: household } = await supabase
      .from('households')
      .select('id')
      .eq('id', householdId)
      .maybeSingle();
    if (!household) return json({ error: 'Casa não encontrada.' }, 403);

    const { url, accessKey } = validateMgUrl(rawUrl);

    const { data: existing } = await supabase
      .from('purchases')
      .select('id, purchased_at')
      .eq('household_id', householdId)
      .eq('access_key', accessKey)
      .maybeSingle();
    if (existing) {
      return json({ error: 'Essa nota já foi lançada na despensa.', code: 'duplicate' }, 409);
    }

    // Página da SEFAZ
    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`SEFAZ respondeu ${res.status}`);
      html = await res.text();
    } catch (e) {
      console.error('Falha ao consultar a SEFAZ', e);
      return json(
        { error: 'O site da SEFAZ não respondeu. Tente de novo em alguns minutos.', code: 'sefaz_unavailable' },
        502,
      );
    }

    const receipt = parseReceiptHtml(html, accessKey);
    if (receipt.items.length === 0) {
      console.error('Nenhum item encontrado. Tamanho do HTML:', html.length, 'trecho:', html.slice(0, 500));
      return json(
        {
          error: 'Não consegui ler os itens dessa nota. Às vezes a SEFAZ demora a liberar notas recentes; tente mais tarde.',
          code: 'parse_failed',
        },
        422,
      );
    }

    const [{ data: categories }, { data: products }, { data: history }] = await Promise.all([
      supabase.from('categories').select('id, name').eq('household_id', householdId),
      supabase
        .from('products')
        .select('id, name, unit_type, category_id')
        .eq('household_id', householdId)
        .eq('archived', 0),
      supabase
        .from('purchase_items')
        .select('raw_description, product_id, created_at, product_variants(brand)')
        .eq('household_id', householdId)
        .in('raw_description', [...new Set(receipt.items.map((i) => i.raw_description))])
        .not('product_id', 'is', null)
        .order('created_at', { ascending: false }),
    ]);

    // Memória: como a casa classificou essa mesma descrição da última vez.
    const productsById = new Map((products ?? []).map((p) => [p.id, p]));
    const remembered = new Map<string, { product_id: string; brand: string | null }>();
    for (const row of history ?? []) {
      if (remembered.has(row.raw_description) || !row.product_id) continue;
      const variant = row.product_variants as { brand: string | null } | null;
      remembered.set(row.raw_description, { product_id: row.product_id, brand: variant?.brand ?? null });
    }

    const unknown = receipt.items
      .map((item, index) => ({ index, raw_description: item.raw_description, unit: item.unit }))
      .filter((i) => {
        const m = remembered.get(i.raw_description);
        return !m || !productsById.has(m.product_id);
      });

    let aiResult = new Map<number, Normalized>();
    let aiAvailable = true;
    if (unknown.length > 0) {
      if (!Deno.env.get('ANTHROPIC_API_KEY')) {
        aiAvailable = false;
      } else {
        try {
          aiResult = await normalizeItems(unknown, categories ?? [], products ?? []);
        } catch (e) {
          console.error('Falha na IA', e);
          aiAvailable = false;
        }
      }
    }

    const items = receipt.items.map((item, index) => {
      let suggestion: Suggestion;
      const memory = remembered.get(item.raw_description);
      const memoryProduct = memory ? productsById.get(memory.product_id) : undefined;
      const ai = aiResult.get(index);

      if (memory && memoryProduct) {
        suggestion = {
          product_id: memoryProduct.id,
          product_name: memoryProduct.name,
          brand: memory.brand,
          category_id: memoryProduct.category_id,
          unit_type: memoryProduct.unit_type as 'package' | 'weight',
          source: 'memoria',
        };
      } else if (ai) {
        const linked = ai.existing_product_id ? productsById.get(ai.existing_product_id) : undefined;
        suggestion = {
          product_id: linked?.id ?? null,
          product_name: linked?.name ?? ai.product_name,
          brand: ai.brand,
          category_id: linked?.category_id ?? ai.category_id,
          unit_type: (linked?.unit_type as 'package' | 'weight') ?? ai.unit_type,
          source: 'ia',
        };
      } else {
        suggestion = {
          product_id: null,
          product_name: titleCase(item.raw_description),
          brand: null,
          category_id: null,
          unit_type: unitTypeFromUnit(item.unit),
          source: 'nota',
        };
      }

      return {
        index,
        ...item,
        unit_price: item.quantity > 0 ? Math.round((item.total_price / item.quantity) * 100) / 100 : null,
        suggestion,
      };
    });

    return json({
      access_key: receipt.access_key,
      store_name: receipt.store_name,
      store_cnpj: receipt.store_cnpj,
      purchased_at: receipt.purchased_at,
      total: receipt.total,
      ai_available: aiAvailable,
      items,
    });
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message, code: 'invalid_qr' }, 400);
    console.error('Erro inesperado', e);
    return json({ error: 'Erro inesperado ao ler a nota.' }, 500);
  }
});
