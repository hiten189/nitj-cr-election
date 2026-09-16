/* ==========================================================
   IPE Voting System
   admin.js - Main Controller
========================================================== */

let adminEventsBound = false;

async function loadAdminData() {
    await window.ElectionState.loadAll();
}

async function refreshAdminViews() {
    await window.ElectionState.loadAll();
    // Dashboard aggregates come from a dedicated RPC and must be cleared too.
    await window.AdminDashboard?.load();

    // Keep every already-mounted panel in sync without rebuilding the portal
    // (module listeners are attached to those panel elements).
    [window.AdminDashboard, window.AdminSettings, window.AdminRules, window.AdminCandidates, window.AdminSystem]
        .forEach((module) => module?.render());

    const settings = window.ElectionState.settings || {};
    const status = settings.election_status || ELECTION_STATUS.DRAFT;
    const title = document.querySelector(".admin-top-header h1");
    if (title) title.textContent = settings.election_name || "NITJ CR Election";
    const badge = document.querySelector(".admin-top-header .ui-badge");
    if (badge) badge.textContent = AdminUtils.statusTitle(status);
}

async function initializeAdminPage() {
    try {
        const session = await AuthAPI.getSession();
        if (!session?.user?.email) {
            window.location.replace("/");
            return;
        }

        const email = normalizeEmail(session.user.email);
        const currentAdmin = await AdminAPI.getCurrent(email);
        if (!currentAdmin) {
            window.location.replace("/");
            return;
        }

        window.ElectionState.currentAdmin = {
            ...currentAdmin,
            email: normalizeEmail(currentAdmin.email || email),
            role: currentAdmin.role || "admin"
        };
        await loadAdminData();
        renderAdminPortal();
        bindAdminEvents();
    } catch (error) {
        console.error("Admin startup error:", error);
        renderError("Unable to load admin portal", error.message || MESSAGE.SOMETHING_WENT_WRONG);
    } finally {
        stopLoading();
        showApp();
    }
}

function navIcon(name) {
    const icons = {
        overview: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
        settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.2H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
        rules: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
        candidates: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M20 8v6M17 11h6"/></svg>',
        administration: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
    };
    return icons[name] || icons.overview;
}

function renderAdminPortal() {
    const settings = window.ElectionState.settings || {};
    const status = settings.election_status || ELECTION_STATUS.DRAFT;

    render(`
        <main class="admin-portal">
            <aside class="admin-sidebar" id="admin-sidebar">
                <nav class="admin-nav" aria-label="Admin sections">
                    <div class="nav-glass-track">
                        <span class="nav-liquid-pill" id="nav-liquid-pill" aria-hidden="true"></span>
                        <button class="nav-item active haptic-press" type="button" data-panel="overview">
                            <span class="nav-icon">${navIcon("overview")}</span><span class="nav-text">Dashboard</span>
                        </button>
                        <button class="nav-item haptic-press" type="button" data-panel="settings">
                            <span class="nav-icon">${navIcon("settings")}</span><span class="nav-text">Setup</span>
                        </button>
                        <button class="nav-item haptic-press" type="button" data-panel="rules">
                            <span class="nav-icon">${navIcon("rules")}</span><span class="nav-text">Auth</span>
                        </button>
                        <button class="nav-item haptic-press" type="button" data-panel="candidates">
                            <span class="nav-icon">${navIcon("candidates")}</span><span class="nav-text">Candidates</span>
                        </button>
                        <button class="nav-item haptic-press" type="button" data-panel="administration">
                            <span class="nav-icon">${navIcon("administration")}</span><span class="nav-text">System</span>
                        </button>
                    </div>
                </nav>
            </aside>
            <section class="admin-content-wrapper">
                <header class="admin-top-header">
                    <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                        <h1 class="desktop-only" style="font-size:1.15rem; font-weight:700; margin:0; font-family:var(--font-display);">${escapeHTML(settings.election_name || "NITJ CR Election")}</h1>
                        <h1 class="mobile-only" style="font-size:1rem; font-weight:700; margin:0; font-family:var(--font-display);">Admin</h1>
                        ${UI.Badge(AdminUtils.statusTitle(status), status === ELECTION_STATUS.LIVE ? 'success' : (status === ELECTION_STATUS.DRAFT ? 'warning' : (status === ELECTION_STATUS.CLOSED ? 'danger' : 'primary')))}
                    </div>
                    <div class="top-header-user">
                        <div class="top-header-user-info desktop-only" style="text-align:right; margin-right:12px;">
                            <span style="display:block; font-size:0.8rem; font-weight:600; color:var(--text);">${escapeHTML(window.ElectionState.currentAdmin.email)}</span>
                            <span style="display:block; font-size:0.7rem; color:var(--text-2); text-transform:capitalize;">${escapeHTML(window.ElectionState.currentAdmin.role.replace("_", " "))}</span>
                        </div>
                        <button id="logout-btn" class="btn btn-ghost haptic-press" style="padding:6px 12px; font-size:0.75rem;">Log out</button>
                    </div>
                </header>
                <div class="admin-content">
                    <section class="admin-panel active" data-panel-view="overview"></section>
                    <section class="admin-panel" data-panel-view="settings"></section>
                    <section class="admin-panel" data-panel-view="rules"></section>
                    <section class="admin-panel" data-panel-view="candidates"></section>
                    <section class="admin-panel" data-panel-view="administration"></section>
                </div>
            </section>
        </main>
    `);

    // Render all modules
    if (window.AdminDashboard) window.AdminDashboard.render();
    if (window.AdminSettings) window.AdminSettings.render();
    if (window.AdminRules) window.AdminRules.render();
    if (window.AdminCandidates) window.AdminCandidates.render();
    if (window.AdminSystem) window.AdminSystem.render();

    // Restore the active section after render
    const activeSection = localStorage.getItem("admin_active_section") || "overview";
    AdminUtils.switchPanel(activeSection);
    requestAnimationFrame(() => {
        AdminUtils.updateNavPill();
        requestAnimationFrame(() => AdminUtils.updateNavPill());
    });
    if (!window.__adminNavResizeBound) {
        window.__adminNavResizeBound = true;
        window.addEventListener("resize", () => AdminUtils.updateNavPill());
    }
    
    // Setup dynamic scroll nav
    if (window.UI && window.UI.setupDynamicBottomNav) {
        window.UI.setupDynamicBottomNav(".admin-sidebar");
    }
}

function bindAdminEvents() {
    if (adminEventsBound) return;

    document.addEventListener("click", (e) => {
        const target = e.target;

        if (target.closest("#logout-btn")) {
            AuthAPI.signOut().then(() => window.location.reload());
        } else if (target.closest("#sidebar-toggle")) {
            document.getElementById("admin-sidebar")?.classList.add("open");
        } else if (target.closest("#sidebar-close") || (target.closest("[data-panel], [data-panel-link]") && window.innerWidth <= 768)) {
            document.getElementById("admin-sidebar")?.classList.remove("open");
        } 
        
        if (target.closest("[data-panel], [data-panel-link]")) {
            const item = target.closest("[data-panel], [data-panel-link]");
            AdminUtils.switchPanel(item.dataset.panel || item.dataset.panelLink);
        } else if (target.closest("[data-modal]")) {
            openModal(target.closest("[data-modal]").dataset.modal);
        }
    });
    
    // Initialize modules only once
    if (window.AdminDashboard) window.AdminDashboard.init();
    if (window.AdminSettings) window.AdminSettings.init();
    if (window.AdminRules) window.AdminRules.init();
    if (window.AdminCandidates) window.AdminCandidates.init();
    if (window.AdminSystem) window.AdminSystem.init();

}

// Global modal handling (for Go Live, Close, etc.)
function openModal(type) {
    let content = '';
    
    if (type === 'go-live') {
        const state = window.ElectionState;
        const nameValid = Boolean(state.settings?.election_name?.trim());
        const activeCands = state.candidates.filter(c => c.active);
        const methodValid = Boolean(state.settings?.voting_method);
        const posSettingValid = Boolean(state.settings?.election_positions);
        
        // Per-position go-live validation
        const positions = state.settings?.election_positions || "male_female";
        const allowMale = positions !== "female_only";
        const allowFemale = positions !== "male_only";
        
        const hasMale = activeCands.some(c => c.position === "Male CR");
        const hasFemale = activeCands.some(c => c.position === "Female CR");
        
        const maleValid = allowMale ? hasMale : true;
        const femaleValid = allowFemale ? hasFemale : true;
        const candidatesValid = maleValid && femaleValid;

        const isValid = nameValid && candidatesValid && methodValid && posSettingValid;

        if (!isValid) {
            UI.showModal("Cannot Launch Election", `
                <p>Please complete all required setup items before launching.</p>
                <div style="margin-top:10px;">
                    <p><span>${nameValid ? '✅' : '❌'}</span> <strong>Election Name:</strong> ${nameValid ? 'OK' : 'Missing'}</p>
                    <p><span>${candidatesValid ? '✅' : '❌'}</span> <strong>Candidates:</strong> ${allowMale ? (hasMale ? 'Male ✅ ' : 'Male ❌ ') : ''}${allowFemale ? (hasFemale ? 'Female ✅ ' : 'Female ❌ ') : ''}</p>
                    <p><span>${methodValid ? '✅' : '❌'}</span> <strong>Voting Method:</strong> ${methodValid ? 'OK' : 'Missing'}</p>
                </div>
            `);
            return;
        }

        // Bypass confirmation dialog
        SettingsAPI.update(state.settings.id, { election_status: ELECTION_STATUS.LIVE, election_locked: true }).then(async () => {
            await AdminUtils.logActivity("GO_LIVE");
            try {
                if (state.settings.tracking_mode === TRACKING_MODE.IMPORTED_LIST) {
                    const eligible = await EligibleStudentsAPI.getAll();
                    const emails = eligible.map(e => e.email);
                    const uniqueEmails = [...new Set(emails)];
                    await EmailAPI.queueEmails(uniqueEmails, "VOTING_STARTED");
                    EmailAPI.triggerSend(); // Fire and forget
                    UI.showToast("Election LIVE. Emails queued.", "success");
                } else {
                    UI.showToast("Election is now LIVE.", "success");
                }
            } catch(e) {
                console.error("Email queue error:", e);
                UI.showToast("Election LIVE, but emails failed.", "warning");
            }
            await refreshAdminViews();
        });

    } else if (type === 'close-election') {
        SettingsAPI.update(window.ElectionState.settings.id, { election_status: ELECTION_STATUS.CLOSED }).then(async () => {
            await AdminUtils.logActivity("CLOSE_ELECTION");
            UI.showToast("Election Closed.", "success");
            await refreshAdminViews();
        });
    } else if (type === 'declare-results') {
        UI.confirmDialog("Declare Results?", "Results will be published.", "Declare", "Cancel")
            .then(async confirmed => {
                if(confirmed) {
                    await SettingsAPI.update(window.ElectionState.settings.id, { results_published: true });
                    await AdminUtils.logActivity("RESULT_DECLARED");
                    
                    try {
                        let emails = [];
                        if (window.ElectionState.settings.tracking_mode === TRACKING_MODE.IMPORTED_LIST) {
                            const eligible = await EligibleStudentsAPI.getAll();
                            emails = eligible.map(e => e.email);
                        } else {
                            const voters = await VoterTrackingAPI.getAll();
                            emails = voters.map(v => v.email);
                        }
                        
                        // Prevent multiple emails to the same user
                        const uniqueEmails = [...new Set(emails)];
                        await EmailAPI.queueEmails(uniqueEmails, "VOTING_COMPLETED");
                        EmailAPI.triggerSend(); // Fire and forget
                        console.log("Result emails queued for sending.");
                    } catch(e) {
                        console.error("Failed to queue result emails:", e);
                    }

                    // Celebration modal removed as per user request; results embedded in dashboard.
                    
                    await refreshAdminViews();
                }
            });
    } else if (type === 'start-final') {
        UI.confirmDialog("Start Final Round?", "Students will be allowed to vote again. Previous votes remain archived.", "Start Round 2", "Cancel")
            .then(async confirmed => {
                if(confirmed) {
                    await SettingsAPI.update(window.ElectionState.settings.id, { election_status: ELECTION_STATUS.FINAL_ROUND, results_published: false });
                    await AdminUtils.logActivity("START_FINAL_ROUND");
                    UI.showToast("Final VS Election Started.", "success");
                    await refreshAdminViews();
                }
            });
    } else if (type === 'reset-election') {
        UI.confirmDialog("Reset Election?", "This will permanently remove all votes, authorization data, participation records, and local election cache. Candidates and election setup remain.", "Reset Permanently", "Cancel", true)
            .then(async confirmed => {
                if(confirmed) {
                    const { error } = await supabaseClient.rpc("reset_election_data");
                    if (error) throw error;
                    window.ElectionState.clearElectionData();
                    UI.showToast("Election reset. All votes, participation, and authorization data were cleared.", "success");
                    setTimeout(() => window.location.reload(), 1000);
                }
            }).catch((error) => UI.showToast(error.message || "Could not reset the election.", "error"));
    }
}
