(function () {
    "use strict";

    oAPP.common.message = {};

    oAPP.common.message.alert = function (title, message, callback) {
        var root = document.getElementById("u4aWsDialogRoot");
        if (!root) {
            window.alert(message || title || "");
            if (callback) callback();
            return;
        }

        root.innerHTML = [
            '<div class="u4a-dialog-backdrop">',
            '  <div class="u4a-dialog">',
            '    <div class="u4a-dialog-header">',
            '      <div class="u4a-dialog-title">' + oAPP.common.util.escapeHtml(title || "Message") + '</div>',
            '      <button class="u4a-dialog-close" data-u4a-dialog-close>×</button>',
            '    </div>',
            '    <div class="u4a-dialog-body">' + oAPP.common.util.escapeHtml(message || "") + '</div>',
            '    <div class="u4a-dialog-footer">',
            '      <button class="u4a-primary-button" data-u4a-dialog-close>OK</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join("");

        root.querySelectorAll("[data-u4a-dialog-close]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                root.innerHTML = "";
                if (callback) callback();
            });
        });
    };

    oAPP.common.message.confirm = function (title, message, callback) {
        var root = document.getElementById("u4aWsDialogRoot");
        root.innerHTML = [
            '<div class="u4a-dialog-backdrop">',
            '  <div class="u4a-dialog">',
            '    <div class="u4a-dialog-header"><div class="u4a-dialog-title">' + oAPP.common.util.escapeHtml(title || "Confirm") + '</div></div>',
            '    <div class="u4a-dialog-body">' + oAPP.common.util.escapeHtml(message || "") + '</div>',
            '    <div class="u4a-dialog-footer">',
            '      <button class="u4a-ghost-button" data-answer="N">Cancel</button>',
            '      <button class="u4a-primary-button" data-answer="Y">OK</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join("");

        root.querySelectorAll("[data-answer]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var answer = btn.getAttribute("data-answer");
                root.innerHTML = "";
                if (callback) callback(answer === "Y");
            });
        });
    };

    oAPP.common.message.toast = function (message) {
        var root = document.getElementById("u4aWsToastRoot");
        if (!root) return;

        root.innerHTML = '<div class="u4a-toast">' + oAPP.common.util.escapeHtml(message || "") + '</div>';
        clearTimeout(oAPP._toastTimer);
        oAPP._toastTimer = setTimeout(function () {
            root.innerHTML = "";
        }, 1800);
    };

}());
