import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";

const socket = io();
const root = document.getElementById("game");
const lobby = document.getElementById("lobby"), deadPanel = document.getElementById("dead");
const controls = document.getElementById("controls");
const healthFill = document.getElementById("healthFill"), healthText = document.getElementById("healthText");
const roundLabel = document.getElementById("roundLabel"), playersLabel = document.getElementById("playersLabel");
const killsEl = document.getElementById("kills"), feed = document.getElementById("feed");
const notice = document.getElementById("notice"), killToast = document.getElementById("killToast");
let myId = null, myState = "lobby", round = 1, alive = false, health = 100, kills = 0;
let yaw = 0, pitch = .18, verticalVelocity = 0, onGround = true, crouch = false, running = false;
let moveX = 0, moveY = 0, lastSend = 0, lastShot = 0, otherPlayers = new Map();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ac5d2); scene.fog = new THREE.Fog(0x9ac5d2, 55, 125);
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, .1, 250);
const renderer = new THREE.WebGLRenderer({antialias:false, powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false; root.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xdceeff,0x56634b,2));
const sun = new THREE.DirectionalLight(0xfff0d1,2); sun.position.set(30,50,20); scene.add(sun);
const mat = (color, roughness=.9) => new THREE.MeshStandardMaterial({color,roughness});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(180,180), mat(0x647c55)); ground.rotation.x=-Math.PI/2; ground.position.y=-.08; scene.add(ground);
const grid = new THREE.GridHelper(180,60,0x78906c,0x78906c); grid.position.y=-.05; scene.add(grid);
function box(w,h,d,color,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));m.position.set(x,y,z);scene.add(m);return m}
for(let i=0;i<28;i++){let x=(Math.random()-.5)*140,z=(Math.random()-.5)*140;if(Math.abs(x)<13&&Math.abs(z)<13)continue;
  if(Math.random()>.45){box(2+Math.random()*3,1.5+Math.random()*3,2+Math.random()*3,0x8b8d83,x,1,z)}
  else {const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,2,5),mat(0x62452b));trunk.position.set(x,1,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.6,4,6),mat(0x315c3d));crown.position.set(x,3.7,z);scene.add(crown)}
}
const arenaWall=mat(0x34434a);
box(90,3,1,0x34434a,0,1.5,-45);box(90,3,1,0x34434a,0,1.5,45);box(1,3,90,0x34434a,-45,1.5,0);box(1,3,90,0x34434a,45,1.5,0);
const playerGeo = new THREE.CapsuleGeometry(.42,.8,4,8);
function makeAvatar(color=0x3ca9d8){const g=new THREE.Group();const body=new THREE.Mesh(playerGeo,mat(color));body.position.y=.85;g.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),mat(0xd3a77e));head.position.y=1.65;g.add(head);
 const marker=new THREE.Mesh(new THREE.BoxGeometry(.55,.08,.08),mat(0xffd166));marker.position.set(0,1.15,.43);g.add(marker);scene.add(g);return g}
const me=makeAvatar(0x2c9ed8); me.visible=false;
let myPos = new THREE.Vector3(0,0,0);
const clock = new THREE.Clock();
function showNotice(text){notice.textContent=text;notice.style.opacity="1";setTimeout(()=>{notice.style.opacity="0"},2400)}
function addFeed(text){const d=document.createElement("div");d.textContent=text;feed.prepend(d);while(feed.children.length>4)feed.lastChild.remove();setTimeout(()=>d.remove(),6000)}
function updateHealth(n){health=n;healthFill.style.width=n+"%";healthText.textContent=n;healthFill.style.background=n<30?"#ff5148":n<60?"#ffb547":"#52e28b"}
function setState(state){myState=state;alive=state==="match";lobby.classList.toggle("hidden",state!=="lobby");deadPanel.classList.toggle("hidden",state!=="dead");controls.classList.toggle("hidden",!alive);roundLabel.textContent=state==="match"?"RANQUEADA • "+round:"LOBBY";if(state==="lobby")me.visible=false;else if(state==="match")me.visible=true}
socket.on("connect",()=>{myId=socket.id});
socket.on("welcome",d=>{myId=d.id;round=d.round;d.players.forEach(upsertPlayer);playersLabel.textContent="JOGADORES: "+d.players.length});
socket.on("playerJoined",upsertPlayer);
socket.on("playerUpdated",upsertPlayer);
socket.on("playerLeft",id=>removePlayer(id));
socket.on("snapshot",list=>{playersLabel.textContent="JOGADORES: "+list.length;list.forEach(p=>{if(p.id===myId){if(p.state==="match"&&myState==="match"){updateHealth(p.health);kills=p.kills;killsEl.textContent=kills}}upsertPlayer(p)});for(const [id] of otherPlayers)if(!list.some(p=>p.id===id))removePlayer(id)});
socket.on("round",d=>{round=d.round||round;if(d.state==="match"){setState("match");updateHealth(100);kills=0;killsEl.textContent="0";showNotice("Partida ranqueada começou!");myPos.set(0,0,0)}else{setState("lobby");if(d.winner)showNotice("Vitória de "+d.winner)}});
socket.on("notice",d=>showNotice(d.text));
socket.on("elimination",d=>{addFeed(`${d.killerName} eliminou ${d.victimName}`);if(d.killer===myId){kills=d.kills;killsEl.textContent=kills;killToast.textContent="ELIMINAÇÃO +1";killToast.style.opacity="1";setTimeout(()=>killToast.style.opacity="0",1600)}});
socket.on("eliminated",d=>{setState("dead");document.getElementById("deadText").textContent=`Você foi eliminado por ${d.killerName}. Kills nesta partida: ${kills}.`;});
socket.on("hit",d=>{if(d.target===myId)updateHealth(d.health)});
function upsertPlayer(p){if(!p||p.id===myId)return;let a=otherPlayers.get(p.id);if(!a){a={mesh:makeAvatar(0xd56b52),data:p};otherPlayers.set(p.id,a)}a.data=p;a.mesh.visible=p.state==="match"&&p.alive;a.mesh.position.set(p.x,p.y,p.z);a.mesh.rotation.y=p.yaw}
function removePlayer(id){const a=otherPlayers.get(id);if(a){scene.remove(a.mesh);a.mesh.traverse(o=>{if(o.geometry)o.geometry.dispose()});otherPlayers.delete(id)}}
document.getElementById("playBtn").addEventListener("click",()=>{const n=document.getElementById("nameInput").value.trim();if(n)socket.emit("setName",n);socket.emit("joinMatch")});
document.getElementById("backBtn").addEventListener("click",()=>setState("lobby"));
document.getElementById("crouchBtn").addEventListener("click",()=>{crouch=!crouch;document.getElementById("crouchBtn").style.background=crouch?"#b27a2b":"#13232bd9"});
document.getElementById("runBtn").addEventListener("pointerdown",e=>{running=true;e.currentTarget.setPointerCapture(e.pointerId)});
document.getElementById("runBtn").addEventListener("pointerup",()=>running=false);
document.getElementById("runBtn").addEventListener("pointercancel",()=>running=false);
document.getElementById("jumpBtn").addEventListener("pointerdown",()=>{if(onGround&&alive){verticalVelocity=7;onGround=false}});
document.getElementById("shootBtn").addEventListener("pointerdown",e=>{e.preventDefault();shoot()});
document.getElementById("soundBtn").addEventListener("click",()=>showNotice("Áudio ainda não implementado"));
function shoot(){const now=performance.now();if(now-lastShot<250||!alive)return;lastShot=now;
 let best=null,bestDist=32;
 for(const [id,a] of otherPlayers){if(!a.data.alive||a.data.state!=="match")continue;const dx=a.data.x-myPos.x,dz=a.data.z-myPos.z,dist=Math.hypot(dx,dz);if(dist>=bestDist)continue;
  const desired=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));if(Math.abs(diff)<.42){best=id;bestDist=dist}}
 if(best)socket.emit("shoot",best);
}
const joy=document.getElementById("joystick"), knob=document.getElementById("joyKnob"), base=document.getElementById("joyBase");
let joyPointer=null;
joy.addEventListener("pointerdown",e=>{joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e)});
joy.addEventListener("pointermove",e=>{if(e.pointerId===joyPointer)moveJoy(e)});
function moveJoy(e){const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const max=34,d=Math.hypot(dx,dy);if(d>max){dx=dx/d*max;dy=dy/d*max}knob.style.transform=`translate(${dx}px,${dy}px)`;moveX=dx/max;moveY=dy/max}
function resetJoy(){joyPointer=null;moveX=moveY=0;knob.style.transform="translate(0,0)"}
joy.addEventListener("pointerup",resetJoy);joy.addEventListener("pointercancel",resetJoy);
// Right-side drag rotates camera. Left side is reserved for the movement stick.
let aimPointer=null,lastAimX=0,lastAimY=0;
renderer.domElement.addEventListener("pointerdown",e=>{if(!alive||e.clientX<innerWidth*.48)return;aimPointer=e.pointerId;lastAimX=e.clientX;lastAimY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener("pointermove",e=>{if(e.pointerId!==aimPointer)return;const dx=e.clientX-lastAimX,dy=e.clientY-lastAimY;lastAimX=e.clientX;lastAimY=e.clientY;yaw-=dx*.006;pitch=THREE.MathUtils.clamp(pitch+dy*.004,-.55,.8)});
renderer.domElement.addEventListener("pointerup",()=>aimPointer=null);renderer.domElement.addEventListener("pointercancel",()=>aimPointer=null);
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});

function animate(){
 requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);
 if(alive){
  const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const speed=(running?9:5)*(crouch?.45:1);
  myPos.addScaledVector(forward,-moveY*speed*dt);myPos.addScaledVector(right,moveX*speed*dt);
  myPos.x=THREE.MathUtils.clamp(myPos.x,-43,43);myPos.z=THREE.MathUtils.clamp(myPos.z,-43,43);
  verticalVelocity-=18*dt;myPos.y+=verticalVelocity*dt;if(myPos.y<=0){myPos.y=0;verticalVelocity=0;onGround=true}
  me.position.copy(myPos);me.rotation.y=yaw;me.scale.y=crouch?.72:1;
  if(performance.now()-lastSend>50){lastSend=performance.now();socket.emit("input",{x:myPos.x,y:myPos.y,z:myPos.z,yaw,crouch})}
  const target=new THREE.Vector3(myPos.x, myPos.y+1.3, myPos.z);
  const dir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  camera.position.copy(target).addScaledVector(dir,-5.5);camera.position.y+=.8;camera.lookAt(target.clone().addScaledVector(dir,10));
 }else{camera.position.lerp(new THREE.Vector3(0,16,22),.025);camera.lookAt(0,0,0)}
 renderer.render(scene,camera);
}
setState("lobby");animate();