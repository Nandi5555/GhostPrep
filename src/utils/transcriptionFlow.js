function buildHistoryForModel(conversationHistory, { includeScreenTurns = true, maxMessages = 8 } = {}) {
    return (conversationHistory || [])
        .filter(turn => {
            if (!includeScreenTurns && turn && turn.usedScreen) return false;
            return true;
        })
        .flatMap(turn => {
            const out = [];
            if (turn?.transcription) out.push({ role: 'user', text: turn.transcription });
            if (turn?.ai_response) out.push({ role: 'model', text: turn.ai_response });
            return out;
        })
        .slice(-Math.max(1, Number(maxMessages) || 8));
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
    // Short/partial questions (e.g. "closure") often get worse answers if we include too much prior history.
    // Keep history small for short prompts to reduce "unrelated answer" risk.
    const maxMessages = t.length <= 20 ? 4 : 8;
    const history = buildHistoryForModel(conversationHistory, { maxMessages });

    const canStream = typeof onDelta === 'function' && typeof modelAdapter.generateTextStream === 'function';
    let responseText = '';
    try {
        responseText = canStream
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
    } catch (e) {
        // Streaming can occasionally hang/abort; fall back to non-streaming to guarantee finalization.
        responseText = await modelAdapter.generateText({
            systemInstruction,
            userText,
            history,
            images: images || [],
        });
    }
    if (!String(responseText || '').trim()) {
        // One more safety net: if we somehow got empty output, force a non-streaming retry.
        responseText = await modelAdapter.generateText({
            systemInstruction,
            userText,
            history,
            images: images || [],
        });
    }

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


