(function(){
'use strict';
const $=id=>document.getElementById(id), host=$('towerView');
let scene,camera,renderer,world,blocks=[],selected=null,phase='ready',motion=null,elapsed=0,turn=0,topSlots=0,fallen=false,started=false,last=0;
let azimuth=.72,elevation=.24,radius=24,drag=null;
let appliedMoves=[],roomCode=null,pendingCanonical=null;
let cameraCue=null,cameraZoom=1,cameraTargetY=5.5,entranceTime=0;

// Giant Jenga 6 corporate colors matching the giant company set & physical dice
const JENGA_COLORS = [
  { id: 'rosa', name: 'Rosa', hex: '#ff2d75', text: '#ffffff', emissive: 0xff4081 },
  { id: 'azul', name: 'Azul', hex: '#1976d2', text: '#ffffff', emissive: 0x42a5f5 },
  { id: 'turquesa', name: 'Turquesa', hex: '#00bfa5', text: '#ffffff', emissive: 0x26a69a },
  { id: 'lima', name: 'Verde lima', hex: '#76ff03', text: '#153d08', emissive: 0x76ff03 },
  { id: 'morado', name: 'Morado', hex: '#8e24aa', text: '#ffffff', emissive: 0xab47bc },
  { id: 'amarillo', name: 'Amarillo', hex: '#ffd600', text: '#2c1e02', emissive: 0xffea00 }
];
window.JENGA_COLORS = JENGA_COLORS;

// 3D Giant Dice state
let diceMesh = null, diceRolling = false, diceRollTime = 0, diceRollDuration = 1.8;
let diceStartPos = null, diceTargetPos = null, diceTargetQuat = null, diceSpinAxis = null, diceOnComplete = null;
const DICE_SIZE = 1.85;
const DICE_REST_POS = new THREE.Vector3(3.4, 0.95, 2.8);
const DICE_FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),   // 0: +X Rosa
  new THREE.Vector3(-1, 0, 0),  // 1: -X Azul
  new THREE.Vector3(0, 1, 0),   // 2: +Y Turquesa
  new THREE.Vector3(0, -1, 0),  // 3: -Y Verde lima
  new THREE.Vector3(0, 0, 1),   // 4: +Z Morado
  new THREE.Vector3(0, 0, -1)   // 5: -Z Amarillo
];

const animations=()=>window.JengaMotion;
const session=()=>window.JengaSession;
const H=.6,W=1,L=3,GAP=.018,STEP=H+.004;
const wood=new CANNON.Material('wood'),sliding=new CANNON.Material('sliding-wood');
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();

function status(message){$('towerStatus').textContent=message;}
function eligible(){const highest=Math.max(...blocks.map(b=>b.level));return blocks.filter(b=>b.level<highest-1&&b.body.position.y>.25&&Math.abs(b.body.position.y-b.homeY)<.4);}

function controls(){
 const ready=phase==='ready'&&!fallen&&!diceRolling;
 $('drawBlock').disabled=!ready||!session()?.can('draw');
 $('blockPicker').disabled=!ready||!session()?.can('draw');
 $('confirmBlock').disabled=!ready||!selected||!session()?.can('complete');
 document.querySelectorAll('.dice-color-btn').forEach(btn => {
   btn.disabled = !ready || !session()?.can('draw');
   btn.style.opacity = btn.disabled ? '0.45' : '1';
   btn.style.pointerEvents = btn.disabled ? 'none' : 'auto';
 });
}

function options(){
 const list=$('blockPicker');
 list.replaceChildren(new Option('Seleccionar una pieza…',''));
 eligible().sort((a,b)=>a.id-b.id).forEach(b=>{
   list.add(new Option('#'+b.id+' · '+b.color.name+' (nivel '+(b.level+1)+')',String(b.id)));
 });
}

function select(b){
 if(!b)return;
 if(selected?.id!==b.id&&animations()?.enabled()&&!animations().paused()){
   const goal=(b.level%2?Math.PI:Math.PI/2)+.22;
   const angle=((goal-azimuth+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
   cameraCue={from:azimuth,to:azimuth+angle,t:0};
 }
 selected=b;$('blockPicker').value=String(b.id);
 window.dispatchEvent(new CustomEvent('jenga-challenge',{detail:{id:b.id}}));
 $('pieceInstruction').textContent='Saca la pieza #'+b.id+' ('+b.color.name+')';
 $('pieceDetail').textContent='Color '+b.color.name+' · Nivel '+(b.level+1)+' · posición '+(b.slot+1)+'/3';
 status('Pieza asignada ('+b.color.name+'). Responde su pregunta antes de confirmar la retirada.');
 controls();
}

function choose(b){
 if(phase!=='ready'||fallen||!session()?.can('draw')||!eligible().includes(b))return;
 session().act('draw',{blockId:b.id});
}

function createDiceFaceTexture(color){
 const c=document.createElement('canvas');c.width=512;c.height=512;const ctx=c.getContext('2d');
 ctx.fillStyle='#162238';ctx.fillRect(0,0,512,512);
 ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
 for(let i=0;i<512;i+=8){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,512);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}
 ctx.strokeStyle='#0c1422';ctx.lineWidth=12;ctx.strokeRect(6,6,500,500);
 const cx=256,cy=256,r=172;
 ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=color.hex;ctx.shadowColor='rgba(0,0,0,0.55)';ctx.shadowBlur=18;ctx.fill();ctx.shadowBlur=0;
 const grad=ctx.createRadialGradient(cx-35,cy-35,25,cx,cy,r);
 grad.addColorStop(0,'rgba(255,255,255,0.28)');grad.addColorStop(0.65,'rgba(255,255,255,0.0)');grad.addColorStop(1,'rgba(0,0,0,0.22)');
 ctx.fillStyle=grad;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=5;ctx.setLineDash([16,12]);
 ctx.beginPath();ctx.arc(cx,cy,r-8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
 ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=2;
 ctx.beginPath();ctx.arc(cx,cy,r-13,0,Math.PI*2);ctx.stroke();
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

function initDice(){
 if(diceMesh)return;
 const geom=new THREE.BoxGeometry(DICE_SIZE,DICE_SIZE,DICE_SIZE);
 const materials=JENGA_COLORS.map(c=>new THREE.MeshStandardMaterial({map:createDiceFaceTexture(c),roughness:0.58,metalness:0.05}));
 diceMesh=new THREE.Mesh(geom,materials);
 diceMesh.castShadow=true;diceMesh.receiveShadow=true;
 diceMesh.position.copy(DICE_REST_POS);
 diceMesh.quaternion.setFromEuler(new THREE.Euler(0.2,0.4,0));
 scene.add(diceMesh);
}

function rollDice(targetColorIndex,onComplete){
 if(diceRolling)return;
 diceRolling=true;diceRollTime=0;
 diceRollDuration=animations()?.enabled()?1.75:0.25;
 diceOnComplete=onComplete;
 diceStartPos=diceMesh.position.clone();
 const camDir=new THREE.Vector3(Math.sin(azimuth),0,Math.cos(azimuth)).normalize();
 diceTargetPos=new THREE.Vector3(camDir.x*3.2,0.95,camDir.z*3.2);
 const toCam=camera.position.clone().sub(diceTargetPos).normalize();
 toCam.y=Math.max(0.42,toCam.y+0.2);toCam.normalize();
 const normal=DICE_FACE_NORMALS[targetColorIndex];
 diceTargetQuat=new THREE.Quaternion().setFromUnitVectors(normal,toCam);
 diceSpinAxis=new THREE.Vector3(Math.sin(Math.random()*10)+0.6,Math.cos(Math.random()*10)+1.2,Math.sin(Math.random()*7)+0.4).normalize();
 $('drawBlock').textContent='🎲 Rodando dado…';
 controls();manualCamera();
}

function updateDice(dt){
 if(!diceMesh||!diceRolling)return;
 diceRollTime+=dt;
 const p=Math.min(1,diceRollTime/diceRollDuration);
 diceMesh.position.x=diceStartPos.x+(diceTargetPos.x-diceStartPos.x)*p;
 diceMesh.position.z=diceStartPos.z+(diceTargetPos.z-diceStartPos.z)*p;
 if(animations()?.enabled()){
   let bounce=0;
   if(p<=0.72)bounce=Math.sin(p/0.72*Math.PI)*4.6;
   else if(p<=0.88)bounce=Math.sin((p-0.72)/0.16*Math.PI)*0.95;
   else bounce=Math.sin((p-0.88)/0.12*Math.PI)*0.22;
   diceMesh.position.y=diceTargetPos.y+bounce;
   if(p<1){
     const remainingSpins=Math.pow(1-p,1.8)*(Math.PI*7.5);
     const spinQ=new THREE.Quaternion().setFromAxisAngle(diceSpinAxis,remainingSpins);
     diceMesh.quaternion.copy(spinQ.multiply(diceTargetQuat));
   }else diceMesh.quaternion.copy(diceTargetQuat);
 }else{
   diceMesh.position.y=diceTargetPos.y;
   diceMesh.quaternion.copy(diceTargetQuat);
 }
 if(p>=1){
   diceRolling=false;
   diceMesh.position.copy(diceTargetPos);
   diceMesh.quaternion.copy(diceTargetQuat);
   $('drawBlock').textContent='🎲 Tirar dado gigante';
   controls();
   if(diceOnComplete){const cb=diceOnComplete;diceOnComplete=null;cb();}
 }
}

function rollAndChoose(specificColorIndex=null){
 if(phase!=='ready'||fallen||!session()?.can('draw')||diceRolling)return;
 const choices=eligible();
 if(!choices.length){status('No quedan piezas disponibles bajo los dos niveles superiores. Reconstruye la torre.');return;}
 let targetColor=specificColorIndex;
 let candidates=[];
 if(targetColor!==null&&targetColor!==undefined){candidates=choices.filter(b=>b.colorIndex===targetColor);}
 if(!candidates.length){
   const availableColors=[...new Set(choices.map(b=>b.colorIndex))];
   targetColor=availableColors[Math.floor(Math.random()*availableColors.length)];
   candidates=choices.filter(b=>b.colorIndex===targetColor);
 }
 const chosenBlock=candidates[Math.floor(Math.random()*candidates.length)];
 rollDice(targetColor,()=>{
   choose(chosenBlock);
   status('🎲 ¡Salió '+chosenBlock.color.name.toUpperCase()+'! Saca la pieza #'+chosenBlock.id+' en la torre.');
 });
}

function canonical(moves){
 if(!moves.length&&appliedMoves.length)entranceTime=0;
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

function aim(){if(!camera)return;const distance=radius*cameraZoom;camera.position.set(Math.sin(azimuth)*distance*Math.cos(elevation),cameraTargetY+Math.sin(elevation)*distance,Math.cos(azimuth)*distance*Math.cos(elevation));camera.lookAt(0,cameraTargetY,0);}
function manualCamera(){cameraCue=null;animations()?.pause(8000);}

function animateCamera(dt,time){
 const active=document.activeElement;
 if(active&&/^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)){animations()?.pause(1000);return;}
 if(!animations()?.enabled()||animations().paused()||drag||document.getElementById('gameMenu')?.open)return;
 if(cameraCue){
   cameraCue.t=Math.min(1,cameraCue.t+dt/1.35);const t=cameraCue.t,s=t*t*(3-2*t);
   azimuth=cameraCue.from+(cameraCue.to-cameraCue.from)*s;if(t===1)cameraCue=null;
 }else if(!selected&&!motion&&!fallen&&!diceRolling){azimuth+=dt*.12;}
 const focus=motion?.b||selected,zoom=focus ? .96 : 1+Math.sin(time*.0005)*.008;
 cameraZoom+=(zoom-cameraZoom)*Math.min(1,dt*3);
 const target=focus?5.5+(focus.body.position.y-5.5)*.07:5.5+Math.sin(time*.00035)*.06;
 cameraTargetY+=(target-cameraTargetY)*Math.min(1,dt*2.5);aim();
}

function texture(id,end=false){
 const c=document.createElement('canvas');c.width=end?256:512;c.height=128;const ctx=c.getContext('2d');
 const color=JENGA_COLORS[(id-1)%JENGA_COLORS.length];
 ctx.fillStyle=color.hex;ctx.fillRect(0,0,c.width,128);
 const grad=ctx.createLinearGradient(0,0,0,128);
 grad.addColorStop(0,'rgba(255,255,255,0.26)');grad.addColorStop(0.12,'rgba(255,255,255,0.06)');grad.addColorStop(0.85,'rgba(0,0,0,0.02)');grad.addColorStop(1,'rgba(0,0,0,0.22)');
 ctx.fillStyle=grad;ctx.fillRect(0,0,c.width,128);
 ctx.strokeStyle='rgba(0,0,0,0.18)';ctx.lineWidth=2;ctx.strokeRect(4,4,c.width-8,120);
 ctx.shadowColor='rgba(0,0,0,0.35)';ctx.shadowBlur=6;ctx.shadowOffsetY=2;
 ctx.fillStyle=color.text;
 if(end){
   ctx.font='bold 62px system-ui, -apple-system, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(String(id).padStart(2,'0'),128,65);
 }else{
   ctx.font='bold 44px system-ui, -apple-system, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(String(id).padStart(2,'0')+' · '+color.name.toUpperCase(),256,64);
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function init(){
 if(started)return;started=true;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){host.textContent='No se pudo iniciar la vista 3D. Puedes seguir usando las instrucciones y los retos.';status('Vista 3D no disponible en este navegador.');$('drawBlock').disabled=true;$('confirmBlock').disabled=true;return;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0xeaf0eb);host.appendChild(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Torre Jenga 3D y dado gigante. Arrastra para girar; tira el dado o usa el selector.');
 scene=new THREE.Scene();scene.fog=new THREE.Fog(0xeaf0eb,35,65);camera=new THREE.PerspectiveCamera(39,1,.1,100);aim();
 scene.add(new THREE.HemisphereLight(0xfff6e3,0x637967,1.8));
 const light=new THREE.DirectionalLight(0xfff1d9,2);light.position.set(7,16,8);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-12,right:12,top:15,bottom:-12});light.shadow.normalBias=.025;scene.add(light);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:0xd4dfd5,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.23;floor.receiveShadow=true;scene.add(floor);
 const base=new THREE.Mesh(new THREE.CylinderGeometry(4.7,4.85,.22,64),new THREE.MeshStandardMaterial({color:0x22443c,roughness:.8}));base.position.y=-.115;scene.add(base);
 world=new CANNON.World({gravity:new CANNON.Vec3(0,-9.81,0),allowSleep:true});world.broadphase=new CANNON.SAPBroadphase(world);world.solver.iterations=40;world.solver.tolerance=.0001;
 world.addContactMaterial(new CANNON.ContactMaterial(wood,wood,{friction:.35,restitution:0,contactEquationStiffness:1e8,contactEquationRelaxation:4}));
 world.addContactMaterial(new CANNON.ContactMaterial(wood,sliding,{friction:.015,restitution:0,contactEquationStiffness:1e8,contactEquationRelaxation:4}));
 const ground=new CANNON.Body({mass:0,material:wood,shape:new CANNON.Plane()});ground.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(ground);
 initDice();
 reset();roomUpdate(session()?.getState(),null);new ResizeObserver(resize).observe(host);
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{manualCamera();drag={x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;azimuth-=(e.clientX-drag.x)*.009;elevation=Math.max(-.05,Math.min(.8,elevation+(e.clientY-drag.y)*.005));drag.x=e.clientX;drag.y=e.clientY;aim();});
 canvas.addEventListener('pointerup',e=>{
   if(drag&&Math.hypot(e.clientX-drag.ox,e.clientY-drag.oy)<6){
     const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
     ray.setFromCamera(pointer,camera);
     const hitList=diceMesh?[diceMesh,...blocks.map(b=>b.mesh)]:blocks.map(b=>b.mesh);
     const hits=ray.intersectObjects(hitList);
     if(hits.length){
       if(hits[0].object===diceMesh)rollAndChoose();
       else if(hits[0].object.userData.block)choose(hits[0].object.userData.block);
     }
   }
   drag=null;
 });
 canvas.addEventListener('pointercancel',()=>drag=null);
 requestAnimationFrame(frame);
}

function resize(){if(!renderer||!host.clientWidth)return;const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}

function reset(){
 if(!world)return;
 entranceTime=0;cameraCue=null;
 window.dispatchEvent(new Event('jenga-board-reset'));
 blocks.forEach(b=>{world.removeBody(b.body);scene.remove(b.mesh);b.mesh.geometry.dispose();new Set(b.mesh.material).forEach(m=>{m.map.dispose();m.dispose();});});
 blocks=[];selected=null;motion=null;turn=0;topSlots=0;fallen=false;elapsed=0;phase='settling';
 if(diceMesh){diceRolling=false;diceOnComplete=null;diceMesh.position.copy(DICE_REST_POS);diceMesh.quaternion.setFromEuler(new THREE.Euler(0.2,0.4,0));}
 for(let level=0;level<18;level++)for(let slot=0;slot<3;slot++){
   const id=level*3+slot+1,pos=(slot-1)*(W+GAP),y=H/2+level*STEP;
   const colorIndex=(id-1)%JENGA_COLORS.length;
   const color=JENGA_COLORS[colorIndex];
   const body=new CANNON.Body({mass:.3,material:wood,shape:new CANNON.Box(new CANNON.Vec3(L/2,H/2,W/2)),linearDamping:.18,angularDamping:.35,sleepSpeedLimit:.06,sleepTimeLimit:1});
   body.position.set(level%2?pos:0,y,level%2?0:pos);body.quaternion.setFromEuler(0,level%2?Math.PI/2:0,0);world.addBody(body);
   const longMat=new THREE.MeshStandardMaterial({map:texture(id),roughness:.58,color:0xffffff});
   const endMat=new THREE.MeshStandardMaterial({map:texture(id,true),roughness:.65,color:0xffffff});
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(L,H,W),[endMat,endMat,longMat,longMat,longMat,longMat]);
   mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
   const b={id,level,slot,body,mesh,homeY:y,color,colorIndex};mesh.userData.block=b;blocks.push(b);
 }
 $('pieceInstruction').textContent='¿Qué color saldrá?';
 $('pieceDetail').textContent='Tira el dado gigante 3D o elige una pieza. Los niveles se cuentan desde la base.';
 $('towerTurns').textContent='0 piezas retiradas';
 status('El Jenga de colores está listo…');options();controls();
}

function extract(){if(!selected||phase!=='ready'||fallen)return;window.dispatchEvent(new CustomEvent('jenga-board-busy',{detail:true}));const b=selected;phase='pulling';elapsed=0;const dir=new CANNON.Vec3();b.body.quaternion.vmult(new CANNON.Vec3(1,0,0),dir);dir.y=0;dir.normalize();motion={b,origin:b.body.position.clone(),dir};b.body.material=sliding;b.body.type=CANNON.Body.KINEMATIC;b.body.updateMassProperties();b.body.angularVelocity.setZero();b.body.velocity.copy(dir.scale(.55));world.bodies.forEach(x=>x.wakeUp());status('Retirando #'+b.id+' ('+b.color.name+') · la torre está buscando su equilibrio…');controls();}

function place(){const b=motion.b,level=18+Math.floor(topSlots/3),slot=topSlots%3,pos=(slot-1)*(W+GAP);b.level=level;b.slot=slot;b.homeY=H/2+level*STEP;
 b.body.material=wood;b.body.type=CANNON.Body.DYNAMIC;b.body.mass=.3;b.body.updateMassProperties();b.body.position.set(level%2?pos:0,b.homeY+.10,level%2?0:pos);b.body.quaternion.setFromEuler(0,level%2?Math.PI/2:0,0);b.body.velocity.setZero();b.body.angularVelocity.setZero();b.body.aabbNeedsUpdate=true;b.body.wakeUp();topSlots++;turn++;$('towerTurns').textContent=turn+(turn===1?' pieza retirada':' piezas retiradas');phase='settling';elapsed=0;selected=null;motion=null;status('Pieza '+b.color.name+' colocada arriba. Esperando a que la torre se estabilice…');}

function collapse(){fallen=true;phase='fallen';selected=null;if(motion){motion.b.body.material=wood;motion.b.body.type=CANNON.Body.DYNAMIC;motion.b.body.updateMassProperties();motion.b.body.wakeUp();}motion=null;status('La torre virtual cayó. Si la torre real sigue en pie, puedes reconstruir la simulación.');$('pieceInstruction').textContent='¡La torre perdió el equilibrio!';$('pieceDetail').textContent='Reconstruye la torre para comenzar otra ronda.';controls();}

function update(dt){
 elapsed+=dt;entranceTime=animations()?.enabled()?entranceTime+dt:2;
 updateDice(dt);
 if(phase==='pulling'){
   const {b,origin,dir}=motion;
   b.body.velocity.copy(dir.scale(.55));
   const offset=b.body.position.vsub(origin).dot(dir);
   if(offset>3.35){b.body.type=CANNON.Body.KINEMATIC;b.body.updateMassProperties();b.body.velocity.setZero();b.body.angularVelocity.setZero();phase='lifting';elapsed=0;motion.liftStart=b.body.position.clone();}
   else if(elapsed>12){b.body.material=wood;b.body.type=CANNON.Body.DYNAMIC;b.body.updateMassProperties();b.body.velocity.setZero();phase='ready';motion=null;status('Prueba otra pieza o vuelve a intentarlo.');controls();}
 }else if(phase==='lifting'){
   const b=motion.b,t=Math.min(elapsed/2,1),rise=Math.min(t/.65,1),slide=Math.max(0,(t-.65)/.35),s=slide*slide*(3-2*slide),y=Math.max(...blocks.filter(x=>x!==b).map(x=>x.body.position.y))+1.3;
   b.body.position.set(motion.liftStart.x*(1-s),motion.liftStart.y+(y-motion.liftStart.y)*rise,motion.liftStart.z*(1-s));b.body.aabbNeedsUpdate=true;
   if(t===1)place();
 }
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
 blocks.forEach(b=>{
   b.mesh.position.copy(b.body.position);b.mesh.quaternion.copy(b.body.quaternion);
   if(animations()?.enabled()&&entranceTime<1.6){const t=Math.max(0,Math.min(1,(entranceTime-b.level*.025-b.slot*.02)/.65));b.mesh.position.y+=(2+b.level*.08)*Math.pow(1-t,3);}
   b.mesh.material.forEach(m=>{
     m.emissive.setHex(b===selected?b.color.emissive:0x000000);
     m.emissiveIntensity=b===selected?(animations()?.enabled()?.55+.25*Math.sin(performance.now()*.006):.6):0;
   });
 });
}

function frame(time){
 requestAnimationFrame(frame);
 const dt=Math.min((time-last)/1000||1/60,.04);last=time;
 if(!document.hidden&&$('juego').classList.contains('active')&&renderer&&host.clientWidth){
   update(dt);animateCamera(dt,time);renderer.render(scene,camera);
 }
}

$('drawBlock').addEventListener('click',()=>rollAndChoose());
document.querySelectorAll('.dice-color-btn').forEach(btn=>{
 btn.addEventListener('click',e=>{
   e.stopPropagation();
   const colorIndex=Number(btn.dataset.color);
   rollAndChoose(colorIndex);
 });
});
$('blockPicker').addEventListener('change',e=>{const b=blocks.find(b=>b.id===Number(e.target.value));if(b)choose(b);});
$('confirmBlock').addEventListener('click',()=>{if(selected&&phase==='ready')session()?.act('complete');});
$('rebuildTower').addEventListener('click',()=>session()?.act('reset'));
$('rotateLeft').addEventListener('click',()=>{manualCamera();azimuth-=Math.PI/4;aim();});
$('rotateRight').addEventListener('click',()=>{manualCamera();azimuth+=Math.PI/4;aim();});
$('zoomTower').addEventListener('input',e=>{manualCamera();radius=Number(e.target.value);aim();});
window.addEventListener('jenga-open',()=>{init();resize();});
window.addEventListener('jenga-reset',()=>{
 if(world){
   const current=session()?.getState();
   if(current){canonical(current.moves);if(current.selectedId)select(blocks.find(b=>b.id===current.selectedId));}
   else reset();
 }
});
window.addEventListener('jenga-permissions',controls);
window.addEventListener('jenga-room-state',event=>roomUpdate(event.detail.state,event.detail.previous));
})();
