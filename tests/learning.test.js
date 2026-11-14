const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('../docs/learning.js');

test('content has unique IDs and usable answers; sentence tiles form the target Japanese',()=>{
 assert.equal(L.missions.length,3);assert.equal(L.allQuestions.length,18);
 assert.equal(new Set(L.allQuestions.map(q=>q.id)).size,18);
 for(const q of L.allQuestions){assert.ok(q.jp&&q.meaning&&q.explanation);if(q.type==='tiles'){assert.equal(q.tiles.join(''),q.jp);assert.equal(new Set(q.tiles).size,q.tiles.length);}else{assert.ok(q.answer>=0&&q.answer<q.options.length);assert.equal(new Set(q.options).size,q.options.length);}}
});
test('a wrong answer earns no steps and returns sooner than independent success',()=>{
 const s=L.recordAnswer(L.blankState(),'l1',false,false,1000);
 assert.equal(s.xp,0);assert.equal(s.attempts.l1.correct,0);assert.equal(s.reviews.l1.streak,0);
 assert.equal(L.dueItems(s,1001).length,0);assert.equal(L.dueItems(s,1801000).length,1);
 const ok=L.recordAnswer(L.blankState(),'l1',true,false,1000);
 assert.equal(ok.reviews.l1.due,86401000);assert.equal(ok.reviews.l1.streak,1);
});
test('helped answers record support and do not advance independent review streaks',()=>{
 let s=L.recordAnswer(L.blankState(),'l1',true,false,1000);
 s=L.recordAnswer(s,'l1',true,true,2000);
 assert.equal(s.reviews.l1.streak,0);assert.equal(s.attempts.l1.hints,1);assert.equal(s.reviews.l1.due,1802000);
});
test('replaying an easy question or a completed mission cannot farm rewards',()=>{
 let s=L.recordAnswer(L.blankState(),'l1',true,false,1000);
 s=L.recordAnswer(s,'l1',true,false,2000);assert.equal(s.xp,10);
 s=L.completeMission(s,'listen');s=L.completeMission(s,'listen');assert.equal(s.xp,40);assert.deepEqual(s.completed,['listen']);
});
test('a full café run earns three stamps and survives JSON restore',()=>{
 let s=L.blankState();for(const m of L.missions){for(const q of m.questions)s=L.recordAnswer(s,q.id,true,false,12345);s=L.completeMission(s,m.id);}
 assert.equal(s.xp,270);assert.equal(s.learned.length,18);assert.equal(s.completed.length,3);
 assert.deepEqual(L.restore(JSON.stringify(s)),s);
});
test('malformed and unsupported saves recover; unknown IDs and invalid metrics are filtered',()=>{
 assert.deepEqual(L.restore('{broken'),L.blankState());assert.deepEqual(L.restore({version:99}),L.blankState());
 const s=L.restore({version:1,xp:Infinity,completed:['listen','listen','ghost'],learned:['ghost'],attempts:{l1:{total:-1,correct:10,hints:0}},reviews:{l1:{due:'bad',streak:0}}});
 assert.equal(s.xp,0);assert.deepEqual(s.completed,['listen']);assert.deepEqual(s.learned,[]);assert.deepEqual(s.attempts,{});assert.deepEqual(s.reviews,{});
});
test('learning transitions preserve the input and reject unknown learning IDs',()=>{
 const original=L.blankState();const next=L.recordAnswer(original,'l1',true,false,1000);
 assert.equal(original.xp,0);assert.equal(next.xp,10);
 assert.throws(()=>L.recordAnswer(original,'unknown',true,false));assert.throws(()=>L.completeMission(original,'unknown'));
});
test('the public garden includes its original soundtrack',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const track=fs.readFileSync(path.join(__dirname,'../docs/assets/audio/lantern-hours.wav'));
 assert.equal(track.toString('ascii',0,4),'RIFF');
 assert.equal(track.toString('ascii',8,12),'WAVE');
});
