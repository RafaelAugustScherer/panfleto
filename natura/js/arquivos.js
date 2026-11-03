// Persistência na pasta de trabalho escolhida pelo usuário (File System Access API, Chrome/Edge).
NF.arquivos = (() => {
  const suportado = typeof window.showDirectoryPicker === 'function';
  let raiz = null;      // pasta de trabalho
  let projeto = null;   // panfletos/<slug>

  // ---- IndexedDB: lembra a pasta escolhida entre sessões ----
  const DB = 'nf-editor', STORE = 'handles';
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  async function idbSet(k, v) {
    const db = await idb();
    await new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); });
  }
  async function idbGet(k) {
    const db = await idb();
    return new Promise((res, rej) => { const t = db.transaction(STORE).objectStore(STORE).get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
  }

  async function escolherPasta() {
    const h = await window.showDirectoryPicker({ id: 'nf-panfletos', mode: 'readwrite' });
    raiz = h;
    await idbSet('raiz', h).catch(() => {});
    return h;
  }

  // Retorna 'ok' | 'permissao' (precisa de clique) | 'nenhuma'
  async function restaurarPasta() {
    // Modo de teste (index.html?teste): usa o armazenamento privado do navegador em vez de uma pasta real.
    if (new URLSearchParams(location.search).has('teste') && navigator.storage?.getDirectory) {
      raiz = await navigator.storage.getDirectory();
      return 'ok';
    }
    let h;
    try { h = await idbGet('raiz'); } catch { return 'nenhuma'; }
    if (!h) return 'nenhuma';
    raiz = h;
    const p = await h.queryPermission({ mode: 'readwrite' });
    return p === 'granted' ? 'ok' : 'permissao';
  }

  async function pedirPermissao() {
    if (!raiz) return false;
    return (await raiz.requestPermission({ mode: 'readwrite' })) === 'granted';
  }

  const nomeRaiz = () => raiz?.name || (raiz ? '(teste)' : '');

  async function dir(base, caminho, criar = true) {
    let d = base;
    for (const parte of caminho.split('/').filter(Boolean)) d = await d.getDirectoryHandle(parte, { create: criar });
    return d;
  }

  async function arquivo(base, caminho, criar) {
    const partes = caminho.split('/').filter(Boolean);
    const nome = partes.pop();
    const d = await dir(base, partes.join('/'), criar);
    return d.getFileHandle(nome, { create: criar });
  }

  async function gravar(base, caminho, dados) {
    const fh = await arquivo(base, caminho, true);
    const w = await fh.createWritable();
    await w.write(dados);
    await w.close();
  }

  async function ler(base, caminho) {
    const fh = await arquivo(base, caminho, false);
    return fh.getFile();
  }

  async function existe(base, caminho) {
    try { await arquivo(base, caminho, false); return true; } catch { return false; }
  }

  // ---- Panfletos ----
  async function listarPanfletos() {
    const pasta = await dir(raiz, 'panfletos');
    const lista = [];
    for await (const [nome, h] of pasta.entries()) {
      if (h.kind !== 'directory') continue;
      try {
        const f = await (await h.getFileHandle('projeto.json')).getFile();
        const j = JSON.parse(await f.text());
        lista.push({ slug: nome, nome: j.nome || nome, modificado: f.lastModified });
      } catch { /* pasta sem projeto */ }
    }
    return lista.sort((a, b) => b.modificado - a.modificado);
  }

  async function criarPanfleto(slugBase) {
    const pasta = await dir(raiz, 'panfletos');
    let slug = slugBase, n = 2;
    for (;;) {
      try { await pasta.getDirectoryHandle(slug); slug = `${slugBase}-${n++}`; } catch { break; }
    }
    projeto = await pasta.getDirectoryHandle(slug, { create: true });
    return slug;
  }

  async function abrirPanfleto(slug) {
    projeto = await dir(raiz, `panfletos/${slug}`, false);
    const f = await ler(projeto, 'projeto.json');
    return JSON.parse(await f.text());
  }

  const salvarProjeto = (obj) => gravar(projeto, 'projeto.json', JSON.stringify(obj, null, 2));
  const gravarNoProjeto = (caminho, blob) => gravar(projeto, caminho, blob);
  const lerDoProjeto = (caminho) => ler(projeto, caminho);
  const existeNoProjeto = (caminho) => existe(projeto, caminho);

  // ---- Fontes: arquivos .ttf/.otf/.woff/.woff2 em <pasta de trabalho>/fonts ----
  async function lerFontes() {
    const pasta = await dir(raiz, 'fonts', false);
    const lista = [];
    for await (const [nome, h] of pasta.entries()) {
      if (h.kind === 'file' && /\.(ttf|otf|woff2?)$/i.test(nome)) lista.push(await h.getFile());
    }
    return lista.sort((a, b) => a.name.localeCompare(b.name)); // ordem fixa: pesos repetidos sempre iguais
  }
  const gravarFonte = (nome, blob) => gravar(raiz, `fonts/${nome}`, blob);

  // ---- Tipografia das ofertas (compartilhada entre panfletos) ----
  const lerTipografia = async () => JSON.parse(await (await ler(raiz, 'tipografia.json')).text());
  const gravarTipografia = (cfg) => gravar(raiz, 'tipografia.json', JSON.stringify(cfg, null, 2));

  // ---- Biblioteca de artes do usuário (compartilhada entre panfletos) ----
  async function lerArtesUsuario() {
    try {
      const f = await ler(raiz, 'biblioteca-artes/artes.json');
      return JSON.parse(await f.text());
    } catch { return []; }
  }
  const gravarArtesUsuario = (lista) => gravar(raiz, 'biblioteca-artes/artes.json', JSON.stringify(lista, null, 2));
  const gravarNaBiblioteca = (caminho, blob) => gravar(raiz, `biblioteca-artes/${caminho}`, blob);
  const lerDaBiblioteca = (caminho) => ler(raiz, `biblioteca-artes/${caminho}`);

  return {
    suportado, escolherPasta, restaurarPasta, pedirPermissao, nomeRaiz,
    listarPanfletos, criarPanfleto, abrirPanfleto, salvarProjeto, gravarNoProjeto, lerDoProjeto, existeNoProjeto,
    lerArtesUsuario, gravarArtesUsuario, gravarNaBiblioteca, lerDaBiblioteca, lerFontes, gravarFonte, lerTipografia, gravarTipografia,
    temProjeto: () => !!projeto,
  };
})();
