function buildHistoryForModel(
    conversationHistory,
    {
        includeScreenTurns = true,
        // Keep much more context than before (ChatGPT/Cluely style), but still bounded.
        // NOTE: One "turn" becomes up to 2 messages (user + assistant).
        maxMessages = 40,
        maxChars = 12000,
    } = {}
) {
    const turns = (conversationHistory || []).filter(turn => {
        if (!includeScreenTurns && turn && turn.usedScreen) return false;
        return true;
    });

    // Build full message list (chronological).
    const messages = [];
    for (const turn of turns) {
        const userText = String(turn?.transcription || '').trim();
        const assistantText = String(turn?.ai_response || '').trim();
        if (userText) messages.push({ role: 'user', text: userText });
        if (assistantText) messages.push({ role: 'assistant', text: assistantText });
    }

    if (!messages.length) return [];

    // Enforce bounds from the end (most recent first), then reverse back to chronological.
    const selected = [];
    let totalChars = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        const t = String(m?.text || '');
        if (!t.trim()) continue;

        const nextChars = totalChars + t.length;
        if (selected.length >= maxMessages) break;
        if (selected.length > 0 && nextChars > maxChars) break;

        selected.push(m);
        totalChars = nextChars;
    }

    return selected.reverse();
}

function formatSubmittedQuestion({ actionName, transcript }) {
    const t = String(transcript || '').trim();
    const a = String(actionName || '').trim();
    if (!t) return '';
    return a ? `[${a}] ${t}` : t;
}

async function submitBufferedTranscript({
    transcript,
    actionName,
    actionPrompt,
    systemInstruction,
    conversationHistory,
    images,
    modelAdapter,
    onDelta,
} = {}) {
    const t = String(transcript || '').trim();
    if (!t) throw new Error('No transcription available');
    if (!modelAdapter || typeof modelAdapter.generateText !== 'function') {
        throw new Error('Model not initialized');
    }

    const prompt = String(actionPrompt || '').trim();
    const userText = prompt ? `${prompt}\n\n${t}` : t;
    const history = buildHistoryForModel(conversationHistory);

    const canStream = typeof onDelta === 'function' && typeof modelAdapter.generateTextStream === 'function';
    const responseText = canStream
        ? await modelAdapter.generateTextStream({
              systemInstruction,
              userText,
              history,
              images: images || [],
              onDelta,
          })
        : await modelAdapter.generateText({
              systemInstruction,
              userText,
              history,
              images: images || [],
          });

    return {
        questionText: formatSubmittedQuestion({ actionName, transcript: t }),
        responseText: (responseText || '').trim(),
        rawTranscript: t,
    };
}

module.exports = {
    submitBufferedTranscript,
    formatSubmittedQuestion,
    buildHistoryForModel,
};


