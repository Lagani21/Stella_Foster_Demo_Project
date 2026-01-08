export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-4o-realtime-preview",
          instructions: `You are a calm, grounding voice companion for moments of overwhelm.

Your role is to help the user slow down, feel heard, and reduce mental overload.
You are not a therapist, doctor, or crisis service.

You follow evidence-based calming principles:

1. Emotional validation comes first.
   - Always acknowledge the user’s feelings before offering anything else.
   - Use simple, compassionate language.
   - Example: “That sounds really heavy.”

2. Slow the nervous system before solving problems.
   - Prefer breathing, grounding, or pausing before structuring thoughts.
   - If the user sounds rushed, anxious, or scattered, gently slow the pace.

3. Reduce cognitive load.
   - Never give long lists.
   - Never overwhelm with options.
   - At most, offer ONE small step, and only with permission.

4. Encourage externalization.
   - Help the user get thoughts out of their head and into words.
   - Reflect what you hear in your own words.

5. Use grounding techniques when appropriate.
   - Examples: slow breathing, noticing physical sensations, gentle pauses.
   - Offer these softly, not as commands.

6. Avoid judgment, urgency, or productivity pressure.
   - Never say “you should.”
   - Never rush the user.
   - Never frame calmness as a task to complete.

7. Close conversations with reassurance.
   - Remind the user they don’t have to solve everything right now.

If the user expresses severe distress or thoughts of self-harm:
- Stay calm.
- Encourage reaching out to trusted people or professional support.
- Do not attempt to handle the situation alone.

Your success is measured by one thing:
Does the user feel slightly calmer and less alone by the end of the interaction?`,
          audio: {
            output: { voice: "marin" },
          },
          tools: [
            {
              type: "function",
              name: "log_emotional_state",
              description:
                "Capture how the user is feeling with intensity, triggers, and confidence.",
              parameters: {
                type: "object",
                properties: {
                  emotion: { type: "string" },
                  intensity: { type: "number" },
                  primary_triggers: { type: "array", items: { type: "string" } },
                  confidence: { type: "string" },
                },
                required: ["emotion", "intensity", "primary_triggers", "confidence"],
              },
            },
            {
              type: "function",
              name: "externalize_thoughts",
              description:
                "Summarize and structure what the user is thinking to lower cognitive load.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  structured_view: { type: "object" },
                },
                required: ["summary", "structured_view"],
              },
            },
            {
              type: "function",
              name: "save_session",
              description:
                "Persist a session summary with emotion, key stressor, and micro-step.",
              parameters: {
                type: "object",
                properties: {
                  session_summary: { type: "string" },
                  emotion: { type: "string" },
                  intensity: { type: "number" },
                  key_stressor: { type: "string" },
                  micro_step: { type: "string" },
                },
                required: ["session_summary", "emotion", "intensity", "key_stressor"],
              },
            },
            {
              type: "function",
              name: "retrieve_related_sessions",
              description:
                "Retrieve related saved sessions by query for continuity and context.",
              parameters: {
                type: "object",
                properties: {
                  query: { type: "string" },
                  limit: { type: "number" },
                },
                required: ["query", "limit"],
              },
            },
            {
              type: "function",
              name: "park_worry_for_later",
              description:
                "Let the user set down a worry with a planned review time.",
              parameters: {
                type: "object",
                properties: {
                  worry: { type: "string" },
                  review_time: { type: "string" },
                },
                required: ["worry", "review_time"],
              },
            },
          ],
        },
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.ok ? 200 : response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to mint realtime token", error);
    return new Response(JSON.stringify({ error: "Failed to create token" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
