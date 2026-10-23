(function(){
'use strict';
const preference=matchMedia('(prefers-reduced-motion:reduce)'),key='solprosig-jenga-motion';
let saved=null;try{saved=sessionStorage.getItem(key);}catch{}
let enabled=!preference.matches&&saved!=='off',pausedUntil=0;
function render(){
 document.body.classList.toggle('motion-paused',!enabled);
 const button=document.getElementById('motionToggle');
 button.textContent=enabled?'⏸':'▶';button.setAttribute('aria-pressed',String(enabled));
 button.setAttribute('aria-label',enabled?'Pausar animaciones automáticas':'Activar animaciones automáticas');
 window.dispatchEvent(new Event('jenga-motion-change'));
}
window.JengaMotion={enabled:()=>enabled,paused:()=>performance.now()<pausedUntil,pause:(ms=8000)=>{pausedUntil=performance.now()+ms;}};
document.getElementById('motionToggle').addEventListener('click',()=>{enabled=!enabled;try{sessionStorage.setItem(key,enabled?'on':'off');}catch{}render();});
preference.addEventListener('change',()=>{if(preference.matches)enabled=false;render();});
render();
})();
