# Editor de Panfletos Natura — Especificação

Ferramenta web local para montar panfletos (frente e verso) da Franquia Natura Dois Irmãos, substituindo o Photoshop.

## Como usar

1. Abra https://panfleto.estrutura.dev/natura/ no Chrome ou Edge. Localmente: `Abrir editor (servidor local).bat` (http://localhost:8765/natura/) ou `natura/index.html` direto (sem as fotos do site da Natura).
2. Na primeira vez, a tela inicial é uma **configuração guiada** em quatro passos: (1) escolher a pasta de trabalho (o navegador lembra a escolha); (2) baixar as fontes no SharePoint da Natura (pasta *Document fonts*: marcar tudo, desmarcar `AdobeFnt23.lst`, Baixar; o vídeo `natura/img/fontes-sharepoint.mp4` (em loop) mostra o processo); (3) soltar o .zip baixado, que o editor lê sem extrair e copia para `fonts/`; (4) criar o primeiro panfleto. Cada passo conclui pelo estado real (pasta aberta, fontes na pasta, panfletos existentes), então reabrir o editor continua de onde parou. Com tudo pronto, a tela inicial lista os panfletos.
3. **Arquivo → Novo panfleto**: nome, validade, arte e grid de cada lado. Em seguida abre **Sincronizar planilha**.
4. **Sincronizar planilha** (botão fixo depois do último menu) lê o link publicado (ou células coladas) e normaliza os nomes. A planilha manda no conteúdo: ofertas são casadas pelos códigos; a planilha sobrescreve nome, quantidade, De, Por, "cada" e "ou"; linhas novas viram ofertas (imagens baixadas); ofertas fora da planilha saem com os selos da célula. A ordem da planilha define a posição: a linha N ocupa a vaga N (frente, depois verso, linha a linha); ao mudar de vaga, a oferta leva seus selos e ajustes de posição. Antes de aplicar, o modal lista cada linha que muda (campo antigo → novo), as novas e as que saem. Linhas vazias ou inválidas (sem código, sem nome, Por/De inválido, códigos repetidos) bloqueiam a sincronização. O número de linhas válidas precisa ser igual ao de vagas do layout; só quando não bate o modal oferece escolher outro layout (frente e verso). Não existe "Adicionar oferta".
5. Ajuste no canvas: clique e arraste imagens, nomes, etiquetas e selos; alças nos cantos redimensionam. O painel Propriedades edita textos, preços, tolerância do fundo e a imagem da galeria.
6. **Arquivo → Exportar PNG** grava em `panfletos/<nome>/exportados/` e, ao clicar em Exportar, baixa os arquivos na hora e fecha o diálogo.

Atalhos: V mover · H mão (ou segure Espaço) · Z zoom · C recortar · Ctrl+roda zoom · setas movem (Shift = 10×) · Ctrl+Z/Ctrl+Y · Ctrl+D duplicar · Del excluir · Esc desmarcar · Ctrl+C copia a seleção como imagem PNG (imagem: arquivo original; produto: recorte sem fundo; célula: a oferta como aparece no panfleto; textos e selos: o item renderizado, fundo transparente; tudo a 300 dpi) · Ctrl+V substitui a imagem ou o produto selecionado pela imagem da área de transferência (células, textos e selos não) · Ctrl+S salvar · Ctrl+E exportar · Ctrl+0 ajustar à tela. O zoom do navegador (Ctrl+roda, pinça, Ctrl+=/-/0) fica desativado no editor.

`natura/index.html?teste` usa o armazenamento interno do navegador em vez de uma pasta (só para testes).

## Decisões

| Tema | Decisão |
|---|---|
| Execução | Site estático no Cloudflare Pages (https://panfleto.estrutura.dev/natura/, publicado a cada push no GitHub; ver PUBLICACAO.md) ou local, sem instalação. Sem etapa de build (JS puro + bibliotecas em `natura/vendor`). |
| Persistência | API de sistema de arquivos do navegador: o usuário escolhe uma pasta de trabalho uma vez; a ferramenta grava lá. |
| Formato | Um `projeto.json` por panfleto + imagens originais dos produtos em `imagens/`. |
| Arte | Tudo montado na ferramenta (fundo, cabeçalho, painel branco, rodapé). Artes de campanha vêm de uma biblioteca pré-definida ou de upload. |
| Exportação | PNG da frente e do verso em dois formatos: **Impressão** (A4 + sangria 3 mm + marcas de corte e barras de cor, 2755×3783 px) e **Redes sociais** (A4 300 dpi sem marcas, 2480×3508 px). |
| Nomes da planilha | Normalização automática (maiúsculas → título, acentos comuns, quantidades em fonte fina, "40%"/"% OFF" no nome é descartado). Colunas: Código, Produto, De, Por e Cada (caixa de seleção: marcada → "cada" depois do preço; sem a coluna, vale "cada" escrito no Por). Linhas com só a coluna Cada preenchida são ignoradas. Sem revisão manual. |
| Loja | "Franquia Natura Dois Irmãos" como padrão, com todos os textos editáveis. |
| Grid | 3×3 ou 3×4 por lado, escolhido graficamente. Células podem ser removidas individualmente para dar lugar a artes. Vão horizontal de 40 px (300 dpi) entre colunas, sem mudar a largura total da grade (`VAO_COLUNAS` em modelo.js). |
| Fontes | Só as da pasta `fonts` da pasta de trabalho (.ttf, .otf, .woff, .woff2), carregadas ao abrir a pasta. Padrão: Helvetica Now Display, com peso conforme o texto (nomes 700 + quantidade 400, preços 500/700, selos 800, validade 500 com datas 700). As fontes são licenciadas e não acompanham o editor (nem o repositório): sem Helvetica Now Display Regular/Medium/Bold/Extra Bold na pasta, o editor abre **Instalar fontes** ao abrir a pasta (uma vez por sessão da aba), copiando das fontes instaladas no computador (Local Font Access, com permissão do navegador) ou de arquivos .ttf/.otf ou do .zip do SharePoint escolhidos/arrastados; ignora itálicos, repetidas e não fontes. Natura Display aparece como opcional. Também em Arquivo → Instalar fontes… e na tela inicial; a barra de status só avisa quando faltam. Com as fontes na pasta, o diálogo só confirma ("As fontes estão instaladas." + Concluir). |
| Tipografia das ofertas | Fonte, tamanho e peso do nome, da quantidade, do "ou" e de cada parte da etiqueta de preço valem para todos os panfletos da pasta e ficam em `<pasta>/tipografia.json` (sem o arquivo, valem os padrões: nome 40→31 px 700, quantidade 400, preço 80 px 700 etc.). São ajustadas em **Arquivo → Tipografia das ofertas…** (`natura/playground.html`): até 3 variações lado a lado sobre 8 ofertas de teste (nomes curtos e longos, sem De, preço de 4 dígitos), desenhadas pelo mesmo código do editor, com zoom e rolagem sincronizada; "Usar no editor" grava a variação e os editores abertos se atualizam na hora. As medidas da etiqueta acompanham o tamanho do preço. |
| Publicação como página Claude | Fora do escopo por enquanto. Observação: páginas Claude não acessam sites externos (imagens Natura, Google Sheets) nem pastas locais; essa versão exigiria colar imagens/dados manualmente. |

## Estrutura da pasta de trabalho

```
<pasta escolhida>/
  fonts/              HelveticaNowDisplay*.ttf, NaturaDisplay-*.ttf ... (só estas aparecem para escolha)
  panfletos/
    natura-friday-2026/
      projeto.json
      imagens/          108400_1.jpg ...  (originais baixados da Natura ou enviados)
      artes/            imagens enviadas pelo usuário (banners, cabeçalhos)
      exportados/       frente-impressao.png, verso-redes.png ...
```

## Modelo de dados (projeto.json, versão 1)

- `ofertas[]`: uma oferta ocupa uma célula. Campos: `nome`, `complemento` (quantidade, fonte fina), `de`, `por`, `sufixo` (ex.: "cada"), `mostrarOu` ("ou" entre os produtos; por padrão só quando a linha tem exatamente 2 códigos e o nome contém "ou"; editável no painel), `produtos[]`.
- `produtos[]` de uma oferta: `codigo`, `imagem` (caminho relativo), `galeria` (índice _1, _2…), `tolerancia` (remoção de fundo a partir das bordas, padrão 5), `escala`, `dx`, `dy`.
- `paginas.frente` / `paginas.verso`: `grid {linhas, colunas, area}`, `celulas[] {linha, coluna, removida, ofertaId, deslocamentos}`, `elementos[]` (componentes e imagens livres, em ordem de camada).
- Elementos de componente: `tipo`, `x`, `y`, `escala`, `rotacao`, `props` (tipadas conforme a definição do componente).

## Imagens de produto

- URL: `https://static.rede.natura.net/nxcf/image/sku/1200x1200/{codigo}_{n}.jpg` (galeria `_1`, `_2`…; o servidor permite CORS).
- Site da Natura (fotos da página `natura.com.br/p/…/NATBRA-{codigo}`, às vezes só existem lá): `https://production.na01.natura.com/on/demandware.static/-/Sites-natura-br-storefront-catalog/default/NATBRA-{codigo}_{n}.jpg`. Esse servidor não permite CORS, então o download passa pela rota `natura-imagem` ao lado do editor (Pages Function `functions/natura/natura-imagem.js` no site publicado, `servidor.py` localmente; só esse host); com o editor aberto direto do arquivo, essas fotos não baixam.
- A galeria mostra as fotos do link interno e, em seguida, as do site (cada uma sondada até o primeiro 404); miniaturas são exibidas direto da Natura e só a imagem escolhida é baixada para `imagens/` (`{codigo}_{n}.jpg` ou `{codigo}_s{n}.jpg`). Na sincronização, produto sem foto no link interno recebe a primeira foto do site.
- Remoção de fundo não destrutiva: preenchimento a partir das bordas (varinha mágica contígua) com tolerância ajustável por produto; recorte automático das margens transparentes. O arquivo original é mantido.
- **Recortar** (ferramenta na barra da esquerda, tecla C) recorta a camada selecionada: um produto ou uma imagem solta (não bloqueada). A foto original inteira aparece sobre a camada, esmaecida fora da área mantida, com uma caixa que se arrasta e alças como as de redimensionar (sem passar da foto). Enter, clicar fora ou o mesmo botão aplica; Esc desiste; **Sem recorte** no painel volta à foto inteira. No produto, o corte acontece antes da remoção de fundo e do cálculo de tamanho (ex.: refis Tododia, que trazem um círculo com o frasco à esquerda); na imagem solta, a parte mantida fica no mesmo lugar. Fica salvo em `recorte` (% de cada lado) e é zerado ao trocar a imagem; o Ctrl+C copia só a parte mantida.
- Códigos sem imagem (na planilha piloto: 181012, 181013, 70983) aparecem com aviso e permitem enviar um arquivo.

## Editor

- Layout no estilo Photoshop/GIMP: barra de menus, abas Frente/Verso, ferramentas à esquerda (Mover, Mão, Zoom), canvas central, painéis à direita (Propriedades, Camadas, Componentes, Artes, Ofertas), barra de status.
- Minimalista: cada ação fica num único lugar e a interface não mostra o que se vê no próprio panfleto. Menus: Arquivo (Novo, Abrir outro, Salvar, Exportar PNG, Instalar fontes, Trocar pasta) e Exibir (100%, aproximar, afastar), mais o botão Sincronizar planilha. Barra de ferramentas: Mover, Mão, Zoom, Ajustar à tela, Desfazer, Refazer, Linha de corte. Duplicar, Excluir e Desmarcar só pelo teclado (Ctrl+D, Del, Esc). Ordem das camadas só na aba Camadas. Ações de arte (Aplicar, Adicionar arte, Salvar arte, Inserir imagem) só na aba Artes. Barra de status: só gravação, tarefas em andamento e aviso de fontes. Sem textos de ajuda nos painéis.
- Tudo é arrastável: imagens dos produtos, nome, etiqueta de preço e selos dentro da célula; componentes e artes na página.
- **Selo % OFF automático:** a oferta com desconto de 40% ou mais entre De e Por ganha o selo "40% OFF"; com 50% ou mais, "50% OFF". O selo acompanha as mudanças de preço (planilha ou painel) e sai se o desconto cair abaixo de 40%. Apagar o selo (Del) ou desmarcar "Selo X% OFF" no painel da oferta desliga o selo automático dela; a escolha fica salva no `projeto.json` (`semSeloAuto`) e marcar a caixa de novo devolve o selo. Selos colocados à mão pela aba Componentes não são alterados.
- Montagem automática da célula:
  - Os produtos de uma oferta ficam todos com a mesma altura (as fotos da Natura vêm enquadradas de jeitos diferentes); se não couberem na largura, diminuem juntos. Ficam alinhados pela base e centralizados.
  - Nome e etiqueta de preço formam um bloco com no máximo a largura de uma coluna simples da grade. Numa célula alargada (que ocupa 2 ou mais colunas), o nome quebra em linhas em vez de esticar, e o bloco fica centralizado sob os produtos.
- Desfazer/refazer, zoom, salvamento automático na pasta.
- Canvas desenhado com pelo menos 2× a resolução da tela e imagens reduzidas com filtro de alta qualidade, para o texto e as fotos não serrilharem com zoom baixo.

## Biblioteca de componentes

Cada componente tem propriedades tipadas editadas no painel lateral (texto, número, data, cor, opção). Componentes de texto têm Fonte e Peso, limitados às famílias e pesos da pasta `fonts`; ao trocar a família, o peso vai para o mais próximo disponível. A fonte de nomes, preços e "ou" das ofertas fica em Página → Cores do panfleto.

- Validade (datas de início/fim; mudar as datas numa página muda nas outras), Texto com período (ex.: "em perfumaria (24/11 a 30/11)"), Texto livre, Título da loja
- Selo % OFF (estrela, também o selo automático), Selo % OFF (círculo), Selo Economize X%, Selo Lançamento
- Rodapé da loja (endereço, WhatsApp, Instagram, Facebook), "Imagens meramente ilustrativas."
- Painel (retângulo arredondado), Linha divisória, Imagem

## Biblioteca de artes

Cada arte embutida traz cabeçalho (um por página quando frente e verso diferem), fundo, cores e layout (posição do painel, título, validade, rodapé e grade). Aplicar outra arte reposiciona esses elementos.

- **Natura Friday 1**: arte e banner "60% / 50%" do Natura Friday 2025 (texto de datas removido do banner), fundo em degradê laranja. A arte desce além do topo do painel para a faixa preta continuar pelo canto e pela margem direita, como no original.
- **Natal 1**: cabeçalho vermelho com a família (frente) e verde com o personagem (verso), Natal 2025. Sem rodapé, como o original.
- **Dia das Mães 1**: cabeçalho bege com flores, Dia das Mães 2026 (frase de validade removida da arte). Fundo branco, sem painel e sem título.
- **Dia dos Pais 1**: cabeçalhos com pais e filhos (diferentes na frente e no verso), Dia dos Pais 2025.
- A arte só é trocada pela aba **Artes** ("Aplicar"). Fundo da página e cores do título e do "ou" vêm da arte e não são editáveis; Etiqueta e Nomes (cores) continuam no painel da página.
- **Adicionar arte…**: PNG da arte da frente e (opcional) do verso, com 2550 px de largura (com sangria) e altura de 640 px (só o topo) até 3578 px (página inteira). No recorte, a prévia mostra a página toda com o painel branco por cima; arrastar move num eixo por vez, o zoom aproxima e "Altura" corta a base. A arte fica atrás de tudo; o painel e os produtos vão por cima. Se a arte não chega ao fim da página, o restante do fundo é inferido da cor média da base dela (quase branco vira branco). Título/rodapé e "ou" vêm da paleta dos 640 px do topo; etiqueta e nomes ficam com os valores fixos. O conteúdo começa sempre abaixo dos 640 px do topo. Essas artes não têm banner.
- **Gerar prompt…** (no mesmo diálogo): campos de campanha, frases, cenas, cores e estilo geram dois prompts (frente e verso) para uma IA de imagens; campos vazios ficam como [CAMPO]. Tamanho "Página inteira" (2550 × 3578, com as zonas: topo 0–640 para a cena e a frase, centro coberto pelo painel, margens e faixa de baixo visíveis) ou "Só o topo" (2550 × 640); os dois informam a altura mínima (640) e máxima (3578).
- **Banner**: trocado no lugar (selecionar o banner na página → Substituir banner; a imagem nova encaixa na mesma caixa). Ao aplicar outra arte com banner, o banner da página é trocado no lugar.
- **Arquivo → Salvar arte…**: guarda a configuração atual (cabeçalhos, banner com os textos sobre ele, posições de painel/título/validade/rodapé/grade, fundo e cores) como nova arte ou substituindo uma existente. Substituir uma arte embutida cria uma versão do usuário que aparece no lugar dela; "Restaurar original" na aba Artes desfaz.
- Artes do usuário ficam em `biblioteca-artes/` da pasta de trabalho (`artes.json` + imagens).

## Piloto: Natura Friday 2026

18 ofertas da planilha publicada. Layout igual ao Friday 2025: frente 3×4 com 6 células removidas para o banner (2 linhas × 3 colunas à direita), verso 3×4.
