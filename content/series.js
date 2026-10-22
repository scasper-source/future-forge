/* Future Forge — content/series.js
 *
 * Ordered card series for the Live Vision Lab's deck mode.
 *
 * A series is any set of physical cards numbered on the back that runs from
 * one unmistakable thing to another. The app never draws the cards; the camera
 * looks at the real ones. Adding a series = adding one object here. Redrawing
 * or reprinting a deck changes nothing in the code as long as the card count
 * and the two end names are still right.
 *
 * Fields:
 *   id       short code printed on the card backs (e.g. "FV")
 *   name     what the visitor sees when choosing a deck
 *   count    number of cards; they are asked for as 1..count
 *   ends     the two labels, in series order: card 1 is ends[0], card `count` is ends[1]
 *   middle   the card designed to be most ambiguous (used for copy only)
 *   note     one line shown under the deck's name
 *
 * The free "any two piles" vision mode does not use this file at all.
 */
window.FF_CONTENT = window.FF_CONTENT || {};

window.FF_CONTENT.series = [
  {
    id: "FV",
    name: "Faces–Candlestick deck",
    count: 9,
    ends: [
      { id: "faces", name: "FACES", short: "Faces" },
      { id: "candlestick", name: "CANDLESTICK", short: "Candlestick" }
    ],
    middle: 5,
    note: "Two faces in profile become a candlestick. Cards FV-1 to FV-9."
  },
  {
    id: "DR",
    name: "Duck–Rabbit deck",
    count: 9,
    ends: [
      { id: "duck", name: "DUCK", short: "Duck" },
      { id: "rabbit", name: "RABBIT", short: "Rabbit" }
    ],
    middle: 5,
    note: "A duck becomes a rabbit. Cards DR-1 to DR-9."
  }
];
