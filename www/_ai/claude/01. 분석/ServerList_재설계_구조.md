# ServerList HTML5 재설계 — 폴더/리소스 구조 (가독성 강화판)

> 전제 환경: Electron / `nodeIntegration: true` / `@electron/remote` 직접 사용 / `preload`·`contextBridge` **미사용** / 번들러 **없음**(CommonJS `require`).
> 유지 대상: **루트 `ServerList_v2/`** 와 **시작 HTML `ServerList.html`**. 그 외 전부 재설계.
> 본 개정판은 "**시간이 지나도 파일만 열면 바로 이해**"되도록 가독성을 최우선으로 재구성했다.

---

## 1. 가독성을 위한 3대 장치

1. **폴더마다 `README.md`** — 그 폴더의 역할 + 파일별 한 줄 설명 + 구(舊) 대응을 표로.
2. **모든 `.js` 상단 박스 헤더** — 일관된 양식으로 즉시 파악.
   ```
   /**
    * ====================================================================
    *  [기능:목록] 서버 목록 뷰 — serverTable.view.js
    * --------------------------------------------------------------------
    *  역할   : 6컬럼 테이블/카드, 정렬·선택·더블클릭·툴바
    *  시점   : shell mount 후 / SAPLogonItems 변경 시
    *  입출력 : 입력 STATE.SAPLogonItems / 출력 #ws-server-table
    *  구대응 : fnGetSAPLogonListTable(L2190)
    *  의존   : core/store, ./statusBadge.view, ./serverAction.handler
    * ====================================================================
    */
   ```
3. **이름만 봐도 종류를 아는 파일 규칙**
   - `*.view.js` → 화면을 **그리는** 코드
   - `*.handler.js` → 사용자 **이벤트**를 서비스/상태로 잇는 코드
   - `*.service.js` → **도메인/네이티브** 작업

그리고 최상위 `00_README.md` 가 전체 지도(부팅 순서·데이터 흐름·"어디 고치나" 표)를 제공한다.

---

## 2. 핵심 변화: 레이어 + "기능 응집"

이전(레이어 전용)에서는 한 기능이 `ui/components`, `ui/handlers` 등 여러 폴더에 흩어져 있었다.
개정판은 화면을 **기능(feature) 단위로 응집**하여, **폴더 하나만 열면 그 기능의 뷰+핸들러+설명이 모두** 보이게 했다. 동시에 도메인/상태/연동은 레이어로 유지(여러 기능이 공유하므로).

```
ServerList_v2/
├── ServerList.html          시작 HTML (유지)
├── package.json
├── 00_README.md             ★ 전체 지도 (여기부터)
├── ARCHITECTURE.md          본 문서
│
├── app/        [조립]  index · env · bootstrap · lifecycle
├── core/       [상태]  state · store · constants
├── services/   [도메인] registry/landscape/workspace/serverStore/sapgui/
│                        servicesPort/login/theme/sound (.service.js)
├── ipc/        [연동]  rendererIpc · netServer/(index + handlers/*)
│
├── features/   [화면 — 기능별 응집]
│   ├── shell/            shell.view · titlebar.view
│   ├── workspace-tree/   tree.view · treeSelect.handler
│   ├── server-list/      serverTable.view · statusBadge.view · serverAction.handler
│   ├── server-edit/      editDialog.view · settingsDialog.view
│   └── global-settings/  settingsMenu.view · settings.handler
│
├── widgets/    [공통 UI]  modal · confirmDialog · toast · busyIndicator
├── i18n/       index · messages.map
├── styles/     tokens · base · busy · layout · components · responsive
└── assets/     icons/ · sound/
```

> 각 폴더의 README, 각 파일의 박스 헤더에 옛 함수·라인이 적혀 있어 구→신 추적이 항상 가능하다.

---

## 3. 어디를 고치나 (요약)

| 하고 싶은 것 | 위치 |
|--------------|------|
| 부팅 순서 | `app/bootstrap.js` (init 본문 1~6 번호) |
| 골격/헤더/분할 | `features/shell/*`, `styles/layout.css` |
| 좌측 트리 | `features/workspace-tree/*` |
| 우측 표/카드/정렬 | `features/server-list/serverTable.view.js`, `styles/components.css`·`responsive.css` |
| Active/Inactive | `features/server-list/statusBadge.view.js` |
| 등록/수정/검증 | `features/server-edit/editDialog.view.js` |
| 서버 옵션 | `features/server-edit/settingsDialog.view.js` |
| 삭제/실행 | `features/server-list/serverAction.handler.js` |
| JSON 저장 | `services/serverStore.service.js` |
| 레지스트리 | `services/registry.service.js` |
| XML 가공 | `services/landscape.service.js` |
| 테마(색/폰트) | `styles/tokens.css` |
| 다국어 | `i18n/*` |
| 외부 연동 | `ipc/netServer/*` |

(전체/상세 매핑표는 `00_README.md` 4장 및 각 폴더 README 참조.)

---

## 4. 로딩/모듈 규칙

- HTML은 **CSS 6개**(tokens→base→busy→layout→components→responsive)와 **`app/index.js` 하나**만 로드.
- 이후 전부 `require("상대경로")` 로 연결(번들러 불필요). `nodeIntegration` 이라 `require` 가 항상 살아있어 구 UI5 회피용 Node 전역 임시제거 로직은 **삭제**.
- 모든 네이티브 핸들은 `app/env.js` 가 1회 require 후 공유 → 핸들 불일치/중복 방지.

---

## 5. 상태 한 줄 규칙

> **상태 변경 = `core/store.set(key, value)` → 그 key를 구독한 뷰가 다시 그린다.**

구 단일 JSONModel의 `/WSLANGU /SAPLogon /ServerList /SAPLogonItems` 가 `core/state.js` 의 동일 키로 1:1 이동했다.

---

## 6. 반응형

| 폭 | 트리 | 우측 |
|----|------|------|
| ≥1025px | 고정 2분할(30%) | 표 |
| ≤1024px | 드로어(햄버거) | 표(전체폭) |
| ≤768px | 드로어 | **카드 리스트**(컬럼명 인라인 라벨) |

테마는 기존 SAP Horizon Dark 계승(다크 네이비 + 초록 Active 점), 전부 `styles/tokens.css` 변수.
