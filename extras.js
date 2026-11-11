
module.exports=({app,io,db,save,parties,emit,init,publicUser,isOwner})=>{
const avatars=['🎮','🦊','🐉','👾','🚀','🐱','🦄','⚡','🐼','🦁'];
const get=u=>db.users[u];
const profile=u=>{let x=get(u);return { ...publicUser(u),avatar:x.avatar||'🎮',xp:x.xp||0,level:1+Math.floor((x.xp||0)/100),achievements:x.achievements||[],friends:x.friends||[] }};
const requireLogin=(req,res,next)=>{if(!req.session.user||!get(req.session.user)||get(req.session.user).banned)return res.status(401).json({error:'Log in first'});next()};
app.get('/api/profile',requireLogin,(req,res)=>res.json(profile(req.session.user)));
app.post('/api/avatar',requireLogin,(req,res)=>{let a=req.body?.avatar;if(!avatars.includes(a))return res.status(400).json({error:'Invalid avatar'});get(req.session.user).avatar=a;save();res.json(profile(req.session.user))});
app.get('/api/friends',requireLogin,(req,res)=>{let u=req.session.user,x=get(u);res.json({friends:(x.friends||[]).filter(get).map(profile),requests:(x.requests||[]).filter(get)})});
app.post('/api/friend/request',requireLogin,(req,res)=>{let u=req.session.user,v=String(req.body?.username||'').toLowerCase(),x=get(u),y=get(v);if(!y||v===u)return res.status(400).json({error:'Player not found'});if((x.friends||[]).includes(v))return res.status(400).json({error:'Already friends'});y.requests=y.requests||[];if(!y.requests.includes(u))y.requests.push(u);save();res.json({ok:true})});
app.post('/api/friend/accept',requireLogin,(req,res)=>{let u=req.session.user,v=String(req.body?.username||'').toLowerCase(),x=get(u),y=get(v);if(!y||!(x.requests||[]).includes(v))return res.status(400).json({error:'No request from that player'});x.requests=x.requests.filter(n=>n!==v);x.friends=x.friends||[];y.friends=y.friends||[];if(!x.friends.includes(v))x.friends.push(v);if(!y.friends.includes(u))y.friends.push(u);save();res.json({ok:true})});
app.get('/api/players',requireLogin,(req,res)=>res.json(Object.keys(db.users).slice(0,150).map(u=>({username:u,avatar:get(u).avatar||'🎮'}))));
const online=new Map(),timers=new Map(),inputs=new Map();
const levels=['Easy','Medium','Hard','Extreme','Impossible'];
function resetParty(p){stop(p.code);if(p.arenaTimer)clearInterval(p.arenaTimer);p.arenaTimer=null;p.arena=null;p.matchId=(p.matchId||0)+1;p.started=false;p.ready={};p.pong=null;p.winner=null;p.turn='X';p.deadline=null;p.board=init(p.game);p.choices={};p.round=0;p.lastRound=null;p.goAt=null;emit(p)}
io.on('connection',socket=>{const u=socket.request.session?.user;if(!u)return;socket.on('partyDifficulty',value=>{const p=parties.get(socket.data.code);if(!p||p.host!==u||!Number.isInteger(value)||value<0||value>4)return;p.difficulty=value;resetParty(p)})});
io.on('connection',socket=>{const u=socket.request.session?.user;if(!u)return;socket.on('partyReady',ready=>{const p=parties.get(socket.data.code);if(!p||!p.players.includes(u)||p.started||p.winner||typeof ready!=='boolean')return;p.ready=p.ready||{};p.ready[u]=ready;if(p.players.length===2&&p.players.every(name=>p.ready[name])){p.started=true;p.turn='X';p.deadline=['tictactoe','connect4'].includes(p.game)?Date.now()+[30000,20000,14000,9000,6000][p.difficulty??1]:null;if(p.game==='pong')pongStart(p);if(p.game==='neontag')arenaStart(p)}emit(p)})});
const ownerOnly=(req,res,next)=>isOwner(req.session.user)?next():res.status(403).json({error:'Owner access only'});
app.get('/api/admin/players',requireLogin,ownerOnly,(req,res)=>res.json(Object.keys(db.users).sort().map(username=>({username,role:isOwner(username)?'owner':'player',banned:!!get(username).banned,wins:get(username).wins||0,points:get(username).points||0,xp:get(username).xp||0,played:get(username).played||0}))));
app.post('/api/admin/ban',requireLogin,ownerOnly,async(req,res)=>{const target=String(req.body?.username||'').trim().toLowerCase(),ban=req.body?.banned;if(!get(target)||typeof ban!=='boolean')return res.status(400).json({error:'Invalid player or action'});if(isOwner(target))return res.status(403).json({error:'Owner cannot be banned'});get(target).banned=ban;try{await save();if(ban){for(const s of io.sockets.sockets.values())if(s.data.user===target){s.emit('errorMsg','Your account has been banned');s.disconnect(true)}}res.json({ok:true})}catch{res.status(503).json({error:'Unable to save ban'})}});

// Casual solo rewards are capped and cooldown-limited; competitive leaderboard wins remain online-only.
const soloCooldown=new Map();
app.post('/api/solo/result',requireLogin,async(req,res)=>{
 const u=req.session.user,x=get(u),game=req.body?.game,won=req.body?.won,elapsed=req.body?.elapsed,now=Date.now();
 if(!Number.isInteger(game)||game<0||game>21||typeof won!=='boolean'||!Number.isInteger(elapsed)||elapsed<0||elapsed>7200)return res.status(400).json({error:'Invalid result'});
 const day=new Date().toISOString().slice(0,10);if(x.soloDay!==day){x.soloDay=day;x.soloCount=0}
 if(x.soloCount>=30)return res.json({rewarded:false,message:'Daily solo reward limit reached (30 games).'});
 if(now-(soloCooldown.get(u)||0)<20000||elapsed<5)return res.json({rewarded:false,message:'Play a little longer before earning another reward.'});
 soloCooldown.set(u,now);x.soloCount++;const xp=won?25:8,points=won?2:0;x.xp=(x.xp||0)+xp;x.points=(x.points||0)+points;x.achievements=x.achievements||[];if(!x.achievements.includes('Solo Starter'))x.achievements.push('Solo Starter');
 try{await save();res.json({rewarded:true,xp,points,level:1+Math.floor(x.xp/100)})}catch{res.status(503).json({error:'Could not save reward'})}
});
const publish=p=>{if(p.game==='pong'&&p.pong)io.to(p.code).emit('pong',p.pong);else emit(p)};
function reward(p,w){if(p.winner)return;p.winner=w;const [a,b]=p.players;if(!a||!b)return;for(let u of [a,b]){let x=get(u);if(!x)continue;x.played=(x.played||0)+1;x.xp=(x.xp||0)+(w==='draw'?15:w===u?50:20);x.achievements=x.achievements||[];if(!x.achievements.includes('First Match'))x.achievements.push('First Match');if(w==='draw'){x.draws=(x.draws||0)+1;x.points=(x.points||0)+1}else if(w===u){x.wins=(x.wins||0)+1;x.points=(x.points||0)+3;if(!x.achievements.includes('First Victory'))x.achievements.push('First Victory');if(x.wins>=10&&!x.achievements.includes('10 Wins'))x.achievements.push('10 Wins')}else x.losses=(x.losses||0)+1}save();publish(p)}
function stop(c){if(timers.has(c))clearInterval(timers.get(c));timers.delete(c);inputs.delete(c)}

// Neon Tag: colorful, non-realistic arcade blaster arena. Server simulates movement and scoring.
function arenaStart(p){
 if(p.arenaTimer)clearInterval(p.arenaTimer);
 const level=p.difficulty??1,moveSpeed=[3.4,3.8,4.2,4.6,5][level],orbSpeed=[6,7,8,9,10][level];
 const state={players:[{x:95,y:210,score:0,input:{}},{x:705,y:210,score:0,input:{}}],orbs:[],tick:0};
 p.arena=state;const code=p.code,match=p.matchId||0;
 p.arenaTimer=setInterval(()=>{
  if(parties.get(code)!==p||!p.started||p.game!=='neontag'||p.matchId!==match||p.players.length!==2){clearInterval(p.arenaTimer);p.arenaTimer=null;return}
  state.tick++;
  for(let i=0;i<2;i++){const a=state.players[i],inp=a.input||{},len=Math.hypot(inp.x||0,inp.y||0)||1;
   a.x=Math.max(18,Math.min(782,a.x+(inp.x||0)/Math.max(1,len)*moveSpeed));a.y=Math.max(18,Math.min(402,a.y+(inp.y||0)/Math.max(1,len)*moveSpeed));
   if(inp.fire&&state.tick-(a.lastShot||-100)>=[16,13,10,8,6][level]){a.lastShot=state.tick;const angle=Number.isFinite(inp.angle)?inp.angle:(i===0?0:Math.PI);state.orbs.push({x:a.x,y:a.y,vx:Math.cos(angle)*orbSpeed,vy:Math.sin(angle)*orbSpeed,owner:i})}
  }
  const keep=[];for(const orb of state.orbs){orb.x+=orb.vx;orb.y+=orb.vy;if(orb.x<0||orb.x>800||orb.y<0||orb.y>420)continue;const target=state.players[1-orb.owner];if(Math.hypot(target.x-orb.x,target.y-orb.y)<24){const scorer=state.players[orb.owner];scorer.score++;target.x=orb.owner===0?705:95;target.y=210;state.orbs=[];if(scorer.score>=7){clearInterval(p.arenaTimer);p.arenaTimer=null;reward(p,p.players[orb.owner]);p.started=false;emit(p)}break}keep.push(orb)}
  if(p.started){state.orbs=keep.slice(-70);io.to(code).emit('arenaState',{players:state.players.map(a=>({x:a.x,y:a.y,score:a.score})),orbs:state.orbs})}
 },50)
}

function pongStart(p){stop(p.code);const matchId=p.matchId||0;p.pong={ball:{x:400,y:220,vx:[2.8,4,5.6,7.2,9][p.difficulty??1]*(Math.random()<.5?1:-1),vy:[1.8,2.5,3.3,4.2,5][p.difficulty??1]},paddles:[180,180],score:[0,0]};let c=p.code;inputs.set(c,[0,0]);let id=setInterval(()=>{if(parties.get(c)!==p||p.matchId!==matchId||!p.started||p.game!=='pong'||p.players.length!==2){stop(c);return}let s=p.pong,b=s.ball,inp=inputs.get(c)||[0,0];for(let k=0;k<2;k++)s.paddles[k]=Math.max(0,Math.min(360,s.paddles[k]+inp[k]*[6,8,10,12,14][p.difficulty??1]));b.x+=b.vx;b.y+=b.vy;if(b.y<8||b.y>432)b.vy*=-1;for(let k=0;k<2;k++){let edge=k===0?32:768;if((k===0&&b.x<=edge+9&&b.x>=edge-10&&b.vx<0)||(k===1&&b.x>=edge-9&&b.x<=edge+10&&b.vx>0)){if(b.y>=s.paddles[k]-8&&b.y<=s.paddles[k]+88){b.vx*=-1.025;b.vy+=(b.y-(s.paddles[k]+40))/25}}}if(b.x<0||b.x>800){let scorer=b.x<0?1:0;s.score[scorer]++;b.x=400;b.y=220;b.vx=[2.8,4,5.6,7.2,9][p.difficulty??1]*(scorer===0?-1:1);b.vy=(Math.random()-.5)*[3.6,5,6.6,8.4,10][p.difficulty??1];if(s.score[scorer]>=5){stop(c);reward(p,p.players[scorer]);p.started=false;emit(p);return}}io.to(c).emit('pong',s)},50);timers.set(c,id)}
io.on('connection',socket=>{let u=socket.request.session?.user;if(!u||!get(u)||get(u).banned)return;online.set(u,(online.get(u)||0)+1);io.emit('onlineUsers',[...online.keys()]);
socket.on('joinParty',()=>{});
socket.on('extraGame',game=>{let p=parties.get(socket.data.code);if(!p||p.host!==u||!['pong','rps','reaction','neontag'].includes(game))return;stop(p.code);p.game=game;resetParty(p)});
socket.on('restartMatch',()=>{let p=parties.get(socket.data.code);if(!p||p.host!==u||p.players.length!==2||!p.winner)return;resetParty(p)});
socket.on('arenaInput',raw=>{const p=parties.get(socket.data.code);if(!p||p.game!=='neontag'||!p.started||!p.arena||p.winner)return;const i=p.players.indexOf(u);if(i<0||!raw||typeof raw!=='object')return;const v=p.arena.players[i];if(!v)return;v.input={x:Math.max(-1,Math.min(1,Number(raw.x)||0)),y:Math.max(-1,Math.min(1,Number(raw.y)||0)),fire:raw.fire===true,angle:Number.isFinite(raw.angle)?raw.angle:0}});
socket.on('pongInput',v=>{let p=parties.get(socket.data.code);if(!p||p.game!=='pong'||!p.started||p.winner||!inputs.has(p.code))return;let idx=p.players.indexOf(u);if(idx<0)return;inputs.get(p.code)[idx]=v===-1?-1:v===1?1:0});
socket.on('choice',v=>{let p=parties.get(socket.data.code);if(!p||!p.started||p.players.length!==2||p.winner||!['rps','reaction'].includes(p.game))return;if(p.game==='rps'){if(!['rock','paper','scissors'].includes(v))return;p.choices[u]=v;if(Object.keys(p.choices).length===2){let [a,b]=p.players,aa=p.choices[a],bb=p.choices[b],win=aa===bb?'draw':({rock:'scissors',paper:'rock',scissors:'paper'}[aa]===bb?a:b);p.round++;p.lastRound={a:aa,b:bb,winner:win};p.choices={};if(p.round>=3){reward(p,win==='draw'?'draw':win);p.started=false}else emit(p)}else emit(p)}else{if(v!=='tap'||!p.goAt)return;let now=Date.now();if(now<p.goAt)return;let prev=p.choices[u];if(prev)return;p.choices[u]=now-p.goAt;let [a,b]=p.players;if(p.choices[a]&&p.choices[b]){p.lastRound={a:p.choices[a],b:p.choices[b]};reward(p,p.choices[a]===p.choices[b]?'draw':p.choices[a]<p.choices[b]?a:b);p.started=false}else emit(p)}});
socket.on('reactionStart',()=>{let p=parties.get(socket.data.code);if(!p||p.host!==u||p.game!=='reaction'||!p.started||p.players.length!==2)return;p.choices={};p.goAt=Date.now()+[3500,2800,2200,1600,1000][p.difficulty??1]+Math.floor(Math.random()*[3500,2500,1800,1100,650][p.difficulty??1]);emit(p);setTimeout(()=>{if(parties.get(p.code)===p&&p.game==='reaction')io.to(p.code).emit('reactionGo')},p.goAt-Date.now())});
socket.on('partyChat',raw=>{let p=parties.get(socket.data.code);if(!p||!p.players.includes(u))return;let msg=String(raw||'').trim().slice(0,180);if(!msg)return;let now=Date.now();if(now-(socket.data.lastChat||0)<900)return;socket.data.lastChat=now;io.to(p.code).emit('partyChat',{username:u,message:msg})});
socket.on('disconnect',()=>{let n=(online.get(u)||1)-1;if(n<=0)online.delete(u);else online.set(u,n);io.emit('onlineUsers',[...online.keys()]);for(let [c,p] of parties)if(p.players.includes(u)&&p.game==='pong')stop(c)})});
};
