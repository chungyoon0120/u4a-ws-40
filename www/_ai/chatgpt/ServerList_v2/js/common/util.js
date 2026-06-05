(function () {
    "use strict";

    oAPP.common.util = {};

    oAPP.common.util.createEl = function (tagName, className, text) {
        var el = document.createElement(tagName);
        if (className) el.className = className;
        if (typeof text === "string") el.textContent = text;
        return el;
    };

    oAPP.common.util.clear = function (el) {
        if (!el) return;
        while (el.firstChild) el.removeChild(el.firstChild);
    };

    oAPP.common.util.escapeHtml = function (value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    oAPP.common.util.toArray = function (value) {
        if (!value) return [];
        return Array.isArray(value) ? value : [value];
    };

    oAPP.common.util.deepClone = function (value) {
        return JSON.parse(JSON.stringify(value || null));
    };

    oAPP.common.util.stop = function (event) {
        if (!event) return;
        event.preventDefault();
        event.stopPropagation();
    };

}());
