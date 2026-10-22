/* Future Forge — content/domains.js
 *
 * The six "futures" a visitor can choose, plus everything a domain changes:
 *   - the Accessible Data Lab scenario (two sensors, two labels, starter readings)
 *   - the deterministic Future Forge Challenge cards
 *
 * Plain JavaScript (not .json) so the app also runs from a double-clicked
 * index.html, where browsers refuse to fetch() JSON files. Edit the data;
 * the app reads it on load. Nothing in app.js knows the domain names.
 *
 * Data Lab scenario fields:
 *   title      what the visitor is monitoring
 *   x, y       the two sensors: label, unit, min, max, step
 *   classes    two labels in display order (first = "ordinary", second = "act")
 *   starter    readings loaded by "Load starter readings": [x, y, classIndex]
 *   hint       a nudge for BREAK IT, shown only if the visitor asks for one
 *
 * Starter readings are deliberately incomplete: each set pairs the two sensors
 * the usual way, so an unusual combination (see `hint`) has no nearby evidence.
 */
window.FF_CONTENT = window.FF_CONTENT || {};

window.FF_CONTENT.domains = [
  {
    id: "health",
    name: "Human Health",
    short: "Monitoring, diagnosis, care.",
    keyword: "health",
    sensor: {
      title: "A patient monitor",
      intro: "Two readings from a patient. Two labels: STABLE or CHECK ON.",
      x: { label: "Heart rate", unit: "bpm", min: 40, max: 180, step: 1 },
      y: { label: "Temperature", unit: "°C", min: 35, max: 41, step: 0.1 },
      classes: [
        { id: "stable", name: "STABLE", meaning: "no action needed" },
        { id: "check", name: "CHECK ON", meaning: "a person should look" }
      ],
      starter: [
        [62, 36.6, 0], [70, 36.8, 0], [75, 37.0, 0], [80, 37.1, 0], [68, 36.5, 0], [90, 37.3, 0], [110, 37.2, 0], [125, 37.4, 0],
        [120, 38.6, 1], [130, 39.2, 1], [140, 39.8, 1], [125, 38.9, 1], [150, 40.2, 1], [135, 39.5, 1], [115, 38.4, 1], [145, 40.0, 1]
      ],
      hint: "Try a racing heart with no fever at all."
    },
    challenges: [
      {
        question: "Could an AI system notice a patient getting worse hours before a person would — from readings a nurse already collects?",
        build: "What readings would it need, and how many patients' worth of examples before you trusted it?",
        responsibility: "Who is affected if it stays quiet when it should speak up — or cries wolf all night?"
      },
      {
        question: "Could an AI system help a rural clinic read an X-ray when the nearest specialist is three hours away?",
        build: "What would you need to know about the images it learned from before using it on your patients?",
        responsibility: "Who decides when its answer is good enough — and who is responsible when it is wrong?"
      },
      {
        question: "Could an AI system tell a real fall from a sat-down-hard from a wearable's motion data — and know when it isn't sure?",
        build: "Which people and which movements would have to be in the training data for it to work for everyone?",
        responsibility: "What happens to the person wearing it if it is wrong in either direction?"
      }
    ]
  },
  {
    id: "energy",
    name: "Energy & Power",
    short: "Grids, turbines, storage.",
    keyword: "energy",
    sensor: {
      title: "A substation transformer",
      intro: "Two readings from a transformer. Two labels: NORMAL or INSPECT.",
      x: { label: "Load", unit: "%", min: 0, max: 120, step: 1 },
      y: { label: "Oil temperature", unit: "°C", min: 20, max: 120, step: 1 },
      classes: [
        { id: "normal", name: "NORMAL", meaning: "running as expected" },
        { id: "inspect", name: "INSPECT", meaning: "send someone to look" }
      ],
      starter: [
        [20, 38, 0], [30, 42, 0], [40, 48, 0], [50, 55, 0], [60, 62, 0], [70, 70, 0], [80, 78, 0], [45, 50, 0],
        [90, 100, 1], [95, 106, 1], [100, 110, 1], [105, 112, 1], [110, 115, 1], [92, 98, 1], [98, 104, 1], [115, 117, 1]
      ],
      hint: "Try an overloaded transformer that is still cool."
    },
    challenges: [
      {
        question: "Could an AI system predict tomorrow's demand on a small-town grid well enough to charge batteries at the right hour?",
        build: "What would it need besides yesterday's numbers — weather, holidays, a big game?",
        responsibility: "Who pays when it is wrong on the coldest night of the year?"
      },
      {
        question: "Could an AI system hear a wind turbine bearing beginning to fail — months before it breaks — from vibration alone?",
        build: "How would you collect examples of failures without waiting for turbines to break?",
        responsibility: "Who is affected if it misses one — and if it sends crews up a tower for nothing?"
      },
      {
        question: "Could an AI system spot a failing solar panel from the power it produces — and tell that apart from a cloudy day?",
        build: "What extra reading would let it tell 'broken' from 'shaded'?",
        responsibility: "Who checks its work before a panel is replaced, and who pays if it was fine?"
      }
    ]
  },
  {
    id: "environment",
    name: "Environment",
    short: "Water, weather, wildfire, wildlife.",
    keyword: "the environment",
    sensor: {
      title: "A stream gauge for flood warning",
      intro: "Two readings from a river. Two labels: SAFE or WARN.",
      x: { label: "Rainfall, last 24 h", unit: "mm", min: 0, max: 120, step: 1 },
      y: { label: "Stream level", unit: "m", min: 0, max: 4, step: 0.1 },
      classes: [
        { id: "safe", name: "SAFE", meaning: "no warning" },
        { id: "warn", name: "WARN", meaning: "alert the town" }
      ],
      starter: [
        [0, 0.5, 0], [5, 0.6, 0], [12, 0.8, 0], [20, 1.0, 0], [28, 1.2, 0], [35, 1.4, 0], [15, 0.7, 0], [8, 0.9, 0],
        [60, 2.4, 1], [70, 2.7, 1], [80, 3.0, 1], [95, 3.4, 1], [110, 3.7, 1], [75, 2.9, 1], [88, 3.2, 1], [100, 3.5, 1]
      ],
      hint: "Try a river that is rising with no rain — snowmelt, or a dam upstream."
    },
    challenges: [
      {
        question: "Could an AI system combine rainfall, stream and terrain data to warn a small town about flash floods earlier — and say how sure it is?",
        build: "What data would make the warning more reliable, and where would you get examples of floods that haven't happened here yet?",
        responsibility: "Who is harmed by a false alarm — or a missed one?"
      },
      {
        question: "Could an AI system tell smoke from fog in a camera on a fire tower — at dawn, in winter, in the Adirondacks?",
        build: "How many mornings, seasons and cameras would it need to see before you trusted it?",
        responsibility: "Who is affected if a crew is sent to fog — or not sent to smoke?"
      },
      {
        question: "Could an AI system count a bird species from recordings in the woods — including the ones that sound like each other?",
        build: "Who labels the training recordings, and what happens when two experts disagree about a call?",
        responsibility: "What decisions would people make from its counts, and what if the counts are quietly wrong?"
      }
    ]
  },
  {
    id: "manufacturing",
    name: "Manufacturing",
    short: "Machines, quality, supply.",
    keyword: "manufacturing",
    sensor: {
      title: "A motor on a production line",
      intro: "Two readings from a motor. Two labels: NORMAL or INSPECT.",
      x: { label: "Temperature", unit: "°C", min: 20, max: 120, step: 1 },
      y: { label: "Vibration", unit: "mm/s", min: 0, max: 12, step: 0.1 },
      classes: [
        { id: "normal", name: "NORMAL", meaning: "keep running" },
        { id: "inspect", name: "INSPECT", meaning: "stop and check it" }
      ],
      starter: [
        [35, 1.2, 0], [42, 1.8, 0], [48, 2.1, 0], [55, 2.4, 0], [60, 1.6, 0], [65, 2.8, 0], [72, 2.2, 0], [78, 3.0, 0],
        [70, 7.5, 1], [76, 8.2, 1], [82, 9.1, 1], [88, 8.7, 1], [95, 10.2, 1], [85, 6.8, 1], [92, 7.9, 1], [100, 9.6, 1]
      ],
      hint: "Try a motor that is dangerously hot but not shaking at all."
    },
    challenges: [
      {
        question: "Could an AI system detect early signs of equipment failure from noisy sensor data — while knowing when it isn't confident enough to decide alone?",
        build: "What data would you need, and how would you get examples of failures without breaking machines on purpose?",
        responsibility: "Who is affected when it stops a good machine — or keeps a bad one running?"
      },
      {
        question: "Could an AI system inspect every part coming off a line with a camera — and still catch a defect it has never seen before?",
        build: "What would you show it so that 'new kind of flaw' doesn't get waved through as 'fine'?",
        responsibility: "Who gets blamed when a bad part reaches a customer — the model, or the person who trusted it?"
      },
      {
        question: "Could an AI system tell a machine operator which of fifty alarms actually matters right now?",
        build: "How would you learn what 'matters' from operators without copying their habits, good and bad?",
        responsibility: "What happens the day it hides the alarm that mattered most?"
      }
    ]
  },
  {
    id: "robotics",
    name: "Robotics & Autonomy",
    short: "Drones, rovers, self-driving.",
    keyword: "robotics",
    sensor: {
      title: "A delivery robot's wheel motor",
      intro: "Two readings from a robot. Two labels: OK or STOP.",
      x: { label: "Motor current", unit: "A", min: 0, max: 20, step: 0.1 },
      y: { label: "Speed", unit: "m/s", min: 0, max: 2, step: 0.01 },
      classes: [
        { id: "ok", name: "OK", meaning: "keep driving" },
        { id: "stop", name: "STOP", meaning: "stop and call for help" }
      ],
      starter: [
        [3, 0.8, 0], [4, 1.0, 0], [5, 1.2, 0], [6, 1.4, 0], [7, 1.5, 0], [8, 1.6, 0], [4.5, 0.9, 0], [6.5, 1.3, 0],
        [12, 0.5, 1], [13, 0.4, 1], [14, 0.3, 1], [16, 0.2, 1], [18, 0.1, 1], [15, 0.35, 1], [17, 0.15, 1], [19, 0.05, 1]
      ],
      hint: "Try full speed with the motor pulling far too much current."
    },
    challenges: [
      {
        question: "Could an AI system let a farm rover tell a weed from a seedling — in mud, at dusk, after a week without rain?",
        build: "How many fields, seasons and lighting conditions would the examples need to cover?",
        responsibility: "Who is affected when it pulls the crop and leaves the weed?"
      },
      {
        question: "Could an AI system help a drone find a lost hiker from the air — and know the difference between a person and a rock?",
        build: "Where would you get examples of what a person looks like from 200 feet up, in every season?",
        responsibility: "What does a wrong answer cost when a search team follows it?"
      },
      {
        question: "Could an AI system decide when a self-driving shuttle should hand control back to a person — before it gets confused, not after?",
        build: "What would 'I'm not sure' look like in its data, and how would you test for it?",
        responsibility: "Who is responsible in the seconds after the handoff?"
      }
    ]
  },
  {
    id: "business",
    name: "Business & Society",
    short: "Decisions, markets, people.",
    keyword: "business and society",
    sensor: {
      title: "A fraud check on a card payment",
      intro: "Two facts about a payment. Two labels: OK or REVIEW.",
      x: { label: "Amount", unit: "$", min: 0, max: 2000, step: 5 },
      y: { label: "Distance from home", unit: "km", min: 0, max: 500, step: 5 },
      classes: [
        { id: "ok", name: "OK", meaning: "approve it" },
        { id: "review", name: "REVIEW", meaning: "hold it and ask" }
      ],
      starter: [
        [12, 2, 0], [25, 5, 0], [40, 3, 0], [60, 8, 0], [90, 12, 0], [120, 15, 0], [150, 10, 0], [75, 20, 0],
        [1200, 350, 1], [1500, 400, 1], [1800, 450, 1], [1400, 300, 1], [1650, 420, 1], [1900, 480, 1], [1300, 380, 1], [1750, 330, 1]
      ],
      hint: "Try a small purchase a long way from home — someone on vacation."
    },
    challenges: [
      {
        question: "Could an AI system forecast what a small business will sell next month — and say when its guess is worth less than the owner's?",
        build: "What history would it need, and what would you do in a year unlike any in the data?",
        responsibility: "Who bears the cost when a forecast is confidently wrong — the model, or the family that ordered the stock?"
      },
      {
        question: "Could an AI system flag a suspicious payment without freezing the cards of people who simply travel?",
        build: "What examples would teach it the difference between 'unusual' and 'wrong'?",
        responsibility: "Who is affected when it blocks an honest person far from home?"
      },
      {
        question: "Could an AI system sort thousands of public comments on a town decision so every viewpoint gets read — not just the loudest?",
        build: "How would you check that it isn't quietly ignoring the people who write differently?",
        responsibility: "Who decides what 'fair' means here, and who checks the model against that?"
      }
    ]
  }
];
