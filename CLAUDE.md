# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개요

U4A Workspace(`com.u4a_ws3.app`, productName "U4A Workspace") — U4A Solution R&D 팀이 만든
Windows용 Electron 데스크톱 앱(SAP/웹 환경 통합 개발 IDE). Electron 14, CommonJS 기반이며
프런트엔드 빌드 단계가 없다. 렌더러는 순수 HTML/JS 와 대규모 레거시 SAPUI5 앱으로 구성된다.
주석과 커밋 메시지는 한글이다.

## 명령어

```powershell
npm start            # 개발 모드 실행 (electron .)
npm run build        # postinstall(네이티브 의존성 리빌드) + build:win
npm run build:win    # electron-builder --win --x64  → dist/U4A-Workspace-Setup-<version>.exe
npm run postinstall  # electron-builder install-app-deps (better-sqlite3 등 리빌드)
```

**테스트 러너 없음**(`npm test` 는 스텁), **린터 없음**. 네이티브 모듈(`better-sqlite3`,
`regedit` 등)은 `electron-rebuild` 가 필요하므로 설치 후 `npm run postinstall` 을 실행한다.

디버깅: 환경 변수 `WS_REMOTE_DEBUG_HOST`(URL)를 설정하면 `--remote-debugging-port` 가 켜진다.
개발 모드(`!app.isPackaged`)에서는 자식 창의 DevTools 가 자동으로 열린다.

## 런타임 / 보안 모델

SAP 서버와 직접 통신하는 신뢰된 데스크톱 클라이언트이므로 일반적인 웹 샌드박스는 의도적으로
꺼져 있다. `electron/main.js` 에서 `nodeIntegration: true`, `contextIsolation: false`,
`enableRemoteModule: true`, `webSecurity: false`, `--disable-web-security`,
`--ignore-certificate-errors`, `--no-sandbox` 를 설정하고 `SameSite` 쿠키를 `None` 으로
재작성한다. 렌더러 코드는 `require(...)` 와 `@electron/remote` 를 자유롭게 사용한다. 즉,
**렌더러 파일은 브라우저 샌드박스가 아니라 Node 환경**이라는 점을 항상 염두에 둘 것.

`userData` 는 `app.whenReady()` **이전에** `AppData/Roaming/<appName>` 으로 고정된다(미패키징
시 `.dev` 접미사) — `main.js` 상단 참고. 개인화(p13n), 설정, 테마, SQLite 메시지 DB 가 모두
이 경로 기준으로 해석된다.

## 부트 / 창 흐름

다중 창 앱이다. 각 서버 접속은 자체 `BrowserWindow` 를 열며, 해당 창의 `webPreferences` 에
저장된 `SYSID` 로 식별된다.

1. `main.js` → `www/intro3.html` 로드(스플래시; 로직은 `www/intro.js`).
2. `intro.js` 가 **ServerList** 창을 연다(`www/ServerList_v2/` — `serverlist.ui.js` +
   `serverlist.data.js`; 구버전 `www/_ServerList_v2/` 는 백업).
3. 서버를 더블클릭하면 **호스트 창**(`www/ws30/ws10_20/index.html`)이 열리며, `SYSID`,
   창별 `partition`(세션 격리), 접속 키를 `webPreferences` 와 URL 쿼리로 전달한다. 이후
   여는 쪽이 SERVERINFO / USERINFO / 세션 키 / 테마를 담은 **`if-meta-info`** IPC 메시지를
   보낸다.
4. `www/ws30/ws10_20/index.js` 가 **호스트 라우터**다. `if-meta-info` 수신 시 분기한다:
   - 로그인 정보 없음 → **Login** iframe(`Login/Login.html`) 로드
   - 로그인 정보 있음 → **Main** iframe(`Main/Main.html`) 로드
5. 로그인 성공 시 `Login.js` 가 `parent.oAPP.views.VW_MAIN.fn.loadWS30MainPage()`(`index.js`
   에 정의)를 호출해 로그인 iframe 을 메인 iframe 으로 교체한다.

창 간 UX 상태(테마 `dark`/`white`/`purple`, 언어 `ko`/`en`)는 창을 열 때 URL 쿼리로 전달되고
IPC 채널 `u4a-ws-ux-theme` / `u4a-ws-ux-lang` 로 실시간 전파된다. 로그인/메인 창은 ServerList
의 글로벌 테마가 아니라 **SYSID 기준 저장 테마**(`<userData>/u4a-ws/uxThemeBySysid.json`)를
따른다.

## 공통 헤더 (단일 소스 — 프로젝트 메모리 참고)

`www/common/header/`(`u4a-header.js` + `u4a-header.css`)는 **모든** 창의 타이틀바와 창 제어
(최소화 / 최대화-복원 / 닫기)를 담당하는 **단일 소스**다. `U4AHeader.mount(elementId,
{ title, logo, onClose })` 로 마운트한다. 창 제어 아이콘이나 타이틀바 스타일을 바꾸려면 이 두
파일만 수정한다 — 창마다 복사본을 만들지 말 것.

창 드래그는 JS 가 아니라 최상위 헤더의 CSS `-webkit-app-region: drag` 로 OS 가 처리한다.
로그인↔메인 iframe 교체 후 Electron 의 드래그 영역 캐시가 stale 해지므로, `index.js` 가
`_kickHostDragRegion()`(1px 리사이즈 넛지)으로 강제 재계산한다.

## 레거시 SAPUI5 앱과 진행 중인 마이그레이션

실제 IDE 는 `www/ws30/ws10_20/js/` 에 대규모 SAPUI5 코드베이스로 존재한다: `ws_common.js`,
`ws_main.js`, `ws_fn_0X.js`, `ws_events*.js`, `ws_util.js`, 그리고 다수의 `fn*PopupOpen.js` /
`moduleAppF4Popup.js` 모듈. `js/mainAppBoot.js` 가 UI5 를 부트스트랩한다(UI5 로더와 충돌을
피하려고 Node 의 `require`/`module`/`exports` 를 먼저 격리). 팝업은
`www/ws30/ws10_20/Popups/` 아래에 있다.

SAPUI5 → 순수 HTML 마이그레이션이 진행 중이다. 마주치게 될 신호:
- 현재 부트 경로는 UI5(`_loadMainApp`/`mainAppBoot.js`)를 우회하고 정적 `Main.html` /
  `Login.html` iframe 을 렌더한다. `mainAppBoot.js` 는 참고용으로 보존되어 있다.
- `*.ui5.bak.html` / `*.ui5.bak.js` 는 마이그레이션 이전 원본이다(보존, 미로드).
- `_` 접두 디렉터리(`www/_ws30/`, `www/_ServerList_v2/`, `_backup_orig/`)와 `_` 접두 파일은
  **백업**이며 **빌드에서 제외된다**(`package.json` 의 `!www/**/_*.*`, `!www/**/_*/**`).
  배포될 거라 기대하고 백업을 수정하지 말 것.

## 경로와 메시지

- `www/ws30/resources/pathInfo.js` — 모든 파일/userData 경로의 중앙 레지스트리(LOGIN,
  MAINFRAME, 팝업 HTML, p13n/conf/pattern 루트 등). 경로를 하드코딩하지 말고 이를 통해 해석할
  것. 참고로 `main.js` 에서 `APP.getAppPath()` 는 항상 `.../www` 를 가리키도록 재정의된다.
- 메시지는 SQLite 기반이다: `electron/lib/msg/WsMsgClsService.js` 가 언어별
  `MessageDatabase` 인스턴스를 캐시하며 `global.WsMsgCls` 로 노출된다. 렌더러는
  `remote.getGlobal('WsMsgCls').getRow(langu, arbgb, msgnr)` 로 읽는다. DB 파일:
  `www/MSG/WS_COMMON/<lang>/MESSAGE_CLASS.db`.
- `www/ext_api/` 에는 SAP GUI 정보 조회, 호스트 연결 점검, 패치/서포트 패키지 업데이트에
  사용되는 PowerShell(`ps/`)·VBS 스크립트가 있다. NSIS 설치 훅: `ext_api/nsh/`.

## 컨벤션

- 전반적으로 한글 주석, `#region` 스타일 JSDoc 배너와 `@since/@author` 태그 사용.
- 렌더러 모듈은 보통 `(function(global){ "use strict"; ... })(window)` IIFE 와 방어적
  `try/catch (_) {}` 가드를 쓴다(창이 비-Electron 컨텍스트나 teardown 중에 로드될 수 있음).
- 패키징(`package.json` 의 `build`): asar, Windows NSIS 원클릭 per-user 설치 관리자, GitHub
  배포. `node_modules`, `U4A`, `regedit/vbs` 는 `extraResources` 로 동봉된다.
