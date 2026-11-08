// Leitura da página de consulta da NFC-e da SEFAZ de Minas Gerais.
// A página lista cada item numa linha (<tr>) com textos fixos como
// "Qtde total de ítens", "UN:" e "Valor total R$". Em vez de depender da
// posição das tabelas, procuramos esses textos, que mudam bem menos.

export type ParsedItem = {
  raw_description: string;
  code: string | null;
  quantity: number;
  unit: string;
  total_price: number;
};

export type ParsedReceipt = {
  access_key: string;
  store_name: string | null;
  store_cnpj: string | null;
  purchased_at: string | null; // ISO
  total: number | null;
  items: ParsedItem[];
};

/** Hosts aceitos. Só buscamos páginas desses endereços (evita usar a função para acessar qualquer site). */
const MG_HOSTS = new Set([
  'portalsped.fazenda.mg.gov.br',
  'nfce.fazenda.mg.gov.br',
]);

export function validateMgUrl(raw: string): { url: URL; accessKey: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UserError('Esse QR code não é de uma nota fiscal.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UserError('Esse QR code não é de uma nota fiscal.');
  }
  if (!MG_HOSTS.has(url.hostname)) {
    throw new UserError('Por enquanto o app lê apenas notas de Minas Gerais.');
  }
  url.protocol = 'https:';
  // Endereço antigo foi desativado; a consulta atual fica no portalsped.
  url.hostname = 'portalsped.fazenda.mg.gov.br';

  const p = url.searchParams.get('p') ?? '';
  const accessKey = p.split('|')[0].replace(/\D/g, '');
  if (accessKey.length !== 44) {
    throw new UserError('Não encontrei a chave de acesso nesse QR code.');
  }
  return { url, accessKey };
}

export class UserError extends Error {}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  acirc: 'â', ecirc: 'ê', ocirc: 'ô', Acirc: 'Â', Ecirc: 'Ê', Ocirc: 'Ô',
  atilde: 'ã', otilde: 'õ', Atilde: 'Ã', Otilde: 'Õ', ccedil: 'ç', Ccedil: 'Ç',
};

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m);
}

function stripTags(html: string): string {
  return decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** "1.234,56" → 1234.56 ; "1.0000" → 1 ; "0,850" → 0.85 */
export function parseBrNumber(text: string): number | null {
  const clean = text.trim();
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseBrDate(text: string): string | null {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = '12', mi = '00', ss = '00'] = m;
  // Horário de Brasília (UTC-3)
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`).toISOString();
}

export function parseReceiptHtml(html: string, accessKey: string): ParsedReceipt {
  const items: ParsedItem[] = [];

  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const rowHtml = row.split(/<\/tr>/i)[0];
    if (!/Qtde/i.test(rowHtml)) continue;

    const text = stripTags(rowHtml);
    const descHtml = rowHtml.match(/<h7[^>]*>([\s\S]*?)<\/h7>/i)?.[1]
      ?? rowHtml.match(/class="txtTit[^"]*"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    const description = descHtml ? stripTags(descHtml) : null;
    const qty = text.match(/Qtde\.?(?:\s*total de [ií]tens)?\s*:?\s*([\d.,]+)/i)?.[1];
    const unit = text.match(/UN\s*:\s*([A-Za-z]+)/)?.[1];
    const value =
      text.match(/Valor total R\$\s*:?\s*(?:R\$)?\s*([\d.,]+)/i)?.[1] ??
      text.match(/Vl\.?\s*Total\s*:?\s*([\d.,]+)/i)?.[1];
    const code = text.match(/C[óo]digo\s*:\s*([^)\s]+)/i)?.[1] ?? null;

    const quantity = qty ? parseBrNumber(qty) : null;
    const total = value ? parseBrNumber(value) : null;
    if (!description || quantity == null || total == null) continue;

    items.push({
      raw_description: description.toUpperCase(),
      code,
      quantity,
      unit: (unit ?? 'UN').toUpperCase(),
      total_price: total,
    });
  }

  const pageText = stripTags(html);
  const storeHtml =
    html.match(/<h4[^>]*>\s*<b>([\s\S]*?)<\/b>/i)?.[1] ??
    html.match(/id="u20"[^>]*>([\s\S]*?)</i)?.[1];
  const cnpj = pageText.match(/CNPJ\s*:?\s*([\d./-]{14,18})/i)?.[1] ?? null;
  const emission =
    pageText.match(/Emiss[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/i)?.[1] ??
    pageText.match(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/)?.[0] ??
    null;
  const totalText =
    pageText.match(/Valor a pagar R\$\s*:?\s*([\d.,]+)/i)?.[1] ??
    pageText.match(/Valor total R\$\s*:?\s*([\d.,]+)\s*(?:Desconto|Valor a pagar|Forma)/i)?.[1];

  return {
    access_key: accessKey,
    store_name: storeHtml ? stripTags(storeHtml) : null,
    store_cnpj: cnpj ? cnpj.replace(/\D/g, '') : null,
    purchased_at: emission ? parseBrDate(emission) : null,
    total: totalText ? parseBrNumber(totalText) : null,
    items,
  };
}
