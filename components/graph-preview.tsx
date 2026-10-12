'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type PointerEvent,type KeyboardEvent} from 'react';
import {Move,MousePointer2,Plus,X,PaintBucket,SquareDashed,Trash2} from 'lucide-react';
import {graphLayout,graphSchema,renderGraph,curveLineStyle,distributionPeakIndex,conicHandleIndices,smoothConnectionIssue,nearestMappedCurvePosition,yAxisRange,xAxisRange,type XAxis,type YAxis,type Graph,type Style} from '@/lib/graph';
import './graph-editor.css';
import {CurvePlotControls} from '@/components/curve-plot-controls';
import {CurveConnection} from '@/components/curve-connection';
import {CurveLineStyle} from '@/components/curve-line-style';
import {DistributionControls} from '@/components/distribution-controls';
import {ConicControls} from '@/components/conic-controls';
import {CurvePointInsert} from '@/components/curve-point-insert';
import {GraphShading} from '@/components/graph-shading';
import {RectangleShadeDraw} from '@/components/rectangle-shade-draw';
import {typesetSvg,typesetSvgCached} from '@/lib/math-svg';
import {movePoint,moveCurve,moveLabel,adjustText,insertCurvePoint,replaceCurve,deleteGraphTarget,type EditTarget} from '@/lib/graph-edit';

type Box={id:string;x:number;y:number;width:number;height:number};
type Path={index:number;d:string};
type Drag={target:EditTarget;inspected:EditTarget|null;start:{x:number;y:number};graph:Graph;next:Graph;pointer:number;moved:boolean;box?:Box};
const keyOf=(t:EditTarget)=>t.kind==='point'?`point:${t.curve}:${t.index}`:t.kind==='curve'?`curve:${t.curve}`:t.kind==='axis'?`axis:${t.axis}`:t.kind==='tick'?`tick:${t.axis}:${t.index}`:`${t.kind}:${t.index}`;
const targetOf=(id:string):EditTarget=>{const [kind,a,b]=id.split(':');if(kind==='axis')return {kind,axis:a as 'x'|'y'|'right'|'top'};if(kind==='tick')return {kind,axis:a as 'x'|'y'|'right'|'top',index:Number(b)};return {kind:'label',index:Number(a)};};
const rounded=(v:number)=>Number(v.toPrecision(12));
const equalPoint=(a:{x:number;y:number},b:{x:number;y:number})=>a.x===b.x&&a.y===b.y;
const hasTarget=(g:Graph,t:EditTarget)=>t.kind==='point'?Boolean(g.curves[t.curve]?.points[t.index]):t.kind==='curve'?Boolean(g.curves[t.curve]):t.kind==='label'?Boolean(g.labels[t.index]):t.kind==='guide'?Boolean(g.guides[t.index]):t.kind==='tick'?Boolean((t.axis==='top'?g.topXAxis?.ticks:t.axis==='right'?g.rightYAxis?.ticks:g[t.axis==='x'?'xTicks':'yTicks'])?.[t.index]):t.kind==='axis'&&t.axis==='right'?Boolean(g.rightYAxis):t.kind==='axis'&&t.axis==='top'?Boolean(g.topXAxis):true;
const isModelHandle=(g:Graph,t:EditTarget)=>t.kind==='point'&&Boolean(g.curves[t.curve]?.distribution||g.curves[t.curve]?.conic);
const deleteName=(g:Graph,t:EditTarget)=>t.kind==='curve'||isModelHandle(g,t)?'그래프 전체':t.kind==='point'?'점':t.kind==='guide'?'보조선':t.kind==='axis'?'축 이름':t.kind==='tick'?'눈금':'문자';

export function GraphPreview({graph,style,disabled,follow,onFollowChange,onCommit,onDropImage}:{graph:Graph;style:Style;disabled:boolean;follow:boolean;onFollowChange:(value:boolean)=>void;onCommit:(graph:Graph)=>void;onDropImage:(file:File)=>void}){
 const [enabled,setEnabled]=useState(true),[selected,setSelected]=useState<EditTarget|null>(null),[draft,setDraft]=useState<Graph|null>(null);
 const [addingPoint,setAddingPoint]=useState(false),[shadingOpen,setShadingOpen]=useState(false);
 const [drawingRectangle,setDrawingRectangle]=useState(false),[initialShadingIndex,setInitialShadingIndex]=useState<number|undefined>();
 const [snap,setSnap]=useState(false),[step,setStep]=useState('0.1'),[error,setError]=useState('');
 const [deletionNotice,setDeletionNotice]=useState<{graph:Graph;message:string}|null>(null);
 const [typed,setTyped]=useState<{source:string;svg:string;errors:string[]}>({source:'',svg:'',errors:[]});
 const [boxes,setBoxes]=useState<Box[]>([]),[paths,setPaths]=useState<Path[]>([]),[guidePaths,setGuidePaths]=useState<Path[]>([]),[scale,setScale]=useState(1);
 const [dragView,setDragView]=useState<Pick<Drag,'graph'|'inspected'>|null>(null);
 const [observed,setObserved]=useState({graph,disabled});
 const content=useRef<HTMLDivElement>(null),overlay=useRef<SVGSVGElement>(null),drag=useRef<Drag|null>(null);
 // Reset prop-dependent interaction state before painting the new graph.
 // The gesture ref remains event-only; dragView holds its frozen inspector.
 if(observed.graph!==graph||observed.disabled!==disabled){
  setObserved({graph,disabled});
  if(observed.graph!==graph||disabled){setDraft(null);setDrawingRectangle(false);setDragView(null);}
  if(observed.graph.title!==graph.title){setSelected(null);setAddingPoint(false);setShadingOpen(false);}
  else if(observed.graph!==graph)setSelected(t=>{
   if(t?.kind==='point'&&graph.curves[t.curve]?.distribution)return {...t,index:distributionPeakIndex(graph.curves[t.curve])};
   if(t?.kind==='point'&&graph.curves[t.curve]?.conic&&!conicHandleIndices(graph.curves[t.curve]).includes(t.index))return {kind:'curve',curve:t.curve};
   return t&&hasTarget(graph,t)?t:null;
  });
 }
 const current=draft||graph,layout=useMemo(()=>graphLayout(current,style),[current,style]);
 const source=useMemo(()=>renderGraph(current,style,'preview'),[current,style]);
 const cached=typesetSvgCached(source);
 const display=cached?.svg||(typed.source===source?typed.svg:source);
 useEffect(()=>{let active=true;if(cached)return;typesetSvg(source).then(r=>{if(active)setTyped({source,...r});});return()=>{active=false;};},[source,cached]);
 useLayoutEffect(()=>{
  const items=Array.from(content.current?.querySelectorAll<SVGGraphicsElement>('[data-edit]')||[]);
  setBoxes(items.filter(el=>!el.dataset.edit?.startsWith('curve:')).map(el=>{const b=el.getBBox();return {id:el.dataset.edit!,x:b.x-5,y:b.y-5,width:Math.max(16,b.width+10),height:Math.max(20,b.height+10)};}));
  const grouped=new Map<number,string>();
  for(const el of items.filter(el=>el.dataset.edit?.startsWith('curve:'))){const i=Number(el.dataset.edit!.split(':')[1]),d=el.getAttribute('d');if(d)grouped.set(i,(grouped.get(i)??'')+' '+d);}
  setPaths([...grouped].map(([index,d])=>({index,d})));
  setGuidePaths(Array.from(content.current?.querySelectorAll<SVGGraphicsElement>('[data-guide]')??[]).map(el=>({index:Number(el.dataset.guide),d:el.getAttribute('d')??`M${el.getAttribute('x1')},${el.getAttribute('y1')} L${el.getAttribute('x2')},${el.getAttribute('y2')}`})));
 },[display]);
 useLayoutEffect(()=>{const node=content.current;if(!node)return;const observer=new ResizeObserver(()=>setScale(node.getBoundingClientRect().width/style.width||1));observer.observe(node);return()=>observer.disconnect();},[style.width]);
 function cancel(){drag.current=null;setDragView(null);setDraft(null);setDrawingRectangle(false);setSelected(t=>t?{...t}:t);}
 useEffect(()=>{const escape=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape'){drag.current=null;setDragView(null);setDraft(null);setAddingPoint(false);setDrawingRectangle(false);setSelected(t=>t?{...t}:t);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
 useLayoutEffect(()=>{drag.current=null;},[graph,disabled]);
 function deleteSelection(){
  if(disabled||!enabled||!selected||addingPoint||drawingRectangle||shadingOpen||drag.current||!hasTarget(graph,selected))return;
  try{
   const next=deleteGraphTarget(graph,selected);
   if(JSON.stringify(next)===JSON.stringify(graph))return;
   setDeletionNotice({graph:next,message:`${deleteName(graph,selected)} 삭제 완료. 실행 취소로 복원할 수 있습니다.`});
   setSelected(null);setDraft(null);setError('');
   overlay.current?.focus({preventScroll:true});
   onCommit(next);
  }catch(e){setError(e instanceof Error?e.message:'선택한 항목을 삭제하지 못했습니다.');}
 }
 function deleteOnKeyDown(e:KeyboardEvent<SVGSVGElement|HTMLFormElement>){
  if(!['Delete','Backspace'].includes(e.key)||e.defaultPrevented||e.repeat||e.nativeEvent.isComposing||e.keyCode===229||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;
  const target=e.target instanceof Element?e.target:null;
  if(target?.closest('input,textarea,select,[contenteditable],[role="textbox"],[role="combobox"]')||document.querySelector('[role="dialog"],[role="alertdialog"]'))return;
  if(disabled||!enabled||!selected||addingPoint||drawingRectangle||shadingOpen||drag.current)return;
  e.preventDefault();e.stopPropagation();deleteSelection();
 }
 function svgPoint(e:{clientX:number;clientY:number}){const matrix=overlay.current?.getScreenCTM();return matrix?new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse()):null;}
 function begin(e:PointerEvent<SVGElement>,target:EditTarget){
  if(disabled||!enabled||e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus({preventScroll:true});setSelected(target);setError('');setDeletionNotice(null);
  if(target.kind==='axis'||target.kind==='tick'||target.kind==='guide')return;
  const p=svgPoint(e);if(!p)return;overlay.current?.setPointerCapture(e.pointerId);
  drag.current={target,inspected:selected,start:{x:p.x,y:p.y},graph,next:graph,pointer:e.pointerId,moved:false,box:target.kind==='label'?boxes.find(b=>b.id===keyOf(target)):undefined};
  setDragView({graph,inspected:selected});
 }
 function addPoint(curve:number,segment:number,t=.5){
  try{const result=insertCurvePoint(graph,curve,segment,t);onCommit(result.graph);setSelected({kind:'point',curve,index:result.index});setAddingPoint(false);setShadingOpen(false);setError('');}
  catch(e){setError(e instanceof Error?e.message:'점을 추가할 수 없습니다.');}
 }
 function addAtPointer(curve:number,e:{clientX:number;clientY:number}){
  const p=svgPoint(e);if(!p)return;
  try{const c=graph.curves[curve],near=nearestMappedCurvePosition(c,p,x=>layout.XFor(x,c.xAxis),y=>layout.YFor(y,c.yAxis));addPoint(curve,near.segment,near.t);}
  catch(e){setError(e instanceof Error?e.message:'선 위의 다른 위치를 선택해 주세요.');}
 }
 function quantize(v:number){const n=Number(step);return rounded(snap&&Number.isFinite(n)&&n>0?Math.round(v/n)*n:v);}
 function move(e:PointerEvent<SVGSVGElement>){
  const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const p=svgPoint(e);if(!p)return;
  const dx=p.x-d.start.x,dy=p.y-d.start.y;if(!d.moved&&Math.hypot(dx,dy)<2)return;d.moved=true;
  const base=graphLayout(d.graph,style),t=d.target;let next=d.graph;
  try{
   if(t.kind==='point'){const c=d.graph.curves[t.curve],old=c.points[t.index],world=base.worldFor(base.XFor(old.x,c.xAxis)+dx,base.YFor(old.y,c.yAxis)+dy,c.yAxis,c.xAxis);next=movePoint(d.graph,t.curve,t.index,quantize(world.x),quantize(world.y),follow);}
   if(t.kind==='curve'){const c=d.graph.curves[t.curve],start=base.worldFor(d.start.x,d.start.y,c.yAxis,c.xAxis),end=base.worldFor(p.x,p.y,c.yAxis,c.xAxis);next=moveCurve(d.graph,t.curve,quantize(end.x-start.x),quantize(end.y-start.y),follow);}
   if(t.kind==='label'){const b=d.box;const xx=b?Math.max(-b.x,Math.min(style.width-b.x-b.width,dx)):dx,yy=b?Math.max(-b.y,Math.min(style.height-b.y-b.height,dy)):dy;next=moveLabel(d.graph,t.index,rounded(xx),rounded(yy));}
   d.next=next;setDraft(next);
  }catch(e){setError(e instanceof Error?e.message:'이동할 수 없습니다.');}
 }
 function finish(e:PointerEvent<SVGSVGElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;setDragView(null);setDraft(null);setSelected({...d.target});if(overlay.current?.hasPointerCapture(e.pointerId))overlay.current.releasePointerCapture(e.pointerId);if(d.moved&&JSON.stringify(d.graph)!==JSON.stringify(d.next))onCommit(d.next);}
 function nudge(e:KeyboardEvent<SVGElement>,t:EditTarget){
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||t.kind==='axis'||t.kind==='tick'||t.kind==='guide')return;
  e.preventDefault();const factor=e.shiftKey?10:1,x=(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)*factor,y=(e.key==='ArrowUp'?1:e.key==='ArrowDown'?-1:0)*factor;
  try{
   if(t.kind==='label'){onCommit(moveLabel(graph,t.index,x,-y));setSelected(t);return;}
   const c=graph.curves[t.curve],point=c.points[t.kind==='point'?t.index:0];
   const nextWorld=layout.worldFor(layout.XFor(point.x,c.xAxis)+x*(layout.R-layout.L)/100,layout.YFor(point.y,c.yAxis)-y*(layout.B-layout.T)/100,c.yAxis,c.xAxis);
   const snapUnit=snap&&Number(step)>0?Number(step):null;
   const sx=Math.sign(layout.XFor(xAxisRange(graph,c.xAxis).max,c.xAxis)-layout.XFor(xAxisRange(graph,c.xAxis).min,c.xAxis));
   const yr=yAxisRange(graph,c.yAxis),sy=Math.sign(layout.YFor(yr.min,c.yAxis)-layout.YFor(yr.max,c.yAxis));
   const dx=snapUnit===null?nextWorld.x-point.x:x*snapUnit*sx,dy=snapUnit===null?nextWorld.y-point.y:y*snapUnit*sy;
   const next=t.kind==='point'?movePoint(graph,t.curve,t.index,rounded(point.x+dx),rounded(point.y+dy),follow):moveCurve(graph,t.curve,dx,dy,follow);
   onCommit(next);setSelected(t);
  }catch(e){setError(e instanceof Error?e.message:'이동할 수 없습니다.');}
 }
 const active=enabled&&!disabled;
 const selectedCurve=selected&&(selected.kind==='curve'||selected.kind==='point')?selected.curve:null;
 // Mounting an inspector during pointer-down can shift a sticky canvas under
 // the cursor. Keep its previous content and height until the gesture ends.
 const inspectorGraph=dragView?.graph||current;
 const inspection=dragView?dragView.inspected:selected;
 const inspected=inspection&&hasTarget(inspectorGraph,inspection)?inspection:null;
 const formulaControls=current.curves.some(c=>c.distribution);
 const conicControls=current.curves.some(c=>c.conic);
 const smoothControls=current.curves.some(c=>c.smooth&&!smoothConnectionIssue(c.points));
 const mathErrors=typed.source===source?typed.errors:[];
 const clipName=(xa:XAxis='bottom',ya:YAxis='left')=>`preview-hit-${xa}-${ya}`;
 const axes=(['bottom',...(current.topXAxis?['top']:[])] as XAxis[]).flatMap(xa=>(['left',...(current.rightYAxis?['right']:[])] as YAxis[]).map(ya=>({xa,ya})));
 return <>
  <div className="preview-toolbar"><button className={'button '+(enabled?'edit-active':'')} aria-pressed={enabled} onClick={()=>{cancel();setAddingPoint(false);setEnabled(v=>!v);}} disabled={disabled}><MousePointer2 size={15}/>{enabled?'직접 편집 켜짐':'직접 편집 켜기'}</button>
   <button className={'button '+(addingPoint?'edit-active':'')} aria-pressed={addingPoint} disabled={disabled||!graph.curves.some(c=>!c.distribution&&!c.conic&&(c.plot??'line')==='line'&&c.points.length>1&&c.points.length<500)} onClick={()=>{cancel();setEnabled(true);setShadingOpen(false);setAddingPoint(v=>!v);setError('');}}><Plus size={15}/>{addingPoint?'점 추가 취소':'점 추가'}</button>
   <button className={'button '+(shadingOpen?'edit-active':'')} aria-expanded={shadingOpen} disabled={disabled} onClick={()=>{cancel();setAddingPoint(false);setInitialShadingIndex(undefined);setShadingOpen(v=>!v);}}><PaintBucket size={15}/>{graph.shadings?.length?`음영 편집 (${graph.shadings.length})`:'음영 추가'}</button>
   <button className={'button '+(drawingRectangle?'edit-active':'')} aria-pressed={drawingRectangle} disabled={disabled||(graph.shadings?.length??0)>=20} onClick={()=>{cancel();setDrawingRectangle(!drawingRectangle);setEnabled(true);setAddingPoint(false);setShadingOpen(false);setSelected(null);setError('');}}><SquareDashed size={15}/>{drawingRectangle?'사각형 취소':'사각형 음영'}</button>
   <button className="button" disabled={disabled||graph.labels.length>=40} onClick={()=>{cancel();const index=graph.labels.length;onCommit({...graph,labels:[...graph.labels,{text:'A',...layout.world((layout.L+layout.R)/2,(layout.T+layout.B)/2),dx:0,dy:0}]});setEnabled(true);setSelected({kind:'label',index});}}><Plus size={15}/>문자 추가</button>
   <label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/>좌표 맞춤</label><input className="snap-step" type="number" min="0" step="any" value={step} disabled={!snap} aria-label="좌표 맞춤 간격" onChange={e=>setStep(e.target.value)}/>
   <label title="점이나 봉우리에 연결된 보조선과 문자가 함께 이동합니다."><input type="checkbox" checked={follow} onChange={e=>onFollowChange(e.target.checked)}/>보조선·문자 함께 이동</label>
  </div>
  <p className="preview-help" role={addingPoint||drawingRectangle?'status':undefined}>{drawingRectangle?'왼쪽 세로축 기준으로 대각선 드래그해 사각형 영역을 그리세요. Esc로 취소 · 좌표 입력은 음영 편집의 사각형 영역을 사용하세요.':addingPoint?'점을 추가할 선 위를 클릭하세요. 기존 점 사이에 삽입됩니다. Esc로 취소 · 키보드는 선 선택 후 아래의 중간 점 추가를 사용하세요.':active?(conicControls?'원·타원은 네 방향 손잡이로 크기를, 선을 드래그해 중심을 바꿉니다. 선을 선택하면 중심과 반지름을 정확히 입력할 수 있습니다.':formulaControls?'봉우리를 드래그해 위치·높이를 바꾸세요. 선을 선택하면 분포 종류와 폭을 조절할 수 있습니다.':smoothControls?'점·선을 클릭하면 연결 방식을 바꿀 수 있습니다. 곡선의 조절점은 주변 구간도 매끄럽게 바꿉니다.':'점·선을 클릭해 직선 / 곡선을 선택하세요. 드래그로 이동 · 방향키로 미세 이동 · Esc로 드래그 취소'):'편집 표시를 숨긴 미리보기입니다.'}</p>
  {shadingOpen&&!disabled&&<GraphShading graph={graph} onChange={onCommit} initialCurve={selectedCurve??undefined} initialShadingIndex={initialShadingIndex} onClose={()=>setShadingOpen(false)}/>}
  <div className={'paper '+(style.transparent?'transparent-paper':'')} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={e=>{e.preventDefault();if(!disabled&&e.dataTransfer.files[0])onDropImage(e.dataTransfer.files[0]);}}>
   <div className="graph-preview"><div ref={content} className="graph-art" dangerouslySetInnerHTML={{__html:display}}/>
    {active&&!drawingRectangle&&<svg ref={overlay} className={'graph-edit-overlay '+(addingPoint?'adding-point':'')} viewBox={`0 0 ${style.width} ${style.height}`} aria-label="그래프 직접 편집" role="group" tabIndex={-1} onKeyDown={deleteOnKeyDown} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={()=>{if(drag.current)cancel();}} onPointerDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
     <defs>{axes.map(({xa,ya})=><clipPath key={clipName(xa,ya)} id={clipName(xa,ya)}>{layout.xMappingFor(xa).pixelIntervals.flatMap(([x1,x2],xi)=>layout.yMappingFor(ya).pixelIntervals.map(([y1,y2],yi)=><rect key={`${xi}-${yi}`} x={x1} y={y1} width={x2-x1} height={y2-y1}/>))}</clipPath>)}</defs>
     {style.guides&&!addingPoint&&guidePaths.map(p=>{const g=current.guides[p.index];if(!g)return null;const t:EditTarget={kind:'guide',index:p.index};return <path key={p.index} d={p.d} fill="none" clipPath={`url(#${clipName(g.xAxis,g.yAxis)})`} stroke="transparent" strokeWidth={12/scale} className={'guide-hit '+(selected?.kind==='guide'&&selected.index===p.index?'selected':'')} tabIndex={0} role="button" aria-label={`보조선 ${p.index+1} 선택`} onPointerDown={e=>begin(e,t)} onClick={()=>setSelected(t)} onFocus={()=>setSelected(t)}/>;})}
     {paths.map(p=>{if(addingPoint&&(current.curves[p.index]?.distribution||current.curves[p.index]?.conic||(current.curves[p.index]?.plot??'line')!=='line'))return null;const t:EditTarget={kind:'curve',curve:p.index};return <path key={p.index} d={p.d} fill="none" clipPath={`url(#${clipName(current.curves[p.index]?.xAxis,current.curves[p.index]?.yAxis)})`} stroke="transparent" strokeWidth={16} className={'curve-hit '+(selectedCurve===p.index?'selected':'')} tabIndex={0} role="button" aria-label={addingPoint?`곡선 ${p.index+1}에 점 추가`:`곡선 ${p.index+1} 이동`} onPointerDown={e=>{if(addingPoint){e.preventDefault();return;}begin(e,t);}} onClick={e=>{if(addingPoint)addAtPointer(p.index,e);else setSelected(t);}} onFocus={()=>{if(!addingPoint)setSelected(t);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setAddingPoint(false);setSelected(t);}else if(!addingPoint)nudge(e,t);}}/>;})}
     {!addingPoint&&current.curves.flatMap((c,ci)=>{const count=c.points.length;const closed=(c.plot??'line')==='line'&&count>2&&equalPoint(c.points[0],c.points[count-1]);return c.points.flatMap((p,pi)=>{
      if(c.distribution&&pi!==distributionPeakIndex(c))return [];
      if(c.conic&&!conicHandleIndices(c).includes(pi))return [];
      if(closed&&pi===count-1)return [];
      if(!c.distribution&&!c.conic&&count>35&&(selectedCurve!==ci||pi%Math.ceil(count/30)!==0&&pi!==count-1&&!(selected?.kind==='point'&&selected.curve===ci&&selected.index===pi)))return [];
      if(!layout.xMappingFor(c.xAxis).contains(p.x)||!layout.yMappingFor(c.yAxis).contains(p.y))return [];
      const t:EditTarget={kind:'point',curve:ci,index:pi},isSelected=selected&&keyOf(selected)===keyOf(t);
      return <g key={c.distribution?`${ci}:distribution-peak`:`${ci}:${pi}`} tabIndex={0} role="button" aria-label={c.conic?`곡선 ${ci+1} ${["오른쪽","위쪽","왼쪽","아래쪽"][pi/4]} 반지름 조절`:c.distribution?`곡선 ${ci+1} 분포 봉우리 이동`:`곡선 ${ci+1}의 점 ${pi+1} 이동`} className={'point-handle '+(isSelected?'selected':'')} onPointerDown={e=>begin(e,t)} onClick={()=>setSelected(t)} onFocus={()=>setSelected(t)} onKeyDown={e=>nudge(e,t)}><circle cx={layout.XFor(p.x,c.xAxis)} cy={layout.YFor(p.y,c.yAxis)} r={Math.max(13,12/scale)} fill="transparent"/><circle cx={layout.XFor(p.x,c.xAxis)} cy={layout.YFor(p.y,c.yAxis)} r={(isSelected?6:4.5)/scale} className="visible-handle"/></g>;
     });})}
     {!addingPoint&&boxes.map(b=>{const t=targetOf(b.id);return <rect key={b.id} x={b.x} y={b.y} width={b.width} height={b.height} rx={3} className={'text-hit '+(selected&&keyOf(selected)===b.id?'selected':'')} tabIndex={0} role="button" aria-label={t.kind==='axis'?`${t.axis==='x'?'가로':t.axis==='top'?'위쪽 가로':t.axis==='right'?'오른쪽 세로':'왼쪽 세로'}축 이름 편집`:t.kind==='tick'?`${t.axis==='x'?'가로':t.axis==='top'?'위쪽 가로':t.axis==='right'?'오른쪽 세로':'왼쪽 세로'}축 눈금 ${t.index+1} 편집`:`문자 ${t.kind==='label'?t.index+1:''} 이동·편집`} onPointerDown={e=>begin(e,t)} onClick={()=>setSelected(t)} onFocus={()=>setSelected(t)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(t);}else nudge(e,t);}}/>;})}
    </svg>}
    {active&&drawingRectangle&&<RectangleShadeDraw graph={graph} style={style} snapStep={snap?Number(step):null} onError={setError} onCreate={shade=>{onCommit(graphSchema.parse({...graph,shadings:[...(graph.shadings??[]),shade]}));setDrawingRectangle(false);setInitialShadingIndex(graph.shadings?.length??0);setShadingOpen(true);setError('');}}/>}
   </div>
   {disabled&&<div className="canvas-loading"><Move size={24}/><span>축과 곡선의 관계를 읽고 있습니다</span></div>}
  </div>
  <div className="canvas-caption"><span>{active?'선택 후 Delete / Backspace로 삭제 · 실행 취소 가능':'흑백 · 시험지 스타일'}</span><span>{style.width} × {style.height} px</span></div>
  {active&&inspected&&!addingPoint&&!drawingRectangle&&<SelectionEditor graph={inspectorGraph} target={inspected} follow={follow} onCommit={onCommit} onInsert={addPoint} onDelete={deleteSelection} onDeleteKey={deleteOnKeyDown} onClose={()=>setSelected(null)}/>}
  {deletionNotice?.graph===graph&&<p className="preview-help deletion-notice" role="status">{deletionNotice.message}</p>}
  {(error||mathErrors.length>0)&&<p role="alert" className="error">{error||`수식 문법을 확인해 주세요: ${mathErrors.join(', ')}`}</p>}
 </>;
}

function SelectionEditor({graph,target,follow,onCommit,onInsert,onDelete,onDeleteKey,onClose}:{graph:Graph;target:EditTarget;follow:boolean;onCommit:(g:Graph)=>void;onInsert:(curve:number,segment:number)=>void;onDelete:()=>void;onDeleteKey:(e:KeyboardEvent<HTMLFormElement>)=>void;onClose:()=>void}){
 let savedText='',savedX='',savedY='';
 if(target.kind==='point'){const p=graph.curves[target.curve]?.points[target.index];if(p){savedX=String(p.x);savedY=String(p.y);}}
 if(target.kind==='label'){const l=graph.labels[target.index];if(l){savedText=l.text;savedX=String(l.dx);savedY=String(l.dy);}}
 if(target.kind==='axis')savedText=target.axis==='top'?graph.topXAxis?.label??'':target.axis==='right'?graph.rightYAxis?.label??'':graph[target.axis==='x'?'xLabel':'yLabel'];
 if(target.kind==='tick'){const tick=(target.axis==='top'?graph.topXAxis?.ticks:target.axis==='right'?graph.rightYAxis?.ticks:graph[target.axis==='x'?'xTicks':'yTicks'])?.[target.index];if(tick){savedText=tick.label;savedX=String(tick.value);}}
 if(target.kind==='curve')savedText=graph.curves[target.curve]?.name||'';
 const selectionKey=keyOf(target);
 const [text,setText]=useState(savedText),[x,setX]=useState(savedX),[y,setY]=useState(savedY),[error,setError]=useState('');
 const [saved,setSaved]=useState({selectionKey,text:savedText,x:savedX,y:savedY});
 // Connection and style changes must not overwrite unapplied field edits.
 if(saved.selectionKey!==selectionKey||saved.text!==savedText||saved.x!==savedX||saved.y!==savedY){
  setSaved({selectionKey,text:savedText,x:savedX,y:savedY});setError('');setText(savedText);setX(savedX);setY(savedY);
 }
 const curveIndex=target.kind==='curve'||target.kind==='point'?target.curve:null;
 const connection=curveIndex===null?null:graph.curves[curveIndex];
 const t=target,title=t.kind==='point'?(connection?.conic?'원·타원 크기':connection?.distribution?'분포 봉우리':`점 ${t.index+1} 좌표`):t.kind==='curve'?`곡선 ${t.curve+1}`:t.kind==='label'?`문자 ${t.index+1}`:t.kind==='guide'?`보조선 ${t.index+1}`:t.kind==='axis'?`${t.axis==='x'?'가로':t.axis==='top'?'위쪽 가로':t.axis==='right'?'오른쪽 세로':'왼쪽 세로'}축 이름`:`${t.axis==='x'?'가로':t.axis==='top'?'위쪽 가로':t.axis==='right'?'오른쪽 세로':'왼쪽 세로'}축 눈금 ${t.index+1}`;
 function apply(){if(t.kind==='guide')return;try{let next=graph;
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
 function changeAxis(axis:YAxis){
  try{
   const next=curveIndex!==null?{...graph,curves:graph.curves.map((c,i)=>i===curveIndex?{...c,yAxis:axis}:c),shadings:graph.shadings?.map(s=>s.mode!=='rectangle'&&s.curve===curveIndex?{...s,yAxis:undefined}:s)}:t.kind==='label'?{...graph,labels:graph.labels.map((l,i)=>i===t.index?{...l,yAxis:axis}:l)}:graph;
   const valid=graphSchema.safeParse(next);
   if(!valid.success)throw Error('축을 변경할 수 없습니다. 두 선 사이 음영은 같은 세로축의 선끼리만 사용할 수 있습니다.');
   onCommit(valid.data);setError('');
  }catch(e){setError(e instanceof Error?e.message:'축 설정을 확인해 주세요.');}
 }

 function changeXAxis(axis:XAxis){
  try{
   const next=curveIndex!==null?{...graph,curves:graph.curves.map((c,i)=>i===curveIndex?{...c,xAxis:axis}:c),shadings:graph.shadings?.map(s=>s.mode!=='rectangle'&&s.curve===curveIndex?{...s,xAxis:undefined}:s)}:t.kind==='label'?{...graph,labels:graph.labels.map((l,i)=>i===t.index?{...l,xAxis:axis}:l)}:graph;
   const valid=graphSchema.safeParse(next);if(!valid.success)throw Error(valid.error.issues[0].message);
   onCommit(valid.data);setError('');
  }catch(e){setError(e instanceof Error?e.message:'가로축 설정을 확인해 주세요.');}
 }
 function changePlot(curve:Graph['curves'][number]){
  if(curveIndex===null)return;
  try{onCommit(replaceCurve(graph,curveIndex,curve,follow));setError('');}catch(e){setError(e instanceof Error?e.message:'그래프 종류를 확인해 주세요.');}
 }

 return <form className="preview-inspector" noValidate onKeyDown={onDeleteKey} onSubmit={e=>{e.preventDefault();apply();}}><div className="inspector-title"><strong>{title}</strong><div className="selection-actions"><button type="button" className="button selection-delete" onClick={onDelete} title="Delete / Backspace"><Trash2 size={14}/>{deleteName(graph,t)} 삭제</button><button type="button" className="icon-button" aria-label="선택 해제" onClick={onClose}><X size={14}/></button></div></div><p className="selection-delete-hint">{isModelHandle(graph,t)?'분포 봉우리·원/타원 손잡이를 삭제하면 해당 그래프 전체가 삭제됩니다. ':'선택한 항목은 Delete 또는 Backspace로 삭제할 수 있습니다. '}{t.kind==='axis'?'축은 유지하고 이름만 지웁니다. ':''}실행 취소로 복원할 수 있습니다.</p>{t.kind!=='guide'&&!((connection?.distribution||connection?.conic)&&t.kind==='point')&&<div className="inspector-fields">
  {t.kind!=='point'&&<label className="inspector-text">{t.kind==='curve'?'선 이름':'표시할 문자'}<textarea rows={1} aria-label="선택한 문자" value={text} maxLength={t.kind==='curve'?40:t.kind==='label'?120:80} onChange={e=>setText(e.target.value)}/></label>}
  {(t.kind==='point'||t.kind==='label'||t.kind==='tick')&&<label>{t.kind==='label'?'가로 이동(px)':t.kind==='tick'?'눈금 좌표':'x 좌표'}<input type="number" step="any" aria-label={t.kind==='point'?'선택한 점 x 좌표':t.kind==='label'?'문자 가로 이동':'눈금 좌표'} value={x} onChange={e=>setX(e.target.value)}/></label>}
  {(t.kind==='point'||t.kind==='label')&&<label>{t.kind==='label'?'세로 이동(px)':'y 좌표'}<input type="number" step="any" aria-label={t.kind==='point'?'선택한 점 y 좌표':'문자 세로 이동'} value={y} onChange={e=>setY(e.target.value)}/></label>}
  <button className="button primary" type="submit">적용</button>
 </div>}{(connection||t.kind==='label')&&<label className="axis-assignment">기준 세로축<select aria-label="선택한 요소의 기준 세로축" value={connection?.yAxis??(t.kind==='label'?graph.labels[t.index].yAxis:undefined)??'left'} onChange={e=>changeAxis(e.target.value as YAxis)}><option value="left">왼쪽 세로축</option><option value="right" disabled={!graph.rightYAxis}>오른쪽 세로축{!graph.rightYAxis?' (축·눈금에서 추가)':''}</option></select>{graph.rightYAxis&&<span>좌표값은 유지하고 선택한 축의 눈금으로 표시합니다.</span>}</label>}{graph.topXAxis&&(connection||t.kind==='label')&&<label className="axis-assignment">기준 가로축<select aria-label="선택한 요소의 기준 가로축" value={connection?.xAxis??(t.kind==='label'?graph.labels[t.index].xAxis:undefined)??'bottom'} onChange={e=>changeXAxis(e.target.value as XAxis)}><option value="bottom">기본 가로축</option><option value="top">위쪽 보조 가로축</option></select></label>}{connection&&<CurvePlotControls graph={graph} curve={connection} onChange={changePlot}/>}{connection&&(connection.plot??'line')==='line'&&!connection.distribution&&!connection.conic&&<CurveConnection points={connection.points} smooth={connection.smooth} onChange={smooth=>onCommit({...graph,curves:graph.curves.map((c,i)=>i===curveIndex?{...c,smooth}:c)})}/>}
 {connection&&(connection.plot??'line')==='line'&&!connection.conic&&curveIndex!==null&&<DistributionControls key={`distribution-${curveIndex}`} curve={connection} onChange={curve=>onCommit(replaceCurve(graph,curveIndex,curve,follow))}/>}
 {connection&&(connection.plot??'line')==='line'&&!connection.distribution&&curveIndex!==null&&<ConicControls key={`conic-${curveIndex}`} curve={connection} onChange={curve=>onCommit(replaceCurve({...graph,...((curve.conic&&!connection.conic||connection.conic&&graph.equalAxes===undefined)?{equalAxes:!graph.rightYAxis&&!graph.topXAxis&&graph.xScale!=='log'&&graph.yScale!=='log'&&!graph.xBreak&&!graph.yBreak}:{})},curveIndex,curve,follow))}/> }
 {connection&&<CurveLineStyle value={curveLineStyle(connection)} onChange={lineStyle=>onCommit({...graph,curves:graph.curves.map((c,i)=>i===curveIndex?{...c,lineStyle,dashed:lineStyle!=='solid'}:c)})}/>}
 {connection&&(connection.plot??'line')==='line'&&!connection.distribution&&!connection.conic&&curveIndex!==null&&<CurvePointInsert key={curveIndex} points={connection.points} initialSegment={t.kind==='point'?t.index:0} onInsert={segment=>onInsert(curveIndex,segment)}/>}
 {t.kind==='curve'&&(connection?.plot??'line')==='line'&&!connection?.distribution&&!connection?.conic&&<div className="curve-options">{(['dots','arrows'] as const).map(k=><label key={k}><input type="checkbox" checked={graph.curves[t.curve]?.[k]||false} onChange={e=>onCommit({...graph,curves:graph.curves.map((c,i)=>i===t.curve?{...c,[k]:e.target.checked}:c)})}/>{({dots:'점 표시',arrows:'진행 방향'})[k]}</label>)}</div>}{error&&<p className="error" role="alert">{error}</p>}</form>;
}
