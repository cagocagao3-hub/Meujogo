import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const auth = $('auth'), game = $('game'), authForm = $('authForm');
let isRegister = false, token = localStorage.getItem('urbanToken') || '';
let socket = null, selfId = null, playerData = null, scene, camera, renderer, clock;
let localAvatar, remoteAvatars = new Map(), vehicleMeshes = new Map(), keys = {};
let move = {x:0,z:0}, rotation = 0, running = false, driving = false;
let lastMoveSent = 0, toastTimer, joystickActive = false, joystickCenter = {x:0,y:0};
const worldBounds = 180;

function showError(message) { $('authError').textContent = message || ''; }
$('switchAuth').addEventListener('click', () => {
  isRegister = !isRegister;
  $('authTitle').textContent = isRegister ? 'Criar sua conta' : 'Entre na cidade';
  $('authSubmit').textContent = isRegister ? 'REGISTRAR' : 'ENTRAR';
  $('switchAuth').textContent = isRegister ? 'Já tenho conta — entrar' : 'Ainda não tenho conta — registrar';
  showError();
});
async function authRequest(url, body) {
  const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Falha ao autenticar.');
  return data;
}
authForm.addEventListener('submit', async (e) => {
  e.preventDefault(); showError(); $('authSubmit').disabled = true;
  try {
    const data = await authRequest(isRegister ? '/api/register' : '/api/login', {
      username: $('username').value.trim(), password: $('password').value
    });
    token = data.token; playerData = data.player;
    localStorage.setItem('urbanToken', token);
    startGame();
  } catch (err) { showError(err.message); }
  finally { $('authSubmit').disabled = false; }
});
$('logoutButton').addEventListener('click', () => {
  if (socket) { socket.emit('player:save'); socket.disconnect(); }
  socket = null; token = ''; localStorage.removeItem('urbanToken');
  game.hidden = true; auth.style.display = 'grid';
});
if (token) {
  fetch('/api/status').then(r => r.ok ? startLoginRestore() : null).catch(() => {});
}
async function startLoginRestore() {
  // Tokens are in-memory in this prototype; after server restart, log in again.
  try {
    // No session refresh endpoint by design. Ask user to sign in again if token is stale.
    const probe = io({ auth: { token }, autoConnect: false });
    probe.on('connect', () => { probe.disconnect(); startGame(); });
    probe.on('connect_error', () => { localStorage.removeItem('urbanToken'); token = ''; });
    probe.connect();
  } catch (_) { localStorage.removeItem('urbanToken'); token = ''; }
}

function startGame() {
  auth.style.display = 'none'; game.hidden = false;
  $('characterName').textContent = playerData?.name || playerData?.username || 'Cidadão';
  $('cash').textContent = '$' + (playerData?.cash ?? 500);
  $('jobName').textContent = playerData?.job || 'Desempregado';
  initThree();
  socket = io({ auth: { token } });
  socket.on('connect', () => { selfId = socket.id; });
  socket.on('connect_error', (err) => toast(err.message || 'Erro de conexão.'));
  socket.on('world:init', (data) => {
    selfId = data.selfId;
    if (data.players) Object.entries(data.players).forEach(([id,p]) => { if (id !== selfId) addRemote(id,p); });
    if (data.vehicles) data.vehicles.forEach(addVehicle);
  });
  socket.on('player:joined', ({id, player}) => { if (id !== selfId) { addRemote(id, player); toast(`${player.name} entrou na cidade.`); } });
  socket.on('player:left', id => { const obj = remoteAvatars.get(id); if (obj) { scene.remove(obj); remoteAvatars.delete(id); } });
  socket.on('player:moved', data => {
    const obj = remoteAvatars.get(data.id);
    if (obj) { obj.position.set(data.x,0,data.z); obj.rotation.y = data.rotation || 0; }
  });
  socket.on('world:count', count => $('onlineCount').textContent = '● ' + count + ' online');
  socket.on('chat:message', addChat);
  socket.on('notice', toast);
  socket.on('player:stats', stats => {
    $('cash').textContent = '$' + stats.cash; $('jobName').textContent = stats.job;
    if (playerData) { playerData.cash = stats.cash; playerData.job = stats.job; }
  });
  socket.on('vehicle:entered', () => { driving = true; toast('Modo veículo demonstrativo. A física avançada será adicionada na próxima etapa.'); });
  $('chatMessages').innerHTML = '<div class="system-message">Conectado! Use o chat para falar com outros jogadores.</div>';
  animate();
}
function initThree() {
  if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc8e8);
  scene.fog = new THREE.Fog(0x9cc8e8, 65, 230);
  camera = new THREE.PerspectiveCamera(65, innerWidth/innerHeight, .1, 500);
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = false;
  $('world').replaceWith(renderer.domElement); renderer.domElement.id = 'world';
  renderer.domElement.style.touchAction = 'none';
  scene.add(new THREE.HemisphereLight(0xe5f3ff, 0x4d5a67, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1); sun.position.set(40,70,20); scene.add(sun);
  buildCity();
  localAvatar = makeAvatar(0x278bff, true);
  localAvatar.position.set(playerData?.x || 0, 0, playerData?.z || 0);
  scene.add(localAvatar);
  camera.position.set(0,5,9);
  clock = new THREE.Clock();
  addEventListener('resize', onResize);
}
function material(color, roughness=0.9) { return new THREE.MeshStandardMaterial({color, roughness}); }
function box(w,h,d,color,x,y,z, target=scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material(color));
  mesh.position.set(x,y,z); target.add(mesh); return mesh;
}
function buildCity() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420,420), material(0x6e9673));
  ground.rotation.x = -Math.PI/2; ground.position.y = -0.08; scene.add(ground);
  // Grid of asphalt streets, sidewalks and compact placeholder buildings.
  for (let i=-160;i<=160;i+=40) {
    box(12,.05,360,0x343d49,i,0,0);
    box(360,.05,12,0x343d49,0,0,i);
    box(1,.06,360,0xe8dca8,i-6.2,.02,0);
    box(1,.06,360,0xe8dca8,i+6.2,.02,0);
    box(360,.06,1,0xe8dca8,0,.02,i-6.2);
    box(360,.06,1,0xe8dca8,0,.02,i+6.2);
  }
  const colors=[0x9aa7b4,0xc1b5a2,0x7e91a7,0xc8cbd0,0xb4a08e,0x7d9e9b];
  for (let x=-150;x<=150;x+=20) for (let z=-150;z<=150;z+=20) {
    if (Math.abs(x%40)<10 || Math.abs(z%40)<10) continue;
    const h=6+Math.random()*22, w=8+Math.random()*5, d=8+Math.random()*5;
    const b=box(w,h,d,colors[Math.floor(Math.random()*colors.length)],x,h/2,z);
    b.position.x += (Math.random()-.5)*3; b.position.z += (Math.random()-.5)*3;
    // dark windows on street-facing facade
    for (let yy=2; yy<h-1; yy+=3.2) {
      for (let xx=-w/2+1.4; xx<w/2-1; xx+=2.4) {
        box(.9,1.2,.08,0x263c52,b.position.x+xx,yy,b.position.z+d/2+.05);
      }
    }
  }
  // Work marker and spawn plaza
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,.12,32), new THREE.MeshStandardMaterial({color:0xffc542,emissive:0x634000}));
  marker.position.set(0,.08,-6); scene.add(marker);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5,.08,8,32), new THREE.MeshBasicMaterial({color:0xffd45c}));
  ring.rotation.x=Math.PI/2; ring.position.set(0,.16,-6); scene.add(ring);
  box(10,.15,8,0x8b9aa8,0,.03,0);
}
function makeAvatar(color, local=false) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.48,.8,4,8), material(color));
  body.position.y=1.15; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.32,12,10), material(0xe0b18a));
  head.position.y=2.0; group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.33,12,8,0,Math.PI*2,0,Math.PI/2), material(local?0x182333:0x32251f));
  hair.position.y=2.13; group.add(hair);
  return group;
}
function addRemote(id,p) {
  if (!scene || remoteAvatars.has(id)) return;
  const obj=makeAvatar(0xc56aff,false);
  obj.position.set(p.x||0,0,p.z||0); obj.rotation.y=p.rotation||0; scene.add(obj); remoteAvatars.set(id,obj);
}
function addVehicle(v) {
  if (!scene || vehicleMeshes.has(v.id)) return;
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.2,.75,4.2), material(v.color || 0x2488ff));
  body.position.y=.8; g.add(body);
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.55,.7,1.8), material(0x263b50));
  cabin.position.set(0,1.45,-.1); g.add(cabin);
  for(const x of [-1,1]) for(const z of [-1.35,1.35]) {
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.22,12),material(0x17191d));
    wheel.rotation.z=Math.PI/2; wheel.position.set(x, .38,z); g.add(wheel);
  }
  g.position.set(v.x,0,v.z); scene.add(g); vehicleMeshes.set(v.id,g);
}
function onResize() {
  if (!camera||!renderer) return;
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
function animate() {
  if (game.hidden || !renderer) return;
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05);
  const forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)+move.z;
  const side=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+move.x;
  const len=Math.hypot(forward,side);
  if (len>.08 && !driving) {
    const speed=(running||keys.ShiftLeft?8:4.5)*dt;
    const fx=side/Math.max(1,len), fz=forward/Math.max(1,len);
    localAvatar.position.x=THREE.MathUtils.clamp(localAvatar.position.x+fx*speed,-worldBounds,worldBounds);
    localAvatar.position.z=THREE.MathUtils.clamp(localAvatar.position.z-fz*speed,-worldBounds,worldBounds);
    rotation=Math.atan2(fx,-fz); localAvatar.rotation.y=rotation;
  }
  const target=new THREE.Vector3(localAvatar.position.x,2.1,localAvatar.position.z);
  const behind=new THREE.Vector3(Math.sin(rotation)*8,5.2,Math.cos(rotation)*8);
  camera.position.lerp(target.clone().add(behind),.08); camera.lookAt(target);
  const now=performance.now();
  if (socket?.connected && now-lastMoveSent>70) {
    lastMoveSent=now;
    socket.emit('player:move',{x:localAvatar.position.x,z:localAvatar.position.z,rotation});
  }
  renderer.render(scene,camera);
}
addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.code]=false;});
function toast(message) {
  const el=$('toast'); el.textContent=message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
}
function addChat(item) {
  const row=document.createElement('div'); row.className='chat-line';
  const time=document.createElement('time'); time.textContent=item.time||'';
  const name=document.createElement('strong'); name.textContent=item.name+': ';
  const message=document.createElement('span'); message.textContent=item.message;
  row.append(time,name,message); $('chatMessages').append(row);
  $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
}
$('chatForm').addEventListener('submit',e=>{
  e.preventDefault(); const text=$('chatInput').value.trim();
  if(text&&socket){socket.emit('chat:send',text);$('chatInput').value='';}
});
$('jobButton').addEventListener('click',()=>socket?.emit('job:work'));
$('jobsButton').addEventListener('click',()=>$('jobMenu').hidden=!$('jobMenu').hidden);
$('closeJobs').addEventListener('click',()=>$('jobMenu').hidden=true);
document.querySelectorAll('[data-job]').forEach(btn=>btn.addEventListener('click',()=>{
  socket?.emit('job:choose',btn.dataset.job); $('jobMenu').hidden=true;
}));
$('saveButton').addEventListener('click',()=>{socket?.emit('player:save');toast('Pedido de salvamento enviado.');});
$('vehicleButton').addEventListener('click',()=>{
  if(!socket||!localAvatar)return;
  let best=null,dist=Infinity;
  for(const [id,v] of vehicleMeshes){const d=localAvatar.position.distanceTo(v.position);if(d<dist){dist=d;best=id;}}
  if(best!==null) socket.emit('vehicle:enter',best); else toast('Nenhum veículo disponível.');
});
$('interactButton').addEventListener('click',()=>{
  const d=Math.hypot(localAvatar.position.x,localAvatar.position.z+6);
  if(d<5) socket?.emit('job:work'); else $('vehicleButton').click();
});
$('runButton').addEventListener('touchstart',e=>{e.preventDefault();running=true;},{passive:false});
$('runButton').addEventListener('touchend',()=>running=false);
const joystick=$('joystick'),stick=$('stick');
function joyStart(e){e.preventDefault();joystickActive=true;const r=joystick.getBoundingClientRect();joystickCenter={x:r.left+r.width/2,y:r.top+r.height/2};joyMove(e);}
function joyMove(e){
  if(!joystickActive)return; const p=e.touches?e.touches[0]:e;
  let dx=p.clientX-joystickCenter.x,dy=p.clientY-joystickCenter.y; const max=34,len=Math.hypot(dx,dy)||1;
  if(len>max){dx=dx/len*max;dy=dy/len*max;}
  stick.style.transform=`translate(${dx}px,${dy}px)`;
  move.x=dx/max;move.z=dy/max;
}
function joyEnd(){joystickActive=false;move={x:0,z:0};stick.style.transform='translate(0,0)';}
joystick.addEventListener('touchstart',joyStart,{passive:false});
joystick.addEventListener('touchmove',joyMove,{passive:false});
joystick.addEventListener('touchend',joyEnd);
joystick.addEventListener('touchcancel',joyEnd);
joystick.addEventListener('mousedown',joyStart);
addEventListener('mousemove',joyMove);addEventListener('mouseup',joyEnd);
addEventListener('beforeunload',()=>socket?.emit('player:save'));
