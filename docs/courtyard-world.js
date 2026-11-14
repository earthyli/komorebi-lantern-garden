(function (root) {
  'use strict';
  const WIDTH=1280, HEIGHT=900, RADIUS=17, CELL=20;
  const SPAWN={x:660,y:650,facing:'down'};
  // Ground-level footprints traced from the painted background.
  const obstacles=[
    {id:'cafe',kind:'rect',x:0,y:0,w:700,h:432},
    {id:'porch',kind:'rect',x:0,y:425,w:327,h:35},
    {id:'pond',kind:'ellipse',x:1050,y:544,rx:223,ry:78},
    {id:'haru',kind:'circle',x:674,y:468,r:15},
    {id:'sign',kind:'circle',x:824,y:706,r:13}
  ];
  const targets=[
    {id:'cafe',name:'Komorebi Café',action:'Enter the café',x:465,y:439,approach:{x:465,y:485},range:67,hit:{x:50,y:120,w:647,h:321}},
    {id:'haru',name:'Haru',action:'Talk to Haru',x:674,y:468,approach:{x:674,y:523},range:68,hit:{x:643,y:380,w:65,h:100}},
    {id:'sign',name:'Village sign',action:'Read the sign',x:824,y:706,approach:{x:770,y:725},range:72,hit:{x:793,y:635,w:68,h:82}}
  ];
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function isWalkable(x,y,radius=RADIUS){
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<48+radius||x>WIDTH-48-radius||y<411+radius||y>HEIGHT-40-radius)return false;
    for(const o of obstacles){
      if(o.kind==='rect'&&x>o.x-radius&&x<o.x+o.w+radius&&y>o.y-radius&&y<o.y+o.h+radius)return false;
      if(o.kind==='circle'&&Math.hypot(x-o.x,y-o.y)<o.r+radius)return false;
      if(o.kind==='ellipse'&&((x-o.x)/(o.rx+radius))**2+((y-o.y)/(o.ry+radius))**2<1)return false;
    }
    return true;
  }
  function restorePosition(value){
    if(value&&isWalkable(value.x,value.y))return {x:value.x,y:value.y,facing:['up','down','left','right'].includes(value.facing)?value.facing:'down'};
    return {...SPAWN};
  }
  function move(position,dx,dy){
    const result={x:position.x,y:position.y};
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return result;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6)),sx=dx/steps,sy=dy/steps;
    for(let i=0;i<steps;i++){
      if(isWalkable(result.x+sx,result.y+sy)){result.x+=sx;result.y+=sy;}
      else {if(isWalkable(result.x+sx,result.y))result.x+=sx;if(isWalkable(result.x,result.y+sy))result.y+=sy;}
    }
    return result;
  }
  function nearestWalkable(point){
    const x=clamp(point.x,70,WIDTH-70),y=clamp(point.y,430,HEIGHT-65);
    if(isWalkable(x,y))return {x,y};
    for(let radius=10;radius<240;radius+=10){
      for(let a=0;a<32;a++){const angle=a/32*Math.PI*2,px=x+Math.cos(angle)*radius,py=y+Math.sin(angle)*radius;if(isWalkable(px,py))return {x:px,y:py};}
    }
    return null;
  }
  function clearLine(a,b){const steps=Math.max(1,Math.ceil(distance(a,b)/5));for(let i=0;i<=steps;i++)if(!isWalkable(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps))return false;return true;}
  class Heap {
    constructor(){this.items=[];}
    push(item){const a=this.items;a.push(item);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].f<=item.f)break;a[i]=a[p];i=p;}a[i]=item;}
    pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(true){let c=i*2+1;if(c>=a.length)break;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
  }
  function findPath(start,destination){
    if(!isWalkable(start.x,start.y)||!Number.isFinite(destination.x)||!Number.isFinite(destination.y))return [];
    const goal=nearestWalkable(destination);if(!goal)return [];
    if(clearLine(start,goal))return [goal];
    const snap=p=>{let best=null,bestDistance=Infinity;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const n={x:(Math.round(p.x/CELL)+dx)*CELL,y:(Math.round(p.y/CELL)+dy)*CELL};if(isWalkable(n.x,n.y)&&clearLine(p,n)&&distance(n,p)<bestDistance){best=n;bestDistance=distance(n,p);}}return best;};
    const first=snap(start),last=snap(goal);if(!first||!last)return [];
    const key=p=>`${p.x},${p.y}`,goalKey=key(last),startKey=key(first),frontier=new Heap(),scores=new Map([[startKey,0]]),parents=new Map(),closed=new Set();
    frontier.push({...first,f:distance(first,last)});
    while(frontier.items.length){
      const cur=frontier.pop(),curKey=key(cur);if(closed.has(curKey))continue;
      if(curKey===goalKey){const result=[goal];let p=last;while(p){result.push({x:p.x,y:p.y});p=parents.get(key(p));}result.reverse();return result.filter((p,i)=>i===0||distance(p,result[i-1])>.01);}
      closed.add(curKey);
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]){
        const n={x:cur.x+dx*CELL,y:cur.y+dy*CELL},nk=key(n);
        if(closed.has(nk)||!isWalkable(n.x,n.y)||!clearLine(cur,n))continue;
        if(dx&&dy&&(!isWalkable(cur.x+dx*CELL,cur.y)||!isWalkable(cur.x,cur.y+dy*CELL)))continue;
        const g=scores.get(curKey)+Math.hypot(dx,dy)*CELL;
        if(g<(scores.get(nk)??Infinity)){scores.set(nk,g);parents.set(nk,cur);frontier.push({...n,f:g+distance(n,last)});}
      }
    }
    return [];
  }
  function nearby(position){return targets.filter(t=>distance(position,t)<t.range).sort((a,b)=>distance(position,a)-distance(position,b))[0]||null;}
  function hitTarget(point){return [...targets].reverse().find(t=>point.x>=t.hit.x&&point.x<=t.hit.x+t.hit.w&&point.y>=t.hit.y&&point.y<=t.hit.y+t.hit.h)||null;}
  const api={WIDTH,HEIGHT,RADIUS,CELL,SPAWN,obstacles,targets,isWalkable,restorePosition,move,nearestWalkable,findPath,nearby,hitTarget,distance,clamp,clearLine};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KomorebiWorld=api;
})(typeof globalThis!=='undefined'?globalThis:this);
