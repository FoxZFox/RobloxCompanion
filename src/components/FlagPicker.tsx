import type { CustomFlag } from '../models/flags';

interface Props {
  flags: CustomFlag[];
  applied: string[];
  busy: boolean;
  onToggle: (flagId: string, applied: boolean) => void;
}

/**
 * The user's own flags, as toggles on a server row (spec section 22).
 *
 * A flag marked "avoid" gets a visible marker so the consequence of applying it is not
 * hidden: tapping it here is what stops Smart Join and Join Lowest ever picking this
 * server again.
 */
export function FlagPicker({ flags, applied, busy, onToggle }: Props): React.JSX.Element | null {
  if (flags.length === 0) return null;
  const active = new Set(applied);

  return (
    <div className="rc-flagpicker">
      {flags.map((flag) => {
        const isOn = active.has(flag.id);
        return (
          <button
            key={flag.id}
            type="button"
            className={`rc-flagchip${isOn ? ' rc-flagchip--on' : ''}`}
            aria-pressed={isOn}
            disabled={busy}
            title={
              flag.avoid
                ? `${flag.name} — servers with this flag are skipped by Smart Join`
                : flag.name
            }
            onClick={() => onToggle(flag.id, !isOn)}
          >
            <span aria-hidden="true">{flag.icon}</span>
            <span>{flag.name}</span>
            {flag.avoid ? (
              <span className="rc-flagchip__avoid" aria-label="skipped by Smart Join">
                🚫
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
