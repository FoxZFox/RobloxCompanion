import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';
import { readFile, stat, writeFile } from 'node:fs/promises';

/**
 * Two-stage build, because the extension has two kinds of JavaScript with incompatible
 * constraints.
 *
 * PAGES (popup, side panel, dashboard, options) run on the extension's own origin under
 * our own CSP, so Vite's normal ES-module output is fine and React code-splitting works.
 *
 * INJECTED SCRIPTS (content script, MAIN-world bridge, service worker) are bundled by
 * esbuild into self-contained IIFEs with no imports at all. This is not a style
 * preference:
 *
 *   roblox.com's CSP does not list chrome-extension: in script-src, so anything that
 *   reaches for a chrome-extension: URL from the page's context is blocked outright in
 *   Chrome 130+. A bundler that emits a loader stub doing `import("./chunk.js")` -
 *   which is what the usual MV3 Vite plugin produces - therefore breaks the MAIN-world
 *   bridge silently, taking the join feature with it.
 *
 * One file per script, no dynamic imports, nothing to fetch at runtime.
 */

/**
 * Release builds drop everything meant for whoever is building this thing.
 *
 * One codebase, two outputs. `--release` writes to dist-release/ with `__RELEASE__` true,
 * which switches off Developer Mode, the API probe and the job-id check, hides features
 * that are not finished, and swaps the long engineering explanations in Settings for the
 * short version. Nothing about how the extension behaves on Roblox changes.
 *
 * The honest caveats stay in both. They are not developer notes - "this is time since you
 * joined, not time played" is the difference between a number and a claim.
 */
const release = process.argv.includes('--release');
const OUT = release ? 'dist-release' : 'dist';

const SCRIPTS = [
  // `pageCsp` marks the scripts that execute on roblox.com and are therefore subject to
  // its Content-Security-Policy. The service worker runs on the extension's own origin.
  { entry: 'src/background/serviceWorker.ts', outfile: `${OUT}/background.js`, pageCsp: false },
  { entry: 'src/content/bootstrap.ts', outfile: `${OUT}/content.js`, pageCsp: true },
  { entry: 'src/main-world/index.ts', outfile: `${OUT}/main-world.js`, pageCsp: true },
];

const watch = process.argv.includes('--watch');

async function buildPages() {
  await viteBuild({
    logLevel: 'warn',
    build: { outDir: OUT },
    define: { __RELEASE__: String(release) },
  });
}

async function buildScripts() {
  await Promise.all(
    SCRIPTS.map((script) =>
      esbuild({
        entryPoints: [script.entry],
        outfile: script.outfile,
        bundle: true,
        format: 'iife',
        target: 'chrome114',
        platform: 'browser',
        sourcemap: true,
        logLevel: 'warning',
        // Fails the build rather than emitting a runtime import that CSP would block.
        splitting: false,
        /*
         * The content script now carries React for the in-page panel, and this is what
         * keeps that affordable. Without it esbuild bundles React's development build -
         * every warning string and dev-only branch - which weighs over a megabyte and is
         * injected into every Roblox page load.
         */
        define: { 'process.env.NODE_ENV': '"production"', __RELEASE__: String(release) },
        minify: true,
      }),
    ),
  );
}

/**
 * Guards the one invariant that silently breaks the join bridge.
 *
 * roblox.com's CSP has no `chrome-extension:` in script-src, so anything reaching for a
 * chrome-extension: URL from the page's context is blocked. `format: 'iife'` plus
 * `splitting: false` should make that impossible, but this asserts it rather than
 * assuming - a regression here fails silently at runtime, in the worst possible place.
 *
 * String occurrences are ignored: React ships warning text mentioning `import(`.
 */
async function assertNoRuntimeImports() {
  const REAL_IMPORT = /(^|[^"'`\w.])import\s*\(/;
  for (const script of SCRIPTS.filter((s) => s.pageCsp)) {
    const code = await readFile(script.outfile, 'utf8');
    const stripped = code
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, '``');
    if (REAL_IMPORT.test(stripped)) {
      throw new Error(
        `${script.outfile} contains a runtime import(), which roblox.com's CSP will block`,
      );
    }
  }
}

/*
 * Size budgets for the three scripts, in kilobytes.
 *
 * These are the only outputs whose weight the user pays for without asking: content.js
 * and main-world.js are injected into every roblox.com page load, and background.js is
 * parsed each time Chrome wakes the service worker - which MV3 does constantly. The
 * extension's own pages are opened deliberately and are not budgeted here.
 *
 * Measured on 28 Aug 2026, at v0.8.0: content 286 KB, background 66 KB, main-world 1 KB.
 * Each budget is roughly a tenth above what was measured, so ordinary growth is silent
 * and a step change - a library pulled into the content script, say - is not. Raising one
 * is a decision to make on purpose, with the new number measured, not a formality.
 */
const SIZE_BUDGET_KB = {
  'content.js': 320,
  'background.js': 96,
  'main-world.js': 4,
};

/**
 * Reports what each injected script weighs, and fails the build when one outgrows its
 * budget.
 *
 * Printed on every build rather than only on failure: a number nobody sees is a number
 * nobody notices creeping, and this is the one performance figure the project can measure
 * honestly without guessing at anyone's machine.
 */
async function reportSizes() {
  const rows = [];
  let over = null;

  for (const script of SCRIPTS) {
    const { size } = await stat(script.outfile);
    const kb = size / 1024;
    const budget = SIZE_BUDGET_KB[script.outfile.slice(OUT.length + 1)];
    rows.push(`  ${script.outfile.padEnd(22)} ${kb.toFixed(1).padStart(7)} KB / ${budget} KB`);
    if (budget !== undefined && kb > budget) over ??= { outfile: script.outfile, kb, budget };
  }

  console.log(rows.join('\n'));
  if (over) {
    throw new Error(
      `${over.outfile} is ${over.kb.toFixed(1)} KB, over its ${over.budget} KB budget. ` +
        'It is injected into every Roblox page load, so either trim it or raise the budget ' +
        'deliberately in build.mjs.',
    );
  }
}

/**
 * The in-page panel renders in a Shadow DOM root, which cannot see a stylesheet emitted
 * into the main document, so the shared CSS is compiled into a string module. Running it
 * here means the panel can never ship with stale styles.
 */
async function regenerateSharedStyles() {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['tools/make-shared-styles.mjs'], { stdio: 'inherit' });
}

/**
 * Keeps the manifest version in step with package.json so they cannot drift, and names
 * the development build so two loaded side by side are told apart at a glance.
 */
async function syncManifest() {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const manifestPath = `${OUT}/manifest.json`;
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  manifest.version = pkg.version;
  if (!release) manifest.name = `${manifest.name} (dev)`;

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function run() {
  const started = Date.now();
  // The panel needs the shared CSS as a string; keep it in step with the stylesheet.
  await regenerateSharedStyles();
  await buildPages(); // Runs first: Vite empties the output directory.
  // CSS imported by the content script lands beside it as content.css, since esbuild
  // names the stylesheet after the outfile. That is the path the manifest references.
  await buildScripts();
  await assertNoRuntimeImports();
  await syncManifest();
  await reportSizes();
  console.log(`built ${release ? 'release' : 'dev'} in ${Date.now() - started}ms → ${OUT}/`);
}

await run();

if (watch) {
  const { watch: fsWatch } = await import('node:fs');
  let timer;
  fsWatch('src', { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      run().catch((err) => console.error(err));
    }, 150);
  });
  console.log('watching src/ ...');
}
