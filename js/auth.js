function emailMatchesRule(email, rule) {
    const type = String(rule.rule_type || "").toLowerCase();
    const value = String(rule.rule_value || "").trim().toLowerCase();
    if (!value) return false;

    if (["email", "exact", "exact_email"].includes(type)) return email === value;
    if (["domain", "email_domain"].includes(type)) return email.endsWith("@" + value.replace(/^@/, ""));
    if (["suffix", "ends_with"].includes(type)) return email.endsWith(value);

    // Supports SQL-style wildcard rules such as %.ip.25@nitj.ac.in.
    const wildcard = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%|\*/g, ".*");
    return new RegExp("^" + wildcard + "$", "i").test(email);
}

function isValidSignInEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function isDatabaseAdmin(email) {
    try {
        // This runs before a magic-link session exists. Reading `admins`
        // directly is normally blocked by RLS at that point, so use the
        // narrowly scoped RPC instead of accidentally treating an admin as a
        // student.
        const { data, error } = await supabaseClient.rpc("is_admin_email", {
            user_email: normalizeEmail(email)
        });
        if (!error) return data === true;
        console.warn("Pre-login admin check RPC unavailable:", error.message);
    } catch (error) {
        console.warn("Pre-login admin check failed:", error.message);
    }

    // Local development fallback. Production authorization remains governed
    // by the `admins` table through the RPC above.
    return isAdmin(email);
}

async function isAllowedEmail(email) {
    if (await isDatabaseAdmin(email)) return true;

    const { data, error } = await supabaseClient.rpc(
        "is_allowed_voter",
        {
            user_email: email
        }
    );

    if (error) {
        console.error("Voter authorization RPC failed:", error);
        throw error;
    }

    return data === true;
}

async function sendMagicLink(email, button) {
    email = normalizeEmail(email);
    if (!isValidSignInEmail(email)) {
        showToast("Enter a valid email address.", "error");
        return;
    }

    setButtonLoading(button, true);
    try {
        const administrator = await isDatabaseAdmin(email);
        if (!administrator) {
            const availability = await PublicElectionAPI.getAvailability();
            if (!availability.settingsConfigured) {
                showToast("Election not set up yet. Please try again later.", "warning");
                return;
            }
            if (!availability.authorizationConfigured) {
                showToast("Student access isn't enabled yet. Contact the admin.", "warning");
                return;
            }
            if (!availability.studentLoginsOpen) {
                showToast("Sign-in isn't open yet. Check back when voting starts.", "warning");
                return;
            }
            if (!await isAllowedEmail(email)) {
                showToast(MESSAGE.NOT_ALLOWED, "error");
                return;
            }
        }
        const redirectUrl = MAGIC_LINK_REDIRECT || (window.location.origin + window.location.pathname);
        const { error } = await supabaseClient.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectUrl }
        });
        if (error) throw error;
        // Navigate to link-sent confirmation screen
        renderLinkSent(email);
    } catch (error) {
        console.error("Magic link error:", error);
        showToast("Couldn't send the link. Please try again.", "error");
    } finally {
        setButtonLoading(button, false);
    }
}

async function logout() {
    await signOut();
    render(`
        <main class="auth-page" style="animation: fadeUp 0.4s ease;">
            <section class="auth-card" style="text-align:center;">
                <div style="font-size:2.8rem;margin-bottom:16px;">&#128075;</div>
                <h1 style="font-family:var(--font-display);font-size:1.5rem;font-weight:800;margin-bottom:8px;">Signed out</h1>
                <p style="color:var(--text-2);font-size:0.9rem;margin-bottom:24px;">Your session was securely cleared.</p>
                <button class="auth-submit haptic-press" onclick="renderLogin()" style="width:100%;">Back to Sign In</button>
            </section>
        </main>
    `);
}

function renderLinkSent(email) {
    render(`
        <main class="auth-page">
            <section class="auth-card link-sent-card" aria-labelledby="link-sent-title">
                <div class="link-sent-icon" aria-hidden="true">&#9993;</div>
                <h1 id="link-sent-title" class="link-sent-title">Check your inbox</h1>
                <p class="link-sent-body">We sent a sign-in link to</p>
                <div class="link-sent-email-pill">${escapeHTML(email)}</div>
                <p class="link-sent-hint">Tap the link in the email to sign in instantly. Check your spam folder if you don't see it within a minute.</p>
                <div class="link-sent-actions">
                    <a id="open-gmail-btn"
                       class="auth-submit link-sent-gmail haptic-press"
                       href="https://mail.google.com" target="_blank" rel="noopener"
                       data-deep-link="true">
                        &#128140; Open Gmail
                    </a>
                    <button class="btn btn-ghost haptic-press link-sent-back" type="button" id="try-diff-email-btn">
                        Try a different email
                    </button>
                </div>
                <p class="link-sent-expire">&#128274; This link expires in 1 hour</p>
            </section>
        </main>`);
    document.getElementById("try-diff-email-btn").addEventListener("click", () => renderLogin());

    // Gmail deep-link: try to open the native Gmail app, fall back to web
    const gmailBtn = document.getElementById("open-gmail-btn");
    if (gmailBtn) {
        gmailBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const ua = navigator.userAgent;
            if (/android/i.test(ua)) {
                // Android: use intent URI to open Gmail app inbox
                window.location.href = "intent://mail.google.com/#Intent;scheme=https;package=com.google.android.gm;end";
            } else if (/iphone|ipad|ipod/i.test(ua)) {
                // iOS: try Gmail custom URL scheme
                const timeout = setTimeout(() => { window.open("https://mail.google.com", "_blank", "noopener"); }, 1500);
                window.location.href = "googlegmail://";
                window.addEventListener("blur", () => clearTimeout(timeout), { once: true });
            } else {
                window.open("https://mail.google.com", "_blank", "noopener");
            }
        });
    }
}

async function routeAuthenticatedUser() {
    console.log("Checking auth session...");
    const session = await getSession();
    if (!session) {
        console.log("No session found; rendering login.");
        await renderLogin();
        return;
    }
    const email = normalizeEmail(session.user.email || "");
    console.log("Session found for:", email);
    if (await isDatabaseAdmin(email)) {
        console.log("Active administrator found; redirecting to admin portal.");
        window.location.replace("/admin/");
        return;
    }
    console.log("Student session found; loading student dashboard settings.");
    await renderStudentDashboard(email);
}

function initializeLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        sendMagicLink(document.getElementById("email").value, form.querySelector("button[type=submit]"));
    });
}

async function renderLogin() {
    // Fetch the election name silently — falls back to nothing if not available
    const electionName = await PublicElectionAPI.getElectionName().catch(() => null);

    render(`
        <main class="auth-page">
            <section class="auth-card" aria-labelledby="login-title">
                <header class="auth-header">
                    <div class="auth-brand">
                        <span class="auth-mark-pill">NITJ</span>
                        CR Election
                    </div>
                    ${electionName ? `<p class="auth-election-name">${escapeHTML(electionName)}</p>` : ''}
                    <h1 id="login-title">Cast your vote</h1>
                    <p>Enter your institute email &mdash; we&rsquo;ll send you a secure sign-in link instantly.</p>
                </header>
                <form id="loginForm" class="auth-form" novalidate>
                    <label class="auth-field" for="email">Institute email address
                        <input id="email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@nitj.ac.in" required>
                    </label>
                    <button class="auth-submit haptic-press" type="submit"><span>Send Sign-In Link</span><span aria-hidden="true">&rarr;</span></button>
                </form>
                <footer class="auth-footer"><span class="auth-security" aria-hidden="true">&#9670;</span><span>Trouble signing in? Contact the election admin.</span></footer>
            </section>
        </main>`);
    initializeLogin();
}

