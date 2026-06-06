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
function _setHostTitle(sText) {
    let el = document.getElementById("u4a-host-title");
    if (el) { el.textContent = sText; }
}

// 로그인/메인 iframe 이 들어갈 컨텐츠 영역. (구조 누락 시 body 로 안전 폴백)
function _getContentHost() {
    return document.getElementById("u4a-content") || document.body;
}

// 닫기: 현재 iframe(login/main)에 닫기 허용 신호(__prepareClose)를 준 뒤 창을 닫는다.
//  - 로그인 페이지는 onbeforeunload 가드(isPressWindowClose)가 있어 신호 없이는 닫히지 않음.
function _hostClose() {
    let f = document.getElementById("ws_login_frame") || document.getElementById("ws_main_frame");
    try {
        if (f && f.contentWindow && typeof f.contentWindow.__prepareClose === "function") {
            f.contentWindow.__prepareClose();
        }
    } catch (_) {}
    try { REMOTE.getCurrentWindow().close(); } catch (_) {}
}

function _wireHostHeader() {
    let CW = null;
    try { CW = REMOTE.getCurrentWindow(); } catch (_) {}
    if (!CW) { return; }

    let on = function (id, fn) { let b = document.getElementById(id); if (b) { b.addEventListener("click", fn); } };
    on("u4a-host-min", function () { try { CW.minimize(); } catch (_) {} });
    on("u4a-host-max", function () { try { CW.isMaximized() ? CW.unmaximize() : CW.maximize(); } catch (_) {} });
    on("u4a-host-close", function () { _hostClose(); });

    let _updMax = function () {
        let b = document.getElementById("u4a-host-max");
        if (!b) { return; }
        let bMax = false; try { bMax = CW.isMaximized(); } catch (_) {}
        b.title = bMax ? "Restore" : "Maximize";
        b.innerHTML = bMax ? "&#10697;" : "&#9633;";
    };
    try { CW.on("maximize", _updMax); CW.on("unmaximize", _updMax); } catch (_) {}
    _updMax();
}


/*************************************************************
 * 헤더 드래그 영역 강제 재계산 (진단/우회)
 * ----------------------------------------------------------
 *  증상: 로그인 → 메인 전환 후 공통 헤더(#u4a-host-titlebar) 드래그가
 *        먹지 않다가, 창을 최대화→복원하면(=리사이즈) 다시 동작.
 *
 *  로그인/메인은 동일한 부모 헤더를 드래그 영역으로 쓰고, 유일한 차이는
 *  그 아래 iframe(Login.html→Main.html) 이 로드 후 교체된다는 점뿐이다.
 *  "리사이즈하면 풀린다"는 관찰은 리사이즈가 트리거하는 무언가(드래그
 *  영역 재전송으로 추정)가 stale 했음을 뜻한다.
 *
 *  → 사용자가 손으로 하던 동작(리사이즈)을 코드로 그대로 재현한다:
 *    창 크기를 1px 늘렸다 즉시 되돌린다. 같은 tick 에서 원복하므로
 *    화면 깜빡임은 거의 없고, 리사이즈 이벤트는 OS 로 전달된다.
 *    이걸로 드래그가 복구되면 원인은 리사이즈로 풀리는 계열이 확정된다.
 *************************************************************/
function _kickHostDragRegion() {
    try {
        let win = REMOTE.getCurrentWindow();
        if (!win || win.isDestroyed()) { return; }
        if (win.isMaximized() || win.isFullScreen()) { return; }   // 이미 리사이즈 상태면 불필요
        let b = win.getBounds();
        win.setBounds({ x: b.x, y: b.y, width: b.width + 1, height: b.height });
        // 같은 tick 에서 원복하면 OS 가 변화없음으로 합쳐버릴 수 있어, 다음 틱에
        // 되돌려 '두 번의 분리된 리사이즈'를 보장한다(수동 최대화→복원과 동일).
        setTimeout(function () {
            try { if (!win.isDestroyed()) { win.setBounds(b); } } catch (_) {}
        }, 0);
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

        // 로그인 iframe 제거 → 메인 iframe 추가로 DOM 이 바뀌어 헤더 드래그 영역이
        // stale 해진다. 드래그 영역을 강제 재전송해 복구. (창 리사이즈 없이)
        _kickHostDragRegion();
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
