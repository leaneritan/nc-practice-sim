import { copyFile, mkdir } from 'node:fs/promises';

// Source of truth is src/guide/*.md. Export byte-for-byte so repository copies cannot drift.
await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
for (const language of ['ja', 'en']) {
  await copyFile(new URL(`../src/guide/${language}.md`, import.meta.url), new URL(`../docs/guide-${language}.md`, import.meta.url));
}
