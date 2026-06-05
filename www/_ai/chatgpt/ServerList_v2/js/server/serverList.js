(function () {
    "use strict";

    oAPP.server = oAPP.server || {};

    oAPP.server.syncSavedServerInfo = function () {
        var aSavedServerList = oAPP.server.loadSavedServers();

        function syncOne(server) {
            server.ISSAVE = false;
            server.status = "Inactive";

            var saved = aSavedServerList.find(function (item) {
                return item.uuid === server.uuid;
            });

            if (saved) {
                server.ISSAVE = true;
                server.status = "Active";
                server.settings = saved.settings || {};
            }

            return server;
        }

        oAPP.data.state.serverList = (oAPP.data.state.serverList || []).map(syncOne);
        oAPP.data.state.sapLogonItems = (oAPP.data.state.sapLogonItems || []).map(syncOne);
    };

    oAPP.fn.fnPressServerListItem = async function (server) {
        if (!server) {
            return;
        }

        if (!server.ISSAVE) {
            oAPP.dialog.editServerDialog.open(server);
            return;
        }

        var oSavedData = oAPP.fn.fnGetSavedServerListData(server.uuid);
        if (oSavedData.RETCD === "E") {
            oAPP.dialog.editServerDialog.open(server);
            return;
        }

        oAPP.setBusy(true);

        var oLoginInfo = {
            NAME: server.name,
            SERVER_INFO: oSavedData.RETDATA,
            SERVER_INFO_DETAIL: server,
            INSTANCENO: server.insno,
            SYSTEMID: server.systemid,
            CLIENT: "",
            LANGU: "",
            SYSID: server.systemid,
            SETTINGS: server.settings || undefined
        };

        try {
            await oAPP.fn._registSelectedSystemInfo(oLoginInfo);
        } catch (error) {
            console.warn("[regist selected system skipped]", error);
        }

        oAPP.fn.fnLoginPage(oLoginInfo);
    };

    oAPP.fn._registSelectedSystemInfo = async function (oLoginInfo) {
        try {
            if (!oAPP.SETTINGS || !oAPP.SETTINGS.regPaths || !oAPP.SETTINGS.regPaths.cSession) {
                return;
            }

            var Regedit = parent.require("regedit").promisified;
            var sPath = oAPP.SETTINGS.regPaths.cSession;

            await Regedit.createKey([sPath]);

            var oPut = {};
            oPut[sPath] = {
                SYSID: {
                    value: oLoginInfo.SYSID || "",
                    type: "REG_DEFAULT"
                }
            };

            await Regedit.putValue(oPut);

        } catch (error) {
            console.warn("[_registSelectedSystemInfo]", error);
        }
    };

}());
