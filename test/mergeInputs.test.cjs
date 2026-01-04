const test = require('node:test');
const assert = require('node:assert/strict');

const { formatMergedTypedAndSpokenInput } = require('../src/utils/aiPipeline');

test('formatMergedTypedAndSpokenInput returns empty when both inputs empty', () => {
    assert.equal(formatMergedTypedAndSpokenInput({ typedText: '', spokenText: '' }), '');
    assert.equal(formatMergedTypedAndSpokenInput({ typedText: '   ', spokenText: '\n' }), '');
});

test('formatMergedTypedAndSpokenInput returns typed text when only typed provided', () => {
    assert.equal(formatMergedTypedAndSpokenInput({ typedText: ' hello ', spokenText: '' }), 'hello');
});

test('formatMergedTypedAndSpokenInput returns spoken text when only spoken provided', () => {
    assert.equal(formatMergedTypedAndSpokenInput({ typedText: '', spokenText: ' hi ' }), 'hi');
});

test('formatMergedTypedAndSpokenInput merges typed and spoken with clear structure', () => {
    const out = formatMergedTypedAndSpokenInput({
        typedText: 'console.log(1+1)',
        spokenText: 'what is the output',
    });

    assert.match(out, /^Pasted content \(text input\):/);
    assert.ok(out.includes('console.log(1+1)'), 'Expected typed content preserved');
    assert.ok(out.includes('Spoken instruction (voice transcription):'), 'Expected spoken label');
    assert.ok(out.includes('what is the output'), 'Expected spoken content preserved');
});

