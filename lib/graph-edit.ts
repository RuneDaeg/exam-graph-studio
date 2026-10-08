import {graphSchema, pointOnCurve, shadingIssue, withDistribution, distributionPeakIndex, withConic, conicHandleIndices, yAxisRange, type YAxis, type Conic, type Distribution, type Graph, type Shading} from './graph';

export type EditTarget =
 | {kind:'point';curve:number;index:number}
 | {kind:'curve';curve:number}
 | {kind:'label';index:number}
 | {kind:'guide';index:number}
 | {kind:'axis';axis:'x'|'y'|'right'}
 | {kind:'tick';axis:'x'|'y'|'right';index:number};

type Point = Graph['curves'][number]['points'][number];
type Movement = {from:Point;to:Point};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const same=(a:Point,b:Point)=>a.x===b.x&&a.y===b.y;

function finite(...values:number[]){
 if(values.some(value=>!Number.isFinite(value)))throw Error('유한한 숫자를 입력해 주세요.');
}
function item<T>(items:T[],index:number):T{
 if(!Number.isInteger(index)||index<0||index>=items.length)throw Error('편집할 항목을 찾을 수 없습니다.');
 return items[index];
}

export function insertCurvePoint(graph:Graph,curve:number,segment:number,t:number):{graph:Graph;index:number}{
 const source=item(graph.curves,curve);
 if(source.distribution)throw Error('수식 분포에는 개별 점을 추가할 수 없습니다. 자유 곡선으로 전환한 뒤 점을 추가해 주세요.');
 if(source.conic)throw Error('원·타원에는 개별 점을 추가할 수 없습니다. 자유 곡선으로 전환한 뒤 점을 추가해 주세요.');
 if(source.points.length>=500)throw Error('한 선에는 점을 500개까지 추가할 수 있습니다.');
 if(source.points.length<2)throw Error('점을 추가하려면 선에 점이 두 개 이상 있어야 합니다.');
 finite(t);
 if(t<=.0001||t>=.9999)throw Error('기존 점에서 조금 떨어진 선 위를 선택해 주세요.');
 const point=pointOnCurve(source,segment,t);
 if(source.points.some(p=>same(p,point)))throw Error('같은 위치에 이미 점이 있습니다.');
 // Preserve the order of every existing point, including the repeated last
 // point of a closed path. Smooth ordered curves must remain strictly ordered.
 if(source.smooth&&source.points.every((p,i)=>!i||p.x>source.points[i-1].x)&&!(point.x>source.points[segment].x&&point.x<source.points[segment+1].x))throw Error('기존 점 사이에 새 점을 넣을 공간이 없습니다.');
 const index=segment+1,points=[...source.points.slice(0,index),point,...source.points.slice(index)];
 return {graph:graphSchema.parse({...graph,curves:graph.curves.map((c,i)=>i===curve?{...c,points}:c)}),index};
}

export function removeCurve(graph:Graph,index:number):Graph{
 item(graph.curves,index);
 const shadings=graph.shadings?.filter(s=>s.mode==='rectangle'||(s.curve!==index&&(s.mode!=='between'||s.otherCurve!==index))).map(s=>s.mode==='rectangle'?s:({
  ...s,curve:s.curve>index?s.curve-1:s.curve,
  ...(s.otherCurve===undefined?{}:{otherCurve:s.otherCurve===index?0:s.otherCurve>index?s.otherCurve-1:s.otherCurve}),
 }));
 return graphSchema.parse({...graph,curves:graph.curves.filter((_,i)=>i!==index),...(shadings===undefined?{}:{shadings})});
}

/** Delete the selected visual item without removing independent annotations. */
export function deleteGraphTarget(graph:Graph,target:EditTarget):Graph{
 if(target.kind==='curve')return removeCurve(graph,target.curve);
 if(target.kind==='axis')return adjustText(graph,target,'');
 if(target.kind==='label'||target.kind==='guide'){
  const key=target.kind==='label'?'labels':'guides';
  item<unknown>(graph[key],target.index);
  return graphSchema.parse({...graph,[key]:graph[key].filter((_,i)=>i!==target.index)});
 }
 if(target.kind==='tick'){
  if(target.axis==='right'){
   if(!graph.rightYAxis)throw Error('오른쪽 세로축을 먼저 켜 주세요.');
   item(graph.rightYAxis.ticks,target.index);
   return graphSchema.parse({...graph,rightYAxis:{...graph.rightYAxis,ticks:graph.rightYAxis.ticks.filter((_,i)=>i!==target.index)}});
  }
  const key=target.axis==='x'?'xTicks':'yTicks';
  item(graph[key],target.index);
  return graphSchema.parse({...graph,[key]:graph[key].filter((_,i)=>i!==target.index)});
 }
 const source=item(graph.curves,target.curve);
 item(source.points,target.index);
 // Formula samples are derived geometry: deleting a displayed handle deletes
 // the owning curve instead of silently regenerating the removed point.
 if(source.distribution||source.conic)return removeCurve(graph,target.curve);
 const last=source.points.length-1,closed=last>0&&same(source.points[0],source.points[last]);
 const vertexIndex=closed&&target.index===last?0:target.index;
 const vertices=(closed?source.points.slice(0,-1):source.points).filter((_,i)=>i!==vertexIndex);
 if(!vertices.length)return removeCurve(graph,target.curve);
 const distinct=new Set(vertices.map(p=>`${p.x},${p.y}`)).size;
 const points=closed&&distinct>=3?[...vertices,vertices[0]]:vertices;
 const next={...source,points,...(points.length<=2?{smooth:false}:{}),...(points.length===1?{dots:true}: {})};
 const result={...graph,curves:graph.curves.map((curve,i)=>i===target.curve?next:curve)};
 if(graph.shadings)result.shadings=graph.shadings.filter(shade=>
  shade.mode==='rectangle'||(shade.curve!==target.curve&&(shade.mode!=='between'||shade.otherCurve!==target.curve))||!shadingIssue(result,shade));
 return graphSchema.parse(result);
}

export function createRectangleShading(graph:Graph,a:Point,b:Point,axis:YAxis='left'):Shading{
 finite(a.x,a.y,b.x,b.y);
 if((graph.shadings?.length??0)>=20)throw Error('음영은 20개까지 추가할 수 있습니다.');
 if(a.x===b.x||a.y===b.y)throw Error('사각형의 가로와 세로에 넓이가 있도록 두 모서리를 선택해 주세요.');
 const shade:Shading={...(axis==='right'?{yAxis:axis}:{}),mode:'rectangle',curve:0,baseline:0,xStart:Math.min(a.x,b.x),xEnd:Math.max(a.x,b.x),yStart:Math.min(a.y,b.y),yEnd:Math.max(a.y,b.y),pattern:'solid',opacity:.15};
 const issue=shadingIssue(graph,shade);
 if(issue)throw Error(issue);
 return shade;
}

function followAnchors(graph:Graph,movements:Movement[],axis:YAxis='left'):Graph{
 const range=yAxisRange(graph,axis);
 // Ignore round-off in API coordinates and repeated pointer edits, while
 // keeping nearby but independently positioned annotations separate.
 const close=(a:number,b:number,span:number)=>Math.abs(a-b)<=Math.max(Math.abs(span)*1e-9,Number.EPSILON*Math.max(Math.abs(a),Math.abs(b))*8);
 const matches=(a:Point,b:Point)=>close(a.x,b.x,graph.xMax-graph.xMin)&&close(a.y,b.y,range.max-range.min);
 const moved=(point:Point)=>movements.find(m=>matches(m.from,point))?.to;
 const labels=graph.labels.map(label=>{
  if((label.yAxis??'left')!==axis)return label;
  const next=moved(label);
  return next?{...label,x:next.x,y:next.y}:label;
 });
 const guides=graph.guides.map(guide=>{
  if((guide.yAxis??'left')!==axis)return guide;
  const a=moved({x:guide.x1,y:guide.y1}),b=moved({x:guide.x2,y:guide.y2});
  if(!a&&!b)return guide;
  const next={...guide,...(a?{x1:a.x,y1:a.y}:{}),...(b?{x2:b.x,y2:b.y}:{})};
  // An unmatched endpoint is a projection; preserve the original guide direction.
  if(!!a!==!!b){
   if(close(guide.x1,guide.x2,graph.xMax-graph.xMin)){if(a)next.x2=a.x;else next.x1=b!.x;}
   if(close(guide.y1,guide.y2,range.max-range.min)){if(a)next.y2=a.y;else next.y1=b!.y;}
  }
  return next;
 });
 return {...graph,labels,guides};
}

function followNormalTicks(graph:Graph,before:Distribution,after:Distribution):Graph{
 if(before.kind!=='normal'||after.kind!=='normal')return graph;
 // These symbols describe parameters, unlike fixed numeric axis graduations.
 const offsets:Record<string,number>={'\\mu':0,'\\mu-\\sigma':-1,'\\mu+\\sigma':1,'μ':0,'μ−σ':-1,'μ-σ':-1,'μ+σ':1};
 return {...graph,xTicks:graph.xTicks.map(tick=>{
  const offset=offsets[tick.label.replace(/\s/g,'')];
  if(offset===undefined||Math.abs(tick.value-(before.peak+offset*before.sigma))>Math.abs(graph.xMax-graph.xMin)*1e-9)return tick;
  return {...tick,value:after.peak+offset*after.sigma};
 })};
}

/** Replace a curve from numeric controls, retaining semantic model anchors. */
export function replaceCurve(graph:Graph,index:number,curve:Graph['curves'][number],follow=false):Graph{
 const source=item(graph.curves,index);
 let result=graphSchema.parse({...graph,curves:graph.curves.map((c,i)=>i===index?curve:c)});
 if(!follow||(source.yAxis??'left')!==(curve.yAxis??'left'))return result;
 const next=result.curves[index];
 let movements:Movement[]=[];
 if(source.distribution&&next.distribution){
  const a=source.distribution,b=next.distribution;
  movements=[{from:{x:a.peak,y:a.baseline+a.height},to:{x:b.peak,y:b.baseline+b.height}}];
  if(a.kind==='normal'&&b.kind==='normal')for(const sign of [-1,1])movements.push({from:{x:a.peak+sign*a.sigma,y:a.baseline+a.height*Math.exp(-.5)},to:{x:b.peak+sign*b.sigma,y:b.baseline+b.height*Math.exp(-.5)}});
 }else if(next.distribution&&!source.distribution){
  const peak=source.points.reduce((a,b)=>b.y>a.y?b:a),model=next.distribution;
  movements=[{from:peak,to:{x:model.peak,y:model.baseline+model.height}}];
 }else if(source.points.length===next.points.length){
  movements=source.points.map((from,i)=>({from,to:next.points[i]}));
 }
 result=followAnchors(result,movements.filter(m=>!same(m.from,m.to)),source.yAxis);
 if(source.distribution&&next.distribution)result=followNormalTicks(result,source.distribution,next.distribution);
 return graphSchema.parse(result);
}

export function updateDistribution(graph:Graph,index:number,patch:Partial<Distribution>,follow=false):Graph{
 const source=item(graph.curves,index);
 if(!source.distribution)throw Error('수식 분포를 먼저 선택해 주세요.');
 const next=withDistribution(source,{...source.distribution,...patch} as Distribution);
 return replaceCurve(graph,index,next,follow);
}

export function updateConic(graph:Graph,index:number,patch:Partial<Conic>):Graph{
 const source=item(graph.curves,index);
 if(!source.conic)throw Error('원·타원 공식을 먼저 선택해 주세요.');
 const next=withConic(source,{...source.conic,...patch});
 return graphSchema.parse({...graph,curves:graph.curves.map((c,i)=>i===index?next:c)});
}

export function movePoint(graph:Graph,curve:number,index:number,x:number,y:number,follow=false):Graph{
 finite(x,y);
 const source=item(graph.curves,curve),point=item(source.points,index),range=yAxisRange(graph,source.yAxis);
 if(source.conic){
  if(!conicHandleIndices(source).includes(index))throw Error('원·타원은 위·아래·왼쪽·오른쪽 조절점으로 크기를 바꿉니다. 개별 점을 옮기려면 자유 곡선으로 전환해 주세요.');
  const model=source.conic,horizontal=index===0||index===8;
  const maxRx=Math.min(model.cx-graph.xMin,graph.xMax-model.cx),maxRy=Math.min(model.cy-range.min,range.max-model.cy);
  const maximum=model.kind==='circle'?Math.min(maxRx,maxRy):horizontal?maxRx:maxRy;
  const current=horizontal?model.rx:model.ry;
  const minimum=Math.min(current,Math.max(Number.EPSILON*Math.max(1,Math.abs(model.cx),Math.abs(model.cy))*2,maximum*.0001));
  if(maximum<minimum||maximum<=0)throw Error('원의 중심이 축 범위 안에 오도록 축 범위를 넓혀 주세요.');
  const proposed=horizontal?(index===0?x-model.cx:model.cx-x):(index===4?y-model.cy:model.cy-y);
  const radius=clamp(proposed,minimum,maximum);
  const patch=model.kind==='circle'?{rx:radius,ry:radius}:horizontal?{rx:radius}:{ry:radius};
  let result=updateConic(graph,curve,patch);
  if(follow)result=followAnchors(result,source.points.map((from,i)=>({from,to:result.curves[curve].points[i]})),source.yAxis);
  return graphSchema.parse(result);
 }
 if(source.distribution){
  if(index!==distributionPeakIndex(source))throw Error('수식 분포는 꼭짓점을 움직여 모양을 조절합니다. 개별 점을 옮기려면 자유 곡선으로 전환해 주세요.');
  const model=source.distribution,gap=Math.min((model.end-model.origin)*.005,model.peak-model.origin,model.end-model.peak);
  const minX=Math.max(graph.xMin,model.origin+gap),maxX=Math.min(graph.xMax,model.end-gap);
  const minimumHeight=Math.min(model.height,Math.max(Number.EPSILON*Math.max(1,Math.abs(model.baseline)),(range.max-range.min)*.0001));
  const minY=Math.max(range.min,model.baseline+minimumHeight),maxY=range.max;
  if(minX>maxX||minY>maxY)throw Error('분포의 꼭짓점이 축 범위 안에 오도록 축 범위를 넓혀 주세요.');
  const peak=clamp(x,minX,maxX),height=clamp(y,minY,maxY)-model.baseline;
  return updateDistribution(graph,curve,{peak,height},follow);
 }
 const last=source.points.length-1;
 let minX=graph.xMin,maxX=graph.xMax;
 if(source.smooth&&last>1&&point.x>=minX&&point.x<=maxX&&source.points.every((p,i)=>i===0||p.x>source.points[i-1].x)){
  // Sparse smooth knots need room for their neighboring cubic segments. A gap
  // relative to the curve's span prevents narrow spikes at any unit scale.
  // Preserve tighter existing spacing (and a no-op edit); do not force a
  // resampling or change vertical / closed paths, whose x values are unordered.
  const gap=Math.min(maxX-minX,source.points[last].x-source.points[0].x)*.025;
  if(index>0){
   const previous=source.points[index-1].x;
   const bound=previous+Math.min(gap,point.x-previous);
   minX=Math.max(minX,bound>previous?Math.min(point.x,bound):point.x);
  }
  if(index<last){
   const following=source.points[index+1].x;
   const bound=following-Math.min(gap,following-point.x);
   maxX=Math.min(maxX,bound<following?Math.max(point.x,bound):point.x);
  }
 }
 const next={x:clamp(x,minX,maxX),y:clamp(y,range.min,range.max)};
 const closed=last>0&&same(source.points[0],source.points[last]);
 const points=source.points.map((p,i)=>i===index||(closed&&(index===0||index===last)&&(i===0||i===last))?next:p);
 let result={...graph,curves:graph.curves.map((c,i)=>i===curve?{...c,points}:c)};
 if(follow)result=followAnchors(result,[{from:point,to:next}],source.yAxis);
 return graphSchema.parse(result);
}

export function moveCurve(graph:Graph,curve:number,dx:number,dy:number,follow=false):Graph{
 finite(dx,dy);
 const source=item(graph.curves,curve),range=yAxisRange(graph,source.yAxis);
 if(source.conic){
  const model=source.conic,minDx=graph.xMin-model.cx+model.rx,maxDx=graph.xMax-model.cx-model.rx,minDy=range.min-model.cy+model.ry,maxDy=range.max-model.cy-model.ry;
  if(minDx>maxDx||minDy>maxDy)throw Error('원·타원이 축 범위보다 큽니다. 먼저 축 범위를 넓혀 주세요.');
  const shiftX=clamp(dx,minDx,maxDx),shiftY=clamp(dy,minDy,maxDy);
  let result=updateConic(graph,curve,{cx:model.cx+shiftX,cy:model.cy+shiftY});
  if(follow)result=followAnchors(result,source.points.map((from,i)=>({from,to:result.curves[curve].points[i]})),source.yAxis);
  return graphSchema.parse(result);
 }
 if(source.distribution){
  const model=source.distribution,minDx=graph.xMin-model.origin,maxDx=graph.xMax-model.end,minDy=range.min-model.baseline,maxDy=range.max-model.baseline-model.height;
  if(minDx>maxDx||minDy>maxDy)throw Error('곡선이 축 범위보다 큽니다. 먼저 축 범위를 넓혀 주세요.');
  const shiftX=clamp(dx,minDx,maxDx),shiftY=clamp(dy,minDy,maxDy);
  let result=updateDistribution(graph,curve,{origin:model.origin+shiftX,peak:model.peak+shiftX,end:model.end+shiftX,baseline:model.baseline+shiftY});
  if(follow){
   result=followAnchors(result,source.points.map(from=>({from,to:{x:from.x+shiftX,y:from.y+shiftY}})),source.yAxis);
   result=followNormalTicks(result,model,result.curves[curve].distribution!);
  }
  return graphSchema.parse(result);
 }
 const xs=source.points.map(p=>p.x),ys=source.points.map(p=>p.y);
 const minDx=graph.xMin-Math.min(...xs),maxDx=graph.xMax-Math.max(...xs);
 const minDy=range.min-Math.min(...ys),maxDy=range.max-Math.max(...ys);
 if(minDx>maxDx||minDy>maxDy)throw Error('곡선이 축 범위보다 큽니다. 먼저 축 범위를 넓혀 주세요.');
 const shiftX=clamp(dx,minDx,maxDx),shiftY=clamp(dy,minDy,maxDy);
 const points=source.points.map(p=>({x:p.x+shiftX,y:p.y+shiftY}));
 let result={...graph,curves:graph.curves.map((c,i)=>i===curve?{...c,points}:c)};
 if(follow)result=followAnchors(result,source.points.map((from,i)=>({from,to:points[i]})),source.yAxis);
 return graphSchema.parse(result);
}

export function moveLabel(graph:Graph,index:number,dxPixels:number,dyPixels:number):Graph{
 finite(dxPixels,dyPixels);
 const source=item(graph.labels,index);
 const next={...source,dx:clamp(source.dx+dxPixels,-1e6,1e6),dy:clamp(source.dy+dyPixels,-1e6,1e6)};
 return graphSchema.parse({...graph,labels:graph.labels.map((label,i)=>i===index?next:label)});
}

export function adjustText(graph:Graph,target:EditTarget,text:string,value?:number):Graph{
 if(target.kind==='axis'&&target.axis==='right'){
  if(!graph.rightYAxis)throw Error('오른쪽 세로축을 먼저 켜 주세요.');
  return graphSchema.parse({...graph,rightYAxis:{...graph.rightYAxis,label:text}});
 }
 if(target.kind==='axis')return graphSchema.parse({...graph,[target.axis==='x'?'xLabel':'yLabel']:text});
 if(target.kind==='label'){
  item(graph.labels,target.index);
  return graphSchema.parse({...graph,labels:graph.labels.map((label,i)=>i===target.index?{...label,text}:label)});
 }
 if(target.kind==='tick'){
  if(target.axis==='right'){
   if(!graph.rightYAxis)throw Error('오른쪽 세로축을 먼저 켜 주세요.');
   item(graph.rightYAxis.ticks,target.index);
   return graphSchema.parse({...graph,rightYAxis:{...graph.rightYAxis,ticks:graph.rightYAxis.ticks.map((tick,i)=>i===target.index?{...tick,label:text,...(value===undefined?{}:{value})}:tick)}});
  }
  const key=target.axis==='x'?'xTicks':'yTicks';
  item(graph[key],target.index);
  return graphSchema.parse({...graph,[key]:graph[key].map((tick,i)=>i===target.index?{...tick,label:text,...(value===undefined?{}:{value})}:tick)});
 }
 throw Error('이 항목에는 편집할 문자가 없습니다.');
}
