import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd();
await mkdir(path.join(root,'outputs'),{recursive:true});
const temp=await mkdtemp(path.join(root,'outputs','graph-edit-test-'));
try{
 for(const name of ['graph','graph-edit']){
  const source=(await readFile(path.join(root,'lib',name+'.ts'),'utf8')).replace("from './graph'","from './graph.mjs'");
  await writeFile(path.join(temp,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 }
 const {presets,graphSchema}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const {movePoint,moveCurve,moveLabel,adjustText}=await import(pathToFileURL(path.join(temp,'graph-edit.mjs')));
 const base=structuredClone(presets[0].graph);
 const original=structuredClone(base);
 const clamped=movePoint(base,0,1,100,-100);
 assert.deepEqual(clamped.curves[0].points[1],{x:base.xMax,y:base.yMin});
 assert.deepEqual(clamped.guides,base.guides,'following is opt-in');
 assert.deepEqual(base,original,'point edits must not mutate the input');
 assert.throws(()=>movePoint(base,0,1,NaN,1));
 assert.throws(()=>movePoint(base,0,99,1,1));

 const negative={...base,xMin:-10,xMax:-2,yMin:-8,yMax:-1,curves:[{...base.curves[0],points:[{x:-9,y:-7},{x:-5,y:-3}]}],labels:[],guides:[]};
 const shifted=moveCurve(negative,0,100,100);
 assert.deepEqual(shifted.curves[0].points,[{x:-6,y:-5},{x:-2,y:-1}]);
 const backwards=moveCurve(negative,0,-100,-100);
 assert.deepEqual(backwards.curves[0].points,[{x:-10,y:-8},{x:-6,y:-4}]);
 assert.deepEqual(movePoint(negative,0,0,0,-20).curves[0].points[0],{x:-2,y:-8});
 const tooWide={...negative,curves:[{...negative.curves[0],points:[{x:-20,y:-3},{x:5,y:-3}]}]};
 assert.throws(()=>moveCurve(tooWide,0,1,1),/축 범위/);

 const pv=structuredClone(presets.find(p=>p.id==='pv').graph);
 const pvOriginal=structuredClone(pv);
 for(const index of [0,pv.curves[0].points.length-1]){
  const next=movePoint(pv,0,index,1.2,1.3);
  assert.deepEqual(next.curves[0].points[0],{x:1.2,y:1.3});
  assert.deepEqual(next.curves[0].points.at(-1),{x:1.2,y:1.3});
 }
 assert.deepEqual(pv,pvOriginal);

 const fixture={...base,xMax:10,yMax:10,
  curves:[{...base.curves[0],points:[{x:2,y:3},{x:4,y:5}]}],
  labels:[{x:2,y:3,text:'A',dx:9,dy:-12},{x:2.001,y:3,text:'독립',dx:0,dy:0}],
  guides:[
   {x1:2,y1:0,x2:2,y2:3},
   {x1:0,y1:3,x2:2,y2:3},
   {x1:2,y1:3,x2:4,y2:5},
   {x1:1,y1:1,x2:6,y2:1},
   {x1:2,y1:3,x2:2,y2:8},
   {x1:2,y1:3,x2:7,y2:3},
  ]};
 const fixtureOriginal=structuredClone(fixture);
 const followed=movePoint(fixture,0,0,3,5,true);
 assert.deepEqual(followed.labels[0],{x:3,y:5,text:'A',dx:9,dy:-12});
 assert.deepEqual(followed.labels[1],fixture.labels[1],'nearby anchors must not follow');
 assert.deepEqual(followed.guides,[
  {x1:3,y1:0,x2:3,y2:5},
  {x1:0,y1:5,x2:3,y2:5},
  {x1:3,y1:5,x2:4,y2:5},
  {x1:1,y1:1,x2:6,y2:1},
  {x1:3,y1:5,x2:3,y2:8},
  {x1:3,y1:5,x2:7,y2:5},
 ]);
 assert.deepEqual(followed.xTicks,fixture.xTicks);
 assert.deepEqual(followed.yTicks,fixture.yTicks);
 const followedCurve=moveCurve(fixture,0,1,2,true);
 assert.deepEqual(followedCurve.guides[2],{x1:3,y1:5,x2:5,y2:7},'both matching endpoints move independently');
 assert.deepEqual(followedCurve.guides[0],{x1:3,y1:0,x2:3,y2:5});
 assert.deepEqual(fixture,fixtureOriginal,'follow must not mutate labels or guides');
 assert.deepEqual(moveCurve(fixture,0,1,2).labels,fixture.labels);

 const labelMove=moveLabel(fixture,0,5,-7);
 assert.deepEqual(labelMove.labels[0],{x:2,y:3,text:'A',dx:14,dy:-19});
 assert.equal(moveLabel(fixture,0,2e6,-2e6).labels[0].dx,1e6);
 assert.equal(moveLabel(fixture,0,2e6,-2e6).labels[0].dy,-1e6);
 assert.throws(()=>moveLabel(fixture,0,Infinity,0));
 assert.equal(adjustText(fixture,{kind:'axis',axis:'x'},'t_0').xLabel,'t_0');
 assert.equal(adjustText(fixture,{kind:'label',index:0},'B').labels[0].text,'B');
 const tick=adjustText(fixture,{kind:'tick',axis:'y',index:0},'P_0',2.5).yTicks[0];
 assert.deepEqual(tick,{value:2.5,label:'P_0'});
 assert.equal(adjustText(fixture,{kind:'tick',axis:'x',index:0},'T').xTicks[0].value,fixture.xTicks[0].value);
 assert.throws(()=>adjustText(fixture,{kind:'axis',axis:'y'},'x'.repeat(81)));
 assert.throws(()=>adjustText(fixture,{kind:'tick',axis:'x',index:0},'t',Infinity));
 assert.throws(()=>adjustText(fixture,{kind:'point',curve:0,index:0},'A'));
 assert.deepEqual(fixture,fixtureOriginal);
 for(const graph of [clamped,shifted,backwards,followed,followedCurve,labelMove])assert.equal(graphSchema.safeParse(graph).success,true);
 console.log('PASS: bounds, negative ranges, closed loops, optional follow, guide projections, text validation, immutable edits');
}finally{await rm(temp,{recursive:true,force:true});}
