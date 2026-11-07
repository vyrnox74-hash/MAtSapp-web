/**
 * MAtSapp main application bootstrap
 * MAT KAI STUDIOS · Mataaxion
 */
(async function App() {
  DB.init();

  let currentUser = null;

  // ---------- Boot ----------
  async function boot() {
    // Splash delay for polish
    await delay(1400);

    currentUser = await DB.getCurrentUser();
    if (currentUser && currentUser.display_name && currentUser.display_name !== currentUser.phone) {
      await enterApp();
    } else if (currentUser) {
      UI.showScreen('profile-setup');
    } else {
      UI.showScreen('login-screen');
    }
  }

  async function enterApp() {
    currentUser = await DB.getCurrentUser();
    document.getElementById('settings-name').textContent = currentUser.display_name || currentUser.phone;
    document.getElementById('settings-status').textContent = currentUser.status_text || 'Hey there! I am using MAtSapp.';
    const settingsAvatar = document.getElementById('settings-avatar');
    if (currentUser.avatar_url) {
      settingsAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="profile" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    } else {
      settingsAvatar.textContent = UI.avatarInitial(currentUser.display_name);
    }

    // Show admin menu item if flagged
    if (currentUser.is_admin || (currentUser.phone && currentUser.phone.endsWith('0000'))) {
      document.getElementById('menu-admin').classList.remove('hidden');
    }

    await Chat.init(currentUser);
    UI.showScreen('app');

    // Load remote app config (admin changes)
    try {
      const cfg = await DB.getAppConfig();
      if (cfg.app_name) {
        document.getElementById('app-bar-title').textContent = cfg.app_name;
        document.title = cfg.app_name;
      }
      if (cfg.maintenance === true || cfg.maintenance === 'true') {
        UI.toast('App is in maintenance mode', 5000);
      }
    } catch (_) {}
  }

  // ---------- Login flow ----------
  const btnContinue = document.getElementById('btn-continue');
  const otpSection = document.getElementById('otp-section');
  let otpMode = false;

  btnContinue.addEventListener('click', async () => {
    try {
      btnContinue.disabled = true;
      if (!otpMode) {
        const code = document.getElementById('country-code').value;
        const num = document.getElementById('phone-input').value.trim();
        await Auth.requestOtp(code, num);
        otpSection.classList.remove('hidden');
        otpMode = true;
        btnContinue.textContent = 'Verify';
        UI.toast(CONFIG.DEMO_MODE ? 'Demo mode: enter any 6 digits (e.g. 123456)' : 'Code sent');
      } else {
        const otp = document.getElementById('otp-input').value.trim();
        const user = await Auth.verifyOtp(otp);
        currentUser = user;
        if (!user.display_name || user.display_name === user.phone) {
          UI.showScreen('profile-setup');
        } else {
          await enterApp();
        }
      }
    } catch (e) {
      console.error('Login error:', e);
      const msg = (e && e.message) ? e.message : 'Something went wrong';
      // Never show raw Supabase provider errors
      if (msg.toLowerCase().includes('phone provider') || msg.toLowerCase().includes('unsupported')) {
        UI.toast('Login system updated. Please hard-refresh the page (clear cache) and try again with code 123456');
      } else {
        UI.toast(msg);
      }
    } finally {
      btnContinue.disabled = false;
    }
  });

  // Profile setup
  document.getElementById('avatar-picker').addEventListener('click', () => {
    document.getElementById('avatar-file').click();
  });
  document.getElementById('avatar-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const preview = document.getElementById('avatar-preview');
      preview.innerHTML = `<img src="${reader.result}" alt="avatar">`;
      preview.dataset.url = reader.result;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-finish-setup').addEventListener('click', async () => {
    const name = document.getElementById('display-name').value.trim();
    if (!name) {
      UI.toast('Please enter your name');
      return;
    }
    const avatar = document.getElementById('avatar-preview').dataset.url || null;
    await Auth.completeProfile({ displayName: name, avatarDataUrl: avatar });
    await enterApp();
  });

  // ---------- Tabs ----------
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => UI.setTab(tab.dataset.tab));
  });

  // ---------- Overflow menu ----------
  const menu = document.getElementById('overflow-menu');
  document.getElementById('btn-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  document.addEventListener('click', () => menu.classList.add('hidden'));

  menu.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    menu.classList.add('hidden');
    switch (action) {
      case 'settings':
        UI.showScreen('settings');
        break;
      case 'admin':
        openAdmin();
        break;
      case 'new-group':
        UI.toast('New group – coming in next update');
        break;
      default:
        UI.toast(action + ' – coming soon');
    }
  });

  // ---------- Navigation ----------
  document.getElementById('btn-back-chat').addEventListener('click', () => Chat.close());
  document.getElementById('btn-back-settings').addEventListener('click', () => UI.showScreen('app'));
  document.getElementById('btn-back-newchat').addEventListener('click', () => UI.showScreen('app'));
  document.getElementById('btn-back-ai').addEventListener('click', () => UI.showScreen('app'));
  document.getElementById('btn-back-admin').addEventListener('click', () => UI.showScreen('app'));

  document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());

  // New chat FAB
  document.getElementById('fab-new-chat').addEventListener('click', () => {
    UI.showScreen('new-chat');
    renderContacts();
  });

  document.getElementById('btn-new-contact').addEventListener('click', async () => {
    const phone = prompt('Enter phone number with country code\n(e.g. +2567XXXXXXX)');
    if (!phone) return;
    const name = prompt('Contact name (optional)') || phone;
    await Chat.startChatWithPhone(phone.replace(/\s/g, ''), name);
  });

  function renderContacts() {
    // In demo we show previously messaged numbers + self
    const list = document.getElementById('contact-list');
    const users = JSON.parse(localStorage.getItem('matsapp_users') || '{}');
    const items = Object.values(users).filter(u => u.id !== currentUser.id);
    if (items.length === 0) {
      list.innerHTML = `<p style="padding:20px;color:#8696A0;text-align:center">No contacts yet. Tap “New contact” to message a number.</p>`;
      return;
    }
    list.innerHTML = items.map(u => `
      <div class="chat-item" data-phone="${u.phone}" data-name="${u.display_name}">
        <div class="avatar">${UI.avatarInitial(u.display_name)}</div>
        <div class="chat-meta">
          <div class="chat-meta-top"><span class="chat-name">${UI.escapeHtml(u.display_name)}</span></div>
          <div class="chat-meta-bottom"><span class="chat-preview">${u.phone}</span></div>
        </div>
      </div>`).join('');
    list.querySelectorAll('.chat-item').forEach(el => {
      el.addEventListener('click', () => {
        Chat.startChatWithPhone(el.dataset.phone, el.dataset.name);
      });
    });
  }

  // Send message
  document.getElementById('btn-send').addEventListener('click', () => {
    Chat.send(document.getElementById('message-input').value);
  });
  document.getElementById('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Chat.send(e.target.value);
  });

  // Status
  document.getElementById('my-status').addEventListener('click', async () => {
    const text = prompt('Status update (visible 24h)');
    if (!text) return;
    await DB.addStatus(currentUser.id, text);
    UI.toast('Status added');
    // simple refresh
    const list = document.getElementById('status-list');
    list.innerHTML = `<div class="chat-item"><div class="avatar">${UI.avatarInitial(currentUser.display_name)}</div>
      <div class="chat-meta"><div class="chat-meta-top"><span class="chat-name">You</span></div>
      <div class="chat-meta-bottom"><span class="chat-preview">${UI.escapeHtml(text)}</span></div></div></div>` + list.innerHTML;
  });

  // Communities
  document.getElementById('btn-new-community').addEventListener('click', () => {
    UI.toast('Community creation will be available after backend connection');
  });

  // Mataax AI (simple local responses + future API hook)
  document.getElementById('btn-search').addEventListener('dblclick', () => {
    // secret: double-click search opens Mataax AI
    UI.showScreen('mataax-ai');
  });
  // Also expose via menu later; for now add a long-press or just open from settings
  document.getElementById('btn-ai-send').addEventListener('click', sendToAI);
  document.getElementById('ai-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendToAI();
  });

  function sendToAI() {
    const input = document.getElementById('ai-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const box = document.getElementById('ai-messages');
    box.innerHTML += `<div class="ai-bubble user">${UI.escapeHtml(text)}</div>`;
    // Simple local replies (replace with real LLM endpoint later)
    setTimeout(() => {
      const reply = mataaxReply(text);
      box.innerHTML += `<div class="ai-bubble assistant">${reply}</div>`;
      box.scrollTop = box.scrollHeight;
    }, 600);
  }

  function mataaxReply(q) {
    const lower = q.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi')) return 'Hello! I am Mataax AI, built into MAtSapp by Mataaxion. How can I help you today?';
    if (lower.includes('who are you')) return 'I am Mataax AI – the intelligent assistant of MAtSapp, created by MAT KAI STUDIOS / Mataaxion.';
    if (lower.includes('whatsapp')) return 'MAtSapp is an independent messaging platform inspired by familiar patterns, engineered by Mataaxion.';
    return 'Thanks for your message. Full Mataax AI cloud intelligence can be connected via an API key in a future update. For now I run locally inside the app.';
  }

  // ---------- Admin ----------
  async function openAdmin() {
    const cfg = await DB.getAppConfig();
    document.getElementById('admin-app-name').value = cfg.app_name || 'MAtSapp';
    document.getElementById('admin-tagline').value = cfg.tagline || 'Connect Beyond Limits';
    document.getElementById('admin-welcome').value = cfg.welcome_message || '';
    document.getElementById('admin-maintenance').value = String(cfg.maintenance || false);
    UI.showScreen('admin-panel');
  }

  document.getElementById('btn-save-admin').addEventListener('click', async () => {
    const config = {
      app_name: document.getElementById('admin-app-name').value.trim(),
      tagline: document.getElementById('admin-tagline').value.trim(),
      welcome_message: document.getElementById('admin-welcome').value.trim(),
      maintenance: document.getElementById('admin-maintenance').value === 'true'
    };
    await DB.saveAppConfig(config);
    document.getElementById('app-bar-title').textContent = config.app_name;
    UI.toast('Configuration saved – applies to all users');
  });

  document.getElementById('btn-broadcast').addEventListener('click', () => {
    const msg = document.getElementById('admin-broadcast').value.trim();
    if (!msg) return;
    UI.toast('Broadcast queued (connect Supabase + Edge Function for real push)');
  });

  // Clear cache
  document.getElementById('btn-clear-cache').addEventListener('click', () => {
    if (confirm('Clear local cache and demo data? You will stay logged in.')) {
      // keep current user
      const user = localStorage.getItem('matsapp_currentUser');
      const keys = Object.keys(localStorage).filter(k => k.startsWith('matsapp_') && k !== 'matsapp_currentUser');
      keys.forEach(k => localStorage.removeItem(k));
      if (user) localStorage.setItem('matsapp_currentUser', user);
      UI.toast('Cache cleared');
      Chat.refreshList();
    }
  });

  // PWA install prompt helper
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Start
  boot();
})();
