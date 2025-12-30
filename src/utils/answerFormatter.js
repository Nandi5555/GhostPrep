// Intentionally minimal.
// The model (via system/custom prompts) must produce the final formatting/structure.
// We do not restructure, wrap, or guess code blocks in the client.

function formatAnswer(rawText) {
  return String(rawText ?? '');
}

function readActiveCustomPrompt() {
  // Kept only for backward compatibility with older imports/usage.
  return '';
}

export { formatAnswer, readActiveCustomPrompt };

 