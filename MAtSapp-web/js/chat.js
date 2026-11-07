/**
 * Chat logic – open conversation, send/receive messages
 */
const Chat = (() => {
  let currentConvId = null;
  let currentTitle = '';
  let currentUser = null;
  let subscription = null;

  async function init(user) {
    currentUser = user;
    await refreshList();
  }

  async function refreshList() {
    if (!currentUser) return;
    const convs = await DB.getConversations(currentUser.id);
    UI.renderChatList(convs, currentUser.id);
  }

  async function open(conversationId, title) {
    currentConvId = conversationId;
    currentTitle = title || conversationId;

    document.getElementById('chat-title').textContent = currentTitle;
    document.getElementById('chat-subtitle').textContent = 'tap here for info';
    document.getElementById('chat-avatar').textContent = UI.avatarInitial(currentTitle);

    const messages = await DB.getMessages(conversationId);
    UI.renderMessages(messages, currentUser.id);

    // Realtime
    if (subscription) subscription.unsubscribe();
    subscription = DB.subscribeMessages(conversationId, (msg) => {
      const box = document.getElementById('messages');
      const mine = msg.sender_id === currentUser.id;
      const div = document.createElement('div');
      div.className = 'message ' + (mine ? 'out' : 'in');
      div.innerHTML = `${UI.escapeHtml(msg.content)}<span class="time">${UI.formatTime(msg.created_at)}${mine ? ' <span class="ticks">✓✓</span>' : ''}</span>`;
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

    try {
      const msg = await DB.sendMessage({
        conversationId: currentConvId,
        senderId: currentUser.id,
        content
      });
      // Optimistic UI (demo has no realtime push to self)
      if (CONFIG.DEMO_MODE) {
        const box = document.getElementById('messages');
        const div = document.createElement('div');
        div.className = 'message out';
        div.innerHTML = `${UI.escapeHtml(content)}<span class="time">${UI.formatTime(msg.created_at)} <span class="ticks">✓✓</span></span>`;
        box.appendChild(div);
        box.scrollTop = box.scrollHeight;
      }
      await refreshList();
    } catch (e) {
      UI.toast('Failed to send: ' + e.message);
    }
  }

  async function startChatWithPhone(phone, name) {
    const conv = await DB.getOrCreatePrivateConversation(
      currentUser.id,
      phone,
      name || phone
    );
    await open(conv.id, conv.title);
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
