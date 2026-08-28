import { useId } from 'react';

/**
 * The three controls every settings section is built from.
 *
 * They live here rather than inside Options.tsx because the labelling is the point, and
 * it has to be identical everywhere. A settings page made of bare `<span>` captions next
 * to unlabelled `<select>`s reads as "combo box, blank" to a screen reader - the control
 * is reachable, operable, and unidentifiable. Owning the id in one place is what makes
 * `htmlFor` and `aria-describedby` impossible to forget at a call site.
 */

export interface FieldIds {
  /** Put this on the control itself; the label already points at it. */
  id: string;
  /** Present only when there is a hint to point at. */
  describedBy?: string;
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const id = useId();
  return (
    <section className="rc-card" aria-labelledby={id} style={{ marginBottom: 12 }}>
      {/*
        A real heading, not a styled div: the settings page is long, and headings are how
        someone using a screen reader skips through it instead of hearing all of it.
      */}
      <h2 className="rc-card__label" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * One labelled control. The child is a function so the label can hand it the id it has
 * already claimed, rather than hoping the caller repeats it correctly.
 */
export function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (ids: FieldIds) => React.ReactNode;
}): React.JSX.Element {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="rc-field">
      <label className="rc-field__label" htmlFor={id}>
        {label}
      </label>
      {children({ id, ...(hint ? { describedBy: hintId } : {}) })}
      {hint ? (
        <span className="rc-header__sub" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A checkbox with its explanation beside it rather than inside its label.
 *
 * The hint used to sit inside the `<label>`, which made the accessible name of every
 * toggle the label *and* a paragraph of prose - announced in full on focus, every time.
 * `aria-describedby` says the same thing at the point it is useful and leaves the name
 * short enough to be a name.
 */
export function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}): React.JSX.Element {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="rc-field">
      <label
        htmlFor={id}
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="rc-field__label" style={{ fontSize: 12 }}>
          {label}
        </span>
      </label>
      {hint ? (
        <span className="rc-header__sub" id={hintId} style={{ paddingLeft: 24 }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
