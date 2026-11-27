# 0119. The docs speak eight languages, one folder per language under Mintlify navigation.languages

- Status: Accepted (the loop's call)
- Date: 2026-11-27
- Deciders: Claude (the build loop's call, under the owner's v1.2 order of 2026-11-27 for todz in every supported language)
- Inspired by: the zapbip docs, whose ADR 0048 fixed the same layout

The loop's call: docs.todz.app uses Mintlify's `navigation.languages` with eight entries, English at the root and `pt-br`, `es`, `de`, `fr`, `ja`, `ko` and `zh` as folders, each holding a twin of every English page and the same five groups with translated names; the language codes are the values of the `Language` enum in `libs/types`. Commands, code, URLs and tool names stay untranslated, links stay inside the reader's folder and images are shared. Repository-shape tests pin the twins so a page cannot drift from its English source, and Mintlify keeps its own light and dark toggle.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Translate only the pages people open first | Less to review | A language that stops mid-flow sends readers to English, and the twin tests need exceptions | The owner asked for every supported language |
| One folder per language outside `navigation.languages` | No `docs.json` change | No switcher, no per-language navigation | Mintlify's switcher is the point |
| Machine-translate at build time | No translator | Not native copy, and code could drift | The owner expects native-quality writing |
