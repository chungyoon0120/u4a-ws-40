(function () {
    "use strict";

    oAPP.ui.layout = {};

    oAPP.ui.layout.render = function () {
        var root = document.getElementById("content");
        if (!root || !oAPP.common.util) return;

        oAPP.common.util.clear(root);

        var shell = oAPP.common.util.createEl("div", "u4a-app-shell");

        shell.appendChild(oAPP.ui.titlebar.render());
        shell.appendChild(oAPP.ui.layout.renderHeader());
        shell.appendChild(oAPP.ui.layout.renderMain());

        root.appendChild(shell);

        oAPP.ui.settingMenu.bindDocumentClose();
    };

    oAPP.ui.layout.renderHeader = function () {
        var header = oAPP.common.util.createEl("section", "u4a-logon-header");

        var title = oAPP.common.util.createEl("div", "u4a-logon-title");
        title.appendChild(oAPP.common.util.createEl("h1", "", "U4A Workspace Logon Pad"));
        title.appendChild(oAPP.common.util.createEl("span", "", "Select a workspace and open the SAP server connection."));

        var actions = oAPP.common.util.createEl("div", "u4a-header-actions");

        var refreshBtn = oAPP.common.util.createEl("button", "u4a-primary-button", "Refresh");
        refreshBtn.addEventListener("click", async function () {
            try {
                oAPP.setBusy(true);
                await oAPP.fn.fnOnListupSapLogon();
                oAPP.common.message.toast("새로고침 완료");
            } catch (error) {
                oAPP.fn.showError(error);
            } finally {
                oAPP.setBusy(false);
            }
        });

        var settingBtn = oAPP.common.util.createEl("button", "u4a-icon-button", "⚙");
        settingBtn.setAttribute("title", "Settings");
        settingBtn.addEventListener("click", oAPP.ui.settingMenu.toggle);

        actions.appendChild(refreshBtn);
        actions.appendChild(settingBtn);

        header.appendChild(title);
        header.appendChild(actions);
        header.appendChild(oAPP.ui.settingMenu.render());

        return header;
    };

    oAPP.ui.layout.renderMain = function () {
        var main = oAPP.common.util.createEl("main", "u4a-main-layout");

        var left = oAPP.common.util.createEl("aside", "u4a-panel u4a-workspace-panel");
        left.appendChild(oAPP.ui.layout.panelHeader("Workspace", "SAP Logon folders"));
        left.appendChild(oAPP.ui.workspaceTree.render());

        var right = oAPP.common.util.createEl("section", "u4a-panel u4a-server-panel");
        right.appendChild(oAPP.ui.layout.panelHeader("Server List", "Available SAP systems"));
        right.appendChild(oAPP.ui.serverTable.renderToolbar());
        right.appendChild(oAPP.ui.serverTable.render());

        main.appendChild(left);
        main.appendChild(right);

        return main;
    };

    oAPP.ui.layout.panelHeader = function (title, subtitle) {
        var header = oAPP.common.util.createEl("div", "u4a-panel-header");
        var wrap = oAPP.common.util.createEl("div");
        wrap.appendChild(oAPP.common.util.createEl("div", "u4a-panel-title", title));
        wrap.appendChild(oAPP.common.util.createEl("div", "u4a-panel-subtitle", subtitle));
        header.appendChild(wrap);
        return header;
    };

}());
