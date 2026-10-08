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
 const {presets,graphSchema,renderGraph,graphLayout,parseCoordinates,smoothConnectionIssue,pointOnCurve,nearestCurvePosition,shadingIssue,defaultStyle,curveLineStyle,lineDashArray,distributionValue,withDistribution,freeDistribution,distributionPeakIndex,withConic,freeConic,conicHandleIndices}=await import(pathToFileURL(path.join(temp,'graph.mjs')));
 const {movePoint,moveCurve,moveLabel,adjustText,insertCurvePoint,removeCurve,createRectangleShading,updateDistribution,updateConic}=await import(pathToFileURL(path.join(temp,'graph-edit.mjs')));
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
 // Explicit patterns override legacy booleans, while older saved graphs and
 // presets retain the original 6/5 dashed stroke at the default line width.
 const mainStroke=svg=>svg.match(/<path data-edit="curve:0"[^>]+\/>/)?.[0];
 assert.equal(curveLineStyle({dashed:false}),'solid');
 assert.equal(curveLineStyle({dashed:true}),'dashed');
 assert.equal(lineDashArray('dashed',defaultStyle.lineWidth),'6 5');
 assert.equal(mainStroke(renderGraph(base)).includes('stroke-dasharray'),false);
 assert.ok(mainStroke(renderGraph({...base,curves:[{...base.curves[0],dashed:true}]})).includes('stroke-dasharray="6 5"'));
 const patterns={solid:undefined,dashed:'6 5',dotted:'0 6','dash-dot':'10 5 0 5','dash-dot-dot':'10 5 0 5 0 5'};
 for(const [lineStyle,pattern] of Object.entries(patterns)){
  assert.equal(lineDashArray(lineStyle,defaultStyle.lineWidth),pattern);
  for(const graph of [connection,smoothed])for(const width of [1,2.5,6]){
   const styled={...graph,curves:[{...graph.curves[0],lineStyle,dashed:lineStyle==='solid'}]};
   const snapshot=structuredClone(styled),svg=renderGraph(styled,{...defaultStyle,lineWidth:width}),stroke=mainStroke(svg);
   assert.equal(curveLineStyle(styled.curves[0]),lineStyle,'explicit patterns override a conflicting legacy dashed value');
   assert.equal(graphSchema.parse(styled).curves[0].lineStyle,lineStyle);
   assert.equal(stroke.match(/stroke-dasharray="([^"]+)"/)?.[1],lineDashArray(lineStyle,width));
   assert.ok(stroke.includes('stroke-linecap="round"'),'round caps make zero-length dash marks visible as dots');
   assert.equal(stroke.match(/ d="([^"]+)"/)?.[1],curvePath(graph),'line styles must preserve straight and smooth geometry');
   assert.ok(svg.includes('stroke-dasharray="5 4"'),'curve style changes must not change guide patterns');
   assert.deepEqual(styled,snapshot,'style resolution and rendering must not mutate the graph');
   if(pattern){
    const values=lineDashArray(lineStyle,width).split(' ').map(Number);
    assert.ok(values.every(Number.isFinite));
    assert.ok(values.every((value,i)=>i%2===0?value>=0:value>width),'round dots and adjacent dashes need visible gaps at every supported width');
   }
  }
 }
 for(const invalid of ['dash',null,7])assert.equal(graphSchema.safeParse({...base,curves:[{...base.curves[0],lineStyle:invalid}]}).success,false);
 assert.equal(graphSchema.parse(base).curves[0].lineStyle,undefined,'older graph documents remain valid without lineStyle');
 for(const width of [0,-1,NaN,Infinity])assert.equal(lineDashArray('dash-dot',width),patterns['dash-dot'],'invalid preview widths fall back to the standard width');
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
  assert.equal(smoothConnectionIssue(points),'');
  assert.deepEqual(points,snapshot,'eligibility must not reorder a path');
  const parametric={...connection,curves:[{...connection.curves[0],points,smooth:true}]};
  assert.ok(curvePath(parametric).includes(' C'),'vertical, reversed and closed curves use parametric interpolation');
  assert.ok(!curvePath(parametric).includes(' L'));
  assert.notEqual(curvePath(parametric),curvePath({...parametric,curves:[{...parametric.curves[0],smooth:false}]}));
 }
 assert.match(smoothConnectionIssue([{x:0,y:0},{x:0,y:0},{x:2,y:3}]),/연속/);
 assert.match(smoothConnectionIssue([{x:0,y:0},{x:1,y:2},{x:0,y:0}]),/서로 다른/);
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
 // Rectangles mark an independent part of the coordinate plane. They need no
 // curve and retain their own bounds as curves are edited or deleted.
 const emptyGraph={...base,xMin:-5,xMax:5,yMin:-4,yMax:4,curves:[]};
 const emptySnapshot=structuredClone(emptyGraph);
 const rectangle=createRectangleShading(emptyGraph,{x:3,y:2},{x:-2,y:-3});
 assert.deepEqual(rectangle,{mode:'rectangle',curve:0,baseline:0,xStart:-2,xEnd:3,yStart:-3,yEnd:2,pattern:'solid',opacity:.15});
 assert.deepEqual(emptyGraph,emptySnapshot,'creating a rectangle must not mutate the graph');
 assert.deepEqual(createRectangleShading(emptyGraph,{x:-2,y:2},{x:3,y:-3}),rectangle,'all drag directions normalize the same corners');
 const rectangleGraph={...emptyGraph,shadings:[rectangle]};
 assert.equal(graphSchema.safeParse(rectangleGraph).success,true,'rectangles are valid without a curve');
 assert.equal(shadingIssue(rectangleGraph,rectangle),'');
 const rectLayout=graphLayout(rectangleGraph),rectSvg=renderGraph(rectangleGraph,undefined,'rectangle-test');
 const rounded=value=>Math.round(value*100)/100;
 const rectCoordinates=[[-2,-3],[3,-3],[3,2],[-2,2]].map(([x,y])=>`${rounded(rectLayout.X(x))},${rounded(rectLayout.Y(y))}`);
 assert.ok(rectSvg.includes(`data-shading="0" d="M${rectCoordinates.join(' L')} Z" fill="#151515" fill-rule="evenodd" opacity="0.15"`),'SVG exports use the exact rectangle bounds');
 assert.ok(rectSvg.indexOf('data-shading="0"')<rectSvg.indexOf('stroke-dasharray="5 4"'),'rectangle shading stays behind guide lines');
 assert.ok(!rectSvg.includes('data-edit="curve:'),'independent shading does not create a hidden curve');
 const oversized={...rectangle,xStart:-10,xEnd:7,yStart:-9,yEnd:8,pattern:'hatch'};
 const oversizedSvg=renderGraph({...rectangleGraph,shadings:[oversized]},undefined,'rectangle-crop');
 const rectangleClip=oversizedSvg.match(/id="rectangle-crop-shade-clip-0"><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/).slice(1).map(Number);
 assert.deepEqual(rectangleClip,[rectLayout.L,rectLayout.T,rectLayout.R-rectLayout.L,rectLayout.B-rectLayout.T],'rectangles are clipped to the full axis viewport on both axes');
 assert.ok(oversizedSvg.includes('fill="url(#rectangle-crop-shade-hatch-0)"'),'independent rectangles support hatch fills');
 assert.deepEqual(createRectangleShading(emptyGraph,{x:-10,y:-9},{x:7,y:8}),{...oversized,pattern:'solid'},'partly visible rectangles keep their world bounds instead of changing with the viewport');
 const beyondCurve={...rectangle,xStart:4.2,xEnd:4.8,yStart:2.5,yEnd:3.5};
 assert.equal(shadingIssue({...emptyGraph,curves:base.curves},beyondCurve),'','rectangle bounds may extend beyond every curve');
 for(const invalid of [
  {...rectangle,yStart:undefined},{...rectangle,yEnd:undefined},{...rectangle,yStart:NaN},{...rectangle,yEnd:Infinity},
  {...rectangle,yStart:2,yEnd:2},{...rectangle,yStart:3,yEnd:2},{...rectangle,xStart:3,xEnd:3},{...rectangle,xStart:4,xEnd:3},
 ]){
  assert.equal(graphSchema.safeParse({...emptyGraph,shadings:[invalid]}).success,false,'malformed rectangle bounds must not enter saved graph documents');
  assert.ok(shadingIssue(emptyGraph,invalid));
  assert.ok(!renderGraph({...emptyGraph,shadings:[invalid]}).includes('data-shading='),'invalid rectangle rendering safely skips the shade');
 }
 for(const outside of [{...rectangle,xStart:5,xEnd:6},{...rectangle,xStart:-7,xEnd:-5},{...rectangle,yStart:4,yEnd:5},{...rectangle,yStart:-6,yEnd:-4}]){
  assert.match(shadingIssue(emptyGraph,outside),/축 범위와 겹쳐/,'touching the viewport boundary alone is not a visible rectangle');
  assert.ok(!renderGraph({...emptyGraph,shadings:[outside]}).includes('data-shading='));
 }
 for(const [a,b] of [[{x:1,y:1},{x:1,y:3}],[{x:1,y:1},{x:3,y:1}],[{x:NaN,y:1},{x:3,y:2}],[{x:0,y:0},{x:Infinity,y:2}],[{x:6,y:1},{x:8,y:3}],[{x:0,y:0},{x:1000001,y:3}]])assert.throws(()=>createRectangleShading(emptyGraph,a,b));
 assert.throws(()=>createRectangleShading({...emptyGraph,shadings:Array(20).fill(rectangle)},{x:0,y:0},{x:1,y:1}),/20개/);
 assert.deepEqual(removeCurve({...base,shadings:[rectangle,shade]},0).shadings,[rectangle],'deleting the last curve preserves independent rectangles');
 const indexedRectangle={...rectangle,curve:2,otherCurve:1};
 assert.deepEqual(removeCurve({...base,curves:[...base.curves,...base.curves,...base.curves],shadings:[indexedRectangle]},0).shadings,[indexedRectangle],'ignored rectangle curve placeholders must not be reindexed');
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

 // Formula conics keep circles circular at every canvas aspect ratio. Both
 // stroke and shading use the same tangent-matched analytic Bézier arcs.
 const circleModel={kind:'circle',cx:0,cy:0,rx:2,ry:2};
 const circleCurve=withConic({...base.curves[0],points:[{x:99,y:99}],lineStyle:'dash-dot'},circleModel);
 const circleGraph=graphSchema.parse({...base,xMin:-3,xMax:3,yMin:-3,yMax:3,curves:[circleCurve],guides:[],labels:[],shadings:[{...closedShade,opacity:.15}]});
 const circleSnapshot=structuredClone(circleGraph);
 assert.equal(circleCurve.points.length,17);
 assert.equal(circleCurve.smooth,true);
 assert.deepEqual(conicHandleIndices(circleCurve),[0,4,8,12]);
 assert.deepEqual(circleCurve.points.filter((_,i)=>[0,4,8,12].includes(i)),[{x:2,y:0},{x:0,y:2},{x:-2,y:0},{x:0,y:-2}]);
 assert.deepEqual(circleCurve.points.at(-1),circleCurve.points[0]);
 assert.equal(circleGraph.equalAxes,undefined,'axis policy remains optional in stored documents');
 assert.deepEqual(graphSchema.parse({...circleGraph,curves:[{...circleCurve,points:[{x:0,y:0}],smooth:false}]}),circleGraph,'conic parameters replace stale polygon samples');
 assert.deepEqual(graphSchema.parse(JSON.parse(JSON.stringify(circleGraph))),circleGraph);
 for(const patch of [{kind:'parabola'},{rx:0},{ry:-1},{rx:Infinity},{cx:NaN},{ry:3},{cx:999999},{cy:-999999},{cx:99999,rx:1e-20,ry:1e-20}]){
  assert.equal(graphSchema.safeParse({...circleGraph,curves:[{...circleCurve,conic:{...circleModel,...patch}}]}).success,false,'invalid conic metadata cannot be saved');
 }
 assert.equal(graphSchema.safeParse({...circleGraph,curves:[{...circleCurve,distribution:{kind:'gamma',origin:0,peak:1,height:1,power:3,baseline:0,end:3}}]}).success,false);
 assert.equal(graphSchema.parse({...base,curves:[{...base.curves[0],conic:null}]}).curves[0].conic,null);
 for(const equalAxes of [null,0,'true'])assert.equal(graphSchema.safeParse({...base,equalAxes}).success,false);
 const ellipseModel={kind:'ellipse',cx:1,cy:-.5,rx:2,ry:.7};
 for(const model of [circleModel,ellipseModel]){
  const c=withConic(circleCurve,model),graph={...circleGraph,curves:[c]};
  for(let segment=0;segment<16;segment++)for(const t of [0,.1,.25,.5,.75,.9,1]){
   const p=pointOnCurve(c,segment,t),radius=Math.hypot((p.x-model.cx)/model.rx,(p.y-model.cy)/model.ry);
   assert.ok(Math.abs(radius-1)<7e-8,'analytic arc radius agrees with the circle/ellipse equation between knots');
   const nearest=nearestCurvePosition(c,p,93,93);
   assert.ok(nearest.distance<1e-6,'hit testing uses the actual conic arc');
  }
  const svg=renderGraph(graph),stroke=curvePath(graph),fill=svg.match(/data-shading="0" d="([^"]+)"/)?.[1];
  assert.equal((stroke.match(/ C/g)||[]).length,16);
  assert.ok(!stroke.includes(' L'));
  assert.equal(fill,stroke+' Z','closed fill and conic stroke share exactly the same path');
  assert.ok(svg.includes('opacity="0.15"'));
  assert.ok(!/NaN|Infinity/.test(svg));
  assert.ok(mainStroke(svg).includes('stroke-dasharray="10 5 0 5"'));
  const annotated={...graph,curves:[{...c,dots:true,arrows:true}]};
  assert.equal((renderGraph(annotated).match(/<circle /g)||[]).length,4,'conic markers show cardinal handles instead of sample points');
  assert.equal(curveArrows(annotated).length,4);
 }
 for(const style of [defaultStyle,{...defaultStyle,width:1200,height:400},{...defaultStyle,width:400,height:900}]){
  const layout=graphLayout(circleGraph,style);
  assert.ok(Math.abs(layout.dx-layout.dy)<1e-12,'an x unit and a y unit must occupy equal screen lengths');
  assert.ok(Math.abs(layout.X(2)-layout.X(-2)-(layout.Y(-2)-layout.Y(2)))<1e-10,'circle diameter stays equal on both axes');
  assert.ok(layout.L>=0&&layout.R<=style.width&&layout.T>=0&&layout.B<=style.height);
  for(const p of [{x:-3,y:3},{x:2,y:-1},{x:0,y:0}]){
   const inverse=layout.world(layout.X(p.x),layout.Y(p.y));
   assert.ok(Math.abs(inverse.x-p.x)<1e-12&&Math.abs(inverse.y-p.y)<1e-12,'screen/world conversion is consistent with letterboxing');
  }
  const svg=renderGraph(circleGraph,style,'circle-layout');
  const clip=svg.match(/id="circle-layout-shade-clip-0"><rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/).slice(1).map(Number);
  assert.deepEqual(clip,[layout.L,layout.T,layout.R-layout.L,layout.B-layout.T]);
 }
 const unrestricted=graphLayout({...circleGraph,equalAxes:false});
 assert.notEqual(unrestricted.dx,unrestricted.dy,'explicit independent axes override conic defaults');
 const fixedOrdinary=graphLayout({...base,equalAxes:true});
 assert.ok(Math.abs(fixedOrdinary.dx-fixedOrdinary.dy)<1e-12,'equal units are also available to ordinary graphs');
 const ordinaryLayout=graphLayout(base);
 assert.notEqual(ordinaryLayout.dx,ordinaryLayout.dy,'legacy graphs retain their independent axis scales');
 const tinyAxisLayout=graphLayout({...base,equalAxes:true,xMin:-1e-30,xMax:1e-30});
 assert.ok(tinyAxisLayout.dx>0&&Number.isFinite(tinyAxisLayout.dx)&&tinyAxisLayout.dx===tinyAxisLayout.dy,'subpixel fitted axis widths retain a finite common scale');
 assert.ok(Object.values(tinyAxisLayout.world(tinyAxisLayout.L,tinyAxisLayout.B)).every(Number.isFinite));
 for(const [index,x,y,expected] of [[0,1,2,1],[4,1,1,1],[8,-1,2,1],[12,2,-1,1]]){
  const resized=movePoint(circleGraph,0,index,x,y);
  assert.deepEqual(resized.curves[0].conic,{...circleModel,rx:expected,ry:expected},'all four handles adjust a circle radius without deforming it');
  assert.deepEqual(resized.shadings,circleGraph.shadings);
 }
 for(const [index,p] of circleCurve.points.entries()){
  if(conicHandleIndices(circleCurve).includes(index))assert.deepEqual(movePoint(circleGraph,0,index,p.x,p.y),circleGraph,'conic no-op edits are stable');
  else assert.throws(()=>movePoint(circleGraph,0,index,p.x,p.y),/자유 곡선/);
 }
 assert.equal(movePoint(circleGraph,0,0,100,100).curves[0].conic.rx,3,'radius is clamped to the full visible circle');
 assert.ok(movePoint(circleGraph,0,0,-100,0).curves[0].conic.rx>0,'handles cannot invert a radius');
 const ellipseGraph={...circleGraph,curves:[withConic(circleCurve,ellipseModel)]};
 assert.deepEqual(movePoint(ellipseGraph,0,0,2.5,99).curves[0].conic,{...ellipseModel,rx:1.5},'ellipse horizontal handles only change rx');
 assert.deepEqual(movePoint(ellipseGraph,0,4,99,1.5).curves[0].conic,{...ellipseModel,ry:2},'ellipse vertical handles only change ry');
 const translatedCircle=moveCurve(circleGraph,0,100,-100);
 assert.deepEqual(translatedCircle.curves[0].conic,{...circleModel,cx:1,cy:-1});
 assert.deepEqual(translatedCircle.shadings,circleGraph.shadings);
 assert.throws(()=>moveCurve({...circleGraph,xMin:-1,xMax:1},0,0,0),/축 범위/);
 const followedCircle=moveCurve({...circleGraph,labels:[{x:2,y:0,text:'R',dx:4,dy:5}],guides:[{x1:0,y1:0,x2:2,y2:0}]},0,.5,.5,true);
 assert.deepEqual(followedCircle.labels[0],{x:2.5,y:.5,text:'R',dx:4,dy:5});
 assert.deepEqual(followedCircle.guides[0],{x1:0,y1:.5,x2:2.5,y2:.5});
 assert.throws(()=>insertCurvePoint(circleGraph,0,0,.5),/자유 곡선/);
 assert.throws(()=>updateConic(base,0,{rx:2}),/먼저 선택/);
 assert.throws(()=>updateConic(circleGraph,0,{rx:3}),/반지름/);
 assert.deepEqual(updateConic(circleGraph,0,{kind:'ellipse',ry:1}).curves[0].conic,{...circleModel,kind:'ellipse',ry:1});
 const freeCircle=freeConic(circleCurve);
 assert.equal(freeCircle.conic,undefined);
 assert.deepEqual(freeCircle.points,circleCurve.points);
 assert.equal(freeCircle.smooth,true);
 assert.equal(insertCurvePoint({...circleGraph,curves:[freeCircle]},0,2,.5).graph.curves[0].points.length,18);
 assert.deepEqual(circleGraph,circleSnapshot,'conic drawing and edits do not mutate source documents');

 // Non-function paths need continuous parametric tangents at every knot,
 // including a periodic closed seam. Existing straight polygons stay straight.
 const loopPoints=[{x:2,y:0},{x:1.2,y:1.5},{x:-1,y:2},{x:-2,y:-.5},{x:0,y:-1.5},{x:2,y:0}];
 const loop={...base.curves[0],points:loopPoints,smooth:true};
 const derivative=(curve,segment,end)=>{
  const p=[0,1/3,2/3,1].map(t=>pointOnCurve(curve,segment,t));
  const slope=axis=>end?(11*p[3][axis]-18*p[2][axis]+9*p[1][axis]-2*p[0][axis])/2:(-11*p[0][axis]+18*p[1][axis]-9*p[2][axis]+2*p[3][axis])/2;
  return {x:slope('x'),y:slope('y')};
 };
 for(let i=0;i<loop.points.length-1;i++){
  const incoming=derivative(loop,(i+loop.points.length-2)%(loop.points.length-1),true),outgoing=derivative(loop,i,false);
  const product=Math.hypot(incoming.x,incoming.y)*Math.hypot(outgoing.x,outgoing.y);
  assert.ok(Math.abs(incoming.x*outgoing.y-incoming.y*outgoing.x)/product<1e-12,'closed tangents join in the same direction without a seam kink');
  assert.ok(incoming.x*outgoing.x+incoming.y*outgoing.y>0);
  assert.deepEqual(pointOnCurve(loop,i,0),loop.points[i]);
  assert.deepEqual(pointOnCurve(loop,i,1),loop.points[i+1]);
 }
 for(const segment of [0,2,4]){
  const p=pointOnCurve(loop,segment,.37),nearest=nearestCurvePosition(loop,p,51,88);
  assert.equal(nearest.segment,segment);
  assert.ok(Math.abs(nearest.t-.37)<1e-8);
  const added=insertCurvePoint({...circleGraph,curves:[loop]},0,segment,.37);
  assert.deepEqual(added.graph.curves[0].points[segment+1],p);
  assert.deepEqual(added.graph.curves[0].points[0],added.graph.curves[0].points.at(-1),'insertion retains the periodic closing point');
 }
 assert.equal(curvePath(pv).includes(' C'),false,'existing P–V polygons remain straight unless smoothing is selected');
 const loopGraph={...circleGraph,curves:[loop]};
 assert.ok(renderGraph(loopGraph).includes(`data-shading="0" d="${curvePath(loopGraph)} Z"`),'general closed curves share their smoothed fill boundary');

 const modeledDistribution=structuredClone(presets.find(p=>p.id==='distribution').graph);
 const modeledOriginal=structuredClone(modeledDistribution);
 const model=modeledDistribution.curves[0].distribution;
 assert.deepEqual(model,{kind:'gamma',origin:0,peak:2,height:1,power:3,baseline:0,end:10});
 assert.equal(distributionValue(model,-1),0);
 assert.equal(distributionValue(model,0),0);
 assert.equal(distributionValue(model,2),1);
 assert.ok(Math.abs(distributionValue(model,4)-8*Math.exp(-3))<1e-15,'gamma values use the analytic formula');
 const normalized=graphSchema.parse({...modeledDistribution,curves:[{...modeledDistribution.curves[0],points:[{x:9,y:9}],smooth:false}]});
 assert.deepEqual(normalized.curves[0].points,modeledDistribution.curves[0].points,'formula metadata is canonical even when supplied samples are stale');
 assert.equal(normalized.curves[0].smooth,true);
 assert.equal(graphSchema.parse({...base,curves:[{...base.curves[0],distribution:null}]}).curves[0].distribution,null);
 assert.deepEqual(graphSchema.parse(base),base,'legacy documents without formula metadata are not changed');
 for(const patch of [{origin:2},{peak:0},{peak:10},{end:2},{height:0},{height:-1},{height:NaN},{power:1.9},{power:80.1},{baseline:1000000},{kind:'normal'}])assert.equal(graphSchema.safeParse({...modeledDistribution,curves:[{...modeledDistribution.curves[0],distribution:{...model,...patch}}]}).success,false);
 for(const parameters of [model,{...model,peak:4.5,power:5,height:.6},{...model,power:2},{...model,power:80},{...model,peak:1e-30,end:1e6},{...model,origin:-1e6,peak:-999999.9999,end:1e6,baseline:-3,height:2}]){
  const curve=withDistribution({...modeledDistribution.curves[0],lineStyle:'dash-dot',dots:true,arrows:true},parameters);
  assert.ok(curve.points.length>20&&curve.points.length<=500);
  assert.equal(curve.points[0].x,parameters.origin);
  assert.equal(curve.points.at(-1).x,parameters.end);
  const peakIndex=distributionPeakIndex(curve);
  assert.ok(peakIndex>0&&peakIndex<curve.points.length-1);
  assert.deepEqual(curve.points[peakIndex],{x:parameters.peak,y:parameters.baseline+parameters.height});
  assert.ok(curve.points.every((p,i)=>!i||p.x>curve.points[i-1].x));
  let area=0;
  for(let segment=0;segment<curve.points.length-1;segment++){
   const a=curve.points[segment],b=curve.points[segment+1];
   let last=a.y;
   for(const t of [.25,.5,.75,1]){
    const p=pointOnCurve(curve,segment,t);
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
    assert.ok(Math.abs(p.y-distributionValue(parameters,p.x))<=parameters.height*1.1e-5,'the drawn cubic must agree with the formula across each segment');
    assert.ok(segment<peakIndex?p.y>=last-parameters.height*1e-6:p.y<=last+parameters.height*1e-6,'formula curves have a single peak without extra ripples');
    last=p.y;
   }
   area+=(b.x-a.x)*(a.y+4*pointOnCurve(curve,segment,.5).y+b.y-6*parameters.baseline)/6;
  }
  if(parameters===model){
   let referenceArea=0;
   for(let i=0;i<10000;i++)referenceArea+=distributionValue(model,(i+.5)*.001)*.001;
   assert.ok(Math.abs(area-referenceArea)<1e-5,'curve area retains analytic accuracy');
  }
  const graph={...modeledDistribution,curves:[curve],shadings:[{curve:0,mode:'baseline',baseline:parameters.baseline,xStart:parameters.origin,xEnd:parameters.end,pattern:'hatch',opacity:.2}]};
  const svg=renderGraph(graph),path=curvePath(graph),fill=svg.match(/data-shading="0" d="([^"]+)"/)?.[1];
  assert.ok(path.includes('C')&&!path.includes('L'));
  if(fill)assert.ok(fill.startsWith(path),'formula shading shares the precise curve boundary');
  assert.ok(!/NaN|Infinity/.test(svg));
  assert.equal((svg.match(/<circle /g)||[]).length,1,'formula markers show only the peak');
  assert.equal(curveArrows(graph).length,1,'formula direction arrows must not repeat on every sample');
  assert.ok(svg.includes('stroke-dasharray="10 5 0 5"'),'formula curves preserve line style');
 }
 const formulaCurve=modeledDistribution.curves[0],peakIndex=distributionPeakIndex(formulaCurve);
 // Cubic endpoint derivatives must equal the formula on both sides of every
 // knot, including the zero derivative at the peak. This catches the visible
 // shoulders produced by unrelated interpolant slopes between sparse samples.
 const expectedDerivative=x=>x<=model.origin?0:(distributionValue(model,x)-model.baseline)*model.power*(1/(x-model.origin)-1/(model.peak-model.origin));
 for(let i=0;i<formulaCurve.points.length-1;i++){
  const values=[0,1/3,2/3,1].map(t=>pointOnCurve(formulaCurve,i,t).y),h=formulaCurve.points[i+1].x-formulaCurve.points[i].x;
  const left=(-11*values[0]+18*values[1]-9*values[2]+2*values[3])/(2*h);
  const right=(11*values[3]-18*values[2]+9*values[1]-2*values[0])/(2*h);
  assert.ok(Math.abs(left-expectedDerivative(formulaCurve.points[i].x))<1e-9);
  assert.ok(Math.abs(right-expectedDerivative(formulaCurve.points[i+1].x))<1e-9);
 }
 assert.deepEqual(graphSchema.parse(JSON.parse(JSON.stringify(modeledDistribution))),modeledDistribution,'saved formula graphs rebuild reproducibly');
 const peakEdited=movePoint(modeledDistribution,0,peakIndex,3,.8);
 assert.equal(peakEdited.curves[0].distribution.peak,3);
 assert.equal(peakEdited.curves[0].distribution.height,.8);
 assert.ok(peakEdited.curves[0].points.every(p=>p.y===distributionValue(peakEdited.curves[0].distribution,p.x)));
 assert.deepEqual(movePoint(modeledDistribution,0,peakIndex,2,1),modeledDistribution,'formula no-op edits preserve canonical coordinates');
 for(const [x,y] of [[-1e6,-1e6],[1e6,1e6]]){
  const next=movePoint(modeledDistribution,0,peakIndex,x,y),m=next.curves[0].distribution;
  assert.ok(m.origin<m.peak&&m.peak<m.end&&m.height>0);
  assert.ok(m.peak>=next.xMin&&m.peak<=next.xMax&&m.baseline+m.height<=next.yMax);
 }
 assert.throws(()=>movePoint(modeledDistribution,0,0,.5,.5),/자유 곡선/);
 assert.throws(()=>insertCurvePoint(modeledDistribution,0,peakIndex,.5),/자유 곡선/);
 const reshaped=updateDistribution(modeledDistribution,0,{power:8,end:11});
 assert.equal(reshaped.curves[0].distribution.power,8);
 assert.equal(reshaped.curves[0].points.at(-1).x,11);
 assert.throws(()=>updateDistribution(modeledDistribution,0,{peak:20}));
 assert.throws(()=>updateDistribution(base,0,{power:8}));
 const modelTranslated=moveCurve(modeledDistribution,0,100,100),translatedModel=modelTranslated.curves[0].distribution;
 assert.deepEqual(translatedModel,{...model,origin:1,peak:3,end:11,baseline:.30000000000000004});
 const followModel={...modeledDistribution,labels:[{x:2,y:1,text:'정점',dx:0,dy:0}],guides:[{x1:2,y1:0,x2:2,y2:1}],shadings:[{curve:0,mode:'baseline',baseline:0,xStart:0,xEnd:10,pattern:'solid',opacity:.2}]};
 const followedPeak=movePoint(followModel,0,peakIndex,3,.8,true);
 assert.deepEqual(followedPeak.labels[0],{x:3,y:.8,text:'정점',dx:0,dy:0});
 assert.deepEqual(followedPeak.guides[0],{x1:3,y1:0,x2:3,y2:.8});
 assert.deepEqual(followedPeak.shadings,followModel.shadings);
 const freed=freeDistribution(formulaCurve);
 assert.equal(freed.distribution,undefined);
 assert.deepEqual(freed.points,formulaCurve.points);
 assert.equal(freed.smooth,true);
 const freeGraph={...modeledDistribution,curves:[freed]};
 assert.equal(insertCurvePoint(freeGraph,0,3,.5).graph.curves[0].points.length,freed.points.length+1);
 assert.deepEqual(modeledDistribution,modeledOriginal,'model edits, conversion and render must not mutate input');
 // Keep sparse historical distribution fixtures to protect ordinary free-curve
 // editing independently of the new analytic distribution preset.
 const sparseXs=[[0,.35,.7,1.1,1.5,2,2.7,3.5,4.6,6,8,10],[0,.7,1.5,2.3,3.3,4.5,5.8,7.2,8.6,10]];
 const distribution={...modeledDistribution,curves:modeledDistribution.curves.map((c,i)=>({...freeDistribution(c),points:sparseXs[i].map(x=>({x,y:distributionValue(c.distribution,x)}))}))};
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
 console.log('PASS: analytic circle/ellipse arcs and shared shading, equal-axis layout and inverse dragging, conic resize/translation/conversion, periodic smooth paths and insertion, analytic gamma values, derivative continuity and adaptive sampling, immutable formula edits and conversion, five line styles and legacy compatibility across widths, shading boundaries and clipping, immutable insertion and nearest cubic points, curve deletion references, connection mode eligibility and reversible SVG paths, bounds, smooth knot spacing and cubic export, repeated and tiny-range edits, closed loops, optional follow, text validation, immutable edits');
}finally{await rm(temp,{recursive:true,force:true});}
