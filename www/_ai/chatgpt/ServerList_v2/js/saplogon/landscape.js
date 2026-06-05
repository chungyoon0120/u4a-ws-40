(function () {
    "use strict";

    oAPP.fn.fnSetSAPLogonLandscapeList = function () {
        var oErr = {
            RETCD: "E",
            RTMSG: "Server information does not exist in the SAPGUI logon file."
        };

        var oSucc = { RETCD: "S", RTMSG: "" };

        var oLandscapeFile = oAPP.data.SAPLogon.LandscapeFile;
        if (!oLandscapeFile || !oLandscapeFile.Services || !oLandscapeFile.Services.Service) {
            return oErr;
        }

        var aServices = oAPP.common.util.toArray(oLandscapeFile.Services.Service);
        var aRouters = oLandscapeFile.Routers ? oAPP.common.util.toArray(oLandscapeFile.Routers.Router) : [];
        var aMessageservers = oLandscapeFile.Messageservers ? oAPP.common.util.toArray(oLandscapeFile.Messageservers.Messageserver) : [];

        oAPP.data.SAPLogon.aServices = aServices;
        oAPP.data.SAPLogon.aRouters = aRouters;
        oAPP.data.SAPLogon.aMessageservers = aMessageservers;

        var aBindData = [];

        aServices.forEach(function (oService) {
            var oServiceAttr = oAPP.common.util.deepClone(oService._attributes || {});
            if (!oServiceAttr.uuid) return;
            if (oServiceAttr.shortcut === "1") return;

            if (oServiceAttr.mode === "1" && oServiceAttr.server) {
                var aServer = oServiceAttr.server.split(":");
                oServiceAttr.host = aServer[0] || "";
                oServiceAttr.port = aServer[1] || "";
            }

            if (oServiceAttr.routerid && aRouters.length) {
                var oRouter = aRouters.find(function (element) {
                    return element._attributes && element._attributes.uuid === oServiceAttr.routerid;
                });

                oServiceAttr.router = oRouter ? oAPP.common.util.deepClone(oRouter._attributes) : {};
            }

            if (oServiceAttr.msid && aMessageservers.length) {
                var oMsgSvr = aMessageservers.find(function (element) {
                    return element._attributes && element._attributes.uuid === oServiceAttr.msid;
                });

                oServiceAttr.msgsvr = oMsgSvr ? oAPP.common.util.deepClone(oMsgSvr._attributes) : {};

                oServiceAttr.host = oServiceAttr.server || oServiceAttr.msgsvr.host || "";
                oServiceAttr.port = oServiceAttr.msgsvr.port || "";

                if (!oServiceAttr.port && Array.isArray(oAPP.data.SAPLogon.aSys32MsgServPort)) {
                    var oPortInfo = oAPP.data.SAPLogon.aSys32MsgServPort.find(function (e) {
                        return e.SYSID === oServiceAttr.systemid;
                    });

                    if (oPortInfo) {
                        oServiceAttr.port = oPortInfo.PORT;
                        oServiceAttr.msgsvr.port = oPortInfo.PORT;
                    }
                }

                oServiceAttr.msgsvr.port = oServiceAttr.msgsvr.port || "3600";
            }

            if (oServiceAttr.port) {
                oServiceAttr.insno = String(oServiceAttr.port).substring(2, 4);
            }

            oServiceAttr.ISSAVE = false;
            aBindData.push(oServiceAttr);
        });

        oAPP.data.state.serverList = aBindData;

        return oSucc;
    };

}());
