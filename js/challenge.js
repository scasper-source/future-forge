/* Future Forge — js/challenge.js
 *
 * The Future Forge Challenge card.
 *
 * Default path: deterministic, local, instant. Picks one of the domain's
 * challenges (by a per-session seed, so replays vary but a card never changes
 * under the visitor's feet) or frames the visitor's own idea, then adds a next
 * question chosen by what actually happened in the session.
 *
 * Optional path (FF_CONFIG.challengeEndpoint.enabled): POST {domain, idea, lesson}
 * to a Clarkson-controlled service; on any failure or timeout, the local card
 * is used. Nothing else is ever sent.
 */
window.FF = window.FF || {};

(function () {
  "use strict";

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /** Strip anything that looks like contact details; the visitor was told not to enter them. */
  function sanitizeIdea(text) {
    if (!text) return "";
    let t = String(text).replace(/\s+/g, " ").trim().slice(0, 140);
    t = t.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "")           // emails
         .replace(/https?:\/\/\S+|www\.\S+/gi, "")            // links
         .replace(/\+?\d[\d\s().-]{7,}\d/g, "")               // phone-like numbers
         .replace(/\s+/g, " ").trim();
    t = t.replace(/[.!?…]+$/g, "");
    return t;
  }

  function localCard(domain, idea, lessonCode, seed) {
    const C = window.FF_CONTENT.challengeCards;
    idea = sanitizeIdea(idea);
    let question, build, responsibility;
    if (idea.length >= 3) {
      question = C.ideaFrame.question.replace("{idea}", idea);
      build = C.ideaFrame.build;
      responsibility = C.ideaFrame.responsibility;
    } else {
      const list = (domain && domain.challenges) || [];
      const pick = list.length ? list[hash((domain.id || "") + "|" + String(seed || 0)) % list.length] : null;
      question = pick ? pick.question : "Could an AI system help with a problem you care about — while knowing when it isn't confident enough to decide alone?";
      build = pick ? pick.build : C.ideaFrame.build;
      responsibility = pick ? pick.responsibility : C.ideaFrame.responsibility;
    }
    const next = C.nextQuestions.slice();
    const extra = C.byLesson[lessonCode];
    if (extra) next.push(extra);
    return { question, build, responsibility, next, source: "local" };
  }

  async function remoteCard(domain, idea, lessonCode) {
    const cfg = (window.FF_CONFIG && window.FF_CONFIG.challengeEndpoint) || {};
    if (!cfg.enabled || !cfg.url) return null;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), cfg.timeoutMs || 4000);
    try {
      const body = JSON.stringify({ domain: domain ? domain.id : "", idea: sanitizeIdea(idea), lesson: lessonCode || "" });
      const res = await fetch(cfg.url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: controller ? controller.signal : undefined, credentials: "omit" });
      if (!res.ok) return null;
      const j = await res.json();
      if (!j || typeof j.question !== "string" || !j.question.trim()) return null;
      return {
        question: String(j.question).slice(0, 300),
        build: typeof j.build === "string" ? j.build.slice(0, 300) : "",
        responsibility: typeof j.responsibility === "string" ? j.responsibility.slice(0, 300) : "",
        next: window.FF_CONTENT.challengeCards.nextQuestions.slice(),
        source: "remote"
      };
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Returns a card, always. */
  async function makeCard(domain, idea, lessonCode, seed) {
    const remote = await remoteCard(domain, idea, lessonCode);
    if (remote) return remote;
    return localCard(domain, idea, lessonCode, seed);
  }

  window.FF.challenge = { makeCard, localCard, sanitizeIdea };
})();
