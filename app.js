/**
 * Catchup - Application Entry Point
 * Orchestrates initialization, theme preferences, keyboard shortcuts, and PWA registration.
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

    // 3. Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Check if a modal is currently open
      const openModal = document.querySelector('.modal-overlay.open');
      if (openModal) {
        if (e.key === 'Escape') {
          uiModule.closeModal(openModal);
        }
        return; // Don't trigger tab shortcuts while filling forms
      }

      // Ignore keystrokes when typing in inputs/textareas
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) {
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

    // 4. System Color-Scheme Changes Listener
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const currentTheme = storage.loadTheme();
        if (!currentTheme || currentTheme === 'system') {
          const newTheme = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', newTheme);
          if (themeIcon) themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
        }
      });
    }

    // 5. Register PWA Service Worker (Only active when served over HTTPS or localhost)
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('Catchup ServiceWorker registered with scope:', reg.scope);
        }).catch((err) => {
          console.log('ServiceWorker registration skipped or failed:', err);
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
