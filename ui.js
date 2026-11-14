/**
 * Catchup - UI Rendering & Component Controller
 * Modern view rendering, timestamp-accurate Pomodoro timer, accessible modal dialogs,
 * micro-interactions, audio chimes, and adaptive plan visualization.
 * Supports both browser direct file execution (file://) and module environments.
 */

(function(global) {
  'use strict';

  function getPlanner() {
    if (typeof global.CatchupPlanner !== 'undefined') return global.CatchupPlanner;
    if (typeof require !== 'undefined') return require('./planner.js');
    throw new Error('CatchupPlanner not loaded');
  }

  function getStorage() {
    if (typeof global.CatchupStorage !== 'undefined') return global.CatchupStorage;
    if (typeof require !== 'undefined') return require('./storage.js');
    throw new Error('CatchupStorage not loaded');
  }

  // ==========================================
  // WEB AUDIO SOUND CHIME (Zero external dependencies)
  // ==========================================
  let audioCtx = null;

  function playChime() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const now = audioCtx.currentTime;
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      // Soft harmonic chime
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.exponentialRampToValueAtTime(987.77, now + 0.15); // B5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(329.63, now); // E4

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch (err) {
      console.warn('Audio chime playback failed:', err);
    }
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    let icon = 'ℹ️';
    if (type === 'success') icon = '✨';
    if (type === 'warning') icon = '⚡';
    if (type === 'danger') icon = '⚠️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close-btn" aria-label="Close notification">✕</button>
    `;

    toast.querySelector('.toast-close-btn').addEventListener('click', () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================
  // FOCUS TRAP FOR ACCESSIBLE MODALS
  // ==========================================
  let lastFocusedElement = null;

  function trapFocus(modalEl) {
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modalEl.querySelectorAll(focusableSelectors);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    modalEl._focusKeydownHandler = function(e) {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      } else if (e.key === 'Escape') {
        closeModal(modalEl);
      }
    };

    modalEl.addEventListener('keydown', modalEl._focusKeydownHandler);
    setTimeout(() => firstElement.focus(), 50);
  }

  function openModal(modalEl, triggerBtn = null) {
    if (!modalEl) return;
    lastFocusedElement = triggerBtn || document.activeElement;
    modalEl.classList.add('open');
    modalEl.setAttribute('aria-hidden', 'false');
    trapFocus(modalEl);
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    modalEl.setAttribute('aria-hidden', 'true');
    if (modalEl._focusKeydownHandler) {
      modalEl.removeEventListener('keydown', modalEl._focusKeydownHandler);
      modalEl._focusKeydownHandler = null;
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  // Inline Validation Helpers
  function setFieldError(fieldId, errorMsg) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    const inputEl = document.getElementById(fieldId);
    if (errorEl) {
      errorEl.textContent = errorMsg || '';
      errorEl.style.display = errorMsg ? 'block' : 'none';
    }
    if (inputEl) {
      if (errorMsg) {
        inputEl.classList.add('input-invalid');
        inputEl.setAttribute('aria-invalid', 'true');
      } else {
        inputEl.classList.remove('input-invalid');
        inputEl.removeAttribute('aria-invalid');
      }
    }
  }

  function clearFieldErrors(formEl) {
    formEl.querySelectorAll('.form-error-msg').forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });
    formEl.querySelectorAll('.input-invalid').forEach(el => {
      el.classList.remove('input-invalid');
      el.removeAttribute('aria-invalid');
    });
  }

  // ==========================================
  // UI CONTROLLER CLASS
  // ==========================================
  class UIController {
    constructor() {
      const planner = getPlanner();
      this.currentTab = 'today';
      this.todayStr = planner.formatDate(new Date());

      // Timestamp-accurate Pomodoro Timer State (prevents drift)
      this.timerMode = 'work'; // 'work' or 'break'
      this.timerDurationMs = 25 * 60 * 1000;
      this.timerRemainingMs = 25 * 60 * 1000;
      this.timerEndTime = null;
      this.timerInterval = null;
      this.isTimerRunning = false;

      this.subjectColorMap = {};
    }

    init() {
      this.loadStateAndCache();
      this.setupGlobalEvents();
      this.setupPomodoro();
      this.renderActiveTab();
      this.checkWorkloadBanner();
    }

    loadStateAndCache() {
      const storage = getStorage();
      let subjects = storage.loadSubjects();
      if (!subjects || subjects.length === 0) {
        const demo = storage.generateDemoData(this.todayStr);
        subjects = demo.subjects;
      }

      this.subjectColorMap = {};
      for (const s of (subjects || [])) {
        this.subjectColorMap[s.id] = s.color || '#6366f1';
      }
    }

    setupGlobalEvents() {
      const storage = getStorage();

      // Tab Switching
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.switchTab(btn.dataset.tab);
        });
      });

      // Theme Toggle
      const themeBtn = document.getElementById('theme-toggle-btn');
      if (themeBtn) {
        themeBtn.addEventListener('click', () => this.toggleTheme());
      }

      // Idempotent Demo Data
      document.querySelectorAll('.btn-load-demo').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Load sample study data? This will load a realistic 3-subject study schedule with exams in 5, 9, and 14 days.')) {
            storage.generateDemoData(this.todayStr);
            this.loadStateAndCache();
            this.checkWorkloadBanner();
            this.renderActiveTab(true);
            showToast('Sample data loaded! Exams scheduled in 5, 9, and 14 days.', 'success');
          }
        });
      });

      // Reset All Data Button
      const resetBtn = document.getElementById('btn-reset-data');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          const resetModal = document.getElementById('reset-modal');
          if (resetModal) {
            openModal(resetModal, resetBtn);
          }
        });
      }

      const confirmResetBtn = document.getElementById('btn-confirm-reset');
      if (confirmResetBtn) {
        confirmResetBtn.addEventListener('click', () => {
          storage.resetAllData();
          storage.saveSubjects([]);
          storage.saveSessions([]);
          storage.saveStudyLogs({});
          const resetModal = document.getElementById('reset-modal');
          if (resetModal) closeModal(resetModal);
          this.loadStateAndCache();
          this.checkWorkloadBanner();
          this.renderActiveTab();
          showToast('All study data has been reset.', 'info');
        });
      }

      // Settings: Daily Hours input validation & debounced auto-replan
      const dailyHoursInput = document.getElementById('setting-daily-hours');
      if (dailyHoursInput) {
        dailyHoursInput.addEventListener('change', (e) => {
          const val = parseFloat(e.target.value);
          if (isNaN(val) || val < 0.5 || val > 16) {
            setFieldError('setting-daily-hours', 'Daily study hours must be between 0.5 and 16 hours.');
            return;
          }
          setFieldError('setting-daily-hours', '');
          const settings = storage.loadSettings();
          settings.dailyHours = val;
          storage.saveSettings(settings);
          this.triggerAutoReplan(`Updated daily study budget to ${val}h`);
        });
      }

      // Settings: Study days toggle buttons
      document.querySelectorAll('.day-checkbox-label').forEach(label => {
        label.addEventListener('click', (e) => {
          e.preventDefault();
          const dayVal = parseInt(label.dataset.day, 10);
          const settings = storage.loadSettings();
          let days = settings.studyDays || [1, 2, 3, 4, 5, 6, 0];

          if (days.includes(dayVal)) {
            if (days.length <= 1) {
              showToast('You must maintain at least one active study day per week!', 'warning');
              return;
            }
            days = days.filter(d => d !== dayVal);
            label.classList.remove('active');
          } else {
            days.push(dayVal);
            label.classList.add('active');
          }

          settings.studyDays = days;
          storage.saveSettings(settings);
          this.triggerAutoReplan('Adjusted weekly study schedule');
        });
      });

      // Today: Catchup Action Buttons
      const missedTodayBtn = document.getElementById('btn-missed-today');
      if (missedTodayBtn) {
        missedTodayBtn.addEventListener('click', () => this.handleMissedToday());
      }

      const partialHoursBtn = document.getElementById('btn-partial-hours');
      if (partialHoursBtn) {
        partialHoursBtn.addEventListener('click', (e) => this.openPartialHoursModal(e.currentTarget));
      }

      // Generic Modal Dismissals
      document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const modal = e.target.closest('.modal-overlay');
          if (modal) closeModal(modal);
        });
      });

      // Background click dismissal for modals
      document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            closeModal(modal);
          }
        });
      });
    }

    switchTab(tabId) {
      this.currentTab = tabId;
      document.querySelectorAll('.tab-btn').forEach(btn => {
        const isCurrent = btn.dataset.tab === tabId;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-content').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tabId}`);
      });
      this.renderActiveTab();
    }

    renderActiveTab(highlightShifted = false) {
      if (this.currentTab === 'setup') {
        this.renderSetupScreen();
      } else if (this.currentTab === 'today') {
        this.renderTodayScreen();
      } else if (this.currentTab === 'plan') {
        this.renderPlanScreen(highlightShifted);
      } else if (this.currentTab === 'progress') {
        this.renderProgressScreen();
      }
    }

    triggerAutoReplan(reasonMsg) {
      const planner = getPlanner();
      const storage = getStorage();
      const subjects = storage.loadSubjects() || [];
      const settings = storage.loadSettings();
      const existingSessions = storage.loadSessions() || [];

      const result = planner.replan({
        fromDate: this.todayStr,
        subjects,
        settings,
        existingSessions
      });

      storage.saveSessions(result.newSessions);
      storage.saveSubjects(result.updatedSubjects);

      showToast(reasonMsg || result.diffSummary, 'info');
      this.checkWorkloadBanner(result.warning);
      this.renderActiveTab(true);
    }

    handleMissedToday() {
      if (!confirm('Mark all remaining study sessions today as missed and reschedule them across upcoming days?')) {
        return;
      }

      const planner = getPlanner();
      const storage = getStorage();
      const subjects = storage.loadSubjects() || [];
      const settings = storage.loadSettings();
      const existingSessions = storage.loadSessions() || [];

      const result = planner.replan({
        fromDate: this.todayStr,
        subjects,
        settings,
        existingSessions,
        missedToday: true
      });

      storage.saveSessions(result.newSessions);
      storage.saveSubjects(result.updatedSubjects);

      showToast(result.diffSummary, 'warning');
      this.checkWorkloadBanner(result.warning);
      this.renderActiveTab(true);
    }

    openPartialHoursModal(triggerBtn) {
      const modal = document.getElementById('partial-hours-modal');
      if (!modal) return;

      const planner = getPlanner();
      const storage = getStorage();
      const input = document.getElementById('partial-hours-input');
      const settings = storage.loadSettings();
      input.value = Math.max(0.5, Math.round((settings.dailyHours / 2) * 2) / 2);
      setFieldError('partial-hours-input', '');

      openModal(modal, triggerBtn);

      const confirmBtn = document.getElementById('btn-confirm-partial');
      confirmBtn.onclick = () => {
        const hoursDone = parseFloat(input.value);
        if (isNaN(hoursDone) || hoursDone < 0 || hoursDone > 24) {
          setFieldError('partial-hours-input', 'Please enter a valid study duration between 0 and 24 hours.');
          return;
        }

        closeModal(modal);

        const subjects = storage.loadSubjects() || [];
        const existingSessions = storage.loadSessions() || [];

        if (hoursDone > 0) {
          storage.recordStudyLog(this.todayStr, hoursDone);
        }

        const result = planner.replan({
          fromDate: this.todayStr,
          subjects,
          settings,
          existingSessions,
          completedHoursToday: hoursDone
        });

        storage.saveSessions(result.newSessions);
        storage.saveSubjects(result.updatedSubjects);

        showToast(result.diffSummary, 'success');
        this.checkWorkloadBanner(result.warning);
        this.renderActiveTab(true);
      };
    }

    checkWorkloadBanner(customWarning) {
      const banner = document.getElementById('workload-warning-banner');
      if (!banner) return;

      const planner = getPlanner();
      const storage = getStorage();
      const subjects = storage.loadSubjects() || [];
      const settings = storage.loadSettings();
      const warning = customWarning || planner.calculateWorkloadWarning({
        subjects,
        settings,
        startDate: this.todayStr
      });

      if (warning && warning.hasWarning) {
        banner.style.display = 'flex';
        const textEl = banner.querySelector('.warning-text');
        const subjectDetail = warning.subjectWarnings.length > 0
          ? `(${warning.subjectWarnings.map(w => `${escapeHtml(w.subjectName)}: +${w.extraPerDayNeeded}h/day`).join(', ')})`
          : '';

        textEl.innerHTML = `
          <h4>Workload Alert: ${warning.shortfallHours}h deficit detected before exams</h4>
          <p>Your current daily study hours are insufficient. Add <strong>+${warning.extraHoursPerDayNeeded} hours/day</strong> ${subjectDetail} to cover all topics.</p>
        `;
      } else {
        banner.style.display = 'none';
      }
    }

    // ==========================================
    // SCREEN 1: SETUP
    // ==========================================
    renderSetupScreen() {
      const container = document.getElementById('subjects-list-container');
      if (!container) return;

      const planner = getPlanner();
      const storage = getStorage();
      const subjects = storage.loadSubjects() || [];
      const settings = storage.loadSettings();

      const dailyHoursInput = document.getElementById('setting-daily-hours');
      if (dailyHoursInput) dailyHoursInput.value = settings.dailyHours;

      const activeDays = settings.studyDays || [1, 2, 3, 4, 5, 6, 0];
      document.querySelectorAll('.day-checkbox-label').forEach(label => {
        const dayVal = parseInt(label.dataset.day, 10);
        label.classList.toggle('active', activeDays.includes(dayVal));
      });

      if (subjects.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📚</div>
            <h3>No subjects added yet</h3>
            <p>Get started quickly by loading demo data or add your subjects, topics, and exam dates manually.</p>
            <button class="btn btn-primary btn-load-demo">⚡ Load Demo Data</button>
          </div>
        `;
        container.querySelector('.btn-load-demo')?.addEventListener('click', () => {
          storage.generateDemoData(this.todayStr);
          this.loadStateAndCache();
          this.renderSetupScreen();
          showToast('Demo data loaded successfully!', 'success');
        });
        return;
      }

      container.innerHTML = '';

      subjects.forEach(subject => {
        const daysLeft = planner.daysBetween(this.todayStr, subject.examDate);
        const isUrgent = daysLeft <= 4;
        const card = document.createElement('div');
        card.className = 'subject-item-card';

        const topicsHtml = (subject.topics || []).map(t => `
          <div class="topic-row">
            <div class="topic-info">
              <span class="difficulty-pill" title="Difficulty ${t.difficulty}/5">D${t.difficulty}</span>
              <span style="font-weight: 600;">${escapeHtml(t.name)}</span>
            </div>
            <div class="topic-hours-tag">
              <span>${t.hoursDone || 0} / ${t.estimatedHours}h</span>
              <button class="btn-icon btn-sm delete-topic-btn" data-sub-id="${subject.id}" data-topic-id="${t.id}" title="Delete Topic" aria-label="Delete topic ${escapeHtml(t.name)}" style="margin-left: 6px; width:26px; height:26px; border:none; background:transparent;">✕</button>
            </div>
          </div>
        `).join('');

        card.innerHTML = `
          <div class="subject-header-row">
            <div class="subject-title-area">
              <span class="color-dot" style="background-color: ${subject.color}"></span>
              <h4 style="font-size: 1.15rem; margin:0;">${escapeHtml(subject.name)}</h4>
              <span class="subject-exam-badge ${isUrgent ? 'urgent' : ''}">
                ${daysLeft < 0 ? 'Exam Passed' : daysLeft === 0 ? 'Exam Today!' : `${daysLeft}d to exam (${subject.examDate})`}
              </span>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-secondary btn-sm add-topic-btn" data-sub-id="${subject.id}">+ Topic</button>
              <button class="btn btn-danger btn-sm delete-subject-btn" data-sub-id="${subject.id}">Delete</button>
            </div>
          </div>
          <div class="topics-table-area">
            <div class="topics-list">
              ${topicsHtml || '<div style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0;">No topics yet. Click "+ Topic" above to add curriculum items.</div>'}
            </div>
          </div>
        `;

        card.querySelector('.add-topic-btn').addEventListener('click', (e) => {
          this.openAddTopicModal(subject.id, e.currentTarget);
        });

        card.querySelector('.delete-subject-btn').addEventListener('click', () => {
          if (confirm(`Delete subject "${subject.name}" and all its topics?`)) {
            const updated = (storage.loadSubjects() || []).filter(s => s.id !== subject.id);
            storage.saveSubjects(updated);
            this.loadStateAndCache();
            this.triggerAutoReplan(`Removed subject: ${subject.name}`);
          }
        });

        card.querySelectorAll('.delete-topic-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const subId = btn.dataset.subId;
            const topicId = btn.dataset.topicId;
            const allSubs = storage.loadSubjects() || [];
            const sObj = allSubs.find(s => s.id === subId);
            if (sObj) {
              sObj.topics = (sObj.topics || []).filter(t => t.id !== topicId);
              storage.saveSubjects(allSubs);
              this.loadStateAndCache();
              this.triggerAutoReplan('Removed topic');
            }
          });
        });

        container.appendChild(card);
      });

      const addSubjectBtn = document.getElementById('btn-add-subject');
      if (addSubjectBtn) {
        addSubjectBtn.onclick = (e) => this.openAddSubjectModal(e.currentTarget);
      }
    }

    openAddSubjectModal(triggerBtn) {
      const modal = document.getElementById('subject-modal');
      if (!modal) return;

      const planner = getPlanner();
      const storage = getStorage();

      const form = document.getElementById('subject-form');
      form.reset();
      clearFieldErrors(form);

      const dateInput = document.getElementById('subject-exam-date');
      dateInput.value = planner.addDays(this.todayStr, 7);
      dateInput.min = this.todayStr;

      openModal(modal, triggerBtn);

      form.onsubmit = (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('subject-name');
        const name = nameInput.value.trim();
        const color = document.getElementById('subject-color').value;
        const examDate = dateInput.value;

        let hasError = false;
        if (!name) {
          setFieldError('subject-name', 'Subject name is required.');
          hasError = true;
        } else if (name.length < 2) {
          setFieldError('subject-name', 'Subject name must be at least 2 characters.');
          hasError = true;
        } else {
          setFieldError('subject-name', '');
        }

        if (!examDate) {
          setFieldError('subject-exam-date', 'Exam date is required.');
          hasError = true;
        } else if (examDate < this.todayStr) {
          setFieldError('subject-exam-date', 'Exam date cannot be in the past.');
          hasError = true;
        } else {
          setFieldError('subject-exam-date', '');
        }

        if (hasError) return;

        const subjects = storage.loadSubjects() || [];
        const newSubject = {
          id: `sub-${Date.now()}`,
          name,
          color,
          examDate,
          topics: []
        };

        subjects.push(newSubject);
        storage.saveSubjects(subjects);
        closeModal(modal);
        this.loadStateAndCache();
        this.renderSetupScreen();
        showToast(`Added ${name}! Click "+ Topic" to add curriculum items.`, 'success');
      };
    }

    openAddTopicModal(subjectId, triggerBtn) {
      const modal = document.getElementById('topic-modal');
      if (!modal) return;

      const storage = getStorage();
      const form = document.getElementById('topic-form');
      form.reset();
      clearFieldErrors(form);

      openModal(modal, triggerBtn);

      form.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('topic-name').value.trim();
        const difficulty = parseInt(document.getElementById('topic-difficulty').value, 10) || 3;
        const hours = parseFloat(document.getElementById('topic-hours').value);

        let hasError = false;
        if (!name) {
          setFieldError('topic-name', 'Topic name is required.');
          hasError = true;
        } else {
          setFieldError('topic-name', '');
        }

        if (isNaN(hours) || hours < 0.5 || hours > 40) {
          setFieldError('topic-hours', 'Estimated hours must be between 0.5 and 40 hours.');
          hasError = true;
        } else {
          setFieldError('topic-hours', '');
        }

        if (hasError) return;

        const subjects = storage.loadSubjects() || [];
        const target = subjects.find(s => s.id === subjectId);
        if (target) {
          if (!target.topics) target.topics = [];
          target.topics.push({
            id: `t-${Date.now()}`,
            name,
            difficulty,
            estimatedHours: hours,
            hoursDone: 0
          });
          storage.saveSubjects(subjects);
          closeModal(modal);
          this.loadStateAndCache();
          this.triggerAutoReplan(`Added topic "${name}" to ${target.name}`);
        }
      };
    }

    // ==========================================
    // SCREEN 2: TODAY (Enhanced with Hero Card & Daily Progress)
    // ==========================================
    renderTodayScreen() {
      const listContainer = document.getElementById('today-sessions-container');
      const dateDisplay = document.getElementById('today-date-display');
      const heroContainer = document.getElementById('today-hero-container');
      const dailyProgressBar = document.getElementById('today-daily-progress-bar');
      const dailyProgressLabel = document.getElementById('today-daily-progress-label');

      if (!listContainer) return;

      const planner = getPlanner();
      const storage = getStorage();
      const subjects = storage.loadSubjects() || [];
      const sessions = storage.loadSessions() || [];
      const subjectMap = {};
      for (const s of subjects) subjectMap[s.id] = s;

      const d = planner.parseDate(this.todayStr);
      const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
      if (dateDisplay) {
        dateDisplay.textContent = d.toLocaleDateString(undefined, options);
      }

      const todaySessions = sessions.filter(s => s.date === this.todayStr);

      // Calculate Daily Hours Done vs Planned
      const totalPlannedToday = todaySessions.reduce((acc, s) => acc + (s.plannedHours || 0), 0);
      const totalDoneToday = todaySessions.reduce((acc, s) => acc + (s.doneHours || (s.status === 'done' ? s.plannedHours : 0)), 0);
      const dailyPercent = totalPlannedToday > 0 ? Math.min(100, Math.round((totalDoneToday / totalPlannedToday) * 100)) : 100;

      if (dailyProgressBar && dailyProgressLabel) {
        dailyProgressBar.style.width = `${dailyPercent}%`;
        dailyProgressLabel.textContent = `${Math.round(totalDoneToday * 10) / 10} / ${Math.round(totalPlannedToday * 10) / 10}h completed (${dailyPercent}%)`;
      }

      // Hero Card: Highlight the next uncompleted focus session
      const nextPendingSession = todaySessions.find(s => s.status !== 'done');
      if (heroContainer) {
        if (nextPendingSession) {
          const sub = subjectMap[nextPendingSession.subjectId] || { name: 'General', color: '#6366f1' };
          heroContainer.innerHTML = `
            <div class="today-hero-card" style="--hero-color: ${sub.color}">
              <div class="hero-top-row">
                <span class="hero-pill" style="color: ${sub.color}; background: rgba(99, 102, 241, 0.12);">CURRENT FOCUS</span>
                <span style="font-size: 0.85rem; color: var(--text-secondary);">⏱️ ${nextPendingSession.plannedHours}h allocated</span>
              </div>
              <h3 class="hero-title">${escapeHtml(nextPendingSession.topicName)}</h3>
              <p class="hero-sub">${escapeHtml(sub.name)} ${nextPendingSession.isRevision ? '• Final Exam Review' : ''}</p>
              <div class="hero-actions">
                <button class="btn btn-primary btn-sm hero-start-btn">🎯 Start Focus Block in Timer</button>
              </div>
            </div>
          `;
          heroContainer.querySelector('.hero-start-btn').addEventListener('click', () => {
            const startBtn = document.getElementById('pomo-start-btn');
            if (startBtn) {
              if (!this.isTimerRunning) startBtn.click();
              showToast(`Focus block started for: ${nextPendingSession.topicName}`, 'info');
            }
          });
          heroContainer.style.display = 'block';
        } else if (todaySessions.length > 0) {
          heroContainer.innerHTML = `
            <div class="today-hero-card hero-completed">
              <div class="hero-top-row">
                <span class="hero-pill" style="color: var(--accent-emerald); background: rgba(16, 185, 129, 0.15);">ALL DONE FOR TODAY! 🎉</span>
              </div>
              <h3 class="hero-title">Fantastic focus! You hit 100% of today's study goal.</h3>
              <p class="hero-sub">Take a relaxing break, or check out upcoming sessions in the Plan tab.</p>
            </div>
          `;
          heroContainer.style.display = 'block';
        } else {
          heroContainer.style.display = 'none';
        }
      }

      if (todaySessions.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🎉</div>
            <h3>You're all caught up for today!</h3>
            <p>No study sessions scheduled for today. Take a well-deserved rest day or check upcoming days in the Plan tab.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = '';

      todaySessions.forEach(session => {
        const subject = subjectMap[session.subjectId] || { name: 'General', color: '#6366f1' };
        const isDone = session.status === 'done';
        const isRevision = session.isRevision;

        const card = document.createElement('div');
        card.className = `session-card ${isDone ? 'completed' : ''}`;
        card.style.setProperty('--session-color', subject.color);

        card.innerHTML = `
          <div class="session-checkbox-wrapper">
            <button class="custom-checkbox ${isDone ? 'checked' : ''}" role="checkbox" aria-checked="${isDone}" aria-label="Mark ${escapeHtml(session.topicName)} as ${isDone ? 'incomplete' : 'done'}">
              <svg class="check-svg" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
            </button>
          </div>
          <div class="session-main-details">
            <span class="session-subject-tag">${escapeHtml(subject.name)}</span>
            <div class="session-topic-title">${escapeHtml(session.topicName)}</div>
            <div class="session-meta-tags">
              <span>⏱️ ${session.plannedHours}h planned</span>
              ${isRevision ? '<span class="badge-revision">Light Exam Revision</span>' : ''}
              ${session.status === 'missed' ? '<span style="color:var(--accent-rose);font-weight:700;">Missed</span>' : ''}
            </div>
          </div>
        `;

        const checkbox = card.querySelector('.custom-checkbox');
        const toggleDone = () => {
          const newDone = !isDone;
          session.status = newDone ? 'done' : 'planned';
          session.doneHours = newDone ? session.plannedHours : 0;

          if (newDone) {
            storage.recordStudyLog(this.todayStr, session.plannedHours);
            playChime();
          }

          if (session.topicId && session.topicId !== 'revision') {
            const subObj = subjects.find(s => s.id === session.subjectId);
            if (subObj) {
              const topic = (subObj.topics || []).find(t => t.id === session.topicId);
              if (topic) {
                topic.hoursDone = newDone
                  ? Math.min(topic.estimatedHours, (topic.hoursDone || 0) + session.plannedHours)
                  : Math.max(0, (topic.hoursDone || 0) - session.plannedHours);
                storage.saveSubjects(subjects);
              }
            }
          }

          storage.saveSessions(sessions);
          this.renderTodayScreen();
          this.checkWorkloadBanner();
          showToast(newDone ? `Completed: ${session.topicName}! 🎯` : 'Session unmarked', 'info');
        };

        checkbox.addEventListener('click', toggleDone);

        listContainer.appendChild(card);
      });
    }

    // ==========================================
    // POMODORO TIMER (Timestamp-accurate: No drift)
    // ==========================================
    setupPomodoro() {
      const storage = getStorage();
      const timeDisplay = document.getElementById('pomo-time-display');
      const startPauseBtn = document.getElementById('pomo-start-btn');
      const resetBtn = document.getElementById('pomo-reset-btn');
      const workModeBtn = document.getElementById('pomo-mode-work');
      const breakModeBtn = document.getElementById('pomo-mode-break');
      const progressCircle = document.getElementById('pomo-progress-circle');

      if (!timeDisplay || !startPauseBtn) return;

      const CIRCUMFERENCE = 2 * Math.PI * 90;
      if (progressCircle) {
        progressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
        progressCircle.style.strokeDashoffset = '0';
      }

      const updateDisplay = () => {
        const totalSecondsLeft = Math.ceil(this.timerRemainingMs / 1000);
        const mins = Math.floor(totalSecondsLeft / 60);
        const secs = totalSecondsLeft % 60;
        timeDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        if (progressCircle) {
          const fraction = 1 - (this.timerRemainingMs / this.timerDurationMs);
          const offset = CIRCUMFERENCE * Math.max(0, Math.min(1, fraction));
          progressCircle.style.strokeDashoffset = String(offset);
        }
      };

      const setMode = (mode) => {
        this.timerMode = mode;
        const settings = storage.loadSettings();
        const mins = mode === 'work' ? (settings.pomodoroWorkMin || 25) : (settings.pomodoroBreakMin || 5);
        this.timerDurationMs = mins * 60 * 1000;
        this.timerRemainingMs = this.timerDurationMs;
        this.pauseTimer();

        if (workModeBtn && breakModeBtn) {
          workModeBtn.classList.toggle('active', mode === 'work');
          breakModeBtn.classList.toggle('active', mode === 'break');
        }
        if (progressCircle) {
          progressCircle.classList.toggle('break', mode === 'break');
        }

        updateDisplay();
      };

      workModeBtn?.addEventListener('click', () => setMode('work'));
      breakModeBtn?.addEventListener('click', () => setMode('break'));

      startPauseBtn.addEventListener('click', () => {
        if (this.isTimerRunning) {
          this.pauseTimer();
        } else {
          this.startTimer(updateDisplay);
        }
      });

      resetBtn?.addEventListener('click', () => {
        this.pauseTimer();
        this.timerRemainingMs = this.timerDurationMs;
        updateDisplay();
      });

      updateDisplay();
    }

    startTimer(updateDisplay) {
      this.isTimerRunning = true;
      const startPauseBtn = document.getElementById('pomo-start-btn');
      if (startPauseBtn) startPauseBtn.textContent = 'Pause';

      // Timestamp-based calculation: Immune to browser background throttling
      this.timerEndTime = Date.now() + this.timerRemainingMs;

      this.timerInterval = setInterval(() => {
        const now = Date.now();
        this.timerRemainingMs = Math.max(0, this.timerEndTime - now);

        if (this.timerRemainingMs <= 0) {
          this.pauseTimer();
          this.timerRemainingMs = 0;
          updateDisplay();
          playChime();
          showToast(
            this.timerMode === 'work'
              ? 'Pomodoro focus complete! Great job. Time for a 5-min break.'
              : 'Break time is over! Ready to focus again?',
            'success',
            6000
          );
        } else {
          updateDisplay();
        }
      }, 250);
    }

    pauseTimer() {
      this.isTimerRunning = false;
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      const startPauseBtn = document.getElementById('pomo-start-btn');
      if (startPauseBtn) startPauseBtn.textContent = 'Start Focus';
    }

    // ==========================================
    // SCREEN 3: PLAN (14-day Calendar with Tooltips)
    // ==========================================
    renderPlanScreen(highlightShifted = false) {
      const grid = document.getElementById('plan-calendar-grid');
      if (!grid) return;

      const planner = getPlanner();
      const storage = getStorage();
      const subjects = storage.loadSubjects() || [];
      const settings = storage.loadSettings();
      const sessions = storage.loadSessions() || [];
      const subjectMap = {};
      for (const s of subjects) subjectMap[s.id] = s;

      grid.innerHTML = '';
      const totalDaysToShow = 14;

      for (let i = 0; i < totalDaysToShow; i++) {
        const curDateStr = planner.addDays(this.todayStr, i);
        const curDate = planner.parseDate(curDateStr);
        const isToday = curDateStr === this.todayStr;
        const isStudy = planner.isStudyDay(curDateStr, settings);

        const dayName = curDate.toLocaleDateString(undefined, { weekday: 'short' });
        const monthDay = curDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        const dayCol = document.createElement('div');
        dayCol.className = `calendar-day-col ${isToday ? 'today' : ''} ${!isStudy ? 'non-study' : ''}`;

        const daySessions = sessions.filter(s => s.date === curDateStr);

        const sessionsHtml = daySessions.map(session => {
          const subject = subjectMap[session.subjectId] || { name: 'General', color: '#6366f1' };
          let statusClass = `status-${session.status}`;
          if (session.isRevision) statusClass = 'status-revision';

          const shiftClass = highlightShifted && session.status === 'planned' ? 'replan-shifted' : '';
          const tooltipContent = `${escapeHtml(subject.name)}&#10;• Topic: ${escapeHtml(session.topicName)}&#10;• Planned: ${session.plannedHours}h${session.isRevision ? ' (Pre-Exam Revision)' : ''}&#10;• Status: ${session.status}`;

          return `
            <div class="plan-session-pill ${statusClass} ${shiftClass}" style="--session-color: ${subject.color}" title="${tooltipContent}" tabindex="0">
              <div style="font-weight: 700; font-size: 0.72rem; text-transform: uppercase; color: ${subject.color}">
                ${escapeHtml(subject.name)}
              </div>
              <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(session.topicName)}
              </div>
              <div style="color: var(--text-secondary); font-size: 0.72rem; margin-top: 2px;">
                ${session.plannedHours}h ${session.isRevision ? '• Revision' : ''}
              </div>
            </div>
          `;
        }).join('');

        dayCol.innerHTML = `
          <div class="calendar-day-header">
            <span class="day-name">${dayName} ${isToday ? '<span class="today-marker">TODAY</span>' : ''}</span>
            <span class="day-date-number">${monthDay}</span>
          </div>
          <div class="day-sessions-stack">
            ${sessionsHtml || (!isStudy ? '<span style="color:var(--text-muted);font-size:0.75rem;">Rest Day</span>' : '<span style="color:var(--text-muted);font-size:0.75rem;">No sessions</span>')}
          </div>
        `;

        grid.appendChild(dayCol);
      }
    }

    // ==========================================
    // SCREEN 4: PROGRESS (Circular Gauges & Heatmap)
    // ==========================================
    renderProgressScreen() {
      const planner = getPlanner();
      const storage = getStorage();
      const subjects = storage.loadSubjects() || [];
      const readinessContainer = document.getElementById('readiness-scores-container');
      const countdownContainer = document.getElementById('exam-countdown-container');
      const overallScoreEl = document.getElementById('overall-readiness-val');

      if (overallScoreEl) {
        overallScoreEl.textContent = `${planner.calculateOverallReadiness(subjects)}%`;
      }

      if (readinessContainer) {
        readinessContainer.innerHTML = '';
        if (subjects.length === 0) {
          readinessContainer.innerHTML = '<div style="color:var(--text-muted);padding:1rem;">No subjects to track. Add subjects in Setup!</div>';
        } else {
          subjects.forEach(subject => {
            const score = planner.calculateSubjectReadiness(subject);
            const item = document.createElement('div');
            item.className = 'readiness-item';
            item.innerHTML = `
              <div class="readiness-header-row">
                <span style="display:flex;align-items:center;gap:0.5rem;font-weight:600;">
                  <span class="color-dot" style="background-color:${subject.color}"></span>
                  ${escapeHtml(subject.name)}
                </span>
                <span style="font-family:var(--font-mono);font-weight:700;">${score}% Ready</span>
              </div>
              <div class="progress-track">
                <div class="progress-bar" style="width: ${score}%; background-color: ${subject.color};"></div>
              </div>
            `;
            readinessContainer.appendChild(item);
          });
        }
      }

      if (countdownContainer) {
        countdownContainer.innerHTML = '';
        if (subjects.length === 0) {
          countdownContainer.innerHTML = '<div style="color:var(--text-muted);padding:1rem;">No upcoming exams configured.</div>';
        } else {
          const sorted = [...subjects].sort((a, b) => a.examDate.localeCompare(b.examDate));
          sorted.forEach(subject => {
            const daysLeft = planner.daysBetween(this.todayStr, subject.examDate);
            let badgeClass = '';
            let badgeText = `${daysLeft}d left`;

            if (daysLeft < 0) {
              badgeText = 'Passed';
            } else if (daysLeft === 0) {
              badgeText = 'TODAY';
              badgeClass = 'danger';
            } else if (daysLeft <= 4) {
              badgeClass = 'danger';
            } else if (daysLeft <= 8) {
              badgeClass = 'warning';
            }

            const row = document.createElement('div');
            row.className = 'countdown-row';
            row.style.setProperty('--sub-color', subject.color);
            row.innerHTML = `
              <div>
                <div style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(subject.name)}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Target: ${subject.examDate}</div>
              </div>
              <div class="days-left-badge ${badgeClass}">${badgeText}</div>
            `;
            countdownContainer.appendChild(row);
          });
        }
      }

      this.renderHeatmap();
    }

    renderHeatmap() {
      const grid = document.getElementById('study-heatmap-grid');
      if (!grid) return;

      const planner = getPlanner();
      const storage = getStorage();

      grid.innerHTML = '';
      const logs = storage.loadStudyLogs() || {};

      const totalDays = 84; // 12 weeks * 7 days
      const startDayOffset = -(totalDays - 1);

      for (let i = startDayOffset; i <= 0; i++) {
        const dateStr = planner.addDays(this.todayStr, i);
        const hours = logs[dateStr] || 0;

        let level = 0;
        if (hours > 0 && hours < 1.5) level = 1;
        else if (hours >= 1.5 && hours < 2.5) level = 2;
        else if (hours >= 2.5 && hours < 3.5) level = 3;
        else if (hours >= 3.5) level = 4;

        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.dataset.level = String(level);
        cell.dataset.date = dateStr;
        cell.dataset.hours = String(hours);
        cell.title = `${dateStr}: ${hours}h completed`;
        cell.setAttribute('aria-label', `${dateStr}: ${hours} hours studied`);

        grid.appendChild(cell);
      }
    }

    toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('catchup_theme_v2', next);
      } catch (e) {
        console.warn('Could not save theme:', e);
      }
      const themeIcon = document.getElementById('theme-icon');
      if (themeIcon) {
        themeIcon.textContent = next === 'dark' ? '🌙' : '☀️';
      }
    }
  }

  const CatchupUI = {
    playChime,
    showToast,
    openModal,
    closeModal,
    UIController
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CatchupUI;
  }
  if (typeof global !== 'undefined') {
    global.CatchupUI = CatchupUI;
  }
})(typeof window !== 'undefined' ? window : globalThis);
