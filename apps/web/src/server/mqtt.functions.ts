import { createServerFn } from "@tanstack/react-start";
import { publishCommand } from "./mqtt-client";

// ==========================================
// 1. FUNGSI INTERNAL (Hanya dipanggil oleh server lain, cth: heat.functions.ts)
// ==========================================
export async function publishResetToHardware() {
	return publishCommand("control", { command: "RESET" });
}

export async function publishStopToHardware() {
	return publishCommand("control", { command: "STOP" });
}

export async function publishStopAndResetHardware() {
	await publishStopToHardware();
	await new Promise((resolve) => setTimeout(resolve, 3000));
	await publishResetToHardware();
}

export const triggerResetHardware = createServerFn({ method: "POST" }).handler(
	async () => {
		await publishResetToHardware();
		return { success: true, message: "Perintah RESET terkirim ke hardware." };
	},
);

export const triggerStopHardware = createServerFn({ method: "POST" }).handler(
	async () => {
		await publishStopToHardware();
		return { success: true, message: "Perintah STOP terkirim ke hardware." };
	},
);
