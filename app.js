const MODEL_MAX_TOKENS = {
  'mercury': 16384,
  'mercury-2': 16384,
  'mercury-coder': 16384,
  'mercury-coder-small': 16384,
  'mercury-coder-large': 16384,
};
function getMaxTokensForModel(model) {
  return MODEL_MAX_TOKENS[model] || 16384;
}
function updateReasoningToggleVisibility(model) {
  const wrap = document.getElementById('reasoning-toggle-wrap');
  wrap.style.display = model === 'mercury-2' ? 'flex' : 'none';
}

function applyMaxTokensForModel(model) {
  const max = getMaxTokensForModel(model);
  const input = document.getElementById('max-tokens-input');
  input.max = max;
  document.querySelector('label[for="max-tokens-input"] + input + .setting-description').textContent =
    `Maximum number of tokens in response (1\u2013${max})`;
  // Clamp existing value if it exceeds the new max
  if (parseInt(input.value) > max) input.value = max;
}

// Sidebar toggle functionality
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const mainContent = document.getElementById('main-content');

function toggleSidebar() {
  const isOpen = sidebar.classList.contains('open');

  if (isOpen) {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
    mainContent.classList.remove('sidebar-open');
    hamburgerBtn.classList.remove('sidebar-open');
  } else {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('open');
    mainContent.classList.add('sidebar-open');
    hamburgerBtn.classList.add('sidebar-open');
  }
}

hamburgerBtn.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

// Sidebar menu actions
document.querySelectorAll('.sidebar-item').forEach(item => {
  item.addEventListener('click', (e) => {
    // Remove active class from all items
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    // Add active class to clicked item
    e.target.classList.add('active');

    const action = e.target.dataset.action;
    switch(action) {
      case 'new-chat':
        document.getElementById('results').innerHTML = '';
        document.getElementById('chat-input').value = '';
        const ws = document.getElementById('welcome-state');
        if (ws) ws.style.display = '';
        document.dispatchEvent(new CustomEvent('clearConversationHistory'));
        if (window.electronAPI) {
          window.electronAPI.newChat();
        }
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('refreshRecentChats'));
        }, 100);
        break;
      case 'recents':
        // TODO: Show recent chats
        break;
      case 'settings':
        settingsBtn.click();
        break;
    }

    // Close sidebar on mobile after selection
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });
});

// Bottom buttons functionality
const clearChatBtn = document.getElementById('clear-chat-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const modalClose = document.getElementById('modal-close');

// Clear chat functionality
clearChatBtn.addEventListener('click', () => {
  document.getElementById('results').innerHTML = '';
  document.getElementById('chat-input').value = '';
  const ws = document.getElementById('welcome-state');
  if (ws) ws.style.display = '';
  document.dispatchEvent(new CustomEvent('clearConversationHistory'));
  if (window.electronAPI) {
    window.electronAPI.newChat();
  }
  setTimeout(() => {
    document.dispatchEvent(new CustomEvent('refreshRecentChats'));
  }, 100);
});

// Settings modal functionality
settingsBtn.addEventListener('click', async () => {
  // Load settings when opening modal
  if (window.electronAPI) {
    try {
      const settings = await window.electronAPI.loadSettings();
      document.getElementById('api-key-input').value = settings.apiKey || '';
      document.getElementById('openrouter-key-input').value = settings.openRouterApiKey || '';
      const currentModel = settings.model || 'mercury-2';
      document.getElementById('model-setting').value = currentModel;
      applyMaxTokensForModel(currentModel);
      const modelMax = getMaxTokensForModel(currentModel);
      const savedTokens = settings.maxTokens;
      // Use saved value only if it's a valid custom value below the model max; otherwise use model max
      document.getElementById('max-tokens-input').value = (savedTokens && savedTokens <= modelMax) ? savedTokens : modelMax;
      document.getElementById('theme-setting').value = settings.theme || 'dark';
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }
  settingsModal.classList.add('open');
});

async function closeModal() {
  // Save settings when closing modal
  if (window.electronAPI) {
    try {
      const settings = {
        apiKey: document.getElementById('api-key-input').value,
        openRouterApiKey: document.getElementById('openrouter-key-input').value,
        model: document.getElementById('model-setting').value,
        maxTokens: parseInt(document.getElementById('max-tokens-input').value) || getMaxTokensForModel(document.getElementById('model-setting').value),
        theme: document.getElementById('theme-setting').value
      };
      await window.electronAPI.saveSettings(settings);

      // Update the model dropdown in the main UI
      document.getElementById('model-select').value = settings.model;
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }
  settingsModal.classList.remove('open');
}

// Add event listener for model setting changes in the modal
document.getElementById('model-setting').addEventListener('change', async function(e) {
  const selectedModel = e.target.value;

  // Update max tokens and reasoning toggle for the newly selected model
  applyMaxTokensForModel(selectedModel);
  document.getElementById('max-tokens-input').value = getMaxTokensForModel(selectedModel);
  updateReasoningToggleVisibility(selectedModel);

  // Update the main dropdown immediately
  document.getElementById('model-select').value = selectedModel;

  if (window.electronAPI) {
    try {
      // Load current settings and update model
      const currentSettings = await window.electronAPI.loadSettings() || {};
      currentSettings.model = selectedModel;
      await window.electronAPI.saveSettings(currentSettings);
    } catch (error) {
      console.error('Error saving model preference from settings:', error);
    }
  }
});

modalClose.addEventListener('click', closeModal);

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    closeModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsModal.classList.contains('open')) {
    closeModal();
  }
});

// Load settings on page startup and set up auto-save
async function loadInitialSettings() {
  const modelSelect = document.getElementById('model-select');

  if (window.electronAPI) {
    try {
      const settings = await window.electronAPI.loadSettings();
      // Set the saved model or default to 'mercury'
      const savedModel = settings?.model || 'mercury-2';
      modelSelect.value = savedModel;
      updateReasoningToggleVisibility(savedModel);

      // Show API key prompt if no key is configured (neither Inception nor OpenRouter)
      const hasAnyKey = (settings?.apiKey && settings.apiKey.trim()) || (settings?.openRouterApiKey && settings.openRouterApiKey.trim());
      if (!hasAnyKey) {
        document.getElementById('api-key-modal').classList.add('open');
        setTimeout(() => document.getElementById('api-key-prompt-input').focus(), 300);
      }
    } catch (error) {
      console.error('Error loading initial settings:', error);
      modelSelect.value = 'mercury-2';
      // Show prompt since we couldn't verify any keys exist
      document.getElementById('api-key-modal').classList.add('open');
    }
  } else {
    // Default to 'mercury' if no electronAPI
    modelSelect.value = 'mercury-2';
  }

  // Add event listener to auto-save when dropdown changes
  modelSelect.addEventListener('change', async function(e) {
    const selectedModel = e.target.value;

    updateReasoningToggleVisibility(selectedModel);

    // Update the settings modal dropdown immediately
    document.getElementById('model-setting').value = selectedModel;

    if (window.electronAPI) {
      try {
        // Load current settings and update model
        const currentSettings = await window.electronAPI.loadSettings() || {};
        currentSettings.model = selectedModel;
        await window.electronAPI.saveSettings(currentSettings);
      } catch (error) {
        console.error('Error saving model preference:', error);
      }
    }
  });
}

// API key prompt modal handlers
document.getElementById('api-key-prompt-save').addEventListener('click', async () => {
  const apiKey = document.getElementById('api-key-prompt-input').value.trim();
  const openRouterApiKey = document.getElementById('openrouter-key-prompt-input').value.trim();
  if (!apiKey && !openRouterApiKey) return;

  if (window.electronAPI) {
    const currentSettings = await window.electronAPI.loadSettings() || {};
    if (apiKey) currentSettings.apiKey = apiKey;
    if (openRouterApiKey) currentSettings.openRouterApiKey = openRouterApiKey;
    await window.electronAPI.saveSettings(currentSettings);
  }

  document.getElementById('api-key-modal').classList.remove('open');
  // Keep the settings modal inputs in sync
  if (apiKey) document.getElementById('api-key-input').value = apiKey;
  if (openRouterApiKey) document.getElementById('openrouter-key-input').value = openRouterApiKey;
});

document.getElementById('api-key-prompt-skip').addEventListener('click', () => {
  document.getElementById('api-key-modal').classList.remove('open');
});

document.getElementById('api-key-prompt-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('api-key-prompt-save').click();
  if (e.key === 'Escape') document.getElementById('api-key-modal').classList.remove('open');
});

document.getElementById('openrouter-key-prompt-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('api-key-prompt-save').click();
  if (e.key === 'Escape') document.getElementById('api-key-modal').classList.remove('open');
});

// Warning modal handlers
(function() {
  const warnModal = document.getElementById('warning-modal');
  const closeBtn = document.getElementById('warning-modal-close');
  const okBtn = document.getElementById('warning-modal-ok');
  const dismiss = () => warnModal.classList.remove('open');
  closeBtn.addEventListener('click', dismiss);
  okBtn.addEventListener('click', dismiss);
  warnModal.addEventListener('click', (e) => { if (e.target === warnModal) dismiss(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && warnModal.classList.contains('open')) dismiss();
  });
})();

// Load settings when page loads
loadInitialSettings();

// Display app version in sidebar
if (window.electronAPI) {
  window.electronAPI.getVersion().then(v => {
    document.getElementById('sidebar-version').textContent = `v${v}`;
  }).catch(() => {});

  document.getElementById('check-update-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('check-update-status');
    const btn = document.getElementById('check-update-btn');
    btn.disabled = true;
    statusEl.style.display = 'inline';
    statusEl.textContent = 'Checking...';

    // Safety timeout: re-enable if IPC never resolves
    const safetyTimer = setTimeout(() => {
      btn.disabled = false;
      statusEl.style.color = '#f87171';
      statusEl.textContent = 'Check timed out';
      setTimeout(() => { statusEl.style.display = 'none'; statusEl.style.color = '#6ee7b7'; }, 3000);
    }, 15000);

    try {
      const result = await window.electronAPI.checkForUpdates();
      clearTimeout(safetyTimer);
      if (!result || !result.updateInfo) {
        statusEl.style.color = '#6b7085';
        statusEl.textContent = 'Up to date';
        setTimeout(() => { statusEl.style.display = 'none'; statusEl.style.color = '#6ee7b7'; }, 3000);
      } else {
        // Show the update banner directly — don't rely solely on onUpdateAvailable
        statusEl.style.display = 'none';
        const banner = document.getElementById('update-banner');
        const panelAvailable = document.getElementById('update-banner-available');
        const panelProgress = document.getElementById('update-banner-progress');
        const panelReady = document.getElementById('update-banner-ready');
        document.getElementById('update-new-version').textContent = `v${result.updateInfo.version}`;
        banner.style.display = 'block';
        panelAvailable.style.display = 'block';
        panelProgress.style.display = 'none';
        panelReady.style.display = 'none';
        // Store download URL for download button
        banner.dataset.downloadUrl = result.updateInfo.downloadUrl || '';
      }
    } catch {
      clearTimeout(safetyTimer);
      statusEl.style.color = '#f87171';
      statusEl.textContent = 'Check failed';
      setTimeout(() => { statusEl.style.display = 'none'; statusEl.style.color = '#6ee7b7'; }, 3000);
    }
    btn.disabled = false;
  });
}

// Theme management functions
function applyTheme(theme) {
  const body = document.body;

  // Remove existing theme classes
  body.classList.remove('light-theme');

  if (theme === 'light') {
    body.classList.add('light-theme');
  } else if (theme === 'auto') {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (!prefersDark) {
      body.classList.add('light-theme');
    }
  }
  // 'dark' theme is the default, no class needed
}

// Auto-save theme changes
async function saveThemeChange(newTheme) {
  if (window.electronAPI) {
    try {
      const currentSettings = await window.electronAPI.loadSettings() || {};
      currentSettings.theme = newTheme;
      await window.electronAPI.saveSettings(currentSettings);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }
}

// Add event listener for theme setting changes
document.getElementById('theme-setting').addEventListener('change', async function(e) {
  const selectedTheme = e.target.value;

  // Apply theme immediately
  applyTheme(selectedTheme);

  // Save the theme preference
  await saveThemeChange(selectedTheme);
});

// Load and apply initial theme
async function loadInitialTheme() {
  if (window.electronAPI) {
    try {
      const settings = await window.electronAPI.loadSettings();
      const savedTheme = settings?.theme || 'light';
      applyTheme(savedTheme);
    } catch (error) {
      console.error('Error loading initial theme:', error);
      applyTheme('light');
    }
  } else {
    applyTheme('light');
  }
}

// Listen for system theme changes when in auto mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
  if (window.electronAPI) {
    try {
      const settings = await window.electronAPI.loadSettings();
      if (settings?.theme === 'auto') {
        applyTheme('auto');
      }
    } catch (error) {
      console.error('Error checking theme setting on system change:', error);
    }
  }
});

// Load theme when page loads
loadInitialTheme();

// Auto-update UI
(function() {
  if (!window.electronAPI) return;

  const banner = document.getElementById('update-banner');
  const panelAvailable = document.getElementById('update-banner-available');
  const panelProgress = document.getElementById('update-banner-progress');
  const panelReady = document.getElementById('update-banner-ready');

  function showPanel(name) {
    banner.style.display = 'block';
    panelAvailable.style.display = name === 'available' ? 'block' : 'none';
    panelProgress.style.display = name === 'progress' ? 'block' : 'none';
    panelReady.style.display = name === 'ready' ? 'block' : 'none';
  }

  window.electronAPI.onDownloadProgress((progress) => {
    showPanel('progress');
    document.getElementById('update-progress-bar').style.width = `${progress.percent}%`;
    document.getElementById('update-progress-text').textContent = `${progress.percent}%`;
  });

  window.electronAPI.onUpdateDownloaded(() => {
    showPanel('ready');
  });

  window.electronAPI.onUpdateError(() => {
    banner.style.display = 'none';
  });

  document.getElementById('update-download-btn').addEventListener('click', () => {
    const url = banner.dataset.downloadUrl;
    if (!url) { banner.style.display = 'none'; return; }
    showPanel('progress');
    window.electronAPI.downloadUpdate(url);
  });

  document.getElementById('update-dismiss-btn').addEventListener('click', () => {
    banner.style.display = 'none';
  });

  // "Open Installer" — DMG is already open at this point, just close the banner
  document.getElementById('update-install-btn').addEventListener('click', () => {
    banner.style.display = 'none';
  });

  document.getElementById('update-later-btn').addEventListener('click', () => {
    banner.style.display = 'none';
  });
})();
