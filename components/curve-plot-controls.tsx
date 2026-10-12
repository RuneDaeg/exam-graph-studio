'use client';

import { axisOptions, yAxisRange, type Graph } from '@/lib/graph';

type Curve = Graph['curves'][number];
export function CurvePlotControls({ curve, graph, onChange }: { curve: Curve; graph: Graph; onChange: (curve: Curve) => void }) {
  const plot = curve.plot ?? 'line';
  const baseline = axisOptions(graph, curve.yAxis ?? 'left').scale === 'log' ? yAxisRange(graph, curve.yAxis).min : 0;
  function changePlot(value: NonNullable<Curve['plot']>) {
    onChange({ ...curve, plot: value, ...(value === 'line' ? {} : { conic: null, distribution: null, smooth: false, arrows: false, dots: true }),
      barWidth: curve.barWidth ?? (value === 'histogram' ? 1 : .7), barBaseline: curve.barBaseline ?? baseline });
  }
  return <div className="curve-plot-controls">
    <label className="field-label">그래프 종류<select aria-label="그래프 종류" value={plot} onChange={e => changePlot(e.target.value as NonNullable<Curve['plot']>)}><option value="line">선 그래프</option><option value="scatter">산점도 · 점만 표시</option><option value="bar">막대그래프</option><option value="histogram">히스토그램</option></select></label>
    {plot === 'scatter' && <label className="field-label">점 모양<select aria-label="점 모양" value={curve.marker ?? 'circle'} onChange={e => onChange({ ...curve, marker: e.target.value as Curve['marker'] })}><option value="circle">원</option><option value="square">사각형</option><option value="triangle">삼각형</option><option value="cross">십자</option></select></label>}
    {(plot === 'bar' || plot === 'histogram') && <><div className="two-columns">
      <label className="field-label">막대 폭<input type="number" min="0.000001" step="any" value={curve.barWidth ?? 1} onChange={e => onChange({ ...curve, barWidth: Number(e.target.value) })} /></label>
      <label className="field-label">막대 기준값<input type="number" step="any" value={curve.barBaseline ?? baseline} onChange={e => onChange({ ...curve, barBaseline: Number(e.target.value) })} /></label>
    </div><p className="hint">x는 각 막대의 중심, y는 높이의 끝값입니다. 히스토그램의 폭은 계급 간격에 맞추세요. 계급 폭이 다르면 도수와 도수밀도를 구분해야 합니다.</p></>}
    {plot === 'scatter' && <p className="hint">같은 계열의 점을 선으로 연결하지 않습니다. 점의 좌표는 아래에서 수정할 수 있습니다.</p>}
  </div>;
}
