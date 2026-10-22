# Future Forge — facilitator sheet (one page)

**The job:** invite, watch, ask two questions. Never lecture. The screen delivers the lesson; you deliver the questions.

**Before doors open:** run `START FUTURE FORGE (kiosk)`, point the camera straight down at the table (not at faces), press **Staff** (bottom right) to pick the downward camera if the laptop has two, do one full run yourself. Reset is top right; it clears everything in one tap.

## The station script

| When | Say |
|---|---|
| Someone slows down | **"Want to teach an AI in three minutes? The fun part is that after it works, your job is to break it."** |
| They're adding examples | **"You're making the training data right now."** |
| First predictions look good | **"Looks smart. Now let's see how smart."** |
| They find a failure | **"Excellent. You just did one of the most important jobs in AI."** Then: **"Why do you think it got that wrong?"** — and wait. Don't answer it for them. |
| After they add an example and retrain | **"What changed — the AI, or the evidence you gave it?"** |
| Before they leave | **"What would you need to know before you trusted a system like this for something that actually matters?"** |
| Closing line | **"That's the bigger Clarkson idea. We don't just want people who know how to use AI. We need people in every field who know how to build it, test it, question it and decide when to trust it."** Then let the screen say **YOU BELONG IN THE LOOP.** |

**The map** (the panel beside the camera) is the model's inside, for real: each shot is a point, the gold line is what it learned, and the white point is what the camera sees right now. Observers can follow the whole story on it from across the room. Point at it when the visitor pushes the white point over the line: "That's the failure. You did that."

**Parents:** get them in, not watching. "Can the two of you fool it differently?"

## Making it break (it should)

MobileNet is tolerant; small rotations often won't fool it. Reliable breaks: show **both piles at once**; show **the back of a card**; cover **most** of the card with a hand; show **something that isn't either pile**; hold a card at the **edge of the frame**. If they're stuck, the screen's "I can't break it" button suggests these.

**Data Lab traps** (the readings the starter set never covers): Manufacturing — hot but not shaking (110 °C, 1.5 mm/s). Energy — overloaded but cool (115 %, 45 °C). Health — racing heart, no fever (170 bpm, 36.8 °C). Robotics — full speed, huge current (18 A, 1.8 m/s). Business — small purchase far from home ($50, 480 km). Environment — river rising with no rain (5 mm, 3.3 m). "Give me a hint" on screen says the same thing.

## The two-sorter deck script (Faces–Candlestick or Duck–Rabbit)

Best with a parent and a student. Vision Lab → turn on camera → choose the deck → **Two sorters**.

1. "Shuffle it. Numbers are on the back. The screen asks for a card; put it face up under the camera and say what you see. No conferring."
2. **Sorter A** goes through all nine. The model trains on A's calls (a second). "Now **Sorter B**. Sorter A — no hints."
3. Sorter B goes through all nine. The reveal comes up: model confidence across the deck, with the band where the two of them disagreed.
4. Ask: **"The machine learned from one of you. Which one?"** Let them read the picture. Then press **Swap** — it learns from B instead, and the dip moves.
5. If there's time, **Add a decision**: they re-label the contested card, retrain, and watch it get *more confident* about the same card. Ask: "Is it more right now, or just more sure?"
6. What this teaches that the piles can't: every label in a training set is a judgment call somebody made, and the model inherits it. Nobody was wrong about card 5.

**Solo visitor:** choose **One sorter**. They sort once, then the model judges each card; the picture shows where their own line was and where the model got unsure.

## If something goes wrong

- Camera won't start → press **Use the Data Lab instead** on that screen. Same lesson, no camera.
- Screen looks stuck → **Reset** (top right). Under five seconds.
- Kiosk needs closing → Alt+F4 (Windows) / Cmd+Q (Mac). Relaunch with the START file.
- Nothing is stored, so there is nothing to lose. The only number kept is today's tally of completed sessions on this machine (Staff panel can clear it).
