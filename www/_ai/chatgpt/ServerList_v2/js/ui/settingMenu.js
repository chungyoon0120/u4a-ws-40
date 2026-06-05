(function () {
    "use strict";

    oAPP.ui.settingMenu = {};

    oAPP.ui.settingMenu.render = function () {
        var menu = oAPP.common.util.createEl("div", "u4a-menu-popover is-hidden");
        menu.id = "u4aSettingMenu";

        [
            ["🌐", "Language", oAPP.dialog.languageDialog.open],
            ["🎨", "Theme", oAPP.dialog.themeDialog.open],
            ["🔊", "Sound", oAPP.dialog.soundDialog.open],
            ["ℹ", "About WS", oAPP.dialog.aboutDialog.open]
        ].forEach(function (item) {
            var btn = oAPP.common.util.createEl("button", "u4a-menu-item", item[0] + "  " + item[1]);
            btn.addEventListener("click", function (event) {
                oAPP.common.util.stop(event);
                oAPP.ui.settingMenu.hide();
                item[2]();
            });
            menu.appendChild(btn);
        });

        menu.addEventListener("click", function (event) {
            event.stopPropagation();
        });

        return menu;
    };

    oAPP.ui.settingMenu.toggle = function (event) {
        if (event) event.stopPropagation();
        var menu = document.getElementById("u4aSettingMenu");
        if (menu) menu.classList.toggle("is-hidden");
    };

    oAPP.ui.settingMenu.hide = function () {
        var menu = document.getElementById("u4aSettingMenu");
        if (menu) menu.classList.add("is-hidden");
    };

    oAPP.ui.settingMenu.bindDocumentClose = function () {
        document.onclick = function () {
            oAPP.ui.settingMenu.hide();
        };
    };

}());
