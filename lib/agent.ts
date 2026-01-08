
export async function getAgentResponse(transcript: string, context: string[] = []) {
	const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
	if (!apiKey) throw new Error('Missing OpenAI API key');

	const systemPrompt = `You are a calm, supportive voice companion. Your goal is to help the user feel less overwhelmed. Do not rush. Do not give lists unless asked. Prefer reflection over advice.`;

	const messages = [
		{ role: 'system', content: systemPrompt },
		...context.map((c) => ({ role: 'user', content: c })),
		{ role: 'user', content: transcript }
	];

	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: 'gpt-3.5-turbo',
			messages,
			temperature: 0.7,
		}),
	});
	if (!res.ok) {
		const err = await res.text();
		throw new Error('OpenAI LLM error: ' + err);
	}
	const data = await res.json();
	return data.choices?.[0]?.message?.content || '';
}
