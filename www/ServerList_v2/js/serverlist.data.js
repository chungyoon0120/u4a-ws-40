/* ====================================================================
   U4A Workspace — ServerList 데이터 (레지스트리/XML/감시)
   --------------------------------------------------------------------
   흐름: 레지스트리에서 SAPUILandscape.xml 경로 → xml-js 파싱
        → 서버목록(services) + 워크스페이스 트리(tree) 구성
        → serverInfo_v2.json 과 병합(Active/Inactive)
        → fs.watch 로 변경 감시 → onChange 콜백
   비고: 화면(ui)에서 window.WSData 로 사용.
        Electron(nodeIntegration) 아니면 데모로 폴백(브라우저 미리보기용).
   ==================================================================== */
"use strict";

(function () {

    const hasNode = (typeof require === "function");

    // ── 네이티브 핸들 (Electron 일 때만) ────────────────────────────
    let FS, PATH, APP, REGEDIT, XMLJS;
    if (hasNode) {
        try {
            FS = require("fs");
            PATH = require("path");
            const remote = require("@electron/remote");
            APP = remote.app;
            REGEDIT = require("regedit");
            XMLJS = require("xml-js");
            // 패키징 시 regedit VBS 위치(있으면) — 환경에 맞게 조정
            try {
                if (APP.isPackaged) {
                    REGEDIT.setExternalVBSLocation(
                        PATH.join(PATH.dirname(APP.getPath("exe")), "resources", "regedit", "vbs")
                    );
                }
            } catch (_) {}
        } catch (e) {
            console.error("[WSData] 네이티브 모듈 로드 실패:", e);
        }
    }

    // ── 설정(환경에 맞게 조정 가능) ────────────────────────────────
    const REG_KEY = "HKCU\\Software\\SAP\\SAPLogon\\Options";
    const REG_VALUE_CANDIDATES = ["LandscapeFile", "LandscapeFileOnServer", "LandscapeGlobalFile"];
    function defaultXmlPath() {
        const appData = (hasNode && (process.env.APPDATA || (APP && APP.getPath("appData")))) || "";
        return appData ? PATH.join(appData, "SAP", "Common", "SAPUILandscape.xml") : null;
    }
    // 실파일: %AppData%/<app>/p13n/ServerInfo-v2.json
    // 구버전(레거시) 호환: %AppData%/<app>/serverInfo_v2.json
    function savedInfoPath() {
        try {
            const base = APP.getPath("userData");
            const primary = PATH.join(base, "p13n", "ServerInfo-v2.json");
            const legacy  = PATH.join(base, "serverInfo_v2.json");
            // 읽기 시 우선순위: primary 가 있으면 primary, 아니면 legacy 도 인정
            if (FS.existsSync(primary)) return primary;
            if (FS.existsSync(legacy))  return legacy;
            // 둘 다 없으면 (최초 쓰기 대상) primary
            return primary;
        } catch (_) { return null; }
    }

    // ── 상태 ──────────────────────────────────────────────────────
    const state = {
        xmlPath: null,
        tree: null,                 // { name, uuid, children:[], items:[] }
        servicesByUuid: {},         // uuid -> 서버 속성
        savedUuids: new Set(),      // serverInfo_v2.json 에 저장된 uuid
        msgPortBySid: {},           // etc/services 에서 추출 (sapms<SID>)
    };

    // ── 유틸 ──────────────────────────────────────────────────────
    const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
    const attrs = (n) => (n && n._attributes) ? n._attributes : {};
    function regList(keys) {
        return new Promise((res, rej) => {
            try { REGEDIT.list(keys, (err, result) => (err ? rej(err) : res(result))); }
            catch (e) { rej(e); }
        });
    }

    // etc/services 에서 메시지서버 포트(sapms<SID>) best-effort 추출
    function loadMsgPorts() {
        state.msgPortBySid = {};
        try {
            const root = process.env.SystemRoot || "C:\\Windows";
            const f = PATH.join(root, "System32", "drivers", "etc", "services");
            const txt = FS.readFileSync(f, "utf8");
            txt.split(/\r?\n/).forEach((line) => {
                const m = line.match(/^\s*sapms(\w+)\s+(\d+)\/tcp/i);
                if (m) state.msgPortBySid[m[1].toUpperCase()] = m[2];
            });
        } catch (_) { /* 없으면 기본 3600 */ }
    }

    // ── 경로 해석: 레지스트리 → 기본 APPDATA ───────────────────────
    async function resolveXmlPath() {
        // 1) 레지스트리
        try {
            const res = await regList([REG_KEY]);
            const vals = (res && res[REG_KEY] && res[REG_KEY].values) || {};
            for (const k of REG_VALUE_CANDIDATES) {
                const cand = vals[k] && vals[k].value;
                if (cand && FS.existsSync(cand)) { console.log("[WSData] XML(레지스트리):", cand); return cand; }
            }
        } catch (e) { console.warn("[WSData] 레지스트리 조회 실패:", e && e.message); }
        // 2) 기본 경로
        const def = defaultXmlPath();
        if (def && FS.existsSync(def)) { console.log("[WSData] XML(기본 경로):", def); return def; }
        console.warn("[WSData] SAPUILandscape.xml 을 찾지 못함. 기본 경로:", def);
        return null;
    }

    // ── XML → 서버목록 ────────────────────────────────────────────
    function buildServices(landscape) {
        const services = {};
        const routers = {};
        arr(landscape.Routers && landscape.Routers.Router).forEach((r) => { const a = attrs(r); if (a.uuid) routers[a.uuid] = a; });
        const msgsrv = {};
        arr(landscape.Messageservers && landscape.Messageservers.Messageserver).forEach((m) => { const a = attrs(m); if (a.uuid) msgsrv[a.uuid] = a; });

        arr(landscape.Services && landscape.Services.Service).forEach((s) => {
            const a = Object.assign({}, attrs(s));
            if (a.shortcut === "1") return;                 // 바로가기 제외

            if (a.mode === "1" && a.server) {               // host:port
                const [host, port] = String(a.server).split(":");
                a.host = host; if (port) a.port = port;
            }
            if (a.msid) {                                   // 메시지 서버(로그온 그룹)
                const ms = msgsrv[a.msid] || {};
                a.host = a.server || ms.host || a.host;
                a.port = ms.port || state.msgPortBySid[(a.systemid || "").toUpperCase()] || "3600";
            } else if (!a.host && a.server) {
                a.host = a.server;
            }
            if (a.routerid && routers[a.routerid]) {
                a.router = routers[a.routerid].router || routers[a.routerid].name;
            }
            if (a.port) a.insno = String(a.port).substring(2, 4);   // SNO = 포트 3~4자리

            if (a.uuid) services[a.uuid] = a;
        });
        return services;
    }

    // ── XML → 트리 ────────────────────────────────────────────────
    function mapNode(n) {
        const a = attrs(n);
        const node = {
            name: a.name || "(no name)",
            uuid: a.uuid || "",
            items: arr(n.Item).map(attrs),
            children: arr(n.Node).map(mapNode),
        };
        node.children.sort((x, y) => (x.name || "").toUpperCase().localeCompare((y.name || "").toUpperCase()));
        return node;
    }
    function buildTree(landscape) {
        const ws = arr(landscape.Workspaces && landscape.Workspaces.Workspace).map(mapNode);
        ws.sort((x, y) => (x.name || "").toUpperCase().localeCompare((y.name || "").toUpperCase()));
        return { name: "Workspace", uuid: "WorkspaceROOT", items: [], children: ws };
    }

    // ── 저장된 접속정보(Active 판정 + 전체 엔트리) ─────────────────
    // 전체 엔트리는 모듈 내부 캐시(savedList)에 보관. state.savedUuids 는 Active 판정용 파생.
    let savedList = [];
    function loadSaved() {
        state.savedUuids = new Set();
        savedList = [];
        try {
            const p = savedInfoPath();
            if (p && FS.existsSync(p)) {
                const list = JSON.parse(FS.readFileSync(p, "utf8"));
                savedList = Array.isArray(list) ? list : [];
                savedList.forEach((r) => { if (r && r.uuid) state.savedUuids.add(r.uuid); });
            }
        } catch (e) { console.warn("[WSData] ServerInfo-v2.json 읽기 실패:", e && e.message); }
    }
    function writeSaved() {
        if (!hasNode) return false;       // 데모 모드: 메모리만
        try {
            const p = savedInfoPath();
            if (!p) return false;
            const dir = PATH.dirname(p);
            if (!FS.existsSync(dir)) FS.mkdirSync(dir, { recursive: true });
            FS.writeFileSync(p, JSON.stringify(savedList, null, 2), "utf8");
            return true;
        } catch (e) { console.error("[WSData] ServerInfo-v2.json 쓰기 실패:", e); return false; }
    }
    function getSavedByUuid(uuid)  { return savedList.find((r) => r && r.uuid === uuid) || null; }
    function getServiceByUuid(uuid){ return state.servicesByUuid[uuid] || null; }
    function upsertSaved(entry) {
        if (!entry || !entry.uuid) return { ok: false, persisted: false };
        const clean = {
            uuid: entry.uuid,
            protocol: entry.protocol || "https",
            host: (entry.host || "").trim(),
            port: (entry.port || "").trim(),
            settings: {
                useInternal:     !!(entry.settings && entry.settings.useInternal),
                skipCertificate: !!(entry.settings && entry.settings.skipCertificate),
            },
        };
        const i = savedList.findIndex((r) => r && r.uuid === entry.uuid);
        if (i >= 0) savedList[i] = clean; else savedList.push(clean);
        state.savedUuids.add(clean.uuid);
        const persisted = writeSaved();
        return { ok: true, persisted };
    }
    function removeSaved(uuid) {
        const i = savedList.findIndex((r) => r && r.uuid === uuid);
        if (i < 0) return { ok: false, persisted: false };
        savedList.splice(i, 1);
        state.savedUuids.delete(uuid);
        const persisted = writeSaved();
        return { ok: true, persisted };
    }

    // ── 노드 → 행 목록 ────────────────────────────────────────────
    function findNode(node, uuid) {
        if (!node) return null;
        if (node.uuid === uuid) return node;
        for (const c of node.children) { const r = findNode(c, uuid); if (r) return r; }
        return null;
    }
    function getRows(nodeUuid) {
        const node = findNode(state.tree, nodeUuid) || state.tree;
        if (!node) return [];
        // SAPGUI 동작: 선택한 폴더의 "직속 아이템"만 표시한다.
        // (하위 폴더 자손을 끌어모으지 않음 → 같은 서버가 여러 하위 폴더에 있을 때 생기던 중복 제거)
        const items = (node.items || []).slice();
        const rows = [];
        items.forEach((it) => {
            const svc = state.servicesByUuid[it.serviceid];
            if (!svc) return;
            rows.push({
                uuid: svc.uuid,
                name: svc.name || it.name || "",
                sid: svc.systemid || "",
                host: svc.host || "",
                sno: svc.insno || "",
                active: state.savedUuids.has(svc.uuid),
            });
        });
        rows.sort((a, b) => (a.name || "").localeCompare((b.name || "")));
        return rows;
    }

    // 트리에서 첫 선택 가능한(직속 서버가 있는) 노드 uuid
    function firstSelectableUuid() {
        let found = null;
        (function walk(n) {
            if (found || !n) return;
            if (n.items && n.items.length > 0) { found = n.uuid; return; }   // 직속 아이템이 있는 첫 노드
            n.children.forEach(walk);
        })(state.tree);
        return found || (state.tree && state.tree.children[0] && state.tree.children[0].uuid) || (state.tree && state.tree.uuid);
    }

    // ── 적재 ──────────────────────────────────────────────────────
    async function reload() {
        if (!hasNode || !XMLJS) throw new Error("NODE_UNAVAILABLE");
        if (!state.xmlPath) state.xmlPath = await resolveXmlPath();
        if (!state.xmlPath) throw new Error("XML_NOT_FOUND");

        loadMsgPorts();
        loadSaved();

        const xml = FS.readFileSync(state.xmlPath, "utf8");
        const obj = XMLJS.xml2js(xml, { compact: true, ignoreComment: true, ignoreDeclaration: true });
        const landscape = obj.Landscape || {};
        state.servicesByUuid = buildServices(landscape);
        state.tree = buildTree(landscape);
        console.log("[WSData] 적재 완료: 서버", Object.keys(state.servicesByUuid).length, "개");
        return state;
    }

    // ── 감시 ──────────────────────────────────────────────────────
    let watcher = null, debTimer = null;
    function startWatch(onChange) {
        if (!hasNode || !state.xmlPath) return;
        stopWatch();
        try {
            watcher = FS.watch(state.xmlPath, { persistent: false }, () => {
                clearTimeout(debTimer);
                debTimer = setTimeout(async () => {
                    try { await reload(); onChange && onChange(); }
                    catch (e) { console.error("[WSData] 재적재 실패:", e); }
                    // 파일이 교체(rename)되면 watcher 가 끊길 수 있어 재등록
                    startWatch(onChange);
                }, 250);
            });
            console.log("[WSData] 변경 감시 시작:", state.xmlPath);
        } catch (e) { console.warn("[WSData] fs.watch 실패:", e && e.message); }
    }
    function stopWatch() {
        try { if (watcher) watcher.close(); } catch (_) {}
        watcher = null;
    }

    // ── 데모 폴백(브라우저 미리보기) ──────────────────────────────
    function loadDemo() {
        state.servicesByUuid = {
            s1:{uuid:"s1",name:"1. [UHA] U4A 개발 서버",systemid:"UHA",host:"27.102.205.26",port:"3200",insno:"00"},
            s2:{uuid:"s2",name:"2. [U4A] U4A 운영서버",systemid:"U4A",host:"27.102.205.25",port:"3200",insno:"00"},
            s3:{uuid:"s3",name:"3. [U4E] U4A 교육서버",systemid:"U4E",host:"211.218.126.186",port:"3200",insno:"00"},
            s4:{uuid:"s4",name:"4. [U41] U4A 2.0 서버",systemid:"U41",host:"192.168.0.28",port:"3200",insno:"00"},
            s5:{uuid:"s5",name:"5. [U42] U4A WS 2.5 서버",systemid:"U42",host:"192.168.0.28",port:"3210",insno:"10"},
        };
        // 데모용 등록 데이터 — 사용자가 올려준 ServerInfo-v2.json 과 같은 스키마
        savedList = [
            {uuid:"s1",protocol:"https",host:"uha.u4aide.com",port:"10101",settings:{useInternal:false,skipCertificate:false}},
            {uuid:"s2",protocol:"https",host:"u4a.u4aide.com",port:"10102",settings:{useInternal:false,skipCertificate:false}},
            {uuid:"s3",protocol:"http", host:"u4aedusrv.u4aeduc.com",port:"9304",settings:{useInternal:false,skipCertificate:false}},
        ];
        state.savedUuids = new Set(savedList.map((r) => r.uuid));
        state.tree = { name:"Workspace", uuid:"WorkspaceROOT", items:[], children:[
            { name:"Local", uuid:"LOCAL", children:[], items:[
                {serviceid:"s1"},{serviceid:"s2"},{serviceid:"s3"},{serviceid:"s4"},{serviceid:"s5"},
            ]},
        ]};
    }

    window.WSData = {
        state,
        hasNode,
        async load() {            // 최초 적재 (실패 시 throw)
            if (!hasNode || !XMLJS) { loadDemo(); console.warn("[WSData] 비-Electron: 데모 데이터 사용"); return state; }
            return reload();
        },
        reload, getRows, firstSelectableUuid, startWatch, stopWatch,
        // 등록정보 CRUD
        getSavedByUuid, getServiceByUuid, upsertSaved, removeSaved,
        savedInfoPath,            // (디버깅·표시용)
    };

})();
