// Leitura da planilha (TSV/CSV ou células coladas) e normalização dos nomes de produto.
NF.normalizar = (() => {
  const { limparPreco } = NF.util;

  // Palavras que a planilha traz sem acento (em maiúsculas) e sua grafia correta.
  const ACENTOS = {
    CLASSICO: 'Clássico', CLASSICA: 'Clássica', CLASSICOS: 'Clássicos', COLONIA: 'Colônia', COLONIAS: 'Colônias',
    ALGODAO: 'Algodão', CUPUACU: 'Cupuaçu', MAOS: 'Mãos', MAO: 'Mão', ROMA: 'Romã', PECA: 'Pecã', MACA: 'Maçã',
    TAMARA: 'Tâmara', OLEO: 'Óleo', OLEOS: 'Óleos', SEVE: 'Sève', ILIA: 'Ilía', HIDRATACAO: 'Hidratação',
    PROTECAO: 'Proteção', AVELA: 'Avelã', ACAI: 'Açaí', MARACUJA: 'Maracujá', AGUA: 'Água', LIQUIDO: 'Líquido',
    ESSENCIA: 'Essência', UNICO: 'Único', UNICA: 'Única', LANCAMENTO: 'Lançamento', ACUCAR: 'Açúcar', CAFE: 'Café',
    LIMAO: 'Limão', MELAO: 'Melão', AMENDOAS: 'Amêndoas', AMENDOA: 'Amêndoa', CHA: 'Chá', BALSAMO: 'Bálsamo',
    CONDICIONADOR: 'Condicionador', REPARACAO: 'Reparação', ROLLON: 'Roll-on', 'ROLL-ON': 'Roll-on', NUTRICAO: 'Nutrição',
    COMBINACAO: 'Combinação', COLECAO: 'Coleção', EDICAO: 'Edição', FRAGANCIA: 'Fragrância', PERFUMARIA: 'Perfumaria',
    MAMAE: 'Mamãe', BEBE: 'Bebê', ORQUIDEA: 'Orquídea', PITAYA: 'Pitaya', ERVA: 'Erva', DOCE: 'Doce', MANGA: 'Manga',
    CREME: 'Creme', GEL: 'Gel', BARBEAR: 'Barbear', POS: 'Pós', ANTITRANSPIRANTE: 'Antitranspirante',
    PAIXAO: 'Paixão', CORACAO: 'Coração', EMOCAO: 'Emoção', GRATIDAO: 'Gratidão', PROPRIO: 'Próprio',
  };
  const ABREVIACOES = { TDD: 'Tododia', FEM: 'Feminino', MASC: 'Masculino', KIT: 'Kit', DEO: 'Deo' };
  const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'com', 'para', 'em', 'a', 'o', 'na', 'no', 'p/', 'c/']);

  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  function tituloPalavra(w, i) {
    if (!w) return w;
    // Pontuação colada (ex.: "ALGODAO,") não pode atrapalhar a busca no dicionário.
    const pont = w.match(/^(.*?)([,.;:!?)]+)$/);
    if (pont && pont[1]) return tituloPalavra(pont[1], i) + pont[2];
    const up = w.toUpperCase();
    const chave = semAcento(up);
    if (ABREVIACOES[up]) return ABREVIACOES[up];
    if (i > 0 && MINUSCULAS.has(w.toLowerCase())) return w.toLowerCase();
    // Já acentuada na planilha (ex.: ROMÃ): respeita a acentuação existente.
    if (up !== chave) return up.charAt(0) + up.slice(1).toLowerCase();
    if (ACENTOS[chave]) return ACENTOS[chave];
    if (w.includes('-')) return w.split('-').map((p, j) => tituloPalavra(p, j === 0 ? i : 1)).join('-');
    return up.charAt(0) + up.slice(1).toLowerCase();
  }

  // "40%", "40% OFF", "-50%"... no nome é descartado: o selo vem do desconto entre De e Por.
  const RE_PCT = /[-–]?\s*\d{1,3}\s?%\s*(off\b)?/gi;
  const RE_QTD = /\b(\d+(?:[.,]\d+)?)\s?(ml|g|kg|l|un|unid|unidades)\b/gi;

  function normalizarNome(bruto) {
    let s = String(bruto || '').replace(/\s+/g, ' ').trim();
    s = s.replace(RE_PCT, ' ');

    const qtds = [];
    s = s.replace(RE_QTD, (_, n, u) => {
      const un = u.toLowerCase();
      const q = /^un/.test(un) ? `${n} unidades` : `${n}${un}`;
      if (!qtds.includes(q)) qtds.push(q);
      return ' ';
    });

    s = s.replace(/\s*\/\s*/g, ', ').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').replace(/^[\s,]+|[\s,]+$/g, '');
    s = s.split(' ').map((w, i) => tituloPalavra(w, i)).join(' ');
    s = s.replace(/,\s*,/g, ',').replace(/\s+,/g, ',');
    return { nome: s, complemento: qtds.join(' ') };
  }

  function normalizarPor(bruto) {
    const t = String(bruto || '');
    const sufixo = /cada/i.test(t) ? 'cada' : '';
    return { por: limparPreco(t), sufixo };
  }

  // Divide uma linha respeitando aspas (para CSV).
  function dividir(linha, sep) {
    if (sep === '\t') return linha.split('\t');
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') { if (q && linha[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === sep && !q) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }

  // Aceita TSV publicado, CSV ou células coladas do Google Sheets. Cada linha guarda seu número na planilha.
  function lerTabela(texto) {
    const linhas = String(texto || '').replace(/\r/g, '').split('\n').map((l, i) => ({ l, n: i + 1 })).filter((x) => x.l.trim());
    if (!linhas.length) return [];
    const sep = linhas[0].l.includes('\t') ? '\t' : (linhas[0].l.includes(';') ? ';' : ',');
    const rows = linhas.map((x) => ({ n: x.n, c: dividir(x.l, sep).map((c) => c.trim()) }));
    const cab = rows[0].c.map((c) => semAcento(c).toLowerCase());
    const idx = (re, def) => { const i = cab.findIndex((c) => re.test(c)); return i >= 0 ? i : def; };
    const temCabecalho = cab.some((c) => /codigo|produto|^de$|^por$/.test(c));
    const iCod = idx(/cod/, 0), iNome = idx(/produto|nome|descri/, 1), iDe = idx(/^de$|preco de|valor de/, 2), iPor = idx(/^por$|preco por|valor por/, 3);
    // Coluna "Cada" (caixa de seleção: TRUE/FALSE). Sem ela, vale "cada" escrito no valor Por.
    const iCada = temCabecalho ? idx(/^cada$/, -1) : -1;
    // Linhas com só a coluna "Cada" preenchida (caixas vazias no fim da planilha) não contam.
    const preenchida = (r) => r.some((c, i) => c && i !== iCada);
    return (temCabecalho ? rows.slice(1) : rows).filter((r) => preenchida(r.c)).map(({ n, c: r }) => ({
      linha: n,
      codigos: (r[iCod] || '').split(/[,;\s]+/).map((c) => c.replace(/\D/g, '')).filter(Boolean),
      produto: r[iNome] || '', de: r[iDe] || '', por: r[iPor] || '',
      cada: iCada >= 0 ? /^(true|verdadeiro|sim|x|1|cada)$/i.test(r[iCada] || '') : null,
    }));
  }

  function linhaParaOferta(r) {
    const n = normalizarNome(r.produto);
    const p = normalizarPor(r.por);
    if (r.cada != null) p.sufixo = r.cada ? 'cada' : '';
    const de = limparPreco(r.de);
    return {
      codigos: r.codigos, nome: n.nome, complemento: n.complemento,
      de: de && de !== p.por ? de : '', por: p.por, sufixo: p.sufixo, original: r.produto,
      // "ou" entre os produtos só por padrão quando são 2 códigos e o nome tem "ou" (ex.: "Kaiak Clássico ou Aventura").
      mostrarOu: r.codigos.length === 2 && /\bou\b/i.test(n.nome),
    };
  }

  return { lerTabela, linhaParaOferta, normalizarNome, normalizarPor };
})();
