from pathlib import Path
import json
p=Path('SOLPROSIG_Jenga_Salud_Listo_Para_Usar (2).html')
s=Path('.jenga-build/base.html').read_text(encoding='utf-8-sig')
css='''
.jenga-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,1fr);gap:20px;margin:20px 0}.tower-stage{position:relative;border:1px solid #cadbd0;border-radius:20px;overflow:hidden;background:#eaf0eb}.tower-view{height:530px;touch-action:none}.tower-view canvas{display:block;width:100%;height:100%;cursor:grab}.tower-view canvas:active{cursor:grabbing}.tower-badge{position:absolute;left:14px;top:14px;pointer-events:none;background:#ffffffe6;padding:6px 12px;border-radius:30px;font-size:12px;font-weight:800;color:#27584c}.tower-controls{display:flex;align-items:center;justify-content:center;gap:10px;padding:10px;background:#ffffffb8;flex-wrap:wrap}.tower-controls button{border:1px solid #c3d7cb;background:white;border-radius:9px;min-width:42px;min-height:40px;color:#165348;font-weight:800}.tower-controls label{font-size:12px;display:flex;align-items:center;gap:6px}.tower-controls input{width:95px}.piece-card{align-self:center}.piece-card h3{font-size:29px;line-height:1.15;color:#07565b;margin:10px 0}.piece-card .btn{width:100%;margin-top:10px}.piece-card select{width:100%;padding:12px;border:1px solid #bed1c2;border-radius:10px;background:#fff;color:#20453d;margin:8px 0}.piece-card label{font-weight:800;font-size:13px}.tower-status{min-height:66px;background:#edf6ed;padding:12px;border-radius:12px;font-size:13px;color:#285b45;margin-top:15px}.tower-guide{font-size:13px;color:#526c61;line-height:1.6}.tower-guide summary{font-weight:800;cursor:pointer;color:#07565b}.tower-guide ol{padding-left:22px}.piece-card .fine{margin-top:12px}.tower-turns{font-size:12px;font-weight:800;color:#536b5b}.jenga-challenge{border-top:1px solid #e4d8bf;padding-top:22px;margin-top:20px}.jenga-challenge .wood-block{min-height:60px;font-size:16px;box-shadow:4px 4px 0 #ad773f;margin:12px 0 20px;width:240px}.jenga-challenge .challenge-title{font-size:23px}
@media(max-width:700px){.jenga-layout{grid-template-columns:1fr}.tower-view{height:440px}.piece-card h3{font-size:26px}.tower-controls button{width:auto}.tower-controls{gap:6px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
'''
s=s.replace('</style>',css+'\n</style>',1)
old='<p class="copy">Retira una pieza del Jenga gigante y pulsa <strong>Nuevo reto</strong>. Responde y descubre la orientación del facilitador.</p>'
new='''<p class="copy">Sortea una pieza y responde su pregunta. Retírala del Jenga real, colócala arriba y confirma para actualizar la torre 3D.</p>
      <div class="jenga-layout">
        <div class="tower-stage">
          <div class="tower-badge">54 piezas · madera y gravedad</div>
          <div id="towerView" class="tower-view"></div>
          <div class="tower-controls" aria-label="Controles de la cámara">
            <button id="rotateLeft" type="button" aria-label="Girar vista a la izquierda">↶</button>
            <span class="fine">Arrastra para girar</span>
            <button id="rotateRight" type="button" aria-label="Girar vista a la derecha">↷</button>
            <label>Distancia <input id="zoomTower" type="range" min="17" max="34" value="24" aria-label="Distancia de la cámara"></label>
          </div>
        </div>
        <div class="piece-card">
          <div class="cap">Tu siguiente movimiento</div>
          <h3 id="pieceInstruction">¿Qué pieza saldrá?</h3>
          <p id="pieceDetail" class="copy">Los niveles se cuentan desde la base.</p>
          <button id="drawBlock" type="button" class="btn primary" disabled>🎲 Sortear pieza</button>
          <label for="blockPicker">O elige la que vas a retirar</label>
          <select id="blockPicker" disabled><option value="">Seleccionar una pieza…</option></select>
          <button id="confirmBlock" type="button" class="btn primary" disabled>✓ Ya la retiré y la coloqué arriba</button>
          <div id="towerStatus" class="tower-status" role="status" aria-live="polite">Preparando la torre…</div>
          <p id="towerTurns" class="tower-turns">0 piezas retiradas</p>
          <button id="rebuildTower" type="button" class="btn outline">Reconstruir y abrir nueva ronda</button>
          <p class="fine">Extracción asistida; torre con gravedad y colisiones. La física es una aproximación visual. La pantalla no puede detectar ni predecir la caída de la torre real.</p>
        </div>
      </div>
      <details class="tower-guide"><summary>Cómo hacer coincidir tu Jenga real</summary>
        <ol><li>Arma 18 niveles de 3 piezas, alternando su dirección. Numera las piezas del 1 al 54, desde la base hacia arriba, siguiendo la torre de la pantalla.</li>
        <li>Gira la vista para ver los números impresos y copia ese orden en tu torre. Mantén la numeración de cada pieza cuando cambie de nivel.</li>
        <li>En tu turno, pulsa <strong>Sortear pieza</strong> o selecciona directamente un número. La pieza queda fija durante ese turno. Se excluyen los dos niveles superiores del sorteo.</li>
        <li>Responde la pregunta de esa pieza y consulta la respuesta. Coloca la pieza retirada arriba, completando grupos de tres con dirección alternada, y confirma para sincronizar el turno.</li></ol>
        <p>Si tu torre tiene otra cantidad de piezas o un orden distinto, usa la vista como referencia y acuerda la numeración con el facilitador. Solo el facilitador puede reconstruir y abrir una nueva ronda para todo el grupo.</p>
      </details>
      <div class="jenga-challenge">
      <div class="cap">Reto de salud del turno</div>'''
assert old in s
s=s.replace(old,new)
s=s.replace('<div class="jenga-layout">',Path('.jenga-build/session.html').read_text(encoding='utf-8')+'\n<div class="jenga-layout">',1)
s=s.replace('</style>','''
.session-card{padding:20px;border:1px solid #b8d8cc;border-radius:18px;background:#f5fbf6;margin:18px 0}.session-card h3{font-size:24px;line-height:1.2;margin:8px 0}.session-card label{display:block;font-size:13px;font-weight:800;margin:12px 0 5px}.session-card input,.session-card select,.session-card textarea{width:100%;padding:11px;border:1px solid #b9cfc1;border-radius:10px;background:white;color:#20453d;font:inherit;min-width:0}.session-card details{margin-top:14px}.session-card summary{cursor:pointer;font-weight:800}.session-card ol{display:flex;gap:10px 24px;flex-wrap:wrap;padding-left:24px}.current-player{font-weight:900;color:#087c78}[hidden]{display:none!important}.session-card .error{margin-top:10px}.answer-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
</style>''',1)
s=s.replace('<div class="reveal" id="challengeAnswer" role="status"></div>','<div class="answer-actions"><button id="markAnswered" type="button" class="btn primary" disabled>Ya respondí en voz alta</button></div><div class="reveal" id="challengeAnswer" role="status"></div>')
s=s.replace('Esta versión no guarda ni envía información; los datos se borran al cerrar o recargar la página.','Los indicadores de salud no se guardan ni se envían y se borran al recargar. Si entras a una sala, se envían a Supabase tu alias y los movimientos del juego. En ambos modos se guardan tu alias y tus respuestas escritas para consulta y descarga del equipo autorizado; en modo local quedan pendientes en este navegador hasta tener conexión. Evita escribir datos personales o indicadores de salud. El navegador conserva la sesión de la sala durante esta pestaña.')
s=s.replace('Esta versión no guarda ni envía información','Esta versión mantiene los indicadores de salud en este dispositivo')
s=s.replace('Los enlaces a referencias requieren conexión; esta aplicación funciona sin internet.','El modo local funciona sin internet. Las salas compartidas y los enlaces a referencias requieren conexión.')
s=s.replace('<button id="newChallenge" type="button" class="btn primary">🎲 Nuevo reto</button>','')
s=s.replace('<button id="seeAnswer" type="button" class="btn light">','<button id="seeAnswer" type="button" class="btn light" disabled>')
s=s.replace('<p class="challenge-title" id="challengeQuestion">¿Podrás retirar un bloque sin tumbar la torre?</p>', '<p class="challenge-title" id="challengeQuestion" aria-live="polite">Sortea o selecciona una pieza para ver su pregunta.</p>')
s=s.replace('<div class="counter" id="challengeCount">0 de 30 retos explorados</div>', '<div class="counter" id="challengeCount">0 de 30 preguntas respondidas</div><p class="fine">Cada pieza tiene una pregunta fija. Las piezas 1–30 usan las 30 preguntas existentes; las piezas 31–54 repiten las preguntas 1–24. Responde en voz alta y luego consulta la respuesta.</p>')
s=s.replace('Los retos no requieren revelar indicadores personales. Si alguna actividad física es incómoda, cambia por una respuesta verbal.</p>','Los retos no requieren revelar indicadores personales. Si alguna actividad física es incómoda, cambia por una respuesta verbal.</p>\n      </div>')
s=s.replace('  window.scrollTo(0,0);','  window.scrollTo(0,0);\n  if(page===\'juego\') window.dispatchEvent(new Event(\'jenga-open\'));')
s=s.replace("function restart(){el('healthForm')","function restart(){window.dispatchEvent(new Event('jenga-reset'));el('healthForm')")
s=s.replace("el('newChallenge').addEventListener('click',newChallenge);", "window.addEventListener('jenga-challenge',event=>setBlockChallenge(event.detail));\nwindow.addEventListener('jenga-board-reset',resetBlockChallenge);")
start=s.index('let remaining=challenges.map')
end=s.index('function restart()',start)
s=s[:start]+'''let remaining=challenges.map((_,i)=>i),current=null,visited=0;
let currentPiece=null;
const exploredQuestions=new Set();
function setBlockChallenge(detail){
  if(!detail||!Number.isInteger(detail.id)||detail.id<1||detail.id>54)return;
  const index=(detail.id-1)%challenges.length;
  const changed=currentPiece!==detail.id;
  currentPiece=detail.id;current=challenges[index];
  const color=detail.color||(window.JENGA_COLORS||[])[(detail.id-1)%6];
  const colorHtml=color?'<span class="color-badge" style="background:'+color.hex+';color:'+color.text+'">'+color.name.toUpperCase()+'</span> · ':'';
  el('blockLabel').innerHTML=colorHtml+current[3];
  el('challengeType').textContent=current[0]+(color?' · '+color.name:'');
  el('challengeQuestion').textContent=current[1];
  el('challengeAnswer').textContent='Respuesta o guía: '+current[2];
  if(changed){el('challengeAnswer').classList.remove('visible');el('seeAnswer').textContent='👀 Ver respuesta';}
  el('seeAnswer').disabled=false;
  if(detail.completed)exploredQuestions.add(index);
  el('challengeCount').textContent=exploredQuestions.size+' de 30 preguntas exploradas con piezas retiradas';
}
function resetBlockChallenge(){
  current=null;currentPiece=null;exploredQuestions.clear();
  el('blockLabel').textContent='¡TU RETO TE ESPERA!';
  el('challengeType').textContent='Una pieza, una pregunta';
  el('challengeQuestion').textContent='Sortea o selecciona una pieza para ver su pregunta.';
  el('challengeAnswer').classList.remove('visible');el('challengeAnswer').textContent='';
  el('seeAnswer').textContent='👀 Ver respuesta';el('seeAnswer').disabled=true;
  el('challengeCount').textContent='0 de 30 preguntas exploradas con piezas retiradas';
}
''' + s[end:]
s=s.replace('if(!current){newChallenge();return;}', 'if(!current)return;')
s=s.replace("function restart(){window.dispatchEvent(new Event('jenga-reset'));", "function restart(){window.dispatchEvent(new Event('jenga-reset'));resetBlockChallenge();")
s=s.replace("el('alertBox').replaceChildren();showPage('intro')", "el('alertBox').replaceChildren();resetBlockChallenge();showPage('intro')")
# La respuesta se revela mediante la sesión y se comparte con toda la sala.
answer_start=s.index("el('seeAnswer').addEventListener('click',")
answer_end=s.index("el('finish').addEventListener",answer_start)
s=s[:answer_start]+'''window.addEventListener('jenga-answer-state',event=>{
  el('challengeAnswer').classList.toggle('visible',!!event.detail.revealed);
});
'''+s[answer_end:]
s=s.replace("  el('seeAnswer').disabled=false;", "  el('seeAnswer').disabled=!window.JengaSession?.can('reveal');")
j=Path('.jenga-build/jenga.js').read_text(encoding='utf-8-sig').replace(" $('newChallenge').disabled=!ready||!selected;",'')
# El área de juego mantiene torre, pregunta y acciones en un único escenario.
game_start=s.index('  <section id="juego"')
game_end=s.index('  <section id="gracias"',game_start)
game=Path('.jenga-build/game.html').read_text(encoding='utf-8').replace('<!-- SESSION -->',Path('.jenga-build/session.html').read_text(encoding='utf-8'))
s=s[:game_start]+game+'\n'+s[game_end:]
s=s.replace('</style>',Path('.jenga-build/game.css').read_text(encoding='utf-8')+'\n</style>',1)
s=s.replace('  window.scrollTo(0,0);',"  window.scrollTo(0,0);\n  window.dispatchEvent(new CustomEvent('experience-page',{detail:{page}}));")
Path('.jenga-build/jenga.js').write_text(j,encoding='utf-8')
vendor='\n<!-- Bibliotecas integradas para funcionamiento sin internet. Three.js r160.1 y cannon-es 0.20.0 (MIT). -->\n<script>\n'+Path('.jenga-build/three.min.js').read_text(encoding='utf-8')+'\n</script>\n<script>\nwindow.CANNON=(function(){const exports={};\n'+Path('.jenga-build/cannon.cjs.js').read_text(encoding='utf-8')+'\nreturn exports;})();\n</script>\n'
vendor='<!--\n'+Path('.jenga-build/three-LICENSE.txt').read_text(encoding='utf-8')+'\n'+Path('.jenga-build/cannon-es-LICENSE.txt').read_text(encoding='utf-8')+'\n-->\n'+vendor
s=s.replace('<script>\n(function(){',vendor+'<script>\n(function(){',1)
config_path=Path('.jenga-build/supabase-config.json')
project_config=json.loads(config_path.read_text(encoding='utf-8')) if config_path.exists() else {}
config_js='window.JENGA_PROJECT='+json.dumps(project_config,ensure_ascii=True).replace('<','\\u003c')+';\n'
s=s.replace('</body>','<script>\n'+config_js+Path('.jenga-build/answers.js').read_text(encoding='utf-8')+'\n'+Path('.jenga-build/session.js').read_text(encoding='utf-8')+'\n</script>\n<script>\n'+Path('.jenga-build/motion.js').read_text(encoding='utf-8')+'\n</script>\n<script>\n'+j+'\n</script>\n<script>\n'+Path('.jenga-build/game-ui.js').read_text(encoding='utf-8')+'\n</script>\n</body>')
p.write_text(s,encoding='utf-8')
Path('index.html').write_text(s,encoding='utf-8')
print('HTML integrado:',p.stat().st_size,'bytes')
