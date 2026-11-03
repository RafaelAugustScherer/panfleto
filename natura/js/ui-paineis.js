// Painéis laterais: Propriedades, Camadas, Componentes, Artes e Ofertas.
(() => {
  const { html, useState, useEffect, useRef } = htmPreact;
  const E = NF.estado, M = NF.modelo;

  // Edição com histórico agrupado: o primeiro ajuste de cada foco cria um passo de desfazer.
  function useEdicao() {
    const sessao = useRef(true);
    return {
      aplicar(fn) { E.alterar(fn, { historico: sessao.current }); sessao.current = false; },
      reiniciar() { sessao.current = true; },
    };
  }

  function Campo({ id, label, tipo = 'texto', valor, onValor, min, max, passo, opcoes, placeholder }) {
    const ed = useEdicao();
    const set = (v) => ed.aplicar((p) => onValor(p, v));
    const comum = { id, onFocus: ed.reiniciar, onBlur: ed.reiniciar };
    let input;
    if (tipo === 'area') input = html`<textarea ...${comum} rows="2" value=${valor ?? ''} onInput=${(e) => set(e.target.value)}></textarea>`;
    else if (tipo === 'numero') input = html`<input ...${comum} type="number" value=${valor ?? 0} min=${min} max=${max} step=${passo || 1} onInput=${(e) => e.target.value !== '' && set(Number(e.target.value))} />`;
    else if (tipo === 'data') input = html`<input ...${comum} type="date" value=${valor || ''} onInput=${(e) => set(e.target.value)} />`;
    else if (tipo === 'cor') input = html`<div class="color-field"><input ...${comum} type="color" value=${valor || '#000000'} onInput=${(e) => set(e.target.value)} />
        <input type="text" value=${valor || ''} onFocus=${ed.reiniciar} onChange=${(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && set(e.target.value)} aria-label=${`${label} (hex)`} /></div>`;
    else if (tipo === 'opcao') input = html`<select ...${comum} value=${valor} onChange=${(e) => { ed.reiniciar(); set(e.target.value); }}>${opcoes.map(([v, t]) => html`<option value=${v}>${t}</option>`)}</select>`;
    else if (tipo === 'bool') input = html`<input ...${comum} type="checkbox" checked=${!!valor} onChange=${(e) => { ed.reiniciar(); set(e.target.checked); }} />`;
    else input = html`<input ...${comum} type="text" value=${valor ?? ''} placeholder=${placeholder} onInput=${(e) => set(e.target.value)} />`;
    return html`<div class="field"><label for=${id}>${label}</label>${input}</div>`;
  }

  function Faixa({ id, label, valor, min, max, passo, onValor, formato = (v) => v }) {
    const ed = useEdicao();
    return html`<div class="field"><label for=${id}>${label}</label>
      <div class="row"><input id=${id} type="range" min=${min} max=${max} step=${passo} value=${valor} onPointerDown=${ed.reiniciar}
        onInput=${(e) => ed.aplicar((p) => onValor(p, Number(e.target.value)))} />
        <span style="width:44px;text-align:right;font-variant-numeric:tabular-nums">${formato(valor)}</span></div></div>`;
  }

  const arrastavel = (dados) => ({
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.setData('application/x-nf', JSON.stringify(dados)); e.dataTransfer.effectAllowed = 'copy'; },
  });

  // ================= Propriedades =================
  function PainelPagina() {
    const p = E.s.projeto, pag = E.pagina();
    const removidas = pag.celulas.filter((c) => c.removida).length;
    const tamanho = (l, c) => E.alterar((pr) => {
      const pg = pr.paginas[E.s.ui.pagina];
      if (pg.grade.linhas === l && pg.grade.colunas === c) return false;
      M.redimensionarGrade(pg, l, c);
    });
    return html`
      <div class="group">
        <div class="field"><label>Grade</label><div class="seg">
          <button class=${pag.grade.colunas === 3 ? 'on' : ''} onClick=${() => tamanho(3, 3)}>3×3</button>
          <button class=${pag.grade.colunas === 4 ? 'on' : ''} onClick=${() => tamanho(3, 4)}>3×4</button></div></div>
        ${removidas > 0 && html`<div class="field"><label></label>
          <button class="btn small" onClick=${() => E.alterar((pr) => { pr.paginas[E.s.ui.pagina].celulas.forEach((c) => { c.removida = false; c.span = { c: 1, r: 1 }; }); })}>Restaurar células removidas</button></div>`}
      </div>
      <div class="group"><div class="group-title">Cores do panfleto</div>
        <${Campo} id="tm-escuro" label="Etiqueta" tipo="cor" valor=${p.tema.escuro} onValor=${(pr, v) => { pr.tema.escuro = v; }} />
        <${Campo} id="tm-texto" label="Nomes" tipo="cor" valor=${p.tema.texto} onValor=${(pr, v) => { pr.tema.texto = v; }} />
      </div>`;
  }

  // Troca de imagem pelo painel e pelo Ctrl+V.
  async function trocarImagemElemento(elId, file) {
    const img = await NF.util.carregarImagem(URL.createObjectURL(file));
    const caminho = await NF.imagens.salvarEnvio(file, 'artes/imagem');
    E.alterar((pr) => {
      const e = pr.paginas[E.s.ui.pagina].elementos.find((x) => x.id === elId);
      if (!e) return;
      // Cabeçalho mantém a largura; as demais imagens (ex.: banner) encaixam na mesma caixa, no mesmo lugar.
      delete e.recorte; // o recorte era da imagem anterior
      if (e.papel === 'cabecalho') { e.ref = `proj:${caminho}`; e.h = e.w * (img.naturalHeight / img.naturalWidth); }
      else NF.artes.trocarImagem(e, { w: img.naturalWidth, h: img.naturalHeight }, `proj:${caminho}`);
    });
  }
  async function trocarImagemProduto(ofertaId, k, file) {
    const prod = E.s.projeto.ofertas.find((o) => o.id === ofertaId)?.produtos[k];
    if (!prod) return;
    const caminho = await NF.imagens.salvarEnvio(file, `imagens/${prod.codigo || 'produto'}_envio`);
    E.alterar((p) => {
      const pr = p.ofertas.find((o) => o.id === ofertaId)?.produtos[k];
      if (pr) { pr.imagem = caminho; pr.semImagem = false; pr.galeria = 0; delete pr.recorte; }
    });
  }

  function ProdutoDaCelula({ oferta, prod, k, selecionado }) {
    const [trocar, setTrocar] = useState(false);
    const [baixando, setBaixando] = useState(false);
    const alt = (fn) => E.alterar((p) => { const pr = p.ofertas.find((o) => o.id === oferta.id).produtos[k]; return fn(pr, p); });
    const escolher = async (n) => {
      setBaixando(true);
      try {
        const caminho = await NF.imagens.baixarDaNatura(prod.codigo, n);
        alt((pr) => { pr.galeria = n; pr.imagem = caminho; pr.semImagem = false; pr.dx = 0; pr.dy = 0; pr.escala = 1; delete pr.recorte; });
        setTrocar(false);
      } catch (e) { E.aviso(e.message, 'err'); }
      setBaixando(false);
    };
    const enviar = (file) => file && trocarImagemProduto(oferta.id, k, file);
    const thumb = prod.imagem && prod.galeria ? NF.imagens.urlGaleria(prod.codigo, prod.galeria) : null;
    return html`<div class=${`prod ${selecionado ? 'on' : ''}`}>
      <div class="prod-head">
        <div class="thumb">${thumb ? html`<img src=${thumb} alt="" />` : html`<span class="hint">${prod.imagem ? 'arquivo' : '—'}</span>`}</div>
        <div class="grow"><div class="code">${prod.codigo || 'sem código'}</div>
          ${prod.semImagem ? html`<div class="hint" style="margin:0"><span class="warn-text">Sem imagem na Natura</span></div>` : !prod.imagem && html`<div class="hint" style="margin:0">Baixando…</div>`}</div>
        <button class="btn small danger" title="Remover produto da oferta" onClick=${() => E.alterar((p) => { p.ofertas.find((o) => o.id === oferta.id).produtos.splice(k, 1); })}>✕</button>
      </div>
      <div class="btns"><button class="btn small" onClick=${() => setTrocar(!trocar)}>${trocar ? 'Fechar galeria' : 'Trocar imagem'}</button>
        <label class="btn small">Enviar arquivo<input type="file" accept="image/*" hidden onChange=${(e) => enviar(e.target.files[0])} /></label>
        ${prod.recorte && html`<button class="btn small" title="Volta à foto inteira" onClick=${() => alt((pr) => { delete pr.recorte; })}>Sem recorte</button>`}
        ${(prod.dx || prod.dy || prod.escala !== 1) && html`<button class="btn small" onClick=${() => alt((pr) => { pr.dx = 0; pr.dy = 0; pr.escala = 1; })}>Centralizar</button>`}</div>
      ${trocar && html`<${NF.ui.Galeria} codigo=${prod.codigo} escolhida=${prod.galeria} onEscolher=${escolher} />${baixando && html`<p class="hint">Baixando…</p>`}`}
      <div style="margin-top:8px">
        <${Faixa} id=${`tol-${k}`} label="Tolerância" valor=${prod.tolerancia} min="0" max="80" passo="1" onValor=${(p, v) => { p.ofertas.find((o) => o.id === oferta.id).produtos[k].tolerancia = v; }} />
        <${Faixa} id=${`esc-${k}`} label="Tamanho" valor=${prod.escala || 1} min="0.3" max="2.5" passo="0.01" formato=${(v) => `${Math.round(v * 100)}%`} onValor=${(p, v) => { p.ofertas.find((o) => o.id === oferta.id).produtos[k].escala = v; }} />
      </div>
    </div>`;
  }

  function PainelCelula({ sel }) {
    const p = E.s.projeto, pag = E.pagina();
    const cel = E.celula(sel.id);
    if (!cel) return null;
    const oferta = cel.ofertaId ? E.oferta(cel.ofertaId) : null;
    const [novoCodigo, setNovoCodigo] = useState('');
    const alterarCel = (fn) => E.alterar((pr) => fn(pr.paginas[E.s.ui.pagina].celulas.find((c) => c.id === cel.id), pr));
    const altOf = (campo) => (pr, v) => { pr.ofertas.find((o) => o.id === oferta.id)[campo] = v; };
    const faixa = oferta && NF.sincronizar.faixaDesconto(oferta);
    const maxC = pag.grade.colunas - cel.coluna, maxR = pag.grade.linhas - cel.linha;

    const span = (eixo, v) => alterarCel((c, pr) => {
      c.span = { ...c.span, [eixo]: v };
      const pg = pr.paginas[E.s.ui.pagina];
      // Células cobertas pela expansão perdem a oferta e ficam marcadas como removidas.
      for (const o of pg.celulas) {
        if (o === c) continue;
        const dentro = o.linha >= c.linha && o.linha < c.linha + c.span.r && o.coluna >= c.coluna && o.coluna < c.coluna + c.span.c;
        if (dentro) { o.removida = true; o.ofertaId = null; }
      }
    });

    return html`
      <div class="group"><div class="group-title">Célula</div>
        <div class="field"><label>Ocupa</label><div class="row">
          <select value=${cel.span.c} onChange=${(e) => span('c', Number(e.target.value))} aria-label="Colunas">${Array.from({ length: maxC }, (_, i) => html`<option value=${i + 1}>${i + 1} col.</option>`)}</select>
          <select value=${cel.span.r} onChange=${(e) => span('r', Number(e.target.value))} aria-label="Linhas">${Array.from({ length: maxR }, (_, i) => html`<option value=${i + 1}>${i + 1} lin.</option>`)}</select></div></div>
        <div class="btns">
          <button class="btn small" onClick=${() => { alterarCel((c) => { c.removida = true; c.ofertaId = null; c.span = { c: 1, r: 1 }; }); E.selecionar(null); }}>Remover célula</button>
          ${oferta && html`<button class="btn small" onClick=${() => alterarCel((c) => { c.ofertaId = null; c.ajustes = {}; })}>Tirar oferta da célula</button>`}
          ${oferta && Object.keys(cel.ajustes || {}).length > 0 && html`<button class="btn small" onClick=${() => alterarCel((c) => { c.ajustes = {}; })}>Restaurar posições</button>`}
        </div>
      </div>
      ${oferta && html`<div class="group"><div class="group-title">Oferta</div>
          <${Campo} id="of-nome" label="Nome" tipo="area" valor=${oferta.nome} onValor=${altOf('nome')} />
          <${Campo} id="of-comp" label="Quantidade" valor=${oferta.complemento} placeholder="100ml" onValor=${altOf('complemento')} />
          <${Campo} id="of-de" label="Valor De" valor=${oferta.de} placeholder="sem valor De" onValor=${(pr, v) => { pr.ofertas.find((o) => o.id === oferta.id).de = v.trim() ? NF.util.limparPreco(v) || v : ''; }} />
          <${Campo} id="of-por" label="Valor Por" valor=${oferta.por} onValor=${(pr, v) => { pr.ofertas.find((o) => o.id === oferta.id).por = NF.util.limparPreco(v) || v; }} />
          <${Campo} id="of-suf" label="Após o preço" tipo="opcao" valor=${oferta.sufixo} opcoes=${[['', '—'], ['cada', 'cada']]} onValor=${altOf('sufixo')} />
          <${Campo} id="of-ou" label='Mostrar "ou"' tipo="bool" valor=${oferta.mostrarOu} onValor=${altOf('mostrarOu')} />
          ${faixa && html`<${Campo} id="of-selo" label=${`Selo ${faixa}% OFF`} tipo="bool" valor=${!oferta.semSeloAuto}
            onValor=${(pr, v) => { pr.ofertas.find((o) => o.id === oferta.id).semSeloAuto = !v; }} />`}
        </div>
        <div class="group"><div class="group-title">Produtos</div>
          ${oferta.produtos.map((prod, k) => html`<${ProdutoDaCelula} key=${`${prod.codigo}-${k}`} oferta=${oferta} prod=${prod} k=${k} selecionado=${sel.parte === 'produto' && sel.indice === k} />`)}
          <div class="row"><input type="text" placeholder="Código do produto" value=${novoCodigo} onInput=${(e) => setNovoCodigo(e.target.value.replace(/\D/g, ''))} aria-label="Novo código" />
            <button class="btn" disabled=${!novoCodigo} onClick=${() => {
              E.alterar((pr) => { pr.ofertas.find((o) => o.id === oferta.id).produtos.push(M.novoProduto(novoCodigo)); });
              setNovoCodigo('');
              NF.ui.baixarImagensDasOfertas([oferta.id]);
            }}>Adicionar</button></div>
        </div>`}`;
  }

  function PainelElemento({ sel }) {
    const el = E.elemento(sel.id);
    if (!el) return null;
    const def = el.tipo === 'componente' ? NF.componentes.def(el.comp) : null;
    const altEl = (fn) => (pr, v) => { const e = pr.paginas[E.s.ui.pagina].elementos.find((x) => x.id === el.id); fn(e, v); };
    const props = {};
    if (def) for (const c of def.props) props[c.key] = el.props[c.key] ?? c.padrao;
    // Ao trocar de família, cada peso vai para o mais próximo que a nova família tem.
    const ajustarPesos = (e, familia) => {
      const disp = NF.fontes.opcoesPeso(familia).map(([v]) => Number(v));
      for (const c of def.props) {
        if (c.tipo !== 'opcao' || typeof c.opcoes !== 'function' || c.key === 'fonte') continue;
        const atual = Number(e.props[c.key] ?? c.padrao);
        e.props[c.key] = String(disp.reduce((a, b) => (Math.abs(b - atual) < Math.abs(a - atual) ? b : a), disp[0]));
      }
    };
    // As datas da validade valem para o panfleto inteiro: mudar numa página muda nas outras.
    const altValidade = (key) => (pr, v) => {
      for (const p of Object.values(pr.paginas)) for (const e of p.elementos) if (e.comp === 'validade') e.props[key] = v;
    };
    const substituir = (file) => file && trocarImagemElemento(el.id, file);
    if (el.tipo === 'grade') return html`<div class="group"><div class="group-title">Ofertas (grade)</div></div>`;
    return html`
      <div class="group"><div class="group-title"><span>${def ? def.nome : 'Imagem'}</span></div>
        <${Campo} id="el-nome" label="Nome da camada" valor=${el.nome} onValor=${altEl((e, v) => { e.nome = v; })} />
        ${def && def.props.map((c) => {
          const valor = c.key === 'fonte' ? NF.fontes.normalizar(props[c.key]) : props[c.key];
          let opcoes = typeof c.opcoes === 'function' ? c.opcoes(props) : c.opcoes;
          if (opcoes && !opcoes.some(([v]) => String(v) === String(valor))) opcoes = [[valor, `${valor} (não está na pasta fonts)`], ...opcoes];
          const aoMudar = c.key === 'fonte' ? altEl((e, v) => { e.props.fonte = v; ajustarPesos(e, v); })
            : el.comp === 'validade' && c.tipo === 'data' ? altValidade(c.key) : altEl((e, v) => { e.props[c.key] = v; });
          return html`<${Campo} key=${c.key} id=${`pp-${c.key}`} label=${c.label} tipo=${c.tipo} valor=${valor}
            min=${c.min} max=${c.max} passo=${c.passo} opcoes=${opcoes} onValor=${aoMudar} />`;
        })}
      </div>
      <div class="group"><div class="group-title">Posição</div>
        <div class="field"><label>X / Y</label><div class="row">
          <input type="number" value=${Math.round(el.x)} aria-label="X" onChange=${(e) => E.alterar(() => { el.x = Number(e.target.value); })} />
          <input type="number" value=${Math.round(el.y)} aria-label="Y" onChange=${(e) => E.alterar(() => { el.y = Number(e.target.value); })} /></div></div>
        <${Faixa} id="el-esc" label="Escala" valor=${el.escala || 1} min="0.1" max="3" passo="0.01" formato=${(v) => `${Math.round(v * 100)}%`} onValor=${altEl((e, v) => { e.escala = v; })} />
        <${Campo} id="el-rot" label="Rotação" tipo="numero" valor=${el.rotacao || 0} min="-360" max="360" onValor=${altEl((e, v) => { e.rotacao = v; })} />
        ${el.tipo === 'imagem' && html`<${Faixa} id="el-op" label="Opacidade" valor=${el.opacidade ?? 1} min="0" max="1" passo="0.01" formato=${(v) => `${Math.round(v * 100)}%`} onValor=${altEl((e, v) => { e.opacidade = v; })} />`}
        <${Campo} id="el-lock" label="Bloqueado" tipo="bool" valor=${el.bloqueado} onValor=${altEl((e, v) => { e.bloqueado = v; })} />
        ${el.celulaId && html`<div class="field"><label>Célula</label><button class="btn small" onClick=${() => E.alterar((pr) => {
          const pg = pr.paginas[E.s.ui.pagina]; const e = pg.elementos.find((x) => x.id === el.id); const r = M.retangulos(pg).get(e.celulaId);
          if (r) { e.x += r.x; e.y += r.y; } e.celulaId = null;
        })}>Soltar da célula</button></div>`}
      </div>
      ${el.tipo === 'imagem' && html`<div class="group btns"><label class="btn">${el.papel === 'banner' ? 'Substituir banner…' : 'Substituir imagem…'}<input type="file" accept="image/*" hidden onChange=${(e) => substituir(e.target.files[0])} /></label>
        ${el.recorte && html`<button class="btn" title="Volta à foto inteira" onClick=${() => E.alterar((pr) => { delete pr.paginas[E.s.ui.pagina].elementos.find((x) => x.id === el.id).recorte; })}>Sem recorte</button>`}</div>`}`;
  }

  function Propriedades() {
    const sel = E.s.ui.selecao;
    if (!sel) return html`<${PainelPagina} key=${E.s.ui.pagina} />`;
    if (sel.tipo === 'celula') return html`<${PainelCelula} key=${sel.id} sel=${sel} />`;
    return html`<${PainelElemento} key=${sel.id} sel=${sel} />`;
  }

  // ================= Camadas =================
  function Camadas() {
    const pag = E.pagina();
    const sel = E.s.ui.selecao;
    const els = [...pag.elementos].reverse();
    const mover = (id, d) => E.alterar((pr) => {
      const a = pr.paginas[E.s.ui.pagina].elementos; const i = a.findIndex((x) => x.id === id); const j = i + d;
      if (j < 0 || j >= a.length) return false;
      [a[i], a[j]] = [a[j], a[i]];
    });
    const icone = (el) => (el.tipo === 'grade' ? '▦' : el.tipo === 'imagem' ? '▣' : 'T');
    return html`<div class="layers">
      ${els.map((el) => html`<div class=${`layer ${sel?.tipo === 'elemento' && sel.id === el.id ? 'on' : ''}`} onClick=${() => E.selecionar({ tipo: 'elemento', id: el.id })}>
        <button class=${`eye ${el.visivel === false ? 'off' : ''}`} title=${el.visivel === false ? 'Mostrar' : 'Ocultar'}
          onClick=${(e) => { e.stopPropagation(); E.alterar((pr) => { const x = pr.paginas[E.s.ui.pagina].elementos.find((y) => y.id === el.id); x.visivel = x.visivel === false; }); }}>${el.visivel === false ? '◌' : '◉'}</button>
        <span class="name">${icone(el)}  ${el.nome || el.comp || el.tipo} ${el.bloqueado ? html`<span class="lock">🔒</span>` : ''}</span>
        <span class="acts">
          <button title="Subir" onClick=${(e) => { e.stopPropagation(); mover(el.id, 1); }}>▲</button>
          <button title="Descer" onClick=${(e) => { e.stopPropagation(); mover(el.id, -1); }}>▼</button>
        </span></div>`)}
      <div class="layer" style="cursor:default;opacity:.7"><span></span><span class="name">Fundo da página</span><span></span></div>
    </div>`;
  }

  // ================= Componentes =================
  function Previa({ comp }) {
    const ref = useRef();
    useEffect(() => {
      const cv = NF.cena.previaComponente(comp);
      cv.style.width = `${cv.width / 2}px`;
      ref.current.replaceChildren(cv);
    }, [comp, NF.fontes.versao()]);
    return html`<div class="prev" ref=${ref}></div>`;
  }

  function Componentes() {
    const cats = {};
    for (const d of NF.componentes.DEFS) (cats[d.categoria] = cats[d.categoria] || []).push(d);
    const inserir = (comp) => {
      const sel = E.s.ui.selecao;
      const pag = E.pagina();
      const el = M.elementoComponente(comp);
      if (comp.startsWith('selo') && sel?.tipo === 'celula') {
        const r = M.retangulos(pag).get(sel.id);
        el.celulaId = sel.id; el.x = Math.round(r.w - 240); el.y = 20;
      } else { el.x = 900; el.y = 1500; }
      E.alterar((pr) => { pr.paginas[E.s.ui.pagina].elementos.push(el); });
      E.selecionar({ tipo: 'elemento', id: el.id });
    };
    return html`<div>${Object.entries(cats).map(([cat, defs]) => html`<div class="group"><div class="group-title">${cat}</div>
      <div class="lib-grid">${defs.map((d) => html`<div class="lib-item" title="Arraste para a página ou clique para inserir" ...${arrastavel({ tipo: 'componente', comp: d.id })} onClick=${() => inserir(d.id)}>
        <${Previa} comp=${d.id} /><span>${d.nome}</span></div>`)}</div></div>`)}</div>`;
  }

  // ================= Artes =================
  function Artes() {
    const artes = NF.artes.lista();
    const enviar = async (file) => {
      if (!file) return;
      const img = await NF.util.carregarImagem(URL.createObjectURL(file));
      const caminho = await NF.imagens.salvarEnvio(file, 'artes/imagem');
      NF.cena.soltarItem({ tipo: 'imagem', ref: `proj:${caminho}`, w: img.naturalWidth, h: img.naturalHeight, nome: file.name }, { x: 1275, y: 1700 });
    };
    const projeto = E.s.projeto;
    const restaurar = async (a) => { await NF.artes.restaurarOriginal(a.id); E.aviso(`"${a.nome}" voltou à versão original.`); E.notificar('ui'); };
    const Img = NF.ui.ImagemRef;
    const asset = (a, recurso, rotulo, extra = {}) => a[recurso] && html`<div class="asset" title="Arraste para a página"
        ...${arrastavel({ tipo: 'imagem', ref: a[recurso].ref, w: a[recurso].w, h: a[recurso].h, nome: `${rotulo} — ${a.nome}`, ...extra })}>
        <${Img} refImg=${a[recurso].ref} />${rotulo}</div>`;
    return html`<div>
      ${artes.map((a) => html`<div class=${`art-card ${projeto.arte === a.id ? 'atual' : ''}`}>
        ${a.cabecalho && html`<${Img} refImg=${a.cabecalho.ref} />`}
        <div class="body"><span><b>${a.nome}</b>${a.substituida ? html` <span class="hint">(sua versão)</span>` : ''}</span>
          <span class="row">${a.substituida && html`<button class="btn small" onClick=${() => restaurar(a)}>Restaurar original</button>`}
            <button class="btn small" onClick=${() => E.alterar((pr) => NF.artes.aplicar(pr, a.id))}>Aplicar</button></span></div>
        <div class="art-assets">
          ${asset(a, 'cabecalho', a.cabecalhoVerso ? 'Cabeçalho frente' : 'Cabeçalho')}
          ${asset(a, 'cabecalhoVerso', 'Cabeçalho verso')}
          ${asset(a, 'banner', 'Banner', { papel: 'banner' })}
        </div></div>`)}
      <div class="btns"><button class="btn" onClick=${() => E.ui({ dialogo: { tipo: 'arte' } })}>Adicionar arte…</button>
        <button class="btn" onClick=${() => NF.ui.acoes.salvarArte()}>Salvar arte…</button>
        <label class="btn">Inserir imagem…<input type="file" accept="image/*" hidden onChange=${(e) => enviar(e.target.files[0])} /></label></div></div>`;
  }

  // ================= Ofertas =================
  function Ofertas() {
    const p = E.s.projeto;
    const onde = (o) => {
      const loc = M.localizarOferta(p, o.id);
      return loc ? { loc } : null;
    };
    const lista = p.ofertas.map((o) => ({ o, w: onde(o) })).sort((a, b) => (!!a.w - !!b.w));
    const ir = ({ loc }) => { E.ui({ pagina: loc.pagina.id }); E.selecionar({ tipo: 'celula', id: loc.celula.id, parte: 'celula' }); };
    return html`<div>
      ${!lista.length && html`<p class="hint">Nenhuma oferta ainda.</p>`}
      ${lista.map(({ o, w }) => {
        const p0 = o.produtos[0];
        const th = p0 && p0.imagem && p0.galeria ? NF.imagens.urlGaleria(p0.codigo, p0.galeria) : null;
        return html`<div class=${`offer ${w ? 'placed' : ''}`} ...${arrastavel({ tipo: 'oferta', id: o.id })} onClick=${() => w && ir(w)} title=${w ? 'Clique para ir até a célula; arraste para trocar de lugar' : 'Arraste para uma célula'}>
          <div class="thumb">${th ? html`<img src=${th} alt="" loading="lazy" />` : null}</div>
          <div><div class="t">${o.nome}</div><div class="p">${o.de ? `de R$ ${o.de} ` : ''}por R$ ${o.por}${o.sufixo ? ` ${o.sufixo}` : ''}</div>
            ${!w && html`<div class="where">Fora do panfleto</div>`}</div></div>`;
      })}</div>`;
  }

  NF.ui.Propriedades = Propriedades;
  NF.ui.Camadas = Camadas;
  NF.ui.Componentes = Componentes;
  NF.ui.Artes = Artes;
  NF.ui.Ofertas = Ofertas;
  NF.ui.trocarImagemElemento = trocarImagemElemento;
  NF.ui.trocarImagemProduto = trocarImagemProduto;
})();
