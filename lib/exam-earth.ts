import type { Graph } from './graph';
import type { ExamTemplate } from './exam-presets';

const curve = (name: string, points: number[][], dashed = false, smooth = true): Graph['curves'][number] => ({
  name, points: points.map(([x, y]) => ({ x, y })), dashed, smooth, arrows: false, dots: false,
});
const ticks = (values: number[], labels?: string[]) => values.map((value, i) => ({ value, label: labels?.[i] ?? String(value) }));
const base: Graph = { title: '', xLabel: '', yLabel: '', xMin: 0, xMax: 5, yMin: 0, yMax: 1.2, xTicks: [], yTicks: [], curves: [], guides: [], labels: [], note: '' };
const source = (record: string, date: string, question: number, pdfPage: number, zip: string): ExamTemplate['source'] => ({
  agency: '한국교육과정평가원', academicYear: Number(date.slice(0, 4)) + 1, conductedOn: date,
  exam: record.slice(4, 6) === '06' ? '6월 모의평가' : '9월 모의평가', question, pdfPage,
  pdfUrl: `https://wdown.ebsi.co.kr/W61001/01exam/${record.slice(0, 8)}/go3/${zip}.zip`,
  landingUrl: `https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=${record}&targetCd=D300`,
});

export const earthTemplates: ExamTemplate[] = [
  {
    id: 'earth1-radioactive-decay', course: '지구과학Ⅰ', name: '방사성 원소의 붕괴',
    description: '반감기마다 절반으로 줄어드는 모원소의 양과 보조선', tags: ['방사성 원소', '반감기', '절대 연령', '지수 감소'],
    source: source('202306013', '2023-06-01', 19, 4, 'gat_main_mun_QPB4DJIV'),
    adaptation: { kind: 'normalized', note: '원본의 일부 구간과 축 생략을 대신해 반감기 3회 구간 전체를 표시했습니다. 시간은 반감기 T 단위이며 원본의 연대·수치를 사용하지 않습니다.' },
    graph: { ...base, title: '방사성 원소의 붕괴', xLabel: '시간', yLabel: '모원소\n함량 (\\%)', xMax: 3.5, yMax: 115,
      xTicks: ticks([1, 2, 3], ['T', '2T', '3T']), yTicks: ticks([12.5, 25, 50, 100]),
      curves: [curve('모원소', [0, .5, 1, 1.5, 2, 2.5, 3].map(x => [x, 100 * 2 ** -x]))],
      guides: [1, 2, 3].flatMap(x => [{ x1: 0, y1: 100 * 2 ** -x, x2: x, y2: 100 * 2 ** -x }, { x1: x, y1: 0, x2: x, y2: 100 * 2 ** -x }]),
      note: '기출 유형 재구성 · N/N₀ = 2^(−t/T)에 따른 조절점입니다. T는 반감기이며, 원본 연대와 수치는 바꾸었습니다. 곡선은 조절점 사이를 보간합니다.',
    },
  },
  {
    id: 'earth1-transit-light-curve', course: '지구과학Ⅰ', name: '외계 행성의 식과 밝기',
    description: '식의 깊이와 지속 시간을 조절하는 상대 밝기 곡선', tags: ['외계 행성', '식 현상', '밝기', '광도 곡선'],
    source: source('202209013', '2022-08-31', 18, 4, 'gat_main_mun_1461D6Z8'),
    adaptation: { kind: 'normalized', note: '문항 (나)의 단일 식 개형을 참고했습니다. 밝기 감소율과 시간 간격을 바꾼 도식이며 궤도 그림·생명 가능 지대는 포함하지 않습니다. 세로축은 0.985~1.004로 확대했습니다.' },
    graph: { ...base, title: '외계 행성의 식과 밝기', xLabel: '시간', yLabel: '상대밝기', xMax: 6.4, yMin: .985, yMax: 1.004,
      xTicks: ticks([1.5, 2.5, 3.5, 4.5], ['t_1', 't_2', 't_3', 't_4']), yTicks: ticks([.99, 1], ['0.990', '1.000']),
      curves: [curve('중심별의 밝기', [[0,1],[1.5,1],[2,.995],[2.5,.99],[3.5,.99],[4,.995],[4.5,1],[6,1]])],
      guides: [{ x1: 0, y1: .99, x2: 3.5, y2: .99 }],
      note: '기출 유형 재구성 · 상대 밝기의 세로축을 0.985~1.004로 확대했습니다. 밝기 감소량·시간은 예시이며 실제 관측 자료가 아닙니다.',
    },
  },
  {
    id: 'earth2-galaxy-rotation', course: '지구과학Ⅱ', name: '은하의 회전 속도',
    description: '원반과 암흑 물질의 기여를 전체 회전 곡선과 비교', tags: ['은하', '암흑 물질', '회전 속도', '다중 곡선'],
    source: source('202509033', '2025-09-03', 12, 3, 'gat_mun_69Q199OH'),
    adaptation: { kind: 'normalized', note: '두 은하를 비교한 원본에서 회전 곡선의 개념만 사용해 하나의 가상 은하로 재구성했습니다. 거리와 속도는 상대값입니다. 조절점에서 v² = v원반² + v암흑²이 되게 설정했습니다.' },
    graph: (() => {
      const xs = [0, .5, 1, 1.5, 2, 3, 4, 5, 6];
      const disk = (x: number) => 1.4 * (x / 1.4) * Math.exp(1 - x / 1.4);
      const halo = (x: number) => 1.55 * (1 - Math.exp(-x / 2.5));
      return { ...base, title: '은하의 회전 속도', xLabel: 'r\n(상대값)', yLabel: '회전속도\n(상대값)', xMax: 7.5, yMax: 2,
        xTicks: ticks([2, 4, 6]), yTicks: ticks([.5, 1, 1.5]),
        curves: [curve('전체', xs.map(x => [x, Math.hypot(disk(x), halo(x))])), curve('원반', xs.map(x => [x, disk(x)]), true), curve('암흑 물질', xs.map(x => [x, halo(x)]), true)],
        labels: [{ x: 6, y: Math.hypot(disk(6), halo(6)), text: '전체', dx: 30, dy: -16 }, { x: 6, y: disk(6), text: '원반', dx: 28, dy: 0 }, { x: 6, y: halo(6), text: '암흑 물질', dx: 32, dy: 21 }],
        note: '기출 유형 재구성 · r은 은하 중심으로부터의 거리이며 가상 은하의 상대값입니다. 조절점에서 각 성분의 속도 제곱을 더해 전체 속도를 정했으며, 관측 자료나 원본의 수치를 재현하지 않습니다.',
      };
    })(),
  },
  {
    id: 'earth2-seismic-travel-time', course: '지구과학Ⅱ', name: '지진파의 주시 곡선',
    description: '진원 거리와 P파·S파 도달 시간, 두 파의 시간 차', tags: ['지진파', '주시 곡선', 'PS시', '직선'],
    source: source('202606043', '2026-06-04', 20, 4, 'gat_mun_43Z718KA'),
    adaptation: { kind: 'redrawn', note: '원본 (가)의 거리–P파 도달 시간 관계를 확장해 P파와 S파를 같은 축에 그렸습니다. 균질 매질에서 vP=6 km/s, vS=3 km/s를 가정한 독립 예시이며 원본의 속도·시각을 사용하지 않습니다.' },
    graph: { ...base, title: '지진파의 주시 곡선', xLabel: '거리 (\\mathrm{km})', yLabel: '도달시간\n(\\mathrm{s})', xMax: 75, yMax: 25,
      xTicks: ticks([15, 30, 45, 60]), yTicks: ticks([5, 10, 15, 20]),
      curves: [curve('P파', [[0,0],[60,10]], false, false), curve('S파', [[0,0],[60,20]], false, false)],
      guides: [{ x1: 45, y1: 0, x2: 45, y2: 15 }, { x1: 0, y1: 7.5, x2: 45, y2: 7.5 }, { x1: 0, y1: 15, x2: 45, y2: 15 }],
      labels: [{ x: 60, y: 10, text: 'P', dx: 20, dy: 0 }, { x: 60, y: 20, text: 'S', dx: 20, dy: 0 }],
      note: '기출 유형 재구성 · 균질 매질에서 P파 6 km/s, S파 3 km/s를 가정했습니다. 원본의 수치 대신 별도의 예시 값을 사용했습니다.',
    },
  },
];
