/************************************************************************
 * u4a-header.js — U4A Workspace 공통 헤더(타이틀바) 단일 동작 소스
 * ----------------------------------------------------------------------
 *  모든 창(ServerList / 로그인·메인 호스트 / 새 창)이 이 파일 하나로
 *  타이틀바를 렌더 + 창 제어(최소화/최대화·복원/닫기)를 처리한다.
 *
 *  ▶ 사용법 (창마다 한 번):
 *      <link rel="stylesheet" href="…/common/header/u4a-header.css">
 *      <header id="u4a-header"></header>
 *      <script src="…/common/header/u4a-header.js"></script>
 *      <script>
 *        var hdr = U4AHeader.mount("u4a-header", {
 *          title:   "U4A Workspace - Main",
 *          logo:    "…/img/logo.png",
 *          onClose: fnCustomClose,    // (생략 가능) 없으면 win.close()
 *          i18n:    { brand:"brand", min:"win_min", max:"win_max", close:"win_close" } // (생략 가능)
 *        });
 *        hdr.setTitle("…");
 *
 *  ▶ 드래그: 타이틀바의 CSS `-webkit-app-region: drag`(u4a-header.css)로 OS 가
 *           직접 처리한다. JS 는 창버튼만 담당. (창 이동·끝 스냅·더블클릭 최대화 = 네이티브)
 *
 *  ▶ 아이콘/스타일 변경 → 이 파일(ICONS) + u4a-header.css 만 고치면 전 창 반영.
 *
 *  ※ Electron 렌더러(@electron/remote 사용). 비-Electron 에서 열려도 안전(가드).
 ************************************************************************/
(function (global) {
    "use strict";

    function _getWin() {
        try {
            if (typeof require === "function") {
                return require("@electron/remote").getCurrentWindow();
            }
        } catch (_) {}
        return null;
    }

    function _esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
        });
    }

    /* ── 창 제어 아이콘(SVG 라인) — 모양 변경은 여기만 고치면 전 창 반영 ── */
    var ICONS = {
        min: '<svg class="u4a-hdr__winicon" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><line x1="1.5" y1="5" x2="8.5" y2="5" /></svg>',
        max: '<svg class="u4a-hdr__winicon u4a-hdr__winicon--max" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="7" height="7" rx="1.2" /></svg>',
        restore: '<svg class="u4a-hdr__winicon u4a-hdr__winicon--restore" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><rect x="1.3" y="3" width="5.7" height="5.7" rx="1" /><path d="M3.4 3 V2.1 a1 1 0 0 1 1-1 H8.7 a1 1 0 0 1 1 1 V6.4 a1 1 0 0 1 -1 1 H7" /></svg>',
        close: '<svg class="u4a-hdr__winicon" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><line x1="1.6" y1="1.6" x2="8.4" y2="8.4" /><line x1="8.4" y1="1.6" x2="1.6" y2="8.4" /></svg>'
    };

    function _buildMarkup(opts) {
        var i18n = opts.i18n || {};
        var aBrand = i18n.brand ? ' data-i18n="' + _esc(i18n.brand) + '"' : '';
        var aMin = i18n.min ? ' data-i18n-title="' + _esc(i18n.min) + '"' : '';
        var aMax = i18n.max ? ' data-i18n-title="' + _esc(i18n.max) + '"' : '';
        var aClose = i18n.close ? ' data-i18n-title="' + _esc(i18n.close) + '"' : '';

        var sLogo = opts.logo
            ? '<img class="u4a-hdr__logo" src="' + _esc(opts.logo) + '" alt="U4A Workspace" draggable="false" onerror="this.style.visibility=\'hidden\'" />'
            : '';

        return ''
            + '<div class="u4a-hdr__brand">'
            +     sLogo
            +     '<span class="u4a-hdr__title"' + aBrand + '>' + _esc(opts.title || "U4A Workspace") + '</span>'
            + '</div>'
            + '<div class="u4a-hdr__winbtns">'
            +     '<button type="button" class="u4a-hdr__winbtn" data-win="min" title="Minimize" aria-label="Minimize"' + aMin + '>' + ICONS.min + '</button>'
            +     '<button type="button" class="u4a-hdr__winbtn" data-win="max" title="Maximize" aria-label="Maximize"' + aMax + '>' + ICONS.max + ICONS.restore + '</button>'
            +     '<button type="button" class="u4a-hdr__winbtn u4a-hdr__winbtn--close" data-win="close" title="Close" aria-label="Close"' + aClose + '>' + ICONS.close + '</button>'
            + '</div>';
    }

    /**
     * 공통 헤더를 target 요소에 렌더 + 동작 연결.
     * @param {string|HTMLElement} target  헤더를 그릴 요소(또는 id)
     * @param {object} [opts]  { title, logo, onClose, i18n }
     * @returns {object|null}  { el, win, setTitle, destroy }
     */
    function mount(target, opts) {
        opts = opts || {};

        var el = (typeof target === "string") ? document.getElementById(target) : target;
        if (!el) {
            try { console.warn("[U4AHeader] mount 대상 요소 없음:", target); } catch (_) {}
            return null;
        }

        el.classList.add("u4a-hdr");
        el.setAttribute("role", "banner");
        el.innerHTML = _buildMarkup(opts);

        var win = _getWin();
        var maxBtn = el.querySelector('[data-win="max"]');

        /* 최대화/복원 상태에 따라 최대화 버튼 아이콘 토글 */
        function _syncMaxIcon() {
            if (!maxBtn) { return; }
            var bMax = false;
            try { bMax = !!(win && win.isMaximized()); } catch (_) {}
            maxBtn.classList.toggle("is-maximized", bMax);
            maxBtn.title = bMax ? "Restore" : "Maximize";
        }

        /* 창버튼 클릭 처리 (드래그는 CSS app-region 이 담당) */
        el.addEventListener("click", function (e) {
            var btn = e.target && e.target.closest && e.target.closest("[data-win]");
            if (!btn || !el.contains(btn)) { return; }
            var act = btn.getAttribute("data-win");
            if (act === "min") {
                try { if (win) win.minimize(); } catch (_) {}
            } else if (act === "max") {
                try { if (win) { win.isMaximized() ? win.unmaximize() : win.maximize(); } } catch (_) {}
            } else if (act === "close") {
                if (typeof opts.onClose === "function") {
                    try { opts.onClose(); } catch (_) {}
                } else {
                    try { if (win) win.close(); else window.close(); } catch (_) {}
                }
            }
        });

        if (win && typeof win.on === "function") {
            try { win.on("maximize", _syncMaxIcon); win.on("unmaximize", _syncMaxIcon); } catch (_) {}
        }
        _syncMaxIcon();

        return {
            el: el,
            win: win,
            setTitle: function (sText) {
                var t = el.querySelector(".u4a-hdr__title");
                if (t) { t.textContent = (sText == null ? "" : String(sText)); }
            },
            syncMaxIcon: _syncMaxIcon,
            destroy: function () {
                if (win && typeof win.removeListener === "function") {
                    try {
                        win.removeListener("maximize", _syncMaxIcon);
                        win.removeListener("unmaximize", _syncMaxIcon);
                    } catch (_) {}
                }
            }
        };
    }

    global.U4AHeader = { mount: mount, ICONS: ICONS };

})(typeof window !== "undefined" ? window : this);
