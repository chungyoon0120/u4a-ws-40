(function () {
    "use strict";

    oAPP.fn.fnLoginPage = function (oLoginInfo) {
        try {
            var RANDOM = oAPP.RANDOM;
            var SESSKEY = RANDOM.generate(40);
            var BROWSERKEY = RANDOM.generate(10);

            var BrowserWindow = oAPP.REMOTE.BrowserWindow;

            var oDefaultOption = {};
            if (oAPP.PATHINFO && oAPP.PATHINFO.BROWSERSETTINGS) {
                oDefaultOption = parent.require(oAPP.PATHINFO.BROWSERSETTINGS);
            }

            var oBrowserOptions = JSON.parse(JSON.stringify((oDefaultOption && oDefaultOption.browserWindow) || {}));

            oBrowserOptions.width = oBrowserOptions.width || 1000;
            oBrowserOptions.height = oBrowserOptions.height || 800;
            oBrowserOptions.minWidth = 1000;
            oBrowserOptions.minHeight = 800;
            oBrowserOptions.autoHideMenuBar = true;
            oBrowserOptions.titleBarStyle = "hidden";
            oBrowserOptions.backgroundColor = "#10161d";
            oBrowserOptions.webPreferences = oBrowserOptions.webPreferences || {};
            oBrowserOptions.webPreferences.partition = SESSKEY;
            oBrowserOptions.webPreferences.browserkey = BROWSERKEY;
            oBrowserOptions.webPreferences.OBJTY = "MAIN";
            oBrowserOptions.webPreferences.SYSID = oLoginInfo.SYSID;

            var oBrowserWindow = new BrowserWindow(oBrowserOptions);
            oBrowserWindow.setMenu(null);

            var oQueryParams = {
                browserkey: BROWSERKEY,
                sessionKey: SESSKEY,
                OBJTY: "MAIN",
                SYSID: oLoginInfo.SYSID
            };

            var loadUrl = oAPP.PATHINFO.MAINFRAME;
            if (oAPP.WSUTIL && oAPP.WSUTIL.QueryString && oAPP.WSUTIL.QueryString.build) {
                loadUrl = oAPP.WSUTIL.QueryString.build(oAPP.PATHINFO.MAINFRAME, oQueryParams);
            }

            oBrowserWindow.loadURL(loadUrl);

            if (oAPP.APP && !oAPP.APP.isPackaged) {
                oBrowserWindow.webContents.openDevTools();
            }

            oBrowserWindow.webContents.on("did-finish-load", function () {
                oAPP.setBusy(false);

                oBrowserWindow.webContents.send("if-meta-info", {
                    SERVERINFO: oLoginInfo,
                    THEMEINFO: oLoginInfo.oThemeInfo || {},
                    EXEPAGE: "LOGIN",
                    SESSIONKEY: SESSKEY,
                    BROWSERKEY: BROWSERKEY
                });
            });

            oBrowserWindow.on("closed", function () {
                oBrowserWindow = null;
            });

        } catch (error) {
            oAPP.setBusy(false);
            oAPP.common.message.alert("Login Error", error.toString());
        }
    };

}());
