/**
 * MAtSapp Configuration
 * MAT KAI STUDIOS · Mataaxion
 */
const CONFIG = {
  // ---- SUPABASE ----
  SUPABASE_URL: 'https://ulpuafxqtzmobapseytd.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscHVhZnhxdHptb2JhcHNleXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4OTU1NDIsImV4cCI6MjEwOTQ3MTU0Mn0.vHt03w3YRBbTzRLeBg89goSv-iVfrXzXIfbRxrIOsHw',

  // App identity
  APP_NAME: 'MAtSapp',
  TAGLINE: 'Connect Beyond Limits',
  WATERMARK: 'by Mataaxion',

  // Feature flags
  FEATURES: {
    status: true,
    communities: true,
    calls: true,
    mataaxAI: true,
    adminPanel: true
  },

  // Real mode – Supabase connected
  DEMO_MODE: false
};

console.info('%cMAtSapp connected to Supabase – real-time messaging active', 'color:#25D366; font-weight:bold');
