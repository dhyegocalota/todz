import { describe, expect, test } from 'vitest';
import { markdownHtml } from '../../scripts/site/markdown-html';

const CODE_REGION = '<pre class="code" tabindex="0" role="region" aria-label="Code">';

describe('the Markdown renderer of the self-host guide', () => {
  test('gives each heading an id from its text', () => {
    expect(markdownHtml('# Self-host todz\n\n## 1. Fork, install and check')).toBe(
      '<h1 id="self-host-todz">Self-host todz</h1>\n<h2 id="1-fork-install-and-check">1. Fork, install and check</h2>',
    );
  });

  test('an id ignores the code marks of its heading', () => {
    expect(markdownHtml('## Run `pnpm verify`')).toBe('<h2 id="run-pnpm-verify">Run <code>pnpm verify</code></h2>');
  });

  test('joins the lines of a paragraph and ends it at a blank line', () => {
    expect(markdownHtml('One line\nand the next.\n\nAnother.')).toBe('<p>One line and the next.</p>\n<p>Another.</p>');
  });

  test('a list item right under a paragraph line starts a list', () => {
    expect(markdownHtml('Check two things:\n- the first;\n- the second.')).toBe(
      '<p>Check two things:</p>\n<ul>\n<li>the first;</li>\n<li>the second.</li>\n</ul>',
    );
  });

  test('a fenced block becomes a code region a keyboard can scroll, its text kept verbatim and escaped', () => {
    expect(markdownHtml('```bash\npnpm install\necho <id> && done\n```')).toBe(
      `${CODE_REGION}<code>pnpm install\necho &lt;id&gt; &amp;&amp; done</code></pre>`,
    );
  });

  test('a fenced block keeps Markdown marks as text', () => {
    expect(markdownHtml('```\n**not bold** [not](a-link)\n```')).toBe(`${CODE_REGION}<code>**not bold** [not](a-link)</code></pre>`);
  });

  test('renders inline code and bold, escaping the text around them', () => {
    expect(markdownHtml('Use `a<b>` and **Workers Paid** <now> & "then"')).toBe(
      '<p>Use <code>a&lt;b&gt;</code> and <strong>Workers Paid</strong> &lt;now&gt; &amp; &quot;then&quot;</p>',
    );
  });

  test('an https link and a fragment stay links', () => {
    expect(markdownHtml('See [the docs](https://example.com/a?b=1&c=2) and [step 2](#2-rename).')).toBe(
      '<p>See <a href="https://example.com/a?b=1&amp;c=2">the docs</a> and <a href="#2-rename">step 2</a>.</p>',
    );
  });

  test('a repository-relative link becomes its plain text, code marks kept', () => {
    expect(markdownHtml('Read [ADR 0044](adr/0044-x.md) and ([`docs/product`](product/README.md)).')).toBe(
      '<p>Read ADR 0044 and (<code>docs/product</code>).</p>',
    );
  });

  test('an http link, which is not https, becomes its plain text', () => {
    expect(markdownHtml('[plain](http://example.com)')).toBe('<p>plain</p>');
  });

  test('a link target that tries to break out of its attribute stays inside it, escaped', () => {
    expect(markdownHtml('[x](https://example.com/"onclick=alert(1))')).toBe(
      '<p><a href="https://example.com/&quot;onclick=alert(1">x</a>)</p>',
    );
  });

  test('two headings with the same text are refused, so every id is unique', () => {
    expect(() => markdownHtml('## Same\n\n## Same')).toThrow('same');
  });
});
