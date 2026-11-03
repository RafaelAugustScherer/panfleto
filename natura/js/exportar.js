// Exportação PNG: "Redes sociais" (A4 sem marcas) e "Impressão" (sangria + marcas de corte + barras de cor).
NF.exportar = (() => {
  const M = NF.modelo;
  const IMPRESSAO = { w: 2755, h: 3783 };

  // Garante que todas as imagens do projeto estão carregadas e processadas antes de desenhar.
  async function precarregar(projeto) {
    const refs = new Set();
    const produtos = [];
    for (const pag of Object.values(projeto.paginas)) {
      for (const el of pag.elementos) if (el.tipo === 'imagem' && el.ref) refs.add(el.ref);
    }
    for (const of of projeto.ofertas) for (const p of of.produtos) if (p.imagem) { refs.add(`proj:${p.imagem}`); produtos.push(p); }
    await Promise.all([...refs].map((r) => NF.imagens.carregarRef(r).catch(() => null)));
    for (const p of produtos) NF.imagens.obterProcessada(p.imagem, p.tolerancia, p.recorte);
  }

  function redes(canvasPagina) {
    const R = M.REFILE;
    const cv = document.createElement('canvas');
    cv.width = R.w; cv.height = R.h;
    cv.getContext('2d').drawImage(canvasPagina, R.x, R.y, R.w, R.h, 0, 0, R.w, R.h);
    return cv;
  }

  function impressao(canvasPagina) {
    const P = M.PAGINA;
    const cv = document.createElement('canvas');
    cv.width = IMPRESSAO.w; cv.height = IMPRESSAO.h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cv.width, cv.height);
    const ox = Math.floor((IMPRESSAO.w - P.w) / 2), oy = Math.floor((IMPRESSAO.h - P.h) / 2);
    ctx.drawImage(canvasPagina, ox, oy);

    // Marcas de corte nos cantos do refile, fora da sangria.
    const t = { x0: ox + P.sangria, y0: oy + P.sangria, x1: ox + P.w - P.sangria, y1: oy + P.h - P.sangria };
    const ini = P.sangria + 12, comp = 62;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    const linha = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    for (const [x, sx] of [[t.x0, -1], [t.x1, 1]]) {
      for (const [y, sy] of [[t.y0, -1], [t.y1, 1]]) {
        linha(x + sx * ini, y, x + sx * (ini + comp), y);
        linha(x, y + sy * ini, x, y + sy * (ini + comp));
      }
    }

    // Barras de controle: escala de cinza à esquerda, cores à direita.
    const q = 50, by = 22;
    const cinzas = ['#000', '#1a1a1a', '#333', '#4d4d4d', '#666', '#808080', '#999', '#b3b3b3', '#ccc', '#e6e6e6', '#fff'];
    cinzas.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(ox + 60 + i * q, by, q, q); });
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(ox + 60, by, cinzas.length * q, q);
    const cores = ['#ffed00', '#e6007e', '#009fe3', '#312783', '#009640', '#e30613', '#000000', '#fff59b', '#f5a3c7', '#8fd3f5', '#9d9d9c'];
    const xc = ox + P.w - 60 - cores.length * q;
    cores.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(xc + i * q, by, q, q); });
    ctx.strokeRect(xc, by, cores.length * q, q);
    return cv;
  }

  // ---- PNG com 300 dpi (bloco pHYs) ----
  const TAB_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (bytes) => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = TAB_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  async function pngComDpi(canvas, dpi = 300) {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer());
    const ppm = Math.round(dpi / 0.0254);
    const chunk = new Uint8Array(21);
    const dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9);
    chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
    dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
    dv.setUint32(17, crc32(chunk.subarray(4, 17)));
    const fimIHDR = 8 + 25; // assinatura + bloco IHDR
    const out = new Uint8Array(buf.length + chunk.length);
    out.set(buf.subarray(0, fimIHDR), 0);
    out.set(chunk, fimIHDR);
    out.set(buf.subarray(fimIHDR), fimIHDR + chunk.length);
    return new Blob([out], { type: 'image/png' });
  }

  // paginas: ['frente','verso'] ; formatos: ['impressao','redes']
  async function exportar(projeto, paginas, formatos, progresso = () => {}) {
    await precarregar(projeto);
    const arquivos = [];
    let passo = 0;
    const total = paginas.length * formatos.length;
    for (const pid of paginas) {
      const base = NF.cena.exportarCanvas(projeto, pid);
      for (const fmt of formatos) {
        const cv = fmt === 'impressao' ? impressao(base) : redes(base);
        const blob = await pngComDpi(cv, 300);
        const nome = `${pid}-${fmt === 'impressao' ? 'impressao' : 'redes'}.png`;
        await NF.arquivos.gravarNoProjeto(`exportados/${nome}`, blob);
        arquivos.push({ nome, blob, w: cv.width, h: cv.height });
        progresso(++passo / total, nome);
      }
    }
    return arquivos;
  }

  return { exportar, precarregar, IMPRESSAO };
})();
