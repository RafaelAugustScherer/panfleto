// Fontes do panfleto: lidas da pasta "fonts" da pasta de trabalho e registradas no navegador.
// Só as famílias encontradas lá aparecem para escolha; o padrão é Helvetica Now Display.
NF.fontes = (() => {
  const PADRAO = 'Helvetica Now Display';
  const LEGADO = { helvetica: PADRAO, futura: PADRAO, natura: 'Natura Display' };
  // Fontes que o editor espera encontrar. Não acompanham o editor (são licenciadas): o usuário instala na pasta.
  const ESPERADAS = [
    { familia: PADRAO, obrigatoria: true, pesos: [[400, 'Regular'], [500, 'Medium'], [700, 'Bold'], [800, 'Extra Bold']] },
    { familia: 'Natura Display', obrigatoria: false, pesos: [] },
  ];
  const familias = new Map(); // nome -> [{peso, rotulo}]
  const presentes = new Set(); // "família|subfamília" já na pasta (evita duplicar ao instalar)
  let versao = 0;
  let situacao = { carregadas: 0, erro: '' };

  // Lê nome da família, subfamília e peso das tabelas "name" e "OS/2" (TTF e OTF).
  function lerMetadados(buf) {
    const dv = new DataView(buf);
    const n = dv.getUint16(4);
    const tabs = {};
    for (let i = 0; i < n; i++) {
      const p = 12 + 16 * i;
      const tag = String.fromCharCode(dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3));
      tabs[tag] = dv.getUint32(p + 8);
    }
    const nomes = {};
    if (tabs.name != null) {
      const o = tabs.name, qtd = dv.getUint16(o + 2), inicio = o + dv.getUint16(o + 4);
      for (let i = 0; i < qtd; i++) {
        const r = o + 6 + 12 * i;
        const plataforma = dv.getUint16(r), id = dv.getUint16(r + 6), len = dv.getUint16(r + 8), off = dv.getUint16(r + 10);
        if (plataforma !== 3 || nomes[id]) continue;
        let s = '';
        for (let k = 0; k < len; k += 2) s += String.fromCharCode(dv.getUint16(inicio + off + k));
        nomes[id] = s;
      }
    }
    let peso = 400, italico = false;
    if (tabs['OS/2'] != null) {
      peso = dv.getUint16(tabs['OS/2'] + 4) || 400;
      italico = (dv.getUint16(tabs['OS/2'] + 62) & 1) === 1;
    }
    return { familia: nomes[16] || nomes[1], subfamilia: nomes[17] || nomes[2] || 'Regular', peso, italico };
  }

  async function carregarDaPasta() {
    familias.clear();
    presentes.clear();
    situacao = { carregadas: 0, erro: '' };
    let arquivos = [];
    try { arquivos = await NF.arquivos.lerFontes(); } catch { situacao.erro = 'Pasta "fonts" não encontrada na pasta de trabalho.'; }
    for (const f of arquivos) {
      try {
        const buf = await f.arrayBuffer();
        const m = lerMetadados(buf);
        if (!m.familia || m.italico) continue;
        presentes.add(`${m.familia}|${m.subfamilia}`);
        const lista = familias.get(m.familia) || [];
        // Duas variantes com o mesmo peso declarado (ex.: XBold e Extra Bold) recebem pesos distintos.
        let peso = m.peso;
        while (lista.some((x) => x.peso === peso)) peso += 50;
        const face = new FontFace(m.familia, buf, { weight: String(peso) });
        await face.load();
        document.fonts.add(face);
        lista.push({ peso, rotulo: m.subfamilia });
        familias.set(m.familia, lista.sort((a, b) => a.peso - b.peso));
        situacao.carregadas++;
      } catch (e) { console.warn('Fonte ignorada:', f.name, e); }
    }
    versao++;
    return situacao;
  }

  const normalizar = (f) => LEGADO[f] || f || PADRAO;
  const css = (f) => `"${normalizar(f)}", "${PADRAO}", "Helvetica Neue", Arial, sans-serif`;

  function opcoesFamilia() {
    const nomes = [...familias.keys()].sort((a, b) => (a === PADRAO ? -1 : b === PADRAO ? 1 : a.localeCompare(b)));
    return (nomes.length ? nomes : [PADRAO]).map((n) => [n, n]);
  }

  function opcoesPeso(familia) {
    const lista = familias.get(normalizar(familia));
    if (!lista?.length) return [['400', 'Regular'], ['500', 'Medium'], ['700', 'Bold'], ['800', 'Extra Bold']];
    return lista.map((p) => [String(p.peso), p.rotulo]);
  }

  // ---------- Instalação na pasta "fonts" ----------
  // Situação de cada fonte esperada: [{familia, obrigatoria, tem, pesos: [{peso, rotulo, tem}]}]
  function esperadas() {
    return ESPERADAS.map((e) => {
      const lista = familias.get(e.familia) || [];
      return { ...e, tem: lista.length > 0, pesos: e.pesos.map(([peso, rotulo]) => ({ peso, rotulo, tem: lista.some((p) => p.peso === peso) })) };
    });
  }
  const faltaObrigatoria = () => esperadas().some((e) => e.obrigatoria && (!e.tem || e.pesos.some((p) => !p.tem)));

  // Tipo do arquivo pelo cabeçalho: 'ttf' | 'otf' | null (coleções .ttc e WOFF não são lidas).
  function formato(buf) {
    const tag = new DataView(buf).getUint32(0);
    if (tag === 0x00010000 || tag === 0x74727565) return 'ttf'; // 1.0 ou "true"
    if (tag === 0x4f54544f) return 'otf'; // "OTTO"
    return null;
  }

  // Copia fontes para <pasta>/fonts. itens: [{nome, blob}]. Ignora o que não é fonte, itálicos e o que já está lá.
  async function instalar(itens) {
    const r = { copiadas: 0, repetidas: 0, ignoradas: [] };
    for (const it of itens) {
      try {
        const buf = await it.blob.arrayBuffer();
        const ext = formato(buf);
        const m = ext && lerMetadados(buf);
        if (!m?.familia) { r.ignoradas.push(it.nome); continue; }
        if (m.italico) continue;
        const chave = `${m.familia}|${m.subfamilia}`;
        if (presentes.has(chave)) { r.repetidas++; continue; }
        const base = (it.nome.replace(/\.[^.]+$/, '') || `${m.familia}-${m.subfamilia}`).replace(/[\\/:*?"<>|]+/g, '-');
        await NF.arquivos.gravarFonte(`${base}.${ext}`, new Blob([buf]));
        presentes.add(chave);
        r.copiadas++;
      } catch (e) { console.warn('Fonte não instalada:', it.nome, e); r.ignoradas.push(it.nome); }
    }
    if (r.copiadas) await carregarDaPasta();
    return r;
  }

  const podeLerInstaladas = () => typeof window.queryLocalFonts === 'function';

  // Fontes instaladas no computador que pertencem às famílias esperadas (Chrome/Edge pedem permissão).
  async function lerInstaladas() {
    const todas = await window.queryLocalFonts();
    const alvo = ESPERADAS.map((e) => e.familia.toLowerCase());
    const itens = [];
    for (const f of todas) {
      if (!alvo.some((a) => f.family.toLowerCase().startsWith(a)) || /italic|oblique/i.test(f.style)) continue;
      itens.push({ nome: f.postscriptName || f.fullName, blob: await f.blob() });
    }
    return itens;
  }

  return {
    PADRAO, carregarDaPasta, normalizar, css, opcoesFamilia, opcoesPeso,
    esperadas, faltaObrigatoria, instalar, podeLerInstaladas, lerInstaladas,
    situacao: () => situacao, versao: () => versao, total: () => familias.size,
  };
})();
