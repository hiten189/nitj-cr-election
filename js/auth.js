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

async function isDatabaseAdmin(email) {
    if (isAdmin(email)) return true;
    try {
        const { data } = await supabaseClient
            .from("admins")
            .select("id")
            .eq("email", email)
            .eq("active", true)
            .maybeSingle();
        return Boolean(data);
    } catch {
        return false;
    }
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

async function sendMagicLink(email, button, loginRole = "student") {
    email = normalizeEmail(email);
    if (!isAdmin(email) && !isValidEmail(email)) {
        showToast(MESSAGE.INVALID_EMAIL, "error");
        return;
    }

    setButtonLoading(button, true);
    try {
        const databaseAdmin = await isDatabaseAdmin(email);
        if (loginRole === "admin" && !databaseAdmin) {
            showToast("This email is not authorised for the admin portal.", "error");
            return;
        }
        if (loginRole === "student" && databaseAdmin) {
            showToast("Please use Admin Login for an administrator account.", "error");
            return;
        }
        if (loginRole === "student" && !await isAllowedEmail(email)) {
            showToast(MESSAGE.NOT_ALLOWED, "error");
            return;
        }
        const redirectUrl = MAGIC_LINK_REDIRECT || (window.location.origin + window.location.pathname);
        const { error } = await supabaseClient.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectUrl }
        });
        if (error) throw error;
        showToast(MESSAGE.MAGIC_LINK_SENT, "success");
    } catch (error) {
        console.error("Magic link error:", error);
        showToast(error.message || MESSAGE.UNKNOWN_ERROR, "error");
    } finally {
        setButtonLoading(button, false);
    }
}

async function logout() {
    await signOut();
    window.location.replace("/");
}

async function routeAuthenticatedUser() {
    const session = await getSession();
    if (!session) {
        renderLogin();
        return;
    }
    const email = normalizeEmail(session.user.email || "");
    if (await isDatabaseAdmin(email)) {
        window.location.replace("/admin/");
        return;
    }
    await renderStudentDashboard(email);
}

function initializeLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;
    let loginRole = "student";
    form.querySelectorAll("[data-login-role]").forEach((control) => {
        control.addEventListener("click", () => {
            loginRole = control.dataset.loginRole;
            form.querySelectorAll("[data-login-role]").forEach(button => {
                const selected = button === control;
                button.classList.toggle("is-selected", selected);
                button.setAttribute("aria-pressed", String(selected));
            });
            document.getElementById("login-role-description").textContent = loginRole === "admin"
                ? "Use your authorised administrator email to access the admin portal."
                : "Use your approved student email to access the voting portal.";
        });
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        sendMagicLink(document.getElementById("email").value, form.querySelector("button[type=submit]"), loginRole);
    });
}
