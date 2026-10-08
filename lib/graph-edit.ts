import {graphSchema, pointOnCurve, shadingIssue, withDistribution, distributionPeakIndex, type Distribution, type Graph, type Shading} from './graph';

export type EditTarget =
 | {kind:'point';curve:number;index:number}
 | {kind:'curve';curve:number}
 | {kind:'label';index:number}
 | {kind:'axis';axis:'x'|'y'}
 | {kind:'tick';axis:'x'|'y';index:number};

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

export function createRectangleShading(graph:Graph,a:Point,b:Point):Shading{
 finite(a.x,a.y,b.x,b.y);
 if((graph.shadings?.length??0)>=20)throw Error('음영은 20개까지 추가할 수 있습니다.');
 if(a.x===b.x||a.y===b.y)throw Error('사각형의 가로와 세로에 넓이가 있도록 두 모서리를 선택해 주세요.');
 const shade:Shading={mode:'rectangle',curve:0,baseline:0,xStart:Math.min(a.x,b.x),xEnd:Math.max(a.x,b.x),yStart:Math.min(a.y,b.y),yEnd:Math.max(a.y,b.y),pattern:'solid',opacity:.15};
 const issue=shadingIssue(graph,shade);
 if(issue)throw Error(issue);
 return shade;
}

function followAnchors(graph:Graph,movements:Movement[]):Graph{
 const moved=(point:Point)=>movements.find(m=>same(m.from,point))?.to;
 const labels=graph.labels.map(label=>{
  const next=moved(label);
  return next?{...label,x:next.x,y:next.y}:label;
 });
 const guides=graph.guides.map(guide=>{
  const a=moved({x:guide.x1,y:guide.y1}),b=moved({x:guide.x2,y:guide.y2});
  if(!a&&!b)return guide;
  const next={...guide,...(a?{x1:a.x,y1:a.y}:{}),...(b?{x2:b.x,y2:b.y}:{})};
  // An unmatched endpoint is a projection; preserve the original guide direction.
  if(!!a!==!!b){
   if(guide.x1===guide.x2){if(a)next.x2=a.x;else next.x1=b!.x;}
   if(guide.y1===guide.y2){if(a)next.y2=a.y;else next.y1=b!.y;}
  }
  return next;
 });
 return {...graph,labels,guides};
}

export function updateDistribution(graph:Graph,index:number,patch:Partial<Distribution>):Graph{
 const source=item(graph.curves,index);
 if(!source.distribution)throw Error('수식 분포를 먼저 선택해 주세요.');
 const next=withDistribution(source,{...source.distribution,...patch});
 return graphSchema.parse({...graph,curves:graph.curves.map((c,i)=>i===index?next:c)});
}

export function movePoint(graph:Graph,curve:number,index:number,x:number,y:number,follow=false):Graph{
 finite(x,y);
 const source=item(graph.curves,curve),point=item(source.points,index);
 if(source.distribution){
  if(index!==distributionPeakIndex(source))throw Error('수식 분포는 꼭짓점을 움직여 모양을 조절합니다. 개별 점을 옮기려면 자유 곡선으로 전환해 주세요.');
  const model=source.distribution,gap=Math.min((model.end-model.origin)*.005,model.peak-model.origin,model.end-model.peak);
  const minX=Math.max(graph.xMin,model.origin+gap),maxX=Math.min(graph.xMax,model.end-gap);
  const minimumHeight=Math.min(model.height,Math.max(Number.EPSILON*Math.max(1,Math.abs(model.baseline)),(graph.yMax-graph.yMin)*.0001));
  const minY=Math.max(graph.yMin,model.baseline+minimumHeight),maxY=graph.yMax;
  if(minX>maxX||minY>maxY)throw Error('분포의 꼭짓점이 축 범위 안에 오도록 축 범위를 넓혀 주세요.');
  const peak=clamp(x,minX,maxX),height=clamp(y,minY,maxY)-model.baseline;
  let result=updateDistribution(graph,curve,{peak,height});
  if(follow)result=followAnchors(result,[{from:point,to:{x:peak,y:model.baseline+height}}]);
  return graphSchema.parse(result);
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
 const next={x:clamp(x,minX,maxX),y:clamp(y,graph.yMin,graph.yMax)};
 const closed=last>0&&same(source.points[0],source.points[last]);
 const points=source.points.map((p,i)=>i===index||(closed&&(index===0||index===last)&&(i===0||i===last))?next:p);
 let result={...graph,curves:graph.curves.map((c,i)=>i===curve?{...c,points}:c)};
 if(follow)result=followAnchors(result,[{from:point,to:next}]);
 return graphSchema.parse(result);
}

export function moveCurve(graph:Graph,curve:number,dx:number,dy:number,follow=false):Graph{
 finite(dx,dy);
 const source=item(graph.curves,curve);
 if(source.distribution){
  const model=source.distribution,minDx=graph.xMin-model.origin,maxDx=graph.xMax-model.end,minDy=graph.yMin-model.baseline,maxDy=graph.yMax-model.baseline-model.height;
  if(minDx>maxDx||minDy>maxDy)throw Error('곡선이 축 범위보다 큽니다. 먼저 축 범위를 넓혀 주세요.');
  const shiftX=clamp(dx,minDx,maxDx),shiftY=clamp(dy,minDy,maxDy);
  let result=updateDistribution(graph,curve,{origin:model.origin+shiftX,peak:model.peak+shiftX,end:model.end+shiftX,baseline:model.baseline+shiftY});
  if(follow)result=followAnchors(result,source.points.map(from=>({from,to:{x:from.x+shiftX,y:from.y+shiftY}})));
  return graphSchema.parse(result);
 }
 const xs=source.points.map(p=>p.x),ys=source.points.map(p=>p.y);
 const minDx=graph.xMin-Math.min(...xs),maxDx=graph.xMax-Math.max(...xs);
 const minDy=graph.yMin-Math.min(...ys),maxDy=graph.yMax-Math.max(...ys);
 if(minDx>maxDx||minDy>maxDy)throw Error('곡선이 축 범위보다 큽니다. 먼저 축 범위를 넓혀 주세요.');
 const shiftX=clamp(dx,minDx,maxDx),shiftY=clamp(dy,minDy,maxDy);
 const points=source.points.map(p=>({x:p.x+shiftX,y:p.y+shiftY}));
 let result={...graph,curves:graph.curves.map((c,i)=>i===curve?{...c,points}:c)};
 if(follow)result=followAnchors(result,source.points.map((from,i)=>({from,to:points[i]})));
 return graphSchema.parse(result);
}

export function moveLabel(graph:Graph,index:number,dxPixels:number,dyPixels:number):Graph{
 finite(dxPixels,dyPixels);
 const source=item(graph.labels,index);
 const next={...source,dx:clamp(source.dx+dxPixels,-1e6,1e6),dy:clamp(source.dy+dyPixels,-1e6,1e6)};
 return graphSchema.parse({...graph,labels:graph.labels.map((label,i)=>i===index?next:label)});
}

export function adjustText(graph:Graph,target:EditTarget,text:string,value?:number):Graph{
 if(target.kind==='axis')return graphSchema.parse({...graph,[target.axis==='x'?'xLabel':'yLabel']:text});
 if(target.kind==='label'){
  item(graph.labels,target.index);
  return graphSchema.parse({...graph,labels:graph.labels.map((label,i)=>i===target.index?{...label,text}:label)});
 }
 if(target.kind==='tick'){
  const key=target.axis==='x'?'xTicks':'yTicks';
  item(graph[key],target.index);
  return graphSchema.parse({...graph,[key]:graph[key].map((tick,i)=>i===target.index?{...tick,label:text,...(value===undefined?{}:{value})}:tick)});
 }
 throw Error('이 항목에는 편집할 문자가 없습니다.');
}
