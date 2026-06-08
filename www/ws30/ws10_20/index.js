/*************************************************************
 * index.js  (SAPUI5 -> HTML 변환: 진입 분기)
 * ----------------------------------------------------------
 *  서버리스트 더블클릭 → 이 index.html 실행 → if-meta-info 수신 →
 *  로그인 정보 유무로 분기.
 *
 *   - 로그인 정보 없음  → 로그인 페이지(Login/Login.html) iframe 로드   (UI5 미사용)
 *   - 로그인 정보 있음  → WS30 메인 앱 부트스트랩(js/mainAppBoot.js)      (UI5 — 추후 변환)
 *
 *  ※ 이 파일에는 UI5 로드 코드가 전혀 없다.
 *    UI5 부트스트랩은 메인 앱 경로에서만 js/mainAppBoot.js 를 동적 로드하여 수행한다.
 *  ※ 원본: index.ui5.bak.js
 *************************************************************/

/*************************************************************
 * UX 테마 (ServerList → 쿼리스트링으로 전달, 이후 IPC 로 실시간 갱신)
 *  - 로그인 창은 별도 BrowserWindow + 랜덤 partition 이라 localStorage 미공유.
 *    그래서 ServerList 가 창을 열 때 현재 테마를 URL(u4aTheme)로 전달하고,
 *    테마 변경 시에는 'u4a-ws-ux-theme' IPC 로 직접 전파한다.
 *************************************************************/
function _getUxThemeFromUrl() {
    try {
        var v = new URLSearchParams(window.location.search).get("u4aTheme");
        return (v === "dark" || v === "white" || v === "purple") ? v : "";
    } catch (_) { return ""; }
}
var __u4aUxTheme = _getUxThemeFromUrl();

/*************************************************************
 * UX 표시 언어 (ServerList 언어 따라가기) — 테마와 동일 메커니즘
 *************************************************************/
function _getUxLangFromUrl() {
    try {
        var v = new URLSearchParams(window.location.search).get("u4aLang");
        return (v === "ko" || v === "en") ? v : "";
    } catch (_) { return ""; }
}
var __u4aUxLang = _getUxLangFromUrl();

// 로그인 iframe 의 표시 언어 적용 (iframe 내부 Login.js 가 노출한 __applyLoginLang 호출)
//  - 메인(Main.html) 프레임은 아직 i18n 미적용(정적 한글)이라 호출부 없으면 무시됨.
function _applyUxLangToLogin(lang) {
    if (lang !== "ko" && lang !== "en") {
        return;
    }
    __u4aUxLang = lang;
    ["ws_login_frame", "ws_main_frame"].forEach(function (sId) {
        let oFrame = document.getElementById(sId);
        try {
            if (oFrame && oFrame.contentWindow && typeof oFrame.contentWindow.__applyLoginLang === "function") {
                oFrame.contentWindow.__applyLoginLang(lang);
            }
        } catch (_) { /* 아직 로드 전이면 무시 — iframe src 쿼리로 초기 언어 적용됨 */ }
    });
}

// ServerList 에서 언어 변경 시 실시간 전파 수신
IPCRENDERER.on("u4a-ws-ux-lang", (event, lang) => {
    _applyUxLangToLogin(lang);
});

// 테마별 기본 배경색 (공통 테마 --u4a-bg 와 동일)
function _uxThemeBg(theme) {
    return ({ purple: "#0f0818", dark: "#0b1118", white: "#eef2f7" })[theme] || "#0f0818";
}

// index 윈도우(로그인 iframe 컨테이너) + BrowserWindow 배경을 테마색으로.
//  → 창이 뜰 때 흰색 → 테마색으로 튀는 플래시 방지(자연스러운 연출)
function _applyIndexBg(theme) {
    let sBg = _uxThemeBg(theme);
    try {
        document.documentElement.style.background = sBg;
        if (document.body) { document.body.style.background = sBg; }
        REMOTE.getCurrentWindow().setBackgroundColor(sBg);
    } catch (_) {}
}

// 로드 시점에 즉시 배경 적용 (URL 로 전달된 테마 기준)
_applyIndexBg(__u4aUxTheme);

// 로그인/메인 iframe 에 테마 적용 (same-origin file:// 이므로 contentDocument 직접 접근 가능)
function _applyUxThemeToLogin(theme) {
    if (theme !== "dark" && theme !== "white" && theme !== "purple") {
        return;
    }
    __u4aUxTheme = theme;
    _applyIndexBg(theme);   // 컨테이너/창 배경도 함께 갱신
    try { document.documentElement.setAttribute("data-theme", theme); } catch (_) {}   // 공통 헤더(최상위) 테마
    ["ws_login_frame", "ws_main_frame"].forEach(function (sId) {
        let oFrame = document.getElementById(sId);
        try {
            if (oFrame && oFrame.contentDocument && oFrame.contentDocument.documentElement) {
                oFrame.contentDocument.documentElement.setAttribute("data-theme", theme);
            }
        } catch (_) { /* 아직 로드 전이면 무시 — iframe src 쿼리로 이미 초기 테마 적용됨 */ }
    });
}

// ServerList 에서 테마 변경 시 실시간 전파 수신
IPCRENDERER.on("u4a-ws-ux-theme", (event, theme) => {
    _applyUxThemeToLogin(theme);
});


/*************************************************************
 * 공통 헤더 (최상위 문서) — 창 제어 + 제목
 *  - iframe 안이 아니라 최상위 문서이므로 -webkit-app-region:drag 가
 *    Electron 버전 업그레이드 후에도 안정적으로 동작한다.
 *  - 창 버튼(최소화/최대화/닫기)을 여기서 직접 처리. 로그인/메인 iframe 은
 *    더 이상 자체 타이틀바를 두지 않는다.
 *************************************************************/
// 공통 헤더 컴포넌트 인스턴스 (U4AHeader.mount 결과). 창버튼/제목/드래그복구를 제공.
var __u4aHeader = null;

function _setHostTitle(sText) {
    if (__u4aHeader) { __u4aHeader.setTitle(sText); }
}

// 로그인/메인 iframe 이 들어갈 컨텐츠 영역. (구조 누락 시 body 로 안전 폴백)
function _getContentHost() {
    return document.getElementById("u4a-content") || document.body;
}


/*************************************************************
 * ★ 새 공통 busy 오버레이 (ServerList → 로그인 → 메인 전환 표시)
 * ----------------------------------------------------------
 *  - 기존 busy 는 이 호스트 셸에서 보이지 않았다:
 *      · #u4aWsBusyIndicator → 단순 "Loading…" 텍스트라 인지 불가
 *      · #u4a_main_load     → 애니메이션 CSS(frame.css)를 이 셸이 로드하지 않음
 *      · setBusy(UI5)       → UI5 미부팅 경로라 동작 안 함
 *    → #u4aHostBusy(자급자족 스피너) 하나로 대체한다.
 *  - 전환 잠금(__hostBusyLock): iframe 교체가 끝나기 전(특히 Login.js 가
 *    loadWS30MainPage() 직후 호출하는 showLoadingPage("")) 외부 hide 로 인해
 *    busy 가 조기에 사라지는 것을 막는다. 잠금 해제는 대상 iframe 의 load 에서만.
 *  - 기존 호출부(Login.js 의 parent.setDomBusy/showLoadingPage/setBusy)는
 *    아래에서 이 오버레이로 재정의되어 수정 없이 그대로 동작한다.
 *************************************************************/
var __hostBusyLock = false;

function _hostBusyEl() {
    return document.getElementById("u4aHostBusy");
}

// busy 표시. bLock=true 이면 전환 잠금(외부 hide 무시)까지 건다.
function _hostBusyShow(sText, bLock) {
    let el = _hostBusyEl();
    if (!el) { return; }
    try {
        let oText = el.querySelector(".u4a-busy__text");
        if (oText) { oText.textContent = (sText != null && sText !== "") ? sText : "Loading…"; }
    } catch (_) {}
    el.classList.add("is-show");
    el.setAttribute("aria-hidden", "false");
    if (bLock) { __hostBusyLock = true; }
}

// busy 숨김. 전환 잠금 중에는 bForce=true 일 때만 숨긴다.
function _hostBusyHide(bForce) {
    if (__hostBusyLock && bForce !== true) { return; }   // 전환 중 외부 hide 무시
    let el = _hostBusyEl();
    if (!el) { return; }
    el.classList.remove("is-show");
    el.setAttribute("aria-hidden", "true");
}

// 전환 완료(iframe load): 잠금 해제 + 강제 숨김.
function _hostBusyUnlockHide() {
    __hostBusyLock = false;
    _hostBusyHide(true);
}

/*************************************************************
 * 기존 busy API 재정의(단일 소스) — 호출부는 그대로, 표시만 새 오버레이로.
 *  ※ index.js 는 resources/index.js 보다 늦게 로드되므로 전역 함수가 덮어써진다.
 *    Login.js 등 iframe 은 parent.* 로 접근하므로 window 노출도 보장한다.
 *************************************************************/
function setDomBusy(bIsBusy)      { if (bIsBusy === "X") { _hostBusyShow(); } else { _hostBusyHide(); } }
function showLoadingPage(bIsShow) { if (bIsShow === "X") { _hostBusyShow(); } else { _hostBusyHide(); } }
function setBusy(bIsBusy)         { if (bIsBusy === "X") { _hostBusyShow(); } else { _hostBusyHide(); } }
try {
    window.setDomBusy = setDomBusy;
    window.showLoadingPage = showLoadingPage;
    window.setBusy = setBusy;
} catch (_) {}

// ★ to-be 공통: 창(webContents)의 URL 쿼리스트링을 객체로 파싱한다.
//  - Electron 업그레이드 후 BrowserWindow 의 getWebPreferences() 로 커스텀 값(SYSID/sessionKey 등)
//    추출이 불가해졌다. 대신 모든 창이 loadURL 시 쿼리스트링으로 실어보낸 값
//    (browserkey/sessionKey/OBJTY/SYSID)을 getURL() → QueryString.parse 로 읽는다.
//  - 동일 패턴: WSUTIL.getCheckAlreadyOpenWindow (ws_util.js)
function _parseWinQuery(wc) {
    try {
        if (wc && typeof wc.getURL === "function") {
            return WSUTIL.QueryString.parse(wc.getURL()) || {};
        }
    } catch (_) {}
    return {};
}

// 이 호스트 창의 SYSID. (창 URL 쿼리스트링의 SYSID 우선 → 서버/유저 정보 폴백)
function _getHostSysid() {
    try {
        let sSysid = _parseWinQuery(REMOTE.getCurrentWindow().webContents).SYSID;
        if (sSysid) { return sSysid; }
    } catch (_) {}
    try { let si = getServerInfo(); if (si && si.SYSID) { return si.SYSID; } } catch (_) {}
    try { let ui = getUserInfo();  if (ui && ui.SYSID) { return ui.SYSID; } } catch (_) {}
    return "";
}

// 같은 SYSID 로 떠있는 "다른" 창의 개수. (자기 자신 / 파괴된 창 제외)
//  - SYSID 없는 창(ServerList 등)은 매칭되지 않아 자동 제외된다.
//  - to-be: 각 창의 SYSID 는 webPreferences 가 아니라 창 URL 쿼리스트링에서 읽는다.
function _countOtherSameSysidWindows() {
    let n = 0;
    try {
        let sSysid = _getHostSysid();
        if (!sSysid) { return 0; }

        let iSelfId = -1;
        try { iSelfId = REMOTE.getCurrentWindow().id; } catch (_) {}

        let aWins = REMOTE.BrowserWindow.getAllWindows() || [];
        for (let i = 0; i < aWins.length; i++) {
            let w = aWins[i];
            try {
                if (!w || w.isDestroyed() || w.id === iSelfId) { continue; }
                if (_parseWinQuery(w.webContents).SYSID === sSysid) { n++; }
            } catch (_) {}
        }
    } catch (_) {}
    return n;
}

// 현재 창에 종속된(자식) 팝업 창들을 모두 닫는다. (레거시 fnChildWindowAllClose 동일)
//  - to-be: Electron 네이티브 부모/자식 관계(getChildWindows) 사용 → getWebPreferences 불필요.
//  - ★ 향후 팝업을 BrowserWindow({ parent: 현재창 }) 로 띄우기만 하면 자동으로 여기에 수집되어
//    로그오프/닫기 시 함께 닫힌다. (Electron 도 부모가 닫히면 자식을 자동 종료하지만,
//    닫기 순서를 보장하기 위해 창을 닫기 전에 명시적으로 먼저 닫는다.)
function _closeChildWindows() {
    try {
        let oCurrWin = REMOTE.getCurrentWindow();
        if (!oCurrWin || oCurrWin.isDestroyed()) { return; }
        let aChild = oCurrWin.getChildWindows() || [];
        for (let i = 0; i < aChild.length; i++) {
            let oChild = aChild[i];
            try { if (oChild && !oChild.isDestroyed()) { oChild.close(); } } catch (_) {}
        }
    } catch (_) {}
}

// 실제 창 닫기: 종속 팝업을 먼저 닫고, 현재 iframe(login/main)에 닫기 허용 신호(__prepareClose)를
// 준 뒤 창을 닫는다. (로그오프/닫기 버튼/세션 종료 등 모든 닫기 경로가 이 함수를 거친다)
//  - 로그인 페이지는 onbeforeunload 가드(isPressWindowClose)가 있어 신호 없이는 닫히지 않음.
function _doHostClose() {
    // 종속(자식) 팝업 창들을 먼저 닫는다. (모든 닫기 경로 공통)
    _closeChildWindows();

    let f = document.getElementById("ws_login_frame") || document.getElementById("ws_main_frame");
    try {
        if (f && f.contentWindow && typeof f.contentWindow.__prepareClose === "function") {
            f.contentWindow.__prepareClose();
        }
    } catch (_) {}
    try { REMOTE.getCurrentWindow().close(); } catch (_) {}
}

// 닫기 진입점:
//  - 로그인 페이지: 종전대로 바로 닫는다(세션 진입 전이므로 종료 확인 없음).
//  - 메인 페이지: 같은 SYSID 의 다른 창이 하나라도 있으면 바로 닫고,
//    이 창이 해당 SYSID 의 "마지막 창"이면 메인 프레임의 스타일 종료 확인 팝업을 띄운다.
function _hostClose() {

    let oMainFrame = document.getElementById("ws_main_frame");

    // 메인 페이지(로그인 이후) + 같은 SYSID 가 이 창 하나뿐 → 종료 확인 팝업
    if (oMainFrame && _countOtherSameSysidWindows() === 0) {
        try {
            // 메인 프레임(Main.js)의 스타일 모달로 확인. 종료 선택 시 콜백으로 실제 닫기.
            if (oMainFrame.contentWindow && typeof oMainFrame.contentWindow.__confirmExit === "function") {
                let bShown = oMainFrame.contentWindow.__confirmExit(function () { _doHostClose(); });
                if (bShown) {
                    return;   // 팝업 표시됨 — 닫기는 콜백에서 처리(취소 시 닫지 않음)
                }
            }
        } catch (_) {}
        // 폴백: 팝업 함수를 못 쓰면 그냥 닫는다.
        _doHostClose();
        return;
    }

    _doHostClose();
}


/*************************************************************
 * 로그오프 (메인 화면 빨간 전원 버튼 → Main.js 가 parent.__hostLogout() 호출)
 * ----------------------------------------------------------
 *  레거시 oAPP.events.ev_Logout 와 동일한 순서/규약:
 *    1) 같은 sessionKey 의 "다른" 창들에 닫기 전파 (채널 if-browser-close, ACTCD "A")
 *    2) SAP 백엔드 로그오프 (navigator.sendBeacon → <serverPath>/logoff)
 *    3) 비콘 후 내 창 닫기
 *  ※ to-be: 각 창의 sessionKey/browserKey 는 webPreferences 가 아니라
 *           창 URL 쿼리스트링(_parseWinQuery)에서 읽는다.
 *  ※ 전파 transport: 레거시의 remote-ipcMain 공유리스너 대신, 이 프로젝트의 테마 동기화와
 *     동일하게 [대상 창 webContents.send] + [수신측 IPCRENDERER.on] 방식을 사용한다.
 *************************************************************/

// 이 호스트 창의 sessionKey (창 URL 쿼리스트링 우선 → 저장값 폴백)
function _getHostSessionKey() {
    try { let k = _parseWinQuery(REMOTE.getCurrentWindow().webContents).sessionKey; if (k) { return k; } } catch (_) {}
    try { let k = getSessionKey(); if (k) { return k; } } catch (_) {}
    return "";
}

// 이 호스트 창의 browserKey (창 URL 쿼리스트링 우선 → 저장값 폴백)
function _getHostBrowserKey() {
    try { let k = _parseWinQuery(REMOTE.getCurrentWindow().webContents).browserkey; if (k) { return k; } } catch (_) {}
    try { let k = getBrowserKey(); if (k) { return k; } } catch (_) {}
    return "";
}

// SAP 백엔드 로그오프 (레거시 sendServerExit 동일: navigator.sendBeacon fire-and-forget).
//  - URL: getServerPath() + "/logoff" (+ APPID/SSID 쿼리). 비콘 후 약간의 지연을 두고 콜백.
function _sendServerLogoff(fnCallback) {
    let bSent = false;
    try {
        let sUrl = getServerPath() + "/logoff";

        let sAppId = "";
        try { let a = getAppInfo(); if (a && a.APPID) { sAppId = a.APPID; } } catch (_) {}

        let sSsid = "";
        try { sSsid = getSSID() || ""; } catch (_) {}

        let aQs = [];
        if (sAppId) { aQs.push("APPID=" + encodeURIComponent(sAppId)); }
        if (sSsid)  { aQs.push("SSID="  + encodeURIComponent(sSsid)); }
        let sBeaconUrl = aQs.length ? (sUrl + "?" + aQs.join("&")) : sUrl;

        if (navigator && typeof navigator.sendBeacon === "function") {
            navigator.sendBeacon(sBeaconUrl);
            bSent = true;
        }
    } catch (_) {}

    // 비콘은 fire-and-forget 이므로 서버 반영 시간을 약간 준 뒤 닫는다(레거시 fnSleep(500) 동일).
    setTimeout(function () {
        try { if (typeof fnCallback === "function") { fnCallback(); } } catch (_) {}
    }, bSent ? 500 : 0);
}

// 로그오프 진입점 (Main.js 의 빨간 전원 버튼 → parent.__hostLogout()).
function __hostLogout() {

    let sSessKey  = _getHostSessionKey();
    let sBrowsKey = _getHostBrowserKey();

    // 1) 같은 세션의 "다른" 창들에 닫기 전파 (if-browser-close / ACTCD "A")
    try {
        let iSelfId = -1;
        try { iSelfId = REMOTE.getCurrentWindow().id; } catch (_) {}

        let aWins = REMOTE.BrowserWindow.getAllWindows() || [];
        for (let i = 0; i < aWins.length; i++) {
            let w = aWins[i];
            try {
                if (!w || w.isDestroyed() || w.id === iSelfId) { continue; }
                let wc = w.webContents;
                if (!wc || typeof wc.send !== "function") { continue; }
                if (_parseWinQuery(wc).sessionKey !== sSessKey) { continue; }   // 같은 세션만
                wc.send("if-browser-close", { ACTCD: "A", SESSKEY: sSessKey, BROWSKEY: sBrowsKey });
            } catch (_) {}
        }
    } catch (_) {}

    // 2) SAP 로그오프 → 3) 비콘 후 내 창 닫기
    _sendServerLogoff(function () { _doHostClose(); });
}

// 같은 세션 창 닫기 수신 (레거시 fnIpcMain_if_browser_close 규약 동일).
//  - ACTCD "A": 보낸 창 제외, 같은 세션이면 내 창 닫기
//  - ACTCD "B": 전달된 browserKey 가 나와 같을 때만 내 창 닫기
function _onIpcBrowserClose(event, res) {
    try {
        if (!res || res.SESSKEY !== _getHostSessionKey()) { return; }   // 다른 세션이면 무시

        let sMyBrowsKey = _getHostBrowserKey();

        if (res.ACTCD === "A") {
            if (sMyBrowsKey && sMyBrowsKey === res.BROWSKEY) { return; }   // 보낸 창(나)은 제외
            _doHostClose();
        } else if (res.ACTCD === "B") {
            if (sMyBrowsKey !== res.BROWSKEY) { return; }
            _doHostClose();
        }
    } catch (_) {}
}

function _wireHostHeader() {
    if (typeof U4AHeader === "undefined" || !U4AHeader.mount) {
        try { zconsole.warn("_wireHostHeader", "U4AHeader 미로드 — 공통 헤더 컴포넌트 확인 필요"); } catch (_) {}
        return;
    }
    // 공통 헤더 단일 소스로 렌더 + 창제어 연결. 닫기는 호스트 전용 _hostClose 사용.
    __u4aHeader = U4AHeader.mount("u4a-host-titlebar", {
        title:   "U4A Workspace",
        logo:    "../../img/logo.png",
        onClose: _hostClose
    });
}


/*************************************************************
 * ★ 드래그 영역 재계산 (iframe 교체 후 stale 우회)
 * ----------------------------------------------------------
 *  증상: 로그인→메인 iframe 교체 후 공통 헤더(#u4a-host-titlebar)의
 *        -webkit-app-region 드래그가 안 먹다가, 창을 최대화 한번 하면 풀린다.
 *  원인: iframe DOM 교체로 Electron 의 드래그 영역 캐시가 stale.
 *  해결: 창을 1px 살짝 키웠다 두 프레임 뒤 원복 → OS 에 '분리된 리사이즈'를
 *        흘려 드래그 영역을 강제 재계산 (수동 최대화→복원과 동일 효과).
 *  ※ _test 하니스에서 검증된 방식 그대로 이식.
 *************************************************************/
function _kickHostDragRegion() {
    try {
        let win = REMOTE.getCurrentWindow();
        if (!win || win.isDestroyed()) { return; }
        if (win.isMaximized() || win.isFullScreen()) { return; }   // 이미 리사이즈 상태면 불필요
        let b = win.getBounds();
        win.setBounds({ x: b.x, y: b.y, width: b.width + 1, height: b.height + 1 });
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                try { if (!win.isDestroyed()) { win.setBounds(b); } } catch (_) {}
            });
        });
    } catch (_) {}
}


/*************************************************************
 * 로그인 페이지(iframe) 로드 — UI5 미사용
 *************************************************************/
function _renderLoginShell() {

    // 전환 busy ON (잠금) — 로그인 iframe load 에서 해제. (ServerList → 로그인)
    _hostBusyShow("Loading…", true);

    let oContent = document.getElementById("content");
    if (oContent) {
        oContent.style.display = "none";
    }

    // 기존 로그인 프레임 제거 (재진입 대비)
    let oOld = document.getElementById("ws_login_frame");
    if (oOld) {
        oOld.parentNode.removeChild(oOld);
    }

    let oFrame = document.createElement("iframe");
    oFrame.id = "ws_login_frame";
    // 현재 UX 테마/언어를 쿼리로 전달 → 로그인 초기 렌더부터 즉시 적용 (무플래시)
    let aParams = [];
    if (__u4aUxTheme) { aParams.push("u4aTheme=" + encodeURIComponent(__u4aUxTheme)); }
    if (__u4aUxLang) { aParams.push("u4aLang=" + encodeURIComponent(__u4aUxLang)); }
    oFrame.src = "./Login/Login.html" + (aParams.length ? ("?" + aParams.join("&")) : "");
    oFrame.setAttribute("allow", "autoplay");
    // 컨텐츠 영역(.u4a-content)을 가득 채운다. 위치/크기는 컨테이너가 결정.
    oFrame.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%;border:0;");
    _setHostTitle("U4A Workspace - Login");
    // IPC 가 로드 전에 도착했을 수 있으니 로드 완료 후 한번 더 적용
    oFrame.addEventListener("load", function () {
        _applyUxThemeToLogin(__u4aUxTheme);
        _applyUxLangToLogin(__u4aUxLang);
        // 로그인 화면 준비 완료 → 전환 busy 해제
        _hostBusyUnlockHide();
        // iframe 교체 후 드래그 영역 재계산 (stale 우회)
        setTimeout(_kickHostDragRegion, 50);
    });

    _getContentHost().appendChild(oFrame);

} // end of _renderLoginShell


/*************************************************************
 * 메인 페이지(iframe) 로드 — UI5 미사용 (Main/Main.html, 화면만)
 *  - 로그인 페이지와 동일한 iframe 방식. 현재는 화면만(로직 미연동).
 *  - 기존 UI5 메인 앱(_loadMainApp/mainAppBoot.js)은 보존하되 호출하지 않음.
 *************************************************************/
function _renderMainShell() {

    // 전환 busy ON (잠금) — 메인 iframe load 에서 해제. (로그인 → 메인 / 재진입)
    //  ※ 잠금 덕분에 Login.js 가 loadWS30MainPage() 직후 호출하는 showLoadingPage("")
    //    로는 꺼지지 않고, 실제 메인 화면 로드 완료 시점에만 사라진다.
    _hostBusyShow("Loading…", true);

    let oContent = document.getElementById("content");
    if (oContent) {
        oContent.style.display = "none";
    }

    // 기존 로그인 프레임 제거
    let oLogin = document.getElementById("ws_login_frame");
    if (oLogin) {
        oLogin.parentNode.removeChild(oLogin);
    }

    // 기존 메인 프레임 제거 (재진입 대비)
    let oOld = document.getElementById("ws_main_frame");
    if (oOld) {
        oOld.parentNode.removeChild(oOld);
    }

    let oFrame = document.createElement("iframe");
    oFrame.id = "ws_main_frame";
    // 현재 UX 테마/언어를 쿼리로 전달 → 초기 렌더부터 즉시 적용 (무플래시)
    let aParams = [];
    if (__u4aUxTheme) { aParams.push("u4aTheme=" + encodeURIComponent(__u4aUxTheme)); }
    if (__u4aUxLang) { aParams.push("u4aLang=" + encodeURIComponent(__u4aUxLang)); }
    oFrame.src = "./Main/Main.html" + (aParams.length ? ("?" + aParams.join("&")) : "");
    oFrame.setAttribute("allow", "autoplay");
    // 컨텐츠 영역(.u4a-content)을 가득 채운다. 위치/크기는 컨테이너가 결정.
    oFrame.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%;border:0;");
    _setHostTitle("U4A Workspace - Main");
    // IPC 가 로드 전에 도착했을 수 있으니 로드 완료 후 한번 더 적용
    oFrame.addEventListener("load", function () {
        _applyUxThemeToLogin(__u4aUxTheme);
        _applyUxLangToLogin(__u4aUxLang);

        // 메인 화면 로드 완료 → 전환 busy 해제(잠금 해제 + 강제 숨김).
        //  - 원래 UI5 메인앱이 렌더 완료 후 껐으나, Main.html 로 대체되어 끄는 주체가
        //    없었다. 새 공통 오버레이를 여기서 확실히 해제한다.
        _hostBusyUnlockHide();

        // iframe 교체 후 드래그 영역 재계산 (stale 우회) — _test 검증 방식
        setTimeout(_kickHostDragRegion, 50);
    });

    _getContentHost().appendChild(oFrame);

} // end of _renderMainShell


/*************************************************************
 * WS30 메인 앱 부트스트랩 로더 — 필요 시에만 mainAppBoot.js(UI5) 동적 로드
 *  ※ 현재 부트 흐름에서는 호출하지 않음(Main.html 로 대체). 추후 로직 연동 시 참고용 보존.
 *************************************************************/
function _loadMainApp() {

    if (typeof window.__bootMainApp === "function") {
        window.__bootMainApp();
        return;
    }

    let oScript = document.createElement("script");
    oScript.src = "./js/mainAppBoot.js";
    oScript.onload = function () {
        if (typeof window.__bootMainApp === "function") {
            window.__bootMainApp();
        }
    };
    document.body.appendChild(oScript);

} // end of _loadMainApp


/*************************************************************
 * 로그인 성공 후 메인 앱으로 전환
 *  - Login.js 가 parent.oAPP.views.VW_MAIN.fn.loadWS30MainPage() 로 호출
 *************************************************************/
function loadWS30MainPage() {

    let oFrame = document.getElementById("ws_login_frame");
    if (oFrame) {
        oFrame.parentNode.removeChild(oFrame);
    }

    // UI5 메인 앱(_loadMainApp) 대신 Main.html 화면 표시 (UI5 제거, 화면만)
    _renderMainShell();

} // end of loadWS30MainPage

// Login.js 호환 API (기존 호출부 유지)
oAPP.views = oAPP.views || {};
oAPP.views.VW_MAIN = { fn: { loadWS30MainPage: loadWS30MainPage } };
window.loadWS30MainPage = loadWS30MainPage;

// 공통 헤더 창버튼 연결 (index.js 는 body 끝에서 로드되므로 헤더 DOM 이 이미 존재)
_wireHostHeader();

// 창이 뜬 직후부터 busy 표시(잠금) — if-meta-info 수신 후 로그인/메인 iframe 의
// load 에서 해제된다. (ServerList → 로그인 전환 시작 구간까지 빈 화면 노출 방지)
_hostBusyShow("Loading…", true);

// 메인 화면(Main.js) 빨간 전원 버튼이 호출하는 로그오프 진입점 공개
try { window.__hostLogout = __hostLogout; } catch (_) {}

// 같은 세션 창 닫기 전파 수신 (테마/언어 IPC 와 동일하게 IPCRENDERER.on 사용)
try { IPCRENDERER.on("if-browser-close", _onIpcBrowserClose); } catch (_) {}


/*************************************************************
 * Electron Event - 전달받은 Meta 정보를 저장하고 분기한다.
 *************************************************************/
IPCRENDERER.on('if-meta-info', (event, res) => {

    var oMetadata = res;

    // 메타데이터 정보
    if (oMetadata.METADATA) {
        setMetadata(oMetadata.METADATA);
    }

    // Default Browser 정보
    if (oMetadata.DEFBR) {
        parent.setDefaultBrowserInfo(oMetadata.DEFBR);
    }

    // 서버 정보
    if (oMetadata.SERVERINFO) {
        oWS.oServerInfo = oMetadata.SERVERINFO;
    }

    // 이전 서버 접속 정보
    if (oMetadata.BeforeServerInfo) {
        parent.setBeforeServerInfo(oMetadata.BeforeServerInfo);
    }

    // 로그인 유저 정보
    if (oMetadata.USERINFO) {
        setUserInfo(oMetadata.USERINFO);
    }

    // 브라우저 세션 키 정보
    if (oMetadata.SESSIONKEY) {
        setSessionKey(oMetadata.SESSIONKEY);
    }

    // 브라우저 키 정보
    if (oMetadata.BROWSERKEY) {
        setBrowserKey(oMetadata.BROWSERKEY);
    }

    // 테마정보
    if (oMetadata.THEMEINFO) {
        setThemeInfo(oMetadata.THEMEINFO);
    }

    // 새창 실행 후 IF 데이터가 있을 경우
    if (oMetadata.IF_DATA) {
        setNewBrowserIF_DATA(oMetadata.IF_DATA);
    }

    // 새창일 경우 process object에 USERINFO 정보를 저장한다.
    const
        CURRWIN = REMOTE.getCurrentWindow(),
        WEBCON = CURRWIN.webContents,
        WEBPREF = WEBCON.getWebPreferences(),
        USERINFO = WEBPREF.USERINFO;

    if (USERINFO) {
        setProcessEnvUserInfo(USERINFO);
    }

    // 타이틀 설정
    CURRWIN.setTitle("U4A Workspace - #Main");

    /*********************************************************
     * 🔀 분기: 로그인 정보 유무
     *********************************************************/
    let oUserInfo = getUserInfo();

    if (!oUserInfo) {
        // 로그인 정보 없음 → 로그인 페이지 (UI5 미사용)
        _renderLoginShell();
        return;
    }

    // 로그인 정보 있음 → 메인 페이지 (UI5 미사용, Main.html 화면만)
    _renderMainShell();

});
