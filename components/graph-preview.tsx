'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type PointerEvent,type KeyboardEvent} from 'react';
import {Move,MousePointer2,Plus,X,PaintBucket} from 'lucide-react';
import {graphLayout,graphSchema,renderGraph,smoothConnectionIssue,nearestCurvePosition,type Graph,type Style} from '@/lib/graph';
import {CurveConnection} from '@/components/curve-connection';
import {CurvePointInsert} from '@/components/curve-point-insert';
import {GraphShading} from '@/components/graph-shading';
import {typesetSvg,typesetSvgCached} from '@/lib/math-svg';
import {movePoint,moveCurve,moveLabel,adjustText,insertCurvePoint,type EditTarget} from '@/lib/graph-edit';

type Box={id:string;x:number;y:number;width:number;height:number};
type Path={index:number;d:string};
type Drag={target:EditTarget;inspected:EditTarget|null;start:{x:number;y:number};graph:Graph;next:Graph;pointer:number;moved:boolean;box?:Box};
const keyOf=(t:EditTarget)=>t.kind==='point'?`point:${t.curve}:${t.index}`:t.kind==='curve'?`curve:${t.curve}`:t.kind==='axis'?`axis:${t.axis}`:t.kind==='tick'?`tick:${t.axis}:${t.index}`:`label:${t.index}`;
const targetOf=(id:string):EditTarget=>{const [kind,a,b]=id.split(':');if(kind==='axis')return {kind,axis:a as 'x'|'y'};if(kind==='tick')return {kind,axis:a as 'x'|'y',index:Number(b)};return {kind:'label',index:Number(a)};};
const rounded=(v:number)=>Number(v.toPrecision(12));
const equalPoint=(a:{x:number;y:number},b:{x:number;y:number})=>a.x===b.x&&a.y===b.y;
const hasTarget=(g:Graph,t:EditTarget)=>t.kind==='point'?Boolean(g.curves[t.curve]?.points[t.index]):t.kind==='curve'?Boolean(g.curves[t.curve]):t.kind==='label'?Boolean(g.labels[t.index]):t.kind==='tick'?Boolean(g[t.axis==='x'?'xTicks':'yTicks'][t.index]):true;

export function GraphPreview({graph,style,disabled,onCommit,onDropImage}:{graph:Graph;style:Style;disabled:boolean;onCommit:(graph:Graph)=>void;onDropImage:(file:File)=>void}){
 const [enabled,setEnabled]=useState(true),[selected,setSelected]=useState<EditTarget|null>(null),[draft,setDraft]=useState<Graph|null>(null);
 const [addingPoint,setAddingPoint]=useState(false),[shadingOpen,setShadingOpen]=useState(false);
 const [follow,setFollow]=useState(false),[snap,setSnap]=useState(false),[step,setStep]=useState('0.1'),[error,setError]=useState('');
 const [typed,setTyped]=useState<{source:string;svg:string;errors:string[]}>({source:'',svg:'',errors:[]});
 const [boxes,setBoxes]=useState<Box[]>([]),[paths,setPaths]=useState<Path[]>([]),[scale,setScale]=useState(1);
 const content=useRef<HTMLDivElement>(null),overlay=useRef<SVGSVGElement>(null),drag=useRef<Drag|null>(null);
 const current=draft||graph,layout=useMemo(()=>graphLayout(current,style),[current,style]);
 const source=useMemo(()=>renderGraph(current,style,'preview'),[current,style]);
 const cached=useMemo(()=>typesetSvgCached(source),[source,typed]);
 const display=cached?.svg||(typed.source===source?typed.svg:source);
 useEffect(()=>{let active=true;if(cached)return;typesetSvg(source).then(r=>{if(active)setTyped({source,...r});});return()=>{active=false;};},[source,cached]);
 useLayoutEffect(()=>{
  const items=Array.from(content.current?.querySelectorAll<SVGGraphicsElement>('[data-edit]')||[]);
  setBoxes(items.filter(el=>!el.dataset.edit?.startsWith('curve:')).map(el=>{const b=el.getBBox();return {id:el.dataset.edit!,x:b.x-5,y:b.y-5,width:Math.max(16,b.width+10),height:Math.max(20,b.height+10)};}));
  setPaths(items.filter(el=>el.dataset.edit?.startsWith('curve:')).map(el=>({index:Number(el.dataset.edit!.split(':')[1]),d:el.getAttribute('d')||''})));
 },[display]);
 useLayoutEffect(()=>{const node=content.current;if(!node)return;const observer=new ResizeObserver(()=>setScale(node.getBoundingClientRect().width/style.width||1));observer.observe(node);return()=>observer.disconnect();},[style.width]);
 function cancel(){drag.current=null;setDraft(null);setSelected(t=>t?{...t}:t);}
 useEffect(()=>{const escape=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape'){drag.current=null;setDraft(null);setAddingPoint(false);setSelected(t=>t?{...t}:t);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
 useEffect(()=>{drag.current=null;setDraft(null);setSelected(t=>t&&hasTarget(graph,t)?t:null);},[graph]);
 useEffect(()=>{setSelected(null);setAddingPoint(false);setShadingOpen(false);},[graph.title]);
 function svgPoint(e:{clientX:number;clientY:number}){const matrix=overlay.current?.getScreenCTM();return matrix?new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()):null;}
 function begin(e:PointerEvent<SVGElement>,target:EditTarget){
  if(disabled||!enabled||e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus({preventScroll:true});setSelected(target);setError('');
  if(target.kind==='axis'||target.kind==='tick')return;
  const p=svgPoint(e);if(!p)return;overlay.current?.setPointerCapture(e.pointerId);
  drag.current={target,inspected:selected,start:{x:p.x,y:p.y},graph,next:graph,pointer:e.pointerId,moved:false,box:target.kind==='label'?boxes.find(b=>b.id===keyOf(target)):undefined};
 }
 function addPoint(curve:number,segment:number,t=.5){
  try{const result=insertCurvePoint(graph,curve,segment,t);onCommit(result.graph);setSelected({kind:'point',curve,index:result.index});setAddingPoint(false);setShadingOpen(false);setError('');}
  catch(e){setError(e instanceof Error?e.message:'점을 추가할 수 없습니다.');}
 }
 function addAtPointer(curve:number,e:{clientX:number;clientY:number}){
  const p=svgPoint(e);if(!p)return;
  try{const near=nearestCurvePosition(graph.curves[curve],layout.world(p.x,p.y),layout.dx,layout.dy);addPoint(curve,near.segment,near.t);}
  catch(e){setError(e instanceof Error?e.message:'선 위의 다른 위치를 선택해 주세요.');}
 }
 function quantize(v:number){const n=Number(step);return rounded(snap&&Number.isFinite(n)&&n>0?Math.round(v/n)*n:v);}
 function move(e:PointerEvent<SVGSVGElement>){
  const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const p=svgPoint(e);if(!p)return;
  const dx=p.x-d.start.x,dy=p.y-d.start.y;if(!d.moved&&Math.hypot(dx,dy)<2)return;d.moved=true;
  const base=graphLayout(d.graph,style),t=d.target;let next=d.graph;
  try{
   if(t.kind==='point'){const old=d.graph.curves[t.curve].points[t.index];next=movePoint(d.graph,t.curve,t.index,quantize(old.x+dx/base.dx),quantize(old.y-dy/base.dy),follow);}
   if(t.kind==='curve')next=moveCurve(d.graph,t.curve,quantize(dx/base.dx),quantize(-dy/base.dy),follow);
   if(t.kind==='label'){const b=d.box;const xx=b?Math.max(-b.x,Math.min(style.width-b.x-b.width,dx)):dx,yy=b?Math.max(-b.y,Math.min(style.height-b.y-b.height,dy)):dy;next=moveLabel(d.graph,t.index,rounded(xx),rounded(yy));}
   d.next=next;setDraft(next);
  }catch(e){setError(e instanceof Error?e.message:'이동할 수 없습니다.');}
 }
 function finish(e:PointerEvent<SVGSVGElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;setDraft(null);setSelected({...d.target});if(overlay.current?.hasPointerCapture(e.pointerId))overlay.current.releasePointerCapture(e.pointerId);if(d.moved&&JSON.stringify(d.graph)!==JSON.stringify(d.next))onCommit(d.next);}
 function nudge(e:KeyboardEvent<SVGElement>,t:EditTarget){
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||t.kind==='axis'||t.kind==='tick')return;
  e.preventDefault();const factor=e.shiftKey?10:1,x=(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)*factor,y=(e.key==='ArrowUp'?1:e.key==='ArrowDown'?-1:0)*factor;
  const snapUnit=snap&&Number(step)>0?Number(step):null,unitX=snapUnit??(graph.xMax-graph.xMin)/100,unitY=snapUnit??(graph.yMax-graph.yMin)/100;
  try{const next=t.kind==='point'?movePoint(graph,t.curve,t.index,rounded(graph.curves[t.curve].points[t.index].x+x*unitX),rounded(graph.curves[t.curve].points[t.index].y+y*unitY),follow):t.kind==='curve'?moveCurve(graph,t.curve,x*unitX,y*unitY,follow):moveLabel(graph,t.index,x,-y);onCommit(next);setSelected(t);}catch(e){setError(e instanceof Error?e.message:'이동할 수 없습니다.');}
 }
 const active=enabled&&!disabled;
 const selectedCurve=selected&&(selected.kind==='curve'||selected.kind==='point')?selected.curve:null;
 // Mounting an inspector during pointer-down can shift a sticky canvas under
 // the cursor. Keep its previous content and height until the gesture ends.
 const inspectorGraph=drag.current?.graph||current;
 const inspection=drag.current?drag.current.inspected:selected;
 const inspected=inspection&&hasTarget(inspectorGraph,inspection)?inspection:null;
 const smoothControls=current.curves.some(c=>c.smooth&&!smoothConnectionIssue(c.points));
 const mathErrors=typed.source===source?typed.errors:[];
 return <>
  <div className="preview-toolbar"><button className={'button '+(enabled?'edit-active':'')} aria-pressed={enabled} onClick={()=>{cancel();setAddingPoint(false);setEnabled(v=>!v);}} disabled={disabled}><MousePointer2 size={15}/>{enabled?'직접 편집 켜짐':'직접 편집 켜기'}</button>
   <button className={'button '+(addingPoint?'edit-active':'')} aria-pressed={addingPoint} disabled={disabled||!graph.curves.some(c=>c.points.length>1&&c.points.length<500)} onClick={()=>{cancel();setEnabled(true);setShadingOpen(false);setAddingPoint(v=>!v);setError('');}}><Plus size={15}/>{addingPoint?'점 추가 취소':'점 추가'}</button>
   <button className={'button '+(shadingOpen?'edit-active':'')} aria-expanded={shadingOpen} disabled={disabled} onClick={()=>{cancel();setAddingPoint(false);setShadingOpen(v=>!v);}}><PaintBucket size={15}/>{graph.shadings?.length?`음영 편집 (${graph.shadings.length})`:'음영 추가'}</button>
   <button className="button" disabled={disabled||graph.labels.length>=40} onClick={()=>{const index=graph.labels.length;onCommit({...graph,labels:[...graph.labels,{text:'A',x:(graph.xMin+graph.xMax)/2,y:(graph.yMin+graph.yMax)/2,dx:0,dy:0}]});setEnabled(true);setSelected({kind:'label',index});}}><Plus size={15}/>문자 추가</button>
   <label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/>좌표 맞춤</label><input className="snap-step" type="number" min="0" step="any" value={step} disabled={!snap} aria-label="좌표 맞춤 간격" onChange={e=>setStep(e.target.value)}/>
   <label title="이동 전 좌표가 같은 문자와 점선 끝점만 함께 이동합니다."><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>연결된 문자·점선</label>
  </div>
  <p className="preview-help" role={addingPoint?'status':undefined}>{addingPoint?'점을 추가할 선 위를 클릭하세요. 기존 점 사이에 삽입됩니다. Esc로 취소 · 키보드는 선 선택 후 아래의 중간 점 추가를 사용하세요.':active?(smoothControls?'점·선을 클릭하면 연결 방식을 바꿀 수 있습니다. 곡선의 조절점은 주변 구간도 매끄럽게 바꿉니다.':'점·선을 클릭해 직선 / 곡선을 선택하세요. 드래그로 이동 · 방향키로 미세 이동 · Esc로 드래그 취소'):'편집 표시를 숨긴 미리보기입니다.'}</p>
  {shadingOpen&&!disabled&&<GraphShading graph={graph} onChange={onCommit} initialCurve={selectedCurve??undefined} onClose={()=>setShadingOpen(false)}/>}
  <div className={'paper '+(style.transparent?'transparent-paper':'')} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{e.preventDefault();if(!disabled&&e.dataTransfer.files[0])onDropImage(e.dataTransfer.files[0]);}}>
   <div className="graph-preview"><div ref={content} className="graph-art" dangerouslySetInnerHTML={{__html:display}}/>
    {active&&<svg ref={overlay} className={'graph-edit-overlay '+(addingPoint?'adding-point':'')} viewBox={`0 0 ${style.width} ${style.height}`} aria-label="그래프 직접 편집" role="group" onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current)cancel();}} onPointerDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
     {paths.map(p=>{const t:EditTarget={kind:'curve',curve:p.index};return <path key={p.index} d={p.d} fill="none" stroke="transparent" strokeWidth={16} className={'curve-hit '+(selectedCurve===p.index?'selected':'')} tabIndex={0} role="button" aria-label={addingPoint?`곡선 ${p.index+1}에 점 추가`:`곡선 ${p.index+1} 이동`} onPointerDown={e=>{if(addingPoint){e.preventDefault();return;}begin(e,t);}} onClick={e=>{if(addingPoint)addAtPointer(p.index,e);else setSelected(t);}} onFocus={()=>{if(!addingPoint)setSelected(t);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setAddingPoint(false);setSelected(t);}else if(!addingPoint)nudge(e,t);}}/>;})}
     {!addingPoint&&current.curves.flatMap((c,ci)=>{const count=c.points.length;const closed=count>2&&equalPoint(c.points[0],c.points[count-1]);return c.points.flatMap((p,pi)=>{
      if(closed&&pi===count-1)return [];
      if(count>35&&(selectedCurve!==ci||pi%Math.ceil(count/30)!==0&&pi!==count-1&&!(selected?.kind==='point'&&selected.curve===ci&&selected.index===pi)))return [];
      if(p.x<current.xMin||p.x>current.xMax||p.y<current.yMin||p.y>current.yMax)return [];
      const t:EditTarget={kind:'point',curve:ci,index:pi},isSelected=selected&&keyOf(selected)===keyOf(t);
      return <g key={`${ci}:${pi}`} tabIndex={0} role="button" aria-label={`곡선 ${ci+1}의 점 ${pi+1} 이동`} className={'point-handle '+(isSelected?'selected':'')} onPointerDown={e=>begin(e,t)} onClick={()=>setSelected(t)} onFocus={()=>setSelected(t)} onKeyDown={e=>nudge(e,t)}><circle cx={layout.X(p.x)} cy={layout.Y(p.y)} r={Math.max(13,12/scale)} fill="transparent"/><circle cx={layout.X(p.x)} cy={layout.Y(p.y)} r={(isSelected?6:4.5)/scale} className="visible-handle"/></g>;
     });})}
     {!addingPoint&&boxes.map(b=>{const t=targetOf(b.id);return <rect key={b.id} x={b.x} y={b.y} width={b.width} height={b.height} rx={3} className={'text-hit '+(selected&&keyOf(selected)===b.id?'selected':'')} tabIndex={0} role="button" aria-label={t.kind==='axis'?`${t.axis==='x'?'가로':'세로'}축 이름 편집`:t.kind==='tick'?`${t.axis==='x'?'가로':'세로'}축 눈금 ${t.index+1} 편집`:`문자 ${t.kind==='label'?t.index+1:''} 이동·편집`} onPointerDown={e=>begin(e,t)} onClick={()=>setSelected(t)} onFocus={()=>setSelected(t)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(t);}else nudge(e,t);}}/>;})}
    </svg>}
   </div>
   {disabled&&<div className="canvas-loading"><Move size={24}/><span>축과 곡선의 관계를 읽고 있습니다</span></div>}
  </div>
  <div className="canvas-caption"><span>{active?'편집 손잡이는 다운로드에 포함되지 않습니다.':'흑백 · 시험지 스타일'}</span><span>{style.width} × {style.height} px</span></div>
  {active&&inspected&&!addingPoint&&<SelectionEditor graph={inspectorGraph} target={inspected} follow={follow} onCommit={onCommit} onInsert={addPoint} onClose={()=>setSelected(null)}/>}
  {(error||mathErrors.length>0)&&<p role="alert" className="error">{error||`수식 문법을 확인해 주세요: ${mathErrors.join(', ')}`}</p>}
 </>;
}

function SelectionEditor({graph,target,follow,onCommit,onInsert,onClose}:{graph:Graph;target:EditTarget;follow:boolean;onCommit:(g:Graph)=>void;onInsert:(curve:number,segment:number)=>void;onClose:()=>void}){
 const [text,setText]=useState(''),[x,setX]=useState(''),[y,setY]=useState(''),[error,setError]=useState('');
 let savedText='',savedX='',savedY='';
 if(target.kind==='point'){const p=graph.curves[target.curve]?.points[target.index];if(p){savedX=String(p.x);savedY=String(p.y);}}
 if(target.kind==='label'){const l=graph.labels[target.index];if(l){savedText=l.text;savedX=String(l.dx);savedY=String(l.dy);}}
 if(target.kind==='axis')savedText=graph[target.axis==='x'?'xLabel':'yLabel'];
 if(target.kind==='tick'){const tick=graph[target.axis==='x'?'xTicks':'yTicks'][target.index];if(tick){savedText=tick.label;savedX=String(tick.value);}}
 if(target.kind==='curve')savedText=graph.curves[target.curve]?.name||'';
 // Connection and style changes must not overwrite unapplied field edits.
 useEffect(()=>{setError('');setText(savedText);setX(savedX);setY(savedY);},[savedText,savedX,savedY,target]);
 const curveIndex=target.kind==='curve'||target.kind==='point'?target.curve:null;
 const connection=curveIndex===null?null:graph.curves[curveIndex];
 const t=target,title=t.kind==='point'?`점 ${t.index+1} 좌표`:t.kind==='curve'?`곡선 ${t.curve+1}`:t.kind==='label'?`문자 ${t.index+1}`:t.kind==='axis'?`${t.axis==='x'?'가로':'세로'}축 이름`:`${t.axis==='x'?'가로':'세로'}축 눈금 ${t.index+1}`;
 function apply(){try{let next=graph;
  const number=(v:string)=>{if(!v.trim()||!Number.isFinite(Number(v)))throw Error('숫자를 입력해 주세요.');return Number(v);};
  if(t.kind==='point')next=movePoint(graph,t.curve,t.index,number(x),number(y),follow);
  else if(t.kind==='label'){const old=graph.labels[t.index];next=moveLabel(adjustText(graph,t,text),t.index,number(x)-old.dx,number(y)-old.dy);}
  else if(t.kind==='tick')next=adjustText(graph,t,text,number(x));
  else if(t.kind==='axis')next=adjustText(graph,t,text);
  else next={...graph,curves:graph.curves.map((c,i)=>i===t.curve?{...c,name:text}:c)};
  onCommit(graphSchema.parse(next));setError('');
  // Apply can clamp back to the existing value without changing saved fields.
  if(t.kind==='point'){const p=next.curves[t.curve].points[t.index];setX(String(p.x));setY(String(p.y));}
  if(t.kind==='label'){const l=next.labels[t.index];setX(String(l.dx));setY(String(l.dy));}
 }catch(e){setError(e instanceof Error?e.message:'입력 값을 확인해 주세요.');}}
 return <form className="preview-inspector" onSubmit={e=>{e.preventDefault();apply();}}><div className="inspector-title"><strong>{title}</strong><button type="button" className="icon-button" aria-label="선택 해제" onClick={onClose}><X size={14}/></button></div><div className="inspector-fields">
  {t.kind!=='point'&&<label className="inspector-text">{t.kind==='curve'?'선 이름':'표시할 문자'}<textarea rows={1} aria-label="선택한 문자" value={text} maxLength={t.kind==='curve'?40:t.kind==='label'?120:80} onChange={e=>setText(e.target.value)}/></label>}
  {(t.kind==='point'||t.kind==='label'||t.kind==='tick')&&<label>{t.kind==='label'?'가로 이동(px)':t.kind==='tick'?'눈금 좌표':'x 좌표'}<input type="number" step="any" aria-label={t.kind==='point'?'선택한 점 x 좌표':t.kind==='label'?'문자 가로 이동':'눈금 좌표'} value={x} onChange={e=>setX(e.target.value)}/></label>}
  {(t.kind==='point'||t.kind==='label')&&<label>{t.kind==='label'?'세로 이동(px)':'y 좌표'}<input type="number" step="any" aria-label={t.kind==='point'?'선택한 점 y 좌표':'문자 세로 이동'} value={y} onChange={e=>setY(e.target.value)}/></label>}
  <button className="button primary" type="submit">적용</button>
 </div>{connection&&<CurveConnection points={connection.points} smooth={connection.smooth} onChange={smooth=>onCommit({...graph,curves:graph.curves.map((c,i)=>i===curveIndex?{...c,smooth}:c)})}/>}
 {connection&&curveIndex!==null&&<CurvePointInsert key={curveIndex} points={connection.points} initialSegment={t.kind==='point'?t.index:0} onInsert={segment=>onInsert(curveIndex,segment)}/>}
 {t.kind==='curve'&&<div className="curve-options">{(['dashed','dots','arrows'] as const).map(k=><label key={k}><input type="checkbox" checked={graph.curves[t.curve]?.[k]||false} onChange={e=>onCommit({...graph,curves:graph.curves.map((c,i)=>i===t.curve?{...c,[k]:e.target.checked}:c)})}/>{({dashed:'점선',dots:'점 표시',arrows:'진행 방향'})[k]}</label>)}</div>}{t.kind==='label'&&<button type="button" className="text-button remove-label" onClick={()=>{onCommit({...graph,labels:graph.labels.filter((_,i)=>i!==t.index)});onClose();}}>문자 삭제</button>}{error&&<p className="error" role="alert">{error}</p>}</form>;
}
