'use client';

import {useId,useState} from 'react';
import {Pencil,Plus,Trash2,X} from 'lucide-react';
import {shadingIssue,type Graph,type Shading} from '@/lib/graph';
import './graph-shading.css';

type Props={graph:Graph;onChange:(graph:Graph)=>void;initialCurve?:number;onClose?:()=>void};
type Draft=Omit<Shading,'baseline'|'xStart'|'xEnd'>&{baseline:string;xStart:string;xEnd:string};
const boundaryNames={baseline:'선과 기준선 사이',between:'두 선 사이',closed:'닫힌 선 내부'} as const;
const curveName=(graph:Graph,index:number)=>`${index+1}. ${graph.curves[index]?.name||'이름 없는 선'}`;
const asDraft=(shade:Shading):Draft=>({...shade,baseline:String(shade.baseline),xStart:String(shade.xStart),xEnd:String(shade.xEnd)});
function otherCurveIndex(graph:Graph,curve:number,current?:number){
 if(current!==undefined&&Number.isInteger(current)&&current>=0&&current<graph.curves.length&&current!==curve)return current;
 const first=graph.curves.findIndex((_,index)=>index!==curve);
 return first<0?undefined:first;
}

function initialShading(graph:Graph,curveIndex=0):Shading{
 const curve=Math.max(0,Math.min(curveIndex,graph.curves.length-1));
 const points=graph.curves[curve]?.points??[];
 const xs=points.map(point=>point.x);
 const first=points[0],last=points.at(-1);
 const closed=points.length>=4&&first.x===last?.x&&first.y===last?.y;
 const left=Math.max(graph.xMin,Math.min(...xs));
 const right=Math.min(graph.xMax,Math.max(...xs));
 return {curve,mode:closed?'closed':'baseline',otherCurve:otherCurveIndex(graph,curve),baseline:Math.max(graph.yMin,Math.min(0,graph.yMax)),xStart:Number.isFinite(left)?left:graph.xMin,xEnd:Number.isFinite(right)?right:graph.xMax,pattern:'solid',opacity:.15};
}

export function GraphShading({graph,onChange,initialCurve=0,onClose}:Props){
 const [editing,setEditing]=useState<number|null>(null);
 const [newVersion,setNewVersion]=useState(0);
 const shades=graph.shadings??[];
 const activeIndex=editing!==null&&editing<shades.length?editing:null;
 const activeShade=activeIndex===null?undefined:shades[activeIndex];
 const titleId=useId();
 function startNew(){setEditing(null);setNewVersion(version=>version+1);}
 function remove(index:number){
  onChange({...graph,shadings:shades.filter((_,i)=>i!==index)});
  setEditing(current=>current===index?null:current!==null&&current>index?current-1:current);
 }
 return <section className="graph-shading" aria-labelledby={titleId}>
  <div className="shading-heading"><div><h3 id={titleId}>음영</h3><p>선을 따라 영역을 채우고, 인쇄용 회색이나 빗금을 선택하세요.</p></div>{onClose&&<button type="button" className="icon-button" aria-label="음영 편집 닫기" onClick={onClose}><X size={16}/></button>}</div>
  {graph.curves.length===0?<p className="shading-empty">먼저 그래프에 선을 추가해 주세요. 선과 기준선 사이, 두 선 사이 또는 닫힌 선의 내부에 음영을 넣을 수 있습니다.</p>:<>
   {shades.length>0&&<ul className="shading-list" aria-label="추가한 음영">{shades.map((shade,index)=>{const issue=shadingIssue(graph,shade);return <li className={activeIndex===index?'active':''} key={index}>
    <span aria-hidden="true" className={`shading-swatch ${shade.pattern}`} style={{opacity:shade.opacity/.6}}/>
    <div className="shading-summary"><strong>음영 {index+1} · {graph.curves[shade.curve]?.name||`선 ${shade.curve+1}`}</strong><span>{boundaryNames[shade.mode]} · {Math.round(shade.opacity*100)}%</span>{issue&&<span className="shading-warning">{issue}</span>}</div>
    <button type="button" className="icon-button" aria-label={`음영 ${index+1} 수정`} aria-pressed={activeIndex===index} onClick={()=>setEditing(index)}><Pencil size={14}/></button>
    <button type="button" className="icon-button shading-delete" aria-label={`음영 ${index+1} 삭제`} onClick={()=>remove(index)}><Trash2 size={15}/></button>
   </li>;})}</ul>}
   {activeIndex!==null&&<button type="button" className="button shading-new" disabled={shades.length>=20} onClick={startNew}><Plus size={14}/>새 음영 추가</button>}
   {activeIndex===null&&shades.length>=20?<p className="shading-empty">음영은 20개까지 추가할 수 있습니다. 기존 음영을 수정하거나 삭제해 주세요.</p>:<ShadingForm
    key={`${graph.curves.length}-${activeIndex===null?`new-${newVersion}`:`edit-${activeIndex}-${JSON.stringify(activeShade)}`}`}
    graph={graph}
    initial={activeShade??initialShading(graph,initialCurve)}
    index={activeIndex}
    onCancel={activeIndex===null?undefined:startNew}
    onApply={shade=>{
     const next=activeIndex===null?[...shades,shade]:shades.map((current,index)=>index===activeIndex?shade:current);
     onChange({...graph,shadings:next});
     setEditing(activeIndex??shades.length);
    }}
   />}
  </>}
 </section>;
}

function ShadingForm({graph,initial,index,onApply,onCancel}:{graph:Graph;initial:Shading;index:number|null;onApply:(shade:Shading)=>void;onCancel?:()=>void}){
 const [draft,setDraft]=useState(()=>asDraft(initial));
 const [error,setError]=useState('');
 const id=useId();
 function update<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(current=>({...current,[key]:value}));setError('');}
 function chooseMode(mode:Shading['mode']){
  setDraft(current=>({...current,mode,otherCurve:mode==='between'?otherCurveIndex(graph,current.curve,current.otherCurve):current.otherCurve}));
  setError('');
 }
 function chooseCurve(curve:number){
  const defaults=initialShading(graph,curve);
  setDraft(current=>({...current,curve,mode:defaults.mode==='closed'?'closed':current.mode==='closed'?'baseline':current.mode,xStart:String(defaults.xStart),xEnd:String(defaults.xEnd),otherCurve:otherCurveIndex(graph,curve,current.otherCurve)}));
  setError('');
 }
 const parsed:Shading={...draft,baseline:Number(draft.baseline),xStart:Number(draft.xStart),xEnd:Number(draft.xEnd)};
 const empty=draft.mode!=='closed'&&(!draft.xStart.trim()||!draft.xEnd.trim()||(draft.mode==='baseline'&&!draft.baseline.trim()));
 const issue=empty?'음영 영역의 좌표를 입력해 주세요.':shadingIssue(graph,parsed);
 function apply(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(issue){setError(issue);return;}
  onApply(parsed);
 }
 return <form className="shading-form" onSubmit={apply} aria-label={index===null?'새 음영 설정':`음영 ${index+1} 설정`} noValidate>
  <div className="shading-form-title">{index===null?'새 음영':`음영 ${index+1} 수정`}</div>
  <div className="shading-fields">
   <label>대상 선<select value={draft.curve} onChange={event=>chooseCurve(Number(event.target.value))}>{graph.curves.map((_,curve)=><option key={curve} value={curve}>{curveName(graph,curve)}</option>)}</select></label>
   <label>채울 영역<select value={draft.mode} onChange={event=>chooseMode(event.target.value as Shading['mode'])}><option value="baseline">선과 기준선 사이</option><option value="between" disabled={graph.curves.length<2}>두 선 사이</option><option value="closed">닫힌 선 내부</option></select></label>
   {draft.mode==='between'&&<label className="shading-field-wide">반대쪽 선<select value={draft.otherCurve??''} onChange={event=>update('otherCurve',Number(event.target.value))}><option value="" disabled>선을 선택하세요</option>{graph.curves.map((_,curve)=>curve!==draft.curve&&<option key={curve} value={curve}>{curveName(graph,curve)}</option>)}</select></label>}
   {draft.mode!=='closed'&&<>
    <label>x 시작<input type="number" step="any" value={draft.xStart} onChange={event=>update('xStart',event.target.value)}/></label>
    <label>x 끝<input type="number" step="any" value={draft.xEnd} onChange={event=>update('xEnd',event.target.value)}/></label>
    {draft.mode==='baseline'&&<label className="shading-field-wide">기준선 y<input type="number" step="any" value={draft.baseline} onChange={event=>update('baseline',event.target.value)}/><span className="shading-field-note">0을 입력하면 선과 가로축 사이를 채웁니다.</span></label>}
   </>}
  </div>
  {draft.mode==='closed'&&<p className="shading-field-note">시작점과 끝점이 같은 선의 내부 전체를 채웁니다.</p>}
  <div className="shading-style-fields">
   <fieldset><legend>채우기</legend><div className="shading-patterns">{([['solid','회색'],['hatch','빗금']] as const).map(([pattern,label])=><label className={draft.pattern===pattern?'active':''} key={pattern}><input type="radio" name={`${id}-pattern`} value={pattern} checked={draft.pattern===pattern} onChange={()=>update('pattern',pattern)}/><span className={`shading-swatch ${pattern}`} aria-hidden="true"/>{label}</label>)}</div></fieldset>
   <label className="shading-opacity" htmlFor={`${id}-opacity`}><span>진하기 <output>{Math.round(draft.opacity*100)}%</output></span><input id={`${id}-opacity`} type="range" min="5" max="60" step="5" value={Math.round(draft.opacity*100)} onChange={event=>update('opacity',Number(event.target.value)/100)}/></label>
  </div>
  {(error||issue)&&<p className="shading-validation" role={error?'alert':undefined}>{error||issue}</p>}
  <div className="shading-actions">{onCancel&&<button type="button" className="button" onClick={onCancel}>취소</button>}<button type="submit" className="button primary" disabled={Boolean(issue)}>{index===null?'음영 추가':'음영 적용'}</button></div>
 </form>;
}
