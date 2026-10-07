'use client';
import {useId} from 'react';
import {lineDashArray,type LineStyle} from '@/lib/graph';

const choices:{value:LineStyle;label:string}[]=[
 {value:'solid',label:'실선'},
 {value:'dashed',label:'파선'},
 {value:'dotted',label:'점선'},
 {value:'dash-dot',label:'일점쇄선'},
 {value:'dash-dot-dot',label:'이점쇄선'},
];

export function CurveLineStyle({value,onChange}:{value:LineStyle;onChange:(value:LineStyle)=>void}){
 const id=useId();
 return <fieldset className="curve-line-style"><legend>선 종류</legend><div className="line-style-choices">
  {choices.map(choice=><label key={choice.value} className={'line-style-choice'+(value===choice.value?' active':'')}>
   <input className="sr-only" type="radio" name={id} value={choice.value} checked={value===choice.value} onChange={()=>onChange(choice.value)}/>
   <svg width="62" height="16" viewBox="0 0 62 16" aria-hidden="true"><path d="M 2 8 H 60" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray={lineDashArray(choice.value,1.8)}/></svg>
   <span>{choice.label}</span>
  </label>)}
 </div></fieldset>;
}
