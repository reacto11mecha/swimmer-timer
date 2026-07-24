// apps/web/src/server/mqtt.functions.ts
import { publishCommand } from "./mqtt-client";

export async function publishResetToHardware() {
  return publishCommand("control", { command: "RESET" });
}

export async function publishStopToHardware() {
  return publishCommand("control", { command: "STOP" });
}

// Fungsi baru: stop lalu reset hardware (untuk transisi heat)
export async function publishStopAndResetHardware() {
  await publishStopToHardware();
  // Jeda kecil agar hardware sempat memproses STOP sebelum RESET
  await new Promise(resolve => setTimeout(resolve, 3000));
  await publishResetToHardware();
}
