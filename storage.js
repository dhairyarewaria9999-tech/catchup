/**
 * Catchup - Storage Module
 * Manages local persistence, data sanitization, migrations, and demo data.
 * Supports both browser direct file execution (file://) and module environments.
 */

(function(global) {
  'use strict';

  const STORAGE_KEYS = {
    SCHEMA_VERSION: 'catchup_schema_version',
    SUBJECTS: 'catchup_subjects_v2',
    SETTINGS: 'catchup_settings_v2',
    SESSIONS: 'catchup_sessions_v2',
    STUDY_LOGS: 'catchup_logs_v2',
    THEME: 'catchup_theme_v2'
  };

  const CURRENT_SCHEMA_VERSION = 2;

  const DEFAULT_SETTINGS = {
    dailyHours: 3,
    studyDays: [1, 2, 3, 4, 5, 6, 0], // Monday through Sunday
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

  // ==========================================
  // SCHEMA MIGRATION & SANITIZATION
  // ==========================================

  function getLocalStorage() {
    if (typeof localStorage !== 'undefined') return localStorage;
    // Memory fallback for headless Node.js unit testing
    if (!global._memStorage) {
      global._memStorage = {
        _data: {},
        getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; },
        clear() { this._data = {}; }
      };
    }
    return global._memStorage;
  }

  function migrateIfNeeded() {
    try {
      const storage = getLocalStorage();
      const v = parseInt(storage.getItem(STORAGE_KEYS.SCHEMA_VERSION), 10) || 1;
      if (v < 2) {
        const oldSubjects = storage.getItem('catchup_subjects_v1');
        if (oldSubjects && !storage.getItem(STORAGE_KEYS.SUBJECTS)) {
          storage.setItem(STORAGE_KEYS.SUBJECTS, oldSubjects);
        }
        const oldSettings = storage.getItem('catchup_settings_v1');
        if (oldSettings && !storage.getItem(STORAGE_KEYS.SETTINGS)) {
          storage.setItem(STORAGE_KEYS.SETTINGS, oldSettings);
        }
        const oldSessions = storage.getItem('catchup_sessions_v1');
        if (oldSessions && !storage.getItem(STORAGE_KEYS.SESSIONS)) {
          storage.setItem(STORAGE_KEYS.SESSIONS, oldSessions);
        }
        const oldLogs = storage.getItem('catchup_logs_v1');
        if (oldLogs && !storage.getItem(STORAGE_KEYS.STUDY_LOGS)) {
          storage.setItem(STORAGE_KEYS.STUDY_LOGS, oldLogs);
        }
        storage.setItem(STORAGE_KEYS.SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
      }
    } catch (e) {
      console.warn('Migration check failed:', e);
    }
  }

  migrateIfNeeded();

  /**
   * Deeply sanitizes subjects array to guarantee valid types and prevent runtime crashes.
   */
  function sanitizeSubjects(rawSubjects) {
    if (!Array.isArray(rawSubjects)) return null;
    return rawSubjects.filter(s => s && typeof s === 'object').map(s => ({
      id: String(s.id || `sub-${Date.now()}`),
      name: String(s.name || 'Untitled Subject').trim(),
      color: String(s.color || '#6366f1'),
      examDate: String(s.examDate || ''),
      topics: Array.isArray(s.topics) ? s.topics.filter(t => t && typeof t === 'object').map(t => ({
        id: String(t.id || `t-${Date.now()}`),
        name: String(t.name || 'Untitled Topic').trim(),
        difficulty: Math.max(1, Math.min(5, parseInt(t.difficulty, 10) || 3)),
        estimatedHours: Math.max(0.5, Math.min(100, parseFloat(t.estimatedHours) || 2)),
        hoursDone: Math.max(0, Math.min(parseFloat(t.estimatedHours) || 2, parseFloat(t.hoursDone) || 0))
      })) : []
    }));
  }

  // ==========================================
  // ACCESSORS WITH TRY-CATCH & RECOVERY
  // ==========================================

  function loadSubjects() {
    try {
      const raw = getLocalStorage().getItem(STORAGE_KEYS.SUBJECTS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return sanitizeSubjects(parsed);
    } catch (e) {
      console.error('Failed to parse subjects from localStorage:', e);
      return null;
    }
  }

  function saveSubjects(subjects) {
    try {
      const sanitized = sanitizeSubjects(subjects) || [];
      getLocalStorage().setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Failed to save subjects to localStorage:', e);
    }
  }

  function loadSettings() {
    try {
      const raw = getLocalStorage().getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        dailyHours: Math.max(0.5, Math.min(16, parseFloat(parsed.dailyHours) || DEFAULT_SETTINGS.dailyHours)),
        studyDays: Array.isArray(parsed.studyDays) && parsed.studyDays.length > 0 ? parsed.studyDays : DEFAULT_SETTINGS.studyDays,
        pomodoroWorkMin: parseInt(parsed.pomodoroWorkMin, 10) || DEFAULT_SETTINGS.pomodoroWorkMin,
        pomodoroBreakMin: parseInt(parsed.pomodoroBreakMin, 10) || DEFAULT_SETTINGS.pomodoroBreakMin
      };
    } catch (e) {
      console.error('Failed to load settings:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    try {
      getLocalStorage().setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  function loadSessions() {
    try {
      const raw = getLocalStorage().getItem(STORAGE_KEYS.SESSIONS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed.filter(s => s && s.id && s.date);
    } catch (e) {
      console.error('Failed to load sessions:', e);
      return null;
    }
  }

  function saveSessions(sessions) {
    try {
      getLocalStorage().setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions || []));
    } catch (e) {
      console.error('Failed to save sessions:', e);
    }
  }

  function loadStudyLogs() {
    try {
      const raw = getLocalStorage().getItem(STORAGE_KEYS.STUDY_LOGS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Failed to load study logs:', e);
      return {};
    }
  }

  function saveStudyLogs(logs) {
    try {
      getLocalStorage().setItem(STORAGE_KEYS.STUDY_LOGS, JSON.stringify(logs || {}));
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
      return getLocalStorage().getItem(STORAGE_KEYS.THEME) || 'system';
    } catch {
      return 'system';
    }
  }

  function saveTheme(theme) {
    try {
      getLocalStorage().setItem(STORAGE_KEYS.THEME, theme);
    } catch (e) {
      console.error('Failed to save theme:', e);
    }
  }

  // ==========================================
  // IDEMPOTENT DEMO DATA GENERATOR
  // ==========================================

  /**
   * Generates deterministic demo data so clicking "Load demo data" multiple times
   * produces the exact same predictable schedule without random drift or duplicate keys.
   */
  function generateDemoData(baseDateStr) {
    const planner = getPlanner();
    const todayStr = baseDateStr || planner.formatDate(new Date());

    const subjects = [
      {
        id: 'demo-sub-calc',
        name: 'Calculus & Linear Algebra',
        color: '#6366f1', // Indigo
        examDate: planner.addDays(todayStr, 5), // 5 days away
        topics: [
          { id: 'demo-t-calc-1', name: 'Eigenvalues & Diagonalization', difficulty: 4, estimatedHours: 3.5, hoursDone: 1.5 },
          { id: 'demo-t-calc-2', name: 'Multivariable Optimization & Lagrange', difficulty: 5, estimatedHours: 4.0, hoursDone: 0 },
          { id: 'demo-t-calc-3', name: 'Vector Fields & Stokes Theorem', difficulty: 4, estimatedHours: 3.0, hoursDone: 0 }
        ]
      },
      {
        id: 'demo-sub-os',
        name: 'Operating Systems & Concurrency',
        color: '#10b981', // Emerald
        examDate: planner.addDays(todayStr, 9), // 9 days away
        topics: [
          { id: 'demo-t-os-1', name: 'Virtual Memory & Page Replacement', difficulty: 3, estimatedHours: 3.0, hoursDone: 1.5 },
          { id: 'demo-t-os-2', name: 'Deadlock Detection & Semaphores', difficulty: 4, estimatedHours: 3.5, hoursDone: 0.5 },
          { id: 'demo-t-os-3', name: 'File Systems & Inode Layouts', difficulty: 2, estimatedHours: 2.5, hoursDone: 0 },
          { id: 'demo-t-os-4', name: 'Raft Consensus & Distributed Basics', difficulty: 5, estimatedHours: 4.0, hoursDone: 0 }
        ]
      },
      {
        id: 'demo-sub-ml',
        name: 'Machine Learning & Deep Networks',
        color: '#f59e0b', // Amber
        examDate: planner.addDays(todayStr, 14), // 14 days away
        topics: [
          { id: 'demo-t-ml-1', name: 'Backprop & Optimization Dynamics', difficulty: 3, estimatedHours: 3.0, hoursDone: 2.0 },
          { id: 'demo-t-ml-2', name: 'Self-Attention & Transformer Blocks', difficulty: 5, estimatedHours: 4.5, hoursDone: 0 },
          { id: 'demo-t-ml-3', name: 'Regularization, Dropout & Batch Norm', difficulty: 2, estimatedHours: 2.0, hoursDone: 0 },
          { id: 'demo-t-ml-4', name: 'Model Evaluation & ROC-AUC Curves', difficulty: 2, estimatedHours: 2.0, hoursDone: 0 }
        ]
      }
    ];

    const settings = {
      ...DEFAULT_SETTINGS,
      dailyHours: 3,
      studyDays: [1, 2, 3, 4, 5, 6, 0]
    };

    // Deterministic study activity heatmap history for past 35 days
    const studyLogs = {};
    const deterministicPattern = [2.0, 3.5, 0, 1.5, 3.0, 2.5, 0, 3.0, 4.0, 2.0, 0, 3.5, 2.5, 1.0];
    for (let i = 35; i >= 1; i--) {
      const pastDate = planner.addDays(todayStr, -i);
      const val = deterministicPattern[i % deterministicPattern.length];
      if (val > 0) {
        studyLogs[pastDate] = val;
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

  /**
   * Resets all user study data cleanly.
   */
  function resetAllData() {
    try {
      const storage = getLocalStorage();
      storage.removeItem(STORAGE_KEYS.SUBJECTS);
      storage.removeItem(STORAGE_KEYS.SETTINGS);
      storage.removeItem(STORAGE_KEYS.SESSIONS);
      storage.removeItem(STORAGE_KEYS.STUDY_LOGS);
      // Retain theme preference across resets
    } catch (e) {
      console.error('Failed to reset data:', e);
    }
  }

  const CatchupStorage = {
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    sanitizeSubjects,
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
    resetAllData
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CatchupStorage;
  }
  if (typeof global !== 'undefined') {
    global.CatchupStorage = CatchupStorage;
  }
})(typeof window !== 'undefined' ? window : globalThis);
