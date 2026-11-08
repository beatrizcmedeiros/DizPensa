// Padronização dos nomes da nota com o Gemini (Google).
// "LEITE UHT INT ITALAC 1L" → produto "Leite integral", marca "Italac".
import { GoogleGenAI } from 'npm:@google/genai@3.0.0';

/** Modelo estável, rápido e barato da linha Flash-Lite. */
const MODEL = 'gemini-3.5-flash-lite';

export type NormalizeInput = {
  index: number;
  raw_description: string;
  unit: string;
};

export type Normalized = {
  index: number;
  product_name: string;
  brand: string | null;
  existing_product_id: string | null;
  category_id: string | null;
  unit_type: 'package' | 'weight';
};

type Category = { id: string; name: string };
type Product = { id: string; name: string; unit_type: string; category_id: string | null };

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          product_name: { type: 'string' },
          brand: { type: ['string', 'null'] },
          existing_product_id: { type: ['string', 'null'] },
          category_id: { type: ['string', 'null'] },
          unit_type: { type: 'string', enum: ['package', 'weight'] },
        },
        required: ['index', 'product_name', 'brand', 'existing_product_id', 'category_id', 'unit_type'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const SYSTEM = `Você organiza a despensa de uma casa brasileira a partir de itens de notas fiscais de supermercado (NFC-e).
As descrições vêm abreviadas e em maiúsculas, por exemplo "LEITE UHT INT ITALAC 1L" ou "PAO FRANCES KG".

Para cada item, devolva:
- product_name: nome genérico e amigável do produto em português, com acentos, sem marca e sem tamanho, como uma pessoa escreveria numa lista de compras. Ex.: "Leite integral", "Pão francês", "Detergente", "Arroz branco", "Peito de frango". Mantenha o tipo/variedade quando muda o produto (integral x desnatado, branco x parboilizado), mas não a marca.
- brand: a marca, se der para identificar com segurança (ex.: "Italac", "Tio João"); senão null.
- existing_product_id: se o item é o mesmo produto genérico de um dos produtos já cadastrados na despensa, o id desse produto (marcas diferentes do mesmo produto contam como o mesmo); senão null. Prefira reaproveitar um produto existente a criar um nome quase igual.
- category_id: o id da categoria mais adequada entre as categorias da casa; null se nenhuma servir.
- unit_type: "weight" para itens vendidos a peso (unidade KG ou G na nota, carnes, frios fatiados, hortifruti a granel); senão "package".

Responda com todos os itens recebidos, usando o mesmo index.`;

export async function normalizeItems(
  items: NormalizeInput[],
  categories: Category[],
  products: Product[],
  apiKey: string,
): Promise<Map<number, Normalized>> {
  const result = new Map<number, Normalized>();
  if (items.length === 0) return result;

  const ai = new GoogleGenAI({ apiKey });

  const userContent = JSON.stringify({
    categorias: categories.map((c) => ({ id: c.id, nome: c.name })),
    produtos_cadastrados: products.map((p) => ({ id: p.id, nome: p.name })),
    itens_da_nota: items.map((i) => ({ index: i.index, descricao: i.raw_description, unidade: i.unit })),
  });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userContent,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseJsonSchema: OUTPUT_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    console.error('Gemini não devolveu texto:', response.candidates?.[0]?.finishReason);
    return result;
  }

  let parsed: { items: Normalized[] };
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    console.error('Resposta da IA não é JSON válido', e);
    return result;
  }
  if (!Array.isArray(parsed?.items)) return result;

  // Só aceitamos ids que existem de verdade nesta casa.
  const productIds = new Set(products.map((p) => p.id));
  const categoryIds = new Set(categories.map((c) => c.id));
  for (const item of parsed.items) {
    if (typeof item?.index !== 'number' || typeof item.product_name !== 'string') continue;
    result.set(item.index, {
      index: item.index,
      product_name: item.product_name.trim(),
      brand: item.brand?.trim() || null,
      existing_product_id:
        item.existing_product_id && productIds.has(item.existing_product_id)
          ? item.existing_product_id
          : null,
      category_id: item.category_id && categoryIds.has(item.category_id) ? item.category_id : null,
      unit_type: item.unit_type === 'weight' ? 'weight' : 'package',
    });
  }
  return result;
}
