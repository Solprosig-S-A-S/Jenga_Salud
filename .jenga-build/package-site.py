"""Genera el juego y prepara únicamente los archivos públicos para GitHub Pages."""
from pathlib import Path
import runpy
import shutil

root = Path(__file__).resolve().parent.parent
if Path.cwd().resolve() != root:
    raise SystemExit('Ejecuta este script desde la raíz del proyecto.')
runpy.run_path(str(root / '.jenga-build' / 'integrate.py'), run_name='__main__')
output = root / '.pages'
output.mkdir(exist_ok=True)
shutil.copyfile(root / 'index.html', output / 'index.html')
(output / '.nojekyll').write_text('', encoding='utf-8')
files = {p.name for p in output.iterdir()}
if files != {'index.html', '.nojekyll'}:
    raise SystemExit('La carpeta .pages contiene archivos inesperados; revísala antes de publicar.')
print('Publicación preparada: .pages/index.html y .pages/.nojekyll')
