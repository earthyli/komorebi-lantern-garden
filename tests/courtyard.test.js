const test=require('node:test');
const assert=require('node:assert/strict');
const W=require('../docs/courtyard-world.js');

test('entry and every interaction approach are reachable without crossing a collider',()=>{
 assert.ok(W.isWalkable(W.SPAWN.x,W.SPAWN.y));
 const starts=[W.SPAWN,...W.targets.map(t=>t.approach),{x:1100,y:700},{x:800,y:450}];
 for(const start of starts)for(const target of W.targets){
  const path=W.findPath(start,target.approach);assert.ok(path.length,`${JSON.stringify(start)} -> ${target.id}`);
  let previous=start;for(const point of path){assert.ok(W.isWalkable(point.x,point.y));assert.ok(W.clearLine(previous,point),`${target.id} crosses an obstacle`);previous=point;}
  assert.ok(W.distance(path.at(-1),target.approach)<1);assert.equal(W.nearby(target.approach).id,target.id);
 }
});
test('manual movement cannot tunnel through the café, pond or courtyard boundary',()=>{
 for(const [start,dx,dy] of [[{x:465,y:490},0,-500],[{x:790,y:545},400,0],[{x:700,y:800},0,500],[{x:80,y:600},-800,0]]){
  const end=W.move(start,dx,dy);assert.ok(W.isWalkable(end.x,end.y));assert.ok(W.distance(end,{x:start.x+dx,y:start.y+dy})>20);
 }
});
test('straight walking is accurate and diagonal obstruction can slide along a wall',()=>{
 const start={x:700,y:650};assert.deepEqual(W.move(start,25,0),{x:725,y:650});
 const end=W.move({x:465,y:490},80,-100);assert.ok(W.isWalkable(end.x,end.y));assert.ok(end.x>500);assert.ok(end.y>=449);
});
test('unwalkable taps move to a safe nearby point instead of inside the pond',()=>{
 const target=W.nearestWalkable({x:980,y:580});assert.ok(target);assert.ok(W.isWalkable(target.x,target.y));assert.ok(W.distance(target,{x:980,y:580})<160);
 const path=W.findPath(W.SPAWN,{x:980,y:580});assert.ok(path.length);assert.ok(W.isWalkable(path.at(-1).x,path.at(-1).y));
});
test('invalid stored positions recover at the entrance and valid positions preserve facing',()=>{
 for(const bad of [null,{x:NaN,y:500},{x:980,y:580},{x:400,y:300},{x:-100,y:900}])assert.deepEqual(W.restorePosition(bad),W.SPAWN);
 assert.deepEqual(W.restorePosition({x:700,y:650,facing:'left'}),{x:700,y:650,facing:'left'});
 assert.deepEqual(W.restorePosition({x:700,y:650,facing:'broken'}),{x:700,y:650,facing:'down'});
});
test('café and host click targets are distinct and remote interactions stay unavailable',()=>{
 assert.equal(W.hitTarget({x:465,y:350}).id,'cafe');assert.equal(W.hitTarget({x:674,y:440}).id,'haru');assert.equal(W.hitTarget({x:824,y:660}).id,'sign');
 assert.equal(W.nearby(W.SPAWN),null);assert.equal(W.hitTarget({x:700,y:800}),null);
});
