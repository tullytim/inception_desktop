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

  function sanitize(html) {
    if (typeof DOMPurify !== 'undefined') {
      return DOMPurify.sanitize(html);
    }
    // DOMPurify failed to load — escape all HTML to prevent XSS
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  const VALID_ROLES = ['user', 'assistant'];

  function createMessageElement(role, htmlContent) {
    const safeRole = VALID_ROLES.includes(role) ? role : 'assistant';
    const row = document.createElement('div');
    row.className = `message-row ${safeRole}`;
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = sanitize(htmlContent);
    row.appendChild(bubble);
    return row;
  }

  const API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';

  // Load recent chats on startup
  loadRecentChats();

  // Listen for refresh events
  document.addEventListener('refreshRecentChats', loadRecentChats);

  // Listen for menu events from main process
  if (window.electronAPI && window.electronAPI.onMenuCommand) {
    window.electronAPI.onMenuCommand('menu:new-chat', () => {
      // Clear the chat
      resultsDiv.innerHTML = '';
      // Clear the input field
      chatInput.value = '';
      // Start new chat in database
      if (window.electronAPI) {
        window.electronAPI.newChat();
      }
      // Refresh recent chats
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

      // Clear current results
      resultsDiv.innerHTML = '';

      // Display all messages from the conversation
      messages.forEach(message => {
        resultsDiv.appendChild(createMessageElement(message.role, marked.parse(message.content)));
      });

      // Highlight code blocks
      Prism.highlightAll();

      // Scroll to bottom
      setTimeout(() => {
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
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

    resultsDiv.appendChild(createMessageElement('user', marked.parse(userMsg)));
    chatInput.value = '';

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

    // Scroll to bottom after user message
    setTimeout(() => {
      resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }, 0);

    // Load current settings
    let settings = {
      apiKey: '',
      model: selectedModel || 'mercury-2',
      maxTokens: 16384
    };

    if (window.electronAPI) {
      try {
        settings = await window.electronAPI.loadSettings();
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }

    // Validate API key is set
    if (!settings.apiKey || !settings.apiKey.trim()) {
      const errBox = document.createElement('div');
      errBox.style.cssText = 'padding:20px;margin:20px 0;background:#2d1b1b;border:1px solid #dc3545;border-radius:8px;color:#f8d7da;';
      const heading = document.createElement('h3');
      heading.style.cssText = 'margin:0 0 10px 0;color:#dc3545;';
      heading.textContent = '⚠️ API Key Required';
      const p1 = document.createElement('p');
      p1.style.margin = '0';
      p1.textContent = 'Please set your Inception Labs API key in the settings before making requests.';
      const p2 = document.createElement('p');
      p2.style.cssText = 'margin:10px 0 0 0;font-size:0.9em;opacity:0.8;';
      p2.textContent = 'Click the settings button (⚙️) at the bottom to configure your API key, or ';
      const link = document.createElement('a');
      link.href = 'https://platform.inceptionlabs.ai/dashboard/api-keys';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.color = '#f8d7da';
      link.textContent = 'get one here →';
      p2.appendChild(link);
      errBox.appendChild(heading);
      errBox.appendChild(p1);
      errBox.appendChild(p2);
      resultsDiv.appendChild(errBox);
      resultsDiv.scrollTop = resultsDiv.scrollHeight;
      return;
    }

    const model = settings.model || selectedModel;
    const reasoningToggle = document.getElementById('reasoning-toggle');
    const payload = {
      model,
      messages: [
        { role: 'user', content: userMsg }
      ],
      max_tokens: settings.maxTokens || 16384,
      ...(model === 'mercury-2' && reasoningToggle?.checked ? { reasoning_effort: 'instant' } : {})
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey.trim()}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '[No response]';
      resultsDiv.appendChild(createMessageElement('assistant', marked.parse(reply)));
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

      // Scroll to bottom after assistant reply
      setTimeout(() => {
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
      }, 0);
    } catch (err) {
      const errDiv = document.createElement('div');
      errDiv.style.color = '#ff6b6b';
      errDiv.innerHTML = '<b>Error:</b> ';
      errDiv.appendChild(document.createTextNode(err.message));
      resultsDiv.appendChild(errDiv);
      setTimeout(() => {
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
      }, 0);
    }
  });
});
