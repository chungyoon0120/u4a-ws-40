(function () {
    "use strict";

    oAPP.dialog.editServerDialog = {};

    oAPP.dialog.editServerDialog.open = function (server) {
        if (!server) return;

        var saved = oAPP.fn.fnGetSavedServerListData(server.uuid);
        var data = saved.RETCD === "S" ? saved.RETDATA : {};

        var protocol = data.protocol || "http";
        var host = data.host || server.host || "";
        var port = data.port || server.port || "";
        var useInternal = data.settings && data.settings.useInternal ? "checked" : "";
        var skipCertificate = data.settings && data.settings.skipCertificate ? "checked" : "";

        var root = document.getElementById("u4aWsDialogRoot");

        root.innerHTML = [
            '<div class="u4a-dialog-backdrop">',
            '  <div class="u4a-dialog">',
            '    <div class="u4a-dialog-header">',
            '      <div class="u4a-dialog-title">Server Edit</div>',
            '      <button class="u4a-dialog-close" data-close>×</button>',
            '    </div>',
            '    <div class="u4a-dialog-body">',
            '      <div class="u4a-form">',
            '        <div class="u4a-field"><label>Server</label><input readonly value="' + oAPP.common.util.escapeHtml(server.name || "") + '"></div>',
            '        <div class="u4a-field"><label>Protocol</label><select id="dlgProtocol"><option value="http">http</option><option value="https">https</option></select></div>',
            '        <div class="u4a-field"><label>Host</label><input id="dlgHost" value="' + oAPP.common.util.escapeHtml(host) + '"></div>',
            '        <div class="u4a-field"><label>Port</label><input id="dlgPort" value="' + oAPP.common.util.escapeHtml(port) + '"></div>',
            '        <label class="u4a-check-row"><input id="dlgUseInternal" type="checkbox" ' + useInternal + '> Use Internal</label>',
            '        <label class="u4a-check-row"><input id="dlgSkipCertificate" type="checkbox" ' + skipCertificate + '> Skip Certificate</label>',
            '      </div>',
            '    </div>',
            '    <div class="u4a-dialog-footer">',
            '      <button class="u4a-ghost-button" data-close>Cancel</button>',
            '      <button class="u4a-primary-button" id="dlgSave">Save</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join("");

        document.getElementById("dlgProtocol").value = protocol;

        root.querySelectorAll("[data-close]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                root.innerHTML = "";
            });
        });

        document.getElementById("dlgSave").addEventListener("click", async function () {
            var saveData = {
                protocol: document.getElementById("dlgProtocol").value,
                host: document.getElementById("dlgHost").value.trim(),
                port: document.getElementById("dlgPort").value.trim(),
                useInternal: document.getElementById("dlgUseInternal").checked,
                skipCertificate: document.getElementById("dlgSkipCertificate").checked
            };

            await oAPP.fn.fnPressSave(server, saveData);
            root.innerHTML = "";
        });
    };

}());
