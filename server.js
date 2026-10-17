const express=require("express");
const http=require("http");
const path=require("path");
const {Server}=require("socket.io");
const app=express(),server=http.createServer(app),io=new Server(server);
const PORT=process.env.PORT||3000;
app.use(express.static(path.join(__dirname,"public")));
app.get("/health",(_,res)=>res.json({ok:true,online:Object.keys(players).length}));
const players={}; const MAX=20, ARENA=240;
let state="lobby",round=0,endsAt=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const spawn=()=>({x:(Math.random()-.5)*150,z:(Math.random()-.5)*150});
function safe(p){return {id:p.id,name:p.name,x:p.x,y:p.y,z:p.z,yaw:p.yaw,hp:p.hp,alive:p.alive,state:p.state,kills:p.kills,crouch:p.crouch,team:p.team}}
function live(){return Object.values(players).filter(p=>p.alive&&p.state==="match")}
function notice(text,type="info"){io.emit("notice",{text,type})}
function startRound(){
 const waiting=Object.values(players).filter(p=>p.state==="lobby");
 if(!waiting.length)return;
 state="match";round++;endsAt=Date.now()+15*60*1000;
 for(const p of waiting){const s=spawn();Object.assign(p,s,{y:0,hp:200,alive:true,state:"match",kills:0,lastShot:0})}
 io.emit("round",{state,round,endsAt});notice("Batalha iniciada! Boa sorte.","success");
 io.emit("snapshot",Object.values(players).map(safe));
}
function endRound(winner){state="lobby";io.emit("round",{state,round,winner:winner?.name||null});notice(winner?winner.name+" venceu!":"Partida encerrada.");
 for(const p of Object.values(players)){p.state="lobby";p.alive=false;p.hp=200}
 io.emit("snapshot",Object.values(players).map(safe))}
io.on("connection",s=>{
 const p={id:s.id,name:"Player"+s.id.slice(0,4),...spawn(),y:0,yaw:0,hp:200,alive:false,state:"lobby",kills:0,crouch:false,lastShot:0};
 players[s.id]=p;s.emit("welcome",{id:s.id,state,round,players:Object.values(players).map(safe)});s.broadcast.emit("playerJoined",safe(p));
 s.on("profile",d=>{if(!players[s.id])return;p.name=String(d?.name||p.name).replace(/[<>]/g,"").slice(0,18);io.emit("playerUpdated",safe(p))});
 s.on("joinMatch",()=>{if(state!=="match")startRound();else if(p.state==="lobby"){const pos=spawn();Object.assign(p,pos,{hp:200,alive:true,state:"match",kills:0});s.emit("round",{state,round,endsAt})}});
 s.on("input",d=>{if(!p.alive||p.state!=="match"||!d)return;
 // Basic sanity bounds. Production build should simulate movement server-side.
 p.x=clamp(d.x,-ARENA/2,ARENA/2);p.y=clamp(d.y,0,5);p.z=clamp(d.z,-ARENA/2,ARENA/2);p.yaw=clamp(d.yaw,-1e6,1e6);p.crouch=!!d.crouch});
 s.on("shoot",id=>{const t=players[String(id)],now=Date.now();if(!t||t.id===p.id||!p.alive||!t.alive||p.state!=="match"||now-p.lastShot<280)return;p.lastShot=now;
 const dx=t.x-p.x,dz=t.z-p.z,dist=Math.hypot(dx,dz),want=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(want-p.yaw),Math.cos(want-p.yaw));
 if(dist>38||Math.abs(diff)>.38)return;t.hp=Math.max(0,t.hp-25);io.emit("hit",{shooter:p.id,target:t.id,damage:25,health:t.hp});
 if(t.hp===0){t.alive=false;t.state="lobby";p.kills++;io.emit("elimination",{killer:p.id,killerName:p.name,victim:t.id,victimName:t.name,kills:p.kills});io.to(t.id).emit("eliminated",{killerName:p.name,kills:t.kills});
 const alive=live();if(alive.length<=1)endRound(alive[0]||null)}
 });
 s.on("disconnect",()=>{delete players[s.id];io.emit("playerLeft",s.id);if(state==="match"&&live().length<=1)endRound(live()[0]||null)});
});
setInterval(()=>{if(state==="match"&&Date.now()>endsAt){const a=live().sort((x,y)=>y.hp-x.hp||y.kills-x.kills);endRound(a[0]||null)}io.emit("snapshot",Object.values(players).map(safe))},50);
server.listen(PORT,"0.0.0.0",()=>console.log("BR Elite rodando na porta "+PORT));