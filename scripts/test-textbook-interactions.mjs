import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileTestModules} from './test-module-loader.mjs';

await mkdir('outputs',{recursive:true});
const temp=await mkdtemp(path.join(process.cwd(),'outputs','textbook-interactions-test-'));
try{
 await compileTestModules(temp,['graph','graph-edit']);
 const {graphSchema,graphLayout,renderGraph,withDistribution,pointOnCurve,nearestMappedCurvePosition}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const {movePoint,moveCurve,adjustText,deleteGraphTarget,updateDistribution,createRectangleShading,insertCurvePoint}=await import(pathToFileURL(path.join(temp,'graph-edit.mjs')));
 const base={title:'축과 도표 상호 작용',xLabel:'x',yLabel:'y',xMin:0,xMax:10,yMin:0,yMax:10,xTicks:[],yTicks:[],curves:[],guides:[],labels:[],note:''};
 const curve=points=>({name:'검증',points,dashed:false,smooth:false,arrows:false,dots:false});
 const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance*Math.max(1,Math.abs(a),Math.abs(b)),`${a} ≠ ${b}`);
 const failures=[];let passed=0;
 function check(name,fn){try{fn();passed++;}catch(error){failures.push({name,error:error.message});}}
 const top=graphSchema.parse({...base,topXAxis:{label:'상단',min:100,max:200,reversed:true,ticks:[{value:120,label:'a'}]},rightYAxis:{label:'오른쪽',min:0,max:100,ticks:[]},curves:[{...curve([{x:120,y:30},{x:150,y:60}]),xAxis:'top',yAxis:'right'}],labels:[{x:120,y:30,text:'top-right',dx:0,dy:0,xAxis:'top',yAxis:'right'},{x:120,y:30,text:'bottom-right',dx:0,dy:0,yAxis:'right'},{x:120,y:30,text:'top-left',dx:0,dy:0,xAxis:'top'}],guides:[{x1:120,y1:0,x2:120,y2:30,xAxis:'top',yAxis:'right'},{x1:120,y1:0,x2:120,y2:30,yAxis:'right'}]});
 check('top/right point clamping and anchor isolation',()=>{
  const next=movePoint(top,0,0,250,200,true);
  assert.deepEqual(next.curves[0].points[0],{x:200,y:100});
  assert.deepEqual(next.labels[0],{...top.labels[0],x:200,y:100});
  assert.deepEqual(next.labels.slice(1),top.labels.slice(1));
  assert.deepEqual(next.guides[0],{...top.guides[0],x1:200,x2:200,y2:100});
  assert.deepEqual(next.guides[1],top.guides[1]);
 });
 check('top/right curve clamp uses assigned units',()=>{
  const next=moveCurve(top,0,100,100,true);
  assert.deepEqual(next.curves[0].points,[{x:170,y:70},{x:200,y:100}]);
  assert.deepEqual(next.labels[0],{...top.labels[0],x:170,y:70});
 });
 check('top axis text/tick edits and deletions stay isolated',()=>{
  const named=adjustText(top,{kind:'axis',axis:'top'},'새 상단');
  assert.equal(named.topXAxis.label,'새 상단');assert.equal(named.xLabel,top.xLabel);
  const tick=adjustText(top,{kind:'tick',axis:'top',index:0},'b',130);
  assert.deepEqual(tick.topXAxis.ticks,[{value:130,label:'b'}]);assert.deepEqual(tick.xTicks,top.xTicks);
  assert.equal(deleteGraphTarget(top,{kind:'tick',axis:'top',index:0}).topXAxis.ticks.length,0);
  assert.equal(deleteGraphTarget(top,{kind:'axis',axis:'top'}).topXAxis.label,'');
 });
 check('normal parameter ticks follow their top axis only',()=>{
  const normal=withDistribution({...curve([{x:1,y:1},{x:4,y:4},{x:9,y:1}]),xAxis:'top'},{kind:'normal',origin:1,end:9,peak:4,sigma:1,height:3,baseline:1});
  const graph=graphSchema.parse({...base,xTicks:[{value:4,label:'\\mu'}],topXAxis:{label:'상단',min:0,max:10,ticks:[{value:3,label:'\\mu-\\sigma'},{value:4,label:'\\mu'},{value:5,label:'\\mu+\\sigma'}]},curves:[normal]});
  const next=updateDistribution(graph,0,{peak:5,sigma:2},true);
  assert.deepEqual(next.xTicks,graph.xTicks,'bottom-axis symbols belong to another axis');
  assert.deepEqual(next.topXAxis.ticks.map(t=>t.value),[3,5,7]);
  const shifted=moveCurve(graph,0,1,0,true);
  assert.deepEqual(shifted.xTicks,graph.xTicks);
  assert.deepEqual(shifted.topXAxis.ticks.map(t=>t.value),[4,5,6]);
 });
 check('scatter duplicate endpoint moves independently',()=>{
  const graph=graphSchema.parse({...base,curves:[{...curve([{x:1,y:1},{x:2,y:2},{x:3,y:4},{x:1,y:1}]),plot:'scatter'}]});
  const next=movePoint(graph,0,0,1.5,1.5);
  assert.deepEqual(next.curves[0].points.at(-1),{x:1,y:1});
 });
 check('scatter duplicate endpoint deletion retains other observations',()=>{
  const points=[{x:1,y:1},{x:2,y:2},{x:3,y:4},{x:1,y:1}],graph=graphSchema.parse({...base,curves:[{...curve(points),plot:'scatter'}]});
  assert.deepEqual(deleteGraphTarget(graph,{kind:'point',curve:0,index:3}).curves[0].points,points.slice(0,3));
 });
 check('scatter positions have no smooth-line neighbor restriction',()=>{
  const graph=graphSchema.parse({...base,curves:[{...curve([{x:1,y:1},{x:2,y:2},{x:3,y:4}]),smooth:true,plot:'scatter'}]});
  assert.equal(movePoint(graph,0,1,8,2).curves[0].points[1].x,8);
 });
 check('bar/scatter single point deletion removes the empty series',()=>{
  for(const plot of ['scatter','bar','histogram']){
   const graph=graphSchema.parse({...base,curves:[{...curve([{x:2,y:4}]),plot}]});
   assert.equal(deleteGraphTarget(graph,{kind:'point',curve:0,index:0}).curves.length,0);
   assert.throws(()=>insertCurvePoint(graph,0,0,.5));
  }
 });
 check('nonlinear nearest-point includes near-endpoint minima',()=>{
  const c=curve([{x:1,y:1},{x:1000,y:4}]);
  const graph=graphSchema.parse({...base,xMin:1,xMax:1000,xScale:'log',curves:[c]}),layout=graphLayout(graph);
  for(const t of [.002,.005,.23,.5,.994,.998]){
   const expected=pointOnCurve(c,0,t),pixel={x:layout.X(expected.x),y:layout.Y(expected.y)};
   const actual=nearestMappedCurvePosition(c,pixel,layout.X,layout.Y);
   near(actual.t,t,1e-6);assert.ok(actual.distance<1e-3);
  }
 });
 check('nonlinear/reversed top-axis pointer conversion round trips',()=>{
  const graph=graphSchema.parse({...top,topXAxis:{...top.topXAxis,min:1,max:1000,scale:'log'},rightYAxis:{...top.rightYAxis,min:1,max:1000,scale:'log',reversed:true},guides:[],labels:[]}),layout=graphLayout(graph);
  for(const p of [{x:5,y:7},{x:125,y:36},{x:950,y:700}]){
   const world=layout.worldFor(layout.XFor(p.x,'top'),layout.YFor(p.y,'right'),'right','top');near(world.x,p.x);near(world.y,p.y);
  }
 });
 check('rectangle draw corners remain positive in reversed/log layouts',()=>{
  for(const reversed of [false,true]){
   const graph=graphSchema.parse({...base,xMin:1,xMax:1000,yMin:1,yMax:1000,xScale:'log',yScale:'log',xReversed:reversed,yReversed:reversed}),layout=graphLayout(graph);
   const a=layout.world(layout.L+30,layout.T+40),b=layout.world(layout.R-30,layout.B-40),shade=createRectangleShading(graph,a,b);
   assert.ok(shade.xStart<shade.xEnd&&shade.yStart<shade.yEnd);
   const x=Math.min(layout.X(a.x),layout.X(b.x)),y=Math.min(layout.Y(a.y),layout.Y(b.y)),width=Math.abs(layout.X(b.x)-layout.X(a.x)),height=Math.abs(layout.Y(b.y)-layout.Y(a.y));
   near(x,layout.L+30);near(y,layout.T+40);near(width,layout.R-layout.L-60);near(height,layout.B-layout.T-80);
   assert.ok(!/NaN|Infinity/.test(renderGraph({...graph,shadings:[shade]})));
  }
 });
 check('broken axis inverse chooses a visible gap edge',()=>{
  for(const reversed of [false,true]){
   const graph=graphSchema.parse({...base,xBreak:{from:3,to:7},yBreak:{from:3,to:7},xReversed:reversed,yReversed:reversed}),layout=graphLayout(graph);
   const pixelX=(layout.X(3)+layout.X(7))/2,pixelY=(layout.Y(3)+layout.Y(7))/2,p=layout.world(pixelX,pixelY);
   assert.ok(p.x===3||p.x===7);assert.ok(p.y===3||p.y===7);
  }
 });
 if(failures.length){console.error(JSON.stringify({passed,failures},null,2));throw Error(`${failures.length} textbook interaction regressions`);}
 console.log(`Textbook interaction tests passed: ${passed} groups (assigned axes, symbolic anchors, scatter deletion, nonlinear insertion, rectangle mapping, broken gaps).`);
}finally{await rm(temp,{recursive:true,force:true});}
