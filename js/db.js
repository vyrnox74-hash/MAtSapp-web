/**
 * Database layer – Supabase + localStorage fallback
 * Fixed for reliable multi-device messaging
 */
const DB = (() => {
  let supabase = null;
  const LS_PREFIX = 'matsapp_';

  function init() {
    if (!CONFIG.DEMO_MODE && window.supabase) {
      supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
        realtime: {
          params: { eventsPerSecond: 10 }
        }
      });
      console.info('%c[MAtSapp] Supabase connected', 'color:#25D366');
    }
    return supabase;
  }

  function lsGet(key, fallback = null) {
    try {
      const v = localStorage.getItem(LS_PREFIX + key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  }
  function lsSet(key, value) {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  }

  // ---------- Users ----------
  async function getCurrentUser() {
    const local = lsGet('currentUser');
    if (!local) return null;

    if (supabase && local.phone) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('phone', local.phone)
          .maybeSingle();
        if (data) {
          const user = {
            id: data.phone,
            phone: data.phone,
            display_name: data.display_name || data.phone,
            avatar_url: data.avatar_url,
            status_text: data.status_text,
            is_admin: data.is_admin
          };
          lsSet('currentUser', user);
          return user;
        }
      } catch (e) {
        console.warn('getCurrentUser refresh failed', e);
      }
    }
    return local;
  }

  async function saveUser(user) {
    user.id = user.phone;
    lsSet('currentUser', user);

    const users = lsGet('users', {});
    users[user.phone] = user;
    lsSet('users', users);

    if (supabase) {
      const { error } = await supabase.from('profiles').upsert({
        phone: user.phone,
        display_name: user.display_name || user.phone,
        avatar_url: user.avatar_url || null,
        status_text: user.status_text || 'Hey there! I am using MAtSapp.',
        is_admin: !!user.is_admin,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' });

      if (error) console.error('saveUser error:', error.message);
    }
    return user;
  }

  async function findUserByPhone(phone) {
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
      if (error) console.warn(error);
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
          conversation_id,
          conversations (
            id,
            type,
            title,
            last_message,
            last_message_at
          )
        `)
        .eq('user_phone', userId);

      if (error) {
        console.error('getConversations error:', error);
        return [];
      }

      return (data || [])
        .filter(row => row.conversations)
        .map(row => ({
          id: row.conversations.id,
          title: row.conversations.title,
          lastMessage: row.conversations.last_message || '',
          lastMessageAt: row.conversations.last_message_at
            ? new Date(row.conversations.last_message_at).getTime()
            : 0,
          unread: row.unread_count || 0,
          pinned: row.pinned
        }))
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    }

    // local fallback
    const all = lsGet('conversations', {});
    return Object.values(all)
      .filter(c => c.members && c.members.includes(userId))
      .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
  }

  async function getOrCreatePrivateConversation(myId, otherPhone, otherName) {
    const convId = [String(myId), String(otherPhone)].sort().join('_');

    if (supabase) {
      // 1. Ensure both profiles exist
      await supabase.from('profiles').upsert([
        { phone: myId, display_name: myId },
        { phone: otherPhone, display_name: otherName || otherPhone }
      ], { onConflict: 'phone' });

      // 2. Check conversation
      let { data: existing } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', convId)
        .maybeSingle();

      if (!existing) {
        const { error: cErr } = await supabase.from('conversations').insert({
          id: convId,
          type: 'private',
          title: otherName || otherPhone,
          last_message: '',
          last_message_at: new Date().toISOString()
        });
        if (cErr) console.error('create conversation error:', cErr);
      }

      // 3. Ensure BOTH users are members
      const { error: mErr } = await supabase.from('conversation_members').upsert([
        { conversation_id: convId, user_phone: myId },
        { conversation_id: convId, user_phone: otherPhone }
      ], { onConflict: 'conversation_id,user_phone' });

      if (mErr) console.error('members upsert error:', mErr);

      // Re-fetch
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', convId)
        .single();

      return {
        id: convId,
        title: (conv && conv.title) || otherName || otherPhone,
        lastMessage: (conv && conv.last_message) || '',
        lastMessageAt: conv && conv.last_message_at
          ? new Date(conv.last_message_at).getTime()
          : Date.now()
      };
    }

    // local fallback
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
        .limit(200);

      if (error) {
        console.error('getMessages error:', error);
        return [];
      }
      return data || [];
    }

    const all = lsGet('messages', {});
    return all[conversationId] || [];
  }

  async function sendMessage({ conversationId, senderId, content, type = 'text' }) {
    const payload = {
      conversation_id: conversationId,
      sender_id: senderId,
      content: content,
      type: type,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('messages')
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error('sendMessage error:', error);
        throw new Error(error.message || 'Failed to send');
      }

      // Update conversation preview
      await supabase
        .from('conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString()
        })
        .eq('id', conversationId);

      console.log('%c[MAtSapp] Message saved to Supabase', 'color:#25D366', data);
      return data;
    }

    // local
    payload.id = 'm_' + Date.now();
    const all = lsGet('messages', {});
    if (!all[conversationId]) all[conversationId] = [];
    all[conversationId].push(payload);
    lsSet('messages', all);

    const convs = lsGet('conversations', {});
    if (convs[conversationId]) {
      convs[conversationId].lastMessage = content;
      convs[conversationId].lastMessageAt = Date.now();
      lsSet('conversations', convs);
    }
    return payload;
  }

  // Realtime – listen for new messages in a conversation
  function subscribeMessages(conversationId, callback) {
    if (!supabase) {
      console.warn('No supabase – realtime disabled');
      return { unsubscribe: () => {} };
    }

    const channelName = 'chat:' + conversationId;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('%c[MAtSapp] Realtime message received', 'color:#25D366', payload.new);
          callback(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('[MAtSapp] Realtime status:', status);
      });

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  }

  // Also allow listening for any new conversations for a user (for chat list updates)
  function subscribeConversations(userPhone, callback) {
    if (!supabase) return { unsubscribe: () => {} };

    const channel = supabase
      .channel('user-convs:' + userPhone)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => callback()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => callback()
      )
      .subscribe();

    return {
      unsubscribe: () => supabase.removeChannel(channel)
    };
  }

  // ---------- App config ----------
  async function getAppConfig() {
    if (supabase) {
      const { data } = await supabase.from('app_config').select('*').eq('id', 1).maybeSingle();
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
      await supabase.from('app_config').upsert({ id: 1, ...config, updated_at: new Date().toISOString() });
      return;
    }
    lsSet('appConfig', config);
  }

  async function getStatuses() { return lsGet('statuses', []); }
  async function addStatus(userId, text) {
    const status = { id: 's_' + Date.now(), user_id: userId, text, created_at: Date.now() };
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
    subscribeConversations,
    getAppConfig,
    saveAppConfig,
    getStatuses,
    addStatus,
    get supabase() { return supabase; },
    get isDemo() { return CONFIG.DEMO_MODE; }
  };
})();
