"use strict";

const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const searchEngine = document.getElementById("sj-search-engine");

const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
});

function applyProfile(profileId) {
    let title = "Games", icon = "";
    if (profileId === "google-classroom") { title = "Classes"; icon = "https://ssl.gstatic.com/classroom/favicon.png"; }
    else if (profileId === "desmos") { title = "Desmos | Graphing Calculator"; icon = "https://www.desmos.com/favicon.ico"; }
    else if (profileId === "ap-classroom") { title = "AP Classroom"; icon = "https://apclassroom.collegeboard.org/favicon.ico"; }
    
    document.title = title;
    if (icon) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = icon;
    }
}

async function initNetworkEngine() {
    if (window.location.hash.length <= 1) return;

    let payloadUrl = "";
    try {
        const decoded = atob(window.location.hash.substring(1));
        const payload = JSON.parse(decoded);
        payloadUrl = payload.u;
        applyProfile(payload.p);
    } catch (e) {
        return; // silently fail
    }

    try {
        await loadScript("/scram/scramjet.all.js");
        await loadScript("/baremux/index.js");
        await loadScript("register-sw.js");
        await loadScript("search.js");

        const { ScramjetController: GameEngine } = window.$scramjetLoadController();
        const engine = new GameEngine({
            files: {
                wasm: "/scram/scramjet.wasm.wasm",
                all: "/scram/scramjet.all.js",
                sync: "/scram/scramjet.sync.js",
            },
        });

        engine.init();
        const sysCon = new window.BareMux.BareMuxConnection("/baremux/worker.js");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await window.registerSW();
            const target = window.search(address.value, searchEngine.value);

            let wispNode = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
            if ((await sysCon.getTransport()) !== "/libcurl/index.mjs") {
                await sysCon.setTransport("/libcurl/index.mjs", [{ websocket: wispNode }]);
            }
            const view = engine.createFrame();
            view.frame.id = "sys-frame";
            view.frame.style.border = "none";
            view.frame.style.width = "100vw";
            view.frame.style.height = "100vh";
            document.body.appendChild(view.frame);
            view.go(target);
        });

        address.value = payloadUrl;
        setTimeout(() => {
            form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }, 100);

    } catch (e) {
        console.error("Engine failure:", e);
    }
}

initNetworkEngine();
