(function () {
    "use strict";

    oAPP.ui.serverTable = {};

    oAPP.ui.serverTable.renderToolbar = function () {
        var toolbar = oAPP.common.util.createEl("div", "u4a-server-toolbar");

        var searchBox = oAPP.common.util.createEl("div", "u4a-search-box");
        var input = document.createElement("input");
        input.placeholder = "Search server name, SID, host...";
        input.value = oAPP.data.state.searchText || "";
        input.addEventListener("input", function () {
            oAPP.data.state.searchText = input.value || "";
            oAPP.ui.serverTable.refreshBody();
        });
        searchBox.appendChild(input);

        var addBtn = oAPP.common.util.createEl("button", "u4a-ghost-button", "Add / Edit");
        addBtn.addEventListener("click", function () {
            var list = oAPP.ui.serverTable.getFilteredList();
            if (!list.length) {
                oAPP.common.message.alert("Server", "선택된 서버가 없습니다.");
                return;
            }
            oAPP.dialog.editServerDialog.open(list[0]);
        });

        toolbar.appendChild(searchBox);
        toolbar.appendChild(addBtn);

        return toolbar;
    };

    oAPP.ui.serverTable.render = function () {
        var wrap = oAPP.common.util.createEl("div", "u4a-table-wrap");
        var table = oAPP.common.util.createEl("table", "u4a-server-table");

        table.innerHTML = [
            "<thead>",
            "  <tr>",
            "    <th style='width:130px;'>STATUS</th>",
            "    <th>SERVER NAME</th>",
            "    <th style='width:90px;'>SID</th>",
            "    <th style='width:180px;'>HOST(Or IP)</th>",
            "    <th style='width:80px;'>SNO</th>",
            "    <th style='width:160px;text-align:right;'>Settings</th>",
            "  </tr>",
            "</thead>",
            "<tbody id='u4aServerTableBody'></tbody>"
        ].join("");

        wrap.appendChild(table);

        setTimeout(oAPP.ui.serverTable.refreshBody, 0);

        return wrap;
    };

    oAPP.ui.serverTable.refreshBody = function () {
        var tbody = document.getElementById("u4aServerTableBody");
        if (!tbody) return;

        tbody.innerHTML = "";

        var list = oAPP.ui.serverTable.getFilteredList();

        if (list.length === 0) {
            var tr = document.createElement("tr");
            tr.innerHTML = "<td colspan='6'><div class='u4a-empty'>No server data.</div></td>";
            tbody.appendChild(tr);
            return;
        }

        list.forEach(function (server) {
            tbody.appendChild(oAPP.ui.serverTable.renderRow(server));
        });
    };

    oAPP.ui.serverTable.getFilteredList = function () {
        var list = oAPP.data.state.sapLogonItems || [];
        var search = String(oAPP.data.state.searchText || "").toLowerCase();

        if (!search) {
            return list;
        }

        return list.filter(function (server) {
            return [
                server.name,
                server.systemid,
                server.host,
                server.server,
                server.insno
            ].join(" ").toLowerCase().indexOf(search) !== -1;
        });
    };

    oAPP.ui.serverTable.renderRow = function (server) {
        var tr = document.createElement("tr");
        var statusClass = server.ISSAVE ? "active" : "inactive";
        var statusText = server.ISSAVE ? "Active" : "Inactive";

        tr.innerHTML = [
            "<td><span class='u4a-status " + statusClass + "'>" + statusText + "</span></td>",
            "<td>" + oAPP.common.util.escapeHtml(server.name || "") + "</td>",
            "<td>" + oAPP.common.util.escapeHtml(server.systemid || "") + "</td>",
            "<td>" + oAPP.common.util.escapeHtml(server.host || server.server || "") + "</td>",
            "<td>" + oAPP.common.util.escapeHtml(server.insno || "") + "</td>",
            "<td><div class='u4a-row-actions'>",
            "  <button class='u4a-row-btn' data-action='edit'>Edit</button>",
            "  <button class='u4a-row-btn' data-action='delete' " + (server.ISSAVE ? "" : "disabled") + ">Delete</button>",
            "</div></td>"
        ].join("");

        tr.addEventListener("dblclick", function () {
            oAPP.fn.fnPressServerListItem(server);
        });

        tr.querySelector("[data-action='edit']").addEventListener("click", function (event) {
            oAPP.common.util.stop(event);
            oAPP.dialog.editServerDialog.open(server);
        });

        tr.querySelector("[data-action='delete']").addEventListener("click", function (event) {
            oAPP.common.util.stop(event);
            oAPP.fn.fnPressDelete(server);
        });

        return tr;
    };

}());
