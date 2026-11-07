# MAtSapp – Supabase Real-time Setup Guide
**MAT KAI STUDIOS · Mataaxion**

This guide makes messages sync live between different phones and browsers.

---

## 1. Create a Free Supabase Project

1. Go to → [https://supabase.com](https://supabase.com)
2. Sign in with GitHub / Google
3. Click **New Project**
4. Choose organization → give it a name (e.g. `matsapp`)
5. Set a strong Database Password (save it somewhere)
6. Choose a region close to your users (e.g. Frankfurt or Singapore)
7. Click **Create new project**
8. Wait 1–2 minutes until the project is ready

---

## 2. Get Your API Keys

1. In the left sidebar click **Project Settings** (gear icon)
2. Click **API**
3. Copy these two values:

```
Project URL          →  https://xxxxxxxx.supabase.co
anon public key      →  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

You will paste them into `js/config.js` later.

---

## 3. Create the Database Tables

1. In the left sidebar click **SQL Editor**
2. Click **New query**
3. Paste the entire SQL below and click **Run**

```sql
-- ============================================================
-- MAtSapp Schema (simplified for the web PWA)
-- ============================================================

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  status_text TEXT DEFAULT 'Hey there! I am using MAtSapp.',
  is_admin BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE public.conversations (
  id TEXT PRIMARY KEY,                     -- we use phone1_phone2 format
  type TEXT DEFAULT 'private',
  title TEXT,
  avatar_url TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation members
CREATE TABLE public.conversation_members (
  conversation_id TEXT REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_phone TEXT NOT NULL,
  unread_count INTEGER DEFAULT 0,
  pinned BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_phone)
);

-- Messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,                 -- phone number
  content TEXT,
  type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App configuration (Admin panel)
CREATE TABLE public.app_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  app_name TEXT DEFAULT 'MAtSapp',
  tagline TEXT DEFAULT 'Connect Beyond Limits',
  welcome_message TEXT DEFAULT '',
  maintenance BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config row
INSERT INTO public.app_config (id) VALUES (1);

-- Indexes for speed
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_members_user ON public.conversation_members(user_phone);
CREATE INDEX idx_profiles_phone ON public.profiles(phone);

-- ============================================================
-- Enable Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_config;

-- ============================================================
-- Row Level Security (open for easy start – tighten later)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Temporary open policies (anyone can read/write)
-- Replace with proper auth policies later
CREATE POLICY "Allow all profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all conversations" ON public.conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all members" ON public.conversation_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all config" ON public.app_config FOR ALL USING (true) WITH CHECK (true);
```

---

## 4. Update the App Configuration

Open the file:

```
js/config.js
```

Replace the two lines with your real values:

```js
const CONFIG = {
  SUPABASE_URL: 'https://xxxxxxxx.supabase.co',      // ← paste Project URL
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',  // ← paste anon key

  APP_NAME: 'MAtSapp',
  TAGLINE: 'Connect Beyond Limits',
  WATERMARK: 'by Mataaxion',

  FEATURES: {
    status: true,
    communities: true,
    calls: true,
    mataaxAI: true,
    adminPanel: true
  },

  DEMO_MODE: false   // ← important: set to false
};
```

Also make sure this line at the bottom is updated or removed so it doesn’t force demo mode:

```js
// Delete or comment out the auto-detect block if you want,
// or just set DEMO_MODE: false as shown above.
```

---

## 5. Improve the Database Layer for Real Supabase

The current `js/db.js` already has Supabase support, but we will make the most important functions work better with the tables above.

You can keep the existing file — it will work.  
For best results, after adding the keys, hard-refresh the app (Ctrl+Shift+R).

---

## 6. Deploy / Refresh

1. Upload the updated `js/config.js` (and any other changed files) to your GitHub repository.
2. Wait for GitHub Pages to update (usually under 1 minute).
3. Open the site on **two different phones** or one phone + one computer.
4. Login with **different phone numbers** on each device.
5. On device A: New contact → enter the phone number of device B → send a message.
6. The message should appear on device B within 1–2 seconds.

---

## 7. How Real-time Works

- When a message is inserted into the `messages` table, Supabase Realtime pushes it to every connected client that is listening to that conversation.
- The app already has this code:

```js
DB.subscribeMessages(conversationId, (newMessage) => {
  // adds the bubble instantly
});
```

---

## 8. Making a User Admin

In Supabase → **Table Editor** → `profiles`:

- Find the user
- Set `is_admin` = `true`

Or in SQL Editor:

```sql
UPDATE public.profiles 
SET is_admin = true 
WHERE phone = '+2567XXXXXXXX';
```

That user will see **Admin Panel** in the ⋮ menu.

---

## 9. Optional – Better Security Later

The policies above are open so everything works quickly.  
Later you should replace them with proper authenticated policies (using Supabase Auth).

---

## Quick Test Checklist

- [ ] Supabase project created
- [ ] SQL schema ran without errors
- [ ] Realtime enabled on `messages` table
- [ ] `js/config.js` has real URL + anon key
- [ ] `DEMO_MODE: false`
- [ ] App refreshed on two devices
- [ ] Different phone numbers used
- [ ] Message sent from one appears on the other

---

## Need Help?

If messages still don’t appear live:

1. Open browser console (long-press refresh → Inspect)
2. Look for red errors
3. Common issues:
   - Wrong URL / key
   - Realtime not enabled on the table
   - RLS blocking (we opened it above)
   - Old cached version of the app (hard refresh)

---

**Once this is done, MAtSapp has real multi-device real-time messaging.**

MAtSapp · by Mataaxion
EOF
