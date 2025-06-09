// Renderer process - handles chat UI and API calls

document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const resultsDiv = document.getElementById('results');

  const API_KEY = 'sk_aeaa96f1fe26076c7b3135a9dce704b7';
  const API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userMsg = chatInput.value.trim();
    if (!userMsg) return;

    resultsDiv.innerHTML += `<div style="margin-bottom:16px;"><b>You:</b><br>${marked.parse(userMsg)}</div>`;
    chatInput.value = '';

    // Scroll to bottom after user message
    setTimeout(() => {
      resultsDiv.scrollTop = resultsDiv.scrollHeight;
    }, 0);

    const payload = {
      model: 'mercury-coder-small',
      messages: [
        { role: 'user', content: userMsg }
      ],
      max_tokens: 30000
    };

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
