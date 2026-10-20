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

document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const modelSelect = document.getElementById('model-select');
  const resultsDiv = document.getElementById('results');
  const welcomeState = document.getElementById('welcome-state');
  const submitBtn = document.getElementById('submit-btn');
  const stopBtn = document.getElementById('stop-btn');

  // Initialize Mermaid
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
  }

  function sanitize(html) {
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html, { ADD_TAGS: ['details', 'summary'], ADD_ATTR: ['open'] });
    }
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  function autoGrow() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
    chatInput.style.overflowY = chatInput.scrollHeight > 160 ? 'auto' : 'hidden';
  }
  function updateSendState() {
    submitBtn.disabled = !chatInput.value.trim();
  }
  chatInput.addEventListener('input', () => { autoGrow(); updateSendState(); });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  const mainContent = document.getElementById('main-content');

  function hideWelcome() {
    if (welcomeState) welcomeState.style.display = 'none';
    mainContent.classList.remove('is-empty');
  }

  function showWelcome() {
    if (welcomeState) welcomeState.style.display = '';
    mainContent.classList.add('is-empty');
    document.getElementById('scroll-to-bottom')?.classList.remove('visible');
    renderWelcome();
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Still up?';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function renderWelcome() {
    const title = document.getElementById('welcome-title');
    if (title) title.textContent = greeting();

    const h = new Date().getHours();
    const timely = h < 12
      ? ['Help me plan my day', 'Give me a quick breakfast idea']
      : h < 18
        ? ['Help me write a polite email', 'Suggest a 15-minute workout']
        : ['Suggest an easy dinner for tonight', 'Recommend something to watch'];
    const general = [
      'Explain how black holes work',
      'Plan a weekend trip to Lisbon',
      'Help me prepare for a job interview',
      'Write a short poem about autumn',
      'Teach me something surprising',
      'Summarize the pros and cons of renting vs buying',
      'Write a Python script to rename files',
      'Help me debug an error message',
      'Explain how neural networks learn',
      'Brainstorm names for a small business',
      'Give me a study plan for learning Spanish',
      'Help me make sense of a confusing contract',
    ];
    for (let i = general.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [general[i], general[j]] = [general[j], general[i]];
    }
    const picks = [timely[Math.floor(Math.random() * timely.length)], ...general.slice(0, 3)];
    const container = document.getElementById('welcome-prompts');
    if (!container) return;
    container.innerHTML = '';
    picks.forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'welcome-prompt-btn';
      btn.dataset.prompt = label;
      btn.textContent = label;
      container.appendChild(btn);
    });
  }
  renderWelcome();

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.welcome-prompt-btn');
    if (!btn) return;
    chatInput.value = btn.dataset.prompt;
    autoGrow();
    updateSendState();
    chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  // Update `target` to match `html`, touching only blocks that changed so finished
  // paragraphs don't re-render (or re-animate) while the reply streams in.
  // outerHTML without the transient entrance class, so unchanged blocks compare equal
  function blockSignature(el) {
    const clone = el.cloneNode(true);
    clone.classList.remove('fade-in');
    if (!clone.getAttribute('class')) clone.removeAttribute('class');
    return clone.outerHTML;
  }

  function patchBlocks(target, html) {
    const next = document.createElement('div');
    next.innerHTML = html;
    const incoming = Array.from(next.children);
    const existing = Array.from(target.children);
    incoming.forEach((node, i) => {
      const current = existing[i];
      if (!current) {
        node.classList.add('fade-in');
        node.addEventListener('animationend', () => node.classList.remove('fade-in'), { once: true });
        target.appendChild(node);
      } else if (blockSignature(current) !== node.outerHTML) {
        current.replaceWith(node);
      }
    });
    for (let i = existing.length - 1; i >= incoming.length; i--) existing[i].remove();
  }

  function showTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.id = 'typing-indicator-row';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const thinking = document.createElement('div');
    thinking.className = 'thinking-text';
    thinking.textContent = 'Thinking\u2026';
    bubble.appendChild(thinking);
    row.appendChild(bubble);
    resultsDiv.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function hideTypingIndicator() {
    const el = document.getElementById('typing-indicator-row');
    if (el) el.remove();
  }

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
          copyBtn.classList.add('done');
          copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>Copied';
          setTimeout(() => { copyBtn.classList.remove('done'); copyBtn.textContent = 'Copy'; }, 1500);
        });
      });
      header.appendChild(langLabel);
      header.appendChild(copyBtn);
      pre.insertBefore(header, pre.firstChild);

      // Long blocks start collapsed so one reply doesn't swamp the conversation
      const lineCount = code.textContent.split('\n').length;
      if (lineCount > 24) {
        pre.classList.add('collapsed');
        const expand = document.createElement('button');
        expand.type = 'button';
        expand.className = 'code-expand-btn';
        expand.textContent = `Show all ${lineCount} lines`;
        expand.addEventListener('click', () => {
          const collapsed = pre.classList.toggle('collapsed');
          expand.textContent = collapsed ? `Show all ${lineCount} lines` : 'Show less';
        });
        pre.appendChild(expand);
      }
    });
  }

  async function renderMermaid(container) {
    if (typeof mermaid === 'undefined') return;
    const blocks = container.querySelectorAll('pre code.language-mermaid');
    for (const code of blocks) {
      const src = code.textContent;
      const pre = code.closest('pre');
      try {
        const id = 'mermaid-' + Math.random().toString(36).slice(2);
        const { svg } = await mermaid.render(id, src);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-diagram';
        wrapper.innerHTML = svg;
        pre.replaceWith(wrapper);
      } catch (e) { /* leave as code block if render fails */ }
    }
  }

  function renderMath(container) {
    if (typeof renderMathInElement === 'undefined') return;
    try {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    } catch (e) {}
  }

  async function postProcess(bubble) {
    enhanceCodeBlocks(bubble);
    await renderMermaid(bubble);
    renderMath(bubble);
    if (typeof Prism !== 'undefined') Prism.highlightAllUnder(bubble);
  }

  const ICONS = {
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
    retry: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 11-2.3-5.7"/><path d="M20 4v5h-5"/></svg>',
  };

  function actionButton(className, title, icon) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `msg-action-btn ${className}`;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = icon;
    return btn;
  }

  // Hover action row under a message. getText returns the raw message text for copying.
  function createActions(role, getText) {
    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const copyBtn = actionButton('copy-msg-btn', 'Copy', ICONS.copy);
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(getText()).then(() => {
        copyBtn.innerHTML = ICONS.check;
        copyBtn.title = 'Copied';
        setTimeout(() => { copyBtn.innerHTML = ICONS.copy; copyBtn.title = 'Copy'; }, 1500);
      });
    });
    actions.appendChild(copyBtn);

    if (role === 'user') {
      actions.appendChild(actionButton('edit-btn', 'Edit message', ICONS.edit));
    }
    return actions;
  }

  const VALID_ROLES = ['user', 'assistant'];

  function createMessageElement(role, htmlContent, rawContent, time = null) {
    const safeRole = VALID_ROLES.includes(role) ? role : 'assistant';
    const row = document.createElement('div');
    row.className = `message-row ${safeRole}`;
    if (rawContent !== undefined) row.dataset.raw = rawContent;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = sanitize(htmlContent);

    row.appendChild(bubble);
    row.appendChild(createActions(safeRole, () => row.dataset.raw || bubble.innerText));

    if (time) {
      const timeEl = document.createElement('span');
      timeEl.className = 'msg-time';
      timeEl.textContent = time;
      row.appendChild(timeEl);
    }

    return row;
  }

  const INCEPTION_API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';
  const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  let conversationHistory = [];
  let isGenerating = false;
  let currentAbortController = null;
  let allRecentChats = [];
  let activeConversationId = null;

  // Pinned chats live in this browser profile only; they are a view preference
  function getPinned() {
    try { return new Set(JSON.parse(localStorage.getItem('pinnedChats') || '[]')); } catch (e) { return new Set(); }
  }
  function setPinned(set) {
    try { localStorage.setItem('pinnedChats', JSON.stringify([...set])); } catch (e) {}
  }

  function setGenerating(val) {
    isGenerating = val;
    if (stopBtn) stopBtn.style.display = val ? 'flex' : 'none';
    if (submitBtn) submitBtn.style.display = val ? 'none' : '';
    chatInput.disabled = val;
    if (!val) chatInput.focus();
  }

  const MODEL_CONTEXT_WINDOW = 128000;
  function compactHistory(history, maxTokens) {
    if (history.length === 0) return history;
    const estimateTokens = (msgs) => msgs.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
    const budget = MODEL_CONTEXT_WINDOW - maxTokens;
    let compacted = [...history];
    while (compacted.length > 1 && estimateTokens(compacted) > budget) {
      const dropFrom = compacted.length > 2 ? 1 : 0;
      compacted.splice(dropFrom, 2);
    }
    return compacted;
  }

  // Inline notice in the conversation. actions: [{ label, primary, onClick }]
  function showNotice(kind, title, text, actions = []) {
    const box = document.createElement('div');
    box.className = `notice ${kind}`;
    const body = document.createElement('div');
    body.className = 'notice-body';
    const t = document.createElement('div');
    t.className = 'notice-title';
    t.textContent = title;
    const p = document.createElement('div');
    p.className = 'notice-text';
    p.textContent = text;
    body.appendChild(t);
    body.appendChild(p);
    if (actions.length) {
      const row = document.createElement('div');
      row.className = 'notice-actions';
      actions.forEach(a => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn ${a.primary ? 'btn-primary' : 'btn-secondary'}`;
        b.textContent = a.label;
        b.addEventListener('click', a.onClick);
        row.appendChild(b);
      });
      body.appendChild(row);
    }
    box.appendChild(body);
    resultsDiv.appendChild(box);
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return box;
  }

  function friendlyError(err, status) {
    if (status === 401 || status === 403) return { title: 'Your API key was rejected', text: 'Check that the key in Settings is correct and still active.', settings: true };
    if (status === 429) return { title: "You're going a little fast", text: 'Too many requests right now. Wait a moment and try again.' };
    if (status >= 500) return { title: 'The service is having trouble', text: "That's on their end. Try again in a minute." };
    if (err && (err.name === 'TypeError' || /failed to fetch|network/i.test(err.message || ''))) {
      return { title: "Couldn't connect", text: 'Check your internet connection and try again.' };
    }
    return { title: 'Something went wrong', text: (err && err.message) || 'Please try again.' };
  }

  function openSettings() {
    document.getElementById('settings-btn')?.click();
  }

  function showWarning(title, message) {
    const warnModal = document.getElementById('warning-modal');
    document.getElementById('warning-modal-title').textContent = title;
    document.getElementById('warning-modal-message').textContent = message;
    warnModal.classList.add('open');
  }

  function updateContextBar(usage) {
    const bar = document.getElementById('context-bar');
    const fill = document.getElementById('context-bar-fill');
    const text = document.getElementById('context-bar-text');
    if (!bar || !fill || !text) return;
    const used = (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);
    if (!used) return;
    const pct = Math.min(100, (used / MODEL_CONTEXT_WINDOW) * 100);
    fill.style.width = pct + '%';
    const long = pct >= 70;
    bar.classList.toggle('warn', long);
    text.textContent = long ? 'This conversation is getting long. Start a new chat for best results.' : '';
  }

  function attachRegenerateButton() {
    resultsDiv.querySelectorAll('.regenerate-btn-row').forEach(el => el.remove());
    const assistantRows = resultsDiv.querySelectorAll('.message-row.assistant');
    if (!assistantRows.length) return;
    const btnRow = document.createElement('div');
    btnRow.className = 'regenerate-btn-row';
    const btn = document.createElement('button');
    btn.className = 'regenerate-btn';
    btn.innerHTML = ICONS.retry + ' Try again';
    btn.addEventListener('click', handleRegenerate);
    btnRow.appendChild(btn);
    resultsDiv.appendChild(btnRow);
  }

  async function handleRegenerate() {
    if (isGenerating) return;
    if (!conversationHistory.length || conversationHistory[conversationHistory.length - 1].role !== 'assistant') return;
    conversationHistory.pop();
    resultsDiv.querySelectorAll('.regenerate-btn-row').forEach(el => el.remove());
    const assistantRows = resultsDiv.querySelectorAll('.message-row.assistant');
    if (assistantRows.length) assistantRows[assistantRows.length - 1].remove();
    await runRequest();
  }

  function setConversationTitle(title) {
    const el = document.getElementById('conversation-title');
    if (el) el.textContent = title || '';
  }

  async function generateAutoTitle(firstUserMessage, apiUrl, apiKey, resolvedModel) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [{ role: 'user', content: `Write a short title (4 words or fewer) for a conversation that starts with: "${firstUserMessage.substring(0, 200)}". Reply with only the title, no quotes or punctuation.` }],
          max_tokens: 20,
          stream: false
        })
      });
      if (!res.ok) return;
      const data = await res.json();
      const title = data.choices?.[0]?.message?.content?.trim();
      if (title) {
        setConversationTitle(title);
        if (window.electronAPI) {
          await window.electronAPI.updateConversationTitle(title);
          setTimeout(loadRecentChats, 200);
        }
      }
    } catch (e) {}
  }

  async function runRequest() {
    let settings = { apiKey: '', model: modelSelect.value || 'mercury-3', maxTokens: 32768, systemPrompt: '' };
    if (window.electronAPI) {
      try { settings = await window.electronAPI.loadSettings(); } catch (e) {}
    }

    const hasInceptionKey = settings.apiKey?.trim();
    const hasOpenRouterKey = settings.openRouterApiKey?.trim();
    const useOpenRouter = !hasInceptionKey && hasOpenRouterKey;
    const activeApiUrl = useOpenRouter ? OPENROUTER_API_URL : INCEPTION_API_URL;
    const activeApiKey = useOpenRouter ? settings.openRouterApiKey.trim() : settings.apiKey.trim();
    const model = (settings.model === 'mercury' ? 'mercury-3' : settings.model) || modelSelect.value || 'mercury-3';
    const maxTokens = settings.maxTokens || 32768;

    let resolvedModel;
    if (useOpenRouter) {
      const map = { 'mercury-3': 'inception/mercury-3', 'mercury-2': 'inception/mercury-2' };
      if (!map[model]) {
        showWarning('Model Not Available on OpenRouter',
          `"${model}" is not available on OpenRouter. Switch to Mercury 3.`);
        return;
      }
      resolvedModel = map[model];
    } else {
      const map = { 'mercury-3': 'mercury-3', 'mercury-2': 'mercury-2' };
      if (!map[model]) {
        showWarning('Model Not Available',
          `"${model}" is not available. Switch to Mercury 3.`);
        return;
      }
      resolvedModel = map[model];
    }

    const reasoningToggle = document.getElementById('reasoning-toggle');
    const messages = [];
    if (settings.systemPrompt?.trim()) {
      messages.push({ role: 'system', content: settings.systemPrompt.trim() });
    }
    messages.push(...compactHistory(conversationHistory, maxTokens));

    const payload = {
      model: resolvedModel,
      messages,
      max_tokens: maxTokens,
      stream: true,
      ...((model === 'mercury-2' || model === 'mercury-3') && reasoningToggle?.checked ? { reasoning_effort: 'instant' } : {})
    };

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeApiKey}` };
    if (useOpenRouter) {
      headers['HTTP-Referer'] = 'https://github.com/tullytim/inception_desktop';
      headers['X-Title'] = 'Inception Desktop';
    }

    // Build assistant row
    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant';
    const assistantBubble = document.createElement('div');
    assistantBubble.className = 'message-bubble';

    // Reasoning block (hidden until reasoning tokens arrive)
    const reasoningDetails = document.createElement('details');
    reasoningDetails.className = 'reasoning-block';
    reasoningDetails.style.display = 'none';
    const reasoningSummary = document.createElement('summary');
    reasoningSummary.textContent = 'Thinking\u2026';
    const reasoningContent = document.createElement('div');
    reasoningContent.className = 'reasoning-content';
    reasoningDetails.appendChild(reasoningSummary);
    reasoningDetails.appendChild(reasoningContent);
    assistantBubble.appendChild(reasoningDetails);

    const streamingEl = document.createElement('div');
    streamingEl.className = 'streaming-text active';
    assistantBubble.appendChild(streamingEl);

    assistantRow.appendChild(assistantBubble);

    hideTypingIndicator();
    resultsDiv.appendChild(assistantRow);
    assistantRow.scrollIntoView({ behavior: 'smooth', block: 'start' });

    currentAbortController = new AbortController();
    setGenerating(true);

    let fullReply = '';
    let fullReasoning = '';

    // Render markdown as it streams, at most once per frame. Highlighting, math and
    // diagrams wait for the final pass.
    let renderQueued = false;
    function scheduleStreamRender() {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        patchBlocks(streamingEl, sanitize(marked.parse(fullReply)));
        assistantRow.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      });
    }
    let usage = null;
    let errored = false;

    try {
      const res = await fetch(activeApiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: currentAbortController.signal
      });

      if (!res.ok) {
        let errMsg = `API error (${res.status})`;
        try { const b = await res.json(); if (b.error?.message) errMsg = typeof b.error.message === 'string' ? b.error.message : JSON.stringify(b.error); } catch {}
        const apiErr = new Error(errMsg);
        apiErr.status = res.status;
        throw apiErr;
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const chunk = JSON.parse(raw);
              const reasoning = chunk.choices?.[0]?.delta?.reasoning;
              if (reasoning) {
                fullReasoning += reasoning;
                reasoningDetails.style.display = '';
                reasoningContent.textContent = fullReasoning;
              }
              const token = chunk.choices?.[0]?.delta?.content;
              if (token) {
                fullReply += token;
                scheduleStreamRender();
                assistantRow.scrollIntoView({ behavior: 'instant', block: 'nearest' });
              }
              if (chunk.usage) usage = chunk.usage;
            } catch {}
          }
        }
      } else {
        const b = await res.json();
        fullReply = b.choices?.[0]?.message?.content || '';
        if (b.usage) usage = b.usage;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        errored = true;
        assistantRow.remove();
        const info = friendlyError(err, err.status);
        const actions = [{ label: 'Try again', primary: !info.settings, onClick: (e) => { e.currentTarget.closest('.notice').remove(); if (!isGenerating) { showTypingIndicator(); runRequest(); } } }];
        if (info.settings) actions.unshift({ label: 'Open Settings', primary: true, onClick: openSettings });
        showNotice('error', info.title, info.text, actions);
        setGenerating(false);
        currentAbortController = null;
        return;
      }
    }

    // Remove streaming cursor class; stop any queued frame from touching the removed element
    renderQueued = true;
    streamingEl.classList.remove('active');

    // Final render
    if (fullReply) {
      streamingEl.remove();
      const contentDiv = document.createElement('div');
      contentDiv.innerHTML = sanitize(marked.parse(fullReply));
      assistantBubble.appendChild(contentDiv);
      await postProcess(contentDiv);
    } else if (!errored) {
      streamingEl.classList.remove('active');
      streamingEl.textContent = '[No response]';
    }

    // Update reasoning summary now it's done
    if (fullReasoning) {
      reasoningSummary.textContent = 'Reasoning';
    }

    // Token usage
    if (usage) {
      const usageEl = document.createElement('div');
      usageEl.className = 'token-usage';
      usageEl.textContent = `${(usage.prompt_tokens ?? '?').toLocaleString()} in \u00b7 ${(usage.completion_tokens ?? '?').toLocaleString()} out`;
      assistantRow.appendChild(usageEl);
      updateContextBar(usage);
    }

    // Add action buttons and timestamp to assistant message
    if (fullReply) {
      assistantRow.dataset.raw = fullReply;
      assistantRow.appendChild(createActions('assistant', () => fullReply));

      const timeEl = document.createElement('span');
      timeEl.className = 'msg-time';
      timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      assistantRow.appendChild(timeEl);
    }

    // Save to history and DB
    if (fullReply) {
      conversationHistory.push({ role: 'assistant', content: fullReply });
      if (window.electronAPI) {
        try { await window.electronAPI.saveMessage('assistant', fullReply); } catch (e) {}
      }
    }

    // Auto-title after first exchange
    if (conversationHistory.length === 2 && conversationHistory[0].role === 'user') {
      const firstMsg = conversationHistory[0].content;
      setConversationTitle(firstMsg.length > 50 ? firstMsg.substring(0, 50) + '\u2026' : firstMsg);
      generateAutoTitle(firstMsg, activeApiUrl, activeApiKey, resolvedModel);
    }

    attachRegenerateButton();
    setTimeout(loadRecentChats, 100);
    setGenerating(false);
    currentAbortController = null;
  }

  // ── Scroll to bottom ──
  const scrollToBottomBtn = document.getElementById('scroll-to-bottom');
  resultsDiv.addEventListener('scroll', () => {
    const distFromBottom = resultsDiv.scrollHeight - resultsDiv.scrollTop - resultsDiv.clientHeight;
    scrollToBottomBtn?.classList.toggle('visible', distFromBottom > 120);
  });
  scrollToBottomBtn?.addEventListener('click', () => {
    resultsDiv.scrollTo({ top: resultsDiv.scrollHeight, behavior: 'smooth' });
  });

  // ── Export conversation ──
  function exportConversation() {
    if (!conversationHistory.length) return;
    const title = document.getElementById('conversation-title')?.textContent?.trim() || 'Conversation';
    const date = new Date().toLocaleDateString();
    let md = `# ${title}\n_Exported ${date}_\n\n`;
    conversationHistory.forEach(m => {
      const label = m.role === 'user' ? 'You' : 'Assistant';
      md += `**${label}**\n\n${m.content}\n\n---\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  document.getElementById('export-btn')?.addEventListener('click', exportConversation);

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'n' && !window.electronAPI?.onMenuCommand) {
      e.preventDefault();
      // New chat
      resultsDiv.innerHTML = '';
      chatInput.value = '';
      conversationHistory = [];
      setConversationTitle('');
      showWelcome();
      if (window.electronAPI) window.electronAPI.newChat().catch(() => {});
      setTimeout(loadRecentChats, 100);
    }
    if (mod && e.key === '/') {
      e.preventDefault();
      chatInput.focus();
    }
    if (e.key === 'Escape') {
      if (isGenerating && currentAbortController) {
        currentAbortController.abort();
      }
    }
  });

  // ── Load recent chats ──
  loadRecentChats();

  document.addEventListener('refreshRecentChats', loadRecentChats);
  document.addEventListener('clearConversationHistory', () => {
    conversationHistory = [];
    activeConversationId = null;
    setConversationTitle('');
    showWelcome();
  });

  if (window.electronAPI && window.electronAPI.onMenuCommand) {
    window.electronAPI.onMenuCommand('menu:new-chat', () => {
      resultsDiv.innerHTML = '';
      chatInput.value = '';
      conversationHistory = [];
      activeConversationId = null;
      setConversationTitle('');
      showWelcome();
      if (window.electronAPI) window.electronAPI.newChat();
      setTimeout(loadRecentChats, 100);
      chatInput.focus();
    });
  }

  async function loadRecentChats() {
    if (!window.electronAPI) return;
    try {
      allRecentChats = await window.electronAPI.getRecentChats();
      const searchVal = (document.getElementById('chat-search')?.value || '').toLowerCase().trim();
      displayRecentChats(searchVal ? allRecentChats.filter(c =>
        (c.title || c.first_message || '').toLowerCase().includes(searchVal)
      ) : allRecentChats);
    } catch (err) {
      console.error('Failed to load recent chats:', err);
    }
  }

  // SQLite CURRENT_TIMESTAMP is UTC without a zone marker
  function parseDbDate(value) {
    if (!value) return new Date(NaN);
    return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  }

  function dateGroup(date) {
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return 'Previous 7 days';
    if (days < 30) return 'Previous 30 days';
    return 'Older';
  }

  function displayRecentChats(chats) {
    const recentsContainer = document.getElementById('recents-list');
    if (!recentsContainer) return;
    recentsContainer.innerHTML = '';
    if (!chats || chats.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'recents-empty';
      const searching = !!document.getElementById('chat-search')?.value;
      empty.innerHTML = searching
        ? '<svg viewBox="0 0 64 64"><circle cx="28" cy="28" r="14"/><path d="M38 38l14 14"/></svg><span></span>'
        : '<svg viewBox="0 0 64 64"><path class="accent-fill" d="M12 14h40a4 4 0 014 4v22a4 4 0 01-4 4H30l-10 9v-9h-8a4 4 0 01-4-4V18a4 4 0 014-4z"/><path d="M22 26h20M22 34h12"/></svg><span></span>';
      empty.querySelector('span').textContent = searching ? 'No matching chats' : 'Your chats will show up here';
      recentsContainer.appendChild(empty);
      return;
    }
    const pinned = getPinned();
    // Pinned chats float to the top under their own heading
    chats = [...chats.filter(c => pinned.has(c.id)), ...chats.filter(c => !pinned.has(c.id))];
    let lastGroup = null;
    chats.forEach(chat => {
      const isPinned = pinned.has(chat.id);
      const group = isPinned ? 'Pinned' : dateGroup(parseDbDate(chat.updated_at));
      if (group !== lastGroup) {
        const heading = document.createElement('div');
        heading.className = 'recents-group-title';
        heading.textContent = group;
        recentsContainer.appendChild(heading);
        lastGroup = group;
      }

      const chatItem = document.createElement('div');
      chatItem.className = 'recent-chat-item';
      if (chat.id === activeConversationId) chatItem.classList.add('active');
      chatItem.dataset.conversationId = chat.id;

      const title = chat.title ||
        (chat.first_message
          ? (chat.first_message.length > 40 ? chat.first_message.substring(0, 40) + '...' : chat.first_message)
          : 'New chat');

      const titleEl = document.createElement('div');
      titleEl.className = 'recent-chat-title';
      titleEl.textContent = title;

      if (isPinned) {
        chatItem.insertAdjacentHTML('afterbegin', '<svg class="pin-mark" viewBox="0 0 24 24"><path d="M14 3l7 7-3 1-3 3 .5 5-1.5 1.5-4-4-5 5-1-1 5-5-4-4L7 11l5 .5 3-3 1-3z"/></svg>');
      }

      const pinBtn = document.createElement('button');
      pinBtn.className = 'pin-chat-btn';
      pinBtn.title = isPinned ? 'Unpin chat' : 'Pin chat';
      pinBtn.setAttribute('aria-label', pinBtn.title);
      pinBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14 3l7 7-3 1-3 3 .5 5-1.5 1.5-4-4-5 5-1-1 5-5-4-4L7 11l5 .5 3-3 1-3z"/></svg>';
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const set = getPinned();
        if (set.has(chat.id)) set.delete(chat.id); else set.add(chat.id);
        setPinned(set);
        loadRecentChats();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-chat-btn';
      deleteBtn.title = 'Delete chat';
      deleteBtn.setAttribute('aria-label', 'Delete chat');
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!window.electronAPI) return;
        await window.electronAPI.deleteConversation(chat.id);
        const pins = getPinned();
        if (pins.delete(chat.id)) setPinned(pins);
        if (chat.id === activeConversationId) {
          activeConversationId = null;
          document.getElementById('clear-chat-btn')?.click();
        }
        loadRecentChats();
      });

      chatItem.appendChild(titleEl);
      chatItem.appendChild(pinBtn);
      chatItem.appendChild(deleteBtn);
      chatItem.addEventListener('click', () => loadConversation(chat.id, chat.title));
      recentsContainer.appendChild(chatItem);
    });
  }

  async function loadConversation(conversationId, conversationTitle) {
    if (!window.electronAPI) return;
    // Only show a skeleton if loading takes a noticeable moment
    const skeletonTimer = setTimeout(() => {
      hideWelcome();
      resultsDiv.innerHTML = '<div class="skeleton"><span></span><span></span><span></span><span></span><span></span></div>';
    }, 150);
    try {
      const messages = await window.electronAPI.getConversationMessages(conversationId);
      clearTimeout(skeletonTimer);
      activeConversationId = conversationId;
      hideWelcome();
      resultsDiv.innerHTML = '';
      conversationHistory = messages.map(m => ({ role: m.role, content: m.content }));
      setConversationTitle(conversationTitle || '');

      let firstRow = null;
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const row = createMessageElement(message.role, marked.parse(message.content), message.content);
        row.dataset.historyIndex = i;
        if (!firstRow) firstRow = row;
        resultsDiv.appendChild(row);
        await postProcess(row.querySelector('.message-bubble'));
      }

      if (conversationHistory.length && conversationHistory[conversationHistory.length - 1].role === 'assistant') {
        attachRegenerateButton();
      }

      document.querySelectorAll('.recent-chat-item').forEach(el => {
        el.classList.toggle('active', el.dataset.conversationId === String(conversationId));
      });
      setTimeout(() => {
        if (firstRow) firstRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } catch (err) {
      clearTimeout(skeletonTimer);
      console.error('Failed to load conversation:', err);
    }
  }

  // ── Submit handler ──
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isGenerating) return;
    const userMsg = chatInput.value.trim();
    if (!userMsg) return;

    let settings = {};
    if (window.electronAPI) {
      try { settings = await window.electronAPI.loadSettings(); } catch (err) {}
    }
    const hasInceptionKey = settings.apiKey?.trim();
    const hasOpenRouterKey = settings.openRouterApiKey?.trim();

    if (!hasInceptionKey && !hasOpenRouterKey) {
      hideWelcome();
      showNotice('', 'Add an API key to get started', 'Inception needs a key to talk to the model. It takes a few seconds.', [
        { label: 'Open Settings', primary: true, onClick: openSettings },
      ]);
      resultsDiv.scrollTop = resultsDiv.scrollHeight;
      return;
    }

    hideWelcome();
    resultsDiv.querySelectorAll('.regenerate-btn-row').forEach(el => el.remove());

    const historyIndex = conversationHistory.length;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userRow = createMessageElement('user', marked.parse(userMsg), userMsg, now);
    userRow.dataset.historyIndex = historyIndex;
    resultsDiv.appendChild(userRow);
    postProcess(userRow.querySelector('.message-bubble'));

    chatInput.value = '';
    chatInput.style.height = 'auto';
    autoGrow();
    updateSendState();

    conversationHistory.push({ role: 'user', content: userMsg });

    if (window.electronAPI) {
      try {
        await window.electronAPI.saveMessage('user', userMsg);
        setTimeout(loadRecentChats, 100);
      } catch (err) {}
    }

    showTypingIndicator();
    setTimeout(() => userRow.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    await runRequest();
  });

  // ── Stop button ──
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      if (currentAbortController) currentAbortController.abort();
    });
  }

  // ── Edit button (delegated) ──
  resultsDiv.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (!editBtn || isGenerating) return;
    const row = editBtn.closest('.message-row.user');
    if (!row) return;
    const rawContent = row.dataset.raw || '';
    const historyIndex = parseInt(row.dataset.historyIndex, 10);
    const allRows = [...resultsDiv.querySelectorAll('.message-row, .regenerate-btn-row')];
    const rowIdx = allRows.indexOf(row);
    if (rowIdx !== -1) allRows.slice(rowIdx).forEach(r => r.remove());
    if (!isNaN(historyIndex)) conversationHistory = conversationHistory.slice(0, historyIndex);
    if (window.electronAPI) window.electronAPI.newChat().catch(() => {});
    chatInput.value = rawContent;
    autoGrow();
    chatInput.focus();
  });

  // ── Search ──
  const searchInput = document.getElementById('chat-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const val = searchInput.value.toLowerCase().trim();
      displayRecentChats(val ? allRecentChats.filter(c =>
        (c.title || c.first_message || '').toLowerCase().includes(val)
      ) : allRecentChats);
    });
  }
});
