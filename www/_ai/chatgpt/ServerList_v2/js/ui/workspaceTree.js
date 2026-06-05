(function () {
    "use strict";

    oAPP.ui.workspaceTree = {};

    oAPP.ui.workspaceTree.render = function () {
        var tree = oAPP.common.util.createEl("nav", "u4a-tree");
        var ul = document.createElement("ul");

        var nodes = oAPP.data.state.workspaceTree || [];
        if (!nodes.length) {
            var empty = oAPP.common.util.createEl("div", "u4a-empty", "Workspace 정보가 없습니다.");
            tree.appendChild(empty);
            return tree;
        }

        nodes.forEach(function (node) {
            ul.appendChild(oAPP.ui.workspaceTree.renderNode(node));
        });

        tree.appendChild(ul);
        return tree;
    };

    oAPP.ui.workspaceTree.renderNode = function (node) {
        var li = oAPP.common.util.createEl("li", "u4a-tree-item");
        var row = oAPP.common.util.createEl("button", "u4a-tree-row");

        var uuid = node._attributes ? node._attributes.uuid : "";
        var name = node._attributes ? node._attributes.name : "";

        if (oAPP.data.state.selectedWorkspaceId === uuid) {
            row.classList.add("is-selected");
        }

        var children = oAPP.common.util.toArray(node.Node);
        var hasChildren = children.length > 0;

        row.appendChild(oAPP.common.util.createEl("span", "u4a-tree-toggle", hasChildren ? "▼" : ""));
        row.appendChild(oAPP.common.util.createEl("span", "u4a-tree-icon", "▣"));
        row.appendChild(oAPP.common.util.createEl("span", "u4a-tree-label", name));

        row.addEventListener("click", function () {
            oAPP.fn.fnPressWorkSpaceTreeItem(node);
        });

        li.appendChild(row);

        if (hasChildren) {
            var ul = document.createElement("ul");
            children.forEach(function (child) {
                ul.appendChild(oAPP.ui.workspaceTree.renderNode(child));
            });
            li.appendChild(ul);
        }

        return li;
    };

}());
