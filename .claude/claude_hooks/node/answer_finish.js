
(async function (params) {

    function HexToStr(hex) {
        var hex = hex.toString();//force conversion
        var str = '';
        for (var i = 0; i < hex.length; i += 2)
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        return str;
    }

    const oTelegramConfig = {
        botToken: "353333393236353239393a414146557a57394e743065697368635238596f594a746a4e4b76415a48776f66534651",
        chatId: "498542502"
    }

    try {

        let sMsg = "[Claude Code] 응답 완료!!";

        let sUrl = `https://api.telegram.org/bot${HexToStr(oTelegramConfig.botToken)}/sendMessage`;

        await fetch(sUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: oTelegramConfig.chatId, text: sMsg }),
        });

    } catch (e) {
        // 알림 실패해도 Claude는 막지 않음
        console.error(e);
    }

})();