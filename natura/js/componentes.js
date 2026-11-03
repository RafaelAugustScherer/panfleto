// Biblioteca de componentes: definição das propriedades editáveis e desenho em Konva.
// Também contém o desenho da etiqueta de preço e do nome do produto usados nas células.
NF.componentes = (() => {
  const { partesPreco, formatarData } = NF.util;

  // ---------- Texto com estilos mistos ----------
  // As famílias vêm da pasta "fonts" (NF.fontes); sem fonte definida usa Helvetica Now Display.
  const medidor = document.createElement('canvas').getContext('2d');
  const fontCss = (st) => `${st.peso || 400} ${st.tamanho}px ${NF.fontes.css(st.fonte)}`;
  function medir(texto, st) {
    medidor.font = fontCss(st);
    medidor.letterSpacing = `${st.espaco || 0}px`;
    return medidor.measureText(texto).width;
  }

  // runs: [{t, ...estilo}] ; quebra por palavras em linhas de largura máxima (0 = sem quebra).
  function diagramar(runs, larguraMax = 0, entrelinha = 1.18, alinhar = 'left') {
    const tokens = [];
    for (const r of runs) {
      const partes = String(r.t).split(/(\n| )/);
      for (const p of partes) {
        if (p === '') continue;
        tokens.push({ ...r, t: p });
      }
    }
    const linhas = [[]];
    let x = 0;
    for (const tk of tokens) {
      if (tk.t === '\n') { linhas.push([]); x = 0; continue; }
      const w = medir(tk.t, tk);
      const linha = linhas[linhas.length - 1];
      if (tk.t === ' ') { if (linha.length) { linha.push({ ...tk, w }); x += w; } continue; }
      if (larguraMax && x + w > larguraMax && linha.length) {
        while (linha.length && linha[linha.length - 1].t === ' ') { x -= linha.pop().w; }
        linhas.push([]); x = 0;
      }
      linhas[linhas.length - 1].push({ ...tk, w });
      x += w;
    }
    let y = 0, largura = 0;
    const saida = linhas.map((ln) => {
      while (ln.length && ln[ln.length - 1].t === ' ') ln.pop();
      const maior = Math.max(...ln.map((t) => t.tamanho), runs[0]?.tamanho || 10);
      const lw = ln.reduce((a, t) => a + t.w, 0);
      largura = Math.max(largura, lw);
      const base = y + maior * 0.8;
      y += maior * entrelinha;
      return { tokens: ln, w: lw, base, altura: maior };
    });
    const ultima = saida[saida.length - 1];
    const altura = ultima ? ultima.base + ultima.altura * 0.22 : 0;
    const L = Math.max(larguraMax || 0, largura);
    for (const ln of saida) {
      let cx = alinhar === 'center' ? (L - ln.w) / 2 : alinhar === 'right' ? L - ln.w : 0;
      for (const t of ln.tokens) { t.x = cx; cx += t.w; }
    }
    return { linhas: saida, w: larguraMax && alinhar !== 'left' ? L : largura, h: altura };
  }

  function desenharLinhas(ctx, linhas, contorno) {
    for (const ln of linhas) {
      for (const t of ln.tokens) {
        if (t.t === ' ') continue;
        ctx.font = fontCss(t);
        ctx.letterSpacing = `${t.espaco || 0}px`;
        const y = ln.base + (t.dy || 0);
        if (contorno) { ctx.lineJoin = 'round'; ctx.lineWidth = contorno.largura; ctx.strokeStyle = contorno.cor; ctx.strokeText(t.t, t.x, y); }
        ctx.fillStyle = t.cor || '#000';
        ctx.fillText(t.t, t.x, y);
      }
    }
  }

  // Cria um Konva.Shape que desenha o texto diagramado. Retorna {node, w, h}.
  function textoRico(runs, { largura = 0, entrelinha = 1.18, alinhar = 'left', contorno = null, x = 0, y = 0, nome } = {}) {
    const lay = diagramar(runs, largura, entrelinha, alinhar);
    const node = new Konva.Shape({
      x, y, width: Math.max(1, lay.w), height: Math.max(1, lay.h), name: nome,
      sceneFunc(ctx) {
        const c = ctx._context;
        c.save();
        c.textBaseline = 'alphabetic';
        desenharLinhas(c, lay.linhas, contorno);
        c.restore();
      },
      hitFunc(ctx, shape) { ctx.beginPath(); ctx.rect(0, 0, shape.width(), shape.height()); ctx.closePath(); ctx.fillStrokeShape(shape); },
    });
    return { node, w: lay.w, h: lay.h };
  }

  const linhaSimples = (t, estilo, opts) => textoRico([{ t, ...estilo }], opts);

  // ---------- Etiqueta de preço ----------
  // Tamanhos, pesos e fonte vêm de NF.tipografia; as medidas da caixa acompanham o tamanho do preço
  // (nos valores padrão: topo 62, base 112, largura mínima 360).
  function etiquetaPreco(oferta, tema, T = NF.tipografia.atual()) {
    const g = new Konva.Group({ name: 'etiqueta' });
    const escuro = tema.escuro, claro = '#ffffff';
    const temDe = !!oferta.de;
    const por = partesPreco(oferta.por);
    const st = (k, cor) => ({ tamanho: T[k].tamanho, peso: T[k].peso, espaco: T[k].espaco || 0, fonte: T.etiqueta.fonte, cor });
    const I = T.porInteiro.tamanho;
    const D = Math.max(T.deRotulo.tamanho, T.deInteiro.tamanho, T.deCentavos.tamanho);
    const PAD = 20, BORDA = 5, TOPO = temDe ? Math.round(D * 1.6) : 0, BASE = Math.round(I * 1.4);

    const stPor = st('porRotulo', claro);
    const stRS = st('moeda', claro);
    const stInt = st('porInteiro', claro);
    const stCent = st('porCentavos', claro);
    const stSuf = st('sufixo', claro);

    const wRS = Math.max(medir('por', stPor), medir('R$', stRS));
    const wInt = medir(por.int, stInt);
    const wCent = medir(`,${por.cents}`, stCent);
    const wSuf = oferta.sufixo ? medir(` ${oferta.sufixo}`, stSuf) : 0;
    let W = Math.max(I * 4.5, PAD + wRS + 12 + wInt + 4 + wCent + wSuf + PAD);

    const runsDe = () => {
      const de = partesPreco(oferta.de);
      return [{ t: 'de R$ ', ...st('deRotulo', escuro) }, { t: de.int, ...st('deInteiro', escuro) }, { t: `,${de.cents}`, ...st('deCentavos', escuro) }];
    };
    if (temDe) W = Math.max(W, PAD + diagramar(runsDe()).w + PAD);
    W = Math.round(W * 1.05); // folga à direita do preço

    const H = TOPO + BASE;
    g.add(new Konva.Rect({ width: W, height: H, fill: escuro, cornerRadius: [0, 18, 0, 14] }));
    if (temDe) {
      g.add(new Konva.Rect({ x: BORDA, y: BORDA, width: W - BORDA * 2, height: TOPO - BORDA, fill: claro, cornerRadius: [0, 14, 0, 0] }));
      const t = textoRico(runsDe());
      t.node.position({ x: PAD + 2, y: BORDA + (TOPO - BORDA - t.h) / 2 + 2 });
      g.add(t.node);
    }
    const linhaBase = TOPO + BASE - I * 0.225;
    const tPor = linhaSimples('por', stPor);
    tPor.node.position({ x: PAD, y: TOPO + I * 0.175 });
    g.add(tPor.node);
    const tRS = linhaSimples('R$', stRS);
    tRS.node.position({ x: PAD, y: linhaBase - stRS.tamanho * 0.8 });
    g.add(tRS.node);
    const xInt = PAD + wRS + 12;
    const tInt = linhaSimples(por.int, stInt);
    tInt.node.position({ x: xInt, y: linhaBase + 4 - stInt.tamanho * 0.8 });
    g.add(tInt.node);
    const tCent = textoRico([{ t: `,${por.cents}`, ...stCent }, ...(oferta.sufixo ? [{ t: ` ${oferta.sufixo}`, ...stSuf }] : [])]);
    tCent.node.position({ x: xInt + wInt + 4, y: linhaBase - I * 0.375 - stCent.tamanho * 0.8 });
    g.add(tCent.node);
    return { node: g, w: W, h: H };
  }

  // ---------- Nome do produto (negrito + quantidade fina) ----------
  // Reduz a fonte (até o mínimo da tipografia) para o nome caber em 2 linhas.
  function nomeProduto(oferta, largura, tema, T = NF.tipografia.atual()) {
    const N = T.nome, Q = T.quantidade;
    const montar = (t) => {
      const runs = [{ t: oferta.nome || '', tamanho: t, peso: N.peso, fonte: N.fonte, cor: tema.texto }];
      if (oferta.complemento) runs.push({ t: ` ${oferta.complemento}`, tamanho: t, peso: Q.peso, fonte: N.fonte, cor: tema.texto, espaco: Q.espaco });
      return runs;
    };
    let t = N.tamanho;
    while (t > N.minimo && diagramar(montar(t), largura, N.entrelinha).linhas.length > 2) t -= 1;
    return textoRico(montar(t), { largura, entrelinha: N.entrelinha, nome: 'nome' });
  }

  // ---------- Ícones do rodapé ----------
  const PATH_TELEFONE = 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z';
  function icone(tipo, s, cor) {
    const g = new Konva.Group();
    const sw = Math.max(2, s * 0.085);
    if (tipo === 'whatsapp') {
      g.add(new Konva.Circle({ x: s / 2, y: s / 2, radius: s / 2 - sw, stroke: cor, strokeWidth: sw }));
      g.add(new Konva.Line({ points: [s * 0.2, s * 0.78, s * 0.1, s * 0.95, s * 0.32, s * 0.88], fill: cor, closed: true }));
      g.add(new Konva.Path({ data: PATH_TELEFONE, fill: cor, x: s * 0.24, y: s * 0.24, scaleX: s * 0.022, scaleY: s * 0.022 }));
    } else if (tipo === 'instagram') {
      g.add(new Konva.Rect({ x: sw / 2, y: sw / 2, width: s - sw, height: s - sw, cornerRadius: s * 0.28, stroke: cor, strokeWidth: sw }));
      g.add(new Konva.Circle({ x: s / 2, y: s / 2, radius: s * 0.22, stroke: cor, strokeWidth: sw }));
      g.add(new Konva.Circle({ x: s * 0.76, y: s * 0.24, radius: s * 0.06, fill: cor }));
    } else if (tipo === 'facebook') {
      g.add(new Konva.Rect({ x: sw / 2, y: sw / 2, width: s - sw, height: s - sw, cornerRadius: s * 0.22, stroke: cor, strokeWidth: sw }));
      const f = linhaSimples('f', { tamanho: s * 0.86, peso: 700, cor });
      f.node.position({ x: s * 0.36, y: s * 0.16 });
      g.add(f.node);
    }
    return g;
  }

  // ---------- Selos ----------
  function seloCirculo(diam, fundo, linhas) {
    const g = new Konva.Group();
    g.add(new Konva.Circle({ x: diam / 2, y: diam / 2, radius: diam / 2, fill: fundo }));
    const t = textoRico(linhas, { alinhar: 'center', entrelinha: 1.02 });
    t.node.position({ x: (diam - t.w) / 2, y: (diam - t.h) / 2 });
    g.add(t.node);
    return g;
  }

  function estrela(diam, pontas, fundo) {
    const pts = [];
    const R = diam / 2, r = R * 0.86;
    for (let i = 0; i < pontas * 2; i++) {
      const a = (Math.PI * i) / pontas - Math.PI / 2;
      const rr = i % 2 ? r : R;
      pts.push(R + Math.cos(a) * rr, R + Math.sin(a) * rr);
    }
    return new Konva.Line({ points: pts, closed: true, fill: fundo, lineJoin: 'round', stroke: fundo, strokeWidth: diam * 0.03 });
  }

  // ---------- Definições ----------
  const P = {
    texto: (key, label, padrao) => ({ key, label, tipo: 'texto', padrao }),
    area: (key, label, padrao) => ({ key, label, tipo: 'area', padrao }),
    num: (key, label, padrao, min = 0, max = 4000, passo = 1) => ({ key, label, tipo: 'numero', padrao, min, max, passo }),
    data: (key, label, padrao) => ({ key, label, tipo: 'data', padrao }),
    cor: (key, label, padrao) => ({ key, label, tipo: 'cor', padrao }),
    opcao: (key, label, padrao, opcoes) => ({ key, label, tipo: 'opcao', padrao, opcoes }),
    bool: (key, label, padrao) => ({ key, label, tipo: 'bool', padrao }),
    // Opções calculadas na hora: só famílias e pesos encontrados na pasta "fonts".
    fonte: () => ({ key: 'fonte', label: 'Fonte', tipo: 'opcao', padrao: NF.fontes.PADRAO, opcoes: () => NF.fontes.opcoesFamilia() }),
    peso: (padrao, key = 'peso', label = 'Peso') => ({ key, label, tipo: 'opcao', padrao: String(padrao), opcoes: (p) => NF.fontes.opcoesPeso(p.fonte) }),
  };

  const DEFS = [
    {
      id: 'validade', nome: 'Validade', categoria: 'Textos',
      props: [P.data('inicio', 'De (opcional)', ''), P.data('fim', 'Até', ''), P.texto('linha2', '2ª linha', 'ou enquanto durarem os estoques.'),
        P.num('tamanho', 'Tamanho', 44, 10, 300), P.fonte(), P.peso(500, 'peso', 'Peso do texto'), P.peso(700, 'pesoDatas', 'Peso das datas'), P.cor('cor', 'Cor', '#3b3b3b')],
      render(p) {
        const st = { tamanho: p.tamanho, peso: p.peso, fonte: p.fonte, cor: p.cor };
        const bold = { ...st, peso: p.pesoDatas };
        const runs = p.inicio
          ? [{ t: 'Promoções válidas de ', ...st }, { t: formatarData(p.inicio) || 'dd/mm/aaaa', ...bold }, { t: ' até ', ...st }, { t: formatarData(p.fim) || 'dd/mm/aaaa', ...bold }]
          : [{ t: 'Promoções válidas até ', ...st }, { t: formatarData(p.fim) || 'dd/mm/aaaa', ...bold }];
        if (p.linha2) runs.push({ t: '\n', ...st }, { t: p.linha2, ...st });
        return textoRico(runs, { entrelinha: 1.2 }).node;
      },
    },
    {
      id: 'texto-periodo', nome: 'Texto com período', categoria: 'Textos',
      props: [P.texto('prefixo', 'Antes', 'em perfumaria ('), P.data('inicio', 'Início', ''), P.data('fim', 'Fim', ''), P.texto('separador', 'Entre datas', ' a '),
        P.texto('sufixo', 'Depois', ')'), P.opcao('formato', 'Formato', 'curto', [['curto', 'dd/mm'], ['longo', 'dd/mm/aaaa']]),
        P.num('tamanho', 'Tamanho', 46, 10, 300), P.fonte(), P.peso(500), P.cor('cor', 'Cor', '#ffffff')],
      render(p) {
        const c = p.formato === 'curto';
        const txt = `${p.prefixo || ''}${formatarData(p.inicio, c) || 'dd/mm'}${p.separador || ''}${formatarData(p.fim, c) || 'dd/mm'}${p.sufixo || ''}`;
        return linhaSimples(txt, { tamanho: p.tamanho, peso: p.peso, fonte: p.fonte, cor: p.cor }).node;
      },
    },
    {
      id: 'texto', nome: 'Texto livre', categoria: 'Textos',
      props: [P.area('texto', 'Texto', 'Texto'), P.num('tamanho', 'Tamanho', 60, 8, 600), P.fonte(), P.peso(700), P.cor('cor', 'Cor', '#222222'),
        P.opcao('alinhar', 'Alinhamento', 'left', [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']]),
        P.num('largura', 'Largura (0 = livre)', 0, 0, 2600), P.num('espaco', 'Espaçamento', 0, -10, 40)],
      render(p) {
        return textoRico([{ t: p.texto, tamanho: p.tamanho, peso: p.peso, fonte: p.fonte, cor: p.cor, espaco: p.espaco }], { largura: p.largura, alinhar: p.alinhar }).node;
      },
    },
    {
      id: 'titulo-loja', nome: 'Título da loja', categoria: 'Textos',
      props: [P.texto('texto', 'Texto', 'Franquia Natura Dois Irmãos'), P.num('tamanho', 'Tamanho', 88, 10, 400), P.fonte(), P.peso(700), P.cor('cor', 'Cor', '#97503f')],
      render(p) { return linhaSimples(p.texto, { tamanho: p.tamanho, peso: p.peso, fonte: p.fonte, cor: p.cor }).node; },
    },
    {
      id: 'selo-estrela', nome: 'Selo % OFF', categoria: 'Selos',
      props: [P.num('percentual', 'Percentual', 45, 1, 99), P.texto('texto', 'Texto', 'OFF'), P.num('diametro', 'Diâmetro', 210, 60, 900),
        P.num('pontas', 'Pontas', 14, 6, 30), P.fonte(), P.peso(800), P.cor('fundo', 'Fundo', '#ee6a24'), P.cor('corTexto', 'Texto', '#ffffff')],
      render(p) {
        const d = p.diametro, g = new Konva.Group();
        g.add(estrela(d, p.pontas, p.fundo));
        const st = { peso: p.peso, fonte: p.fonte, cor: p.corTexto, tamanho: d * 0.2 };
        const t = textoRico([{ t: `${p.percentual}%`, ...st }, { t: '\n', ...st }, { t: p.texto, ...st }], { alinhar: 'center', entrelinha: 1.0 });
        t.node.position({ x: (d - t.w) / 2, y: (d - t.h) / 2 });
        g.add(t.node);
        return g;
      },
    },
    {
      id: 'selo-off', nome: 'Selo % OFF (círculo)', categoria: 'Selos',
      props: [P.num('percentual', 'Percentual', 40, 1, 99), P.texto('texto', 'Texto', 'OFF'), P.num('diametro', 'Diâmetro', 200, 60, 900),
        P.fonte(), P.peso(800), P.cor('fundo', 'Fundo', '#f26a21'), P.cor('corTexto', 'Texto', '#1a1a1a')],
      render(p) {
        const d = p.diametro, st = { peso: p.peso, fonte: p.fonte, cor: p.corTexto };
        return seloCirculo(d, p.fundo, [{ t: `${p.percentual}%`, tamanho: d * 0.25, ...st }, { t: '\n', tamanho: d * 0.25, ...st }, { t: p.texto, tamanho: d * 0.25, ...st }]);
      },
    },
    {
      id: 'selo-economize', nome: 'Selo Economize', categoria: 'Selos',
      props: [P.num('percentual', 'Percentual', 30, 1, 99), P.texto('texto', 'Texto', 'Economize'), P.num('diametro', 'Diâmetro', 190, 60, 900),
        P.fonte(), P.peso(500), P.cor('fundo', 'Fundo', '#343826'), P.cor('corTexto', 'Texto', '#ffffff')],
      render(p) {
        const d = p.diametro, st = { peso: p.peso, fonte: p.fonte, cor: p.corTexto };
        return seloCirculo(d, p.fundo, [
          { t: p.texto, tamanho: d * 0.15, ...st }, { t: '\n', tamanho: d * 0.15, ...st },
          { t: `${p.percentual}%`, tamanho: d * 0.25, ...st },
        ]);
      },
    },
    {
      id: 'selo-lancamento', nome: 'Selo Lançamento', categoria: 'Selos',
      props: [P.texto('texto', 'Texto', 'lançamento'), P.num('tamanho', 'Tamanho', 44, 10, 300), P.fonte(), P.peso(500), P.cor('fundo', 'Fundo', '#d0202e'), P.cor('corTexto', 'Texto', '#ffffff')],
      render(p) {
        const g = new Konva.Group();
        const t = linhaSimples(p.texto, { tamanho: p.tamanho, peso: p.peso, fonte: p.fonte, cor: p.corTexto });
        const px = p.tamanho * 0.5, py = p.tamanho * 0.32;
        g.add(new Konva.Rect({ width: t.w + px * 2, height: t.h + py * 2, fill: p.fundo, cornerRadius: p.tamanho * 0.35 }));
        t.node.position({ x: px, y: py });
        g.add(t.node);
        return g;
      },
    },
    {
      id: 'ou', nome: 'Separador "ou"', categoria: 'Textos',
      // A cor vem da arte (tema "ou"), como o "ou" entre produtos.
      props: [P.texto('texto', 'Texto', 'ou'), P.num('tamanho', 'Tamanho', 54, 10, 300), P.fonte(), P.peso(700)],
      render(p, tema) { return linhaSimples(p.texto, { tamanho: p.tamanho, peso: p.peso, fonte: p.fonte, cor: tema.ou }).node; },
    },
    {
      id: 'rodape-loja', nome: 'Rodapé da loja', categoria: 'Loja',
      props: [P.texto('nome', 'Loja', 'Franquia Natura Dois Irmãos'), P.texto('endereco', 'Endereço', 'Avenida São Miguel, 895, Sala 2'),
        P.texto('cidade', 'Cidade', 'Centro - Dois Irmãos/RS'), P.texto('whatsapp', 'WhatsApp', '(51) 99527-7491'),
        P.texto('instagram', 'Instagram', '@franquianatura_doisirmaos'), P.texto('facebook', 'Facebook', 'Franquia Natura Dois Irmãos'),
        P.num('tamanho', 'Tamanho', 40, 10, 200), P.num('largura', 'Distância colunas', 1250, 300, 2400),
        P.fonte(), P.peso(500, 'peso', 'Peso do endereço'), P.peso(700, 'pesoRedes', 'Peso das redes'), P.cor('cor', 'Cor', '#97503f')],
      render(p) {
        const g = new Konva.Group();
        const st = { tamanho: p.tamanho, peso: p.peso, fonte: p.fonte, cor: p.cor };
        const esq = textoRico([{ t: [p.nome, p.endereco, p.cidade].filter(Boolean).join('\n'), ...st }], { entrelinha: 1.22 });
        g.add(esq.node);
        const xDir = p.largura;
        g.add(new Konva.Rect({ x: xDir - 70, y: 4, width: 4, height: esq.h - 4, fill: p.cor }));
        const itens = [['whatsapp', p.whatsapp], ['instagram', p.instagram], ['facebook', p.facebook]].filter((i) => i[1]);
        const lh = p.tamanho * 1.22;
        itens.forEach(([tipo, txt], i) => {
          const s = p.tamanho * 0.95;
          const ic = icone(tipo, s, p.cor);
          ic.position({ x: xDir, y: i * lh + (lh - s) / 2 - p.tamanho * 0.08 });
          g.add(ic);
          const t = linhaSimples(txt, { tamanho: p.tamanho * 0.92, peso: p.pesoRedes, fonte: p.fonte, cor: p.cor, espaco: 0.5 });
          t.node.position({ x: xDir + s + p.tamanho * 0.4, y: i * lh + (lh - t.h) / 2 - p.tamanho * 0.06 });
          g.add(t.node);
        });
        return g;
      },
    },
    {
      id: 'aviso-lateral', nome: 'Imagens ilustrativas', categoria: 'Loja',
      props: [P.texto('texto', 'Texto', 'Imagens meramente ilustrativas.'), P.num('tamanho', 'Tamanho', 36, 8, 200), P.fonte(), P.peso(800),
        P.cor('cor', 'Cor', '#000000'), P.cor('contorno', 'Contorno', '#ffffff')],
      render(p) {
        return textoRico([{ t: p.texto, tamanho: p.tamanho, peso: p.peso, fonte: p.fonte, cor: p.cor }], { contorno: { cor: p.contorno, largura: p.tamanho * 0.22 } }).node;
      },
    },
    {
      id: 'painel', nome: 'Painel', categoria: 'Formas',
      props: [P.num('largura', 'Largura', 2335, 20, 2600), P.num('altura', 'Altura', 2755, 20, 3600), P.cor('cor', 'Cor', '#ffffff'),
        P.num('raioSupEsq', 'Raio sup. esq.', 0, 0, 600), P.num('raioSupDir', 'Raio sup. dir.', 150, 0, 600),
        P.num('raioInfDir', 'Raio inf. dir.', 0, 0, 600), P.num('raioInfEsq', 'Raio inf. esq.', 150, 0, 600), P.bool('sombra', 'Sombra', false)],
      render(p) {
        return new Konva.Rect({
          width: p.largura, height: p.altura, fill: p.cor, cornerRadius: [p.raioSupEsq, p.raioSupDir, p.raioInfDir, p.raioInfEsq],
          shadowColor: '#000', shadowBlur: p.sombra ? 30 : 0, shadowOpacity: p.sombra ? 0.25 : 0, shadowOffsetY: p.sombra ? 8 : 0,
        });
      },
    },
    {
      id: 'linha', nome: 'Linha divisória', categoria: 'Formas',
      props: [P.num('comprimento', 'Comprimento', 2000, 10, 2600), P.num('espessura', 'Espessura', 5, 1, 60), P.cor('cor', 'Cor', '#1d2a44')],
      render(p) { return new Konva.Rect({ width: p.comprimento, height: p.espessura, fill: p.cor }); },
    },
  ];

  const MAPA = new Map(DEFS.map((d) => [d.id, d]));
  const def = (id) => MAPA.get(id);

  function renderizar(el, tema = NF.modelo.TEMA_PADRAO) {
    const d = def(el.comp);
    if (!d) return new Konva.Group();
    const props = {};
    for (const c of d.props) props[c.key] = el.props?.[c.key] ?? c.padrao;
    try { return d.render(props, tema); } catch (e) { console.error(e); return new Konva.Group(); }
  }

  return { DEFS, def, renderizar, etiquetaPreco, nomeProduto, textoRico, linhaSimples, medir };
})();
