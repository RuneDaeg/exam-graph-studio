import { z } from 'zod';
const num = z.number().finite().min(-1000000).max(1000000);
const point = z.object({x:num,y:num});
const tick = z.object({value:num,label:z.string().max(80)});
const distributionSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('gamma'),origin:num,peak:num,height:num.positive(),power:z.number().finite().min(2).max(80),baseline:num,end:num}),
 z.object({kind:z.literal('normal'),origin:num,peak:num,sigma:num.positive(),height:num.positive(),baseline:num,end:num})
]).superRefine((model,ctx)=>{
 if(!(model.origin<model.peak&&model.peak<model.end))ctx.addIssue({code:z.ZodIssueCode.custom,path:['peak'],message:'분포의 시작 < 꼭짓점 < 끝 순서로 입력해 주세요.'});
 if(model.baseline+model.height>1000000)ctx.addIssue({code:z.ZodIssueCode.custom,path:['height'],message:'기준 높이와 분포 높이의 합은 1,000,000 이하여야 합니다.'});
 if(model.kind==='normal'&&(model.peak-model.sigma===model.peak||model.peak+model.sigma===model.peak))ctx.addIssue({code:z.ZodIssueCode.custom,path:['sigma'],message:'평균 좌표에서 구분할 수 있는 크기의 표준편차를 입력해 주세요.'});
});
export type Distribution=z.infer<typeof distributionSchema>;
const conicSchema=z.object({kind:z.enum(['circle','ellipse']),cx:num,cy:num,rx:num.positive(),ry:num.positive()}).superRefine((model,ctx)=>{
 if(model.kind==='circle'&&model.rx!==model.ry)ctx.addIssue({code:z.ZodIssueCode.custom,path:['ry'],message:'원의 가로·세로 반지름은 같아야 합니다.'});
 for(const [center,radius] of [['cx','rx'],['cy','ry']] as const){
  if(model[center]-model[radius]<-1000000||model[center]+model[radius]>1000000)ctx.addIssue({code:z.ZodIssueCode.custom,path:[radius],message:'원·타원의 전체 좌표는 -1,000,000부터 1,000,000까지 입력해 주세요.'});
  if(model[center]-model[radius]===model[center]||model[center]+model[radius]===model[center])ctx.addIssue({code:z.ZodIssueCode.custom,path:[radius],message:'중심 좌표에서 구분할 수 있는 크기의 반지름을 입력해 주세요.'});
 }
});
export type Conic=z.infer<typeof conicSchema>;
type DistributionPoint={x:number;y:number};
function sampleConic(model:Conic):DistributionPoint[]{
 const points=Array.from({length:16},(_,i)=>{
  // Cardinal points are exact; in particular the closing point must be
  // identical, not the tiny sine residual produced at 2π.
  if(i===0)return {x:model.cx+model.rx,y:model.cy};
  if(i===4)return {x:model.cx,y:model.cy+model.ry};
  if(i===8)return {x:model.cx-model.rx,y:model.cy};
  if(i===12)return {x:model.cx,y:model.cy-model.ry};
  const angle=i*Math.PI/8;
  return {x:model.cx+model.rx*Math.cos(angle),y:model.cy+model.ry*Math.sin(angle)};
 });
 return [...points,{...points[0]}];
}
export function distributionValue(model:Distribution,x:number):number{
 if(model.kind==='normal'){
  const z=(x-model.peak)/model.sigma;
  return model.baseline+model.height*Math.exp(-.5*z*z);
 }
 if(x<=model.origin)return model.baseline;
 if(x===model.peak)return model.baseline+model.height;
 const z=(x-model.origin)/(model.peak-model.origin);
 if(!Number.isFinite(z))return model.baseline;
 const delta=z-1,exponent=model.power*(Math.log(z)-delta);
 return model.baseline+model.height*Math.exp(Math.min(0,exponent));
}
function distributionTangentOffset(model:Distribution,x:number,h:number):number{
 if(model.kind==='normal'){
  const z=(x-model.peak)/model.sigma;
  if(z===0||!Number.isFinite(z)||distributionValue(model,x)===model.baseline)return 0;
  const logMagnitude=Math.log(model.height)-.5*z*z+Math.log(Math.abs(z))+Math.log(h)-Math.log(model.sigma);
  return -Math.sign(z)*Math.exp(logMagnitude);
 }
 const z=(x-model.origin)/(model.peak-model.origin);
 if(z<=0||z===1||!Number.isFinite(z)||distributionValue(model,x)===model.baseline)return 0;
 // Logarithms avoid overflowing the world-space derivative for narrow curves.
 const logMagnitude=Math.log(model.height)+model.power*(Math.log(z)+1-z)+Math.log(model.power)+Math.log(Math.abs(1-z))-Math.log(z)+Math.log(h)-Math.log(model.peak-model.origin);
 return Math.sign(1-z)*Math.exp(logMagnitude);
}
function distributionControls(model:Distribution,from:DistributionPoint,to:DistributionPoint){
 const h=to.x-from.x;
 return {c1:{x:from.x+h/3,y:from.y+distributionTangentOffset(model,from.x,h)/3},c2:{x:to.x-h/3,y:to.y-distributionTangentOffset(model,to.x,h)/3}};
}
function sampleDistribution(model:Distribution):DistributionPoint[]{
 // Seed around the mode in dimensionless coordinates. Uniform sampling across
 // a very long domain could miss a narrow peak altogether.
 const xs=[model.origin,model.peak,model.end];
 if(model.kind==='normal'){
  // Both tails need seeds measured in σ, independently of the display range.
  // In particular, a tiny σ in a wide domain must retain its central bell.
  for(let z=1;z<=64;z*=2)for(const direction of [-1,1]){
   const x=model.peak+direction*model.sigma*z;
   if(x>model.origin&&x<model.end)xs.push(x);
  }
 }else{
  const width=model.peak-model.origin;
  for(let z=2;z<2048;z*=2){
   const x=model.origin+width*z;
   if(x>=model.end)break;
   xs.push(x);
   if(distributionValue(model,x)===model.baseline)break;
  }
 }
 const samples=[...new Set(xs)].sort((a,b)=>a-b).map(x=>({x,y:distributionValue(model,x)}));
 const error=(from:DistributionPoint,to:DistributionPoint)=>{
  if((from.x+to.x)/2===from.x||(from.x+to.x)/2===to.x)return 0;
  const {c1,c2}=distributionControls(model,from,to);
  let largest=0;
  for(const t of [.25,.5,.75]){
   const u=1-t,x=from.x+(to.x-from.x)*t;
   const y=from.y+3*u*u*t*(c1.y-from.y)+3*u*t*t*(c2.y-from.y)+t*t*t*(to.y-from.y);
   largest=Math.max(largest,Math.abs(y-distributionValue(model,x))/model.height);
  }
  // Ordered controls prevent tiny artificial extrema at the long tail.
  const lo=Math.min(from.y,to.y),hi=Math.max(from.y,to.y);
  for(const c of [c1,c2])largest=Math.max(largest,(lo-c.y)/model.height,(c.y-hi)/model.height);
  return largest;
 };
 const errors=samples.slice(1).map((to,i)=>error(samples[i],to));
 while(samples.length<500){
  let largest=0,index=-1;
  errors.forEach((value,i)=>{if(value>largest){largest=value;index=i;}});
  if(largest<=1e-6||index<0)break;
  const from=samples[index],to=samples[index+1],x=from.x+(to.x-from.x)/2,middle={x,y:distributionValue(model,x)};
  samples.splice(index+1,0,middle);
  errors.splice(index,1,error(from,middle),error(middle,to));
 }
 return samples;
}
const lineStyle = z.enum(['solid','dashed','dotted','dash-dot','dash-dot-dot']);
const shading = z.object({curve:z.number().int().min(0).max(11),mode:z.enum(['baseline','between','closed','rectangle']),otherCurve:z.number().int().min(0).max(11).optional(),baseline:num,xStart:num,xEnd:num,yStart:num.optional(),yEnd:num.optional(),pattern:z.enum(['solid','hatch']),opacity:z.number().finite().min(.05).max(.6)}).superRefine((shade,ctx)=>{
 if(shade.mode!=='rectangle')return;
 if(shade.xStart>=shade.xEnd)ctx.addIssue({code:z.ZodIssueCode.custom,path:['xEnd'],message:'사각형의 가로 끝은 시작보다 커야 합니다.'});
 if(shade.yStart===undefined||shade.yEnd===undefined||shade.yStart>=shade.yEnd)ctx.addIssue({code:z.ZodIssueCode.custom,path:['yEnd'],message:'사각형의 세로 시작과 끝을 입력하고 끝을 더 크게 설정해 주세요.'});
});
const curveSchema=z.object({name:z.string().max(40),points:z.array(point).min(1).max(500),dashed:z.boolean(),lineStyle:lineStyle.optional(),smooth:z.boolean(),arrows:z.boolean(),dots:z.boolean(),distribution:distributionSchema.nullable().optional(),conic:conicSchema.nullable().optional()})
 .refine(curve=>!(curve.distribution&&curve.conic),{path:['conic'],message:'한 선에는 분포 공식과 원·타원 공식을 함께 적용할 수 없습니다.'})
 .transform(curve=>curve.distribution?{...curve,points:sampleDistribution(curve.distribution),smooth:true}:curve.conic?{...curve,points:sampleConic(curve.conic),smooth:true}:curve);
export const graphSchema = z.object({
 title:z.string().max(120), xLabel:z.string().max(80), yLabel:z.string().max(80),
 xMin:num,xMax:num,yMin:num,yMax:num,equalAxes:z.boolean().optional(),
 xTicks:z.array(tick).max(30),yTicks:z.array(tick).max(30),
 curves:z.array(curveSchema).max(12),
 shadings:z.array(shading).max(20).optional(),
 guides:z.array(z.object({x1:num,y1:num,x2:num,y2:num})).max(80),
 labels:z.array(z.object({x:num,y:num,text:z.string().max(120),dx:num,dy:num})).max(40),
 note:z.string().max(1000)
}).refine(g=>g.xMax>g.xMin&&g.yMax>g.yMin,{message:'축의 최댓값은 최솟값보다 커야 합니다.'});
export type Graph = z.infer<typeof graphSchema>;
export type LineStyle = z.infer<typeof lineStyle>;
export type Shading = NonNullable<Graph['shadings']>[number];
type Curve = Graph['curves'][number];
type Point = Curve['points'][number];
export function withDistribution(curve:Curve,model:Distribution):Curve{
 return curveSchema.parse({...curve,conic:null,distribution:model});
}
export function freeDistribution(curve:Curve):Curve{
 const {distribution:_,...free}=curve;
 return free;
}
export function distributionPeakIndex(curve:Curve):number{
 return curve.distribution?curve.points.findIndex(p=>p.x===curve.distribution!.peak):-1;
}
export function withConic(curve:Curve,model:Conic):Curve{
 return curveSchema.parse({...curve,distribution:null,conic:model});
}
export function freeConic(curve:Curve):Curve{
 const {conic:_,...free}=curve;
 return free;
}
export function conicHandleIndices(curve:Curve):number[]{
 return curve.conic?[0,4,8,12]:[];
}
type Segment = {from:Point;to:Point;c1?:Point;c2?:Point};
export function curveLineStyle(curve:Pick<Curve,'lineStyle'|'dashed'>):LineStyle{
 return curve.lineStyle??(curve.dashed?'dashed':'solid');
}
export function lineDashArray(style:LineStyle,width:number):string|undefined{
 if(style==='solid')return undefined;
 const unit=Number.isFinite(width)&&width>0?width:2.5;
 // Zero-length dashes with round caps produce circular dots. Scaling every
 // gap with the stroke width keeps them distinct even on heavier lines.
 const patterns={dashed:[2.4,2],dotted:[0,2.4],'dash-dot':[4,2,0,2],'dash-dot-dot':[4,2,0,2,0,2]};
 return patterns[style].map(value=>Number((value*unit).toFixed(4))).join(' ');
}
export function smoothConnectionIssue(points:Graph['curves'][number]['points']):string{
 if(points.length<3)return '매끄러운 곡선에는 점이 3개 이상 필요합니다.';
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return '좌표에 유한한 숫자를 입력해 주세요.';
 if(points.some((p,i)=>i>0&&p.x===points[i-1].x&&p.y===points[i-1].y))return '같은 위치의 점이 연속으로 있으면 곡선을 연결할 수 없습니다.';
 if(points.length===3&&points[0].x===points[2].x&&points[0].y===points[2].y)return '닫힌 곡선에는 서로 다른 점이 3개 이상 필요합니다.';
 return '';
}

function parametricSegments(points:Point[]):Segment[]{
 const closed=points[0].x===points.at(-1)!.x&&points[0].y===points.at(-1)!.y;
 const knots=closed?points.slice(0,-1):points;
 const neighbor=(index:number):Point=>{
  if(closed)return knots[(index+knots.length)%knots.length];
  if(index<0)return {x:2*knots[0].x-knots[1].x,y:2*knots[0].y-knots[1].y};
  if(index>=knots.length){const last=knots.length-1;return {x:2*knots[last].x-knots[last-1].x,y:2*knots[last].y-knots[last-1].y};}
  return knots[index];
 };
 return points.slice(1).map((to,i)=>{
  const from=points[i],before=neighbor(i-1),after=neighbor(i+2);
  // Centripetal Catmull–Rom uses chord-length square roots as its parameter.
  // Unlike an x-only interpolant this handles vertical tangents, loops and
  // paths that double back, with the same tangent on both sides of a seam.
  const a=Math.sqrt(Math.hypot(from.x-before.x,from.y-before.y));
  const b=Math.sqrt(Math.hypot(to.x-from.x,to.y-from.y));
  const c=Math.sqrt(Math.hypot(after.x-to.x,after.y-to.y));
  const control=(axis:'x'|'y')=>{
   const delta=to[axis]-from[axis];
   const m1=delta+b*((from[axis]-before[axis])/a-(to[axis]-before[axis])/(a+b));
   const m2=delta+b*((after[axis]-to[axis])/c-(after[axis]-from[axis])/(b+c));
   return [from[axis]+m1/3,to[axis]-m2/3];
  };
  const x=control('x'),y=control('y');
  return {from,to,c1:{x:x[0],y:y[0]},c2:{x:x[1],y:y[1]}};
 });
}

// Keep one set of Bézier controls for visible strokes, shading boundaries,
// direction arrows and insertion. Affine scaling preserves these cubics.
function curveSegments(curve:Curve):Segment[]{
 const points=curve.points,smooth=curve.smooth&&!smoothConnectionIssue(points);
 if(curve.distribution)return points.slice(1).map((to,i)=>({from:points[i],to,...distributionControls(curve.distribution!,points[i],to)}));
 if(curve.conic){
  const model=curve.conic,k=4/3*Math.tan(Math.PI/32);
  return points.slice(1).map((to,i)=>{
   const from=points[i],a=i*Math.PI/8,b=(i+1)*Math.PI/8;
   return {from,to,c1:{x:from.x-k*model.rx*Math.sin(a),y:from.y+k*model.ry*Math.cos(a)},c2:{x:to.x+k*model.rx*Math.sin(b),y:to.y-k*model.ry*Math.cos(b)}};
  });
 }
 if(smooth&&!points.every((p,i)=>!i||p.x>points[i-1].x))return parametricSegments(points);
 const tangentOffset=(i:number,h:number)=>{
  if(i===0)return points[1].y-points[0].y;
  if(i===points.length-1)return points[i].y-points[i-1].y;
  const dyA=points[i].y-points[i-1].y,dyB=points[i+1].y-points[i].y;
  if(!dyA||!dyB||Math.sign(dyA)!==Math.sign(dyB))return 0;
  const dxA=points[i].x-points[i-1].x,dxB=points[i+1].x-points[i].x;
  const a=Math.abs(dyA/dxA),b=Math.abs(dyB/dxB),small=Math.min(a,b),large=Math.max(a,b);
  if(Number.isFinite(large))return Math.sign(dyA)*(small/(1+small/large))*h*2;
  // Extremely small x units can overflow a world-space slope. The ratio
  // form keeps the offset bounded by twice the local y difference.
  const local=h===dxA?dyA:dyB,other=h===dxA?dyB:dyA,otherH=h===dxA?dxB:dxA;
  const logRatio=Math.log(Math.abs(local))-Math.log(h)-Math.log(Math.abs(other))+Math.log(otherH);
  return 2*local/(1+Math.exp(logRatio));
 };
 return points.slice(1).map((to,i)=>{
  const from=points[i],h=to.x-from.x;
  return smooth?{from,to,c1:{x:from.x+h/3,y:from.y+tangentOffset(i,h)/3},c2:{x:to.x-h/3,y:to.y-tangentOffset(i+1,h)/3}}:{from,to};
 });
}
function segmentPoint(segment:Segment,t:number):Point{
 const {from,to,c1,c2}=segment;
 if(t===0)return {...from};
 if(t===1)return {...to};
 if(!c1||!c2)return {x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
 const u=1-t;
 // Use offsets from the first point to preserve small differences at large
 // translated coordinates. Both axes use the exact controls that are drawn.
 const value=(a:number,b:number,c:number,d:number)=>a+3*u*u*t*(b-a)+3*u*t*t*(c-a)+t*t*t*(d-a);
 return {x:value(from.x,c1.x,c2.x,to.x),y:value(from.y,c1.y,c2.y,to.y)};
}
export function pointOnCurve(curve:Curve,segment:number,t:number):Point{
 if(!Number.isInteger(segment)||segment<0||segment>=curve.points.length-1)throw Error('점을 추가할 선분을 찾을 수 없습니다.');
 if(!Number.isFinite(t)||t<0||t>1)throw Error('선분 안의 위치를 선택해 주세요.');
 return segmentPoint(curveSegments(curve)[segment],t);
}
function unitPolynomialRoots(coefficients:number[]):number[]{
 const scale=Math.max(...coefficients.map(Math.abs));
 if(!scale)return [];
 const p=coefficients.map(c=>c/scale);
 while(p.length>1&&Math.abs(p.at(-1)!)<1e-14)p.pop();
 if(p.length===1)return [];
 if(p.length===2){const root=-p[0]/p[1];return root>=0&&root<=1?[root]:[];}
 const value=(t:number)=>p.reduceRight((sum,c)=>sum*t+c,0);
 const critical=unitPolynomialRoots(p.slice(1).map((c,i)=>c*(i+1)));
 const boundaries=[0,...critical.filter(t=>t>0&&t<1),1],roots:number[]=[];
 const add=(t:number)=>{if(!roots.some(root=>Math.abs(t-root)<1e-9))roots.push(t);};
 for(const t of boundaries)if(Math.abs(value(t))<1e-12)add(t);
 for(let i=1;i<boundaries.length;i++){
  let lo=boundaries[i-1],hi=boundaries[i],left=value(lo);
  if(left*value(hi)>=0)continue;
  for(let pass=0;pass<48;pass++){
   const mid=(lo+hi)/2,v=value(mid);
   if(left*v<=0)hi=mid;else{lo=mid;left=v;}
  }
  add((lo+hi)/2);
 }
 return roots.sort((a,b)=>a-b);
}
export function nearestCurvePosition(curve:Curve,point:Point,scaleX:number,scaleY:number):{segment:number;t:number;point:Point;distance:number}{
 if(curve.points.length<2)throw Error('점을 추가하려면 선에 점이 두 개 이상 있어야 합니다.');
 if(![point.x,point.y,scaleX,scaleY].every(Number.isFinite)||scaleX===0||scaleY===0)throw Error('유효한 좌표와 화면 배율을 입력해 주세요.');
 let best={segment:0,t:0,point:{...curve.points[0]},distance:Infinity};
 for(const [index,segment] of curveSegments(curve).entries()){
  const distance=(t:number)=>{const p=segmentPoint(segment,t);return ((p.x-point.x)*scaleX)**2+((p.y-point.y)*scaleY)**2;};
  const consider=(t:number)=>{
   const d=distance(t);
   if(d<best.distance)best={segment:index,t,point:segmentPoint(segment,t),distance:d};
  };
  if(!segment.c1){
   const dx=(segment.to.x-segment.from.x)*scaleX,dy=(segment.to.y-segment.from.y)*scaleY,denominator=dx*dx+dy*dy;
   consider(denominator?Math.max(0,Math.min(1,((point.x-segment.from.x)*scaleX*dx+(point.y-segment.from.y)*scaleY*dy)/denominator)):0);
   continue;
  }
  // The derivative of squared distance to a cubic is a degree-five
  // polynomial. Isolating its roots finds all candidate minima, including
  // those very close to a knot, without projecting onto straight chords.
  const coefficients=(axis:'x'|'y',scale:number)=>{
   const start=segment.from[axis],a=segment.c1![axis]-start,b=segment.c2![axis]-start,c=segment.to[axis]-start;
   return [(start-point[axis])*scale,3*a*scale,(3*b-6*a)*scale,(c+3*a-3*b)*scale];
  };
  const derivative=Array<number>(6).fill(0);
  for(const axis of [coefficients('x',scaleX),coefficients('y',scaleY)])for(let i=0;i<axis.length;i++)for(let j=1;j<axis.length;j++)derivative[i+j-1]+=axis[i]*axis[j]*j;
  consider(0);consider(1);
  for(const t of unitPolynomialRoots(derivative))consider(t);
 }
 return {...best,distance:Math.sqrt(best.distance)};
}
function orderedFunction(curve:Curve){
 return curve.points.length>=2&&curve.points.every((p,i)=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&(!i||p.x>curve.points[i-1].x));
}
function shadingRange(graph:Graph,shade:Shading):[number,number]{
 const curve=graph.curves[shade.curve],other=shade.mode==='between'?graph.curves[shade.otherCurve!]:undefined;
 return [Math.max(graph.xMin,shade.xStart,curve.points[0].x,other?.points[0].x??-Infinity),Math.min(graph.xMax,shade.xEnd,curve.points.at(-1)!.x,other?.points.at(-1)?.x??Infinity)];
}
export function shadingIssue(graph:Graph,shade:Shading):string{
 if(!shading.safeParse(shade).success)return '음영의 좌표, 진하기, 선 선택 값을 확인해 주세요.';
 if(shade.mode==='rectangle')return Math.max(graph.xMin,shade.xStart)<Math.min(graph.xMax,shade.xEnd)&&Math.max(graph.yMin,shade.yStart!)<Math.min(graph.yMax,shade.yEnd!)?'':'사각형 음영이 현재 축 범위와 겹쳐야 합니다.';
 const curve=graph.curves[shade.curve];
 if(!curve)return '음영을 적용할 선을 선택해 주세요.';
 if(shade.mode==='closed'){
  const first=curve.points[0],last=curve.points.at(-1);
  return curve.points.length>=4&&first.x===last?.x&&first.y===last.y?'':'닫힌 영역은 점이 4개 이상이고 첫 점과 마지막 점이 같아야 합니다.';
 }
 if(!orderedFunction(curve))return '구간 음영은 점이 2개 이상이고 왼쪽부터 순서대로 이어진 선에 사용할 수 있습니다.';
 if(shade.xStart>=shade.xEnd)return '음영 구간의 끝은 시작보다 커야 합니다.';
 if(shade.mode==='between'){
  const other=graph.curves[shade.otherCurve!];
  if(!other||shade.otherCurve===shade.curve)return '사이 영역을 만들 다른 선을 선택해 주세요.';
  if(!orderedFunction(other))return '두 선 모두 점이 2개 이상이고 왼쪽부터 순서대로 이어져야 합니다.';
 }
 const [start,end]=shadingRange(graph,shade);
 return start<end?'':'선과 음영 구간이 현재 축 범위 안에서 겹쳐야 합니다.';
}
export type Style = {lineWidth:number;fontSize:number;guides:boolean;arrows:boolean;transparent:boolean;width:number;height:number;font:'serif'|'sans'|'dotum'};
export const graphFontFamilies:Record<Style['font'],string>={
 serif:"'Times New Roman', 'Noto Serif KR', 'Batang', serif",
 sans:"'Arial', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
 dotum:"'Dotum', '돋움', 'AppleGothic', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
};
export const defaultStyle:Style={lineWidth:2.5,fontSize:23,guides:true,arrows:true,transparent:false,width:760,height:540,font:'serif'};
const curve=(name:string,pts:number[][],opts:Partial<Graph['curves'][number]>={}):Graph['curves'][number]=>({name,points:pts.map(([x,y])=>({x,y})),dashed:false,smooth:false,arrows:false,dots:false,...opts});
const ticks=(values:number[],labels?:string[])=>values.map((value,i)=>({value,label:labels?.[i]??String(value)}));
const guide=(x1:number,y1:number,x2:number,y2:number)=>({x1,y1,x2,y2});
const label=(x:number,y:number,text:string,dx=0,dy=-14)=>({x,y,text,dx,dy});
const base:Graph={title:'전류의 시간 변화',xLabel:'시간',yLabel:'I_1',xMin:0,xMax:5,yMin:0,yMax:4,xTicks:ticks([1,2,3,4],['t_0','2t_0','3t_0','4t_0']),yTicks:ticks([1,2,3],['I_0','2I_0','3I_0']),curves:[curve('전류',[[0,0],[2,3],[4,1]])],guides:[1,2,3].map(y=>guide(0,y,4,y)).concat([1,2,3,4].map(x=>guide(x,0,x,3))),labels:[],note:''};
const samples=(f:(x:number)=>number,a:number,b:number,n=100)=>Array.from({length:n+1},(_,i)=>[a+(b-a)*i/n,f(a+(b-a)*i/n)]);
const distributionCurve=(name:string,peak:number,power:number,height=1,dashed=false)=>withDistribution(curve(name,[[0,0]],{dashed}),{kind:'gamma',origin:0,peak,height,power,baseline:0,end:10});
export const presets:{id:string;subject:string;name:string;description:string;graph:Graph}[]=[
 {id:'current',subject:'물리학',name:'전류 · 시간',description:'시간에 따라 증가한 뒤 감소하는 전류',graph:base},
 {id:'pv',subject:'물리학',name:'기체의 순환 과정',description:'A → B → C → D → A의 P–V 그래프',graph:{...base,title:'기체의 순환 과정',xLabel:'V',yLabel:'P',xMax:3,yMax:2.7,xTicks:ticks([1,2],['V_0','2V_0']),yTicks:ticks([1,2],['P_0','2P_0']),curves:[curve('순환 과정',[[1,1],[1,2],[2,2],[2,1],[1,1]],{arrows:true,dots:true})],guides:[guide(0,1,2,1),guide(0,2,2,2),guide(1,0,1,1),guide(2,0,2,1)],labels:[label(1,1,'A',-22,26),label(1,2,'B',0,-20),label(2,2,'C',0,-20),label(2,1,'D',24,20)]}},
 {id:'wave',subject:'물리학',name:'두 매질의 파동',description:'경계 x = 6에서 파장이 달라지는 파동',graph:{...base,title:'두 매질에서의 파동',xLabel:'x (m)',yLabel:'변위',xMax:16,yMin:-1.5,yMax:1.7,xTicks:ticks([1,2,3,4,5,6,8,10,12,14]),yTicks:[],curves:[curve('파동',samples(x=>x<=6?-Math.cos(Math.PI*x/2):Math.cos(Math.PI*(x-6)/4),0,15.5,200))],guides:[guide(6,-1.3,6,1.4)],labels:[label(3,1.3,'매질 A'),label(10.5,1.3,'매질 B')]}},
 {id:'distance',subject:'물리학',name:'거리 · 시간',description:'두 물체 사이의 거리 변화',graph:{...base,title:'B와 C 사이의 거리',xLabel:'t (초)',yLabel:'거리\n(m)',xMax:8.5,yMax:17,xTicks:ticks([1,2,3,4,5,6,7]),yTicks:ticks([8,12,14]),curves:[curve('거리',[[0,12],[2,0],[4,8],[7.5,15]])],guides:[guide(0,8,4,8),guide(4,0,4,8),guide(0,14,7,14),guide(7,0,7,14)],labels:[]}},
 {id:'magnetic',subject:'물리학',name:'자기장 · 전류',description:'전류가 증가할수록 감소하는 자기장',graph:{...base,title:'자기장과 전류의 관계',xLabel:'I_P',yLabel:'B',xMax:2.1,yMax:3.7,xTicks:ticks([1,1.5],['I_0','1.5I_0']),yTicks:ticks([1],['B_1']),curves:[curve('자기장',[[0,3],[1.5,0]])],guides:[guide(0,1,1,1),guide(1,0,1,1)],labels:[]}},
 {id:'distribution',subject:'생명과학',name:'형질의 분포',description:'부리 크기에 따른 두 개체군의 분포',graph:{...base,title:'개체군의 형질 분포',xLabel:'부리 크기',yLabel:'개체 수',xMax:11,yMax:1.3,xTicks:[],yTicks:[],curves:[distributionCurve("P′",2,3),distributionCurve('P',4.5,5,.6,true)],guides:[],labels:[label(2.5,1,'P′',20,-5),label(6.3,.43,'P',12,-12)],note:'⚠ 개체 수준에서 그래프 변형은 실제 자연, 과학적 사실과 일치하지 않을 수 있으니 출제 시 유의하세요.'}},
 {id:'normal',subject:'공통',name:'정규분포',description:'평균 μ와 표준편차 σ로 조절하는 대칭 분포',graph:{...base,title:'정규분포',xLabel:'x',yLabel:'상대 도수',xMax:8.5,yMax:1.3,xTicks:ticks([3,4,5],['\\mu-\\sigma','\\mu','\\mu+\\sigma']),yTicks:[],curves:[withDistribution(curve('정규분포',[[0,0]]),{kind:'normal',origin:0,peak:4,sigma:1,height:1,baseline:0,end:8})],guides:[guide(0,1,4,1),guide(4,0,4,1)],labels:[],note:'평균 μ, 표준편차 σ와 봉우리 높이를 조절하는 정규분포 모양의 예시입니다.'}},
 {id:'chemistry',subject:'화학',name:'중화 반응의 온도',description:'혼합 용액의 최고 온도 비교',graph:{...base,title:'혼합 용액의 최고 온도',xLabel:'부피 (mL)',yLabel:'최고 온도\n(°C)',xMax:50,yMax:3.2,xTicks:ticks([20,30,40],['20\n40','30\n30','40\n20']),yTicks:ticks([1],['t_1']),curves:[curve('측정값',[[20,1]],{dots:true}),curve('측정값',[[30,2.7]],{dots:true}),curve('측정값',[[40,1]],{dots:true})],guides:[guide(0,1,45,1),...([20,30,40].map(x=>guide(x,0,x,3)))],labels:[label(7,0,'HCl\nNaOH',0,31),label(20,1,'(가)',24,-12),label(30,2.7,'(나)',24,-12),label(40,1,'(다)',24,-12)],note:'NaOH 부피는 HCl 부피와 합이 60 mL가 되도록 설정한 예시입니다.'}},
 {id:'spectrum',subject:'지구과학',name:'복사 에너지 분포',description:'연속 곡선과 흡수선이 있는 스펙트럼',graph:{...base,title:'파장에 따른 복사 에너지',xLabel:'파장',yLabel:'에너지의\n상대 세기',xMax:10.5,yMax:1.3,xTicks:[],yTicks:[],curves:[curve('ㄱ',samples(x=>Math.pow(x/1.5,2)*Math.exp(2-2*x/1.5),0,10,200)),curve('ㄴ',samples(x=>{const b=.65*Math.pow(x/1.6,2)*Math.exp(2-2*x/1.6);return b*(1-.65*Math.pow(Math.sin(x*9),18));},0,10,400))],guides:[],labels:[label(2.3,.85,'ㄱ',18,-15),label(2.4,.5,'ㄴ',18,-10)],note:'형태를 재현한 예시이며 실제 측정 스펙트럼은 아닙니다.'}}
];
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function rich(s:string){return s.split(/(_\{[^}]+\}|\^\{[^}]+\}|_[A-Za-z0-9]+|\^[A-Za-z0-9]+)/).map(t=>/^[_^]/.test(t)?`<tspan baseline-shift="${t[0]==='_'?'sub':'super'}" font-size="70%">${esc(t.slice(1).replace(/[{}]/g,''))}</tspan>`:esc(t).replace(/([A-Za-z]+)/g,word=>/^(m|s|kg|mol|mL|Pa|Hz|cm|HCl|NaOH)$/.test(word)?word:word.replace(/[A-Za-z]/g,'<tspan font-style="italic">$&</tspan>'))).join('');}
export function graphLayout(g:Graph,s:Style=defaultStyle){
 const w=s.width,h=s.height;
 let L=Math.min(w*.34,Math.max(Math.min(112,w*.2),Math.max(...g.yLabel.split('\n').map(t=>t.replace(/\\[a-zA-Z]+/g,'').replace(/[_^{}]/g,'').length))*s.fontSize*.8+22)),R=w-Math.min(95,w*.14),T=Math.min(66,h*.14),B=h-Math.min(95,h*.2);
 let equalScale:number|undefined;
 if(g.equalAxes??g.curves.some(curve=>!!curve.conic)){
  // Fit the declared domain into the available rectangle at one shared unit
  // scale. Updating the bounds also keeps clipping, axes and inverse dragging
  // aligned with the centered plot, without modifying the saved axis limits.
  const scale=Math.min((R-L)/(g.xMax-g.xMin),(B-T)/(g.yMax-g.yMin));
  equalScale=scale;
  const width=(g.xMax-g.xMin)*scale,height=(g.yMax-g.yMin)*scale;
  const centerX=(L+R)/2,centerY=(T+B)/2;
  L=centerX-width/2;R=centerX+width/2;T=centerY-height/2;B=centerY+height/2;
 }
 const dx=equalScale??(R-L)/(g.xMax-g.xMin),dy=equalScale??(B-T)/(g.yMax-g.yMin);
 const X=(x:number)=>L+(x-g.xMin)*dx,Y=(y:number)=>B-(y-g.yMin)*dy;
 const zx=Math.max(g.xMin,Math.min(0,g.xMax)),zy=Math.max(g.yMin,Math.min(0,g.yMax)),ox=X(zx),oy=Y(zy);
 return {w,h,L,R,T,B,dx,dy,X,Y,zx,zy,ox,oy,world:(x:number,y:number)=>({x:g.xMin+(x-L)/dx,y:g.yMin+(B-y)/dy})};
}
export function renderGraph(g:Graph,s:Style=defaultStyle,id='plot'){
 const {w,h,L,R,T,B,X,Y,zx,zy,ox,oy}=graphLayout(g,s);
 const n=(x:number)=>Math.round(x*100)/100;
 const text=(x:number,y:number,t:string,anchor='middle',size=s.fontSize,edit='')=>`<text ${edit?`data-edit="${edit}"`:''} data-label="${esc(t).replace(/\n/g,'&#10;')}" x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-size="${size}" fill="#151515">${t.split('\n').map((line,i)=>`<tspan x="${n(x)}" dy="${i?1.2:0}em">${rich(line)}</tspan>`).join('')}</text>`;
 const line=(x1:number,y1:number,x2:number,y2:number,extra='')=>`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${extra}/>`;
 const a=s.arrows?`marker-end="url(#${id}-arrow)"`:'';
 const geometries=g.curves.map(curveSegments);
 const pathData=(ci:number,reverse=false,start='M')=>{
  const curve=g.curves[ci],segments=geometries[ci];
  const first=reverse?curve.points.at(-1):curve.points[0];
  if(!first)return '';
  let d=`${start}${n(X(first.x))},${n(Y(first.y))}`;
  for(const segment of reverse?[...segments].reverse():segments){
   const to=reverse?segment.from:segment.to,c1=reverse?segment.c2:segment.c1,c2=reverse?segment.c1:segment.c2;
   d+=c1&&c2?` C${n(X(c1.x))},${n(Y(c1.y))} ${n(X(c2.x))},${n(Y(c2.y))} ${n(X(to.x))},${n(Y(to.y))}`:` L${n(X(to.x))},${n(Y(to.y))}`;
  }
  return d;
 };
 let shadeDefs='',shadePaths='';
 for(const [index,shade] of (g.shadings??[]).entries()){
  if(shadingIssue(g,shade))continue;
  const [start,end]=shade.mode==='closed'||shade.mode==='rectangle'?[g.xMin,g.xMax]:shadingRange(g,shade);
  const clip=`${id}-shade-clip-${index}`,hatch=`${id}-shade-hatch-${index}`;
  shadeDefs+=`<clipPath id="${clip}"><rect x="${X(start)}" y="${T}" width="${X(end)-X(start)}" height="${B-T}"/></clipPath>`;
  if(shade.pattern==='hatch')shadeDefs+=`<pattern id="${hatch}" patternUnits="userSpaceOnUse" width="7" height="7"><path d="M-1 1 L1 -1 M0 7 L7 0 M6 8 L8 6" fill="none" stroke="#151515" stroke-width="1.2"/></pattern>`;
  let d:string;
  if(shade.mode==='rectangle'){
   d=`M${n(X(shade.xStart))},${n(Y(shade.yStart!))} L${n(X(shade.xEnd))},${n(Y(shade.yStart!))} L${n(X(shade.xEnd))},${n(Y(shade.yEnd!))} L${n(X(shade.xStart))},${n(Y(shade.yEnd!))}`;
  }else{
   const curve=g.curves[shade.curve],first=curve.points[0],last=curve.points.at(-1)!;
   d=pathData(shade.curve);
   if(shade.mode==='baseline')d+=` L${n(X(last.x))},${n(Y(shade.baseline))} L${n(X(first.x))},${n(Y(shade.baseline))}`;
   if(shade.mode==='between')d+=' '+pathData(shade.otherCurve!,true,'L');
  }
  shadePaths+=`<path data-shading="${index}" d="${d} Z" fill="${shade.pattern==='hatch'?`url(#${hatch})`:'#151515'}" fill-rule="evenodd" opacity="${shade.opacity}" clip-path="url(#${clip})"/>`;
 }
 let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-korean-font="${s.font}" role="img" aria-label="${esc(g.title)}"><title>${esc(g.title)}</title><defs><marker id="${id}-arrow" viewBox="0 0 12 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L12 5 L0 10 L3 5Z" fill="#151515"/></marker><clipPath id="${id}-clip"><rect x="${L-12}" y="${T-12}" width="${R-L+24}" height="${B-T+24}"/></clipPath>${shadeDefs}</defs>${s.transparent?'':`<rect width="${w}" height="${h}" fill="white"/>`}<g font-family="${graphFontFamilies[s.font]}" font-style="normal">${shadePaths}`;
 if(s.guides)out+=`<g stroke="#666" stroke-width="${s.lineWidth*.6}" stroke-dasharray="5 4" clip-path="url(#${id}-clip)">${g.guides.map(p=>line(X(p.x1),Y(p.y1),X(p.x2),Y(p.y2))).join('')}</g>`;
 out+=`<g stroke="#151515" stroke-width="${s.lineWidth*.7}" fill="none">${line(L,oy,R+20,oy,a)}${line(ox,B,ox,T-22,a)}</g>`;
 out+=text(R+20,oy+43,g.xLabel,'end',s.fontSize,'axis:x')+text(ox-17,T-25,g.yLabel,'end',s.fontSize,'axis:y')+(g.xMin<=0&&g.xMax>=0&&g.yMin<=0&&g.yMax>=0?text(ox-15,oy+27,'0'):'');
 g.xTicks.forEach((t,i)=>{if(t.value<g.xMin||t.value>g.xMax||t.value===zx)return;out+=line(X(t.value),oy-4,X(t.value),oy+4,`stroke="#151515" stroke-width="1"`)+text(X(t.value),oy+31,t.label,'middle',s.fontSize,`tick:x:${i}`);});
 g.yTicks.forEach((t,i)=>{if(t.value<g.yMin||t.value>g.yMax||t.value===zy)return;out+=text(ox-12,Y(t.value)+s.fontSize*.33,t.label,'end',s.fontSize,`tick:y:${i}`);});
 for(const [ci,c] of g.curves.entries()){
  const visiblePoints=c.distribution?[c.points[distributionPeakIndex(c)]]:c.conic?conicHandleIndices(c).map(i=>c.points[i]):c.points;
  const pts=visiblePoints.filter(Boolean).map(p=>[X(p.x),Y(p.y)]),d=pathData(ci),dashArray=lineDashArray(curveLineStyle(c),s.lineWidth);
  const arrowGeometry=c.distribution?[geometries[ci][Math.min(geometries[ci].length-1,distributionPeakIndex(c)+Math.floor((c.points.length-distributionPeakIndex(c))/4))]].filter(Boolean):c.conic?[0,4,8,12].map(i=>geometries[ci][i]):geometries[ci];
  const arrowSegments=c.arrows?arrowGeometry.map(segment=>{
   const p=segmentPoint(segment,.48),q=segmentPoint(segment,.56);
   return [X(p.x),Y(p.y),X(q.x),Y(q.y)];
  }):[];
  out+=`<g clip-path="url(#${id}-clip)"><path data-edit="curve:${ci}" d="${d}" fill="none" stroke="#151515" stroke-width="${s.lineWidth}" stroke-linejoin="round" stroke-linecap="round" ${dashArray?`stroke-dasharray="${dashArray}"`:''}/>`;
  if(c.dots)out+=pts.map(([x,y])=>`<circle cx="${n(x)}" cy="${n(y)}" r="${s.lineWidth*2}" fill="#151515"/>`).join('');
  if(c.arrows)for(const [x,y,xx,yy] of arrowSegments)out+=line(x,y,xx,yy,`stroke="#151515" stroke-width="${s.lineWidth}" marker-end="url(#${id}-arrow)"`);
  out+='</g>';
 }
 out+=g.labels.map((l,i)=>(l.text==='0'&&l.x===0&&l.y===0&&g.xMin<=0&&g.xMax>=0&&g.yMin<=0&&g.yMax>=0)?'':text(X(l.x)+l.dx,Y(l.y)+l.dy,l.text,'middle',s.fontSize,`label:${i}`)).join('');return out+'</g></svg>';
}
export function parseCoordinates(input:string,strict=false):{x:number;y:number}[]{
 const scalar='[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
 const coordinates=new RegExp(`\\(\\s*(${scalar})\\s*,\\s*(${scalar})\\s*\\)`,'g');
 const matches=[...input.matchAll(coordinates)];
 if(strict&&input.replace(coordinates,'').replace(/[,\s]/g,''))throw Error('좌표 형식을 확인해 주세요. 예: (0,0), (2,3), (4,1)');
 if(matches.length<2)throw Error('좌표를 두 개 이상 입력해 주세요. 예: (0,0), (2,3), (4,1)');
 if(matches.length>500)throw Error('좌표는 500개까지 입력할 수 있습니다.');
 const points=matches.map(m=>({x:Number(m[1]),y:Number(m[2])}));
 if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1000000||Math.abs(p.y)>1000000))throw Error('좌표는 -1,000,000부터 1,000,000까지 입력해 주세요.');
 return points;
}
export function fromCoordinates(input:string):Graph{
 const points=parseCoordinates(input),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 const minX=Math.min(0,...xs),minY=Math.min(0,...ys),maxX=Math.max(0,...xs),maxY=Math.max(0,...ys),spanX=Math.max(1,maxX-minX),spanY=Math.max(1,maxY-minY);
 const xt=[...new Set(xs)].sort((a,b)=>a-b).slice(0,20),yt=[...new Set(ys)].sort((a,b)=>a-b).slice(0,20);
 const xLabel=input.match(/(?:x축|가로축)\s*[:=은는]?\s*([^,;\n]+?)(?=\s*(?:y축|세로축|[.;\n]|$))/)?.[1]?.trim()||'x';
 const yLabel=input.match(/(?:y축|세로축)\s*[:=은는]?\s*([^,;\n.]+)/)?.[1]?.trim()||'y';
 return {...base,title:'좌표로 만든 그래프',xLabel,yLabel,xMin:minX,xMax:maxX+spanX*.2,yMin:minY,yMax:maxY+spanY*.2,xTicks:ticks(xt),yTicks:ticks(yt),curves:[curve('그래프',points.map(p=>[p.x,p.y]),{smooth:/곡선|부드럽/.test(input),dots:/점 표시/.test(input)})],guides:points.slice(0,40).flatMap(p=>[guide(zero(minX),p.y,p.x,p.y),guide(p.x,zero(minY),p.x,p.y)]),labels:[],note:'입력한 좌표를 연결했습니다. 추가 조건은 세부 편집에서 조절해 주세요.'};
}
const zero=(v:number)=>Math.max(v,0);
