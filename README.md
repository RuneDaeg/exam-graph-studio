# 도해 — 시험지 그래프 스튜디오

한국어 설명과 문제집 그래프 이미지에서 편집 가능한 흑백 시험지 그래프를 만드는 웹앱입니다. GitHub Pages에서 동작하는 정적 React 앱입니다.

## 사용 방법

1. **내 API 연결**에서 본인의 OpenAI API 키를 입력합니다.
2. 그래프를 설명하거나 PNG/JPG/WebP 이미지를 첨부합니다.
3. 생성한 그래프의 좌표·축·눈금·문자를 확인하고 수정합니다.
4. SVG 또는 PNG로 다운로드합니다.

8개 예시, 직접 좌표 입력, 편집 및 다운로드는 API 키 없이 사용할 수 있습니다.

## API 키와 비용

- 사용자가 입력한 키와 설명·이미지는 브라우저에서 `https://api.openai.com/v1/responses`로 직접 전송됩니다.
- 키는 현재 탭의 메모리에만 보관하며 localStorage, sessionStorage, 쿠키, URL, 서버에 저장하지 않습니다. 새로고침 또는 연결 해제 시 지워집니다.
- 사용 비용은 입력한 키의 OpenAI 계정에 청구됩니다. ChatGPT 구독과 API 과금은 별개입니다.
- 브라우저의 페이지 스크립트·확장 프로그램은 키에 접근할 수 있습니다. 신뢰하는 개인 기기에서 사용하며 앱 전용 키를 권장합니다.
- GitHub 저장소·Pages 빌드·Actions에는 OpenAI 키를 설정하지 않습니다. 모델은 `gpt-5.4-mini`입니다.

## 그래프 편집

- 8개 과학 그래프 예시, AI 없이 좌표 입력
- 미리보기에서 점·선·문자 드래그, 축 이름·눈금 클릭 편집
- 좌표 맞춤, 방향키 미세 이동, 드래그 1회 단위 실행 취소
- 선택적으로 연결된 문자·점선을 함께 이동, 미리보기에 이미지 끌어놓기
- 축 범위·눈금·곡선·점·진행 화살표·문자·점선 편집
- KaTeX 수식: 숫자, 변수, 첨자, 단위, 분수, 근호
- KaTeX 글꼴을 SVG path로 변환하여 SVG와 1–4배 PNG에서 같은 수식 모양 유지
- 투명 배경, 선 두께·글자 크기, 실행 취소·다시 실행

이미지에 없는 수치는 상대 좌표로 복원될 수 있습니다. 문항에 사용하기 전 수치와 기호를 확인해 주세요. 한글은 기기 글꼴에 따라 달라질 수 있습니다.

## 로컬 실행과 배포

Node 22.13 이상이 필요합니다.

```sh
npm ci
npm run build:pages
npm run preview:pages
```

기본 경로는 `/exam-graph-studio/`입니다. 다른 저장소에는 `PAGES_BASE_PATH=/저장소이름/ npm run build:pages`, 계정 루트 사이트에는 `PAGES_BASE_PATH=/ npm run build:pages`를 사용합니다.

GitHub 저장소 Settings → Pages → Source를 **GitHub Actions**로 선택하면, `main`에 push할 때 `.github/workflows/pages.yml`이 `dist-pages`만 배포합니다. API 키 secret은 필요하지 않습니다.

이전 로컬 Sites 개발 환경은 `npm run dev`로 실행할 수 있습니다. 기존 서버용 `.env.local`과 `.wrangler`는 Git 및 Pages 빌드에서 제외됩니다. Pages는 서버 경로를 사용하지 않습니다.
