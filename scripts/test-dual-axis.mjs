import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const root=process.cwd();
await mkdir(path.join(root,'outputs'),{recursive:true});
const temp=await mkdtemp(path.join(root,'outputs','dual-axis-test-'));
try{
 for(const name of ['graph','graph-edit']){
  const source=(await readFile(path.join(root,'lib',name+'.ts'),'utf8')).replace("from './graph'","from './graph.mjs'");
  await writeFile(path.join(temp,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 }
 const {presets,graphSchema,graphLayout,renderGraph,shadingIssue,withDistribution,distributionPeakIndex,withConic,yAxisRange,defaultStyle}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const {movePoint,moveCurve,replaceCurve,createRectangleShading,adjustText,removeCurve}=await import(pathToFileURL(path.join(temp,'graph-edit.mjs')));
 const approx=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≈ ${b}`);
 const round=value=>Math.round(value*100)/100;
 const base=structuredClone(presets[0].graph);
 const simple={...base.curves[0],points:[{x:1,y:20},{x:2,y:80},{x:4,y:40}],yAxis:'right'};
 const input={...base,xMax:5,yMax:4,rightYAxis:{label:'상대 습도 (%)',min:0,max:100,ticks:[{value:0,label:'0'},{value:50,label:'50'},{value:100,label:'100'}]},curves:[base.curves[0],simple],guides:[{x1:0,y1:80,x2:2,y2:80},{x1:2,y1:0,x2:2,y2:80,yAxis:'right'},{x1:5,y1:80,x2:2,y2:80,yAxis:'right'}],labels:[{x:2,y:80,text:'left',dx:0,dy:0},{x:2,y:80,text:'right',dx:0,dy:0,yAxis:'right'}]};
 const graph=graphSchema.parse(input),layout=graphLayout(graph);
 assert.deepEqual(yAxisRange(graph),{min:0,max:4});
 assert.deepEqual(yAxisRange(graph,'right'),{min:0,max:100});
 assert.throws(()=>yAxisRange(base,'right'),/오른쪽/);
 approx(layout.YFor(50,'right'),layout.Y(2));
 approx(layout.YFor(0,'right'),layout.B);
 approx(layout.YFor(100,'right'),layout.T);
 approx(layout.dyFor('right')*25,layout.dy);
 for(const axis of ['left','right'])for(const [x,y] of [[0,0],[2,2],[3,80]]){
  const inverse=layout.worldFor(layout.X(x),layout.YFor(y,axis),axis);
  approx(inverse.x,x);approx(inverse.y,y);
 }
 assert.deepEqual(layout.world(layout.X(2),layout.Y(2)),layout.worldFor(layout.X(2),layout.Y(2),'left'));
 const svg=renderGraph(graph),pathFor=(svg,index)=>svg.match(new RegExp(`data-edit="curve:${index}" d="([^"]+)"`))?.[1];
 assert.ok(pathFor(svg,1).startsWith(`M${round(layout.X(1))},${round(layout.YFor(20,'right'))}`));
 assert.ok(svg.includes('data-edit="axis:right"'));
 assert.ok(svg.includes('data-edit="tick:right:0"'),'right axis includes its own zero tick');
 assert.ok(svg.includes('data-edit="tick:right:2"'));
 assert.ok(svg.includes(`x1="${round(layout.X(2))}" y1="${round(layout.YFor(0,'right'))}" x2="${round(layout.X(2))}" y2="${round(layout.YFor(80,'right'))}"`),'guide uses its assigned axis');
 assert.ok(svg.match(/data-edit="label:1"[^>]+/)[0].includes(`y="${round(layout.YFor(80,'right'))}"`));
 // Every previous single-axis graph retains the exact serialized drawing.
 for(const preset of presets.filter(p=>!p.graph.rightYAxis)){
  const single=graphSchema.parse(preset.graph);
  assert.equal(renderGraph({...single,rightYAxis:null}),renderGraph(single));
  assert.equal(renderGraph({...single,curves:single.curves.map(c=>({...c,yAxis:'left'})),labels:single.labels.map(l=>({...l,yAxis:'left'})),guides:single.guides.map(g=>({...g,yAxis:'left'}))}),renderGraph(single));
 }
 assert.ok(graphSchema.safeParse(presets.find(p=>p.id==='dual-axis').graph).success);
 assert.equal(graphSchema.safeParse({...input,rightYAxis:{...input.rightYAxis,max:0}}).success,false);
 assert.equal(graphSchema.safeParse({...input,equalAxes:true}).success,false);
 for(const key of ['curves','guides','labels','shadings']){
  const rightElement=key==='curves'?simple:key==='guides'?input.guides[1]:key==='labels'?input.labels[1]:{mode:'rectangle',curve:0,baseline:0,xStart:0,xEnd:1,yStart:1,yEnd:2,pattern:'solid',opacity:.15,yAxis:'right'};
  assert.equal(graphSchema.safeParse({...base,[key]:[rightElement]}).success,false,`${key} cannot use a missing right axis`);
 }
 const snapshot=structuredClone(graph);
 const moved=movePoint(graph,1,1,3,90,true);
 assert.deepEqual(moved.curves[1].points[1],{x:3,y:90});
 assert.deepEqual(moved.guides[0],graph.guides[0],'equal numeric coordinates on the left axis must not follow a right-axis point');
 assert.deepEqual(moved.labels[0],graph.labels[0]);
 assert.deepEqual(moved.guides[1],{x1:3,y1:0,x2:3,y2:90,yAxis:'right'});
 assert.deepEqual(moved.guides[2],{x1:5,y1:90,x2:3,y2:90,yAxis:'right'});
 assert.deepEqual(moved.labels[1],{...graph.labels[1],x:3,y:90});
 assert.deepEqual(movePoint(graph,1,1,2,500).curves[1].points[1],{x:2,y:100},'point clamp uses 100, not left maximum 4');
 assert.deepEqual(movePoint(graph,0,1,2,500).curves[0].points[1],{x:2,y:4});
 const shifted=moveCurve(graph,1,0,50,true);
 assert.deepEqual(shifted.curves[1].points.map(p=>p.y),[40,100,60]);
 assert.equal(shifted.labels[1].y,100);
 assert.deepEqual(graph,snapshot,'edits and rendering must remain immutable');
 const noFollow=replaceCurve(graph,1,{...simple,points:simple.points.map(p=>({...p,y:p.y/25})),yAxis:'left'},true);
 assert.deepEqual(noFollow.guides,graph.guides,'changing axis assignment must not pull unrelated anchors between coordinate systems');
 const normal=withDistribution(simple,{kind:'normal',origin:0,peak:2,sigma:.5,height:80,baseline:0,end:4});
 const normalGraph=graphSchema.parse({...graph,curves:[normal]});
 const normalMoved=movePoint(normalGraph,0,distributionPeakIndex(normal),2.5,95,true);
 assert.equal(normalMoved.curves[0].distribution.height,95);
 assert.equal(normalMoved.guides[1].y2,95);
 assert.ok(pathFor(renderGraph(normalMoved),0).includes(' C'),'normal model remains analytic on the right axis');
 const ellipse=withConic(simple,{kind:'ellipse',cx:2,cy:50,rx:1,ry:30});
 const conicGraph=graphSchema.parse({...graph,curves:[ellipse]});
 const resized=movePoint(conicGraph,0,4,2,95);
 assert.equal(resized.curves[0].conic.ry,45);
 assert.equal(moveCurve(conicGraph,0,0,50).curves[0].conic.cy,70);
 assert.equal(graphLayout(conicGraph).dyFor('right'),layout.dyFor('right'),'conic does not silently enable equal axis units for dual axes');
 const baseline={curve:1,mode:'baseline',baseline:20,xStart:1,xEnd:4,pattern:'solid',opacity:.15};
 assert.equal(shadingIssue(graph,baseline),'');
 const shaded=renderGraph({...graph,shadings:[baseline]});
 assert.ok(shaded.match(/data-shading="0" d="([^"]+)"/)[1].endsWith(`L${round(layout.X(4))},${round(layout.YFor(20,'right'))} L${round(layout.X(1))},${round(layout.YFor(20,'right'))} Z`));
 const rectangle=createRectangleShading(graph,{x:1,y:40},{x:3,y:80},'right');
 assert.equal(rectangle.yAxis,'right');
 assert.equal(shadingIssue(graph,rectangle),'');
 assert.match(shadingIssue(graph,{...rectangle,yStart:110,yEnd:120}),/축 범위/);
 const rectSvg=renderGraph({...graph,shadings:[rectangle]});
 assert.ok(rectSvg.match(/data-shading="0" d="([^"]+)"/)[1].startsWith(`M${round(layout.X(1))},${round(layout.YFor(40,'right'))}`));
 const cross={...baseline,mode:'between',otherCurve:0};
 assert.match(shadingIssue(graph,cross),/같은 세로축/);
 assert.equal(graphSchema.safeParse({...graph,shadings:[cross]}).success,false);
 const sameAxis={...graph,curves:[simple,{...simple,points:simple.points.map(p=>({...p,y:p.y-10}))}]};
 assert.equal(shadingIssue(sameAxis,{...baseline,curve:0,mode:'between',otherCurve:1}),'');
 const closed=graphSchema.parse({...conicGraph,shadings:[{...baseline,curve:0,mode:'closed'}]});
 assert.equal(shadingIssue(closed,closed.shadings[0]),'');
 assert.equal(renderGraph(closed).match(/data-shading="0" d="([^"]+)"/)[1],pathFor(renderGraph(closed),0)+' Z');
 const renamed=adjustText(graph,{kind:'axis',axis:'right'},'습도 (%)');
 assert.equal(renamed.rightYAxis.label,'습도 (%)');
 assert.equal(renamed.yLabel,graph.yLabel);
 const ticked=adjustText(graph,{kind:'tick',axis:'right',index:1},'H_0',60);
 assert.deepEqual(ticked.rightYAxis.ticks[1],{value:60,label:'H_0'});
 assert.deepEqual(ticked.yTicks,graph.yTicks);
 assert.throws(()=>adjustText(base,{kind:'axis',axis:'right'},'습도'),/오른쪽/);
 assert.equal(removeCurve({...graph,shadings:[rectangle]},1).shadings[0].yAxis,'right');
 // A nonzero right minimum must affect geometry, inverse edits, and clipping.
 const offset=graphSchema.parse({...graph,rightYAxis:{...graph.rightYAxis,min:200,max:300}}),ol=graphLayout(offset);
 approx(ol.YFor(250,'right'),ol.Y(2));
 approx(ol.worldFor(ol.X(2),ol.YFor(250,'right'),'right').y,250);
 assert.equal(movePoint(offset,1,1,2,0).curves[1].points[1].y,200);
 // Multi-line titles leave a separate row above the topmost tick.
 const multi=presets.find(p=>p.id==='dual-axis').graph,ml=graphLayout(multi),ms=renderGraph(multi);
 assert.ok(ml.T>graphLayout({...multi,rightYAxis:null,curves:[]}).T);
 const titleY=Number(ms.match(/data-edit="axis:right"[^>]* y="([^"]+)"/)[1]);
 const titleLastBaseline=titleY+(multi.rightYAxis.label.split('\n').length-1)*defaultStyle.fontSize*1.2;
 approx(titleLastBaseline,ml.T-25);
 assert.ok(titleLastBaseline<ml.T-defaultStyle.fontSize*.7);
 assert.ok(Number(ms.match(/data-edit="axis:right"[^>]* x="([^"]+)"/)[1])<defaultStyle.width-80,'normal Korean titles have room before the image border');
 assert.equal(multi.xLabel,'시간 (\\mathrm{h})');
 assert.equal(multi.rightYAxis.label,'상대 습도\n(\\%)');
 for(const style of [defaultStyle,{...defaultStyle,fontSize:32},{...defaultStyle,width:420,height:290,fontSize:18}]){
  const bottomLayout=graphLayout(multi,style),bottomSvg=renderGraph(multi,style);
  const xTitle=Number(bottomSvg.match(/data-edit="axis:x"[^>]* y="([^"]+)"/)[1]);
  const lastXTick=Number(bottomSvg.match(/data-edit="tick:x:4"[^>]* y="([^"]+)"/)[1]);
  assert.ok(xTitle-lastXTick>=style.fontSize*1.49,'x-axis name has a separate row below endpoint ticks');
  assert.ok(xTitle+style.fontSize*.35<style.height,'x-axis name stays inside the exported image, including thumbnails');
  const rightZeroX=Number(bottomSvg.match(/data-edit="tick:right:0"[^>]* x="([^"]+)"/)[1]);
  assert.ok(rightZeroX>=bottomLayout.R+31.99,'right zero label clears the horizontal axis arrowhead');
 }
 // Dual axes stay on opposite borders even when x=0 is inside or beyond
 // the plot. The numeric origin must remain at its real x location.
 for(const [xMin,xMax] of [[-5,-1],[-5,0],[-5,5],[1,5]]){
  const varied=graphSchema.parse({...graph,xMin,xMax,yMin:-10,yMax:10,xTicks:[{value:xMin,label:String(xMin)},{value:0,label:'0'},{value:xMax,label:String(xMax)}],yTicks:[{value:-10,label:'-10'},{value:0,label:'0'},{value:10,label:'10'}],rightYAxis:{label:'습도',min:200,max:300,ticks:[{value:200,label:'200'},{value:250,label:'250'},{value:300,label:'300'}]}});
  const vl=graphLayout(varied),vs=renderGraph(varied);
  assert.equal(vl.ox,vl.L,'left axis must not overlap the right axis in a negative x domain');
  assert.ok(vs.includes(`x1="${round(vl.L)}" y1="${round(vl.B)}" x2="${round(vl.L)}" y2="${round(vl.T-22)}"`));
  assert.ok(vs.includes(`x1="${round(vl.R)}" y1="${round(vl.B)}" x2="${round(vl.R)}" y2="${round(vl.T-22)}"`));
  assert.ok(vs.includes('data-edit="tick:x:0"'),'nonzero leftmost tick stays visible');
  assert.ok(vs.includes('data-edit="tick:y:1"'),'left y=0 gets its own tick when the numerical origin is elsewhere');
  if(xMax>=0&&xMin<=0)assert.ok(vs.includes(`data-label="0" x="${round(vl.X(0)-15)}" y="${round(vl.oy+27)}"`),'origin label belongs at x=0, not the relocated left axis');
 }
 const projected=graphSchema.parse({...graph,yMin:-10,yMax:10,rightYAxis:{...graph.rightYAxis,min:200,max:300},curves:[{...simple,points:[{x:1,y:250},{x:2,y:280},{x:4,y:260}]}],guides:[{x1:2,y1:250,x2:2,y2:280,yAxis:'right'},{x1:5,y1:280,x2:2,y2:280,yAxis:'right'}],labels:[{x:2,y:280,text:'P',dx:0,dy:-10,yAxis:'right'}]});
 const projectionMoved=movePoint(projected,0,1,3,290,true),pl=graphLayout(projectionMoved);
 assert.deepEqual(projectionMoved.guides[0],{x1:3,y1:250,x2:3,y2:290,yAxis:'right'});
 assert.deepEqual(projectionMoved.guides[1],{x1:5,y1:290,x2:3,y2:290,yAxis:'right'});
 approx(pl.YFor(projectionMoved.guides[0].y1,'right'),pl.oy);
 const offsetShade={...baseline,curve:0,baseline:250};
 const offsetSvg=renderGraph({...projectionMoved,shadings:[offsetShade]});
 assert.ok(offsetSvg.match(/data-shading="0" d="([^"]+)"/)[1].endsWith(`L${round(pl.X(4))},${round(pl.oy)} L${round(pl.X(1))},${round(pl.oy)} Z`));
 const shadeClip=offsetSvg.match(/id="plot-shade-clip-0"><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/).slice(1).map(Number);
 assert.deepEqual(shadeClip,[pl.X(1),pl.T,pl.X(4)-pl.X(1),pl.B-pl.T],'shading clips to the shared plot, including below the left zero axis');
 const punctuation=renderGraph({...base,xLabel:"P'",yLabel:'x&y',labels:[{x:1,y:1,text:'x < y > 0; \"A\"',dx:0,dy:0}]});
 assert.ok(!/&(?!(?:amp|apos|quot|lt|gt);|#(?:[0-9]+|x[0-9a-fA-F]+);)/.test(punctuation),'every ampersand must remain a complete XML entity');
 assert.ok(!punctuation.includes('&<tspan'),'letter styling must not split escaped punctuation into malformed XML');
 assert.ok(punctuation.includes('</tspan>&apos;'),'prime punctuation stays escaped inside the graph text');
 assert.ok(punctuation.includes('</tspan>&amp;<tspan'),'ampersand between symbols stays a complete entity');
 assert.ok(punctuation.includes('&lt;')&&punctuation.includes('&gt;')&&punctuation.includes('&quot;'));
 console.log('PASS: independent right-axis ranges, inverse transforms, analytic models, linked anchors, clamping, labels and ticks, shading coordinate systems, validation and single-axis compatibility');
}finally{await rm(temp,{recursive:true,force:true});}
