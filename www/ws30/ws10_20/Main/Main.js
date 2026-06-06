/************************************************************************
 * Main.js — U4A Workspace 메인 페이지(WS10) 공통 기능
 * ----------------------------------------------------------------------
 *  - 화면(Main.html)에 대한 "공통 윈도우 기능"만 연결한다(로직 미연동 단계).
 *    · 타이틀바 창 제어: 최소화 / 최대화·복원 / 닫기
 *    · 최대화 상태에 따른 버튼 표시 갱신, 타이틀바 더블클릭 최대화/복원
 *    · 창 제목 / 줌 초기화
 *    · 로그오프(빨간 전원) 버튼 → 창 닫기(=세션 창 종료)
 *  - 메뉴/툴바/검색 등 업무 로직은 추후 단계.
 *  - parent(index.html)가 노출한 Electron 핸들(REMOTE/CURRWIN/WEBFRAME)을 사용.
 *    브라우저(비-Electron)에서 단독으로 열려도 안전하도록 모두 가드 처리.
 ************************************************************************/
(function () {
    "use strict";

    /* parent(index.html) Electron 핸들 — 없으면(브라우저 프리뷰) 전부 no-op */
    var P = (function () { try { return window.parent; } catch (_) { return null; } })();
    var REMOTE = null, CURRWIN = null, WEBFRAME = null;
    try { REMOTE = (P && P.REMOTE) || null; } catch (_) {}
    try { CURRWIN = (P && P.CURRWIN) || (REMOTE && REMOTE.getCurrentWindow && REMOTE.getCurrentWindow()) || null; } catch (_) {}
    try { WEBFRAME = (P && P.WEBFRAME) || null; } catch (_) {}

    function $(id) { return document.getElementById(id); }
    function on(id, fn) { var b = $(id); if (b) { b.addEventListener("click", fn); } }
    var isElectron = !!CURRWIN;

    /* 창 제어 버튼(최소화/최대화/닫기)·드래그는 공통 헤더(ws10_20/index.html)로 이동.
       이 페이지는 헤더 아래 영역만 그린다. */

    /* ── 로그오프(빨간 전원) → 창 닫기(세션 창 종료) ── */
    function _wireLogoff() {
        on("ws-logoff", function () { try { if (CURRWIN) { CURRWIN.close(); } } catch (_) {} });
    }

    /* 창 드래그는 ServerList 와 동일하게 CSS(-webkit-app-region: drag, 타이틀바)로 처리 → JS 불필요.
       (더블클릭 최대화/복원, 최대화 상태 드래그 복원이동 등은 OS/Chromium 이 app-region 으로 처리) */

    /* ── 시스템 메뉴 드롭다운 (정보 / 옵션) ── */
    function _wireSystemMenu() {
        var btn = $("ws-sys-btn"), menu = $("ws-sys-menu");
        if (!btn || !menu) { return; }

        function open() { menu.classList.remove("is-hidden"); btn.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); }
        function close() { menu.classList.add("is-hidden"); btn.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); }
        function toggle() { menu.classList.contains("is-hidden") ? open() : close(); }

        btn.addEventListener("click", function (e) { e.stopPropagation(); toggle(); });

        // 바깥 클릭 / Esc 로 닫기
        document.addEventListener("click", function (e) {
            if (menu.classList.contains("is-hidden")) { return; }
            if (e.target === btn || menu.contains(e.target)) { return; }
            close();
        });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") { close(); } });

        // '정보' 항목 → 버전/시스템 정보 팝업
        var info = $("ws-sys-info");
        if (info) { info.addEventListener("click", function () { close(); _openInfoPopup(); }); }

        // '옵션' 항목 → 옵션(테마 변경) 팝업
        var opt = $("ws-sys-options");
        if (opt) { opt.addEventListener("click", function () { close(); _openOptionsPopup(); }); }
    }

    /* ── 정보 팝업: Electron/로그인/WS 버전, 접속 SYSID 등 ── */
    function _esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
        });
    }
    function _v(fn) {
        try { var v = fn(); return (v === undefined || v === null || v === "") ? "-" : String(v); }
        catch (_) { return "-"; }
    }
    // 서버 주소에서 'http(s)://호스트:포트' 까지만 추출(경로/쿼리 등 비공개)
    function _hostOrigin(s) {
        if (s === undefined || s === null || s === "") { return "-"; }
        s = String(s).trim();
        var m = s.match(/^(https?:\/\/[^\/?#]+)/i);
        return m ? m[1] : s;
    }
    function _collectInfo() {
        var P = window.parent || {};
        var ui = {}, si = {}, pv = {};
        try { ui = P.getUserInfo() || {}; } catch (_) {}
        try { si = P.getServerInfo() || {}; } catch (_) {}
        try { pv = (P.process && P.process.versions) || {}; } catch (_) {}
        if (!pv.electron) { try { pv = (P.REMOTE && P.REMOTE.process && P.REMOTE.process.versions) || pv; } catch (_) {} }

        // 현재 WS(앱) 버전: 패키지면 app.getVersion(), 아니면 설정의 appVersion
        var sAppVer = _v(function () {
            var v = P.APP && P.APP.getVersion && P.APP.getVersion();
            try {
                var st = P.WSUTIL && P.WSUTIL.getWsSettingsInfo && P.WSUTIL.getWsSettingsInfo();
                if (st && (!P.APP.isPackaged) && st.appVersion) { v = st.appVersion; }
            } catch (_) {}
            return v;
        });

        // 로그인 시점 WS 버전 (+ 패치레벨)
        var sLoginVer = "-";
        if (ui.WSVER) {
            sLoginVer = String(ui.WSVER);
            if (ui.WSPATCH_LEVEL !== undefined && ui.WSPATCH_LEVEL !== null && Number(ui.WSPATCH_LEVEL) > 0) {
                sLoginVer += " (SP " + ui.WSPATCH_LEVEL + ")";
            }
        }

        return [
            ["U4A Workspace 버전", sAppVer],
            ["로그인 버전", sLoginVer],
            ["접속 SYSID", _v(function () { return si.SYSID || ui.SYSID; })],
            ["CLIENT", _v(function () { return ui.CLIENT || si.CLIENT; })],
            ["사용자 ID", _v(function () { return ui.ID || ui.UNAME; })],
            ["언어(LANGU)", _v(function () { return ui.LANGU || si.LANGU; })],
            ["서버(HOST)", _hostOrigin((function () { try { return si.HOST || (P.getServerPath && P.getServerPath()); } catch (_) { return ""; } })())],
            ["Electron", _v(function () { return pv.electron; })],
            ["Node.js", _v(function () { return pv.node; })],
            ["Chromium", _v(function () { return pv.chrome; })]
        ];
    }

    // 공용 모달 셸 생성 (head 아이콘+타이틀+X, body, foot 닫기). { back, close } 반환.
    function _modalShell(sTitle, sIconSvg, sBodyHtml) {
        var root = $("ws-modal-root");
        if (!root) { return null; }

        var back = document.createElement("div");
        back.className = "ws-modal-backdrop";
        back.innerHTML =
            '<div class="ws-modal" role="dialog" aria-modal="true" aria-label="' + _esc(sTitle) + '">' +
            '  <div class="ws-modal__head">' +
            '    <span class="ws-ico" aria-hidden="true">' + sIconSvg + '</span>' +
            '    <span class="ws-modal__title">' + _esc(sTitle) + '</span>' +
            '    <button type="button" class="ws-modal__close" aria-label="닫기">&#10005;</button>' +
            '  </div>' +
            '  <div class="ws-modal__body">' + sBodyHtml + '</div>' +
            '  <div class="ws-modal__foot"><button type="button" class="ws-modal__btn" data-close>닫기</button></div>' +
            '</div>';

        function close() {
            back.classList.remove("is-open");
            document.removeEventListener("keydown", onKey);
            window.setTimeout(function () { if (back.parentNode) { back.parentNode.removeChild(back); } }, 200);
        }
        function onKey(e) { if (e.key === "Escape") { close(); } }

        back.addEventListener("click", function (e) {
            if (e.target === back || e.target.closest("[data-close]") || e.target.closest(".ws-modal__close")) { close(); }
        });
        document.addEventListener("keydown", onKey);

        root.appendChild(back);
        window.requestAnimationFrame(function () { back.classList.add("is-open"); });

        return { back: back, close: close };
    }

    var _ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/></svg>';
    var _ICON_GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15z"/></svg>';

    function _openInfoPopup() {
        var rows = _collectInfo();
        var sList = rows.map(function (r, i) {
            var last = (i === rows.length - 1) ? "is-last" : "";
            return '<dt class="' + last + '">' + _esc(r[0]) + "</dt>" +
                   '<dd class="' + last + '">' + _esc(r[1]) + "</dd>";
        }).join("");
        _modalShell("정보", _ICON_INFO, '<dl class="ws-info-list">' + sList + '</dl>');
    }

    /* ── 옵션 팝업: 테마 변경(퍼플/다크/화이트) ── */
    var _THEMES = ["purple", "dark", "white"];

    // 이 창의 SYSID (ServerList 가 넣은 webPreferences.SYSID 우선 → serverInfo/userInfo)
    function _currentSysid() {
        var P = window.parent || {};
        try {
            var CW = P.REMOTE && P.REMOTE.getCurrentWindow && P.REMOTE.getCurrentWindow();
            var wp = CW && CW.webContents && CW.webContents.getWebPreferences && CW.webContents.getWebPreferences();
            if (wp && wp.SYSID) { return wp.SYSID; }
        } catch (_) {}
        try { var si = P.getServerInfo && P.getServerInfo(); if (si && si.SYSID) { return si.SYSID; } } catch (_) {}
        try { var ui = P.getUserInfo && P.getUserInfo(); if (ui && ui.SYSID) { return ui.SYSID; } } catch (_) {}
        return "";
    }

    // SYSID 기준 UX 테마를 userData 공유 JSON 에 저장 → ServerList 가 다음 접속 때 읽어 적용.
    //   파일: <userData>/u4a-ws/uxThemeBySysid.json  ({ "<SYSID>": "<theme>" })
    function _saveSysidUxTheme(theme) {
        try {
            var P = window.parent || {};
            var sysid = _currentSysid();
            if (!sysid) { return; }
            var FS = P.FS, PATH = P.PATH, APP = P.APP;
            if (!FS || !PATH || !APP || !APP.getPath) { return; }
            var dir = PATH.join(APP.getPath("userData"), "u4a-ws");
            var file = PATH.join(dir, "uxThemeBySysid.json");
            var obj = {};
            try { if (FS.existsSync(file)) { obj = JSON.parse(FS.readFileSync(file, "utf8")) || {}; } } catch (_) { obj = {}; }
            obj[sysid] = theme;
            try { if (!FS.existsSync(dir)) { FS.mkdirSync(dir, { recursive: true }); } } catch (_) {}
            FS.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
        } catch (_) {}
    }

    // 같은 SYSID 의 다른 열린 창들(로그인/메인)에 테마 실시간 동기화.
    //   각 창(index.html)은 IPC 'u4a-ws-ux-theme' 수신 → _applyUxThemeToLogin 로 적용(ServerList 가 쓰는 채널 재사용).
    //   대상 식별 = webPreferences.SYSID 일치(ServerList 윈도우는 SYSID 없어 자동 제외), 자기 자신 제외.
    function _broadcastSysidTheme(theme) {
        try {
            var P = window.parent || {};
            var REMOTE = P.REMOTE;
            if (!REMOTE || !REMOTE.BrowserWindow || !REMOTE.BrowserWindow.getAllWindows) { return; }
            var sysid = _currentSysid();
            if (!sysid) { return; }
            var selfId = -1;
            try { selfId = REMOTE.getCurrentWindow().id; } catch (_) {}
            var wins = REMOTE.BrowserWindow.getAllWindows() || [];
            wins.forEach(function (w) {
                try {
                    if (!w || w.isDestroyed() || w.id === selfId) { return; }
                    var wc = w.webContents;
                    if (!wc) { return; }
                    var wp = wc.getWebPreferences ? wc.getWebPreferences() : (wc.getLastWebPreferences ? wc.getLastWebPreferences() : null);
                    if (wp && wp.SYSID === sysid) { wc.send("u4a-ws-ux-theme", theme); }
                } catch (_) {}
            });
        } catch (_) {}
    }

    function _applyTheme(t) {
        if (_THEMES.indexOf(t) < 0) { t = "purple"; }
        try { document.documentElement.setAttribute("data-theme", t); } catch (_) {}
        try { localStorage.setItem("u4a-ws-theme-v1", t); } catch (_) {}
        _saveSysidUxTheme(t);      // SYSID 기준 userData 영구 저장 (ServerList 접속 시 재사용)
        _broadcastSysidTheme(t);   // 같은 SYSID 의 다른 창들에 실시간 동기화
        // 호스트(index.html)의 배경/다른 프레임도 동일 테마로 갱신 (있으면)
        try { if (window.parent && typeof window.parent._applyUxThemeToLogin === "function") { window.parent._applyUxThemeToLogin(t); } } catch (_) {}
    }

    function _openOptionsPopup() {
        var cur = "purple";
        try { cur = document.documentElement.getAttribute("data-theme") || "purple"; } catch (_) {}

        var labels = { purple: "퍼플 (기본)", dark: "다크", white: "화이트" };
        var seg = _THEMES.map(function (t) {
            return '<button type="button" class="ws-seg__btn' + (t === cur ? " is-active" : "") +
                   '" data-theme-val="' + t + '" role="radio" aria-checked="' + (t === cur) + '">' + _esc(labels[t]) + '</button>';
        }).join("");

        var body =
            '<div class="ws-opt-field">' +
            '  <div class="ws-opt-label">테마</div>' +
            '  <div class="ws-seg" role="radiogroup" aria-label="테마">' + seg + '</div>' +
            '</div>';

        var m = _modalShell("옵션", _ICON_GEAR, body);
        if (!m) { return; }

        var segBtns = m.back.querySelectorAll(".ws-seg__btn");
        [].forEach.call(segBtns, function (b) {
            b.addEventListener("click", function () {
                _applyTheme(b.getAttribute("data-theme-val"));
                [].forEach.call(segBtns, function (x) {
                    var on = (x === b);
                    x.classList.toggle("is-active", on);
                    x.setAttribute("aria-checked", on);
                });
            });
        });
    }

    /* ── 초기화 ── */
    function _init() {
        try { if (CURRWIN && CURRWIN.setTitle) { CURRWIN.setTitle("U4A Workspace - Main"); } } catch (_) {}
        try { if (WEBFRAME && WEBFRAME.setZoomLevel) { WEBFRAME.setZoomLevel(0); } } catch (_) {}

        _wireLogoff();
        _wireSystemMenu();

        // Electron 환경 표식(스타일 분기 필요 시 사용)
        if (isElectron) { document.documentElement.setAttribute("data-electron", "1"); }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", _init);
    } else {
        _init();
    }

})();
