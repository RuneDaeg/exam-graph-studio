'use client';

import {useEffect,useId,useState} from 'react';
import katex from 'katex';
import {freeConic,withConic,type Conic,type Graph} from '@/lib/graph';
import './conic-controls.css';

type Curve=Graph['curves'][number];
type Fields=Record<'cx'|'cy'|'rx'|'ry',string>;
const formulas={
 circle:katex.renderToString(String.raw`(x-a)^2+(y-b)^2=r^2`,{throwOnError:false,trust:false}),
 ellipse:katex.renderToString(String.raw`\frac{(x-a)^2}{r_x^2}+\frac{(y-b)^2}{r_y^2}=1`,{throwOnError:false,trust:false}),
};
const fieldValues=(model:Conic):Fields=>({cx:String(model.cx),cy:String(model.cy),rx:String(model.rx),ry:String(model.ry)});

function initialConic(curve:Curve):Conic|null{
 if(curve.points.length<4)return null;
 const xs=curve.points.map(point=>point.x),ys=curve.points.map(point=>point.y);
 const left=Math.min(...xs),right=Math.max(...xs),bottom=Math.min(...ys),top=Math.max(...ys);
 const rx=(right-left)/2,ry=(top-bottom)/2;
 const first=curve.points[0],last=curve.points[curve.points.length-1];
 if(!(rx>0&&ry>0)||Math.hypot(first.x-last.x,first.y-last.y)>Math.max(1,rx,ry)*1e-6)return null;
 const kind=Math.abs(rx-ry)<=Math.max(rx,ry)*1e-3?'circle':'ellipse';
 return {kind,cx:(left+right)/2,cy:(bottom+top)/2,rx,ry:kind==='circle'?rx:ry};
}

export function ConicControls({curve,onChange}:{curve:Curve;onChange:(curve:Curve)=>void}){
 const [error,setError]=useState('');
 if(curve.distribution)return null;
 if(curve.conic)return <ConicFields curve={curve} model={curve.conic} onChange={onChange}/>;
 const initial=initialConic(curve);
 if(!initial)return null;
 return <div className="conic-start">
  <button type="button" className="button" onClick={()=>{try{onChange(withConic(curve,initial));setError('');}catch(e){setError(e instanceof Error?e.message:'원·타원 값을 확인해 주세요.');}}}>원·타원 공식 적용</button>
  <p>닫힌 선의 가로·세로 범위를 기준으로 정확한 원이나 타원으로 바꿉니다.</p>
  {error&&<p className="conic-error" role="alert">{error}</p>}
 </div>;
}

function ConicFields({curve,model,onChange}:{curve:Curve;model:Conic;onChange:(curve:Curve)=>void}){
 const id=useId();
 const [kind,setKind]=useState<Conic['kind']>(model.kind);
 const [fields,setFields]=useState(()=>fieldValues(model)),[error,setError]=useState('');
 const {kind:appliedKind,cx,cy,rx,ry}=model;
 useEffect(()=>{setKind(appliedKind);setFields(fieldValues({kind:appliedKind,cx,cy,rx,ry}));setError('');},[appliedKind,cx,cy,rx,ry]);
 function apply(){
  try{
   const activeFields=kind==='circle'?['cx','cy','rx'] as const:['cx','cy','rx','ry'] as const;
   if(activeFields.some(key=>!fields[key].trim()||!Number.isFinite(Number(fields[key]))))throw Error('모든 항목에 유한한 숫자를 입력해 주세요.');
   const next:Conic={kind,cx:Number(fields.cx),cy:Number(fields.cy),rx:Number(fields.rx),ry:Number(kind==='circle'?fields.rx:fields.ry)};
   if(!(next.rx>0&&next.ry>0))throw Error('반지름은 0보다 커야 합니다.');
   if(Math.abs(next.cx)+next.rx>1000000||Math.abs(next.cy)+next.ry>1000000)throw Error('원의 범위가 -1,000,000에서 1,000,000 안에 들어오도록 입력해 주세요.');
   onChange(withConic(curve,next));setError('');
  }catch(e){setError(e instanceof Error?e.message:'원·타원 값을 확인해 주세요.');}
 }
 const input=(key:keyof Fields,label:string,min?:number)=><label key={key} htmlFor={`${id}-${key}`}>{label}<input id={`${id}-${key}`} type="number" step="any" min={min} value={fields[key]} onChange={event=>setFields(previous=>({...previous,[key]:event.target.value}))}/></label>;
 return <fieldset className="conic-controls" aria-describedby={`${id}-hint`} onKeyDown={event=>{if(event.key==='Enter'&&event.target instanceof HTMLInputElement){event.preventDefault();event.stopPropagation();apply();}}}>
  <legend>원·타원 공식</legend>
  <div className="conic-fields">
   <label htmlFor={`${id}-kind`}>모양<select id={`${id}-kind`} value={kind} onChange={event=>setKind(event.target.value as Conic['kind'])}><option value="circle">원</option><option value="ellipse">타원</option></select></label>
   {input('cx','중심 x')}
   {input('cy','중심 y')}
   {input('rx',kind==='circle'?'반지름 r':'가로 반지름',0)}
   {kind==='ellipse'&&input('ry','세로 반지름',0)}
  </div>
  <p className="conic-formula" aria-label={kind==='circle'?'원 공식':'타원 공식'} dangerouslySetInnerHTML={{__html:formulas[kind]}}/>
  <p id={`${id}-hint`} className="conic-hint">중심과 반지름으로 곡선 전체를 계산합니다. 축·눈금에서 가로·세로 같은 축척을 설정할 수 있습니다.</p>
  {error&&<p className="conic-error" role="alert">{error}</p>}
  <div className="conic-actions">
   <button type="button" className="button" onClick={()=>onChange(freeConic(curve))}>자유 곡선으로 전환</button>
   <button type="button" className="button primary" onClick={apply}>원·타원 변경 적용</button>
  </div>
  <p className="conic-hint">점을 따로 옮기거나 추가하려면 자유 곡선으로 전환하세요.</p>
 </fieldset>;
}
