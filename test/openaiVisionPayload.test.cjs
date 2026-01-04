const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInput } = require('../src/utils/llm/openaiResponsesClient');

test('buildInput attaches images as input_image data URLs', () => {
    const input = buildInput({
        systemPrompt: 'sys',
        history: [{ role: 'user', text: 'hi' }],
        userText: 'analyze',
        images: [{ data: 'aGVsbG8=', mimeType: 'image/jpeg' }],
    });

    const last = input[input.length - 1];
    assert.equal(last.role, 'user');
    assert.ok(Array.isArray(last.content));
    const imagePart = last.content.find((p) => p && p.type === 'input_image');
    assert.ok(imagePart, 'Expected an input_image content part');
    assert.equal(imagePart.image_url, 'data:image/jpeg;base64,aGVsbG8=');
});

