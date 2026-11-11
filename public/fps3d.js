(()=>{'use strict';
const T=window.THREE;
if(!T){window.FPSArena={make(parent){const p=document.createElement('p');p.textContent='3D engine could not load. Check your connection and refresh.';parent.append(p);return{stop(){p.remove()},update(){},tag(){},damage(){}}}};return}
const W=64,H=48,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MAPS=[{id:'city',name:'🏙️ Block City',sky:'#8bb9e9',ground:'#688a65',wall:'#697b98'},{id:'desert',name:'🏜️ Dusty Outpost',sky:'#f2c990',ground:'#bfa06a',wall:'#ae8059'},{id:'snow',name:'❄️ Frost Fortress',sky:'#b6d9fa',ground:'#d9e6ed',wall:'#819db7'}];
function buildCells(id){return Array.from({length:H},(_,y)=>Array.from({length:W},(_,x)=>{if(!x||!y||x===W-1||y===H-1)return true;if(id==='desert')return (x===18&&y>5&&y<39&&y!==16&&y!==29)||(y===24&&x>18&&x<57&&x!==31&&x!==48)||(x%16===0&&y%12<4);if(id==='snow')return (x===28&&y>4&&y<40&&y!==12&&y!==29)||(y===14&&x>6&&x<55&&x!==18&&x!==42)||(y===33&&x>9&&x<58&&x!==23&&x!==49)||(x%18===0&&y%13<4);return (x===15&&y>3&&y<16&&y!==8&&y!==13)||(y===18&&x>4&&x<28&&x!==11&&x!==22)||(x===42&&y>4&&y<25&&y!==10)||(y===39&&x>10&&x<51&&x!==19&&x!==33)||(x%13===0&&y%9<4)}))}
function make(parent,mode,opts={}){
 const selected=MAPS.find(m=>m.id===opts.map)||MAPS[0];const cells=buildCells(selected.id);
 const blocked=(x,z)=>{for(const [dx,dz] of [[-.24,-.24],[.24,.24],[-.24,.24],[.24,-.24]]){const cx=Math.floor(x+dx),cz=Math.floor(z+dz);if(cx<0||cz<0||cx>=W||cz>=H||cells[cz][cx])return true}return false};
 const root=document.createElement('div');root.className='fps-root';parent.append(root);
 const chooser=document.createElement('div');chooser.className='fps-map-choice';const label=document.createElement('label');label.textContent='🗺️ Map: ';const select=document.createElement('select');MAPS.forEach(m=>{const option=document.createElement('option');option.value=m.id;option.textContent=m.name;select.append(option)});select.value=selected.id;select.disabled=mode==='online';label.append(select);chooser.append(label);root.append(chooser);if(mode==='solo')select.onchange=()=>{const parentNode=root.parentNode;const newMap=select.value;stop();const next=make(parentNode,mode,{...opts,map:newMap});if(opts.onInstance)opts.onInstance(next)};else{const note=document.createElement('small');note.textContent=' · Host chooses the online map before Ready Up';chooser.append(note)}
 const hud=document.createElement('div');hud.className='fps-hud';root.append(hud);
 const renderer=new T.WebGLRenderer({antialias:true,powerPreference:'default'});renderer.setSize(960,540);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.domElement.className='fps-view';renderer.domElement.tabIndex=0;root.append(renderer.domElement);
 const help=document.createElement('p');help.textContent='WASD move · Shift sprint · Space jump · Mouse aim · Click shoot · Esc release cursor';root.append(help);
 const button=document.createElement('button');button.textContent='🎮 Click to enter 3D arena';root.append(button);
 const scene=new T.Scene();scene.background=new T.Color(selected.sky);scene.fog=new T.Fog(selected.sky,24,65);
 const camera=new T.PerspectiveCamera(78,960/540,.06,90);const ambient=new T.HemisphereLight(0xffffff,0x53627a,2.1);scene.add(ambient);const sun=new T.DirectionalLight(0xffffff,1.7);sun.position.set(20,35,12);scene.add(sun);
 const mat=(c)=>new T.MeshLambertMaterial({color:c});const groundMat=mat(selected.ground),wallMat=mat(selected.wall),topMat=mat('#8b96ac');
 const floor=new T.Mesh(new T.PlaneGeometry(W,H),groundMat);floor.rotation.x=-Math.PI/2;floor.position.set(W/2,0,H/2);scene.add(floor);
 // Distinct in-game architecture for each selected battleground.
 const structure=(x,y,z,w,h,d,color)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat(color));mesh.position.set(x,y,z);scene.add(mesh);return mesh};
 const wallGeo=new T.BoxGeometry(1,3.5,1);
 for(let z=0;z<H;z++)for(let x=0;x<W;x++)if(cells[z][x]){
  const boundary=x===0||z===0||x===W-1||z===H-1;
  const color=selected.id==='city'?(boundary?'#334c68':'#4c718e'):selected.id==='desert'?(boundary?'#967049':'#b8915e'):(boundary?'#7194ae':'#9ebaca');
  const wall=new T.Mesh(wallGeo,mat(color));wall.position.set(x+.5,1.75,z+.5);scene.add(wall)
 }
 const safeSpot=(x,z,r=1.5)=>{for(let dx=-r;dx<=r;dx+=.5)for(let dz=-r;dz<=r;dz+=.5)if(blocked(x+dx,z+dz))return false;return true};
 // Buildings and props occupy decorative space only, with collision registered below.
 const obstacles=[];
 const addSolid=(x,z,w,d)=>{const x0=Math.floor(x-w/2),x1=Math.ceil(x+w/2),z0=Math.floor(z-d/2),z1=Math.ceil(z+d/2);for(let zz=z0;zz<z1;zz++)for(let xx=x0;xx<x1;xx++)if(zz>0&&xx>0&&zz<H-1&&xx<W-1)cells[zz][xx]=true;obstacles.push([x,z,w,d])};
 const buildings=selected.id==='city'?
 [[10,24,5,5,7],[24,10,5,5,10],[35,25,6,5,8],[53,29,5,6,6],[10,39,5,5,9]]:
 selected.id==='desert'?
 [[11,22,6,5,4],[26,11,6,5,5],[36,32,7,5,4],[52,31,6,5,6],[12,39,5,5,4]]:
 [[10,24,6,5,5],[23,9,6,5,7],[35,26,6,6,5],[53,29,6,5,6],[11,39,5,5,5]];
 for(const [x,z,w,d,h] of buildings){
  if(!safeSpot(x,z,Math.max(w,d)/2+.6))continue;
  addSolid(x,z,w,d);
  const body=selected.id==='city'?'#537f9e':selected.id==='desert'?'#c39a6b':'#89aabe';
  structure(x,h/2,z,w,h,d,body);
  if(selected.id==='city'){
   structure(x,h+.12,z,w+.25,.24,d+.25,'#2b4860');
   for(let level=1.3;level<h-.5;level+=1.55)for(let offset=-w/2+.7;offset<w/2;offset+=1.35){
    structure(x+offset,level,z+d/2+.035,.65,.75,.07,'#b7e1f3');
    structure(x+offset,level,z-d/2-.035,.65,.75,.07,'#8dc4df');
   }
  }else if(selected.id==='desert'){
   structure(x,h+.16,z,w+.6,.32,d+.6,'#e0bb88');
   for(let offset=-w/2+.8;offset<w/2;offset+=1.7)structure(x+offset,1.6,z+d/2+.045,.6,1,.09,'#5b5147');
   structure(x,1.1,z+d/2+.06,1.25,2.2,.1,'#614c3e');
  }else{
   const roof=new T.Mesh(new T.ConeGeometry(Math.max(w,d)*.8,2,4),mat('#f4fbff'));roof.rotation.y=Math.PI/4;roof.position.set(x,h+1,z);scene.add(roof);
   structure(x,h+.08,z,w+.2,.18,d+.2,'#edf6fb');
   for(let offset=-w/2+.9;offset<w/2;offset+=1.7)structure(x+offset,1.7,z+d/2+.05,.65,.8,.1,'#b8e6fa');
  }
 }
 if(selected.id==='city'){
  for(let x=6;x<59;x+=12){structure(x,.025,5,.12,.05,13,'#c9c9b7');structure(x,.025,44,.12,.05,5,'#c9c9b7')}
  for(let z=6;z<44;z+=9)structure(32,.025,z,1.6,.05,.14,'#e5d7a2');
 }else if(selected.id==='desert'){
  for(const [x,z] of [[6,12],[40,8],[48,41],[20,37]]){structure(x,.5,z,.6,1,.6,'#997046');structure(x,1.4,z,1.2,.8,1.2,'#688565')}
 }else{
  for(const [x,z] of [[7,12],[39,9],[48,40],[19,36]]){structure(x,1.3,z,.32,2.6,.32,'#5b7b82');const cone=new T.Mesh(new T.ConeGeometry(1.4,3,6),mat('#d9eef3'));cone.position.set(x,3,z);scene.add(cone)}
 }
 const topMat=mat(selected.id==='desert'?'#d1b17d':selected.id==='snow'?'#d5e6f2':'#8696a5');
 const rampData=[[7,14,7,4],[45,7,8,4],[20,30,8,5],[48,40,7,4]];
 for(const [x,z,w,d] of rampData){const pad=structure(x+w/2,.07,z+d/2,w,.14,d,selected.id==='snow'?'#d6e8ef':selected.id==='desert'?'#bfa06d':'#607d88');pad.userData.decorative=true}
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
 // Choose a visible opponent, including other bots. Bot-vs-bot is preferred
 // when another bot is nearby, so the arena has independent AI battles.
 const candidates=[...bots.filter(other=>other!==b).map(other=>({x:other.x,z:other.z,bot:other})),{x:me.x,z:me.z,isPlayer:true}];
 const visible=[];
 const start=new T.Vector3(b.x,1.45,b.z);
 for(const t of candidates){const distance=Math.hypot(t.x-b.x,t.z-b.z);if(distance>19||distance<.5)continue;
 const end=new T.Vector3(t.x,t.isPlayer?1.65+me.y:1.45,t.z),dir=end.clone().sub(start).normalize();let clear=true;
 for(let d=.4;d<distance-.4;d+=.3){const p=start.clone().addScaledVector(dir,d);if(blocked(p.x,p.z)){clear=false;break}}
 if(clear)visible.push({target:t,end,distance})}
 if(visible.length){const botTargets=visible.filter(v=>v.target.bot);const pool=botTargets.length&&Math.random()<.7?botTargets:visible;const chosen=pool[Math.floor(Math.random()*pool.length)];
 b.group.rotation.y=Math.atan2(chosen.target.x-b.x,chosen.target.z-b.z);
 projectile(start,chosen.end,true,chosen.target.bot||'player')}
 b.nextShot=performance.now()+[2300,1800,1350,1000,700][level]+Math.random()*500;
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