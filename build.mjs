import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';

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

const SCRIPTS = [
  // `pageCsp` marks the scripts that execute on roblox.com and are therefore subject to
  // its Content-Security-Policy. The service worker runs on the extension's own origin.
  { entry: 'src/background/serviceWorker.ts', outfile: 'dist/background.js', pageCsp: false },
  { entry: 'src/content/bootstrap.ts', outfile: 'dist/content.js', pageCsp: true },
  { entry: 'src/main-world/index.ts', outfile: 'dist/main-world.js', pageCsp: true },
];

const watch = process.argv.includes('--watch');

async function buildPages() {
  await viteBuild({ logLevel: 'warn' });
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
        define: { 'process.env.NODE_ENV': '"production"' },
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

/**
 * The in-page panel renders in a Shadow DOM root, which cannot see a stylesheet emitted
 * into the main document, so the shared CSS is compiled into a string module. Running it
 * here means the panel can never ship with stale styles.
 */
async function regenerateSharedStyles() {
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, ['tools/make-shared-styles.mjs'], { stdio: 'inherit' });
}

/** Keeps the manifest version in step with package.json so they cannot drift. */
async function syncVersion() {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const manifestPath = 'dist/manifest.json';
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.version !== pkg.version) {
    manifest.version = pkg.version;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

async function run() {
  const started = Date.now();
  // The panel needs the shared CSS as a string; keep it in step with the stylesheet.
  await regenerateSharedStyles();
  await buildPages(); // Runs first: Vite empties dist/.
  // CSS imported by the content script lands at dist/content.css, since esbuild names
  // the stylesheet after the outfile. That is the path the manifest references.
  await buildScripts();
  await assertNoRuntimeImports();
  await syncVersion();
  console.log(`built in ${Date.now() - started}ms`);
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
