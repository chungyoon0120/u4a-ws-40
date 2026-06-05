(function () {
    "use strict";

    oAPP.ui.titlebar = {};

    oAPP.ui.titlebar.render = function () {
        var bar = oAPP.common.util.createEl("header", "u4a-titlebar");

        var brand = oAPP.common.util.createEl("div", "u4a-titlebar-brand");
        brand.appendChild(oAPP.common.util.createEl("div", "u4a-brand-mark"));
        brand.appendChild(oAPP.common.util.createEl("div", "u4a-titlebar-text", "U4A Workspace"));

        var actions = oAPP.common.util.createEl("div", "u4a-window-actions");

        var minBtn = oAPP.common.util.createEl("button", "u4a-window-btn", "─");
        var maxBtn = oAPP.common.util.createEl("button", "u4a-window-btn", "□");
        var closeBtn = oAPP.common.util.createEl("button", "u4a-window-btn close", "×");

        minBtn.addEventListener("click", function () {
            if (oAPP.CURRWIN) oAPP.CURRWIN.minimize();
        });

        maxBtn.addEventListener("click", function () {
            if (!oAPP.CURRWIN) return;
            oAPP.CURRWIN.isMaximized() ? oAPP.CURRWIN.unmaximize() : oAPP.CURRWIN.maximize();
        });

        closeBtn.addEventListener("click", function () {
            if (oAPP.CURRWIN) oAPP.CURRWIN.close();
        });

        actions.appendChild(minBtn);
        actions.appendChild(maxBtn);
        actions.appendChild(closeBtn);

        bar.appendChild(brand);
        bar.appendChild(actions);

        return bar;
    };

}());
