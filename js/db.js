/**
 * Database layer – Supabase when configured, otherwise localStorage demo store
 * Updated for simplified phone-based schema
 */
const DB = (() => {
  let supabase = null;
  const LS_PREFIX = 'matsapp_';

  function init() {
    if (!CONFIG.DEMO_MODE && window.supabase) {
      supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      console.info('%cSupabase client ready – real-time enabled', 'color:#25D366');
    }
    return supabase;
  }

  // ---------- Local helpers (demo mode) ----------
  function lsGet(key, fallback = null) {
    try {
      const v = localStorage.getItem(LS_PREFIX + key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }
  function lsSet(key, value) {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  }

  // ---------- Profiles / Auth state ----------
  async function getCurrentUser() {
    if (supabase) {
      // We store the current phone in localStorage even with Supabase
      // so we don't force Supabase Auth for the simple phone flow
      const local = lsGet('currentUser');
      if (local && local.phone) {
        // Refresh from server
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('phone', local.phone)
          .maybeSingle();
        if (data) {
          const user = {
            id: data.phone,           // use phone as id for simplicity
            phone: data.phone,
            display_name: data.display_name,
            avatar_url: data.avatar_url,
            status_text: data.status_text,
            is_admin: data.is_admin
          };
          lsSet('currentUser', user);
          return user;
        }
      }
      return local;
    }
    return lsGet('currentUser');
  }

  async function saveUser(user) {
    // Always keep a local copy
    lsSet('currentUser', user);
    const users = lsGet('users', {});
    users[user.phone] = user;
    lsSet('users', users);

    if (supabase) {
      // Upsert into profiles table
      const { error } = await supabase.from('profiles').upsert({
        phone: user.phone,
        display_name: user.display_name,
        avatar_url: user.avatar_url || null,
        status_text: user.status_text || 'Hey there! I am using MAtSapp.',
        is_admin: user.is_admin || false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' });

      if (error) console.warn('Profile save error:', error.message);
    }
    return user;
  }

  async function findUserByPhone(phone) {
    if (supabase) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
      if (data) {
        return {
          id: data.phone,
          phone: data.phone,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          status_text: data.status_text,
          is_admin: data.is_admin
        };
      }
      return null;
    }
    const users = lsGet('users', {});
    return users[phone] || null;
  }

  // ---------- Conversations ----------
  async function getConversations(userId) {
    if (supabase) {
      const { data, error } = await supabase
        .from('conversation_members')
        .select(`
          unread_count,
          pinned,
          archived,
          conversation_id,
          conversations (
            id,
            type,
            title,
            avatar_url,
            last_message,
            last_message_at
          )
        `)
        .eq('user_phone', userId);

      if (error) {
        console.warn(error);
        return [];
      }

      return (data || []).map(row => ({
        id: row.conversations?.id || row.conversation_id,
        title: row.conversations?.title,
        lastMessage: row.conversations?.last_message || '',
        lastMessageAt: row.conversations?.last_message_at
          ? new Date(row.conversations.last_message_at).getTime()
          : 0,
        unread: row.unread_count || 0,
        pinned: row.pinned,
        type: row.conversations?.type || 'private'
      })).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    }

    // Demo path
    const all = lsGet('conversations', {});
    return Object.values(all)
      .filter(c => c.members && c.members.includes(userId))
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  }

  async function getOrCreatePrivateConversation(myId, otherPhone, otherName) {
    const convId = [myId, otherPhone].sort().join('_');

    if (supabase) {
      // Check if exists
      const { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', convId)
        .maybeSingle();

      if (existing) return {
        id: existing.id,
        title: existing.title,
        lastMessage: existing.last_message,
        lastMessageAt: existing.last_message_at
      };

      // Create conversation
      await supabase.from('conversations').insert({
        id: convId,
        type: 'private',
        title: otherName || otherPhone,
        last_message: '',
        last_message_at: new Date().toISOString()
      });

      // Add both members
      await supabase.from('conversation_members').upsert([
        { conversation_id: convId, user_phone: myId },
        { conversation_id: convId, user_phone: otherPhone }
      ]);

      // Also make sure the other user has a profile
      await supabase.from('profiles').upsert({
        phone: otherPhone,
        display_name: otherName || otherPhone
      }, { onConflict: 'phone' });

      return {
        id: convId,
        title: otherName || otherPhone,
        lastMessage: '',
        lastMessageAt: Date.now()
      };
    }

    // Demo path
    const all = lsGet('conversations', {});
    if (all[convId]) return all[convId];

    const conv = {
      id: convId,
      type: 'private',
      title: otherName || otherPhone,
      members: [myId, otherPhone],
      lastMessageAt: Date.now(),
      lastMessage: '',
      unread: 0
    };
    all[convId] = conv;
    lsSet('conversations', all);
    return conv;
  }

  // ---------- Messages ----------
  async function getMessages(conversationId) {
    if (supabase) {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(150);

      if (error) {
        console.warn(error);
        return [];
      }
      return data || [];
    }

    const all = lsGet('messages', {});
    return all[conversationId] || [];
  }

  async function sendMessage({ conversationId, senderId, content, type = 'text' }) {
    const msg = {
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      type,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('messages')
        .insert(msg)
        .select()
        .single();

      if (error) throw error;

      // Update conversation preview
      await supabase
        .from('conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      return data;
    }

    // Demo
    msg.id = 'm_' + Date.now();
    const all = lsGet('messages', {});
    if (!all[conversationId]) all[conversationId] = [];
    all[conversationId].push(msg);
    lsSet('messages', all);

    const convs = lsGet('conversations', {});
    if (convs[conversationId]) {
      convs[conversationId].lastMessage = content;
      convs[conversationId].lastMessageAt = Date.now();
      lsSet('conversations', convs);
    }
    return msg;
  }

  // Realtime subscription
  function subscribeMessages(conversationId, callback) {
    if (!supabase) {
      return { unsubscribe: () => {} };
    }

    const channel = supabase
      .channel('messages:' + conversationId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  }

  // ---------- App config (Admin) ----------
  async function getAppConfig() {
    if (supabase) {
      const { data } = await supabase
        .from('app_config')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      return data || {};
    }
    return lsGet('appConfig', {
      app_name: CONFIG.APP_NAME,
      tagline: CONFIG.TAGLINE,
      welcome_message: '',
      maintenance: false
    });
  }

  async function saveAppConfig(config) {
    if (supabase) {
      await supabase.from('app_config').upsert({
        id: 1,
        ...config,
        updated_at: new Date().toISOString()
      });
      return;
    }
    lsSet('appConfig', config);
  }

  // ---------- Status updates ----------
  async function getStatuses() {
    return lsGet('statuses', []);
  }

  async function addStatus(userId, text, mediaUrl) {
    const status = {
      id: 's_' + Date.now(),
      user_id: userId,
      text,
      media_url: mediaUrl,
      created_at: Date.now(),
      expires_at: Date.now() + 24 * 60 * 60 * 1000
    };
    const list = lsGet('statuses', []);
    list.unshift(status);
    lsSet('statuses', list);
    return status;
  }

  return {
    init,
    getCurrentUser,
    saveUser,
    findUserByPhone,
    getConversations,
    getOrCreatePrivateConversation,
    getMessages,
    sendMessage,
    subscribeMessages,
    getAppConfig,
    saveAppConfig,
    getStatuses,
    addStatus,
    get supabase() { return supabase; },
    get isDemo() { return CONFIG.DEMO_MODE; }
  };
})();
