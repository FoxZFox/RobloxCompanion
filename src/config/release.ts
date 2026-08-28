/**
 * Whether this is the build meant for people who just want to use the thing.
 *
 * Set by `npm run build:release` (see build.mjs), which writes to dist-release/. Both
 * builds run identical code against Roblox: what changes is what Settings shows.
 *
 * Three things come off in a release build:
 *
 *   1. **Developer Mode**, and with it the API probe and the job-id check. They exist to
 *      answer questions about Roblox's API before anything is built on it, which is not a
 *      question anybody using the extension has.
 *   2. **Features that are not finished.** A disabled toggle labelled "arrives in phase 8"
 *      is a note to ourselves; someone installing this should see the switches that do
 *      something and nothing else.
 *   3. **The long explanations**, replaced by short ones through `explain()`.
 *
 * What does NOT come off is the honesty. "Time since you joined, not time played",
 * "at least this old", "Roblox does not disclose who is in a server" - those are not
 * developer notes, they are the difference between a number and a claim, and a release
 * build that dropped them would be the dishonest one.
 */
declare const __RELEASE__: boolean;

export const IS_RELEASE: boolean = typeof __RELEASE__ === 'boolean' ? __RELEASE__ : false;

/**
 * Picks the wording for the build being made.
 *
 * Both versions sit side by side at the call site on purpose. The alternative - a separate
 * strings file - puts the short and long forms of the same sentence in different files,
 * where they drift apart and nobody notices which one is stale.
 *
 * `short` still has to be true. It is the same fact said in fewer words, never a softer
 * version of it.
 */
export function explain(short: string, long: string): string {
  return IS_RELEASE ? short : long;
}
