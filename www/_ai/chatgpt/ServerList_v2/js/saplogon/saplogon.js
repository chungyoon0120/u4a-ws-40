(function () {
    "use strict";

    window.oAPP = window.oAPP || {};
    oAPP.saplogon = oAPP.saplogon || {};
    oAPP.fn = oAPP.fn || {};
    oAPP.data = oAPP.data || {};
    oAPP.data.state = oAPP.data.state || {};
    oAPP.data.SAPLogon = oAPP.data.SAPLogon || {};
    oAPP.data.SAPLogon.aSys32MsgServPort = oAPP.data.SAPLogon.aSys32MsgServPort || [];

    oAPP.saplogon.initialize = async function () {
        if (oAPP.setBusy) {
            oAPP.setBusy(true);
        }

        try {
            await oAPP.saplogon.getMsgServerPortList();
            await oAPP.fn.fnOnListupSapLogon();

        } catch (error) {
            if (oAPP.fn && typeof oAPP.fn.showError === "function") {
                oAPP.fn.showError(error);
            } else {
                console.error(error);
            }

        } finally {
            if (oAPP.setBusy) {
                oAPP.setBusy(false);
            }
        }
    };

    oAPP.fn.fnOnListupSapLogon = async function () {
        oAPP.data.state.workspaceTree = [];
        oAPP.data.state.serverList = [];
        oAPP.data.state.sapLogonItems = [];
        oAPP.data.state.savedServers = [];

        if (oAPP.ui && oAPP.ui.layout && typeof oAPP.ui.layout.render === "function") {
            oAPP.ui.layout.render();
        }

        var oResult = await oAPP.fn.fnGetRegInfoForSAPLogon();
        await oAPP.fn.fnGetRegInfoForSAPLogonThen(oResult);
    };

    oAPP.fn.fnGetRegInfoForSAPLogon = function () {
        return new Promise(function (resolve, reject) {
            if (!oAPP.SETTINGS || !oAPP.SETTINGS.regPaths || !oAPP.SETTINGS.regPaths.saplogon) {
                reject("SETTINGS.regPaths.saplogon 정보를 찾을 수 없습니다.");
                return;
            }

            var sSaplogonPath = oAPP.SETTINGS.regPaths.saplogon;

            if (!oAPP.REGEDIT || typeof oAPP.REGEDIT.list !== "function") {
                reject("regedit 모듈을 사용할 수 없습니다.");
                return;
            }

            oAPP.REGEDIT.list(sSaplogonPath, function (err, result) {
                if (err) {
                    reject("SAP Logon 레지스트리 조회 실패: " + err.toString());
                    return;
                }

                var oSapLogon = result[sSaplogonPath];
                if (!oSapLogon || oSapLogon.exists === false) {
                    reject("SAPGUI 설치 여부와 저장된 SAP Logon 서버 정보를 확인하세요.");
                    return;
                }

                resolve(oSapLogon.values || {});
            });
        });
    };

    oAPP.fn.fnGetRegInfoForSAPLogonThen = async function (oResult) {
        var oLandscapeFile = oResult.LandscapeFile;

        if (!oLandscapeFile || !oLandscapeFile.value) {
            throw new Error("LandscapeFile 레지스트리 값을 찾을 수 없습니다.");
        }

        var sLandscapeFilePath = oLandscapeFile.value;

        if (!oAPP.FS || !oAPP.FS.existsSync(sLandscapeFilePath)) {
            throw new Error("SAP Landscape XML 파일을 찾을 수 없습니다.\n" + sLandscapeFilePath);
        }

        oAPP.data.state.landscapeFilePath = sLandscapeFilePath;

        if (oAPP.oSapLogonWatch) {
            try {
                oAPP.oSapLogonWatch.close();
            } catch (e) {}
            delete oAPP.oSapLogonWatch;
        }

        oAPP.oSapLogonWatch = oAPP.FS.watch(sLandscapeFilePath, oAPP.fn.fnSapLogonFileChange);

        var oReadResult = await oAPP.fn.fnReadSAPLogonData("LandscapeFile", sLandscapeFilePath);
        await oAPP.fn.fnReadSAPLogonDataThen(oReadResult);
    };

    oAPP.fn.fnSapLogonFileChange = function () {
        if (typeof oAPP.iSapLogonChangeTimeout !== "undefined") {
            clearTimeout(oAPP.iSapLogonChangeTimeout);
            delete oAPP.iSapLogonChangeTimeout;
        }

        oAPP.iSapLogonChangeTimeout = setTimeout(async function () {
            clearTimeout(oAPP.iSapLogonChangeTimeout);
            delete oAPP.iSapLogonChangeTimeout;

            try {
                if (oAPP.setBusy) {
                    oAPP.setBusy(true);
                }

                await oAPP.fn.fnOnListupSapLogon();

                if (oAPP.common && oAPP.common.message) {
                    oAPP.common.message.toast("SAP Logon 정보가 갱신되었습니다.");
                }

            } catch (error) {
                if (oAPP.fn && typeof oAPP.fn.showError === "function") {
                    oAPP.fn.showError(error);
                } else {
                    console.error(error);
                }

            } finally {
                if (oAPP.setBusy) {
                    oAPP.setBusy(false);
                }
            }

        }, 1000);
    };

    oAPP.fn.fnReadSAPLogonData = function (sFileName, sFilePath) {
        return new Promise(function (resolve, reject) {
            oAPP.FS.readFile(sFilePath, { encoding: "utf8" }, function (err, data) {
                if (err) {
                    reject(err.toString());
                    return;
                }

                var xmlOption = {
                    ignoreComment: true,
                    ignoreDeclaration: true,
                    compact: true,
                    spaces: 4
                };

                try {
                    var sResult = oAPP.XMLJS.xml2json(data, xmlOption);
                    var oResult = JSON.parse(sResult);

                    resolve({
                        fileName: sFileName,
                        Result: oResult.Landscape
                    });

                } catch (error) {
                    reject("SAP Landscape XML 파싱 실패: " + error.toString());
                }
            });
        });
    };

    oAPP.fn.fnReadSAPLogonDataThen = async function (oResult) {
        if (typeof oAPP.fn.fnCheckSapguiVersion === "function") {
            var oCheckVer = await oAPP.fn.fnCheckSapguiVersion();

            if (oCheckVer && oCheckVer.RETCD === "E") {
                console.warn("[SAPGUI Check]", oCheckVer.RTMSG);
            }
        }

        oAPP.data.SAPLogon[oResult.fileName] = oResult.Result;

        var oLogonResult = oAPP.fn.fnSetSAPLogonLandscapeList();
        if (oLogonResult.RETCD === "E") {
            throw new Error(oLogonResult.RTMSG);
        }

        oAPP.fn.fnCreateWorkspaceTree();

        if (oAPP.server && typeof oAPP.server.loadSavedServers === "function") {
            oAPP.server.loadSavedServers();
        }

        if (oAPP.server && typeof oAPP.server.syncSavedServerInfo === "function") {
            oAPP.server.syncSavedServerInfo();
        }

        oAPP.fn.restoreInitialWorkspaceSelection();

        oAPP.data.state.isReady = true;

        if (oAPP.ui && oAPP.ui.layout && typeof oAPP.ui.layout.render === "function") {
            oAPP.ui.layout.render();
        }

        if (oAPP.pipe && typeof oAPP.pipe.initialize === "function") {
            oAPP.pipe.initialize();
        }
    };

    oAPP.saplogon.getMsgServerPortList = async function () {
        try {
            var systemRoot = process.env.SystemRoot || oAPP.data.SystemRootPath || "C:\\Windows";
            var servicesPath = oAPP.PATH.join(systemRoot, "System32", "drivers", "etc", "services");

            oAPP.data.SAPLogon.aSys32MsgServPort = [];

            if (!oAPP.FS || !oAPP.FS.existsSync(servicesPath)) {
                return;
            }

            var text = oAPP.FS.readFileSync(servicesPath, "utf-8");
            var lines = text.split(/\r?\n/);

            lines.forEach(function (line) {
                var m = line.match(/^sapms([A-Za-z0-9]{3})\s+(\d+)\/tcp/i);
                if (!m) {
                    return;
                }

                oAPP.data.SAPLogon.aSys32MsgServPort.push({
                    SYSID: m[1].toUpperCase(),
                    PORT: m[2]
                });
            });

        } catch (error) {
            console.warn("[getMsgServerPortList skipped]", error);
        }
    };

}());
