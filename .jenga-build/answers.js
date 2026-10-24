(function(){
'use strict';
const key='solprosig-jenga-answers-v1';
let sending=false;
function pending(){try{return Object.keys(localStorage).filter(k=>k.startsWith(key+':')).map(k=>JSON.parse(localStorage.getItem(k)));}catch{throw new Error('No se pueden leer las respuestas pendientes de este navegador.');}}
function status(message){document.getElementById('answerSaveStatus').textContent=message;}
async function flush(){
 if(sending)return;
 sending=true;
 try{
  while(pending().length){
   const item=pending()[0],config=window.JENGA_PROJECT;
   if(!navigator.onLine)throw new Error('Sin conexión');
   const headers={'Content-Type':'application/json',apikey:config.key};
   if(config.key.startsWith('eyJ'))headers.Authorization='Bearer '+config.key;
   const res=await fetch(config.url+'/rest/v1/rpc/jenga_save_local_answer',{method:'POST',headers,body:JSON.stringify({p_answer:item}),signal:AbortSignal.timeout(12000)});
   if(!res.ok)throw new Error('No se pudo guardar');
   localStorage.removeItem(key+':'+item.id);
  }
  status('Respuestas guardadas en la base de datos.');
 }catch{status('Hay respuestas guardadas en este navegador pendientes de envío. Mantén esta página abierta o vuelve a abrirla con conexión.');}
 finally{sending=false;}
}
window.JengaAnswers={
 payload:()=>({response:document.getElementById('playerResponse').value.trim()}),
 recordLocal(state,response){
  const item={id:crypto.randomUUID(),session:state.sessionId,round:state.round,turn:state.turn,block:state.selectedId,alias:state.players.find(p=>p.id===state.activeId).name,response};
  try{localStorage.setItem(key+':'+item.id,JSON.stringify(item));}
  catch{throw new Error('No se pudo guardar la respuesta en este dispositivo. Habilita el almacenamiento del navegador y vuelve a intentar.');}
  status('Respuesta guardada en este navegador. Enviando…');void flush();
 },
 savedOnline(){status('Respuesta guardada en la base de datos.');}
};
window.addEventListener('online',flush);
setInterval(()=>{try{if(pending().length)void flush();}catch(e){status(e.message);}},15000);
try{if(pending().length)void flush();}catch(e){status(e.message);}
})();
