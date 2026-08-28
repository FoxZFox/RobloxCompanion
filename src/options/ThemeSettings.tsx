import { ThemePicker } from '../components/ThemePicker';
import type { AppState, UiRequest } from '../models/messages';

interface Props {
  state: AppState;
  busy: boolean;
  send: (request: UiRequest) => void;
}

/**
 * Themes (phase 8, spec section 23).
 *
 * The picker is shared with the panel; what is different here is that this page cannot
 * see roblox.com, so it cannot report what a theme matched. That report lives in the
 * panel's Theme tool, and this says so rather than leaving the difference unexplained.
 */
export function ThemeSettings({ state, busy, send }: Props): React.JSX.Element {
  return (
    <section className="rc-card" style={{ marginBottom: 12 }}>
      <div className="rc-card__label">Theme</div>

      <p className="rc-header__sub" style={{ marginTop: 0 }}>
        Colour only — no images, no fonts and no layout changes, so a theme cannot move
        anything on Roblox or break a page. Every palette here was drawn for this
        extension.
      </p>

      <ThemePicker state={state} busy={busy} send={send} />

      <p className="rc-footnote">
        Open the Theme tool in the in-page panel on roblox.com to see which parts of their
        page a theme actually matched. This page cannot measure that from here.
      </p>
    </section>
  );
}
