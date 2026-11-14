# ⚡ Catchup — Adaptive Study Planner

> **"Study plans fail the moment a student misses a day. Catchup generates a day-by-day plan and automatically re-plans the remaining days when life happens."**

🌐 **Live Demo on GitHub Pages**: [https://dhairyarewaria9999-tech.github.io/catchup/](https://dhairyarewaria9999-tech.github.io/catchup/)  
🧪 **Live Unit Test Suite**: [https://dhairyarewaria9999-tech.github.io/catchup/tests.html](https://dhairyarewaria9999-tech.github.io/catchup/tests.html)  
📦 **GitHub Repository**: [https://github.com/dhairyarewaria9999-tech/catchup](https://github.com/dhairyarewaria9999-tech/catchup)

Built for a 24-hour hackathon. 100% vanilla HTML5, CSS3, and modern JavaScript. Zero dependencies, zero build steps, zero backends. Runs directly by opening `index.html` on your desktop (`file:///`) or online via GitHub Pages (`https://`).

---

## 🎯 Problem Statement

Every student has made a detailed study timetable only to see it collapse by Tuesday because:
1. **Life intervenes**: You catch a cold, have an emergency, or simply burn out for a day.
2. **Timetable paralysis**: Once a calendar schedule falls behind, manually re-calculating, shifting, and re-allocating 15 topics across 3 subjects is overwhelming.
3. **Guilt & abandonment**: Students abandon the entire schedule instead of adjusting it.

**Catchup solves this:** Study plans adapt dynamically. With a single click on *"I missed today"* or *"I only did ___ hours"*, Catchup mathematically redistributes remaining workload across upcoming study days, accounting for exam dates, topic difficulties, subject interleaving, and burnout prevention.

---

## ✨ Features & Polish Enhancements

- 🧠 **Dynamic Urgency & Difficulty Scheduling Engine** (`planner.js`): Pure functional scheduler that dynamically weights topics by difficulty ($1–5$), remaining hours, and exponential exam-proximity urgency boost.
- 🔀 **Cognitive Interleaving**: Cognitive science proves that cramming one subject all day hurts retention. Catchup interleaves different subjects across each study day.
- 🛡️ **Pre-Exam Revision Day**: Automatically designates the day immediately before each exam (`examDate - 1`) as a light revision block ($\le 1.0\text{h}$), preventing last-minute topic overloads.
- ⚡ **Zero-Guilt Re-Planning**:
  - **"I missed today"**: Marks today's sessions as missed without penalizing past completed work and shifts pending topics forward across future study days.
  - **"I only did ___ hours"**: Logs partial progress and smoothly re-plans the remainder.
  - **Catchup on Missed Sequences**: Automatically detects past uncompleted days and converts them to `missed` status so schedules stay synchronized without phantom sessions.
- ⚠️ **Workload Capacity Warnings**: Alerts you instantly if remaining hours exceed total available study capacity before an exam, calculating exactly how many extra hours/day would restore feasibility.
- ⏱️ **Timestamp-Accurate Pomodoro Focus Timer**: 25/5 focus intervals with smooth SVG progress ring, zero-drift timestamp tracking (`Date.now()`), and soft synthesizer audio chimes via the Web Audio API (100% offline).
- 🎯 **Today Focus Hero Card & Daily Progress**: Prominent hero card showing the next priority session with a 1-click timer trigger, plus a real-time daily progress bar ($1.5 / 3.0\text{h}$).
- 📅 **14-Day Adaptive Timeline (Plan)**: Visual calendar view with color-coded subject pills, hover tooltips, glowing `TODAY` indicator, and `.replan-shifted` pulse animations.
- 📊 **Exam Readiness & Consistency (Progress)**:
  - Difficulty-weighted mastery score: $\frac{\sum (\text{hoursDone} \times \text{difficulty})}{\sum (\text{estimatedHours} \times \text{difficulty})} \times 100\%$
  - Live exam countdown badges with urgency colors.
  - GitHub-style 12-week study activity heatmap.
- 🎨 **Modern, Distinctive UI/UX**:
  - Typography powered by Google Fonts (*Outfit* and *Plus Jakarta Sans*).
  - Dark and Light mode toggle with system preference detection and persistence.
  - Mobile-first responsive layout (360px to 1440px+) with 44px minimum touch targets.
  - Toast notification engine detailing exact changes on every re-plan.
  - Accessible modals with focus traps (Tab cycling) and Escape key dismissal.
  - Full `@media (prefers-reduced-motion: reduce)` support.
- 📱 **Progressive Web App (PWA)**: Includes `manifest.json` and `sw.js` service worker for complete offline support and home screen installation.
- ⚡ **Idempotent Demo Data & Data Reset**: Pre-loaded with realistic subjects (Calculus in 5d, OS in 9d, ML in 14d) and reproducible 35-day study history. Complete "Reset All Data" option with confirmation modal.
- 🧪 **Built-in Browser & CLI Test Suite** (`tests.html` & `tests_runner.cjs`): 14 unit test suites verifying algorithms, capacity checks, schema migrations, and stress benchmarks.

---

## 🧮 How the Planning Algorithm Works

The core logic lives in `planner.js` as pure functions:

### 1. Topic Weighting
$$\text{Weight} = \text{Difficulty (1–5)} \times \text{Remaining Hours} \times \left(1 + \frac{6}{\max(1, \text{daysUntilExam})}\right)$$

Topics close to their exam deadline with high difficulty receive the highest priority.

### 2. Daily Slot Interleaving
- For each active study day, daily capacity (`dailyHours`, default 3h) is divided into 1.0h to 1.5h blocks.
- The algorithm greedily selects candidate topics with the highest weight while filtering out subjects already studied that day (unless no other subjects have pending work).
- The day prior to any exam (`examDate - 1`) automatically locks in a $\le 1.0\text{h}$ **Light Revision** session for that subject.
- No sessions are ever scheduled on or after a subject's exam date.

### 3. Re-Planning (`replan()`)
1. **Preserve History**: Completed sessions (`status === 'done'`) and past records remain immutable.
2. **Handle Interruption**:
   - *Past Uncompleted Days*: Automatically converted from `planned` to `missed` status with `doneHours: 0`.
   - *Missed Today*: Marks today's sessions as `missed` and shifts uncompleted hours forward starting tomorrow.
   - *Partial Hours*: Credits $X$ hours to today's sessions, logs them to study history, and regenerates the remainder.
3. **Cleanse Orphaned Data**: Dropping or editing subjects removes orphaned future sessions cleanly.
4. **Capacity Check**: Evaluates if total remaining hours exceed capacity before each deadline:
   $$\text{Extra Hours/Day} = \left\lceil \frac{\text{Shortfall Hours}}{\text{Available Days}} \times 10 \right\rceil / 10$$
5. **Diff Generation**: Emits an informative toast summary describing what moved where.

---

## ⚡ Performance Benchmarks

| Metric | Target | Actual Result |
| :--- | :--- | :--- |
| **Replan Stress Test** (20 subjects, 200 topics, 90 days) | < 50 ms | **26.94 ms** |
| **Pomodoro Timer Drift** | 0% drift in background | **0.00% drift** (timestamp-based) |
| **Bundle / Build Step Size** | 0 dependencies | **0 KB dependencies** (100% vanilla) |
| **Offline Reliability** | PWA Service Worker | **100% offline functional** |

---

## 📂 File Structure

```text
├── index.html          # Semantic application shell (Setup, Today, Plan, Progress, Modals)
├── styles.css          # Cohesive design system, CSS variables, dark/light themes, animations
├── app.js              # Controller, keyboard shortcuts, PWA registration, theme coordination
├── planner.js          # Pure functional engine: weighting, interleaving, and re-planning
├── storage.js          # LocalStorage schema v2, migrations, sanitization, and demo data
├── ui.js               # View rendering, Hero card, Pomodoro timer, Web Audio chime, toasts
├── tests.html          # In-browser unit test runner with visual pass/fail indicators
├── tests_runner.cjs    # CLI Node.js unit test runner
├── manifest.json       # Web App Manifest for PWA installation
├── sw.js               # Service worker for offline asset caching
└── README.md           # Documentation, architecture, benchmarks, and demo pitch
```

---

## 🚀 How to Run

### Option 1: Direct File Opening (Offline)
Double-click `index.html` in your file explorer, or right-click $\rightarrow$ *Open With* $\rightarrow$ Chrome / Edge / Safari / Firefox.

### Option 2: Live Online Demo
Visit [https://dhairyarewaria9999-tech.github.io/catchup/](https://dhairyarewaria9999-tech.github.io/catchup/).

---

## 🧪 Running Automated Tests

- **In the Browser**: Open [tests.html](https://dhairyarewaria9999-tech.github.io/catchup/tests.html).
- **In Node.js (CLI)**:
  ```bash
  node tests_runner.cjs
  ```
All 14 unit test suites run automatically and report duration in milliseconds.

---

## ⏱️ 60-Second Hackathon Pitch Script

> **[0:00 - 0:10] The Hook**
> *"Every single one of us has made an ambitious study schedule, gotten busy or exhausted on day three, and watched the whole plan fall apart. Static timetables don't forgive reality."*

> **[0:10 - 0:25] The Solution & Curriculum**
> *"This is **Catchup** — an adaptive study planner. On the Setup screen, we have 3 subjects: Calculus in 5 days, Operating Systems in 9, Machine Learning in 14. Catchup doesn't block-cram; it interleaves topics across days and protects the day before each exam for light revision."*

> **[0:25 - 0:45] The Killer Demo: "I missed today"**
> *"Let's go to **Today**. Suppose I have 3 hours scheduled, but life happens and I can't study. In traditional tools, I am now permanently behind. In Catchup, I click **'I missed today'**. In just 26 milliseconds, our algorithm recalculates the entire 14-day timeline. Notice the toast: 'Marked today as missed. Rescheduled 3.0h across upcoming study days.' In the Plan tab, sessions smoothly animate to their new dates, respecting cognitive load."*

> **[0:45 - 0:55] Actionable Workload Alert & Progress**
> *"If exam deadlines get too tight, Catchup warns me: 'Workload alert: add +0.8 hours/day to stay on track'. In the Progress tab, I get difficulty-weighted mastery and a GitHub-style consistency heatmap."*

> **[0:55 - 1:00] Technical & Call to Action**
> *"Zero backend, zero build step, 100% vanilla web standards that install as an offline PWA. With Catchup, missing a day is no longer the failure of your study plan — it's just an input to the algorithm."*
