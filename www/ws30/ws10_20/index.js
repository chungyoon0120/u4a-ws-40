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

// 이 호스트 창의 SYSID. (ServerList 가 넣은 webPreferences.SYSID 우선 → 서버/유저 정보)
function _getHostSysid() {
    try {
        let wp = REMOTE.getCurrentWindow().webContents.getWebPreferences();
        if (wp && wp.SYSID) { return wp.SYSID; }
    } catch (_) {}
    try { let si = getServerInfo(); if (si && si.SYSID) { return si.SYSID; } } catch (_) {}
    try { let ui = getUserInfo();  if (ui && ui.SYSID) { return ui.SYSID; } } catch (_) {}
    return "";
}

// 같은 SYSID 로 떠있는 "다른" 창의 개수. (자기 자신 / 파괴된 창 제외)
//  - SYSID 없는 창(ServerList 등)은 매칭되지 않아 자동 제외된다.
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
                let wc = w.webContents;
                if (!wc) { continue; }
                let wp = wc.getWebPreferences ? wc.getWebPreferences()
                       : (wc.getLastWebPreferences ? wc.getLastWebPreferences() : null);
                if (wp && wp.SYSID === sSysid) { n++; }
            } catch (_) {}
        }
    } catch (_) {}
    return n;
}

// 실제 창 닫기: 현재 iframe(login/main)에 닫기 허용 신호(__prepareClose)를 준 뒤 창을 닫는다.
//  - 로그인 페이지는 onbeforeunload 가드(isPressWindowClose)가 있어 신호 없이는 닫히지 않음.
function _doHostClose() {
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

        // 로그인 단계(Login.js fnOnLoginCheckThen)에서 켜둔 busy/로딩 해제.
        //  - 원래 UI5 메인앱이 렌더 완료 후 껐으나, Main.html 로 대체되어 끄는 주체가 없으므로 여기서 해제.
        //  - showLoadingPage("X")=u4a_main_load, setDomBusy("X")=u4aWsBusyIndicator(3-dot)
        try { if (typeof setDomBusy === "function") { setDomBusy(""); } } catch (_) {}
        try { if (typeof showLoadingPage === "function") { showLoadingPage(""); } } catch (_) {}
        try { if (typeof setBusy === "function") { setBusy(""); } } catch (_) {}

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
