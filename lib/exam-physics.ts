import type { Graph } from './graph';
import type { ExamTemplate } from './exam-presets';

const ticks = (values: number[], labels?: string[]) => values.map((value, i) => ({ value, label: labels?.[i] ?? String(value) }));
const curve = (name: string, points: number[][], options: Partial<Graph['curves'][number]> = {}): Graph['curves'][number] => ({
  name, points: points.map(([x, y]) => ({ x, y })), dashed: false, smooth: false, arrows: false, dots: false, ...options,
});
const label = (x: number, y: number, text: string, dx = 0, dy = -16) => ({ x, y, text, dx, dy });
const guide = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });
const base: Graph = {
  title: '', xLabel: '', yLabel: '', xMin: 0, xMax: 5, yMin: 0, yMax: 4,
  xTicks: [], yTicks: [], curves: [], guides: [], labels: [], note: '',
};
const sources = {
  force: ['202206093', '20220609/go3/gat_main_mun_W3QMA4M7.zip'],
  photoelectric: ['202306013', '20230601/go3/gat_main_mun_QPB4DJIV.zip'],
  position: ['202506043', '20250604/go3/gat_mun_7WL37B39.zip'],
  pendulum: ['202409043', '20240904/go3/gat_mun_AVG5QCC2.zip'],
  resonance: ['202509033', '20250903/go3/gat_mun_69Q199OH.zip'],
  capacitor: ['202606043', '20260604/go3/gat_mun_43Z718KA.zip'],
} as const;
const source = (key: keyof typeof sources, academicYear: number, conductedOn: string, exam: '6월 모의평가' | '9월 모의평가', question: number, pdfPage: number): ExamTemplate['source'] => ({
  agency: '한국교육과정평가원', academicYear, conductedOn, exam, question, pdfPage,
  pdfUrl: `https://wdown.ebsi.co.kr/W61001/01exam/${sources[key][1]}`,
  landingUrl: `https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=${sources[key][0]}&targetCd=D300`,
});

const impulseTimes = [0, .25, .5, 1, 1.5, 2, 2.5, 3, 3.5, 3.75, 4];
const positionTimes = [0, .4, 2 - 2 / Math.sqrt(3), 1.4, 2, 2.6, 2 + 2 / Math.sqrt(3), 3.7, 4, 4.5];
const pendulumTimes = Array.from({ length: 25 }, (_, i) => i * 3 / 16);
const frequencies = [0, .15, .3, .5, .65, .8, .9, 1, 1.1, 1.25, Math.SQRT2, 1.7, 2.1, 2.6, 3.2];

export const physicsTemplates: ExamTemplate[] = [
  {
    id: 'exam-physics1-impulse', course: '물리학Ⅰ', name: '충돌 중 힘 · 시간',
    description: '유한한 충돌 시간 동안 증가했다가 감소하는 힘 곡선', tags: ['힘', '충격량', '부드러운 곡선'],
    source: source('force', 2023, '2022-06-09', '6월 모의평가', 9, 2),
    adaptation: { kind: 'redrawn', note: '원문의 충돌력 곡선 유형을 참고하고, 최대 힘 8 N·충돌 시간 4 s인 독립적인 예시로 새로 구성했습니다. 원문 면적과 수치는 사용하지 않았습니다.' },
    graph: {
      ...base, title: '충돌 중 힘의 시간 변화', xLabel: 't\\,(\\mathrm{s})', yLabel: 'F\\,(\\mathrm{N})', xMax: 4.8, yMax: 10,
      xTicks: ticks([1, 2, 3, 4]), yTicks: ticks([4, 8]),
      curves: [curve('충돌력', impulseTimes.map(t => [t, 8 * Math.sin(Math.PI * t / 4) ** 2]), { smooth: true })],
      guides: [guide(2, 0, 2, 8), guide(0, 8, 2, 8)], labels: [label(2, 8, 'F_{\\max}')],
      note: '기출 유형을 참고한 재구성 예시입니다. 0≤t≤4에서 F(t)=8 sin²(πt/4)를 조절점으로 근사했습니다. 곡선 아래 면적은 충격량이며, 점을 움직이면 예시 공식에서 벗어납니다.',
    },
  },
  {
    id: 'exam-physics1-photoelectric', course: '물리학Ⅰ', name: '광전 효과의 문턱 진동수',
    description: '기울기는 같고 문턱 진동수가 다른 두 금속의 직선', tags: ['광전 효과', '문턱 진동수', '평행 직선'],
    source: source('photoelectric', 2024, '2023-06-01', '6월 모의평가', 17, 4),
    adaptation: { kind: 'normalized', note: '원문에서 확인한 평행 직선 관계를 문턱 진동수 f₀와 2f₀인 별도의 예시로 정규화했습니다. E₀=hf₀이며 원문 좌표를 복제하지 않았습니다.' },
    graph: {
      ...base, title: '광전자의 최대 운동 에너지', xLabel: 'f', yLabel: 'E_{K,\\max}', xMax: 4.8, yMax: 4,
      xTicks: ticks([1, 2, 3, 4], ['f_0', '2f_0', '3f_0', '4f_0']), yTicks: ticks([1, 2, 3], ['E_0', '2E_0', '3E_0']),
      curves: [curve('금속 P', [[1, 0], [4, 3]]), curve('금속 Q', [[2, 0], [4, 2]], { dashed: true })],
      guides: [guide(4, 0, 4, 3), guide(0, 3, 4, 3), guide(0, 2, 4, 2)],
      labels: [label(4, 3, 'P', 16, -8), label(4, 2, 'Q', 16, -8)],
      note: '기출 유형을 참고한 정규화 예시입니다. E₀=hf₀로 두고 E_K=hf−W를 적용했습니다. 각 문턱 진동수보다 낮은 영역은 광전자 방출이 없어 직선을 그리지 않았습니다.',
    },
  },
  {
    id: 'exam-physics1-position-turns', course: '물리학Ⅰ', name: '운동 방향이 바뀌는 위치 · 시간',
    description: '극대·극소와 원점 통과가 있는 매끄러운 위치 곡선', tags: ['위치', '속도', '운동 방향'],
    source: source('position', 2026, '2025-06-04', '6월 모의평가', 3, 1),
    adaptation: { kind: 'redrawn', note: '원문의 두 번 방향 전환이라는 관계를 참고해 x(t)=0.8t(t−2)(t−4)의 독립적인 좌표를 사용했습니다. 원문 시각과 위치 수치를 바꿨습니다.' },
    graph: {
      ...base, title: '방향 전환과 위치의 시간 변화', xLabel: 't\\,(\\mathrm{s})', yLabel: 'x\\,(\\mathrm{m})', xMax: 5.2, yMin: -3.8, yMax: 5.8,
      xTicks: ticks([1, 2, 3, 4]), yTicks: ticks([-2, 2, 4]),
      curves: [curve('위치', positionTimes.map(t => [t, .8 * t * (t - 2) * (t - 4)]), { smooth: true })],
      labels: [label(2 - 2 / Math.sqrt(3), 2.46336, 'A', 0, -20), label(2 + 2 / Math.sqrt(3), -2.46336, 'B', 0, 28)],
      note: '기출 유형을 참고한 재구성 예시입니다. 위치 함수 x(t)=0.8t(t−2)(t−4)를 부드러운 조절점으로 근사했습니다. A와 B에서는 순간 속도가 0이고 운동 방향이 바뀝니다.',
    },
  },
  {
    id: 'exam-physics2-pendulum-energy', course: '물리학Ⅱ', name: '단진동의 운동 에너지',
    description: '항상 0 이상이며 주기적으로 변하는 운동 에너지', tags: ['단진동', '운동 에너지', '주기'],
    source: source('pendulum', 2025, '2024-09-04', '9월 모의평가', 5, 1),
    adaptation: { kind: 'redrawn', note: '시간에 따른 진자의 운동 에너지 유형을 참고해 작은 진폭의 이상적인 단진동, 주기 3 s·최대 에너지 3 J로 새로 구성했습니다.' },
    graph: {
      ...base, title: '단진동 중 운동 에너지', xLabel: 't\\,(\\mathrm{s})', yLabel: 'E_K\\,(\\mathrm{J})', xMax: 5.1, yMax: 4.1,
      xTicks: ticks([.75, 1.5, 2.25, 3, 3.75, 4.5]), yTicks: ticks([3]),
      curves: [curve('운동 에너지', pendulumTimes.map(t => [t, 3 * Math.sin(2 * Math.PI * t / 3) ** 2]), { smooth: true })],
      guides: [guide(0, 3, 4.5, 3)],
      note: '기출 유형을 참고한 재구성 예시입니다. 작은 진폭의 단진동에서 E_K(t)=3 sin²(2πt/3)를 조절점으로 근사했습니다. 진동 주기는 3 s, 운동 에너지의 반복 주기는 1.5 s입니다.',
    },
  },
  {
    id: 'exam-physics2-ac-resonance', course: '물리학Ⅱ', name: '교류 회로의 공명 곡선',
    description: '공명 봉우리와 진동수에 따라 증가하는 전류를 비교', tags: ['교류', '공명', '전류'],
    source: source('resonance', 2026, '2025-09-03', '9월 모의평가', 7, 2),
    adaptation: { kind: 'normalized', note: '원문에서 공명 곡선과 단조 증가 곡선을 확인했습니다. 같은 저항을 가진 직렬 RLC·RC 회로의 독립적인 정규화 예시를 계산했습니다. 원문 회로·수치·선택지는 복제하지 않았습니다.' },
    graph: {
      ...base, title: '진동수에 따른 교류 전류', xLabel: 'f', yLabel: 'I', xMax: 3.8, yMax: 1.3,
      xTicks: ticks([1, 2, 3], ['f_0', '2f_0', '3f_0']), yTicks: ticks([1], ['I_0']),
      curves: [
        curve('직렬 RLC', frequencies.map(u => [u, u === 0 ? 0 : 1 / Math.sqrt(1 + (1.8 * (u - 1 / u)) ** 2)]), { smooth: true }),
        curve('직렬 RC', frequencies.map(u => [u, u === 0 ? 0 : 1 / Math.sqrt(1 + (1.8 / u) ** 2)]), { smooth: true, dashed: true }),
      ],
      guides: [guide(1, 0, 1, 1), guide(0, 1, 3.2, 1)],
      labels: [label(2.8, .84, '\\mathrm{RC}', 0, -16), label(2.5, .25, '\\mathrm{RLC}', 0, 26)],
      note: '기출 유형을 참고한 정규화 예시입니다. 전압 진폭과 저항은 일정하며 I₀=V₀/R입니다. u=f/f₀, ω₀L/R=1.8에서 RLC와 RC 전류를 계산해 조절점으로 근사했습니다. RLC의 공명은 f₀에서 일어납니다.',
    },
  },
  {
    id: 'exam-physics2-capacitor-charge', course: '물리학Ⅱ', name: '축전기의 전하량 · 전압',
    description: '전기 용량이 다른 두 축전기의 비례 관계', tags: ['축전기', '전기 용량', '비례'],
    source: source('capacitor', 2027, '2026-06-04', '6월 모의평가', 14, 3),
    adaptation: { kind: 'normalized', note: '전하량–전압 직선의 기울기로 전기 용량을 비교하는 유형입니다. 원문과 달리 C_B=2C_A인 독립적인 정규화 예시로 재구성했습니다.' },
    graph: {
      ...base, title: '축전기에 저장된 전하량', xLabel: 'V', yLabel: 'Q', xMax: 3.8, yMax: 7.3,
      xTicks: ticks([1, 2, 3], ['V_0', '2V_0', '3V_0']), yTicks: ticks([2, 4, 6], ['2Q_0', '4Q_0', '6Q_0']),
      curves: [curve('축전기 A', [[0, 0], [3, 3]]), curve('축전기 B', [[0, 0], [3, 6]])],
      guides: [guide(3, 0, 3, 6), guide(0, 3, 3, 3), guide(0, 6, 3, 6)],
      labels: [label(3, 3, 'A', 18, -4), label(3, 6, 'B', 18, -4)],
      note: '기출 유형을 참고한 정규화 예시입니다. Q=CV에서 Q₀=C_AV₀, C_B=2C_A로 두었습니다. 직선의 기울기는 전기 용량이며, 원문 수치는 사용하지 않았습니다.',
    },
  },
];
