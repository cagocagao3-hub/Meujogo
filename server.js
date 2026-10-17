const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_, res) => res.json({ ok: true, players: Object.keys(players).length }));

const players = Object.create(null);
const ARENA = 90;
const MAX_HEALTH = 100;
const TICK_MS = 50;
let round = 1;
let roundState = "lobby";
let roundEndsAt = 0;

function spawnPoint() {
  return { x: (Math.random() - .5) * 50, z: (Math.random() - .5) * 50 };
}
function publicPlayer(p) {
  return { id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw,
    health: p.health, alive: p.alive, crouch: p.crouch, kills: p.kills, state: p.state };
}
function alivePlayers() { return Object.values(players).filter(p => p.alive && p.state === "match"); }
function broadcastNotice(text, type = "info") { io.emit("notice", { text, type, at: Date.now() }); }

function startRound() {
  round++;
  roundState = "match";
  roundEndsAt = Date.now() + 12 * 60 * 1000;
  for (const p of Object.values(players)) {
    const s = spawnPoint();
    Object.assign(p, { x:s.x, y:0, z:s.z, health:MAX_HEALTH, alive:true, kills:0, state:"match", lastShot:0 });
  }
  io.emit("round", { state:roundState, round, endsAt:roundEndsAt });
  broadcastNotice("Partida ranqueada iniciada!", "success");
}
function endRound(winner) {
  roundState = "lobby";
  io.emit("round", { state:roundState, round, winner: winner ? winner.name : null });
  if (winner) broadcastNotice(`${winner.name} venceu a partida!`, "success");
  else broadcastNotice("Partida encerrada. Voltando ao lobby.", "info");
  for (const p of Object.values(players)) {
    p.state = "lobby"; p.alive = false; p.health = MAX_HEALTH;
  }
  io.emit("snapshot", Object.values(players).map(publicPlayer));
}

io.on("connection", socket => {
  const s = spawnPoint();
  players[socket.id] = {
    id:socket.id, name:`Player-${socket.id.slice(0,4)}`, x:s.x, y:0, z:s.z, yaw:0,
    health:MAX_HEALTH, alive:false, crouch:false, kills:0, state:"lobby",
    lastShot:0, lastDamage:0
  };
  socket.emit("welcome", { id:socket.id, round, state:roundState, players:Object.values(players).map(publicPlayer) });
  socket.broadcast.emit("playerJoined", publicPlayer(players[socket.id]));

  socket.on("setName", name => {
    const p = players[socket.id]; if (!p) return;
    p.name = String(name || "").replace(/[<>]/g, "").trim().slice(0,16) || p.name;
    io.emit("playerUpdated", publicPlayer(p));
  });
  socket.on("joinMatch", () => {
    const p = players[socket.id]; if (!p) return;
    if (roundState !== "match") {
      // The first player can start a test round; real matchmaking can be added later.
      if (Object.values(players).filter(x => x.state === "lobby").length >= 1) startRound();
    } else {
      const s = spawnPoint();
      Object.assign(p, { x:s.x, y:0, z:s.z, health:MAX_HEALTH, alive:true, kills:0, state:"match" });
      socket.emit("round", { state:"match", round, endsAt:roundEndsAt });
    }
  });
  socket.on("input", data => {
    const p = players[socket.id];
    if (!p || !p.alive || p.state !== "match" || !data) return;
    p.x = clamp(Number(data.x) || 0, -ARENA/2, ARENA/2);
    p.y = clamp(Number(data.y) || 0, 0, 4);
    p.z = clamp(Number(data.z) || 0, -ARENA/2, ARENA/2);
    p.yaw = Number(data.yaw) || 0;
    p.crouch = !!data.crouch;
  });
  socket.on("shoot", targetId => {
    const p = players[socket.id], target = players[String(targetId)];
    const now = Date.now();
    if (!p || !target || p.id === target.id || !p.alive || !target.alive ||
        p.state !== "match" || target.state !== "match" || now - p.lastShot < 250) return;
    p.lastShot = now;
    const dx = target.x - p.x, dz = target.z - p.z;
    const dist = Math.hypot(dx,dz);
    if (dist > 32) return;
    // Basic server-side line-of-sight approximation; validate shot angle to prevent arbitrary remote hits.
    const desired = Math.atan2(dx, dz);
    const diff = Math.atan2(Math.sin(desired-p.yaw), Math.cos(desired-p.yaw));
    if (Math.abs(diff) > 0.42) return;
    target.health = Math.max(0, target.health - 25);
    target.lastDamage = now;
    io.emit("hit", { shooter:p.id, target:target.id, damage:25, health:target.health });
    if (target.health <= 0) {
      target.alive = false; target.state = "lobby"; p.kills++;
      io.emit("elimination", { killer:p.id, killerName:p.name, victim:target.id, victimName:target.name, kills:p.kills });
      io.to(target.id).emit("eliminated", { killerName:p.name, kills:target.kills });
      target.health = MAX_HEALTH;
      target.x = 0; target.y = 0; target.z = 0;
      const remaining = alivePlayers();
      if (remaining.length <= 1 && roundState === "match") endRound(remaining[0] || null);
    }
  });
  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
    if (roundState === "match" && alivePlayers().length <= 1) endRound(alivePlayers()[0] || null);
  });
});
function clamp(n,min,max) { return Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0)); }

setInterval(() => {
  if (roundState === "match" && Date.now() > roundEndsAt) {
    const sorted = alivePlayers().sort((a,b) => b.health-a.health || b.kills-a.kills);
    endRound(sorted[0] || null);
  }
  io.emit("snapshot", Object.values(players).map(publicPlayer));
}, TICK_MS);

server.listen(PORT, "0.0.0.0", () => console.log(`Battle Royale 1.0 em http://localhost:${PORT}`));
