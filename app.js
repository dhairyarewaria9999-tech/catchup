/**
 * Catchup - Application Entry Point
 * Orchestrates initialization, theme preferences, and keyboard shortcuts.
 * Supports both browser direct file execution (file://) and module environments.
 */

(function() {
  'use strict';

  function initApp() {
    const storage = window.CatchupStorage;
    const uiModule = window.CatchupUI;

    if (!storage || !uiModule) {
      console.error('Catchup modules not yet loaded.');
      return;
    }

    // 1. Initialize Theme Preference
    const savedTheme = storage.loadTheme();
    let activeTheme = savedTheme;

    if (savedTheme === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      activeTheme = prefersDark ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', activeTheme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      themeIcon.textContent = activeTheme === 'dark' ? '🌙' : '☀️';
    }

    // 2. Initialize UI Controller
    const ui = new uiModule.UIController();
    ui.init();

    // 3. Keyboard Shortcuts for Power Users
    window.addEventListener('keydown', (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      if (e.key === '1') {
        ui.switchTab('setup');
      } else if (e.key === '2') {
        ui.switchTab('today');
      } else if (e.key === '3') {
        ui.switchTab('plan');
      } else if (e.key === '4') {
        ui.switchTab('progress');
      } else if (e.code === 'Space') {
        if (ui.currentTab === 'today') {
          e.preventDefault();
          const startBtn = document.getElementById('pomo-start-btn');
          startBtn?.click();
        }
      }
    });

    // Listen for system color-scheme changes if set to system
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const currentTheme = localStorage.getItem('catchup_theme_v1');
        if (!currentTheme || currentTheme === 'system') {
          const newTheme = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', newTheme);
          if (themeIcon) themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
