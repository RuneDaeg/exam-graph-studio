export type AxisScaleKind='linear'|'log';
export type AxisBreak={from:number;to:number};
export type AxisOptions={min:number;max:number;scale?:AxisScaleKind;reversed?:boolean;break?:AxisBreak};

/** A finite, invertible coordinate mapping. A broken interval is represented by
 * a fixed screen gap; hit testing snaps that gap to its nearest visible edge. */
export function createAxisScale(axis:AxisOptions,start:number,end:number,spanOverride?:number){
 const screenSpan=spanOverride??(end-start);
 const log=axis.scale==='log', transform=(value:number)=>log?Math.log(value):value;
 const lo=transform(axis.min),hi=transform(axis.max),span=hi-lo;
 const safeSpan=Number.isFinite(span)&&span>0?span:1;
 const unit=(value:number)=>(transform(value)-lo)/safeSpan;
 const gap=axis.break;
 const a=gap?unit(gap.from):0,b=gap?unit(gap.to):0;
 const gapSize=gap?Math.min(.055,14/Math.max(1,Math.abs(screenSpan))):0;
 const visibleSpan=gap?1-(b-a):1;
 const stretch=gap?(1-gapSize)/visibleSpan:1;
 const before=a*stretch,after=before+gapSize;
 const compress=(u:number)=>!gap?u:u<=a?u*stretch:u>=b?after+(u-b)*stretch:before+(u-a)/(b-a)*gapSize;
 const expand=(v:number)=>!gap?v:v<=before?v/stretch:v>=after?b+(v-after)/stretch:Math.abs(v-before)<=Math.abs(v-after)?a:b;
 const pixel=(v:number)=>start+(axis.reversed?1-v:v)*screenSpan;
 const forward=(value:number)=>{
  // Invalid logarithmic values are outside the drawable area. Returning a
  // finite off-screen location keeps SVG exports valid even for raw drafts.
  if(!Number.isFinite(value)||(log&&value<=0))return pixel(-1000000);
  const result=pixel(compress(unit(value)));
  return Number.isFinite(result)?Math.max(-1e9,Math.min(1e9,result)):pixel(value<axis.min?-1000000:1000000);
 };
 const inverse=(value:number)=>{
  let v=(value-start)/screenSpan;if(axis.reversed)v=1-v;
  const u=expand(v);
  if(u===0)return axis.min;if(u===1)return axis.max;
  const transformed=lo+u*safeSpan,result=log?Math.exp(transformed):transformed;
  return Number.isFinite(result)?result:result>0?Number.MAX_VALUE:-Number.MAX_VALUE;
 };
 const visible=(value:number)=>Number.isFinite(value)&&(!log||value>0)&&(!gap||value<=gap.from||value>=gap.to);
 const contains=(value:number)=>visible(value)&&value>=axis.min&&value<=axis.max;
 const intervals=gap?[[axis.min,gap.from],[gap.to,axis.max]]:[[axis.min,axis.max]];
 const pixelIntervals=intervals.map(([from,to])=>[Math.min(forward(from),forward(to)),Math.max(forward(from),forward(to))] as [number,number]);
 const gapPixels=gap?[Math.min(forward(gap.from),forward(gap.to)),Math.max(forward(gap.from),forward(gap.to))] as [number,number]:undefined;
 const nominal=screenSpan/(axis.max-axis.min)*(axis.reversed?-1:1);
 return {forward,inverse,visible,contains,pixelIntervals,gapPixels,nonlinear:log||!!gap,nominal:Number.isFinite(nominal)?nominal:Math.sign(nominal)*Number.MAX_VALUE};
}
