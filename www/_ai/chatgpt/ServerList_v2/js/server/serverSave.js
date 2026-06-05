(function () {
    "use strict";

    oAPP.server = oAPP.server || {};

    oAPP.server.getServerInfoPath = function () {
        return oAPP.PATHINFO ? oAPP.PATHINFO.SERVERINFO_V2 : "";
    };

    oAPP.server.loadSavedServers = function () {
        var path = oAPP.server.getServerInfoPath();
        var data = oAPP.common.storage.readJson(path, []);

        if (!Array.isArray(data)) {
            data = [];
        }

        oAPP.data.state.savedServers = data;
        return data;
    };

    oAPP.fn.fnGetSavedServerListDataAll = function () {
        try {
            var aSavedJsonData = oAPP.server.loadSavedServers();

            return {
                RETCD: "S",
                RETDATA: aSavedJsonData
            };

        } catch (error) {
            return {
                RETCD: "E",
                RTMSG: error.toString()
            };
        }
    };

    oAPP.fn.fnGetSavedServerListData = function (pUUID) {
        var oAll = oAPP.fn.fnGetSavedServerListDataAll();
        if (oAll.RETCD !== "S") {
            return oAll;
        }

        var found = oAll.RETDATA.find(function (elem) {
            return elem.uuid === pUUID;
        });

        if (!found) {
            return {
                RETCD: "E",
                RTMSG: "not exists save file."
            };
        }

        return {
            RETCD: "S",
            RETDATA: found
        };
    };

    oAPP.fn.fnPressSave = async function (server, saveData) {
        if (!server || !server.uuid) {
            oAPP.common.message.alert("Save", "저장할 서버 정보가 없습니다.");
            return;
        }

        var valid = oAPP.fn.fnCheckValid(saveData);
        if (valid.RETCD === "E") {
            oAPP.setSoundMsg("02");
            oAPP.common.message.alert("Validation", valid.RTMSG);
            return;
        }

        var localSaveData = {
            uuid: server.uuid,
            protocol: saveData.protocol,
            host: saveData.host,
            port: saveData.port,
            settings: {
                useInternal: !!saveData.useInternal,
                skipCertificate: !!saveData.skipCertificate
            }
        };

        var path = oAPP.server.getServerInfoPath();
        var aSavedData = oAPP.server.loadSavedServers();

        var idx = aSavedData.findIndex(function (e) {
            return e.uuid === localSaveData.uuid;
        });

        if (idx >= 0) {
            aSavedData[idx] = Object.assign({}, aSavedData[idx], localSaveData);
        } else {
            aSavedData.push(localSaveData);
        }

        var writeResult = await oAPP.common.storage.writeJson(path, aSavedData);
        if (writeResult.RETCD !== "S") {
            oAPP.common.message.alert("Save Error", writeResult.RTMSG);
            return;
        }

        oAPP.data.state.savedServers = aSavedData;
        oAPP.server.syncSavedServerInfo();
        oAPP.ui.layout.render();
        oAPP.setSoundMsg("01");
        oAPP.common.message.toast("저장되었습니다.");
    };

    oAPP.fn.fnPressDelete = async function (server) {
        if (!server || !server.uuid) {
            return;
        }

        oAPP.common.message.confirm("Delete", "선택한 서버 저장 정보를 삭제하시겠습니까?", async function (ok) {
            if (!ok) {
                return;
            }

            var path = oAPP.server.getServerInfoPath();
            var aSavedData = oAPP.server.loadSavedServers().filter(function (item) {
                return item.uuid !== server.uuid;
            });

            var writeResult = await oAPP.common.storage.writeJson(path, aSavedData);
            if (writeResult.RETCD !== "S") {
                oAPP.common.message.alert("Delete Error", writeResult.RTMSG);
                return;
            }

            oAPP.data.state.savedServers = aSavedData;
            oAPP.server.syncSavedServerInfo();
            oAPP.ui.layout.render();
            oAPP.common.message.toast("삭제되었습니다.");
        });
    };

    oAPP.fn.fnCheckValid = function (data) {
        if (!data.protocol) {
            return { RETCD: "E", RTMSG: "Protocol을 선택하세요." };
        }

        if (!data.host) {
            return { RETCD: "E", RTMSG: "Host를 입력하세요." };
        }

        if (data.port && !/^[0-9]+$/.test(String(data.port))) {
            return { RETCD: "E", RTMSG: "Port는 숫자만 입력하세요." };
        }

        return { RETCD: "S" };
    };

}());
