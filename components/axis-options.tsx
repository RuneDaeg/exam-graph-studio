'use client';

import type { Graph } from '@/lib/graph';

type AxisOptionsValue = { scale?: 'linear' | 'log'; reversed?: boolean; break?: { from: number; to: number } };

function ScaleOptions({ title, min, max, value, onChange }: {
  title: string; min: number; max: number; value: AxisOptionsValue;
  onChange: (value: AxisOptionsValue) => void;
}) {
  return <fieldset className="axis-scale-options"><legend>{title}</legend>
    <label className="field-label">눈금 간격<select aria-label={`${title} 눈금 간격`} value={value.scale ?? 'linear'} onChange={e => onChange({ ...value, scale: e.target.value as 'linear' | 'log' })}>
      <option value="linear">선형 · 같은 차이</option><option value="log">로그 · 같은 비율</option>
    </select></label>
    <label className="equal-axes-control"><input type="checkbox" checked={value.reversed ?? false} onChange={e => onChange({ ...value, reversed: e.target.checked })} />값이 증가하는 방향 뒤집기</label>
    <label className="equal-axes-control"><input type="checkbox" checked={Boolean(value.break)} onChange={e => onChange({ ...value, break: e.target.checked ? { from: min + (max - min) * .25, to: min + (max - min) * .6 } : undefined })} />축의 중간 구간 생략</label>
    {value.break && <div className="two-columns">{(['from', 'to'] as const).map(key => <label className="field-label" key={key}>생략 {key === 'from' ? '시작' : '끝'}<input aria-label={`${title} 생략 ${key === 'from' ? '시작' : '끝'}`} type="number" step="any" value={value.break![key]} onChange={e => onChange({ ...value, break: { ...value.break!, [key]: Number(e.target.value) } })} /></label>)}</div>}
    {value.scale === 'log' && <p className="hint">최솟값과 이 축의 데이터는 0보다 커야 합니다. 1, 10, 100처럼 같은 비율의 눈금이 같은 간격으로 표시됩니다.</p>}
    {value.break && <p className="hint">생략 구간은 축 범위 안에 있어야 합니다. 구간 안의 점과 선은 숨겨지고 축에 생략 표시가 나타납니다.</p>}
  </fieldset>;
}

export function AxisOptions({ graph, onChange, topTicks, onTopTicksChange, onToggleTop }: {
  graph: Graph; onChange: (graph: Graph) => void; topTicks: string;
  onTopTicksChange: (value: string) => void; onToggleTop: (enabled: boolean) => void;
}) {
  return <section className="advanced-axis-options">
    <h3>축 방향·로그 눈금·생략</h3>
    <div className="two-columns">
      <ScaleOptions title="가로축" min={graph.xMin} max={graph.xMax} value={{ scale: graph.xScale, reversed: graph.xReversed, break: graph.xBreak }} onChange={value => onChange({ ...graph, xScale: value.scale, xReversed: value.reversed, xBreak: value.break, equalAxes: false })} />
      <ScaleOptions title="왼쪽 세로축" min={graph.yMin} max={graph.yMax} value={{ scale: graph.yScale, reversed: graph.yReversed, break: graph.yBreak }} onChange={value => onChange({ ...graph, yScale: value.scale, yReversed: value.reversed, yBreak: value.break, equalAxes: false })} />
    </div>
    <label className="field-label">기본 가로축 위치<select aria-label="기본 가로축 위치" value={graph.xAxisPosition ?? 'bottom'} onChange={e => onChange({ ...graph, xAxisPosition: e.target.value as 'bottom' | 'top' })} disabled={Boolean(graph.topXAxis)}><option value="bottom">아래 / 원점</option><option value="top">위</option></select></label>
    {graph.rightYAxis && <ScaleOptions title="오른쪽 세로축" min={graph.rightYAxis.min} max={graph.rightYAxis.max} value={graph.rightYAxis} onChange={value => onChange({ ...graph, rightYAxis: { ...graph.rightYAxis!, ...value }, equalAxes: false })} />}
    <section className="right-axis-editor"><label className="equal-axes-control"><input type="checkbox" checked={Boolean(graph.topXAxis)} onChange={e => onToggleTop(e.target.checked)} />위쪽 보조 가로축 사용</label>
      <p className="hint">수온·염분처럼 가로 변인이 다른 선을 함께 그립니다. 각 선에서 기준 가로축을 선택하세요.</p>
      {graph.topXAxis && <><label className="field-label">위쪽 가로축 이름<textarea rows={2} maxLength={80} value={graph.topXAxis.label} onChange={e => onChange({ ...graph, topXAxis: { ...graph.topXAxis!, label: e.target.value } })} /></label>
        <div className="two-columns">{(['min', 'max'] as const).map(key => <label key={key} className="field-label">위쪽 축 {key === 'min' ? '최솟값' : '최댓값'}<input type="number" step="any" value={graph.topXAxis![key]} onChange={e => onChange({ ...graph, topXAxis: { ...graph.topXAxis!, [key]: Number(e.target.value) } })} /></label>)}</div>
        <label className="field-label">위쪽 가로축 눈금<textarea rows={5} value={topTicks} onChange={e => onTopTicksChange(e.target.value)} /></label><p className="hint">실제 좌표 = 표시할 문자 · 예: 35 = 35</p>
        <ScaleOptions title="위쪽 가로축" min={graph.topXAxis.min} max={graph.topXAxis.max} value={graph.topXAxis} onChange={value => onChange({ ...graph, topXAxis: { ...graph.topXAxis!, ...value }, equalAxes: false })} />
      </>}
    </section>
  </section>;
}
