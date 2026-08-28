import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME_CUSTOM, THEME_OFF, type ThemeSettings } from '../../models/theme';
import {
  contrastRatio,
  deriveTokens,
  isHexColor,
  mix,
  normaliseHex,
  readableTextOn,
  sanitiseInput,
} from './colors';
import { buildThemeCss, hostTokens, resolveTheme } from './buildThemeCss';
import { THEME_PRESETS, findPreset } from './presets';
import { conflictsWithPage } from './pageTheme';
import { ROBLOX_SURFACES } from './robloxSurfaces';

function settings(patch: Partial<ThemeSettings>): ThemeSettings {
  return { ...DEFAULT_THEME, ...patch };
}

describe('isHexColor', () => {
  it('accepts three and six digit hex', () => {
    expect(isHexColor('#abc')).toBe(true);
    expect(isHexColor('#A1B2C3')).toBe(true);
  });

  it('rejects everything a stylesheet would treat as more than a colour', () => {
    // The case that matters: settings can arrive from an imported backup file, so these
    // are attacker-supplied strings heading for a stylesheet injected into roblox.com.
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#fff}body{display:none')).toBe(false);
    expect(isHexColor('url(https://example.com/x.png)')).toBe(false);
    expect(isHexColor('#12345')).toBe(false);
    expect(isHexColor('')).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
    expect(isHexColor(42)).toBe(false);
  });
});

describe('normaliseHex', () => {
  it('expands shorthand and lower-cases', () => {
    expect(normaliseHex('#ABC')).toBe('#aabbcc');
    expect(normaliseHex('#A1B2C3')).toBe('#a1b2c3');
  });
});

describe('mix', () => {
  it('returns the endpoints untouched', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('meets in the middle', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('clamps a weight outside 0..1 rather than producing an impossible colour', () => {
    expect(mix('#000000', '#ffffff', 5)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', -5)).toBe('#000000');
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG extremes', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('readableTextOn', () => {
  it('puts dark text on a pale accent and light text on a dark one', () => {
    // Why this exists: a user who picks pale yellow as their accent still has to be able
    // to read the button label sitting on it.
    expect(contrastRatio('#ffe066', readableTextOn('#ffe066'))).toBeGreaterThan(4.5);
    expect(contrastRatio('#1b3a8f', readableTextOn('#1b3a8f'))).toBeGreaterThan(4.5);
  });
});

describe('deriveTokens', () => {
  it('lightens surfaces on a dark palette and darkens them on a light one', () => {
    const dark = deriveTokens({ background: '#000000', text: '#ffffff', accent: '#5b8cff' });
    const light = deriveTokens({ background: '#ffffff', text: '#000000', accent: '#1268d3' });

    expect(Number.parseInt(dark.bgSubtle.slice(1, 3), 16)).toBeGreaterThan(0);
    expect(Number.parseInt(light.bgSubtle.slice(1, 3), 16)).toBeLessThan(255);
  });

  it('keeps muted text readable against its own background', () => {
    const tokens = deriveTokens({ background: '#0f1420', text: '#e6ecf5', accent: '#5b8cff' });
    expect(contrastRatio(tokens.textMuted, tokens.bg)).toBeGreaterThan(4.5);
  });
});

describe('sanitiseInput', () => {
  it('keeps valid colours and reports the ones it refused', () => {
    const { input, rejected } = sanitiseInput(
      { background: '#111111', text: '#fff}body{opacity:0', accent: '#abc' },
      DEFAULT_THEME.custom,
    );

    expect(input.background).toBe('#111111');
    expect(input.accent).toBe('#aabbcc');
    expect(input.text).toBe(DEFAULT_THEME.custom.text);
    expect(rejected).toEqual(['text']);
  });

  it('falls back for every key when the stored object is missing entirely', () => {
    expect(sanitiseInput(undefined, DEFAULT_THEME.custom).input).toEqual(DEFAULT_THEME.custom);
  });
});

describe('presets', () => {
  it('has unique ids and resolves each one', () => {
    const ids = THEME_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(findPreset(id)?.id).toBe(id);
  });

  it('ships only hex colours', () => {
    for (const preset of THEME_PRESETS) {
      expect(isHexColor(preset.input.background)).toBe(true);
      expect(isHexColor(preset.input.text)).toBe(true);
      expect(isHexColor(preset.input.accent)).toBe(true);
    }
  });

  it('keeps body text readable in every preset', () => {
    for (const preset of THEME_PRESETS) {
      const tokens = deriveTokens(preset.input);
      expect(contrastRatio(tokens.text, tokens.bg)).toBeGreaterThan(7);
    }
  });
});

describe('resolveTheme', () => {
  it('injects nothing when the feature is off', () => {
    expect(resolveTheme(settings({ preset: 'midnight' }), false)).toBeNull();
  });

  it('injects nothing when the preset is off', () => {
    expect(resolveTheme(settings({ preset: THEME_OFF }), true)).toBeNull();
  });

  it('leaves the page alone for a preset id it does not recognise', () => {
    // An id from a newer build, arriving in an imported backup. Falling back to some
    // other palette would repaint the page with something nobody chose.
    expect(resolveTheme(settings({ preset: 'from-a-later-version' }), true)).toBeNull();
  });

  it('resolves a known preset', () => {
    const theme = resolveTheme(settings({ preset: 'midnight' }), true);
    expect(theme?.name).toBe('Midnight');
    expect(theme?.base).toBe('dark');
  });

  it('classifies a custom palette by its own background, not by a stored label', () => {
    const light = resolveTheme(
      settings({
        preset: THEME_CUSTOM,
        custom: { background: '#fbfbfb', text: '#101010', accent: '#1268d3' },
      }),
      true,
    );
    expect(light?.base).toBe('light');
  });
});

describe('buildThemeCss', () => {
  const theme = resolveTheme(settings({ preset: 'midnight' }), true)!;

  it('declares every token the stylesheets read', () => {
    const css = buildThemeCss(theme);
    for (const property of Object.keys(hostTokens(theme.tokens))) {
      expect(css).toContain(`${property}: `);
    }
  });

  it('outranks the palette in theme.css instead of relying on stylesheet order', () => {
    expect(buildThemeCss(theme)).toContain(':root.dark-theme');
  });

  it('restyles Roblox only when asked', () => {
    const withPage = buildThemeCss(theme);
    const ourUiOnly = buildThemeCss({ ...theme, restyleRobloxPage: false });

    expect(withPage).toContain('.btn-primary-md');
    expect(ourUiOnly).not.toContain('.btn-primary-md');
    // Our own surfaces stay themed either way - that is the point of the switch.
    expect(ourUiOnly).toContain('--rc-accent:');
  });

  it('cannot emit a rule that escapes its block', () => {
    // Colours are the only thing interpolated into this CSS, and they are hex-checked
    // first; this asserts the result of that, so a future edit that starts writing some
    // other string into the stylesheet fails here.
    const css = buildThemeCss(
      resolveTheme(
        settings({
          preset: THEME_CUSTOM,
          custom: { background: '#000}html{display:none', text: '#ffffff', accent: '#5b8cff' },
        }),
        true,
      )!,
    );

    expect(css).not.toContain('display:none');
    expect(css.split('{').length).toBe(css.split('}').length);
  });

  it('writes literal colours into Roblox rules rather than variables', () => {
    // A page painted with undefined custom properties would be far worse than a page
    // left alone, so nothing that touches Roblox's own markup may depend on our tokens
    // having applied.
    const robloxRules = buildThemeCss(theme).split('/* Page background */')[1] ?? '';
    expect(robloxRules).not.toContain('var(--rc-');
    expect(robloxRules).toContain(theme.tokens.bg);
  });
});

describe('ROBLOX_SURFACES', () => {
  it('pairs a foreground with every background, so nothing can vanish into itself', () => {
    const tokens = deriveTokens(THEME_PRESETS[0]!.input);
    for (const surface of ROBLOX_SURFACES) {
      const declarations = surface.declarations(tokens);
      if (declarations.some((d) => d.startsWith('background-color'))) {
        expect(declarations.some((d) => d.startsWith('color'))).toBe(true);
      }
    }
  });

  it('changes colour only - a theme must never move the page or hide anything', () => {
    const tokens = deriveTokens(THEME_PRESETS[0]!.input);
    const allowed = ['background-color', 'color', 'border-color'];
    for (const surface of ROBLOX_SURFACES) {
      for (const declaration of surface.declarations(tokens)) {
        const property = declaration.split(':')[0]!.trim();
        expect(allowed).toContain(property);
      }
    }
  });

  it('has unique ids so the match report cannot double-count', () => {
    const ids = ROBLOX_SURFACES.map((surface) => surface.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('conflictsWithPage', () => {
  it('holds a dark palette back from Roblox’s light theme, and the reverse', () => {
    // The failure this prevents is not cosmetic. Our CSS can only set three colour
    // properties, so it cannot hide anything - but a dark background under Roblox's own
    // dark text is content that is still there and cannot be read, which is
    // indistinguishable from a page that failed to load.
    expect(conflictsWithPage('dark', 'light')).toBe(true);
    expect(conflictsWithPage('light', 'dark')).toBe(true);
  });

  it('allows a palette that matches', () => {
    expect(conflictsWithPage('dark', 'dark')).toBe(false);
    expect(conflictsWithPage('light', 'light')).toBe(false);
  });

  it('does not treat an unknown page theme as a conflict', () => {
    // Roblox stamps no class at all on some pages. Refusing to theme on a guess would be
    // as wrong as painting on one.
    expect(conflictsWithPage('dark', null)).toBe(false);
  });

  it('offers a palette for whichever theme Roblox is on', () => {
    // The advice the panel gives when there is a conflict is "pick one marked for light"
    // - which has to be advice someone can actually follow.
    for (const base of ['dark', 'light'] as const) {
      expect(THEME_PRESETS.some((preset) => preset.base === base)).toBe(true);
    }
  });
});
