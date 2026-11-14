# ⚡ Catchup — Adaptive Study Planner

> **"Study plans fail the moment a student misses a day. Catchup generates a day-by-day plan and automatically re-plans the remaining days when life happens."**

🌐 **Live Demo on GitHub Pages**: [https://dhairyarewaria9999-tech.github.io/catchup/](https://dhairyarewaria9999-tech.github.io/catchup/)  
🧪 **Live Unit Test Suite**: [https://dhairyarewaria9999-tech.github.io/catchup/tests.html](https://dhairyarewaria9999-tech.github.io/catchup/tests.html)  
📦 **GitHub Repository**: [https://github.com/dhairyarewaria9999-tech/catchup](https://github.com/dhairyarewaria9999-tech/catchup)

Built for a 24-hour hackathon. 100% vanilla HTML, CSS, and modern JavaScript. Zero dependencies, zero build steps, zero backends. Runs directly by opening `index.html` or online via GitHub Pages.

---

## 🎯 Problem Statement

Every student has made a detailed study timetable only to see it collapse by Tuesday because:
1. **Life intervenes**: You catch a cold, have an emergency, or simply burn out for a day.
2. **Timetable paralysis**: Once a calendar schedule falls behind, manually re-calculating, shifting, and re-allocating 15 topics across 3 subjects is overwhelming.
3. **Guilt & abandonment**: Students abandon the entire schedule instead of adjusting it.

**Catchup solves this:** Study plans adapt dynamically. With a single click on *"I missed today"* or *"I only did X hours"*, Catchup mathematically redistributes remaining workload across upcoming study days, accounting for exam dates, topic difficulties, subject interleaving, and burnout prevention.

---

## ✨ Features

- 🧠 **Dynamic Urgency & Difficulty Scheduling Engine** (`planner.js`): Pure functional scheduler that dynamically weights topics by difficulty ($1-5$), remaining hours, and exponential exam-proximity urgency boost.
- 🔀 **Subject Interleaving**: Cognitive science demonstrates that blocked practice ("cramming one subject all day") hinders retention. Catchup interleaves different subjects across each study day.
- 🛡️ **Pre-Exam Revision Day**: Automatically designates the day immediately before each exam as a light revision block, preventing last-minute topic overloads.
- ⚡ **Zero-Guilt Re-Planning**:
  - **"I missed today"**: Marks today's sessions as missed without losing credit for past work and shifts pending topics across future available days.
  - **"I only did ___ hours"**: Logs partial progress and smoothly re-plans the remaining hours.
- ⚠️ **Workload Capacity Warnings**: Alerts you instantly if remaining hours exceed total available time before an exam, calculating exactly how many extra hours/day would restore balance.
- ⏱️ **Integrated Pomodoro Focus Timer**: 25/5 focus intervals with smooth SVG progress ring and a soft, synthesizer audio chime built via the Web Audio API (100% offline, zero audio file dependencies).
- 📅 **14-Day Adaptive Timeline (Plan)**: Visual calendar view with color-coded subject pills and subtle shift animations highlighting newly re-planned sessions.
- 📊 **Exam Readiness & Consistency (Progress)**:
  - Difficulty-weighted mastery score: $\frac{\sum (\text{hoursDone} \times \text{difficulty})}{\sum (\text{estimatedHours} \times \text{difficulty})} \times 100\%$
  - Live exam countdown badges with urgency colors.
  - GitHub-style 12-week study activity heatmap.
- 🎨 **Modern, Distinctive UI/UX**:
  - Typography powered by Google Fonts (*Outfit* and *Plus Jakarta Sans*).
  - Dark and Light mode toggle with system preference detection and persistence.
  - Mobile-first responsive layout with accessible focus rings and semantic tags.
  - Toast notification engine detailing exact changes on every re-plan.
- ⚡ **Instant Demo Data**: Pre-loaded with three realistic subjects (Calculus, Operating Systems, Machine Learning) with exams in 5, 9, and 14 days and realistic historical study logs.
- 🧪 **Built-in Browser Test Suite** (`tests.html`): Full unit-style test runner verifying the planning and re-planning algorithm with visual pass/fail indicators.

---

## 🧮 How the Planning Algorithm Works

The core logic lives in `planner.js` as pure functions:

### 1. Topic Weighting
$$\text{Weight} = \text{Difficulty} \times \text{Remaining Hours} \times \text{Urgency Boost}$$

Where urgency boost scales inversely with days left until the subject's exam:
$$\text{Urgency Boost} = 1 + \frac{6}{\max(1, \text{daysUntilExam})}$$

Topics close to their exam deadline with high difficulty receive the highest priority.

### 2. Daily Slot Interleaving
- For each active study day, the daily capacity (`dailyHours`, default 3h) is divided into 1.0h to 1.5h blocks.
- The algorithm greedily selects candidate topics with the highest weight while filtering out subjects already studied that day (unless no other subjects have pending work).
- The day prior to any exam (`examDate - 1`) automatically locks in a $\le 1.0\text{h}$ **Light Revision** session for that subject.
- No sessions are ever scheduled on or after a subject's exam date.

### 3. Re-Planning (`replan()`)
1. **Preserve History**: Completed sessions (`status === 'done'`) and past days remain immutable records.
2. **Handle Interruption**:
   - *Missed Today*: Today's uncompleted sessions are marked `status: 'missed'`, and unstudied hours are preserved. Future sessions are regenerated starting tomorrow.
   - *Partial Hours*: Logs $X$ hours to today's sessions, credits the topics, and regenerates the remainder.
3. **Capacity Check**: Evaluates if total remaining hours exceed capacity before each deadline. If so, flags:
   $$\text{Extra Hours/Day} = \left\lceil \frac{\text{Shortfall Hours}}{\text{Available Days}} \times 10 \right\rceil / 10$$
4. **Diff Generation**: Emits an informative toast summary describing what moved where.

---

## 📂 File Structure

```text
├── index.html       # Single-page application shell (Setup, Today, Plan, Progress)
├── styles.css       # Design system, CSS variables, dark/light themes, animations
├── app.js           # Main controller, keyboard shortcuts, theme coordinator
├── planner.js       # Pure planning, weighting, interleaving, and re-planning logic
├── storage.js       # LocalStorage wrapper, demo data generator, study history logs
├── ui.js            # View rendering, Pomodoro timer, Web Audio chime, toasts
├── tests.html       # In-browser unit test runner for planner.js
└── README.md        # Documentation, architecture, and 60-second demo script
```

---

## 🚀 How to Run

### Option 1: Direct File Opening
Double-click `index.html` in your file explorer, or right-click $\rightarrow$ *Open With* $\rightarrow$ Chrome / Edge / Safari / Firefox.

### Option 2: Local HTTP Server (Optional)
If you prefer running via a local server:
```bash
# Python 3
python -m http.server 8000

# or Node.js npx
npx serve .
```
Navigate to `http://localhost:8000`.

### Option 3: Deploy to Netlify / GitHub Pages
- **GitHub Pages**: Push this repository to GitHub $\rightarrow$ Settings $\rightarrow$ Pages $\rightarrow$ Deploy from `main` branch root.
- **Netlify**: Drag and drop the folder into Netlify Drop, or connect repository with publish directory set to `.`.

---

## 🧪 Running Automated Tests

Open `tests.html` in your browser. It automatically runs 10 test suites testing:
- Urgency boost scaling & topic weight calculation
- Strict exam date boundaries
- Pre-exam light revision day creation
- Multi-subject daily interleaving
- Completed session preservation on re-plan
- "I missed today" forward shifting
- Partial hours logging
- Workload capacity warning calculations
- Difficulty-weighted readiness scores
- Edge cases (past exams, zero topics, rest days)

---

## ⏱️ 60-Second Hackathon Pitch & Demo Script

> **[0:00 - 0:10] Hook**
> *"Every single one of us has made an ambitious study schedule, gotten sick or busy on day three, and watched the whole plan fall apart. Why? Because static timetables don't forgive reality."*

> **[0:10 - 0:25] Introduce Catchup & Demo Data**
> *"This is **Catchup** — an adaptive study planner. Notice here on our Setup screen: we have 3 subjects — Calculus in 5 days, Operating Systems in 9, Machine Learning in 14. Catchup doesn't just block-cram; it interleaves topics across days and protects the day before each exam for light revision."*

> **[0:25 - 0:45] The Killer Moment: "I missed today"**
> *"Now let's go to **Today**. I have 3 hours scheduled. Imagine I have an emergency and can't study. In traditional tools, I'm now behind forever. In Catchup, I click **'I missed today'**. Watch: in 50 milliseconds, our algorithm regenerates the entire 14-day timeline. Look at the toast: 'Logged day as missed. Shifted 3.0h across upcoming study days.' Check the Plan tab: the sessions smoothly animated to their new dates, respecting exam deadlines and cognitive load."*

> **[0:45 - 0:55] Actionable Workload Alert & Progress**
> *"If my deadline gets too tight, Catchup warns me: 'Workload alert: add +0.8 hours/day to stay on track'. In the Progress tab, I get a difficulty-weighted readiness score and a GitHub-style consistency heatmap."*

> **[0:55 - 1:00] Technical & Call to Action**
> *"Zero backend, zero build step, 100% vanilla web standards that work offline in any browser. With Catchup, missing a day is no longer the end of your study plan — it's just an input to the algorithm."*
