// Playground de tipografia: compara até 3 variações de fonte, tamanho e peso do nome, da quantidade, do "ou"
// e da etiqueta de preço em ofertas de teste, desenhadas pelo mesmo código do editor.
// "Usar no editor" grava a variação em <pasta de trabalho>/tipografia.json.
(() => {
  const { html, render, useState, useEffect, useRef, useMemo } = htmPreact;
  const M = NF.modelo, T = NF.tipografia;
  const MAX = 3;

  // Casos que cobrem os extremos: nomes curtos e longos (até o mínimo), com e sem quantidade, "ou",
  // sem valor De e preço de 4 dígitos.
  const CASOS = [
    { nome: 'Kaiak Clássico ou Aventura Masculino', de: '189,90', por: '132,93', sufixo: 'cada', mostrarOu: true, codigos: ['108400', '108402'] },
    { nome: 'Luna Radiante, Liberdade ou Coragem', de: '185,90', por: '111,54', sufixo: 'cada', mostrarOu: false, codigos: ['44452', '115463', '169776'] },
    { nome: 'Hidratante Algodão, Amora Vermelha, Maçã Caramelada', complemento: '400ml', de: '78,90', por: '47,34', sufixo: 'cada', mostrarOu: false, codigos: ['2816', '88103'] },
    { nome: 'Body Splash Tâmara e Canela, Romã e Flor de Amora, Maçã Caramelada', complemento: '200ml', de: '96,00', por: '59,90', sufixo: 'cada', mostrarOu: false, codigos: ['2795', '135050'] },
    { nome: 'Kriska Shok', de: '169,90', por: '99,90', codigos: ['68944'] },
    { nome: 'Una Clássico Blush', complemento: '75ml', de: '329,90', por: '230,93', codigos: ['2446', '128756'] },
    { nome: 'Creme de Mãos Essencial Clássico', por: '24,75', codigos: ['108939'] },
    { nome: 'Kit Essencial Masculino Sentir Supreme', de: '1279,90', por: '1181,94', codigos: ['167755', '95560'] },
  ];

  function projetoTeste(grade) {
    const pagina = M.novaPagina('frente', 'Frente', { ...M.MODELOS_GRADE[grade], removidas: [], spans: {} });
    pagina.elementos.push(M.novoElemento('grade', { nome: 'Ofertas (grade)' }));
    const ofertas = CASOS.map((c) => {
      const o = M.novaOferta(c);
      o.produtos.forEach((p) => { p.imagem = NF.imagens.URL_NATURA(p.codigo, 1); });
      return o;
    });
    const vagas = M.celulasVisiveis(pagina);
    ofertas.forEach((o, i) => { if (vagas[i]) vagas[i].ofertaId = o.id; });
    return { tema: NF.util.clone(M.TEMA_PADRAO), ofertas, paginas: { frente: pagina } };
  }

  // Desenha a página de teste com a variação e recorta a área das células ocupadas.
  function desenhar(cfg, proj) {
    const anterior = T.atual();
    T.usar(cfg);
    try {
      const pagina = NF.cena.exportarCanvas(proj, 'frente');
      const pg = proj.paginas.frente;
      const rects = M.retangulos(pg);
      const rs = M.celulasVisiveis(pg).filter((c) => c.ofertaId).map((c) => rects.get(c.id));
      const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
      const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
      const cv = document.createElement('canvas');
      cv.width = Math.round(x1 - x0); cv.height = Math.round(y1 - y0);
      cv.getContext('2d').drawImage(pagina, -Math.round(x0), -Math.round(y0));
      return cv;
    } finally { T.usar(anterior); }
  }

  // Com zoom, as prévias rolam juntas para comparar o mesmo trecho em todas as variações.
  const rolarJuntas = (e) => {
    for (const o of document.querySelectorAll('.pg-previa')) {
      if (o !== e.currentTarget) { o.scrollLeft = e.currentTarget.scrollLeft; o.scrollTop = e.currentTarget.scrollTop; }
    }
  };

  function Previa({ cfg, proj, versao, zoom }) {
    const ref = useRef();
    useEffect(() => {
      const t = setTimeout(() => {
        const cv = desenhar(cfg, proj);
        cv.style.setProperty('--w', `${cv.width}px`);
        ref.current.replaceChildren(cv);
      }, 120);
      return () => clearTimeout(t);
    }, [cfg, proj, versao]);
    return html`<div class=${`pg-previa ${zoom === 'ajustar' ? '' : 'zoom'}`} style=${zoom === 'ajustar' ? '' : `--zoom:${zoom}`} ref=${ref} onScroll=${rolarJuntas}></div>`;
  }

  // ---------- Controles ----------
  const PARTES = [
    ['deRotulo', '"de R$"'], ['deInteiro', 'De (inteiro)'], ['deCentavos', 'De (centavos)'], ['porRotulo', '"por"'],
    ['moeda', '"R$"'], ['porInteiro', 'Por (inteiro)'], ['porCentavos', 'Por (centavos)'], ['sufixo', '"cada"'],
  ];

  function Familia({ valor, onValor }) {
    const ops = NF.fontes.opcoesFamilia();
    const lista = ops.some(([v]) => v === valor) ? ops : [[valor, `${valor} (não está na pasta)`], ...ops];
    return html`<select value=${valor} onChange=${(e) => onValor(e.target.value)}>${lista.map(([v, t]) => html`<option value=${v}>${t}</option>`)}</select>`;
  }

  function Peso({ familia, valor, onValor }) {
    const ops = NF.fontes.opcoesPeso(familia);
    const lista = ops.some(([v]) => Number(v) === valor) ? ops : [[String(valor), `${valor} (indisponível)`], ...ops];
    return html`<select value=${String(valor)} onChange=${(e) => onValor(Number(e.target.value))}>${lista.map(([v, t]) => html`<option value=${v}>${t}</option>`)}</select>`;
  }

  const Num = ({ valor, onValor, passo = 1, min, max, rotulo }) => html`<input type="number" aria-label=${rotulo} value=${valor} step=${passo} min=${min} max=${max}
    onInput=${(e) => e.target.value !== '' && !Number.isNaN(Number(e.target.value)) && onValor(Number(e.target.value))} />`;

  function Variacao({ letra, cfg, emUso, proj, versao, zoom, onMudar, onDuplicar, onRemover, onUsar, gravando }) {
    // onMudar recebe uma função da configuração atual: alterações seguidas não se perdem.
    const set = (sec, campo, v) => onMudar((c) => ({ ...c, [sec]: { ...c[sec], [campo]: v } }));
    // Trocar a família leva os pesos que dependem dela para o mais próximo disponível.
    const familia = (sec, fam, pesos) => {
      const disp = NF.fontes.opcoesPeso(fam).map(([v]) => Number(v));
      const perto = (p) => disp.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a), disp[0]);
      onMudar((c) => {
        const novo = { ...c, [sec]: { ...c[sec], fonte: fam } };
        for (const k of pesos) novo[k] = { ...novo[k], peso: perto(novo[k].peso) };
        return novo;
      });
    };
    const fEt = cfg.etiqueta.fonte, fNome = cfg.nome.fonte;
    return html`<section class=${`pg-var ${emUso ? 'em-uso' : ''}`}>
      <header><b>Variação ${letra}</b>${emUso && html`<span class="tag-uso">✓ em uso no editor</span>`}<span class="grow"></span>
        ${onDuplicar && html`<button class="btn small" onClick=${onDuplicar}>Duplicar</button>`}
        ${onRemover && html`<button class="btn small" onClick=${onRemover}>Remover</button>`}
        <button class="btn small primary" disabled=${emUso || gravando} onClick=${onUsar}>Usar no editor</button></header>
      <${Previa} cfg=${cfg} proj=${proj} versao=${versao} zoom=${zoom} />
      <div class="pg-ctrl">
        <div class="pg-sec"><h3>Nome</h3>
          <div class="pg-lin c2"><label>Fonte</label><${Familia} valor=${fNome} onValor=${(v) => familia('nome', v, ['nome', 'quantidade'])} /></div>
          <div class="pg-lin"><label>Tamanho / peso</label><${Num} rotulo="Tamanho do nome" valor=${cfg.nome.tamanho} min="10" max="120" onValor=${(v) => set('nome', 'tamanho', v)} />
            <${Peso} familia=${fNome} valor=${cfg.nome.peso} onValor=${(v) => set('nome', 'peso', v)} /></div>
          <div class="pg-lin"><label>Mínimo / entrelinha</label><${Num} rotulo="Tamanho mínimo do nome" valor=${cfg.nome.minimo} min="10" max="120" onValor=${(v) => set('nome', 'minimo', v)} />
            <${Num} rotulo="Entrelinha do nome" valor=${cfg.nome.entrelinha} passo="0.01" min="0.8" max="2" onValor=${(v) => set('nome', 'entrelinha', v)} /></div>
          <div class="pg-lin"><label>Quantidade</label><${Peso} familia=${fNome} valor=${cfg.quantidade.peso} onValor=${(v) => set('quantidade', 'peso', v)} />
            <${Num} rotulo="Espaçamento da quantidade" valor=${cfg.quantidade.espaco} passo="0.5" min="-5" max="10" onValor=${(v) => set('quantidade', 'espaco', v)} /></div>
        </div>
        <div class="pg-sec"><h3>Etiqueta de preço</h3>
          <div class="pg-lin c2"><label>Fonte</label><${Familia} valor=${fEt} onValor=${(v) => familia('etiqueta', v, PARTES.map(([k]) => k))} /></div>
          ${PARTES.map(([k, rot]) => html`<div class="pg-lin"><label>${rot}</label>
            <${Num} rotulo=${`Tamanho ${rot}`} valor=${cfg[k].tamanho} min="8" max="200" onValor=${(v) => set(k, 'tamanho', v)} />
            <${Peso} familia=${fEt} valor=${cfg[k].peso} onValor=${(v) => set(k, 'peso', v)} /></div>`)}
          <div class="pg-lin c2"><label>Espaço do preço</label><${Num} rotulo="Espaçamento do preço" valor=${cfg.porInteiro.espaco} passo="0.5" min="-10" max="10" onValor=${(v) => set('porInteiro', 'espaco', v)} /></div>
        </div>
        <div class="pg-sec"><h3>"ou"</h3>
          <div class="pg-lin"><label>Fonte / peso</label><${Familia} valor=${cfg.ou.fonte} onValor=${(v) => familia('ou', v, ['ou'])} />
            <${Peso} familia=${cfg.ou.fonte} valor=${cfg.ou.peso} onValor=${(v) => set('ou', 'peso', v)} /></div>
        </div>
        <div class="btns"><button class="btn small" onClick=${() => onMudar(() => T.mesclar(null))}>Voltar ao padrão original</button></div>
      </div>
    </section>`;
  }

  // ---------- Página ----------
  function App() {
    const [situacao, setSituacao] = useState('carregando');
    const [variacoes, setVariacoes] = useState([]);
    const [emUso, setEmUso] = useState('');
    const [grade, setGrade] = useState('3x4');
    const [zoom, setZoom] = useState('ajustar');
    const [versao, setVersao] = useState(0);
    const [gravando, setGravando] = useState(false);
    const [erro, setErro] = useState('');
    const proj = useMemo(() => projetoTeste(grade), [grade]);

    const preparar = async () => {
      await NF.fontes.carregarDaPasta();
      const atual = await T.carregar();
      setVariacoes([atual]);
      setEmUso(JSON.stringify(atual));
      setSituacao('ok');
    };
    useEffect(() => {
      // Fotos carregadas e recortadas: desenha de novo.
      NF.imagens.eventos.on((r) => { if (r === 'processar') setVersao((v) => v + 1); });
      (async () => {
        const st = NF.arquivos.suportado ? await NF.arquivos.restaurarPasta() : 'nenhuma';
        if (st === 'ok') await preparar(); else setSituacao(st);
      })();
    }, []);

    const usar = async (cfg) => {
      setGravando(true); setErro('');
      try { await T.salvar(cfg); setEmUso(JSON.stringify(T.atual())); } catch (e) { setErro(`Não foi possível gravar: ${e.message}`); }
      setGravando(false);
    };
    const mudar = (i, f) => setVariacoes((vs) => vs.map((v, j) => (j === i ? f(v) : v)));

    if (situacao === 'carregando') return null;
    if (situacao === 'nenhuma') return html`<div class="pg-msg">Abra o editor e escolha a pasta de trabalho primeiro.</div>`;
    if (situacao === 'permissao') {
      return html`<div class="pg-msg"><button class="btn primary" onClick=${async () => { if (await NF.arquivos.pedirPermissao()) await preparar(); }}>Continuar com ${NF.arquivos.nomeRaiz()}</button></div>`;
    }
    return html`<div class="pg">
      <div class="pg-topo"><h1>Tipografia das ofertas</h1>
        <div class="seg"><button class=${grade === '3x3' ? 'on' : ''} onClick=${() => setGrade('3x3')}>3×3</button><button class=${grade === '3x4' ? 'on' : ''} onClick=${() => setGrade('3x4')}>3×4</button></div>
        <div class="seg">${[['ajustar', 'Ajustar'], [0.5, '50%'], [1, '100%']].map(([z, t]) => html`<button class=${zoom === z ? 'on' : ''} onClick=${() => setZoom(z)}>${t}</button>`)}</div>
        ${erro && html`<span class="err-text">${erro}</span>`}<span class="grow"></span></div>
      <div class="pg-variacoes" style=${`--n:${variacoes.length}`}>
        ${variacoes.map((cfg, i) => html`<${Variacao} key=${i} letra=${'ABC'[i]} cfg=${cfg} proj=${proj} versao=${versao} zoom=${zoom} gravando=${gravando}
          emUso=${JSON.stringify(T.mesclar(cfg)) === emUso}
          onMudar=${(c) => mudar(i, c)} onUsar=${() => usar(cfg)}
          onDuplicar=${variacoes.length < MAX ? () => setVariacoes((vs) => [...vs.slice(0, i + 1), NF.util.clone(cfg), ...vs.slice(i + 1)]) : null}
          onRemover=${variacoes.length > 1 ? () => setVariacoes((vs) => vs.filter((_, j) => j !== i)) : null} />`)}
      </div>
    </div>`;
  }

  render(html`<${App} />`, document.getElementById('app'));
})();
