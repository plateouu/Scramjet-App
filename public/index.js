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

function decodeLegacyPayload(hashValue) {
    try {
        return JSON.parse(atob(hashValue));
    } catch {
        return null;
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchLaunchPayloadFromToken(hashValue) {
    const lookupUrls = [
        `/api/proxy-session?token=${encodeURIComponent(hashValue)}`,
        `/api/proxy-session/${encodeURIComponent(hashValue)}`,
    ];

    let lastStatus = 0;

    for (let attempt = 0; attempt < 4; attempt++) {
        for (const lookupUrl of lookupUrls) {
            const response = await fetch(lookupUrl, {
                cache: "no-store",
                credentials: "same-origin",
            });

            if (response.ok) {
                return response.json();
            }

            lastStatus = response.status;

            if (response.status !== 404) {
                throw new Error(`Session token lookup failed with status ${response.status}`);
            }
        }

        await sleep(250 * (attempt + 1));
    }

    throw new Error(`Session token lookup failed with status ${lastStatus || 404}`);
}

async function fetchCurrentLaunchPayload() {
    const response = await fetch("/api/proxy-session", {
        cache: "no-store",
        credentials: "same-origin",
    });

    if (!response.ok) {
        throw new Error(`Current session lookup failed with status ${response.status}`);
    }

    return response.json();
}

async function resolveLaunchPayload() {
    const hashValue = window.location.hash.substring(1);
    if (!hashValue) {
        return fetchCurrentLaunchPayload();
    }

    const legacyPayload = decodeLegacyPayload(hashValue);
    if (legacyPayload?.u) {
        return legacyPayload;
    }

    return fetchLaunchPayloadFromToken(hashValue);
}

async function initNetworkEngine() {
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
        const payload = await resolveLaunchPayload();
        if (!payload?.u) return;
        payloadUrl = payload.u;
        applyProfile(payload.p);
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch (e) {
        console.error("Failed to resolve launch payload:", e);
        return;
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

        await engine.init();

        const sysCon = new window.BareMux.BareMuxConnection("/api/v1/worker/worker.js");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await window.registerSW();
            const target = window.search(address.value, searchEngine.value);
            console.log("Internal search result:", target);

            let wispNode = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
            
            try {
                if ((await sysCon.getTransport()) !== "/api/v1/transport/index.mjs") {
                    console.log("Setting transport to libcurl...");
                    await sysCon.setTransport("/api/v1/transport/index.mjs", [{ websocket: wispNode }]);
                }
            } catch (e) {
                console.error("Transport setup failed:", e);
            }

            const view = engine.createFrame();
            view.frame.id = "sys-frame";
            view.frame.style.cssText = "border:none;width:100vw;height:100vh;background:#000;";
            document.body.appendChild(view.frame);

            console.log("Navigating frame via Scramjet to:", target);
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
