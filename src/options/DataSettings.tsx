import { useRef, useState } from 'react';
import type { AppState, UiRequest } from '../models/messages';
import type { ApiProbeResult } from '../features/devtools/apiProbe';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

const VERDICT_ICON: Record<ApiProbeResult['verdict'], string> = {
  ok: '✓',
  refused: '✗',
  failed: '!',
  skipped: '–',
};

/**
 * Backup, restore and the API probe (spec sections 37 and 48).
 */
export function DataSettings({ state, busy, send }: Props): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Built and downloaded entirely in the page. Nothing is uploaded anywhere - the whole
   * point of local-first is that an export is a file on your disk, not a round trip.
   */
  const exportAll = (): void => {
    const bundle = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      settings: state.settings,
      customFlags: state.allCustomFlags,
      blacklist: state.blacklist,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roblox-companion-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (file: File): void => {
    setError(null);
    void file
      .text()
      .then((text) => send({ type: 'backup/import', text }))
      .catch(() => setError('Could not read that file'));
  };

  return (
    <>
      <section className="rc-card" style={{ marginBottom: 12 }}>
        <div className="rc-card__label">Backup</div>
        <p className="rc-header__sub" style={{ marginTop: 0 }}>
          Exports your settings, flags and blacklist as JSON. Importing merges rather than
          replaces, so anything already here survives.
        </p>

        <div className="rc-btn-row">
          <button type="button" className="rc-btn" disabled={busy} onClick={exportAll}>
            Export to file
          </button>
          <button
            type="button"
            className="rc-btn"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            Import from file
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) importFile(file);
            e.target.value = '';
          }}
        />

        {error ? <div className="rc-banner" style={{ marginTop: 8 }}>{error}</div> : null}
      </section>

      {state.settings.developerMode ? (
        <section className="rc-card" style={{ marginBottom: 12 }}>
          <div className="rc-card__label">API probe</div>

          {/*
            This panel exists because region detection was built on an endpoint that had
            never been called, and only failed once it shipped. Everything still marked
            docs-only carries that risk, so it can now be checked before anything is built
            on top of it.
          */}
          <p className="rc-header__sub" style={{ marginTop: 0 }}>
            Calls each endpoint the extension relies on and reports what actually came back,
            so <code>02_ROBLOX_API_MAP.md</code> can be corrected before more is built on
            top of it. Every probe is a plain read — nothing is created, bought or joined.
          </p>

          <button
            type="button"
            className="rc-btn rc-btn--primary"
            disabled={busy}
            onClick={() => send({ type: 'dev/probeApis' })}
          >
            Run probe
          </button>

          {state.apiProbe ? (
            <div style={{ marginTop: 10 }}>
              {state.apiProbe.map((result) => (
                <div className="rc-probe" key={result.id}>
                  <span aria-hidden="true">{VERDICT_ICON[result.verdict]}</span>
                  <div>
                    <div className="rc-probe__label">{result.label}</div>
                    <div className="rc-probe__detail">{result.detail}</div>
                    {result.sample ? (
                      <div className="rc-probe__sample">{result.sample}</div>
                    ) : null}
                    {/*
                      The reason to run this at all: the map claiming one thing while
                      Roblox does another is exactly what went unnoticed with region.
                    */}
                    {result.documentedAs === 'docs-only' && result.verdict === 'ok' ? (
                      <div className="rc-probe__mismatch">
                        Works — update the API map to verified-live
                      </div>
                    ) : null}
                    {result.documentedAs === 'verified-live' && result.verdict !== 'ok' ? (
                      <div className="rc-probe__mismatch">
                        Documented as verified-live but did not answer — the map is stale
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rc-header__sub" style={{ marginTop: 8 }}>
              Not run yet. Open a Roblox experience page first so the place-specific probes
              have something to work with.
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
