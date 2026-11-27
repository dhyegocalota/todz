import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { type Catalog, type Fragment, mergedCatalog, TRANSLATED_LANGUAGES } from '../tools/repository-shape/src/mac-strings-merge';

const CATALOG_FILES: Record<string, string> = {
  'mac-strings': '../apps/macos/Copy/Localizable.xcstrings',
  'mac-strings-extra': '../apps/macos/Todz/Shortcuts/AppShortcuts.xcstrings',
};
const FRAGMENTS_FOLDER_ARGUMENT = 2;

const fragmentsFolder = process.argv[FRAGMENTS_FOLDER_ARGUMENT];
const catalogPath = fragmentsFolder ? CATALOG_FILES[basename(fragmentsFolder)] : undefined;
if (!fragmentsFolder || !catalogPath) {
  throw new Error(
    `Usage: tsx scripts/merge-mac-strings.ts <a folder named ${Object.keys(CATALOG_FILES).join(' or ')} holding one <language>.json per language>`,
  );
}
const catalogFile = join(import.meta.dirname, catalogPath);

function readJson<Value>(file: string): Value {
  return JSON.parse(readFileSync(file, 'utf8')) as Value;
}

const merged = TRANSLATED_LANGUAGES.reduce(
  (catalog, language) => mergedCatalog({ catalog, language, fragment: readJson<Fragment>(join(fragmentsFolder, `${language}.json`)) }),
  readJson<Catalog>(catalogFile),
);
writeFileSync(catalogFile, `${JSON.stringify(merged, null, 2)}\n`);
