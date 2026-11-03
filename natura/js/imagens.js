// Imagens: galeria da Natura, download para a pasta do panfleto, remoção de fundo e cache.
NF.imagens = (() => {
  const URL_NATURA = (codigo, n) => `https://static.rede.natura.net/nxcf/image/sku/1200x1200/${codigo}_${n}.jpg`;
  const MAX_GALERIA = 10;
  const eventos = NF.util.emitter();

  // Fotos da página do produto em natura.com.br (às vezes só existem lá). O servidor delas não libera CORS,
  // então o download passa por um intermediário na mesma pasta do editor (rota natura-imagem): o servidor.py
  // localmente, a Pages Function functions/natura/natura-imagem.js no Cloudflare.
  const URL_SITE = (codigo, n) => `https://production.na01.natura.com/on/demandware.static/-/Sites-natura-br-storefront-catalog/default/NATBRA-${codigo}_${n}.jpg`;
  // Escolha da galeria: número = link interno (1, 2…); "s1", "s2"… = site da Natura.
  const ehSite = (g) => /^s\d+$/.test(String(g));
  const urlGaleria = (codigo, g) => (ehSite(g) ? URL_SITE(codigo, String(g).slice(1)) : URL_NATURA(codigo, g));

  // ---------- Galeria ----------
  const galerias = new Map(); // codigo -> Promise<{ interna, site }>
  const existeRemoto = (url) => new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth > 1);
    img.onerror = () => res(false);
    img.src = url;
  });
  const contar = async (url) => {
    let n = 0;
    while (n < MAX_GALERIA && await existeRemoto(url(n + 1))) n++;
    return n;
  };
  function contarGaleria(codigo) {
    if (!galerias.has(codigo)) {
      galerias.set(codigo, Promise.all([contar((n) => URL_NATURA(codigo, n)), contar((n) => URL_SITE(codigo, n))])
        .then(([interna, site]) => ({ interna, site })));
    }
    return galerias.get(codigo);
  }

  async function baixarDaNatura(codigo, g) {
    let r;
    if (ehSite(g)) {
      if (location.protocol === 'file:') throw new Error('Fotos do site da Natura só baixam com o editor aberto pelo endereço publicado ou pelo servidor local.');
      r = await fetch(`natura-imagem?u=${encodeURIComponent(urlGaleria(codigo, g))}`);
    } else r = await fetch(URL_NATURA(codigo, g), { mode: 'cors' });
    if (!r.ok) throw new Error(`Imagem ${codigo}_${g} não encontrada (${r.status})`);
    const blob = await r.blob();
    const caminho = `imagens/${codigo}_${g}.jpg`;
    await NF.arquivos.gravarNoProjeto(caminho, blob);
    esquecer(caminho);
    return caminho;
  }

  async function salvarEnvio(file, prefixo) {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const caminho = `${prefixo}_${Date.now().toString(36)}.${ext}`;
    await NF.arquivos.gravarNoProjeto(caminho, file);
    return caminho;
  }

  // ---------- Fontes de imagem ----------
  // Referências: "proj:<caminho no panfleto>", "lib:<arte>:<recurso>", "bib:<arquivo da biblioteca do usuário>"
  const fontes = new Map(); // ref -> Promise<HTMLImageElement>
  const prontas = new Map(); // ref -> HTMLImageElement

  async function blobParaImagem(blob) {
    const url = URL.createObjectURL(blob);
    return NF.util.carregarImagem(url);
  }

  function carregarRef(ref) {
    if (!fontes.has(ref)) {
      const p = (async () => {
        const [tipo, ...resto] = ref.split(':');
        const valor = resto.join(':');
        if (tipo === 'proj') return blobParaImagem(await NF.arquivos.lerDoProjeto(valor));
        if (tipo === 'bib') return blobParaImagem(await NF.arquivos.lerDaBiblioteca(valor));
        if (tipo === 'lib') {
          const [arteId, recurso] = valor.split(':');
          const arte = (window.NF_ARTES || []).find((a) => a.id === arteId);
          if (!arte || !arte[recurso]) throw new Error(`Arte ${valor} não encontrada`);
          return NF.util.carregarImagem(arte[recurso]);
        }
        if (tipo === 'data') return NF.util.carregarImagem(ref);
        if (tipo === 'http' || tipo === 'https') {
          const r = await fetch(ref, { mode: 'cors' });
          if (!r.ok) throw new Error(`Imagem não encontrada (${r.status}): ${ref}`);
          return blobParaImagem(await r.blob());
        }
        throw new Error(`Referência inválida: ${ref}`);
      })();
      fontes.set(ref, p);
      p.then((img) => { prontas.set(ref, img); eventos.emit(ref); })
        .catch((e) => { console.warn(e); prontas.set(ref, null); eventos.emit(ref); });
    }
    return fontes.get(ref);
  }

  // Acesso síncrono para a renderização: retorna a imagem ou undefined (e começa a carregar).
  function obter(ref) {
    if (!ref) return null;
    if (prontas.has(ref)) return prontas.get(ref);
    carregarRef(ref);
    return undefined;
  }

  // ---------- Remoção de fundo ----------
  // Varinha mágica a partir das bordas: remove pixels próximos do branco ligados à borda.
  // Pixels mantidos vizinhos ao fundo recebem transparência parcial (borda suave).
  // recorte: % a cortar de cada lado ({ e, d, c, b }) antes de tirar o fundo (ex.: foto com um detalhe ao lado do produto).
  function removerFundo(img, tolerancia = 5, recorte = null) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const rc = recorte || {};
    const sx = Math.round((W * (rc.e || 0)) / 100), sy = Math.round((H * (rc.c || 0)) / 100);
    const w = Math.max(1, W - sx - Math.round((W * (rc.d || 0)) / 100)), h = Math.max(1, H - sy - Math.round((H * (rc.b || 0)) / 100));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
    const im = ctx.getImageData(0, 0, w, h);
    const d = im.data;
    const n = w * h;
    const fundo = new Uint8Array(n);
    const lim = 255 - tolerancia;
    const claro = (p) => { const i = p * 4; return d[i] >= lim && d[i + 1] >= lim && d[i + 2] >= lim; };

    if (tolerancia >= 0) {
      const fila = new Int32Array(n);
      let ini = 0, fim = 0;
      const semear = (p) => { if (!fundo[p] && claro(p)) { fundo[p] = 1; fila[fim++] = p; } };
      for (let x = 0; x < w; x++) { semear(x); semear((h - 1) * w + x); }
      for (let y = 0; y < h; y++) { semear(y * w); semear(y * w + w - 1); }
      while (ini < fim) {
        const p = fila[ini++];
        const x = p % w;
        if (x > 0) semear(p - 1);
        if (x < w - 1) semear(p + 1);
        if (p >= w) semear(p - w);
        if (p < n - w) semear(p + w);
      }
    }

    let minX = w, minY = h, maxX = -1, maxY = -1;
    const SUAVE = 36 + tolerancia;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x, i = p * 4;
        if (fundo[p]) { d[i + 3] = 0; continue; }
        const vizinhoFundo = (x > 0 && fundo[p - 1]) || (x < w - 1 && fundo[p + 1]) || (y > 0 && fundo[p - w]) || (y < h - 1 && fundo[p + w]);
        if (vizinhoFundo) {
          const dist = 255 - Math.min(d[i], d[i + 1], d[i + 2]);
          if (dist < SUAVE) d[i + 3] = Math.round(255 * Math.max(0.15, dist / SUAVE));
        }
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    ctx.putImageData(im, 0, 0);
    // ox/oy: onde o resultado começa na foto original (o modo de recorte sobrepõe a foto inteira ao produto).
    if (maxX < 0) return { canvas: cv, w, h, ox: sx, oy: sy };
    const tw = maxX - minX + 1, th = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = tw; out.height = th;
    out.getContext('2d').drawImage(cv, minX, minY, tw, th, 0, 0, tw, th);
    return { canvas: out, w: tw, h: th, ox: sx + minX, oy: sy + minY };
  }

  const processadas = new Map(); // chave -> {canvas,w,h} | null (falha) ; ausente = carregando
  const pendentes = new Set();
  function obterProcessada(caminho, tolerancia = 5, recorte = null) {
    if (!caminho) return null;
    const ref = /^https?:/.test(caminho) ? caminho : `proj:${caminho}`; // URL direta: prévias do playground
    const chave = `${ref}|${tolerancia}|${['e', 'd', 'c', 'b'].map((k) => recorte?.[k] || 0).join(',')}`;
    if (processadas.has(chave)) return processadas.get(chave);
    const img = obter(ref);
    if (img === null) return null;
    if (img === undefined) {
      if (!pendentes.has(ref)) {
        pendentes.add(ref);
        const off = eventos.on((r) => { if (r === ref) { off(); pendentes.delete(ref); eventos.emit('processar'); } });
      }
      return undefined;
    }
    const res = removerFundo(img, tolerancia, recorte);
    processadas.set(chave, res);
    return res;
  }

  function esquecer(caminho) {
    const ref = `proj:${caminho}`;
    fontes.delete(ref); prontas.delete(ref);
    for (const k of [...processadas.keys()]) if (k.startsWith(`${ref}|`)) processadas.delete(k);
  }

  return { URL_NATURA, urlGaleria, contarGaleria, baixarDaNatura, salvarEnvio, obter, carregarRef, obterProcessada, removerFundo, esquecer, eventos };
})();
