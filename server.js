const express=require('express'),http=require('http'),{Server}=require('socket.io'),fs=require('fs'),path=require('path'),bcrypt=require('bcryptjs'),session=require('express-session'),rateLimit=require('express-rate-limit'),crypto=require('crypto');
const app=express(),server=http.createServer(app),io=new Server(server);app.set('trust proxy',1);app.use(express.json({limit:'16kb'}));app.use(express.static(path.join(__dirname,'public')));
const {Pool}=require('pg'), PgStore=require('connect-pg-simple')(session);
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required: configure a persistent PostgreSQL database on Render.');
if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)throw new Error('SESSION_SECRET must be a stable random value of at least 32 characters.');
const OWNER_USERNAME=String(process.env.OWNER_USERNAME||'potatozay12').trim().toLowerCase();
const isOwner=u=>!!OWNER_USERNAME&&u===OWNER_USERNAME;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false},max:5});
let db={users:{}},saveQueue=Promise.resolve(),databaseReady=false;
function save(){
 if(!databaseReady)throw new Error('Database is not ready');
 const snapshot=JSON.stringify(db);
 saveQueue=saveQueue.then(()=>pool.query('INSERT INTO arcade_state (id, payload) VALUES (1,$1::jsonb) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload',[snapshot]));
 saveQueue.catch(e=>{console.error('Database save failed:',e);databaseReady=false});
 return saveQueue;
}
const sessions=session({store:new PgStore({pool,createTableIfMissing:true}),secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:30*864e5}});
app.use(sessions);io.engine.use(sessions);
app.use((req,res,next)=>databaseReady?next():res.status(503).json({error:'Database temporarily unavailable'}));
const authLimit=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-7',legacyHeaders:false});const safe=u=>typeof u==='string'&&/^[a-zA-Z0-9_]{3,20}$/.test(u);function publicUser(u){const x=db.users[u];return {username:u,role:isOwner(u)?'owner':'player',wins:x.wins||0,losses:x.losses||0,draws:x.draws||0,played:x.played||0,points:x.points||0}};app.post('/api/register',authLimit,(req,res)=>{let {username,password}=req.body||{};if(!safe(username)||typeof password!=='string'||password.length<8||password.length>72)return res.status(400).json({error:'Username: 3–20 letters, numbers or underscores. Password: 8–72 characters.'});username=username.toLowerCase();if(db.users[username])return res.status(409).json({error:'Username already taken'});db.users[username]={hash:bcrypt.hashSync(password,10),wins:0,losses:0,draws:0,played:0,points:0};save().then(()=>{req.session.user=username;req.session.save(err=>err?res.status(500).json({error:'Session save failed'}):res.json({user:publicUser(username)}))}).catch(()=>res.status(503).json({error:'Database save failed; please retry'}))});app.post('/api/login',authLimit,(req,res)=>{const {username,password}=req.body||{},u=String(username||'').toLowerCase();if(db.users[u]?.banned)return res.status(403).json({error:'This account is banned'});if(!db.users[u]||typeof password!=='string'||!bcrypt.compareSync(password,db.users[u].hash))return res.status(401).json({error:'Invalid username or password'});req.session.user=u;req.session.save(err=>err?res.status(500).json({error:'Session save failed'}):res.json({user:publicUser(u)}))});app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));app.get('/api/me',(req,res)=>res.json({user:req.session.user&&db.users[req.session.user]&&!db.users[req.session.user].banned?publicUser(req.session.user):null}));app.get('/api/leaderboard',(req,res)=>res.json(Object.keys(db.users).map(publicUser).sort((a,b)=>b.points-a.points||b.wins-a.wins).slice(0,100)));
const parties=new Map();const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';function code(){let c;do{c=Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}while(parties.has(c));return c};function partyView(p){return {code:p.code,host:p.host,players:p.players,game:p.game,turn:p.turn,board:p.board,winner:p.winner,ready:p.ready}};function emit(p){io.to(p.code).emit('party',partyView(p))};function init(game){return game==='connect4'?Array(42).fill(''):game==='reversi'?Array.from({length:64},(_,i)=>i===27||i===36?'X':i===28||i===35?'O':''):Array(9).fill('')};function winner3(b){const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const l of lines)if(b[l[0]]&&l.every(i=>b[i]===b[l[0]]))return b[l[0]];return b.every(Boolean)?'draw':null};function winner4(b){for(let r=0;r<6;r++)for(let c=0;c<7;c++){const v=b[r*7+c];if(!v)continue;for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]])if([0,1,2,3].every(k=>{let rr=r+dr*k,cc=c+dc*k;return rr>=0&&rr<6&&cc>=0&&cc<7&&b[rr*7+cc]===v}))return v}return b.every(Boolean)?'draw':null};function finish(p,w){p.winner=w;const [a,b]=p.players;if(!a||!b)return;for(const u of [a,b]){const x=db.users[u];if(!x)continue;x.played++;if(w==='draw'){x.draws++;x.points+=1}else if(u===(w==='X'?a:b)){x.wins++;x.points+=3}else x.losses++}save()};function leave(socket){const code=socket.data.code,p=parties.get(code);if(!p)return;socket.leave(code);socket.data.code=null;p.players=p.players.filter(u=>u!==socket.data.user);delete p.ready[socket.data.user];if(!p.players.length){parties.delete(code);return}if(p.host===socket.data.user)p.host=p.players[0];p.board=init(p.game);p.turn='X';p.winner=null;emit(p)}
io.on('connection',socket=>{const u=socket.request.session?.user;if(!u||!db.users[u]||db.users[u].banned){socket.emit('errorMsg','Log in to play online');socket.disconnect();return}socket.data.user=u;socket.on('createParty',()=>{leave(socket);const c=code(),p={code:c,host:u,players:[u],game:'tictactoe',turn:'X',board:init('tictactoe'),winner:null,ready:{}};parties.set(c,p);socket.join(c);socket.data.code=c;emit(p)});socket.on('joinParty',raw=>{const c=String(raw||'').toUpperCase(),p=parties.get(c);if(!p)return socket.emit('errorMsg','Party not found or expired');if(p.players.length>=2&&!p.players.includes(u))return socket.emit('errorMsg','Party full (2 players maximum)');leave(socket);if(!p.players.includes(u))p.players.push(u);socket.join(c);socket.data.code=c;emit(p)});socket.on('setGame',game=>{const p=parties.get(socket.data.code);if(!p||p.host!==u||!['tictactoe','connect4'].includes(game))return;p.game=game;p.board=init(game);p.turn='X';p.winner=null;emit(p)});socket.on('move',pos=>{const p=parties.get(socket.data.code);if(!p||p.players.length!==2||p.winner||p.players[p.turn==='X'?0:1]!==u||!Number.isInteger(pos))return;let i=pos;if(p.game==='connect4'){if(pos<0||pos>6)return;i=-1;for(let r=5;r>=0;r--)if(!p.board[r*7+pos]){i=r*7+pos;break}}if(i<0||i>=p.board.length||p.board[i])return;p.board[i]=p.turn;const w=p.game==='connect4'?winner4(p.board):winner3(p.board);if(w)finish(p,w);else p.turn=p.turn==='X'?'O':'X';emit(p)});socket.on('leaveParty',()=>leave(socket));socket.on('disconnect',()=>leave(socket))});

// Arcade Hub 3.1 online extensions
require('./extras')( {app,io,db,save,parties,emit,init,publicUser,isOwner} );

app.get('/health',(req,res)=>res.status(databaseReady?200:503).json({ok:databaseReady}));
(async()=>{
 try{
  await pool.query('CREATE TABLE IF NOT EXISTS arcade_state (id integer PRIMARY KEY, payload jsonb NOT NULL)');
  const result=await pool.query('SELECT payload FROM arcade_state WHERE id=1');
  if(result.rows.length){db.users=result.rows[0].payload.users||{}}
  else{
   const file=process.env.DATA_FILE||path.join(__dirname,'data.json');
   let previous={users:{}};try{previous=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}
   db.users=previous.users||{};
   await pool.query('INSERT INTO arcade_state (id,payload) VALUES (1,$1::jsonb)',[JSON.stringify(db)]);
  }
  databaseReady=true;
  server.listen(process.env.PORT||3000,()=>console.log('Arcade Hub with PostgreSQL on port '+(process.env.PORT||3000)));
 }catch(e){console.error('Cannot start Arcade Hub without persistent database:',e);process.exit(1)}
})();
