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

function looksLikeCodeLine(line) {
    const l = String(line || '');
    const t = l.trim();
    if (!t) return false;

    // Already-markdown structures we should not treat as code
    if (/^#{1,6}\s+/.test(t)) return false;
    if (/^>\s+/.test(t)) return false;

    // Explicit indentation is a strong signal, but avoid treating normal prose indents as code.
    if (/^\t+/.test(l)) return true;
    if (/^ {4,}/.test(l)) return true;

    // Heuristics for common programming lines.
    // Favor symbols + keywords, penalize long prose.
    const tooWordy = t.split(/\s+/).length > 16 && !/[{}()[\];=<>]/.test(t);
    if (tooWordy) return false;

    const hasCodePunct = /[{}()[\];=<>]/.test(t);
    const hasKeyword = /\b(const|let|var|function|class|import|export|return|if|else|for|while|switch|case|try|catch|def|async|await|public|private|static|package|interface|type)\b/.test(
        t
    );
    const looksLikePathOrCommand =
        /^(\$|>|#)\s*\S+/.test(t) ||
        /\b(npm|yarn|pnpm|node|python|pip|git|curl|brew)\b/.test(t);

    // Avoid treating bullets as code unless they are clearly code-like.
    if (/^[-*]\s+/.test(t) && !hasCodePunct && !hasKeyword && !looksLikePathOrCommand) return false;

    return hasCodePunct || hasKeyword || looksLikePathOrCommand;
}

function wrapBareCodeBlocks(text) {
    const s = normalizeNewlines(text);
    if (!s.trim()) return s;

    // If the model already used fenced code blocks, don't try to be clever.
    if (s.includes('```')) return s;

    const lines = s.split('\n');
    const out = [];
    let i = 0;

    while (i < lines.length) {
        // Find the start of a code-ish run
        if (!looksLikeCodeLine(lines[i])) {
            out.push(lines[i]);
            i++;
            continue;
        }

        const start = i;
        let end = i;
        while (end < lines.length && looksLikeCodeLine(lines[end])) end++;

        const blockLines = lines.slice(start, end);

        // Only fence "real" blocks (multi-line or reasonably long single line).
        const isMultiLine = blockLines.length >= 2;
        const isLongSingleLine = blockLines.length === 1 && blockLines[0].trim().length >= 60;
        if (isMultiLine || isLongSingleLine) {
            out.push('```');
            out.push(...blockLines);
            out.push('```');
        } else {
            out.push(...blockLines);
        }

        i = end;
    }

    return out.join('\n');
}

/**
 * Backwards-compatible signature:
 * - rawText: string
 * - questionText: (optional) string
 * - customPromptOrContext: (optional) string|object|null
 */
function formatAnswer(rawText, _questionText = '', _customPromptOrContext = null) {
    // Today we only do conservative repairs. Keep args for compatibility.
    return wrapBareCodeBlocks(rawText);
}

function readActiveCustomPrompt() {
    // Kept only for backward compatibility with older imports/usage.
    return '';
}

export { formatAnswer, readActiveCustomPrompt };