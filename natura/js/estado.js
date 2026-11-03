// Estado central: projeto aberto, estado da interface, desfazer/refazer e salvamento automático.
NF.estado = (() => {
  const { clone, debounce } = NF.util;
  const LIMITE_HISTORICO = 80;
  const subs = new Set();

  const s = {
    projeto: null,
    ui: {
      pagina: 'frente', selecao: null, ferramenta: 'mover', zoom: 0.2, mostrarGuias: true,
      painelSup: 'propriedades', painelInf: 'componentes', dialogo: null, toast: null,
      recorte: null, // modo de recorte aberto: { alvo, rect } (ver NF.cena.alternarRecorte)
    },
    salvo: 'salvo', // salvo | pendente | salvando | erro
    erroSalvar: '',
  };
  let desfazer = [], refazer = [];

  const notificar = (motivo) => subs.forEach((f) => f(motivo));
  const assinar = (f) => (subs.add(f), () => subs.delete(f));

  const salvarAgora = async () => {
    if (!s.projeto || !NF.arquivos.temProjeto()) return;
    s.salvo = 'salvando'; notificar('salvo');
    try {
      await NF.arquivos.salvarProjeto(s.projeto);
      s.salvo = 'salvo'; s.erroSalvar = '';
    } catch (e) {
      s.salvo = 'erro'; s.erroSalvar = e.message;
      console.error(e);
    }
    notificar('salvo');
  };
  const salvarDepois = debounce(salvarAgora, 900);

  function carregar(projeto) {
    NF.artes.ajustarProporcoes(projeto);
    const selosMudaram = NF.sincronizar.selosAuto(projeto);
    s.projeto = projeto;
    desfazer = []; refazer = [];
    s.ui.selecao = null;
    s.ui.pagina = 'frente';
    s.salvo = 'salvo';
    if (selosMudaram) { s.salvo = 'pendente'; salvarDepois(); }
    notificar('projeto');
  }

  // Altera o projeto. fn recebe o projeto e o modifica no lugar.
  function alterar(fn, { historico = true, salvar = true } = {}) {
    if (!s.projeto) return;
    const antes = historico ? clone(s.projeto) : null;
    const r = fn(s.projeto);
    if (r === false) return; // alteração cancelada
    NF.sincronizar.selosAuto(s.projeto); // selo "% OFF" segue o desconto da oferta
    if (historico) {
      desfazer.push(antes);
      if (desfazer.length > LIMITE_HISTORICO) desfazer.shift();
      refazer = [];
    }
    if (salvar) { s.salvo = 'pendente'; salvarDepois(); }
    notificar('projeto');
  }

  function voltar() {
    if (!desfazer.length) return;
    refazer.push(clone(s.projeto));
    s.projeto = desfazer.pop();
    validarSelecao();
    s.salvo = 'pendente'; salvarDepois();
    notificar('projeto');
  }

  function avancar() {
    if (!refazer.length) return;
    desfazer.push(clone(s.projeto));
    s.projeto = refazer.pop();
    validarSelecao();
    s.salvo = 'pendente'; salvarDepois();
    notificar('projeto');
  }

  function validarSelecao() {
    const sel = s.ui.selecao;
    if (!sel || !s.projeto) return;
    const pag = s.projeto.paginas[s.ui.pagina];
    const ok = sel.tipo === 'elemento' ? pag.elementos.some((e) => e.id === sel.id) : pag.celulas.some((c) => c.id === sel.id && !c.removida);
    if (!ok) s.ui.selecao = null;
  }

  function ui(patch) {
    Object.assign(s.ui, typeof patch === 'function' ? patch(s.ui) : patch);
    notificar('ui');
  }

  function selecionar(sel) {
    s.ui.selecao = sel;
    if (sel) s.ui.painelSup = 'propriedades';
    notificar('selecao');
  }

  let toastTimer;
  function aviso(texto, tipo = 'ok', ms = 3200) {
    s.ui.toast = { texto, tipo };
    notificar('ui');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { s.ui.toast = null; notificar('ui'); }, ms);
  }

  // Atalhos de leitura
  const pagina = () => s.projeto?.paginas[s.ui.pagina];
  const oferta = (id) => s.projeto?.ofertas.find((o) => o.id === id);
  const elemento = (id) => pagina()?.elementos.find((e) => e.id === id);
  const celula = (id) => pagina()?.celulas.find((c) => c.id === id);

  return {
    s, assinar, notificar, carregar, alterar, voltar, avancar, ui, selecionar, aviso,
    salvarAgora: () => salvarDepois.flush(), pagina, oferta, elemento, celula,
    podeDesfazer: () => desfazer.length > 0, podeRefazer: () => refazer.length > 0,
  };
})();
