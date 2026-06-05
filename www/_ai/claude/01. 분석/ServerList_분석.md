# U4A Workspace ServerList 소스 분석

> 대상: `ServerList_v2/ServerList.js` (5,783 lines) 및 부속 모듈
> 목적: 기존 SAPUI5 기반 서버 목록 화면을 HTML5 기반 반응형으로 재구현하기 위한 전체 흐름 분석
> 전환 환경: Electron 유지 / `nodeIntegration` 활성 렌더러 / `preload`·`contextBridge` 미사용 / `@electron/remote`·`require` 직접 사용

---

## 1. 개요

`ServerList`는 **U4A Workspace Logon Pad**(서버 접속 런처) 화면이다. 실행 환경은 순수 웹이 아니라 **Electron 데스크톱 앱** 위에서 동작하는 **SAPUI5(`sap.m`, `sap.ui.table`, `sap.ui.layout`) 애플리케이션**이다.

핵심 동작은 다음과 같다.

1. Windows 레지스트리에서 SAPGUI의 `SAPUILandscape.xml` 파일 경로를 읽는다.
2. 그 XML을 파싱하여 **좌측 워크스페이스 트리**(폴더 구조)와 **우측 서버 목록**(서비스 목록)을 구성한다.
3. 사용자가 입력/저장한 접속 정보(`serverInfo_v2.json`)와 병합하여 서버별 **Active / Inactive 상태**를 표시한다.
4. 서버를 더블클릭하면 접속 정보로 새 Electron 브라우저 창(로그인 페이지)을 띄운다.

> 환경 의존성 요약: `@electron/remote`, `electron.ipcRenderer`, Node `fs`/`path`/`child_process`, `regedit`(Windows 레지스트리), `xml-js`(XML 파싱), PowerShell 스크립트(SAPGUI 버전 체크), Named Pipe(`net`) 서버.
>
> **전환 환경 전제(중요)**: 본 전환 작업은 **`nodeIntegration`이 활성화된 렌더러**에서 진행한다. 즉 `preload`/`contextBridge`를 쓰지 않고, 렌더러 JS에서 `require(...)`와 **`@electron/remote`** 를 직접 호출한다(현재 코드와 동일한 방식). 따라서 위의 네이티브 기능들은 **별도 백엔드나 IPC 브릿지 없이 HTML5 화면 코드 안에서 그대로 재사용**한다. (10장 참고)

---

## 2. 파일 구조

```
ServerList_v2/
├── ServerList.html               진입 HTML (Busy Indicator + #content + ServerList.js 로드)
├── ServerList.js                  메인 로직 전체 (5,783줄)
├── css/
│   ├── server.css                서버 목록/다이얼로그 관련 보조 스타일
│   └── serverInfo.css            BusyIndicator 등 공통 스타일
└── modules/Server/net/
    ├── index.js                   Named Pipe 서버 (외부 프로그램 연동용)
    └── PRC_MODULES/               요청 코드(PRCCD)별 처리 모듈
        ├── CONNECT / DISCONNECT / ISCONNECT
        ├── OPEN_SERVER (+ sap_landscape.js)
        ├── WS20 / TEST / ERROR
        └── code_info.txt          오류 코드 정의
```

`ServerList.js` 내부는 크게 세 블록으로 나뉜다.

| 블록 | 위치(라인) | 역할 |
|------|-----------|------|
| 1차 IIFE `(function(window){...})` | 12 ~ 112 | `oAPP` 전역 골격 생성, Electron 핸들 확보, `if-globalSetting-info` IPC 수신, BusyIndicator, 사운드 |
| 전역 require/상수 영역 | 115 ~ 209 | 모듈 import, 상수(`SAPGUIVER`, `POPID`, `SERVER_TBL_ID`, `BINDROOT`), Node/UI5 충돌 회피 |
| 2차 IIFE `(function(oAPP){...})` | 212 ~ 5499 | 실제 비즈니스 로직 전체 (시작·데이터·렌더링·이벤트) |
| 부트스트랩 함수들 | 5502 ~ 끝 | `_onLoad`, `fnLoadBootStrapSetting`, `fnLoadCommonCss`, `_ensureSingleInstance`, `onbeforeunload` |

---

## 3. 진입점 ~ 부팅 흐름

### 3.1 전체 호출 체인

```
[HTML 로드] ServerList.js
        │
        ├─ (즉시 실행) fnLoadCommonCss()                  공통 CSS 주입
        │
        ├─ Electron 메인 → if-globalSetting-info IPC 수신
        │        └─ oAPP.fn.fnOnDeviceReady()
        │                 └─ oAPP.fn.fnLoadBootStrapSetting()   ★ 시작점
        │                          │  (UI5 부트스트랩 <script> 동적 삽입)
        │                          │   data-sap-ui-oninit="_onLoad"
        │                          ▼
        │                       _onLoad()                       ★ UI5 초기화 진입
        │                          ├─ Node 환경변수 복원
        │                          ├─ _ensureSingleInstance()   단일 인스턴스 보장
        │                          └─ sap.ui.getCore().attachInit(...)
        │                                   └─ oAPP.fn.fnOnMainStart()  ★ 메인 시작
```

### 3.2 `fnLoadBootStrapSetting` (L5541) — UI5 부트스트랩 생성

- 전역 `SETTINGS.UI5.bootstrap` 설정과 글로벌 설정(`oAPP.data.GlobalSettings`)을 읽는다.
- 테마(`data-sap-ui-theme`)는 글로벌 설정값 우선, 없으면 기본값. 코드 기본은 `sap_horizon_dark`.
- 언어(`data-sap-ui-language`)는 글로벌 설정값 우선, 없으면 `EN`(브라우저 언어를 2자리로 잘라 fallback).
- 로드 라이브러리: `sap.m, sap.ui.layout, sap.ui.table`.
- `data-sap-ui-oninit="_onLoad"`를 지정하여 UI5 코어 로드 완료 시 `_onLoad`가 자동 호출되도록 연결.
- 위 속성을 가진 `<script>`를 `document.head`에 동적 추가 → 이 시점에 UI5가 실제 로딩된다.

### 3.3 `_onLoad` (L5502) — UI5 초기화 진입

- `window.__node`에 백업해 둔 Node 전역(`require`/`module`/`exports`) 복원. (L192 IIFE에서 UI5 로더를 속이려고 일시 제거했던 것을 되돌림)
- `_ensureSingleInstance()`로 중복 실행 방지(패키징 환경에서만 동작, `requestSingleInstanceLock`).
- `sap.ui.getCore().attachInit(...)` 안에서 `oAPP.attr.sap = sap` 저장 후 `fnOnMainStart()` 호출.

### 3.4 `fnOnMainStart` (L475) — 메인 시퀀스

`async` 함수로, 순서대로 다음을 수행한다.

| 순서 | 호출 | 설명 |
|------|------|------|
| 1 | `oAPP.setBusy(true)` | 화면 잠금 + BusyIndicator |
| 2 | `DEV_SOURCE_FINDER.init(window)` | (개발 도구) 우클릭 소스 탐색 주입 |
| 3 | `jQuery.sap.require("sap.m.MessageBox")` | MessageBox 사전 로드 |
| 4 | `fnWsGlobalMsgList()` | 다국어 메시지(`oAPP.msg.M01~M271`)를 레지스트리 언어 기준으로 로드 |
| 5 | `fnRegisterIllustrationPool()` | TNT 일러스트 세트 등록(빈 화면 표시용) |
| 6 | `_createTaskBarMenu()` | 작업표시줄 메뉴 생성 |
| 7 | `_attachCurrentWindowEvents()` | 현재 창 이벤트 핸들러 |
| 8 | `fnOnInitModeling()` | **초기 JSONModel 구성** (다국어 텍스트 `/WSLANGU`) |
| 9 | `fnOnInitRendering()` | **화면(UI5 컨트롤 트리) 렌더링** |
| 10 | `_getMsgServPortList()` | `etc/services`에서 메시지 서버 SYSID/PORT 추출 |
| 11 | `fnOnListupSapLogon()` | **레지스트리·XML을 읽어 서버 목록 데이터 적재** |
| 12 | `oU4ASERV.createServer()` | 외부 연동용 Named Pipe 서버 기동 |
| 13 | `oAPP.setBusy(false)` + `CURRWIN.focus()` | 잠금 해제 |

> 핵심 분리: **화면 골격(9번)은 데이터(11번)보다 먼저 그려진다.** 즉 UI 컨트롤을 먼저 만들고, 이후 모델 프로퍼티(`/SAPLogon`, `/ServerList`, `/SAPLogonItems`)를 채우면 바인딩으로 자동 반영되는 구조.

---

## 4. 데이터 적재 흐름 (`fnOnListupSapLogon`)

이 화면의 데이터 코어다. 호출 체인은 다음과 같다.

```
fnOnListupSapLogon (L849)
   ├─ 모델 초기화 ( /SAPLogon, /ServerList, /SAPLogonItems 비움 )
   ├─ fnGetRegInfoForSAPLogon()        레지스트리에서 SAPLogon 키 읽기 (REGEDIT.list)
   └─ fnGetRegInfoForSAPLogonThen()
            ├─ LandscapeFile 경로 유효성/존재 확인 (FS.existsSync)
            ├─ FS.watch 로 XML 변경 감지 등록 → 변경 시 fnSapLogonFileChange → 재조회
            ├─ fnReadSAPLogonData()    XML 파일 읽어 xml-js로 JSON 변환
            └─ fnReadSAPLogonDataThen()
                     ├─ fnCheckSapguiVersion()       PowerShell로 설치 버전 확인 (770 미만 차단)
                     ├─ 레지스트리에 GUIVer / GUIPath 저장
                     ├─ oAPP.data.SAPLogon[fileName] = 파싱결과
                     ├─ fnSetSAPLogonLandscapeList()  ★ 서버 목록(/ServerList) 구성
                     ├─ fnCreateWorkspaceTree()       ★ 좌측 트리(/SAPLogon) 구성
                     ├─ TreeTable expandToLevel(1)
                     └─ attachEventOnce("rowsUpdated", fnAttachRowsUpdateOnce)  마지막 선택노드 복원
```

### 4.1 `fnReadSAPLogonData` (L1422)

`SAPUILandscape.xml`을 `FS.readFile`로 읽고 `xml-js`의 `xml2json`(옵션: `compact:true`, 주석/선언 무시)으로 JSON 변환. 결과의 `Landscape` 노드를 반환.

### 4.2 `fnCheckSapguiVersion` (L1320) / `_checkSapGuiInfoShell` (L1213)

- PowerShell 스크립트(`get_sapgui_inf.ps1`)를 실행하여 **설치된 SAPGUI 버전/경로**를 얻는다. (기존엔 XML의 버전을 읽었으나 설치본 기준으로 변경됨)
- `SUBRC === 8`이면 미설치, 버전 파싱 실패/없음 각각 오류 메시지, **770(`SAPGUIVER`) 미만이면 지원 불가** 처리.

### 4.3 `fnSetSAPLogonLandscapeList` (L1461) — 서버 목록 빌드

XML → `/ServerList` 모델 데이터로 변환하는 핵심 로직.

- `Landscape.Services.Service`(단건이면 객체→배열로 정규화)를 순회.
- `shortcut == "1"`인 항목은 제외.
- `mode == "1"`이면 `server`를 `:`로 분리해 `host`/`port` 도출.
- `routerid`가 있고 `Routers`가 있으면 라우터 정보를 `_attributes.router`로 매핑.
- `msid`(메시지 서버)가 있으면:
  - `host`는 `server`(logon group)명, `port`는 메시지 서버 포트.
  - 포트가 없으면 `etc/services`에서 추출한 `aSys32MsgServPort`에서 SYSID 매칭하여 보완, 그래도 없으면 기본 `3600`.
- `port`가 있으면 `insno = port.substring(2,4)` (인스턴스 번호 = 화면의 **SNO**).
- 각 서비스의 `_attributes` 객체를 모아 `oCoreModel.setProperty("/ServerList", aBindData)`로 저장.

### 4.4 `fnCreateWorkspaceTree` (L2117) / `fnWorkSpaceSort` (L2141)

- `Landscape.Workspaces.Workspace`를 가상 루트(`name:"Workspace"`, `uuid:"WorkspaceROOT"`)로 감싸 `/SAPLogon`에 저장.
- `fnWorkSpaceSort`로 각 Node를 이름(대문자 기준) 오름차순 재귀 정렬.
- TreeTable의 `rows.path = "/SAPLogon"`, `arrayNames:['Node']` 바인딩으로 폴더 트리가 렌더링됨.

---

## 5. 모델 구조 (JSONModel 단일 코어 모델)

`sap.ui.getCore().setModel(...)` 하나의 글로벌 JSONModel에 다음 키들이 공존한다.

| 경로 | 내용 | 생성 위치 |
|------|------|----------|
| `/WSLANGU` | 다국어 메시지 텍스트(메시지클래스 단위) | `fnOnInitModeling` |
| `/SAPLogon` | 좌측 워크스페이스 트리 데이터(가상 루트 + Node 계층) | `fnCreateWorkspaceTree` |
| `/ServerList` | XML에서 추출한 전체 서버(서비스) 원본 목록 | `fnSetSAPLogonLandscapeList` |
| `/SAPLogonItems` | **현재 선택한 트리 노드에 속한 서버 목록(우측 테이블 바인딩 대상)** | `fnPressWorkSpaceTreeItem` |

화면에 보이는 우측 테이블은 `/SAPLogonItems`에 바인딩되며, 좌측 트리 선택 시마다 이 배열이 새로 채워진다.

서버 항목별 주요 필드: `uuid`, `name`(서버명), `systemid`(SID), `host`, `insno`(SNO), `ISSAVE`(저장/활성 여부), `settings`(옵션).

---

## 6. 화면(UI) 렌더링 구조 (`fnOnInitRendering`, L1691)

```
sap.m.App
└─ sap.m.Page (MainPage)
   ├─ customHeader: Bar
   │    ├─ 좌: WS 로고 이미지 + "U4A Workspace" 타이틀
   │    └─ 우: 최소화 / 최대화(toggle) / 닫기 버튼  (드래그 영역 클래스 부여)
   ├─ subHeader: Bar
   │    ├─ 좌: "U4A Workspace Logon Pad" 타이틀(다국어 바인딩)
   │    └─ 우: 설정 MenuButton (언어 / 테마 / 사운드 / About)
   └─ content: sap.ui.layout.Splitter (가로 분할)
        ├─ Page1 (size 30%) → 좌측 TreeTable (WorkTree)
        └─ Page2 (나머지)   → 우측 Table (serverlist_table)
```

- `onAfterRendering`에서 팝업 영역을 페이지 콘텐츠로 제한(`sap.ui.core.Popup.setWithinArea`)하고 `#content`를 fadeIn.
- 전체 컴팩트 사이즈(`sapUiSizeCompact`).

### 6.1 좌측 TreeTable (`fnGetWorkSpaceTreeTable`, L1881)

- 단일 선택(`Single`, `RowOnly`), 컬럼 헤더 숨김, 행 자동 개수.
- 컬럼 1개: `{_attributes/name}` 텍스트.
- `rowSelectionChange` → `fnServerListUnselect()`(우측 선택 해제) + `fnPressWorkSpaceTreeItem()`(우측 목록 갱신).

### 6.2 우측 Table (`fnGetSAPLogonListTable`, L2190)

`sap.m.Table` (`fixedLayout:false`, `alternateRowColors`, `autoPopinMode:true`, `SingleSelectMaster`, 헤더 sticky). `autoPopinMode`로 좁은 폭에서 셀이 접히는 **반응형** 동작을 일부 제공한다.

컬럼/셀 구성:

| # | 컬럼 헤더 | 셀 컨트롤 | 바인딩 | 비고 |
|---|-----------|-----------|--------|------|
| 1 | STATUS (150px) | `sap.m.ObjectStatus` (아이콘 `circle-task-2`) | `ISSAVE` | `true`→"Active"/Success, else "Inactive"/None. 정렬 메뉴 |
| 2 | SERVER NAME | `Text` | `{name}` | 정렬 메뉴(필터는 주석 처리됨) |
| 3 | SID (가운데) | `Text` | `{systemid}` | 정렬 메뉴 |
| 4 | HOST(Or IP) | `Text` | `{host}` | 정렬 메뉴 |
| 5 | SNO (가운데) | `Text` | `{insno}` | |
| 6 | Settings (가운데) | `Button` (`settings` 아이콘) | `enabled = !!ISSAVE` | 설정 팝업 |

- 컬럼별 정렬은 `sap.m.table.columnmenu.Menu` + `QuickAction`(오름/내림) → `binding.sort(new sap.ui.model.Sorter(path, bDescending))`, `_clearAllSortIndicator()`로 다른 컬럼 지시자 초기화.
- 테이블 `ondblclick` → `fnPressServerListItem`(서버 실행).

> 첨부 이미지와의 대응: 초록 점 + "Active" / 회색 점 + "Inactive" = STATUS 컬럼(ObjectStatus의 state Success/None). 우측 상단 파란 연필/빨간 휴지통 = 헤더 툴바의 Edit/Delete. 행별 톱니바퀴 = Settings 컬럼 버튼(미저장 행은 비활성).

### 6.3 헤더 툴바 (`fnGetSAPLogonListTableToolbar`, L3006)

- Edit 버튼(`fnPressEdit`)과 Delete 버튼(`fnPressDelete`)을 가진 `sap.m.Toolbar`.

---

## 7. 사용자 인터랙션 흐름

### 7.1 좌측 트리 선택 → 우측 목록 갱신 (`fnPressWorkSpaceTreeItem`, L1943)

1. 선택 행의 컨텍스트/데이터 확보, `/SAPLogonItems` 초기화.
2. 선택 노드의 `uuid`를 레지스트리(`setRegistryLastSelectedNodeKey`)에 마지막 선택값으로 저장(재시작 시 복원용).
3. 노드의 하위 `Item`(서버 참조) 각각의 `serviceid`로 `/ServerList`에서 원본 서버를 찾아 깊은 복사하여 `aItemList`에 push.
4. `name` 오름차순 정렬 후 `/SAPLogonItems`에 set.
5. `_syncSavedServerInfo()`로 저장된 접속정보와 병합.

### 7.2 저장 정보 병합 (`_syncSavedServerInfo`, L2708)

- `fnGetSavedServerListDataAll()`로 `serverInfo_v2.json` 전체를 읽고, 현재 `/SAPLogonItems`의 각 `uuid`와 매칭되면 `ISSAVE = true` 및 `settings`를 주입 → STATUS가 "Active"로 표시됨.

### 7.3 마지막 선택 노드 복원 (`fnAttachRowsUpdateOnce`, L662 / `_findLastSelectedPath`, L754)

- TreeTable 최초 `rowsUpdated` 시 1회 실행. 레지스트리의 `LastSelectedNodeKey`를 읽어 해당 노드까지의 경로를 재귀 탐색하고, 상위 노드를 펼치며 마지막 노드를 선택·스크롤한다.

### 7.4 등록/수정 (`fnPressEdit` → `fnEditDialogOpen` → `fnPressSave`)

- `fnEditDialogOpen` (L3180): Protocol(http/https Select) · Host(필수) · Port 입력 폼을 가진 `sap.m.Dialog` 생성. 기존 저장값이 있으면 채워 넣음. 모델 루트 `BINDROOT = "/SAVEDATA"`.
- `fnPressSave` (L3652):
  1. `fnCheckValid`로 Host 필수/공백 검증(`valueState` 에러 표시 + 포커스).
  2. 저장 객체 구성(`uuid`, `protocol`, `host`, `port`, `settings.useInternal/skipCertificate`).
  3. `serverInfo_v2.json` 읽어 동일 `uuid`면 갱신, 없으면 push 후 `fnWriteFile`로 저장.
  4. 모델의 해당 행 `ISSAVE = true` 설정, 다이얼로그 닫기, 성공 사운드/토스트.

### 7.5 삭제 (`fnPressDelete`, L3069)

- 선택 행이 `ISSAVE`일 때만 동작. 확인 MessageBox("C") → "OK"면 `serverInfo_v2.json`에서 해당 `uuid` 제거 후 저장 → `fnSetRefreshSelectTreeItem()`로 좌측 트리 재선택(목록 갱신).

### 7.6 서버 실행 / 로그인 (`fnPressServerListItem` → `fnLoginPage`)

- `fnPressServerListItem` (L3879): 더블클릭 행의 데이터 확보. **미저장(`!ISSAVE`)이면 등록 팝업을 대신 연다.** 저장돼 있으면 저장 정보로 `protocol://host:port` URL 구성, `oLoginInfo`(이름/서버정보/SID/인스턴스 등) 구성, 테마 개인화(`fnP13nCreateTheme`) 로드, 선택 정보 레지스트리 저장(`_registSelectedSystemInfo`) 후 `fnLoginPage` 호출.
- `fnLoginPage` (L5029): `electron-window-state`로 창 상태 관리, 세션키/브라우저키 난수 생성, `BROWSERSETTINGS` 기반 옵션으로 **새 `BrowserWindow`** 생성, `MAINFRAME` URL을 쿼리스트링과 함께 로드, `did-finish-load` 시 `if-meta-info` IPC로 메타데이터 전달, 세션 SameSite 회피 처리.

### 7.7 설정 메뉴 (`ev_settingItemSelected`, L3962)

- 키별 분기: `WSLANGU`(언어) / `WSTHEME`(테마) / `WSSOUND`(사운드) / `ABOUTWS`(정보) 팝업을 연다. 언어·테마 변경 저장 시 모델/부트스트랩 재구성으로 즉시 반영.

---

## 8. 외부 연동 서버 (`modules/Server/net/index.js`)

- `oU4ASERV.createServer()`가 **Windows Named Pipe**(`\\.\pipe\u4aws\serverlist`, 개발 시 `_dev` 접미사)로 TCP 서버를 연다.
- 수신 데이터는 JSON. `PRCCD` 값으로 `PRC_MODULES/<PRCCD>/index.js`를 동적 `require`하여 처리(예: `CONNECT`, `DISCONNECT`, `ISCONNECT`, `OPEN_SERVER`, `WS20`).
- 공통 응답 구조 `TY_RES`: `PRCCD/ACTCD/RETCD/STCOD/RTMSG/RDATA`.
- 오류 코드는 `code_info.txt` 참조(E001 잘못된 JSON, E002 지원하지 않는 경로 등).
- 목적: U4A EDU 등 외부 프로그램이 서버리스트와 통신(서버 열기 등)하기 위한 IPC 채널.

---

## 9. 종료/생명주기 처리

- `window.onbeforeunload` (L5704): 서버리스트 외 실행 중인 자식 브라우저(`OBJTY != SERVERLIST/FLTMENU`)가 있으면 **창을 닫지 못하게 막고** `showIllustratedMsg()`를 띄운다. (SameSite 이벤트 핸들러가 서버리스트에 있어 먼저 닫히면 다른 창의 통신이 끊기기 때문)
- `showIllustratedMsg` (L5345): 자식 창이 있을 때 "전체 종료" 여부를 묻는 일러스트 메시지 페이지.
- 닫기 버튼/`fnProgramShuttDown`/`_showShuttdownAskPopup` 등으로 전체 종료 흐름 처리.

---

## 10. HTML5 반응형 전환 방향 (remote + nodeIntegration 환경)

### 10.0 전환 전제

본 전환은 **다음 환경을 그대로 유지**한 채 진행한다.

- `preload` 스크립트 **미사용**, `contextBridge` **미사용**.
- 렌더러(`nodeIntegration: true`, `contextIsolation: false`)에서 `require(...)`와 **`@electron/remote`** 를 직접 호출.
- 즉 현재 `ServerList.js`가 쓰는 것과 **동일한 네이티브 접근 방식**을 새 HTML5 코드에서도 그대로 쓴다.

이 전제 덕분에 전환 작업의 본질은 **"UI 레이어 교체"** 하나로 좁혀진다. 데이터/네이티브 로직(레지스트리, 파일, PowerShell, Named Pipe, 새 창 생성)은 **재설계 없이 그대로 재사용**하고, **SAPUI5 컨트롤 + JSONModel 바인딩** 부분만 **HTML5/CSS + 자체 렌더링·이벤트 코드**로 바꾼다.

> 단, 보안상 `nodeIntegration` 활성 렌더러는 외부 URL을 직접 로드하면 위험하므로, 본 화면(서버리스트)은 로컬 자원만 로드한다는 전제를 유지한다.

### 10.1 그대로 재사용하는 부분 (수정 불필요 / 거의 무수정)

아래 함수·모듈은 UI 프레임워크와 무관하므로 **그대로 가져다 쓴다.** `sap.ui.getCore().getModel()` 같은 UI5 모델 접근만 자체 상태객체 접근으로 치환하면 된다.

| 구분 | 대상 | 비고 |
|------|------|------|
| 모듈 import | `REMOTE`, `FS`, `PATH`, `REGEDIT`, `XMLJS`, `child_process`, `RANDOM`, `IPCRENDERER` | `require`/`@electron/remote` 그대로 |
| 레지스트리 | `fnGetRegInfoForSAPLogon`, `setRegistryLastSelectedNodeKey`, GUIVer/GUIPath 저장 | `regedit` 그대로 |
| 파일 I/O·감시 | `fnReadSAPLogonData`, `fnWriteFile`, `fnGetSavedServerListData(All)`, `FS.watch` | `fs` 그대로 |
| XML 파싱 | `xml-js`의 `xml2json` | 그대로 |
| SAPGUI 버전 | `fnCheckSapguiVersion`, `_checkSapGuiInfoShell` (PowerShell `spawn`) | 그대로 |
| services 파싱 | `_getMsgServPortList`, `_getSys32Services` (`child_process`) | 그대로 |
| 서버 실행/로그인 | `fnLoginPage` (`REMOTE.BrowserWindow`), `_registSelectedSystemInfo`, `fnP13nCreateTheme` | `@electron/remote` 그대로 |
| 외부 연동 | `oU4ASERV.createServer()` (Named Pipe) 및 `PRC_MODULES` | 그대로 |
| 데이터 가공 | `fnSetSAPLogonLandscapeList`, `fnCreateWorkspaceTree`, `fnWorkSpaceSort`, `_syncSavedServerInfo` | UI5 모델 set/get만 치환 |
| 생명주기 | `_ensureSingleInstance`, `onbeforeunload`, `fnProgramShuttDown` | 그대로 |
| 사운드 | `oAPP.setSoundMsg` (`<audio>`) | 그대로 |

### 10.2 HTML5/CSS/JS로 새로 만드는 부분 (UI 레이어)

SAPUI5 → HTML5 대응표.

| 현재 (UI5) | HTML5 대체 |
|------------|------------|
| `sap.m.App` / `sap.m.Page` / `Bar` (커스텀 헤더·서브헤더) | 시맨틱 `header`/`section` + CSS. 창 최소화/최대화/닫기 버튼은 그대로 `CURRWIN.*`(remote) 호출 |
| `sap.ui.layout.Splitter` (좌30%/우) | CSS Grid `grid-template-columns: minmax(220px,30%) 1fr` 또는 Flex. (선택) 드래그 리사이저 |
| `sap.ui.table.TreeTable` (좌측 트리) | `<ul>` 재귀 렌더링 또는 `<div>` 트리. 펼침/접힘 토글, 선택 하이라이트 직접 구현 |
| `sap.m.Table` + `ColumnListItem` (우측) | `<table>`(또는 Grid). 좁은 폭에서는 행→**카드** 전환(미디어쿼리) |
| `sap.m.ObjectStatus` (STATUS) | `<span class="status dot">` + 텍스트. Active=초록/Inactive=회색 CSS |
| 컬럼 헤더 정렬 메뉴(`columnmenu`) | 헤더 클릭 → 정렬 토글 + 지시자(▲▼) 직접 구현 |
| `sap.m.Dialog` (등록/수정) | `<dialog>` 또는 모달 `div`. Protocol(select)/Host/Port(input) + 검증 |
| MessageBox / MessageToast | 자체 confirm 모달 / toast 컴포넌트 |
| `sap.m.MenuButton` + `Menu` (설정) | 드롭다운 메뉴(언어/테마/사운드/About) |
| JSONModel 양방향 바인딩 | 자체 상태객체 + "상태 변경 → 부분 리렌더" 패턴(아래 10.3) |
| 다국어 `{/WSLANGU/...}` 바인딩 | i18n JSON 로드 후 렌더 시 텍스트 치환(`data-i18n` 속성 등) |
| BusyIndicator | `ServerList.html`의 기존 `#u4aWsBusyIndicator` DOM·CSS 재사용 |

### 10.3 상태(모델) 관리 치환 전략

현재 단일 JSONModel의 4개 경로(`/WSLANGU`, `/SAPLogon`, `/ServerList`, `/SAPLogonItems`)를 **평범한 JS 상태객체**로 옮긴다.

```js
const STATE = {
  WSLANGU: {},        // 다국어 텍스트
  SAPLogon: {},       // 좌측 트리(가상 루트 + Node 계층)
  ServerList: [],     // XML에서 추출한 전체 서버
  SAPLogonItems: [],  // 현재 선택 노드의 우측 표시 목록
};
```

- 기존 `oCoreModel.setProperty("/ServerList", x)` → `STATE.ServerList = x; renderServerTable();`
- 기존 `oModel.refresh()` → 해당 영역만 다시 그리는 `renderXxx()` 호출.
- `_syncSavedServerInfo`의 `ISSAVE`/`settings` 주입 로직은 `STATE.SAPLogonItems`를 대상으로 동일하게 수행.
- (선택) 변경 추적을 자동화하려면 `Proxy` 또는 경량 라이브러리(예: 신호/리액티브)로 감싸도 되지만, 본 화면 규모에서는 명시적 `render*()` 호출이 단순·안정적.

### 10.4 데이터·렌더 흐름 매핑 (전환 후)

```
[Electron 메인] if-globalSetting-info  (그대로 IPCRENDERER.on)
        └─ 부팅: 공통 CSS + (UI5 부트스트랩 제거) → 바로 init()
                 init()
                  ├─ _ensureSingleInstance()                 (그대로)
                  ├─ loadI18n()        → STATE.WSLANGU
                  ├─ renderShell()     좌/우 레이아웃·헤더 DOM 생성 (UI5 대체)
                  ├─ _getMsgServPortList()                    (그대로)
                  ├─ fnOnListupSapLogon()                     (UI5 모델 set만 치환)
                  │     └─ ... fnSetSAPLogonLandscapeList → STATE.ServerList
                  │         fnCreateWorkspaceTree           → STATE.SAPLogon
                  │         → renderTree()
                  └─ oU4ASERV.createServer()                 (그대로)

[좌측 트리 클릭]  fnPressWorkSpaceTreeItem 로직 재사용
        → STATE.SAPLogonItems 구성 → _syncSavedServerInfo → renderServerTable()
[행 더블클릭]    fnPressServerListItem → fnLoginPage(REMOTE.BrowserWindow)  (그대로)
[Edit/Save/Delete/Settings]  로직 재사용 + 모달 UI만 HTML5로
```

### 10.5 반응형 설계 가이드

- **데스크톱(≥1024px)**: 현재처럼 좌측 트리 + 우측 테이블 2분할 유지.
- **태블릿(~768px)**: 트리를 토글 가능한 사이드 패널(드로어)로 전환, 우측을 전체폭으로.
- **모바일(<768px)**: 테이블을 **카드 리스트**로 전환(컬럼 라벨을 카드 내부 라벨로). STATUS·SID·HOST·SNO를 카드 한 장에 표시, Settings/실행은 카드 액션 버튼으로.
- 헤더의 창 제어 버튼(최소/최대/닫기)은 Electron 프레임리스 창 기준이므로 폭과 무관하게 유지하되, 모바일 폭에서는 아이콘만 노출.
- 폰트/색상은 기존 `sap_horizon_dark` 톤(첨부 이미지의 다크 네이비 배경, 초록 Active 점)을 CSS 변수로 토큰화하여 테마 설정과 연동.

### 10.6 전환 시 주의점 / 리스크

- **UI5 의존 코드 제거**: `jQuery.sap.require`, `sap.ui.getCore().byId`, `sap.ui.model.*`, `IllustrationPool`, `sap.m.*` 호출 전부 제거·치환. 단 `fnLoginPage`처럼 UI5와 무관한 함수는 손대지 않는다.
- **부트스트랩 제거**: `fnLoadBootStrapSetting`/`_onLoad`의 UI5 로딩 로직 삭제. 대신 `if-globalSetting-info` 수신 → 자체 `init()` 직행. Node 전역 임시제거(L192) 로직도 UI5 로더를 속이기 위한 것이므로 **불필요해져 삭제** 가능.
- **`FS.watch` 재진입**: XML 변경 감지 후 목록 갱신 시 `render*()`가 호출되도록 연결(현재는 `fnOnListupSapLogon` 재호출). 중복 watch 정리 로직(`oAPP.oSapLogonWatch.close()`)은 유지.
- **선택 상태 복원**: `fnAttachRowsUpdateOnce`/`_findLastSelectedPath`의 "마지막 선택 노드 복원"은 UI5 TreeTable API(`expand`, `setSelectedIndex`)에 의존하므로, 자체 트리 렌더 후 동일 효과(경로 펼침 + 선택 + 스크롤)를 새로 구현해야 한다.
- **컴팩트 사이즈/팝업 영역 제한**: `sapUiSizeCompact`, `Popup.setWithinArea`는 UI5 전용. 모달이 Electron 프레임리스 헤더 영역과 겹치지 않도록 CSS로 z-index·영역을 직접 관리.
- **성능**: 트리/테이블이 클 경우 전체 재렌더 대신 변경 행만 갱신하거나 가상 스크롤 고려.

---

## 부록 A. 주요 함수 인덱스 (라인)

| 함수 | 라인 | 역할 |
|------|------|------|
| `fnLoadBootStrapSetting` | 5541 | UI5 부트스트랩 스크립트 동적 생성 (시작점) |
| `_onLoad` | 5502 | UI5 init 진입, 단일 인스턴스, fnOnMainStart 호출 |
| `fnOnMainStart` | 475 | 메인 시퀀스 오케스트레이션 |
| `fnWsGlobalMsgList` | 533 | 다국어 메시지 로드 |
| `fnOnInitModeling` | 606 | `/WSLANGU` 모델 구성 |
| `fnOnInitRendering` | 1691 | 전체 화면 렌더링 |
| `fnGetWorkSpaceTreeTable` | 1881 | 좌측 TreeTable |
| `fnGetSAPLogonListTable` | 2190 | 우측 Table + 컬럼/정렬 |
| `fnOnListupSapLogon` | 849 | 데이터 적재 진입 |
| `fnGetRegInfoForSAPLogon(Then)` | 878 / 908 | 레지스트리 SAPLogon 읽기 |
| `fnReadSAPLogonData(Then)` | 1422 / 1021 | XML 읽기·후처리 |
| `fnCheckSapguiVersion` | 1320 | SAPGUI 버전 체크 |
| `fnSetSAPLogonLandscapeList` | 1461 | `/ServerList` 빌드 |
| `fnCreateWorkspaceTree` / `fnWorkSpaceSort` | 2117 / 2141 | `/SAPLogon` 트리 빌드·정렬 |
| `fnPressWorkSpaceTreeItem` | 1943 | 트리 선택→우측 목록 갱신 |
| `_syncSavedServerInfo` | 2708 | 저장 정보 병합(ISSAVE) |
| `fnAttachRowsUpdateOnce` / `_findLastSelectedPath` | 662 / 754 | 마지막 선택 노드 복원 |
| `fnEditDialogOpen` / `fnPressSave` / `fnCheckValid` | 3180 / 3652 / 3799 | 등록·수정 |
| `fnPressDelete` | 3069 | 삭제 |
| `fnPressServerListItem` / `fnLoginPage` | 3879 / 5029 | 서버 실행/로그인 창 |
| `fnGetSavedServerListData(All)` | 3372 / 3425 | 저장 JSON 조회 |
| `ev_settingItemSelected` 외 팝업들 | 3962~ | 언어/테마/사운드/About |
| `oU4ASERV.createServer` | (net/index.js) | Named Pipe 연동 서버 |

## 부록 B. 상수/경로

- `SAPGUIVER = 7700` (최소 지원 버전), `POPID = "editPopup"`, `SERVER_TBL_ID = "serverlist_table"`, `BINDROOT = "/SAVEDATA"`.
- 저장 파일: `PATHINFO.SERVERINFO_V2` (= `serverInfo_v2.json`).
- 레지스트리: `SETTINGS.regPaths.saplogon`(SAPLogon), `HKCU\SOFTWARE\U4A\WS\GUIVer|GUIPath|cSession|LogonSettings`.
