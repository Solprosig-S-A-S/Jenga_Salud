"""Genera el juego y prepara únicamente los archivos públicos para GitHub Pages."""
from pathlib import Path
import runpy
import shutil
import json

root = Path(__file__).resolve().parent.parent
if Path.cwd().resolve() != root:
    raise SystemExit('Ejecuta este script desde la raíz del proyecto.')
runpy.run_path(str(root / '.jenga-build' / 'integrate.py'), run_name='__main__')
output = root / '.pages'
output.mkdir(exist_ok=True)
shutil.copyfile(root / 'index.html', output / 'index.html')
(output / '.nojekyll').write_text('', encoding='utf-8')
config = json.loads((root / '.jenga-build/supabase-config.json').read_text(encoding='utf-8'))
scripts = 'window.JENGA_PROJECT=' + json.dumps(config).replace('<', '\\u003c') + ';\n'
scripts += (root / '.jenga-build/xlsx.js').read_text(encoding='utf-8') + '\n'
scripts += (root / '.jenga-build/admin.js').read_text(encoding='utf-8')
admin = (root / '.jenga-build/admin.html').read_text(encoding='utf-8').replace('/* ADMIN_SCRIPTS */', scripts)
(root / 'admin.html').write_text(admin, encoding='utf-8')
(output / 'admin.html').write_text(admin, encoding='utf-8')
files = {p.name for p in output.iterdir()}
if files != {'index.html', 'admin.html', '.nojekyll'}:
    raise SystemExit('La carpeta .pages contiene archivos inesperados; revísala antes de publicar.')
print('Publicación preparada: juego, admin.html y .nojekyll')
