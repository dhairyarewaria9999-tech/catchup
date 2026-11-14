const planner = require('./planner.js');
const storage = require('./storage.js');
const TODAY = '2026-11-14';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(actual, exp, msg) { if (actual !== exp) throw new Error((msg||'') + ': expected ' + exp + ', got ' + actual); }

const tests = [
  ['calculateUrgencyBoost scaling', () => {
    assert(planner.calculateUrgencyBoost(1) > planner.calculateUrgencyBoost(5));
    assert(planner.calculateUrgencyBoost(5) > planner.calculateUrgencyBoost(14));
    assertEqual(planner.calculateUrgencyBoost(0), 0);
  }],
  ['calculateTopicWeight weighting', () => {
    const subject = { examDate: planner.addDays(TODAY, 5) };
    const w1 = planner.calculateTopicWeight({ difficulty: 1, estimatedHours: 4, hoursDone: 0 }, subject, TODAY);
    const w5 = planner.calculateTopicWeight({ difficulty: 5, estimatedHours: 4, hoursDone: 0 }, subject, TODAY);
    assert(w5 > w1 * 4.5);
    assertEqual(planner.calculateTopicWeight({ difficulty: 5, estimatedHours: 4, hoursDone: 4 }, subject, TODAY), 0);
  }],
  ['Never schedules past exam date', () => {
    const subjects = [{ id: 's1', name: 'Physics', examDate: planner.addDays(TODAY, 3), topics: [{ id: 't1', name: 'Optics', difficulty: 4, estimatedHours: 8, hoursDone: 0 }] }];
    const sessions = planner.generatePlan({ subjects, settings: { dailyHours: 3, studyDays: [0,1,2,3,4,5,6] }, startDate: TODAY });
    for (const s of sessions) assert(s.date < subjects[0].examDate);
  }],
  ['Light revision before exam', () => {
    const subjects = [{ id: 's1', name: 'Chemistry', examDate: planner.addDays(TODAY, 4), topics: [{ id: 't1', name: 'Thermodynamics', difficulty: 3, estimatedHours: 6, hoursDone: 0 }] }];
    const sessions = planner.generatePlan({ subjects, settings: { dailyHours: 3, studyDays: [0,1,2,3,4,5,6] }, startDate: TODAY });
    const revDay = planner.addDays(subjects[0].examDate, -1);
    const rev = sessions.filter(s => s.date === revDay && s.isRevision);
    assert(rev.length > 0 && rev[0].plannedHours <= 1.0);
  }],
  ['Interleaving subjects', () => {
    const subjects = [
      { id: 's1', name: 'Math', examDate: planner.addDays(TODAY, 6), topics: [{ id: 't1', name: 'Algebra', difficulty: 4, estimatedHours: 4, hoursDone: 0 }] },
      { id: 's2', name: 'History', examDate: planner.addDays(TODAY, 7), topics: [{ id: 't2', name: 'WW2', difficulty: 3, estimatedHours: 4, hoursDone: 0 }] }
    ];
    const sessions = planner.generatePlan({ subjects, settings: { dailyHours: 3, studyDays: [0,1,2,3,4,5,6] }, startDate: TODAY });
    const day1 = sessions.filter(s => s.date === TODAY);
    assert(new Set(day1.map(s => s.subjectId)).size >= 2);
  }],
  ['replan preserves completed', () => {
    const subjects = [{ id: 's1', name: 'Bio', examDate: planner.addDays(TODAY, 6), topics: [{ id: 't1', name: 'Genetics', difficulty: 3, estimatedHours: 6, hoursDone: 0 }] }];
    const settings = { dailyHours: 3, studyDays: [0,1,2,3,4,5,6] };
    const initial = planner.generatePlan({ subjects, settings, startDate: TODAY });
    const existing = initial.map(s => ({ ...s }));
    existing[0].status = 'done';
    existing[0].doneHours = existing[0].plannedHours;
    const res = planner.replan({ fromDate: TODAY, subjects, settings, existingSessions: existing });
    assertEqual(res.newSessions.filter(s => s.id === existing[0].id && s.status === 'done').length, 1);
  }],
  ['I missed today', () => {
    const subjects = [{ id: 's1', name: 'Econ', examDate: planner.addDays(TODAY, 6), topics: [{ id: 't1', name: 'Macro', difficulty: 4, estimatedHours: 5, hoursDone: 0 }] }];
    const settings = { dailyHours: 2, studyDays: [0,1,2,3,4,5,6] };
    const initial = planner.generatePlan({ subjects, settings, startDate: TODAY });
    const res = planner.replan({ fromDate: TODAY, subjects, settings, existingSessions: initial, missedToday: true });
    assert(res.newSessions.filter(s => s.date === TODAY).every(s => s.status === 'missed'));
  }],
  ['I only did X hours', () => {
    const subjects = [{ id: 's1', name: 'Lit', examDate: planner.addDays(TODAY, 5), topics: [{ id: 't1', name: 'Shakespeare', difficulty: 3, estimatedHours: 6, hoursDone: 0 }] }];
    const settings = { dailyHours: 3, studyDays: [0,1,2,3,4,5,6] };
    const initial = planner.generatePlan({ subjects, settings, startDate: TODAY });
    const res = planner.replan({ fromDate: TODAY, subjects, settings, existingSessions: initial, completedHoursToday: 1.0 });
    assertEqual(res.newSessions.filter(s => s.date === TODAY).reduce((acc, s) => acc + (s.doneHours||0), 0), 1.0);
  }],
  ['Missing multiple days converts past to missed', () => {
    const subjects = [{ id: 's1', name: 'Physics', examDate: planner.addDays(TODAY, 8), topics: [{ id: 't1', name: 'Quantum', difficulty: 4, estimatedHours: 8, hoursDone: 0 }] }];
    const settings = { dailyHours: 3, studyDays: [0,1,2,3,4,5,6] };
    const oldPlan = planner.generatePlan({ subjects, settings, startDate: planner.addDays(TODAY, -4) });
    const res = planner.replan({ fromDate: TODAY, subjects, settings, existingSessions: oldPlan });
    const past = res.newSessions.filter(s => s.date < TODAY);
    for (const s of past) assertEqual(s.status, 'missed');
  }],
  ['Deleting subject cleanses future sessions', () => {
    const s1 = { id: 's1', name: 'Math', examDate: planner.addDays(TODAY, 6), topics: [{ id: 't1', name: 'Algebra', difficulty: 4, estimatedHours: 4, hoursDone: 0 }] };
    const s2 = { id: 's2', name: 'History', examDate: planner.addDays(TODAY, 7), topics: [{ id: 't2', name: 'WW2', difficulty: 3, estimatedHours: 4, hoursDone: 0 }] };
    const settings = { dailyHours: 3, studyDays: [0,1,2,3,4,5,6] };
    const sessions = planner.generatePlan({ subjects: [s1, s2], settings, startDate: TODAY });
    const res = planner.replan({ fromDate: TODAY, subjects: [s1], settings, existingSessions: sessions });
    assertEqual(res.newSessions.filter(s => s.date >= TODAY && s.subjectId === 's2').length, 0);
  }],
  ['Workload Warning check', () => {
    const subjects = [{ id: 's1', name: 'Massive', examDate: planner.addDays(TODAY, 3), topics: [{ id: 't1', name: 'Huge', difficulty: 5, estimatedHours: 20, hoursDone: 0 }] }];
    const warning = planner.calculateWorkloadWarning({ subjects, settings: { dailyHours: 2, studyDays: [0,1,2,3,4,5,6] }, startDate: TODAY });
    assert(warning.hasWarning && warning.shortfallHours > 10 && warning.extraHoursPerDayNeeded > 3);
  }],
  ['Data Sanitization safety', () => {
    const sanitized = storage.sanitizeSubjects([null, { name: 'Broken' }, { id: 's1', name: 'Ok', examDate: '2026-11-20', topics: [{ name: 'No hours' }, null] }]);
    assertEqual(sanitized.length, 2);
    assertEqual(sanitized[1].topics[0].estimatedHours, 2);
  }],
  ['Demo data idempotency', () => {
    const d1 = storage.generateDemoData(TODAY);
    const d2 = storage.generateDemoData(TODAY);
    assertEqual(d1.subjects.length, d2.subjects.length);
    assertEqual(d1.sessions.length, d2.sessions.length);
    assertEqual(d1.sessions[0].id, d2.sessions[0].id);
  }],
  ['Stress benchmark < 50ms', () => {
    const stressSubjects = [];
    for (let i = 0; i < 20; i++) {
      const topics = [];
      for (let j = 0; j < 10; j++) {
        topics.push({ id: 'st_' + i + '_' + j, name: 'Topic ' + j, difficulty: (j%5)+1, estimatedHours: 3, hoursDone: 0 });
      }
      stressSubjects.push({ id: 'ss_' + i, name: 'Sub ' + i, color: '#6366f1', examDate: planner.addDays(TODAY, 20 + i*3), topics });
    }
    const settings = { dailyHours: 4, studyDays: [0,1,2,3,4,5,6] };
    const plan = planner.generatePlan({ subjects: stressSubjects, settings, startDate: TODAY, maxDays: 90 });
    const start = performance.now();
    const res = planner.replan({ fromDate: TODAY, subjects: stressSubjects, settings, existingSessions: plan, missedToday: true });
    const duration = performance.now() - start;
    console.log('Stress replan duration: ' + duration.toFixed(2) + ' ms for ' + res.newSessions.length + ' sessions');
    assert(duration < 50, 'Must finish in < 50ms');
  }]
];

let passed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    passed++;
    console.log('PASS: ' + name);
  } catch (e) {
    console.error('FAIL: ' + name + ' -> ' + e.message);
  }
}
console.log('\n--- Summary ---');
console.log('Total passed: ' + passed + ' / ' + tests.length);
if (passed !== tests.length) process.exit(1);
