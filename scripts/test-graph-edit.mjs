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
 const {presets,graphSchema,renderGraph,graphLayout,parseCoordinates,smoothConnectionIssue,pointOnCurve,nearestCurvePosition,shadingIssue}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const {movePoint,moveCurve,moveLabel,adjustText,insertCurvePoint,removeCurve}=await import(pathToFileURL(path.join(temp,'graph-edit.mjs')));
 assert.deepEqual(parseCoordinates('(1e-7, -2.5E+2), (+.5, 3.)',true),[{x:1e-7,y:-250},{x:.5,y:3}]);
 assert.deepEqual(parseCoordinates('x축 시간, (0,0), (2,3), 부드러운 곡선'),[{x:0,y:0},{x:2,y:3}],'natural coordinate prompts remain permissive by default');
 assert.throws(()=>parseCoordinates('(0,0), (2,3), (4,',true),/좌표 형식/);
 assert.throws(()=>parseCoordinates('(0,0), (2,3) 잘못된 입력',true),/좌표 형식/);
 assert.throws(()=>parseCoordinates('(0,0), (1e309,3)',true),/좌표는/);
 assert.throws(()=>parseCoordinates('(0,0)',true),/두 개/);
 assert.throws(()=>parseCoordinates(Array.from({length:501},(_,x)=>`(${x},0)`).join(', '),true),/500개/);
 const base=structuredClone(presets[0].graph);
 const original=structuredClone(base);
 // Changing connection mode changes only the rendered connection, not the
 // observations, symbols, or the point order used for scientific paths.
 const connectionPoints=[{x:0,y:0},{x:2,y:3},{x:4,y:1}];
 const connection={...base,curves:[{...base.curves[0],points:connectionPoints,smooth:false}]};
 const connectionOriginal=structuredClone(connection);
 const curvePath=g=>renderGraph(g).match(/data-edit="curve:0" d="([^"]+)"/)?.[1];
 const straightPath=curvePath(connection);
 const smoothed={...connection,curves:connection.curves.map(c=>({...c,smooth:true}))};
 const smoothPath=curvePath(smoothed);
 assert.equal(smoothConnectionIssue(connectionPoints),'');
 assert.ok(straightPath.includes('L')&&!straightPath.includes('C'));
 assert.ok(smoothPath.includes('C')&&!smoothPath.includes('L'));
 assert.deepEqual(smoothed.curves[0].points,connectionOriginal.curves[0].points);
 assert.deepEqual(connection,connectionOriginal,'connection rendering must not mutate source data');
 assert.equal(curvePath({...smoothed,curves:smoothed.curves.map(c=>({...c,smooth:false}))}),straightPath,'switching back must restore the same straight path');
 const curveArrows=g=>{
  const group=renderGraph(g).match(/<g clip-path="[^"]+"><path data-edit="curve:0"[\s\S]*?<\/g>/)?.[0]||'';
  return [...group.matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map(m=>m.slice(1).map(Number));
 };
 const arrowed={...smoothed,curves:smoothed.curves.map(c=>({...c,arrows:true}))};
 const smoothArrows=curveArrows(arrowed);
 const straightArrows=curveArrows({...arrowed,curves:arrowed.curves.map(c=>({...c,smooth:false}))});
 assert.equal(smoothArrows.length,connectionPoints.length-1);
 assert.notEqual(smoothArrows[0][1],straightArrows[0][1],'smooth direction arrows must follow the curved segment, not its chord');
 const commands=curvePath(arrowed).match(/[MC][^MC]*/g);
 let previous=commands[0].slice(1).split(',').map(Number);
 for(const [index,command] of commands.slice(1).entries()){
  const [cx1,cy1,cx2,cy2,x,y]=command.slice(1).trim().split(/[ ,]+/).map(Number);
  const at=t=>{const u=1-t;return [
   u**3*previous[0]+3*u*u*t*cx1+3*u*t*t*cx2+t**3*x,
   u**3*previous[1]+3*u*u*t*cy1+3*u*t*t*cy2+t**3*y,
  ];};
  const expected=[...at(.48),...at(.56)],actual=smoothArrows[index];
  expected.forEach((value,j)=>assert.ok(Math.abs(actual[j]-value)<.02,'arrow endpoints must lie on the rendered cubic'));
  assert.ok(actual[0]>=previous[0]&&actual[2]<=x,'smooth arrows stay inside the segment');
  previous=[x,y];
 }
 for(const points of [[],connectionPoints.slice(0,1),connectionPoints.slice(0,2)])assert.match(smoothConnectionIssue(points),/3개/);
 for(const points of [
  [{x:0,y:0},{x:0,y:2},{x:1,y:3}],
  [...connectionPoints].reverse(),
  [...connectionPoints,connectionPoints[0]],
 ]){
  const snapshot=structuredClone(points);
  assert.match(smoothConnectionIssue(points),/왼쪽부터/);
  assert.deepEqual(points,snapshot,'eligibility must not reorder a path');
  const fallback={...connection,curves:[{...connection.curves[0],points,smooth:true}]};
  assert.equal(curvePath(fallback),curvePath({...fallback,curves:[{...fallback.curves[0],smooth:false}]}),'unsupported paths retain their original straight connections');
 }
 for(const value of [NaN,Infinity,-Infinity]){
  assert.match(smoothConnectionIssue([{x:0,y:0},{x:1,y:value},{x:2,y:0}]),/숫자/);
  assert.match(smoothConnectionIssue([{x:0,y:0},{x:value,y:1},{x:2,y:0}]),/숫자/);
 }
 // Intermediate points come from the rendered geometry, including curved,
 // vertical and closing segments. Existing observations retain their order.
 const straightInsert=insertCurvePoint(connection,0,0,.5);
 assert.equal(straightInsert.index,1);
 assert.deepEqual(straightInsert.graph.curves[0].points,[{x:0,y:0},{x:1,y:1.5},{x:2,y:3},{x:4,y:1}]);
 assert.deepEqual(connection,connectionOriginal);
 const onCubic=pointOnCurve(smoothed.curves[0],0,.5);
 assert.deepEqual(onCubic,{x:1,y:1.875});
 const smoothInsert=insertCurvePoint(smoothed,0,0,.5);
 assert.deepEqual(smoothInsert.graph.curves[0].points[1],onCubic,'inserted points must lie on the old cubic, not its chord');
 assert.deepEqual(smoothInsert.graph.curves[0].points.filter((_,i)=>i!==1),smoothed.curves[0].points);
 assert.equal(smoothInsert.graph.curves[0].smooth,true);
 const straightNearest=nearestCurvePosition(connection.curves[0],{x:1,y:2},10,100);
 const expectedT=(1*10*20+2*100*300)/(20**2+300**2);
 assert.ok(Math.abs(straightNearest.t-expectedT)<1e-12,'nearest-point projection must use screen proportions');
 for(const t of [.00001,.002,.4,.5,.998,.99999]){
  const point=pointOnCurve(smoothed.curves[0],0,t);
  const nearest=nearestCurvePosition(smoothed.curves[0],point,170,240);
  assert.equal(nearest.segment,0);
  assert.ok(Math.abs(nearest.t-t)<1e-8,'nearest cubic projection must find interior minima next to endpoints');
  assert.ok(nearest.distance<1e-6);
 }
 // Compare several off-curve projections against a dense brute-force oracle.
 for(const point of [{x:-.2,y:.1},{x:.08,y:.4},{x:1.2,y:2.9},{x:2.4,y:1.5},{x:3.98,y:.99}]){
  const nearest=nearestCurvePosition(smoothed.curves[0],point,121,79);
  let sampled=Infinity;
  for(let segment=0;segment<2;segment++)for(let i=0;i<=1500;i++){
   const p=pointOnCurve(smoothed.curves[0],segment,i/1500);
   sampled=Math.min(sampled,Math.hypot((p.x-point.x)*121,(p.y-point.y)*79));
  }
  assert.ok(nearest.distance<=sampled+1e-6,'nearest cubic candidate must be at least as close as dense samples');
 }
 for(const t of [0,1,.00001,.99999,NaN,Infinity])assert.throws(()=>insertCurvePoint(connection,0,0,t));
 assert.throws(()=>insertCurvePoint(connection,0,99,.5));
 assert.throws(()=>insertCurvePoint(connection,99,0,.5));
 const singleton={...base,curves:[{...base.curves[0],points:[{x:0,y:0}]}]};
 assert.throws(()=>insertCurvePoint(singleton,0,0,.5),/두 개/);
 assert.throws(()=>nearestCurvePosition(singleton.curves[0],{x:0,y:0},1,1),/두 개/);
 assert.throws(()=>nearestCurvePosition(smoothed.curves[0],{x:0,y:0},0,1));
 const fullCurve={...base,curves:[{...base.curves[0],points:Array.from({length:500},(_,x)=>({x,y:0}))}]};
 assert.throws(()=>insertCurvePoint(fullCurve,0,0,.5),/500개/);
 assert.equal(insertCurvePoint({...fullCurve,curves:[{...fullCurve.curves[0],points:fullCurve.curves[0].points.slice(0,499)}]},0,0,.5).graph.curves[0].points.length,500);
 assert.throws(()=>insertCurvePoint({...base,curves:[{...base.curves[0],points:[{x:1,y:1},{x:1,y:1}]}]},0,0,.5),/이미 점/);

 const shade={curve:0,mode:'baseline',baseline:0,xStart:.5,xEnd:3.5,pattern:'solid',opacity:.2};
 const shaded={...smoothed,shadings:[shade]};
 const shadedOriginal=structuredClone(shaded),shadeSvg=renderGraph(shaded,undefined,'shade-test');
 const shadePath=shadeSvg.match(/data-shading="0" d="([^"]+)"/)?.[1];
 assert.equal(shadingIssue(shaded,shade),'');
 assert.ok(shadePath.startsWith(curvePath(smoothed)),'shade must share the exact rendered cubic boundary');
 assert.ok(shadePath.endsWith(' Z'));
 assert.ok(shadeSvg.indexOf('data-shading="0"')<shadeSvg.indexOf('stroke-dasharray="5 4"'),'shades go behind guide lines');
 const layout=graphLayout(shaded);
 const clip=shadeSvg.match(/id="shade-test-shade-clip-0"><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/).slice(1).map(Number);
 assert.deepEqual(clip,[layout.X(.5),layout.T,layout.X(3.5)-layout.X(.5),layout.B-layout.T],'clip must combine requested x interval and exact plotting rectangle');
 const hatched={...shaded,shadings:[{...shade,pattern:'hatch'},{...shade,pattern:'hatch',baseline:1}]};
 const hatchSvg=renderGraph(hatched,undefined,'preview-one'),otherHatchSvg=renderGraph(hatched,undefined,'preview-two');
 for(const i of [0,1]){
  assert.ok(hatchSvg.includes(`id="preview-one-shade-hatch-${i}"`));
  assert.ok(hatchSvg.includes(`fill="url(#preview-one-shade-hatch-${i})"`));
 }
 assert.ok(!otherHatchSvg.includes('preview-one-shade'),'hatch IDs must be scoped to the rendered graph');
 assert.equal((hatchSvg.match(/<pattern /g)||[]).length,2);
 const between={...shaded,curves:[smoothed.curves[0],{...smoothed.curves[0],points:[{x:1,y:3},{x:2,y:0},{x:5,y:3}]}],shadings:[{...shade,mode:'between',otherCurve:1,xStart:-1,xEnd:6}]};
 const betweenSvg=renderGraph(between,undefined,'between-test'),betweenD=betweenSvg.match(/data-shading="0" d="([^"]+)"/)?.[1];
 assert.equal(shadingIssue(between,between.shadings[0]),'');
 assert.equal((betweenD.match(/ C/g)||[]).length,4,'both forward and reversed smooth boundaries must retain cubic segments');
 assert.ok(betweenSvg.includes('fill-rule="evenodd"'),'crossing curves must shade alternating interiors');
 const betweenClip=betweenSvg.match(/id="between-test-shade-clip-0"><rect x="([^"]+)" y="[^"]+" width="([^"]+)"/).slice(1).map(Number);
 assert.deepEqual(betweenClip,[layout.X(1),layout.X(4)-layout.X(1)],'between mode uses only the common domain of the two curves');
 const invalidShades=[{...shade,curve:11},{...shade,xStart:4,xEnd:2},{...shade,xStart:6,xEnd:7},{...shade,mode:'between'},{...shade,mode:'between',otherCurve:0},{...shade,mode:'closed'},{...shade,opacity:NaN}];
 for(const invalid of invalidShades){
  assert.ok(shadingIssue(shaded,invalid));
  assert.ok(!renderGraph({...shaded,shadings:[invalid]}).includes('data-shading='),'invalid shades must safely skip rendering');
 }
 assert.ok(shadingIssue(singleton,shade));
 assert.equal(graphSchema.safeParse({...shaded,shadings:Array(21).fill(shade)}).success,false);
 assert.equal(graphSchema.safeParse(shaded).success,true);
 assert.equal(graphSchema.safeParse(base).success,true,'existing graphs without shadings remain compatible');
 assert.deepEqual(shaded,shadedOriginal,'shading validation and rendering must not mutate the graph');
 const removeFixture={...between,curves:[...between.curves,connection.curves[0]],shadings:[shade,{...shade,curve:2},{...shade,curve:1,mode:'between',otherCurve:2},{...shade,mode:'between',otherCurve:2}]};
 const removeOriginal=structuredClone(removeFixture),removed=removeCurve(removeFixture,0);
 assert.equal(removed.curves.length,2);
 assert.deepEqual(removed.shadings,[{...shade,curve:1},{...shade,curve:0,mode:'between',otherCurve:1}],'deleting a curve removes dependent shades and reindexes retained references');
 assert.deepEqual(removeFixture,removeOriginal);
 assert.throws(()=>removeCurve(removeFixture,99));
 assert.equal(removeCurve(base,0).shadings,undefined);
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
 const verticalInsert=insertCurvePoint(pv,0,0,.5);
 assert.deepEqual(verticalInsert.graph.curves[0].points[1],{x:1,y:1.5});
 const closingInsert=insertCurvePoint(pv,0,3,.5);
 assert.deepEqual(closingInsert.graph.curves[0].points[4],{x:1.5,y:1});
 assert.deepEqual(closingInsert.graph.curves[0].points[0],closingInsert.graph.curves[0].points.at(-1));
 const closedShade={...shade,mode:'closed',xStart:2,xEnd:1};
 const closedGraph={...pv,shadings:[closedShade]};
 assert.equal(shadingIssue(closedGraph,closedShade),'','closed shade ignores the x interval');
 assert.ok(shadingIssue(pv,shade),'vertical and closed paths cannot use baseline interval shading');
 const closedSvg=renderGraph(closedGraph);
 assert.ok(closedSvg.includes(`data-shading="0" d="${curvePath(pv)} Z"`));
 const movedShade=moveCurve(shaded,0,.3,.2);
 assert.deepEqual(movedShade.shadings,shaded.shadings);
 assert.notEqual(renderGraph(movedShade).match(/data-shading="0" d="([^"]+)"/)?.[1],shadePath,'shade geometry follows its referenced curve');

 const pvLayout=graphLayout(pv),pvPoints=pv.curves[0].points.map(p=>[pvLayout.X(p.x),pvLayout.Y(p.y)]);
 assert.deepEqual(curveArrows(pv),pvPoints.slice(1).map(([x,y],i)=>{
  const [previousX,previousY]=pvPoints[i];
  return [previousX+(x-previousX)*.48,previousY+(y-previousY)*.48,previousX+(x-previousX)*.56,previousY+(y-previousY)*.56].map(v=>Math.round(v*100)/100);
 }),'straight closed-path arrows must retain their exact coordinates');
 for(const index of [0,pv.curves[0].points.length-1]){
  const next=movePoint(pv,0,index,1.2,1.3);
  assert.deepEqual(next.curves[0].points[0],{x:1.2,y:1.3});
  assert.deepEqual(next.curves[0].points.at(-1),{x:1.2,y:1.3});
 }
 assert.deepEqual(pv,pvOriginal);

 const distribution=structuredClone(presets.find(p=>p.id==='distribution').graph);
 const distributionOriginal=structuredClone(distribution);
 const ordered=curve=>curve.points.every((p,i)=>i===0||p.x>curve.points[i-1].x);
 function smoothPathsStayWithinKnots(graph){
  const svg=renderGraph(graph);
  for(const [ci,curve] of graph.curves.entries()){
   const d=svg.match(new RegExp(`data-edit="curve:${ci}" d="([^"]+)"`))?.[1];
   assert.ok(d&&!d.includes('L'),'smooth ordered curves must export as cubic paths');
   const commands=d.match(/[MC][^MC]*/g);
   assert.equal(commands.length,curve.points.length);
   let previous=commands[0].slice(1).split(',').map(Number);
   for(const command of commands.slice(1)){
    const [cx1,cy1,cx2,cy2,x,y]=command.slice(1).trim().split(/[ ,]+/).map(Number);
    for(let i=0;i<=20;i++){
     const t=i/20,u=1-t;
     const xx=u**3*previous[0]+3*u*u*t*cx1+3*u*t*t*cx2+t**3*x;
     const yy=u**3*previous[1]+3*u*u*t*cy1+3*u*t*t*cy2+t**3*y;
     assert.ok(Number.isFinite(xx)&&Number.isFinite(yy));
     // SVG coordinates are rounded to 0.01 px by the renderer.
     assert.ok(xx>=previous[0]-.02&&xx<=x+.02,'cubic x must stay ordered');
     assert.ok(yy>=Math.min(previous[1],y)-.02&&yy<=Math.max(previous[1],y)+.02,'cubic must not overshoot adjacent y values');
    }
    previous=[x,y];
   }
  }
 }
 for(const [ci,curve] of distribution.curves.entries()){
  assert.ok(curve.smooth&&curve.points.length<=16,'distribution should expose sparse smooth control knots');
  assert.ok(ordered(curve));
  for(const [index,p] of curve.points.entries()){
   assert.deepEqual(movePoint(distribution,ci,index,p.x,p.y),distribution,'no-op must preserve exact control coordinates');
   for(const x of [-1e6,1e6]){
    const next=movePoint(distribution,ci,index,x,p.y);
    assert.ok(ordered(next.curves[ci]),'dragging past a neighbor must not cross it');
    assert.equal(next.curves[ci].points.length,curve.points.length,'editing must retain stable knot indices');
    assert.ok(next.curves[ci].points[index].x>=next.xMin&&next.curves[ci].points[index].x<=next.xMax);
    smoothPathsStayWithinKnots(next);
   }
  }
 }
 let repeated=distribution;
 for(let i=0;i<80;i++){
  const index=i%repeated.curves[0].points.length;
  repeated=movePoint(repeated,0,index,i%2?1e6:-1e6,i%3?1e6:-1e6);
  assert.ok(repeated.curves.every(ordered),'repeated edits must preserve x order');
 }
 smoothPathsStayWithinKnots(repeated);
 assert.deepEqual(distribution,distributionOriginal,'smooth edits must not mutate source knots');

 for(const [offset,scale] of [[0,1e-8],[999999,1e-8]]){
  const tiny={...distribution,xMin:offset+distribution.xMin*scale,xMax:offset+distribution.xMax*scale,yMin:0,yMax:1e-7,
   curves:distribution.curves.map(c=>({...c,points:c.points.map(p=>({x:offset+p.x*scale,y:p.y*1e-8}))}))};
  const p=tiny.curves[0].points[2];
  assert.deepEqual(movePoint(tiny,0,2,p.x,p.y),tiny,'small or translated no-op must preserve coordinates');
  const next=movePoint(tiny,0,2,tiny.xMax,5.1e-8);
  assert.ok(ordered(next.curves[0]),'spacing must scale with tiny coordinate ranges');
  assert.equal(next.curves[0].points[2].y,5.1e-8);
  smoothPathsStayWithinKnots(next);
 }
 const tight={...distribution,curves:[{...distribution.curves[0],points:[{x:0,y:0},{x:.001,y:.2},{x:.002,y:.5},{x:1,y:0}]}]};
 assert.deepEqual(movePoint(tight,0,1,.001,.2),tight,'do not expand existing tight spacing');
 assert.equal(movePoint(tight,0,1,1,.3).curves[0].points[1].x,.001,'tight knots must not become even closer');
 const smoothPv={...pv,curves:pv.curves.map(c=>({...c,smooth:true}))};
 assert.deepEqual(movePoint(smoothPv,0,0,1.2,1.3).curves[0].points,movePoint(pv,0,0,1.2,1.3).curves[0].points,'unordered smooth closed curves retain normal point editing');
 const backwardsSmooth={...tight,curves:[{...tight.curves[0],points:[{x:1,y:0},{x:.5,y:1},{x:0,y:0}]}]};
 assert.deepEqual(movePoint(backwardsSmooth,0,1,2,.8).curves[0].points[1],{x:2,y:.8},'nonordered smooth curves retain normal point editing');

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
 console.log('PASS: shading boundaries and clipping, immutable insertion and nearest cubic points, curve deletion references, connection mode eligibility and reversible SVG paths, bounds, smooth knot spacing and cubic export, repeated and tiny-range edits, closed loops, optional follow, text validation, immutable edits');
}finally{await rm(temp,{recursive:true,force:true});}
