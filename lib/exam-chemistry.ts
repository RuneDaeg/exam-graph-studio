import type { Graph } from './graph';
import type { ExamTemplate } from './exam-presets';

const curve = (name: string, points: number[][], options: Partial<Graph['curves'][number]> = {}): Graph['curves'][number] => ({
  name, points: points.map(([x, y]) => ({ x, y })), dashed: false, smooth: false, arrows: false, dots: false, ...options,
});
const label = (x: number, y: number, text: string, dx = 0, dy = -18) => ({ x, y, text, dx, dy });
const guide = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });
const graph = (values: Partial<Graph>): Graph => ({
  title: '', xLabel: '', yLabel: '', xMin: 0, xMax: 8, yMin: 0, yMax: 5,
  xTicks: [], yTicks: [], curves: [], guides: [], labels: [], note: '', ...values,
});
const source = (record: string, date: string, academicYear: number, question: number, pdfPage: number, zip: string): ExamTemplate['source'] => ({
  agency: '한국교육과정평가원', academicYear, conductedOn: date, exam: '9월 모의평가', question, pdfPage,
  pdfUrl: zip, landingUrl: `https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=${record}&targetCd=D300`,
});

const dilutionXs = [0, .4, .9, 1.5, 2.4, 3.6, 5, 6.5];
const pressureAXs = [.2, .8, 1.5, 2, 2.5, 3, 3.5, 4, 4.4];
const pressureBXs = [.2, 1, 2, 2.5, 3.5, 4.5, 5.3, 6, 6.8];
const pressureA = (x: number) => .5 * Math.exp(.48 * x);
const pressureB = (x: number) => .22 * Math.exp(.43 * x);
const reactionXs = [0, .35, .75, 1, 1.5, 2, 3, 4.5];
const reactant = (x: number) => 4 * Math.pow(2, -x);

export const chemistryTemplates: ExamTemplate[] = [
  {
    id: 'chemistry-dilution', course: '화학Ⅰ', name: '희석과 몰 농도',
    description: '물을 넣을수록 감소하며 서로 교차하는 두 용액의 몰 농도',
    tags: ['용액', '희석', '몰 농도', '반비례', '교차 곡선'],
    source: source('202309063', '2023-09-06', 2024, 13, 3, 'https://wdown.ebsi.co.kr/W61001/01exam/20230906/go3/gat_main_mun_4OS666SN.zip'),
    adaptation: {
      kind: 'normalized',
      note: '원문 13번의 희석 곡선 유형을 재구성했습니다. 초기 농도·부피·눈금은 새 상대값이며, 각 용액의 용질 양이 일정한 희석식을 사용했습니다. 원문 정답용 수치가 아닙니다.',
    },
    graph: graph({
      title: '희석에 따른 두 용액의 몰 농도', xLabel: '넣어 준 물의 부피', yLabel: '몰 농도\n(상댓값)', yMax: 4.8,
      xTicks: [{ value: 1.5, label: 'V_1' }, { value: 5, label: 'V_2' }],
      yTicks: [{ value: 1.6, label: 'C_1' }, { value: 4, label: 'C_0' }],
      curves: [
        curve('용액 A', dilutionXs.map(x => [x, 4 / (1 + x)]), { smooth: true }),
        curve('용액 B', dilutionXs.map(x => [x, 2.2 / (1 + x / 4)]), { smooth: true, dashed: true }),
      ],
      guides: [guide(0, 1.6, 1.5, 1.6), guide(1.5, 0, 1.5, 1.6), guide(5, 0, 5, 4 / 6)],
      labels: [label(5.8, 4 / 6.8, 'A', 20, 25), label(5.8, 2.2 / 2.45, 'B', 20, -18)],
      note: '원문의 수치·눈금을 바꾼 편집용 상대좌표입니다. 두 용액 각각의 용질 양은 일정하며, 물을 추가한 부피만큼 전체 용액 부피가 증가하는 예시입니다.',
    }),
  },
  {
    id: 'chemistry-dynamic-equilibrium', course: '화학Ⅰ', name: '동적 평형 도달',
    description: '밀폐 용기에서 기체 분자 수가 증가하다 일정해지는 곡선',
    tags: ['동적 평형', '증발', '응축', '분자 수', '포화'],
    source: source('202409043', '2024-09-04', 2025, 6, 2, 'https://wdown.ebsi.co.kr/W61001/01exam/20240904/go3/gat_mun_AVG5QCC2.zip'),
    adaptation: {
      kind: 'normalized',
      note: '원문 6번 (나)의 증가 후 평탄해지는 기체 분자 수 곡선을 독립적인 상대좌표로 다시 그렸습니다. 플라스크 그림은 제외했고, 평형 도달 시간·분자 수는 기호로 표시했습니다.',
    },
    graph: graph({
      title: '시간에 따른 기체 분자 수', xLabel: '시간', yLabel: '기체의\n분자 수', xMax: 7.5, yMax: 3.8,
      xTicks: [{ value: 4, label: 't_1' }], yTicks: [{ value: 3, label: 'N_{\\mathrm{eq}}' }],
      curves: [curve('기체 분자 수', [[0, 0], [.4, .75], [1, 1.6], [1.8, 2.3], [2.8, 2.78], [3.6, 2.97], [4, 3], [5, 3], [6.5, 3]], { smooth: true })],
      guides: [guide(0, 3, 4, 3), guide(4, 0, 4, 3)],
      labels: [label(5.2, 3, '\\mathrm{H_2O(g)}', 0, -22)],
      note: '밀폐 용기·일정한 온도에서 액체가 남아 있는 상황을 상대좌표로 재구성했습니다. 평탄한 구간에서도 증발과 응축은 같은 속도로 계속됩니다.',
    }),
  },
  {
    id: 'chemistry-bond-angle', course: '화학Ⅰ', name: '분자 특성 산점도',
    description: '전자쌍 수의 비와 결합각을 함께 비교하는 네 점',
    tags: ['분자 구조', '결합각', '전자쌍', '산점도', '비교'],
    source: source('202609023', '2026-09-02', 2027, 8, 2, 'https://wdown.ebsi.co.kr/W61001/01exam/20260902/go3/gat_mun_BAX731L7.zip'),
    adaptation: {
      kind: 'normalized',
      note: '원문 8번의 전자쌍 수비–결합각 산점도 유형입니다. A～D는 새 비교 기호이며 좌표·눈금은 상대값으로 바꿨습니다. 원문 분자의 실제 전자쌍 수나 결합각을 나타내지 않습니다.',
    },
    graph: graph({
      title: '전자쌍 수의 비와 결합각 비교', xLabel: '전자쌍 수의 비', yLabel: '결합각\n(상댓값)', xMax: 4.6, yMax: 4.8,
      xTicks: [{ value: 1.5, label: 'r_0' }], yTicks: [{ value: 3.6, label: '\\theta_0' }],
      curves: [
        curve('A', [[.5, 3.6]], { dots: true }), curve('B', [[1.5, 3.6]], { dots: true }),
        curve('C', [[1.5, 1.7]], { dots: true }), curve('D', [[3.7, 1.9]], { dots: true }),
      ],
      guides: [guide(0, 3.6, 1.5, 3.6), guide(.5, 0, .5, 3.6), guide(1.5, 0, 1.5, 3.6), guide(0, 1.7, 1.5, 1.7), guide(3.7, 0, 3.7, 1.9)],
      labels: [label(.5, 3.6, 'A', 0, -22), label(1.5, 3.6, 'B', 20, -18), label(1.5, 1.7, 'C', 20, 20), label(3.7, 1.9, 'D', 20, -12)],
      note: '가로축은 비공유 전자쌍 수 / 공유 전자쌍 수를 뜻합니다. A～D와 좌표는 비교형 그래프 편집을 위한 새 기호·상대값이며, 특정 분자의 실측값이 아닙니다.',
    }),
  },
  {
    id: 'chemistry-vapor-pressure', course: '화학Ⅱ', name: '두 액체의 증기 압력',
    description: '온도에 따라 증가하는 두 증기 압력 곡선 비교',
    tags: ['증기 압력', '온도', '끓는점', '액체', '증가 곡선'],
    source: source('202209013', '2022-08-31', 2023, 7, 2, 'https://wdown.ebsi.co.kr/W61001/01exam/20220901/go3/gat_main_mun_1461D6Z8.zip'),
    adaptation: {
      kind: 'normalized',
      note: '원문 7번 (나)의 두 증기 압력 곡선 유형을 상대좌표로 다시 그렸습니다. 압력계 그림과 실제 단위·수치는 제외했습니다. 지수형 조절점은 개형 편집을 위한 근사이며 특정 액체의 물성식이 아닙니다.',
    },
    graph: graph({
      title: '두 액체의 온도와 증기 압력', xLabel: '온도 (상댓값)', yLabel: '증기압\n(상댓값)', xMax: 8, yMax: 5,
      xTicks: [{ value: 2.5, label: 'T_0' }],
      yTicks: [{ value: pressureB(2.5), label: 'P_1' }, { value: pressureA(2.5), label: 'P_2' }],
      curves: [curve('액체 A', pressureAXs.map(x => [x, pressureA(x)]), { smooth: true }), curve('액체 B', pressureBXs.map(x => [x, pressureB(x)]), { smooth: true })],
      guides: [guide(0, pressureA(2.5), 2.5, pressureA(2.5)), guide(0, pressureB(2.5), 2.5, pressureB(2.5)), guide(2.5, 0, 2.5, pressureA(2.5))],
      labels: [label(4.4, pressureA(4.4), 'A', 20, -10), label(6.8, pressureB(6.8), 'B', 20, -10)],
      note: '기출의 두 증기 압력 곡선을 새 상대좌표로 재구성했습니다. 같은 온도에서 증기 압력을 비교하는 개형 예시이며, 특정 액체의 물성 측정값은 아닙니다.',
    }),
  },
  {
    id: 'chemistry-first-order', course: '화학Ⅱ', name: '반응물·생성물의 농도',
    description: '1차 반응에서 감소하는 반응물과 증가하는 두 생성물',
    tags: ['반응 속도', '1차 반응', '반감기', '몰 농도', '생성물'],
    source: source('202509033', '2025-09-03', 2026, 11, 2, 'https://wdown.ebsi.co.kr/W61001/01exam/20250903/go3/gat_mun_69Q199OH.zip'),
    adaptation: {
      kind: 'normalized',
      note: '원문 11번의 세 농도 곡선 유형을 재구성했습니다. 2A → 2B + C인 예시로 반응식의 미지수를 없애고, 초기 농도와 시간 눈금은 새 상대값으로 바꿨습니다. 원문 정답용 자료가 아닙니다.',
    },
    graph: graph({
      title: '1차 반응의 농도 변화', xLabel: '반응 시간', yLabel: '몰 농도\n(상댓값)', xMax: 5.3, yMax: 5,
      xTicks: [{ value: 1, label: 't_{1/2}' }, { value: 2, label: '2t_{1/2}' }, { value: 3, label: '3t_{1/2}' }],
      yTicks: [{ value: 2, label: '\\frac{C_0}{2}' }, { value: 4, label: 'C_0' }],
      curves: [
        curve('반응물 A', reactionXs.map(x => [x, reactant(x)]), { smooth: true }),
        curve('생성물 B', reactionXs.map(x => [x, 4 - reactant(x)]), { smooth: true }),
        curve('생성물 C', reactionXs.map(x => [x, (4 - reactant(x)) / 2]), { smooth: true }),
      ],
      guides: [guide(0, 2, 1, 2), guide(1, 0, 1, 2)],
      labels: [label(4.5, reactant(4.5), 'A', 18, -12), label(4.5, 4 - reactant(4.5), 'B', 18, -12), label(4.5, (4 - reactant(4.5)) / 2, 'C', 18, 0)],
      note: '2A → 2B + C인 1차 반응을 새 상대농도·반감기 단위로 구성했습니다. 처음에는 A만 존재하며, B의 생성량은 C의 2배인 예시입니다. 조절점 이동 후에는 반응식과 수치 관계를 다시 확인하세요.',
    }),
  },
];
