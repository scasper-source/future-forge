# Future Forge — accessibility notes

For Clarkson's web review and for anyone who asks "is this accessible?". Build 1.2, October 2026. Future Forge is designed toward **WCAG 2.2 Level AA**. It has not been formally audited or certified; this sheet says what was built and what was tested, and names the limits.

## What is built in

- **Keyboard:** every action is a native button, link or form control; focus moves to the new screen's heading on each transition; focus is always visible; no keyboard traps. Single-key shortcuts (A / B / 1 / 2 / Enter) are additions, never requirements.
- **No required camera, mouse, sound or timing.** The Accessible Data Lab is an equal route with the same lesson. Nothing is timed except an optional idle reset at the booth, which warns for a full minute first and can be switched off.
- **Screen readers:** semantic headings and landmarks; accessible names on all controls; a polite live region announces events and a throttled one carries the live prediction (a new announcement only when the reading changes, at most every 2.5 s); the "map" and the charts carry text narratives and a "Show as table" equivalent.
- **Colour is never the only signal:** pile A is always ● and pile B is ■, on buttons, markers and the meter; decision regions are also labelled in text.
- **Motion:** `prefers-reduced-motion` removes the glides, trail, pulse and attract cycle; every animated moment has a static twin. Nothing essential is communicated by motion alone.
- **Text and layout:** type scales with the viewport and reflows from a 360-pixel phone to a 43-inch display without horizontal scrolling; text can be zoomed to 200 %; controls are at least 44 × 44 CSS pixels (WCAG 2.2 target-size, exceeding the AA minimum); contrast meets AA for text and controls.
- **Plain language:** short instructions, one action at a time, the same words on screen and in the facilitator sheet; errors say what happened and what to do.
- **Privacy as design:** no account, no identifiers, no retained images; camera frames never leave the browser.

## What was tested

- Automated: axe-core (WCAG 2.0/2.1/2.2 A and AA rule sets) on every screen of both labs at desktop and phone widths — no violations in build 1.2.
- Scripted walk-throughs in headless Chromium: both labs end to end, keyboard only, 360-pixel width, reduced motion, no camera, camera refused, ten consecutive resets, offline after load.
- Manual so far: runs in Edge and Chrome on a Windows laptop. Not yet tried on an iPhone, with a screen reader, or by anyone who relies on assistive technology — those are the next tests to do, with people.

## Known limits

- The live camera picture is inherently visual; the meter text and the announcements describe the prediction, not the picture. The Data Lab exists for exactly this reason.
- Automated tools cannot judge whether the lesson lands for a screen-reader user; that needs a run-through with an assistive-technology user, which has not yet happened.
- The two printed card decks are visual objects; the Data Lab is the non-visual equivalent of the two-sorter activity.
- No formal WCAG conformance claim is made; Clarkson's own review process decides that.

## Contact

Problems or accommodation requests: ai.institute@clarkson.edu.
