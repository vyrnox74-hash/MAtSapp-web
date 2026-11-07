# MAtSapp – Web PWA
**Connect Beyond Limits**  
MAT KAI STUDIOS · Engineered by Mataaxion

A WhatsApp-inspired messaging Progressive Web App that runs on **GitHub Pages** (or any static host).

## Features
- Phone-number login (demo mode works offline; real SMS via Supabase Phone Auth)
- Chats list + real conversation UI
- Send messages to any number you add
- Updates / Status
- Communities & Calls tabs (UI ready)
- Mataax AI assistant
- Admin panel (change app name, tagline, maintenance mode without code edits)
- Installable PWA (Add to Home Screen)
- “by Mataaxion” watermark
- Works in pure DEMO mode with localStorage, or with full Supabase backend

## Quick Start (GitHub Pages)

1. Create a new GitHub repository (e.g. `matsapp`).
2. Upload **all files** from this `MAtSapp-web` folder to the root of the repo (or into a `docs/` folder).
3. In the repository: **Settings → Pages → Source**: Deploy from branch `main` (root or `/docs`).
4. After a minute your app is live at:  
   `https://YOUR_USERNAME.github.io/matsapp/`

## Making Real Multi-User Messaging Work

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor run the migrations from the earlier `/supabase` folder (or the simplified schema).
3. Enable **Phone Auth** (or Email magic link) in Authentication → Providers.
4. Open `js/config.js` and replace:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ...'
   ```
5. Commit & push. The app will automatically leave DEMO mode.

### Demo Mode (no backend)
- Any phone number works.
- Use OTP `123456` or any 6 digits.
- Messages stay on the device (localStorage).
- To test “two users”, open the site in two different browsers / profiles and use different numbers.
- Numbers ending in `0000` get the Admin menu.

## Admin Access
- Login with a phone number ending in `0000` (demo) or set `is_admin: true` on the profile.
- Menu (⋮) → Admin Panel.
- Change app name, tagline, maintenance flag – stored in the database / localStorage and applied to clients.

## PWA Install
- Android Chrome: menu → “Install app” / “Add to Home screen”.
- iOS Safari: Share → Add to Home Screen.
- The app then opens full-screen like a native app.

## File Structure
```
index.html          ← entry (GitHub Pages default)
css/styles.css
js/
  config.js         ← put your Supabase keys here
  db.js
  auth.js
  ui.js
  chat.js
  app.js
manifest.json
sw.js               ← service worker
icons/
```

## Logo
Replace `icons/icon-192.png` and `icons/icon-512.png` with real PNG icons (the included SVG can be converted at https://realfavicongenerator.net or similar).

## Important Notes
- GitHub Pages is **static**. Realtime multi-device messaging requires the Supabase (or other) backend.
- Calling (voice/video) needs WebRTC + a signaling server (future phase).
- Never commit real service-role keys. Only the anon key belongs in the frontend.

---
MAtSapp · by Mataaxion · MAT KAI STUDIOS
