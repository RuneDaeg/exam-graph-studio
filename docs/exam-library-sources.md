# 기출 그래프 라이브러리 출처와 검토 범위

작성일: 2026-10-07

## 검토 방법

- 대상은 **2022–2026년 실제 시행된 한국교육과정평가원 6월·9월 모의평가**의 과학탐구Ⅰ·Ⅱ 8과목입니다. 5개년 × 2회 × 8과목, 총 80개 과목별 문제지 PDF의 레이아웃 텍스트를 파싱했습니다. 자료는 EBSi 공식 기출 자료실에서 제공하는 파일을 사용했습니다.
- 텍스트에서 그림·축·물리량 관련 문맥을 찾아 후보를 추렸고, 최종 선택한 **20개 유형의 원본 문항 페이지를 이미지로 렌더링해 시각 검토**했습니다. 전체 80개 PDF의 모든 문항을 각각 시각 검토한 것은 아닙니다.
- 표의 학년도와 시행일은 구분합니다. 예를 들어 2027학년도 모의평가는 2026년에 시행되었습니다. **2023학년도 9월 모의평가의 실제 시행일은 2022-08-31**이며 EBS 파일 경로에 들어 있는 20220901과 다릅니다.

## 편집용 그래프의 성격

라이브러리의 그래프는 원문에서 확인한 개념과 유형을 바탕으로 **독립적으로 다시 만든 편집용 예시**입니다. 원본 그림을 그대로 추출하거나 스캔 이미지를 넣은 것이 아닙니다. 수치·축 범위·기호·일부 조건을 바꾸거나 상대좌표로 정규화했으므로 원문 문항의 정답을 구하는 자료로 사용할 수 없습니다. 변경 내용은 앱의 각 유형 상세 설명과 데이터의 `adaptation.note`에 기록되어 있습니다.

현재 편집기는 하나의 선형 x–y 좌표계와 선·점·문자·보조선을 지원합니다. 로그축·다중 패널·이중 축·채워진 막대·실험 장치 도식은 재현 범위에 포함하지 않았습니다. 원문의 부분 그래프만 사용하거나 별도 관계를 더한 경우도 변경 설명에 명시했습니다. 곡선은 편집 가능한 조절점으로 구성되며, 이동 후에는 사용자가 수치와 과학적 관계를 다시 확인해야 합니다.

## 수록한 20개 유형

PDF 쪽은 각 과목 파일의 첫 페이지를 1쪽으로 세며, 시험지 아래에 인쇄된 전체 영역 쪽 번호와 다를 수 있습니다. 시험명 링크는 해당 회차의 EBSi 공식 자료 페이지입니다.

| 과목 | 편집용 유형 | 원문 시험 | 실제 시행일 | 문항 | PDF 쪽 |
|---|---|---|---|---:|---:|
| 물리학Ⅰ | 충돌 중 힘 · 시간 | [2023학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202206093&targetCd=D300) | 2022-06-09 | 9 | 2 |
| 물리학Ⅰ | 광전 효과의 문턱 진동수 | [2024학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202306013&targetCd=D300) | 2023-06-01 | 17 | 4 |
| 물리학Ⅰ | 운동 방향이 바뀌는 위치 · 시간 | [2026학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202506043&targetCd=D300) | 2025-06-04 | 3 | 1 |
| 물리학Ⅱ | 단진동의 운동 에너지 | [2025학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202409043&targetCd=D300) | 2024-09-04 | 5 | 1 |
| 물리학Ⅱ | 교류 회로의 공명 곡선 | [2026학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202509033&targetCd=D300) | 2025-09-03 | 7 | 2 |
| 물리학Ⅱ | 축전기의 전하량 · 전압 | [2027학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202606043&targetCd=D300) | 2026-06-04 | 14 | 3 |
| 화학Ⅰ | 희석과 몰 농도 | [2024학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202309063&targetCd=D300) | 2023-09-06 | 13 | 3 |
| 화학Ⅰ | 동적 평형 도달 | [2025학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202409043&targetCd=D300) | 2024-09-04 | 6 | 2 |
| 화학Ⅰ | 분자 특성 산점도 | [2027학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202609023&targetCd=D300) | 2026-09-02 | 8 | 2 |
| 화학Ⅱ | 두 액체의 증기 압력 | [2023학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202209013&targetCd=D300) | 2022-08-31 | 7 | 2 |
| 화학Ⅱ | 반응물·생성물의 농도 | [2026학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202509033&targetCd=D300) | 2025-09-03 | 11 | 2 |
| 생명과학Ⅰ | 뉴런의 활동 전위 | [2024학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202306013&targetCd=D300) | 2023-06-01 | 5 | 1 |
| 생명과학Ⅰ | 1차·2차 면역 반응 | [2027학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202606043&targetCd=D300) | 2026-06-04 | 8 | 2 |
| 생명과학Ⅰ | S자형 개체군 생장 | [2027학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202609023&targetCd=D300) | 2026-09-02 | 20 | 4 |
| 생명과학Ⅱ | 효소 반응의 포화 | [2023학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202206093&targetCd=D300) | 2022-06-09 | 13 | 3 |
| 생명과학Ⅱ | 능동 수송과 세포 안 농도 | [2026학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202506043&targetCd=D300) | 2025-06-04 | 6 | 1 |
| 지구과학Ⅰ | 방사성 원소의 붕괴 | [2024학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202306013&targetCd=D300) | 2023-06-01 | 19 | 4 |
| 지구과학Ⅰ | 외계 행성의 식과 밝기 | [2023학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202209013&targetCd=D300) | 2022-08-31 | 18 | 4 |
| 지구과학Ⅱ | 은하의 회전 속도 | [2026학년도 9월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202509033&targetCd=D300) | 2025-09-03 | 12 | 3 |
| 지구과학Ⅱ | 지진파의 주시 곡선 | [2027학년도 6월 모의평가](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202606043&targetCd=D300) | 2026-06-04 | 20 | 4 |

## 데이터 위치

- [통합 목록과 출처 형식](../lib/exam-presets.ts)
- [물리학Ⅰ·Ⅱ](../lib/exam-physics.ts), [화학Ⅰ·Ⅱ](../lib/exam-chemistry.ts), [생명과학Ⅰ·Ⅱ](../lib/exam-biology.ts), [지구과학Ⅰ·Ⅱ](../lib/exam-earth.ts)

각 항목의 `source`에는 시행 기관·학년도·시행일·문항·PDF 쪽·EBSi 상세 페이지·공식 원본 ZIP 주소가 들어 있습니다. 저장소에는 재구성한 그래프 데이터와 출처 정보를 수록하며, 원본 문제지 PDF나 스캔 이미지는 포함하지 않습니다.

## 파싱 대상 회차

아래 10회차의 8과목씩을 파싱했습니다.

[2022년 6월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202206093&targetCd=D300) · [2022년 9월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202209013&targetCd=D300) · [2023년 6월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202306013&targetCd=D300) · [2023년 9월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202309063&targetCd=D300) · [2024년 6월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202406043&targetCd=D300) · [2024년 9월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202409043&targetCd=D300) · [2025년 6월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202506043&targetCd=D300) · [2025년 9월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202509033&targetCd=D300) · [2026년 6월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202606043&targetCd=D300) · [2026년 9월](https://www.ebsi.co.kr/ebs/xip/xipa/retrieveSCVMainInfo.ebs?irecord=202609023&targetCd=D300)
