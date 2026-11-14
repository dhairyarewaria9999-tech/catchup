/**
 * Catchup - Storage Module
 * Manages local persistence, demo data generation, and study history logs.
 * Supports both browser direct file execution (file://) and module environments.
 */

(function(global) {
  'use strict';

  const STORAGE_KEYS = {
    SUBJECTS: 'catchup_subjects_v1',
    SETTINGS: 'catchup_settings_v1',
    SESSIONS: 'catchup_sessions_v1',
    STUDY_LOGS: 'catchup_logs_v1',
    THEME: 'catchup_theme_v1'
  };

  const DEFAULT_SETTINGS = {
    dailyHours: 3,
    studyDays: [1, 2, 3, 4, 5, 6, 0],
    pomodoroWorkMin: 25,
    pomodoroBreakMin: 5
  };

  function getPlanner() {
    if (typeof global.CatchupPlanner !== 'undefined') {
      return global.CatchupPlanner;
    }
    if (typeof require !== 'undefined') {
      return require('./planner.js');
    }
    throw new Error('CatchupPlanner not loaded');
  }

  function loadSubjects() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Failed to load subjects from localStorage:', e);
      return null;
    }
  }

  function saveSubjects(subjects) {
    try {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    } catch (e) {
      console.error('Failed to save subjects to localStorage:', e);
    }
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.error('Failed to load settings:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Failed to load sessions:', e);
      return null;
    }
  }

  function saveSessions(sessions) {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save sessions:', e);
    }
  }

  function loadStudyLogs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STUDY_LOGS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Failed to load study logs:', e);
      return {};
    }
  }

  function saveStudyLogs(logs) {
    try {
      localStorage.setItem(STORAGE_KEYS.STUDY_LOGS, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save study logs:', e);
    }
  }

  function recordStudyLog(dateStr, hours) {
    const logs = loadStudyLogs();
    logs[dateStr] = Math.round(((logs[dateStr] || 0) + hours) * 10) / 10;
    saveStudyLogs(logs);
  }

  function loadTheme() {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME) || 'system';
    } catch {
      return 'system';
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {
      console.error('Failed to save theme:', e);
    }
  }

  function generateDemoData(baseDateStr) {
    const planner = getPlanner();
    const todayStr = baseDateStr || planner.formatDate(new Date());

    const subjects = [
      {
        id: 'sub-calc',
        name: 'Calculus & Linear Algebra',
        color: '#6366f1',
        examDate: planner.addDays(todayStr, 5),
        topics: [
          { id: 't-calc-1', name: 'Eigenvalues & Diagonalization', difficulty: 4, estimatedHours: 3.5, hoursDone: 1.5 },
          { id: 't-calc-2', name: 'Multivariable Optimization & Lagrange', difficulty: 5, estimatedHours: 4.0, hoursDone: 0 },
          { id: 't-calc-3', name: 'Vector Fields & Stokes Theorem', difficulty: 4, estimatedHours: 3.0, hoursDone: 0 }
        ]
      },
      {
        id: 'sub-os',
        name: 'Operating Systems & Concurrency',
        color: '#10b981',
        examDate: planner.addDays(todayStr, 9),
        topics: [
          { id: 't-os-1', name: 'Virtual Memory & Page Replacement', difficulty: 3, estimatedHours: 3.0, hoursDone: 1.5 },
          { id: 't-os-2', name: 'Deadlock Detection & Semaphores', difficulty: 4, estimatedHours: 3.5, hoursDone: 0.5 },
          { id: 't-os-3', name: 'File Systems & Inode Layouts', difficulty: 2, estimatedHours: 2.5, hoursDone: 0 },
          { id: 't-os-4', name: 'Raft Consensus & Distributed Basics', difficulty: 5, estimatedHours: 4.0, hoursDone: 0 }
        ]
      },
      {
        id: 'sub-ml',
        name: 'Machine Learning & Deep Networks',
        color: '#f59e0b',
        examDate: planner.addDays(todayStr, 14),
        topics: [
          { id: 't-ml-1', name: 'Backprop & Optimization Dynamics', difficulty: 3, estimatedHours: 3.0, hoursDone: 2.0 },
          { id: 't-ml-2', name: 'Self-Attention & Transformer Blocks', difficulty: 5, estimatedHours: 4.5, hoursDone: 0 },
          { id: 't-ml-3', name: 'Regularization, Dropout & Batch Norm', difficulty: 2, estimatedHours: 2.0, hoursDone: 0 },
          { id: 't-ml-4', name: 'Model Evaluation & ROC-AUC Curves', difficulty: 2, estimatedHours: 2.0, hoursDone: 0 }
        ]
      }
    ];

    const settings = {
      ...DEFAULT_SETTINGS,
      dailyHours: 3,
      studyDays: [1, 2, 3, 4, 5, 6, 0]
    };

    const studyLogs = {};
    for (let i = 35; i >= 1; i--) {
      const pastDate = planner.addDays(todayStr, -i);
      const dayOfWeek = (new Date(pastDate)).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const random = (Math.sin(i * 997) + 1) / 2;

      if (random > 0.3) {
        const hours = isWeekend ? (random > 0.6 ? 2.0 : 1.0) : (random > 0.7 ? 3.5 : random > 0.5 ? 2.5 : 1.5);
        studyLogs[pastDate] = hours;
      }
    }

    const sessions = planner.generatePlan({
      subjects,
      settings,
      startDate: todayStr
    });

    saveSubjects(subjects);
    saveSettings(settings);
    saveSessions(sessions);
    saveStudyLogs(studyLogs);

    return { subjects, settings, sessions, studyLogs };
  }

  function clearAllData() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  }

  const CatchupStorage = {
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    loadSubjects,
    saveSubjects,
    loadSettings,
    saveSettings,
    loadSessions,
    saveSessions,
    loadStudyLogs,
    saveStudyLogs,
    recordStudyLog,
    loadTheme,
    saveTheme,
    generateDemoData,
    clearAllData
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CatchupStorage;
  }
  if (typeof global !== 'undefined') {
    global.CatchupStorage = CatchupStorage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
