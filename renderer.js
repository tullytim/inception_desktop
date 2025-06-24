// Renderer process - handles chat UI and API calls

document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const modelSelect = document.getElementById('model-select');
  const resultsDiv = document.getElementById('results');

  const API_KEY = 'sk_aeaa96f1fe26076c7b3135a9dce704b7';
  const API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';

  // Load recent chats on startup
  loadRecentChats();

  // Listen for refresh events
  document.addEventListener('refreshRecentChats', loadRecentChats);

  async function loadRecentChats() {
    if (!window.electronAPI) return;
    
    try {
      const recentChats = await window.electronAPI.getRecentChats();
      console.log('Recent chats loaded:', recentChats.length);
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
      
      chatItem.innerHTML = `
        <div class="recent-chat-title">${title}</div>
        <div class="recent-chat-date">${date}</div>
      `;
      
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
        if (message.role === 'user') {
          resultsDiv.innerHTML += `<div style="margin-bottom:16px;"><b>You:</b><br>${marked.parse(message.content)}</div>`;
        } else {
          resultsDiv.innerHTML += `<div style="margin-bottom:24px;"><b>Assistant:</b><br>${marked.parse(message.content)}</div>`;
        }
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

    resultsDiv.innerHTML += `<div style="margin-bottom:16px;"><b>You:</b><br>${marked.parse(userMsg)}</div>`;
    chatInput.value = '';

    // Save user message to database
    if (window.electronAPI) {
      try {
        console.log('Saving user message:', userMsg);
        const result = await window.electronAPI.saveMessage('user', userMsg);
        if (result) {
          console.log('User message saved successfully');
          // Refresh recent chats list after user message
          setTimeout(() => loadRecentChats(), 100);
        } else {
          console.log('Database not available - message not saved');
        }
      } catch (err) {
        console.error('Failed to save user message:', err);
      }
    }

    // Scroll to bottom after user message
    setTimeout(() => {
      resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }, 0);

    const payload = {
      model: selectedModel,
      messages: [
        { role: 'user', content: userMsg }
      ],
      max_tokens: 30000
    };

    console.log('Using model:', selectedModel);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '[No response]';
      resultsDiv.innerHTML += `<div style="margin-bottom:24px;"><b>Assistant:</b><br>${marked.parse(reply)}</div>`;
      Prism.highlightAll();
      
      // Save assistant message to database
      if (window.electronAPI) {
        try {
          console.log('Saving assistant message:', reply.substring(0, 100) + '...');
          const result = await window.electronAPI.saveMessage('assistant', reply);
          if (result) {
            console.log('Assistant message saved successfully');
            // Refresh recent chats list after assistant message
            setTimeout(() => loadRecentChats(), 100);
          } else {
            console.log('Database not available - message not saved');
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
      resultsDiv.innerHTML += `<div style="color:#ff6b6b;"><b>Error:</b> ${err.message}</div>`;
      setTimeout(() => {
        resultsDiv.scrollTop = resultsDiv.scrollHeight;
      }, 0);
    }
  });
});
