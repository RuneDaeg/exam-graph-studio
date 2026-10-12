'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { defaultStyle, renderGraph, type Graph } from '@/lib/graph';
import { typesetSvg } from '@/lib/math-svg';
import { textbookTemplates, textbookBooks, textbookCourses, filterTextbookTemplates } from '@/lib/textbook-presets';
import './textbook-library.css';

function Preview({graph,id}:{graph:Graph;id:string}){
 const raw=useMemo(()=>renderGraph(graph,{...defaultStyle,width:760,height:540,fontSize:22},`textbook-${id}`),[graph,id]);
 const [result,setResult]=useState({raw:'',svg:''});
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  void typesetSvg(raw).then(output=>{if(active){setResult({raw,svg:output.svg});setError('');}}).catch(()=>{if(active)setError('글꼴 변환을 완료하지 못해 기본 미리보기를 표시합니다.');});
  return()=>{active=false;};
 },[raw]);
 return <><div className="library-preview" aria-label={`${graph.title} 미리보기`} dangerouslySetInnerHTML={{__html:result.raw===raw?result.svg:raw}}/>{error&&<p role="status" className="textbook-render-note">{error}</p>}</>;
}

const pageSize=16;
export function TextbookLibrary({onSelect,onClose,onReturnFocus}:{onSelect:(graph:Graph)=>void;onClose:()=>void;onReturnFocus:()=>void}){
 const [course,setCourse]=useState('전체');
 const [book,setBook]=useState('전체');
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(0);
 const [selectedId,setSelectedId]=useState(textbookTemplates[0].id);
 const [panel,setPanel]=useState(0);
 const results=useMemo(()=>filterTextbookTemplates(course,book,query),[course,book,query]);
 const pages=Math.max(1,Math.ceil(results.length/pageSize));
 const activePage=Math.min(page,pages-1);
 const visible=results.slice(activePage*pageSize,(activePage+1)*pageSize);
 const selected=results.find(item=>item.id===selectedId)??visible[0];
 const panelIndex=selected?Math.min(panel,selected.graphs.length-1):0;
 const graph=selected?.graphs[panelIndex];
 const reset=()=>{setCourse('전체');setBook('전체');setQuery('');setPage(0);setPanel(0);};
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}>
  <DialogContent className="library-dialog textbook-dialog" onCloseAutoFocus={event=>{event.preventDefault();onReturnFocus();}}>
   <DialogHeader>
    <span className="eyebrow">TEXTBOOK GRAPH LIBRARY</span>
    <DialogTitle className="library-title"><BookOpen size={21}/>교과서에서 찾은 그래프 유형 <span>{textbookTemplates.length}</span></DialogTitle>
    <DialogDescription>19권·3,422쪽의 텍스트 탐색과 77쪽의 그림 검토에서 선별한 대표 사례 88건입니다. 전체 그래프 개수는 아닙니다.<br/>공식·개념 관계를 새 좌표로 그린 편집 예시이며, 교과서 원본 그림이나 실측 자료를 제공하지 않습니다.</DialogDescription>
   </DialogHeader>
   <div className="library-filters textbook-filters">
    <label className="library-search"><Search size={17}/><input aria-label="교과서 유형 검색" placeholder="개념, 그래프, 축 검색" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);setPanel(0);}}/></label>
    <label className="library-course"><span className="sr-only">교과 영역</span><select aria-label="교과서 영역" value={course} onChange={event=>{setCourse(event.target.value);setBook('전체');setPage(0);setPanel(0);}}><option value="전체">모든 영역</option>{textbookCourses.map(item=><option key={item}>{item}</option>)}</select></label>
    <label className="library-course textbook-book"><span className="sr-only">교과서</span><select aria-label="교과서 선택" value={book} onChange={event=>{setBook(event.target.value);setPage(0);setPanel(0);}}><option value="전체">모든 교과서</option>{textbookBooks.filter(item=>course==='전체'||textbookTemplates.some(t=>t.book===item&&t.course===course)).map(item=><option key={item}>{item}</option>)}</select></label>
   </div>
   <div className="library-count" role="status">{results.length}개 대표 사례 <span>출처 쪽수 · 재구성 조건 · 과학적 주의점</span></div>
   <div className="library-body">
    <div className="textbook-list-column">
     <div className="library-results textbook-results" aria-label="교과서 그래프 사례 목록">
      {visible.map(template=><button key={template.id} className={`library-card textbook-card${selected?.id===template.id?' selected':''}`} aria-pressed={selected?.id===template.id} onClick={()=>{setSelectedId(template.id);setPanel(0);}}>
       <div className="library-card-copy"><span>{template.course} · {template.caseId}</span><strong>{template.name}</strong><small>{template.book} · PDF {template.source.pdfPage}쪽</small><span className="textbook-panel-count">{template.graphs.length}개 편집 패널</span></div>
      </button>)}
      {!results.length&&<div className="library-empty"><b>일치하는 사례가 없습니다.</b><p>검색어나 교과서를 바꿔 보세요.</p><button className="button" onClick={reset}>전체 사례 보기</button></div>}
     </div>
     <nav className="textbook-pagination" aria-label="사례 목록 페이지"><button className="button" aria-label="이전 사례 페이지" disabled={activePage===0} onClick={()=>{setPage(activePage-1);setSelectedId(results[(activePage-1)*pageSize].id);setPanel(0);}}><ChevronLeft size={16}/></button><span>{activePage+1} / {pages}</span><button className="button" aria-label="다음 사례 페이지" disabled={activePage+1>=pages} onClick={()=>{setPage(activePage+1);setSelectedId(results[(activePage+1)*pageSize].id);setPanel(0);}}><ChevronRight size={16}/></button></nav>
    </div>
    {selected&&graph&&<section className="library-detail" aria-label="선택한 교과서 사례 상세">
     <div className="library-detail-scroll">
      <div className="library-detail-heading"><span className="badge">{selected.course}</span><h3>{selected.name}</h3><p>{selected.description}</p></div>
      {selected.graphs.length>1&&<div className="textbook-panels" role="group" aria-label="편집할 패널 선택">{selected.graphs.map((item,index)=><button key={`${selected.id}-${index}`} aria-pressed={panelIndex===index} onClick={()=>setPanel(index)}>{index+1}. {item.title}</button>)}</div>}
      <Preview graph={graph} id={`${selected.id}-${panelIndex}`}/>
      <p className="textbook-axes"><b>선택 패널</b> {graph.title}<br/><span>가로축: {graph.xLabel} · 세로축: {graph.yLabel}</span>{graph.rightYAxis&&<><br/><span>오른쪽 축: {graph.rightYAxis.label}</span></>}{graph.topXAxis&&<><br/><span>위쪽 축: {graph.topXAxis.label}</span></>}</p>
      <div className="library-tags">{selected.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
      <div className="library-source"><b>유형을 확인한 출처</b><span>{selected.source.publisher} · {selected.source.book}</span><span>PDF {selected.source.pdfPage}쪽 · 책에 인쇄된 {selected.source.printedPage}쪽{selected.source.figure?` · ${selected.source.figure}`:''}</span></div>
      <div className="library-adaptation textbook-caution"><b>출제·편집 시 유의하세요</b><p>{selected.caution}</p></div>
      <details className="textbook-notes"><summary>재구성 조건과 패널 메모</summary><p>{graph.note}</p></details>
     </div>
     <div className="library-use"><span>AI · API 키 없이 편집 · 여러 패널은 하나씩 불러오기</span><button className="button primary full" onClick={()=>{onSelect(structuredClone(graph));onClose();}}>이 패널로 시작</button></div>
    </section>}
   </div>
  </DialogContent>
 </Dialog>;
}
