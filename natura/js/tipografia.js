// Tipografia das ofertas (nome, quantidade, "ou" e etiqueta de preço). Vale para todos os panfletos da pasta:
// fica em <pasta de trabalho>/tipografia.json e é ajustada no playground (playground.html).
NF.tipografia = (() => {
  const F = NF.fontes.PADRAO;
  const PADRAO = {
    nome: { fonte: F, tamanho: 41, minimo: 33, peso: 700, entrelinha: 1.02 },
    quantidade: { peso: 400, espaco: 1.5 }, // mesma fonte e tamanho do nome
    ou: { fonte: F, peso: 700 },
    etiqueta: { fonte: F },
    deRotulo: { tamanho: 31, peso: 500 },
    deInteiro: { tamanho: 39, peso: 500 },
    deCentavos: { tamanho: 28, peso: 500 },
    porRotulo: { tamanho: 33, peso: 500 },
    moeda: { tamanho: 35, peso: 700 },
    porInteiro: { tamanho: 80, peso: 700, espaco: 0 },
    porCentavos: { tamanho: 38, peso: 700 },
    sufixo: { tamanho: 33, peso: 500 },
  };
  const mesclar = (cfg) => Object.fromEntries(Object.entries(PADRAO).map(([k, v]) => [k, { ...v, ...(cfg?.[k] || {}) }]));
  let atual = mesclar(null);

  async function carregar() {
    try { atual = mesclar(await NF.arquivos.lerTipografia()); } catch { atual = mesclar(null); }
    return atual;
  }
  async function salvar(cfg) {
    atual = mesclar(cfg);
    await NF.arquivos.gravarTipografia(atual);
    try { new BroadcastChannel('nf-editor').postMessage('tipografia'); } catch { /* sem BroadcastChannel */ }
  }

  return {
    PADRAO, mesclar, carregar, salvar,
    atual: () => atual,
    usar: (cfg) => { atual = mesclar(cfg); }, // só na memória (prévia do playground)
  };
})();
