const test = require('node:test');
const assert = require('node:assert/strict');

const marked = require('../src/assets/marked-4.3.0.min.js');

function renderMarkdownLikeApp(content) {
    const escapeHtml = (str) =>
        String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const renderer = new marked.Renderer();
    renderer.code = (code, infostring) => {
        const lang = (infostring || '').trim().toLowerCase();
        const isOutput = ['output', 'text', 'plaintext', 'console'].includes(lang);
        const highlighted = escapeHtml(code);
        const langClass = lang ? `language-${lang}` : '';
        const blockClass = isOutput ? 'output-block' : '';
        return `<pre class="${blockClass}"><code class="${langClass}">${highlighted}</code></pre>`;
    };

    marked.setOptions({
        breaks: true,
        gfm: true,
        sanitize: false,
    });

    marked.use({
        renderer,
        tokenizer: {
            code: () => undefined,
        },
    });

    return marked.parse(String(content || '').replace(/\r\n/g, '\n'));
}

test('Indented prose does not render as a code block', () => {
    const md = [
        '**Main Point**',
        '',
        '    The event loop is a mechanism in JavaScript that allows non-blocking async work.',
        '',
        'Supporting paragraph.',
    ].join('\n');

    const html = renderMarkdownLikeApp(md);
    assert.ok(!html.includes('<pre'), 'Expected no <pre> blocks for indented prose');
    assert.ok(html.includes('<p>'), 'Expected prose to render as paragraphs');
});

test('Fenced code still renders as a code block', () => {
    const md = [
        '```js',
        'console.log("hi");',
        '```',
    ].join('\n');

    const html = renderMarkdownLikeApp(md);
    assert.ok(html.includes('<pre'), 'Expected fenced code to render inside <pre>');
    assert.ok(html.includes('language-js'), 'Expected language class to be preserved');
});

