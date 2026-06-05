(function () {
    "use strict";

    oAPP.common.sound = {};

    oAPP.common.sound.play = function (src) {
        var audio = document.getElementById("u4aWsAudio");
        if (!audio || !src) return;

        if (!audio.paused) return;

        audio.src = "";
        audio.src = src;
        audio.play().catch(function () {});
    };

}());
