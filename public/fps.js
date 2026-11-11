(()=>{'use strict';
// Expanded 48 x 36 arena with courtyards, corridors, and raised ramp zones.
const MW=64,MH=48;
const map=Array.from({length:MH},(_,y)=>Array.from({length:MW},(_,x)=>{
 if(!x||!y||x===MW-1||y===MH-1)return '#';
 if((x>4&&x<12&&y>5&&y<11)||(x>42&&x<57&&y>30&&y<39))return '.';
 if((x===15&&y>3&&y<16&&y!==8&&y!==13)||(y===18&&x>4&&x<28&&x!==11&&x!==22)||(x===42&&y>4&&y<25&&y!==10)||(y===39&&x>10&&x<51&&x!==19&&x!==33))return '#';
 if((x%13===0&&y%9<4)||(y%11===0&&x%10<3))return '#';
 return '.';
}).join(''));
const ramps=[{x:7,y:14,w:7,h:4},{x:45,y:7,w:8,h:4},{x:20,y:30,w:8,h:5},{x:48,y:40,w:7,h:4}];
const wall=(x,y)=>!map[Math.floor(y)]||map[Math.floor(y)][Math.floor(x)]!=='.';
const rampAt=(x,y)=>ramps.find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function make(parent,mode,options={}){
 const root=document.createElement('div');root.className='fps-root';parent.append(root);
 const hud=document.createElement('div');hud.className='fps-hud';root.append(hud);
 const canvas=document.createElement('canvas');canvas.width=800;canvas.height=450;canvas.className='fps-view';canvas.tabIndex=0;root.append(canvas);
 const controls=document.createElement('p');controls.textContent='WASD move · Space jump · Mouse look up/down/around · Arrows look · Click or Space to tag · Esc unlocks mouse';root.append(controls);
 const launch=document.createElement('button');launch.textContent='🎯 Click to aim';root.append(launch);
 const ctx=canvas.getContext('2d'),keys=new Set(),me={x:3.5,y:3.5,a:0,pitch:0,z:0,vz:0},bots=Array.from({length:9},(_,i)=>({x:8.5+(i%5)*10,y:8.5+Math.floor(i/5)*23,score:0,z:0,phase:i*1.7})),difficulty=clamp(options.difficulty||0,0,4);
 let live=true,frame=0,score=0,opponents=[],last=performance.now(),shotFlash=0,remoteShot=0;const respawn=b=>{const points=[[8.5,8.5],[19.5,9.5],[29.5,7.5],[49.5,9.5],[58.5,13.5],[9.5,34.5],[23.5,42.5],[38.5,32.5],[55.5,42.5]];const p=points[Math.floor(Math.random()*points.length)];b.x=p[0];b.y=p[1];b.z=0};
 const blocked=(x,y)=>wall(x-.23,y-.23)||wall(x+.23,y-.23)||wall(x-.23,y+.23)||wall(x+.23,y+.23);
 function keydown(e){if(!live)return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown',' '].includes(k)){if(document.activeElement===canvas||document.pointerLockElement===canvas){e.preventDefault();keys.add(k)}}}
 function keyup(e){keys.delete(e.key.toLowerCase())}
 function look(e){if(document.pointerLockElement===canvas){me.a+=e.movementX*.003;me.pitch=clamp(me.pitch+e.movementY*.0025,-.85,.85)}}
 function lock(){canvas.focus();canvas.requestPointerLock?.()}
 function shoot(){if(!live||shotFlash>0)return;shotFlash=8;const targets=mode==='solo'?bots:opponents;let hit=-1,dist=100;
 targets.forEach((b,i)=>{const d=Math.hypot(b.x-me.x,b.y-me.y);let delta=Math.atan2(b.y-me.y,b.x-me.x)-me.a;delta=Math.atan2(Math.sin(delta),Math.cos(delta));if(d<dist&&Math.abs(delta)<.12+(.22/d)&&Math.abs(me.pitch)<.22){const n=Math.ceil(d/.05);let clear=true;for(let t=1;t<n;t++)if(wall(me.x+(b.x-me.x)*t/n,me.y+(b.y-me.y)*t/n)){clear=false;break}if(clear){dist=d;hit=i}}});
 if(hit>=0){score++;if(mode==='solo'){respawn(bots[hit])}else options.send?.({type:'tag',target:opponents[hit].username})}
 options.send?.({type:'shot'});if(mode==='solo'&&score>=12){live=false;hud.textContent='🏆 Victory! 12 tags · Restart to play again';options.win?.()}
 }
 function render(){const W=canvas.width,H=canvas.height;const horizon=H/2-me.pitch*H*.72+me.z*28;ctx.fillStyle='#6d91d5';ctx.fillRect(0,0,W,horizon);ctx.fillStyle=rampAt(me.x,me.y)?'#4a457e':'#2b354c';ctx.fillRect(0,horizon,W,H-horizon);for(let row=0;row<9;row++){const yy=horizon+Math.pow(row/9,1.6)*(H-horizon);ctx.strokeStyle=row%2?'#364f75':'#4c527c';ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(W,yy);ctx.stroke()}
 const z=new Float32Array(W);const fov=Math.PI/2.8;
 for(let x=0;x<W;x+=2){const ang=me.a+Math.atan((x/W-.5)*2*Math.tan(fov/2));const dx=Math.cos(ang),dy=Math.sin(ang);let d=.03;while(d<75&&!wall(me.x+dx*d,me.y+dy*d))d+=.045;const corrected=d*Math.cos(ang-me.a),height=Math.min(H*2,H/(corrected*.085));const wx=me.x+dx*d,wy=me.y+dy*d;const shade=Math.floor(clamp(210-d*7,55,210));const edge=Math.min(wx%1,wy%1,1-wx%1,1-wy%1)<.05;ctx.fillStyle=edge?'rgb('+Math.floor(shade*.55)+','+Math.floor(shade*.5)+','+shade+')':'rgb('+Math.floor(shade*.45)+','+Math.floor(shade*.62)+','+shade+')';ctx.fillRect(x,horizon-height/2,2,height);z[x]=z[x+1]=d}
 const sprites=(mode==='solo'?bots:opponents).map(b=>({...b,d:Math.hypot(b.x-me.x,b.y-me.y)})).sort((a,b)=>b.d-a.d);
 for(const b of sprites){const rel=Math.atan2(b.y-me.y,b.x-me.x)-me.a,angle=Math.atan2(Math.sin(rel),Math.cos(rel));if(Math.abs(angle)>fov*.8||b.d<.25)continue;const sx=W/2+Math.tan(angle)/Math.tan(fov/2)*W/2,sz=Math.min(280,H/(b.d*.12));if(sx<0||sx>=W||b.d>z[clamp(Math.floor(sx),0,W-1)]+.25)continue;// Animated humanoid avatars: head, torso, swinging arms and walking legs.
 const walk=Math.sin(frame*.18+(b.x+b.y)*2)*sz*.065;
 const bodyColor=mode==='solo'?'#ff65c4':'#52e5e4';
 ctx.save();ctx.translate(sx,horizon+sz*.02-(b.z||0)*sz*.36);ctx.shadowColor=bodyColor;ctx.shadowBlur=12;
 ctx.fillStyle='#171d3d';ctx.fillRect(-sz*.17,sz*.09,sz*.13,sz*.34+walk);ctx.fillRect(sz*.04,sz*.09,sz*.13,sz*.34-walk);
 ctx.fillStyle=bodyColor;ctx.fillRect(-sz*.24,-sz*.30,sz*.48,sz*.45);
 ctx.fillStyle='#e9cbb4';ctx.fillRect(-sz*.17,-sz*.57,sz*.34,sz*.28);
 ctx.fillStyle='#1a254e';ctx.fillRect(-sz*.18,-sz*.59,sz*.36,sz*.10);
 ctx.fillStyle='#b2f5ff';ctx.fillRect(-sz*.09,-sz*.45,sz*.18,sz*.055);
 ctx.fillStyle=bodyColor;ctx.fillRect(-sz*.38,-sz*.27-walk,sz*.14,sz*.36);ctx.fillRect(sz*.24,-sz*.27+walk,sz*.14,sz*.36);
 ctx.fillStyle='#26365c';ctx.fillRect(sz*.10,-sz*.08,sz*.32,sz*.085);
 ctx.restore()}
 ctx.strokeStyle=shotFlash?'#ffdf6d':'#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(W/2-10,H/2);ctx.lineTo(W/2-3,H/2);ctx.moveTo(W/2+3,H/2);ctx.lineTo(W/2+10,H/2);ctx.moveTo(W/2,H/2-10);ctx.lineTo(W/2,H/2-3);ctx.moveTo(W/2,H/2+3);ctx.lineTo(W/2,H/2+10);ctx.stroke();
 ctx.fillStyle='#e8faff';ctx.font='bold 17px system-ui';ctx.fillText('NEON FRONTIER · '+(mode==='solo'?'AI ARENA':'ONLINE ARENA'),18,28);
 // Mini-map with player, opponents, and ramps.
 const scale=2.15,mx=W-MW*scale-16,my=14;ctx.fillStyle='#071329df';ctx.fillRect(mx-5,my-5,MW*scale+10,MH*scale+10);
 for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){ctx.fillStyle=map[y][x]==='#'?'#6476ad':rampAt(x+.5,y+.5)?'#9c69e6':'#192b46';ctx.fillRect(mx+x*scale,my+y*scale,scale,scale)}
 ctx.fillStyle='#51ffb6';ctx.fillRect(mx+me.x*scale-2,my+me.y*scale-2,5,5);
 ctx.fillStyle='#ff7fce';for(const b of mode==='solo'?bots:opponents)ctx.fillRect(mx+b.x*scale-2,my+b.y*scale-2,4,4);
 hud.textContent=mode==='solo'?'🎯 Tags: '+score+'/12 · Difficulty: '+['Easy','Medium','Hard','Extreme','Impossible'][difficulty]:'🎯 Tags: '+score+' · Opponents: '+opponents.length;
 }
 function tick(now){if(!live)return;const dt=Math.min((now-last)/16.67,2);last=now;frame++;if(keys.has('arrowleft'))me.a-=.055*dt;if(keys.has('arrowright'))me.a+=.055*dt;if(keys.has('arrowup'))me.pitch=clamp(me.pitch-.025*dt,-.85,.85);if(keys.has('arrowdown'))me.pitch=clamp(me.pitch+.025*dt,-.85,.85);if(keys.has(' ')&&me.z<=0)me.vz=.19;me.vz-=.012*dt;me.z=Math.max(0,me.z+me.vz*dt);if(me.z===0)me.vz=0;const f=Number(keys.has('w'))-Number(keys.has('s')),side=Number(keys.has('d'))-Number(keys.has('a')),speed=.095*dt;const dx=(Math.cos(me.a)*f-Math.sin(me.a)*side)*speed,dy=(Math.sin(me.a)*f+Math.cos(me.a)*side)*speed;if(!blocked(me.x+dx,me.y))me.x+=dx;if(!blocked(me.x,me.y+dy))me.y+=dy;
 if(mode==='solo'){bots.forEach((b,i)=>{const ang=Math.atan2(me.y-b.y,me.x-b.x),v=(.014+difficulty*.007)*dt;if(frame%(3+difficulty)===0){const nx=b.x+Math.cos(ang)*v,ny=b.y+Math.sin(ang)*v;if(!blocked(nx,b.y))b.x=nx;if(!blocked(b.x,ny))b.y=ny}b.phase+=.05*dt;b.z=Math.max(0,Math.sin(b.phase))*((i%3===0)?.42:0);if(Math.hypot(me.x-b.x,me.y-b.y)<.65)respawn(b)})} else if(frame%2===0)options.send?.({type:'move',x:me.x,y:me.y,a:me.a,z:me.z,pitch:me.pitch});
 if(shotFlash)shotFlash--;render();requestAnimationFrame(tick)}
 function onMouse(e){if(document.pointerLockElement===canvas)shoot();else lock()}
 function onSpace(e){if(e.code==='Space'&&document.activeElement===canvas){e.preventDefault()}}
 document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);document.addEventListener('keydown',onSpace);document.addEventListener('mousemove',look);canvas.addEventListener('click',onMouse);launch.onclick=lock;requestAnimationFrame(tick);
 return {update(players){opponents=players.filter(p=>p.username!==options.username)},tag(){score++},stop(){live=false;document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);document.removeEventListener('keydown',onSpace);document.removeEventListener('mousemove',look);if(document.pointerLockElement===canvas)document.exitPointerLock?.();root.remove()}}
}
window.FPSArena={make};
})();