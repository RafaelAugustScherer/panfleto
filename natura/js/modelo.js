// Modelo de dados do panfleto: medidas, grid, criação de projetos e distribuição de ofertas.
NF.modelo = (() => {
  const { uid, clone } = NF.util;

  // Página A4 a 300 dpi com 3 mm de sangria em cada lado (coordenadas de desenho).
  const PAGINA = { w: 2550, h: 3578, sangria: 35 };
  const REFILE = { x: PAGINA.sangria, y: PAGINA.sangria, w: 2480, h: 3508 };

  const AREA_GRADE = { x: 110, y: 800, w: 2300, h: 2520 };
  // Vão horizontal entre colunas da grade (px a 300 dpi); a largura total da grade não muda.
  const VAO_COLUNAS = 40;
  const larguraColuna = (g) => (g.w - VAO_COLUNAS * (g.colunas - 1)) / g.colunas;

  const MODELOS_GRADE = {
    '3x3': { linhas: 3, colunas: 3 },
    '3x4': { linhas: 3, colunas: 4 },
  };

  // Layout do Natura Friday 2025: na frente, 2 ofertas largas à esquerda e o banner ocupando 2×2 à direita.
  const PRESETS = {
    'friday-2025-frente': {
      nome: 'Igual Friday 2025', linhas: 3, colunas: 4,
      removidas: ['0,1', '0,2', '0,3', '1,1', '1,2', '1,3'],
      spans: { '0,0': { c: 2, r: 1 }, '1,0': { c: 2, r: 1 } },
    },
  };

  const TEMA_PADRAO = { escuro: '#4b2b0b', titulo: '#97503f', ou: '#e8692a', texto: '#3b3b3b', branco: '#ffffff', fonte: 'Helvetica Now Display' };

  function novaCelula(linha, coluna) {
    return { id: uid('cel'), linha, coluna, removida: false, span: { c: 1, r: 1 }, ofertaId: null, ajustes: {} };
  }

  function novaGrade(linhas, colunas, removidas = [], spans = {}) {
    const celulas = [];
    for (let r = 0; r < linhas; r++) {
      for (let c = 0; c < colunas; c++) {
        const cel = novaCelula(r, c);
        if (removidas.includes(`${r},${c}`)) cel.removida = true;
        if (spans[`${r},${c}`]) cel.span = { ...spans[`${r},${c}`] };
        celulas.push(cel);
      }
    }
    return { grade: { linhas, colunas, ...AREA_GRADE }, celulas };
  }

  // Muda a grade preservando ofertas por posição; ofertas sem célula voltam para a lista.
  function redimensionarGrade(pagina, linhas, colunas) {
    const antigas = new Map(pagina.celulas.map((c) => [`${c.linha},${c.coluna}`, c]));
    const { celulas } = novaGrade(linhas, colunas);
    for (const c of celulas) {
      const a = antigas.get(`${c.linha},${c.coluna}`);
      if (a) Object.assign(c, { ...a, span: { c: Math.min(a.span.c, colunas - c.coluna), r: Math.min(a.span.r, linhas - c.linha) } });
    }
    pagina.grade.linhas = linhas;
    pagina.grade.colunas = colunas;
    pagina.celulas = celulas;
  }

  // Retângulo de cada célula (considerando células que ocupam várias colunas/linhas e o vão entre colunas).
  function retangulos(pagina) {
    const g = pagina.grade;
    const cw = larguraColuna(g), ch = g.h / g.linhas;
    const out = new Map();
    for (const c of pagina.celulas) {
      if (c.removida) continue;
      const sc = c.span?.c || 1;
      out.set(c.id, { x: g.x + c.coluna * (cw + VAO_COLUNAS), y: g.y + c.linha * ch, w: cw * sc + VAO_COLUNAS * (sc - 1), h: ch * (c.span?.r || 1) });
    }
    return out;
  }

  // Células "cobertas" por outra que se estende sobre elas.
  function cobertas(pagina) {
    const set = new Set();
    for (const c of pagina.celulas) {
      if (c.removida) continue;
      for (let r = 0; r < (c.span?.r || 1); r++) {
        for (let k = 0; k < (c.span?.c || 1); k++) {
          if (r || k) set.add(`${c.linha + r},${c.coluna + k}`);
        }
      }
    }
    return set;
  }

  // Área livre deixada pelas células removidas (não cobertas), para posicionar banners.
  function areaRemovida(pagina) {
    const g = pagina.grade;
    const cw = larguraColuna(g), ch = g.h / g.linhas;
    const cob = cobertas(pagina);
    const livres = pagina.celulas.filter((c) => c.removida && !cob.has(`${c.linha},${c.coluna}`));
    if (!livres.length) return null;
    const r0 = Math.min(...livres.map((c) => c.linha)), r1 = Math.max(...livres.map((c) => c.linha));
    const c0 = Math.min(...livres.map((c) => c.coluna)), c1 = Math.max(...livres.map((c) => c.coluna));
    return { x: g.x + c0 * (cw + VAO_COLUNAS), y: g.y + r0 * ch, w: (c1 - c0 + 1) * cw + (c1 - c0) * VAO_COLUNAS, h: (r1 - r0 + 1) * ch };
  }

  const celulasVisiveis = (pagina) => {
    const cob = cobertas(pagina);
    return pagina.celulas.filter((c) => !c.removida && !cob.has(`${c.linha},${c.coluna}`))
      .sort((a, b) => a.linha - b.linha || a.coluna - b.coluna);
  };

  function novaOferta(dados = {}) {
    return {
      id: uid('of'), nome: dados.nome || 'Novo produto', complemento: dados.complemento || '',
      de: dados.de || '', por: dados.por || '', sufixo: dados.sufixo || '', mostrarOu: !!dados.mostrarOu,
      produtos: (dados.codigos || []).map((codigo) => novoProduto(codigo)),
    };
  }

  function novoProduto(codigo) {
    return { codigo: String(codigo || ''), galeria: 1, imagem: null, semImagem: false, tolerancia: 5, escala: 1, dx: 0, dy: 0 };
  }

  function novaPagina(id, nome, modelo) {
    const { grade, celulas } = novaGrade(modelo.linhas, modelo.colunas, modelo.removidas, modelo.spans);
    return { id, nome, fundo: { tipo: 'cor', cor: '#ffffff' }, grade, celulas, elementos: [] };
  }

  function novoElemento(tipo, dados) {
    return { id: uid('el'), tipo, x: 0, y: 0, escala: 1, rotacao: 0, visivel: true, bloqueado: false, ...dados };
  }

  function elementoComponente(comp, props = {}, dados = {}) {
    const def = NF.componentes.def(comp);
    const p = {};
    for (const campo of def.props) p[campo.key] = campo.padrao;
    return novoElemento('componente', { nome: def.nome, comp, props: { ...p, ...props }, ...dados });
  }

  // Elementos fixos de toda página: grade, painel, título, validade, rodapé, aviso lateral.
  function elementosBase(pagina, tema, validade) {
    const els = [
      elementoComponente('painel', { largura: 2335, altura: 2755, cor: '#ffffff' }, { nome: 'Painel branco', papel: 'painel', x: 90, y: 585, bloqueado: true }),
      novoElemento('grade', { nome: 'Ofertas (grade)' }),
      elementoComponente('titulo-loja', { cor: tema.titulo }, { papel: 'titulo', x: 125, y: 625 }),
      elementoComponente('validade', { ...validade, cor: tema.texto }, { papel: 'validade', x: 1330, y: 632 }),
      elementoComponente('rodape-loja', { cor: tema.titulo }, { papel: 'rodape', x: 190, y: 3392 }),
      elementoComponente('aviso-lateral', {}, { x: 2444, y: 2240, rotacao: -90 }),
    ];
    pagina.elementos.push(...els);
  }

  function novoProjeto({ nome, slug, arteId, modeloFrente, modeloVerso, validade }) {
    const tema = clone(TEMA_PADRAO);
    const projeto = {
      versao: 1, nome, slug, criado: new Date().toISOString(), arte: arteId || null, tema,
      ofertas: [],
      paginas: {
        frente: novaPagina('frente', 'Frente', modeloFrente || MODELOS_GRADE['3x3']),
        verso: novaPagina('verso', 'Verso', modeloVerso || MODELOS_GRADE['3x4']),
      },
    };
    for (const p of Object.values(projeto.paginas)) elementosBase(p, tema, validade || {});
    if (arteId) NF.artes.aplicar(projeto, arteId, { banner: true });
    return projeto;
  }

  // Coloca ofertas nas células vazias (frente, depois verso). Retorna as que sobraram.
  function distribuirOfertas(projeto, ofertas) {
    const fila = [...ofertas];
    for (const pag of [projeto.paginas.frente, projeto.paginas.verso]) {
      for (const cel of celulasVisiveis(pag)) {
        if (!fila.length) break;
        if (cel.ofertaId) continue;
        cel.ofertaId = fila.shift().id;
      }
    }
    return fila;
  }

  // Layout de uma página como modelo {linhas, colunas, removidas, spans} (o formato do seletor de grade).
  const modeloDePagina = (pag) => ({
    linhas: pag.grade.linhas, colunas: pag.grade.colunas,
    removidas: pag.celulas.filter((c) => c.removida).map((c) => `${c.linha},${c.coluna}`),
    spans: Object.fromEntries(pag.celulas.filter((c) => c.span.c > 1 || c.span.r > 1).map((c) => [`${c.linha},${c.coluna}`, { ...c.span }])),
  });

  // Vagas (células visíveis) de um modelo de layout.
  function contarVagas(m) {
    const cob = new Set();
    for (const [k, s] of Object.entries(m.spans || {})) {
      if (m.removidas.includes(k)) continue;
      const [r, c] = k.split(',').map(Number);
      for (let i = 0; i < s.r; i++) for (let j = 0; j < s.c; j++) if (i || j) cob.add(`${r + i},${c + j}`);
    }
    let n = 0;
    for (let r = 0; r < m.linhas; r++) for (let c = 0; c < m.colunas; c++) { const k = `${r},${c}`; if (!m.removidas.includes(k) && !cob.has(k)) n++; }
    return n;
  }

  function localizarOferta(projeto, ofertaId) {
    for (const pag of Object.values(projeto.paginas)) {
      const cel = pag.celulas.find((c) => c.ofertaId === ofertaId && !c.removida);
      if (cel) return { pagina: pag, celula: cel };
    }
    return null;
  }

  return {
    PAGINA, REFILE, AREA_GRADE, MODELOS_GRADE, PRESETS, TEMA_PADRAO,
    novaGrade, redimensionarGrade, retangulos, larguraColuna, cobertas, areaRemovida, celulasVisiveis,
    novaOferta, novoProduto, novaPagina, novoElemento, elementoComponente, novoProjeto, distribuirOfertas, localizarOferta,
    modeloDePagina, contarVagas,
  };
})();
