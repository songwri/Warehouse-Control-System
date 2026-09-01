# WCS Control Simulator — UI/UX Design Concept

레드 톤 다크모드 사이버물류 컨셉의 **Warehouse Control Simulation System 대시보드 디자인 시안**입니다.
저장소 루트의 실제 동작하는 WCS 목업 시뮬레이터(블루 톤)와는 별개의, UI/UX 설계 산출물입니다.

## 보는 방법

`wcs-control-simulator-design.html`을 브라우저로 직접 열면 됩니다(더블클릭 또는 `open`/`start` 등).
빌드나 서버가 필요 없는 단일 HTML 파일이며, Claude Design 캔버스 에디터가 내장되어 있어 3개의
아트보드를 팬/줌으로 둘러볼 수 있습니다.

> 로컬에서 `file://`로 직접 열었을 때 일부 브라우저/샌드박스 환경에서는 아트보드가 계속
> "Loading..." 상태로 멈출 수 있습니다(에디터가 특정 호스팅 조건을 기대하는 미리보기 전용 빌드라
> 그렇습니다). 그럴 경우 아래 발행된 링크로 보는 쪽이 안정적입니다.

**발행된 링크(권장)**: https://claude.ai/code/artifact/36a2c93c-c41b-4212-bcf8-f27d2ccf348a

## 구성

- `Main.dc.html` — 메인 대시보드. 좌측 고정 내비 + 오더 처리 흐름도(화면의 약 74%) + 우측 KPI/오더 패널.
  오더카드를 클릭하면 지도 위 연결된 설비가 하이라이트되는 인터랙션이 실제로 동작합니다.
- `StyleGuide.dc.html` — 컬러 팔레트, 타이포그래피, 오더카드/상태칩/내비 상태 등 컴포넌트 명세.
- `WarehouseMap.dc.html` — 보조 화면. 설비의 실제 공간 배치 + Equipment Inspector 패널
  (메인 대시보드가 "처리 순서"를, 이 화면이 "물리적 위치"를 보여주는 역할 분담).
- `canvas.json` — 세 아트보드의 캔버스 배치 및 설명 주석(스티키노트).
- `wcs-control-simulator-design.html` — 위 소스들을 Claude Design 캔버스 에디터에 시딩해 만든,
  브라우저에서 바로 열리는 단일 배포 파일.
