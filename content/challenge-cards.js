/* Future Forge — content/challenge-cards.js
 *
 * The deterministic Future Forge Challenge generator's text. This is the
 * DEFAULT path, not a fallback: it runs with no network and no LLM.
 *
 * A card = a domain challenge (from domains.js) or, when the visitor typed an
 * idea, the idea wrapped in a fixed frame — plus a "next questions" line that
 * depends on what happened in the session (the `lesson` code).
 *
 * Lesson codes (also the only "lesson" value the optional endpoint may receive):
 *   model_failed_under_new_conditions   a failure was declared and the model was retrained
 *   model_uncertain_sparse_data         Data Lab failure in a region with weak evidence
 *   labels_inherited_from_sorter        ordered-series mode, two sorters
 *   labels_are_decisions                ordered-series mode, one sorter
 *   no_failure_found                    the visitor could not break it (or skipped BREAK)
 *   model_improved_after_example        the visitor reported "Better" after retraining
 */
window.FF_CONTENT = window.FF_CONTENT || {};

window.FF_CONTENT.challengeCards = {
  title: "YOUR FUTURE FORGE CHALLENGE",
  nextLead: "Your next questions:",
  close: "That's the work: build it, question it, make it better.",

  /* When the visitor typed an idea, it is quoted rather than rewritten, so any
   * phrasing works and nothing is put in their mouth. */
  ideaFrame: {
    question: "You said: “{idea}.” Could a machine-learning system take that on — and know when its evidence runs out?",
    build: "What examples would it need, and where would you get them?",
    responsibility: "Who is affected if it is wrong — and who checks?"
  },

  /* Standard next-question trio (spec, verbatim). */
  nextQuestions: [
    "What data would you need?",
    "Who could be harmed by a wrong answer?",
    "How would you test it under conditions different from training?"
  ],

  /* One extra question chosen by what the visitor actually did. */
  byLesson: {
    model_failed_under_new_conditions: "You already found one condition that broke a model. What would the equivalent be here?",
    model_uncertain_sparse_data: "You found a reading with no evidence behind it. Where would this system have no evidence?",
    labels_inherited_from_sorter: "The model learned one sorter's judgment. Whose judgment would this one learn — and who checks the labels?",
    labels_are_decisions: "Every label is a decision someone made. Who would make them here, and how would they disagree?",
    no_failure_found: "You couldn't break yours today. What would you try next time — and what would that mean for this system?",
    model_improved_after_example: "One good example fixed yours. How many, and which ones, would this one need?"
  }
};
