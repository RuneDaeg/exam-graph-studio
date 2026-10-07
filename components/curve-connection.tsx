'use client';

import { useId } from 'react';
import { smoothConnectionIssue, type Graph } from '@/lib/graph';

type Props = {
  points: Graph['curves'][number]['points'] | null;
  smooth: boolean;
  onChange: (smooth: boolean) => void;
};

export function CurveConnection({ points, smooth, onChange }: Props) {
  const id = useId();
  const issue = points ? smoothConnectionIssue(points) : '좌표 입력을 마치면 연결 방식을 선택할 수 있습니다.';
  return <fieldset className="connection-mode" aria-describedby={`${id}-hint`}>
    <legend>점 연결 방식</legend>
    <div className="connection-choices">
      {([false, true] as const).map(value => <label key={String(value)} className={'connection-choice' + (smooth === value ? ' active' : '') + (value && issue ? ' unavailable' : '')}>
        <input className="sr-only" type="radio" name={id} value={value ? 'smooth' : 'straight'} checked={smooth === value} disabled={value && Boolean(issue)} onChange={() => onChange(value)} />
        <svg width="26" height="18" viewBox="0 0 26 18" fill="none" aria-hidden="true"><path d={value ? 'M2 15C6 15 7 3 13 3S20 15 24 15' : 'M2 15L13 3L24 15'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {value ? '매끄러운 곡선' : '직선'}
      </label>)}
    </div>
    <p id={`${id}-hint`}>{issue ? `${smooth && points ? '현재 좌표는 직선으로 표시됩니다. ' : ''}${issue}` : (smooth ? '선택한 선의 모든 점을 지나도록 매끄럽게 연결합니다.' : '선택한 선의 점과 점 사이를 직선으로 연결합니다.')}</p>
  </fieldset>;
}
