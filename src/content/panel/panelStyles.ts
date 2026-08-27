/**
 * Styles for the in-page panel, as a string rather than a stylesheet.
 *
 * The panel renders inside a Shadow DOM root, which is the only reliable way to survive
 * roblox.com: its global CSS is broad enough to restyle anything we inject, and anything
 * we inject would otherwise be able to break their page. A shadow root cuts both ways at
 * once.
 *
 * That is also why this is a string. A stylesheet emitted as a separate file lands in the
 * main document, where the shadow root cannot see it, so the CSS has to travel with the
 * script and be adopted into the root directly.
 *
 * The tokens are redeclared here rather than inherited. Custom properties do cross a
 * shadow boundary, but relying on that would leave the panel unstyled on any page where
 * our content stylesheet failed to load - and a half-styled floating window over someone
 * else's site is worse than none.
 */
export const PANEL_STYLES = `
:host {
  --rc-bg: #ffffff;
  --rc-bg-subtle: #f2f4f5;
  --rc-bg-raised: #ffffff;
  --rc-border: #d7dbdf;
  --rc-border-strong: #b9bfc4;
  --rc-text: #1c1e21;
  --rc-text-muted: #6b7278;
  --rc-text-faint: #969ba0;
  --rc-accent: #0d6efd;
  --rc-accent-text: #ffffff;
  --rc-clean: #00a55f;
  --rc-exploiter: #d93025;
  --rc-bugged: #e8830c;
  --rc-avoid: #8b5cf6;
  --rc-unknown: #969ba0;
  --rc-favorite: #f5a623;
  --rc-radius: 10px;
  --rc-radius-sm: 6px;
  --rc-gap: 8px;
  --rc-font: system-ui, -apple-system, "Segoe UI", "Builder Sans", Arial, sans-serif;
  --rc-shadow: 0 8px 32px rgb(0 0 0 / 18%), 0 2px 8px rgb(0 0 0 / 10%);

  /*
   * Positioning lives on the host element inline (see mountPanel), because an inline
   * declaration outranks these rules. What is left here is only what the shadow content
   * needs.
   *
   * The host ignores pointer events so its zero-size box never swallows clicks meant for
   * Roblox; the panel and launcher below turn them back on for themselves.
   */
  pointer-events: none;
}

.rc-launcher,
.rc-panel {
  pointer-events: auto;
}

:host(.rc-dark) {
  --rc-bg: #1d1f22;
  --rc-bg-subtle: #272a2e;
  --rc-bg-raised: #2e3236;
  --rc-border: #3b4045;
  --rc-border-strong: #4d545a;
  --rc-text: #ffffff;
  --rc-text-muted: #b4b8bc;
  --rc-text-faint: #858b91;
  --rc-accent: #3b82f6;
  --rc-clean: #2ecc71;
  --rc-exploiter: #ff5a4e;
  --rc-bugged: #ffa726;
  --rc-avoid: #a78bfa;
  --rc-unknown: #858b91;
  --rc-favorite: #ffc44d;
  --rc-shadow: 0 8px 32px rgb(0 0 0 / 55%), 0 2px 8px rgb(0 0 0 / 35%);
}

* { box-sizing: border-box; }

button, input, select, textarea {
  font-family: inherit;
  font-size: inherit;
}

/* ------------------------------------------------------------------ launcher */

.rc-launcher {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: flex;
  gap: 7px;
  align-items: center;
  height: 40px;
  padding: 0 14px 0 12px;
  border: 1px solid var(--rc-border-strong);
  border-radius: 999px;
  background: var(--rc-bg-raised);
  box-shadow: var(--rc-shadow);
  color: var(--rc-text);
  font-family: var(--rc-font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.rc-launcher:hover { border-color: var(--rc-accent); }
.rc-launcher:focus-visible { outline: 2px solid var(--rc-accent); outline-offset: 2px; }

.rc-launcher__mark {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--rc-accent);
}

/* A count of things needing attention, so the closed panel still communicates. */
.rc-launcher__badge {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--rc-exploiter);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

/* --------------------------------------------------------------------- panel */

.rc-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  width: 420px;
  max-width: calc(100vw - 24px);
  height: 560px;
  max-height: calc(100vh - 24px);
  overflow: hidden;
  border: 1px solid var(--rc-border-strong);
  border-radius: var(--rc-radius);
  background: var(--rc-bg);
  box-shadow: var(--rc-shadow);
  color: var(--rc-text);
  font-family: var(--rc-font);
  font-size: 13px;
  line-height: 1.45;
}

.rc-panel--minimised { height: auto; }

.rc-titlebar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex: 0 0 auto;
  padding: 9px 10px;
  border-bottom: 1px solid var(--rc-border);
  background: var(--rc-bg-subtle);
  /* The whole bar drags, so it must not look like selectable text. */
  cursor: grab;
  user-select: none;
}

.rc-titlebar--dragging { cursor: grabbing; }

.rc-titlebar__grip {
  color: var(--rc-text-faint);
  font-size: 13px;
  letter-spacing: -2px;
}

.rc-titlebar__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rc-titlebar__sub {
  display: block;
  color: var(--rc-text-muted);
  font-size: 10px;
  font-weight: 400;
}

.rc-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: var(--rc-radius-sm);
  background: none;
  color: var(--rc-text-muted);
  font-size: 13px;
  cursor: pointer;
}

.rc-iconbtn:hover { background: var(--rc-bg); color: var(--rc-text); }
.rc-iconbtn:focus-visible { outline: 2px solid var(--rc-accent); outline-offset: 1px; }

.rc-body { display: flex; flex: 1; min-height: 0; }

/* ---------------------------------------------------------------- tool rail */

/*
 * The rail is the part built for growth: a new feature adds one entry and needs no
 * layout decisions, which is what keeps this from turning into nested menus later.
 */
.rc-rail {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 2px;
  width: 52px;
  padding: 6px 4px;
  overflow-y: auto;
  border-right: 1px solid var(--rc-border);
  background: var(--rc-bg-subtle);
}

.rc-rail__btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  justify-content: center;
  padding: 7px 2px;
  border: 1px solid transparent;
  border-radius: var(--rc-radius-sm);
  background: none;
  color: var(--rc-text-muted);
  cursor: pointer;
}

.rc-rail__btn:hover { background: var(--rc-bg); color: var(--rc-text); }
.rc-rail__btn:focus-visible { outline: 2px solid var(--rc-accent); outline-offset: -1px; }

.rc-rail__btn--on {
  background: var(--rc-bg-raised);
  border-color: var(--rc-border);
  color: var(--rc-text);
}

.rc-rail__icon { font-size: 15px; line-height: 1; }
.rc-rail__label { font-size: 8px; font-weight: 700; letter-spacing: 0.02em; }

.rc-rail__dot {
  position: absolute;
  width: 6px;
  height: 6px;
  margin: -14px 0 0 18px;
  border-radius: 50%;
  background: var(--rc-exploiter);
}

.rc-content { flex: 1; min-width: 0; overflow-y: auto; padding: 10px; }

/* ------------------------------------------------------------------ resize */

.rc-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}

.rc-resize::after {
  position: absolute;
  right: 3px;
  bottom: 2px;
  color: var(--rc-text-faint);
  content: "◢";
  font-size: 9px;
}

/* -------------------------------------------------------------- palette */

.rc-palette-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
  background: rgb(0 0 0 / 45%);
  pointer-events: auto;
}

.rc-palette {
  display: flex;
  flex-direction: column;
  width: min(560px, calc(100vw - 32px));
  max-height: 60vh;
  overflow: hidden;
  border: 1px solid var(--rc-border-strong);
  border-radius: var(--rc-radius);
  background: var(--rc-bg);
  box-shadow: var(--rc-shadow);
  color: var(--rc-text);
  font-family: var(--rc-font);
}

.rc-palette__input {
  flex: 0 0 auto;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid var(--rc-border);
  background: none;
  color: var(--rc-text);
  font-size: 15px;
  outline: none;
}

.rc-palette__input::placeholder { color: var(--rc-text-faint); }

.rc-palette__list { flex: 1; min-height: 0; overflow-y: auto; padding: 6px; }

.rc-palette__row {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--rc-radius-sm);
  background: none;
  color: var(--rc-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.rc-palette__row--on { background: var(--rc-bg-subtle); }

.rc-palette__icon { flex: 0 0 auto; width: 20px; font-size: 14px; text-align: center; }
.rc-palette__label { flex: 1; min-width: 0; }

/* Matched characters, so it is obvious why a result is there. */
.rc-palette__hit { color: var(--rc-accent); font-weight: 700; }

.rc-palette__hint {
  display: block;
  color: var(--rc-text-muted);
  font-size: 11px;
}

.rc-palette__section {
  flex: 0 0 auto;
  color: var(--rc-text-faint);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.rc-palette__empty { padding: 24px 12px; color: var(--rc-text-muted); text-align: center; }

.rc-palette__footer {
  display: flex;
  gap: 14px;
  flex: 0 0 auto;
  padding: 8px 14px;
  border-top: 1px solid var(--rc-border);
  background: var(--rc-bg-subtle);
  color: var(--rc-text-faint);
  font-size: 10px;
}
`;
