// Biblioteca de artes de campanha (pré-definidas + enviadas ou salvas pelo usuário).
NF.artes = (() => {
  // Metadados das artes embutidas; as imagens ficam em biblioteca/<id>.js (window.NF_ARTES).
  const META = {
    'natura-friday-1': {
      descricao: 'Cabeçalho laranja com faixa "natura friday" e banner 60% / 50% (Friday 2025).',
      // A arte desce além do painel para a faixa preta continuar pela margem direita.
      cabecalho: { w: 2454, h: 1000 },
      banner: { w: 1218, h: 1764 },
      fundo: { tipo: 'degrade', paradas: [[0, '#ea5b15'], [0.16, '#ef7c3d'], [0.43, '#f6ac7d'], [1, '#fde9da']] },
      tema: { escuro: '#4b2b0b', titulo: '#97503f', ou: '#e8692a', texto: '#3b3b3b' },
      textosBanner: [
        { comp: 'texto-periodo', props: { prefixo: 'em perfumaria (', inicio: '2026-11-24', fim: '2026-11-30', sufixo: ')', cor: '#ffffff', tamanho: 46 }, rel: { x: 0.47, y: 0.69 } },
      ],
    },
    'natal-1': {
      descricao: 'Família no cabeçalho vermelho (frente) e personagem no verde (verso), Natal 2025. Sem rodapé.',
      cabecalho: { w: 2463, h: 624 },
      cabecalhoVerso: { w: 2460, h: 642 },
      fundo: { tipo: 'cor', cor: '#53161a' },
      fundoVerso: { tipo: 'degrade', paradas: [[0, '#123a2c'], [0.5, '#0f2620'], [1, '#101414']] },
      tema: { escuro: '#4b2b0b', titulo: '#91503f', ou: '#f05a1c', texto: '#3b3b3b' },
      layout: {
        painel: { y: 672, altura: 2808 }, titulo: { x: 95, y: 715 }, validade: { x: 1300, y: 706 },
        rodape: { visivel: false }, grade: { y: 875, h: 2585 },
      },
    },
    'dia-das-maes-1': {
      descricao: 'Cabeçalho bege com flores, Dia das Mães 2026. Fundo branco, sem painel.',
      // A arte inclui a sangria: posição em coordenadas da página.
      cabecalho: { w: 2519, h: 770, pos: { x: 20, y: 16, w: 2506 } },
      fundo: { tipo: 'cor', cor: '#ffffff' },
      tema: { escuro: '#363d1f', titulo: '#dd7230', ou: '#e8692a', texto: '#3b3b3b' },
      layout: {
        painel: { visivel: false }, titulo: { visivel: false }, validade: { x: 115, y: 735 },
        grade: { y: 840, h: 2420 }, rodape: { x: 700, y: 3310, props: { largura: 700 } },
      },
    },
    'dia-dos-pais-1': {
      descricao: 'Pais e filhos no cabeçalho bege, Dia dos Pais 2025.',
      cabecalho: { w: 2417, h: 598 },
      cabecalhoVerso: { w: 2425, h: 533 },
      fundo: { tipo: 'cor', cor: '#edebe5' },
      tema: { escuro: '#0a2e2e', titulo: '#0a2a5c', ou: '#e4580d', texto: '#3b3b3b' },
      layout: {
        painel: { y: 642, altura: 2733 }, titulo: { x: 80, y: 682 }, validade: { x: 1530, y: 682 },
        grade: { y: 835, h: 2520 }, rodape: { x: 700, y: 3390, props: { largura: 800 } },
      },
      layoutVerso: { painel: { y: 574, altura: 2801 }, titulo: { y: 614 }, validade: { y: 614 }, grade: { y: 770, h: 2585 } },
    },
  };

  // Posições padrão dos elementos fixos (layout do Natura Friday). Cada arte sobrescreve o que precisar.
  const LAYOUT_PADRAO = {
    painel: { visivel: true, y: 585, altura: 2755 },
    titulo: { visivel: true, x: 125, y: 625 },
    validade: { visivel: true, x: 1330, y: 632 },
    rodape: { visivel: true, x: 190, y: 3392, props: { largura: 1250 } },
    grade: { y: NF.modelo.AREA_GRADE.y, h: NF.modelo.AREA_GRADE.h },
  };

  // Arte enviada pelo usuário: largura total com sangria; altura de 640 px (só o topo) até a página inteira.
  // O conteúdo (painel com os produtos) começa sempre abaixo dos 640 px do topo; o que falta até o fim da página é inferido.
  const ARTE = { w: NF.modelo.PAGINA.w, hMin: 640, hMax: NF.modelo.PAGINA.h, topo: 640 };

  // [{id, nome, cabecalho:{ref,w,h,pos}, cabecalhoVerso, banner, textosBanner, fundo, fundoVerso, tema, layout, layoutVerso, substitui}]
  // "substitui: true" com o id de uma arte embutida = versão do usuário que aparece no lugar dela.
  let doUsuario = [];

  function lista() {
    const usuario = new Map(doUsuario.map((a) => [a.id, a]));
    const embutidas = (window.NF_ARTES || []).map((a) => {
      const meta = META[a.id] || {};
      const recurso = (chave) => (a[chave] ? { ref: `lib:${a.id}:${chave}`, ...(meta[chave] || {}) } : null);
      const original = {
        ...meta, id: a.id, nome: a.nome, embutida: true,
        cabecalho: recurso('cabecalho'), cabecalhoVerso: recurso('cabecalhoVerso'), banner: recurso('banner'),
      };
      const versao = usuario.get(a.id);
      return versao ? { ...versao, id: a.id, embutida: true, substituida: true } : original;
    });
    const ids = new Set(embutidas.map((a) => a.id));
    return [...embutidas, ...doUsuario.filter((a) => !ids.has(a.id)).map((a) => ({ ...a, embutida: false }))];
  }

  function layoutDaPagina(arte, paginaId) {
    const L = NF.util.clone(LAYOUT_PADRAO);
    for (const fonte of [arte.layout, paginaId === 'verso' ? arte.layoutVerso : null]) {
      for (const [k, v] of Object.entries(fonte || {})) L[k] = { ...L[k], ...v, props: { ...L[k]?.props, ...v.props } };
    }
    return L;
  }

  const papelDe = (el) => el.papel || (el.comp === 'titulo-loja' ? 'titulo' : el.comp === 'validade' ? 'validade'
    : el.comp === 'rodape-loja' ? 'rodape' : el.comp === 'painel' && el.bloqueado ? 'painel' : null);

  // Reposiciona painel, título, validade, rodapé e grade conforme o layout da arte.
  function aplicarLayout(pag, L) {
    for (const el of pag.elementos) {
      const papel = papelDe(el);
      const c = papel && L[papel];
      if (!c) continue;
      if ('visivel' in c) el.visivel = c.visivel;
      if ('x' in c) el.x = c.x;
      if ('y' in c) el.y = c.y;
      if (papel === 'painel' && c.altura) el.props.altura = c.altura;
      if (c.props) Object.assign(el.props, c.props);
    }
    pag.grade.y = L.grade.y;
    pag.grade.h = L.grade.h;
  }

  // Lê o layout atual de uma página (o inverso de aplicarLayout).
  function layoutAtual(pag) {
    const L = { grade: { y: Math.round(pag.grade.y), h: Math.round(pag.grade.h) } };
    for (const el of pag.elementos) {
      const papel = papelDe(el);
      if (!['painel', 'titulo', 'validade', 'rodape'].includes(papel) || L[papel]) continue;
      const c = { visivel: el.visivel !== false, x: Math.round(el.x), y: Math.round(el.y) };
      if (papel === 'painel') c.altura = el.props.altura;
      if (papel === 'rodape') c.props = { largura: el.props.largura };
      L[papel] = c;
    }
    return L;
  }

  const obter = (id) => lista().find((a) => a.id === id);

  // Ao abrir um panfleto: imagens das artes embutidas podem ter mudado de proporção (ex.: Natura Friday 1 ficou
  // mais alta); recalcula a altura dos elementos que as usam, mantendo a largura.
  function ajustarProporcoes(projeto) {
    for (const pag of Object.values(projeto.paginas || {})) {
      for (const el of pag.elementos || []) {
        if (el.tipo !== 'imagem' || !el.ref?.startsWith('lib:')) continue;
        const [, id, recurso] = el.ref.split(':');
        const m = META[id]?.[recurso];
        if (m?.w && m?.h) el.h = el.w * (m.h / m.w);
      }
    }
  }

  async function carregarDoUsuario() {
    doUsuario = await NF.arquivos.lerArtesUsuario();
    return doUsuario;
  }

  async function gravarNaLista(arte) {
    const atuais = (await NF.arquivos.lerArtesUsuario()).filter((a) => a.id !== arte.id);
    await NF.arquivos.gravarArtesUsuario([...atuais, arte]);
    await carregarDoUsuario();
  }

  async function restaurarOriginal(id) {
    const atuais = (await NF.arquivos.lerArtesUsuario()).filter((a) => a.id !== id);
    await NF.arquivos.gravarArtesUsuario(atuais);
    await carregarDoUsuario();
  }

  const novoId = (nome) => `${NF.util.slug(nome) || 'arte'}-${Date.now().toString(36)}`;

  // ---------- Cores inferidas do cabeçalho ----------
  const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };

  // Reduz um trecho (sy..sy+sh) da imagem para analisar as cores.
  function amostrar(canvas, sy = 0, sh = canvas.height, w = 255, h = 64) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, w, h);
    return { d: ctx.getImageData(0, 0, w, h).data, w, h };
  }

  // Fundo = cor média da faixa inferior (a página continua a partir dela); quase branco vira branco.
  function corDaBase(canvas) {
    const faixa = Math.min(60, canvas.height);
    const { d, w, h } = amostrar(canvas, canvas.height - faixa, faixa, 255, 12);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = h - 3; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    r /= n; g /= n; b /= n;
    return lum(r, g, b) > 0.93 ? '#ffffff' : hex(r, g, b);
  }

  // Paleta por agrupamento simples (só o topo, onde fica o cabeçalho): uma cor escura e saturada (título/rodapé) e uma viva ("ou").
  function paleta(canvas) {
    const { d } = amostrar(canvas, 0, Math.min(canvas.height, ARTE.topo), 200, 50);
    const grupos = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4);
      const g = grupos.get(k) || { r: 0, g: 0, b: 0, n: 0 };
      g.r += d[i]; g.g += d[i + 1]; g.b += d[i + 2]; g.n++;
      grupos.set(k, g);
    }
    const total = d.length / 4;
    const cores = [...grupos.values()].filter((g) => g.n > total * 0.004).map((g) => ({ r: g.r / g.n, g: g.g / g.n, b: g.b / g.n, n: g.n }));
    const melhor = (filtro, nota) => cores.filter(filtro).sort((a, b) => nota(b) - nota(a))[0];
    const titulo = melhor((c) => lum(c.r, c.g, c.b) > 0.1 && lum(c.r, c.g, c.b) < 0.5 && sat(c.r, c.g, c.b) > 0.25,
      (c) => sat(c.r, c.g, c.b) * Math.sqrt(c.n) * (1 - lum(c.r, c.g, c.b)));
    const ou = melhor((c) => lum(c.r, c.g, c.b) > 0.3 && lum(c.r, c.g, c.b) < 0.75 && sat(c.r, c.g, c.b) > 0.45,
      (c) => sat(c.r, c.g, c.b) * Math.sqrt(c.n));
    return {
      titulo: titulo ? hex(titulo.r, titulo.g, titulo.b) : NF.modelo.TEMA_PADRAO.titulo,
      ou: ou ? hex(ou.r, ou.g, ou.b) : NF.modelo.TEMA_PADRAO.ou,
    };
  }

  // Fundo das páginas e cores de título/"ou" vêm do cabeçalho; etiqueta e nomes ficam com os valores fixos.
  function inferirCores(canvasFrente, canvasVerso) {
    const T = NF.modelo.TEMA_PADRAO;
    const fundo = corDaBase(canvasFrente);
    const fundoVerso = canvasVerso ? corDaBase(canvasVerso) : fundo;
    return {
      fundo: { tipo: 'cor', cor: fundo },
      fundoVerso: fundoVerso !== fundo ? { tipo: 'cor', cor: fundoVerso } : null,
      tema: { escuro: T.escuro, texto: T.texto, ...paleta(canvasFrente) },
    };
  }

  // Layout padrão deslocado para começar logo abaixo de um cabeçalho de altura h no topo da página.
  function layoutAbaixoDe(h) {
    const d = h - 16 - LAYOUT_PADRAO.painel.y;
    return {
      painel: { y: LAYOUT_PADRAO.painel.y + d, altura: LAYOUT_PADRAO.painel.altura - d },
      titulo: { y: LAYOUT_PADRAO.titulo.y + d }, validade: { y: LAYOUT_PADRAO.validade.y + d },
      grade: { y: LAYOUT_PADRAO.grade.y + d, h: LAYOUT_PADRAO.grade.h - d },
    };
  }

  // Nova arte a partir das imagens já recortadas (canvas 2550 × 640…3578) de frente e, opcionalmente, verso.
  async function adicionarDoUsuario({ nome, frente, verso }) {
    const id = novoId(nome);
    const salvar = async (canvas, arquivo) => {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      await NF.arquivos.gravarNaBiblioteca(`${id}/${arquivo}`, blob);
      return { ref: `bib:${id}/${arquivo}`, w: canvas.width, h: canvas.height, pos: { x: 0, y: 0, w: NF.modelo.PAGINA.w } };
    };
    const cores = inferirCores(frente, verso);
    const arte = {
      id, nome, criado: new Date().toISOString(),
      cabecalho: await salvar(frente, 'cabecalho.png'),
      cabecalhoVerso: verso ? await salvar(verso, 'cabecalho-verso.png') : null,
      banner: null,
      fundo: cores.fundo, fundoVerso: cores.fundoVerso, tema: cores.tema,
      layout: layoutAbaixoDe(ARTE.topo),
    };
    await gravarNaLista(arte);
    return arte;
  }

  // ---------- Salvar a configuração atual do panfleto como arte ----------
  // Copia para a biblioteca as imagens que só existem no panfleto (ex.: banner substituído).
  async function guardarImagem(ref, id, nomeArquivo) {
    if (!ref || ref.startsWith('lib:') || ref.startsWith('bib:')) return ref;
    let blob;
    if (ref.startsWith('proj:')) blob = await NF.arquivos.lerDoProjeto(ref.slice(5));
    else blob = await (await fetch(ref)).blob();
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const caminho = `${id}/${nomeArquivo}_${Date.now().toString(36)}.${ext}`;
    await NF.arquivos.gravarNaBiblioteca(caminho, blob);
    return `bib:${caminho}`;
  }

  // O que será salvo: usado também para mostrar o resumo no diálogo.
  function resumoAtual(projeto) {
    const pag = (id) => projeto.paginas[id];
    const achar = (id, papel) => pag(id).elementos.find((e) => e.papel === papel);
    const cabF = achar('frente', 'cabecalho'), cabV = achar('verso', 'cabecalho');
    const banner = achar('frente', 'banner') || achar('verso', 'banner');
    return { cabF, cabV: cabV && cabV.ref !== cabF?.ref ? cabV : null, mesmoCabecalho: !!(cabV && cabV.ref === cabF?.ref), banner };
  }

  async function salvarAtual(projeto, { nome, substituirId }) {
    const id = substituirId || novoId(nome);
    const existente = substituirId ? obter(substituirId) : null;
    const { cabF, cabV, banner } = resumoAtual(projeto);
    const cab = async (el, arquivo) => (el ? {
      ref: await guardarImagem(el.ref, id, arquivo), w: el.w, h: el.h, pos: { x: Math.round(el.x), y: Math.round(el.y), w: el.w },
    } : null);
    let textosBanner = [];
    if (banner) {
      const pg = Object.values(projeto.paginas).find((p) => p.elementos.includes(banner));
      textosBanner = pg.elementos.filter((e) => e.papel === 'banner-texto' && e.tipo === 'componente').map((e) => ({
        comp: e.comp, props: NF.util.clone(e.props), rel: { x: (e.x - banner.x) / banner.w, y: (e.y - banner.y) / banner.h },
      }));
    }
    const F = projeto.paginas.frente, V = projeto.paginas.verso;
    const mesmoFundo = JSON.stringify(F.fundo) === JSON.stringify(V.fundo);
    const arte = {
      id, nome: nome || existente?.nome, criado: new Date().toISOString(),
      substitui: !!existente?.embutida || undefined,
      cabecalho: await cab(cabF, 'cabecalho'),
      cabecalhoVerso: await cab(cabV, 'cabecalho-verso'),
      banner: banner ? { ref: await guardarImagem(banner.ref, id, 'banner'), w: banner.w, h: banner.h } : null,
      textosBanner,
      fundo: NF.util.clone(F.fundo), fundoVerso: mesmoFundo ? null : NF.util.clone(V.fundo),
      tema: { escuro: projeto.tema.escuro, texto: projeto.tema.texto, titulo: projeto.tema.titulo, ou: projeto.tema.ou },
      layout: layoutAtual(F), layoutVerso: layoutAtual(V),
    };
    await gravarNaLista(arte);
    return arte;
  }

  // ---------- Aplicar ----------
  function encaixar(img, area, margem = 0) {
    const aw = area.w - margem * 2, ah = area.h - margem * 2;
    const s = Math.min(aw / img.w, ah / img.h);
    const w = img.w * s, h = img.h * s;
    return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
  }

  function elementoBanner(arte, area) {
    const r = encaixar(arte.banner, area, 18);
    return NF.modelo.novoElemento('imagem', { nome: `Banner — ${arte.nome}`, papel: 'banner', ref: arte.banner.ref, x: r.x, y: r.y, w: r.w, h: r.h });
  }

  // Aplica a arte: fundo, cores, cabeçalho e layout nas páginas. Um banner já na página é trocado no lugar;
  // com {banner: true}, um novo banner é colocado nas áreas removidas.
  function aplicar(projeto, arteId, { banner = false, paginas = ['frente', 'verso'] } = {}) {
    const arte = obter(arteId);
    if (!arte) return;
    projeto.arte = arteId;
    if (arte.tema) Object.assign(projeto.tema, arte.tema);
    for (const id of paginas) {
      const pag = projeto.paginas[id];
      const fundo = (id === 'verso' && arte.fundoVerso) || arte.fundo;
      if (fundo) pag.fundo = NF.util.clone(fundo);
      pag.elementos = pag.elementos.filter((e) => e.papel !== 'cabecalho');
      const cab = (id === 'verso' && arte.cabecalhoVerso) || arte.cabecalho;
      if (cab) {
        // Sem posição própria, alinha ao refile (a arte vem de um panfleto já cortado); o fundo cobre a sangria.
        const R = NF.modelo.REFILE;
        const pos = cab.pos || { x: R.x, y: R.y, w: R.w };
        const h = (pos.w / cab.w) * cab.h;
        pag.elementos.unshift(NF.modelo.novoElemento('imagem', {
          nome: `Cabeçalho — ${arte.nome}`, papel: 'cabecalho', ref: cab.ref, x: pos.x, y: pos.y, w: pos.w, h, bloqueado: true,
        }));
      }
      if (arte.embutida || arte.layout) aplicarLayout(pag, layoutDaPagina(arte, id));
      for (const el of pag.elementos) {
        if (el.comp === 'titulo-loja' || el.comp === 'rodape-loja') el.props.cor = projeto.tema.titulo;
        if (el.comp === 'validade') el.props.cor = projeto.tema.texto;
      }
      const atual = pag.elementos.find((e) => e.papel === 'banner');
      if (atual && arte.banner) trocarImagem(atual, arte.banner, arte.banner.ref);
      else if (banner && arte.banner) inserirBanner(projeto, pag, arte);
    }
  }

  // Troca a imagem de um elemento mantendo o lugar: a nova imagem é encaixada (centralizada) na mesma caixa.
  function trocarImagem(el, dim, ref) {
    const r = encaixar(dim, { x: el.x, y: el.y, w: el.w, h: el.h });
    Object.assign(el, { ref, x: r.x, y: r.y, w: r.w, h: r.h });
    delete el.recorte;
  }

  function inserirBanner(projeto, pag, arte, area) {
    area = area || NF.modelo.areaRemovida(pag);
    if (!area || !arte.banner) return null;
    const el = elementoBanner(arte, area);
    pag.elementos.push(el);
    for (const t of arte.textosBanner || []) {
      const txt = NF.modelo.elementoComponente(t.comp, t.props, { papel: 'banner-texto' });
      txt.x = el.x + el.w * t.rel.x;
      txt.y = el.y + el.h * t.rel.y;
      pag.elementos.push(txt);
    }
    return el;
  }

  return {
    ARTE, lista, obter, ajustarProporcoes, carregarDoUsuario, adicionarDoUsuario, salvarAtual, resumoAtual, restaurarOriginal,
    inferirCores, aplicar, inserirBanner, encaixar, trocarImagem,
  };
})();
