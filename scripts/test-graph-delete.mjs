import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd();
await mkdir(path.join(root,'outputs'),{recursive:true});
const temp=await mkdtemp(path.join(root,'outputs','graph-delete-test-'));
try{
 for(const name of ['graph','graph-edit']){
  const source=(await readFile(path.join(root,'lib',name+'.ts'),'utf8')).replace("from './graph'","from './graph.mjs'");
  await writeFile(path.join(temp,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 }
 const {graphSchema,renderGraph,withDistribution,withConic,distributionPeakIndex}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const {deleteGraphTarget}=await import(pathToFileURL(path.join(temp,'graph-edit.mjs')));
 const curve=(points,options={})=>({name:'선',points:points.map(([x,y])=>({x,y})),dashed:false,smooth:false,arrows:false,dots:false,...options});
 const base=graphSchema.parse({
  title:'삭제 검사',xLabel:'x',yLabel:'y',xMin:0,xMax:10,yMin:0,yMax:10,
  xTicks:[{value:2,label:'2'},{value:4,label:'4'}],yTicks:[{value:2,label:'2'},{value:4,label:'4'}],
  rightYAxis:{label:'온도',min:0,max:100,ticks:[{value:20,label:'20'},{value:40,label:'40'}]},
  curves:[curve([[0,0],[2,3],[4,1]],{smooth:true}),curve([[0,1],[2,4],[4,2]])],
  guides:[{x1:0,y1:3,x2:2,y2:3},{x1:2,y1:0,x2:2,y2:30,yAxis:'right'}],
  labels:[{x:2,y:3,text:'P',dx:0,dy:0},{x:2,y:30,text:'Q',dx:0,dy:0,yAxis:'right'}],note:'',
 });
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
 const snapshot=structuredClone(base);
 freeze(base);
 const del=(graph,target)=>{
  const before=structuredClone(graph),result=deleteGraphTarget(graph,target);
  assert.deepEqual(graph,before,'deletion must not mutate its input');
  assert.ok(graphSchema.safeParse(result).success,'every deletion must leave a valid graph');
  return result;
 };
 for(const index of [0,1,2]){
  const result=del(base,{kind:'point',curve:0,index});
  assert.deepEqual(result.curves[0].points,base.curves[0].points.filter((_,i)=>i!==index),'delete first, interior and final vertices by index');
  assert.equal(result.curves[0].smooth,false,'two remaining vertices form a straight segment');
  assert.deepEqual(result.curves[1],base.curves[1]);
  assert.deepEqual(result.guides,base.guides,'independent guides survive deleting a point');
  assert.deepEqual(result.labels,base.labels,'independent labels survive deleting a point');
 }
 assert.deepEqual(base,snapshot);
 const pair={...base,curves:[curve([[1,2],[3,4]],{smooth:true})]};
 const singleton=del(pair,{kind:'point',curve:0,index:1});
 assert.equal(singleton.curves[0].dots,true,'a remaining isolated point must stay visible');
 assert.equal(singleton.curves[0].smooth,false);
 assert.ok(renderGraph(singleton).includes('<circle '),'the isolated point is present in the exported SVG');
 const empty=del(singleton,{kind:'point',curve:0,index:0});
 assert.equal(empty.curves.length,0,'the last point removes its empty curve');
 assert.deepEqual(empty.labels,base.labels);
 assert.doesNotThrow(()=>renderGraph(empty));

 const square={...base,curves:[curve([[1,1],[3,1],[3,3],[1,3],[1,1]],{smooth:true})]};
 for(const index of [0,4]){
  const result=del(square,{kind:'point',curve:0,index});
  assert.deepEqual(result.curves[0].points,[{x:3,y:1},{x:3,y:3},{x:1,y:3},{x:3,y:1}],
   'either copy of a closed endpoint removes the same vertex and re-closes');
  assert.equal(result.curves[0].smooth,true);
 }
 const triangle=del(square,{kind:'point',curve:0,index:2});
 assert.deepEqual(triangle.curves[0].points,[{x:1,y:1},{x:3,y:1},{x:1,y:3},{x:1,y:1}]);
 const opened=del(triangle,{kind:'point',curve:0,index:1});
 assert.deepEqual(opened.curves[0].points,[{x:1,y:1},{x:1,y:3}],'fewer than three distinct vertices must remain an open line');
 assert.equal(opened.curves[0].smooth,false);
 const duplicateLoop={...base,curves:[curve([[1,1],[2,2],[1,1]])]};
 assert.deepEqual(del(duplicateLoop,{kind:'point',curve:0,index:2}).curves[0].points,[{x:2,y:2}]);

 const rectangle={curve:0,mode:'rectangle',baseline:0,xStart:0,xEnd:4,yStart:0,yEnd:5,pattern:'solid',opacity:.15};
 const shade=(curve,xStart=0,xEnd=4,options={})=>({curve,mode:'baseline',baseline:0,xStart,xEnd,pattern:'solid',opacity:.15,...options});
 const shaded={...base,shadings:[shade(0,0,1),shade(0,2,4),shade(1),rectangle,shade(1,0,1,{mode:'between',otherCurve:0})]};
 const short=del(shaded,{kind:'point',curve:0,index:0});
 assert.deepEqual(short.shadings,[shaded.shadings[1],shaded.shadings[2],rectangle],
  'point deletion prunes only invalid dependent shades, including a between-shade secondary curve');
 const isolated=del(short,{kind:'point',curve:0,index:0});
 assert.deepEqual(isolated.shadings,[shaded.shadings[2],rectangle],'a singleton cannot bound a baseline shade');
 const removed=del(isolated,{kind:'point',curve:0,index:0});
 assert.deepEqual(removed.shadings,[{...shaded.shadings[2],curve:0},rectangle],'last-point removal reindexes remaining curve shades');
 const closedShade=shade(0,0,4,{mode:'closed'});
 const openWithShade=del({...triangle,shadings:[closedShade,rectangle]},{kind:'point',curve:0,index:1});
 assert.deepEqual(openWithShade.shadings,[rectangle],'opening a polygon removes its now-invalid interior shade');
 const three={...base,curves:[...base.curves,curve([[0,4],[4,4]])],shadings:[shade(0),shade(2),shade(0,0,4,{mode:'between',otherCurve:2}),rectangle]};
 const middleRemoved=del(three,{kind:'curve',curve:1});
 assert.deepEqual(middleRemoved.shadings,[shade(0),shade(1),shade(0,0,4,{mode:'between',otherCurve:1}),rectangle]);
 const firstRemoved=del(three,{kind:'curve',curve:0});
 assert.deepEqual(firstRemoved.shadings,[shade(1),rectangle],'removing an owning curve removes its baseline and between shades');

 for(const model of [
  {kind:'gamma',origin:0,peak:3,height:4,power:4,baseline:0,end:9},
  {kind:'normal',origin:0,peak:5,sigma:1,height:3,baseline:0,end:10},
 ]){
  const formula={...base,curves:[withDistribution(base.curves[0],model),base.curves[1]],shadings:[shade(0),rectangle]};
  const result=del(formula,{kind:'point',curve:0,index:distributionPeakIndex(formula.curves[0])});
  assert.deepEqual(result.curves,[base.curves[1]],'deleting a formula handle removes the owning curve');
  assert.deepEqual(result.shadings,[rectangle]);
 }
 for(const kind of ['circle','ellipse']){
  const conic={...base,curves:[withConic(base.curves[0],{kind,cx:5,cy:5,rx:2,ry:kind==='circle'?2:1})],shadings:[closedShade,rectangle]};
  for(const index of [0,4,8,12]){
   const result=del(conic,{kind:'point',curve:0,index});
   assert.equal(result.curves.length,0,'conic handles delete the exact model instead of leaving a broken sampled outline');
   assert.deepEqual(result.shadings,[rectangle]);
  }
 }

 for(const kind of ['label','guide']){
  const key=kind==='label'?'labels':'guides';
  for(const index of [0,1])assert.deepEqual(del(base,{kind,index})[key],base[key].filter((_,i)=>i!==index));
 }
 for(const axis of ['x','y','right']){
  const result=del(base,{kind:'tick',axis,index:0});
  const ticks=axis==='right'?result.rightYAxis.ticks:result[axis==='x'?'xTicks':'yTicks'];
  assert.deepEqual(ticks,[axis==='right'?base.rightYAxis.ticks[1]:base[axis==='x'?'xTicks':'yTicks'][1]]);
  const noLabel=del(base,{kind:'axis',axis});
  assert.equal(axis==='right'?noLabel.rightYAxis.label:noLabel[axis==='x'?'xLabel':'yLabel'],'');
  assert.deepEqual(noLabel.curves,base.curves,'deleting an axis name preserves the coordinate system and graphs');
  assert.equal(noLabel.rightYAxis.min,base.rightYAxis.min);
  assert.equal(noLabel.rightYAxis.max,base.rightYAxis.max);
 }
 const noRight={...base,rightYAxis:undefined,labels:[],guides:[]};
 assert.throws(()=>deleteGraphTarget(noRight,{kind:'axis',axis:'right'}),/오른쪽/);
 assert.throws(()=>deleteGraphTarget(noRight,{kind:'tick',axis:'right',index:0}),/오른쪽/);
 for(const index of [-1,.5,99,NaN,Infinity]){
  for(const target of [
   {kind:'point',curve:0,index},{kind:'point',curve:index,index:0},{kind:'curve',curve:index},
   {kind:'label',index},{kind:'guide',index},...['x','y','right'].map(axis=>({kind:'tick',axis,index})),
  ])assert.throws(()=>deleteGraphTarget(base,target),/항목/,'invalid indices must never silently delete a different item');
 }
 assert.throws(()=>deleteGraphTarget(empty,{kind:'point',curve:0,index:0}),/항목/);
 console.log('Graph deletion passed: curves, vertices, closed paths, formula handles, shades, labels, guides, axis text, ticks and immutability.');
}finally{
 await rm(temp,{recursive:true,force:true});
}
