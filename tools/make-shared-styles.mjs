import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Turns the shared component CSS into a TypeScript module exporting it as a string.
 *
 * The in-page panel renders inside a Shadow DOM root, and a stylesheet emitted as its own
 * file lands in the main document where a shadow root cannot reach it. The styles have to
 * travel with the script instead.
 *
 * Generating rather than hand-maintaining a second copy is the point: the panel and the
 * extension pages must not be able to drift apart.
 *
 * Run: node tools/make-shared-styles.mjs   (also runs as part of `npm run build`)
 */

const SOURCE = 'src/components/CommandCenter.css';
const OUTPUT = 'src/content/panel/sharedStyles.ts';

const css = readFileSync(SOURCE, 'utf8');

// Anything that would terminate or interpolate the template literal has to be neutralised.
const escaped = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const banner = [
  '// GENERATED FILE - do not edit.',
  `// Source: ${SOURCE}`,
  '// Regenerate with: node tools/make-shared-styles.mjs',
  '',
  '/**',
  ' * Component styles shared by every surface: the in-page panel, the popup, the side',
  ' * panel, the dashboard and the options page.',
  ' *',
  ' * Colour tokens are NOT here. Extension pages take them from components/theme.css; the',
  ' * panel defines them on its shadow host. Only component rules belong in this file.',
  ' */',
  'export const SHARED_STYLES = `',
].join('\n');

writeFileSync(OUTPUT, `${banner}${escaped}\`;\n`);
console.log(`${OUTPUT} <- ${SOURCE} (${escaped.length} bytes of CSS)`);
