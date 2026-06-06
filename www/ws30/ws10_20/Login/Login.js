/************************************************************************
 * Copyright 2020. INFOCG Inc. all rights reserved.
 * ----------------------------------------------------------------------
 * - file Name : Login.js
 * - file Desc : WS Login Page  (SAPUI5 -> 순수 HTML/JS 변환 버전)
 * ----------------------------------------------------------------------
 *  ⚠ 변환 메모
 *  - 뷰: UI5 App/Page/Card/Form  ->  Login.html 정적 DOM
 *  - 모델: sap JSONModel "/LOGIN" -> getLoginData()/setLoginData() (DOM 기준)
 *  - 다이얼로그: sap.m.MessageBox/Toast/Dialog -> toast()/openModal()
 *  - 백엔드/Node 로직(서버통신·권한·버전·테마·remember·SSO·IPC·단축키)은 보존
 *  - 보류(추후): 버전체크 상세 illust, 권한오류 테이블, 로그인오류 가이드 새창,
 *               스태프 빠른로그인, Trial 로그인  (핵심 흐름은 유지)
 *  - 원본: Login.ui5.bak.js
 ************************************************************************/
let oAPP = (function () {
    "use strict";

    const
        require = parent.require,
        REMOTE = parent.REMOTE,
        REMOTEMAIN = parent.REMOTEMAIN,
        CURRWIN = REMOTE.getCurrentWindow(),
        APPPATH = parent.APPPATH,
        PATH = parent.PATH,
        REGEDIT = parent.REGEDIT,
        APP = parent.APP,
        USERDATA = APP.getPath("userData"),
        FS = parent.FS,
        IPCMAIN = REMOTE.require("electron").ipcMain,
        PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js")),
        WSUTIL = require(PATHINFO.WSUTIL),
        autoUpdater = REMOTE.require("electron-updater").autoUpdater,
        autoUpdaterSAP = require(parent.getPath("AUTOUPDSAP")).autoUpdaterSAP,
        SERVPATH = parent.getServerPath(),
        autoUpdaterServerUrl = `${SERVPATH}/update_check`,
        OCTOKIT = REMOTE.require("@octokit/core").Octokit,
        WSLOG = require(PATH.join(PATHINFO.WS10_20_ROOT, "js", "ws_log.js")),
        GlobalShortCut = REMOTE.globalShortcut;

    let oAPP = {};
    oAPP.fn = {};
    oAPP.attr = {};
    oAPP.events = {};
    oAPP.msg = {};

    /* ==================================================================
       i18n — 로그인 페이지 표시 언어는 ServerList 언어(u4a-ws-lang-v1)를 따라간다.
       ① 초기: ServerList 가 창 열 때 URL(u4aLang)로 전달
       ② 실시간: ServerList 언어 변경 시 index.js 가 window.__applyLoginLang(lang) 호출
       (SAP 로그인 LANGUAGE / Workspace Language 값과는 별개의 'UI 표시 언어')
       ================================================================== */
    const LOGIN_I18N = {
        en: {
            app_title: "U4A Workspace - Login",
            card_title: "U4A Workspace Login",
            win_min: "Minimize", win_max: "Maximize", win_close: "Close",
            pw_toggle: "Show / Hide",
            lbl_client: "CLIENT", lbl_id: "ID", lbl_pw: "PASSWORD",
            lbl_langu: "LANGUAGE", lbl_wslangu: "Workspace Language",
            lbl_remember: "Remember", btn_login: "LOGIN"
        },
        ko: {
            app_title: "U4A Workspace - 로그인",
            card_title: "U4A Workspace 로그인",
            win_min: "최소화", win_max: "최대화", win_close: "닫기",
            pw_toggle: "표시 / 숨김",
            lbl_client: "클라이언트", lbl_id: "ID", lbl_pw: "비밀번호",
            lbl_langu: "언어", lbl_wslangu: "워크스페이스 언어",
            lbl_remember: "로그인 정보 저장", btn_login: "로그인"
        }
    };
    let LOGIN_LANG = "en";

    function _getLangFromUrl() {
        try {
            var v = new URLSearchParams(location.search).get("u4aLang");
            return (v === "ko" || v === "en") ? v : "";
        } catch (_) { return ""; }
    }

    function applyLoginI18n(lang) {
        if (lang !== "en" && lang !== "ko") {
            lang = LOGIN_LANG || "en";
        }
        LOGIN_LANG = lang;
        const dict = LOGIN_I18N[lang] || LOGIN_I18N.en;

        document.querySelectorAll("[data-i18n]").forEach(function (el) {
            const k = el.getAttribute("data-i18n");
            if (dict[k] != null) el.textContent = dict[k];
        });
        document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
            const k = el.getAttribute("data-i18n-title");
            if (dict[k] != null) el.setAttribute("title", dict[k]);
        });
        document.documentElement.lang = lang;
        try { parent.CURRWIN.setTitle(dict.app_title); } catch (_) {}
    }

    // index.js(상위 창)에서 ServerList 언어 변경 IPC 수신 시 호출
    window.__applyLoginLang = function (lang) { applyLoginI18n(lang); };

    // 버전체크/업데이트 진행 상태 (기존 UI5 모델 "/BUSYPOP" 대체)
    oAPP.attr.BUSYPOP = {
        TITLE: "", DESC: "", PROGVISI: false, PERVALUE: 0,
        PROGTXT: "", ILLUSTTYPE: "", ANIMATION: true
    };

    /* ==================================================================
       공용 헬퍼 (DOM / clone)
       ================================================================== */
    const $id = (id) => document.getElementById(id);
    const deepClone = (o) => JSON.parse(JSON.stringify(o));

    function isBlank(s) { return isEmpty(String(s == null ? "" : s).trim()); }
    function isEmpty(s) { return !String(s == null ? "" : s).length; }

    /* ==================================================================
       로고 경로 적용 (parent PATHINFO.WS_LOGO)
       ================================================================== */
    function _applyLogos() {
        try {
            const sLogo = "file:///" + String(PATHINFO.WS_LOGO).replace(/\\/g, "/");
            const t = $id("ws-titlebar-logo"); if (t) t.src = sLogo;
            const c = $id("ws-card-logo"); if (c) c.src = sLogo;
        } catch (_) { }
    }

    /* ==================================================================
       로그인 데이터 (기존 sap 모델 "/LOGIN" 대체)
       - 화면 입력값(DOM)을 source of truth 로 하고, 보조 데이터는 attr 에 보관
       ================================================================== */
    oAPP.attr.LOGIN = {
        CLIENT: "", ID: "", PW: "", LANGU: "", SYSID: "",
        WSLANGU: "EN", T_LANGU: [], IDSUGG: [], REMEMBER: false,
        SERVER_SETTINGS: undefined
    };

    // 현재 보여지고 있는 LANGUAGE 필드 (input | select)
    function _languMode() {
        if ($id("ws_langu_select_form").style.display !== "none") return "select";
        return "input"; // 기본
    }

    function _getLanguValue() {
        return (_languMode() === "select")
            ? ($id("ws_langu_select").value || "")
            : ($id("ws_langu").value || "");
    }

    function _setLanguValue(v) {
        if (_languMode() === "select") {
            $id("ws_langu_select").value = v || "";
        } else {
            $id("ws_langu").value = v || "";
        }
    }

    // 화면 -> 데이터 (sap getProperty("/LOGIN") 대체)
    function getLoginData() {
        const o = oAPP.attr.LOGIN;
        o.CLIENT = ($id("ws_client").value || "").trim();
        o.ID = ($id("ws_id").value || "").trim();
        o.PW = $id("ws_pw").value || "";
        o.LANGU = (_getLanguValue() || "").toUpperCase();
        o.WSLANGU = $id("ws_wslangu").value || "EN";
        o.REMEMBER = !!$id("ws_rem").checked;
        return o;
    }

    // 데이터 -> 화면 (sap setProperty("/LOGIN", x) 대체)
    function setLoginData(partial) {
        const o = oAPP.attr.LOGIN;
        Object.assign(o, partial || {});

        if (typeof o.CLIENT === "string") $id("ws_client").value = o.CLIENT;
        if (typeof o.ID === "string") $id("ws_id").value = o.ID;
        if (typeof o.PW === "string") $id("ws_pw").value = o.PW;
        if (typeof o.WSLANGU === "string") $id("ws_wslangu").value = o.WSLANGU;
        if (typeof o.LANGU === "string") _setLanguValue(o.LANGU);
        if (typeof o.REMEMBER === "boolean") $id("ws_rem").checked = o.REMEMBER;

        // 푸터 SYSID
        if (typeof o.SYSID === "string") {
            const el = $id("ws-foot-sysid");
            if (el) el.textContent = o.SYSID;
        }
    }

    /* ==================================================================
       필드 검증 상태 표시 (sap setValueState 대체)
       ================================================================== */
    function _markField(fieldId, sState, sMsg) {
        const wrap = $id(fieldId);
        if (!wrap) return;
        wrap.classList.remove("is-error", "is-info");
        const msgEl = wrap.querySelector(".ws-field__msg");
        if (sState === "Error") {
            wrap.classList.add("is-error");
            if (msgEl) msgEl.textContent = sMsg || "";
        } else if (sState === "Information") {
            wrap.classList.add("is-info");
            if (msgEl) msgEl.textContent = sMsg || "";
        } else if (msgEl) {
            msgEl.textContent = "";
        }
    }

    function _clearAllFieldStates() {
        ["ws-field-client", "ws-field-id", "ws-field-pw", "ws_langu_input_form", "ws_langu_select_form"]
            .forEach((id) => _markField(id, "None"));
    }

    // LANGUAGE 필드(보여지는 쪽) 래퍼 id
    function _languFieldWrapId() {
        return (_languMode() === "select") ? "ws_langu_select_form" : "ws_langu_input_form";
    }

    /* ==================================================================
       Busy / Content fade
       ================================================================== */
    function fadeInContent() {
        const el = $id("content");
        if (!el) return;
        el.style.opacity = "0";
        el.style.display = "flex";
        requestAnimationFrame(() => { el.style.opacity = "1"; });
    }

    function _showContentDom(bIsShow) {
        const el = $id("content");
        if (!el) return;
        if (bIsShow === "X") {
            el.style.display = "flex";
            el.style.opacity = "1";
        }
    }

    function _setCardOpacity(v) {
        const card = document.querySelector(".ws-login-card");
        if (card) card.style.opacity = String(v);
    }

    /* ==================================================================
       Toast / Modal (sap MessageToast / MessageBox 대체)
       ================================================================== */
    function toast(sMsg, bIsError) {
        const root = $id("ws-toast-root");
        if (!root) return;
        const t = document.createElement("div");
        t.className = "ws-toast" + (bIsError ? " is-error" : "");
        t.textContent = sMsg;
        root.appendChild(t);
        setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
    }

    /**
     * 공용 모달
     * @param {object} opts { title, body, isError, escapable, actions:[{label,kind,onClick}], onClose }
     * @return backdrop element
     */
    function openModal(opts) {
        opts = opts || {};
        const root = $id("ws-modal-root");
        const backdrop = document.createElement("div");
        backdrop.className = "ws-modal-backdrop";
        backdrop.innerHTML =
            `<div class="ws-modal" role="dialog" aria-modal="true">
                <div class="ws-modal__head${opts.isError ? " is-error" : ""}">
                    <div class="ws-modal__title"></div>
                </div>
                <div class="ws-modal__body"></div>
                <div class="ws-modal__foot"></div>
             </div>`;
        backdrop.querySelector(".ws-modal__title").textContent = opts.title || "";
        backdrop.querySelector(".ws-modal__body").textContent = opts.body || "";

        const foot = backdrop.querySelector(".ws-modal__foot");
        const aActions = opts.actions && opts.actions.length ? opts.actions : [{ label: "OK", kind: "ok" }];

        aActions.forEach((a) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "ws-btn" + (a.kind === "ok" ? " ws-btn--primary" : "");
            b.textContent = a.label;
            b.onclick = () => {
                closeModal(backdrop);
                if (typeof a.onClick === "function") a.onClick(a.label);
                if (typeof opts.onClose === "function") opts.onClose(a.label);
            };
            foot.appendChild(b);
        });

        if (opts.escapable !== false) {
            backdrop.addEventListener("mousedown", (e) => {
                if (e.target === backdrop) {
                    closeModal(backdrop);
                    if (typeof opts.onClose === "function") opts.onClose("__backdrop__");
                }
            });
        }

        root.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add("is-open"));
        return backdrop;
    }

    function closeModal(m) {
        if (!m) return;
        m.classList.remove("is-open");
        setTimeout(() => { if (m.parentNode) m.parentNode.removeChild(m); }, 200);
    }

    // 오류 메시지 박스 (간편)
    function _msgError(sMsg, opts) {
        return openModal(Object.assign({ title: "Error", body: sMsg, isError: true }, opts || {}));
    }
    function _msgWarning(sMsg, opts) {
        return openModal(Object.assign({ title: "Warning", body: sMsg }, opts || {}));
    }
    function _msgInfo(sMsg, opts) {
        return openModal(Object.assign({ title: "Information", body: sMsg }, opts || {}));
    }

    function _loginErrMsgBox(sMsg) {
        _msgError(sMsg);
    }

    /* ==================================================================
       버전 체크 다이얼로그 (간소화: 진행 모달) — 추후 illust 상세화
       ================================================================== */
    function openVersionDialog() {
        if ($id("ws-ver-modal")) { updateVersionDialog(); return; }
        const root = $id("ws-modal-root");
        const backdrop = document.createElement("div");
        backdrop.id = "ws-ver-modal";
        backdrop.className = "ws-modal-backdrop";
        backdrop.innerHTML =
            `<div class="ws-modal">
                <div class="ws-modal__head"><div class="ws-modal__title" id="ws-ver-title"></div></div>
                <div class="ws-modal__body">
                    <div id="ws-ver-desc"></div>
                    <div id="ws-ver-prog-wrap" style="display:none;margin-top:14px;">
                        <div style="height:8px;border-radius:6px;background:rgba(128,128,128,.25);overflow:hidden;">
                            <div id="ws-ver-prog" style="height:100%;width:0%;background:var(--u4a-accent-grad);transition:width .2s;"></div>
                        </div>
                        <div id="ws-ver-progtxt" style="margin-top:6px;font-size:12px;color:var(--u4a-text-soft);"></div>
                    </div>
                </div>
             </div>`;
        root.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add("is-open"));
        updateVersionDialog();
    }

    function updateVersionDialog() {
        const m = $id("ws-ver-modal");
        if (!m) return;
        const b = oAPP.attr.BUSYPOP;
        const t = $id("ws-ver-title"); if (t) t.textContent = b.TITLE || "";
        const d = $id("ws-ver-desc"); if (d) d.textContent = b.DESC || "";
        const pw = $id("ws-ver-prog-wrap"); if (pw) pw.style.display = b.PROGVISI ? "block" : "none";
        const p = $id("ws-ver-prog"); if (p) p.style.width = (b.PERVALUE || 0) + "%";
        const pt = $id("ws-ver-progtxt");
        if (pt) pt.textContent = (b.PROGTXT ? b.PROGTXT + "... " : "") + (b.PERVALUE || 0) + "%";
    }

    function setBusyPop(partial) {
        Object.assign(oAPP.attr.BUSYPOP, partial || {});
        updateVersionDialog();
    }

    /* ==================================================================
       서버 언어 메시지 (로그인 성공 후 META 에 첨부) — 원본 유지
       ================================================================== */
    function _serverMsgConfig(oMeta) {
        if (!oMeta.MSGCLS || Array.isArray(oMeta.MSGCLS) === false) {
            oMeta.MSGCLS = [];
        }
        let oUserInfo = parent.getUserInfo();
        let sLoginLangu = oUserInfo.LANGU;
        let oSettingsInfo = oAPP.fn.fnGetSettingsInfo();
        let oPath = oSettingsInfo.path;
        let sLanguPath = parent.PATH.join(oPath.WSMSG_ROOT, "WS_MSG", sLoginLangu, "U4AMSG_WS.json");
        if (parent.FS.existsSync(sLanguPath) === false) return;
        try {
            var sMsgStr = parent.FS.readFileSync(sLanguPath, "utf8");
            var aServMsg = JSON.parse(sMsgStr);
        } catch (error) { return; }
        oMeta.MSGCLS = aServMsg;
    }

    function _checkWLOListAsync(aWLO, REGTYP, CHGOBJ) {
        if (!aWLO || Array.isArray(aWLO) === false || aWLO.length === 0) return false;
        let oFind = aWLO.find(e => e.REGTYP === REGTYP && e.CHGOBJ === CHGOBJ);
        return !!oFind;
    }

    /* ==================================================================
       기본 실행 브라우저 목록 / 설치 브라우저 체크 — 원본 유지
       ================================================================== */
    oAPP.fn.getDefaultBrowserInfo = () => {
        let oSettingsInfo = parent.getSettingsInfo();
        return oSettingsInfo.aBrowserInfo;
    };

    oAPP.fn.fnCheckIstalledBrowser = () => {
        return new Promise((resolve) => {
            var aDefaultBrowsers = oAPP.fn.getDefaultBrowserInfo(),
                iBrowsCnt = aDefaultBrowsers.length;
            var aPromise = [];
            for (var i = 0; i < iBrowsCnt; i++) {
                aPromise.push(oAPP.fn.fnGetBrowserInfoPromise(aDefaultBrowsers, i));
            }
            Promise.all(aPromise).then((aValues) => {
                parent.setDefaultBrowserInfo(aValues);
                resolve();
            });
        });
    };

    oAPP.fn.fnGetBrowserInfoPromise = (aDefaultBrowsers, index) => {
        var oDefBrows = aDefaultBrowsers[index],
            sRegPath = oDefBrows.REGPATH,
            sRegPath2 = oDefBrows.REGPATH2;

        return new Promise(async (resolve) => {
            let oRETURN = Object.assign({}, aDefaultBrowsers[index]);
            if (!sRegPath && !sRegPath2) { resolve(oRETURN); return; }

            let oBrowsInstResult = await parent.WSUTIL.getRegeditList([sRegPath, sRegPath2]);
            if (oBrowsInstResult.RETCD == "E") { resolve(oRETURN); return; }

            let oBrowsInstData = oBrowsInstResult.RTDATA,
                oCheckHKCU = oBrowsInstData[sRegPath2];

            if (oCheckHKCU.exists) {
                var oExePathObj = oCheckHKCU.values[""];
                if (oExePathObj != null) { oRETURN.INSPATH = oExePathObj.value; resolve(oRETURN); return; }
            }

            let oCheckHKLM = oBrowsInstData[sRegPath];
            if (oCheckHKLM.exists) {
                var oExePathObj2 = oCheckHKLM.values[""];
                if (oExePathObj2 != null) { oRETURN.INSPATH = oExePathObj2.value; resolve(oRETURN); return; }
            }
            resolve(oRETURN);
        });
    };

    /* ==================================================================
       WS 설정 정보 — 원본 유지
       ================================================================== */
    oAPP.fn.fnGetSettingsInfo = () => WSUTIL.getWsSettingsInfo();

    /* ==================================================================
       (제거) UI5 bootstrap / IllustrationPool / FioriIconPool
       ================================================================== */

    /* ==================================================================
       비밀번호 show/hide & CapsLock — DOM 기반
       ================================================================== */
    function _wirePasswordToggle() {
        const pw = $id("ws_pw");
        const btn = $id("ws_pw_toggle");
        if (!pw || !btn) return;
        btn.onclick = () => {
            const isPw = pw.type === "password";
            pw.type = isPw ? "text" : "password";
            btn.classList.toggle("is-on", isPw);
            pw.focus();
        };
        const capsCheck = (e) => {
            _markField("ws-field-pw", "None");
            let isCaps = false;
            try { isCaps = e.getModifierState && e.getModifierState("CapsLock"); } catch (_) { }
            if (isCaps) _markField("ws-field-pw", "Information", "Caps lock is switched on.");
        };
        pw.addEventListener("keydown", capsCheck);
        pw.addEventListener("mousedown", capsCheck);
        pw.addEventListener("focusout", () => _markField("ws-field-pw", "None"));
    }

    /* ==================================================================
       Enter 로그인 / 입력 이벤트
       ================================================================== */
    function _wireFormEvents() {
        const submitOnEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); oAPP.events.ev_login(); } };
        ["ws_client", "ws_id", "ws_pw", "ws_langu", "ws_langu_select", "ws_wslangu"].forEach((id) => {
            const el = $id(id);
            if (el) el.addEventListener("keydown", submitOnEnter);
        });
        // LANGUAGE input 은 대문자 강제
        const langu = $id("ws_langu");
        if (langu) langu.addEventListener("change", () => { langu.value = (langu.value || "").toUpperCase(); });

        const btn = $id("ws_loginBtn");
        if (btn) btn.onclick = () => oAPP.events.ev_login();

        const tgl = $id("ws_pw_toggle"); // (별도 와이어)
        void tgl;
    }

    /* ==================================================================
       창 제어 버튼
       ================================================================== */
    function _wireWindowButtons() {
        const on = (id, fn) => { const b = $id(id); if (b) b.onclick = fn; };
        on("ws-win-min", () => CURRWIN.minimize());
        on("ws-win-max", () => { CURRWIN.isMaximized() ? CURRWIN.unmaximize() : CURRWIN.maximize(); });
        on("ws-win-close", () => { oAPP.attr.isPressWindowClose = "X"; CURRWIN.close(); });
    }

    /* ==================================================================
       초기 데이터 바인딩 (sap fnOnInitModelBinding 대체)
       ================================================================== */
    oAPP.fn.fnOnInitModelBinding = () => {
        let oUserInfo = parent.getUserInfo(),
            oServerInfo = parent.getServerInfo(),
            bIsRemember = oAPP.fn.fnGetRememberCheck(),
            oRememberInfo = oAPP.fn.fnGetRememberLoginInfo();

        if (oUserInfo) {
            parent.setUserInfo(null);
            parent.setServerInfo(parent.getBeforeServerInfo());
            oServerInfo = parent.getServerInfo();
        }

        let sClient = (bIsRemember ? (oRememberInfo && oRememberInfo.CLIENT) || "" : oServerInfo.CLIENT);
        let sLangu = (bIsRemember ? (oRememberInfo && oRememberInfo.LANGU) || "" : oServerInfo.LANGU);
        let sId = (bIsRemember ? (oRememberInfo && oRememberInfo.ID) || "" : "");
        let sWsLangu = (bIsRemember ? (oRememberInfo && oRememberInfo.WSLANGU) || "" : "");

        let aIDSugg = oAPP.fn.fnReadIDSuggData();

        oAPP.attr.LOGIN = {
            CLIENT: sClient || "",
            ID: sId || "",
            PW: "",
            LANGU: sLangu || "",
            SYSID: oServerInfo.SYSID || "",
            WSLANGU: sWsLangu || "EN",
            T_LANGU: [],
            REMEMBER: !!bIsRemember,
            IDSUGG: aIDSugg || [],
            SERVER_SETTINGS: oServerInfo.SETTINGS
        };

        // 화면 반영
        setLoginData(oAPP.attr.LOGIN);

        // ID Suggestion datalist
        _renderIdSuggestions(aIDSugg);
    };

    function _renderIdSuggestions(aIDSugg) {
        const dl = $id("ws_id_sugg");
        if (!dl) return;
        dl.innerHTML = "";
        (aIDSugg || []).forEach((it) => {
            const opt = document.createElement("option");
            opt.value = it && it.ID != null ? it.ID : it;
            dl.appendChild(opt);
        });
    }

    /* ==================================================================
       로그인 버튼 클릭 — 원본 ev_login 유지 (UI 터치포인트만 교체)
       ================================================================== */
    oAPP.events.ev_login = (oPARAM) => {

        parent.setDomBusy("X");

        let oLogInData = getLoginData();
        if (oLogInData == null) {
            parent.setDomBusy("");
            _showContentDom("X");
            return;
        }

        // SSO 가 아닐 경우에만 입력값 체크
        if (typeof oPARAM?.SSO_TICKET === "undefined") {
            var oResult = oAPP.fn.fnLoginCheck(oLogInData.ID, oLogInData.PW, oLogInData.CLIENT, oLogInData.LANGU);
            if (oResult.RETCD == "E") {
                toast(oResult.MSG, true);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }
        }

        // Remember / ID 저장
        oAPP.fn.fnSaveRemember(oLogInData);
        oAPP.fn.fnSaveIDSuggData(oLogInData.ID);

        let oSettings = WSUTIL.getWsSettingsInfo();
        var sServicePath = parent.getServerPath() + "/wsloginchk";
        var oFormData = new FormData();

        if (typeof oPARAM?.SSO_TICKET === "undefined") {
            oFormData.append("sap-user", oLogInData?.ID);
            oFormData.append("sap-password", oLogInData?.PW);
            oFormData.append("sap-client", oLogInData?.CLIENT);
        }

        oFormData.append("sap-language", oLogInData?.LANGU);
        oFormData.append("SYSID", oLogInData?.SYSID);
        oFormData.append("WSVER", oSettings.appVersion);
        oFormData.append("WSPATCH_LEVEL", oSettings.patch_level);
        oFormData.append("PRCCD", "00");
        oFormData.append("ACTCD", "001");

        var xhr = new XMLHttpRequest();

        xhr.onload = async function () {

            let u4a_status = xhr.getResponseHeader("u4a_status");
            if (u4a_status) {
                let oRes;
                try {
                    oRes = JSON.parse(xhr.response);
                } catch (error) {
                    console.error("[Login] u4a_status JSON parse error", error, xhr.response);
                    let sErrMsg = oAPP.msg.M295 + "\n\n" + oAPP.msg.M290;
                    _openLoginErrorDialog({ TITLE: oAPP.msg.M417, DESC: sErrMsg });
                    parent.setDomBusy("");
                    _showContentDom("X");
                    return;
                }
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            var oResult2;
            try {
                oResult2 = JSON.parse(xhr.response);
                oResult2.SERVER_SETTINGS = oLogInData.SERVER_SETTINGS;
            } catch (error) {
                console.error("[Login] login result JSON parse error", error, xhr.response);
                _openLoginErrorDialog({ TITLE: oAPP.msg.M417, DESC: oAPP.msg.M081 });
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            if (oResult2.TYPE === "E") {

                $id("ws_pw").value = "";

                if (oResult2.RCODE === "R001") {
                    _msgWarning(oAPP.msg.M082);
                    parent.setDomBusy("");
                    _showContentDom("X");
                    return;
                }

                var _called = await oAPP.fn.fnCallAuthErrorListPopup(oResult2);
                if (_called === true) {
                    parent.setDomBusy("");
                    _showContentDom("X");
                    return;
                }

                var sMsg = "";
                let sCriticalErrMsg = oAPP.msg.M295 + "\n" + oAPP.msg.M290;
                let sSTCOD = oResult2?.STCOD || "";
                if (sSTCOD) {
                    sMsg = `[ Error code: ${sSTCOD} ]\n${sCriticalErrMsg}`;
                } else {
                    sMsg = oResult2.MSG;
                }
                _msgError(sMsg);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            oAPP.attr.HTTPONLY = oResult2.HTTP_ONLY;
            oAPP.attr.LOGIN = Object.assign(oAPP.attr.LOGIN, oLogInData);
            oAPP.attr.LOGIN_INFO = oResult2;

            // 권한 체크
            try {
                var oAuthInfo = await oAPP.fn.fnCheckAuthority();
                if (oAuthInfo?.TYPE === "E") {
                    _msgError(oAuthInfo.MSG);
                    parent.setDomBusy("");
                    _showContentDom("X");
                    return;
                }
            } catch (e) {
                console.error("[Login] fnCheckAuthority error", e);
                oAPP.fn.fnShowNoAuthIllustMsg(e);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            var oWsSettings = oAPP.fn.fnGetSettingsInfo(),
                bIsTrial = oWsSettings.isTrial,
                bIsPackaged = APP.isPackaged;

            oAuthInfo.IS_TRIAL = bIsTrial;

            // no build / trial 은 버전 체크 스킵
            if (!bIsPackaged || bIsTrial) {
                oAPP.fn.fnCheckVersionFinished(oResult2, oAuthInfo);
                return;
            }

            oAPP.fn.fnCheckAuthSuccess(oResult2, oAuthInfo);
        };

        function _onError(e) {
            console.error("[Login] xhr error", e, xhr.response);

            if (e && e.type === "timeout") {
                _msgError(oAPP.msg.M294);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            let sErrMsg = oAPP.msg.M283;
            if (xhr.response == "") {
                _msgError(sErrMsg);
                parent.setDomBusy("");
                _showContentDom("X");
                return;
            }

            var sCleanHtml = parent.setCleanHtml(xhr.response);
            parent.showMessage(null, 99, "E", sCleanHtml);
            parent.setDomBusy("");
            _showContentDom("X");
        }

        xhr.onerror = _onError;
        xhr.ontimeout = _onError;
        xhr.open("POST", sServicePath);
        xhr.withCredentials = true;
        xhr.send(oFormData);
    };

    /* ==================================================================
       권한 오류 리스트 팝업 — 추후 상세화 (현재는 흐름 유지 위해 미표시)
       ================================================================== */
    oAPP.fn.fnCallAuthErrorListPopup = (oRes) => {
        return new Promise(async (resolve) => {
            // TODO(추후): 권한오류 테이블 팝업 HTML 변환
            // 현재는 표시하지 않고 일반 오류 메시지로 흐르도록 false 반환
            resolve(false);
        });
    };

    /* ==================================================================
       개발 권한 체크 — 원본 유지
       ================================================================== */
    oAPP.fn.fnCheckAuthority = () => {
        return new Promise((resolve, reject) => {
            console.log("개발 권한 체크중..");
            var sServicePath = parent.getServerPath() + "/chk_u4a_authority";
            var oFormData = new FormData();
            let oSettings = WSUTIL.getWsSettingsInfo();
            oFormData.append("WSVER", oSettings.appVersion);
            oFormData.append("WSPATCH_LEVEL", oSettings.patch_level);

            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== xhr.DONE) return;
                if (xhr.status === 200 || xhr.status === 201) {
                    var oResult;
                    try {
                        oResult = JSON.parse(xhr.response);
                        console.log("## 개발 권한 결과:", oResult);
                    } catch (error) {
                        console.error("[Login] fnCheckAuthority JSON parse error", error);
                        var sCleanHtml = parent.setCleanHtml(xhr.response);
                        parent.showMessage(null, 99, "E", sCleanHtml);
                        parent.setDomBusy("");
                        return;
                    }
                    if (oResult.ISLICEN == "") { reject(oResult.RTMSG); return; }
                    if (oResult.DEV_KEY == "") { reject(oResult.RTMSG); return; }
                    resolve(oResult);
                } else {
                    parent.showMessage(null, 99, "E", xhr.response);
                    parent.setDomBusy("");
                }
            };
            xhr.open("POST", sServicePath);
            xhr.withCredentials = true;
            xhr.send(oFormData);
        });
    };

    /* ==================================================================
       권한 성공 -> 라이센스 체크 -> 버전 체인 — 원본 유지
       ================================================================== */
    oAPP.fn.fnCheckAuthSuccess = (oResult, oAuthInfo) => {
        var oResultData = { oResult: oResult, oAuthInfo: oAuthInfo };
        oAPP.fn.fnCheckCustomerLisence().then(oAPP.fn.fnCheckCustomerLisenceThen.bind(oResultData));
    };

    oAPP.fn.fnCheckCustomerLisence = () => {
        return new Promise((resolve, reject) => {
            var sServicePath = parent.getServerPath() + "/chk_customer_license";
            var oFormData = new FormData();
            let oSettings = WSUTIL.getWsSettingsInfo();
            oFormData.append("WSVER", oSettings.appVersion);
            oFormData.append("WSPATCH_LEVEL", oSettings.patch_level);

            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== xhr.DONE) return;
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        var oResult = JSON.parse(xhr.response);
                        resolve(oResult);
                    } catch (error) {
                        console.error("[Login] fnCheckCustomerLisence JSON parse error", error);
                        var sCleanHtml = parent.setCleanHtml(xhr.response);
                        parent.showMessage(null, 99, "E", sCleanHtml);
                        parent.setDomBusy("");
                        _showContentDom("X");
                    }
                } else {
                    parent.showMessage(null, 99, "E", xhr.response);
                    parent.setDomBusy("");
                    _showContentDom("X");
                }
            };
            xhr.open("POST", sServicePath);
            xhr.withCredentials = true;
            xhr.send(oFormData);
        });
    };

    oAPP.fn.fnCheckCustomerLisenceThen = function (oLicenseInfo) {
        if (oLicenseInfo.RETCD == "E") {
            console.error("[Login] license error", oLicenseInfo);
            oAPP.fn.fnShowNoAuthIllustMsg(oLicenseInfo.RTMSG);
            parent.setDomBusy("");
            _showContentDom("X");
            return;
        }
        var bIsCDN = parent.getIsCDN();
        if (bIsCDN == "X") {
            oAPP.fn.fnConnectionGithub().then(oAPP.fn.fnConnectionGithubThen.bind(this));
            return;
        }
        oAPP.fn.fnSetAutoUpdateForSAP(this).then(oAPP.fn.fnSetAutoUpdateForSAPThen.bind(this));
    };

    /* --------- 메이저 버전 체크 (SAP) — 원본 유지, UI만 교체 --------- */
    oAPP.fn.fnSetAutoUpdateForSAP = (oPARAM) => {
        return new Promise((resolve, reject) => {

            autoUpdaterSAP.on("checking-for-update-sap", (e) => {
                console.log(e?.params?.message || "major update check...");
            });

            autoUpdaterSAP.on("update-available-sap", (e) => {
                _showContentDom("X");
                setBusyPop({ PROGVISI: true, PROGTXT: "Downloading" });
                _setCardOpacity(0.3);
                openVersionDialog();
                parent.setDomBusy("");
            });

            autoUpdaterSAP.on("update-not-available-sap", (e) => {
                let oParam = { ISCDN: "", oLoginInfo: oPARAM.oResult };
                let oVerInfo = e?.params?.verInfo;
                if (oVerInfo && oVerInfo.appVer === oVerInfo.updVER) {
                    console.log("WS Support Package Version Check...");
                    oAPP.fn.fnCheckSupportPackageVersion(resolve, oParam);
                    return;
                }
                resolve();
            });

            autoUpdaterSAP.on("download-progress-sap", (e) => {
                var iToTal = e.params.TOTAL, iJobCnt = e.params.jobCnt;
                var iPer = parseFloat((iJobCnt / iToTal) * 100).toFixed(2);
                if (iPer >= 100) iPer = 100;
                setBusyPop({ TITLE: "Downloading...", PERVALUE: iPer });
            });

            autoUpdaterSAP.on("update-downloaded-sap", (e) => {
                setBusyPop({ TITLE: "Update Complete! Restarting...", ILLUSTTYPE: "sapIllus-SuccessHighFive", PERVALUE: 100 });
                console.log("업데이트가 완료되었습니다.");
                setTimeout(() => { autoUpdaterSAP.quitAndInstall(); }, 3000);
            });

            autoUpdaterSAP.on("update-error-sap", (e) => {
                _showContentDom("X");
                parent.setDomBusy("");
                let sErrMsg = e?.params?.message || "";
                let sMsg = oAPP.msg.M051 + "\n\n";
                if (sErrMsg !== "") sMsg += sErrMsg + "\n\n";
                sMsg += oAPP.msg.M052;
                _openUpdateErrorModal(sMsg, oAPP.msg.M054, true);
            });

            let oServerInfo = { HTTPONLY: oAPP.attr.HTTPONLY, LOGIN: oAPP.attr.LOGIN };
            let sVersion = REMOTE.app.getVersion();
            let oLoginInfo = oPARAM.oResult;
            oServerInfo.LOGIN.META = oLoginInfo.META;
            autoUpdaterSAP.checkForUpdates(sVersion, oServerInfo);
        });
    };

    oAPP.fn.fnSetAutoUpdateForSAPThen = function () {
        oAPP.fn.fnCheckVersionFinished(this.oResult, this.oAuthInfo);
    };

    function HexToStr(hex) {
        hex = hex.toString();
        var str = "";
        for (var i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        return str;
    }

    oAPP.fn.fnConnectionGithub = () => {
        return new Promise((resolve) => {
            var oSettings = oAPP.fn.fnGetSettingsInfo(),
                oGitSettings = oSettings.GITHUB,
                sGitDevKey = oGitSettings.devKey,
                sLatestUrl = oGitSettings.latestUrl;
            const octokit = new OCTOKIT({ auth: HexToStr(sGitDevKey) });
            octokit.request(sLatestUrl, { org: "octokit", type: "Public" })
                .then(() => resolve({ ISCDN: "X" }))
                .catch((err) => { console.log(err); resolve({ ISCDN: "" }); });
        });
    };

    oAPP.fn.fnConnectionGithubThen = function (oReturn) {
        parent.setIsCDN(oReturn.ISCDN);
        if (oReturn.ISCDN != "X") {
            oAPP.fn.fnSetAutoUpdateForSAP(this).then(oAPP.fn.fnSetAutoUpdateForSAPThen.bind(this));
            return;
        }
        oAPP.fn.fnSetAutoUpdateForCDN(this).then(oAPP.fn.fnSetAutoUpdateForCDNThen.bind(this));
    };

    /* --------- CDN 버전 체크 — 원본 유지, UI만 교체 --------- */
    oAPP.fn.fnSetAutoUpdateForCDN = (oPARAM) => {
        return new Promise((resolve, reject) => {

            autoUpdater.on("checking-for-update", () => console.log("CDN - 업데이트 확인 중..."));

            autoUpdater.on("update-available", () => {
                console.log("CDN - 업데이트가 가능합니다.");
                _showContentDom("X");
                setBusyPop({ PROGVISI: true, PROGTXT: "Downloading" });
                _setCardOpacity(0.3);
                openVersionDialog();
                parent.setDomBusy("");
            });

            autoUpdater.on("update-not-available", () => {
                console.log("CDN - 현재 최신버전입니다.");
                let oParam = { ISCDN: "X", oLoginInfo: oPARAM.oResult };
                oAPP.fn.fnCheckSupportPackageVersion(resolve, oParam);
                parent.setIsCDN("");
            });

            autoUpdater.on("error", (err) => {
                _showContentDom("X");
                let sMsg = oAPP.msg.M051 + " \n " + oAPP.msg.M052;
                _openUpdateErrorModal(sMsg, oAPP.msg.M054, false);
                console.log("CDN - 에러: " + err);
            });

            autoUpdater.on("download-progress", (progressObj) => {
                var iPer = parseFloat(progressObj.percent).toFixed(2);
                setBusyPop({ TITLE: "Downloading...", PERVALUE: iPer });
            });

            autoUpdater.on("update-downloaded", () => {
                setBusyPop({ TITLE: "Update Complete! Restarting...", ILLUSTTYPE: "sapIllus-SuccessHighFive" });
                console.log("CDN - 업데이트가 완료되었습니다.");
                setTimeout(() => { parent.setIsCDN(""); autoUpdater.quitAndInstall(); }, 3000);
            });

            autoUpdater.checkForUpdates();
        });
    };

    oAPP.fn.fnSetAutoUpdateForCDNThen = function () {
        oAPP.fn.fnCheckVersionFinished(this.oResult, this.oAuthInfo);
    };

    // 업데이트 오류 모달 (RETRY/CLOSE) — sap MessageBox 대체
    function _openUpdateErrorModal(sMsg, sTitle, bWithOpenLog) {
        const actions = [
            { label: "RETRY", kind: "ok", onClick: () => { APP.relaunch(); APP.exit(); } },
        ];
        if (bWithOpenLog) actions.push({ label: "OpenLog", onClick: () => { WSLOG.openLOG(true); APP.exit(); } });
        actions.push({ label: "CLOSE", onClick: () => { APP.exit(); } });
        openModal({ title: sTitle, body: sMsg, isError: true, escapable: false, actions: actions });
    }

    /* ==================================================================
       버전 체크 완료 -> 로그인 성공 — 원본 유지
       ================================================================== */
    oAPP.fn.fnCheckVersionFinished = (oResult, oAuthInfo) => {
        let oLogInData = getLoginData();
        oLogInData.ID = oResult.UNAME;
        oLogInData.CLIENT = oResult.MANDT;
        setLoginData({ ID: oResult.UNAME, CLIENT: oResult.MANDT });

        var oResultData = deepClone(oResult);
        oResultData.USER_AUTH = oAuthInfo;

        parent.showLoadingPage("X");
        parent.setDomBusy("X");
        parent.CURRWIN.setTitle("U4A Workspace - Main");

        oAPP.fn.fnOnLoginSuccess(oResultData);
    };

    /* ==================================================================
       권한 없음 / 라이센스 오류 모달 (sap IllustratedMessage 대체)
       ================================================================== */
    oAPP.fn.fnShowNoAuthIllustMsg = (sMsg) => {
        openModal({
            title: "No Authority!",
            body: String(sMsg == null ? "" : sMsg),
            isError: true,
            escapable: false,
            actions: [{ label: "OK", kind: "ok", onClick: oAPP.events.ev_attachIllustMsgOkBtn }]
        });
    };

    oAPP.events.ev_attachIllustMsgOkBtn = () => {
        oAPP.attr.isPressWindowClose = "X";
        REMOTE.getCurrentWindow().close();
    };

    /* ==================================================================
       로그인 성공 — 원본 유지 (sap 모델 -> getLoginData)
       ================================================================== */
    oAPP.fn.fnOnLoginSuccess = async (oResult) => {

        let oLogInData = getLoginData();
        if (oLogInData == null) return;

        var oWsSettings = oAPP.fn.fnGetSettingsInfo(),
            bIsTrial = oWsSettings.isTrial,
            oTrialServerInfo = oWsSettings.trialServerInfo;

        if (bIsTrial) {
            oResult.META.HOST = `http://${oTrialServerInfo.SERVERIP}:80${oTrialServerInfo.INSTANCENO}`;
        } else {
            oAPP.fn.fnSaveRemember(oLogInData);
            oAPP.fn.fnSaveIDSuggData(oLogInData.ID);
        }

        var oUserInfo = Object.assign({}, oResult, oLogInData);

        var sAppVer = APP.getVersion();
        if (!APP.isPackaged) sAppVer = oWsSettings.appVersion;

        oUserInfo.WSVER = sAppVer;
        oUserInfo.WSPATCH_LEVEL = Number(oWsSettings.patch_level || 0);

        var oServerInfo = parent.getServerInfo();
        oServerInfo.WSVER = sAppVer;
        oServerInfo.WSPATCH_LEVEL = Number(oWsSettings.patch_level || 0);

        parent.setBeforeServerInfo(deepClone(oServerInfo));

        oServerInfo.CLIENT = oUserInfo.CLIENT;
        oServerInfo.LANGU = oUserInfo.LANGU;
        parent.setServerInfo(oServerInfo);

        oUserInfo.LANGU = oUserInfo.WSLANGU;
        parent.setUserInfo(oUserInfo);

        if (oResult.META) {
            _serverMsgConfig(oResult.META);
            parent.setMetadata(oResult.META);
            if (oResult.META.T_REG_THEME) await _registry_T_REG_THEME(oResult.META.T_REG_THEME);
            if (oResult.META.T_REG_WLO) await _registry_T_REG_WLO(oResult.META.T_REG_WLO);
        }

        let oProcessUserInfo = {
            CLIENT: oUserInfo.CLIENT,
            ID: oUserInfo.ID,
            PW: oUserInfo.PW,
            SYSID: oUserInfo.SYSID,
            LANGU: oResult.META.LANGU,
            LANGU_CNV: oUserInfo.LANGU
        };
        oProcessUserInfo.LANGU = oUserInfo.LANGU;
        parent.setProcessEnvUserInfo(oProcessUserInfo);

        const contentEl = $id("content");
        if (contentEl) contentEl.style.display = "none";

        try {
            var oThemeInfo = await oAPP.fn.fnP13nCreateTheme();
        } catch (error) {
            console.error(error);
        }

        parent.setThemeInfo(oThemeInfo);

        var oCurrWin = REMOTE.getCurrentWindow();
        oCurrWin.setBackgroundColor(oThemeInfo.BGCOL);

        oAPP.attr.isPressWindowClose = "X";

        if (oServerInfo?.IS_SSO === "X" && oServerInfo.APPID && oServerInfo.APPID !== "") {
            parent.setNewBrowserIF_DATA({ ACTCD: "MOVE20", APPID: oServerInfo.APPID });
        }

        // WS30 메인 페이지로 이동 (vw_main 컨트롤)
        parent.oAPP.views.VW_MAIN.fn.loadWS30MainPage();

        parent.showLoadingPage("");
        parent.setSoundMsg("WELCOME");
    };

    /* ==================================================================
       테마 정보 — 원본 유지
       ================================================================== */
    oAPP.fn.fnP13nCreateTheme = () => {
        return new Promise((resolve, reject) => {
            let oLogInData = getLoginData(),
                sSysID = oLogInData.SYSID || oAPP.attr.LOGIN.SYSID,
                sThemeJsonPath = PATH.join(USERDATA, "p13n", "theme", `${sSysID}.json`);

            let oWsSettings = oAPP.fn.fnGetSettingsInfo(),
                oDefThemeInfo = { THEME: oWsSettings.defaultTheme, BGCOL: oWsSettings.defaultBackgroundColor };

            if (!FS.existsSync(sThemeJsonPath)) {
                FS.writeFile(sThemeJsonPath, JSON.stringify(oDefThemeInfo), { encoding: "utf8", mode: 0o777 }, (err) => {
                    if (err) { reject(err.toString()); return; }
                    resolve(oDefThemeInfo);
                });
                return;
            }
            let sThemeData = FS.readFileSync(sThemeJsonPath, "utf-8");
            resolve(JSON.parse(sThemeData));
        });
    };

    /* ==================================================================
       로그인 입력 체크 — 원본 유지 (sap setValueState -> _markField)
       ================================================================== */
    oAPP.fn.fnLoginCheck = (ID, PW, CLIENT, LANGU) => {

        _clearAllFieldStates();

        var oCheck = { RETCD: "S", MSG: "" };

        if (isEmpty(CLIENT) || isBlank(CLIENT)) {
            oCheck.RETCD = "E"; oCheck.MSG = oAPP.msg.M0271;
            _markField("ws-field-client", "Error", oCheck.MSG);
            setTimeout(() => $id("ws_client").focus(), 0);
            return oCheck;
        }
        if (isEmpty(ID) || isBlank(ID)) {
            oCheck.RETCD = "E"; oCheck.MSG = oAPP.msg.M0272;
            _markField("ws-field-id", "Error", oCheck.MSG);
            setTimeout(() => $id("ws_id").focus(), 0);
            return oCheck;
        }
        if (isEmpty(PW) || isBlank(PW)) {
            oCheck.RETCD = "E"; oCheck.MSG = oAPP.msg.M0273;
            _markField("ws-field-pw", "Error", oCheck.MSG);
            setTimeout(() => $id("ws_pw").focus(), 0);
            return oCheck;
        }
        if (isEmpty(LANGU) || isBlank(LANGU)) {
            oCheck.RETCD = "E"; oCheck.MSG = oAPP.msg.M0274;
            _markField(_languFieldWrapId(), "Error", oCheck.MSG);
            return oCheck;
        }
        return oCheck;
    };

    /* ==================================================================
       Remember / ID Suggestion — 원본 유지
       ================================================================== */
    oAPP.fn.fnSaveRemember = (oLogInData) => {
        var oServerInfo = parent.getServerInfo(), sSysID = oServerInfo.SYSID;
        let sJsonPath = PATH.join(USERDATA, "p13n", "login.json"),
            oLoginInfo = {};
        try { oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, "utf-8")); } catch (_) { oLoginInfo = {}; }
        if (typeof oLoginInfo !== "object" || oLoginInfo == null) oLoginInfo = {};
        if (typeof oLoginInfo[sSysID] == "undefined") oLoginInfo[sSysID] = {};

        var oSysInfo = oLoginInfo[sSysID], bIsRemember = oLogInData.REMEMBER;
        oSysInfo.REMEMBER = bIsRemember;
        if (bIsRemember) {
            oSysInfo.CLIENT = oLogInData.CLIENT;
            oSysInfo.LANGU = oLogInData.LANGU;
            oSysInfo.ID = oLogInData.ID;
            oSysInfo.WSLANGU = oLogInData.WSLANGU;
        }
        FS.writeFileSync(sJsonPath, JSON.stringify(oLoginInfo));
    };

    oAPP.fn.fnGetRememberLoginInfo = () => {
        var oServerInfo = parent.getServerInfo(), sSysID = oServerInfo.SYSID;
        let sJsonPath = PATH.join(USERDATA, "p13n", "login.json");
        try {
            var oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, "utf-8"));
        } catch (_) { return; }
        if (typeof oLoginInfo != "object" || oLoginInfo == null) return;
        if (typeof oLoginInfo[sSysID] == "undefined") return;
        return oLoginInfo[sSysID];
    };

    oAPP.fn.fnGetRememberCheck = () => {
        var oServerInfo = parent.getServerInfo(), sSysID = oServerInfo.SYSID;
        let sJsonPath = PATH.join(USERDATA, "p13n", "login.json");
        try {
            var oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, "utf-8"));
        } catch (_) { return false; }
        if (typeof oLoginInfo != "object" || oLoginInfo == null) return false;
        if (typeof oLoginInfo[sSysID] == "undefined") return false;
        return oLoginInfo[sSysID].REMEMBER;
    };

    oAPP.fn.fnSaveIDSuggData = (ID) => {
        const iIdSuggMaxCnt = 10;
        const sJsonPath = PATH.join(USERDATA, "p13n", "login.json");
        let oLoginInfo = {};
        try {
            if (FS.existsSync(sJsonPath)) oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, "utf-8"));
        } catch (_) { oLoginInfo = {}; }
        if (typeof oLoginInfo != "object" || oLoginInfo == null) oLoginInfo = {};
        oLoginInfo.aIds = Array.isArray(oLoginInfo.aIds) ? oLoginInfo.aIds : [];
        oLoginInfo.aIds = oLoginInfo.aIds.filter(a => a.ID !== ID);
        oLoginInfo.aIds.unshift({ ID });
        if (oLoginInfo.aIds.length > iIdSuggMaxCnt) oLoginInfo.aIds = oLoginInfo.aIds.slice(0, iIdSuggMaxCnt);
        try { FS.writeFileSync(sJsonPath, JSON.stringify(oLoginInfo, null, 2)); } catch (e) { console.error("login.json write error", e); }
    };

    oAPP.fn.fnReadIDSuggData = () => {
        let sJsonPath = PATH.join(USERDATA, "p13n", "login.json");
        try {
            var oLoginInfo = JSON.parse(FS.readFileSync(sJsonPath, "utf-8"));
        } catch (_) { return []; }
        if (typeof oLoginInfo != "object" || oLoginInfo == null || oLoginInfo.aIds == null) return [];
        return oLoginInfo.aIds;
    };

    /* ==================================================================
       네트워크 상태 — 원본 유지
       ================================================================== */
    oAPP.fn.fnNetworkCheckerOnline = function () {
        oAPP.attr.bIsNwActive = true;
        parent.setNetworkBusy(!oAPP.attr.bIsNwActive);
    };
    oAPP.fn.fnNetworkCheckerOffline = function () {
        oAPP.attr.bIsNwActive = false;
        parent.setNetworkBusy(!oAPP.attr.bIsNwActive);
    };

    /* ==================================================================
       개인화 폴더 생성 — 원본 유지
       ================================================================== */
    oAPP.fn.fnOnP13nFolderCreate = function () {
        var oServerInfo = parent.getServerInfo(), sSysID = oServerInfo.SYSID;
        var sP13nfolderPath = PATH.join(USERDATA, "p13n"),
            sP13nPath = parent.getPath("P13N"),
            bIsExists = FS.existsSync(sP13nPath);

        if (bIsExists) {
            var oSavedData = JSON.parse(FS.readFileSync(sP13nPath, "utf-8"));
            if (oSavedData == "") oSavedData = {};
            if (oSavedData[sSysID]) return;
            oSavedData[sSysID] = {};
            FS.writeFileSync(sP13nPath, JSON.stringify(oSavedData));
            return;
        }
        var oP13N_data = {};
        oP13N_data[sSysID] = {};
        if (!FS.existsSync(sP13nfolderPath)) FS.mkdirSync(sP13nfolderPath);
        FS.writeFileSync(sP13nPath, JSON.stringify(oP13N_data));
    };

    /* ==================================================================
       단축키 — 원본 유지
       ================================================================== */
    oAPP.fn.fnSetShortCut = () => {
        GlobalShortCut.register("F11", () => {
            var oCurrWin = REMOTE.getCurrentWindow();
            oCurrWin.setFullScreen(!oCurrWin.isFullScreen());
        });
    };
    oAPP.fn.fnOnBeforeUnload = () => { GlobalShortCut.unregisterAll(); };

    /* ==================================================================
       WS Support Package Version Check — 원본 유지, UI만 교체
       ================================================================== */
    oAPP.fn.fnCheckSupportPackageVersion = (resolve, oParam) => {

        setBusyPop({
            ANIMATION: true, PROGVISI: true, TITLE: "Downloading...",
            DESC: "If the patch is completed\nplease restart your computer!",
            PROGTXT: "Downloading", PERVALUE: 0
        });

        let sSupportPackageCheckerPath = parent.getPath("WS_SP_UPD"),
            spAutoUpdater = require(sSupportPackageCheckerPath);

        spAutoUpdater.on("checking-for-update-SP", (e) => console.log(e?.detail?.message || "패치 업데이트 확인중.."));

        spAutoUpdater.on("update-available-SP", () => {
            console.log("SP - 업데이트 항목이 존재합니다");
            _setCardOpacity(0.3);
            openVersionDialog();
            parent.setDomBusy("");
            _showContentDom("X");
        });

        spAutoUpdater.on("update-not-available-SP", () => { console.log("SP - 현재 최신버전입니다."); resolve(); });

        spAutoUpdater.on("download-progress-SP", (e) => {
            setBusyPop({ TITLE: "Support Patch Downloading..." });
            if (oParam.ISCDN == "X") { _supportPackageVersionCheckDialogProgressStart(); return; }
            let iTotal = e.detail.file_info.TOTAL, iCurr = e.detail.file_info.TRANSFERRED;
            let iPer = parseFloat((iCurr / iTotal) * 100).toFixed(2);
            if (iPer >= 100) iPer = 100;
            setBusyPop({ PERVALUE: iPer });
        });

        spAutoUpdater.on("update-install-SP", () => {
            console.log("SP - 패치 파일 다운로드 후 asar 압축 및 인스톨..");
            _supportPackageVersionCheckDialogProgressEnd();
            setBusyPop({ TITLE: "Support Patch Installing...", PROGTXT: "Processing" });
            _supportPackageVersionCheckDialogProgressStart();
        });

        spAutoUpdater.on("update-downloaded-SP", () => {
            console.log("SP - 업데이트가 완료되었습니다.");
            _supportPackageVersionCheckDialogProgressEnd(true);
            setBusyPop({ TITLE: "Update Complete! Restarting...", PROGTXT: "Processing Complete!", ILLUSTTYPE: "sapIllus-SuccessHighFive" });
            setTimeout(() => {
                if (oParam.ISCDN == "X") parent.setIsCDN("");
                APP.relaunch(); APP.exit();
            }, 3000);
        });

        spAutoUpdater.on("update-error-SP", (e) => {
            _showContentDom("X");
            parent.setDomBusy("");
            let sRetMsg = e?.detail?.message || "";
            let sMsg = oAPP.msg.M057 + "\n\n" + sRetMsg;
            openModal({
                title: oAPP.msg.M058, body: sMsg, isError: true, escapable: false,
                actions: [
                    { label: "OK", kind: "ok", onClick: () => APP.exit() },
                    { label: "OpenLog", onClick: () => { WSLOG.openLOG(true); APP.exit(); } }
                ]
            });
            console.log("SP - 패치 업데이트 중 에러: " + sRetMsg);
        });

        let bIsCDN = (oParam.ISCDN == "X"),
            sAppVer = `v${APP.getVersion()}`,
            oSettings = oAPP.fn.fnGetSettingsInfo(),
            sPatch_level = oSettings.patch_level,
            oWSLoginInfo = getLoginData();

        oWSLoginInfo.META = oParam.oLoginInfo.META;
        spAutoUpdater.checkForUpdates(REMOTE, bIsCDN, sAppVer, sPatch_level, oWSLoginInfo);
    };

    function _supportPackageVersionCheckDialogProgressStart() {
        if (oAPP.attr.progressIntervalStop === true) return;
        if (typeof oAPP.attr.progressInterval !== "undefined") {
            clearInterval(oAPP.attr.progressInterval);
            delete oAPP.attr.progressInterval;
        }
        let iPer = 0;
        oAPP.attr.progressInterval = setInterval(function () {
            iPer += 1;
            setBusyPop({ PERVALUE: iPer });
            if (iPer >= 100 && typeof oAPP.attr.progressInterval !== "undefined") {
                clearInterval(oAPP.attr.progressInterval);
                delete oAPP.attr.progressInterval;
                setTimeout(() => _supportPackageVersionCheckDialogProgressStart(), 500);
            }
        }, 20);
    }

    function _supportPackageVersionCheckDialogProgressEnd(bIsStop) {
        if (typeof oAPP.attr.progressInterval !== "undefined") {
            clearInterval(oAPP.attr.progressInterval);
            delete oAPP.attr.progressInterval;
        }
        oAPP.attr.progressIntervalStop = bIsStop;
        setBusyPop({ PERVALUE: 100, ANIMATION: false });
    }

    oAPP.fn.fnFloatingMenuOpen = () => {
        var sFloatingMenuJsPath = parent.getPath("FLTMENU"),
            oFloatMenu = require(sFloatingMenuJsPath),
            oServerInfo = parent.getServerInfo(),
            sSysID = oServerInfo.SYSID;
        oFloatMenu.open(REMOTE, screen, APPPATH, sSysID);
    };

    /* ==================================================================
       IPC — 원본 유지 (UI5 applyTheme -> data-theme)
       ================================================================== */
    oAPP.fn.onIpcMain_if_p13n_themeChange = function () {
        let oLogInData = oAPP.attr.LOGIN;
        let sSysID = oLogInData.SYSID;
        let sThemeJsonPath = PATH.join(USERDATA, "p13n", "theme", `${sSysID}.json`);
        if (FS.existsSync(sThemeJsonPath) === false) return;
        try {
            var oThemeJsonData = JSON.parse(FS.readFileSync(sThemeJsonPath, "utf-8"));
        } catch (error) { return; }
        let sWebConBodyCss = `html, body { margin: 0px; height: 100%; background-color: ${oThemeJsonData.BGCOL}; }`;
        REMOTE.getCurrentWindow().webContents.insertCSS(sWebConBodyCss);
        // UI5 applyTheme 대체: data-theme 토큰 매핑 (THEME 명이 sap 테마면 기본 purple 유지)
        // 추후 서버 테마명 <-> data-theme 매핑 테이블 적용 예정
    };

    oAPP.fn.fnIpcMain_browser_interconnection = (oEvent, oRes) => {
        if (oRes && oRes.PRCCD === "04") oAPP.fn.fnIpcMain_browser_interconnection_04(oRes);
    };
    oAPP.fn.fnIpcMain_browser_interconnection_04 = () => {
        oAPP.attr.isPressWindowClose = "X";
        CURRWIN.close();
    };

    /* ==================================================================
       레지스트리 저장 — 원본 유지
       ================================================================== */
    function _registry_T_REG_THEME(T_REG_THEME) {
        return new Promise(async (resolve) => {
            let oServerInfo = parent.getServerInfo(),
                oSettings = oAPP.fn.fnGetSettingsInfo(),
                oRegPaths = oSettings.regPaths,
                sSystemsRegPath = oRegPaths.systems,
                sRegThemeInfo = JSON.stringify(T_REG_THEME);
            let sRegPath = PATH.join(sSystemsRegPath, oServerInfo.SYSID);
            let oRegData = {};
            oRegData[sRegPath] = {};
            oRegData[sRegPath]["T_REG_THEME"] = { value: sRegThemeInfo, type: "REG_SZ" };
            await WSUTIL.putRegeditValue(oRegData);
            resolve();
        });
    }

    function _registry_T_REG_WLO(T_REG_WLO) {
        return new Promise(async (resolve) => {
            let oServerInfo = parent.getServerInfo(),
                oSettings = oAPP.fn.fnGetSettingsInfo(),
                oRegPaths = oSettings.regPaths,
                sSystemsRegPath = oRegPaths.systems,
                sWhiteListObj = JSON.stringify(T_REG_WLO);
            let sRegPath = PATH.join(sSystemsRegPath, oServerInfo.SYSID);
            let oRegData = {};
            oRegData[sRegPath] = {};
            oRegData[sRegPath]["T_REG_WLO"] = { value: sWhiteListObj, type: "REG_SZ" };
            await WSUTIL.putRegeditValue(oRegData);
            resolve();
        });
    }

    /* ==================================================================
       현재 창 이벤트 / IPC 등록 — 원본 유지 (UI5 byId -> DOM)
       ================================================================== */
    function _attachCurrentWindowEvents() {
        CURRWIN.on("maximize", () => { const b = $id("ws-win-max"); if (b) b.title = "Restore"; });
        CURRWIN.on("unmaximize", () => { const b = $id("ws-win-max"); if (b) b.title = "Maximize"; });
    }

    function _attachIPCEvents() {
        IPCMAIN.on("if-browser-interconnection", oAPP.fn.fnIpcMain_browser_interconnection);
        let oServerInfo = parent.getServerInfo();
        let sSysID = oServerInfo.SYSID;
        IPCMAIN.on(`if-p13n-themeChange-${sSysID}`, oAPP.fn.onIpcMain_if_p13n_themeChange);
    }

    /* ==================================================================
       로그인 오류 가이드 새창 — 추후 (현재는 toast 안내)
       ================================================================== */
    function _showLoginErrorHelpPopup() {
        // TODO(추후): help/login/<langu>/index.html 새창 변환
        toast("점검사항 가이드는 추후 제공됩니다.");
    }

    /* ==================================================================
       로그인 오류 Dialog (sap.m.Dialog 대체)
       - 닫으면 로그인 창을 닫는 동작은 원본과 동일
       ================================================================== */
    function _openLoginErrorDialog(oPARAM) {
        let sTitle = oPARAM?.TITLE || "";
        let sMsg01 = oAPP.msg.M249; // 점검사항
        let sMsg02 = oAPP.msg.M250; // 아래의 점검사항을 확인하세요.
        openModal({
            title: sTitle,
            body: (oPARAM?.DESC || "") + "\n\n" + (sMsg02 || ""),
            isError: true,
            escapable: false,
            actions: [
                { label: sMsg01 || "점검사항", onClick: () => { _showLoginErrorHelpPopup(); } },
                { label: "닫기", kind: "ok" }
            ],
            onClose: () => {
                oAPP.attr.isPressWindowClose = "X";
                CURRWIN.close();
            }
        });
    }

    /* ==================================================================
       접속서버 설치 언어 목록 — 원본 유지 (jQuery.ajax -> fetch)
       ================================================================== */
    function _getSupportedLangu(PARAM) {
        return new Promise(async function (resolve) {
            let sServicePath = parent.getServerPath();
            let oFormData = new FormData();
            oFormData.append("GET_LANGU", "X");
            oFormData.append("PRCCD", PARAM.PRCCD);

            const ctrl = new AbortController();
            const to = setTimeout(() => ctrl.abort(), 5000);

            try {
                const resp = await fetch(sServicePath, { method: "POST", body: oFormData, signal: ctrl.signal, credentials: "include" });
                clearTimeout(to);
                const sStringData = await resp.text();
                try {
                    return resolve(JSON.parse(sStringData));
                } catch (error) {
                    console.log("[Login] _getSupportedLangu JSON parse error (하위버전 서버 가능) -> input 언어");
                    return resolve({ RETCD: "E", STCOD: "E998" });
                }
            } catch (error) {
                clearTimeout(to);
                console.error("[Login] _getSupportedLangu 통신오류", error);
                return resolve({ RETCD: "E", STCOD: "E999" });
            }
        });
    }

    /* ==================================================================
       언어 입력/선택 분기 — 원본 유지 (UI5 form visible -> DOM)
       ================================================================== */
    function _handleLoginLangu() {
        return new Promise(async function (resolve) {
            let sLanguPRCCD = "GET_LANGU";
            let oLanguResult = await _getSupportedLangu({ PRCCD: sLanguPRCCD });
            console.log("[Login] _handleLoginLangu", oLanguResult);

            if (oLanguResult.RETCD === "E") {
                let sErrMsg = "";
                switch (oLanguResult.STCOD) {
                    case "E001": sErrMsg = oAPP.msg.M282; break;
                    case "E998":
                        // 하위버전 서버 -> LANGUAGE input 표시
                        _showLanguField("input");
                        return resolve();
                    case "E999": sErrMsg = oAPP.msg.M283; break;
                    default: sErrMsg = oAPP.msg.M283; break;
                }
                _openLoginErrorDialog({ TITLE: oAPP.msg.M416, DESC: sErrMsg });
                parent.setDomBusy("");
                return;
            }

            // 내가 던진 PRCCD 가 아니면 input
            if (oLanguResult?.PRCCD !== sLanguPRCCD) {
                _showLanguField("input");
                return resolve();
            }

            // select 표시 + 목록 채우기
            _showLanguField("select");
            let aLangu = oLanguResult?.T_LANGU || [];
            _fillLanguSelect(aLangu);

            // 기 저장 언어 없으면 서버 default
            let sLangu = oAPP.attr.LOGIN.LANGU;
            if (!sLangu) {
                oAPP.attr.LOGIN.LANGU = oLanguResult.DEFLANGU || "";
            }
            oAPP.attr.LOGIN.T_LANGU = aLangu;
            _setLanguValue(oAPP.attr.LOGIN.LANGU);

            return resolve();
        });
    }

    function _showLanguField(mode) {
        $id("ws_langu_input_form").style.display = (mode === "input") ? "block" : "none";
        $id("ws_langu_select_form").style.display = (mode === "select") ? "block" : "none";
    }

    function _fillLanguSelect(aLangu) {
        const sel = $id("ws_langu_select");
        if (!sel) return;
        sel.innerHTML = "";
        (aLangu || []).forEach((it) => {
            const opt = document.createElement("option");
            // 원본 template: key="{KEY}", text="{LANGU}"
            opt.value = it.KEY != null ? it.KEY : (it.LANGU || "");
            opt.textContent = it.LANGU != null ? it.LANGU : (it.KEY || "");
            sel.appendChild(opt);
        });
    }

    /* ==================================================================
       화면 렌더 이후 — 원본 _onViewReady 유지
       ================================================================== */
    async function _onViewReady() {

        await oAPP.fn.fnCheckIstalledBrowser();
        await fnWsGlobalMsgList();

        oAPP.fn.fnOnInitModelBinding();

        _attachCurrentWindowEvents();
        _attachIPCEvents();
        oAPP.fn.fnOnP13nFolderCreate();

        // (제거) IllustrationPool / FioriIconPool 등록

        await _handleLoginLangu();

        // SSO 자동 로그인
        let oServerInfo = parent.getServerInfo();
        if (oServerInfo?.IS_SSO === "X") {
            let o = oAPP.attr.LOGIN;
            if (oServerInfo.CLIENT) o.CLIENT = oServerInfo.CLIENT;
            if (oServerInfo.SAPID) o.ID = oServerInfo.SAPID;
            if (oServerInfo.SAPPW) o.PW = oServerInfo.SAPPW;
            if (oServerInfo.LANGU) o.LANGU = oServerInfo.LANGU;
            if (oServerInfo.WSLANGU) o.WSLANGU = oServerInfo.WSLANGU;
            setLoginData(o);

            await _handleSSOLogin();
            oAPP.events.ev_login(oServerInfo);
            return;
        }

        setTimeout(() => { fadeInContent(); }, 300);
        parent.setDomBusy("");
    }

    function _handleSSOLogin() {
        return new Promise(async function (resolve) {
            let oServerInfo = parent.getServerInfo();
            let SSO_TICKET = oServerInfo?.SSO_TICKET || undefined;
            if (typeof SSO_TICKET === "undefined") return resolve();

            let sServerPath = parent.getServerPath();
            let SSO_HDR = `${SSO_TICKET}_XXX`;
            let oFormData = new FormData();
            oFormData.append("SSO_TICKET", SSO_TICKET);
            try {
                await fetch(sServerPath, { headers: { "sso_hdr": SSO_HDR }, method: "POST", body: oFormData });
            } catch (error) {
                console.error("[Login] _handleSSOLogin 통신오류", error);
            }
            resolve();
        });
    }

    /* ==================================================================
       진입점 (sap attachInit 대체)
       ================================================================== */
    oAPP.fn.fnAttachInit = () => {

        _applyLogos();
        _wireWindowButtons();
        _wireFormEvents();
        _wirePasswordToggle();

        // ServerList 언어 적용 (URL 로 전달된 u4aLang 기준, 없으면 기본 en)
        applyLoginI18n(_getLangFromUrl());

        var oWsSettings = oAPP.fn.fnGetSettingsInfo();

        // Trial 은 추후 — 정상 폼으로 진입 (TODO: Login_trial HTML 변환)
        if (oWsSettings.isTrial && typeof oAPP.fn.fnOnTrialLoginPageRendering === "function") {
            try {
                oAPP.fn.fnOnTrialLoginPageRendering();
                return;
            } catch (e) {
                console.warn("[Login] trial rendering skip (추후 변환)", e);
            }
        }

        // 화면 준비 -> 데이터/언어/IPC 초기화
        _onViewReady();
    };

    return oAPP;

})();


/* ====================================================================
   전역 (IIFE 밖) — 원본 유지
   ==================================================================== */

/************************************************************************
 * WS Global 메시지 글로벌 변수 설정
 ************************************************************************/
function fnWsGlobalMsgList() {
    return new Promise(async (resolve) => {
        const WSUTIL = parent.WSUTIL;
        let oSettingInfo = WSUTIL.getWsSettingsInfo(),
            sWsLangu = oSettingInfo.globalLanguage;

        const T = (cls, no, p1) => WSUTIL.getWsMsgClsTxt(sWsLangu, cls, no, p1);

        oAPP.msg.M001 = T("ZMSG_WS_COMMON_001", "001");
        oAPP.msg.M032 = T("ZMSG_WS_COMMON_001", "032");
        oAPP.msg.M051 = T("ZMSG_WS_COMMON_001", "051");
        oAPP.msg.M052 = T("ZMSG_WS_COMMON_001", "052");
        oAPP.msg.M053 = T("ZMSG_WS_COMMON_001", "053");
        oAPP.msg.M054 = T("ZMSG_WS_COMMON_001", "054");
        oAPP.msg.M055 = T("ZMSG_WS_COMMON_001", "055");
        oAPP.msg.M056 = T("ZMSG_WS_COMMON_001", "056");
        oAPP.msg.M057 = T("ZMSG_WS_COMMON_001", "057");
        oAPP.msg.M058 = T("ZMSG_WS_COMMON_001", "058");
        oAPP.msg.M063 = T("ZMSG_WS_COMMON_001", "063");
        oAPP.msg.M064 = T("ZMSG_WS_COMMON_001", "064");
        oAPP.msg.M065 = T("ZMSG_WS_COMMON_001", "065");
        oAPP.msg.M081 = T("ZMSG_WS_COMMON_001", "081");
        oAPP.msg.M082 = T("ZMSG_WS_COMMON_001", "082");
        oAPP.msg.M249 = T("ZMSG_WS_COMMON_001", "249");
        oAPP.msg.M250 = T("ZMSG_WS_COMMON_001", "250");
        oAPP.msg.M0271 = T("ZMSG_WS_COMMON_001", "027", oAPP.msg.M063);
        oAPP.msg.M0272 = T("ZMSG_WS_COMMON_001", "027", oAPP.msg.M064);
        oAPP.msg.M0273 = T("ZMSG_WS_COMMON_001", "027", oAPP.msg.M065);
        oAPP.msg.M0274 = T("ZMSG_WS_COMMON_001", "027", oAPP.msg.M001);
        oAPP.msg.M282 = T("ZMSG_WS_COMMON_001", "282");
        oAPP.msg.M283 = T("ZMSG_WS_COMMON_001", "283");
        oAPP.msg.M290 = T("ZMSG_WS_COMMON_001", "290");
        oAPP.msg.M294 = T("ZMSG_WS_COMMON_001", "294");
        oAPP.msg.M295 = T("ZMSG_WS_COMMON_001", "295");
        oAPP.msg.M414 = T("ZMSG_WS_COMMON_001", "414");
        oAPP.msg.M415 = T("ZMSG_WS_COMMON_001", "415");
        oAPP.msg.M416 = T("ZMSG_WS_COMMON_001", "416");
        oAPP.msg.M417 = T("ZMSG_WS_COMMON_001", "417");

        resolve();
    });
}

window.addEventListener("load", async () => {
    oAPP.fn.fnAttachInit();
});

// 공통 헤더(부모 index.html)의 닫기 버튼이 호출 → onbeforeunload 가드 해제 후 창 닫기 허용.
window.__prepareClose = function () {
    try { if (oAPP && oAPP.attr) { oAPP.attr.isPressWindowClose = "X"; } } catch (_) {}
};

window.onbeforeunload = () => {
    // 닫기 플래그는 이 로그인 페이지(iframe) 자신의 oAPP 에서 세팅한다.
    // (기존 UI5 버전은 부모 vw_main 이 세팅 → parent.oAPP 였으나, 이제 닫기 버튼이
    //  로그인 페이지 자체 타이틀바에 있으므로 자신의 oAPP 를 검사해야 close 가 동작함)
    if (oAPP.attr.isPressWindowClose !== "X") return false;

    window.removeEventListener("online", oAPP.fn.fnNetworkCheckerOnline);
    window.removeEventListener("offline", oAPP.fn.fnNetworkCheckerOffline);

    try {
        const IPCMAIN = parent.REMOTE.require("electron").ipcMain;
        IPCMAIN.off("if-browser-interconnection", oAPP.fn.fnIpcMain_browser_interconnection);
        let oServerInfo = parent.getServerInfo();
        let sSysID = oServerInfo.SYSID;
        IPCMAIN.off(`if-p13n-themeChange-${sSysID}`, oAPP.fn.onIpcMain_if_p13n_themeChange);
    } catch (_) { }

    oAPP.fn.fnOnBeforeUnload();
};

window.addEventListener("online", oAPP.fn.fnNetworkCheckerOnline, false);
window.addEventListener("offline", oAPP.fn.fnNetworkCheckerOffline, false);

document.addEventListener("DOMContentLoaded", function () {
    parent.CURRWIN.setTitle("U4A Workspace - Login");
    parent.WEBFRAME.setZoomLevel(0);
});
