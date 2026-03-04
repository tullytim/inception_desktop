/**
 * MIT License
 *
 * Copyright (c) 2025 Tim Tully
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Renderer process - handles chat UI and API calls

document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const modelSelect = document.getElementById('model-select');
  const resultsDiv = document.getElementById('results');
  const welcomeState = document.getElementById('welcome-state');

  function sanitize(html) {
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html);
    }
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  // ── Auto-growing textarea ──
  function autoGrow() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
    chatInput.style.overflowY = chatInput.scrollHeight > 160 ? 'auto' : 'hidden';
  }
  chatInput.addEventListener('input', autoGrow);

  // Submit on Enter, newline on Shift+Enter
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  // ── Welcome state ──
  function hideWelcome() {
    if (welcomeState) welcomeState.style.display = 'none';
  }

  // Populate welcome prompts from pool
  (function() {
    const allPrompts = [
      { icon: '✨', label: 'Explain quantum computing in simple terms' },
      { icon: '💻', label: 'Write a Python function to sort a list' },
      { icon: '🚀', label: 'Best practices for REST APIs?' },
      { icon: '🐛', label: 'Help me debug a segmentation fault' },
      { icon: '🎨', label: 'Design a color palette for a dark-themed app' },
      { icon: '🧠', label: 'Explain how neural networks learn' },
      { icon: '🔒', label: 'How do I securely store passwords?' },
      { icon: '📈', label: 'Analyze the time complexity of my algorithm' },
      { icon: '⚡', label: 'How can I make my website load faster?' },
      { icon: '🛠', label: 'Help me set up a CI/CD pipeline' },
      { icon: '🤖', label: 'Build a Discord bot in JavaScript' },
      { icon: '🗃', label: 'Design a database schema for an e-commerce app' },
      { icon: '🌐', label: 'Explain how DNS works step by step' },
      { icon: '📱', label: 'Make this layout responsive for mobile' },
      { icon: '🧪', label: 'Write unit tests for my function' },
      { icon: '🔍', label: 'Review my code for security vulnerabilities' },
      { icon: '💡', label: 'Suggest a tech stack for a startup MVP' },
      { icon: '📝', label: 'Write a clear README for my project' },
      { icon: '🧱', label: 'Explain microservices vs monoliths' },
      { icon: '🎲', label: 'Build a simple game with HTML Canvas' },
      { icon: '🔗', label: 'How do I use WebSockets for real-time data?' },
      { icon: '📊', label: 'Visualize this data with a chart in Python' },
      { icon: '🤔', label: 'What is the difference between SQL and NoSQL?' },
      { icon: '🚢', label: 'Help me containerize my app with Docker' },
    ];
    for (let i = allPrompts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPrompts[i], allPrompts[j]] = [allPrompts[j], allPrompts[i]];
    }
    const container = document.getElementById('welcome-prompts');
    if (container) {
      allPrompts.slice(0, 4).forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'welcome-prompt-btn';
        btn.dataset.prompt = p.label;
        btn.innerHTML = '<span class="prompt-icon">' + p.icon + '</span>' + p.label;
        container.appendChild(btn);
      });
    }
  })();

  // Welcome prompt buttons
  document.querySelectorAll('.welcome-prompt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.prompt;
      autoGrow();
      chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
    });
  });

  // ── Typing indicator ──
  function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.id = 'typing-indicator-row';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'I';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const dots = document.createElement('div');
    dots.className = 'typing-indicator';
    dots.innerHTML = '<span></span><span></span><span></span>';
    bubble.appendChild(dots);
    row.appendChild(avatar);
    row.appendChild(bubble);
    resultsDiv.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator-row');
    if (indicator) indicator.remove();
  }

  // ── Code block enhancements ──
  function enhanceCodeBlocks(container) {
    container.querySelectorAll('pre').forEach(pre => {
      if (pre.querySelector('.code-block-header')) return;
      const code = pre.querySelector('code');
      if (!code) return;

      const langMatch = code.className.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : 'code';

      const header = document.createElement('div');
      header.className = 'code-block-header';

      const langLabel = document.createElement('span');
      langLabel.textContent = lang;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(code.textContent).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        });
      });

      header.appendChild(langLabel);
      header.appendChild(copyBtn);
      pre.insertBefore(header, pre.firstChild);
    });
  }

  const VALID_ROLES = ['user', 'assistant'];

  function createMessageElement(role, htmlContent) {
    const safeRole = VALID_ROLES.includes(role) ? role : 'assistant';
    const row = document.createElement('div');
    row.className = `message-row ${safeRole}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = safeRole === 'user' ? 'Y' : 'I';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = sanitize(htmlContent);
    enhanceCodeBlocks(bubble);

    row.appendChild(avatar);
    row.appendChild(bubble);
    return row;
  }

  const INCEPTION_API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';
  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  // In-memory conversation history for the current session
  let conversationHistory = [];

  // Compact history to fit within context budget.
  // Keeps the first message (original topic anchor) and trims oldest pairs
  // until estimated input tokens + maxTokens output budget fits within the
  // model context window (conservatively assumed to be 128k tokens).
  const MODEL_CONTEXT_WINDOW = 128000;
  function compactHistory(history, maxTokens) {
    if (history.length === 0) return history;
    const estimateTokens = (msgs) => msgs.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const budget = MODEL_CONTEXT_WINDOW - maxTokens;
    let compacted = [...history];
    while (compacted.length > 1 && estimateTokens(compacted) > budget) {
      // Always preserve index 0 (first user message); drop the oldest non-first pair
      const dropFrom = compacted.length > 2 ? 1 : 0;
      compacted.splice(dropFrom, 2);
    }
    return compacted;
  }

  // Load recent chats on startup
  loadRecentChats();

  // Listen for refresh events
  document.addEventListener('refreshRecentChats', loadRecentChats);
  document.addEventListener('clearConversationHistory', () => { conversationHistory = []; });

  // Listen for menu events from main process
  if (window.electronAPI && window.electronAPI.onMenuCommand) {
    window.electronAPI.onMenuCommand('menu:new-chat', () => {
      resultsDiv.innerHTML = '';
      chatInput.value = '';
      conversationHistory = [];
      if (welcomeState) welcomeState.style.display = '';
      if (window.electronAPI) {
        window.electronAPI.newChat();
      }
      setTimeout(() => {
        loadRecentChats();
      }, 100);
    });
  }

  async function loadRecentChats() {
    if (!window.electronAPI) return;

    try {
      const recentChats = await window.electronAPI.getRecentChats();
      displayRecentChats(recentChats);
    } catch (err) {
      console.error('Failed to load recent chats:', err);
    }
  }

  function displayRecentChats(chats) {
    const recentsContainer = document.getElementById('recents-list');
    if (!recentsContainer) return;

    recentsContainer.innerHTML = '';

    if (!chats || chats.length === 0) {
      recentsContainer.innerHTML = '<div style="padding: 12px 20px; color: #b0b3c0; font-size: 0.9em;">No recent chats</div>';
      return;
    }

    chats.forEach(chat => {
      const chatItem = document.createElement('div');
      chatItem.className = 'recent-chat-item';
      chatItem.dataset.conversationId = chat.id;

      const title = chat.first_message ?
        (chat.first_message.length > 40 ? chat.first_message.substring(0, 40) + '...' : chat.first_message) :
        'New Chat';

      const date = new Date(chat.updated_at).toLocaleDateString();

      const titleEl = document.createElement('div');
      titleEl.className = 'recent-chat-title';
      titleEl.textContent = title;
      const dateEl = document.createElement('div');
      dateEl.className = 'recent-chat-date';
      dateEl.textContent = date;
      chatItem.appendChild(titleEl);
      chatItem.appendChild(dateEl);

      chatItem.addEventListener('click', () => loadConversation(chat.id));
      recentsContainer.appendChild(chatItem);
    });
  }

  async function loadConversation(conversationId) {
    if (!window.electronAPI) return;

    try {
      const messages = await window.electronAPI.getConversationMessages(conversationId);

      hideWelcome();
      resultsDiv.innerHTML = '';
      conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));

      let firstRow = null;
      messages.forEach(message => {
        const row = createMessageElement(message.role, marked.parse(message.content));
        if (!firstRow) firstRow = row;
        resultsDiv.appendChild(row);
      });

      Prism.highlightAll();

      // Scroll to the first message
      setTimeout(() => {
        if (firstRow) firstRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);

    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  }

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userMsg = chatInput.value.trim();
    const selectedModel = modelSelect.value;
    if (!userMsg) return;

    hideWelcome();
    const userRow = createMessageElement('user', marked.parse(userMsg));
    resultsDiv.appendChild(userRow);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    autoGrow();

    // Add user message to in-memory history
    conversationHistory.push({ role: 'user', content: userMsg });

    // Save user message to database
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.saveMessage('user', userMsg);
        if (result) {
          setTimeout(() => loadRecentChats(), 100);
        }
      } catch (err) {
        console.error('Failed to save user message:', err);
      }
    }

    // Scroll so the user message is visible at the top
    setTimeout(() => {
      userRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    // Load current settings
    let settings = {
      apiKey: '',
      model: selectedModel || 'mercury-2',
      maxTokens: 32768
    };

    if (window.electronAPI) {
      try {
        settings = await window.electronAPI.loadSettings();
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }

    // Determine which API to use: prefer Inception Labs key, fall back to OpenRouter
    const hasInceptionKey = settings.apiKey && settings.apiKey.trim();
    const hasOpenRouterKey = settings.openRouterApiKey && settings.openRouterApiKey.trim();

    if (!hasInceptionKey && !hasOpenRouterKey) {
      const errBox = document.createElement('div');
      errBox.style.cssText = 'padding:20px;margin:20px 0;background:#2d1b1b;border:1px solid #dc3545;border-radius:8px;color:#f8d7da;';
      const heading = document.createElement('h3');
      heading.style.cssText = 'margin:0 0 10px 0;color:#dc3545;';
      heading.textContent = '⚠️ API Key Required';
      const p1 = document.createElement('p');
      p1.style.margin = '0';
      p1.textContent = 'Please set an Inception Labs or OpenRouter API key in the settings before making requests.';
      const p2 = document.createElement('p');
      p2.style.cssText = 'margin:10px 0 0 0;font-size:0.9em;opacity:0.8;';
      p2.textContent = 'Click the settings button (⚙️) at the bottom to configure your API key.';
      errBox.appendChild(heading);
      errBox.appendChild(p1);
      errBox.appendChild(p2);
      resultsDiv.appendChild(errBox);
      resultsDiv.scrollTop = resultsDiv.scrollHeight;
      return;
    }

    const useOpenRouter = !hasInceptionKey && hasOpenRouterKey;
    const activeApiUrl = useOpenRouter ? OPENROUTER_API_URL : INCEPTION_API_URL;
    const activeApiKey = useOpenRouter ? settings.openRouterApiKey.trim() : settings.apiKey.trim();

    const model = settings.model || selectedModel;
    const maxTokens = settings.maxTokens || 32768;
    const reasoningToggle = document.getElementById('reasoning-toggle');
    const payload = {
      model,
      messages: compactHistory(conversationHistory, maxTokens),
      max_tokens: maxTokens,
      ...(model === 'mercury-2' && reasoningToggle?.checked ? { reasoning_effort: 'instant' } : {})
    };

    if (useOpenRouter) {
      // OpenRouter supports: Mercury, Mercury Coder
      const openRouterModelMap = {
        'mercury': 'inception/mercury',
        'mercury-coder': 'inception/mercury-coder',
      };
      if (!openRouterModelMap[payload.model]) {
        const warnModal = document.getElementById('warning-modal');
        document.getElementById('warning-modal-title').textContent = 'Model Not Available on OpenRouter';
        document.getElementById('warning-modal-message').textContent =
          `"${model}" is not available on OpenRouter. Switch to Mercury or Mercury Coder, or add an Inception Labs API key in Settings to use Mercury 2.`;
        warnModal.classList.add('open');
        return;
      }
      payload.model = openRouterModelMap[payload.model];
    } else {
      // Inception Labs direct API supports: Mercury (as mercury-edit), Mercury 2
      const inceptionModelMap = {
        'mercury': 'mercury-edit',
        'mercury-2': 'mercury-2',
      };
      if (!inceptionModelMap[payload.model]) {
        const warnModal = document.getElementById('warning-modal');
        document.getElementById('warning-modal-title').textContent = 'Model Not Available on Inception Labs';
        document.getElementById('warning-modal-message').textContent =
          `"${model}" is not available via the Inception Labs API. Switch to Mercury or Mercury 2, or add an OpenRouter API key in Settings to use Mercury Coder.`;
        warnModal.classList.add('open');
        return;
      }
      payload.model = inceptionModelMap[payload.model];
    }

    showTypingIndicator();

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeApiKey}`
      };
      if (useOpenRouter) {
        headers['HTTP-Referer'] = 'https://github.com/timtully/inception-desktop';
        headers['X-Title'] = 'Inception Desktop';
      }

      const res = await fetch(activeApiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      hideTypingIndicator();
      if (!res.ok) {
        let errMsg = `API error (${res.status})`;
        try {
          const errBody = await res.json();
          if (errBody.error?.message) errMsg = errBody.error.message;
        } catch (_) { /* no parseable body */ }
        throw new Error(errMsg);
      }
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '[No response]';
      conversationHistory.push({ role: 'assistant', content: reply });
      const assistantRow = createMessageElement('assistant', marked.parse(reply));
      resultsDiv.appendChild(assistantRow);
      Prism.highlightAll();

      // Save assistant message to database
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.saveMessage('assistant', reply);
          if (result) {
            setTimeout(() => loadRecentChats(), 100);
          }
        } catch (err) {
          console.error('Failed to save assistant message:', err);
        }
      }

      // Scroll so the user question remains visible with the reply below it
      setTimeout(() => {
        userRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } catch (err) {
      hideTypingIndicator();
      const errDiv = document.createElement('div');
      errDiv.style.color = '#ff6b6b';
      errDiv.innerHTML = '<b>Error:</b> ';
      errDiv.appendChild(document.createTextNode(err.message));
      resultsDiv.appendChild(errDiv);
      setTimeout(() => {
        errDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  });
});
