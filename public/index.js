"use strict";

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

    const form = document.getElementById("sj-form");
    const address = document.getElementById("sj-address");
    const searchEngine = document.getElementById("sj-search-engine");

    if (!form || !address || !searchEngine) {
        // Retry once after DOM content loaded if they are missing
        if (document.readyState === "loading") {
            window.addEventListener("DOMContentLoaded", initNetworkEngine);
            return;
        }
    }

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
        await loadScript("/api/v1/assets/scramjet.all.js");
        await loadScript("/api/v1/worker/index.js");
        await loadScript("/api/v1/register");
        await loadScript("/api/v1/search");

        const { ScramjetController: GameEngine } = window.$scramjetLoadController();
        const engine = new GameEngine({
            prefix: "/api/v1/net/",
            files: {
                wasm: "/api/v1/assets/scramjet.wasm.wasm",
                all: "/api/v1/assets/scramjet.all.js",
                sync: "/api/v1/assets/scramjet.sync.js",
            },
        });

        engine.init();
        
        // Connect BareMux using the Service Worker directly to bypass SharedWorker security restrictions
        const sysCon = new window.BareMux.BareMuxConnection();

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await window.registerSW();
            const target = window.search(address.value, searchEngine.value);
            console.log("Internal search result:", target);

            let wispNode = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
            
            try {
                // Force libcurl transport through the ServiceWorker interface
                if ((await sysCon.getTransport()) !== "/api/v1/transport/index.mjs") {
                    console.log("Setting transport to libcurl via SW...");
                    await sysCon.setTransport("/api/v1/transport/index.mjs", [{ websocket: wispNode }]);
                }
            } catch (e) {
                console.error("Transport setup failed:", e);
            }

            const view = engine.createFrame();
            view.frame.id = "sys-frame";
            view.frame.style.cssText = "border:none;width:100vw;height:100vh;background:white;";
            document.body.appendChild(view.frame);
            
            // Hardcoded manual navigation to ensure we hit our stealthy SW prefix
            const proxiedUrl = location.origin + "/api/v1/net/" + target;
            console.log("Navigating frame directly to:", proxiedUrl);
            view.frame.src = proxiedUrl;
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
