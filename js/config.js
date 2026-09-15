/* ==========================================================
   IPE Voting System
   config.js
   ========================================================== */

 /* -----------------------------
    Supabase Configuration
    Priority:
    1. window.ENV_CONFIG (from config.local.js - for local dev)
    2. window.__ENV__ (injected at build time - for production)
    3. Hardcoded fallback (DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION)
------------------------------ */

// Try to load from config.local.js (local development)
const localConfig = window.ENV_CONFIG || {};

// Try to load from build-time injection (production)
const buildConfig = window.__ENV__ || {};

// Configuration with fallbacks
const SUPABASE_URL = buildConfig.SUPABASE_URL || localConfig.SUPABASE_URL || "https://tcozghdncexmqambecrz.supabase.co";

const SUPABASE_ANON_KEY = buildConfig.SUPABASE_ANON_KEY || localConfig.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjb3pnaGRuY2V4bXFhbWJlY3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjU0NzAsImV4cCI6MjEwMDc0MTQ3MH0.iKSg_NAqDCemlHShSpByIqi-0qV-vDc7pp2XK6GLo2M";

// Optional: Magic link redirect override
const MAGIC_LINK_REDIRECT_OVERRIDE = buildConfig.MAGIC_LINK_REDIRECT || localConfig.MAGIC_LINK_REDIRECT;

// Optional: Admin email for local development (empty by default - production uses database)
const configuredAdminEmail = buildConfig.ADMIN_EMAIL || localConfig.ADMIN_EMAIL || "";

// Expose config globally for other modules
window.APP_CONFIG = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    MAGIC_LINK_REDIRECT_OVERRIDE,
    ADMIN_EMAIL: configuredAdminEmail
};

// Warn if using hardcoded credentials in production-like environment
if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && !buildConfig.SUPABASE_URL) {
    console.warn("%c?? SECURITY WARNING: Using hardcoded Supabase credentials!", "color: #f59e0b; font-size: 1.2rem; font-weight: bold;");
    console.warn("For production, inject SUPABASE_URL and SUPABASE_ANON_KEY at build time via window.__ENV__");
}

