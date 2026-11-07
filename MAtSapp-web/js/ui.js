/**
 * UI helpers – screen navigation, toasts, rendering
 */
const UI = (() => {
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function toast(msg, ms = 2500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), ms);
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  function avatarInitial(name) {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  function renderChatList(conversations, currentUserId) {
    const list = document.getElementById('chat-list');
    if (!conversations || conversations.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <h3>Start chatting on MAtSapp</h3>
          <p>Tap the chat button below to message a phone number.</p>
        </div>`;
      return;
    }

    list.innerHTML = conversations.map(c => {
      const name = c.title || c.id;
      const preview = c.lastMessage || 'Start a conversation';
      const time = c.lastMessageAt ? formatTime(c.lastMessageAt) : '';
      const unread = c.unread || 0;
      return `
        <div class="chat-item" data-id="${c.id}" data-title="${name}">
          <div class="avatar">${avatarInitial(name)}</div>
          <div class="chat-meta">
            <div class="chat-meta-top">
              <span class="chat-name">${escapeHtml(name)}</span>
              <span class="chat-time ${unread ? 'unread' : ''}">${time}</span>
            </div>
            <div class="chat-meta-bottom">
              <span class="chat-preview">${escapeHtml(preview)}</span>
              ${unread ? `<span class="badge">${unread}</span>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.chat-item').forEach(item => {
      item.addEventListener('click', () => {
        Chat.open(item.dataset.id, item.dataset.title);
      });
    });
  }

  function renderMessages(messages, currentUserId) {
    const box = document.getElementById('messages');
    box.innerHTML = messages.map(m => {
      const mine = m.sender_id === currentUserId;
      const time = formatTime(m.created_at);
      return `
        <div class="message ${mine ? 'out' : 'in'}">
          ${escapeHtml(m.content)}
          <span class="time">${time}${mine ? ' <span class="ticks">✓✓</span>' : ''}</span>
        </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setTab(name) {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });
  }

  return {
    showScreen,
    toast,
    formatTime,
    avatarInitial,
    renderChatList,
    renderMessages,
    setTab,
    escapeHtml
  };
})();
