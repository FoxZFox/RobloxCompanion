import { useRef, useState } from 'react';
import { STORAGE_SCHEMA_VERSION } from '../config/constants';
import type { AppState, UiRequest } from '../models/messages';
import type { ApiProbeResult } from '../features/devtools/apiProbe';
import { OPTIONAL_ORIGINS } from '../services/roblox/endpoints';
import { OptionalAccess } from './OptionalAccess';
import { Section } from './controls';
import { IS_RELEASE } from '../config/release';
import { formatDate, formatTime } from '../utils/format';

const PROBE_ORIGINS = Object.values(OPTIONAL_ORIGINS);

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

const VERDICT_ICON: Record<ApiProbeResult['verdict'], string> = {
  ok: '✓',
  empty: '○',
  refused: '✗',
  failed: '!',
  skipped: '–',
};

/** The same five verdicts in words, for anyone who is not seeing the icons. */
const VERDICT_WORD: Record<ApiProbeResult['verdict'], string> = {
  ok: 'Answered',
  empty: 'Answered with nothing',
  refused: 'Refused',
  failed: 'Failed',
  skipped: 'Skipped',
};

/**
 * One line for the whole run.
 *
 * Counts `empty` separately rather than folding it into either column, for the same
 * reason the probe has the verdict at all: an endpoint that answered with nothing has not
 * succeeded and has not failed, and a summary that picks one would be the overclaim this
 * tool exists to catch.
 */
function summarise(results: readonly ApiProbeResult[]): string {
  const count = (verdict: ApiProbeResult['verdict']): number =>
    results.filter((result) => result.verdict === verdict).length;

  const parts = [
    `${count('ok')} answered`,
    `${count('empty')} answered with nothing`,
    `${count('refused') + count('failed')} did not answer`,
  ];
  const skipped = count('skipped');
  if (skipped > 0) parts.push(`${skipped} skipped for want of access`);

  return `${results.length} endpoints checked — ${parts.join(', ')}.`;
}

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
      /*
       * Stamped with the version that actually wrote it. This said 1 until v0.3.0, which
       * meant an import refused every backup this button had ever produced: the file
       * claimed a schema three versions older than its contents.
       */
      schemaVersion: STORAGE_SCHEMA_VERSION,
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
      <Section title="Backup">
        <p className="rc-header__sub" style={{ marginTop: 0 }}>
          Saves your settings, flags and blacklist to a file. Importing merges rather than
          replaces, so nothing you already have is lost.
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

        {error ? (
          <div className="rc-banner" role="alert" style={{ marginTop: 8 }}>
            {error}
          </div>
        ) : null}
      </Section>

      {/*
        Both of these answer questions about Roblox's API before something is built on it.
        Nobody using the extension has those questions, and a stored developerMode from a
        development build must not bring them back, so the build decides too.
      */}
      {!IS_RELEASE && state.settings.developerMode ? (
        <ServerClock state={state} busy={busy} send={send} />
      ) : null}

      {!IS_RELEASE && state.settings.developerMode ? (
        <Section title="API probe">

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

          <OptionalAccess origins={PROBE_ORIGINS} label="Optional access for the probe">
            Some probes read from hosts this extension does not otherwise touch: presence
            (which server someone is in, and when they were last online), friends, avatar
            and trades. Each reads your own account, and each answers whether a blocked
            phase is possible at all.
          </OptionalAccess>

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
              {/*
                A probe run takes a while and then quietly repaints a long list. This says
                how it went in one line, which is also the only part worth announcing -
                reading every result aloud would bury the answer in the detail.
              */}
              <div className="rc-probe__detail" role="status" style={{ marginBottom: 6 }}>
                {summarise(state.apiProbe)}
              </div>
              {state.apiProbe.map((result) => (
                <div className="rc-probe" key={result.id}>
                  <span aria-hidden="true">{VERDICT_ICON[result.verdict]}</span>
                  <div>
                    {/*
                      The icon carries the verdict for everyone who can see it; this carries
                      the same word for everyone who cannot. It sits inside this column
                      rather than beside the icon because the row is a two-column grid - a
                      third child, however invisible, still takes a cell and shunts the text
                      into the 16px one.
                    */}
                    <span className="rc-sr-only">{VERDICT_WORD[result.verdict]}: </span>
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
                    {result.verdict === 'empty' ? (
                      <div className="rc-probe__detail">
                        Not enough to go on: it responded, but an empty list shows no field
                        names and no types. Either there is genuinely nothing there, or the
                        parameters are wrong — the map stays unchanged until one of those is
                        established.
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
        </Section>
      ) : null}
    </>
  );
}

/**
 * Can a server's real uptime ever be known? (asked 28 Aug 2026)
 *
 * The servers API has no start time, no uptime and no version field, so every age this
 * extension shows is measured from its own first sighting - a floor, not the truth. There
 * was one avenue nobody had checked: a job id is a UUID, and a version-1 UUID carries a
 * 60-bit timestamp. If Roblox mints them that way, every server in the list arrives with
 * its start time already attached, for free.
 *
 * This reads the ids rather than assuming, the same way the probe reads a response rather
 * than trusting the docs, and nothing is built on the answer until there is one. It costs
 * no request at all: the ids are already in state from the last scan.
 */
function ServerClock({
  state,
  busy,
  send,
}: {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}): React.JSX.Element {
  const report = state.jobIdClock;

  return (
    <Section title="Server clock">
      {/*
        Asked and answered on 28 Aug 2026: 198 ids, every one version 4. The card stays
        because the answer is a fact about how Roblox mints ids today, not a law - but it
        now leads with what was found, so nobody re-derives it to reach the same place.
      */}
      <p className="rc-header__sub" style={{ marginTop: 0 }}>
        Whether Roblox&apos;s job ids carry the moment a server started. A version-1 UUID
        has a timestamp built into it; a version-4 one is random and carries nothing.
        <strong> Checked on 28 Aug 2026 across 198 ids: all version 4</strong> — so a
        server&apos;s real start time cannot be recovered, and every age this extension
        shows is a floor measured from its own first sighting. Re-run it if you suspect
        Roblox has changed how it mints them. It reads ids already held here — the servers
        scanned this session, then your join history — and makes no request.
      </p>

      <button
        type="button"
        className="rc-btn rc-btn--primary"
        disabled={busy}
        onClick={() => send({ type: "dev/inspectJobIds" })}
      >
        Check job ids
      </button>

      {report ? (
        <>
          <div className="rc-probe__detail" role="status" style={{ marginTop: 8 }}>
            {report.detail}
          </div>
          {report.oldestStartedAt !== null ? (
            <p className="rc-footnote">
              Oldest decoded start time: {formatDate(report.oldestStartedAt)}{" "}
              {formatTime(report.oldestStartedAt)}. Compare it with what that server looks
              like on Roblox before anything is built on it — a number that decodes is not
              yet a number that means what we want it to mean.
            </p>
          ) : null}
        </>
      ) : (
        <div className="rc-header__sub" style={{ marginTop: 8 }}>
          Not checked yet. Load a server list on a game page first, or press this after any
          join — the ids come from either.
        </div>
      )}
    </Section>
  );
}
