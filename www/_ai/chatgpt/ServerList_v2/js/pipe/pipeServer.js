(function () {
    "use strict";

    oAPP.pipe = oAPP.pipe || {};

    oAPP.pipe.initialize = function () {
        if (oAPP.pipe._initialized) {
            return;
        }

        try {
            if (!oAPP.PATH || !oAPP.APPPATH) {
                return;
            }

            var modulePath = oAPP.PATH.join(oAPP.APPPATH, "ServerList_v2", "modules", "Server", "net", "index.js");
            if (!oAPP.FS.existsSync(modulePath)) {
                return;
            }

            oAPP.oU4ASERV = parent.require(modulePath);

            if (oAPP.oU4ASERV && typeof oAPP.oU4ASERV.createServer === "function") {
                oAPP.oU4ASERV.createServer();
                oAPP.pipe._initialized = true;
            }

        } catch (error) {
            console.warn("[pipe.initialize]", error);
        }
    };

}());
