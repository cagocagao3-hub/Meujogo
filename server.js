'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'urban.sqlite');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS characters (
  account_id INTEGER PRIMARY KEY,
  character_name TEXT NOT NULL,
  cash INTEGER NOT NULL DEFAULT 500,
  job TEXT NOT NULL DEFAULT 'Desempregado',
  x REAL NOT NULL DEFAULT 0,
  y REAL NOT NULL DEFAULT 0,
  z REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER,
  model TEXT NOT NULL DEFAULT 'Sedan',
  x REAL NOT NULL DEFAULT 4,
  y REAL NOT NULL DEFAULT 0,
  z REAL NOT NULL DEFAULT 4,
  color TEXT NOT NULL DEFAULT '#2b8cff',
  FOREIGN KEY(owner_id) REFERENCES accounts(id) ON DELETE SET NULL
);`);
const vehicleCount = db.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n;
if (vehicleCount === 0) {
  const add = db.prepare('INSERT INTO vehicles (model,x,y,z,color) VALUES (?,?,?,?,?)');
  add.run('Sedan Azul', 7, 0, 3, '#2488ff');
  add.run('Sedan Vermelho', -8, 0, 3, '#e14b4b');
  add.run('Sedan Verde', 11, 0, -9, '#35bb83');
}

const sessions = new Map();
const online = new Map();
const lastMove = new Map();
const missions = new Map();
const CHECKPOINT = { x: 0, z: -6 };
const DEPOT = { x: 0, z: -14 };
const JOB_LOCATIONS = { Entregador: { x: 0, z: -14, name: 'Garagem de entregas' }, Taxista: { x: 40, z: 0, name: 'Ponto de táxi' }, Mecânico: { x: -40, z: 0, name: 'Oficina mecânica' } };
const DESTINATIONS = [
  { x: 54, z: -54, name: 'Restaurante Verona' },
  { x: -54, z: 46, name: 'Lanchonete Central' },
  { x: 86, z: 34, name: 'Mercado da Praça' },
  { x: -86, z: -34, name: 'Condomínio Vista' },
  { x: 34, z: 86, name: 'Café da Estação' },
  { x: -34, z: -86, name: 'Doca Norte' }
];
const JOBS = ['Desempregado', 'Entregador', 'Taxista', 'Mecânico'];
const getAccount = db.prepare('SELECT * FROM accounts WHERE username = ? COLLATE NOCASE');
const getCharacter = db.prepare('SELECT * FROM characters WHERE account_id = ?');
const createAccount = db.prepare('INSERT INTO accounts (username,password_hash) VALUES (?,?)');
const createCharacter = db.prepare('INSERT INTO characters (account_id,character_name,cash,job,x,y,z) VALUES (?,?,500,?,0,0,0)');
const saveCharacter = db.prepare('UPDATE characters SET cash=?,job=?,x=?,y=?,z=?,updated_at=CURRENT_TIMESTAMP WHERE account_id=?');

function cleanUsername(v) { return typeof v === 'string' ? v.trim() : ''; }
function validUsername(v) { return /^[A-Za-z0-9_]{3,20}$/.test(v); }
function publicPlayer(id) {
  const a = db.prepare('SELECT id,username FROM accounts WHERE id=?').get(id);
  const c = getCharacter.get(id);
  if (!a || !c) return null;
  return { id:a.id, username:a.username, name:c.character_name, cash:c.cash, job:c.job, x:c.x, y:c.y, z:c.z };
}
function vehicles() { return db.prepare('SELECT id,model,x,y,z,color FROM vehicles ORDER BY id').all(); }
function snapshot() { const players={}; for (const [id,p] of online) players[id]=p; return { players, vehicles:vehicles() }; }
function distance(a,b) { return Math.hypot(a.x-b.x,a.z-b.z); }
function updateSocketPlayer(socket) {
  const p=publicPlayer(socket.accountId); if (!p) return null;
  socket.player=p; const live=online.get(socket.id); if (live) Object.assign(live,p); return p;
}
function chooseDestination(previousIndex=-1) {
  let idx=Math.floor(Math.random()*DESTINATIONS.length);
  if (DESTINATIONS.length>1 && idx===previousIndex) idx=(idx+1)%DESTINATIONS.length;
  return { ...DESTINATIONS[idx], index:idx };
}
function publicMission(m) { return { job:m.job, phase:m.phase, target:{x:m.target.x,z:m.target.z,name:m.target.name}, vehicle:m.vehicle }; }

app.get('/api/status', (_req,res)=>res.json({name:'URBAN Roleplay',version:'4.0.0',online:online.size}));
app.get('/api/me',(req,res)=>{const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const id=sessions.get(token);if(!id)return res.status(401).json({error:'Sessão expirada. Entre novamente.'});const player=publicPlayer(id);if(!player)return res.status(401).json({error:'Personagem não encontrado.'});res.json({player});});
app.post('/api/register', async (req,res)=>{
  try {
    const username=cleanUsername(req.body?.username), password=req.body?.password;
    if (!validUsername(username)) return res.status(400).json({error:'Use um usuário de 3 a 20 caracteres: letras, números ou _.'});
    if (typeof password!=='string'||password.length<6||password.length>72) return res.status(400).json({error:'A senha precisa ter de 6 a 72 caracteres.'});
    if (getAccount.get(username)) return res.status(409).json({error:'Esse usuário já existe.'});
    const hash=await bcrypt.hash(password,12), result=createAccount.run(username,hash), id=Number(result.lastInsertRowid);
    createCharacter.run(id,username,'Desempregado');
    const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,id);
    res.json({token,player:publicPlayer(id)});
  } catch(e) { console.error('register:',e.message); res.status(500).json({error:'Não foi possível criar a conta agora.'}); }
});
app.post('/api/login', async (req,res)=>{
  try {
    const username=cleanUsername(req.body?.username), password=req.body?.password;
    if (typeof password!=='string'||!username) return res.status(400).json({error:'Preencha usuário e senha.'});
    const a=getAccount.get(username);
    if (!a||!(await bcrypt.compare(password,a.password_hash))) return res.status(401).json({error:'Usuário ou senha incorretos.'});
    const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,a.id); res.json({token,player:publicPlayer(a.id)});
  } catch(e) { console.error('login:',e.message); res.status(500).json({error:'Não foi possível entrar agora.'}); }
});

io.use((socket,next)=>{
  const id=sessions.get(socket.handshake.auth?.token);
  if (!id) return next(new Error('Faça login novamente.'));
  const p=publicPlayer(id); if (!p) return next(new Error('Personagem não encontrado.'));
  socket.accountId=id; socket.player=p; next();
});
io.on('connection',(socket)=>{
  const accountId=socket.accountId;
  for (const [sid,p] of online) if (p.accountId===accountId && sid!==socket.id) io.sockets.sockets.get(sid)?.disconnect(true);
  const player=publicPlayer(accountId); socket.player=player;
  online.set(socket.id,{...player,accountId,rotation:0});
  socket.emit('world:init',{selfId:socket.id,...snapshot(),checkpoint:CHECKPOINT,depot:DEPOT,jobLocations:JOB_LOCATIONS});
  socket.broadcast.emit('player:joined',{id:socket.id,player:{...player}}); io.emit('world:count',online.size);
  const mission=missions.get(accountId); if (mission) socket.emit('mission:update',publicMission(mission));

  socket.on('player:move',(data)=>{
    const now=Date.now(); if (now-(lastMove.get(socket.id)||0)<45) return;
    lastMove.set(socket.id,now);
    if (!data||!['x','z','rotation'].every(k=>Number.isFinite(data[k]))) return;
    const p=online.get(socket.id); if (!p) return;
    const dx=data.x-p.x,dz=data.z-p.z;
    // Limit movement per packet and clamp to the playable city.
    if (Math.hypot(dx,dz)>2.2) return;
    p.x=Math.max(-180,Math.min(180,data.x)); p.z=Math.max(-180,Math.min(180,data.z)); p.rotation=data.rotation;
    socket.broadcast.volatile.emit('player:moved',{id:socket.id,x:p.x,z:p.z,rotation:p.rotation});
  });
  socket.on('chat:send',(raw)=>{
    if (typeof raw!=='string') return; const message=raw.trim().slice(0,180); if(!message)return;
    io.emit('chat:message',{name:socket.player.name,username:socket.player.username,message,time:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});
  });
  socket.on('job:choose',(job)=>{
    if (!JOBS.includes(job)||job==='Desempregado') return;
    const p=online.get(socket.id); if(!p||distance(p,CHECKPOINT)>5.5) return socket.emit('notice','Vá até o checkpoint amarelo do Centro de Empregos.');
    missions.delete(accountId);
    db.prepare('UPDATE characters SET job=?,updated_at=CURRENT_TIMESTAMP WHERE account_id=?').run(job,accountId);
    const updated=updateSocketPlayer(socket); if(!updated)return;
    // Starting point of each job is deliberately near the work depot.
    const jobLocation=JOB_LOCATIONS[job]||DEPOT; p.x=jobLocation.x; p.z=jobLocation.z; updated.x=p.x; updated.z=p.z;
    saveCharacter.run(updated.cash,updated.job,p.x,updated.y,p.z,accountId);
    socket.emit('job:accepted',{player:updated,teleport:{x:p.x,z:p.z,name:jobLocation.name},job});
    socket.broadcast.emit('player:moved',{id:socket.id,x:p.x,z:p.z,rotation:p.rotation||0});
    socket.emit('notice',`${job} contratado! Você foi levado ao pátio de serviço. Aproxime-se do marcador azul e toque em AÇÃO para iniciar o turno.`);
  });
  socket.on('job:start',()=>{
    const p=online.get(socket.id); if(!p)return;
    const c=getCharacter.get(accountId); if(!c||!['Entregador','Taxista','Mecânico'].includes(c.job)) return socket.emit('notice','Primeiro escolha um emprego no Centro de Empregos.');
    const jobLocation=JOB_LOCATIONS[c.job]||DEPOT; if(distance(p,jobLocation)>8) return socket.emit('notice',`Vá até ${jobLocation.name} para começar o turno.`);
    if(missions.has(accountId)) return socket.emit('notice','Você já tem um serviço ativo. Siga o marcador no mapa.');
    const target=chooseDestination();
    const m={job:c.job,phase:'route',target,vehicle:c.job==='Entregador'?'moto':c.job==='Taxista'?'taxi':'van'};
    missions.set(accountId,m);
    socket.emit('mission:update',publicMission(m));
    socket.emit('notice',c.job==='Entregador'?'Moto liberada! Siga o marcador dourado e entregue o pedido para receber $50.':'Veículo de serviço liberado! Siga o marcador dourado para concluir a tarefa e receber $50.');
  });
  socket.on('job:deliver',()=>{
    const p=online.get(socket.id),m=missions.get(accountId); if(!p||!m)return socket.emit('notice','Você não tem uma tarefa ativa.');
    if(distance(p,m.target)>9) return socket.emit('notice','Você ainda está longe do destino. Chegue ao marcador dourado.');
    const pay=50;
    db.prepare('UPDATE characters SET cash=cash+?,updated_at=CURRENT_TIMESTAMP WHERE account_id=?').run(pay,accountId);
    missions.delete(accountId);
    const updated=updateSocketPlayer(socket); if(!updated)return;
    socket.emit('mission:complete',{pay,cash:updated.cash});
    socket.emit('mission:update',null);
    socket.emit('notice',`Entrega concluída! Você recebeu $${pay}. Volte ao pátio azul para iniciar outro serviço.`);
  });
  socket.on('player:save',()=>{const p=online.get(socket.id);if(p)saveCharacter.run(p.cash,p.job,p.x,p.y,p.z,accountId);});
  socket.on('disconnect',()=>{
    const p=online.get(socket.id); if(p)saveCharacter.run(p.cash,p.job,p.x,p.y,p.z,accountId);
    online.delete(socket.id);lastMove.delete(socket.id);io.emit('player:left',socket.id);io.emit('world:count',online.size);
  });
});
setInterval(()=>{for(const [sid,p] of online)saveCharacter.run(p.cash,p.job,p.x,p.y,p.z,p.accountId);},30000).unref();
server.listen(PORT,'0.0.0.0',()=>console.log(`URBAN Roleplay v4.0.0 rodando na porta ${PORT}`));
