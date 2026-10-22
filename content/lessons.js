/* Future Forge — content/lessons.js
 *
 * Every line of teaching copy the app shows, in one place.
 * Spec copy is verbatim. Edit here, never in app.js.
 */
window.FF_CONTENT = window.FF_CONTENT || {};

window.FF_CONTENT.lessons = {

  /* The four ideas. Shown after the visitor has improved the model. */
  concepts: [
    { key: "DATA",  text: "The model learned from the examples you chose." },
    { key: "MODEL", text: "It found patterns; it did not gain human understanding." },
    { key: "TEST",  text: "A new condition exposed something your training examples missed." },
    { key: "HUMAN", text: "You noticed, questioned it and made it better." }
  ],

  /* Ordered-series variant: the TEST and HUMAN lines change meaning. */
  conceptsSeries: [
    { key: "DATA",  text: "The model learned from one person's calls — including the close ones." },
    { key: "MODEL", text: "It found patterns; it did not gain human understanding." },
    { key: "TEST",  text: "A second sorter exposed a judgment the model had quietly inherited." },
    { key: "HUMAN", text: "You saw that a label is a decision — and decided when to trust it." }
  ],

  lessonClose: "The important part wasn't the prediction. It was what you did next.",

  /* Closing sequence (spec §8). */
  closing: {
    lead: "You just did what AI builders do.",
    lines: [
      "You chose data.",
      "You trained a model.",
      "You challenged its assumptions.",
      "You improved it.",
      "You decided when not to trust it."
    ],
    loop: "AI doesn't remove people from the loop. The future needs better people in the loop.",
    belong: "YOU BELONG IN THE LOOP.",
    institution: "Build the Future with AI at Clarkson.",
    trustQuestion: "What would you need to know before you trusted a system like this for something that actually matters?",
    counterLead: "Today, visitors at this station have built",
    counterUnit: "futures",
    counterClose: "Different problems. Different majors. One future we build together."
  },

  /* The moment a visitor declares a failure. */
  failure: {
    praise: "Excellent. You just did one of the most important jobs in AI.",
    question: "What changed?"
  },

  /* "What changed?" choices and the reflection each one unlocks.
   * The visitor diagnoses; the app only reflects the choice back. */
  reasons: {
    vision: [
      { id: "turned",     label: "I turned it",              reflection: "It had never seen it turned that way. Your examples are the evidence it learns from — and none of them looked like this." },
      { id: "covered",    label: "I covered part of it",     reflection: "Part of what it learned from was missing. It matched what it could still see to the examples it had." },
      { id: "background", label: "The background changed",   reflection: "It learned the background along with the object. Patterns don't come labeled 'important' and 'accidental'." },
      { id: "lighting",   label: "The light changed",        reflection: "Light changes the pixels, and pixels are all it has." },
      { id: "between",    label: "It was something in between", reflection: "Something in between forces a choice the examples never taught it. Confidence is not the same as being right." },
      { id: "new",        label: "I showed it something new", reflection: "It has only ever seen your two piles. It still had to pick one — it has no way to say 'neither'." },
      { id: "unsure",     label: "Not sure",                 reflection: "Fair answer. Finding the failure comes first; explaining it takes more testing." }
    ],
    data: [
      { id: "far",        label: "No examples near this reading", reflection: "The nearest examples were far away. The model answered anyway — it has no way to say 'I have no evidence here'." },
      { id: "combo",      label: "The examples never paired the readings this way", reflection: "Every example paired the two readings the usual way. This reading breaks the pattern, and the model has never seen that." },
      { id: "sensors",    label: "Two readings aren't enough", reflection: "Two numbers can't capture everything a person would notice. The model only knows what it's fed." },
      { id: "label",      label: "The examples were labeled wrong", reflection: "Then the model learned the mistake faithfully. Labels are decisions, and it inherits them." },
      { id: "unsure",     label: "Not sure",                 reflection: "Fair answer. Finding the failure comes first; explaining it takes more testing." }
    ]
  },

  /* Prompts by stage. */
  teach: {
    vision: "Show it one pile and add five or more shots, moving it a little each time. Then the other pile.",
    data: "Load the starter readings, then add a few of your own. Then train."
  },
  test: {
    lead: "Looks smart. Now let's see how smart.",
    vision: "Hold something under the camera and watch the meter.",
    data: "Set a new reading and watch the meter."
  },
  breakIt: {
    vision: "Turn it. Cover part of it. Change the background. Show it something in between.",
    data: "Move the reading somewhere your examples never went.",
    stuck: {
      vision: "Try showing both piles at once. Try your hand. Try the card from the other side of the room.",
      data: "Try the top-left or bottom-right corner of the chart — the readings nobody added."
    },
    declare: "It's wrong or unsure",
    cantBreak: "I can't break it"
  },
  improve: {
    vision: "Show it the thing that fooled it. Which pile does it really belong to?",
    data: "Add the reading that fooled it. What should it be labeled?",
    retrain: "Retrain",
    testAgain: "Now test it again the same way.",
    better: "Better",
    still: "Still fooled",
    stillMore: "Some conditions need more than one example. Add another, or move on — you've already done the important part."
  },

  /* Ordered-series mode. Fixed closing question per card-decks.md. */
  series: {
    setupTitle: "Sort a deck.",
    setupIntro: "Shuffle it. Card numbers are on the back. The app will ask for cards one at a time — say what you see.",
    twoSorters: "Two sorters",
    twoSortersNote: "Two of you sort the same deck, one after the other, without conferring. Nobody is wrong.",
    oneSorter: "One sorter",
    oneSorterNote: "Sort it once. Then the model judges each card and you see where it gets unsure.",
    beginA: "Sorter A, begin",
    beginOne: "Begin",
    cardPrompt: "Put card {n} under the camera, face up. What do you see?",
    trainedOnA: "Trained on Sorter A's calls.",
    handoff: "Now Sorter B. Sorter A — no hints.",
    testIntro: "Now the model judges each card.",
    testPrompt: "Put card {n} under the camera. Then let it judge.",
    judge: "Judge it",
    revealTwo: "The machine learned from one of you. Which one?",
    revealOne: "Where did it get unsure?",
    swap: "Swap: learn from B, test on A",
    swapBack: "Swap back: learn from A, test on B",
    addDecision: "Add a decision",
    improveTitle: "Can more examples fix this?",
    improveIntro: "Pick a contested card. Show it again and give it your call. Retrain and watch that card.",
    improveResult: "More confident. Not more right. Nobody was wrong about card {n} — the model just believes whoever taught it more.",
    agreeAll: "You agreed on every card. Nobody drew the line differently — this time. The model still gets least sure where the pictures are most alike.",
    disagreeAll: "You disagreed on every card. The model agrees with Sorter A on all of them and with Sorter B on none. It learned one person's judgment completely.",
    oneClassOnly: "Sorter A called every card {name}. The model can only learn a difference it was shown — so it says {name} about everything."
  },

  /* The map — the model's interior, drawn truthfully. Captions under it by stage. */
  map: {
    empty: "Add a shot and watch it land here.",
    teach: "Your examples, as the network sees them. Similar pictures sit close together.",
    training: "Finding the direction that separates them…",
    retraining: "Learning again, with your new example…",
    trained: "This is the line it learned. Points near the line are the ones it's least sure about.",
    oneClass: "It only knows one pile, so there is no line to learn.",
    test: "The white point is what the camera sees right now.",
    breakIt: "Push the white point toward the line — or across it.",
    failure: "The ring marks the moment it went wrong.",
    improve: "Show it the thing that fooled it, then tell it which pile that really is.",
    moved: "Your example moved the line. The moment that fooled it now falls on the {name} side.",
    notMoved: "The line moved, but that moment still falls on the {name} side. Some conditions take more than one example.",
    yAxis: "differences it noticed but doesn't use",
    lineLabel: "the line it learned",
    deckEmpty: "The white point is this card, as the network sees it. Each call adds a point.",
    deckTeach: "Your calls so far. Similar cards sit close together; the deck traces a path from one end to the other.",
    deckJudge: "Trained on {name}'s calls. The white point is this card; its side of the line is the model's call. Hollow = cards it is tested on.",
    deckJudgeOne: "Trained on your calls. The white point is this card; its side of the line is the model's call. Hollow = cards it has judged."
  },

  /* How far the failing frame was from anything the model had seen (vision). */
  evidence: {
    weakVision: "The closest thing it had ever seen was unusually far from this. It answered anyway.",
    strongVision: "It had seen things like this before — and still got it wrong. Confidence is not the same as being right."
  },

  /* One line of scale, after the four ideas. */
  scale: "Bigger models do this with more dimensions and more examples. The shape of the work is the same.",

  /* The lab record on the closing screen is built from what actually happened. */
  recap: {
    lead: "Your session",
    vision: "Live Vision Lab",
    data: "Accessible Data Lab",
    series: "Sort a deck",
    examples: "{n} examples",
    readings: "{n} readings",
    broke: "broke it — {how}",
    couldntBreak: "couldn't break it this time",
    improved: "fixed it with {n} example",
    improvedPlural: "fixed it with {n} examples",
    stillFooled: "added {n} and kept testing",
    sorters: "two sorters, {d} contested",
    solo: "one sorter",
    judged: "decided when not to trust it"
  },

  /* Camera copy (spec, verbatim). */
  camera: {
    privacy: "Camera privacy: The camera is used only for this activity. Images are processed in this browser and are not saved or uploaded.",
    aim: "Point the camera at the table, not at people."
  },

  /* Optional idea prompt (spec, verbatim). */
  idea: {
    prompt: "What is one problem in {domain} that you would want AI to help solve?",
    privacy: "Don't enter your name or private information. Just describe a problem you'd like technology to help solve."
  }
};
