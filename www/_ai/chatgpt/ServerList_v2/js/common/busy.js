(function () {
    "use strict";

    oAPP.common.busy = {};

    oAPP.common.busy.show = function (title, desc) {
        var layer = document.getElementById("u4aWsBusyIndicator");
        if (!layer) return;

        var titleEl = layer.querySelector(".u4a-busy-title");
        var descEl = layer.querySelector(".u4a-busy-desc");

        if (titleEl) titleEl.textContent = title || "Loading...";
        if (descEl) descEl.textContent = desc || "Please wait a moment.";

        document.body.style.pointerEvents = "none";
        layer.style.pointerEvents = "auto";
        layer.classList.remove("is-hidden");
    };

    oAPP.common.busy.hide = function () {
        var layer = document.getElementById("u4aWsBusyIndicator");
        document.body.style.pointerEvents = "";
        if (layer) layer.classList.add("is-hidden");
    };

}());
