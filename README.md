# WCS Simulator — 임원 데모용 프레젠테이션 시뮬레이터

React + Framer Motion + Tailwind CSS + Recharts로 만든, **발표자가 상황을 직접 통제하는**
Warehouse Control System 2D 시뮬레이터입니다. 기본 물류 흐름은 자동으로 원활하게 진행되고,
발표자가 이벤트 트리거 버튼을 누르는 순간에만 WCS의 실시간 문제 해결 시나리오(병목 우회,
긴급 오더 하이패스, 설비 장애 복구)가 발동합니다.

## 실행 방법

```bash
npm install
npm run dev       # 개발 서버 (http://localhost:5173)
```

배포용 빌드:

```bash
npm run build      # dist/ 에 정적 파일 생성
npm run preview    # 빌드 결과 로컬 확인
```

## 자동 배포 (GitHub Pages)

`.github/workflows/deploy.yml`이 `main`과 `claude/wcs-mockup-simulator-plan-24rdmo`
브랜치에 push될 때마다 자동으로 빌드해 GitHub Pages에 배포합니다. 로컬에 아무것도 설치할
필요 없이 push만 하면 됩니다.

**최초 1회만** 저장소 설정에서 Pages 소스를 켜야 합니다 (iPad Safari에서도 가능):
저장소 → **Settings** → 좌측 메뉴 **Pages** → **Build and deployment** → Source를
**GitHub Actions**로 선택. 이후에는 push할 때마다 1~2분 내로 자동 반영됩니다.

배포 후 주소: **https://songwri.github.io/Warehouse-Control-System/**
(Actions 탭에서 진행 상황과 실패 로그 확인 가능)

`dist/` 폴더를 그대로 아무 정적 호스팅(예: Netlify, S3, 사내 웹서버)에 올리면 바로 배포됩니다.

## 데모 시나리오

- 오더 100건이 20건씩 5개 배치로 투입되며(배치마다 WCS 그룹핑 애니메이션), 기본 로직은
  **오더라인 1~4 → 자동화 설비, 5~10 → 매뉴얼 설비**로 정상 할당됩니다.
- 좌측 상단 컨트롤러: 재생/일시정지, 배속(1x/2x/5x).
- **Event Trigger 3버튼** — 발표자가 원하는 순간에 눌러 시나리오를 발동시킵니다.
  1. **병목 발생** — Libiao 3D 소터 과부하 → `BOTTLENECK DETECTED` 경고 → 대기 오더를
     매뉴얼 라인으로 자동 우회(`OPTIMIZED`).
  2. **긴급 오더 투입** — 골드색 오더가 하이클라이머 → 로봇암 완전자동 라인으로 하이패스.
  3. **설비 고장** — 출고 무인지게차 ERROR(회색·X) → WCS가 즉시 다른 라인으로 재할당,
     일정 시간 후 자동 복구.
- 하단 대시보드에 처리량, 설비 가동률, AI 최적화 개입 횟수, 리드타임 단축률이 실시간으로
  갱신됩니다.

## 설비 매핑 (좌→우 3개 라인)

| 라인 | 입고 | 보관 | 피킹 | 포장 | 출고 |
|---|---|---|---|---|---|
| PCS 자동화 | XYZ 로봇암·무인지게차 | HaiPick 하이클라이머 | 하이클라이머 피킹(연계) | 포장 자동화 솔루션 | 로봇암·무인지게차 |
| PLT 자동화 | XYZ 로봇암·무인지게차 | 4-Way 셔틀 | Libiao 3D 소터 | 포장 자동화 솔루션 | 로봇암·무인지게차 |
| 매뉴얼 | 일반 하차(유인지게차) | 일반 팔레트랙 | AMR & DPC(스마트글라스 검수) | 매뉴얼 포장 | 일반 지게차 |

## 프로젝트 구조

```
src/
  App.jsx                 최상위 레이아웃
  hooks/useSimulation.js  시뮬레이션 엔진(오더 생성/이동/3가지 트리거 로직)
  data/equipment.js       라인·스테이지·설비 매핑 데이터
  components/
    FlowGrid.jsx           5스테이지 x 3라인 그리드 + WCS AI 코어 + 오더 토큰
    OrderToken.jsx          개별 오더(네모) 렌더링
    StagingCluster.jsx      배치 오더 그룹핑 애니메이션
    ControlBar.jsx           재생/배속/이벤트 트리거 버튼
    Dashboard.jsx             실시간 KPI + Recharts 트렌드
    Toasts.jsx                 상황 설명 팝업(말풍선)
```

## 다른 폴더

- `legacy-vanilla-mockup/` — 이전 버전(순수 HTML/CSS/JS, 블루 톤) WCS 목업. 참고용으로 보존.
- `design/wcs-control-simulator/` — 레드 톤 UI/UX 디자인 시안(Claude Design 캔버스). 이번
  React 구현과는 별개의 비주얼 컨셉 탐색 자료입니다.
