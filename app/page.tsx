
import React from "react";

function MicButton() {
	return (
		<button className="rounded-full bg-blue-600 text-white px-6 py-3 shadow hover:bg-blue-700 focus:outline-none">
			🎤 Start Talking
		</button>
	);
}

function AgentResponse() {
	return (
		<div className="mt-8 p-4 rounded bg-zinc-100 text-zinc-800 min-h-[60px] w-full">
			<span className="italic text-zinc-500">Agent response will appear here.</span>
		</div>
	);
}

function SessionList() {
	return (
		<div className="mt-12 w-full">
			<h2 className="text-lg font-semibold mb-2">Past check-ins</h2>
			<ul className="space-y-2">
				<li className="p-2 rounded bg-zinc-50 border text-zinc-600">No sessions yet.</li>
			</ul>
		</div>
	);
}

export default function Home() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
			<main className="flex flex-col items-center w-full max-w-xl py-16 px-4 bg-white dark:bg-black rounded-lg shadow-lg">
				<h1 className="text-3xl font-bold mb-6 text-center text-blue-700">Calm Voice Companion</h1>
				<MicButton />
				<AgentResponse />
				<SessionList />
			</main>
		</div>
	);
}
