
const $=id=>document.getElementById(id), games=['Tic-Tac-Toe','Connect Four','Emoji Memory','Rock Paper Scissors','Guess the Number','Reaction Time','Math Sprint','Typing Race','Higher or Lower','Coin Flip','Dice Duel','Whack-a-Mole','Simon Says','Sliding Puzzle','Hangman','Word Scramble','Lights Out','Minesweeper','2048','Snake'];
let user=null,socket=null,party=null,active=-1,stop=null;
let arcadeCleanup=null,soloStarted=0,soloFinished=false,soloTimers=[];
function later(fn,ms){const id=setTimeout(fn,ms);soloTimers.push(id);return id}
function endSolo(won,detail=''){if(soloFinished||active<0)return;soloFinished=true;const overlay=document.createElement('div');overlay.className='game-result';const title=document.createElement('h3');title.textContent=won?'🏆 You win!':'🎮 Game over';const info=document.createElement('p');info.textContent=detail||'Ready for another round?';const restart=document.createElement('button');restart.textContent='↻ Restart';restart.onclick=()=>start(active);const exit=document.createElement('button');exit.textContent='← Other games';exit.onclick=closeGame;overlay.append(title,info,restart,exit);$('arena').append(overlay);if(user){const elapsed=Math.round((Date.now()-soloStarted)/1000);api('/api/solo/result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:active,won,elapsed})}).then(r=>{const msg=document.createElement('p');msg.className='reward-toast';msg.textContent=r.rewarded?'+'+r.xp+' XP · +'+r.points+' points · Level '+r.level:r.message||'No reward this round';overlay.append(msg)}).catch(()=>{})}}

const difficulty=()=>$('difficulty').selectedIndex,rand=n=>Math.floor(Math.random()*n),shuffle=a=>a.sort(()=>Math.random()-.5);
let fpsEnginePromise=null;
async function ensureFPS3DEngine(){
 if(window.FPSArena?.ready&&window.THREE)return window.FPSArena;
 if(fpsEnginePromise)return fpsEnginePromise;
 fpsEnginePromise=(async()=>{
  try{
  const engine=await ensureFPS3DEngine();
  const holder=document.createElement('div');
  instance=engine.make(holder,'solo',{map:chosen,difficulty:difficulty(),win:()=>endSolo(true,'You won the Neon Frontier AI arena!')});
  parent.replaceChildren(holder);
 }catch(error){
  console.error('Neon Frontier startup failed:',error);
  start.disabled=false;start.textContent='▶ Try again';
  const message=document.createElement('p');message.setAttribute('role','alert');message.style.cssText='color:#ffb2b2;padding:12px';
  message.textContent='Could not start the 3D arena: '+(error?.message||String(error));
  lobby.querySelector('[role=alert]')?.remove();lobby.append(message);
 }
};lobby.append(start);parent.append(lobby);choose(chosen);
 arcadeCleanup=()=>{instance?.stop();instance=null}
}
