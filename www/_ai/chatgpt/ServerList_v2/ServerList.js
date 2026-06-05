/************************************************************************
 * ServerList_v2
 * Electron 유지 / SAPUI5 제거 버전
 ************************************************************************/
(function (window) {
    "use strict";

    window.oAPP = window.oAPP || {};

    var oAPP = window.oAPP;

    oAPP.fn = oAPP.fn || {};
    oAPP.data = oAPP.data || {};
    oAPP.attr = oAPP.attr || {};
    oAPP.msg = oAPP.msg || {};
    oAPP.common = oAPP.common || {};
    oAPP.saplogon = oAPP.saplogon || {};
    oAPP.server = oAPP.server || {};
    oAPP.ui = oAPP.ui || {};
    oAPP.dialog = oAPP.dialog || {};
    oAPP.pipe = oAPP.pipe || {};
    oAPP.bootstrap = oAPP.bootstrap || {};

    oAPP.data.SAPLogon = oAPP.data.SAPLogon || {};
    oAPP.data.SAPLogon.aSys32MsgServPort = [];

    oAPP.data.state = {
        isReady: false,
        isLoading: false,
        selectedWorkspaceId: "",
        workspaceTree: [],
        serverList: [],
        sapLogonItems: [],
        savedServers: [],
        globalSettings: {},
        searchText: "",
        landscapeFilePath: ""
    };

    oAPP.fn.initElectron = function () {
        try {
            oAPP.REMOTE = window.require ? window.require("@electron/remote") : null;
            oAPP.ELECTRON = window.require ? window.require("electron") : null;
            oAPP.IPCRENDERER = oAPP.ELECTRON ? oAPP.ELECTRON.ipcRenderer : null;

            oAPP.PATH = oAPP.REMOTE ? oAPP.REMOTE.require("path") : window.require("path");
            oAPP.FS = oAPP.REMOTE ? oAPP.REMOTE.require("fs") : window.require("fs");
            oAPP.APP = oAPP.REMOTE ? oAPP.REMOTE.app : null;
            oAPP.DIALOG = oAPP.REMOTE ? oAPP.REMOTE.require("electron").dialog : null;
            oAPP.CURRWIN = oAPP.REMOTE ? oAPP.REMOTE.getCurrentWindow() : null;
            oAPP.SPAWN = window.require("child_process").spawn;
            oAPP.XMLJS = window.require("xml-js");
            oAPP.RANDOM = window.require("random-key");
            oAPP.REGEDIT = window.require("regedit");

            oAPP.APPPATH = oAPP.APP ? oAPP.APP.getAppPath() : "";
            oAPP.USERDATA = oAPP.APP ? oAPP.APP.getPath("userData") : "";

            oAPP.PATHINFO = oAPP.fn.safeRequire(oAPP.PATH.join(oAPP.APPPATH, "ws30", "resources", "pathInfo.js"));
            oAPP.SETTINGS = oAPP.PATHINFO ? oAPP.fn.safeRequire(oAPP.PATHINFO.WSSETTINGS) : null;
            oAPP.WSUTIL = oAPP.PATHINFO ? parent.require(oAPP.PATHINFO.WSUTIL) : null;

            if (oAPP.REGEDIT && oAPP.APP) {
                var vbsDirectory = oAPP.PATH.join(oAPP.PATH.dirname(oAPP.APP.getPath("exe")), "resources/regedit/vbs");
                if (oAPP.FS.existsSync(vbsDirectory)) {
                    oAPP.REGEDIT.setExternalVBSLocation(vbsDirectory);
                }
            }

            return true;

        } catch (error) {
            console.error("[ServerList] Electron init failed.", error);
            return false;
        }
    };

    oAPP.fn.safeRequire = function (modulePath) {
        try {
            if (!modulePath) {
                return null;
            }
            return parent.require ? parent.require(modulePath) : require(modulePath);
        } catch (error) {
            console.warn("[ServerList] require failed:", modulePath, error);
            return null;
        }
    };

    oAPP.fn.setBusyIndicator = function (sIsBusy) {
        if (oAPP.common.busy) {
            if (sIsBusy === "X" || sIsBusy === true) {
                oAPP.common.busy.show("Loading", "처리 중입니다.");
            } else {
                oAPP.common.busy.hide();
            }
        }
    };

    oAPP.setBusy = function (bIsBusy) {
        oAPP.fn.setBusyIndicator(bIsBusy);
    };

    oAPP.setSoundMsg = function (TYPE) {
        try {
            var oSettingInfo = oAPP.WSUTIL && oAPP.WSUTIL.getWsSettingsInfo ? oAPP.WSUTIL.getWsSettingsInfo() : {};
            if (oSettingInfo.globalSound && oSettingInfo.globalSound !== "X") {
                return;
            }

            var sSoundRootPath = oAPP.PATH.join(oAPP.APPPATH, "sound", "sap");
            var sAudioPath = "";

            switch (TYPE) {
                case "01":
                    sAudioPath = oAPP.PATH.join(sSoundRootPath, "sapmsg.wav");
                    break;
                case "02":
                    sAudioPath = oAPP.PATH.join(sSoundRootPath, "saperror.wav");
                    break;
            }

            if (sAudioPath && oAPP.common.sound) {
                oAPP.common.sound.play(sAudioPath);
            }

        } catch (error) {
            console.warn("[ServerList] sound skipped.", error);
        }
    };

    oAPP.fn.showError = function (msg) {
        console.error(msg);
        if (oAPP.common.message) {
            oAPP.common.message.alert("Error", String(msg || "Unknown error"));
        }
    };

    oAPP.fn.fnOnDeviceReady = function () {
        if (!oAPP.fn.initElectron()) {
            oAPP.fn.showError("Electron API 초기화에 실패했습니다.");
            return;
        }

        if (oAPP.bootstrap && typeof oAPP.bootstrap.initialize === "function") {
            oAPP.bootstrap.initialize();
        }
    };

    oAPP.fn.attachIpc = function () {
        if (!oAPP.IPCRENDERER) {
            return;
        }

        oAPP.IPCRENDERER.removeAllListeners("if-globalSetting-info");
        oAPP.IPCRENDERER.on("if-globalSetting-info", function (events, oInfo) {
            oAPP.data.GlobalSettings = oInfo || {};
            oAPP.data.state.globalSettings = oInfo || {};
            oAPP.data.SystemRootPath = process.env.SystemRoot;
            oAPP.fn.fnOnDeviceReady();
        });
    };

    oAPP.fn.attachIpc();

    document.addEventListener("DOMContentLoaded", function () {
        /*
         * 원본은 메인/부모에서 if-globalSetting-info IPC가 온 뒤 시작한다.
         * 개발/단독 실행 테스트에서는 IPC가 오지 않을 수 있으므로 fallback 시작을 둔다.
         */
        setTimeout(function () {
            if (!oAPP.data.state.isReady) {
                oAPP.fn.fnOnDeviceReady();
            }
        }, 200);
    });

}(window));
