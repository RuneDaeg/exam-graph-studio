'use client';

import {useId,useState} from 'react';
import katex from 'katex';
import {z} from 'zod';
import type {Graph} from '@/lib/graph';
import {createScienceGraph,scienceModelDefaults,scienceModelInfo,scienceModelSchema,type ScienceModel,type ScienceModelKind} from '@/lib/science-models';
import './science-model-controls.css';

const formulas=Object.fromEntries(Object.entries(scienceModelInfo).map(([kind,info])=>[kind,katex.renderToString(info.formula,{throwOnError:false,trust:false})]));
const toFields=(model:ScienceModel):Record<string,string>=>Object.fromEntries(Object.entries(model).filter(([key])=>key!=='kind').map(([key,value])=>[key,String(value)]));

export function ScienceModelControls({model,onCreate}:{model?:ScienceModel;onCreate:(graph:Graph)=>void}){
 return <ScienceModelFields key={JSON.stringify(model??null)} initial={model??scienceModelDefaults['thermal-equilibrium']} editing={Boolean(model)} onCreate={onCreate}/>;
}

function ScienceModelFields({initial,editing,onCreate}:{initial:ScienceModel;editing:boolean;onCreate:(graph:Graph)=>void}){
 const id=useId(),[kind,setKind]=useState<ScienceModelKind>(initial.kind),[fields,setFields]=useState(()=>toFields(initial)),[error,setError]=useState('');
 const info=scienceModelInfo[kind];
 function apply(){
  try{
   const raw:Record<string,unknown>={kind};
   for(const field of info.fields){
    if(!fields[field.key]?.trim()||!Number.isFinite(Number(fields[field.key])))throw Error(`${field.label}에 유한한 숫자를 입력해 주세요.`);
    raw[field.key]=Number(fields[field.key]);
   }
   if(kind==='tangent-secant')raw.function=fields.function??'quadratic';
   const model=scienceModelSchema.parse(raw);
   onCreate(createScienceGraph(model));setError('');
  }catch(e){
   setError(e instanceof z.ZodError?e.issues.map(issue=>{
    const field=info.fields.find(value=>value.key===issue.path[0]);
    if(issue.code==='custom')return issue.message;
    if(issue.code==='too_small')return `${field?.label??'값'}은 ${issue.minimum} 이상이어야 합니다.`;
    if(issue.code==='too_big')return `${field?.label??'값'}은 ${issue.maximum} 이하여야 합니다.`;
    return `${field?.label??'입력값'}을 확인해 주세요.`;
   }).join(' '):e instanceof Error?e.message:'과학 공식의 값을 확인해 주세요.');
  }
 }
 return <section className="science-model-controls" aria-labelledby={`${id}-heading`}>
  <h3 id={`${id}-heading`}>과학 공식으로 만들기</h3>
  <p className="science-model-intro">관련된 곡선·점·보조선을 한 번에 계산합니다. 값을 바꾼 뒤 적용하면 서로의 관계도 함께 바뀝니다.</p>
  <label className="science-model-select" htmlFor={`${id}-kind`}>공식 유형<select id={`${id}-kind`} value={kind} onChange={event=>{
   const next=event.target.value as ScienceModelKind;setKind(next);setFields(toFields(scienceModelDefaults[next]));setError('');
  }}>{Object.entries(scienceModelInfo).map(([value,item])=><option key={value} value={value}>{item.title}</option>)}</select></label>
  <div className="science-model-formula" aria-label={`${info.title} 공식`} dangerouslySetInnerHTML={{__html:formulas[kind]}}/>
  <p className="science-model-description">{info.description}</p>
  <div className="science-model-fields" onKeyDown={event=>{if(event.key==='Enter'&&event.target instanceof HTMLInputElement){event.preventDefault();event.stopPropagation();apply();}}}>
   {kind==='tangent-secant'&&<label htmlFor={`${id}-function`}>함수<select id={`${id}-function`} value={fields.function??'quadratic'} onChange={event=>setFields(previous=>({...previous,function:event.target.value}))}>
    <option value="quadratic">y = x²</option><option value="sine">y = sin x</option><option value="exponential">y = eˣ</option>
   </select></label>}
   {info.fields.map(field=><label key={field.key} htmlFor={`${id}-${field.key}`}>{field.label}<input id={`${id}-${field.key}`} type="number" value={fields[field.key]??''} min={field.min} max={field.max} step={field.step??'any'} onChange={event=>setFields(previous=>({...previous,[field.key]:event.target.value}))}/></label>)}
  </div>
  <p className="science-model-caution">{info.caution}</p>
  {error&&<p className="science-model-error" role="alert">{error}</p>}
  <button type="button" className="button primary science-model-apply" onClick={apply}>{editing?'매개변수 변경 적용':'공식 그래프 만들기'}</button>
  <p className="science-model-hint">현재 그래프를 이 공식의 그래프로 바꿉니다. 공식에서 다시 계산하면 자유 편집으로 바꾼 모양·문자는 유지되지 않습니다.</p>
 </section>;
}
