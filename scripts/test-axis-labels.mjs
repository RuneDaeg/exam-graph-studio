import {compileTestModules} from './test-module-loader.mjs';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

await mkdir('outputs',{recursive:true});
const temp=await mkdtemp(path.join(process.cwd(),'outputs','axis-labels-test-'));
try{
 await compileTestModules(temp,['graph','graph-edit']);
 const {graphSchema,graphLayout,renderGraph,defaultStyle,presets}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const {moveAxisLabel,isAxisLabelOnlyEdit,adjustText,deleteGraphTarget,movePoint}=await import(pathToFileURL(path.join(temp,'graph-edit.mjs')));
 const axes=['x','y','right','top'];
 const close=(a,b)=>assert.ok(Math.abs(a-b)<.011,`${a} ≈ ${b}`);
 const base=graphSchema.parse({
  ...presets[0].graph,title:'네 축의 변인',xLabel:'시간 (s)',yLabel:'온도\n(K)',
  xMin:1,xMax:100,yMin:1,yMax:100,equalAxes:false,
  xTicks:[{value:10,label:'10'}],yTicks:[{value:10,label:'10'}],
  topXAxis:{label:'주파수\n(Hz)',min:1,max:100,ticks:[{value:10,label:'10'}]},
  rightYAxis:{label:'압력\n(Pa)',min:1,max:100,ticks:[{value:10,label:'10'}]},
  curves:[{name:'곡선',points:[{x:2,y:3},{x:20,y:60},{x:80,y:20}],dashed:false,smooth:true,arrows:false,dots:false}],
  guides:[{x1:1,y1:60,x2:20,y2:60}],labels:[{x:20,y:60,text:'A',dx:0,dy:-10}],
  shadings:[{curve:0,mode:'rectangle',baseline:0,xStart:2,xEnd:10,yStart:2,yEnd:10,pattern:'solid',opacity:.15}],
 });
 const title=(svg,axis)=>{
  const match=svg.match(new RegExp(`<text data-edit="axis:${axis}"[^>]* x="([^"]+)" y="([^"]+)"[^>]*>([\\s\\S]*?)<\\/text>`));
  assert.ok(match,`axis ${axis} has an editable text element`);
  return {x:Number(match[1]),y:Number(match[2]),tspans:[...match[3].matchAll(/<tspan x="([^"]+)"/g)].map(m=>Number(m[1]))};
 };
 const withoutTitles=svg=>svg.replace(/<text data-edit="axis:(?:x|y|right|top)"[\s\S]*?<\/text>/g,'');
 const withoutOffsets=graph=>{const rest={...graph};delete rest.axisLabelOffsets;return rest;};
 const deepFreeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(deepFreeze);}return value;};
 deepFreeze(base);
 const offsets={x:{dx:-27,dy:18},y:{dx:35,dy:16},right:{dx:-22,dy:20},top:{dx:-28,dy:24}};
 let moved=base;
 for(const axis of axes)moved=moveAxisLabel(moved,axis,offsets[axis].dx,offsets[axis].dy);
 assert.equal(base.axisLabelOffsets,undefined,'moving titles never mutates the input');
 assert.deepEqual(moved.axisLabelOffsets,offsets);
 assert.deepEqual(withoutOffsets(moved),base,'only title offsets change');
 const accumulated=moveAxisLabel(moved,'x',4,-3);
 assert.deepEqual(accumulated.axisLabelOffsets.x,{dx:-23,dy:15});
 assert.deepEqual(moved.axisLabelOffsets.x,offsets.x,'existing offsets are immutable');

 // Layout, axes, ticks, curves, guides and shading are byte-identical after
 // title movement, including transformed and broken coordinate systems.
 const variants=[
  base,
  {...base,xScale:'log',yScale:'log',xReversed:true,yReversed:true,
   topXAxis:{...base.topXAxis,scale:'log',reversed:true},rightYAxis:{...base.rightYAxis,scale:'log',reversed:true}},
  {...base,xBreak:{from:30,to:50},yBreak:{from:70,to:80},
   topXAxis:{...base.topXAxis,break:{from:30,to:50}},rightYAxis:{...base.rightYAxis,break:{from:70,to:80}}},
  {...base,topXAxis:undefined,rightYAxis:undefined,xAxisPosition:'top'},
 ];
 const styles=[defaultStyle,{...defaultStyle,width:1100,height:760,fontSize:30,font:'serif'}];
 for(const candidate of variants)for(const style of styles){
  const original=graphSchema.parse(candidate),changed=graphSchema.parse({...original,axisLabelOffsets:offsets});
  const before=renderGraph(original,style),after=renderGraph(changed,style);
  assert.equal(withoutTitles(after),withoutTitles(before));
  const beforeLayout=graphLayout(original,style),afterLayout=graphLayout(changed,style);
  for(const key of ['L','R','T','B','ox','oy','dx','dy'])assert.equal(afterLayout[key],beforeLayout[key]);
  for(const axis of axes){
   if(axis==='right'&&!original.rightYAxis||axis==='top'&&!original.topXAxis)continue;
   const old=title(before,axis),next=title(after,axis);
   close(next.x-old.x,offsets[axis].dx);close(next.y-old.y,offsets[axis].dy);
   assert.ok(next.tspans.every(x=>x===next.x),'every multiline row follows the title');
  }
 }

 // Absent/zero values preserve the exact legacy SVG, while JSON import/export
 // and independent text/point edits preserve title positions.
 assert.equal(renderGraph({...base,axisLabelOffsets:{}}),renderGraph(base));
 assert.equal(renderGraph({...base,axisLabelOffsets:Object.fromEntries(axes.map(axis=>[axis,{dx:0,dy:0}]))}),renderGraph(base));
 assert.deepEqual(graphSchema.parse(JSON.parse(JSON.stringify(moved))).axisLabelOffsets,offsets);
 for(const axis of axes){
  const target={kind:'axis',axis},edited=adjustText(moved,target,'새 변인'),deleted=deleteGraphTarget(moved,target);
  assert.deepEqual(edited.axisLabelOffsets,offsets);assert.deepEqual(deleted.axisLabelOffsets,offsets);
  assert.deepEqual(deleted.curves,moved.curves);assert.deepEqual(deleted.guides,moved.guides);
  assert.deepEqual(deleted.xTicks,moved.xTicks);assert.deepEqual(deleted.yTicks,moved.yTicks);
  const restored=adjustText(deleted,target,axis==='x'?moved.xLabel:axis==='y'?moved.yLabel:axis==='right'?moved.rightYAxis.label:moved.topXAxis.label);
  assert.equal(renderGraph(restored),renderGraph(moved));
 }
 assert.deepEqual(movePoint(moved,0,1,21,61,false).axisLabelOffsets,offsets);
 // Keeping a science model is safe only when the axis title wording/position
 // changed. All graph content, ranges and independent axes still participate.
 assert.ok(isAxisLabelOnlyEdit(base,base));
 assert.ok(isAxisLabelOnlyEdit(base,moved));
 assert.ok(isAxisLabelOnlyEdit(moved,base),'clearing offsets only is a title edit');
 assert.ok(isAxisLabelOnlyEdit(base,Object.fromEntries(Object.entries(base).reverse())),'schema normalization ignores property order');
 for(const axis of axes){
  assert.ok(isAxisLabelOnlyEdit(moved,adjustText(moved,{kind:'axis',axis},'새 변인')));
  assert.ok(isAxisLabelOnlyEdit(moved,deleteGraphTarget(moved,{kind:'axis',axis})));
  assert.ok(isAxisLabelOnlyEdit(moved,moveAxisLabel(moved,axis,-offsets[axis].dx,-offsets[axis].dy)));
 }
 for(const changed of [
  movePoint(moved,0,1,21,61,false),
  {...moved,xMax:101},
  {...moved,yMin:0},
  {...moved,xReversed:true},
  {...moved,rightYAxis:{...moved.rightYAxis,max:101}},
  {...moved,topXAxis:{...moved.topXAxis,min:0}},
  {...moved,rightYAxis:undefined},
  {...moved,topXAxis:undefined},
  {...moved,xTicks:[{value:10,label:'다른 눈금'}]},
  {...moved,labels:[{...moved.labels[0],dx:10}]},
  {...moved,guides:[]},
  {...moved,shadings:[]},
  {...moved,title:'다른 그래프'},
  {...moved,note:'다른 주의점'},
 ])assert.equal(isAxisLabelOnlyEdit(moved,changed),false);
 for(const axis of ['rightYAxis','topXAxis']){
  const absent={...base,[axis]:undefined};
  assert.equal(isAxisLabelOnlyEdit(absent,base),false,'adding a secondary axis invalidates a model');
 }
 const formula=graphSchema.parse({...presets.find(p=>p.id==='normal').graph,axisLabelOffsets:offsets});
 assert.ok(isAxisLabelOnlyEdit(formula,moveAxisLabel(formula,'x',3,4)),'derived curve samples normalize deterministically');
 for(const axis of axes)for(const value of [NaN,Infinity,-Infinity]){
  assert.equal(graphSchema.safeParse({...base,axisLabelOffsets:{[axis]:{dx:value,dy:0}}}).success,false);
  assert.equal(graphSchema.safeParse({...base,axisLabelOffsets:{[axis]:{dx:0,dy:value}}}).success,false);
  assert.throws(()=>moveAxisLabel(base,axis,value,0));assert.throws(()=>moveAxisLabel(base,axis,0,value));
 }
 assert.equal(graphSchema.safeParse({...base,axisLabelOffsets:{x:{dx:0}}}).success,false);
 assert.throws(()=>moveAxisLabel({...base,topXAxis:undefined},'top',1,1),/위쪽/);
 assert.throws(()=>moveAxisLabel({...base,rightYAxis:undefined},'right',1,1),/오른쪽/);
 const large=moveAxisLabel(base,'x',Number.MAX_VALUE,Number.MAX_VALUE);
 assert.ok(!/Infinity|NaN/.test(renderGraph(large)),'finite extreme offsets never emit invalid SVG numbers');
 assert.throws(()=>moveAxisLabel(large,'x',Number.MAX_VALUE,0));
 console.log('PASS: all four axis titles move independently; linear/log/reversed/broken axes and data stay unchanged; multiline, style changes, immutable edits, JSON round-trip, deletion/restoration, title-only model preservation, and invalid offsets verified');
}finally{await rm(temp,{recursive:true,force:true});}
