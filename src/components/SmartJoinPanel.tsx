import type { AppState } from '../models/messages';
import type { ScoreComponent, SmartJoinPlan } from '../models/smartJoin';
import { shortJobId } from '../utils/format';

/**
 * Explain Why (spec section 28).
 *
 * Shows the breakdown behind Smart Join's choice, including the components it could not
 * judge. Rendering an inapplicable component as a dash with its reason - rather than
 * hiding it or showing 0 - is the point: the user can see exactly which signals fed the
 * decision and which were simply unavailable.
 */
export function SmartJoinPanel({ state }: { state: AppState }): React.JSX.Element | null {
  const plan = state.smartJoinPlan;
  if (!plan) return null;

  if (!plan.chosen) {
    return (
      <div className="rc-card">
        <div className="rc-card__label">Smart Join</div>
        <div className="rc-meta">
          No server qualified. Every one was full, or ruled out by your avoid rules.
        </div>
        <Coverage plan={plan} />
      </div>
    );
  }

  const chosen = plan.chosen;
  const server = state.servers.find((s) => s.jobId === chosen.jobId);

  return (
    <div className="rc-card">
      <div className="rc-card__label">Smart Join &mdash; why this server</div>

      <div className="rc-row__top">
        <span className="rc-row__count">
          {server ? `${server.playing} / ${server.maxPlayers || '?'}` : shortJobId(chosen.jobId)}
        </span>
        <span className="rc-smart__score" title="Scored only on signals that were available">
          {chosen.total}/100
        </span>
      </div>

      <ul className="rc-smart__list">
        {chosen.components.map((component) => (
          <Row key={component.key} component={component} />
        ))}
      </ul>

      <Coverage plan={plan} />
    </div>
  );
}

function Row({ component }: { component: ScoreComponent }): React.JSX.Element {
  const unavailable = !component.applicable;

  return (
    <li className={`rc-smart__item${unavailable ? ' rc-smart__item--na' : ''}`}>
      <span className="rc-smart__mark" aria-hidden="true">
        {unavailable ? '–' : '✓'}
      </span>
      <span className="rc-smart__label">{component.label}</span>
      <span className="rc-smart__points">
        {/*
          An em dash, never "0". A component we could not judge is not a component the
          server scored badly on, and the two must not look alike.
        */}
        {unavailable ? '—' : `${component.points}/${component.max}`}
      </span>
      <span className="rc-smart__reason">{component.reason}</span>
    </li>
  );
}

/**
 * Coverage disclosure. Roblox caps how deep the server list pages, so the honest claim
 * is "best of what we could see" (spec section 33).
 */
function Coverage({ plan }: { plan: SmartJoinPlan }): React.JSX.Element {
  return (
    <div className="rc-smart__coverage">
      Best of {plan.considered} eligible {plan.considered === 1 ? 'server' : 'servers'} out of{' '}
      {plan.loaded} loaded
      {plan.capped ? ' (Roblox caps how many it will show)' : ''}
      {plan.regionsProbed > 0
        ? ` · ${plan.regionsProbed} region ${plan.regionsProbed === 1 ? 'lookup' : 'lookups'}`
        : ''}
    </div>
  );
}
