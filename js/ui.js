function showToast(message, type = "info") {
    let toast = document.getElementById("toast");
    if (!toast) { toast = document.createElement("div"); toast.id = "toast"; document.body.appendChild(toast); }
    toast.className = `toast ${type} show`;
    toast.textContent = message;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toast.classList.remove("show"), 4000);
}
function render(html) { document.getElementById("app").innerHTML = html; }
function startLoading() { showLoader(); }
function stopLoading() { hideLoader(); }
function setButtonLoading(button, loading) {
    if (!button) return;
    if (loading) { button.dataset.label = button.textContent; button.disabled = true; button.textContent = "Please wait..."; }
    else { button.disabled = false; button.textContent = button.dataset.label || "Send Magic Link"; }
}
function renderError(title, message) { render(`<main class="center-screen"><h1>${escapeHTML(title)}</h1><p>${escapeHTML(message)}</p></main>`); }
function renderSuccess(title, message, includeLogout = false) {
    render(`<main class="center-screen"><h1>${escapeHTML(title)}</h1><p>${escapeHTML(message)}</p>${includeLogout ? '<button id="logout-btn" type="button">Log out</button>' : ""}</main>`);
    const logoutButton = document.getElementById("logout-btn");
    if (logoutButton) logoutButton.addEventListener("click", logout);
}
function renderLogin() {
    render(`<main class="login-page"><section class="login-card"><h1 class="login-title">IPE Voting System</h1><p class="login-subtitle">Choose your portal, then sign in with your approved email address.</p><form id="loginForm"><div class="login-selector" role="group" aria-label="Choose login portal"><button class="login-role is-selected" type="button" data-login-role="student" aria-pressed="true">Student Login</button><button class="login-role" type="button" data-login-role="admin" aria-pressed="false">Admin Login</button></div><p id="login-role-description" class="login-role-description">Use your approved student email to access the voting portal.</p><div class="form-group"><label for="email">Email address</label><input id="email" type="email" placeholder="example.ip.25@nitj.ac.in" autocomplete="email" required></div><button type="submit">Send Magic Link</button></form></section></main>`);
    initializeLogin();
}
