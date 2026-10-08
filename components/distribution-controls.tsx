'use client';

import {useEffect,useId,useState} from 'react';
import katex from 'katex';
import {freeDistribution,withDistribution,type Distribution,type Graph} from '@/lib/graph';
import './distribution-controls.css';

type Curve=Graph['curves'][number];
type Fields=Record<'peak'|'height'|'power'|'sigma'|'origin'|'baseline'|'end',string>;
const formulas={
 gamma:katex.renderToString(String.raw`y=b+h\,u^p e^{p(1-u)},\quad u=\frac{x-a}{m-a}\;(x\ge a)`,{throwOnError:false,trust:false}),
 normal:katex.renderToString(String.raw`y=b+h\exp\!\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)`,{throwOnError:false,trust:false}),
};
const fieldValues=(model:Distribution):Fields=>({peak:String(model.peak),height:String(model.height),power:String(model.kind==='gamma'?model.power:Math.min(80,Math.max(2,((model.peak-model.origin)/model.sigma)**2))),sigma:String(model.kind==='normal'?model.sigma:(model.peak-model.origin)/Math.sqrt(model.power)),origin:String(model.origin),baseline:String(model.baseline),end:String(model.end)});

function initialDistribution(curve:Curve,kind:Distribution['kind']):Distribution{
 const xs=curve.points.map(point=>point.x),ys=curve.points.map(point=>point.y);
 const left=Math.min(...xs),right=Math.max(...xs),low=Math.min(...ys),high=Math.max(...ys);
 const origin=left,end=right;
 const highest=curve.points.find(point=>point.y===high)?.x;
 const peak=highest!==undefined&&highest>origin&&highest<end?highest:origin+(end-origin)/(kind==='normal'?2:3);
 const common={origin,peak,end,baseline:low,height:high-low};
 return kind==='normal'?{...common,kind,sigma:Math.min(peak-origin,end-peak)/3}:{...common,kind,power:3};
}

export function DistributionControls({curve,onChange}:{curve:Curve;onChange:(curve:Curve)=>void}){
 const id=useId();
 const [error,setError]=useState(''),[kind,setKind]=useState<Distribution['kind']>('gamma');
 if(curve.distribution)return <DistributionFields curve={curve} model={curve.distribution} onChange={onChange}/>;
 const xs=curve.points.map(point=>point.x),ys=curve.points.map(point=>point.y);
 const unavailable=curve.points.length<3||Math.max(...xs)<=Math.min(...xs)||Math.max(...ys)<=Math.min(...ys);
 return <div className="distribution-start">
  <div className="distribution-start-actions">
   <label className="distribution-kind" htmlFor={`${id}-kind`}>분포 종류<select id={`${id}-kind`} value={kind} onChange={event=>{setKind(event.target.value as Distribution['kind']);setError('');}}><option value="gamma">감마형 분포</option><option value="normal">정규분포</option></select></label>
   <button type="button" className="button" disabled={unavailable} onClick={()=>{try{onChange(withDistribution(curve,initialDistribution(curve,kind)));setError('');}catch(e){setError(e instanceof Error?e.message:'분포 값을 확인해 주세요.');}}}>분포 공식 적용</button>
  </div>
  <p>{unavailable?'분포 공식은 폭과 높이가 있고 점이 3개 이상인 선에 적용할 수 있습니다.':kind==='normal'?'봉우리 위치와 높이를 기준으로 좌우 대칭인 정규분포 곡선으로 바꿉니다.':'봉우리 위치와 높이를 기준으로 매끄러운 감마형 분포 곡선으로 바꿉니다.'}</p>
  {error&&<p className="distribution-error" role="alert">{error}</p>}
 </div>;
}

function DistributionFields({curve,model,onChange}:{curve:Curve;model:Distribution;onChange:(curve:Curve)=>void}){
 const id=useId();
 const [kind,setKind]=useState<Distribution['kind']>(model.kind);
 const [fields,setFields]=useState(()=>fieldValues(model)),[error,setError]=useState('');
 const {kind:appliedKind,peak,height,origin,baseline,end}=model;
 const power=model.kind==='gamma'?model.power:undefined,sigma=model.kind==='normal'?model.sigma:undefined;
 useEffect(()=>{
  const common={peak,height,origin,baseline,end};
  setKind(appliedKind);setFields(fieldValues(appliedKind==='gamma'?{...common,kind:'gamma',power:power!}:{...common,kind:'normal',sigma:sigma!}));setError('');
 },[appliedKind,peak,height,power,sigma,origin,baseline,end]);
 function apply(){
  try{
   const activeFields=kind==='gamma'?['peak','height','power','origin','baseline','end'] as const:['peak','height','sigma','origin','baseline','end'] as const;
   if(activeFields.some(key=>!fields[key].trim()||!Number.isFinite(Number(fields[key]))))throw Error('모든 항목에 유한한 숫자를 입력해 주세요.');
   const common={peak:Number(fields.peak),height:Number(fields.height),origin:Number(fields.origin),baseline:Number(fields.baseline),end:Number(fields.end)};
   const next:Distribution=kind==='gamma'?{...common,kind,power:Number(fields.power)}:{...common,kind,sigma:Number(fields.sigma)};
   if([next.peak,next.height,next.origin,next.baseline,next.end].some(value=>Math.abs(value)>1000000))throw Error('좌표와 높이는 -1,000,000에서 1,000,000 사이로 입력해 주세요.');
   if(!(next.origin<next.peak&&next.peak<next.end))throw Error(kind==='normal'?'시작 x < 평균 μ < 끝 x가 되도록 입력해 주세요.':'시작 x < 봉우리 위치 x < 끝 x가 되도록 입력해 주세요.');
   if(next.height<=0)throw Error('봉우리 높이는 0보다 커야 합니다.');
   if(next.baseline+next.height>1000000)throw Error('기준 높이와 봉우리 높이의 합은 1,000,000 이하여야 합니다.');
   if(next.kind==='gamma'&&(next.power<2||next.power>80))throw Error('모양 지수는 2에서 80 사이로 입력해 주세요.');
   if(next.kind==='normal'&&(!(next.sigma>0)||next.sigma>1000000))throw Error('표준편차는 0보다 크고 1,000,000 이하여야 합니다.');
   onChange(withDistribution(curve,next));setError('');
  }catch(e){setError(e instanceof Error?e.message:'분포 값을 확인해 주세요.');}
 }
 const input=(key:keyof Fields,label:string,min?:number,max?:number)=><label key={key} htmlFor={`${id}-${key}`}>{label}<input id={`${id}-${key}`} type="number" step="any" min={min} max={max} value={fields[key]} onChange={event=>setFields(previous=>({...previous,[key]:event.target.value}))}/></label>;
 return <fieldset className="distribution-controls" aria-describedby={`${id}-hint`} onKeyDown={event=>{if(event.key==='Enter'&&event.target instanceof HTMLInputElement){event.preventDefault();event.stopPropagation();apply();}}}>
  <legend>분포 공식</legend>
  <label className="distribution-kind" htmlFor={`${id}-kind`}>분포 종류<select id={`${id}-kind`} value={kind} onChange={event=>{setKind(event.target.value as Distribution['kind']);setError('');}}><option value="gamma">감마형 분포</option><option value="normal">정규분포</option></select></label>
  <p className="distribution-formula" aria-label={kind==='normal'?'정규분포 공식':'감마형 분포 공식'} dangerouslySetInnerHTML={{__html:formulas[kind]}}/>
  <div className="distribution-fields">
   {input('peak',kind==='normal'?'평균 μ':'봉우리 위치 x')}
   {kind==='normal'&&input('sigma','표준편차 σ',0,1000000)}
   {input('height','봉우리 높이',0)}
   {kind==='gamma'&&input('power','모양 지수 p',2,80)}
  </div>
  <p id={`${id}-hint`} className="distribution-hint">{kind==='normal'?'평균을 중심으로 좌우 대칭이며, 표준편차가 클수록 넓어집니다. 높이는 기준 높이에서 잽니다.':'높이는 기준 높이에서 잽니다. 지수가 클수록 폭이 좁아지고 좌우 비대칭이 줄어듭니다.'}</p>
  {kind==='normal'&&<button type="button" className="button distribution-density" onClick={()=>{
   const deviation=Number(fields.sigma);
   if(!fields.sigma.trim()||!Number.isFinite(deviation)||!(deviation>0)){setError('양수인 표준편차를 먼저 입력해 주세요.');return;}
   setFields(previous=>({...previous,baseline:'0',height:String(1/(deviation*Math.sqrt(2*Math.PI)))}));setError('');
  }}>확률밀도 높이로 설정</button>}
  <details className="distribution-advanced"><summary>시작점·범위 설정</summary><div className="distribution-fields">
   {input('origin','시작 x')}
   {input('baseline','기준 높이')}
   {input('end','끝 x')}
  </div></details>
  {error&&<p className="distribution-error" role="alert">{error}</p>}
  <div className="distribution-actions">
   <button type="button" className="button" onClick={()=>onChange(freeDistribution(curve))}>자유 곡선으로 전환</button>
   <button type="button" className="button primary" onClick={apply}>분포 변경 적용</button>
  </div>
  <p className="distribution-hint">{kind==='normal'?'확률밀도 높이는 1/(σ√(2π))입니다. ':''}점을 따로 옮기거나 추가하려면 자유 곡선으로 전환하세요.</p>
 </fieldset>;
}
