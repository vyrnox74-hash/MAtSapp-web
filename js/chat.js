/**
 * Chat logic – open conversation, send/receive messages (realtime)
 */
const Chat = (() => {
  let currentConvId = null;
  let currentTitle = '';
  let currentUser = null;
  let subscription = null;
  let listSubscription = null;

  async function init(user) {
    currentUser = user;
    await refreshList();

    // Keep chat list updated when any new message arrives
    if (listSubscription) listSubscription.unsubscribe();
    listSubscription = DB.subscribeConversations(user.id || user.phone, () => {
      refreshList();
    });
  }

  async function refreshList() {
    if (!currentUser) return;
    try {
      const convs = await DB.getConversations(currentUser.id || currentUser.phone);
      UI.renderChatList(convs, currentUser.id || currentUser.phone);
    } catch (e) {
      console.error('refreshList failed', e);
    }
  }

  async function open(conversationId, title) {
    currentConvId = conversationId;
    currentTitle = title || conversationId;

    document.getElementById('chat-title').textContent = currentTitle;
    document.getElementById('chat-subtitle').textContent = 'online';
    document.getElementById('chat-avatar').textContent = UI.avatarInitial(currentTitle);

    // Load existing messages
    const messages = await DB.getMessages(conversationId);
    UI.renderMessages(messages, currentUser.id || currentUser.phone);

    // Subscribe to new messages
    if (subscription) subscription.unsubscribe();
    subscription = DB.subscribeMessages(conversationId, (msg) => {
      // Avoid showing our own message twice (we already add it optimistically)
      if (msg.sender_id === (currentUser.id || currentUser.phone)) return;

      const box = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = 'message in';
      div.innerHTML = `${UI.escapeHtml(msg.content)}<span class="time">${UI.formatTime(msg.created_at)}</span>`;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;

      refreshList();
    });

    UI.showScreen('chat-detail');
    document.getElementById('message-input').focus();
  }

  async function send(text) {
    if (!text || !text.trim() || !currentConvId) return;
    const content = text.trim();
    document.getElementById('message-input').value = '';

    const myId = currentUser.id || currentUser.phone;

    try {
      const msg = await DB.sendMessage({
        conversationId: currentConvId,
        senderId: myId,
        content
      });

      // Show immediately
      const box = document.getElementById('messages');
      const div = document.createElement('div');
      div.className = 'message out';
      div.innerHTML = `${UI.escapeHtml(content)}<span class="time">${UI.formatTime(msg.created_at || Date.now())} <span class="ticks">✓✓</span></span>`;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;

      await refreshList();
    } catch (e) {
      console.error(e);
      UI.toast('Failed to send: ' + (e.message || 'error'));
    }
  }

  async function startChatWithPhone(phone, name) {
    const myId = currentUser.id || currentUser.phone;
    UI.toast('Opening chat...');
    try {
      const conv = await DB.getOrCreatePrivateConversation(myId, phone, name || phone);
      await open(conv.id, conv.title || name || phone);
    } catch (e) {
      console.error(e);
      UI.toast('Could not start chat: ' + (e.message || ''));
    }
  }

  function close() {
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
    currentConvId = null;
    UI.showScreen('app');
    refreshList();
  }

  return {
    init,
    open,
    send,
    startChatWithPhone,
    close,
    refreshList,
    get currentConvId() { return currentConvId; }
  };
})();
