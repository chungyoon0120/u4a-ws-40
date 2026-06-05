(function () {
    "use strict";

    oAPP.fn.fnCheckSapguiVersion = function () {
        return new Promise(function (resolve) {
            try {
                var psRootPath = oAPP.PATH.join(oAPP.APP.getPath("userData"), "ext_api", "ps");
                var psPath = oAPP.PATH.join(psRootPath, "WS_SAPGUI_INFO", "get_sapgui_inf.ps1");

                if (!oAPP.FS.existsSync(psPath)) {
                    resolve({
                        RETCD: "S",
                        RTMSG: "SAPGUI PowerShell check skipped.",
                        RTVER: "",
                        RTPATH: ""
                    });
                    return;
                }

                var child = oAPP.SPAWN("powershell.exe", [
                    "-NoProfile",
                    "-ExecutionPolicy", "Bypass",
                    "-File", psPath
                ], {
                    windowsHide: true
                });

                var stdout = "";
                var stderr = "";

                child.stdout.on("data", function (data) {
                    stdout += data.toString();
                });

                child.stderr.on("data", function (data) {
                    stderr += data.toString();
                });

                child.on("close", function (code) {
                    if (code !== 0) {
                        resolve({
                            RETCD: "E",
                            RTMSG: stderr || stdout || "SAPGUI 버전 확인 실패",
                            RTVER: "",
                            RTPATH: ""
                        });
                        return;
                    }

                    var text = stdout.trim();
                    var data = {};

                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        data = { RTVER: text, RTPATH: "" };
                    }

                    resolve({
                        RETCD: data.RETCD || "S",
                        RTMSG: data.RTMSG || "",
                        RTVER: data.RTVER || data.VERSION || "",
                        RTPATH: data.RTPATH || data.PATH || ""
                    });
                });

            } catch (error) {
                resolve({
                    RETCD: "E",
                    RTMSG: error.toString(),
                    RTVER: "",
                    RTPATH: ""
                });
            }
        });
    };

}());
