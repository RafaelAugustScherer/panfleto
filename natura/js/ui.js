// Aplicação: menus, ferramentas, abas, painéis, barra de status, tela inicial e atalhos.
(() => {
  const { html, render, useState, useEffect, useRef, useReducer } = htmPreact;
  const E = NF.estado, M = NF.modelo;

  // Ao abrir uma pasta de trabalho: artes do usuário, fontes da pasta "fonts" e tipografia das ofertas.
  // Com o editor aberto e sem as fontes padrão, oferece instalá-las (uma vez por pasta em cada sessão da aba);
  // na tela inicial quem cuida disso é a configuração guiada.
  async function prepararPasta({ perguntarFontes = true } = {}) {
    await Promise.all([NF.artes.carregarDoUsuario().catch(() => {}), NF.fontes.carregarDaPasta(), NF.tipografia.carregar()]);
    E.notificar('fontes');
    if (!perguntarFontes) return;
    const chave = `nf-fontes-perguntado:${NF.arquivos.nomeRaiz()}`;
    let perguntado = false;
    try { perguntado = !!sessionStorage.getItem(chave); sessionStorage.setItem(chave, '1'); } catch { /* sem sessionStorage */ }
    if (NF.fontes.faltaObrigatoria() && !perguntado && !E.s.ui.dialogo) E.ui({ dialogo: { tipo: 'fontes' } });
  }

  // ---------- Ações ----------
  const acoes = {
    novo: () => E.ui({ dialogo: { tipo: 'novo' } }),
    sincronizar: () => E.s.projeto && E.ui({ dialogo: { tipo: 'sincronizar' } }),
    exportar: () => E.s.projeto && E.ui({ dialogo: { tipo: 'exportar' } }),
    salvarArte: () => E.s.projeto && E.ui({ dialogo: { tipo: 'salvar-arte' } }),
    fontes: () => E.ui({ dialogo: { tipo: 'fontes' } }),
    // Copia a seleção como PNG. O ClipboardItem recebe a promessa para não perder o gesto do usuário enquanto desenha.
    copiar: async () => {
      const sel = E.s.ui.selecao;
      if (!sel || !E.s.projeto) return;
      let vazia = false;
      const png = (async () => {
        const cv = await NF.cena.canvasDaSelecao(E.s.projeto, E.s.ui.pagina, sel);
        if (!cv) { vazia = true; throw new Error('sem imagem'); }
        return new Promise((r) => cv.toBlob(r, 'image/png'));
      })();
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
        E.aviso('Imagem copiada.');
      } catch (e) { E.aviso(vazia ? 'A seleção não tem imagem para copiar.' : `Não foi possível copiar: ${e.message}`, 'err'); }
    },
    // Substitui a imagem selecionada (elemento de imagem ou produto) pela imagem colada. Células, textos e selos não.
    colar: async (file) => {
      const sel = E.s.ui.selecao;
      if (!sel || !E.s.projeto) return;
      const pag = E.s.projeto.paginas[E.s.ui.pagina];
      const el = sel.tipo === 'elemento' ? pag.elementos.find((e) => e.id === sel.id) : null;
      const ofertaId = sel.parte === 'produto' ? pag.celulas.find((c) => c.id === sel.id)?.ofertaId : null;
      if (el?.tipo !== 'imagem' && !ofertaId) return E.aviso('Selecione uma imagem ou um produto para substituir.', 'err');
      if (!file) return E.aviso('A área de transferência não tem imagem.', 'err');
      try {
        if (ofertaId) await NF.ui.trocarImagemProduto(ofertaId, sel.indice, file);
        else await NF.ui.trocarImagemElemento(el.id, file);
        E.aviso('Imagem substituída.');
      } catch (e) { E.aviso(`Não foi possível substituir: ${e.message}`, 'err'); }
    },
    salvar: () => { E.salvarAgora(); E.aviso('Panfleto salvo.'); },
    fechar: () => { E.salvarAgora(); E.s.projeto = null; E.notificar('projeto'); },
    trocarPasta: async () => { try { await NF.arquivos.escolherPasta(); E.s.projeto = null; await prepararPasta(); E.notificar('projeto'); } catch { /* cancelado */ } },
    desfazer: () => E.voltar(),
    refazer: () => E.avancar(),
    excluir: () => {
      const sel = E.s.ui.selecao;
      if (sel?.tipo !== 'elemento') return;
      const el = E.elemento(sel.id);
      if (!el || el.tipo === 'grade') return;
      E.alterar((p) => {
        const pg = p.paginas[E.s.ui.pagina], i = pg.elementos.findIndex((x) => x.id === sel.id);
        NF.sincronizar.seloApagado(p, pg, pg.elementos[i]);
        pg.elementos.splice(i, 1);
      });
      E.selecionar(null);
    },
    duplicar: () => {
      const sel = E.s.ui.selecao;
      if (sel?.tipo !== 'elemento') return;
      const el = E.elemento(sel.id);
      if (!el || el.tipo === 'grade') return;
      const copia = { ...NF.util.clone(el), id: NF.util.uid('el'), x: el.x + 40, y: el.y + 40, bloqueado: false, nome: `${el.nome || ''} (cópia)` };
      E.alterar((p) => { const a = p.paginas[E.s.ui.pagina].elementos; a.splice(a.findIndex((x) => x.id === sel.id) + 1, 0, copia); });
      E.selecionar({ tipo: 'elemento', id: copia.id });
    },
    mover: (dx, dy) => {
      const sel = E.s.ui.selecao;
      if (sel?.tipo === 'elemento') {
        E.alterar((p) => { const el = p.paginas[E.s.ui.pagina].elementos.find((x) => x.id === sel.id); if (!el || el.bloqueado) return false; el.x += dx; el.y += dy; });
      } else if (sel?.tipo === 'celula' && sel.parte !== 'celula') {
        E.alterar((p) => {
          const cel = p.paginas[E.s.ui.pagina].celulas.find((c) => c.id === sel.id);
          if (sel.parte === 'produto') { const pr = p.ofertas.find((o) => o.id === cel.ofertaId)?.produtos[sel.indice]; if (!pr) return false; pr.dx += dx; pr.dy += dy; return; }
          const k = sel.parte === 'nome' ? 'nome' : 'preco';
          cel.ajustes = cel.ajustes || {};
          const a = cel.ajustes[k] || { x: 0, y: 0, escala: 1 };
          cel.ajustes[k] = { ...a, x: a.x + dx, y: a.y + dy };
        });
      }
    },
  };
  NF.ui.acoes = acoes;

  // ---------- Ícones (traço simples) ----------
  const I = {
    mover: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M5 3l13 7-6 1.6L9.5 18z"/></svg>`,
    mao: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-7.5V4a1.5 1.5 0 013 0v8m0-6.5a1.5 1.5 0 013 0V13m0-4.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.5a6 6 0 01-4.8-2.4L4.6 15a1.6 1.6 0 012.4-2.1L8 14"/></svg>`,
    zoom: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8 10.5h5M10.5 8v5"/></svg>`,
    recortar: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14"/></svg>`,
    ajustar: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`,
    desfazer: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>`,
    corte: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2"><rect x="5" y="4" width="14" height="16" rx="0.5"/></svg>`,
    refazer: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/></svg>`,
  };

  // ---------- Menus ----------
  function Menu({ rotulo, itens, aberto, setAberto }) {
    const id = rotulo;
    return html`<div class=${`menu ${aberto === id ? 'open' : ''}`}>
      <button onMouseDown=${(e) => { e.stopPropagation(); setAberto(aberto === id ? null : id); }} onMouseEnter=${() => aberto && setAberto(id)}>${rotulo}</button>
      ${aberto === id && html`<div class="menu-list" onMouseDown=${(e) => e.stopPropagation()}>
        ${itens.map((it) => (it === '-' ? html`<hr />` : html`<button disabled=${it.desativado} onClick=${() => { setAberto(null); it.acao(); }}><span>${it.rotulo}</span>${it.atalho && html`<kbd>${it.atalho}</kbd>`}</button>`))}
      </div>`}</div>`;
  }

  function BarraMenus() {
    const [aberto, setAberto] = useState(null);
    useEffect(() => { const f = () => setAberto(null); window.addEventListener('mousedown', f); return () => window.removeEventListener('mousedown', f); }, []);
    const tem = !!E.s.projeto;
    const p = { aberto, setAberto };
    return html`<div class="menubar">
      <span class="brand"><i></i>Panfletos</span>
      <${Menu} rotulo="Arquivo" ...${p} itens=${[
        { rotulo: 'Novo panfleto…', atalho: 'Ctrl+N', acao: acoes.novo },
        { rotulo: 'Abrir outro panfleto…', acao: acoes.fechar, desativado: !tem },
        { rotulo: 'Salvar', atalho: 'Ctrl+S', acao: acoes.salvar, desativado: !tem },
        '-',
        { rotulo: 'Exportar PNG…', atalho: 'Ctrl+E', acao: acoes.exportar, desativado: !tem },
        '-',
        { rotulo: 'Instalar fontes…', acao: acoes.fontes },
        { rotulo: 'Tipografia das ofertas…', acao: () => window.open('playground.html', '_blank') },
        { rotulo: 'Trocar pasta de trabalho…', acao: acoes.trocarPasta },
      ]} />
      <${Menu} rotulo="Exibir" ...${p} itens=${[
        { rotulo: 'Tamanho real (100%)', atalho: 'Ctrl+1', acao: () => NF.cena.zoomReal(), desativado: !tem },
        { rotulo: 'Aproximar', atalho: 'Ctrl++', acao: () => NF.cena.definirZoom(E.s.ui.zoom * 1.25), desativado: !tem },
        { rotulo: 'Afastar', atalho: 'Ctrl+-', acao: () => NF.cena.definirZoom(E.s.ui.zoom / 1.25), desativado: !tem },
      ]} />
      <div class="menu"><button class="verde" onClick=${acoes.sincronizar} disabled=${!tem}>Sincronizar planilha</button></div>
    </div>`;
  }

  function Ferramentas() {
    const f = E.s.ui.ferramenta;
    const b = (id, icone, titulo) => html`<button class=${`tool ${f === id ? 'on' : ''}`} title=${titulo} aria-label=${titulo} onClick=${() => E.ui({ ferramenta: id })}>${icone}</button>`;
    return html`<div class="toolbar">
      ${b('mover', I.mover, 'Mover (V)')}${b('mao', I.mao, 'Mão (H) — ou segure Espaço')}${b('zoom', I.zoom, 'Zoom (Z) — Alt+clique afasta')}
      <button class=${`tool ${E.s.ui.recorte ? 'on' : ''}`} title="Recortar a imagem ou o produto selecionado (C)" aria-label="Recortar"
        aria-pressed=${!!E.s.ui.recorte} onClick=${NF.cena.alternarRecorte}>${I.recortar}</button>
      <div class="sep"></div>
      <button class="tool" title="Ajustar à tela (Ctrl+0)" aria-label="Ajustar à tela" onClick=${() => NF.cena.ajustarATela()}>${I.ajustar}</button>
      <button class="tool" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled=${!E.podeDesfazer()} onClick=${acoes.desfazer}>${I.desfazer}</button>
      <button class="tool" title="Refazer (Ctrl+Y)" aria-label="Refazer" disabled=${!E.podeRefazer()} onClick=${acoes.refazer}>${I.refazer}</button>
      <div class="sep"></div>
      <button class=${`tool ${E.s.ui.mostrarGuias ? 'on' : ''}`} title="Linha de corte" aria-label="Linha de corte" aria-pressed=${!!E.s.ui.mostrarGuias} onClick=${() => E.ui({ mostrarGuias: !E.s.ui.mostrarGuias })}>${I.corte}</button>
    </div>`;
  }

  function Viewport() {
    const ref = useRef();
    useEffect(() => { NF.cena.iniciar(ref.current); }, []);
    return html`<div class="viewport" ref=${ref}></div>`;
  }

  function Abas() {
    return html`<div class="tabs">
      ${['frente', 'verso'].map((id) => html`<button class=${`tab ${E.s.ui.pagina === id ? 'on' : ''}`} onClick=${() => { E.ui({ pagina: id, selecao: null }); }}>${E.s.projeto.paginas[id].nome}</button>`)}
    </div>`;
  }

  function Dock() {
    const sup = E.s.ui.painelSup, inf = E.s.ui.painelInf;
    const aba = (grupo, id, rotulo) => html`<button class=${E.s.ui[grupo] === id ? 'on' : ''} onClick=${() => E.ui({ [grupo]: id })}>${rotulo}</button>`;
    const naoAlocadas = E.s.projeto.ofertas.filter((o) => !M.localizarOferta(E.s.projeto, o.id)).length;
    return html`<div class="dock">
      <div class="dock-section"><div class="dock-tabs">${aba('painelSup', 'propriedades', 'Propriedades')}${aba('painelSup', 'camadas', 'Camadas')}</div>
        <div class="dock-body">${sup === 'propriedades' ? html`<${NF.ui.Propriedades} />` : html`<${NF.ui.Camadas} />`}</div></div>
      <div class="dock-section"><div class="dock-tabs">${aba('painelInf', 'componentes', 'Componentes')}${aba('painelInf', 'artes', 'Artes')}${aba('painelInf', 'ofertas', `Ofertas${naoAlocadas ? ` (${naoAlocadas})` : ''}`)}</div>
        <div class="dock-body">${inf === 'componentes' ? html`<${NF.ui.Componentes} />` : inf === 'artes' ? html`<${NF.ui.Artes} />` : html`<${NF.ui.Ofertas} />`}</div></div>
    </div>`;
  }

  function Status() {
    const s = E.s;
    const t = s.ui.tarefa;
    const salvo = { salvo: ['saved', 'Salvo'], pendente: ['dirty', 'Alterações não salvas'], salvando: ['dirty', 'Salvando…'], erro: ['err', `Erro ao salvar: ${s.erroSalvar}`] }[s.salvo];
    return html`<div class="statusbar">
      ${t && html`<span style="display:flex;gap:8px;align-items:center">${t.texto}<span class="progress" style="width:120px"><i style=${`width:${t.progresso * 100}%`}></i></span></span>`}
      <span class="grow"></span>
      ${NF.fontes.faltaObrigatoria() && html`<span class="err">Fontes não instaladas</span>`}
      <span class=${salvo[0]}>${salvo[1]}</span>
    </div>`;
  }

  // ---------- Tela inicial ----------
  // Até existir o primeiro panfleto, a tela inicial é uma configuração guiada: pasta de trabalho, baixar as fontes
  // no SharePoint, instalar as fontes e criar o panfleto. Cada passo conclui pelo estado real (pasta aberta, fontes
  // na pasta, panfletos na lista), então reabrir o editor continua de onde parou.
  const PASSOS = [['pasta', 'Pasta de trabalho'], ['baixar', 'Baixar as fontes'], ['instalar', 'Instalar as fontes'], ['panfleto', 'Primeiro panfleto']];

  function Inicio({ situacao, setSituacao }) {
    const [lista, setLista] = useState(null);
    const [erro, setErro] = useState('');
    const [baixou, setBaixou] = useState(false);
    const [ver, setVer] = useState(null); // passo aberto à mão (voltar a um passo concluído)
    useEffect(() => {
      setLista(null);
      if (situacao === 'ok') NF.arquivos.listarPanfletos().then(setLista).catch((e) => setErro(e.message));
    }, [situacao]);

    const pronta = async () => { await prepararPasta({ perguntarFontes: false }); setVer(null); setSituacao('ok'); };
    const escolher = async () => {
      setErro('');
      try { await NF.arquivos.escolherPasta(); await pronta(); } catch (e) {
        // AbortError vem tanto do "Cancelar" quanto de um navegador que recusa a permissão de gravar na pasta
        // (o painel embutido do app Claude faz isso): explica em vez de ficar em silêncio.
        if (e.name !== 'AbortError') setErro(e.message);
        else setErro(`A pasta não foi aberta. Se você escolheu uma pasta e confirmou, este navegador não deu permissão para gravar nela. Abra o editor no Google Chrome ou no Microsoft Edge (${location.href.split('#')[0]}) e escolha a pasta lá.`);
      }
    };
    const permitir = async () => { if (await NF.arquivos.pedirPermissao()) await pronta(); };
    const abrir = async (slug) => {
      try {
        const p = await NF.arquivos.abrirPanfleto(slug);
        E.carregar(p);
        setTimeout(() => NF.cena.ajustarATela(), 30);
      } catch (e) { setErro(`Não foi possível abrir: ${e.message}`); }
    };
    const cartao = (conteudo, classe = '') => html`<div class="welcome"><div class=${`card ${classe}`}><h1>Editor de Panfletos Natura</h1>${conteudo}${erro && html`<p class="err-text">${erro}</p>`}</div></div>`;

    if (!NF.arquivos.suportado) {
      return cartao(html`<p class="err-text">Este navegador não permite gravar em pastas. Abra o editor no Google Chrome ou no Microsoft Edge.</p>`);
    }
    const pastaOk = situacao === 'ok';
    const fontesOk = pastaOk && !NF.fontes.faltaObrigatoria();
    if (pastaOk && lista === null) return cartao(html`<p class="hint">Abrindo a pasta…</p>`);
    const temPanfleto = pastaOk && lista.length > 0;

    // Configuração concluída: lista dos panfletos.
    if (temPanfleto && fontesOk) {
      return cartao(html`<p>Pasta de trabalho: <b>${NF.arquivos.nomeRaiz()}</b> · <a href="#" onClick=${(e) => { e.preventDefault(); escolher(); }} style="color:var(--accent)">trocar</a></p>
        <div class="btns"><button class="btn primary" onClick=${acoes.novo}>Novo panfleto</button></div>
        <div class="projects">${lista.map((p) => html`<div class="proj" onClick=${() => abrir(p.slug)} role="button" tabindex="0" onKeyDown=${(e) => e.key === 'Enter' && abrir(p.slug)}>
          <span><b>${p.nome}</b><br/><small>panfletos/${p.slug}</small></span><small>${new Date(p.modificado).toLocaleString('pt-BR')}</small></div>`)}</div>`);
    }

    const feito = { pasta: pastaOk, baixar: fontesOk || baixou, instalar: fontesOk, panfleto: temPanfleto };
    const pendente = PASSOS.find(([id]) => !feito[id])?.[0] || 'panfleto';
    const atual = ver || pendente;
    const ir = (id) => setVer(id === pendente ? null : id);
    const voltar = (id) => html`<button class="btn" onClick=${() => ir(id)}>Voltar</button>`;
    const indice = PASSOS.findIndex(([id]) => id === atual);
    // Um passo só abre quando os anteriores estão concluídos (ou é o próximo pendente).
    const alcancavel = (i) => PASSOS.slice(0, i).every(([id]) => feito[id]);

    let corpo;
    if (atual === 'pasta') {
      corpo = html`<h2>Onde guardar o trabalho</h2>
        <p>Escolha uma pasta no computador (por exemplo, <b>Documentos\\Natura</b>). O editor cria nela a subpasta <b>panfletos</b>, com uma pasta para cada panfleto, e a subpasta <b>fonts</b>, com as fontes.</p>
        ${situacao === 'permissao' ? html`<p>O navegador precisa da sua confirmação para continuar usando a pasta <b>${NF.arquivos.nomeRaiz()}</b>.</p>
          <div class="btns"><button class="btn primary" onClick=${permitir}>Continuar com ${NF.arquivos.nomeRaiz()}</button><button class="btn" onClick=${escolher}>Escolher outra pasta</button></div>`
        : pastaOk ? html`<p class="ok-text">✓ Pasta escolhida: <b>${NF.arquivos.nomeRaiz()}</b></p>
          <div class="btns"><button class="btn primary" onClick=${() => setVer(null)}>Continuar</button><button class="btn" onClick=${escolher}>Escolher outra pasta</button></div>`
        : html`<div class="btns"><button class="btn primary" onClick=${escolher}>Escolher pasta</button></div>
          <p class="hint">O navegador pergunta se o editor pode ver e editar a pasta: confirme as duas perguntas.</p>`}`;
    } else if (atual === 'baixar') {
      corpo = html`<h2>Baixe as fontes no SharePoint da Natura</h2>
        <p>Os textos do panfleto usam as fontes da campanha (Helvetica Now Display e Natura Display). Elas são licenciadas e ficam no <a href=${NF.ui.URL_FONTES} target="_blank" rel="noopener" style="color:var(--accent)">SharePoint da Natura</a>; entre com a sua conta Natura se o SharePoint pedir.</p>
        <ol class="guia-lista">
          <li>Abra a pasta <b>Document fonts</b> no SharePoint (abre em outra aba).</li>
          <li>Marque a caixa ao lado de <b>Nome</b> para selecionar todos os arquivos e desmarque <b>AdobeFnt23.lst</b>, que não é uma fonte.</li>
          <li>Clique em <b>Baixar</b>. O navegador salva um arquivo <b>.zip</b> (OneDrive_….zip) em Downloads. Não precisa extrair.</li>
        </ol>
        <video class="guia-video" src="img/fontes-sharepoint.mp4" autoplay loop muted playsinline aria-label="No SharePoint: marcar a caixa ao lado de Nome, desmarcar AdobeFnt23.lst e clicar em Baixar"></video>
        <div class="btns"><a class="btn verde" href=${NF.ui.URL_FONTES} target="_blank" rel="noopener">Abrir o SharePoint</a>
          <button class="btn primary" onClick=${() => { setBaixou(true); setVer('instalar'); }}>Já baixei o .zip</button>
          ${voltar('pasta')}</div>`;
    } else if (atual === 'instalar') {
      corpo = html`<h2>Instale as fontes na pasta de trabalho</h2>
        <p>Solte abaixo o .zip baixado do SharePoint. O editor copia as fontes para <b>${NF.arquivos.nomeRaiz()}/fonts</b>; isso só é preciso uma vez.</p>
        <${NF.ui.PainelFontes} />
        <div class="btns" style="margin-top:12px">${fontesOk && html`<button class="btn primary" onClick=${() => setVer(null)}>Continuar</button>`}${voltar('baixar')}</div>`;
    } else {
      corpo = html`<h2>Crie o primeiro panfleto</h2>
        <p>Tudo pronto. No próximo passo você informa o nome do panfleto, a validade, a arte da campanha e a grade de ofertas de cada lado; depois o editor lê a planilha de ofertas.</p>
        <div class="btns"><button class="btn primary" onClick=${acoes.novo}>Criar o primeiro panfleto</button>${voltar('instalar')}</div>`;
    }
    return cartao(html`
      <p>Configuração inicial: quatro passos até o primeiro panfleto.</p>
      <ol class="passos">${PASSOS.map(([id, nome], i) => html`<li key=${id}>
        <button class=${`passo ${feito[id] ? 'feito' : ''} ${i === indice ? 'atual' : ''}`} disabled=${!alcancavel(i)} aria-current=${i === indice ? 'step' : null}
          onClick=${() => ir(id)}><span class="n">${feito[id] ? '✓' : i + 1}</span>${nome}</button></li>`)}</ol>
      ${corpo}`, 'guia');
  }

  // ---------- App ----------
  function App() {
    const [, forcar] = useReducer((x) => x + 1, 0);
    const [situacao, setSituacao] = useState(null);
    useEffect(() => E.assinar((m) => { if (m !== 'zoom' || true) forcar(); }), []);
    useEffect(() => { (async () => {
      if (!NF.arquivos.suportado) { setSituacao('nenhuma'); return; }
      const st = await NF.arquivos.restaurarPasta();
      if (st === 'ok') await prepararPasta({ perguntarFontes: false });
      setSituacao(st);
    })(); }, []);
    if (situacao === null) return null;
    const toast = E.s.ui.toast;
    return html`
      ${E.s.projeto ? html`<div class="app">
        <${BarraMenus} /><${Ferramentas} />
        <div class="main"><${Abas} /><${Viewport} /></div>
        <${Dock} /><${Status} />
      </div>` : html`<${Inicio} situacao=${situacao} setSituacao=${setSituacao} />`}
      <${NF.ui.Dialogos} />
      ${toast && html`<div class=${`toast ${toast.tipo === 'err' ? 'err' : ''}`} role="status">${toast.texto}</div>`}`;
  }

  // ---------- Atalhos ----------
  // O zoom do navegador nunca entra em ação: Ctrl+roda (e o gesto de pinça) fora da área de trabalho ou
  // Ctrl+=/-/0 com o foco num campo cairiam no navegador. Na fase de captura, antes dos atalhos do editor.
  window.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false, capture: true });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['=', '+', '-', '_', '0'].includes(e.key)) e.preventDefault();
  }, true);
  window.addEventListener('keydown', (e) => {
    if (!E.s.projeto || E.s.ui.dialogo) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (ctrl && k === 's') { e.preventDefault(); acoes.salvar(); return; }
    if (ctrl && k === 'e') { e.preventDefault(); acoes.exportar(); return; }
    if (ctrl && k === 'n') { e.preventDefault(); acoes.novo(); return; }
    if (NF.cena.digitando(e)) return;
    if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); acoes.desfazer(); }
    else if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); acoes.refazer(); }
    else if (ctrl && k === 'd') { e.preventDefault(); acoes.duplicar(); }
    else if (ctrl && k === 'c' && E.s.ui.selecao && !String(window.getSelection())) { e.preventDefault(); acoes.copiar(); }
    else if (ctrl && k === '0') { e.preventDefault(); NF.cena.ajustarATela(); }
    else if (ctrl && k === '1') { e.preventDefault(); NF.cena.zoomReal(); }
    else if (ctrl && (k === '=' || k === '+')) { e.preventDefault(); NF.cena.definirZoom(E.s.ui.zoom * 1.25); }
    else if (ctrl && k === '-') { e.preventDefault(); NF.cena.definirZoom(E.s.ui.zoom / 1.25); }
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); acoes.excluir(); }
    else if (k === 'escape') E.selecionar(null);
    else if (k === 'v') E.ui({ ferramenta: 'mover' });
    else if (k === 'h') E.ui({ ferramenta: 'mao' });
    else if (k === 'z') E.ui({ ferramenta: 'zoom' });
    else if (k === 'c' && !ctrl) NF.cena.alternarRecorte();
    else if (k.startsWith('arrow')) {
      e.preventDefault();
      const d = e.shiftKey ? 20 : 2;
      acoes.mover(k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0);
    }
  });
  // Ctrl+V: o evento paste entrega a imagem sem pedir permissão de leitura da área de transferência.
  // Campos de texto recebem a colagem normalmente.
  const recebeTexto = (t) => t.isContentEditable || t.tagName === 'TEXTAREA'
    || (t.tagName === 'INPUT' && /^(text|number|search|url|email|tel|password)$/.test(t.type));
  window.addEventListener('paste', (e) => {
    if (!E.s.projeto || E.s.ui.dialogo || !E.s.ui.selecao || recebeTexto(e.target)) return;
    e.preventDefault();
    acoes.colar([...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/')));
  });
  // Ao sair, só grava se houver alterações pendentes: uma gravação interrompida pelo fechamento da aba pode perder o projeto.json.
  // Nesse caso o navegador pergunta antes de sair, o que dá tempo de a gravação terminar.
  // O playground de tipografia avisa quando grava uma nova configuração.
  try {
    new BroadcastChannel('nf-editor').onmessage = async (m) => {
      if (m.data === 'tipografia') { await NF.tipografia.carregar(); E.notificar('fontes'); }
    };
  } catch { /* sem BroadcastChannel */ }
  window.addEventListener('beforeunload', (e) => {
    if (E.s.salvo !== 'pendente' && E.s.salvo !== 'salvando') return;
    if (E.s.salvo === 'pendente') E.salvarAgora();
    e.preventDefault();
    e.returnValue = '';
  });

  render(html`<${App} />`, document.getElementById('app'));
})();
