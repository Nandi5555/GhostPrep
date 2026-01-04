/**
 * Answer formatting / normalization layer.
 *
 * IMPORTANT:
 * - This is used by the renderer during BOTH final response rendering and
 *   throttled streaming updates (see `AssistantView._scheduleStreamMarkdownRender`).
 * - Call-sites historically passed `(answerText, questionText, customPromptOrNull)`.
 *   JavaScript ignores extra args, but we keep the 3-arg signature for compatibility
 *   and to avoid accidental regressions when formatting rules depend on context.
 *
 * Design:
 * - Be conservative: do not rewrite content that is already valid Markdown.
 * - Only "repair" common model outputs: bare multi-line code blocks without fences.
 */

function normalizeNewlines(s) {
    return String(s ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Backwards-compatible signature:
 * - rawText: string
 * - questionText: (optional) string
 * - customPromptOrContext: (optional) string|object|null
 */
function formatAnswer(rawText, _questionText = '', _customPromptOrContext = null) {
    return normalizeNewlines(rawText);
}

function readActiveCustomPrompt() {
    // Kept only for backward compatibility with older imports/usage.
    return '';
}

export { formatAnswer, readActiveCustomPrompt };
