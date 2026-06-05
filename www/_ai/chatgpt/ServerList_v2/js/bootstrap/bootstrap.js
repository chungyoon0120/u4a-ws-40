(function () {
    "use strict";

    oAPP.bootstrap = oAPP.bootstrap || {};

    oAPP.bootstrap.initialize = async function () {
        if (oAPP.data.state.isLoading) {
            return;
        }

        oAPP.data.state.isLoading = true;

        try {
            /*
             * 화면은 먼저 렌더링한다.
             * SAP Logon / Registry / XML 로직에서 오류가 나더라도
             * 빈 화면으로 죽지 않도록 하기 위함.
             */
            if (oAPP.ui && oAPP.ui.layout && typeof oAPP.ui.layout.render === "function") {
                oAPP.ui.layout.render();
            }

            /*
             * saplogon.js가 정상 로드된 경우
             */
            if (oAPP.saplogon && typeof oAPP.saplogon.initialize === "function") {
                await oAPP.saplogon.initialize();
                return;
            }

            /*
             * saplogon.js 로딩 순서/오류로 initialize가 없는 경우 fallback.
             * 기존 함수가 존재하면 기존 흐름으로 직접 진입한다.
             */
            if (oAPP.fn && typeof oAPP.fn.fnOnListupSapLogon === "function") {
                oAPP.setBusy(true);
                await oAPP.fn.fnOnListupSapLogon();

                if (oAPP.pipe && typeof oAPP.pipe.initialize === "function") {
                    oAPP.pipe.initialize();
                }

                return;
            }

            console.warn("[bootstrap] oAPP.saplogon.initialize and oAPP.fn.fnOnListupSapLogon are not ready.");

        } catch (error) {
            if (oAPP.fn && typeof oAPP.fn.showError === "function") {
                oAPP.fn.showError(error);
            } else {
                console.error(error);
            }

        } finally {
            oAPP.data.state.isLoading = false;

            if (oAPP.common && oAPP.common.busy && typeof oAPP.common.busy.hide === "function") {
                oAPP.common.busy.hide();
            }
        }
    };

}());
