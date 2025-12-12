function buildHistoryForModel(conversationHistory, { includeScreenTurns = true } = {}) {
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
        .slice(-8);
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
} = {}) {
    const t = String(transcript || '').trim();
    if (!t) throw new Error('No transcription available');
    if (!modelAdapter || typeof modelAdapter.generateText !== 'function') {
        throw new Error('Model not initialized');
    }

    const prompt = String(actionPrompt || '').trim();
    const userText = prompt ? `${prompt}\n\n${t}` : t;
    const history = buildHistoryForModel(conversationHistory);

    const responseText = await modelAdapter.generateText({
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


