// Cena Konva: monta a página do panfleto e controla interação (seleção, arrastar, transformar, zoom, soltar).
NF.cena = (() => {
  const M = NF.modelo, E = NF.estado, C = NF.componentes;
  const PAG = M.PAGINA;

  // Reduções grandes (imagem de 1200 px numa célula, página inteira na tela) serrilham com o filtro
  // padrão do navegador; o filtro "high" faz a média dos pixels. Vale para o editor e para a exportação.
  const drawImageOriginal = Konva.Context.prototype.drawImage;
  Konva.Context.prototype.drawImage = function (...args) {
    this._context.imageSmoothingQuality = 'high';
    return drawImageOriginal.apply(this, args);
  };
  // O editor desenha com o dobro de pixels (mínimo 2×) e o navegador reduz: bordas de texto mais suaves com zoom baixo.
  const SUPERAMOSTRAGEM = () => Math.min(3, Math.max(2, window.devicePixelRatio || 1));

  // ---------- Layout interno da célula ----------
  // Nome e etiqueta formam um bloco com no máximo a largura de uma coluna simples da grade: numa célula
  // alargada o nome quebra em linhas (em vez de esticar) e o bloco fica centralizado sob os produtos.
  function layoutCelula(r, larguraColuna = r.w) {
    const pad = Math.min(r.w * 0.07, 48);
    const padColuna = Math.min(larguraColuna * 0.07, 48);
    const larguraBloco = Math.min(r.w - pad * 2, larguraColuna - padColuna * 2);
    return {
      pad,
      imagem: { x: pad * 0.4, y: r.h * 0.02, w: r.w - pad * 0.8, h: r.h * 0.57 },
      precoY: r.h * 0.715,
      blocoX: pad + (r.w - pad * 2 - larguraBloco) / 2,
      nomeLargura: larguraBloco,
    };
  }

  // Calcula posição/escala base de cada produto. Os produtos de uma oferta são variações ("ou") e ficam todos
  // com a mesma altura (as fotos da Natura vêm enquadradas de jeitos diferentes, então a escala comum não
  // preserva tamanho real); se não couberem na largura, diminuem juntos. Alinhados pela base e centralizados.
  function layoutProdutos(oferta, area, tema) {
    const itens = oferta.produtos.map((p) => {
      const res = p.imagem ? NF.imagens.obterProcessada(p.imagem, p.tolerancia, p.recorte) : null;
      if (res) return { p, res, w: res.w, h: res.h };
      return { p, res, w: 520, h: 640, vazio: true };
    });
    if (!itens.length) return { itens: [], ous: [] };
    const tamOu = Math.min(57, area.h * 0.12);
    const wOu = oferta.mostrarOu && itens.length > 1 ? C.medir('ou', { tamanho: tamOu, peso: NF.tipografia.atual().ou.peso, fonte: NF.tipografia.atual().ou.fonte }) + 36 : 18;
    const gaps = wOu * (itens.length - 1);
    // largura de cada um com a altura cheia da área; se a soma passar da largura, reduz todos na mesma proporção
    const somaW = itens.reduce((a, i) => a + i.w * (area.h / i.h), 0);
    const f = Math.min(1, (area.w - gaps) / somaW);
    const altura = area.h * f;
    const total = somaW * f + gaps;
    let x = area.x + (area.w - total) / 2;
    const base = area.y + area.h;
    const ous = [];
    itens.forEach((it, k) => {
      it.s = altura / it.h;
      it.cx = x + (it.w * it.s) / 2;
      it.base = base;
      x += it.w * it.s;
      if (k < itens.length - 1) {
        if (oferta.mostrarOu && itens.length > 1) ous.push({ x: x + 18, y: base - altura / 2 - tamOu * 0.5, tam: tamOu, cor: tema.ou });
        x += wOu;
      }
    });
    return { itens, ous };
  }

  // ---------- Montagem da página ----------
  function montarPagina(projeto, paginaId, { editor = false, selecao = null } = {}) {
    const pag = projeto.paginas[paginaId];
    const tema = projeto.tema;
    const raiz = new Konva.Group({ name: 'pagina', clip: { x: 0, y: 0, width: PAG.w, height: PAG.h } });

    const f = pag.fundo || { tipo: 'cor', cor: '#fff' };
    const fundo = new Konva.Rect({ width: PAG.w, height: PAG.h, name: 'fundo-pagina', listening: editor });
    if (f.tipo === 'degrade' && f.paradas?.length) {
      fundo.setAttrs({ fillLinearGradientStartPoint: { x: 0, y: 0 }, fillLinearGradientEndPoint: { x: 0, y: PAG.h }, fillLinearGradientColorStops: f.paradas.flat() });
    } else fundo.fill(f.cor || '#ffffff');
    raiz.add(fundo);

    const rects = M.retangulos(pag);
    const visiveis = new Set(M.celulasVisiveis(pag).map((c) => c.id));

    for (const el of pag.elementos) {
      if (el.visivel === false) continue;
      if (el.tipo === 'grade') { raiz.add(montarGrade(projeto, pag, rects, visiveis, { editor, selecao })); continue; }
      let ox = 0, oy = 0;
      if (el.celulaId) {
        const r = rects.get(el.celulaId);
        if (!r || !visiveis.has(el.celulaId)) continue;
        ox = r.x; oy = r.y;
      }
      const g = new Konva.Group({
        id: el.id, name: 'el', x: ox + el.x, y: oy + el.y, rotation: el.rotacao || 0, scaleX: el.escala || 1, scaleY: el.escala || 1,
        draggable: editor && !el.bloqueado, listening: editor && !el.bloqueado, opacity: el.opacidade ?? 1,
      });
      g.setAttr('origem', { ox, oy });
      if (el.tipo === 'imagem') {
        const img = NF.imagens.obter(el.ref);
        // Recortada: w/h continuam sendo o tamanho da foto inteira e só a área mantida aparece, no mesmo lugar.
        const q = el.recorte;
        if (img && q) {
          const fx = q.e / 100, fy = q.c / 100, fw = 1 - fx - q.d / 100, fh = 1 - fy - q.b / 100;
          const W = img.naturalWidth, H = img.naturalHeight;
          g.add(new Konva.Image({ image: img, x: el.w * fx, y: el.h * fy, width: el.w * fw, height: el.h * fh, crop: { x: W * fx, y: H * fy, width: W * fw, height: H * fh } }));
        } else if (img) g.add(new Konva.Image({ image: img, width: el.w, height: el.h }));
        else if (editor) g.add(new Konva.Rect({ width: el.w, height: el.h, fill: img === null ? '#e5a5a5' : '#e8e2dc', name: 'editor-only' }));
      } else if (el.tipo === 'componente') {
        g.add(C.renderizar(el, tema));
      }
      raiz.add(g);
    }

    if (editor && E.s.ui.mostrarGuias) {
      const R = M.REFILE;
      raiz.add(new Konva.Rect({ x: R.x, y: R.y, width: R.w, height: R.h, stroke: '#00b7ff', strokeWidth: 3, dash: [18, 12], listening: false, name: 'editor-only' }));
    }
    return raiz;
  }

  function montarGrade(projeto, pag, rects, visiveis, { editor, selecao }) {
    const grupo = new Konva.Group({ name: 'grade' });
    const tema = projeto.tema;
    for (const cel of pag.celulas) {
      if (!visiveis.has(cel.id)) continue;
      const r = rects.get(cel.id);
      const g = new Konva.Group({ id: cel.id, name: 'celula', x: r.x, y: r.y });
      g.setAttr('celulaId', cel.id);
      g.add(new Konva.Rect({ width: r.w, height: r.h, fill: 'rgba(0,0,0,0)', name: 'celula-fundo', listening: editor }));
      const oferta = cel.ofertaId ? projeto.ofertas.find((o) => o.id === cel.ofertaId) : null;
      const L = layoutCelula(r, M.larguraColuna(pag.grade));
      const selecionada = selecao?.tipo === 'celula' && selecao.id === cel.id;

      if (!oferta) {
        if (editor) {
          g.add(new Konva.Rect({ x: 14, y: 14, width: r.w - 28, height: r.h - 28, stroke: '#b9aaa0', strokeWidth: 4, dash: [20, 14], cornerRadius: 12, name: 'editor-only', listening: false }));
          const t = C.linhaSimples('Arraste uma oferta aqui', { tamanho: 34, peso: 500, cor: '#a39388' });
          t.node.setAttrs({ x: (r.w - t.w) / 2, y: r.h / 2 - t.h / 2, listening: false, name: 'editor-only' });
          g.add(t.node);
        }
      } else {
        const aj = cel.ajustes || {};
        // O nome cresce para cima a partir da etiqueta; as imagens terminam logo acima dele.
        const nm = C.nomeProduto(oferta, L.nomeLargura, tema);
        const baseNomeY = L.precoY - nm.h - 10;
        const areaImg = { ...L.imagem, h: Math.min(L.imagem.h, baseNomeY - 18 - L.imagem.y) };
        const { itens, ous } = layoutProdutos(oferta, areaImg, tema);
        itens.forEach((it, k) => {
          const sel = selecionada && selecao.parte === 'produto' && selecao.indice === k;
          const props = {
            name: 'produto', x: it.cx + (it.p.dx || 0), y: it.base + (it.p.dy || 0), offsetX: it.w / 2, offsetY: it.h,
            scaleX: it.s * (it.p.escala || 1), scaleY: it.s * (it.p.escala || 1), draggable: editor,
          };
          let node;
          if (it.res) node = new Konva.Image({ ...props, image: it.res.canvas, width: it.w, height: it.h });
          else {
            node = new Konva.Group(props);
            if (editor) {
              node.add(new Konva.Rect({ width: it.w, height: it.h, fill: it.res === undefined ? '#eee8e2' : '#f6e1dc', stroke: '#d9b9ae', strokeWidth: 6, dash: [24, 16], name: 'editor-only' }));
              const msg = it.res === undefined && it.p.imagem ? 'Carregando…' : `Sem imagem\n${it.p.codigo}`;
              const t = C.textoRico([{ t: msg, tamanho: 64, peso: 700, cor: '#b0857a' }], { alinhar: 'center' });
              t.node.setAttrs({ x: (it.w - t.w) / 2, y: (it.h - t.h) / 2, name: 'editor-only' });
              node.add(t.node);
            }
          }
          node.setAttrs({ celulaId: cel.id, indice: k, baseX: it.cx, baseY: it.base, escalaBase: it.s });
          if (sel) node.setAttr('selecionado', true);
          g.add(node);
        });
        for (const o of ous) {
          const t = C.linhaSimples('ou', { tamanho: o.tam, peso: NF.tipografia.atual().ou.peso, fonte: NF.tipografia.atual().ou.fonte, cor: o.cor });
          t.node.setAttrs({ x: o.x, y: o.y, listening: false });
          g.add(t.node);
        }

        const et = C.etiquetaPreco(oferta, tema);
        const ajP = aj.preco || {};
        et.node.setAttrs({ x: L.blocoX + (ajP.x || 0), y: L.precoY + (ajP.y || 0), scaleX: ajP.escala || 1, scaleY: ajP.escala || 1, draggable: editor });
        et.node.setAttrs({ celulaId: cel.id, baseX: L.blocoX, baseY: L.precoY });
        g.add(et.node);

        const ajN = aj.nome || {};
        nm.node.setAttrs({ x: L.blocoX + (ajN.x || 0), y: baseNomeY + (ajN.y || 0), scaleX: ajN.escala || 1, scaleY: ajN.escala || 1, draggable: editor });
        nm.node.setAttrs({ celulaId: cel.id, baseX: L.blocoX, baseY: baseNomeY });
        g.add(nm.node);
      }

      if (editor && selecionada) {
        g.add(new Konva.Rect({ width: r.w, height: r.h, stroke: '#3d8bfd', strokeWidth: 5, dash: [16, 10], listening: false, name: 'editor-only' }));
      }
      grupo.add(g);
    }
    return grupo;
  }

  // ---------- Editor interativo ----------
  let stage, camada, mundo, transformer, conteudo, container;
  let pan = { x: 40, y: 40 };
  let espacoPressionado = false;
  let botaoPressionado = false;
  let renderAgendado = false;
  let trRecorte = null;

  function iniciar(el) {
    container = el;
    stage = new Konva.Stage({ container: el, width: el.clientWidth, height: el.clientHeight });
    camada = new Konva.Layer();
    stage.add(camada);
    camada.getCanvas().setPixelRatio(SUPERAMOSTRAGEM());
    mundo = new Konva.Group();
    camada.add(mundo);
    transformer = new Konva.Transformer({
      keepRatio: true, enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'], rotateEnabled: true,
      anchorSize: 9, anchorStroke: '#3d8bfd', borderStroke: '#3d8bfd', anchorCornerRadius: 2, rotationSnaps: [0, 90, 180, 270], ignoreStroke: true,
    });
    camada.add(transformer);

    new ResizeObserver(() => {
      if (!el.clientWidth) return;
      stage.size({ width: el.clientWidth, height: el.clientHeight });
      aplicarVista();
    }).observe(el);

    stage.on('mousedown touchstart', aoPressionar);
    el.addEventListener('pointerdown', () => { botaoPressionado = true; }, true);
    window.addEventListener('pointerup', () => { botaoPressionado = false; }, true);
    stage.on('dragend', aoSoltarArrasto);
    transformer.on('transformend', aoTransformar);
    stage.on('dblclick', (e) => {
      const alvo = alvoSelecionavel(e.target);
      if (alvo?.tipo === 'celula') E.ui({ painelSup: 'propriedades' });
    });
    // No modo de recorte, Enter aplica e Esc cancela (antes dos atalhos gerais).
    window.addEventListener('keydown', (e) => {
      if (!E.s.ui.recorte || digitando(e) || (e.key !== 'Enter' && e.key !== 'Escape')) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Enter') aplicarRecorte(); else cancelarRecorte();
    }, true);
    el.addEventListener('wheel', aoRolar, { passive: false });
    configurarPanoramica();
    configurarSoltar();

    E.assinar((motivo) => { if (motivo !== 'salvo') agendarRender(); });
    NF.imagens.eventos.on(() => agendarRender());
    ajustarATela();
  }

  function agendarRender() {
    if (renderAgendado) return;
    renderAgendado = true;
    requestAnimationFrame(() => { renderAgendado = false; render(); });
  }

  function render() {
    if (!stage || !E.s.projeto) return;
    // Não destrói nós com o botão pressionado ou no meio de um arrasto/transformação.
    if (botaoPressionado || Konva.isDragging() || transformer.isTransforming() || trRecorte?.isTransforming()) { setTimeout(agendarRender, 60); return; }
    if (conteudo) conteudo.destroy();
    mundo.destroyChildren();
    if (trRecorte) { trRecorte.destroy(); trRecorte = null; }
    mundo.add(new Konva.Rect({ x: 10, y: 14, width: PAG.w, height: PAG.h, fill: 'rgba(0,0,0,.35)', listening: false }));
    conteudo = montarPagina(E.s.projeto, E.s.ui.pagina, { editor: true, selecao: E.s.ui.selecao });
    mundo.add(conteudo);
    montarRecorte();
    atualizarTransformer();
    container.classList.toggle('hand', E.s.ui.ferramenta === 'mao' || espacoPressionado);
    container.classList.toggle('zoom', E.s.ui.ferramenta === 'zoom' && !espacoPressionado);
    camada.batchDraw();
  }

  function noSelecionado() {
    const sel = E.s.ui.selecao;
    if (!sel || !conteudo) return null;
    if (sel.tipo === 'elemento') return conteudo.findOne(`#${sel.id}`);
    const g = conteudo.findOne(`#${sel.id}`);
    if (!g) return null;
    if (sel.parte === 'produto') return g.getChildren((n) => n.name() === 'produto' && n.getAttr('indice') === sel.indice)[0];
    if (sel.parte === 'nome') return g.findOne('.nome');
    if (sel.parte === 'etiqueta') return g.findOne('.etiqueta');
    return null;
  }

  function atualizarTransformer() {
    const n = noSelecionado();
    const sel = E.s.ui.selecao;
    const el = sel?.tipo === 'elemento' ? E.elemento(sel.id) : null;
    if (n && !(el && el.bloqueado) && !E.s.ui.recorte) {
      transformer.nodes([n]);
      transformer.rotateEnabled(sel.tipo === 'elemento');
      transformer.moveToTop();
    } else transformer.nodes([]);
  }

  // Sobe na árvore até achar algo selecionável.
  function alvoSelecionavel(node) {
    let n = node;
    while (n && n !== stage) {
      const nome = n.name();
      if (nome === 'el') return { tipo: 'elemento', id: n.id(), node: n };
      if (nome === 'produto') return { tipo: 'celula', id: n.getAttr('celulaId'), parte: 'produto', indice: n.getAttr('indice'), node: n };
      if (nome === 'nome') return { tipo: 'celula', id: n.getAttr('celulaId'), parte: 'nome', node: n };
      if (nome === 'etiqueta') return { tipo: 'celula', id: n.getAttr('celulaId'), parte: 'etiqueta', node: n };
      if (nome === 'celula') return { tipo: 'celula', id: n.id(), parte: 'celula', node: n };
      n = n.getParent();
    }
    return null;
  }

  function aoPressionar(e) {
    if (E.s.ui.ferramenta !== 'mover' || espacoPressionado) return;
    if (E.s.ui.recorte) {
      // Clicar fora da caixa de recorte aplica o recorte.
      if (e.target.name() === 'recorte-caixa' || e.target.getParent() === trRecorte) return;
      aplicarRecorte();
    }
    if (e.target.getParent()?.className === 'Transformer' || e.target.getParent() instanceof Konva.Transformer) return;
    const alvo = alvoSelecionavel(e.target);
    if (!alvo) { if (E.s.ui.selecao) E.selecionar(null); return; }
    const { node, ...sel } = alvo;
    const atual = E.s.ui.selecao;
    const igual = atual && atual.tipo === sel.tipo && atual.id === sel.id && atual.parte === sel.parte && atual.indice === sel.indice;
    // A cena só é redesenhada ao soltar o botão, então o mesmo clique já pode arrastar o item.
    if (!igual) E.selecionar(sel);
  }

  function aoSoltarArrasto(e) {
    const n = e.target;
    const nome = n.name();
    if (nome === 'el') {
      const id = n.id();
      const { ox, oy } = n.getAttr('origem') || { ox: 0, oy: 0 };
      const nx = Math.round(n.x() - ox), ny = Math.round(n.y() - oy);
      E.alterar((p) => {
        const el = p.paginas[E.s.ui.pagina].elementos.find((x) => x.id === id);
        if (!el || (el.x === nx && el.y === ny)) return false;
        el.x = nx; el.y = ny;
      });
    } else if (nome === 'produto') {
      salvarProduto(n);
    } else if (nome === 'nome' || nome === 'etiqueta') {
      salvarAjuste(n, nome === 'nome' ? 'nome' : 'preco');
    }
  }

  function salvarProduto(n) {
    const celId = n.getAttr('celulaId'), k = n.getAttr('indice');
    const cel = E.celula(celId);
    E.alterar((p) => {
      const of = p.ofertas.find((o) => o.id === cel.ofertaId);
      const prod = of?.produtos[k];
      if (!prod) return false;
      const dx = Math.round(n.x() - n.getAttr('baseX')), dy = Math.round(n.y() - n.getAttr('baseY'));
      const esc = +(n.scaleX() / n.getAttr('escalaBase')).toFixed(3);
      if (prod.dx === dx && prod.dy === dy && (prod.escala || 1) === esc) return false;
      Object.assign(prod, { dx, dy, escala: esc });
    });
  }

  function salvarAjuste(n, chave) {
    const celId = n.getAttr('celulaId');
    E.alterar((p) => {
      const cel = p.paginas[E.s.ui.pagina].celulas.find((c) => c.id === celId);
      if (!cel) return false;
      const novo = { x: Math.round(n.x() - n.getAttr('baseX')), y: Math.round(n.y() - n.getAttr('baseY')), escala: +n.scaleX().toFixed(3) };
      const atual = cel.ajustes?.[chave] || { x: 0, y: 0, escala: 1 };
      if (atual.x === novo.x && atual.y === novo.y && (atual.escala || 1) === novo.escala) return false;
      cel.ajustes = cel.ajustes || {};
      cel.ajustes[chave] = novo;
    });
  }

  function aoTransformar() {
    const n = transformer.nodes()[0];
    if (!n) return;
    const nome = n.name();
    if (nome === 'el') {
      const id = n.id();
      const { ox, oy } = n.getAttr('origem') || { ox: 0, oy: 0 };
      E.alterar((p) => {
        const el = p.paginas[E.s.ui.pagina].elementos.find((x) => x.id === id);
        if (!el) return false;
        el.x = Math.round(n.x() - ox); el.y = Math.round(n.y() - oy);
        el.escala = +n.scaleX().toFixed(4); el.rotacao = Math.round(n.rotation() * 10) / 10;
      });
    } else if (nome === 'produto') salvarProduto(n);
    else if (nome === 'nome') salvarAjuste(n, 'nome');
    else if (nome === 'etiqueta') salvarAjuste(n, 'preco');
  }

  // ---------- Recorte (ferramenta da barra, tecla C) ----------
  // E.s.ui.recorte = { alvo, rect } enquanto o modo está aberto. alvo: { tipo: 'produto', celulaId, indice } ou
  // { tipo: 'elemento', id } (imagem solta). rect = área mantida, em px da foto original. A foto inteira aparece sobre a
  // camada (fora da área, esmaecida) e a caixa tem alças como as de redimensionar.
  function produtoDe(pr, pag, celulaId, indice) {
    const cel = pag.celulas.find((c) => c.id === celulaId);
    return cel?.ofertaId ? pr.ofertas.find((o) => o.id === cel.ofertaId)?.produtos[indice] : null;
  }
  // Produto ou elemento que guarda o recorte, no projeto dado (o atual, alterado no lugar por E.alterar).
  function donoDoRecorte(pr, alvo) {
    const pag = pr.paginas[E.s.ui.pagina];
    return alvo.tipo === 'elemento' ? pag.elementos.find((e) => e.id === alvo.id) : produtoDe(pr, pag, alvo.celulaId, alvo.indice);
  }
  const imagemDoAlvo = (dono, alvo) => NF.imagens.obter(alvo.tipo === 'elemento' ? dono.ref : `proj:${dono.imagem}`);

  // O que a seleção permite recortar: imagem solta (não bloqueada) ou produto com foto.
  function alvoRecortavel(sel) {
    if (sel?.tipo === 'elemento') {
      const el = E.elemento(sel.id);
      return el?.tipo === 'imagem' && !el.bloqueado ? { tipo: 'elemento', id: el.id } : null;
    }
    if (sel?.tipo === 'celula' && sel.parte === 'produto') {
      const prod = produtoDe(E.s.projeto, E.pagina(), sel.id, sel.indice);
      return prod?.imagem ? { tipo: 'produto', celulaId: sel.id, indice: sel.indice } : null;
    }
    return null;
  }

  // Botão da barra: abre o recorte da camada selecionada; com o recorte aberto, aplica.
  function alternarRecorte() {
    if (E.s.ui.recorte) return aplicarRecorte();
    const alvo = alvoRecortavel(E.s.ui.selecao);
    if (!alvo) { E.aviso('Selecione uma imagem ou um produto para recortar.', 'err'); return; }
    E.ui({ recorte: { alvo } });
    E.aviso('Arraste a caixa e as alças. Enter ou clicar fora aplica; Esc cancela.');
  }

  function cancelarRecorte() {
    if (E.s.ui.recorte) E.ui({ recorte: null });
  }

  function aplicarRecorte() {
    const rc = E.s.ui.recorte;
    if (!rc) return;
    E.s.ui.recorte = null;
    const dono = donoDoRecorte(E.s.projeto, rc.alvo);
    const img = dono && imagemDoAlvo(dono, rc.alvo);
    if (rc.rect && img) {
      const W = img.naturalWidth, H = img.naturalHeight, r = rc.rect;
      const pct = (v, t) => Math.max(0, Math.round((v / t) * 1000) / 10);
      const novo = { e: pct(r.x, W), d: pct(W - r.x - r.w, W), c: pct(r.y, H), b: pct(H - r.y - r.h, H) };
      const vazio = !Object.values(novo).some(Boolean);
      E.alterar((p) => {
        const d = donoDoRecorte(p, rc.alvo);
        if (!d || JSON.stringify(d.recorte || null) === JSON.stringify(vazio ? null : novo)) return false;
        if (vazio) delete d.recorte; else d.recorte = novo;
      });
    }
    E.notificar('ui');
  }

  function montarRecorte() {
    const rc = E.s.ui.recorte;
    if (!rc) return;
    const { alvo } = rc;
    const dono = donoDoRecorte(E.s.projeto, alvo);
    const img = dono && imagemDoAlvo(dono, alvo);
    const n = alvo.tipo === 'elemento' ? conteudo.findOne(`#${alvo.id}`)
      : conteudo.findOne(`#${alvo.celulaId}`)?.getChildren((x) => x.name() === 'produto' && x.getAttr('indice') === alvo.indice)[0];
    // quadro: posição e escala da foto original no sistema da camada. O produto mostra a foto já recortada e sem
    // margens (começa em ox/oy da original); a imagem solta guarda em w/h o tamanho da foto inteira.
    let quadro = null;
    if (img && alvo.tipo === 'produto') {
      const res = NF.imagens.obterProcessada(dono.imagem, dono.tolerancia, dono.recorte);
      if (res) quadro = { x: -res.ox, y: -res.oy, s: 1 };
    } else if (img) quadro = { x: 0, y: 0, s: dono.w / img.naturalWidth };
    const selAtual = alvoRecortavel(E.s.ui.selecao);
    if (!n || !quadro || JSON.stringify(selAtual) !== JSON.stringify(alvo)) { E.s.ui.recorte = null; return; }
    const W = img.naturalWidth, H = img.naturalHeight;
    if (!rc.rect) {
      const q = dono.recorte || {};
      const x = (W * (q.e || 0)) / 100, y = (H * (q.c || 0)) / 100;
      rc.rect = { x, y, w: W - x - (W * (q.d || 0)) / 100, h: H - y - (H * (q.b || 0)) / 100 };
    }
    // Mesmo enquadramento da camada na página, em coordenadas do "mundo".
    const t = mundo.getAbsoluteTransform().copy().invert().multiply(n.getAbsoluteTransform()).decompose();
    const grupo = new Konva.Group({ ...t, name: 'recorte' });
    const foto = new Konva.Group({ x: quadro.x, y: quadro.y, scaleX: quadro.s, scaleY: quadro.s });
    const fundo = new Konva.Image({ image: img, width: W, height: H, opacity: 0.35 });
    const claro = new Konva.Group({ listening: false });
    claro.add(new Konva.Image({ image: img, width: W, height: H, listening: false }));
    const caixa = new Konva.Rect({
      x: rc.rect.x, y: rc.rect.y, width: rc.rect.w, height: rc.rect.h, name: 'recorte-caixa', draggable: true,
      fill: 'rgba(0,0,0,0)', stroke: '#3d8bfd', strokeWidth: 1.5, strokeScaleEnabled: false,
    });
    const atualizar = () => {
      const w = caixa.width() * caixa.scaleX(), h = caixa.height() * caixa.scaleY();
      caixa.x(Math.min(Math.max(caixa.x(), 0), W - w));
      caixa.y(Math.min(Math.max(caixa.y(), 0), H - h));
      claro.clip({ x: caixa.x(), y: caixa.y(), width: w, height: h });
    };
    const guardar = () => {
      caixa.setAttrs({ width: caixa.width() * caixa.scaleX(), height: caixa.height() * caixa.scaleY(), scaleX: 1, scaleY: 1 });
      atualizar();
      rc.rect = { x: caixa.x(), y: caixa.y(), w: caixa.width(), h: caixa.height() };
    };
    caixa.on('dragmove transform', atualizar);
    caixa.on('dragend transformend', guardar);
    foto.add(fundo, claro, caixa);
    grupo.add(foto);
    mundo.add(grupo);
    n.visible(false);
    atualizar();

    trRecorte = new Konva.Transformer({
      nodes: [caixa], rotateEnabled: false, keepRatio: false, ignoreStroke: true, anchorSize: 9,
      anchorStroke: '#3d8bfd', borderStroke: '#3d8bfd', anchorCornerRadius: 2,
      // A caixa não sai da foto nem fica menor que 5% dela.
      boundBoxFunc: (antes, depois) => {
        const f = fundo.getClientRect();
        const dentro = depois.x >= f.x - 0.5 && depois.y >= f.y - 0.5 && depois.x + depois.width <= f.x + f.width + 0.5 && depois.y + depois.height <= f.y + f.height + 0.5;
        return dentro && depois.width >= f.width * 0.05 && depois.height >= f.height * 0.05 ? depois : antes;
      },
    });
    camada.add(trRecorte);
  }

  // ---------- Zoom e panorâmica ----------
  function aplicarVista() {
    if (!mundo) return;
    mundo.scale({ x: E.s.ui.zoom, y: E.s.ui.zoom });
    mundo.position(pan);
    camada.batchDraw();
  }

  function definirZoom(z, foco) {
    z = NF.util.clamp(z, 0.05, 2);
    const antigo = E.s.ui.zoom;
    foco = foco || { x: stage.width() / 2, y: stage.height() / 2 };
    const mx = (foco.x - pan.x) / antigo, my = (foco.y - pan.y) / antigo;
    pan = { x: foco.x - mx * z, y: foco.y - my * z };
    E.s.ui.zoom = z;
    aplicarVista();
    E.notificar('zoom');
  }

  // Centraliza a vista num ponto da página (coordenadas de desenho).
  function centralizarEm(pt, z = E.s.ui.zoom) {
    E.s.ui.zoom = NF.util.clamp(z, 0.05, 2);
    pan = { x: stage.width() / 2 - pt.x * E.s.ui.zoom, y: stage.height() / 2 - pt.y * E.s.ui.zoom };
    aplicarVista();
    E.notificar('zoom');
  }

  function ajustarATela() {
    if (!stage) return;
    const w = stage.width(), h = stage.height();
    const z = Math.min((w - 60) / PAG.w, (h - 60) / PAG.h);
    E.s.ui.zoom = z;
    pan = { x: (w - PAG.w * z) / 2, y: (h - PAG.h * z) / 2 };
    aplicarVista();
    E.notificar('zoom');
  }

  function aoRolar(e) {
    e.preventDefault();
    const r = container.getBoundingClientRect();
    const foco = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.ctrlKey || e.metaKey || E.s.ui.ferramenta === 'zoom') {
      definirZoom(E.s.ui.zoom * Math.pow(1.0015, -e.deltaY), foco);
    } else {
      pan = { x: pan.x - (e.shiftKey ? e.deltaY : e.deltaX), y: pan.y - (e.shiftKey ? 0 : e.deltaY) };
      aplicarVista();
    }
  }

  function configurarPanoramica() {
    let arrastando = null;
    container.addEventListener('mousedown', (e) => {
      const r = container.getBoundingClientRect();
      if (E.s.ui.ferramenta === 'zoom' && !espacoPressionado && e.button === 0) {
        definirZoom(E.s.ui.zoom * (e.altKey ? 1 / 1.4 : 1.4), { x: e.clientX - r.left, y: e.clientY - r.top });
        return;
      }
      if (E.s.ui.ferramenta === 'mao' || espacoPressionado || e.button === 1) {
        e.preventDefault();
        arrastando = { x: e.clientX, y: e.clientY, pan: { ...pan } };
        container.classList.add('panning');
      }
    }, true);
    window.addEventListener('mousemove', (e) => {
      if (!arrastando) return;
      pan = { x: arrastando.pan.x + e.clientX - arrastando.x, y: arrastando.pan.y + e.clientY - arrastando.y };
      aplicarVista();
    });
    window.addEventListener('mouseup', () => { arrastando = null; container.classList.remove('panning'); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !digitando(e) && !espacoPressionado) { espacoPressionado = true; stage.listening(false); container.classList.add('hand'); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && espacoPressionado) { espacoPressionado = false; stage.listening(true); render(); }
    });
  }

  const digitando = (e) => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;

  // Converte coordenadas da tela para coordenadas da página.
  function pontoNaPagina(clientX, clientY) {
    const r = container.getBoundingClientRect();
    return { x: (clientX - r.left - pan.x) / E.s.ui.zoom, y: (clientY - r.top - pan.y) / E.s.ui.zoom };
  }

  function celulaEm(pt) {
    const pag = E.pagina();
    const rects = M.retangulos(pag);
    for (const c of M.celulasVisiveis(pag)) {
      const r = rects.get(c.id);
      if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return { celula: c, rect: r };
    }
    return null;
  }

  // ---------- Soltar itens arrastados dos painéis ----------
  function configurarSoltar() {
    container.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('application/x-nf')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    container.addEventListener('drop', (e) => {
      const raw = e.dataTransfer.getData('application/x-nf');
      if (!raw) return;
      e.preventDefault();
      const item = JSON.parse(raw);
      const pt = pontoNaPagina(e.clientX, e.clientY);
      soltarItem(item, pt);
    });
  }

  function soltarItem(item, pt) {
    if (item.tipo === 'oferta') {
      const alvo = celulaEm(pt);
      if (!alvo) { E.aviso('Solte a oferta sobre uma célula do grid.', 'err'); return; }
      colocarOferta(item.id, E.s.ui.pagina, alvo.celula.id);
      E.selecionar({ tipo: 'celula', id: alvo.celula.id, parte: 'celula' });
    } else if (item.tipo === 'componente') {
      const el = M.elementoComponente(item.comp);
      const alvo = item.comp.startsWith('selo') ? celulaEm(pt) : null;
      if (alvo) { el.celulaId = alvo.celula.id; el.x = Math.round(pt.x - alvo.rect.x); el.y = Math.round(pt.y - alvo.rect.y); }
      else { el.x = Math.round(pt.x); el.y = Math.round(pt.y); }
      E.alterar((p) => { p.paginas[E.s.ui.pagina].elementos.push(el); });
      E.selecionar({ tipo: 'elemento', id: el.id });
    } else if (item.tipo === 'imagem') {
      const s = Math.min(1, 1100 / item.w);
      const el = M.novoElemento('imagem', { nome: item.nome || 'Imagem', ref: item.ref, w: item.w * s, h: item.h * s, papel: item.papel || null });
      el.x = Math.round(pt.x - el.w / 2); el.y = Math.round(pt.y - el.h / 2);
      E.alterar((p) => { p.paginas[E.s.ui.pagina].elementos.push(el); });
      E.selecionar({ tipo: 'elemento', id: el.id });
    }
  }

  // Coloca uma oferta numa célula; se a oferta já estava em outra célula, troca as duas.
  function colocarOferta(ofertaId, paginaId, celulaId) {
    E.alterar((p) => {
      const destinoPag = p.paginas[paginaId];
      const destino = destinoPag.celulas.find((c) => c.id === celulaId);
      let origem = null;
      for (const pg of Object.values(p.paginas)) {
        const c = pg.celulas.find((x) => x.ofertaId === ofertaId);
        if (c) origem = c;
      }
      if (origem === destino) return false;
      const anterior = destino.ofertaId;
      if (origem) { origem.ofertaId = anterior || null; origem.ajustes = {}; }
      destino.ofertaId = ofertaId;
      destino.ajustes = {};
    });
  }

  // Exportação usa a mesma montagem, sem elementos do editor.
  function exportarCanvas(projeto, paginaId) {
    const div = document.createElement('div');
    const st = new Konva.Stage({ container: div, width: PAG.w, height: PAG.h });
    const ly = new Konva.Layer();
    st.add(ly);
    ly.add(montarPagina(projeto, paginaId, { editor: false }));
    ly.draw();
    const cv = st.toCanvas({ pixelRatio: 1 });
    st.destroy();
    return cv;
  }

  // Imagem da seleção para copiar (resolução de impressão). Imagens: o arquivo original; produto: o recorte sem fundo;
  // célula: a área dela no panfleto como aparece; demais itens: o próprio item renderizado, com fundo transparente.
  async function canvasDaSelecao(projeto, paginaId, sel) {
    if (!sel) return null;
    const pag = projeto.paginas[paginaId];
    const el = sel.tipo === 'elemento' ? pag.elementos.find((e) => e.id === sel.id) : null;
    if (el?.tipo === 'imagem') {
      const img = await NF.imagens.carregarRef(el.ref);
      const q = el.recorte || { e: 0, d: 0, c: 0, b: 0 };
      const W = img.naturalWidth, H = img.naturalHeight;
      const sx = Math.round((W * q.e) / 100), sy = Math.round((H * q.c) / 100);
      const cv = document.createElement('canvas');
      cv.width = Math.round(W * (1 - (q.e + q.d) / 100)); cv.height = Math.round(H * (1 - (q.c + q.b) / 100));
      cv.getContext('2d').drawImage(img, sx, sy, cv.width, cv.height, 0, 0, cv.width, cv.height);
      return cv;
    }
    const cel = sel.tipo === 'celula' ? pag.celulas.find((c) => c.id === sel.id) : null;
    if (sel.parte === 'produto') {
      const prod = projeto.ofertas.find((o) => o.id === cel?.ofertaId)?.produtos[sel.indice];
      if (!prod?.imagem) return null;
      await NF.imagens.carregarRef(`proj:${prod.imagem}`);
      return NF.imagens.obterProcessada(prod.imagem, prod.tolerancia, prod.recorte)?.canvas || null;
    }
    await NF.exportar.precarregar(projeto);
    if (sel.parte === 'celula') {
      const r = M.retangulos(pag).get(sel.id);
      if (!r) return null;
      const pagina = exportarCanvas(projeto, paginaId);
      const cv = document.createElement('canvas');
      cv.width = Math.round(r.w); cv.height = Math.round(r.h);
      cv.getContext('2d').drawImage(pagina, -Math.round(r.x), -Math.round(r.y));
      return cv;
    }
    const div = document.createElement('div');
    const st = new Konva.Stage({ container: div, width: PAG.w, height: PAG.h });
    const ly = new Konva.Layer();
    st.add(ly);
    const raiz = montarPagina(projeto, paginaId, { editor: false });
    ly.add(raiz);
    let n = null;
    if (el) n = el.tipo === 'grade' ? raiz.findOne('.grade') : raiz.findOne(`#${el.id}`);
    else if (sel.parte === 'nome' || sel.parte === 'etiqueta') n = raiz.findOne(`#${sel.id}`)?.findOne(`.${sel.parte}`);
    const cv = n ? n.toCanvas({ pixelRatio: 1 }) : null;
    st.destroy();
    return cv;
  }

  // Miniatura de um componente para a biblioteca.
  function previaComponente(comp, tamanho = 120) {
    const el = M.elementoComponente(comp);
    const div = document.createElement('div');
    const st = new Konva.Stage({ container: div, width: 10, height: 10 });
    const ly = new Konva.Layer();
    st.add(ly);
    const n = C.renderizar(el);
    ly.add(n);
    const r = n.getClientRect({ skipTransform: false });
    const s = Math.min(tamanho / Math.max(r.width, 1), (tamanho * 0.45) / Math.max(r.height, 1), 1);
    st.size({ width: Math.ceil(r.width * s) + 4, height: Math.ceil(r.height * s) + 4 });
    n.setAttrs({ x: -r.x * s + 2, y: -r.y * s + 2, scaleX: s, scaleY: s });
    ly.draw();
    const cv = st.toCanvas({ pixelRatio: 2 });
    cv.style.cssText = ''; // o Konva cria o canvas com position:absolute
    st.destroy();
    return cv;
  }

  return {
    iniciar, render: agendarRender, ajustarATela, alternarRecorte, cancelarRecorte, definirZoom, centralizarEm, colocarOferta, soltarItem, celulaEm,
    exportarCanvas, canvasDaSelecao, previaComponente, montarPagina, digitando, layoutCelula,
    zoomReal: () => definirZoom(1),
  };
})();
