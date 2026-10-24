(function(){
'use strict';
const $=id=>document.getElementById(id),config=window.JENGA_PROJECT;
let token=null,rows=[],loading=false,generation=0;
function status(message){$('status').textContent=message;}
function clear(){rows=[];$('rows').replaceChildren();$('count').textContent='';$('download').disabled=true;}
function lock(){generation++;token=null;clear();$('reports').hidden=true;$('account').hidden=true;$('login').hidden=false;}
async function request(path,options={},bearer=token){
 const res=await fetch(config.url+path,{...options,headers:{apikey:config.key,'Content-Type':'application/json',...(bearer?{Authorization:'Bearer '+bearer}:{}),...options.headers},signal:AbortSignal.timeout(20000)});
 const body=await res.json().catch(()=>({}));
 if(!res.ok){if(res.status===401&&token){lock();throw new Error('Tu sesión venció. Vuelve a ingresar.');}throw new Error(path.startsWith('/auth/')?'No se pudo iniciar sesión. Revisa tu correo y contraseña.':body.code==='PGRST202'?'Falta instalar supabase/admin.sql.':'No se pudo consultar. Verifica tu conexión y tus permisos.');}
 return body;
}
$('login').addEventListener('submit',async event=>{
 event.preventDefault();$('signIn').disabled=true;status('Verificando acceso…');
 try{
  const auth=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:$('email').value.trim(),password:$('password').value})},null);
  token=auth.access_token;$('password').value='';
  const allowed=await request('/rest/v1/rpc/jenga_is_admin',{method:'POST',body:'{}'});
  if(allowed!==true){lock();throw new Error('Esta cuenta no tiene acceso de administrador.');}
  $('identity').textContent=auth.user.email;$('login').hidden=true;$('account').hidden=false;$('reports').hidden=false;status('Acceso autorizado. Consulta las respuestas para descargar.');
 }catch(e){lock();status(e.message);}finally{$('signIn').disabled=false;}
});
$('signOut').addEventListener('click',()=>{
 const previous=token;lock();status('Sesión cerrada.');
 void request('/auth/v1/logout',{method:'POST'},previous).catch(()=>{});
});
async function load(){
 if(!token||loading)return;
 clear();
 if($('from').value&&$('to').value&&$('from').value>$('to').value){status('La fecha inicial debe ser anterior a la final.');return;}
 loading=true;$('load').disabled=true;for(const id of ['from','to','alias'])$(id).disabled=true;const current=generation;status('Consultando…');
 try{
  const snapshot=await request('/rest/v1/rpc/jenga_answers_snapshot',{method:'POST',body:'{}'});
  const base=new URLSearchParams({select:'*',order:'id.asc',limit:'1000',id:'lte.'+snapshot});
  if($('from').value)base.append('created_at','gte.'+$('from').value+'T00:00:00Z');
  if($('to').value){const end=new Date($('to').value+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);base.append('created_at','lt.'+end.toISOString());}
  if($('alias').value.trim())base.set('alias','eq.'+$('alias').value.trim());
  let cursor=0;const result=[];
  while(true){
   const query=new URLSearchParams(base);query.append('id','gt.'+cursor);
   const batch=await request('/rest/v1/jenga_answers?'+query);
   if(current!==generation)return;
   if(!Array.isArray(batch))throw new Error('Respuesta de consulta inválida.');
   if(!batch.length)break;
   result.push(...batch);cursor=batch.at(-1).id;
  }
  rows=result;
  for(const row of rows.slice(0,100)){
   const tr=document.createElement('tr');
   for(const value of [row.created_at,row.alias,row.room_code||'Local',row.question,row.response]){const td=document.createElement('td');td.textContent=value;tr.appendChild(td);}
   $('rows').appendChild(tr);
  }
  $('count').textContent=rows.length+' respuestas. Vista previa: hasta 100 filas. El Excel incluye todas las respuestas consultadas.';
  $('download').disabled=!rows.length;status(rows.length?'Consulta lista. Puedes descargar el Excel.':'No hay respuestas para estos filtros.');
 }catch(e){clear();status(e.message);}finally{loading=false;$('load').disabled=false;for(const id of ['from','to','alias'])$(id).disabled=false;}
}
$('load').addEventListener('click',load);
for(const id of ['from','to','alias'])$(id).addEventListener('input',()=>{clear();status('Filtros modificados. Pulsa Consultar.');});
$('download').addEventListener('click',()=>{
 if(!rows.length||!token)return;
 const values=[['ID','Fecha de registro (UTC)','Alias','Modo','Sala','Sesión local','Ronda','Turno','Pieza','Pregunta #','Pregunta','Respuesta'],...rows.map(r=>[r.id,r.created_at,r.alias,r.mode,r.room_code||'',r.local_session||'',r.round_no,r.turn_no+1,r.block_id,r.question_no,r.question,r.response])];
 const blob=window.JengaXlsx(values),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='respuestas-jenga-'+new Date().toISOString().slice(0,10)+'.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
})();
