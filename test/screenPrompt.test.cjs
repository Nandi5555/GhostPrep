const test = require('node:test');
const assert = require('node:assert/strict');

const { getSystemPrompt } = require('../src/utils/prompts');

test('System prompt includes robust screen analysis rules without custom instructions', () => {
    const p = getSystemPrompt('interview', '');
    assert.ok(p.includes('Screen context rules'), 'Expected screen context rules section');
    assert.ok(
        p.toLowerCase().includes('do not guess beyond what is visible'),
        'Expected evidence-grounded rule'
    );
    assert.ok(p.toLowerCase().includes('capture is partial'), 'Expected partial capture guidance');
    assert.ok(!p.includes('UI formatting rules'), 'Expected no forced UI formatting rules');
    assert.ok(!p.includes('Output format:'), 'Expected no forced output templates');
    assert.ok(!p.includes('**Observed Screen**'), 'Expected no forced section headings');
});

test('System prompt includes robust screen analysis rules with custom instructions', () => {
    const p = getSystemPrompt('interview', 'Custom instructions here');
    assert.ok(p.includes('=== CUSTOM INSTRUCTIONS'), 'Expected custom instructions wrapper');
    assert.ok(p.includes('Screen context rules'), 'Expected screen context rules section');
    assert.ok(
        p.toLowerCase().includes('treat the screenshot as primary evidence'),
        'Expected evidence grounding rule'
    );
    assert.ok(!p.includes('UI formatting rules'), 'Expected no forced UI formatting rules');
});
