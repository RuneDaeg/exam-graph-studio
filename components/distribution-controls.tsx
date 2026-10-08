'use client';

import {useEffect,useId,useState} from 'react';
import katex from 'katex';
import {freeDistribution,withDistribution,type Distribution,type Graph} from '@/lib/graph';
import './distribution-controls.css';

type Curve=Graph['curves'][number];
type Fields=Record<'peak'|'height'|'power'|'origin'|'baseline'|'end',string>;
const formula=katex.renderToString(String.raw`y=b+h\,u^p e^{p(1-u)},\quad u=\frac{x-a}{m-a}\;(x\ge a)`,{throwOnError:false,trust:false});
const fieldValues=(model:Distribution):Fields=>({peak:String(model.peak),height:String(model.height),power:String(model.power),origin:String(model.origin),baseline:String(model.baseline),end:String(model.end)});

function initialDistribution(curve:Curve):Distribution{
 const xs=curve.points.map(point=>point.x),ys=curve.points.map(point=>point.y);
 const left=Math.min(...xs),right=Math.max(...xs),low=Math.min(...ys),high=Math.max(...ys);
 const origin=left,end=right;
 const highest=curve.points.find(point=>point.y===high)?.x;
 const peak=highest!==undefined&&highest>origin&&highest<end?highest:origin+(end-origin)/3;
 return {kind:'gamma',origin,peak,end,baseline:low,height:high-low,power:3};
}

export function DistributionControls({curve,onChange}:{curve:Curve;onChange:(curve:Curve)=>void}){
 const [error,setError]=useState('');
 if(curve.distribution)return <GammaFields curve={curve} model={curve.distribution} onChange={onChange}/>;
 const xs=curve.points.map(point=>point.x),ys=curve.points.map(point=>point.y);
 const unavailable=curve.points.length<3||Math.max(...xs)<=Math.min(...xs)||Math.max(...ys)<=Math.min(...ys);
 return <div className="distribution-start">
  <button type="button" className="button" disabled={unavailable} onClick={()=>{try{onChange(withDistribution(curve,initialDistribution(curve)));setError('');}catch(e){setError(e instanceof Error?e.message:'분포 값을 확인해 주세요.');}}}>분포 공식 적용</button>
  <p>{unavailable?'분포 공식은 폭과 높이가 있고 점이 3개 이상인 선에 적용할 수 있습니다.':'봉우리 위치와 높이를 기준으로 매끄러운 감마형 분포 곡선으로 바꿉니다.'}</p>
  {error&&<p className="distribution-error" role="alert">{error}</p>}
 </div>;
}

function GammaFields({curve,model,onChange}:{curve:Curve;model:Distribution;onChange:(curve:Curve)=>void}){
 const id=useId();
 const [fields,setFields]=useState(()=>fieldValues(model)),[error,setError]=useState('');
 const {peak,height,power,origin,baseline,end}=model;
 useEffect(()=>{setFields(fieldValues({kind:'gamma',peak,height,power,origin,baseline,end}));setError('');},[peak,height,power,origin,baseline,end]);
 function apply(){
  try{
   const next:Distribution={kind:'gamma',peak:Number(fields.peak),height:Number(fields.height),power:Number(fields.power),origin:Number(fields.origin),baseline:Number(fields.baseline),end:Number(fields.end)};
   if(Object.values(fields).some(value=>!value.trim())||Object.values(next).some(value=>typeof value==='number'&&!Number.isFinite(value)))throw Error('모든 항목에 유한한 숫자를 입력해 주세요.');
   if([next.peak,next.height,next.origin,next.baseline,next.end].some(value=>Math.abs(value)>1000000))throw Error('좌표와 높이는 -1,000,000에서 1,000,000 사이로 입력해 주세요.');
   if(!(next.origin<next.peak&&next.peak<next.end))throw Error('시작 x < 봉우리 위치 x < 끝 x가 되도록 입력해 주세요.');
   if(next.height<=0)throw Error('봉우리 높이는 0보다 커야 합니다.');
   if(next.baseline+next.height>1000000)throw Error('기준 높이와 봉우리 높이의 합은 1,000,000 이하여야 합니다.');
   if(next.power<2||next.power>80)throw Error('모양 지수는 2에서 80 사이로 입력해 주세요.');
   onChange(withDistribution(curve,next));setError('');
  }catch(e){setError(e instanceof Error?e.message:'분포 값을 확인해 주세요.');}
 }
 const input=(key:keyof Fields,label:string,min?:number,max?:number)=><label key={key} htmlFor={`${id}-${key}`}>{label}<input id={`${id}-${key}`} type="number" step="any" min={min} max={max} value={fields[key]} onChange={event=>setFields(previous=>({...previous,[key]:event.target.value}))}/></label>;
 return <fieldset className="distribution-controls" aria-describedby={`${id}-hint`} onKeyDown={event=>{if(event.key==='Enter'&&event.target instanceof HTMLInputElement){event.preventDefault();event.stopPropagation();apply();}}}>
  <legend>분포 공식</legend>
  <p className="distribution-formula" aria-label="감마형 분포 공식" dangerouslySetInnerHTML={{__html:formula}}/>
  <div className="distribution-fields">
   {input('peak','봉우리 위치 x')}
   {input('height','봉우리 높이',0)}
   {input('power','모양 지수 p',2,80)}
  </div>
  <p id={`${id}-hint`} className="distribution-hint">높이는 기준 높이에서 잽니다. 지수가 클수록 폭이 좁아지고 좌우 비대칭이 줄어듭니다.</p>
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
  <p className="distribution-hint">분포의 모양을 그리는 공식입니다. 점을 따로 옮기거나 추가하려면 자유 곡선으로 전환하세요.</p>
 </fieldset>;
}
