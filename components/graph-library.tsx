'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { defaultStyle, renderGraph, type Graph } from '@/lib/graph';
import { typesetSvg } from '@/lib/math-svg';
import { examTemplates, filterExamTemplates, scienceCourses, sourceTitle, type ExamTemplate } from '@/lib/exam-presets';

function TemplatePreview({ template, small = false }: { template: ExamTemplate; small?: boolean }) {
  const raw = useMemo(() => renderGraph(template.graph, {
    ...defaultStyle, width: 760, height: 540, fontSize: 23,
  }, `library-${small ? 'card' : 'detail'}-${template.id}`), [template, small]);
  const [rendered, setRendered] = useState({ raw: '', svg: '' });
  useEffect(() => {
    let active = true;
    void typesetSvg(raw).then(result => {
      if (active) setRendered({ raw, svg: result.svg });
    });
    return () => { active = false; };
  }, [raw]);
  return <div className={small ? 'library-thumbnail' : 'library-preview'}
    aria-hidden={small || undefined} dangerouslySetInnerHTML={{ __html: rendered.raw === raw ? rendered.svg : raw }} />;
}

export function GraphLibrary({ onSelect, onClose, onReturnFocus }: { onSelect: (graph: Graph) => void; onClose: () => void; onReturnFocus: () => void }) {
  const [course, setCourse] = useState('전체');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(examTemplates[0].id);
  const results = useMemo(() => filterExamTemplates(course, query), [course, query]);
  const selected = results.find(template => template.id === selectedId) ?? results[0];

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="library-dialog" onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus(); }}>
      <DialogHeader>
        <span className="eyebrow">EXAM GRAPH LIBRARY</span>
        <DialogTitle className="library-title"><BookOpen size={21} />기출에서 찾은 그래프 유형 <span>{examTemplates.length}</span></DialogTitle>
        <DialogDescription>2022–2026년 시행 6·9월 모의평가 · 과학탐구Ⅰ·Ⅱ<br />기출 그래프의 개념을 편집용 예시로 재구성했습니다.</DialogDescription>
      </DialogHeader>
      <div className="library-filters">
        <label className="library-search"><Search size={17} /><input aria-label="기출 유형 검색" placeholder="유형, 개념, 연도 검색" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <label className="library-course"><span className="sr-only">과목</span><select aria-label="기출 유형 과목" value={course} onChange={event => setCourse(event.target.value)}><option>전체</option>{scienceCourses.map(item => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="library-count" role="status">{results.length}개 유형 <span>원본 PDF 80개 텍스트 탐색 · 선정 문항 그림 대조</span></div>
      <div className="library-body">
        <div className="library-results" aria-label="기출 그래프 유형 목록">
          {results.map(template => <button key={template.id} className={'library-card' + (selected?.id === template.id ? ' selected' : '')} aria-pressed={selected?.id === template.id} onClick={() => setSelectedId(template.id)}>
            <TemplatePreview template={template} small />
            <div className="library-card-copy"><span>{template.course}</span><strong>{template.name}</strong><small>{template.source.academicYear}학년도 · {template.source.exam.slice(0, 2)} · {template.source.question}번</small></div>
          </button>)}
          {!results.length && <div className="library-empty"><b>일치하는 유형이 없습니다.</b><p>다른 검색어를 입력하거나 과목을 바꿔 보세요.</p><button className="button" onClick={() => { setQuery(''); setCourse('전체'); }}>전체 유형 보기</button></div>}
        </div>
        {selected && <section className="library-detail" aria-label="선택한 기출 유형 상세">
          <div className="library-detail-scroll">
            <div className="library-detail-heading"><span className="badge">{selected.course}</span><h3>{selected.name}</h3><p>{selected.description}</p></div>
            <TemplatePreview template={selected} />
            <div className="library-tags">{selected.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
            <div className="library-source"><b>참고 문항</b><a href={selected.source.landingUrl} target="_blank" rel="noopener noreferrer">{sourceTitle(selected)}<ArrowUpRight size={14} /></a><span>{selected.source.agency} · {selected.source.conductedOn} 시행 · 문제지 {selected.source.pdfPage}쪽</span><a className="library-zip" href={selected.source.pdfUrl} target="_blank" rel="noopener noreferrer">EBSi 과탐 원본 묶음 (ZIP)</a></div>
            <div className="library-adaptation"><b>재구성한 부분</b><p>{selected.adaptation.note}</p></div>
          </div>
          <div className="library-use"><span>AI · API 키 없이 바로 편집</span><button className="button primary full" onClick={() => { onSelect(structuredClone(selected.graph)); onClose(); }}>이 그래프로 시작</button></div>
        </section>}
      </div>
    </DialogContent>
  </Dialog>;
}
