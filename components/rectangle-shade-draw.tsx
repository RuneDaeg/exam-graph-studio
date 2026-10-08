'use client';

import {useRef,useState,type PointerEvent} from 'react';
import {graphLayout,type Graph,type Shading,type Style} from '@/lib/graph';
import {createRectangleShading} from '@/lib/graph-edit';

type Point={x:number;y:number};
type Gesture={pointer:number;start:Point;end:Point};
type Props={graph:Graph;style:Style;snapStep:number|null;onCreate:(shade:Shading)=>void;onError:(message:string)=>void};

export function RectangleShadeDraw({graph,style,snapStep,onCreate,onError}:Props){
 const svg=useRef<SVGSVGElement>(null),gesture=useRef<Gesture|null>(null);
 const [region,setRegion]=useState<{start:Point;end:Point}|null>(null);
 const layout=graphLayout(graph,style);
 function position(event:{clientX:number;clientY:number}):Point|null{
  const matrix=svg.current?.getScreenCTM();if(!matrix)return null;
  const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  const world=layout.world(p.x,p.y);
  const quantize=(value:number)=>Number((snapStep&&Number.isFinite(snapStep)&&snapStep>0?Math.round(value/snapStep)*snapStep:value).toPrecision(12));
  return {x:Math.max(graph.xMin,Math.min(graph.xMax,quantize(world.x))),y:Math.max(graph.yMin,Math.min(graph.yMax,quantize(world.y)))};
 }
 function start(event:PointerEvent<SVGRectElement>){
  if(event.button!==0||gesture.current)return;
  const p=position(event);if(!p)return;
  event.preventDefault();event.stopPropagation();svg.current?.focus({preventScroll:true});svg.current?.setPointerCapture(event.pointerId);
  gesture.current={pointer:event.pointerId,start:p,end:p};setRegion({start:p,end:p});onError('');
 }
 function move(event:PointerEvent<SVGSVGElement>){
  const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;
  const end=position(event);if(!end)return;
  current.end=end;setRegion({start:current.start,end});
 }
 function cancel(){gesture.current=null;setRegion(null);}
 function finish(event:PointerEvent<SVGSVGElement>){
  const current=gesture.current;if(!current||current.pointer!==event.pointerId)return;
  const end=position(event)??current.end;
  cancel();if(svg.current?.hasPointerCapture(event.pointerId))svg.current.releasePointerCapture(event.pointerId);
  try{onCreate(createRectangleShading(graph,current.start,end,'left'));}
  catch(error){onError(error instanceof Error?error.message:'대각선으로 드래그해 사각형의 두 모서리를 지정해 주세요.');}
 }
 const x=region?layout.X(Math.min(region.start.x,region.end.x)):0,y=region?layout.Y(Math.max(region.start.y,region.end.y)):0;
 return <svg ref={svg} className="graph-edit-overlay rectangle-draw-overlay" viewBox={`0 0 ${style.width} ${style.height}`} role="group" aria-label="사각형 음영 그리기" tabIndex={0} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}>
  <rect x={layout.L} y={layout.T} width={layout.R-layout.L} height={layout.B-layout.T} fill="transparent" className="rectangle-draw-surface" onPointerDown={start}/>
  {region&&<rect x={x} y={y} width={Math.abs(region.end.x-region.start.x)*layout.dx} height={Math.abs(region.end.y-region.start.y)*layout.dy} className="rectangle-draw-region" pointerEvents="none"/>}
 </svg>;
}
