import { useEffect, useMemo, useRef, useState } from 'react';
import { rankCommands, type CommandContext } from '../../features/commandPalette/commands';
import { highlight } from '../../features/commandPalette/fuzzy';

interface Props {
  ctx: Omit<CommandContext, 'closePalette'>;
  onClose: () => void;
}

const LIST_ID = 'rc-palette-list';

/** Stable per command, so `aria-activedescendant` can point at a row that exists. */
const rowId = (commandId: string): string => `rc-cmd-${commandId}`;

/**
 * Ctrl+K palette (spec sections 40 and 41).
 *
 * Lives inside the panel's shadow root so Roblox cannot restyle it and its own key
 * handling stays isolated from the page.
 */
export function CommandPalette({ ctx, onClose }: Props): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const context: CommandContext = { ...ctx, closePalette: onClose };
  const results = useMemo(() => rankCommands(query, context).slice(0, 40), [query, context]);

  // Any change to the query invalidates the previous highlight position.
  useEffect(() => setSelected(0), [query]);

  /*
   * Take focus on open and hand it back on close.
   *
   * Returning it matters more here than in an ordinary dialog: the palette is opened by a
   * keystroke from anywhere on the page, so whoever pressed Ctrl+K was in the middle of
   * something. `getRootNode()` rather than `document` because focus inside a shadow root
   * reads as the host element from outside it.
   */
  useEffect(() => {
    const root = inputRef.current?.getRootNode() as DocumentOrShadowRoot | undefined;
    const previous = root?.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  // Keep the highlighted row visible while arrowing through a long list.
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const run = (index: number): void => {
    const hit = results[index];
    if (!hit) return;
    // Closing first so a command that opens a tool is not immediately covered by us.
    onClose();
    hit.command.run(context);
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((current) => Math.min(current + 1, Math.max(0, results.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(selected);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      /*
       * The dialog holds exactly one focusable element, so there is nowhere for Tab to go
       * that is not the Roblox page behind it - which would leave an open palette that no
       * longer answers the keyboard. Swallowing Tab is the whole focus trap.
       */
      event.preventDefault();
    }
  };

  return (
    <div className="rc-palette-backdrop" onPointerDown={onClose} role="presentation">
      <div
        className="rc-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {/*
          The combobox pattern, which is what lets one input drive a list nobody ever
          focuses: keyboard focus stays here throughout, and `aria-activedescendant` is
          how a screen reader is told which row the arrow keys are on.
        */}
        <input
          ref={inputRef}
          className="rc-palette__input"
          value={query}
          placeholder="Type a command…"
          aria-label="Search commands"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={LIST_ID}
          aria-autocomplete="list"
          {...(results[selected] ? { 'aria-activedescendant': rowId(results[selected].command.id) } : {})}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />

        <div className="rc-palette__list" id={LIST_ID} role="listbox" aria-label="Commands" ref={listRef}>
          {results.length === 0 ? (
            <div className="rc-palette__empty">
              Nothing matches “{query}”.
              {/*
                Commands hide themselves when they cannot run - no experience open, the
                feature switched off - so an empty list is often a fact about the page
                rather than about the query.
              */}
              <div className="rc-empty__hint">
                Some commands only appear on an experience or profile page.
              </div>
            </div>
          ) : (
            results.map((hit, index) => (
              /*
               * A row is an option, not a button: giving each one focus would take it off
               * the input, and the input is what the arrow keys and typing belong to.
               */
              <div
                key={hit.command.id}
                id={rowId(hit.command.id)}
                role="option"
                aria-selected={index === selected}
                data-index={index}
                className={`rc-palette__row${index === selected ? ' rc-palette__row--on' : ''}`}
                onPointerEnter={() => setSelected(index)}
                onClick={() => run(index)}
              >
                <span className="rc-palette__icon" aria-hidden="true">
                  {hit.command.icon}
                </span>
                <span className="rc-palette__label">
                  {highlight(hit.command.label, hit.positions).map((part, partIndex) => (
                    <span key={partIndex} className={part.match ? 'rc-palette__hit' : undefined}>
                      {part.text}
                    </span>
                  ))}
                  {hit.command.hint ? (
                    <span className="rc-palette__hint">{hit.command.hint}</span>
                  ) : null}
                </span>
                <span className="rc-palette__section">{hit.command.section}</span>
              </div>
            ))
          )}
        </div>

        <div className="rc-palette__footer">
          <span>↑↓ move</span>
          <span>↵ run</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
