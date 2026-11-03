@echo off
rem Alternativa a abrir natura\index.html direto: serve o editor em http://localhost:8765/natura/
rem (requer Python). Feche esta janela para encerrar.
cd /d "%~dp0"
start "" "http://localhost:8765/natura/"
python servidor.py 8765
