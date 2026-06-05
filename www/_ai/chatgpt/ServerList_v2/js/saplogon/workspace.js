(function () {
    "use strict";

    oAPP.fn.fnCreateWorkspaceTree = function () {
        var oLandscapeFile = oAPP.data.SAPLogon.LandscapeFile || {};
        var aWorkSpace = [];

        if (oLandscapeFile.Workspaces && oLandscapeFile.Workspaces.Workspace) {
            aWorkSpace = oAPP.common.util.toArray(oLandscapeFile.Workspaces.Workspace);
        }

        var rootNode = {
            _attributes: {
                name: "Workspace",
                uuid: "WorkspaceROOT"
            },
            Node: aWorkSpace
        };

        rootNode.Node = oAPP.fn.fnWorkSpaceSort(rootNode.Node || []);
        oAPP.data.state.workspaceTree = [rootNode];
    };

    oAPP.fn.fnWorkSpaceSort = function (aNode) {
        if (!Array.isArray(aNode)) {
            return [];
        }

        aNode.sort(function (a, b) {
            var keyA = (((a || {})._attributes || {}).name || "").toUpperCase();
            var keyB = (((b || {})._attributes || {}).name || "").toUpperCase();
            return keyA.localeCompare(keyB);
        });

        aNode.forEach(function (oNode) {
            if (oNode.Node) {
                oNode.Node = oAPP.fn.fnWorkSpaceSort(oAPP.common.util.toArray(oNode.Node));
            }
        });

        return aNode;
    };

    oAPP.fn.fnPressWorkSpaceTreeItem = async function (node) {
        if (!node || !node._attributes) {
            return;
        }

        var sUUID = node._attributes.uuid;
        oAPP.data.state.selectedWorkspaceId = sUUID;

        await oAPP.fn.setRegistryLastSelectedNodeKey(sUUID);

        var aItemList = oAPP.fn.getServerListByWorkspaceNode(node);

        aItemList.sort(function (a, b) {
            return String(a.name || "").localeCompare(String(b.name || ""));
        });

        oAPP.data.state.sapLogonItems = aItemList;
        oAPP.server.syncSavedServerInfo();
        oAPP.ui.layout.render();
    };

    oAPP.fn.getServerListByWorkspaceNode = function (node) {
        var aServerList = oAPP.data.state.serverList || [];
        var aResult = [];
        var items = oAPP.common.util.toArray(node.Item);

        items.forEach(function (item) {
            var serviceId = item && item._attributes ? item._attributes.serviceid : "";
            if (!serviceId) return;

            var found = aServerList.find(function (server) {
                return server.uuid === serviceId;
            });

            if (found) {
                aResult.push(oAPP.common.util.deepClone(found));
            }
        });

        return aResult;
    };

    oAPP.fn.restoreInitialWorkspaceSelection = function () {
        var root = oAPP.data.state.workspaceTree[0];
        if (!root) {
            return;
        }

        oAPP.data.state.selectedWorkspaceId = root._attributes.uuid;
        oAPP.data.state.sapLogonItems = oAPP.fn.getAllServersForRoot();
        oAPP.server.syncSavedServerInfo();
    };

    oAPP.fn.getAllServersForRoot = function () {
        return (oAPP.data.state.serverList || []).map(function (server) {
            return oAPP.common.util.deepClone(server);
        });
    };

    oAPP.fn.setRegistryLastSelectedNodeKey = async function (value) {
        try {
            if (!oAPP.SETTINGS || !oAPP.SETTINGS.regPaths || !oAPP.SETTINGS.regPaths.LastSelectedNodeKey) {
                return;
            }

            var Regedit = parent.require("regedit").promisified;
            var sPath = oAPP.SETTINGS.regPaths.LastSelectedNodeKey;

            await Regedit.createKey([sPath]);
            var oPut = {};
            oPut[sPath] = {
                LastSelectedNodeKey: {
                    value: value,
                    type: "REG_DEFAULT"
                }
            };

            await Regedit.putValue(oPut);

        } catch (error) {
            console.warn("[setRegistryLastSelectedNodeKey skipped]", error);
        }
    };

}());
