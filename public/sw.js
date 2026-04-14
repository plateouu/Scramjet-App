importScripts("/api/v1/assets/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker({ prefix: "/api/v1/net/" });

self.addEventListener("install", (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

async function handleRequest(event) {
	try {
		await scramjet.loadConfig();
		if (scramjet.route(event)) {
			return scramjet.fetch(event);
		}
	} catch (err) {
		console.error("SW Fetch Error for:", event.request.url, err);
	}
	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
