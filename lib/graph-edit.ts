import {graphSchema, type Graph} from './graph';

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

export function movePoint(graph:Graph,curve:number,index:number,x:number,y:number,follow=false):Graph{
 finite(x,y);
 const source=item(graph.curves,curve),point=item(source.points,index);
 const next={x:clamp(x,graph.xMin,graph.xMax),y:clamp(y,graph.yMin,graph.yMax)};
 const last=source.points.length-1;
 const closed=last>0&&same(source.points[0],source.points[last]);
 const points=source.points.map((p,i)=>i===index||(closed&&(index===0||index===last)&&(i===0||i===last))?next:p);
 let result={...graph,curves:graph.curves.map((c,i)=>i===curve?{...c,points}:c)};
 if(follow)result=followAnchors(result,[{from:point,to:next}]);
 return graphSchema.parse(result);
}

export function moveCurve(graph:Graph,curve:number,dx:number,dy:number,follow=false):Graph{
 finite(dx,dy);
 const source=item(graph.curves,curve);
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
