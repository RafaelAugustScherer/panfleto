// Pages Function da rota /natura/natura-imagem?u=<url>: baixa fotos do site da Natura para o editor.
// O servidor de imagens delas não libera CORS, então o navegador não as lê direto. Mesmo papel do
// servidor.py local; aceita só imagens do host da Natura, para não virar um proxy aberto.
const HOSTS = new Set(['production.na01.natura.com']);

export async function onRequestGet({ request }) {
  let alvo;
  try { alvo = new URL(new URL(request.url).searchParams.get('u') || ''); } catch { return new Response('URL inválida', { status: 400 }); }
  if (alvo.protocol !== 'https:' || !HOSTS.has(alvo.hostname)) return new Response('Só imagens do site da Natura', { status: 400 });

  const r = await fetch(alvo.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' }, cf: { cacheEverything: true, cacheTtl: 86400 } });
  if (!r.ok) return new Response(null, { status: r.status });
  const tipo = r.headers.get('Content-Type') || '';
  if (!tipo.startsWith('image/')) return new Response(null, { status: 415 });
  return new Response(r.body, { headers: { 'Content-Type': tipo, 'Cache-Control': 'public, max-age=86400' } });
}
