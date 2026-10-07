'use client';

import {useEffect,useId,useState} from 'react';
import {Plus} from 'lucide-react';
import type {Graph} from '@/lib/graph';

export function CurvePointInsert({points,initialSegment=0,onInsert}:{points:Graph['curves'][number]['points']|null;initialSegment?:number;onInsert:(segment:number)=>void}){
 const id=useId(),count=points?.length??0;
 const [segment,setSegment]=useState(Math.max(0,Math.min(initialSegment,count-2)));
 useEffect(()=>setSegment(Math.max(0,Math.min(initialSegment,count-2))),[initialSegment,count]);
 const issue=!points?'좌표 입력을 마치면 점을 추가할 수 있습니다.':count<2?'연결된 점이 2개 이상인 선에 추가할 수 있습니다.':count>=500?'한 선에 점은 500개까지 추가할 수 있습니다.':'';
 return <fieldset className="point-insertion" aria-describedby={`${id}-hint`}>
  <legend>중간 점 추가</legend>
  <div className="point-insertion-controls"><label className="sr-only" htmlFor={id}>추가할 구간</label><select id={id} value={segment} disabled={Boolean(issue)} onChange={e=>setSegment(Number(e.target.value))}>
   {points?.slice(1).map((_,i)=><option key={i} value={i}>점 {i+1} → 점 {i+2}</option>)}
  </select><button className="button" type="button" disabled={Boolean(issue)} onClick={()=>onInsert(segment)}><Plus size={14}/>선분 중간에 추가</button></div>
  <p id={`${id}-hint`} className="hint">{issue||'선 위에 점을 추가한 뒤 드래그로 위치를 조절하세요.'}</p>
 </fieldset>;
}
