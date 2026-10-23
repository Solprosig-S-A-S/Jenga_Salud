# Mi salud, bloque a bloque · SOLPROSIG

Juego educativo con una torre Jenga 3D, 30 preguntas de autocuidado y partidas por turnos. Incluye modo local sin internet y salas de Supabase para compartir la pieza, la pregunta, la respuesta y el turno entre dispositivos.

**Juego:** https://solprosig-s-a-s.github.io/Jenga_Salud/

## Jugar

Abre `index.html` o [el juego en GitHub Pages](https://solprosig-s-a-s.github.io/Jenga_Salud/). Completa la experiencia inicial y entra a Jenga. Para jugar en grupo desde diferentes celulares, crea una sala, comparte la invitación y espera a que los participantes entren antes de iniciar.

La URL y la clave pública del proyecto Supabase ya están integradas. El SQL fue instalado y comprobado en el proyecto real. Los indicadores de salud permanecen en cada dispositivo; las salas comparten alias y movimientos. Consulta [la guía de las salas](supabase/LEEME.md) para el flujo completo.

## Publicar con GitHub Pages

1. Sube este proyecto al repositorio de la organización, en la rama `main`.
2. En el repositorio, selecciona **Settings → Pages → Source → GitHub Actions**.
3. Ejecuta **Actions → Publicar Jenga Salud → Run workflow**, o sube un cambio a `main`.
4. Abre la dirección que aparece en el despliegue `github-pages` y úsala para crear y compartir las salas.

El flujo reconstruye el HTML y publica solo `index.html` y `.nojekyll`. El SQL y los archivos de desarrollo quedan en el repositorio y no forman parte del sitio desplegado. La configuración sigue el [flujo oficial de sitios estáticos de GitHub](https://github.com/actions/starter-workflows/blob/main/pages/static.yml).

## Actualizar el juego

Las fuentes están en `.jenga-build`: `base.html`, `jenga.js`, `session.html`, `session.js` y `supabase-config.json`. Después de modificarlas, ejecuta desde la raíz:

La interfaz de juego está en `game.html`, `game.css` y `game-ui.js`. En el celular, la torre, la pregunta y las acciones ocupan una pantalla; el menú reúne los participantes y las instrucciones. La respuesta escrita es opcional y se borra al avanzar de turno; no se envía a Supabase.

```powershell
python .jenga-build/package-site.py
```

Esto actualiza tanto `index.html` como `SOLPROSIG_Jenga_Salud_Listo_Para_Usar (2).html`, y prepara `.pages` para publicar. Ambos HTML son autónomos y tienen el mismo contenido. El despliegue también realiza este paso automáticamente.

## Validación

```powershell
npm.cmd ci --prefix .jenga-build
node .jenga-build/check-supabase.cjs
node .jenga-build/check-local-turns.cjs
node .jenga-build/check-rooms.cjs
node .jenga-build/check-mobile.cjs
```

Las pruebas de navegador usan Chrome instalado en Windows. Las pruebas de salas interceptan HTTP y ejecutan el SQL en PostgreSQL local mediante PGlite; no modifican el proyecto real de Supabase.

Three.js y cannon-es se distribuyen integrados bajo sus licencias MIT, incluidas en el HTML y en `.jenga-build`.
