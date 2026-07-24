import { createFileRoute } from "@tanstack/react-router";
import MainTimer from "@/components/main-timer";

export const Route = createFileRoute("/competition")({
	component: RouteComponent,
});

function RouteComponent() {
	return <MainTimer />;
}
