(function () {
    "use strict";

    oAPP.server = oAPP.server || {};

    oAPP.server.saveServerSettings = async function (uuid, settings) {
        var all = oAPP.server.loadSavedServers();
        var target = all.find(function (item) {
            return item.uuid === uuid;
        });

        if (!target) {
            return { RETCD: "E", RTMSG: "저장된 서버 정보가 없습니다." };
        }

        target.settings = Object.assign({}, target.settings || {}, settings || {});

        var writeResult = await oAPP.common.storage.writeJson(oAPP.server.getServerInfoPath(), all);
        if (writeResult.RETCD === "S") {
            oAPP.data.state.savedServers = all;
            oAPP.server.syncSavedServerInfo();
        }

        return writeResult;
    };

}());
