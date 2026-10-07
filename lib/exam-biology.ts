import type { Graph } from './graph';
import type { ExamTemplate } from './exam-presets';

const line = (name: string, points: number[][], dashed = false): Graph['curves'][number] => ({
  name, points: points.map(([x, y]) => ({ x, y })), dashed, smooth: true, arrows: false, dots: false,
});
const tick = (value: number, label = String(value)) => ({ value, label });
const guide = (x1: number, y1: number, x2: number, y2: number) => ({ x1, y1, x2, y2 });
const label = (x: number, y: number, text: string, dx = 0, dy = -14) => ({ x, y, text, dx, dy });
const graph = (title: string, xLabel: string, yLabel: string, overrides: Partial<Graph>): Graph => ({
  title, xLabel, yLabel, xMin: 0, xMax: 10.5, yMin: 0, yMax: 1.25,
  xTicks: [], yTicks: [], curves: [], guides: [], labels: [], note: '', ...overrides,
});
const source = (record: string, zip: string, question: number, pdfPage: number): ExamTemplate['source'] => ({
  agency: '한국교육과정평가원', academicYear: Number(record.slice(0, 4)) + 1,
  conductedOn: `${record.slice(0, 4)}-${record.slice(4, 6)}-${record.slice(6, 8)}`,
  exam: record.slice(4, 6) === '06' ? '6월 모의평가' : '9월 모의평가', question, pdfPage,
  pdfUrl: `https://wdown.ebsi.co.kr/W61001/01exam/${record.slice(0, 8)}/go3/${zip}.zip`,
  landingUrl: `https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=${record}&targetCd=D300`,
});

export const biologyTemplates: ExamTemplate[] = [
  {
    id: 'exam-biology-action-potential', course: '생명과학Ⅰ', name: '뉴런의 활동 전위',
    description: '휴지 전위에서 탈분극·재분극·과분극을 거쳐 회복하는 곡선',
    tags: ['흥분 전도', '막전위', '뉴런', '과분극', '매끄러운 곡선'],
    source: source('202306013', 'gat_main_mun_QPB4DJIV', 5, 1),
    adaptation: { kind: 'redrawn', note: '원문 조건 Ⅰ의 정상 활동 전위 형태를 참고했습니다. 시간과 최고 전위는 별도로 정한 예시이며, 이온 통로 억제 조건 Ⅱ·Ⅲ은 포함하지 않았습니다.' },
    graph: graph('뉴런의 활동 전위', 't (ms)', '막전위\n(mV)', {
      xMax: 6, yMin: -100, yMax: 60,
      xTicks: [tick(1), tick(3), tick(5)], yTicks: [tick(-70), tick(30)],
      curves: [line('활동 전위', [[0, -70], [.6, -70], [1, -55], [1.4, 0], [1.7, 35], [2, 5], [2.4, -52], [2.8, -78], [3.2, -82], [4.2, -72], [5.5, -70]])],
      guides: [guide(0, -70, 5.5, -70)],
      labels: [label(1.7, 35, '탈분극', -30, -18), label(2.6, -45, '재분극', 35, -3), label(3.6, -82, '과분극', 28, 23)],
      note: '정상 뉴런의 활동 전위를 단순화한 예시입니다. 시간축은 막전위 0 mV에서 교차하며, 실제 측정 자료나 원문 수치의 복원이 아닙니다.',
    }),
  },
  {
    id: 'exam-biology-antibody-response', course: '생명과학Ⅰ', name: '1차·2차 면역 반응',
    description: '같은 항원에 재노출되었을 때 더 빠르고 크게 증가하는 항체 농도',
    tags: ['항체', '체액성 면역', '기억 세포', '1차 면역', '2차 면역', '매끄러운 곡선'],
    source: source('202606043', 'gat_mun_43Z718KA', 8, 2),
    adaptation: { kind: 'normalized', note: '두 차례 항원 주사에 따른 항체 농도 그래프의 유형을 참고했습니다. 주사 시점과 농도를 임의의 상대 척도로 다시 구성했습니다.' },
    graph: graph('같은 항원에 대한 면역 반응', '시간', '항체농도\n(상댓값)', {
      yMax: 1.35,
      xTicks: [tick(.8, 't_1'), tick(5.8, 't_2')],
      curves: [line('항체 농도', [[0, 0], [.8, 0], [1.3, .03], [2, .26], [2.6, .31], [3.2, .19], [4.1, .04], [5, .01], [5.8, .01], [6.2, .25], [6.8, .87], [7.5, 1.08], [8.4, 1.03], [10, .85]])],
      guides: [guide(.8, 0, .8, .45), guide(5.8, 0, 5.8, 1.2)],
      labels: [label(2.4, .45, '1차 반응'), label(8.2, 1.18, '2차 반응')],
      note: 't_1과 t_2에 같은 항원을 주사한 예시입니다. 시간과 농도는 임의의 상댓값이며, 실제 항체 역가나 임상 자료가 아닙니다.',
    }),
  },
  {
    id: 'exam-biology-population-growth', course: '생명과학Ⅰ', name: 'S자형 개체군 생장',
    description: '개체 수가 증가하다가 환경 수용력 부근에서 일정해지는 생장 곡선',
    tags: ['개체군', '환경 저항', '환경 수용력', '출생률', '사망률', 'S자형', '매끄러운 곡선'],
    source: source('202609023', 'gat_mun_BAX731L7', 20, 4),
    adaptation: { kind: 'normalized', note: '원문의 증가기·안정기 비교 그래프를 참고했습니다. 로지스틱 함수 N(t)=K/(1+19 exp(-t))의 표본점으로 새로운 곡선을 만들었으며, 원문을 이 함수에 맞춘 결과는 아닙니다.' },
    graph: graph('환경 수용력과 개체군 생장', '시간', '개체 수\n(상댓값)', {
      xMax: 9.5, yMax: 1.25,
      xTicks: [tick(2.5, 't_1'), tick(7.5, 't_2')], yTicks: [tick(1, 'K')],
      curves: [line('개체 수', [0, 1, 2, 3, 4, 5, 6.5, 8.5].map(x => [x, 1 / (1 + 19 * Math.exp(-x))]))],
      guides: [guide(0, 1, 8.8, 1)],
      labels: [label(2.2, .48, '증가기', -13, -15), label(7.1, 1.12, '안정기')],
      note: 'K는 환경 수용력입니다. 개체 수와 시간은 상댓값이며, 표본점 사이를 매끄럽게 연결한 로지스틱 생장 모형의 예시입니다.',
    }),
  },
  {
    id: 'exam-biology-enzyme-saturation', course: '생명과학Ⅱ', name: '효소 반응의 포화',
    description: '기질 농도가 증가할 때 서로 다른 최댓값에 접근하는 초기 반응 속도',
    tags: ['효소', '기질 농도', '초기 반응 속도', '포화 곡선', '저해제', '매끄러운 곡선'],
    source: source('202206093', 'gat_main_mun_W3QMA4M7', 13, 3),
    adaptation: { kind: 'normalized', note: '원문의 효소 농도·저해제 조건에 따른 세 포화 곡선을 참고했습니다. v=Vmax[S]/(Km+[S])에서 Km=1, Vmax=1.2·0.6·0.3인 독립적인 예시로 다시 그렸습니다.' },
    graph: graph('기질 농도와 초기 반응 속도', '기질 농도', '초기 반응\n속도 (상댓값)', {
      xMax: 9, yMax: 1.4,
      xTicks: [tick(1, 'S_1'), tick(7, 'S_2')], yTicks: [tick(.3), tick(.6), tick(1.2)],
      curves: [1.2, .6, .3].map((v, i) => line(['A', 'B', 'C'][i], [0, .3, .7, 1.2, 2, 3.5, 5.5, 8].map(x => [x, v * x / (1 + x)]), i === 2)),
      guides: [guide(0, 1.2, 8, 1.2), guide(0, .6, 8, .6), guide(0, .3, 8, .3)],
      labels: [label(7.5, 1.08, 'A', 0, -14), label(8, .53, 'B', 18, 2), label(7.5, .25, 'C', 0, 24)],
      note: '미하엘리스-멘텐 모형의 표본점으로 만든 예시입니다. A·B·C의 Vmax는 1.2·0.6·0.3, Km은 모두 1이며, 원문 실험의 측정값을 옮긴 것이 아닙니다.',
    }),
  },
  {
    id: 'exam-biology-active-transport', course: '생명과학Ⅱ', name: '능동 수송과 세포 안 농도',
    description: '세포 안 물질 농도가 안팎의 농도가 같아진 시점의 농도를 넘어 증가하는 곡선',
    tags: ['세포막', '능동 수송', '농도 기울기', '물질 이동', '매끄러운 곡선'],
    source: source('202506043', 'gat_mun_7WL37B39', 6, 1),
    adaptation: { kind: 'normalized', note: '원문 (나)의 단일 농도-시간 곡선을 참고했습니다. C와 두 시점의 의미를 유지하되, 점 좌표와 축의 범위를 임의의 상대 척도로 재구성했습니다.' },
    graph: graph('능동 수송에 따른 세포 안 농도', '시간', '세포 안\n농도 (상댓값)', {
      xMax: 9, yMax: 3.6,
      xTicks: [tick(1, 't_1'), tick(5, 't_2')], yTicks: [tick(1, 'C')],
      curves: [line('세포 안 농도', [[0, 0], [.35, .72], [.75, 1.4], [1, 1.65], [1.4, 1.95], [2.4, 2.42], [3.8, 2.78], [5, 2.95], [8, 3.16]])],
      guides: [guide(0, 1, 8, 1), guide(1, 0, 1, 1.65), guide(5, 0, 5, 2.95)],
      labels: [],
      note: 'C는 세포 안팎 농도가 같아졌던 순간의 농도입니다. 이후의 세포 밖 농도가 항상 C로 유지된다는 뜻은 아닙니다. 시간과 농도는 임의의 상댓값입니다.',
    }),
  },
];
