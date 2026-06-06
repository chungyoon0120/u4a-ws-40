/*************************************************************
 * mainAppBoot.js
 * ----------------------------------------------------------
 *  WS30 "메인 앱" 부트스트랩 (UI5 기반 — 추후 HTML 변환 대상).
 *
 *  index.js 의 진입 분기에서 "로그인 정보가 있을 때"(새 메인창 / 로그인 성공 후)
 *  에만 동적으로 로드된다. 로그인 경로에서는 절대 로드되지 않으므로,
 *  index.js / 로그인 경로에는 UI5 로드 코드가 존재하지 않는다.
 *
 *  공개 API:
 *    window.__bootMainApp()  - UI5 부트스트랩 시작
 *    window._onMainUI5Init() - UI5 onInit 콜백 (library-preload 로드)
 *************************************************************/
(function () {
    "use strict";

    /*********************************************************
     * Node 글로벌 변수를 백업본으로부터 복구한다. (UI5 부트스트랩 이후)
     *********************************************************/
    function _restoreNodeGlobals() {

        if (!window.__node) {
            return;
        }

        console.log('[System] Restoring Node environment variables...');

        window.require = window.__node.require;
        window.module = window.__node.module;
        window.exports = window.__node.exports;

        delete window.__node;

    } // end of _restoreNodeGlobals


    /*********************************************************
     * UI5 부트스트랩 시작
     *********************************************************/
    window.__bootMainApp = function () {

        let oContent = document.getElementById("content");
        if (oContent) {
            oContent.style.display = "none";
        }

        /**************************************************************
         * 🔥 UI5 ↔ Electron Node 충돌 방지:
         *    UI5 bootstrap 전 글로벌 require/module/exports 격리
         **************************************************************/
        (function () {
            if (typeof module !== 'object' || typeof require !== 'function') {
                return;
            }
            console.log('[System] Node environment detected. Isolating global variables for UI5 bootstrap...');
            window.__node = {
                require: window.require,
                module: window.module,
                exports: window.exports
            };
            window.require = undefined;
            window.module = undefined;
            window.exports = undefined;
        }());

        /**************************************************************
         * 🔥 UI5 Bootstrap 삽입
         **************************************************************/
        (function () {

            let oSettings = parent.WSUTIL.getWsSettingsInfo();
            let oSetting_UI5 = oSettings.UI5;
            let oBootStrap = oSetting_UI5.bootstrap;
            let oThemeInfo = parent.getThemeInfo();
            let sLangu = oSettings.globalLanguage;

            let oScript = document.createElement('script');
            oScript.id = 'sap-ui-bootstrap';

            for (const key in oBootStrap) {
                oScript.setAttribute(key, oBootStrap[key]);
            }

            oScript.setAttribute('data-sap-ui-theme', oThemeInfo.THEME);
            oScript.setAttribute('data-sap-ui-language', sLangu);
            oScript.setAttribute('data-sap-ui-libs', 'sap.m, sap.tnt, sap.ui.table, sap.ui.layout, sap.f, sap.ui.codeeditor, sap.ui.unified');
            oScript.setAttribute('src', oSetting_UI5.resourceUrl);
            oScript.setAttribute('data-sap-ui-resourceroots', JSON.stringify({ i18n_root: './' }));
            oScript.setAttribute("data-sap-ui-oninit", "_onMainUI5Init");

            document.head.appendChild(oScript);

        }());

    }; // end of window.__bootMainApp


    /*********************************************************
     * UI5 부트스트랩 완료 후 호출 (메인 앱 로드)
     *********************************************************/
    window._onMainUI5Init = function () {

        _restoreNodeGlobals();

        let oScript = document.createElement("script");
        oScript.src = "./js/library-preload.js";
        document.body.appendChild(oScript);

    }; // end of window._onMainUI5Init

})();
