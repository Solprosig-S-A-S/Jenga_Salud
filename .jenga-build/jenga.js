(function(){
'use strict';
const $=id=>document.getElementById(id), host=$('towerView');
let scene,camera,renderer,world,blocks=[],selected=null,phase='ready',motion=null,elapsed=0,turn=0,topSlots=0,fallen=false,started=false,last=0;
let azimuth=.72,elevation=.24,radius=24,drag=null;
let appliedMoves=[],roomCode=null,pendingCanonical=null;
const session=()=>window.JengaSession;
const H=.6,W=1,L=3,GAP=.018,STEP=H+.004;
const wood=new CANNON.Material('wood'),sliding=new CANNON.Material('sliding-wood');
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
function status(message){$('towerStatus').textContent=message;}
function eligible(){const highest=Math.max(...blocks.map(b=>b.level));return blocks.filter(b=>b.level<highest-1&&b.body.position.y>.25&&Math.abs(b.body.position.y-b.homeY)<.4);}
function controls(){const ready=phase==='ready'&&!fallen;
 $('drawBlock').disabled=!ready||!session()?.can('draw');$('blockPicker').disabled=!ready||!session()?.can('draw');$('confirmBlock').disabled=!ready||!selected||!session()?.can('complete');

}
function options(){const list=$('blockPicker');list.replaceChildren(new Option('Seleccionar una pieza…',''));eligible().sort((a,b)=>a.id-b.id).forEach(b=>list.add(new Option('#'+b.id+' · nivel '+(b.level+1)+' · posición '+(b.slot+1),b.id)));}
function select(b){if(!b)return;selected=b;$('blockPicker').value=b.id;
 window.dispatchEvent(new CustomEvent('jenga-challenge',{detail:{id:b.id}}));
 $('pieceInstruction').textContent='Saca la pieza #'+b.id;
 $('pieceDetail').textContent='Nivel '+(b.level+1)+' · posición '+(b.slot+1)+'/3';
 status('Pieza asignada. Responde su pregunta antes de confirmar la retirada.');controls();}
function choose(b){if(phase!=='ready'||fallen||!session()?.can('draw')||!eligible().includes(b))return;session().act('draw',{blockId:b.id});}
function canonical(moves){
 pendingCanonical=null;window.dispatchEvent(new CustomEvent('jenga-board-busy',{detail:false}));
 blocks.forEach(b=>{b.level=Math.floor((b.id-1)/3);b.slot=(b.id-1)%3;});
 moves.forEach((id,index)=>{const b=blocks.find(b=>b.id===id);if(b){b.level=18+Math.floor(index/3);b.slot=index%3;}});
 blocks.forEach(b=>{const pos=(b.slot-1)*(W+GAP);b.homeY=H/2+b.level*STEP;b.body.type=CANNON.Body.DYNAMIC;b.body.material=wood;b.body.mass=.3;b.body.updateMassProperties();b.body.position.set(b.level%2?pos:0,b.homeY,b.level%2?0:pos);b.body.quaternion.setFromEuler(0,b.level%2?Math.PI/2:0,0);b.body.velocity.setZero();b.body.angularVelocity.setZero();b.body.aabbNeedsUpdate=true;b.body.wakeUp();});
 topSlots=moves.length;turn=moves.length;appliedMoves=[...moves];fallen=false;motion=null;selected=null;phase='settling';elapsed=0;
 $('towerTurns').textContent=turn+(turn===1?' pieza retirada':' piezas retiradas');options();controls();
}
function roomUpdate(next,previous){
 if(!world)return;
 if(!next){reset();appliedMoves=[];roomCode=null;return;}
 const moves=next.moves;
 const newRoom=roomCode!==next.code;roomCode=next.code;
 if(newRoom||moves.length<appliedMoves.length||(!previous&&moves.length)){
   window.dispatchEvent(new Event('jenga-board-reset'));canonical(moves);
   moves.forEach(id=>window.dispatchEvent(new CustomEvent('jenga-challenge',{detail:{id,completed:true}})));
 }else if(moves.length>appliedMoves.length){
   const added=moves.slice(appliedMoves.length);appliedMoves=[...moves];
   added.forEach(id=>window.dispatchEvent(new CustomEvent('jenga-challenge',{detail:{id,completed:true}})));
   if(added.length===1&&phase==='ready'&&!fallen){selected=blocks.find(b=>b.id===added[0]);pendingCanonical=moves;extract();}
   else canonical(moves);
 }
 if(next.status==='lobby'&&previous?.status!=='lobby'){window.dispatchEvent(new Event('jenga-board-reset'));canonical([]);}
 if(next.selectedId!==null&&!motion)select(blocks.find(b=>b.id===next.selectedId));
 else if(!motion)selected=null;
 window.dispatchEvent(new CustomEvent('jenga-answer-state',{detail:{revealed:next.revealed}}));
 controls();
}
function aim(){camera.position.set(Math.sin(azimuth)*radius*Math.cos(elevation),5.5+Math.sin(elevation)*radius,Math.cos(azimuth)*radius*Math.cos(elevation));camera.lookAt(0,5.5,0);}
function texture(id,end=false){const c=document.createElement('canvas');c.width=end?192:512;c.height=128;const x=c.getContext('2d');x.fillStyle='#d9aa70';x.fillRect(0,0,512,128);
 let seed=id*719+13;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
 for(let i=0;i<100;i++){x.strokeStyle='rgba(99,54,22,'+(.025+rnd()*.10)+')';x.lineWidth=.4+rnd()*1.2;x.beginPath();const y=rnd()*128; x.moveTo(0,y);x.bezierCurveTo(130,y+8*rnd(),350,y-8*rnd(),512,y+5*rnd());x.stroke();}
 x.fillStyle='#613b21';x.font='bold 58px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(String(id).padStart(2,'0'),end?96:256,68);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
function init(){if(started)return;started=true;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){host.textContent='No se pudo iniciar la vista 3D. Puedes seguir usando las instrucciones y los retos.';status('Vista 3D no disponible en este navegador.');$('drawBlock').disabled=true;$('confirmBlock').disabled=true;return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0xeaf0eb);host.appendChild(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Torre Jenga 3D. Arrastra para girar; usa el selector para elegir piezas.');
 scene=new THREE.Scene();scene.fog=new THREE.Fog(0xeaf0eb,35,65);camera=new THREE.PerspectiveCamera(39,1,.1,100);aim();
 scene.add(new THREE.HemisphereLight(0xfff6e3,0x637967,1.8));const light=new THREE.DirectionalLight(0xfff1d9,2);light.position.set(7,16,8);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-12,right:12,top:15,bottom:-12});light.shadow.normalBias=.025;scene.add(light);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:0xd4dfd5,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.23;floor.receiveShadow=true;scene.add(floor);
 const base=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.65,.22,64),new THREE.MeshStandardMaterial({color:0x294f48,roughness:.8}));base.position.y=-.115;scene.add(base);
 world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0),allowSleep:true});world.broadphase=new CANNON.SAPBroadphase(world);world.solver.iterations=40;world.solver.tolerance=.0001;
 world.addContactMaterial(new CANNON.ContactMaterial(wood,wood,{friction:.35,restitution:0,contactEquationStiffness:1e8,contactEquationRelaxation:4}));
 world.addContactMaterial(new CANNON.ContactMaterial(wood,sliding,{friction:.015,restitution:0,contactEquationStiffness:1e8,contactEquationRelaxation:4}));
 const ground=new CANNON.Body({mass:0,material:wood,shape:new CANNON.Plane()});ground.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(ground);
 reset();roomUpdate(session()?.getState(),null);new ResizeObserver(resize).observe(host);
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;azimuth-=(e.clientX-drag.x)*.009;elevation=Math.max(-.05,Math.min(.8,elevation+(e.clientY-drag.y)*.005));drag.x=e.clientX;drag.y=e.clientY;aim();});
 canvas.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.ox,e.clientY-drag.oy)<6){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(blocks.map(b=>b.mesh));if(hits.length)choose(hits[0].object.userData.block);}drag=null;});
 canvas.addEventListener('pointercancel',()=>drag=null);
 requestAnimationFrame(frame);
}
function resize(){if(!renderer||!host.clientWidth)return;const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function reset(){if(!world)return;
 window.dispatchEvent(new Event('jenga-board-reset'));
 blocks.forEach(b=>{world.removeBody(b.body);scene.remove(b.mesh);b.mesh.geometry.dispose();new Set(b.mesh.material).forEach(m=>{m.map.dispose();m.dispose();});});blocks=[];selected=null;motion=null;turn=0;topSlots=0;fallen=false;elapsed=0;phase='settling';
 for(let level=0;level<18;level++)for(let slot=0;slot<3;slot++){
 const id=level*3+slot+1,pos=(slot-1)*(W+GAP),y=H/2+level*STEP;
 const body=new CANNON.Body({mass:.3,material:wood,shape:new CANNON.Box(new CANNON.Vec3(L/2,H/2,W/2)),linearDamping:.18,angularDamping:.35,sleepSpeedLimit:.06,sleepTimeLimit:1});body.position.set(level%2?pos:0,y,level%2?0:pos);body.quaternion.setFromEuler(0,level%2?Math.PI/2:0,0);world.addBody(body);
 const longMat=new THREE.MeshStandardMaterial({map:texture(id),roughness:.83,color:0xf2e2cc});
 const endMat=new THREE.MeshStandardMaterial({map:texture(id,true),roughness:.9,color:0xf2e2cc});
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(L,H,W),[endMat,endMat,longMat,longMat,longMat,longMat]);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
 const b={id,level,slot,body,mesh,homeY:y};mesh.userData.block=b;blocks.push(b);}
 $('pieceInstruction').textContent='¿Qué pieza saldrá?';$('pieceDetail').textContent='Sortea una pieza o elige su número. Los niveles se cuentan desde la base.';$('towerTurns').textContent='0 piezas retiradas';status('La madera se está asentando…');options();controls();}
function extract(){if(!selected||phase!=='ready'||fallen)return;window.dispatchEvent(new CustomEvent('jenga-board-busy',{detail:true}));const b=selected;phase='pulling';elapsed=0;const dir=new CANNON.Vec3();b.body.quaternion.vmult(new CANNON.Vec3(1,0,0),dir);dir.y=0;dir.normalize();motion={b,origin:b.body.position.clone(),dir};b.body.material=sliding;b.body.type=CANNON.Body.KINEMATIC;b.body.updateMassProperties();b.body.angularVelocity.setZero();b.body.velocity.copy(dir.scale(.55));world.bodies.forEach(x=>x.wakeUp());status('Retirando #'+b.id+' · la torre está buscando su equilibrio…');controls();}
function place(){const b=motion.b,level=18+Math.floor(topSlots/3),slot=topSlots%3,pos=(slot-1)*(W+GAP);b.level=level;b.slot=slot;b.homeY=H/2+level*STEP;
 b.body.material=wood;b.body.type=CANNON.Body.DYNAMIC;b.body.mass=.3;b.body.updateMassProperties();b.body.position.set(level%2?pos:0,b.homeY+.10,level%2?0:pos);b.body.quaternion.setFromEuler(0,level%2?Math.PI/2:0,0);b.body.velocity.setZero();b.body.angularVelocity.setZero();b.body.aabbNeedsUpdate=true;b.body.wakeUp();topSlots++;turn++;$('towerTurns').textContent=turn+(turn===1?' pieza retirada':' piezas retiradas');phase='settling';elapsed=0;selected=null;motion=null;status('Pieza colocada arriba. Esperando a que la torre se estabilice…');}
function collapse(){fallen=true;phase='fallen';selected=null;if(motion){motion.b.body.material=wood;motion.b.body.type=CANNON.Body.DYNAMIC;motion.b.body.updateMassProperties();motion.b.body.wakeUp();}motion=null;status('La torre virtual cayó. Si la torre real sigue en pie, puedes reconstruir la simulación.');$('pieceInstruction').textContent='¡La torre perdió el equilibrio!';$('pieceDetail').textContent='Reconstruye la torre para comenzar otra ronda.';controls();}
function update(dt){elapsed+=dt;
 if(phase==='pulling'){
 const {b,origin,dir}=motion;
 // The confirmed move is guided by a virtual hand; contacts act on the remaining dynamic blocks.
 b.body.velocity.copy(dir.scale(.55));
 const offset=b.body.position.vsub(origin).dot(dir);
 if(offset>3.35){b.body.type=CANNON.Body.KINEMATIC;b.body.updateMassProperties();b.body.velocity.setZero();b.body.angularVelocity.setZero();phase='lifting';elapsed=0;motion.liftStart=b.body.position.clone();}
 else if(elapsed>12){b.body.material=wood;b.body.type=CANNON.Body.DYNAMIC;b.body.updateMassProperties();b.body.velocity.setZero();phase='ready';motion=null;status('Prueba otra pieza o vuelve a intentarlo.');controls();}
 }else if(phase==='lifting'){
 const b=motion.b,t=Math.min(elapsed/2,1),rise=Math.min(t/.65,1),slide=Math.max(0,(t-.65)/.35),s=slide*slide*(3-2*slide),y=Math.max(...blocks.filter(x=>x!==b).map(x=>x.body.position.y))+1.3;
 b.body.position.set(motion.liftStart.x*(1-s),motion.liftStart.y+(y-motion.liftStart.y)*rise,motion.liftStart.z*(1-s));b.body.aabbNeedsUpdate=true;
 if(t===1)place();
 }
 // En sala, el registro de movimientos manda sobre la animación local.
 // Al terminar cada animación todos vuelven a las mismas posiciones canónicas.
 if(!session()?.isOnline()||motion||pendingCanonical)world.step(1/120,dt,6);
 if(!fallen&&elapsed>.7&&blocks.some(b=>b!==motion?.b&&(b.body.position.y<b.homeY-1.0||Math.abs(b.body.quaternion.x)>.35||Math.abs(b.body.quaternion.z)>.35))){
   if(session()?.isOnline()){canonical(session().getState().moves);return;}else collapse();
 }
 if(phase==='settling'&&elapsed>2){
   if(pendingCanonical&&session()?.isOnline()){const moves=pendingCanonical;canonical(moves);return;}
   pendingCanonical=null;phase='ready';options();
   const nextId=session()?.getState()?.selectedId;if(nextId)select(blocks.find(b=>b.id===nextId));
   window.dispatchEvent(new CustomEvent('jenga-board-busy',{detail:false}));controls();status('Torre lista. Continúa siguiendo el orden de turnos.');
 }
 blocks.forEach(b=>{b.mesh.position.copy(b.body.position);b.mesh.quaternion.copy(b.body.quaternion);b.mesh.material.forEach(m=>{m.emissive.setHex(b===selected?0x359b66:0x000000);m.emissiveIntensity=b===selected?.45+.18*Math.sin(performance.now()*.005):0;});});
}
function frame(time){requestAnimationFrame(frame);const dt=Math.min((time-last)/1000||1/60,.04);last=time;if(!document.hidden&&$('juego').classList.contains('active')&&renderer&&host.clientWidth){update(dt);renderer.render(scene,camera);}}
$('drawBlock').addEventListener('click',()=>{const choices=eligible();if(choices.length)choose(choices[Math.floor(Math.random()*choices.length)]);else status('No quedan piezas disponibles bajo los dos niveles superiores. Reconstruye la torre.');});
$('blockPicker').addEventListener('change',e=>{const b=blocks.find(b=>b.id===Number(e.target.value));if(b)choose(b);});
$('confirmBlock').addEventListener('click',()=>{if(selected&&phase==='ready')session()?.act('complete');});
$('rebuildTower').addEventListener('click',()=>session()?.act('reset'));
$('rotateLeft').addEventListener('click',()=>{azimuth-=Math.PI/4;aim();});$('rotateRight').addEventListener('click',()=>{azimuth+=Math.PI/4;aim();});
$('zoomTower').addEventListener('input',e=>{radius=Number(e.target.value);aim();});
window.addEventListener('jenga-open',()=>{init();resize();});window.addEventListener('jenga-reset',()=>{if(world){const current=session()?.getState();if(current){canonical(current.moves);if(current.selectedId)select(blocks.find(b=>b.id===current.selectedId));}else reset();}});
window.addEventListener('jenga-permissions',controls);
window.addEventListener('jenga-room-state',event=>roomUpdate(event.detail.state,event.detail.previous));
})();
