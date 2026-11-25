import { escapedHtml } from '../../src/escaped-html';
import { LANDING_COPY } from '../../src/site/landing-copy';

enum LineKind {
  Fence = 'fence',
  CodeText = 'code-text',
  Blank = 'blank',
  Heading = 'heading',
  ListItem = 'list-item',
  Text = 'text',
}

enum BlockKind {
  Code = 'code',
  Heading = 'heading',
  List = 'list',
  Paragraph = 'paragraph',
}

type Block = { kind: BlockKind; lines: string[]; isOpen: boolean };

type LineInput = { blocks: Block[]; line: string };

const LINE_SEPARATOR = '\n';
const PARAGRAPH_LINE_SEPARATOR = ' ';
const FENCE_MARK = '```';
const HEADING_MARKS_END = ' ';
const LIST_ITEM_MARK = '- ';
const HEADING_PATTERN = /^#{1,6} \S/;
const INLINE_PATTERN = /`(?<code>[^`]+)`|\*\*(?<bold>[^*]+)\*\*|\[(?<label>[^\]]+)\]\((?<target>[^)\s]+)\)/g;
const KEPT_LINK_PATTERN = /^(?:https:\/\/|#)/;
const INLINE_MARK_PATTERN = /`|\*\*/g;
const ID_SEPARATOR_PATTERN = /[^a-z0-9]+/g;
const ID_EDGE_PATTERN = /^-|-$/g;
const ID_SEPARATOR = '-';
const CODE_REGION_OPENING = `<pre class="code" tabindex="0" role="region" aria-label="${escapedHtml(LANDING_COPY.selfHost.codeLabel)}"><code>`;
const CODE_REGION_CLOSING = '</code></pre>';

function lastOpen({ blocks, kind }: { blocks: Block[]; kind: BlockKind }): Block | null {
  const last = blocks.at(-1);
  const isOpenOfKind = last !== undefined && last.kind === kind && last.isOpen;
  if (!isOpenOfKind) return null;
  return last;
}

function lineKindOf({ blocks, line }: LineInput): LineKind {
  if (line.startsWith(FENCE_MARK)) return LineKind.Fence;
  if (lastOpen({ blocks, kind: BlockKind.Code }) !== null) return LineKind.CodeText;
  if (line.trim() === '') return LineKind.Blank;
  if (HEADING_PATTERN.test(line)) return LineKind.Heading;
  if (line.startsWith(LIST_ITEM_MARK)) return LineKind.ListItem;
  return LineKind.Text;
}

function appendTo({ blocks, line, kind }: LineInput & { kind: BlockKind }): void {
  const open = lastOpen({ blocks, kind });
  if (open === null) {
    blocks.push({ kind, lines: [line], isOpen: true });
    return;
  }
  open.lines.push(line);
}

function absorbFence({ blocks }: LineInput): void {
  const code = lastOpen({ blocks, kind: BlockKind.Code });
  if (code === null) {
    blocks.push({ kind: BlockKind.Code, lines: [], isOpen: true });
    return;
  }
  code.isOpen = false;
}

function absorbBlank({ blocks }: LineInput): void {
  const last = blocks.at(-1);
  if (last === undefined) return;
  last.isOpen = false;
}

const LINE_HANDLERS: Record<LineKind, (input: LineInput) => void> = {
  [LineKind.Fence]: absorbFence,
  [LineKind.CodeText]: ({ blocks, line }) => appendTo({ blocks, line, kind: BlockKind.Code }),
  [LineKind.Blank]: absorbBlank,
  [LineKind.Heading]: ({ blocks, line }) => blocks.push({ kind: BlockKind.Heading, lines: [line], isOpen: false }),
  [LineKind.ListItem]: ({ blocks, line }) => appendTo({ blocks, line: line.slice(LIST_ITEM_MARK.length), kind: BlockKind.List }),
  [LineKind.Text]: ({ blocks, line }) => appendTo({ blocks, line, kind: BlockKind.Paragraph }),
};

function blocksOf(markdown: string): Block[] {
  return markdown.split(LINE_SEPARATOR).reduce<Block[]>((blocks, line) => {
    LINE_HANDLERS[lineKindOf({ blocks, line })]({ blocks, line });
    return blocks;
  }, []);
}

function linkHtml({ label, target }: { label: string; target: string }): string {
  if (!KEPT_LINK_PATTERN.test(target)) return inlineHtml(label);
  return `<a href="${escapedHtml(target)}">${inlineHtml(label)}</a>`;
}

function tokenHtml(match: RegExpExecArray): string {
  const { groups } = match;
  if (groups === undefined) throw new Error('the inline pattern names its groups');
  const { code, bold, label, target } = groups;
  if (code !== undefined) return `<code>${escapedHtml(code)}</code>`;
  if (bold !== undefined) return `<strong>${inlineHtml(bold)}</strong>`;
  if (label === undefined || target === undefined) throw new Error('an inline match is code, bold or a link');
  return linkHtml({ label, target });
}

function inlineHtml(text: string): string {
  const { html, consumed } = [...text.matchAll(INLINE_PATTERN)].reduce(
    (rendered, match) => ({
      html: `${rendered.html}${escapedHtml(text.slice(rendered.consumed, match.index))}${tokenHtml(match)}`,
      consumed: match.index + match[0].length,
    }),
    { html: '', consumed: 0 },
  );
  return `${html}${escapedHtml(text.slice(consumed))}`;
}

function headingOf(block: Block): { level: number; text: string; id: string } {
  const line = block.lines.join('');
  const level = line.indexOf(HEADING_MARKS_END);
  const text = line.slice(level + HEADING_MARKS_END.length);
  const id = text.replace(INLINE_MARK_PATTERN, '').toLowerCase().replace(ID_SEPARATOR_PATTERN, ID_SEPARATOR).replace(ID_EDGE_PATTERN, '');
  return { level, text, id };
}

function headingHtml(block: Block): string {
  const { level, text, id } = headingOf(block);
  return `<h${level} id="${id}">${inlineHtml(text)}</h${level}>`;
}

function listHtml(block: Block): string {
  return ['<ul>', ...block.lines.map((item) => `<li>${inlineHtml(item)}</li>`), '</ul>'].join(LINE_SEPARATOR);
}

const BLOCK_HTML: Record<BlockKind, (block: Block) => string> = {
  [BlockKind.Code]: (block) => `${CODE_REGION_OPENING}${escapedHtml(block.lines.join(LINE_SEPARATOR))}${CODE_REGION_CLOSING}`,
  [BlockKind.Heading]: headingHtml,
  [BlockKind.List]: listHtml,
  [BlockKind.Paragraph]: (block) => `<p>${inlineHtml(block.lines.join(PARAGRAPH_LINE_SEPARATOR))}</p>`,
};

export function markdownHtml(markdown: string): string {
  const blocks = blocksOf(markdown);
  const ids = blocks.filter((block) => block.kind === BlockKind.Heading).map((block) => headingOf(block).id);
  const repeatedId = ids.find((id, index) => ids.indexOf(id) !== index);
  if (repeatedId !== undefined) throw new Error(`two headings share the id ${repeatedId}`);
  return blocks.map((block) => BLOCK_HTML[block.kind](block)).join(LINE_SEPARATOR);
}
