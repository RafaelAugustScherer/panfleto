// Sincronização com a planilha: a planilha manda no conteúdo das ofertas.
// Ofertas são casadas pelos códigos dos produtos; a linha N da planilha ocupa a vaga N (frente, depois verso).
NF.sincronizar = (() => {
  const M = NF.modelo;
  const SELOS = ['selo-estrela', 'selo-off'];
  const CAMPOS = [['nome', 'Nome'], ['complemento', 'Quantidade'], ['de', 'De'], ['por', 'Por'], ['sufixo', '"cada"'], ['mostrarOu', '"ou"']];
  const precoValido = (s) => /^\d+,\d{2}$/.test(s);
  const chave = (codigos) => [...codigos].sort().join(',');
  const formatar = (campo, v) => (campo === 'mostrarOu' ? (v ? 'sim' : 'não') : v || '—');

  const selosDaCelula = (pag, celId) => pag.elementos.filter((e) => e.celulaId === celId && SELOS.includes(e.comp));

  // Vagas do panfleto na ordem da planilha: frente, depois verso, linha a linha.
  const vagasEmOrdem = (projeto) => ['frente', 'verso'].flatMap((id) =>
    M.celulasVisiveis(projeto.paginas[id]).map((celula, i) => ({ pagina: projeto.paginas[id], celula, rotulo: `${projeto.paginas[id].nome} ${i + 1}` })));

  // Lê o texto da planilha e compara com o panfleto. Não altera nada.
  // Retorna {erros:[{linha, texto, problemas}], itens:[{l, oferta?, tipo:'nova'|'atualizada'|'igual', mudancas}], removidas:[oferta]}
  function analisar(projeto, texto) {
    const erros = [], validas = [];
    const vistas = new Map();
    for (const r of NF.normalizar.lerTabela(texto)) {
      const l = NF.normalizar.linhaParaOferta(r);
      const problemas = [];
      if (!r.codigos.length) problemas.push('sem código');
      if (!r.produto.trim()) problemas.push('sem nome do produto');
      if (!r.por.trim()) problemas.push('sem valor Por');
      else if (!precoValido(l.por)) problemas.push(`valor Por inválido ("${r.por}")`);
      if (r.de.trim() && !precoValido(NF.util.limparPreco(r.de))) problemas.push(`valor De inválido ("${r.de}")`);
      const k = chave(r.codigos);
      if (r.codigos.length) {
        if (vistas.has(k)) problemas.push(`mesmos códigos da linha ${vistas.get(k)}`);
        else vistas.set(k, r.linha);
      }
      if (problemas.length) erros.push({ linha: r.linha, texto: r.produto || r.codigos.join(', '), problemas });
      else validas.push({ ...l, linha: r.linha, chave: k });
    }

    const atuais = new Map(projeto.ofertas.map((o) => [chave(o.produtos.map((p) => p.codigo)), o]));
    const usadas = new Set();
    const vagas = vagasEmOrdem(projeto);
    const itens = validas.map((l, i) => {
      const o = atuais.get(l.chave);
      if (!o || usadas.has(o.id)) return { l, tipo: 'nova', mudancas: [] };
      usadas.add(o.id);
      const mudancas = CAMPOS.filter(([c]) => (o[c] ?? '') !== (l[c] ?? ''))
        .map(([c, rotulo]) => ({ rotulo, de: formatar(c, o[c]), para: formatar(c, l[c]) }));
      // A linha i da planilha ocupa a vaga i.
      const daqui = vagas.findIndex((v) => v.celula.ofertaId === o.id);
      if (daqui !== i) mudancas.push({ rotulo: 'Posição', de: vagas[daqui]?.rotulo || 'fora do panfleto', para: vagas[i]?.rotulo || `vaga ${i + 1}` });
      return { l, oferta: o, tipo: mudancas.length ? 'atualizada' : 'igual', mudancas };
    });
    return { erros, itens, removidas: projeto.ofertas.filter((o) => !usadas.has(o.id)) };
  }

  // Aplica a análise ao projeto (dentro de E.alterar). modelos: {frente, verso} no formato do seletor de grade.
  // Retorna os ids das ofertas novas (para baixar as imagens).
  function aplicar(pr, analise, modelos) {
    const arte = NF.artes.obter(pr.arte);
    // 1. Layout novo: as células que continuam no mesmo lugar mantêm id, oferta e ajustes.
    for (const id of ['frente', 'verso']) {
      const pg = pr.paginas[id], m = modelos[id];
      if (JSON.stringify(M.modeloDePagina(pg)) === JSON.stringify(m)) continue;
      const antigas = new Map(M.celulasVisiveis(pg).map((c) => [`${c.linha},${c.coluna}`, c]));
      const { grade, celulas } = M.novaGrade(m.linhas, m.colunas, m.removidas, m.spans);
      pg.grade = { ...pg.grade, linhas: grade.linhas, colunas: grade.colunas };
      pg.celulas = celulas;
      for (const c of M.celulasVisiveis(pg)) {
        const a = antigas.get(`${c.linha},${c.coluna}`);
        if (a) { c.id = a.id; c.ofertaId = a.ofertaId; c.ajustes = a.ajustes; }
      }
      const visiveis = new Set(M.celulasVisiveis(pg).map((c) => c.id));
      pg.elementos = pg.elementos.filter((e) => !e.celulaId || visiveis.has(e.celulaId));
      if (arte?.banner) {
        pg.elementos = pg.elementos.filter((e) => e.papel !== 'banner' && e.papel !== 'banner-texto');
        NF.artes.inserirBanner(pr, pg, arte);
      }
    }
    // 2. Ofertas que saíram da planilha liberam a célula (com os selos dela).
    const fora = new Set(analise.removidas.map((o) => o.id));
    pr.ofertas = pr.ofertas.filter((o) => !fora.has(o.id));
    for (const pg of Object.values(pr.paginas)) {
      for (const c of pg.celulas) {
        if (!c.ofertaId || pr.ofertas.some((o) => o.id === c.ofertaId)) continue;
        c.ofertaId = null; c.ajustes = {};
        pg.elementos = pg.elementos.filter((e) => e.celulaId !== c.id);
      }
    }
    // 3. A planilha sobrescreve os campos; linhas novas viram ofertas.
    const ordem = analise.itens.map(({ l, oferta }) => {
      const dados = { nome: l.nome, complemento: l.complemento, de: l.de, por: l.por, sufixo: l.sufixo, mostrarOu: l.mostrarOu };
      let o = oferta && pr.ofertas.find((x) => x.id === oferta.id);
      if (o) Object.assign(o, dados);
      else { o = M.novaOferta({ ...dados, codigos: l.codigos }); pr.ofertas.push(o); }
      return { o, l, nova: !oferta };
    });
    // 4. A linha i ocupa a vaga i. Ajustes de posição e elementos presos à célula (selos) acompanham a oferta.
    const vagas = vagasEmOrdem(pr);
    const bagagem = new Map();
    for (const { pagina, celula } of vagas) {
      if (!celula.ofertaId) continue;
      const els = pagina.elementos.filter((e) => e.celulaId === celula.id);
      pagina.elementos = pagina.elementos.filter((e) => e.celulaId !== celula.id);
      bagagem.set(celula.ofertaId, { ajustes: celula.ajustes || {}, els });
      celula.ofertaId = null; celula.ajustes = {};
    }
    ordem.forEach(({ o }, i) => {
      const v = vagas[i];
      if (!v) return;
      v.celula.ofertaId = o.id;
      const b = bagagem.get(o.id);
      if (!b) return;
      v.celula.ajustes = b.ajustes;
      for (const e of b.els) { e.celulaId = v.celula.id; v.pagina.elementos.push(e); }
    });
    return ordem.filter((x) => x.nova).map((x) => x.o.id);
  }

  // ---------- Selo "% OFF" automático ----------
  // 40% OFF a partir de 40% de desconto entre De e Por; 50% OFF a partir de 50%. A folga cobre o arredondamento dos centavos.
  const FAIXAS = [50, 40];
  function faixaDesconto(o) {
    const de = NF.util.precoNumero(o.de), por = NF.util.precoNumero(o.por);
    if (!(de > 0) || !(por > 0) || por >= de) return null;
    const pct = (1 - por / de) * 100;
    return FAIXAS.find((f) => pct >= f - 0.05) || null;
  }

  // Mantém o selo de cada célula de acordo com o desconto da oferta. Roda a cada alteração do projeto e ao abrir.
  // Selos automáticos têm "auto: true"; os colocados à mão não são tocados. Se o usuário apagou o selo da oferta,
  // ela fica com "semSeloAuto" e não ganha outro. Retorna true se mudou algo.
  function selosAuto(pr) {
    let mudou = false;
    for (const pg of Object.values(pr.paginas)) {
      let rets = null;
      for (const c of pg.celulas) {
        const o = !c.removida && c.ofertaId && pr.ofertas.find((x) => x.id === c.ofertaId);
        const faixa = o && !o.semSeloAuto ? faixaDesconto(o) : null;
        const selos = selosDaCelula(pg, c.id);
        // Selos de antes desta regra (sem a marca) contam como automáticos quando batem com a faixa.
        for (const e of selos) if (e.auto === undefined && faixa && Number(e.props.percentual) === faixa) { e.auto = true; mudou = true; }
        const autos = selos.filter((e) => e.auto);
        if (!faixa) {
          if (autos.length) { pg.elementos = pg.elementos.filter((e) => !autos.includes(e)); mudou = true; }
        } else if (autos.length) {
          for (const e of autos) if (Number(e.props.percentual) !== faixa) { e.props.percentual = faixa; mudou = true; }
        } else if (!selos.length) {
          rets = rets || M.retangulos(pg);
          const r = rets.get(c.id);
          if (!r) continue;
          pg.elementos.push(M.elementoComponente('selo-estrela', { percentual: faixa }, { celulaId: c.id, x: Math.round(r.w - 240), y: 20, auto: true }));
          mudou = true;
        }
      }
    }
    return mudou;
  }

  // Apagar o selo de uma oferta (dentro de E.alterar) desliga o selo automático dela.
  function seloApagado(pr, pagina, el) {
    if (!el.celulaId || !SELOS.includes(el.comp)) return;
    const c = pagina.celulas.find((x) => x.id === el.celulaId);
    const o = c?.ofertaId && pr.ofertas.find((x) => x.id === c.ofertaId);
    if (o) o.semSeloAuto = true;
  }

  return { analisar, aplicar, faixaDesconto, selosAuto, seloApagado };
})();
