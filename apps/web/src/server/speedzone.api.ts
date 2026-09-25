// apps/web/src/server/speedzone.client.ts

const BASE_URL = process.env.SPEEDZONE_API_URL;
const TOKEN = process.env.SPEEDZONE_API_TOKEN;

// Helper standar untuk melakukan fetch ke Speedzone
export async function fetchSpeedzone(
	endpoint: string,
	options: RequestInit = {},
) {
	if (!TOKEN) {
		throw new Error("SPEEDZONE_API_TOKEN belum diatur di .env");
	}

	const url = `${BASE_URL}${endpoint}`;

	const headers = new Headers(options.headers);
	headers.set("Authorization", `Bearer ${TOKEN}`);
	headers.set("Accept", "application/json");

	if (options.method === "PUT" || options.method === "POST") {
		headers.set("Content-Type", "application/json");
	}

	const response = await fetch(url, {
		...options,
		headers,
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			`Speedzone API Error ${response.status}: ${JSON.stringify(errorData)}`,
		);
	}

	return response.json();
}
