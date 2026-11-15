/* Original 2.5D courtyard, animated with Canvas. No remote assets or game service. */
(function(root){
 'use strict';
 const W=root.KomorebiWorld;
 const art = {};
 for (const name of ['lantern-garden','front','back','side','haru']) {
   const image = new Image();
   image.src = 'assets/garden/' + name + '.webp';
   art[name] = image;
 }
 const ready = image => image.complete && image.naturalWidth > 0;
 // Keep the chosen view while navigating. A fresh visit opens expanded.
 let preferExpanded = true;
 function mount(element,options={}){
  const canvas=element.querySelector('canvas'),ctx=canvas.getContext('2d');
  if(!ctx){element.querySelector('[data-world-status]').textContent='The courtyard could not open here. You can still start any café mission below.';return {destroy(){},pause(){},resume(){}};}
  const abort=new AbortController(),signal=abort.signal,player=W.restorePosition(options.position);
  const status=element.querySelector('[data-world-status]'),context=element.querySelector('[data-world-interact]'),expand=element.querySelector('[data-world-expand]');
  const held=new Set(),pointers=new Map(),camera={x:640,y:510},reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width=900,height=600,scale=.94,dpr=1,route=[],pendingInteraction=null,destination=null,steps=0,moving=false,paused=false,destroyed=false,raf=0,lastTime=0,elapsed=0,visible=true,contextId=null,savedOverflow='',expanded=false,lastStatus='',blockedFrames=0;
  const bind=(target,event,fn)=>target.addEventListener(event,fn,{signal});
  function remember(){options.onPosition?.({x:player.x,y:player.y,facing:player.facing});}
  function message(text){if(text!==lastStatus){status.textContent=text;lastStatus=text;}}
  function stopInput(){held.clear();pointers.clear();route=[];destination=null;pendingInteraction=null;moving=false;remember();}
  function pause(){paused=true;stopInput();updateContext();}
  function resume(){paused=false;lastTime=0;updateContext();wake();}
  function setFacing(dx,dy){if(Math.abs(dx)>Math.abs(dy))player.facing=dx>0?'right':'left';else if(dy)player.facing=dy>0?'down':'up';}
  function go(point,target=null){
    if(paused||document.querySelector('dialog[open]'))return;
    const path=W.findPath(player,point);held.clear();pointers.clear();
    if(!path.length){message('That spot is a little tucked away. Try the path beside it.');return;}
    route=path;destination=path[path.length-1];pendingInteraction=target;blockedFrames=0;element.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));
    message(target?`Walking to ${target.name}…`:'A little walk. Tap another spot to change direction.');wake();
  }
  function walkTo(id){const t=W.targets.find(t=>t.id===id);if(t)go(t.approach,t);}
  function interact(target=W.nearby(player)){if(!target||paused)return;pause();options.onInteract?.(target.id);}
  function updateContext(){
    const nearby=W.nearby(player);const nextId=nearby?.id||'';
    if(!route.length&&!moving&&!paused)message(nearby?`${nearby.name} is right here. Press E or use the button.`:'Tap the path to walk.');
    if(contextId===nextId && context.disabled===(!nearby||paused))return;
    contextId=nextId;
    context.disabled=!nearby||paused;
    context.innerHTML=nearby?`${nearby.action} <span aria-hidden="true">↗</span>`:'Walk up to Haru or the café';
    context.setAttribute('aria-label',nearby?nearby.action:'Walk up to Haru or the café');
    element.dataset.nearby=nextId;
  }
  function resize(){
    const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    scale=Math.max(width/W.WIDTH,height/W.HEIGHT,width<600?.85:.001);updateCamera(1);wake();
  }
  function updateCamera(amount){
    const halfX=width/scale/2,halfY=height/scale/2;
    const desiredX=halfX>W.WIDTH/2?W.WIDTH/2:W.clamp(player.x-(width<600?70:0),halfX,W.WIDTH-halfX);
    const desiredY=halfY>W.HEIGHT/2?W.HEIGHT/2:W.clamp(player.y-190,halfY,W.HEIGHT-halfY);
    camera.x+=(desiredX-camera.x)*amount;camera.y+=(desiredY-camera.y)*amount;
  }
  function toScreen(x,y){return {x:(x-camera.x)*scale+width/2,y:(y-camera.y)*scale+height/2};}
  function toWorld(clientX,clientY){const rect=canvas.getBoundingClientRect();return {x:(clientX-rect.left-width/2)/scale+camera.x,y:(clientY-rect.top-height/2)/scale+camera.y};}
  function nudge(direction){const dirs={up:[0,-58],down:[0,58],left:[-58,0],right:[58,0]};const [dx,dy]=dirs[direction];setFacing(dx,dy);go({x:player.x+dx,y:player.y+dy});}
  function keyDirection(key){return {w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'}[key.toLowerCase()];}
  function canUseKeys(event){const target=event.target;return visible&&!paused&&!document.querySelector('dialog[open]')&&!target?.closest('input,textarea,select,[contenteditable="true"]')&&(!target?.closest('button,a')||element.contains(target));}
  bind(canvas,'click',event=>{if(paused)return;canvas.focus({preventScroll:true});const point=toWorld(event.clientX,event.clientY),target=W.hitTarget(point);if(target)walkTo(target.id);else go(point);});
  bind(element,'click',event=>{
    const marker=event.target.closest('[data-world-target]');if(marker){walkTo(marker.dataset.worldTarget);return;}
    if(event.target.closest('[data-world-interact]'))interact();
    if(event.target.closest('[data-world-expand]'))toggleExpand();
  });
  for(const button of element.querySelectorAll('[data-move]')){
    bind(button,'pointerdown',event=>{if(paused)return;event.preventDefault();button.setPointerCapture(event.pointerId);route=[];destination=null;pendingInteraction=null;held.add(button.dataset.move);pointers.set(event.pointerId,{direction:button.dataset.move,time:performance.now(),x:player.x,y:player.y});button.classList.add('pressed');canvas.focus({preventScroll:true});wake();});
    const release=(event,cancelled=false)=>{const press=pointers.get(event.pointerId);if(!press)return;pointers.delete(event.pointerId);held.delete(press.direction);button.classList.remove('pressed');if(!cancelled&&performance.now()-press.time<170&&Math.hypot(player.x-press.x,player.y-press.y)<15)nudge(press.direction);remember();};
    bind(button,'pointerup',e=>release(e));bind(button,'pointercancel',e=>release(e,true));bind(button,'lostpointercapture',e=>release(e,true));bind(button,'contextmenu',e=>e.preventDefault());
    bind(button,'click',e=>{if(e.detail===0)nudge(button.dataset.move);});
  }
  bind(window,'keydown',event=>{
    if(event.key==='Escape'&&expanded&&!document.querySelector('dialog[open]')){event.preventDefault();toggleExpand(false);return;}
    if(!canUseKeys(event))return;
    const direction=keyDirection(event.key);
    if(direction){event.preventDefault();route=[];pendingInteraction=null;destination=null;held.add(direction);wake();}
    else if(event.key.toLowerCase()==='e'||(event.key==='Enter'&&event.target===canvas)){event.preventDefault();interact();}
  });
  bind(window,'keyup',event=>{const direction=keyDirection(event.key);if(direction){held.delete(direction);if(!held.size)remember();}});
  bind(window,'blur',()=>{stopInput();element.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));});
  bind(document,'visibilitychange',()=>{if(document.hidden){stopInput();cancelAnimationFrame(raf);raf=0;}else wake();});
  const background = [
    ...element.parentElement.children,
    document.querySelector('.site-header'),document.querySelector('.site-footer'),
    document.querySelector('.skip-link')
  ].filter(node => node && node !== element && !node.inert);
  function restorePage() {
    document.body.style.overflow = savedOverflow;
    background.forEach(node => { node.inert = false; });
  }
  function toggleExpand(force = !expanded) {
    expanded = force;
    preferExpanded = expanded;
    element.classList.toggle('is-expanded', expanded);
    expand.setAttribute('aria-expanded', String(expanded));
    expand.setAttribute('aria-label', expanded ? 'Close expanded courtyard' : 'Expand courtyard');
    expand.innerHTML = expanded ? '↙ <span>Close view</span>' : '⤢ <span>Expand</span>';
    if (expanded) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      background.forEach(node => { node.inert = true; });
    } else restorePage();
    resize();
    canvas.focus({preventScroll:true});
  }
  const observer=new ResizeObserver(resize);observer.observe(element);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)wake();else{cancelAnimationFrame(raf);raf=0;stopInput();}},{threshold:0});intersection.observe(element);
  function tick(timestamp){
    raf=0;if(destroyed||document.hidden||!visible)return;
    const dt=lastTime?Math.min(.04,(timestamp-lastTime)/1000):0;lastTime=timestamp;elapsed+=dt;
    const old={x:player.x,y:player.y};let dx=0,dy=0;
    if(!paused){
      if(held.size){dx=(held.has('right')?1:0)-(held.has('left')?1:0);dy=(held.has('down')?1:0)-(held.has('up')?1:0);const magnitude=Math.hypot(dx,dy)||1;dx=dx/magnitude*166*dt;dy=dy/magnitude*166*dt;}
      else if(route.length){const aim=route[0],distance=W.distance(player,aim),travel=Math.min(distance,166*dt);if(distance<3){player.x=aim.x;player.y=aim.y;route.shift();}else{dx=(aim.x-player.x)/distance*travel;dy=(aim.y-player.y)/distance*travel;}}
      if(dx||dy){setFacing(dx,dy);const p=W.move(player,dx,dy);player.x=p.x;player.y=p.y;}
    }
    const traveled=W.distance(player,old);moving=traveled>.05;steps+=traveled/16;
    if(route.length&&(dx||dy)&&traveled<.05){blockedFrames++;if(blockedFrames>15){route=[];pendingInteraction=null;destination=null;remember();message('Let’s take another route. Tap a clear spot on the path.');}}else blockedFrames=0;
    if(!route.length&&pendingInteraction){const target=pendingInteraction;pendingInteraction=null;destination=null;remember();if(W.distance(player,target)<target.range+12)interact(target);}
    if(!route.length&&destination){destination=null;remember();}
    updateCamera(Math.min(1,dt*7));updateContext();
    element.dataset.playerX=player.x.toFixed(1);element.dataset.playerY=player.y.toFixed(1);element.dataset.walking=String(moving||!!route.length);
    draw();raf=requestAnimationFrame(tick);
  }
  function wake(){if(!destroyed&&!raf&&visible&&!document.hidden){lastTime=0;raf=requestAnimationFrame(tick);}}
  function draw(){
    const time=reduced?0:elapsed;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#242e3e';ctx.fillRect(0,0,width,height);
    ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*(width/2-camera.x*scale),dpr*(height/2-camera.y*scale));
    if (ready(art['lantern-garden'])) ctx.drawImage(art['lantern-garden'],0,0,W.WIDTH,W.HEIGHT);
    if(destination&&!paused){
      ctx.strokeStyle='#fff2c0';ctx.lineWidth=2;
      ellipse(ctx,destination.x,destination.y,14+Math.sin(time*5)*2,5,false);
    }
    const actors = [
      {y:468,paint:()=>paintActor(ctx,{x:674,y:468,facing:'down'},true,time,0)},
      {y:player.y,paint:()=>paintActor(ctx,player,false,time,moving?steps:0)},
      {y:706,paint:()=>drawSign(ctx)}
    ];
    actors.sort((a,b)=>a.y-b.y).forEach(actor=>actor.paint());
    // Soft lantern motes over the courtyard, held still under reduced motion.
    for(let i=0;i<25;i++){
      const x=48+(i*147)%1170+Math.sin(time*.28+i)*12;
      const y=300+(i*67)%475+Math.cos(time*.35+i)*10;
      ctx.fillStyle='rgba(255,224,151,'+(.28+.22*Math.sin(time*1.18+i))+')';
      ellipse(ctx,x,y,2.3,2.3);ctx.fillStyle='#fff4bc';ellipse(ctx,x,y,.85,.85);
    }
    for(const label of element.querySelectorAll('[data-world-target]')){
      const target=W.targets.find(t=>t.id===label.dataset.worldTarget),offset=target.id==='cafe'?125:target.id==='haru'?100:72,p=toScreen(target.x,target.y-offset);
      const edge=width<600?67:85;
      label.hidden=p.x<-45||p.x>width+45||p.y<-30||p.y>height-70;label.style.left=`${W.clamp(p.x,edge,width-edge)}px`;label.style.top=`${p.y}px`;
    }
  }
  if (preferExpanded) toggleExpand(true); else resize();
  updateContext();wake();
  return {walkTo,pause,resume,focus:()=>canvas.focus({preventScroll:true}),destroy(){if(destroyed)return;remember();destroyed=true;abort.abort();observer.disconnect();intersection.disconnect();cancelAnimationFrame(raf);if(expanded)restorePage();}};
 }
 function ellipse(c,x,y,rx,ry,fill=true){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);fill?c.fill():c.stroke();}
 function rect(c,x,y,w,h,fill,r=0){c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
 function line(c,points,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();}
 function drawSign(c) {
   c.save();c.translate(824,706);c.fillStyle='#36282a66';ellipse(c,4,1,25,5);
   line(c,[[-18,-42],[-22,0]],'#50332b',5);line(c,[[17,-42],[22,0]],'#50332b',5);
   rect(c,-27,-61,54,45,'#614436',3);rect(c,-24,-58,48,39,'#c89a62',2);
   rect(c,-21,-55,42,33,'#374640',2);
   c.textAlign='center';c.fillStyle='#ffe5ac';c.font='10px serif';c.fillText('ようこそ',0,-38);
   c.font='8px serif';c.fillText('✧',0,-26);c.restore();
 }
 function paintActor(c,p,host,time,phase) {
   const side=p.facing==='right'||p.facing==='left';
   const sprite=art[host?'haru':side?'side':p.facing==='up'?'back':'front'];
   if(!ready(sprite))return;
   const height=host?98:105;
   const width=height*sprite.naturalWidth/sprite.naturalHeight;
   const stride=phase?Math.sin(phase*1.6):0;
   c.save();c.translate(p.x,p.y);
   c.fillStyle='#30263955';ellipse(c,1,1,width*.45,5);
   c.translate(0,-Math.abs(stride)*3+Math.sin(time*1.55)*.55);
   if(p.facing==='right')c.scale(-1,1);
   c.rotate(stride*.024);
   // Animate the lower silhouette independently, keeping the boot soles planted.
   const split=Math.round(sprite.naturalHeight*.72),upper=height*split/sprite.naturalHeight;
   c.drawImage(sprite,0,0,sprite.naturalWidth,split,-width/2,-height,width,upper+.3);
   const half=sprite.naturalWidth/2;
   for(let leg=0;leg<2;leg++){
     const swing=(leg?1:-1)*stride;
     c.drawImage(sprite,leg*half,split,half,sprite.naturalHeight-split,
       (leg-1)*width/2 + swing*1.8,-height+upper,width/2+.25,height-upper+Math.min(0,swing)*3);
   }
   c.restore();
 }
 root.KomorebiCourtyard={mount};
})(window);
