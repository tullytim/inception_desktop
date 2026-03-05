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
  chatInput.addEventListener('input', autoGrow);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  function hideWelcome() {
    if (welcomeState) welcomeState.style.display = 'none';
  }

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

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.welcome-prompt-btn');
    if (!btn) return;
    chatInput.value = btn.dataset.prompt;
    autoGrow();
    chatForm.dispatchEvent(new Event('submit', { cancelable: true }));
  });

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
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        });
      });
      header.appendChild(langLabel);
      header.appendChild(copyBtn);
      pre.insertBefore(header, pre.firstChild);
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

  const VALID_ROLES = ['user', 'assistant'];

  function createMessageElement(role, htmlContent, rawContent, time = null) {
    const safeRole = VALID_ROLES.includes(role) ? role : 'assistant';
    const row = document.createElement('div');
    row.className = `message-row ${safeRole}`;
    if (rawContent !== undefined) row.dataset.raw = rawContent;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = safeRole === 'user' ? 'Y' : 'I';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = sanitize(htmlContent);

    const actions = document.createElement('div');
    actions.className = 'message-actions';

    // Copy button for all messages
    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn copy-msg-btn';
    copyBtn.title = 'Copy message';
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy';
    copyBtn.addEventListener('click', () => {
      const text = row.dataset.raw || bubble.innerText;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = copyBtn.innerHTML.replace('Copy', 'Copied!');
        setTimeout(() => { copyBtn.innerHTML = copyBtn.innerHTML.replace('Copied!', 'Copy'); }, 1500);
      });
    });
    actions.appendChild(copyBtn);

    if (safeRole === 'user') {
      const editBtn = document.createElement('button');
      editBtn.className = 'msg-action-btn edit-btn';
      editBtn.title = 'Edit message';
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg> Edit';
      actions.appendChild(editBtn);
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    row.appendChild(actions);

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
    fill.style.background = pct > 80 ? '#f59e0b' : pct > 60 ? '#6ee7b7' : 'var(--accent-green)';
    text.textContent = `${used.toLocaleString()} / ${MODEL_CONTEXT_WINDOW.toLocaleString()} tokens`;
    bar.style.display = 'flex';
  }

  function attachRegenerateButton() {
    resultsDiv.querySelectorAll('.regenerate-btn-row').forEach(el => el.remove());
    const assistantRows = resultsDiv.querySelectorAll('.message-row.assistant');
    if (!assistantRows.length) return;
    const btnRow = document.createElement('div');
    btnRow.className = 'regenerate-btn-row';
    const btn = document.createElement('button');
    btn.className = 'regenerate-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg> Regenerate';
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
    let settings = { apiKey: '', model: modelSelect.value || 'mercury-2', maxTokens: 32768, systemPrompt: '' };
    if (window.electronAPI) {
      try { settings = await window.electronAPI.loadSettings(); } catch (e) {}
    }

    const hasInceptionKey = settings.apiKey?.trim();
    const hasOpenRouterKey = settings.openRouterApiKey?.trim();
    const useOpenRouter = !hasInceptionKey && hasOpenRouterKey;
    const activeApiUrl = useOpenRouter ? OPENROUTER_API_URL : INCEPTION_API_URL;
    const activeApiKey = useOpenRouter ? settings.openRouterApiKey.trim() : settings.apiKey.trim();
    const model = (settings.model === 'mercury' ? 'mercury-2' : settings.model) || modelSelect.value || 'mercury-2';
    const maxTokens = settings.maxTokens || 32768;

    let resolvedModel;
    if (useOpenRouter) {
      const map = { 'mercury-2': 'inception/mercury-2' };
      if (!map[model]) {
        showWarning('Model Not Available on OpenRouter',
          `"${model}" is not available on OpenRouter. Switch to Mercury 2.`);
        return;
      }
      resolvedModel = map[model];
    } else {
      const map = { 'mercury-2': 'mercury-2' };
      if (!map[model]) {
        showWarning('Model Not Available',
          `"${model}" is not available. Switch to Mercury 2.`);
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
      ...(model === 'mercury-2' && reasoningToggle?.checked ? { reasoning_effort: 'instant' } : {})
    };

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeApiKey}` };
    if (useOpenRouter) {
      headers['HTTP-Referer'] = 'https://github.com/tullytim/inception_desktop';
      headers['X-Title'] = 'Inception Desktop';
    }

    // Build assistant row
    const assistantRow = document.createElement('div');
    assistantRow.className = 'message-row assistant';
    const assistantAvatar = document.createElement('div');
    assistantAvatar.className = 'message-avatar';
    assistantAvatar.textContent = 'I';
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

    assistantRow.appendChild(assistantAvatar);
    assistantRow.appendChild(assistantBubble);

    hideTypingIndicator();
    resultsDiv.appendChild(assistantRow);
    assistantRow.scrollIntoView({ behavior: 'smooth', block: 'start' });

    currentAbortController = new AbortController();
    setGenerating(true);

    let fullReply = '';
    let fullReasoning = '';
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
        throw new Error(errMsg);
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
                streamingEl.textContent = fullReply;
                assistantRow.scrollIntoView({ behavior: 'instant', block: 'nearest' });
              }
              if (chunk.usage) usage = chunk.usage;
            } catch {}
          }
        }
      } else {
        const b = await res.json();
        fullReply = b.choices?.[0]?.message?.content || '';
        if (fullReply) streamingEl.textContent = fullReply;
        if (b.usage) usage = b.usage;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        errored = true;
        assistantRow.remove();
        const errDiv = document.createElement('div');
        errDiv.style.color = '#ff6b6b';
        errDiv.innerHTML = '<b>Error:</b> ';
        errDiv.appendChild(document.createTextNode(err.message));
        resultsDiv.appendChild(errDiv);
        setGenerating(false);
        currentAbortController = null;
        return;
      }
    }

    // Remove streaming cursor class
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
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'msg-action-btn copy-msg-btn';
      copyBtn.title = 'Copy message';
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(fullReply).then(() => {
          copyBtn.innerHTML = copyBtn.innerHTML.replace('Copy', 'Copied!');
          setTimeout(() => { copyBtn.innerHTML = copyBtn.innerHTML.replace('Copied!', 'Copy'); }, 1500);
        });
      });
      actions.appendChild(copyBtn);
      assistantRow.appendChild(actions);

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
    if (mod && e.key === 'k') {
      e.preventDefault();
      // New chat
      resultsDiv.innerHTML = '';
      chatInput.value = '';
      conversationHistory = [];
      setConversationTitle('');
      if (welcomeState) welcomeState.style.display = '';
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
    setConversationTitle('');
  });

  if (window.electronAPI && window.electronAPI.onMenuCommand) {
    window.electronAPI.onMenuCommand('menu:new-chat', () => {
      resultsDiv.innerHTML = '';
      chatInput.value = '';
      conversationHistory = [];
      setConversationTitle('');
      if (welcomeState) welcomeState.style.display = '';
      if (window.electronAPI) window.electronAPI.newChat();
      setTimeout(loadRecentChats, 100);
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

      const title = chat.title ||
        (chat.first_message
          ? (chat.first_message.length > 40 ? chat.first_message.substring(0, 40) + '...' : chat.first_message)
          : 'New Chat');

      const date = new Date(chat.updated_at).toLocaleDateString();

      const titleEl = document.createElement('div');
      titleEl.className = 'recent-chat-title';
      titleEl.textContent = title;
      const dateEl = document.createElement('div');
      dateEl.className = 'recent-chat-date';
      dateEl.textContent = date;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-chat-btn';
      deleteBtn.title = 'Delete conversation';
      deleteBtn.textContent = '\u00d7';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!window.electronAPI) return;
        await window.electronAPI.deleteConversation(chat.id);
        loadRecentChats();
      });

      chatItem.appendChild(titleEl);
      chatItem.appendChild(dateEl);
      chatItem.appendChild(deleteBtn);
      chatItem.addEventListener('click', () => loadConversation(chat.id, chat.title));
      recentsContainer.appendChild(chatItem);
    });
  }

  async function loadConversation(conversationId, conversationTitle) {
    if (!window.electronAPI) return;
    try {
      const messages = await window.electronAPI.getConversationMessages(conversationId);
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

      setTimeout(() => {
        if (firstRow) firstRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    } catch (err) {
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
      const errBox = document.createElement('div');
      errBox.style.cssText = 'padding:20px;margin:20px 0;background:#2d1b1b;border:1px solid #dc3545;border-radius:8px;color:#f8d7da;';
      const heading = document.createElement('h3');
      heading.style.cssText = 'margin:0 0 10px 0;color:#dc3545;';
      heading.textContent = '\u26a0\ufe0f API Key Required';
      const p1 = document.createElement('p');
      p1.style.margin = '0';
      p1.textContent = 'Please set an Inception Labs or OpenRouter API key in the settings before making requests.';
      const p2 = document.createElement('p');
      p2.style.cssText = 'margin:10px 0 0 0;font-size:0.9em;opacity:0.8;';
      p2.textContent = 'Click the settings button (\u2699\ufe0f) at the bottom to configure your API key.';
      errBox.appendChild(heading);
      errBox.appendChild(p1);
      errBox.appendChild(p2);
      resultsDiv.appendChild(errBox);
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
