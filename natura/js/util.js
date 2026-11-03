// Utilitários gerais compartilhados por todos os módulos.
window.NF = window.NF || {};

NF.util = (() => {
  let seq = 0;
  const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

  const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const debounce = (fn, ms) => {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    return d;
  };

  const slug = (s) => (s || 'panfleto').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'panfleto';

  // Preços são guardados como texto no formato brasileiro ("189,90").
  const limparPreco = (s) => {
    if (s == null) return '';
    let t = String(s).replace(/R\$\s*/i, '').replace(/cada/i, '').trim();
    if (!t) return '';
    t = t.replace(/\s/g, '');
    if (/^\d+$/.test(t)) t += ',00';
    if (/^\d+\.\d{1,2}$/.test(t)) t = t.replace('.', ',');
    const m = t.match(/^(\d{1,3}(?:\.\d{3})*|\d+),(\d{1,2})$/);
    if (m) return `${m[1].replace(/\./g, '')},${m[2].padEnd(2, '0')}`;
    return t;
  };

  const partesPreco = (s) => {
    const t = limparPreco(s);
    const [int, cents] = t.split(',');
    return { int: int || '0', cents: (cents || '00').padEnd(2, '0') };
  };

  const precoNumero = (s) => {
    const { int, cents } = partesPreco(s);
    return Number(int) + Number(cents) / 100;
  };

  // Datas em ISO (aaaa-mm-dd) → dd/mm/aaaa ou dd/mm
  const formatarData = (iso, curto = false) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!d) return iso;
    return curto ? `${d}/${m}` : `${d}/${m}/${y}`;
  };

  const carregarImagem = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });

  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  // Executa tarefas assíncronas com limite de concorrência.
  async function emLotes(itens, limite, fn) {
    const res = new Array(itens.length);
    let i = 0;
    const worker = async () => {
      while (i < itens.length) {
        const k = i++;
        res[k] = await fn(itens[k], k);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker));
    return res;
  }

  const emitter = () => {
    const subs = new Set();
    return { on: (f) => (subs.add(f), () => subs.delete(f)), emit: (...a) => subs.forEach((f) => f(...a)) };
  };

  // Lê um .zip (ex.: o "Baixar" de vários arquivos do SharePoint) e devolve [{ nome, blob }], sem pastas.
  // Sem biblioteca: diretório central do zip + DecompressionStream para o método deflate.
  async function lerZip(arquivo) {
    const buf = new Uint8Array(await arquivo.arrayBuffer());
    const dv = new DataView(buf.buffer);
    let fim = buf.length - 22;
    while (fim >= 0 && dv.getUint32(fim, true) !== 0x06054b50) fim--;
    if (fim < 0) throw new Error(`${arquivo.name} não é um .zip válido`);
    const total = dv.getUint16(fim + 10, true);
    let p = dv.getUint32(fim + 16, true);
    const saida = [];
    for (let i = 0; i < total && dv.getUint32(p, true) === 0x02014b50; i++) {
      const metodo = dv.getUint16(p + 10, true), tamanho = dv.getUint32(p + 20, true);
      const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const nome = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nLen)).split('/').pop();
      p += 46 + nLen + xLen + cLen;
      if (!nome || (metodo !== 0 && metodo !== 8)) continue;
      const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      let blob = new Blob([buf.subarray(ini, ini + tamanho)]);
      if (metodo === 8) blob = await new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
      saida.push({ nome, blob });
    }
    return saida;
  }

  return { uid, clone, clamp, debounce, slug, limparPreco, partesPreco, precoNumero, formatarData, carregarImagem, esperar, emLotes, emitter, lerZip };
})();
