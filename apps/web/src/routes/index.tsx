import { createFileRoute } from "@tanstack/react-router";

import TimerDashboard from "#/components/main-timer";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return <TimerDashboard />;
}
