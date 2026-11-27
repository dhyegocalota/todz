import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Catalog, type Fragment, mergedCatalog, TRANSLATED_LANGUAGES } from '../tools/repository-shape/src/mac-strings-merge';

const CATALOG_FILE = join(import.meta.dirname, '../apps/macos/Copy/Localizable.xcstrings');
const FRAGMENTS_FOLDER_ARGUMENT = 2;

const fragmentsFolder = process.argv[FRAGMENTS_FOLDER_ARGUMENT];
if (!fragmentsFolder) throw new Error('Usage: tsx scripts/merge-mac-strings.ts <folder holding one <language>.json per language>');

function readJson<Value>(file: string): Value {
  return JSON.parse(readFileSync(file, 'utf8')) as Value;
}

const merged = TRANSLATED_LANGUAGES.reduce(
  (catalog, language) => mergedCatalog({ catalog, language, fragment: readJson<Fragment>(join(fragmentsFolder, `${language}.json`)) }),
  readJson<Catalog>(CATALOG_FILE),
);
writeFileSync(CATALOG_FILE, `${JSON.stringify(merged, null, 2)}\n`);
