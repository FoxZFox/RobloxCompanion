import { OPTIONAL_ORIGINS } from '../services/roblox/endpoints';
import { OptionalAccess } from './OptionalAccess';
import { Section } from './controls';

const FRIENDS = [OPTIONAL_ORIGINS.friends];

/**
 * Profile tools (phase 8).
 *
 * The only setting here is the permission, and that is the point: comparing friends is
 * off until someone deliberately grants access to a host that reads other people's
 * friend lists, and it can be taken back from the same place.
 */
export function ProfileSettings(): React.JSX.Element {
  return (
    <Section title="Profiles">

      <p className="rc-header__sub" style={{ marginTop: 0 }}>
        Opens on someone&apos;s profile and answers one question: how many friends you have
        in common. It runs when you ask, on the profile you are already looking at, and
        nothing about that person is stored.
      </p>

      <OptionalAccess origins={FRIENDS} label="Access to friends.roblox.com">
        Reading a friends list means reading somebody else&apos;s data, so this host is not
        requested at install. Roblox only discloses a list its owner has chosen to make
        visible — when it does not, the panel says so rather than reporting nothing in
        common.
      </OptionalAccess>
    </Section>
  );
}
