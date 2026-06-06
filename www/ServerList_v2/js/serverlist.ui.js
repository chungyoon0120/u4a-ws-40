/* ====================================================================
   U4A Workspace — ServerList UI (글래스 UX 콜라보)
   데이터: window.WSData (serverlist.data.js) — 레지스트리/XML/감시
   기능: 검색 필터 · 행 Edit/Delete · Refresh · 설정 메뉴 · 드래그 splitter
        · pop-in(패널 폭 기준) · sticky 툴바/헤더 · 트리 레벨 유지
   ==================================================================== */
"use strict";

/* ====================================================================
   U4A Workspace — 공용 로고 경로 (Single Source of Truth)
   --------------------------------------------------------------------
   ★ 모든 새창 / 모달 / 위젯은 반드시 이 객체만 바라본다.
     배포 위치가 바뀌어도 여기 한 곳만 고치면 전체에 반영됨.

   사용 예)
     <img src="${U4A_LOGO.png}" class="ws-logo ws-logo--md">
     document.querySelector('link[rel=icon]').href = U4A_LOGO.ico;
     U4A_LOGO.applyFavicon(document);   // 새로 띄운 window 의 document 에 적용
     U4A_LOGO.createImg('md');          // <img class="ws-logo ws-logo--md" ...> 생성
   ==================================================================== */
window.U4A_LOGO = window.U4A_LOGO || (function () {
    const PNG = "../img/logo.png";
    const ICO = "../img/logo.ico";

    /** 새로 띄운 창/iframe document 의 favicon 을 강제로 로고로 맞춤 */
    function applyFavicon(doc) {
        try {
            doc = doc || document;
            const head = doc.head || doc.getElementsByTagName("head")[0];
            if (!head) return;
            doc.querySelectorAll('link[rel~="icon"]').forEach(n => n.parentNode.removeChild(n));
            const a = doc.createElement("link"); a.rel = "icon";          a.type = "image/x-icon"; a.href = ICO; head.appendChild(a);
            const b = doc.createElement("link"); b.rel = "shortcut icon"; b.type = "image/x-icon"; b.href = ICO; head.appendChild(b);
        } catch (_) {}
    }

    /** 표준 onerror 핸들러 — 로고 누락 시 그라디언트 폴백으로 자동 전환 */
    const ON_ERR = "this.onerror=null;this.classList.add('is-fallback');this.removeAttribute('src');";

    /** 사이즈 sm|md|lg|xl → <img class="ws-logo ws-logo--{size}"> DOM 요소 */
    function createImg(size, extraClass) {
        const img = document.createElement("img");
        img.className = "ws-logo ws-logo--" + (size || "md") + (extraClass ? " " + extraClass : "");
        img.alt = "U4A Workspace";
        img.draggable = false;
        img.setAttribute("onerror", ON_ERR);
        img.src = PNG;
        return img;
    }

    /** HTML 문자열로 받고 싶을 때 (innerHTML 합성용) */
    function imgHTML(size, extraClass) {
        const cls = "ws-logo ws-logo--" + (size || "md") + (extraClass ? " " + extraClass : "");
        return `<img class="${cls}" src="${PNG}" alt="U4A Workspace" draggable="false" onerror="${ON_ERR}" />`;
    }

    return { png: PNG, ico: ICO, ON_ERR, applyFavicon, createImg, imgHTML };
})();

/* ==================================================================== */

(function () {

    /* ---------- 아이콘 ---------- */
    const SVG = (p) => `<svg class="ws-ico" viewBox="0 0 24 24">${p}</svg>`;
    const ICON = {
        edit:     SVG(`<path d="M4 20h4l10-10-4-4L4 16Z"/><path d="M13.5 6.5l4 4"/>`),
        trash:    SVG(`<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>`),
        language: SVG(`<path d="M4 5h9"/><path d="M9 3v2"/><path d="M6 5c.7 2.7 2.2 5 5.2 6.7"/><path d="M12.5 5c-.8 3.2-2.9 5.7-6.5 7.2"/><path d="M13 20l3.2-8h1.6L21 20"/><path d="M14.2 17h5.6"/>`),
        theme:    SVG(`<path d="M12 3v2"/><path d="M12 19v2"/><path d="M4.2 4.2l1.4 1.4"/><path d="M18.4 18.4l1.4 1.4"/><path d="M3 12h2"/><path d="M19 12h2"/><path d="M4.2 19.8l1.4-1.4"/><path d="M18.4 5.6l1.4-1.4"/><path d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z"/>`),
        sound:    SVG(`<path d="M4 10v4h4l5 4V6l-5 4H4z"/><path d="M16 9.5c.8.8 1.2 1.6 1.2 2.5S16.8 13.7 16 14.5"/><path d="M18.5 7c1.4 1.4 2.2 3.1 2.2 5s-.8 3.6-2.2 5"/>`),
        about:    SVG(`<circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7.5h.01"/>`),
    };

    /* ---------- i18n ---------- */
    const LANG_KEY = "u4a-ws-lang-v1";
    const I18N = {
        en: {
            app_title: "U4A Workspace Logon Pad",
            app_subtitle: "Select a workspace and open the SAP server connection.",
            brand: "U4A Workspace",
            loading_title: "Loading…",
            loading_desc: "Please wait a moment.",
            win_min: "Minimize", win_max: "Maximize", win_close: "Close",
            btn_refresh: "Refresh", btn_settings: "Settings",
            panel_workspace: "Workspace", panel_workspace_sub: "SAP Logon folders",
            panel_servers: "Server List", panel_servers_sub: "Available SAP systems",
            splitter_tip: "Drag to resize (double-click = default width)",
            search_placeholder: "Search server name, SID, host…",
            col_status: "STATUS", col_name: "SERVER NAME", col_sid: "SID",
            col_host: "HOST(Or IP)", col_sno: "SNO", col_act: "Settings",
            status_active: "Active", status_inactive: "Inactive",
            menu_language: "Language", menu_theme: "Theme", menu_sound: "Sound", menu_about: "About",
            menu_not_impl: "{name} settings (not yet implemented)",
            sort_dir_asc: "ascending", sort_dir_desc: "descending",
            sort_tip: "Click: {dir} → reverse → unsort this column (click another column to add to multi-sort)",
            sort_clear_label: "Sort", sort_clear_title: "Clear all sorts",
            empty_title: "No servers to show", empty_desc: "Select a workspace (folder) on the left.",
            err_load_title: "Failed to load",
            err_xml_missing: "SAPUILandscape.xml not found. (check console)",
            err_no_node: "Run in Electron to load the actual list.",
            err_generic: "Failed to load server list.",
            act_open: "'{name}' connect (not yet implemented)",
            act_edit_title: "Edit", act_delete_title: "Delete",
            edit_title_new: "Register server",
            field_protocol: "Protocol", field_host: "Host", field_port: "Port",
            field_use_internal: "Use Internal", field_skip_cert: "Skip Certificate",
            val_host_required: "Host is required.",
            val_port_format: "Port must be 1–5 digits.",
            val_port_range: "Port must be 1–65535.",
            msg_saved: "Saved.", msg_saved_demo: "Saved (in-memory only — demo mode)",
            msg_save_fail: "Save failed",
            msg_refreshed: "Refresh complete",
            msg_removed: "Unregistered", msg_removed_demo: "Unregistered (in-memory only — demo mode)",
            msg_remove_fail: "Delete failed",
            confirm_unregister_title: "Unregister",
            confirm_unregister: "Unregister connection of '{name}'?\nIt will become Inactive.",
            modal_save_tip: "Save (Enter)", modal_cancel_tip: "Cancel (Esc)",
            lang_title: "Language Settings", lang_label: "Language",
            theme_title: "Theme Settings", theme_label: "Theme",
            theme_purple: "Purple (default)", theme_dark: "Dark", theme_white: "Light",
        },
        ko: {
            app_title: "U4A Workspace Logon Pad",
            app_subtitle: "워크스페이스를 선택하고 SAP 서버에 연결하세요.",
            brand: "U4A Workspace",
            loading_title: "로딩 중…",
            loading_desc: "잠시만 기다려 주세요.",
            win_min: "최소화", win_max: "최대화", win_close: "닫기",
            btn_refresh: "새로고침", btn_settings: "설정",
            panel_workspace: "워크스페이스", panel_workspace_sub: "SAP 로그온 폴더",
            panel_servers: "서버 목록", panel_servers_sub: "사용 가능한 SAP 시스템",
            splitter_tip: "드래그하여 너비 조절 (더블클릭 = 기본 너비)",
            search_placeholder: "서버 이름, SID, 호스트 검색…",
            col_status: "상태", col_name: "서버 이름", col_sid: "SID",
            col_host: "호스트(IP)", col_sno: "SNO", col_act: "설정",
            status_active: "활성", status_inactive: "비활성",
            menu_language: "언어", menu_theme: "테마", menu_sound: "사운드", menu_about: "정보",
            menu_not_impl: "{name} 설정 (구현 예정)",
            sort_dir_asc: "오름차순", sort_dir_desc: "내림차순",
            sort_tip: "클릭: {dir} → 반대 → 이 컬럼만 해제 (다른 컬럼 클릭 시 멀티 정렬에 추가)",
            sort_clear_label: "정렬", sort_clear_title: "정렬 모두 해제",
            empty_title: "표시할 서버가 없습니다", empty_desc: "좌측에서 워크스페이스(폴더)를 선택하세요.",
            err_load_title: "불러오기 실패",
            err_xml_missing: "SAPUILandscape.xml 을 찾지 못했습니다. (콘솔 확인)",
            err_no_node: "Electron 환경에서 실행해야 실제 목록을 읽습니다.",
            err_generic: "서버 목록을 불러오지 못했습니다.",
            act_open: "'{name}' 접속 (구현 예정)",
            act_edit_title: "수정", act_delete_title: "삭제",
            edit_title_new: "서버 등록",
            field_protocol: "프로토콜", field_host: "호스트", field_port: "포트",
            field_use_internal: "내부망 사용", field_skip_cert: "인증서 검사 건너뛰기",
            val_host_required: "호스트는 필수입니다.",
            val_port_format: "포트는 숫자(1~5자리)여야 합니다.",
            val_port_range: "포트는 1~65535 범위여야 합니다.",
            msg_saved: "저장되었습니다.", msg_saved_demo: "저장되었습니다. (메모리만 · 데모 모드)",
            msg_save_fail: "저장 실패",
            msg_refreshed: "새로고침 완료",
            msg_removed: "등록 해제됨", msg_removed_demo: "등록 해제됨 (메모리만 · 데모 모드)",
            msg_remove_fail: "삭제 실패",
            confirm_unregister_title: "등록 해제",
            confirm_unregister: "'{name}' 의 접속 등록을 해제할까요?\n해제하면 Inactive 상태가 됩니다.",
            modal_save_tip: "저장 (Enter)", modal_cancel_tip: "취소 (Esc)",
            lang_title: "언어 설정", lang_label: "언어",
            theme_title: "테마 설정", theme_label: "테마",
            theme_purple: "퍼플 (기본)", theme_dark: "다크", theme_white: "화이트",
        },
    };
    let LANG = "en";
    function t(key, params) {
        let s = (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key;
        if (params) for (const p in params) s = s.replace(new RegExp("\\{" + p + "\\}", "g"), params[p]);
        return s;
    }
    function loadLanguage() {
        try { const v = localStorage.getItem(LANG_KEY); if (v && I18N[v]) return v; } catch (_) {}
        return "en";
    }
    function saveLanguage(lang) { try { localStorage.setItem(LANG_KEY, lang); } catch (_) {} }
    function applyStaticI18n() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            if (el.tagName === "TITLE") return;          // <title> 은 별도 처리
            el.textContent = t(el.getAttribute("data-i18n"));
        });
        document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
        document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.setAttribute("title", t(el.getAttribute("data-i18n-title"))); });
        document.documentElement.lang = LANG;
        const titleEl = document.querySelector("title[data-i18n]");
        if (titleEl) document.title = t(titleEl.getAttribute("data-i18n"));
    }
    function setLanguage(lang) {
        if (!I18N[lang]) lang = "en";
        if (LANG === lang) return;
        LANG = lang;
        saveLanguage(lang);
        applyStaticI18n();
        rebuildSettingsMenu();   // 메뉴 텍스트 갱신
        refreshFromState();       // 트리 + 테이블 (헤더 라벨, 상태 배지, 버튼 title 등)
        updateSortClearVisibility(); // 핀 카운트 갱신
        broadcastUxLang(lang);    // 열려있는 로그인 창에도 동일 언어 전파
    }

    /* ---------- 테마 ---------- */
    const THEME_KEY = "u4a-ws-theme-v1";
    const THEMES = ["purple", "dark", "white"];
    // 테마별 기본 배경색(공통 테마 --u4a-bg 와 동일) — BrowserWindow backgroundColor 용
    const THEME_BG = { purple: "#0f0818", dark: "#0b1118", white: "#eef2f7" };
    let THEME = "purple";
    function loadTheme() {
        try { const v = localStorage.getItem(THEME_KEY); if (v && THEMES.indexOf(v) >= 0) return v; } catch (_) {}
        return "purple";
    }
    function saveTheme(theme) { try { localStorage.setItem(THEME_KEY, theme); } catch (_) {} }
    function applyTheme(theme) {
        if (THEMES.indexOf(theme) < 0) theme = "purple";
        THEME = theme;
        document.documentElement.setAttribute("data-theme", theme);
    }
    function setTheme(theme) {
        if (THEMES.indexOf(theme) < 0) theme = "purple";
        applyTheme(theme);  // ServerList 자체 UI 에만 적용
        saveTheme(theme);   // 신규 창 열 때의 글로벌 폴백 테마로 저장 (SYSID 저장값 없을 때만 사용됨)
        // ※ 이미 열린 로그인/메인 창은 SYSID 기준 테마를 따르므로 ServerList 테마 변경을 전파하지 않는다(영향 X).
    }

    /* SYSID 기준 UX 테마 — 메인 페이지 옵션에서 userData 에 저장한 값을 읽는다.
       파일: <userData>/u4a-ws/uxThemeBySysid.json ({ "<SYSID>": "<theme>" })
       로그인 창을 열 때, 해당 서버 SYSID 의 저장 테마가 있으면 그걸로 로그인부터 적용한다.
       (없으면 "" 반환 → 호출부에서 ServerList 글로벌 THEME 로 폴백) */
    function readSysidUxTheme(sysid) {
        if (!sysid || typeof require !== "function") return "";
        try {
            const REMOTE = require("@electron/remote");
            const PATH   = require("path");
            const FS     = require("fs");
            const file = PATH.join(REMOTE.app.getPath("userData"), "u4a-ws", "uxThemeBySysid.json");
            if (!FS.existsSync(file)) return "";
            const obj = JSON.parse(FS.readFileSync(file, "utf8")) || {};
            const v = obj[sysid];
            return (THEMES.indexOf(v) >= 0) ? v : "";
        } catch (_) { return ""; }
    }

    /* ---------- 열린 로그인 창 추적 + 테마 실시간 전파 ----------
       로그인 창(ws30/ws10_20/index.html)은 별도 BrowserWindow + 랜덤 partition 이라
       localStorage 가 공유되지 않으므로, 테마 변경 시 IPC(webContents.send)로 직접 전파한다.
       수신측: ws30/ws10_20/index.js 의 'u4a-ws-ux-theme' 핸들러. */
    const aOpenLoginWins = [];
    function _trackLoginWin(win) { if (win && aOpenLoginWins.indexOf(win) < 0) aOpenLoginWins.push(win); }
    function _untrackLoginWin(win) { const i = aOpenLoginWins.indexOf(win); if (i >= 0) aOpenLoginWins.splice(i, 1); }
    function broadcastUxTheme(theme) {
        for (let i = aOpenLoginWins.length - 1; i >= 0; i--) {
            const w = aOpenLoginWins[i];
            try {
                if (!w || w.isDestroyed()) { aOpenLoginWins.splice(i, 1); continue; }
                w.webContents.send("u4a-ws-ux-theme", theme);
            } catch (_) { aOpenLoginWins.splice(i, 1); }
        }
    }
    function broadcastUxLang(lang) {
        for (let i = aOpenLoginWins.length - 1; i >= 0; i--) {
            const w = aOpenLoginWins[i];
            try {
                if (!w || w.isDestroyed()) { aOpenLoginWins.splice(i, 1); continue; }
                w.webContents.send("u4a-ws-ux-lang", lang);
            } catch (_) { aOpenLoginWins.splice(i, 1); }
        }
    }

    /* ---------- 상태 ---------- */
    // sort: null(기본=이름 asc) | "active"(Active 먼저) | "inactive"(Inactive 먼저)
    const state = { selectedNodeUuid: null, selectedRowUuid: null, search: "", sort: null };

    /* ---------- 마지막 선택 영구화 (localStorage) ---------- */
    const SEL_KEY = "u4a-ws-selection-v1";
    function loadSelection() {
        try {
            const raw = localStorage.getItem(SEL_KEY);
            if (!raw) return null;
            const o = JSON.parse(raw);
            return (o && typeof o === "object") ? o : null;
        } catch (_) { return null; }
    }
    function saveSelection() {
        try {
            localStorage.setItem(SEL_KEY, JSON.stringify({
                nodeUuid: state.selectedNodeUuid || null,
                rowUuid:  state.selectedRowUuid  || null,
            }));
        } catch (_) {}
    }

    /* ---------- 정렬 영구화 (localStorage) ----------
       v3 shape : [{ key, dir }, ...] | null   ← 멀티 정렬 (우선순위 = 배열 순서)
       v2 shape : { key, dir } | null          ← 단일 정렬 — 1회 마이그레이션 후 v2 키 삭제
       v1 shape : "active" | "inactive" | null ← STATUS 전용 — 1회 마이그레이션 후 v1 키 삭제 */
    const SORT_KEY    = "u4a-ws-sort-v3";
    const SORT_KEY_V2 = "u4a-ws-sort-v2";
    const SORT_KEY_V1 = "u4a-ws-sort-v1";
    function _validItem(s) { return s && typeof s === "object" && SORT_CMP[s.key] && (s.dir === "asc" || s.dir === "desc"); }
    function loadSort() {
        try {
            // v3
            const raw = localStorage.getItem(SORT_KEY);
            if (raw) {
                const o = JSON.parse(raw);
                if (Array.isArray(o)) {
                    const valid = o.filter(_validItem).map((s) => ({ key: s.key, dir: s.dir }));
                    if (valid.length) return valid;
                }
            }
            // v2 → v3 (단일 객체를 길이 1짜리 배열로 래핑)
            const rawV2 = localStorage.getItem(SORT_KEY_V2);
            if (rawV2) {
                const o = JSON.parse(rawV2);
                if (_validItem(o)) {
                    const migrated = [{ key: o.key, dir: o.dir }];
                    try { localStorage.setItem(SORT_KEY, JSON.stringify(migrated)); } catch (_) {}
                    try { localStorage.removeItem(SORT_KEY_V2); } catch (_) {}
                    return migrated;
                }
            }
            // v1 → v3
            const v1 = localStorage.getItem(SORT_KEY_V1);
            if (v1 === "active" || v1 === "inactive") {
                const migrated = [{ key: "status", dir: v1 === "active" ? "desc" : "asc" }];
                try { localStorage.setItem(SORT_KEY, JSON.stringify(migrated)); } catch (_) {}
                try { localStorage.removeItem(SORT_KEY_V1); } catch (_) {}
                return migrated;
            }
            return null;
        } catch (_) { return null; }
    }
    function saveSort() {
        try {
            if (Array.isArray(state.sort) && state.sort.length) localStorage.setItem(SORT_KEY, JSON.stringify(state.sort));
            else localStorage.removeItem(SORT_KEY);
        } catch (_) {}
    }

    /* ---------- 공통 helper ---------- */
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    function busy(on) { const el = document.getElementById("u4aWsBusyIndicator"); if (el) el.classList.toggle("is-hidden", !on); }
    function toast(msg) {
        const root = document.getElementById("ws-toast-root"); if (!root) return;
        const t = document.createElement("div"); t.className = "ws-toast"; t.textContent = msg;
        root.appendChild(t); setTimeout(() => t.remove(), 2200);
    }

    /* ---------- 컬럼 (비율 pct + 최소폭 min) ---------- */
    const COLS = [
        { key: "status", label: "STATUS",      pct: 17, min: 116 },
        { key: "name",   label: "SERVER NAME", pct: 28, min: 120 },
        { key: "sid",    label: "SID",          pct: 11, min: 72, center: true },
        { key: "host",   label: "HOST(Or IP)",  pct: 19, min: 128 },
        { key: "sno",    label: "SNO",          pct: 11, min: 64, center: true },
        { key: "act",    label: "Settings",     pct: 14, min: 96, center: true },
    ];

    /* ---------- 정렬 메타 ----------
       - SORT_CMP : asc 기준 비교함수 (desc 는 자동으로 부호 반전)
       - SORT_FIRST_DIR : 그 컬럼을 처음 클릭했을 때의 기본 방향
         * status 는 "Active 먼저 보기"가 자연스러우니 desc (테스트된 기존 동작과 동일)
         * 텍스트/숫자 컬럼은 A→Z / 0→9 가 자연스러우니 asc
       - 문자열 비교는 Intl.Collator(numeric:true) — IP / "1."·"10." 접두사 / SNO("00"<"10") 자연 정렬 */
    const COLLATOR = (typeof Intl !== "undefined" && Intl.Collator)
        ? new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
        : { compare: (a, b) => (a < b ? -1 : a > b ? 1 : 0) };
    const cmpStr = (a, b) => COLLATOR.compare(a == null ? "" : String(a), b == null ? "" : String(b));
    const SORT_CMP = {
        status: (a, b) => (a.active === b.active) ? 0 : (a.active ? 1 : -1),   // asc: Inactive 먼저, desc: Active 먼저
        name:   (a, b) => cmpStr(a.name, b.name),
        sid:    (a, b) => cmpStr(a.sid,  b.sid),
        host:   (a, b) => cmpStr(a.host, b.host),
        sno:    (a, b) => cmpStr(a.sno,  b.sno),
    };
    const SORT_FIRST_DIR = { status: "desc", name: "asc", sid: "asc", host: "asc", sno: "asc" };
    function isSortable(c) { return !!SORT_CMP[c.key]; }

    /* ---------- 트리 (레벨 유지: depth padding) ---------- */
    function treeNodes(arr, depth) {
        depth = depth || 0;
        if (!Array.isArray(arr) || !arr.length) return "";
        return `<ul>` + arr.map((n) => {
            const kids = Array.isArray(n.children) && n.children.length;
            const pad = 10 + depth * 16;
            return `<li>
                <div class="ws-tree-row is-open" data-uuid="${esc(n.uuid)}" style="padding-left:${pad}px">
                  <span class="ws-tree-toggle">${kids ? "▸" : ""}</span>
                  <span class="ws-tree-icon"><svg class="ws-ico" viewBox="0 0 24 24"><path d="M4 8V6a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.89l.82 1.22A2 2 0 0 0 14.07 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8z"/></svg></span>
                  <span class="ws-tree-label">${esc(n.name)}</span>
                </div>
                ${kids ? treeNodes(n.children, depth + 1) : ""}
              </li>`;
        }).join("") + `</ul>`;
    }
    function renderTree() {
        const root = document.getElementById("ws-tree");
        if (!root) return;
        const tree = window.WSData.state.tree;
        if (!tree || !tree.children || !tree.children.length) {
            root.innerHTML = `<div class="ws-empty"><div class="ws-empty__title">Workspace 정보가 없습니다.</div></div>`;
            return;
        }
        root.innerHTML = `<div class="ws-tree">${treeNodes(tree.children, 0)}</div>`;
        root.querySelectorAll(".ws-tree-row").forEach((el) => {
            el.onclick = (e) => {
                const tog = e.target.closest(".ws-tree-toggle");
                const sub = el.parentElement.querySelector(":scope > ul");
                if (tog && sub) {
                    el.classList.toggle("is-open");
                    sub.style.display = el.classList.contains("is-open") ? "" : "none";
                    return;
                }
                selectNode(el.getAttribute("data-uuid"));
            };
        });
        highlightTree();
    }
    function highlightTree() {
        document.querySelectorAll("#ws-tree .ws-tree-row").forEach((x) =>
            x.classList.toggle("is-selected", x.getAttribute("data-uuid") === state.selectedNodeUuid));
    }
    function selectNode(uuid) {
        if (state.selectedNodeUuid === uuid) return;
        state.selectedNodeUuid = uuid;
        // 행 선택 uuid 는 그대로 보관 — 같은 트리로 돌아오면 자연 복원, 없으면 무시
        saveSelection();
        highlightTree();
        renderTable();
    }

    /* ---------- 서버 목록 ---------- */
    function filteredRows() {
        const rows = window.WSData.getRows(state.selectedNodeUuid) || [];
        const q = state.search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => [r.name, r.sid, r.host, r.sno].join(" ").toLowerCase().indexOf(q) !== -1);
    }
    // 멀티 정렬 — 배열 순서대로 비교, 앞 컬럼이 동률이면 다음 컬럼으로. V8 stable sort 라 모든 컬럼 동률 시 입력 순서(이름 asc) 유지
    function sortedFilteredRows() {
        const rows = filteredRows();
        if (!Array.isArray(state.sort) || !state.sort.length) return rows;
        const arr = rows.slice();
        arr.sort((a, b) => {
            for (let i = 0; i < state.sort.length; i++) {
                const s = state.sort[i];
                const cmp = SORT_CMP[s.key];
                if (!cmp) continue;
                const r = cmp(a, b);
                if (r !== 0) return s.dir === "desc" ? -r : r;
            }
            return 0;
        });
        return arr;
    }
    // 매 클릭이 그 컬럼에만 작용: (없음) → firstDir → 반대 → (그 컬럼만 제거)
    // 다른 컬럼 클릭은 기존 정렬을 건드리지 않고 그대로 추가됨 → 멀티 정렬이 자연히 쌓임
    function cycleSort(key) {
        if (!SORT_CMP[key]) return;
        const firstDir = SORT_FIRST_DIR[key] || "asc";
        const opposite = firstDir === "asc" ? "desc" : "asc";
        const arr = Array.isArray(state.sort) ? state.sort.slice() : [];
        const idx = arr.findIndex((s) => s.key === key);
        if (idx < 0)                         arr.push({ key, dir: firstDir });        // 추가
        else if (arr[idx].dir === firstDir)  arr[idx] = { key, dir: opposite };        // 방향 반전
        else                                 arr.splice(idx, 1);                       // 그 컬럼만 제거
        state.sort = arr.length ? arr : null;
        saveSort();
        renderTable();
    }
    function badge(active) {
        return `<span class="ws-status ${active ? "active" : "inactive"}">${active ? t("status_active") : t("status_inactive")}</span>`;
    }
    function cell(it, c) {
        if (c.key === "status") return badge(it.active);
        if (c.key === "act") return `<div class="ws-row-actions">
            <button class="ws-row-btn" data-act="edit" title="${esc(t("act_edit_title"))}">${ICON.edit}</button>
            <button class="ws-row-btn danger" data-act="delete" title="${esc(t("act_delete_title"))}" ${it.active ? "" : "disabled"}>${ICON.trash}</button>
          </div>`;
        if (c.key === "name") return `<span class="ws-cell-name">${esc(it.name)}</span>`;
        if (c.key === "sid")  return `<span class="ws-chip">${esc(it.sid)}</span>`;
        if (c.key === "host") return `<span class="ws-host">${esc(it.host)}</span>`;
        return esc(it[c.key]);
    }
    function colClass(c) { return c.center ? "ws-col--center" : (c.right ? "ws-col--right" : ""); }

    function selectRow(uuid) {
        state.selectedRowUuid = uuid || null;
        saveSelection();
        const host = document.getElementById("ws-server-table");
        if (!host) return;
        host.querySelectorAll("tbody tr").forEach((x) =>
            x.classList.toggle("is-selected", x.getAttribute("data-uuid") === state.selectedRowUuid));
    }

    function renderTable() {
        const host = document.getElementById("ws-server-table");
        const cnt = document.getElementById("ws-server-count");
        if (!host) return;
        const rows = sortedFilteredRows();
        if (cnt) cnt.textContent = rows.length;

        if (!rows.length) {
            host.innerHTML = `<div class="ws-empty"><div class="ws-empty__title">${esc(t("empty_title"))}</div><div>${esc(t("empty_desc"))}</div></div>`;
            updateSortClearVisibility();
            return;
        }
        const cols = `<colgroup>` + COLS.map((c) => `<col style="width:${c.pct}%">`).join("") + `</colgroup>`;
        const sortArr = Array.isArray(state.sort) ? state.sort : [];
        const hasMulti = sortArr.length > 1;
        const ORDER_CIRCLED = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
        const head = `<thead><tr>` + COLS.map((c) => {
            const label = t("col_" + c.key);
            if (!isSortable(c)) return `<th class="${colClass(c)}">${esc(label)}</th>`;
            const idx     = sortArr.findIndex((s) => s.key === c.key);
            const sorted  = idx >= 0;
            const dir     = sorted ? sortArr[idx].dir : null;
            const arrow   = sorted ? (dir === "asc" ? "▲" : "▼") : "";
            const orderN  = idx + 1;
            const order   = (sorted && hasMulti) ? (orderN <= 9 ? ORDER_CIRCLED[orderN] : String(orderN)) : "";
            const dirName = t(SORT_FIRST_DIR[c.key] === "desc" ? "sort_dir_desc" : "sort_dir_asc");
            const tip     = t("sort_tip", { dir: dirName });
            const indBlk  = arrow ? `<span class="ws-sort-ind">${arrow}${order}</span>` : "";
            return `<th class="${colClass(c)} is-sortable${sorted ? ' is-sorted' : ''}" data-sort="${c.key}" title="${esc(tip)}"><span class="ws-th-inner"><span class="ws-th-label">${esc(label)}</span>${indBlk}</span></th>`;
        }).join("") + `</tr></thead>`;
        const body = rows.map((it) =>
            `<tr data-uuid="${esc(it.uuid)}">` + COLS.map((c) => `<td data-label="${esc(t("col_" + c.key))}" data-col-key="${c.key}" class="${colClass(c)}">${cell(it, c)}</td>`).join("") + `</tr>`
        ).join("");
        host.innerHTML = `<table class="ws-table">${cols}${head}<tbody>${body}</tbody></table>`;

        // 모든 정렬 가능 헤더에 토글 핸들러 위임 — 매 클릭이 그 컬럼에만 작용
        host.querySelectorAll('th[data-sort]').forEach((th) => {
            th.onclick = () => cycleSort(th.getAttribute("data-sort"));
        });

        host.querySelectorAll("tbody tr").forEach((tr) => {
            const uuid = tr.getAttribute("data-uuid");
            const row = rows.find((r) => r.uuid === uuid);
            tr.onclick = () => selectRow(uuid);
            tr.ondblclick = () => openServer(row);
            const eb = tr.querySelector('[data-act="edit"]');   if (eb) eb.onclick = (e) => { e.stopPropagation(); selectRow(uuid); editServer(row); };
            const db = tr.querySelector('[data-act="delete"]'); if (db) db.onclick = (e) => { e.stopPropagation(); selectRow(uuid); deleteServer(row); };
        });

        // 마지막 선택 행 복원 (현재 표시되는 행에만 적용 — 필터/트리 전환으로 사라진 경우는 자연 무시)
        if (state.selectedRowUuid) {
            const tr = host.querySelector(`tbody tr[data-uuid="${cssEscape(state.selectedRowUuid)}"]`);
            if (tr) tr.classList.add("is-selected");
        }

        // 정렬 해제 핀 가시성/카운트 동기화
        updateSortClearVisibility();
    }

    // querySelector 용 uuid 이스케이프 (uuid 는 보통 안전하지만 방어적으로)
    function cssEscape(s) {
        return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
    }

    /* ---------- 액션: 등록/수정/삭제 ----------
       더블클릭 동작 (구버전 oAPP.fn.fnPressServerListItem 참고):
         · Inactive (등록 안 됨) → 등록 다이얼로그(editServer) 호출
         · Active   (등록 됨)   → 새 BrowserWindow 로 로그인 페이지(ws30/ws10_20/index.html) 오픈
       ※ Electron(@electron/remote) 환경이 아니면 안내 토스트만 (기존 데모 동작 유지) */
    function openServer(row) {
        if (!row) return;
        if (!row.active) { editServer(row); return; }   // Inactive → 등록 팝업
        openLoginPageWindow(row);                        // Active   → 새 창
    }

    /* 새 브라우저 윈도우 오픈 (구버전 fnLoginPage 의 핵심 동작만 이식)
       - loadURL: <APPPATH>/ws30/ws10_20/index.html (+ 쿼리: browserkey/sessionKey/OBJTY/SYSID)
       - did-finish-load 시 if-meta-info 로 SERVERINFO/세션 키 전달 (구버전과 동일 채널)
       - oDefaultOption.browserWindow / 테마(P13N) 의존성은 새 프로젝트엔 없어서 안전한 기본값 사용 */
    function openLoginPageWindow(row) {
        // 비-Electron(브라우저 미리보기 등)인 경우는 기존처럼 안내 토스트만
        if (!window.WSData || !window.WSData.hasNode || typeof require !== "function") {
            toast(t("act_open", { name: row.name }));
            return;
        }

        let oBrowserWindow = null;
        try {
            const saved = window.WSData.getSavedByUuid && window.WSData.getSavedByUuid(row.uuid);
            // 안전망: active 인데 저장정보가 비어 있다면 등록 팝업으로 폴백
            if (!saved) { editServer(row); return; }
            const svc   = (window.WSData.getServiceByUuid && window.WSData.getServiceByUuid(row.uuid)) || {};

            const REMOTE  = require("@electron/remote");
            const PATH    = require("path");
            const APP     = REMOTE.app;
            const APPPATH = APP.getAppPath();

            const SESSKEY    = _randKey(40);
            const BROWSERKEY = _randKey(10);

            // 접속 SYSID 기준 저장 테마(메인 옵션에서 userData 에 저장한 값) → 없으면 ServerList 글로벌 THEME
            const sSysid    = svc.systemid || row.sid || "";
            const sWinTheme = readSysidUxTheme(sSysid) || THEME;

            // 첨부 이미지의 index.html 경로: <APPPATH>/ws30/ws10_20/index.html
            const filePath = PATH.join(APPPATH, "ws30", "ws10_20", "index.html");
            const fileUrl  = "file:///" + String(filePath).replace(/\\/g, "/");
            const qs = [
                "browserkey=" + encodeURIComponent(BROWSERKEY),
                "sessionKey=" + encodeURIComponent(SESSKEY),
                "OBJTY=MAIN",
                "SYSID="      + encodeURIComponent(sSysid),
                "u4aTheme="   + encodeURIComponent(sWinTheme), // SYSID 기준 테마를 로그인창에 전달(로그인부터 적용)
                "u4aLang="    + encodeURIComponent(LANG),       // 현재 ServerList 표시 언어를 로그인 창에 전달
            ].join("&");
            const sLoadUrl = fileUrl + "?" + qs;

            // BrowserWindow 옵션 — 구버전 fnLoginPage 와 동일 컨셉
            // (electron-window-state / browserSettings.json 의존성은 제거 — 합리적 기본값으로 대체)
            const oBrowserOptions = {
                width: 1000, height: 800, minWidth: 1000, minHeight: 800,
                titleBarStyle: "hidden",
                autoHideMenuBar: true,
                show: false,                                              // 첫 페인트 준비 전까지 숨김 → ready-to-show 에서 표시
                backgroundColor: THEME_BG[sWinTheme] || THEME_BG.purple,  // 첫 페인트 전 흰색 플래시 방지(SYSID 테마색)
                webPreferences: {
                    partition: SESSKEY,
                    browserkey: BROWSERKEY,
                    OBJTY: "MAIN",
                    SYSID: sSysid,
                    nodeIntegration: true,
                    contextIsolation: false,
                    webSecurity: false,
                },
            };

            busy(true);
            oBrowserWindow = new REMOTE.BrowserWindow(oBrowserOptions);
            _trackLoginWin(oBrowserWindow);   // 테마 실시간 전파 대상으로 등록
            try { oBrowserWindow.setMenu(null); } catch (_) {}

            // 느린 PC 대응: 첫 프레임이 그려질 준비가 됐을 때(ready-to-show)에만 창을 표시.
            //  - show:false + 테마색 backgroundColor 와 함께 → 흰색 플래시 없이 자연스럽게 등장
            //  - 만약 ready-to-show 가 비정상적으로 지연되어도 영구히 숨지 않도록 안전망(타임아웃) 둠
            let bShown = false;
            const showLoginWin = () => {
                if (bShown) { return; }
                bShown = true;
                try {
                    if (!oBrowserWindow.isDestroyed()) {
                        oBrowserWindow.show();
                        oBrowserWindow.focus();
                    }
                } catch (_) {}
            };
            oBrowserWindow.once("ready-to-show", showLoginWin);
            // 안전망: 일부 환경에서 ready-to-show 가 안 오는 경우 대비 (최대 3초 후 강제 표시)
            setTimeout(showLoginWin, 3000);

            oBrowserWindow.loadURL(sLoadUrl);

            // 새 창의 renderer 에서 @electron/remote 사용을 허용 (열어준 창 한정)
            try {
                const remoteMain = require("@electron/remote/main");
                if (remoteMain && remoteMain.enable) remoteMain.enable(oBrowserWindow.webContents);
            } catch (_) { /* 메인에서 이미 enable 되어 있거나 불필요한 환경이면 무시 */ }

            // 로그인 페이지에 넘길 메타 — 구버전 fnPressServerListItem / fnLoginPage 가 만들던 형태와 동일
            const oLoginInfo = {
                NAME:               row.name,
                SERVER_INFO:        saved,                                     // 저장된 접속정보(protocol/host/port/settings)
                SERVER_INFO_DETAIL: svc,                                       // XML 의 서비스 속성(원본)
                INSTANCENO:         svc.insno || row.sno || "",
                SYSTEMID:           svc.systemid || row.sid || "",
                CLIENT:             "",
                LANGU:              "",
                SYSID:              svc.systemid || row.sid || "",
                SETTINGS:           (saved && saved.settings) || undefined,
            };

            oBrowserWindow.webContents.on("did-finish-load", function () {
                busy(false);
                try {
                    oBrowserWindow.webContents.send("if-meta-info", {
                        SERVERINFO: oLoginInfo,
                        THEMEINFO:  null,       // 구버전은 fnP13nCreateTheme 결과 — 새 프로젝트엔 없으므로 null
                        EXEPAGE:    "LOGIN",
                        SESSIONKEY: SESSKEY,
                        BROWSERKEY: BROWSERKEY,
                    });
                } catch (e) { console.warn("[UI] if-meta-info 전송 실패:", e && e.message); }
            });

            oBrowserWindow.on("closed", () => { _untrackLoginWin(oBrowserWindow); oBrowserWindow = null; });
        } catch (e) {
            busy(false);
            console.error("[UI] 새 창 오픈 실패:", e);
            toast(t("act_open", { name: row.name }));
        }
    }

    // 세션/브라우저 키 생성 (구버전의 random-key 의존성을 제거하기 위한 내장 대체)
    function _randKey(n) {
        const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let s = "";
        for (let i = 0; i < n; i++) s += CH.charAt(Math.floor(Math.random() * CH.length));
        return s;
    }

    function editServer(row) {
        if (!row) return;
        openEditDialog(row);
    }

    function deleteServer(row) {
        if (!row || !row.active) return;
        openConfirmDialog(
            t("confirm_unregister_title"),
            t("confirm_unregister", { name: row.name }),
            (ok) => {
                if (!ok) return;
                const r = window.WSData.removeSaved(row.uuid);
                if (!r.ok) { toast(t("msg_remove_fail")); return; }
                toast(r.persisted ? t("msg_removed") : t("msg_removed_demo"));
                refreshFromState();
            }
        );
    }

    /* ---------- 편집 다이얼로그 (사진 2 레이아웃 · 핑크퍼플 톤) ---------- */
    function openEditDialog(row) {
        const existing = window.WSData.getSavedByUuid && window.WSData.getSavedByUuid(row.uuid);
        // 신규(등록 안 됨): Protocol 만 기본 https, Host/Port 는 공백
        // 수정(이미 등록): JSON 의 기존 값을 그대로 prefill
        const init = existing
            ? {
                protocol:        existing.protocol || "https",
                host:            existing.host || "",
                port:            existing.port || "",
                useInternal:     !!(existing.settings && existing.settings.useInternal),
                skipCertificate: !!(existing.settings && existing.settings.skipCertificate),
            }
            : { protocol: "https", host: "", port: "", useInternal: false, skipCertificate: false };

        const bodyHTML = `
            <div class="ws-field">
                <label class="ws-field__label" for="ws-edit-protocol">${esc(t("field_protocol"))}: <span class="ws-field__req">*</span></label>
                <select id="ws-edit-protocol" class="ws-select">
                    <option value="https">https</option>
                    <option value="http">http</option>
                </select>
            </div>
            <div class="ws-field">
                <label class="ws-field__label" for="ws-edit-host">${esc(t("field_host"))}: <span class="ws-field__req">*</span></label>
                <input id="ws-edit-host" class="ws-input" type="text" autocomplete="off" spellcheck="false" />
            </div>
            <div class="ws-field">
                <label class="ws-field__label" for="ws-edit-port">${esc(t("field_port"))}:</label>
                <input id="ws-edit-port" class="ws-input" type="text" inputmode="numeric" autocomplete="off" maxlength="5" />
            </div>
            <div class="ws-field ws-field--checks">
                <label class="ws-check"><input id="ws-edit-internal"  type="checkbox" /> <span>${esc(t("field_use_internal"))}</span></label>
                <label class="ws-check"><input id="ws-edit-skipcert" type="checkbox" /> <span>${esc(t("field_skip_cert"))}</span></label>
            </div>
        `;

        const modal = createModal({
            title: row.name || t("edit_title_new"),
            bodyHTML,
            actions: [
                { kind: "ok",     onClick: doSave },
                { kind: "cancel", onClick: () => closeModal(modal) },
            ],
        });

        // 초기값 주입
        modal.querySelector("#ws-edit-protocol").value = init.protocol;
        modal.querySelector("#ws-edit-host").value     = init.host;
        modal.querySelector("#ws-edit-port").value     = init.port;
        modal.querySelector("#ws-edit-internal").checked  = init.useInternal;
        modal.querySelector("#ws-edit-skipcert").checked  = init.skipCertificate;
        // 호스트로 포커스
        setTimeout(() => modal.querySelector("#ws-edit-host").focus(), 30);

        function doSave() {
            const $proto = modal.querySelector("#ws-edit-protocol");
            const $host  = modal.querySelector("#ws-edit-host");
            const $port  = modal.querySelector("#ws-edit-port");
            const protocol = $proto.value;
            const host     = $host.value.trim();
            const port     = $port.value.trim();
            const useInternal     = modal.querySelector("#ws-edit-internal").checked;
            const skipCertificate = modal.querySelector("#ws-edit-skipcert").checked;

            // 검증
            if (!host) { markInvalid($host); toast(t("val_host_required")); return; }
            if (port && !/^\d{1,5}$/.test(port)) { markInvalid($port); toast(t("val_port_format")); return; }
            if (port && (+port < 1 || +port > 65535)) { markInvalid($port); toast(t("val_port_range")); return; }

            const r = window.WSData.upsertSaved({
                uuid: row.uuid, protocol, host, port,
                settings: { useInternal, skipCertificate },
            });
            if (!r.ok) { toast(t("msg_save_fail")); return; }
            toast(r.persisted ? t("msg_saved") : t("msg_saved_demo"));
            closeModal(modal);
            refreshFromState();
        }
    }

    function markInvalid(el) {
        if (!el) return;
        el.classList.remove("is-invalid");          // 재트리거를 위해 한 번 떼고
        void el.offsetWidth;                         // 강제 reflow
        el.classList.add("is-invalid");
        try { el.focus(); el.select && el.select(); } catch (_) {}
        setTimeout(() => el.classList.remove("is-invalid"), 1400);
    }

    /* ---------- 확인 다이얼로그 ---------- */
    function openConfirmDialog(title, message, cb) {
        const modal = createModal({
            title,
            bodyHTML: `<div class="ws-confirm-msg">${esc(message).replace(/\n/g, "<br>")}</div>`,
            actions: [
                { kind: "ok",     onClick: () => { closeModal(modal); cb(true); } },
                { kind: "cancel", onClick: () => { closeModal(modal); cb(false); } },
            ],
        });
    }

    /* ---------- 모달 빌더 ---------- */
    function createModal(opts) {
        const backdrop = document.createElement("div");
        backdrop.className = "ws-modal-backdrop";
        backdrop.innerHTML = `
            <div class="ws-modal" role="dialog" aria-modal="true" aria-label="${esc(opts.title || "")}">
                <div class="ws-modal__head">
                    <img class="ws-modal__brand" src="${U4A_LOGO.png}" alt="U4A Workspace" draggable="false" onerror="${U4A_LOGO.ON_ERR}" />
                    <div class="ws-modal__title">${esc(opts.title || "")}</div>
                </div>
                <div class="ws-modal__body">${opts.bodyHTML || ""}</div>
                <div class="ws-modal__foot"></div>
            </div>
        `;
        const foot = backdrop.querySelector(".ws-modal__foot");
        (opts.actions || []).forEach((a) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "ws-fab " + (a.kind === "ok" ? "ws-fab--ok" : "ws-fab--cancel");
            b.title = a.kind === "ok" ? t("modal_save_tip") : t("modal_cancel_tip");
            b.innerHTML = a.kind === "ok" ? "✓" : "✕";
            b.onclick = (e) => { e.preventDefault(); a.onClick && a.onClick(); };
            foot.appendChild(b);
        });

        // 배경 클릭 = 취소
        backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) {
            const cancel = backdrop.querySelector(".ws-fab--cancel");
            if (cancel) cancel.click(); else closeModal(backdrop);
        } });

        // 키보드: Esc=취소, Enter=저장 (textarea/select 안에서는 select만 Enter 무시)
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                const cancel = backdrop.querySelector(".ws-fab--cancel");
                if (cancel) cancel.click(); else closeModal(backdrop);
            } else if (e.key === "Enter") {
                const tag = (e.target && e.target.tagName) || "";
                if (tag === "TEXTAREA" || tag === "BUTTON") return;
                e.preventDefault();
                const ok = backdrop.querySelector(".ws-fab--ok");
                if (ok) ok.click();
            }
        };
        backdrop.__onKey = onKey;
        document.addEventListener("keydown", onKey);

        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add("is-open"));
        return backdrop;
    }

    function closeModal(m) {
        if (!m) return;
        if (m.__onKey) { document.removeEventListener("keydown", m.__onKey); m.__onKey = null; }
        m.classList.remove("is-open");
        setTimeout(() => { if (m.parentNode) m.parentNode.removeChild(m); }, 180);
    }

    /* ---------- splitter 드래그 (반응형 폭 보정) ----------
       핵심: 트리 폭은 절대 px 로 저장하되, "유효 범위" 를 항상 현재 창 크기 기준으로 다시 계산한다.
       - 서버 패널은 항상 SERVER_MIN 이상 → 스플리터가 화면 밖으로 밀려나지 않음 (창 축소 시에도 항상 잡힘)
       - 창이 충분히 넓으면 서버가 팝인(카드) 임계 이상을 유지하도록 우선 확보 → 불필요한 카드 전환 방지
       - 창 리사이즈(최대화/복원 포함)마다 현재 트리 폭을 다시 보정 */
    const TREE_MIN = 170;       // 트리 패널 최소 폭
    const SERVER_MIN = 260;     // 서버 패널 하한 (이 이하로는 절대 안 줄어듦 → 스플리터 항상 노출)
    const SPLITTER_W = 8;       // .ws-splitter 폭 (CSS 와 동기)
    const DEFAULT_TREE_W = 200; // 트리 패널 기본 폭 — 매 실행 시 이 값으로 시작 (localStorage 저장/복원 없음)

    function popinThreshold() {
        const need = Math.max.apply(null, COLS.map((c) => c.min / (c.pct / 100)));
        return Math.round(need) + 36;
    }
    // ws-main 의 안쪽 가용 폭 (좌우 패딩 제외)
    function mainInnerWidth() {
        const main = document.getElementById("ws-main");
        if (!main) return 0;
        const r = main.getBoundingClientRect();
        const cs = getComputedStyle(main);
        return r.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    }
    // 현재 창 기준 트리 폭 상한: 서버 패널이 항상 SERVER_MIN 이상이 되도록만 제한.
    // → 작은 창에서도 스플리터가 넓게 움직임. 트리를 넓히면 서버는 자연히 카드(팝인) 모드로 전환됨.
    function treeMaxWidth() {
        const avail = mainInnerWidth();
        if (avail <= 0) return TREE_MIN;
        return Math.max(TREE_MIN, avail - SPLITTER_W - SERVER_MIN);
    }
    function clampTreeWidth(px) {
        return Math.max(TREE_MIN, Math.min(px, treeMaxWidth()));
    }
    function currentTreeWidthPx() {
        const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ws-tree-w"));
        return isNaN(v) ? DEFAULT_TREE_W : v;
    }
    function setTreeWidth(px, _persist) {
        // _persist 파라미터는 시그니처 호환을 위해 남겨두지만 무시함 — 트리 폭은 저장하지 않음 (요구사항)
        const w = clampTreeWidth(px);
        document.documentElement.style.setProperty("--ws-tree-w", w + "px");
        return w;
    }
    function loadTreeWidth() {
        // localStorage 를 읽지 않음 — 매 실행 시 항상 DEFAULT_TREE_W(200px) 로 시작
        return DEFAULT_TREE_W;
    }

    function wireSplitter() {
        const main = document.getElementById("ws-main");
        const sp = document.getElementById("ws-splitter");
        if (!main || !sp) return;

        // 시작 폭 복원 (저장값 → 현재 창에 맞게 보정)
        setTreeWidth(loadTreeWidth(), false);

        let dragging = false;
        const onMove = (e) => {
            if (!dragging) return;
            const r = main.getBoundingClientRect();
            const cs = getComputedStyle(main);
            const padL = parseFloat(cs.paddingLeft) || 0;
            // 마우스 위치 → 트리 폭 (스플리터를 손잡이 중앙으로 잡도록 절반 보정)
            const w = e.clientX - r.left - padL - SPLITTER_W / 2;
            setTreeWidth(w, true);
        };
        const stop = () => {
            dragging = false; main.classList.remove("is-resizing"); sp.classList.remove("is-active");
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", stop);
        };
        sp.addEventListener("mousedown", (e) => {
            e.preventDefault(); dragging = true; main.classList.add("is-resizing"); sp.classList.add("is-active");
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", stop);
        });
        sp.addEventListener("dblclick", () => setTreeWidth(DEFAULT_TREE_W, true));

        // 창 리사이즈(최대화/복원/축소) 시 현재 폭을 유효 범위로 재보정 → 스플리터·서버 패널 항상 노출
        let rafId = 0;
        const reclamp = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => setTreeWidth(currentTreeWidthPx(), false));
        };
        window.addEventListener("resize", reclamp);
        if (window.ResizeObserver) { try { new ResizeObserver(reclamp).observe(main); } catch (_) {} }
    }

    /* ---------- pop-in: 서버 패널(테이블 호스트) 폭 감시 ---------- */
    function watchTableWidth() {
        const host = document.getElementById("ws-server-table");
        if (!host) return;
        const TH = popinThreshold();
        const apply = (w) => host.classList.toggle("is-narrow", w < TH);
        if (window.ResizeObserver) new ResizeObserver((es) => { for (const e of es) apply(e.contentRect.width); }).observe(host);
        else window.addEventListener("resize", () => apply(host.clientWidth));
        apply(host.clientWidth);
    }

    /* ---------- 검색 ---------- */
    function wireSearch() {
        const input = document.getElementById("ws-search-input");
        if (!input) return;
        input.addEventListener("input", () => { state.search = input.value || ""; renderTable(); });
    }

    /* ---------- 정렬 전체 해제 핀 (멀티 정렬 발견성 + clear-all) ---------- */
    function wireSortClear() {
        const toolbar = document.querySelector(".ws-toolbar");
        if (!toolbar || document.getElementById("ws-sort-clear")) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = "ws-sort-clear";
        btn.className = "ws-sort-clear is-hidden";
        btn.title = t("sort_clear_title");
        btn.innerHTML =
            `<span class="ws-sort-clear__text">${esc(t("sort_clear_label"))}</span>` +
            `<span class="ws-sort-clear__count">0</span>` +
            `<span class="ws-sort-clear__x" aria-hidden="true">✕</span>`;
        btn.onclick = () => {
            if (!Array.isArray(state.sort) || !state.sort.length) return;
            state.sort = null;
            saveSort();
            renderTable();      // 핀 가시성도 여기서 같이 갱신됨
        };
        toolbar.appendChild(btn);
    }
    function updateSortClearVisibility() {
        const btn = document.getElementById("ws-sort-clear");
        if (!btn) return;
        // 텍스트·title 도 현재 언어로 갱신
        btn.title = t("sort_clear_title");
        const txt = btn.querySelector(".ws-sort-clear__text");
        if (txt) txt.textContent = t("sort_clear_label");
        const n = Array.isArray(state.sort) ? state.sort.length : 0;
        if (n > 0) {
            btn.classList.remove("is-hidden");
            const cnt = btn.querySelector(".ws-sort-clear__count");
            if (cnt) cnt.textContent = String(n);
        } else {
            btn.classList.add("is-hidden");
        }
    }

    /* ---------- 창 제어 ---------- */
    function wireWindowButtons() {
        let win = null;
        try { if (typeof require === "function") win = require("@electron/remote").getCurrentWindow(); } catch (_) {}
        const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
        on("ws-win-min",   () => win && win.minimize());
        on("ws-win-max",   () => win && (win.isMaximized() ? win.unmaximize() : win.maximize()));
        on("ws-win-close", () => win && win.close());

        // 최대화/복원 상태에 따라 최대화 버튼 아이콘(사각형 ↔ 겹친 사각형) 토글
        const maxBtn = document.getElementById("ws-win-max");
        const syncMaxIcon = () => {
            if (!maxBtn) return;
            let m = false; try { m = !!(win && win.isMaximized()); } catch (_) {}
            maxBtn.classList.toggle("is-maximized", m);
            maxBtn.title = m ? "Restore" : "Maximize";
        };
        if (win && typeof win.on === "function") {
            try { win.on("maximize", syncMaxIcon); win.on("unmaximize", syncMaxIcon); } catch (_) {}
        }
        syncMaxIcon();
    }

    /* ---------- Refresh / 설정 메뉴 ---------- */
    let _settingsWired = false;
    function rebuildSettingsMenu() {
        const menu = document.getElementById("ws-settings-menu");
        if (!menu) return;
        const items = [
            { key: "language", labelKey: "menu_language", icon: ICON.language },
            { key: "theme",    labelKey: "menu_theme",    icon: ICON.theme    },
            { key: "sound",    labelKey: "menu_sound",    icon: ICON.sound    },
            { key: "about",    labelKey: "menu_about",    icon: ICON.about    },
        ];
        menu.innerHTML = items.map((it) =>
            `<div class="ws-menu__item" data-it="${it.key}"><span class="ws-menu__ico" aria-hidden="true">${it.icon}</span><span class="ws-menu__text">${esc(t(it.labelKey))}</span></div>`
        ).join("");
        menu.querySelectorAll(".ws-menu__item").forEach((el) => {
            el.onclick = () => {
                menu.classList.add("is-hidden");
                const key = el.getAttribute("data-it");
                if (key === "language") { openLanguageDialog(); return; }
                if (key === "theme")    { openThemeDialog();    return; }
                if (key === "about")    { openAboutDialog();    return; }
                const labelKey = "menu_" + key;
                toast(t("menu_not_impl", { name: t(labelKey) }));
            };
        });
    }
    function wireHeader() {
        const refresh = document.getElementById("ws-refresh");
        if (refresh) refresh.onclick = () => loadAll(true);

        const btn = document.getElementById("ws-settings-btn");
        const menu = document.getElementById("ws-settings-menu");
        if (btn && menu) {
            rebuildSettingsMenu();
            if (!_settingsWired) {
                btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle("is-hidden"); };
                document.addEventListener("click", () => menu.classList.add("is-hidden"));
                _settingsWired = true;
            }
        }
    }

    /* ---------- 언어 설정 다이얼로그 ---------- */
    function openLanguageDialog() {
        const cur = LANG;
        const body = `
            <div class="ws-field">
                <label class="ws-field__label" for="ws-lang-select">${esc(t("lang_label"))}: <span class="ws-field__req">*</span></label>
                <select id="ws-lang-select" class="ws-select">
                    <option value="en">EN — English</option>
                    <option value="ko">KO — 한국어</option>
                </select>
            </div>
        `;
        const modal = createModal({
            title: t("lang_title"),
            bodyHTML: body,
            actions: [
                { kind: "ok",     onClick: doSave },
                { kind: "cancel", onClick: () => closeModal(modal) },
            ],
        });
        modal.querySelector("#ws-lang-select").value = cur;
        function doSave() {
            const next = modal.querySelector("#ws-lang-select").value;
            setLanguage(next);
            toast(t("msg_saved"));
            closeModal(modal);
        }
    }

    /* ---------- 테마 설정 다이얼로그 ---------- */
    function openThemeDialog() {
        const cur = THEME;
        const body = `
            <div class="ws-field">
                <label class="ws-field__label" for="ws-theme-select">${esc(t("theme_label"))}: <span class="ws-field__req">*</span></label>
                <select id="ws-theme-select" class="ws-select">
                    <option value="purple">${esc(t("theme_purple"))}</option>
                    <option value="dark">${esc(t("theme_dark"))}</option>
                    <option value="white">${esc(t("theme_white"))}</option>
                </select>
            </div>
        `;
        const modal = createModal({
            title: t("theme_title"),
            bodyHTML: body,
            actions: [
                { kind: "ok",     onClick: doSave },
                { kind: "cancel", onClick: () => { setTheme(cur); closeModal(modal); } },
            ],
        });
        const $sel = modal.querySelector("#ws-theme-select");
        $sel.value = cur;
        // 라이브 프리뷰: 선택 변경 즉시 ServerList 자체 UI 만 미리보기 (취소 시 원복).
        //  ※ 다른 창(로그인/메인)에는 전파하지 않음 — 그 창들은 SYSID 기준 테마를 따른다.
        $sel.addEventListener("change", () => { applyTheme($sel.value); });
        function doSave() {
            const next = $sel.value;
            setTheme(next);
            toast(t("msg_saved"));
            closeModal(modal);
        }
    }

    /* ---------- About 전역 브릿지 ----------
       aboutWs.html 은 iframe 안에서 parent(.parent).REMOTE / WSUTIL / APP 로 전역을 읽는다.
       iframe 의 parent = 이 ServerList 창이므로, 여기서 window 에 해당 전역을 올려두면 About 이 접근할 수 있다.
       - Electron(nodeIntegration) 에서만 동작 → 브라우저/데모 미리보기에서는 조용히 패스 (기존 동작 불변)
       - About 을 열 때만 1회 지연 셋업 (시작 비용/데모 에러 방지) */
    function setupAboutBridge() {
        if (window.WSUTIL && window.REMOTE && window.APP) return true;   // 이미 셋업됨
        if (typeof require !== "function") return false;                 // 비-Electron(데모/브라우저) → 패스
        try {
            const REMOTE   = require("@electron/remote");
            const PATH     = REMOTE.require("path");
            const APP      = REMOTE.app;
            const APPPATH  = APP.getAppPath();
            const PATHINFO = require(PATH.join(APPPATH, "ws30", "resources", "pathInfo.js"));
            const reqFn    = (parent && typeof parent.require === "function") ? parent.require : require;
            const WSUTIL   = reqFn(PATHINFO.WSUTIL);
            // aboutWs.html 이 parent.X 로 읽을 수 있도록 ServerList 창 전역에 노출
            window.REMOTE = REMOTE;
            window.PATH = PATH;
            window.APP = APP;
            window.APPPATH = APPPATH;
            window.PATHINFO = PATHINFO;
            window.WSUTIL = WSUTIL;
            return true;
        } catch (e) {
            console.error("[About] 전역 브릿지 설정 실패:", e);
            return false;
        }
    }

    /* ---------- About(정보) 다이얼로그 ----------
       옵션 메뉴 → About 클릭 시 aboutWs.html 을 iframe 으로 오버레이 표시.
       - 폴더 구조: 이 코드는 www/ServerList_v2/ 안, aboutWs.html 은 상위 폴더 www/ 에 위치
         → iframe src 는 ServerList.html 기준 상대경로 "../aboutWs.html" (상위 폴더)
       - 기존 .ws-modal-backdrop(고정 풀스크린/블러/페이드) + closeModal(키핸들러 정리/페이드/제거) 재사용
       - aboutWs.html 은 parent(.parent).WSUTIL/REMOTE/APP 전역에 접근 → iframe 의 parent 가 이 창이므로 실환경에서 그대로 동작
       - Esc / 배경 클릭 / ✕ 로 닫힘 (등록·수정 모달과 동일한 UX) */
    function openAboutDialog() {
        // 중복 방지: 이미 열려 있으면 재사용
        if (document.querySelector(".ws-about-backdrop")) return;

        // iframe(aboutWs.html) 이 로드되기 전에 전역 브릿지를 먼저 셋업 → parent.WSUTIL 등 즉시 접근 가능
        setupAboutBridge();

        const backdrop = document.createElement("div");
        backdrop.className = "ws-modal-backdrop ws-about-backdrop";
        backdrop.innerHTML = `
            <div class="ws-about-modal" role="dialog" aria-modal="true" aria-label="${esc(t("menu_about"))}">
                <button class="ws-about-close" type="button" title="${esc(t("win_close"))}" aria-label="${esc(t("win_close"))}">✕</button>
                <iframe class="ws-about-frame" src="../aboutWs.html" title="${esc(t("menu_about"))}"></iframe>
            </div>`;

        const close = () => closeModal(backdrop);
        backdrop.querySelector(".ws-about-close").onclick = close;
        // 배경(백드롭) 클릭 시 닫기 — 모달 내부 클릭은 무시
        backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });
        // Esc 닫기 (closeModal 이 정리할 수 있도록 __onKey 에 보관)
        const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
        backdrop.__onKey = onKey;
        document.addEventListener("keydown", onKey);

        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add("is-open"));
    }
    let _watching = false;
    function startWatchOnce() {
        if (_watching) return;
        try {
            window.WSData.startWatch && window.WSData.startWatch(() => {
                console.log("[UI] XML 변경 감지 → 갱신"); refreshFromState();
            });
            _watching = true;
        } catch (_) {}
    }
    function refreshFromState() {
        renderTree();
        if (!state.selectedNodeUuid || !document.querySelector(`#ws-tree [data-uuid="${state.selectedNodeUuid}"]`)) {
            state.selectedNodeUuid = window.WSData.firstSelectableUuid();
            highlightTree();
        }
        renderTable();
    }
    async function loadAll(isRefresh) {
        busy(true);
        try {
            await window.WSData.load();
            // 최초 적재 시: localStorage 의 마지막 선택/정렬 을 복원
            // Refresh 시: 현재 in-memory 상태 유지 (refreshFromState 가 유효성 검사 후 폴백)
            if (!isRefresh) {
                const sel = loadSelection();
                if (sel) {
                    state.selectedNodeUuid = sel.nodeUuid || null;
                    state.selectedRowUuid  = sel.rowUuid  || null;
                }
                state.sort = loadSort();
            }
            refreshFromState();
            startWatchOnce();                 // 경로 확정 후 1회 감시 등록
            if (isRefresh) toast(t("msg_refreshed"));
        } catch (e) {
            const host = document.getElementById("ws-server-table");
            const msg = e && e.message === "XML_NOT_FOUND" ? t("err_xml_missing")
                : (e && e.message === "NODE_UNAVAILABLE" ? t("err_no_node") : t("err_generic"));
            if (host) host.innerHTML = `<div class="ws-empty"><div class="ws-empty__title">${esc(t("err_load_title"))}</div><div>${esc(msg)}</div></div>`;
            console.error("[UI] 적재 실패:", e);
        } finally { busy(false); }
    }

    /* ---------- 말풍선 툴팁 (긴 텍스트 잘림 시) ----------
       - 대상: 트리 라벨(.ws-tree-label) + 테이블 데이터 셀(.ws-table tbody td:not(.ws-col--right))
       - 표시 조건:
         (a) 자체 ellipsis : scrollWidth > clientWidth  (테이블 셀)
         (b) 스크롤 부모 클립: 부모 overflow auto/scroll/hidden 안에서 bounding rect 가 벗어남 (트리 라벨)
       - 카드 모드(.is-narrow) 의 td 는 white-space:normal; overflow:visible 이라 자연스럽게 비활성 */
    function initTooltip() {
        if (document.querySelector(".ws-tip")) return;
        const tip = document.createElement("div");
        tip.className = "ws-tip";
        tip.setAttribute("role", "tooltip");
        document.body.appendChild(tip);

        const SHOW_DELAY = 280;
        let target = null;
        let timer  = 0;
        const SEL = ".ws-tree-label, .ws-table tbody td:not(.ws-col--right)";

        function findScrollParent(el) {
            let p = el && el.parentElement;
            while (p) {
                const s = getComputedStyle(p);
                if (/(auto|scroll|hidden)/.test(s.overflowX) || /(auto|scroll|hidden)/.test(s.overflow)) return p;
                p = p.parentElement;
            }
            return null;
        }
        function isClipped(el) {
            if (!el) return false;
            if (el.scrollWidth > el.clientWidth + 1) return true;
            const parent = findScrollParent(el);
            if (!parent) return false;
            const er = el.getBoundingClientRect();
            const pr = parent.getBoundingClientRect();
            return er.left < pr.left - 1 || er.right > pr.right + 1;
        }
        function place(el) {
            const er = el.getBoundingClientRect();
            const tr = tip.getBoundingClientRect();
            const vw = window.innerWidth, vh = window.innerHeight;
            let top  = er.top - tr.height - 8;
            let left = er.left + er.width / 2 - tr.width / 2;
            if (top < 4) top = er.bottom + 8;                                // 위 공간 없으면 아래로
            if (top + tr.height > vh - 4) top = vh - tr.height - 4;
            if (left < 4) left = 4;
            if (left + tr.width  > vw - 4) left = vw - tr.width  - 4;
            tip.style.top  = top  + "px";
            tip.style.left = left + "px";
        }
        function show(el) {
            const text = (el.textContent || "").trim();
            if (!text) { hide(); return; }
            tip.textContent = text;
            tip.classList.add("is-visible");
            place(el);
        }
        function hide() { tip.classList.remove("is-visible"); }

        // 위임: mouseover 한 번이면 트리/테이블 둘 다 커버
        document.addEventListener("mouseover", (e) => {
            const el = e.target.closest(SEL);
            if (el === target) return;
            target = el;
            clearTimeout(timer);
            if (!el) { hide(); return; }
            timer = setTimeout(() => {
                if (target === el && isClipped(el)) show(el);
                else hide();
            }, SHOW_DELAY);
        });
        // 안전망: 스크롤·리사이즈·블러·클릭 시 즉시 숨김
        window.addEventListener("scroll", hide, true);
        window.addEventListener("resize", hide);
        window.addEventListener("blur",   hide);
        document.addEventListener("mousedown", hide);
    }

    /* ---------- init ---------- */
    function init() {
        LANG = loadLanguage();
        applyStaticI18n();
        applyTheme(loadTheme());
        wireWindowButtons();
        wireHeader();
        wireSearch();
        wireSortClear();
        wireSplitter();
        watchTableWidth();
        initTooltip();
        loadAll(false);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

})();
