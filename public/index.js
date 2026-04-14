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

async function initProxy() {
    if (window.location.hash.length <= 1) return;

    try {
        await loadScript("/scram/scramjet.all.js");
        await loadScript("/baremux/index.js");
        await loadScript("register-sw.js");
        await loadScript("search.js");

        const { ScramjetController } = window.$scramjetLoadController();
        const scramjet = new ScramjetController({
            files: {
                wasm: "/scram/scramjet.wasm.wasm",
                all: "/scram/scramjet.all.js",
                sync: "/scram/scramjet.sync.js",
            },
        });

        scramjet.init();
        const connection = new window.BareMux.BareMuxConnection("/baremux/worker.js");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await window.registerSW();
            const url = window.search(address.value, searchEngine.value);

            let wispUrl = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
            if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
                await connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
            }
            const frame = scramjet.createFrame();
            frame.frame.id = "sj-frame";
            document.body.appendChild(frame.frame);
            frame.go(url);
        });

        address.value = atob(window.location.hash.substring(1));
        setTimeout(() => {
            form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }, 100);

    } catch (e) {
        console.error("init fail");
    }
}

initProxy();
