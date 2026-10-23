(function(){
'use strict';
const $=id=>document.getElementById(id), storageKey='solprosig-jenga-room-v1';
let state=null,mode='online',config=null,token=null,busy=false,healthy=false,timer=null,boardBusy=false,lastRevision=-1;
const getSaved=()=>{try{return JSON.parse(sessionStorage.getItem(storageKey)||'null');}catch{return null;}};
function save(){try{sessionStorage.setItem(storageKey,JSON.stringify({config,token,code:state?.code}));}catch{}}
function error(message){$('roomError').textContent=message||'';$('roomError').classList.toggle('show',!!message);}
function active(){return state?.players.find(p=>p.id===state.activeId);}
function can(action){
  if(!state||busy||(mode==='online'&&!healthy))return false;
  const mine=mode==='local'||state.activeId===state.selfId;
  if(action==='start')return state.isHost&&state.status==='lobby'&&state.players.length>=2;
  if(action==='reset')return state.isHost;
  if(action==='end')return state.isHost&&state.status==='playing';
  if(state.status!=='playing'||!mine)return false;
  if(action==='draw')return !boardBusy&&state.selectedId===null;
  if(action==='answer')return state.selectedId!==null&&!state.answered;
  if(action==='reveal')return state.selectedId!==null&&state.answered&&!state.revealed;
  if(action==='complete')return !boardBusy&&state.selectedId!==null&&state.answered;
  return false;
}
function render(){
  $('sessionSetup').hidden=!!state;$('roomLobby').hidden=!state;
  if(state){
    const person=active();
    $('turnHeading').textContent=state.status==='ended'?'Ronda terminada':state.status==='lobby'?'Esperando al grupo':('Turno '+(state.turn+1)+' · '+(person?.name||''));
    $('turnMessage').textContent=state.status==='lobby'?'El facilitador inicia cuando todos estén en la sala.':(mode==='local'?'Pasa el dispositivo a '+person?.name+'.':(state.activeId===state.selfId?'Es tu turno.':'Espera: está jugando '+person?.name+'.'))+' Primero elige una pieza, responde en voz alta y confirma su retirada.';
    if(state.status==='ended')$('turnMessage').textContent='El facilitador puede reconstruir la torre y abrir una nueva ronda con el mismo grupo.';
    $('roomIdentity').textContent=mode==='local'?'Partida local · orden obligatorio':'Sala '+state.code+' · tú: '+(state.players.find(p=>p.id===state.selfId)?.name||'');
    $('playerOrder').replaceChildren(...state.players.map(p=>{const li=document.createElement('li');li.textContent=p.name+(p.id===state.activeId?' · jugando ahora':'');if(p.id===state.activeId)li.className='current-player';return li;}));
  }else{
    $('turnHeading').textContent='Crea una sala o reúne a tu grupo';
    $('turnMessage').textContent='Cada participante responde y confirma su movimiento antes de pasar al siguiente.';
  }
  $('startRoom').hidden=!state?.isHost||state?.status!=='lobby';$('startRoom').disabled=!can('start');
  $('shareRoom').hidden=!state||mode!=='online';
  $('endRoom').hidden=!state?.isHost||state?.status!=='playing';$('endRoom').disabled=!can('end');
  $('markAnswered').disabled=!can('answer');$('seeAnswer').disabled=!can('reveal');
  $('markAnswered').textContent=state?.answered?'✓ Respuesta registrada':'Ya respondí en voz alta';
  $('rebuildTower').disabled=!!state&&!can('reset');
  ['createRoom','joinRoom','startLocal','roomMode'].forEach(id=>$(id).disabled=busy);
  $('connectionStatus').textContent=state?(mode==='local'?'Turnos en este dispositivo.':(healthy?'Conectado · cambios compartidos cada 2 segundos.':'Sin conexión. Los movimientos están bloqueados hasta reconectar.')):'';
  window.dispatchEvent(new Event('jenga-permissions'));
}
function apply(next){
  if(state&&next.code===state.code&&next.revision<lastRevision)return;
  const previous=state;state=next;lastRevision=next.revision;healthy=true;save();render();
  if(!previous||previous.code!==next.code||previous.revision!==next.revision){
    window.dispatchEvent(new CustomEvent('jenga-room-state',{detail:{state:next,previous}}));
    if(next.selectedId!==null)window.dispatchEvent(new CustomEvent('jenga-challenge',{detail:{id:next.selectedId}}));
    window.dispatchEvent(new CustomEvent('jenga-answer-state',{detail:{revealed:next.revealed}}));
  }
}
function readConfig(){
  const url=$('supabaseUrl').value.trim().replace(/\/+$/,''),key=$('supabaseKey').value.trim();
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))throw new Error('Escribe la URL HTTPS de tu proyecto Supabase.');
  let valid=key.startsWith('sb_publishable_')&&key.length>25;
  if(key.startsWith('eyJ')){try{const part=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');valid=JSON.parse(atob(part)).role==='anon';}catch{}}
  if(!valid)throw new Error('Usa la clave pública publishable o anon. Las claves secretas y service_role no se aceptan.');
  return {url,key};
}
async function rpc(action,payload={},code=state?.code||''){
  const headers={'Content-Type':'application/json',apikey:config.key};
  if(config.key.startsWith('eyJ'))headers.Authorization='Bearer '+config.key;
  let response;
  try{response=await fetch(config.url+'/rest/v1/rpc/jenga_room',{method:'POST',headers,body:JSON.stringify({p_action:action,p_code:code,p_token:token,p_name:$('playerName').value.trim(),p_expected:state?.revision??-1,p_payload:payload}),signal:AbortSignal.timeout(12000)});}catch{throw new Error('No se pudo conectar con Supabase. Revisa tu conexión y la URL del proyecto.');}
  const body=await response.json().catch(()=>({}));
  if(!response.ok){if(body.code==='PGRST202')throw new Error('Falta instalar supabase/jenga.sql en el SQL Editor del proyecto.');throw new Error(body.message||'Supabase rechazó la operación. Revisa la clave pública y el SQL.');}
  return body;
}
function localAction(action,payload){
  const next=structuredClone(state);
  if(action==='start'){next.status='playing';next.activeId=next.players[0].id;}
  if(action==='draw'){
    if(!Number.isInteger(payload.blockId)||payload.blockId<1||payload.blockId>54)throw new Error('Selecciona una pieza válida.');
    next.selectedId=payload.blockId;next.answered=false;next.revealed=false;
  }
  if(action==='answer')next.answered=true;
  if(action==='reveal')next.revealed=true;
  if(action==='complete'){next.moves.push(next.selectedId);next.selectedId=null;next.answered=false;next.revealed=false;next.turn++;next.activeId=next.players[(next.players.findIndex(p=>p.id===next.activeId)+1)%next.players.length].id;}
  if(action==='reset'){Object.assign(next,{status:'lobby',selectedId:null,answered:false,revealed:false,turn:0,moves:[],activeId:null});}
  if(action==='end')next.status='ended';
  next.revision++;return next;
}
async function sync(){
  if(busy||mode!=='online'||!state||document.hidden)return;
  busy=true;
  try{const next=await rpc('sync');apply(next);error('');}catch(e){healthy=false;error(e.message);}finally{busy=false;render();}
}
async function act(action,payload={}){
  if(!can(action))return false;
  busy=true;error('');render();
  try{apply(mode==='local'?localAction(action,payload):await rpc(action,payload));return true;}
  catch(e){error(e.message);if(mode==='online')healthy=false;return false;}
  finally{busy=false;render();}
}
async function connect(action){
  if(busy)return;
  error('');busy=true;render();
  try{
    config=readConfig();mode='online';
    if(!$('playerName').value.trim())throw new Error('Escribe un alias para participar.');
    const saved=getSaved(),freshRoom=action==='create'&&!!saved?.code;
    token=!freshRoom&&saved?.config?.url===config.url&&saved.token?saved.token:crypto.randomUUID()+crypto.randomUUID();
    // Guardar antes del primer request permite recuperar una creación cuya respuesta se pierda.
    save();
    const code=$('roomCode').value.trim().toUpperCase();
    if(action==='join'&&!/^[A-F0-9]{10}$/.test(code))throw new Error('El código tiene 10 letras o números.');
    const next=await rpc(action,{},code);lastRevision=-1;apply(next);startPolling();
  }catch(e){error(e.message);}finally{busy=false;render();}
}
function startPolling(){clearInterval(timer);timer=setInterval(sync,2000);}
function startLocal(){
  const names=$('localPlayers').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(names.length<2||names.length>30||names.some(s=>s.length>30)){error('Ingresa entre 2 y 30 alias, de hasta 30 caracteres cada uno.');return;}
  if(new Set(names.map(s=>s.toLocaleLowerCase())).size!==names.length){error('Usa un alias diferente para cada participante.');return;}
  clearInterval(timer);mode='local';token=null;config=null;lastRevision=-1;
  apply({code:'LOCAL',revision:0,status:'playing',players:names.map((name,seat)=>({id:String(seat),name,seat})),selfId:'0',isHost:true,activeId:'0',selectedId:null,answered:false,revealed:false,turn:0,moves:[]});error('');
}
$('roomMode').addEventListener('change',()=>{$('localSetup').hidden=$('roomMode').value!=='local';$('onlineSetup').hidden=$('roomMode').value!=='online';});
$('createRoom').addEventListener('click',()=>connect('create'));$('joinRoom').addEventListener('click',()=>connect('join'));
$('startLocal').addEventListener('click',startLocal);$('startRoom').addEventListener('click',()=>act('start'));
$('endRoom').addEventListener('click',()=>act('end'));
$('markAnswered').addEventListener('click',()=>act('answer'));$('seeAnswer').addEventListener('click',()=>act('reveal'));
$('leaveRoom').addEventListener('click',()=>{if(busy)return;clearInterval(timer);state=null;lastRevision=-1;boardBusy=false;healthy=false;error('');render();window.dispatchEvent(new CustomEvent('jenga-room-state',{detail:{state:null}}));});
$('shareRoom').addEventListener('click',async()=>{
  if(!state||mode!=='online')return;
  const url=new URL(location.href);url.hash=new URLSearchParams({sala:state.code,sb:config.url,key:config.key}).toString();
  const invitation=location.protocol==='file:'?'Sala '+state.code+' · Abre la versión publicada del juego para entrar.':url.href;
  try{await navigator.clipboard.writeText(invitation);$('connectionStatus').textContent=location.protocol==='file:'?'Código copiado. Publica el HTML para compartir un enlace que funcione en otros celulares.':'Invitación copiada. Compártela con tu grupo.';}catch{$('connectionStatus').textContent=invitation;}
});
window.addEventListener('jenga-board-busy',event=>{boardBusy=event.detail;render();});
window.addEventListener('jenga-reset',()=>{if(mode==='local'){state=null;lastRevision=-1;boardBusy=false;render();}});
window.addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
window.JengaSession={can,act,getState:()=>state,isOnline:()=>mode==='online'&&!!state};
const invite=new URLSearchParams(location.hash.slice(1)),saved=getSaved();
const defaults=window.JENGA_PROJECT||{};
$('supabaseUrl').value=defaults.url||'';$('supabaseKey').value=defaults.key||'';
if(invite.has('sala')){$('roomCode').value=invite.get('sala');$('supabaseUrl').value=invite.get('sb')||defaults.url||'';$('supabaseKey').value=invite.get('key')||defaults.key||'';}
else if(saved?.config){$('supabaseUrl').value=saved.config.url;$('supabaseKey').value=saved.config.key;}
$('connectionSettings').open=!$('supabaseUrl').value||!$('supabaseKey').value;
if(saved?.code&&saved.config&&(!invite.has('sala')||invite.get('sala')===saved.code)){
  config=saved.config;token=saved.token;
  busy=true;
  rpc('sync',{},saved.code).then(next=>{apply(next);startPolling();}).catch(e=>error(e.message)).finally(()=>{busy=false;render();});
}
render();
})();
