(()=>{'use strict';
const T=window.THREE;
if(!T){window.FPSArena={make(parent){const p=document.createElement('p');p.textContent='3D engine could not load. Check your connection and refresh.';parent.append(p);return{stop(){p.remove()},update(){},tag(){},damage(){}}}};return}
const W=64,H=48,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MAPS=[{id:'city',name:'🏙️ Block City',sky:'#8bb9e9',ground:'#688a65',wall:'#697b98'},{id:'desert',name:'🏜️ Dusty Outpost',sky:'#f2c990',ground:'#bfa06a',wall:'#ae8059'},{id:'snow',name:'❄️ Frost Fortress',sky:'#b6d9fa',ground:'#d9e6ed',wall:'#819db7'}];
let cells=[];
function buildCells(id){return Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>{if(!x||!y||x===W-1||y===H-1)return true;if(id==='desert')return (x===18&&y>5&&y<39&&y!==16&&y!==29)||(y===24&&x>18&&x<57&&x!==31&&x!==48)||(x%16===0&&y%12<4);if(id==='snow')return (x===28&&y>4&&y<40&&y!==12&&y!==29)||(y===14&&x>6&&x<55&&x!==18&&x!==42)||(y===33&&x>9&&x<58&&x!==23&&x!==49)||(x%18===0&&y%13<4);return (x===15&&y>3&&y<16&&y!==8&&y!==13)||(y===18&&x>4&&x<28&&x!==11&&x!==22)||(x===42&&y>4&&y<25&&y!==10)||(y===39&&x>10&&x<51&&x!==19&&x!==33)||(x%13===0&&y%9<4)}))}
const blocked=(x,z)=>{for(const [dx,dz] of [[-.24,-.24],[.24,.24],[-.24,.24],[.24,-.24]]){const cx=Math.floor(x+dx),cz=Math.floor(z+dz);if(cx<0||cz<0||cx>=W||cz>=H||cells[cz][cx])return true}return false};
function make(parent,mode,opts={}){
 const selected=MAPS.find(m=>m.id===opts.map)||MAPS[0];cells=buildCells(selected.id);
 const root=document.createElement('div');root.className='fps-root';parent.append(root);
 const chooser=document.createElement('div');chooser.className='fps-map-choice';const label=document.createElement('label');label.textContent='🗺️ Map: ';const select=document.createElement('select');MAPS.forEach(m=>{const option=document.createElement('option');option.value=m.id;option.textContent=m.name;select.append(option)});select.value=selected.id;select.disabled=mode==='online';label.append(select);chooser.append(label);root.append(chooser);if(mode==='solo')select.onchange=()=>{const parentNode=root.parentNode;const newMap=select.value;stop();const next=make(parentNode,mode,{...opts,map:newMap});if(opts.onInstance)opts.onInstance(next)};else{const note=document.createElement('small');note.textContent=' · Host chooses the online map before Ready Up';chooser.append(note)}
 const hud=document.createElement('div');hud.className='fps-hud';root.append(hud);
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'default'});renderer.setSize(960,540);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.domElement.className='fps-view';renderer.domElement.tabIndex=0;root.append(renderer.domElement);
 const help=document.createElement('p');help.textContent='WASD move · Mouse look up/down/around · Space jump · Hold Shift to sprint · Click to fire · Esc release mouse';root.append(help);
 const button=document.createElement('button');button.textContent='🎮 Click to enter 3D arena';root.append(button);
 const scene=new T.Scene();scene.background=new T.Color(selected.sky);scene.fog=new T.Fog(selected.sky,24,65);
 const camera=new T.PerspectiveCamera(78,960/540,.06,90);const ambient=new T.HemisphereLight(0xffffff,0x53627a,2.1);scene.add(ambient);const sun=new T.DirectionalLight(0xffffff,1.7);sun.position.set(20,35,12);scene.add(sun);
 const mat=(c)=>new T.MeshLambertMaterial({color:c});const groundMat=mat(selected.ground),wallMat=mat(selected.wall),topMat=mat('#8b96ac');
 const floor=new T.Mesh(new T.PlaneGeometry(W,H),groundMat);floor.rotation.x=-Math.PI/2;floor.position.set(W/2,0,H/2);scene.add(floor);
 const grid=new T.GridHelper(Math.max(W,H),Math.max(W,H),0x4d6b55,0x5a795c);grid.position.set(W/2,.012,H/2);scene.add(grid);
 const wallGeo=new T.BoxGeometry(1,3.5,1);
 for(let z=0;z<H;z++)for(let x=0;x<W;x++)if(cells[z][x]){const wall=new T.Mesh(wallGeo,wallMat);wall.position.set(x+.5,1.75,z+.5);scene.add(wall)}
 const rampData=[[7,14,7,4],[45,7,8,4],[20,30,8,5],[48,40,7,4]];
 for(const [x,z,w,h] of rampData){const ramp=new T.Mesh(new T.BoxGeometry(w,.25,h),topMat);ramp.position.set(x+w/2,.13,z+h/2);scene.add(ramp);const stripe=new T.Mesh(new T.BoxGeometry(w,.04,.3),mat('#c7a96c'));stripe.position.set(x+w/2,.29,z+h/2);scene.add(stripe)}
 const box=(w,h,d,m)=>new T.Mesh(new T.BoxGeometry(w,h,d),m);
 const avatars=new Map(),botCount=9,level=clamp(opts.difficulty||0,0,4);
 function avatar(id,index){const group=new T.Group(),skin=mat(['#dfb38f','#ae785b','#e5c39f','#b98566'][index%4]),shirt=mat(['#3f72b4','#4b966c','#b45c57','#8965aa','#b29a43'][index%5]),pants=mat('#36465f'),hair=mat('#3b302c');
 const part=(w,h,d,m,x,y,z)=>{const o=box(w,h,d,m);o.position.set(x,y,z);group.add(o);return o};
 part(.67,.74,.34,shirt,0,1.36,0);part(.48,.48,.48,skin,0,2.02,0);part(.5,.13,.5,hair,0,2.32,0);
 part(.1,.055,.05,hair,-.12,2.06,-.255);part(.1,.055,.05,hair,.12,2.06,-.255);
 const leftArm=part(.25,.72,.32,shirt,-.49,1.35,0),rightArm=part(.25,.72,.32,shirt,.49,1.35,0);
 const leftLeg=part(.29,.78,.34,pants,-.18,.53,0),rightLeg=part(.29,.78,.34,pants,.18,.53,0);
 part(.48,.12,.15,mat('#2e3649'),.28,1.43,-.38);
 scene.add(group);const item={group,leftArm,rightArm,leftLeg,rightLeg,x:0,z:0,health:100,lastX:0,lastZ:0,phase:index*.9};avatars.set(id,item);return item}
 const spawn=[[8.5,8.5],[19.5,9.5],[29.5,7.5],[49.5,9.5],[58.5,13.5],[9.5,34.5],[23.5,42.5],[38.5,32.5],[55.5,42.5]];
 const bots=Array.from({length:botCount},(_,i)=>{const b=avatar('bot'+i,i);b.x=spawn[i][0];b.z=spawn[i][1];b.goal=null;b.nextShot=0;return b});
 if(mode!=='solo'){for(let i=0;i<botCount;i++){scene.remove(bots[i].group);avatars.delete('bot'+i)}}
 const me={x:3.5,z:3.5,y:0,vy:0,yaw:0,pitch:0},keys=new Set(),shots=[],clock=new T.Clock();let live=true,health=100,score=0,lastShot=0,lastSend=0,invulnerable=0,frame=0,opponents=[];
 const projectileMat=mat('#ffb343'),playerProjectileMat=mat('#64d4ff'),sphere=new T.SphereGeometry(.095,8,8);
 function projectile(from,to,enemy,target=null){const v=new T.Vector3(to.x-from.x,to.y-from.y,to.z-from.z).normalize(),mesh=new T.Mesh(sphere,enemy?projectileMat:playerProjectileMat);mesh.position.copy(from);scene.add(mesh);shots.push({mesh,v,enemy,target,life:1.4,hit:false})}
 const eye=()=>new T.Vector3(me.x,1.65+me.y,me.z);
 const direction=()=>new T.Vector3(-Math.sin(me.yaw)*Math.cos(me.pitch),-Math.sin(me.pitch),-Math.cos(me.yaw)*Math.cos(me.pitch));
 function shoot(){if(!live||performance.now()-lastShot<350)return;lastShot=performance.now();const from=eye(),dir=direction(),end=from.clone().addScaledVector(dir,30);projectile(from,end,false);
 const targets=mode==='solo'?bots:opponents;let nearest=null,best=30;
 for(const target of targets){const targetPos=new T.Vector3(target.x,1.4+(target.y||0),target.z),v=targetPos.clone().sub(from),dist=v.length();if(dist>best||dist<.2||dir.dot(v.normalize())<.985)continue;let clear=true;for(let d=.25;d<dist;d+=.2){const p=from.clone().addScaledVector(v,d);if(blocked(p.x,p.z)){clear=false;break}}if(clear){best=dist;nearest=target}}
 if(nearest){if(mode==='solo'){nearest.health-=10;if(nearest.health<=0){score++;nearest.health=100;const p=spawn[Math.floor(Math.random()*spawn.length)];nearest.x=p[0];nearest.z=p[1]}}else opts.send?.({type:'tag',target:nearest.username})}
 if(mode==='solo'&&score>=12){live=false;opts.win?.()}
 }
 function onKeyDown(e){if(!live)return;const k=e.key.toLowerCase();if(['w','a','s','d',' ','arrowleft','arrowright','arrowup','arrowdown','shift'].includes(k)&&document.activeElement===renderer.domElement){e.preventDefault();keys.add(k)}}
 function onKeyUp(e){keys.delete(e.key.toLowerCase())}
 function onMouse(e){if(document.pointerLockElement===renderer.domElement){me.yaw-=e.movementX*.0028;me.pitch=clamp(me.pitch+e.movementY*.0028,-1.35,1.35)}}
 function onClick(){if(document.pointerLockElement===renderer.domElement)shoot();else{renderer.domElement.focus();renderer.domElement.requestPointerLock?.()}}
 function lock(){renderer.domElement.focus();renderer.domElement.requestPointerLock?.()}
 document.addEventListener('keydown',onKeyDown);document.addEventListener('keyup',onKeyUp);document.addEventListener('mousemove',onMouse);renderer.domElement.addEventListener('click',onClick);button.onclick=lock;
 const hp=document.createElement('div');hp.className='fps-health';root.insertBefore(hp,renderer.domElement);
 function damage(n){if(performance.now()<invulnerable)return;health=Math.max(0,health-n);invulnerable=performance.now()+550;if(!health){health=100;me.x=3.5;me.z=3.5;me.y=0;me.vy=0}}
 function frameLoop(){if(!live)return;requestAnimationFrame(frameLoop);const dt=Math.min(clock.getDelta(),.05);frame++;
 if(keys.has('arrowleft'))me.yaw+=dt*2;if(keys.has('arrowright'))me.yaw-=dt*2;if(keys.has('arrowup'))me.pitch=clamp(me.pitch-dt*1.4,-1.35,1.35);if(keys.has('arrowdown'))me.pitch=clamp(me.pitch+dt*1.4,-1.35,1.35);
 const forward=(keys.has('w')?1:0)-(keys.has('s')?1:0),strafe=(keys.has('d')?1:0)-(keys.has('a')?1:0),speed=(keys.has('shift')?7.4:4.4)*dt;
 const dx=(-Math.sin(me.yaw)*forward+Math.cos(me.yaw)*strafe)*speed,dz=(-Math.cos(me.yaw)*forward-Math.sin(me.yaw)*strafe)*speed;
 if(!blocked(me.x+dx,me.z))me.x+=dx;if(!blocked(me.x,me.z+dz))me.z+=dz;
 if(keys.has(' ')&&me.y<=0)me.vy=6.2;me.vy-=15*dt;me.y=Math.max(0,me.y+me.vy*dt);if(!me.y)me.vy=0;
 camera.position.set(me.x,1.65+me.y,me.z);camera.rotation.order='YXZ';camera.rotation.y=me.yaw;camera.rotation.x=-me.pitch;
 if(mode==='solo')for(let i=0;i<bots.length;i++){const b=bots[i],dist=Math.hypot(me.x-b.x,me.z-b.z);if(!b.goal||frame%240===i*17%240){const theta=i*2.2+frame*.002;b.goal={x:clamp(me.x+Math.cos(theta)*(7+i%4*2),2,W-3),z:clamp(me.z+Math.sin(theta)*(7+i%4*2),2,H-3)}}
 let vx=b.goal.x-b.x,vz=b.goal.z-b.z;for(const other of bots){if(other===b)continue;const sx=b.x-other.x,sz=b.z-other.z,d=Math.hypot(sx,sz);if(d>.01&&d<2){vx+=sx/d*4;vz+=sz/d*4}}const len=Math.hypot(vx,vz)||1,v=(1.1+level*.2)*dt,nx=b.x+vx/len*v,nz=b.z+vz/len*v;if(!blocked(nx,b.z))b.x=nx;if(!blocked(b.x,nz))b.z=nz;
 b.group.position.set(b.x,0,b.z);b.group.rotation.y=Math.atan2(me.x-b.x,me.z-b.z);
 const moving=Math.hypot(b.x-b.lastX,b.z-b.lastZ)>.001,bob=moving?Math.sin(frame*.13+b.phase)*.5:0;b.leftLeg.rotation.x=bob;b.rightLeg.rotation.x=-bob;b.leftArm.rotation.x=-bob*.7;b.rightArm.rotation.x=bob*.7;b.lastX=b.x;b.lastZ=b.z;
 if(performance.now()>b.nextShot){
 // Bots can choose the player or another bot; shots are visible to everyone in solo mode.
 const targets=[{x:me.x,z:me.z,isPlayer:true},...bots.filter(other=>other!==b).map(other=>({x:other.x,z:other.z,bot:other}))];
 const nearby=targets.filter(t=>Math.hypot(t.x-b.x,t.z-b.z)<17);
 if(nearby.length){const target=nearby[Math.floor(Math.random()*nearby.length)],start=new T.Vector3(b.x,1.45,b.z),end=new T.Vector3(target.x,target.isPlayer?1.65+me.y:1.45,target.z),ray=end.clone().sub(start),distance=ray.length(),dir=ray.clone().normalize();let clear=true;
 for(let d=.4;d<distance;d+=.25){const p=start.clone().addScaledVector(dir,d);if(blocked(p.x,p.z)){clear=false;break}}
 if(clear){b.nextShot=performance.now()+[2500,1900,1450,1100,800][level]+Math.random()*450;projectile(start,end,true,target.bot||'player')}}
 }

 }
 for(const b of opponents){const a=avatars.get(b.username);if(!a)continue;a.group.position.set(b.x,b.y||0,b.z);a.group.rotation.y=b.a||0;const moving=Math.hypot(b.x-a.lastX,b.z-a.lastZ)>.006;const phase=frame*.12;const stride=moving?Math.sin(phase)*.5:0;a.leftLeg.rotation.x=stride;a.rightLeg.rotation.x=-stride;a.leftArm.rotation.x=-stride*.7;a.rightArm.rotation.x=stride*.7;a.lastX=b.x;a.lastZ=b.z}
 for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.mesh.position.addScaledVector(s.v,dt*17);s.life-=dt;if(s.enemy&&!s.hit){if(s.target==='player'&&s.mesh.position.distanceTo(eye())<.5){s.hit=true;damage(10)}else if(s.target&&s.target!=='player'&&s.mesh.position.distanceTo(new T.Vector3(s.target.x,1.45,s.target.z))<.45){s.hit=true;s.target.health=Math.max(0,(s.target.health??100)-10);if(s.target.health===0){s.target.health=100;const spawnPoint=spawn[Math.floor(Math.random()*spawn.length)];s.target.x=spawnPoint[0];s.target.z=spawnPoint[1]}}}if(s.life<=0||s.hit||blocked(s.mesh.position.x,s.mesh.position.z)){scene.remove(s.mesh);shots.splice(i,1)}}
 if(mode==='online'&&performance.now()-lastSend>75){lastSend=performance.now();opts.send?.({type:'move',x:me.x,y:me.z,a:me.yaw,z:me.y,pitch:me.pitch})}
 hp.innerHTML='<div style="height:12px;border-radius:8px;background:#293a54;overflow:hidden"><div style="height:100%;width:'+health+'%;background:'+(health>30?'#51cf76':'#ff6969')+'"></div></div>';hud.textContent='❤️ '+health+'/100 HP · 10 damage per hit · '+(mode==='solo'?'AI defeated: '+score+'/12':'Online tags: '+score);
 renderer.render(scene,camera)
 }
 requestAnimationFrame(frameLoop);
 return{update(players){opponents=players.filter(p=>p.username!==opts.username).map(p=>({username:p.username,x:p.x,z:p.y,y:p.z||0,a:p.a}));const active=new Set(opponents.map(p=>p.username));for(const p of opponents)if(!avatars.has(p.username))avatar(p.username,avatars.size);for(const [id,a] of avatars)if(!id.startsWith('bot')&&!active.has(id)){scene.remove(a.group);avatars.delete(id)}},tag(){score++},damage,stop(){live=false;document.removeEventListener('keydown',onKeyDown);document.removeEventListener('keyup',onKeyUp);document.removeEventListener('mousemove',onMouse);if(document.pointerLockElement===renderer.domElement)document.exitPointerLock?.();renderer.dispose();root.remove()}}
}
window.FPSArena={make};
})();