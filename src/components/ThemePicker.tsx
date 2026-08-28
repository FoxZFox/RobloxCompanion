import { contrastRatio, deriveTokens } from '../features/themes/colors';
import { THEME_PRESETS } from '../features/themes/presets';
import type { AppState, UiRequest } from '../models/messages';
import type { ThemeInput } from '../models/theme';
import { THEME_CUSTOM, THEME_OFF } from '../models/theme';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
  /** The panel passes its live match report in here; the options page has no page to measure. */
  children?: React.ReactNode;
}

/** Below this, body text on its own background is hard work to read (WCAG AA is 4.5). */
const READABLE_CONTRAST = 4.5;

/**
 * The theme picker, shared by the options page and the panel so there is one of it.
 *
 * Every palette is three colours and the rest is derived, which is why the preview here
 * is worth having: it is the real derivation, not an illustration, so what someone sees
 * in the swatch is what the page will look like.
 */
export function ThemePicker({ state, busy, send, children }: Props): React.JSX.Element {
  const theme = state.settings.theme;
  const enabled = state.settings.features.themes;

  const choose = (preset: string): void =>
    send({ type: 'settings/set', patch: { theme: { preset } } });

  const setColour = (key: keyof ThemeInput, value: string): void =>
    send({ type: 'settings/set', patch: { theme: { custom: { [key]: value } } } });

  const customTokens = deriveTokens(theme.custom);
  const customContrast = contrastRatio(customTokens.text, customTokens.bg);

  return (
    <>
      {!enabled ? (
        <div className="rc-banner">
          Themes are switched off in Settings, so nothing below is being applied.
        </div>
      ) : null}

      <div className="rc-swatches">
        <button
          type="button"
          className={`rc-swatch${theme.preset === THEME_OFF ? ' rc-swatch--on' : ''}`}
          disabled={busy}
          onClick={() => choose(THEME_OFF)}
        >
          <span className="rc-swatch__preview rc-swatch__preview--off" aria-hidden="true">
            —
          </span>
          <span className="rc-swatch__name">Off</span>
          <span className="rc-swatch__note">Roblox as it comes</span>
        </button>

        {THEME_PRESETS.map((preset) => {
          const tokens = deriveTokens(preset.input);
          return (
            <button
              key={preset.id}
              type="button"
              className={`rc-swatch${theme.preset === preset.id ? ' rc-swatch--on' : ''}`}
              title={preset.description}
              disabled={busy}
              onClick={() => choose(preset.id)}
            >
              <Preview tokens={tokens} />
              <span className="rc-swatch__name">{preset.name}</span>
              <span className="rc-swatch__note">for {preset.base}</span>
            </button>
          );
        })}

        <button
          type="button"
          className={`rc-swatch${theme.preset === THEME_CUSTOM ? ' rc-swatch--on' : ''}`}
          disabled={busy}
          onClick={() => choose(THEME_CUSTOM)}
        >
          <Preview tokens={customTokens} />
          <span className="rc-swatch__name">Custom</span>
          <span className="rc-swatch__note">your three colours</span>
        </button>
      </div>

      {theme.preset === THEME_CUSTOM ? (
        <div className="rc-card" style={{ marginTop: 10 }}>
          <div className="rc-card__label">Your colours</div>
          <p className="rc-header__sub" style={{ marginTop: 0 }}>
            Pick three; every other shade — surfaces, borders, muted text, the colour of
            text on a button — is derived from them, so the palette stays consistent.
          </p>

          <div className="rc-colours">
            <Colour
              label="Background"
              value={theme.custom.background}
              busy={busy}
              onChange={(value) => setColour('background', value)}
            />
            <Colour
              label="Text"
              value={theme.custom.text}
              busy={busy}
              onChange={(value) => setColour('text', value)}
            />
            <Colour
              label="Accent"
              value={theme.custom.accent}
              busy={busy}
              onChange={(value) => setColour('accent', value)}
            />
          </div>

          {customContrast < READABLE_CONTRAST ? (
            <p className="rc-footnote">
              Text on background is {customContrast.toFixed(1)}:1. Below {READABLE_CONTRAST}:1
              body text gets hard to read — it is your choice, this is just the measurement.
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="rc-field" style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={theme.restyleRobloxPage}
            disabled={busy}
            onChange={(e) =>
              send({
                type: 'settings/set',
                patch: { theme: { restyleRobloxPage: e.target.checked } },
              })
            }
          />
          <span className="rc-field__label" style={{ fontSize: 12 }}>
            Also recolour roblox.com itself
          </span>
        </span>
        <span className="rc-header__sub" style={{ paddingLeft: 24 }}>
          Off, the theme still applies in full to everything this extension draws. On, it
          also repaints Roblox's own header, cards, buttons and fields — which depends on
          class names Roblox renames without notice, so parts of it stop matching from time
          to time. Colour only: nothing is moved, resized or hidden.
        </span>
      </label>

      {children}
    </>
  );
}

function Preview({ tokens }: { tokens: ReturnType<typeof deriveTokens> }): React.JSX.Element {
  return (
    <span
      className="rc-swatch__preview"
      style={{ background: tokens.bg, borderColor: tokens.border }}
      aria-hidden="true"
    >
      <span className="rc-swatch__bar" style={{ background: tokens.bgRaised }} />
      <span className="rc-swatch__line" style={{ background: tokens.text }} />
      <span className="rc-swatch__line rc-swatch__line--short" style={{ background: tokens.textMuted }} />
      <span className="rc-swatch__pill" style={{ background: tokens.accent }} />
    </span>
  );
}

function Colour({
  label,
  value,
  busy,
  onChange,
}: {
  label: string;
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <label className="rc-colour">
      <span className="rc-field__label">{label}</span>
      {/*
        A colour input can only ever produce `#rrggbb`, which is the shape the injector
        insists on. Anything else that reaches storage - a hand-edited backup file, say -
        is refused there rather than trusted here.
      */}
      <input
        type="color"
        className="rc-colour__input"
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="rc-colour__hex">{value}</span>
    </label>
  );
}
