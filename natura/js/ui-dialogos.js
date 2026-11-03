// Diálogos: novo panfleto, sincronizar planilha, exportar PNG, nova arte, salvar arte, instalar fontes.
NF.ui = NF.ui || {};
(() => {
  const { html, useState, useEffect, useMemo, useRef } = htmPreact;
  const E = NF.estado, M = NF.modelo;
  const URL_PLANILHA = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRO36CfzBerQbEQKsOiwTQcsY03w3C_32FgvdK-7_juUlBuCZPlb_k3XQElxolqyX2J6YJI9ejKlLp-/pub?gid=0&single=true&output=tsv';

  function Modal({ titulo, estreito, onFechar, children, rodape }) {
    useEffect(() => {
      const k = (e) => { if (e.key === 'Escape') onFechar(); };
      window.addEventListener('keydown', k);
      return () => window.removeEventListener('keydown', k);
    }, []);
    return html`<div class="modal-back" onMouseDown=${(e) => e.target === e.currentTarget && onFechar()}>
      <div class=${`modal ${estreito ? 'narrow' : ''}`} role="dialog" aria-label=${titulo}>
        <header><h2>${titulo}</h2><button class="x" onClick=${onFechar} aria-label="Fechar">×</button></header>
        <div class="body">${children}</div>
        <footer>${rodape}</footer>
      </div></div>`;
  }

  // ---------- Escolha gráfica do grid ----------
  const { modeloDePagina, contarVagas } = M;

  function SeletorGrade({ titulo, valor, onChange, comBanner }) {
    const m = valor;
    const cob = new Set();
    for (const [k, s] of Object.entries(m.spans || {})) {
      if (m.removidas.includes(k)) continue;
      const [r, c] = k.split(',').map(Number);
      for (let i = 0; i < s.r; i++) for (let j = 0; j < s.c; j++) if (i || j) cob.add(`${r + i},${c + j}`);
    }
    const mudarTamanho = (key) => onChange({ ...M.MODELOS_GRADE[key], removidas: [], spans: {} });
    const alternar = (k, e) => {
      if (e.shiftKey) {
        const [r, c] = k.split(',').map(Number);
        const atual = m.spans[k]?.c || 1;
        const prox = atual >= m.colunas - c ? 1 : atual + 1;
        const spans = { ...m.spans };
        if (prox === 1) delete spans[k]; else spans[k] = { c: prox, r: 1 };
        const removidas = m.removidas.filter((x) => x !== k);
        for (let j = 1; j < prox; j++) if (!removidas.includes(`${r},${c + j}`)) removidas.push(`${r},${c + j}`);
        onChange({ ...m, spans, removidas });
        return;
      }
      const removidas = m.removidas.includes(k) ? m.removidas.filter((x) => x !== k) : [...m.removidas, k];
      const spans = { ...m.spans };
      if (removidas.includes(k)) delete spans[k];
      onChange({ ...m, removidas });
    };
    const celulas = [];
    for (let r = 0; r < m.linhas; r++) {
      for (let c = 0; c < m.colunas; c++) {
        const k = `${r},${c}`;
        if (cob.has(k)) continue;
        const sp = m.spans[k] || { c: 1, r: 1 };
        const rem = m.removidas.includes(k);
        celulas.push(html`<div class=${`tpl-cell ${rem ? 'removed' : ''} ${sp.c > 1 ? 'span' : ''}`}
          style=${`grid-row:${r + 1} / span ${sp.r};grid-column:${c + 1} / span ${sp.c}`}
          title=${rem ? 'Célula removida (clique para restaurar)' : 'Clique para remover · Shift+clique para alargar'}
          onClick=${(e) => alternar(k, e)}>${rem ? '' : `${r + 1}·${c + 1}`}</div>`);
      }
    }
    const isPreset = (id) => JSON.stringify(M.PRESETS[id].removidas.slice().sort()) === JSON.stringify(m.removidas.slice().sort()) && m.colunas === M.PRESETS[id].colunas;
    return html`<div class="tpl">
      <h3><span>${titulo}</span><span class="hint" style="margin:0">${contarVagas(m)} vagas</span></h3>
      <div class="row" style="justify-content:space-between">
        <div class="seg">
          <button class=${m.linhas === 3 && m.colunas === 3 ? 'on' : ''} onClick=${() => mudarTamanho('3x3')}>3×3</button>
          <button class=${m.linhas === 3 && m.colunas === 4 ? 'on' : ''} onClick=${() => mudarTamanho('3x4')}>3×4</button>
        </div>
        <button class=${`btn small ${isPreset('friday-2025-frente') ? 'primary' : ''}`} onClick=${() => onChange(NF.util.clone(M.PRESETS['friday-2025-frente']))}>Igual Friday 2025</button>
      </div>
      <div class="tpl-page"><div class="hdr"></div>
        <div class="tpl-grid" style=${`grid-template-columns:repeat(${m.colunas},1fr);grid-template-rows:repeat(${m.linhas},1fr)`}>${celulas}</div>
      </div>
      <p class="hint">Clique numa célula para removê-la (a área fica livre para artes). Shift+clique alarga a célula para a direita.${comBanner ? ' O banner da arte é colocado na área removida.' : ''}</p>
    </div>`;
  }

  // ---------- Novo panfleto ----------
  function DialogoNovo({ onFechar }) {
    const artes = NF.artes.lista();
    const [nome, setNome] = useState('Natura Friday 2026');
    const [arteId, setArte] = useState(artes[0]?.id || '');
    const [inicio, setInicio] = useState('2026-11-19');
    const [fim, setFim] = useState('2026-11-29');
    const [frente, setFrente] = useState(NF.util.clone(M.PRESETS['friday-2025-frente']));
    const [verso, setVerso] = useState({ ...M.MODELOS_GRADE['3x4'], removidas: [], spans: {} });
    const [ocupado, setOcupado] = useState(false);
    const [erro, setErro] = useState('');

    const criar = async () => {
      setOcupado(true); setErro('');
      try {
        const slug = await NF.arquivos.criarPanfleto(NF.util.slug(nome));
        const projeto = M.novoProjeto({ nome, slug, arteId, modeloFrente: frente, modeloVerso: verso, validade: { inicio, fim } });
        await NF.arquivos.salvarProjeto(projeto);
        E.carregar(projeto);
        E.ui({ dialogo: { tipo: 'sincronizar' } });
        setTimeout(() => NF.cena.ajustarATela(), 30);
      } catch (e) { setErro(e.message); setOcupado(false); }
    };

    return html`<${Modal} titulo="Novo panfleto" onFechar=${onFechar} rodape=${html`
      ${erro && html`<span class="err-text">${erro}</span>`}
      <button class="btn" onClick=${onFechar}>Cancelar</button>
      <button class="btn primary" disabled=${ocupado || !nome.trim()} onClick=${criar}>Criar panfleto</button>`}>
      <div class="cols-2">
        <div>
          <div class="field"><label for="np-nome">Nome</label><input id="np-nome" type="text" value=${nome} onInput=${(e) => setNome(e.target.value)} /></div>
          <div class="field"><label for="np-ini">Válido de</label><input id="np-ini" type="date" value=${inicio} onInput=${(e) => setInicio(e.target.value)} /></div>
          <div class="field"><label for="np-fim">Válido até</label><input id="np-fim" type="date" value=${fim} onInput=${(e) => setFim(e.target.value)} /></div>
          <div class="group-title" style="margin-top:14px">Arte da campanha</div>
          ${artes.map((a) => html`<label class="art-card" style=${`display:block;cursor:default;${a.id === arteId ? 'border-color:var(--accent)' : ''}`}>
            ${a.cabecalho ? html`<${ImagemRef} refImg=${a.cabecalho.ref} />` : null}
            <div class="body"><span><input type="radio" name="np-arte" checked=${a.id === arteId} onChange=${() => setArte(a.id)} /> ${a.nome}</span></div>
          </label>`)}
          <label class="art-card" style="display:block;cursor:default"><div class="body"><span><input type="radio" name="np-arte" checked=${!arteId} onChange=${() => setArte('')} /> Sem arte (fundo branco)</span></div></label>
        </div>
        <div style="display:grid;gap:10px;grid-template-columns:1fr 1fr">
          <${SeletorGrade} titulo="Frente" valor=${frente} onChange=${setFrente} comBanner=${!!arteId} />
          <${SeletorGrade} titulo="Verso" valor=${verso} onChange=${setVerso} comBanner=${!!arteId} />
        </div>
      </div>
    <//>`;
  }

  // ---------- Sincronizar planilha ----------
  async function baixarImagensDasOfertas(ofertaIds) {
    const p = E.s.projeto;
    const tarefas = [];
    for (const of of p.ofertas) {
      if (!ofertaIds.includes(of.id)) continue;
      of.produtos.forEach((prod, k) => { if (!prod.imagem && prod.codigo) tarefas.push({ ofId: of.id, k, codigo: prod.codigo, galeria: prod.galeria || 1 }); });
    }
    if (!tarefas.length) return;
    let feitas = 0;
    const falhas = [];
    E.ui({ tarefa: { texto: `Baixando imagens 0/${tarefas.length}`, progresso: 0 } });
    await NF.util.emLotes(tarefas, 4, async (t) => {
      let caminho = null;
      let galeria = t.galeria;
      try { caminho = await NF.imagens.baixarDaNatura(t.codigo, galeria); } catch { /* tenta o site */ }
      // Sem foto no link interno: a primeira foto da página do produto no site da Natura.
      if (!caminho && galeria !== 's1') {
        galeria = 's1';
        try { caminho = await NF.imagens.baixarDaNatura(t.codigo, galeria); } catch { /* sem imagem */ }
      }
      if (!caminho) falhas.push(t.codigo);
      E.alterar((pr) => {
        const prod = pr.ofertas.find((o) => o.id === t.ofId)?.produtos[t.k];
        if (!prod) return false;
        if (caminho) { prod.imagem = caminho; prod.semImagem = false; prod.galeria = galeria; } else prod.semImagem = true;
      }, { historico: false });
      feitas++;
      E.ui({ tarefa: { texto: `Baixando imagens ${feitas}/${tarefas.length}`, progresso: feitas / tarefas.length } });
    });
    E.ui({ tarefa: null });
    if (falhas.length) E.aviso(`Sem imagem na Natura para: ${falhas.join(', ')}. Envie um arquivo pelo painel da célula.`, 'err', 9000);
    else E.aviso(`${tarefas.length} imagens baixadas para a pasta do panfleto.`);
  }

  // A planilha manda no conteúdo: mostra erros e o que muda antes de aplicar.
  // Só sincroniza com uma linha válida por vaga; se o número não bate, o usuário escolhe outro layout.
  function DialogoSincronizar({ onFechar }) {
    const p = E.s.projeto;
    const [fonte, setFonte] = useState('url');
    const [url, setUrl] = useState(localStorage.getItem('nf-url-planilha') || URL_PLANILHA);
    const [texto, setTexto] = useState('');
    const [lido, setLido] = useState(null);
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [frente, setFrente] = useState(modeloDePagina(p.paginas.frente));
    const [verso, setVerso] = useState(modeloDePagina(p.paginas.verso));

    const buscar = async () => {
      setErro(''); setCarregando(true);
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`A planilha respondeu ${r.status}.`);
        setLido(await r.text());
        try { localStorage.setItem('nf-url-planilha', url); } catch { /* opcional */ }
      } catch (e) {
        setErro(e.message === 'Failed to fetch'
          ? 'O navegador não conseguiu ler o link. Abra a planilha, selecione as células (com o cabeçalho), copie e use "Colar células".'
          : e.message);
      }
      setCarregando(false);
    };
    useEffect(() => { buscar(); }, []);

    const a = useMemo(() => (lido == null ? null : NF.sincronizar.analisar(p, lido)), [lido]);
    const linhas = a ? a.itens.length : 0;
    const atuais = { frente: modeloDePagina(p.paginas.frente), verso: modeloDePagina(p.paginas.verso) };
    const vagasAtuais = contarVagas(atuais.frente) + contarVagas(atuais.verso);
    // Layout novo só entra quando a planilha não cabe no atual.
    const escolherLayout = a && linhas > 0 && linhas !== vagasAtuais;
    const modelos = escolherLayout ? { frente, verso } : atuais;
    const vagas = contarVagas(modelos.frente) + contarVagas(modelos.verso);
    const contaBate = a && linhas === vagas;
    const novas = a ? a.itens.filter((i) => i.tipo === 'nova') : [];
    const atualizadas = a ? a.itens.filter((i) => i.tipo === 'atualizada') : [];
    const layoutMudou = escolherLayout && (JSON.stringify(frente) !== JSON.stringify(atuais.frente) || JSON.stringify(verso) !== JSON.stringify(atuais.verso));
    const nada = a && !novas.length && !atualizadas.length && !a.removidas.length && !layoutMudou;
    const pode = a && !a.erros.length && linhas > 0 && contaBate && !nada;

    const sincronizar = () => {
      let novasIds = [];
      E.alterar((pr) => { novasIds = NF.sincronizar.aplicar(pr, a, modelos); });
      onFechar();
      const partes = [atualizadas.length && `${atualizadas.length} atualizada(s)`, novas.length && `${novas.length} nova(s)`, a.removidas.length && `${a.removidas.length} removida(s)`].filter(Boolean);
      E.aviso(`Planilha sincronizada${partes.length ? `: ${partes.join(', ')}` : ''}.`);
      if (novasIds.length) baixarImagensDasOfertas(novasIds);
    };

    return html`<${Modal} titulo="Sincronizar planilha" onFechar=${onFechar} rodape=${html`
      <button class="btn" onClick=${onFechar}>Cancelar</button>
      <button class="btn primary" disabled=${!pode} onClick=${sincronizar}>Sincronizar</button>`}>
      <div class="row" style="margin-bottom:10px">
        <div class="seg"><button class=${fonte === 'url' ? 'on' : ''} onClick=${() => setFonte('url')}>Link publicado</button><button class=${fonte === 'colar' ? 'on' : ''} onClick=${() => setFonte('colar')}>Colar células</button></div>
      </div>
      ${fonte === 'url' ? html`<div class="row" style="margin-bottom:8px">
          <input type="url" class="grow" value=${url} onInput=${(e) => setUrl(e.target.value)} aria-label="Link da planilha publicada (TSV ou CSV)" />
          <button class="btn" disabled=${carregando} onClick=${buscar}>${carregando ? 'Lendo…' : 'Ler de novo'}</button></div>`
        : html`<textarea rows="5" placeholder="Cole aqui as células copiadas da planilha (Código, Produto, De, Por, Cada)" value=${texto}
            onInput=${(e) => { setTexto(e.target.value); setLido(e.target.value); setErro(''); }}></textarea>`}
      ${erro && html`<p class="err-text">${erro}</p>`}
      ${a && html`<div class="sinc">
        ${a.erros.length > 0 && html`<div class="sinc-bloco err"><b>Corrija ${a.erros.length === 1 ? 'esta linha' : `estas ${a.erros.length} linhas`} na planilha e leia de novo</b>
          <ul>${a.erros.map((x) => html`<li>Linha ${x.linha}${x.texto ? ` · ${x.texto}` : ''}: ${x.problemas.join(', ')}</li>`)}</ul></div>`}
        ${!a.erros.length && !linhas && html`<p class="err-text">Nenhuma linha de produto encontrada. Confira se há as colunas Código, Produto, De e Por.</p>`}
        ${!a.erros.length && escolherLayout && html`<div class="sinc-bloco ${contaBate ? '' : 'err'}">
          <b>A planilha tem ${linhas} ofertas e o layout atual tem ${vagasAtuais} vagas. ${contaBate ? 'O novo layout tem' : 'Escolha um layout com'} ${linhas} vagas${contaBate ? '.' : ` (agora: ${vagas}).`}</b>
          <div class="cols-2" style="margin-top:8px">
            <${SeletorGrade} titulo="Frente" valor=${frente} onChange=${setFrente} comBanner=${!!NF.artes.obter(p.arte)?.banner} />
            <${SeletorGrade} titulo="Verso" valor=${verso} onChange=${setVerso} comBanner=${!!NF.artes.obter(p.arte)?.banner} />
          </div></div>`}
        ${!a.erros.length && contaBate && html`
          ${atualizadas.length > 0 && html`<div class="sinc-bloco"><b>Atualizadas (${atualizadas.length})</b>
            <ul>${atualizadas.map((i) => html`<li>Linha ${i.l.linha} · ${i.oferta.nome}: ${i.mudancas.map((m) => `${m.rotulo} ${m.de} → ${m.para}`).join('; ')}</li>`)}</ul></div>`}
          ${novas.length > 0 && html`<div class="sinc-bloco"><b>Novas (${novas.length})</b>
            <ul>${novas.map((i) => html`<li>Linha ${i.l.linha} · ${i.l.nome} — R$ ${i.l.por}</li>`)}</ul></div>`}
          ${a.removidas.length > 0 && html`<div class="sinc-bloco"><b>Saem do panfleto (${a.removidas.length})</b>
            <ul>${a.removidas.map((o) => html`<li>${o.nome}</li>`)}</ul></div>`}
          ${nada && html`<p class="ok-text">O panfleto já está igual à planilha.</p>`}`}
      </div>`}
    <//>`;
  }

  // ---------- Galeria de imagens de um código ----------
  // Fotos do link interno e, depois, as da página do produto no site da Natura.
  function Galeria({ codigo, escolhida, onEscolher }) {
    const [n, setN] = useState(null);
    useEffect(() => {
      let vivo = true;
      setN(null);
      if (codigo) NF.imagens.contarGaleria(codigo).then((k) => vivo && setN(k));
      return () => { vivo = false; };
    }, [codigo]);
    if (!codigo) return null;
    if (n === null) return html`<div class="gallery"><span class="empty">Procurando imagens de ${codigo}…</span></div>`;
    const ids = [...Array.from({ length: n.interna }, (_, i) => i + 1), ...Array.from({ length: n.site }, (_, i) => `s${i + 1}`)];
    if (!ids.length) return html`<div class="gallery"><span class="empty">Nenhuma imagem na Natura para ${codigo}.</span></div>`;
    return html`<div class="gallery">${ids.map((g) => {
      const nome = typeof g === 'number' ? `${codigo}_${g}` : `${codigo}_${g.slice(1)} (site da Natura)`;
      return html`<button key=${g} class=${escolhida === g ? 'on' : ''} title=${nome} onClick=${() => onEscolher(g)}>
        <img src=${NF.imagens.urlGaleria(codigo, g)} alt=${`Imagem ${nome}`} loading="lazy" /></button>`;
    })}</div>`;
  }
  NF.ui.Galeria = Galeria;

  // ---------- Exportar ----------
  function DialogoExportar({ onFechar }) {
    const [paginas, setPaginas] = useState({ frente: true, verso: true });
    const [formatos, setFormatos] = useState({ impressao: true, redes: true });
    const [prog, setProg] = useState(null);
    const [erro, setErro] = useState('');

    // Exporta, baixa os arquivos na hora e fecha (eles também ficam salvos na pasta do panfleto).
    const exportar = async () => {
      setErro(''); setProg({ v: 0, t: 'Preparando imagens…' });
      try {
        const arq = await NF.exportar.exportar(E.s.projeto, Object.keys(paginas).filter((k) => paginas[k]), Object.keys(formatos).filter((k) => formatos[k]), (v, t) => setProg({ v, t }));
        const slug = E.s.projeto.slug;
        for (const f of arq) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(f.blob);
          a.download = `${slug}-${f.nome}`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 60000);
          await NF.util.esperar(250); // o navegador descarta cliques de download seguidos demais
        }
        E.aviso(`${arq.length === 1 ? 'PNG exportado' : `${arq.length} PNGs exportados`} (também em panfletos/${slug}/exportados).`);
        onFechar();
      } catch (e) { console.error(e); setErro(e.message); setProg(null); }
    };
    const chk = (obj, set, k, rotulo, desc) => html`<label class="row" style="margin-bottom:6px;align-items:flex-start"><input type="checkbox" checked=${obj[k]} onChange=${(e) => set({ ...obj, [k]: e.target.checked })} /><span>${rotulo}${desc && html`<br/><span class="hint">${desc}</span>`}</span></label>`;
    return html`<${Modal} titulo="Exportar PNG" estreito onFechar=${onFechar} rodape=${html`
      <button class="btn" onClick=${onFechar}>Fechar</button>
      <button class="btn primary" disabled=${!!prog || !(paginas.frente || paginas.verso) || !(formatos.impressao || formatos.redes)} onClick=${exportar}>Exportar</button>`}>
      <div class="cols-2">
        <div><div class="group-title">Páginas</div>${chk(paginas, setPaginas, 'frente', 'Frente')}${chk(paginas, setPaginas, 'verso', 'Verso')}</div>
        <div><div class="group-title">Formatos</div>
          ${chk(formatos, setFormatos, 'impressao', 'Impressão', '2755×3783 px, sangria de 3 mm, marcas de corte')}
          ${chk(formatos, setFormatos, 'redes', 'Redes sociais', '2480×3508 px, A4 sem marcas')}</div>
      </div>
      ${prog && html`<div style="margin-top:12px"><div class="progress"><i style=${`width:${prog.v * 100}%`}></i></div><p class="hint">${prog.t}</p></div>`}
      ${erro && html`<p class="err-text">${erro}</p>`}
    <//>`;
  }

  // ---------- Imagem a partir de uma referência (lib:, bib:, proj:, data:) ----------
  function ImagemRef({ refImg, alt = '', ...resto }) {
    const [src, setSrc] = useState(null);
    useEffect(() => {
      let vivo = true;
      setSrc(null);
      if (refImg) NF.imagens.carregarRef(refImg).then((img) => vivo && setSrc(img.src)).catch(() => {});
      return () => { vivo = false; };
    }, [refImg]);
    return src ? html`<img src=${src} alt=${alt} ...${resto} />` : null;
  }

  // ---------- Recorte da arte: largura 2550 px, altura de 640 px até a página inteira ----------
  // A prévia mostra a página toda: a arte no topo, o fundo inferido abaixo dela e o painel branco por cima.
  // A imagem sempre cobre a largura; arrastar move (num eixo só), a roda ou o controle aproximam, "Altura" corta a base.
  function Recorte({ titulo, api, onMudou, opcional }) {
    const { w: W, hMin, hMax, topo } = NF.artes.ARTE;
    const PH = NF.modelo.PAGINA.h;
    const S = 0.12; // escala da prévia
    const [img, setImg] = useState(null);
    const [nomeArq, setNomeArq] = useState('');
    const [v, setV] = useState({ z: 1, ox: 0, oy: 0, hc: hMin });
    const cvRef = useRef();
    const smin = img ? Math.max(W / img.naturalWidth, hMin / img.naturalHeight) : 1;
    const alturaImg = (z) => img.naturalHeight * smin * z;
    const limitar = ({ z, ox, oy, hc }) => {
      const s = smin * z, iw = img.naturalWidth * s, ih = img.naturalHeight * s;
      hc = Math.round(NF.util.clamp(hc, hMin, Math.min(hMax, ih)));
      return { z, hc, ox: NF.util.clamp(ox, W - iw, 0), oy: NF.util.clamp(oy, hc - ih, 0) };
    };
    const zoom = (z) => setV((a) => {
      z = NF.util.clamp(z, 1, 5);
      const k = z / a.z;
      // mantém a altura "cheia" se ela estava no máximo
      const cheia = a.hc >= Math.min(hMax, alturaImg(a.z)) - 1;
      return limitar({ z, ox: W / 2 - (W / 2 - a.ox) * k, oy: a.oy * k, hc: cheia ? hMax : a.hc });
    });
    const abrir = async (file) => {
      if (!file) return;
      const im = await NF.util.carregarImagem(URL.createObjectURL(file));
      const s = Math.max(W / im.naturalWidth, hMin / im.naturalHeight);
      setImg(im); setNomeArq(file.name);
      setV({ z: 1, ox: (W - im.naturalWidth * s) / 2, oy: 0, hc: Math.round(Math.min(hMax, im.naturalHeight * s)) });
    };
    const desenhar = (ctx, escala) => {
      ctx.imageSmoothingQuality = 'high';
      const s = smin * v.z;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W * escala, v.hc * escala); ctx.clip();
      ctx.drawImage(img, v.ox * escala, v.oy * escala, img.naturalWidth * s * escala, img.naturalHeight * s * escala);
      ctx.restore();
    };
    api.current = {
      gerar() {
        if (!img) return null;
        const c = document.createElement('canvas');
        c.width = W; c.height = v.hc;
        desenhar(c.getContext('2d'), 1);
        return c;
      },
      tem: !!img,
    };
    useEffect(() => {
      const c = cvRef.current;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      if (!img) { onMudou && onMudou(); return; }
      desenhar(ctx, S);
      // Abaixo da arte: a cor média da base dela, como o editor vai inferir.
      const yb = Math.floor(v.hc * S);
      if (yb < c.height) {
        const d = ctx.getImageData(0, Math.max(0, yb - 2), c.width, 2).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4;
        ctx.fillStyle = `rgb(${r / n},${g / n},${b / n})`;
        ctx.fillRect(0, yb, c.width, c.height - yb);
      }
      // Painel branco onde ficam os produtos (layout padrão abaixo do topo).
      const P = { x: 90, y: topo - 16, w: 2335, h: 3340 - (topo - 16) };
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.beginPath(); ctx.roundRect(P.x * S, P.y * S, P.w * S, P.h * S, [0, 150 * S, 0, 150 * S]); ctx.fill();
      // Sangria (35 px) e limite da arte.
      const sg = NF.modelo.PAGINA.sangria * S;
      ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.55)';
      ctx.strokeRect(sg + 0.5, sg + 0.5, c.width - sg * 2 - 1, c.height - sg * 2 - 1);
      if (yb < c.height) { ctx.strokeStyle = 'rgba(61,139,253,.9)'; ctx.beginPath(); ctx.moveTo(0, yb + 0.5); ctx.lineTo(c.width, yb + 0.5); ctx.stroke(); }
      onMudou && onMudou();
    }, [img, v]);
    useEffect(() => {
      const c = cvRef.current;
      const roda = (e) => { if (!img) return; e.preventDefault(); zoom(v.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); };
      c.addEventListener('wheel', roda, { passive: false });
      return () => c.removeEventListener('wheel', roda);
    });
    const arrastar = (e) => {
      if (!img) return;
      const r = cvRef.current.getBoundingClientRect();
      const k = W / r.width;
      const x0 = e.clientX, y0 = e.clientY, a = v;
      // Trava num só eixo: o primeiro movimento claro (6 px) decide se o arrasto é horizontal ou vertical.
      let eixo = null;
      const mover = (ev) => {
        const dx = ev.clientX - x0, dy = ev.clientY - y0;
        if (!eixo) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
          eixo = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
        setV(limitar({ ...a, ox: a.ox + (eixo === 'x' ? dx * k : 0), oy: a.oy + (eixo === 'y' ? dy * k : 0) }));
      };
      const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    };
    const hMaxAgora = img ? Math.round(Math.min(hMax, alturaImg(v.z))) : hMax;
    return html`<div class="recorte">
      <div class="row" style="justify-content:space-between;margin-bottom:6px;flex-wrap:wrap">
        <b>${titulo}</b>
        <span class="row"><label class="btn small">${img ? 'Trocar…' : 'Escolher PNG…'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange=${(e) => abrir(e.target.files[0])} /></label>
          ${img && opcional && html`<button class="btn small" onClick=${() => { setImg(null); setNomeArq(''); }}>Remover</button>`}</span>
      </div>
      <canvas ref=${cvRef} width=${Math.round(W * S)} height=${Math.round(PH * S)} class=${img ? 'pode-mover' : ''} onPointerDown=${arrastar}
        aria-label=${`Recorte: ${titulo.toLowerCase()}`}></canvas>
      ${img ? html`
        <div class="row" style="margin-top:6px"><span class="hint rot">Zoom</span>
          <input type="range" min="1" max="5" step="0.01" value=${v.z} class="grow" onInput=${(e) => zoom(Number(e.target.value))} aria-label="Zoom do recorte" />
          <button class="btn small" onClick=${() => zoom(1)}>Encaixar</button></div>
        <div class="row"><span class="hint rot">Altura</span>
          <input type="range" min=${hMin} max=${hMaxAgora} step="1" value=${v.hc} class="grow" disabled=${hMaxAgora <= hMin}
            onInput=${(e) => setV((a) => limitar({ ...a, hc: Number(e.target.value) }))} aria-label="Altura da arte" />
          <span class="hint" style="margin:0;width:118px;text-align:right">${v.hc >= hMax ? 'página inteira' : `${v.hc} px`}</span></div>
        <p class="hint" style="margin:2px 0 0">${nomeArq} · ${W}×${v.hc} px</p>`
        : html`<p class="hint">${opcional ? 'Opcional: sem imagem, o verso usa a mesma arte da frente.' : 'Escolha a imagem da arte.'}</p>`}
    </div>`;
  }

  // ---------- Prompts para IA geradora de imagens ----------
  const CAMPOS_PROMPT = [
    ['campanha', 'Campanha', 'Dia das Mães 2027'],
    ['fraseFrente', 'Frase da frente', 'Para quem cuida de tudo com amor'],
    ['cenaFrente', 'Cena da frente', 'mãe e filha abraçadas, sorrindo, entre flores do campo'],
    ['fraseVerso', 'Frase do verso (opcional)', 'vazio = sem texto'],
    ['cenaVerso', 'Cena do verso', 'flores e folhagens delicadas, sem pessoas'],
    ['paleta', 'Cores', 'bege claro, verde-oliva e laranja terroso'],
    ['estilo', 'Estilo', 'fotografia editorial com luz natural suave'],
  ];

  function montarPrompts(c) {
    const { w: W, hMin, hMax, topo } = NF.artes.ARTE;
    const v = (k, rotulo) => (c[k] || '').trim() || `[${rotulo}]`;
    const pagina = c.tamanho !== 'topo';
    const limites = `A largura é sempre ${W} px; a altura pode ir de ${hMin} px (mínimo: só a faixa do topo) até ${hMax} px (máximo: a página inteira).`;
    const formato = pagina
      ? `Formato: imagem vertical do tamanho da página inteira, ${W} × ${hMax} px (proporção aproximada de 5:7, folha A4 com sangria). ${limites} Se o gerador não tiver 5:7, use 2:3 ou 3:4: a imagem será ajustada na largura e recortada na altura.`
      : `Formato: faixa horizontal panorâmica, ${W} × ${hMin} px (proporção 4:1). ${limites} Se 4:1 não estiver disponível, gere na proporção mais larga possível (ex.: 21:9) com o assunto concentrado na faixa central, pois a imagem será recortada.`;
    const comum = (cena) => [
      `Cena: ${cena}.`,
      `Cores: ${v('paleta', 'CORES')}.`,
      `Estilo: ${v('estilo', 'ESTILO')}. Alta resolução, nítida, adequada para impressão.`,
    ];
    const texto = (frase) => (frase
      ? `Texto: escreva somente a frase "${frase}", em português, dentro da faixa do topo, com tipografia sans-serif moderna, grande e bem legível, sem erros de ortografia. Nenhum outro texto, número, preço ou data.`
      : 'Texto: não escreva nenhum texto, número, preço ou data na imagem.');
    const logo = c.logo !== false ? ' Deixe livre um espaço liso de cerca de 25% da largura, à esquerda do topo, para o logotipo da Natura, que será aplicado depois.' : '';
    const estrutura = pagina
      ? [
        `Estrutura da página (medidas em px, com 35 px de sangria em cada borda que serão cortados):`,
        `• Topo, de 0 a ${topo}: cabeçalho da campanha, com a cena principal e a frase.${logo}`,
        `• Centro, de ${topo - 16} a 3340 de altura e de 90 a 2425 de largura: será coberto por um painel branco de cantos arredondados com os produtos; aqui basta o fundo, sem nada importante.`,
        '• Margens laterais (os 90 px da esquerda e os 125 px da direita) e faixa de baixo (de 3340 até o fim): continuam visíveis. Elementos decorativos do topo (faixas, folhas, formas) podem descer pelas margens.',
        '• A faixa de baixo recebe o endereço e as redes da loja em texto: mantenha-a lisa e sem detalhes.',
        'Mantenha rostos, texto e elementos importantes afastados pelo menos 5% das bordas.',
      ].join('\n')
      : [
        `Composição:${logo || ' distribua a cena por toda a largura.'}`,
        'Mantenha rostos, texto e elementos importantes afastados pelo menos 5% das bordas (margem de corte).',
        'A parte de baixo deve terminar numa faixa de cor lisa e uniforme, porque o fundo do panfleto continua a partir dela.',
      ].join(' ');
    const evitar = "Evite: logotipos, marcas d'água, molduras, bordas e produtos com rótulos ou marcas legíveis.";
    const peca = pagina ? 'a ARTE DE FUNDO' : 'o CABEÇALHO';
    const frente = [
      `Crie ${peca} da FRENTE de um panfleto impresso de ofertas da Natura (cosméticos e perfumaria) para a campanha ${v('campanha', 'CAMPANHA')}.`,
      formato, ...comum(v('cenaFrente', 'CENA DA FRENTE')), texto(v('fraseFrente', 'FRASE DA FRENTE')), estrutura, evitar,
    ].join('\n\n');
    const verso = [
      `Crie ${peca} do VERSO do mesmo panfleto de ofertas da Natura, campanha ${v('campanha', 'CAMPANHA')}. Ela deve combinar com a da frente (mesmas cores e estilo; se possível, use a imagem da frente como referência), com outra cena e visual um pouco mais simples.`,
      formato, ...comum(v('cenaVerso', 'CENA DO VERSO')), texto((c.fraseVerso || '').trim()), estrutura, evitar,
    ].join('\n\n');
    return { frente, verso };
  }

  function Copiar({ texto, alvo }) {
    const [ok, setOk] = useState(false);
    const copiar = async () => {
      try { await navigator.clipboard.writeText(texto); } catch { document.getElementById(alvo)?.select(); document.execCommand('copy'); }
      setOk(true); setTimeout(() => setOk(false), 1500);
    };
    return html`<button class="btn small" onClick=${copiar}>${ok ? 'Copiado' : 'Copiar'}</button>`;
  }

  function GeradorPrompt() {
    const [c, setC] = useState({ logo: true, tamanho: 'pagina' });
    const p = montarPrompts(c);
    return html`<div class="gerador">
      <p class="hint">Preencha o que quiser; o que ficar vazio aparece como [CAMPO] no prompt para você completar. Gere a frente e o verso na mesma conversa da IA para manter o estilo.</p>
      <div class="cols-2" style="gap:6px 14px">
        <div class="field"><label for="gp-tamanho">Tamanho da arte</label><select id="gp-tamanho" value=${c.tamanho} onChange=${(e) => setC({ ...c, tamanho: e.target.value })}>
          <option value="pagina">Página inteira (2550 × 3578)</option><option value="topo">Só o topo (2550 × 640)</option></select></div>
        ${CAMPOS_PROMPT.map(([k, rotulo, ex]) => html`<div class="field"><label for=${`gp-${k}`}>${rotulo}</label>
        <input id=${`gp-${k}`} type="text" placeholder=${ex} value=${c[k] || ''} onInput=${(e) => setC({ ...c, [k]: e.target.value })} /></div>`)}
        <label class="row"><input type="checkbox" checked=${c.logo} onChange=${(e) => setC({ ...c, logo: e.target.checked })} /> Reservar espaço para o logotipo à esquerda</label></div>
      ${[['frente', 'Prompt da frente'], ['verso', 'Prompt do verso']].map(([k, rotulo]) => html`<div class="field" style="display:block;margin-top:8px">
        <div class="row" style="justify-content:space-between;margin-bottom:4px"><label for=${`gp-out-${k}`}>${rotulo}</label><${Copiar} texto=${p[k]} alvo=${`gp-out-${k}`} /></div>
        <textarea id=${`gp-out-${k}`} readonly rows="7" value=${p[k]}></textarea></div>`)}
    </div>`;
  }

  // ---------- Nova arte ----------
  function DialogoArte({ onFechar }) {
    const [nome, setNome] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [prompt, setPrompt] = useState(false);
    const [cores, setCores] = useState(null);
    const apiF = useRef({}), apiV = useRef({});
    const temporizador = useRef();
    // Prévia das cores inferidas (fundo, título, "ou") sempre que o recorte muda.
    const atualizarCores = () => {
      clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        const f = apiF.current.gerar?.();
        setCores(f ? NF.artes.inferirCores(f, apiV.current.gerar?.()) : null);
      }, 200);
    };
    const salvar = async () => {
      setOcupado(true);
      try {
        const arte = await NF.artes.adicionarDoUsuario({ nome: nome.trim(), frente: apiF.current.gerar(), verso: apiV.current.gerar() });
        E.aviso(`Arte "${arte.nome}" adicionada à biblioteca.`);
        E.notificar('ui');
        onFechar();
      } catch (e) { E.aviso(e.message, 'err'); setOcupado(false); }
    };
    const amostra = (cor, rotulo) => html`<span class="amostra"><i style=${`background:${cor}`}></i>${rotulo}</span>`;
    return html`<${Modal} titulo="Adicionar arte à biblioteca" onFechar=${onFechar} rodape=${html`
      <button class="btn note" style="margin-right:auto" onClick=${() => setPrompt(!prompt)}>${prompt ? 'Fechar gerador de prompt' : 'Gerar prompt…'}</button>
      <button class="btn" onClick=${onFechar}>Cancelar</button>
      <button class="btn primary" disabled=${ocupado || !nome.trim() || !cores} onClick=${salvar}>Salvar arte</button>`}>
      ${prompt && html`<div class="group"><div class="group-title">Gerar prompt para IA de imagem</div><${GeradorPrompt} /></div>`}
      <div class="field"><label for="na-nome">Nome</label><input id="na-nome" type="text" placeholder="Dia das Mães 2027" value=${nome} onInput=${(e) => setNome(e.target.value)} /></div>
      <p class="hint">A arte tem ${NF.artes.ARTE.w} px de largura (com sangria) e altura de ${NF.artes.ARTE.hMin} px (só o topo) até a página inteira. Abaixo dela, o fundo é inferido da cor da base; o painel branco com os produtos fica por cima. Arraste para enquadrar (um eixo por vez), use o zoom e a altura; a linha tracejada marca o corte.</p>
      <div class="cols-2">
        <${Recorte} titulo="Arte da frente" api=${apiF} onMudou=${atualizarCores} />
        <${Recorte} titulo="Arte do verso" api=${apiV} onMudou=${atualizarCores} opcional />
      </div>
      ${cores && html`<div class="row" style="margin-top:12px;gap:14px;flex-wrap:wrap"><span class="hint" style="margin:0">Cores inferidas:</span>
        ${amostra(cores.fundo.cor, 'Fundo')}${cores.fundoVerso && amostra(cores.fundoVerso.cor, 'Fundo do verso')}
        ${amostra(cores.tema.titulo, 'Título e rodapé')}${amostra(cores.tema.ou, '"ou"')}</div>`}
    <//>`;
  }

  // ---------- Salvar a configuração atual como arte ----------
  function DialogoSalvarArte({ onFechar }) {
    const p = E.s.projeto;
    const artes = NF.artes.lista();
    const atual = NF.artes.obter(p.arte);
    const [modo, setModo] = useState('nova');
    const [nome, setNome] = useState(atual ? `${atual.nome} (cópia)` : p.nome);
    const [alvo, setAlvo] = useState(atual?.id || artes[0]?.id || '');
    const [ocupado, setOcupado] = useState(false);
    const r = NF.artes.resumoAtual(p);
    const alvoArte = artes.find((a) => a.id === alvo);
    const salvar = async () => {
      setOcupado(true);
      try {
        const arte = await NF.artes.salvarAtual(p, modo === 'nova' ? { nome: nome.trim() } : { substituirId: alvo });
        E.alterar((pr) => { pr.arte = arte.id; });
        E.aviso(modo === 'nova' ? `Arte "${arte.nome}" salva na biblioteca.` : `Arte "${arte.nome}" substituída.`);
        onFechar();
      } catch (e) { E.aviso(e.message, 'err'); setOcupado(false); }
    };
    const item = (rotulo, el, vazio) => html`<div class="resumo-item">${el ? html`<${ImagemRef} refImg=${el.ref} />` : html`<span class="vazio">${vazio}</span>`}<span>${rotulo}</span></div>`;
    return html`<${Modal} titulo="Salvar arte" estreito onFechar=${onFechar} rodape=${html`
      <button class="btn" onClick=${onFechar}>Cancelar</button>
      <button class="btn primary" disabled=${ocupado || !r.cabF || (modo === 'nova' ? !nome.trim() : !alvo)} onClick=${salvar}>${modo === 'nova' ? 'Salvar como nova' : 'Substituir'}</button>`}>
      <p class="hint" style="margin-top:0">Guarda a configuração atual do panfleto: artes de frente e verso, banner, posições (painel, título, validade, rodapé, grade), fundo e cores.</p>
      <div class="resumo">
        ${item('Arte da frente', r.cabF, 'sem arte')}
        ${item('Arte do verso', r.cabV, r.mesmoCabecalho ? 'igual à frente' : 'sem arte')}
        ${item('Banner', r.banner, 'sem banner')}
      </div>
      ${!r.cabF && html`<p class="err-text">A frente precisa de uma arte (aplique uma pela aba Artes).</p>`}
      <label class="row" style="margin-top:10px"><input type="radio" name="sa-modo" checked=${modo === 'nova'} onChange=${() => setModo('nova')} /> Nova arte</label>
      ${modo === 'nova' && html`<div class="field"><label for="sa-nome">Nome</label><input id="sa-nome" type="text" value=${nome} onInput=${(e) => setNome(e.target.value)} /></div>`}
      <label class="row" style="margin-top:6px"><input type="radio" name="sa-modo" checked=${modo === 'substituir'} onChange=${() => setModo('substituir')} /> Substituir uma arte existente</label>
      ${modo === 'substituir' && html`<div class="field"><label for="sa-alvo">Arte</label><select id="sa-alvo" value=${alvo} onChange=${(e) => setAlvo(e.target.value)}>
          ${artes.map((a) => html`<option value=${a.id}>${a.nome}${a.embutida && !a.substituida ? ' (embutida)' : ''}</option>`)}</select></div>
        ${alvoArte?.embutida && html`<p class="hint">Arte embutida: sua versão fica na pasta de trabalho e aparece no lugar dela. "Restaurar original" na aba Artes desfaz.</p>`}`}
    <//>`;
  }

  // ---------- Instalar fontes na pasta de trabalho ----------
  // As fontes são licenciadas e não acompanham o editor: vêm do SharePoint da Natura (o .zip do "Baixar" serve direto),
  // de arquivos do usuário ou das fontes instaladas no computador.
  const URL_FONTES = 'https://naturabr.sharepoint.com/:f:/r/sites/aquitemnatura/Arquivos/Campanhas/2026/08.%20Liquida%20+%20Natura%20Homem/Folhetos/Versionamento%20A4/NATURA_C07_Folheto_Franquias_2.0_A4_%20Folder/Document%20fonts?d=w1f182ca955c74ad195664353566dabbe&csf=1&web=1&e=tcqpUX';
  NF.ui.URL_FONTES = URL_FONTES;

  async function arquivosDeFonte(files) {
    const itens = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) itens.push(...await NF.util.lerZip(f));
      else itens.push({ nome: f.name, blob: f });
    }
    return itens;
  }

  // Situação das fontes esperadas, área para soltar o .zip ou os arquivos e cópia das fontes instaladas no computador.
  function PainelFontes() {
    const [, setVersao] = useState(0);
    const [ocupado, setOcupado] = useState(false);
    const [msg, setMsg] = useState(null); // {texto, erro}
    const [arrastando, setArrastando] = useState(false);
    const lista = NF.fontes.esperadas();

    const relatar = (r, origem) => {
      const partes = [];
      if (r.copiadas) partes.push(`${r.copiadas} fonte(s) copiada(s) para ${NF.arquivos.nomeRaiz()}/fonts`);
      if (r.repetidas) partes.push(`${r.repetidas} já estava(m) na pasta`);
      if (r.ignoradas.length) partes.push(`ignorado(s) por não ser(em) fonte .ttf/.otf: ${r.ignoradas.join(', ')}`);
      setMsg({ texto: partes.length ? `${partes.join('; ')}.` : `Nenhuma fonte encontrada ${origem}.`, erro: !r.copiadas && !r.repetidas });
    };
    const instalar = async (itens, origem) => {
      setOcupado(true); setMsg(null);
      try {
        const r = await NF.fontes.instalar(itens);
        relatar(r, origem);
        if (r.copiadas) E.notificar('fontes');
      } catch (e) { setMsg({ texto: `Não foi possível copiar: ${e.message}`, erro: true }); }
      setOcupado(false); setVersao((v) => v + 1);
    };
    const deArquivos = async (files) => {
      let itens;
      try { itens = await arquivosDeFonte([...files]); } catch (e) { setMsg({ texto: e.message, erro: true }); return; }
      await instalar(itens, 'nos arquivos escolhidos');
    };
    const doComputador = async () => {
      setOcupado(true); setMsg(null);
      let itens;
      try { itens = await NF.fontes.lerInstaladas(); } catch (e) {
        setOcupado(false);
        setMsg({ texto: e.name === 'NotAllowedError' || e.name === 'SecurityError' ? 'O navegador não deu permissão para ler as fontes do computador. Use o .zip do SharePoint.' : `Não foi possível ler as fontes do computador: ${e.message}`, erro: true });
        return;
      }
      if (!itens.length) { setOcupado(false); setMsg({ texto: `${lista.map((e) => e.familia).join(' e ')} não está(ão) instalada(s) neste computador. Use o .zip do SharePoint.`, erro: true }); return; }
      await instalar(itens, 'no computador');
    };
    const soltar = (e) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files.length) deArquivos(e.dataTransfer.files); };

    return html`
      <div class="fontes-lista">${lista.map((f) => html`<div class="fonte-item">
        <div><b style=${f.tem ? `font-family:${NF.fontes.css(f.familia)}` : ''}>${f.familia}</b> <small>${f.obrigatoria ? 'padrão' : 'opcional'}</small></div>
        ${f.pesos.length ? html`<div class="pesos">${f.pesos.map((p) => html`<span class=${`peso ${p.tem ? 'ok' : 'falta'}`}>${p.tem ? '✓' : '✗'} ${p.rotulo}</span>`)}</div>`
          : html`<div class="pesos"><span class=${`peso ${f.tem ? 'ok' : 'falta'}`}>${f.tem ? '✓ instalada' : '✗ não instalada'}</span></div>`}
      </div>`)}</div>
      <label class=${`soltar ${arrastando ? 'on' : ''}`} onDragOver=${(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave=${() => setArrastando(false)} onDrop=${soltar}>
        <span>Arraste aqui o <b>.zip</b> baixado do SharePoint (ou os arquivos .ttf/.otf) ou <u>escolha o arquivo</u></span>
        <input type="file" multiple accept=".zip,.ttf,.otf" hidden disabled=${ocupado} onChange=${(e) => { deArquivos(e.target.files); e.target.value = ''; }} />
      </label>
      ${ocupado && html`<p class="hint">Copiando…</p>`}
      ${msg && html`<p class=${msg.erro ? 'err-text' : 'ok-text'}>${msg.texto}</p>`}
      ${NF.fontes.podeLerInstaladas() && html`<p class="hint" style="margin-top:8px">Já tem as fontes instaladas no Windows?${' '}
        <a href="#" style="color:var(--accent)" onClick=${(e) => { e.preventDefault(); if (!ocupado) doComputador(); }}>Copiar das fontes do computador</a></p>`}`;
  }
  NF.ui.PainelFontes = PainelFontes;

  function DialogoFontes({ onFechar }) {
    // Com as fontes padrão na pasta, só confirma.
    if (!NF.fontes.faltaObrigatoria()) {
      return html`<${Modal} titulo="Fontes" estreito onFechar=${onFechar} rodape=${html`<button class="btn primary" onClick=${onFechar}>Concluir</button>`}>
        <p class="ok-text" style="margin:0">✓ As fontes estão instaladas.</p>
      <//>`;
    }
    return html`<${Modal} titulo="Instalar fontes" estreito onFechar=${onFechar} rodape=${html`
      <button class="btn" onClick=${onFechar}>Agora não</button>`}>
      <p class="hint" style="margin-top:0">Os textos do panfleto usam as fontes da pasta <b>${NF.arquivos.nomeRaiz()}/fonts</b>. Elas são licenciadas e não acompanham o editor:
        baixe-as do <a href=${URL_FONTES} target="_blank" rel="noopener" style="color:var(--accent)">SharePoint da Natura</a> (selecione os arquivos e clique em Baixar) e solte o .zip abaixo.</p>
      <${PainelFontes} />
    <//>`;
  }

  NF.ui.Dialogos = function Dialogos() {
    const d = E.s.ui.dialogo;
    if (!d) return null;
    const fechar = () => E.ui({ dialogo: null });
    if (d.tipo === 'novo') return html`<${DialogoNovo} onFechar=${fechar} />`;
    if (d.tipo === 'sincronizar') return html`<${DialogoSincronizar} onFechar=${fechar} />`;
    if (d.tipo === 'exportar') return html`<${DialogoExportar} onFechar=${fechar} />`;
    if (d.tipo === 'arte') return html`<${DialogoArte} onFechar=${fechar} />`;
    if (d.tipo === 'salvar-arte') return html`<${DialogoSalvarArte} onFechar=${fechar} />`;
    if (d.tipo === 'fontes') return html`<${DialogoFontes} onFechar=${fechar} />`;
    return null;
  };
  NF.ui.baixarImagensDasOfertas = baixarImagensDasOfertas;
  NF.ui.ImagemRef = ImagemRef;
})();
