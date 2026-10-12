import {compileTestModules} from './test-module-loader.mjs';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
await mkdir('outputs',{recursive:true});
const temp=await mkdtemp(path.join(process.cwd(),'outputs','axis-scales-test-'));
try{
 await compileTestModules(temp,['graph','axis-scale']);
 const {graphSchema,graphLayout,renderGraph,presets,xAxisRange,nearestMappedCurvePosition,pointOnCurve}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const {createAxisScale}=await import(pathToFileURL(path.join(temp,'axis-scale.mjs')));
 const approx=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} ≈ ${b}`);
 const base={...presets[0].graph,curves:[],guides:[],labels:[],shadings:[]};
 const curve={name:'test',points:[{x:1,y:1},{x:10,y:80},{x:100,y:20}],dashed:false,smooth:true,arrows:true,dots:false};
 // Mapping round-trips all four axis directions and logarithmic decades.
 for(const kind of ['linear','log'])for(const reversed of [false,true])for(const broken of [false,true]){
  const axis={min:1,max:1000,scale:kind,reversed,...(broken?{break:{from:20,to:200}}:{})};
  const map=createAxisScale(axis,110,660);
  for(const value of [1,2,10,20,200,500,1000])approx(map.inverse(map.forward(value)),value);
  assert.equal(map.contains(100),!broken);
  assert.equal(map.pixelIntervals.length,broken?2:1);
  if(broken){const p=map.gapPixels;assert.ok(Math.abs(p[1]-p[0]-14)<1e-8);assert.ok([20,200].some(v=>Math.abs(map.inverse((p[0]+p[1])/2)-v)<1e-8));}
  assert.equal(Math.sign(map.forward(1000)-map.forward(1)),reversed?-1:1);
 }
 const log=graphSchema.parse({...base,xMin:1,xMax:100,yMin:1,yMax:100,xScale:'log',yScale:'log',xTicks:[1,10,100].map(value=>({value,label:String(value)})),yTicks:[1,10,100].map(value=>({value,label:String(value)})),curves:[curve]});
 const ll=graphLayout(log);
 approx(ll.X(10),(ll.L+ll.R)/2);approx(ll.Y(10),(ll.T+ll.B)/2);
 for(const x of [1,4,10,70,100])for(const y of [1,4,10,70,100]){
  const inv=ll.worldFor(ll.X(x),ll.Y(y));approx(inv.x,x);approx(inv.y,y);
 }
 const svg=renderGraph(log),d=svg.match(/data-edit="curve:0" d="([^"]+)"/)[1];
 assert.ok(!/NaN|Infinity/.test(svg));assert.ok(!d.includes(' C'),'nonlinear projections cannot merely transform cubic controls');
 const vertices=[...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m=>({x:+m[1],y:+m[2]}));
 assert.ok(vertices.length>15);
 // True midcurve location must be visually close to its emitted polyline.
 const p=pointOnCurve(curve,0,.43),target={x:ll.X(p.x),y:ll.Y(p.y)};
 const distanceToSegment=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
 assert.ok(Math.min(...vertices.slice(1).map((v,i)=>distanceToSegment(target,vertices[i],v)))<.2);
 const nearest=nearestMappedCurvePosition(curve,target,ll.X,ll.Y);approx(nearest.t,.43,1e-6);assert.ok(nearest.distance<.001);
 // Insertion must refine one-sided brackets next to both segment endpoints.
 const endpointCurve={...curve,smooth:false,points:[{x:1,y:1},{x:1000,y:4}]};
 const endpointLayout=graphLayout({...log,xMax:1000,curves:[endpointCurve]});
 for(const t of [.00001,.002,.005,.994,.998,.99999]){
  const p=pointOnCurve(endpointCurve,0,t),pixel={x:endpointLayout.X(p.x),y:endpointLayout.Y(p.y)};
  const closest=nearestMappedCurvePosition(endpointCurve,pixel,endpointLayout.X,endpointLayout.Y);
  approx(closest.t,t,1e-8);assert.ok(closest.distance<1e-4);
 }
 const reversed=graphSchema.parse({...log,xReversed:true,yReversed:true});
 const rl=graphLayout(reversed);approx(rl.X(1),rl.R);approx(rl.Y(1),rl.T);approx(rl.oy,rl.B);
 const top=graphSchema.parse({...base,xMax:5,yMax:10,xTicks:[],yTicks:[],topXAxis:{label:'온도',min:100,max:1000,scale:'log',reversed:true,ticks:[{value:100,label:'100'},{value:1000,label:'1000'}]},rightYAxis:{label:'깊이',min:1,max:100,scale:'log',reversed:true,ticks:[]},curves:[{...curve,xAxis:'top',yAxis:'right',points:[{x:100,y:1},{x:300,y:10},{x:1000,y:100}]}]});
 const tl=graphLayout(top);assert.deepEqual(xAxisRange(top,'top'),{min:100,max:1000});
 const inverse=tl.worldFor(tl.XFor(300,'top'),tl.YFor(10,'right'),'right','top');approx(inverse.x,300);approx(inverse.y,10);
 const topSvg=renderGraph(top);assert.ok(topSvg.includes('data-edit="axis:top"'));assert.ok(topSvg.includes('data-edit="tick:top:0"'));assert.ok(!/NaN|Infinity/.test(topSvg));
 const broken=graphSchema.parse({...log,xBreak:{from:3,to:6},yBreak:{from:20,to:50},shadings:[{curve:0,mode:'baseline',baseline:1,xStart:1,xEnd:100,pattern:'solid',opacity:.15}],guides:[{x1:1,y1:10,x2:100,y2:10}]});
 const brokenSvg=renderGraph(broken);assert.ok(brokenSvg.includes('data-axis-break="bottom"'));assert.ok(brokenSvg.includes('data-axis-break="left"'));
 const clip=brokenSvg.match(/id="plot-clip-bottom-left">([\s\S]*?)<\/clipPath>/)[1];assert.equal((clip.match(/<rect/g)||[]).length,4);
 const shadeclip=brokenSvg.match(/id="plot-shade-clip-0">([\s\S]*?)<\/clipPath>/)[1];assert.equal((shadeclip.match(/<rect/g)||[]).length,4);
 assert.ok(!/NaN|Infinity/.test(brokenSvg));
 const topOnly={...base,xAxisPosition:'top'};assert.equal(graphLayout(topOnly).oy,graphLayout(topOnly).T);
 // Reject invalid domain/data instead of exporting impossible logarithms.
 for(const bad of [{...log,xMin:0},{...log,yTicks:[{value:0,label:'0'}]},{...log,curves:[{...curve,points:[{x:0,y:1}]}]},{...log,xBreak:{from:1,to:6}},{...top,xAxisPosition:'top'},{...log,labels:[{x:2,y:0,text:'bad',dx:0,dy:0}]}])assert.equal(graphSchema.safeParse(bad).success,false);
 // Extremely small but valid linear ranges must remain finite on export.
 const tiny={...base,xMin:0,xMax:1e-307,yMin:0,yMax:1e-307,xTicks:[],yTicks:[],curves:[{...curve,points:[{x:0,y:0},{x:5e-308,y:9e-308},{x:1e-307,y:1e-307}]}]};
 assert.ok(!/NaN|Infinity/.test(renderGraph(tiny)));assert.ok(Number.isFinite(graphLayout(tiny).dx));
 for(const marker of ['circle','square','triangle','cross']){
  const scatter=graphSchema.parse({...base,xMax:5,yMax:10,xTicks:[],yTicks:[],curves:[{...curve,plot:'scatter',marker,points:[{x:1,y:2},{x:3,y:5}]}]});
  const output=renderGraph(scatter);assert.equal((output.match(new RegExp(`data-marker="${marker}"`,'g'))||[]).length,2);assert.ok(output.includes('data-edit="curve:0"'));assert.ok(!output.includes('stroke-linejoin="round"'),'scatter has no connecting stroke');
 }
 for(const plot of ['bar','histogram']){
  const bars=graphSchema.parse({...base,xMax:5,yMax:10,xTicks:[],yTicks:[],curves:[{...curve,plot,barWidth:1,barBaseline:1,points:[{x:1,y:4},{x:2,y:7}]}]});
  const output=renderGraph(bars),rects=[...output.matchAll(new RegExp(`<rect data-plot="${plot}" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"`,'g'))];assert.equal(rects.length,2);assert.ok(+rects[0][3]>0&&+rects[0][4]>0);
  approx(+rects[0][1]+ +rects[0][3],+rects[1][1],.001);
 }
 assert.equal(graphSchema.safeParse({...base,curves:[{...curve,plot:'scatter',conic:{kind:'circle',cx:2,cy:2,rx:1,ry:1}}]}).success,false);
 assert.equal(graphSchema.safeParse({...base,curves:[{...curve,plot:'bar',barWidth:0}]}).success,false);
 console.log('PASS: log/reversed/broken axes, all-axis inverse transforms, top/right independent mappings, adaptive nonlinear paths and nearest insertion, matching shade gaps, finite extreme ranges, scatter markers and contiguous histogram bars');
}finally{await rm(temp,{recursive:true,force:true});}
