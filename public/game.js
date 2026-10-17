import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
const $=id=>document.getElementById(id),socket=io();
const world=$("gameworld"),app=$("app"),hud=$("gameHud");
let mode="lobby",page="home",nick="Convidado",skin="shadow",weapon="rifle",weaponSkin="Flama",format="Solo",authUser=null;
let myId=null,round=0,hp=200,kills=0,matches=0,alive=false,yaw=0,pitch=.12,moveX=0,moveY=0,running=false,crouch=false,onGround=true,vy=0,lastInput=0,lastShot=0;
const pos=new THREE.Vector3(),scene=new THREE.Scene();scene.background=new THREE.Color(0x8bb5c7);scene.fog=new THREE.Fog(0x8bb5c7,90,330);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,500);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);world.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xd9ecff,0x435344,2.1));const sun=new THREE.DirectionalLight(0xffe3b0,2.2);sun.position.set(50,90,35);scene.add(sun);
const material=(c,r=.9)=>new THREE.MeshStandardMaterial({color:c,roughness:r});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(360,360),material(0x56764d));ground.rotation.x=-Math.PI/2;ground.position.y=-.1;scene.add(ground);
const grid=new THREE.GridHelper(360,72,0x6c8b5d,0x6c8b5d);grid.position.y=-.08;scene.add(grid);
function box(w,h,d,c,x,y,z){let m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(c));m.position.set(x,y,z);scene.add(m);return m}
// Procedural open-world island: roads, clustered buildings, rocks, trees and a small coastal edge.
for(let i=0;i<100;i++){let x=(Math.random()-.5)*300,z=(Math.random()-.5)*300;if(Math.abs(x)<25&&Math.abs(z)<25)continue;
 if(Math.random()<.32){const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.2,.35,2.5,6),material(0x5c4028));trunk.position.set(x,1.25,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(2+Math.random()*1.8,5+Math.random()*3,7),material([0x285b3b,0x376a43,0x4a7444][i%3]));crown.position.set(x,4.2,z);scene.add(crown)}
 else if(Math.random()<.68){box(4+Math.random()*9,3+Math.random()*7,4+Math.random()*9,[0x777c7a,0x887c69,0x596c77,0x9a907a][i%4],x,2,z)}
 else {const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1+Math.random()*2,0),material(0x626d67));rock.position.set(x,1,z);scene.add(rock)}
}
const roadMat=material(0x77796d);for(const [x,z,w,d] of [[0,0,10,300],[0,0,300,9],[60,45,130,6],[-70,-40,120,7]]){const r=new THREE.Mesh(new THREE.PlaneGeometry(w,d),roadMat);r.rotation.x=-Math.PI/2;r.position.set(x,.01,z);scene.add(r)}
// Scenic spawn hub.
for(let i=0;i<12;i++){let a=i*Math.PI/6;box(3,5,3,0x34495b,Math.cos(a)*16,2.5,Math.sin(a)*16)}
for(const [x,z] of [[-40,-35],[42,-22],[-50,40],[60,65],[15,-80]]){box(16,1,12,0x9a8a68,x,.5,z);box(15,6,11,0x697a83,x,4,z);box(16,1,12,0x3c454a,x,7,z)}
const playerMat=new THREE.MeshStandardMaterial({color:0x151e2a,roughness:.65}),goldMat=material(0xffbd36,.45),skinMat=material(0xb9815b);
function avatar(){const g=new THREE.Group();function part(geo,mat,x,y,z){let m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m}
 part(new THREE.CapsuleGeometry(.36,.72,4,8),playerMat,0,1.03,0);
 part(new THREE.SphereGeometry(.23,12,8),skinMat,0,1.73,0);
 part(new THREE.SphereGeometry(.28,12,8),playerMat,0,1.82,0).scale.set(1,1.05,1);
 part(new THREE.BoxGeometry(.08,.7,.08),goldMat,.22,1.05,-.03);
 part(new THREE.BoxGeometry(.7,.12,.35),material(0x222e3b),0,1.3,.02);
 for(const x of [-.22,.22]){part(new THREE.CapsuleGeometry(.12,.62,3,6),playerMat,x,.4,0);part(new THREE.BoxGeometry(.27,.12,.42),material(0xe0e4e8),x,.08,.07)}
 for(const x of [-.48,.48])part(new THREE.CapsuleGeometry(.12,.5,3,6),playerMat,x,1.12,0);
 return g}
const me=avatar();scene.add(me);me.visible=false;const others=new Map();
function setPage(p){page=p;document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id==="page-"+p));document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===p));}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.page)));
function toast(t){$("toast").textContent=t;$("toast").style.opacity=1;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("toast").style.opacity=0,2500)}
function modal(title,text,ask=false,callback=null){$("modalTitle").textContent=title;$("modalText").textContent=text;$("modalInput").classList.toggle("hidden",!ask);$("modalInput").value="";$("modalOk").onclick=()=>{const v=$("modalInput").value;$("modal").classList.add("hidden");if(callback)callback(v)};$("modal").classList.remove("hidden")}
$("modalClose").onclick=()=>$("modal").classList.add("hidden");
function updateNick(n){nick=String(n||"Convidado").trim().slice(0,18)||"Convidado";$("nick").textContent=nick;$("profileNick").textContent=nick;socket.emit("profile",{name:nick})}
$("editNick").onclick=()=>modal("Editar nick","Escolha um nome para mostrar no jogo.",true,updateNick);
document.querySelectorAll(".skin").forEach(b=>b.onclick=()=>{skin=b.dataset.skin;document.querySelectorAll(".skin").forEach(x=>x.classList.toggle("selected",x===b));$("skinName").textContent=b.querySelector("b").textContent;$("previewChar").className="preview-char "+skin;toast("Visual equipado (demonstração).")});
document.querySelectorAll(".weapon-list button").forEach(b=>b.onclick=()=>{weapon=b.dataset.weapon;document.querySelectorAll(".weapon-list button").forEach(x=>x.classList.toggle("selected",x===b));const names={rifle:"FUZIL VANGUARDA",smg:"SUBMETRALHADORA FANTASMA",sniper:"PRECISÃO LONGA",shotgun:"ESCOPETA IMPACTO",pistol:"PISTOLA COMPACTA"};$("weaponName").textContent=names[weapon];$("weaponArt").textContent=weapon==="sniper"?"━━━━━━━╾":weapon==="shotgun"?"╾━━━━━━╾":"╱╲━━━━━━╾"});
document.querySelectorAll(".weapon-skin").forEach(b=>b.onclick=()=>{weaponSkin=b.dataset.wskin;document.querySelectorAll(".weapon-skin").forEach(x=>x.classList.toggle("selected",x===b));toast("Skin de arma selecionada: "+weaponSkin)});
$("equipWeapon").onclick=()=>toast("Skin "+weaponSkin+" equipada (visual demonstrativo).");
document.querySelectorAll("[data-format]").forEach(b=>b.onclick=()=>{format=b.dataset.format;document.querySelectorAll("[data-format]").forEach(x=>x.classList.toggle("selected",x===b));toast("Formato selecionado: "+format)});
document.querySelectorAll("[data-ftab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-ftab]").forEach(x=>x.classList.toggle("selected",x===b));const tab=b.dataset.ftab;if(tab==="add")modal("Adicionar amigo","Digite o nick ou ID do jogador. Busca global será conectada ao backend social.",true,v=>{if(v.trim())toast("Pedido demonstrativo para "+v.trim()+"; sistema social real ainda precisa de backend.")});else if(tab==="requests"){$("friendList").innerHTML='<div class="empty">Nenhuma solicitação pendente.</div>'}else{$("friendList").innerHTML='<div class="empty">Você ainda não tem amigos adicionados.<br>Use Adicionar para testar a interface.</div>'}});
$("searchFriend").onclick=()=>{const v=$("friendSearch").value.trim();toast(v?"Busca de jogador precisa do backend social.":"Digite um nick ou ID.")};
$("inviteBtn").onclick=()=>modal("Convidar amigo","A lista de amigos online será integrada ao matchmaking na próxima etapa.");
$("settingsBtn").onclick=()=>modal("Configurações","Protótipo: qualidade gráfica automática. Controles e sensibilidade podem ser refinados na próxima atualização.");
$("playBtn").onclick=()=>join();$("rankPlay").onclick=()=>join();
function join(){socket.emit("joinMatch");}
$("leaveMatch").onclick=()=>{alive=false;hud.classList.add("hidden");app.classList.remove("hidden");me.visible=false;mode="lobby";setPage("home");toast("Você saiu da partida.")};
socket.on("connect",()=>myId=socket.id);
socket.on("welcome",d=>{myId=d.id;d.players.forEach(upsert);$("uid").textContent="#"+d.id.slice(0,6).toUpperCase();$("profileUid").textContent="ID: "+d.id.slice(0,10).toUpperCase()});
socket.on("playerJoined",upsert);socket.on("playerUpdated",upsert);socket.on("playerLeft",remove);
socket.on("snapshot",list=>{ $("matchCount").textContent="JOGADORES: "+list.length;list.forEach(p=>{if(p.id===myId&&alive){hp=p.hp;kills=p.kills;setHp(hp);$("matchKills").textContent=kills;$("profileKills").textContent=kills}upsert(p)});for(const [id] of others)if(!list.some(p=>p.id===id))remove(id)});
socket.on("round",d=>{round=d.round||round;if(d.state==="match"){alive=true;mode="match";matches++;$("matches").textContent=matches;app.classList.add("hidden");hud.classList.remove("hidden");me.visible=true;pos.set(0,0,0);hp=200;kills=0;setHp(hp);$("matchKills").textContent="0";toast("Partida ranqueada iniciada!")}else{alive=false;mode="lobby";hud.classList.add("hidden");app.classList.remove("hidden");me.visible=false;setPage("home");toast(d.winner?"Vitória de "+d.winner:"Partida encerrada. Você voltou ao lobby.")}});
socket.on("notice",d=>toast(d.text));function feed(t){const el=document.createElement("div");el.textContent=t;$("matchFeed").prepend(el);while($("matchFeed").children.length>4)$("matchFeed").lastChild.remove();setTimeout(()=>el.remove(),5000)}
socket.on("elimination",d=>{feed(d.killerName+" eliminou "+d.victimName);if(d.killer===myId){kills=d.kills;$("matchKills").textContent=kills;$("profileKills").textContent=kills;toast("ELIMINAÇÃO +1")}});socket.on("eliminated",d=>{alive=false;hud.classList.add("hidden");app.classList.remove("hidden");me.visible=false;setPage("home");toast("ELIMINADO por "+d.killerName+" · voltou ao lobby")});socket.on("hit",d=>{if(d.target===myId)setHp(d.health)});
function setHp(n){$("hpText").textContent=n;$("hpFill").style.width=(n/200*100)+"%"}
function upsert(p){if(!p||p.id===myId)return;let o=others.get(p.id);if(!o){o={mesh:avatar(),data:p};scene.add(o.mesh);others.set(p.id,o)}o.data=p;o.mesh.visible=p.state==="match"&&p.alive;o.mesh.position.set(p.x,p.y,p.z);o.mesh.rotation.y=p.yaw}
function remove(id){const o=others.get(id);if(o){scene.remove(o.mesh);others.delete(id)}}
// Right-side camera drag: vertical direction intentionally follows finger movement (drag up looks up).
let aimId=null,aimX=0,aimY=0;
renderer.domElement.addEventListener("pointerdown",e=>{if(!alive||e.clientX<innerWidth*.46)return;aimId=e.pointerId;aimX=e.clientX;aimY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener("pointermove",e=>{if(e.pointerId!==aimId)return;let dx=e.clientX-aimX,dy=e.clientY-aimY;aimX=e.clientX;aimY=e.clientY;yaw-=dx*.005;pitch=THREE.MathUtils.clamp(pitch-dy*.004,-.6,.8)});renderer.domElement.addEventListener("pointerup",()=>aimId=null);renderer.domElement.addEventListener("pointercancel",()=>aimId=null);
const stick=$("stick"),knob=$("stickKnob");let stickId=null;
stick.addEventListener("pointerdown",e=>{stickId=e.pointerId;stick.setPointerCapture(e.pointerId);joyMove(e)});stick.addEventListener("pointermove",e=>{if(e.pointerId===stickId)joyMove(e)});
function joyMove(e){const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy),max=34;if(d>max){dx=dx/d*max;dy=dy/d*max}moveX=dx/max;moveY=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`}
function joyReset(){stickId=null;moveX=moveY=0;knob.style.transform="translate(0,0)"}stick.addEventListener("pointerup",joyReset);stick.addEventListener("pointercancel",joyReset);
$("crouchBtn").onclick=()=>{crouch=!crouch;$("crouchBtn").style.borderColor=crouch?"#ffbd42":"#ffffff8c"};$("runBtn").addEventListener("pointerdown",()=>running=true);$("runBtn").addEventListener("pointerup",()=>running=false);$("runBtn").addEventListener("pointercancel",()=>running=false);$("jumpBtn").onclick=()=>{if(alive&&onGround){vy=7;onGround=false}};$("fireBtn").addEventListener("pointerdown",e=>{e.preventDefault();shoot()});
function shoot(){if(!alive||performance.now()-lastShot<250)return;lastShot=performance.now();let best=null,distBest=38;for(const [id,o] of others){if(!o.data.alive||o.data.state!=="match")continue;let dx=o.data.x-pos.x,dz=o.data.z-pos.z,d=Math.hypot(dx,dz),want=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(want-yaw),Math.cos(want-yaw));if(d<distBest&&Math.abs(diff)<.38){best=id;distBest=d}}if(best)socket.emit("shoot",best)}
$("googleBtn").onclick=()=>modal("Login com Google","Para ativar o login real, configure Firebase Authentication com Google no Console Firebase e preencha firebase-config.js. O login não pode funcionar de verdade sem as chaves do seu projeto.");
// Camera orbit in lobby; use the same model preview and no fake OAuth.
let last=0;const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),now=performance.now();
 if(alive){const f=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),r=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));let speed=(running?10:5.5)*(crouch?.45:1);pos.addScaledVector(f,-moveY*speed*dt);pos.addScaledVector(r,moveX*speed*dt);pos.x=THREE.MathUtils.clamp(pos.x,-170,170);pos.z=THREE.MathUtils.clamp(pos.z,-170,170);vy-=18*dt;pos.y+=vy*dt;if(pos.y<=0){pos.y=0;vy=0;onGround=true}me.position.copy(pos);me.rotation.y=yaw;me.scale.y=crouch?.78:1;
 if(now-last>50){last=now;socket.emit("input",{x:pos.x,y:pos.y,z:pos.z,yaw,crouch})}
 const target=new THREE.Vector3(pos.x,pos.y+1.45,pos.z),dir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));camera.position.copy(target).addScaledVector(dir,-5.5);camera.position.y+=.75;camera.lookAt(target.clone().addScaledVector(dir,8));
 }else{const t=now*.00012;camera.position.lerp(new THREE.Vector3(Math.sin(t)*23,10,Math.cos(t)*29),.025);camera.lookAt(0,2,0);me.visible=true;me.position.set(0,0,0);me.rotation.y=Math.sin(t*.7)*.22}
 renderer.render(scene,camera)}
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
setPage("home");animate();
