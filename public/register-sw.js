"use strict";
const stockSW = "/sw.js";

/**
 * List of hostnames that are allowed to run serviceworkers on http://
 */
const swAllowedHostnames = ["localhost", "127.0.0.1"];

/**
 * Global util
 * Used in 404.html and index.html
 */
async function registerSW() {
	if (!navigator.serviceWorker) {
		if (
			location.protocol !== "https:" &&
			!swAllowedHostnames.includes(location.hostname)
		)
			throw new Error("Service workers cannot be registered without https.");

		throw new Error("Your browser doesn't support service workers.");
	}

	const registrations = await navigator.serviceWorker.getRegistrations();
	await Promise.all(
		registrations
			.filter((registration) => {
				const scriptUrl =
					registration.active?.scriptURL ||
					registration.waiting?.scriptURL ||
					registration.installing?.scriptURL ||
					"";
				return scriptUrl.includes("/api/v1/sw");
			})
			.map((registration) => registration.unregister())
	);

	const registration = await navigator.serviceWorker.register(stockSW, {
		scope: "/",
	});
	await navigator.serviceWorker.ready;

	if (!navigator.serviceWorker.controller) {
		await new Promise((resolve) => {
			const onControllerChange = () => {
				navigator.serviceWorker.removeEventListener(
					"controllerchange",
					onControllerChange
				);
				resolve();
			};

			navigator.serviceWorker.addEventListener(
				"controllerchange",
				onControllerChange
			);

			setTimeout(onControllerChange, 3000);
		});
	}

	return registration;
}
