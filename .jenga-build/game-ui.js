(function(){
'use strict';
const $=id=>document.getElementById(id),mobile=matchMedia('(max-width:700px)'),menu=$('gameMenu');
let moving=false,responseKey='',lastStatus='',lastPiece=null;
let toastTimer=null;
function effect(node,frames,duration=400){if(window.JengaMotion?.enabled())node.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)'});}
function hideToast(){clearTimeout(toastTimer);$('turnToast').hidden=true;}
function openMenu(){if(!menu.open)menu.showModal();}
function closeMenu(){if(menu.open)menu.close();}
function fitViewport(){document.documentElement.style.setProperty('--game-height',Math.round(window.visualViewport?.height||innerHeight)+'px');}
function render(){
 const session=window.JengaSession,state=session?.getState(),playing=!!state&&state.status!=='lobby';
 const visible=$('juego').classList.contains('active');
 document.body.classList.toggle('jenga-focus',mobile.matches&&visible&&playing);
 $('playArena').hidden=!playing;$('openGameMenu').hidden=!state;
 document.querySelector('.session-card').classList.toggle('room-active',playing);
 if(playing){if($('roomLobby').parentElement!==$('gameMenuRoom'))$('gameMenuRoom').appendChild($('roomLobby'));}
 else if($('roomLobby').parentElement===$('gameMenuRoom'))$('roomLobbyMount').after($('roomLobby'));
 if(!visible){closeMenu();hideToast();document.body.classList.remove('tower-expanded');}
 if(state?.status!==lastStatus){closeMenu();lastStatus=state?.status||'';}
 const mine=!!state&&(!session.isOnline()||state.activeId===state.selfId),ended=state?.status==='ended';
 const chosen=state?.selectedId!==null&&state?.selectedId!==undefined;
 const step=moving?'move':!chosen?'choose':state.answered?'move':'answer';
 $('playArena').dataset.step=step;if($('diceColorSection'))$('diceColorSection').hidden=!mine||chosen||moving||ended;$('playArena').classList.toggle('is-moving',moving);
 document.querySelectorAll('[data-turn-step]').forEach(node=>{
  const order=['choose','answer','move'],index=order.indexOf(node.dataset.turnStep),current=order.indexOf(step);
  node.classList.toggle('is-current',index===current);node.classList.toggle('is-done',index<current);
  if(index===current)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
 });
 $('drawBlock').hidden=!playing||!mine||chosen||moving||ended;
 $('manualChoice').hidden=$('drawBlock').hidden;
 if(chosen)$('manualChoice').open=false;
 $('markAnswered').hidden=!playing||!mine||!chosen||state.answered||moving||ended;
 $('confirmBlock').hidden=!playing||!mine||!chosen||!state.answered||moving||ended;
 $('seeAnswer').hidden=!playing||!mine||!chosen||!state.answered||state.revealed||moving||ended;
 $('markAnswered').textContent='Guardar respuesta';$('confirmBlock').textContent='Siguiente turno →';$('seeAnswer').textContent=mobile.matches?'Ver guía':'Ver respuesta';
 $('waitingTurn').hidden=!playing||ended||(!moving&&mine);
 const active=state?.players.find(p=>p.id===state.activeId)?.name||'';
 $('waitingTurn').textContent=moving?'La torre se está acomodando…':'Juega '+active;
 $('openRoundMenu').hidden=!ended;$('roundEndHint').hidden=!ended;
 $('openRoundMenu').textContent=state?.isHost?'Abrir nueva ronda':'Ver la partida';
 $('responseArea').hidden=!playing||!mine||!chosen||state.answered||moving||ended;
 const key=state?[state.code,state.sessionId,state.round,state.turn,state.selectedId].join(':'):'';
 if(key!==responseKey){$('playerResponse').value='';$('playerResponse').style.height='';$('responseEcho').textContent='';responseKey=key;}
 const written=$('playerResponse').value.trim();
 $('responseEcho').hidden=!mine||!chosen||!state?.answered||!written;
 if(!$('responseEcho').hidden)$('responseEcho').textContent='Tu respuesta: '+written;
 $('actionHint').textContent=ended?'La ronda terminó.':moving?'Un momento, estamos colocando la pieza.':!mine?'Sigue la pieza y la pregunta del turno.':step==='choose'?'Marca el color del dado y toca en la torre el bloque que sacaron.':step==='answer'?'Escribe y guarda tu respuesta.':'Retira la pieza real y colócala arriba.';
 if(playing)$('turnMessage').textContent=ended?'Una nueva ronda, cuando el equipo esté listo.':moving?'Preparando el siguiente movimiento…':mine?'Tu turno · '+(chosen?(state.answered?'mueve tu bloque':'responde el reto'):'marca el color y toca el bloque sacado'):'Es el turno de '+active+'.';
 if(chosen&&lastPiece!==state.selectedId){
  document.body.classList.remove('tower-expanded');$('questionPanel').scrollTop=0;
  effect($('challengeQuestion'),[{opacity:.2,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],420);
  effect($('blockLabel'),[{transform:'scale(.88)'},{transform:'scale(1.07)',offset:.65},{transform:'scale(1)'}],650);
 }
 lastPiece=state?.selectedId;
 const expanded=document.body.classList.contains('tower-expanded');$('expandTower').setAttribute('aria-expanded',String(expanded));$('expandTower').setAttribute('aria-label',expanded?'Volver a la pregunta':'Ampliar torre');$('expandTower').textContent=expanded?'⤡':'⤢';
}
$('openGameMenu').addEventListener('click',openMenu);$('openRoundMenu').addEventListener('click',openMenu);$('closeGameMenu').addEventListener('click',closeMenu);
menu.addEventListener('click',event=>{if(event.target===menu){const r=menu.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeMenu();}});
$('expandTower').addEventListener('click',()=>{document.body.classList.toggle('tower-expanded');render();});
$('playerResponse').addEventListener('input',()=>{$('playerResponse').style.height='auto';$('playerResponse').style.height=Math.min($('playerResponse').scrollHeight,90)+'px';});
$('playerResponse').addEventListener('focus',()=>document.body.classList.add('response-focused'));
$('playerResponse').addEventListener('blur',()=>document.body.classList.remove('response-focused'));
$('markAnswered').addEventListener('click',()=>$('playerResponse').blur());
window.addEventListener('jenga-board-busy',event=>{moving=event.detail;render();});
window.addEventListener('jenga-permissions',render);window.addEventListener('jenga-challenge',render);window.addEventListener('jenga-answer-state',render);window.addEventListener('experience-page',render);
window.addEventListener('jenga-reset',()=>{moving=false;responseKey='';render();});
window.addEventListener('jenga-room-state',event=>{
 const {state,previous}=event.detail;if(!state||state.status!=='playing'){hideToast();return;}
 if(!previous||state.activeId!==previous.activeId||state.turn!==previous.turn||previous.status!=='playing'){
  if(!window.JengaMotion?.enabled())return;
  const name=state.players.find(p=>p.id===state.activeId)?.name||'';
  $('turnToast').textContent='Turno de '+name;clearTimeout(toastTimer);$('turnToast').hidden=false;
  effect($('turnToast'),[{opacity:0,transform:'translateY(-12px) scale(.9)'},{opacity:1,transform:'translateY(0) scale(1)',offset:.16},{opacity:1,transform:'translateY(0) scale(1)',offset:.8},{opacity:0,transform:'translateY(-5px) scale(.98)'}],2100);
  toastTimer=setTimeout(hideToast,2100);
  effect($('turnHeading'),[{opacity:.3,transform:'translateX(-8px)'},{opacity:1,transform:'translateX(0)'}],450);
 }
 if(state.revealed&&!previous?.revealed)effect($('challengeAnswer'),[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],400);
 if(state.answered&&!previous?.answered)effect($('confirmBlock'),[{transform:'scale(.94)'},{transform:'scale(1)'}],350);
});
window.addEventListener('jenga-motion-change',()=>{if(!window.JengaMotion?.enabled()){hideToast();document.querySelectorAll('#juego *').forEach(node=>node.getAnimations().forEach(animation=>animation.cancel()));}});
mobile.addEventListener('change',render);
window.visualViewport?.addEventListener('resize',fitViewport);window.addEventListener('resize',fitViewport);fitViewport();
render();
})();
