(function () {
    "use strict";

    oAPP.common.storage = {};

    oAPP.common.storage.readJson = function (filePath, defaultValue) {
        try {
            if (!filePath || !oAPP.FS.existsSync(filePath)) {
                return defaultValue;
            }
            var text = oAPP.FS.readFileSync(filePath, "utf-8") || "";
            if (!text.trim()) {
                return defaultValue;
            }
            return JSON.parse(text);
        } catch (error) {
            console.error("[storage.readJson]", error);
            return defaultValue;
        }
    };

    oAPP.common.storage.writeJson = function (filePath, data) {
        return new Promise(function (resolve) {
            try {
                var dir = oAPP.PATH.dirname(filePath);
                if (!oAPP.FS.existsSync(dir)) {
                    oAPP.FS.mkdirSync(dir, { recursive: true });
                }

                oAPP.FS.writeFileSync(filePath, JSON.stringify(data, null, 4), "utf-8");
                resolve({ RETCD: "S" });

            } catch (error) {
                resolve({ RETCD: "E", RTMSG: error.toString() });
            }
        });
    };

}());
