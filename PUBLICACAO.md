# Publicação no Cloudflare Pages

O editor fica em **https://panfleto.estrutura.dev/natura/**. É publicado pelo Cloudflare Pages a partir do repositório público [RafaelAugustScherer/panfleto](https://github.com/RafaelAugustScherer/panfleto): cada push na `main` gera um deploy.

## Estrutura

| Caminho | Papel |
|---|---|
| `natura/` | O editor (estático, sem build). A pasta tem o mesmo nome do caminho na URL. |
| `functions/natura/natura-imagem.js` | Pages Function da rota `/natura/natura-imagem`. Ela baixa as fotos do site da Natura, cujo servidor não libera CORS. Aceita só o host `production.na01.natura.com`. |
| `_redirects` | Manda a raiz `/` para `/natura/`. |
| `servidor.py` | Servidor local, no mesmo formato: http://localhost:8765/natura/ e a rota `natura/natura-imagem`. |
| `.gitignore` | Lista de permitidos. PSDs, pastas de campanha, `fonts/` e `.claude/` não entram no repositório. |

O site e o repositório são **públicos** (decisão de 02/11/2026). Por isso, qualquer pessoa com o endereço vê:

- as artes da Natura embutidas em `natura/biblioteca/`;
- o vídeo da extranet em `natura/img/fontes-sharepoint.mp4`.

As fontes licenciadas nunca entram: cada pessoa as baixa do SharePoint e as instala na própria pasta de trabalho.

## Configuração no Cloudflare (feita uma vez)

1. **Workers & Pages → Create → Pages → Connect to Git.** Escolher o repositório `panfleto`.
2. Preencher assim:
   - Production branch: `main`
   - Framework preset: *None*
   - Build command: vazio
   - Build output directory: `/`
   - Root directory: vazio
3. Esperar o primeiro deploy e conferir o endereço `panfleto-xxx.pages.dev/natura/`.
4. **Custom domains → Set up a custom domain** com `panfleto.estrutura.dev`. Com a zona `estrutura.dev` no Cloudflare, o registro DNS é criado sozinho. Se ela estiver em outro provedor, crie um CNAME de `panfleto` para `panfleto-xxx.pages.dev`.

## Atualizar

Basta dar commit e push na `main`. Antes, vale testar localmente com `Abrir editor (servidor local).bat`.

O Pages manda o navegador revalidar os arquivos a cada visita, então uma versão nova aparece ao recarregar a página.

## Pendências

- **Fallback no editor.** Quando `natura-imagem` falhar, mostrar "Copie a foto no site da Natura e cole com Ctrl+V" em vez do erro genérico.
