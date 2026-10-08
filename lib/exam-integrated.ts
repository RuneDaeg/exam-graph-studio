import { withDistribution, type Graph } from './graph';
import type { ExamTemplate } from './exam-presets';

const ticks = (values: number[], labels?: string[]) => values.map((value, i) => ({ value, label: labels?.[i] ?? String(value) }));
const curve = (name: string, points: number[][], options: Partial<Graph['curves'][number]> = {}): Graph['curves'][number] => ({
  name, points: points.map(([x, y]) => ({ x, y })), dashed: false, smooth: false, arrows: false, dots: false, ...options,
});
const label = (x: number, y: number, text: string, dx = 0, dy = -16) => ({ x, y, text, dx, dy });
const guide = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });
const base: Graph = {
  title: '', xLabel: '', yLabel: '', xMin: 0, xMax: 10, yMin: 0, yMax: 5,
  xTicks: [], yTicks: [], curves: [], guides: [], labels: [], note: '',
};
const source = (year: number, date: string, exam: string, agency: string, file: string, listing: string, question: number, pdfPage: number): ExamTemplate['source'] => ({
  agency, academicYear: year, conductedOn: date, exam, grade: '고1', question, pdfPage, resourceType: 'pdf',
  pdfUrl: `https://wdown.ebsi.co.kr/W61001/01exam/${file}`,
  landingUrl: `https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVPreparation.ebs?irecord=${listing}&targetCd=D100`,
});
const september22 = (question: number, page: number) => source(2022, '2022-08-31', '9월 전국연합학력평가', '인천광역시교육청', '20220901/go1/g_sci_mun_AJ5OTVH5.pdf', '202509031', question, page);
const september24 = (question: number, page: number) => source(2024, '2024-09-04', '9월 전국연합학력평가', '인천광역시교육청', '20240904/go1/g_sci_mun_9C9CS868.pdf', '202509031', question, page);
const september25 = (question: number, page: number) => source(2025, '2025-09-03', '9월 전국연합학력평가', '인천광역시교육청', '20250903/go1/g_sci_mun_VF2C9729_1.pdf', '202609021', question, page);
const collision = (duration: number, height: number) => Array.from({ length: 33 }, (_, i) => {
  const t = duration * i / 32;
  return [t, height * Math.sin(Math.PI * i / 32) ** 2];
});

export const integratedTemplates: ExamTemplate[] = [
  {
    id: 'exam-integrated-superconductor', course: '통합과학', name: '초전도체의 임계 온도',
    description: '임계 온도 아래에서 저항이 0인 구간과 정상 상태의 저항 곡선',
    tags: ['물리', '신소재', '초전도체', '전기 저항', '온도', '불연속'],
    source: september22(6, 2),
    adaptation: { kind: 'normalized', note: '원문 (가)의 저항–온도 그래프를 참고했습니다. 임계 온도를 T_C=1로 정규화하고 정상 상태의 저항 곡선을 새로 구성했습니다. 불연속 변화는 두 선과 보조선으로 구분했습니다.' },
    graph: {
      ...base, title: '초전도체의 저항과 온도', xLabel: 'T', yLabel: 'R', xMax: 2.7, yMax: 2.1,
      xTicks: ticks([1], ['T_C']),
      curves: [curve('초전도 상태', [[0, 0], [1, 0]]), curve('정상 상태', [[1, .8], [1.2, .85], [1.5, .97], [1.8, 1.14], [2.1, 1.39], [2.4, 1.72]], { smooth: true })],
      guides: [guide(1, 0, 1, .8)],
      labels: [label(.5, .18, '초전도 상태'), label(1.85, 1.55, '정상 상태')],
      note: '기출의 그래프 유형을 정규화한 예시입니다. T_C 아래에서 R=0인 관계를 강조했으며, 특정 물질의 측정값이나 전이 폭을 표현한 것은 아닙니다.',
    },
  },
  {
    id: 'exam-integrated-catalyst-energy', course: '통합과학', name: '촉매와 활성화 에너지',
    description: '반응물·생성물의 에너지는 같고 활성화 에너지 봉우리만 다른 두 곡선',
    tags: ['화학', '생명', '효소', '카탈레이스', '활성화 에너지', '반응 진행'],
    source: september22(11, 2),
    adaptation: { kind: 'normalized', note: '카탈레이스 유무에 따른 과산화 수소 분해 반응의 에너지 곡선 유형을 참고했습니다. 반응 진행도와 에너지는 임의의 상대 척도이며, 원문의 선 모양과 수치를 복제하지 않았습니다.' },
    graph: {
      ...base, title: '촉매가 있을 때와 없을 때의 에너지', xLabel: '반응의 진행', yLabel: '에너지\n(상댓값)', xMax: 6.7, yMax: 5.2,
      curves: [
        curve('촉매 없음', [[0, 2], [.7, 2], [1.2, 2.3], [1.8, 3.7], [2.3, 4.3], [2.8, 3.6], [3.5, 1.8], [4.4, 1.02], [5, 1], [6, 1]], { smooth: true }),
        curve('촉매 있음', [[0, 2], [.7, 2], [1.3, 2.1], [1.9, 2.65], [2.3, 2.85], [2.8, 2.5], [3.5, 1.5], [4.4, 1.02], [5, 1], [6, 1]], { smooth: true, dashed: true }),
      ],
      labels: [label(2.3, 4.3, '촉매 없음'), label(2.3, 2.85, '촉매 있음', 60, -7), label(.4, 2, '반응물', 0, 27), label(5.5, 1, '생성물')],
      note: '기출 유형을 참고한 개념도입니다. 촉매는 활성화 에너지를 낮추며, 반응물과 생성물의 에너지 차이를 바꾸지 않습니다. 가로축은 시간이 아닌 반응 진행도입니다.',
    },
  },
  {
    id: 'exam-integrated-equal-impulse', course: '통합과학', name: '충돌 시간과 평균 힘',
    description: '면적은 같고 폭과 높이가 다른 힘–시간 곡선',
    tags: ['물리', '충격량', '운동량', '안전장치', '충돌 시간', '힘'],
    source: september24(12, 3),
    adaptation: { kind: 'redrawn', note: '원문 (다)의 면적이 같은 두 충돌력 곡선을 참고했습니다. F_P=8sin²(πt/2), F_Q=4sin²(πt/4)인 독립 예시를 구성하여 두 함수의 충격량을 8 N·s로 맞췄고, 화면에서는 표본점 사이를 매끄럽게 연결해 근사했습니다.' },
    graph: {
      ...base, title: '같은 충격량과 서로 다른 충돌 시간', xLabel: 't\\,(\\mathrm{s})', yLabel: 'F\\,(\\mathrm{N})', xMax: 4.7, yMax: 10,
      xTicks: ticks([1, 2, 3, 4]), yTicks: ticks([4, 8]),
      curves: [curve('P', collision(2, 8), { smooth: true }), curve('Q', collision(4, 4), { smooth: true, dashed: true })],
      guides: [guide(1, 0, 1, 8), guide(2, 0, 2, 4)], labels: [label(1, 8, 'P'), label(2, 4, 'Q')],
      note: '기출 유형을 참고한 재구성 예시입니다. 사용한 두 함수의 충격량은 모두 8 N·s이고, 표시한 보간 곡선의 면적은 약 8 N·s입니다. 충돌 시간이 2배이면 평균 힘은 절반입니다. 조절점을 움직이면 이 관계가 달라집니다.',
    },
  },
  {
    id: 'exam-integrated-atmosphere-temperature', course: '통합과학', name: '기권의 층상 구조와 기온',
    description: '대류권·성층권·중간권·열권에서 기온 변화 방향을 비교',
    tags: ['지구', '기권', '기온', '고도', '대류권', '성층권'],
    source: september24(13, 3),
    adaptation: { kind: 'redrawn', note: '원문 (가)의 기권 기온 분포를 참고했습니다. 편집을 쉽게 하도록 원문과 가로·세로축을 바꾸어 높이를 x축에 두었으며, 경계 높이와 기온은 별도의 이상화 예시입니다.' },
    graph: {
      ...base, title: '높이에 따른 기권의 기온', xLabel: '높이\\,(\\mathrm{km})', yLabel: '기온\\,(^\\circ\\mathrm{C})', xMax: 108, yMin: -100, yMax: 75,
      xTicks: ticks([12, 50, 80, 100]), yTicks: ticks([-80, -40, 40]),
      curves: [curve('기온', [[0, 15], [6, -25], [12, -56], [20, -56], [30, -43], [40, -22], [50, 0], [65, -45], [80, -85], [90, -35], [100, 50]], { smooth: true })],
      guides: [guide(12, -100, 12, 75), guide(50, -100, 50, 75), guide(80, -100, 80, 75)],
      labels: [label(6, 55, '대류권'), label(31, 55, '성층권'), label(65, 55, '중간권'), label(94, 65, '열권')],
      note: '원문의 축을 서로 바꾼 이상화 예시입니다. 각 층의 경계 높이와 기온은 위도·계절·관측 조건에 따라 달라지므로 실제 관측 자료로 사용하지 마세요.',
    },
  },
  {
    id: 'exam-integrated-ocean-layers', course: '통합과학', name: '계절별 해수의 수온 분포',
    description: '혼합층의 두께와 표층 수온이 다른 두 시기의 수온 곡선',
    tags: ['지구', '해수', '수온', '혼합층', '수온 약층', '심해층'],
    source: september25(15, 4),
    adaptation: { kind: 'redrawn', note: '원문의 두 시기 수온–깊이 그래프를 참고했습니다. 깊이를 오른쪽으로 증가하는 x축에 두고 수온과 경계 깊이를 새로 정했습니다. 원문과 축 방향·수치를 바꾼 편집용 예시입니다.' },
    graph: {
      ...base, title: '깊이에 따른 두 시기의 수온', xLabel: '깊이\\,(\\mathrm{m})', yLabel: '수온\\,(^\\circ\\mathrm{C})', xMax: 900, yMax: 30,
      xTicks: ticks([100, 250, 500, 800]), yTicks: ticks([5, 15, 25]),
      curves: [curve('A 시기', [[0, 15], [250, 15], [500, 5], [800, 5]]), curve('B 시기', [[0, 25], [100, 25], [500, 5], [800, 5]], { dashed: true })],
      guides: [guide(250, 0, 250, 15), guide(500, 0, 500, 25)],
      labels: [label(160, 15, 'A', 0, -17), label(65, 25, 'B'), label(685, 8, '심해층')],
      note: '기출 유형을 참고해 축과 수치를 바꾼 예시입니다. A는 B보다 혼합층이 두껍고 표층 수온이 낮습니다. 실제 해양에서 층 경계가 이처럼 꺾인 직선으로 나타나는 것은 아닙니다.',
    },
  },
  {
    id: 'exam-integrated-mass-extinction', course: '통합과학', name: '대멸종과 생물 다양성',
    description: '생물 과 수의 장기 증가와 대멸종 시기의 급격한 감소',
    tags: ['생명', '지구', '생물 다양성', '대멸종', '지질 시대', '해양 생물'],
    source: source(2023, '2023-12-19', '11월 전국연합학력평가', '경기도교육청', '20231219/go1/g_sci_mun_75Z221KR.pdf', '202511141', 12, 3),
    adaptation: { kind: 'normalized', note: '원문 (가)의 해양 생물 과 수 변화와 두 대멸종 시기를 참고했습니다. 시간 간격과 과 수를 임의의 상대 척도로 다시 구성했으며 실제 지질 연대별 통계값이 아닙니다. 시험지 명칭은 11월, 실제 시행일은 12월 19일입니다.' },
    graph: {
      ...base, title: '대멸종 전후의 해양 생물 다양성', xLabel: '시간의 흐름', yLabel: '과의 수\n(상댓값)', xMax: 10.7, yMax: 11,
      xTicks: ticks([5, 8.5], ['t_A', 't_B']), yTicks: ticks([3, 6, 9]),
      curves: [curve('해양 생물의 과 수', [[0, .5], [.7, 1.5], [1.3, 3.1], [2, 4.6], [2.5, 3.6], [3.2, 4.8], [4.2, 4.5], [4.9, 4.6], [5, 2], [5.7, 2.8], [6.6, 4.4], [7.5, 6.1], [8.4, 7.6], [8.5, 5.6], [9.2, 8.1], [10, 9.2]])],
      guides: [guide(5, 0, 5, 5.8), guide(8.5, 0, 8.5, 8.8)],
      labels: [label(5, 5.8, 'A'), label(8.5, 8.8, 'B')],
      note: '기출 그래프의 경향을 정규화한 개념도입니다. A와 B는 대멸종을 나타내며, 가로축 간격은 실제 지질 시대의 지속 기간에 비례하지 않습니다. 실제 과 수 통계나 연대 측정 자료가 아닙니다.',
    },
  },
  {
    id: 'exam-integrated-natural-selection', course: '통합과학', name: '자연선택과 형질 분포',
    description: '자연선택 전후 형질 분포의 봉우리 위치와 폭을 비교',
    tags: ['생명', '자연선택', '진화', '유전적 다양성', '개체군', '정규분포'],
    source: source(2025, '2025-10-14', '10월 전국연합학력평가', '경기도교육청', '20251014/go1/g_sci_mun_E55AW383.pdf', '202610201', 15, 4),
    adaptation: { kind: 'redrawn', note: '원문의 털색에 따른 선택 전후 분포 이동을 참고했습니다. 별도의 두 정규분포 모형으로 재구성한 예시이며, 원문 곡선이 정규분포라는 의미는 아닙니다. 색깔 축은 형질의 상대 척도로 바꿨습니다.' },
    graph: {
      ...base, title: '자연선택 전후의 형질 분포', xLabel: '형질의 상댓값', yLabel: '개체 수\n(상댓값)', xMax: 10.5, yMax: 1.8,
      xTicks: ticks([4, 6.8], ['a_1', 'a_2']),
      curves: [
        withDistribution(curve('선택 전 P', [[0, 0], [10, 0]], { dashed: true }), { kind: 'normal', origin: 0, peak: 4, sigma: 1.6, height: .9, baseline: 0, end: 10 }),
        withDistribution(curve("선택 후 P′", [[0, 0], [10, 0]]), { kind: 'normal', origin: 0, peak: 6.8, sigma: 1.1, height: 1.3, baseline: 0, end: 10 }),
      ],
      guides: [guide(4, 0, 4, .9), guide(6.8, 0, 6.8, 1.3)], labels: [label(4, .9, 'P'), label(6.8, 1.3, 'P^{\\prime}')],
      note: '정규분포로 새로 구성한 형질 분포 예시이며, 모든 형질이 정규분포를 따르거나 자연선택 시 이 모양으로 변하는 것은 아닙니다. ⚠ 개체 수준에서 그래프 변형은 실제 자연, 과학적 사실과 일치하지 않을 수 있으니 출제 시 유의하세요.',
    },
  },
  {
    id: 'exam-integrated-horizontal-projectile', course: '통합과학', name: '수평으로 던진 물체의 경로',
    description: '같은 높이에서 서로 다른 수평 속력으로 던진 두 물체의 포물선',
    tags: ['물리', '역학적 시스템', '중력', '수평 투사', '포물선', '운동 경로'],
    source: september25(18, 4),
    adaptation: { kind: 'redrawn', note: '원문의 물체 A·B 운동 경로 그림을 좌표 그래프로 재구성했습니다. 두 출발점을 같은 좌표로 옮기고 높이 5 m·수평 속력 3 m/s와 6 m/s·g=10 m/s²인 독립적인 예시를 사용했습니다.' },
    graph: {
      ...base, title: '서로 다른 수평 속력과 운동 경로', xLabel: 'x\\,(\\mathrm{m})', yLabel: '높이\\,(\\mathrm{m})', xMax: 6.8, yMax: 6.5,
      xTicks: ticks([3, 6]), yTicks: ticks([5]),
      curves: [3, 6].map((speed, i) => curve(i === 0 ? 'A' : 'B', Array.from({ length: 33 }, (_, k) => { const t = k / 32; return [speed * t, 5 - 5 * t * t]; }), { smooth: true, dashed: i === 1 })),
      labels: [label(1.5, 3.75, 'A', -20, -8), label(3, 3.75, 'B', 16, -8)],
      note: '원문의 경로 그림을 좌표 그래프로 바꾼 예시입니다. 공기 저항을 무시하고 g=10 m/s²로 가정했습니다. 두 물체는 1 s 뒤 지면에 도달하며, 수평 속력의 비는 1:2입니다.',
    },
  },
];
