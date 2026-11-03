"""Servidor local do editor: como `python -m http.server`, mas manda o navegador
revalidar cada arquivo (Cache-Control: no-cache). Sem isso o Chrome guarda os .js
em cache por heurística e, depois de uma atualização, pode misturar scripts velhos
e novos (tela em branco).

Também baixa fotos do site da Natura para o editor (<pasta do editor>/natura-imagem?u=<url>):
o servidor de imagens delas não libera CORS, então o navegador não as lê direto. Publicado no
Cloudflare Pages, quem faz isso é a Function functions/natura/natura-imagem.js.

Uso: python servidor.py [porta] [pasta]   (padrão: 8765, a pasta deste arquivo)
O editor fica em http://localhost:8765/natura/, o mesmo caminho do site publicado.
"""
import functools
import http.server
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

HOSTS_NATURA = {"production.na01.natura.com"}


class SemCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        if url.path.endswith("/natura-imagem"):
            return self.natura_imagem(urllib.parse.parse_qs(url.query).get("u", [""])[0])
        super().do_GET()

    def natura_imagem(self, alvo):
        partes = urllib.parse.urlsplit(alvo)
        if partes.scheme != "https" or partes.hostname not in HOSTS_NATURA:
            return self.send_error(400, "Só imagens do site da Natura")
        try:
            req = urllib.request.Request(alvo, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                corpo, tipo = r.read(), r.headers.get("Content-Type", "image/jpeg")
        except urllib.error.HTTPError as e:
            return self.send_error(e.code)
        except (urllib.error.URLError, TimeoutError) as e:
            return self.send_error(502, str(e))
        if not tipo.startswith("image/"):
            return self.send_error(415)
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)


porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
pasta = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
handler = functools.partial(SemCache, directory=pasta)
with http.server.ThreadingHTTPServer(("127.0.0.1", porta), handler) as srv:
    print(f"Servindo {pasta} em http://localhost:{porta}/ (Ctrl+C para encerrar)")
    srv.serve_forever()
