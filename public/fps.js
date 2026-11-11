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
 let live=true,frame=0,score=0,health=100,opponents=[],last=performance.now(),shotFlash=0,remoteShot=0,invulnerableUntil=0;const respawn=b=>{const points=[[8.5,8.5],[19.5,9.5],[29.5,7.5],[49.5,9.5],[58.5,13.5],[9.5,34.5],[23.5,42.5],[38.5,32.5],[55.5,42.5]];const p=points[Math.floor(Math.random()*points.length)];b.x=p[0];b.y=p[1];b.z=0};
 const blocked=(x,y)=>wall(x-.23,y-.23)||wall(x+.23,y-.23)||wall(x-.23,y+.23)||wall(x+.23,y+.23);
 function keydown(e){if(!live)return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowleft','arrowright','arrowup','arrowdown',' '].includes(k)){if(document.activeElement===canvas||document.pointerLockElement===canvas){e.preventDefault();keys.add(k)}}}
 function keyup(e){keys.delete(e.key.toLowerCase())}
 function look(e){if(document.pointerLockElement===canvas){me.a+=e.movementX*.003;me.pitch=clamp(me.pitch+e.movementY*.0025,-.85,.85)}}
 function lock(){canvas.focus();canvas.requestPointerLock?.()}
 function shoot(){if(!live||shotFlash>0)return;shotFlash=8;const targets=mode==='solo'?bots:opponents;let hit=-1,dist=100;
 targets.forEach((b,i)=>{const d=Math.hypot(b.x-me.x,b.y-me.y);let delta=Math.atan2(b.y-me.y,b.x-me.x)-me.a;delta=Math.atan2(Math.sin(delta),Math.cos(delta));if(d<dist&&Math.abs(delta)<.12+(.22/d)&&Math.abs(me.pitch)<.22){const n=Math.ceil(d/.05);let clear=true;for(let t=1;t<n;t++)if(wall(me.x+(b.x-me.x)*t/n,me.y+(b.y-me.y)*t/n)){clear=false;break}if(clear){dist=d;hit=i}}});
 if(hit>=0){if(mode==='solo'){const bot=bots[hit];bot.health=(bot.health??100)-10;if(bot.health<=0){score++;bot.health=100;respawn(bot)}}else options.send?.({type:'tag',target:opponents[hit].username})}
 options.send?.({type:'shot'});if(mode==='solo'&&score>=12){live=false;hud.textContent='🏆 Victory! 12 tags · Restart to play again';options.win?.()}
 }
 function render(){const W=canvas.width,H=canvas.height;const horizon=H/2-me.pitch*H*.72+me.z*28;ctx.fillStyle='#6d91d5';ctx.fillRect(0,0,W,horizon);ctx.fillStyle=rampAt(me.x,me.y)?'#4a457e':'#2b354c';ctx.fillRect(0,horizon,W,H-horizon);for(let row=0;row<9;row++){const yy=horizon+Math.pow(row/9,1.6)*(H-horizon);ctx.strokeStyle=row%2?'#364f75':'#4c527c';ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(W,yy);ctx.stroke()}
 const z=new Float32Array(W);const fov=Math.PI/2.8;
 for(let x=0;x<W;x+=2){const ang=me.a+Math.atan((x/W-.5)*2*Math.tan(fov/2));const dx=Math.cos(ang),dy=Math.sin(ang);let d=.03;while(d<75&&!wall(me.x+dx*d,me.y+dy*d))d+=.045;const corrected=d*Math.cos(ang-me.a),height=Math.min(H*2,H/(corrected*.085));const wx=me.x+dx*d,wy=me.y+dy*d;const shade=Math.floor(clamp(210-d*7,55,210));const edge=Math.min(wx%1,wy%1,1-wx%1,1-wy%1)<.05;ctx.fillStyle=edge?'rgb('+Math.floor(shade*.55)+','+Math.floor(shade*.5)+','+shade+')':'rgb('+Math.floor(shade*.45)+','+Math.floor(shade*.62)+','+shade+')';ctx.fillRect(x,horizon-height/2,2,height);z[x]=z[x+1]=d}
 const sprites=(mode==='solo'?bots:opponents).map(b=>({...b,d:Math.hypot(b.x-me.x,b.y-me.y)})).sort((a,b)=>b.d-a.d);
 for(const b of sprites){const rel=Math.atan2(b.y-me.y,b.x-me.x)-me.a,angle=Math.atan2(Math.sin(rel),Math.cos(rel));if(Math.abs(angle)>fov*.8||b.d<.25)continue;const sx=W/2+Math.tan(angle)/Math.tan(fov/2)*W/2,sz=Math.min(280,H/(b.d*.12));if(sx<0||sx>=W||b.d>z[clamp(Math.floor(sx),0,W-1)]+.25)continue;// Human-sized, unlit block-character sprites. Separate limbs and natural walk cycles.
 const h=Math.min(145,Math.max(7,sz*.56)),w=h*.38;
 const moving=Math.hypot(b.vx||0,b.vy||0)>.002;
 const stride=moving?Math.sin(frame*.12+(b.phase||0))*h*.075:0;
 const bob=moving?Math.abs(Math.sin(frame*.12+(b.phase||0)))*h*.018:0;
 const skin=['#d8aa86','#e5bd98','#a8795e','#f0c6a3'][Math.abs(Math.floor((b.phase||0)*10))%4];
 const shirt=['#4777b8','#4d996e','#b75f55','#a17ab5','#b5a15a'][Math.abs(Math.floor((b.phase||0)*10))%5];
 const pants='#343d52';
 ctx.save();ctx.translate(sx,horizon+h*.20-(b.z||0)*h*.45-bob);
 ctx.shadowBlur=0;ctx.lineWidth=Math.max(1,h*.012);ctx.strokeStyle='#273247';
 // Two legs move in opposite directions, with simple shoes.
 ctx.fillStyle=pants;ctx.fillRect(-w*.43,h*.04+stride,w*.37,h*.39);ctx.fillRect(w*.06,h*.04-stride,w*.37,h*.39);
 ctx.fillStyle='#242b38';ctx.fillRect(-w*.48,h*.40+stride,w*.45,h*.085);ctx.fillRect(w*.05,h*.40-stride,w*.45,h*.085);
 // Narrower torso and distinct sleeves.
 ctx.fillStyle=shirt;ctx.fillRect(-w*.52,-h*.36,w*1.04,h*.43);
 ctx.fillRect(-w*.82,-h*.34-stride,w*.26,h*.35);ctx.fillRect(w*.56,-h*.34+stride,w*.26,h*.35);
 ctx.fillStyle=skin;ctx.fillRect(-w*.82,-h*.04-stride,w*.26,h*.12);ctx.fillRect(w*.56,-h*.04+stride,w*.26,h*.12);
 // Head with subtle hair and facial details, no glow or visor.
 ctx.fillStyle=skin;ctx.fillRect(-w*.36,-h*.64,w*.72,h*.26);
 ctx.fillStyle='#302a2b';ctx.fillRect(-w*.38,-h*.66,w*.76,h*.075);
 ctx.fillStyle='#263044';ctx.fillRect(-w*.19,-h*.52,w*.07,h*.035);ctx.fillRect(w*.12,-h*.52,w*.07,h*.035);ctx.fillStyle='#5a3935';ctx.fillRect(-w*.12,-h*.43,w*.24,h*.016);
 ctx.restore()}
 ctx.strokeStyle=shotFlash?'#ffdf6d':'#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(W/2-10,H/2);ctx.lineTo(W/2-3,H/2);ctx.moveTo(W/2+3,H/2);ctx.lineTo(W/2+10,H/2);ctx.moveTo(W/2,H/2-10);ctx.lineTo(W/2,H/2-3);ctx.moveTo(W/2,H/2+3);ctx.lineTo(W/2,H/2+10);ctx.stroke();
 ctx.fillStyle='#e8faff';ctx.font='bold 17px system-ui';ctx.fillText('NEON FRONTIER · '+(mode==='solo'?'AI ARENA':'ONLINE ARENA'),18,28);
 // Mini-map with player, opponents, and ramps.
 const scale=2.15,mx=W-MW*scale-16,my=14;ctx.fillStyle='#071329df';ctx.fillRect(mx-5,my-5,MW*scale+10,MH*scale+10);
 for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){ctx.fillStyle=map[y][x]==='#'?'#6476ad':rampAt(x+.5,y+.5)?'#9c69e6':'#192b46';ctx.fillRect(mx+x*scale,my+y*scale,scale,scale)}
 ctx.fillStyle='#51ffb6';ctx.fillRect(mx+me.x*scale-2,my+me.y*scale-2,5,5);
 ctx.fillStyle='#ff7fce';for(const b of mode==='solo'?bots:opponents)ctx.fillRect(mx+b.x*scale-2,my+b.y*scale-2,4,4);
 hud.textContent='❤️ '+health+'/100 HP · 🔫 10 damage per hit · '+(mode==='solo'?'AI defeated: '+score+'/12 · '+['Easy','Medium','Hard','Extreme','Impossible'][difficulty]:'Online tags: '+score+' · Players: '+(opponents.length+1));hud.style.color=health<=30?'#ff8c8c':'#e0f2fe';
 }
 function tick(now){if(!live)return;const dt=Math.min((now-last)/16.67,2);last=now;frame++;if(keys.has('arrowleft'))me.a-=.055*dt;if(keys.has('arrowright'))me.a+=.055*dt;if(keys.has('arrowup'))me.pitch=clamp(me.pitch-.025*dt,-.85,.85);if(keys.has('arrowdown'))me.pitch=clamp(me.pitch+.025*dt,-.85,.85);if(keys.has(' ')&&me.z<=0)me.vz=.19;me.vz-=.012*dt;me.z=Math.max(0,me.z+me.vz*dt);if(me.z===0)me.vz=0;const f=Number(keys.has('w'))-Number(keys.has('s')),side=Number(keys.has('d'))-Number(keys.has('a')),speed=.095*dt;const dx=(Math.cos(me.a)*f-Math.sin(me.a)*side)*speed,dy=(Math.sin(me.a)*f+Math.cos(me.a)*side)*speed;if(!blocked(me.x+dx,me.y))me.x+=dx;if(!blocked(me.x,me.y+dy))me.y+=dy;
 if(mode==='solo'){bots.forEach((b,i)=>{
 const oldX=b.x,oldY=b.y,dist=Math.hypot(me.x-b.x,me.y-b.y);
 if(!b.goal||frame%180===i*11%180){const orbit=i*2.4+frame*.002;b.goal={x:clamp(me.x+Math.cos(orbit)*(5+i%5*2),2,MW-3),y:clamp(me.y+Math.sin(orbit)*(5+i%5*2),2,MH-3)}}
 let vx=b.goal.x-b.x,vy=b.goal.y-b.y;
 // Keep opponents apart instead of stacking into one oversized silhouette.
 for(const other of bots){if(other===b)continue;const ox=b.x-other.x,oy=b.y-other.y,sep=Math.hypot(ox,oy);if(sep>0&&sep<2.2){vx+=ox/sep*3;vy+=oy/sep*3}}
 const len=Math.hypot(vx,vy)||1,step=(.025+difficulty*.004)*dt;
 const nx=b.x+vx/len*step,ny=b.y+vy/len*step;
 if(!blocked(nx,b.y))b.x=nx;if(!blocked(b.x,ny))b.y=ny;
 b.vx=b.x-oldX;b.vy=b.y-oldY;
 b.phase=(b.phase||i*.7);b.z=0;
 // AI can fire only with a clear line of sight, in range, and after its cooldown.
 if(dist<15&&frame>=(b.nextShot||0)){const aim=Math.atan2(me.y-b.y,me.x-b.x);let clear=true;for(let d=.3;d<dist;d+=.2){if(wall(b.x+Math.cos(aim)*d,b.y+Math.sin(aim)*d)){clear=false;break}}
 if(clear){b.nextShot=frame+[145,110,85,65,45][difficulty]+Math.floor(Math.random()*35);if(performance.now()>invulnerableUntil){health=Math.max(0,health-10);invulnerableUntil=performance.now()+650;if(health===0){health=100;me.x=3.5;me.y=3.5;me.z=0;me.vz=0;score=Math.max(0,score-1)}}}}
 if(dist<.65)respawn(b)
 })} else if(frame%2===0)options.send?.({type:'move',x:me.x,y:me.y,a:me.a,z:me.z,pitch:me.pitch});
 if(shotFlash)shotFlash--;render();requestAnimationFrame(tick)}
 function onMouse(e){if(document.pointerLockElement===canvas)shoot();else lock()}
 function onSpace(e){if(e.code==='Space'&&document.activeElement===canvas){e.preventDefault()}}
 document.addEventListener('keydown',keydown);document.addEventListener('keyup',keyup);document.addEventListener('keydown',onSpace);document.addEventListener('mousemove',look);canvas.addEventListener('click',onMouse);launch.onclick=lock;requestAnimationFrame(tick);
 return {update(players){opponents=players.filter(p=>p.username!==options.username)},tag(){score++},damage(amount){health=Math.max(0,health-amount);if(health===0){health=100;me.x=3.5;me.y=3.5;me.z=0;me.vz=0}},stop(){live=false;document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);document.removeEventListener('keydown',onSpace);document.removeEventListener('mousemove',look);if(document.pointerLockElement===canvas)document.exitPointerLock?.();root.remove()}}
}
window.FPSArena={make};
})();