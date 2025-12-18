/**
 * Cluely-style system prompt builder (session-persistent).
 *
 * Design goals:
 * - Short (low latency, faster first token)
 * - Manual-triggered interview assistant
 * - Produces complete answers (not 1–3 sentences), but still ready-to-speak
 * - No chain-of-thought / no "thinking" output
 * - Custom instructions are PRIMARY and override all default rules
 */

// Minimal base rules that don't conflict with custom instructions
const BASE_RULES = `Base rules (apply only if not specified in custom instructions):
- No preface (no "Sure/Okay/Here's…").
- Do not restate the question.
- Do not ask clarifying questions.
- The transcript may contain ASR mistakes, pronunciation errors, or partial words. Always infer the intended question from context and answer the correct interpreted question, not the raw incorrect text.
- Silently correct obvious transcription mistakes and answer the intended question.
- Never mention transcription errors.
- Never reveal chain-of-thought. Output only the final answer.`;

const SCREEN = `Screen:
- If images are provided, use them as context.
- If no images are provided, do not claim you can see the screen.`;

const PROFILE = {
    interview: `Role: You are the user in a technical interview. Respond as the candidate, not as an AI assistant.`,
    sales: `Role: Sales copilot. Provide persuasive talk-tracks, objection handling, and next steps.`,
    meeting: `Role: Meeting copilot. Provide crisp professional phrasing and decisions/next steps.`,
    presentation: `Role: Presentation copilot. Provide confident speaker lines and framing.`,
    negotiation: `Role: Negotiation copilot. Provide strategic, calm, deal-focused language.`,
};

function getSystemPrompt(profile, customPrompt = '', _googleSearchEnabled = false) {
    const roleLine = PROFILE[profile] || PROFILE.interview;
    const context = String(customPrompt || '').trim();

    // If custom instructions exist, they are PRIMARY and override everything
    if (context) {
        console.log('customPrompt', customPrompt);
        return [
            roleLine,
            '',
            '=== CUSTOM INSTRUCTIONS (PRIMARY - STRICTLY FOLLOW - OVERRIDE ALL OTHER RULES) ===',
            '',
            context,
            '',
            '=== END CUSTOM INSTRUCTIONS ===',
            '',
            'Additional base rules (ONLY apply if NOT specified in custom instructions above):',
            BASE_RULES,
            '',
            SCREEN,
            '',
            'IMPORTANT: When custom instructions specify formatting, structure, length, or style rules, those rules take precedence over any base rules. Follow custom instructions exactly as written.',
        ].join('\n');
    } else {
        // No custom instructions - use default structure
        return [
            roleLine,
            '',
            BASE_RULES,
            '',
            SCREEN,
        ].join('\n');
    }
}

module.exports = {
    getSystemPrompt,
};


