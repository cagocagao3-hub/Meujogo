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
const io = new Server(server);

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
);
`);
const vehicleCount = db.prepare('SELECT COUNT(*) AS n FROM vehicles').get().n;
if (vehicleCount === 0) {
  const addVehicle = db.prepare('INSERT INTO vehicles (model, x, y, z, color) VALUES (?, ?, ?, ?, ?)');
  addVehicle.run('Sedan Azul', 5, 0, 5, '#2488ff');
  addVehicle.run('Sedan Vermelho', -7, 0, 8, '#e14b4b');
  addVehicle.run('Sedan Verde', 9, 0, -8, '#35bb83');
}

const sessions = new Map(); // token -> account id; use a persistent auth provider before public launch
const online = new Map();
const lastJobPay = new Map();
const lastMove = new Map();

const getAccountByUsername = db.prepare('SELECT * FROM accounts WHERE username = ? COLLATE NOCASE');
const getCharacter = db.prepare('SELECT * FROM characters WHERE account_id = ?');
const createAccount = db.prepare('INSERT INTO accounts (username, password_hash) VALUES (?, ?)');
const createCharacter = db.prepare('INSERT INTO characters (account_id, character_name, cash, job) VALUES (?, ?, 500, ?)');
const saveCharacter = db.prepare(`
  UPDATE characters SET cash = ?, job = ?, x = ?, y = ?, z = ?, updated_at = CURRENT_TIMESTAMP
  WHERE account_id = ?
`);

function cleanUsername(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}
function validUsername(name) {
  return /^[A-Za-z0-9_]{3,20}$/.test(name);
}
function publicPlayer(accountId) {
  const account = db.prepare('SELECT id, username FROM accounts WHERE id = ?').get(accountId);
  const character = getCharacter.get(accountId);
  if (!account || !character) return null;
  return {
    id: account.id, username: account.username, name: character.character_name,
    cash: character.cash, job: character.job,
    x: character.x, y: character.y, z: character.z
  };
}
function publicVehicles() {
  return db.prepare('SELECT id, model, x, y, z, color FROM vehicles ORDER BY id').all();
}
function onlineSnapshot() {
  const players = {};
  for (const [id, p] of online) players[id] = p;
  return { players, vehicles: publicVehicles() };
}

app.get('/api/status', (_req, res) => {
  res.json({ name: 'URBAN Roleplay', version: '3.0.0', online: online.size });
});

app.post('/api/register', async (req, res) => {
  try {
    const username = cleanUsername(req.body?.username);
    const password = req.body?.password;
    if (!validUsername(username)) {
      return res.status(400).json({ error: 'Use um usuário de 3 a 20 caracteres: letras, números ou _.' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
      return res.status(400).json({ error: 'A senha precisa ter de 6 a 72 caracteres.' });
    }
    if (getAccountByUsername.get(username)) return res.status(409).json({ error: 'Esse usuário já existe.' });
    const hash = await bcrypt.hash(password, 12);
    const result = createAccount.run(username, hash);
    const accountId = Number(result.lastInsertRowid);
    createCharacter.run(accountId, username, 'Desempregado');
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, accountId);
    res.json({ token, player: publicPlayer(accountId) });
  } catch (err) {
    console.error('register:', err.message);
    res.status(500).json({ error: 'Não foi possível criar a conta agora.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const username = cleanUsername(req.body?.username);
    const password = req.body?.password;
    if (typeof password !== 'string' || !username) return res.status(400).json({ error: 'Preencha usuário e senha.' });
    const account = getAccountByUsername.get(username);
    if (!account || !(await bcrypt.compare(password, account.password_hash))) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, account.id);
    res.json({ token, player: publicPlayer(account.id) });
  } catch (err) {
    console.error('login:', err.message);
    res.status(500).json({ error: 'Não foi possível entrar agora.' });
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const accountId = sessions.get(token);
  if (!accountId) return next(new Error('Faça login novamente.'));
  const player = publicPlayer(accountId);
  if (!player) return next(new Error('Personagem não encontrado.'));
  socket.accountId = accountId;
  socket.player = player;
  next();
});

io.on('connection', (socket) => {
  const accountId = socket.accountId;
  // Allow only one active socket per account.
  for (const [sid, entry] of online.entries()) {
    if (entry.accountId === accountId && sid !== socket.id) {
      io.sockets.sockets.get(sid)?.disconnect(true);
    }
  }
  const player = publicPlayer(accountId);
  socket.player = player;
  online.set(socket.id, { ...player, accountId });
  socket.emit('world:init', { selfId: socket.id, ...onlineSnapshot() });
  socket.broadcast.emit('player:joined', { id: socket.id, player: { ...player } });
  io.emit('world:count', online.size);

  socket.on('player:move', (data) => {
    const now = Date.now();
    if (now - (lastMove.get(socket.id) || 0) < 40) return;
    lastMove.set(socket.id, now);
    if (!data || !['x', 'z', 'rotation'].every(k => Number.isFinite(data[k]))) return;
    // Basic movement sanity checks; authoritative movement/anti-cheat should be expanded.
    const old = online.get(socket.id);
    if (!old) return;
    const dx = data.x - old.x, dz = data.z - old.z;
    if (Math.hypot(dx, dz) > 2.5) return;
    old.x = Math.max(-180, Math.min(180, data.x));
    old.z = Math.max(-180, Math.min(180, data.z));
    old.rotation = data.rotation;
    socket.broadcast.volatile.emit('player:moved', {
      id: socket.id, x: old.x, z: old.z, rotation: old.rotation
    });
  });

  socket.on('chat:send', (raw) => {
    if (typeof raw !== 'string') return;
    const message = raw.trim().slice(0, 180);
    if (!message) return;
    io.emit('chat:message', {
      name: socket.player.name,
      username: socket.player.username,
      message,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('job:work', () => {
    const now = Date.now();
    const previous = lastJobPay.get(accountId) || 0;
    if (now - previous < 30000) {
      socket.emit('notice', 'Aguarde um pouco antes de trabalhar novamente.');
      return;
    }
    const character = getCharacter.get(accountId);
    if (!character) return;
    const pay = 50;
    db.prepare('UPDATE characters SET cash = cash + ?, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?').run(pay, accountId);
    lastJobPay.set(accountId, now);
    const updated = publicPlayer(accountId);
    socket.player = updated;
    const entry = online.get(socket.id);
    if (entry) Object.assign(entry, updated);
    socket.emit('player:stats', { cash: updated.cash, job: updated.job });
    socket.emit('notice', `Trabalho concluído! Você recebeu $${pay}.`);
  });

  socket.on('job:choose', (job) => {
    const jobs = ['Desempregado', 'Entregador', 'Taxista', 'Mecânico'];
    if (!jobs.includes(job)) return;
    db.prepare('UPDATE characters SET job = ?, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?').run(job, accountId);
    const updated = publicPlayer(accountId);
    socket.player = updated;
    const entry = online.get(socket.id);
    if (entry) Object.assign(entry, updated);
    socket.emit('player:stats', { cash: updated.cash, job: updated.job });
    socket.emit('notice', `Emprego selecionado: ${job}. Use TRABALHAR para ganhar $50 (intervalo de 30 segundos).`);
  });

  socket.on('vehicle:enter', (vehicleId) => {
    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(vehicleId));
    if (!vehicle) return socket.emit('notice', 'Veículo não encontrado.');
    const p = online.get(socket.id);
    if (!p || Math.hypot(p.x - vehicle.x, p.z - vehicle.z) > 5) {
      return socket.emit('notice', 'Chegue mais perto de um veículo.');
    }
    socket.emit('notice', `Você entrou no ${vehicle.model}. Dirija usando os controles. (Protótipo)`);
    socket.emit('vehicle:entered', { id: vehicle.id, x: vehicle.x, z: vehicle.z });
  });

  socket.on('player:save', () => {
    const p = online.get(socket.id);
    if (p) saveCharacter.run(p.cash, p.job, p.x, p.y, p.z, accountId);
  });

  socket.on('disconnect', () => {
    const p = online.get(socket.id);
    if (p) saveCharacter.run(p.cash, p.job, p.x, p.y, p.z, accountId);
    online.delete(socket.id);
    lastMove.delete(socket.id);
    io.emit('player:left', socket.id);
    io.emit('world:count', online.size);
  });
});

setInterval(() => {
  for (const [socketId, p] of online.entries()) {
    saveCharacter.run(p.cash, p.job, p.x, p.y, p.z, p.accountId);
  }
}, 30000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`URBAN Roleplay v3 rodando na porta ${PORT}`);
});
