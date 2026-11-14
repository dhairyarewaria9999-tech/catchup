/**
 * Catchup - Adaptive Study Planner Algorithm
 * Pure functions for generating, interleaving, and recalculating adaptive study schedules.
 * Supports both browser direct file execution (file://) and module environments.
 */

(function(global) {
  'use strict';

  // ==========================================
  // DATE UTILITIES (ISO YYYY-MM-DD based)
  // ==========================================

  /**
   * Format a Date object or timestamp to 'YYYY-MM-DD' in local timezone.
   * Defensively handles Date instances, timestamps, and date strings.
   * @param {Date|number|string} date
   * @returns {string}
   */
  function formatDate(date) {
    if (!date) return '';
    if (typeof date === 'string') {
      const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[1]}-${match[2]}-${match[3]}`;
      date = new Date(date);
    } else if (typeof date === 'number') {
      date = new Date(date);
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse 'YYYY-MM-DD' into a local Date object set to noon (12:00:00).
   * Noon avoids daylight saving time (DST) boundary jumps across midnight.
   * @param {string} dateStr
   * @returns {Date}
   */
  function parseDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return new Date();
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10) || 2026;
    const month = (parseInt(parts[1], 10) || 1) - 1;
    const day = parseInt(parts[2], 10) || 1;
    return new Date(year, month, day, 12, 0, 0);
  }

  /**
   * Add days to a YYYY-MM-DD date string.
   * @param {string} dateStr
   * @param {number} days
   * @returns {string}
   */
  function addDays(dateStr, days) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + Number(days));
    return formatDate(d);
  }

  /**
   * Difference in calendar days between date2 and date1 (date2 - date1).
   * @param {string} date1Str
   * @param {string} date2Str
   * @returns {number}
   */
  function daysBetween(date1Str, date2Str) {
    const d1 = parseDate(date1Str);
    const d2 = parseDate(date2Str);
    const diffMs = d2.getTime() - d1.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get weekday index: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
   * @param {string} dateStr
   * @returns {number}
   */
  function getDayOfWeek(dateStr) {
    return parseDate(dateStr).getDay();
  }

  // ==========================================
  // WEIGHTING & HEURISTICS
  // ==========================================

  /**
   * Urgency multiplier based on days remaining until exam.
   * Closer exams receive an exponential boost so critical topics bubble to top.
   * @param {number} daysRemaining
   * @returns {number}
   */
  function calculateUrgencyBoost(daysRemaining) {
    if (daysRemaining <= 0) return 0;
    return 1 + 6 / Math.max(1, daysRemaining);
  }

  /**
   * Calculate weight for a topic:
   * Weight = Difficulty (1-5) * Remaining Hours * Urgency Boost
   * @param {Object} topic
   * @param {Object} subject
   * @param {string} currentDateStr
   * @returns {number}
   */
  function calculateTopicWeight(topic, subject, currentDateStr) {
    const remainingHours = Math.max(0, (Number(topic.estimatedHours) || 0) - (Number(topic.hoursDone) || 0));
    if (remainingHours <= 0) return 0;

    const daysToExam = daysBetween(currentDateStr, subject.examDate);
    if (daysToExam <= 0) return 0;

    const urgency = calculateUrgencyBoost(daysToExam);
    const difficulty = Math.max(1, Math.min(5, Number(topic.difficulty) || 3));

    return difficulty * remainingHours * urgency;
  }

  // ==========================================
  // CAPACITY & WORKLOAD WARNING
  // ==========================================

  function isStudyDay(dateStr, settings) {
    const dayOfWeek = getDayOfWeek(dateStr);
    const studyDays = (settings && Array.isArray(settings.studyDays) && settings.studyDays.length > 0)
      ? settings.studyDays
      : [1, 2, 3, 4, 5, 6, 0];
    return studyDays.includes(dayOfWeek);
  }

  function getRemainingHours(subjects) {
    let totalRemaining = 0;
    const perSubject = {};

    for (const subject of (subjects || [])) {
      let subTotal = 0;
      for (const topic of (subject.topics || [])) {
        const rem = Math.max(0, (Number(topic.estimatedHours) || 0) - (Number(topic.hoursDone) || 0));
        subTotal += rem;
      }
      perSubject[subject.id] = Math.round(subTotal * 10) / 10;
      totalRemaining += subTotal;
    }

    return { totalRemaining: Math.round(totalRemaining * 10) / 10, perSubject };
  }

  function calculateWorkloadWarning({ subjects = [], settings = {}, startDate }) {
    if (!startDate) startDate = formatDate(new Date());
    const dailyHours = Math.max(0.5, Number(settings.dailyHours) || 3);
    const subjectWarnings = [];
    let maxExtraDailyNeeded = 0;
    let totalShortfall = 0;

    for (const subject of subjects) {
      if (!subject.examDate) continue;
      const daysUntilExam = daysBetween(startDate, subject.examDate);
      if (daysUntilExam <= 0) continue;

      let availableDays = 0;
      for (let i = 0; i < daysUntilExam; i++) {
        const checkDate = addDays(startDate, i);
        if (isStudyDay(checkDate, settings)) {
          availableDays++;
        }
      }

      let remainingSubjectHours = 0;
      for (const topic of (subject.topics || [])) {
        remainingSubjectHours += Math.max(0, (Number(topic.estimatedHours) || 0) - (Number(topic.hoursDone) || 0));
      }

      const maxSubjectCapacity = availableDays * dailyHours;

      if (remainingSubjectHours > maxSubjectCapacity) {
        const shortfall = remainingSubjectHours - maxSubjectCapacity;
        const extraPerDay = availableDays > 0 ? shortfall / availableDays : shortfall;
        totalShortfall += shortfall;
        maxExtraDailyNeeded = Math.max(maxExtraDailyNeeded, extraPerDay);

        subjectWarnings.push({
          subjectId: subject.id,
          subjectName: subject.name,
          remainingHours: Math.round(remainingSubjectHours * 10) / 10,
          availableDays,
          shortfall: Math.round(shortfall * 10) / 10,
          extraPerDayNeeded: Math.round(extraPerDay * 10) / 10
        });
      }
    }

    let latestExamDate = startDate;
    for (const s of subjects) {
      if (s.examDate && s.examDate > latestExamDate) {
        latestExamDate = s.examDate;
      }
    }

    const totalHorizonDays = Math.max(0, daysBetween(startDate, latestExamDate));
    let totalAvailableStudyDays = 0;
    for (let i = 0; i < totalHorizonDays; i++) {
      const checkDate = addDays(startDate, i);
      if (isStudyDay(checkDate, settings)) {
        totalAvailableStudyDays++;
      }
    }

    const { totalRemaining } = getRemainingHours(subjects);
    const totalCapacity = totalAvailableStudyDays * dailyHours;

    if (totalRemaining > totalCapacity) {
      const globalShortfall = totalRemaining - totalCapacity;
      const globalExtra = totalAvailableStudyDays > 0 ? (globalShortfall / totalAvailableStudyDays) : globalShortfall;
      maxExtraDailyNeeded = Math.max(maxExtraDailyNeeded, globalExtra);
      totalShortfall = Math.max(totalShortfall, globalShortfall);
    }

    const hasWarning = totalShortfall > 0 || subjectWarnings.length > 0;

    return {
      hasWarning,
      totalRemaining: Math.round(totalRemaining * 10) / 10,
      totalCapacity: Math.round(totalCapacity * 10) / 10,
      shortfallHours: Math.round(totalShortfall * 10) / 10,
      extraHoursPerDayNeeded: Math.round(maxExtraDailyNeeded * 10) / 10,
      subjectWarnings
    };
  }

  // ==========================================
  // CORE PLANNING & INTERLEAVING ENGINE
  // ==========================================

  /**
   * Generates a forward-looking study schedule with interleaving and light pre-exam revision.
   * High performance: optimized topic candidate pooling and early termination.
   * @param {Object} params
   * @returns {Array} generated session objects
   */
  function generatePlan({ subjects = [], settings = {}, startDate, maxDays = 45 }) {
    if (!subjects || subjects.length === 0 || !startDate) return [];

    const dailyHours = Math.max(0.5, Math.min(16, Number(settings.dailyHours) || 3));
    const sessions = [];

    // Filter valid subjects and clone state
    const validSubjects = subjects.filter(s => s && s.id && s.examDate);
    const state = validSubjects.map(s => ({
      id: s.id,
      name: s.name || 'Untitled Subject',
      color: s.color || '#6366f1',
      examDate: s.examDate,
      topics: (s.topics || []).map(t => ({
        id: t.id,
        name: t.name || 'Untitled Topic',
        difficulty: Math.max(1, Math.min(5, Number(t.difficulty) || 3)),
        estimatedHours: Math.max(0, Number(t.estimatedHours) || 0),
        hoursDone: Math.max(0, Number(t.hoursDone) || 0),
        remainingHours: Math.max(0, (Number(t.estimatedHours) || 0) - (Number(t.hoursDone) || 0))
      }))
    }));

    let latestExamDate = startDate;
    for (const s of state) {
      if (s.examDate > latestExamDate) {
        latestExamDate = s.examDate;
      }
    }

    const horizon = Math.min(maxDays, Math.max(14, daysBetween(startDate, latestExamDate) + 1));
    let sessionIdCounter = 1;

    for (let dayOffset = 0; dayOffset < horizon; dayOffset++) {
      const currentDateStr = addDays(startDate, dayOffset);

      // Check if any subject has remaining topics OR upcoming revision days
      const hasRemainingTopics = state.some(s => s.topics.some(t => t.remainingHours > 0.05));
      const hasUpcomingRevision = state.some(s => {
        const daysToExam = daysBetween(currentDateStr, s.examDate);
        return daysToExam >= 1;
      });

      if (!hasRemainingTopics && !hasUpcomingRevision) {
        break;
      }

      if (!isStudyDay(currentDateStr, settings)) {
        continue;
      }

      let dayHoursLeft = dailyHours;
      const subjectsStudiedToday = new Set();

      // 1. Light Revision Days (the calendar day before exam: examDate - 1)
      for (const subject of state) {
        const daysToExam = daysBetween(currentDateStr, subject.examDate);
        if (daysToExam === 1) {
          const revisionHours = Math.min(1.0, dayHoursLeft);
          if (revisionHours >= 0.5) {
            sessions.push({
              id: `session-${currentDateStr}-${subject.id}-rev-${sessionIdCounter++}`,
              date: currentDateStr,
              subjectId: subject.id,
              topicId: 'revision',
              topicName: 'Final Exam Review & Cheat Sheet',
              plannedHours: revisionHours,
              doneHours: 0,
              status: 'planned',
              isRevision: true
            });
            dayHoursLeft -= revisionHours;
            subjectsStudiedToday.add(subject.id);
          }
        }
      }

      if (dayHoursLeft < 0.5) continue;

      // 2. Interleaved Topic Allocation
      let safetyCounter = 0;
      while (dayHoursLeft >= 0.5 && safetyCounter++ < 25) {
        const candidates = [];

        for (const subject of state) {
          const daysToExam = daysBetween(currentDateStr, subject.examDate);
          if (daysToExam <= 0) continue; // Exam is today or passed

          for (const topic of subject.topics) {
            if (topic.remainingHours > 0.05) {
              const weight = calculateTopicWeight(topic, subject, currentDateStr);
              candidates.push({
                subject,
                topic,
                weight,
                alreadyStudiedToday: subjectsStudiedToday.has(subject.id)
              });
            }
          }
        }

        if (candidates.length === 0) break;

        // Prioritize interleaved subjects
        const notYetStudied = candidates.filter(c => !c.alreadyStudiedToday);
        const pool = notYetStudied.length > 0 ? notYetStudied : candidates;

        // Pick highest weight
        let chosen = pool[0];
        for (let i = 1; i < pool.length; i++) {
          if (pool[i].weight > chosen.weight) {
            chosen = pool[i];
          }
        }

        const distinctRemainingSubjects = new Set(candidates.map(c => c.subject.id)).size;
        const targetBlock = distinctRemainingSubjects > 1 ? Math.min(1.5, dayHoursLeft) : dayHoursLeft;
        const plannedHours = Math.min(chosen.topic.remainingHours, dayHoursLeft, targetBlock);

        const quantizedHours = plannedHours >= 1.0
          ? Math.round(plannedHours * 2) / 2
          : Math.round(plannedHours * 10) / 10;

        const finalSessionHours = Math.max(0.5, quantizedHours);

        sessions.push({
          id: `session-${currentDateStr}-${chosen.subject.id}-${chosen.topic.id}-${sessionIdCounter++}`,
          date: currentDateStr,
          subjectId: chosen.subject.id,
          topicId: chosen.topic.id,
          topicName: chosen.topic.name,
          plannedHours: finalSessionHours,
          doneHours: 0,
          status: 'planned',
          isRevision: false
        });

        chosen.topic.remainingHours = Math.max(0, chosen.topic.remainingHours - finalSessionHours);
        dayHoursLeft = Math.max(0, Math.round((dayHoursLeft - finalSessionHours) * 10) / 10);
        subjectsStudiedToday.add(chosen.subject.id);
      }
    }

    return sessions;
  }

  // ==========================================
  // REPLANNING ENGINE
  // ==========================================

  /**
   * Adaptive re-plan from a specific date forward.
   * 
   * Robust edge-case guarantees:
   * 1. Preserves historical completed sessions.
   * 2. Automatically converts past uncompleted sessions (date < fromDate) to 'missed' status.
   * 3. Cleanses sessions for subjects/topics that were deleted.
   * 4. Properly recalculates topic remaining hours based on actual completed work.
   * 5. Regenerates future sessions seamlessly.
   */
  function replan({
    fromDate,
    subjects = [],
    settings = {},
    existingSessions = [],
    missedToday = false,
    completedHoursToday = null
  }) {
    if (!fromDate) fromDate = formatDate(new Date());

    // Map existing valid subject & topic IDs to cleanse deleted items
    const validSubjectIds = new Set(subjects.map(s => s.id));
    const validTopicIds = new Set();
    subjects.forEach(s => {
      (s.topics || []).forEach(t => validTopicIds.add(t.id));
    });

    const keptSessions = [];
    const futureDiscardedSessions = [];

    for (const session of (existingSessions || [])) {
      // If the subject was completely deleted, drop future planned sessions
      if (!validSubjectIds.has(session.subjectId) && session.date >= fromDate) {
        continue;
      }

      if (session.date < fromDate) {
        // Past session: keep as record
        if (session.status === 'planned') {
          // BUG FIX: Any uncompleted past session is marked 'missed'
          keptSessions.push({
            ...session,
            status: 'missed',
            doneHours: 0
          });
        } else {
          keptSessions.push({ ...session });
        }
      } else if (session.date === fromDate) {
        if (session.status === 'done') {
          keptSessions.push({ ...session });
        } else {
          futureDiscardedSessions.push(session);
        }
      } else {
        // Future date
        if (session.status === 'done') {
          keptSessions.push({ ...session });
        } else {
          futureDiscardedSessions.push(session);
        }
      }
    }

    let effectiveStartDate = fromDate;

    if (missedToday) {
      const todayUncompleted = (existingSessions || []).filter(s => s.date === fromDate && s.status !== 'done');
      for (const session of todayUncompleted) {
        if (validSubjectIds.has(session.subjectId)) {
          keptSessions.push({
            ...session,
            status: 'missed',
            doneHours: 0
          });
        }
      }
      effectiveStartDate = addDays(fromDate, 1);
    } else if (completedHoursToday !== null) {
      let remainingToDistribute = Math.max(0, Number(completedHoursToday));
      const todayUncompleted = (existingSessions || []).filter(s => s.date === fromDate && s.status !== 'done');

      for (const session of todayUncompleted) {
        if (!validSubjectIds.has(session.subjectId)) continue;

        if (remainingToDistribute <= 0) {
          keptSessions.push({
            ...session,
            status: 'missed',
            doneHours: 0
          });
        } else {
          const hoursApplied = Math.min(session.plannedHours, remainingToDistribute);
          remainingToDistribute -= hoursApplied;
          keptSessions.push({
            ...session,
            doneHours: hoursApplied,
            status: hoursApplied >= session.plannedHours ? 'done' : 'partial'
          });
        }
      }
      effectiveStartDate = addDays(fromDate, 1);
    }

    // Compute actual done hours per topic from kept sessions
    const topicDoneMap = {};
    for (const session of keptSessions) {
      if (session.topicId && session.topicId !== 'revision' && (session.doneHours > 0 || session.status === 'done')) {
        const hours = session.doneHours > 0 ? session.doneHours : session.plannedHours;
        topicDoneMap[session.topicId] = (topicDoneMap[session.topicId] || 0) + hours;
      }
    }

    // Update subjects with calculated hoursDone
    const updatedSubjects = subjects.map(s => ({
      ...s,
      topics: (s.topics || []).map(t => {
        const calculatedDone = topicDoneMap[t.id] !== undefined ? topicDoneMap[t.id] : (t.hoursDone || 0);
        return {
          ...t,
          hoursDone: Math.min(t.estimatedHours, calculatedDone)
        };
      })
    }));

    // Generate new future sessions
    const newFutureSessions = generatePlan({
      subjects: updatedSubjects,
      settings,
      startDate: effectiveStartDate
    });

    // Merge and sort
    const allSessions = [...keptSessions, ...newFutureSessions].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.id.localeCompare(b.id);
    });

    const warning = calculateWorkloadWarning({
      subjects: updatedSubjects,
      settings,
      startDate: effectiveStartDate
    });

    const diffSummary = buildDiffSummary({
      discardedSessions: futureDiscardedSessions,
      newSessions: newFutureSessions,
      subjects: updatedSubjects,
      missedToday,
      completedHoursToday
    });

    return {
      newSessions: allSessions,
      updatedSubjects,
      warning,
      diffSummary
    };
  }

  function buildDiffSummary({ discardedSessions, newSessions, subjects, missedToday, completedHoursToday }) {
    const subjectMap = {};
    for (const s of (subjects || [])) {
      subjectMap[s.id] = s.name;
    }

    if (missedToday) {
      const movedHours = discardedSessions.reduce((acc, s) => acc + (s.plannedHours || 0), 0);
      return `Marked today as missed. Rescheduled ${Math.round(movedHours * 10) / 10}h across upcoming study days.`;
    }

    if (completedHoursToday !== null) {
      return `Logged ${completedHoursToday}h today. Remaining topics re-balanced across future days.`;
    }

    const totalNewHours = newSessions.reduce((acc, s) => acc + (s.plannedHours || 0), 0);
    const subjectsInvolved = [...new Set(newSessions.map(s => subjectMap[s.subjectId] || 'topics'))].slice(0, 2);
    const names = subjectsInvolved.join(' & ');

    if (totalNewHours === 0) {
      return 'All topics are completed! Plan is up to date.';
    }

    return `Adaptive re-plan complete: redistributed ${Math.round(totalNewHours * 10) / 10}h (${names || 'all subjects'}).`;
  }

  // ==========================================
  // PROGRESS & READINESS METRICS
  // ==========================================

  function calculateSubjectReadiness(subject) {
    if (!subject || !subject.topics || subject.topics.length === 0) return 0;

    let totalWeighted = 0;
    let doneWeighted = 0;

    for (const topic of subject.topics) {
      const diff = Math.max(1, Math.min(5, Number(topic.difficulty) || 3));
      const est = Math.max(0, Number(topic.estimatedHours) || 0);
      const done = Math.max(0, Math.min(est, Number(topic.hoursDone) || 0));

      totalWeighted += est * diff;
      doneWeighted += done * diff;
    }

    if (totalWeighted === 0) return 100;
    return Math.min(100, Math.round((doneWeighted / totalWeighted) * 100));
  }

  function calculateOverallReadiness(subjects) {
    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) return 0;
    let totalWeighted = 0;
    let doneWeighted = 0;

    for (const subject of subjects) {
      for (const topic of (subject.topics || [])) {
        const diff = Math.max(1, Math.min(5, Number(topic.difficulty) || 3));
        const est = Math.max(0, Number(topic.estimatedHours) || 0);
        const done = Math.max(0, Math.min(est, Number(topic.hoursDone) || 0));

        totalWeighted += est * diff;
        doneWeighted += done * diff;
      }
    }

    if (totalWeighted === 0) return 100;
    return Math.min(100, Math.round((doneWeighted / totalWeighted) * 100));
  }

  // Package export
  const CatchupPlanner = {
    formatDate,
    parseDate,
    addDays,
    daysBetween,
    getDayOfWeek,
    isStudyDay,
    calculateUrgencyBoost,
    calculateTopicWeight,
    getRemainingHours,
    calculateWorkloadWarning,
    generatePlan,
    replan,
    calculateSubjectReadiness,
    calculateOverallReadiness
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CatchupPlanner;
  }
  if (typeof global !== 'undefined') {
    global.CatchupPlanner = CatchupPlanner;
  }
})(typeof window !== 'undefined' ? window : globalThis);
