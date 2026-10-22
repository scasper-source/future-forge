/* Future Forge — config.js
 *
 * The only file an operator should ever need to change.
 * Everything here is optional; the defaults run the whole experience with
 * no network, no server and no external AI.
 */
window.FF_CONFIG = {

  /* Optional Clarkson-controlled challenge-card service.
   * OFF by default. When on, the app POSTs exactly {domain, idea, lesson} as
   * JSON and expects {question, build, responsibility} back within `timeoutMs`.
   * Anything else — error, timeout, odd shape — silently uses the built-in
   * deterministic card generator. Nothing else is ever sent. */
  challengeEndpoint: {
    enabled: false,
    url: "",
    timeoutMs: 4000
  },

  /* Anonymous "futures built today" tally, kept in this browser only.
   * It stores one day stamp and coarse counts — no identifiers, no per-visit
   * records. Reset clears the visitor's session; it does not clear the tally.
   * Set to false to disable it entirely. */
  counter: true,

  /* Minimum examples per class before "Train" turns on. Five is what the
   * screen asks for; three is enough to let a hurried visitor proceed. */
  minExamplesPerClass: 3,

  /* Frames captured per "Add example" press (a small burst, ~100 ms apart). */
  burstFrames: 3,

  /* Abandoned-session guard for the booth: after this many minutes with no
   * touch, click or key, a "still building?" notice appears; one minute later
   * the session resets (camera off, everything cleared). 0 turns it off. */
  idleResetMinutes: 5,

  /* Show single-key shortcuts on screen (A / B / 1 / 2 / Enter). */
  showKeyboardHints: true,

  /* When hosted on a web address, keep a copy of the whole app in the
   * browser so it still runs with no network. Leave on for the booth and the
   * phone address. Set to false on a preview host while the build is still
   * changing, so every reload shows the latest version. (Ignored when opened
   * as a local file; the cache isn't needed there.) */
  offlineCache: true,

  /* Build identifier shown in the staff panel. */
  version: "1.2.0"
};
