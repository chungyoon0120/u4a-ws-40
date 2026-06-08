# CLAUDE.md — ServerList_v2

이 문서는 `www/ServerList_v2/`(ServerList 창)에서 작업할 때의 가이드다. 상위 프로젝트 규칙은
저장소 루트의 `CLAUDE.md` 를 먼저 따르고, 이 문서는 이 폴더에 한정된 세부 사항을 보충한다.

## 역할 / 부트 위치

부트 흐름상 **2단계 창**이다(루트 가이드 "부트 / 창 흐름" 참고): `intro.js` 가 이 창을 열고,
사용자가 서버를 더블클릭하면 **호스트 창**(`www/ws30/ws10_20/index.html`)을 새 `BrowserWindow`
로 띄운다. 즉 ServerList 는 "SAP 로그온 패드"(서버 선택 + 접속 등록정보 관리)이며, 실제 로그인/
메인 IDE 는 호스트 창이 담당한다.

구버전 백업은 `www/_ServerList_v2/` 에 있다(빌드 제외). **이 폴더(`ServerList_v2`)가 정식본**
이므로 백업본을 수정하지 말 것.

## 파일 구성 (3개 + CSS)

- `ServerList.html` — 정적 셸. FOUC 방지용 인라인 테마 부트스크립트(`<head>`) → 공통 헤더
  (`#u4a-header`) → 로그온 헤더(Refresh/설정) → 본문(트리 `aside` + splitter + 서버 `section`)
  → busy/toast/audio. 스크립트 로드 순서가 중요하다: **`u4a-header.js` → `serverlist.data.js`
  → `serverlist.ui.js`** (UI init 이 `U4AHeader.mount` 와 `window.WSData` 를 둘 다 의존).
- `js/serverlist.data.js` — **데이터 레이어**. `window.WSData` 로 노출. 레지스트리 → XML →
  파싱 → 등록정보 병합 → fs.watch. UI 와 완전히 분리(렌더링 코드 없음).
- `js/serverlist.ui.js` — **UI 레이어**. 단일 IIFE. 트리/테이블 렌더, 정렬/검색/splitter,
  모달, i18n, 테마, 새 창 오픈. 최상단에 `window.U4A_LOGO`(로고 경로 단일 소스)도 정의.
- `css/serverlist.css` — `@import "../../css/theme/u4a-theme.css"` 로 공통 테마 변수
  (`--u4a-*`)를 받아 쓴다. 색을 하드코딩하지 말고 테마 변수를 사용할 것. 타이틀바 스타일은
  여기 두지 말 것 — `common/header/u4a-header.css` 단일 소스다.

`data ↔ ui` 경계를 지킬 것: 데이터 접근/영속화는 전부 `WSData`(데이터 레이어)에, DOM 은 전부
ui.js 에 둔다.

## 데이터 레이어 (`window.WSData`)

소스: **SAP `SAPUILandscape.xml`**(서버/워크스페이스 트리) + **`ServerInfo-v2.json`**(접속 등록정보).

- **XML 경로 해석**: 레지스트리 `HKCU\Software\SAP\SAPLogon\Options` 의
  `LandscapeFile`/`LandscapeFileOnServer`/`LandscapeGlobalFile` → 없으면
  `%AppData%/SAP/Common/SAPUILandscape.xml` 폴백.
- **파싱**: `xml-js`(compact). `Services`/`Workspaces`/`Routers`/`Messageservers` 를 읽어
  `servicesByUuid`(서버 속성)와 `tree`(폴더 계층)를 만든다. 메시지서버 포트는
  `%SystemRoot%/System32/drivers/etc/services` 의 `sapms<SID>` 에서 best-effort 추출(기본 3600).
- **등록정보**: 읽기 우선순위 `userData/p13n/ServerInfo-v2.json` → 레거시
  `userData/serverInfo_v2.json`. 쓰기는 항상 primary(`p13n/...`). `savedUuids` 에 등록된
  uuid 가 곧 행의 **Active** 판정 기준이다.
- **CRUD**: `getSavedByUuid` / `getServiceByUuid` / `upsertSaved` / `removeSaved`. 모두
  `{ ok, persisted }` 를 반환 — `persisted:false` 면 메모리만 갱신된 데모/비영속 상태다.
- **행 구성**: `getRows(nodeUuid)` 는 선택 노드의 **직속 아이템만** 반환(자손 폴더를 끌어모으지
  않음 — 같은 서버가 여러 폴더에 있을 때의 중복 방지). SAPGUI 동작과 동일.
- **감시**: `startWatch(onChange)` 가 XML 을 `fs.watch`(250ms 디바운스). rename 으로 watcher 가
  끊기면 재등록한다.
- **비-Electron 폴백**: `require` 가 없으면(브라우저 미리보기) `loadDemo()` 로 더미 서버/등록
  데이터를 채운다. UI 개발 시 브라우저로 열어도 화면이 동작한다.

`reload()` 가 던지는 에러 코드: `NODE_UNAVAILABLE`(Electron 아님), `XML_NOT_FOUND`. UI 는 이를
i18n 메시지(`err_no_node`/`err_xml_missing`)로 매핑한다.

## UI 레이어 (`serverlist.ui.js`)

- **더블클릭 동작**(`openServer`): Inactive 행 → 등록 다이얼로그(`editServer`), Active 행 →
  새 로그인 창(`openLoginPageWindow`). 비-Electron 이면 토스트만.
- **새 창 오픈**(`openLoginPageWindow`): `@electron/remote` 로 `BrowserWindow` 를 만들어
  `ws30/ws10_20/index.html` 을 로드한다. **호스트 창과의 계약**:
  - URL 쿼리: `browserkey` / `sessionKey` / `OBJTY=MAIN` / `SYSID` / `u4aTheme` / `u4aLang`.
  - `webPreferences`: `partition`(= sessionKey, 세션 격리) / `browserkey` / `OBJTY` / `SYSID`
    + `nodeIntegration:true` / `contextIsolation:false` / `webSecurity:false`.
  - `did-finish-load` 후 **`if-meta-info`** IPC 전송(`SERVERINFO`/`EXEPAGE:"LOGIN"`/세션·브라우저
    키). 호스트 라우터(`index.js`)가 이 메시지로 로그인/메인을 분기한다.
  - 흰색 플래시 방지: `show:false` + 테마색 `backgroundColor`, `ready-to-show` 에서 표시
    (3초 안전망 타임아웃 포함).
  - 새 창은 `aOpenLoginWins` 에 추적되어 테마/언어 변경 시 IPC(`u4a-ws-ux-theme` /
    `u4a-ws-ux-lang`)로 실시간 전파된다.
- **테마**: ServerList 자체는 `localStorage`(`u4a-ws-theme-v1`, 기본 `purple`)를 쓴다. 이 값은
  **신규 창의 글로벌 폴백**일 뿐이다. 로그인/메인 창은 **SYSID 기준 저장 테마**
  (`<userData>/u4a-ws/uxThemeBySysid.json`, `readSysidUxTheme`)를 우선한다 — 이미 열린 로그인/
  메인 창에는 ServerList 테마 변경을 전파하지 않는다.
- **i18n**: `I18N` 테이블(en/ko) + `t(key, params)`. 마크업은 `data-i18n` /`data-i18n-ph`
  /`data-i18n-title` 속성으로 표시하고 `applyStaticI18n()` 이 일괄 적용. 텍스트를 하드코딩하지
  말고 키를 추가할 것. `localStorage` 키 `u4a-ws-lang-v1`.
- **정렬**: 컬럼 헤더 클릭 = 멀티 정렬 누적(`cycleSort`: 없음→기본방향→반대→그 컬럼만 해제).
  영속 키 `u4a-ws-sort-v3`(v1/v2 → v3 자동 마이그레이션). 문자열 비교는
  `Intl.Collator(numeric:true)`(IP·SNO 자연 정렬).
- **선택 영속화**: 트리/행 선택은 `u4a-ws-selection-v1` 에 저장·복원. 트리 폭은 **저장하지
  않음**(매 실행 200px 기본).
- **공통 헤더**: 타이틀바·창제어는 `U4AHeader.mount("u4a-header", {...})` 로만 렌더. 창제어
  아이콘/타이틀바 스타일은 이 폴더가 아니라 `common/header/` 에서 수정한다(루트 가이드 참고).
- **About**: 옵션 → About 은 `../aboutWs.html`(상위 `www/` 폴더)을 iframe 오버레이로 띄운다.
  iframe 이 `parent.WSUTIL`/`REMOTE`/`APP` 를 읽으므로 `setupAboutBridge()` 가 먼저 전역을
  노출한다(Electron 에서만; 데모는 조용히 패스).
- **로고**: `window.U4A_LOGO`(png/ico/applyFavicon/createImg/imgHTML)가 로고 경로 단일 소스다.
  새 창/모달은 반드시 이 객체만 참조할 것.

## 작업 시 주의

- 두 레이어 모두 방어적 `try/catch (_) {}` 와 비-Electron 분기를 둔다 — 새 기능도 데모 모드에서
  깨지지 않게 같은 패턴을 따를 것.
- 경로는 하드코딩하지 말 것. 호스트 창/About 으로 가는 경로는 `APP.getAppPath()` 기준으로
  조립하고, 공유 경로는 `ws30/resources/pathInfo.js` 를 통해 해석한다.
- 테스트 러너/린터 없음(루트 가이드 참고). UI 변경은 `npm start` 후 ServerList 창에서 육안
  확인하거나, 데이터 레이어가 없어도 되는 변경은 브라우저로 `ServerList.html` 을 열어 데모
  모드로 확인한다.
