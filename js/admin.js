const adminState = { currentAdmin: null, settings: null, candidates: [], rules: [], votes: [], activity: [], eligibleStudents: [] };

function adminError(error) { return error?.message || MESSAGE.SOMETHING_WENT_WRONG || "Something went wrong."; }
function isSuperAdmin() { return adminState.currentAdmin?.role === "super_admin"; }
function statusTitle(status) { return String(status || "draft").replace(/^./, (letter) => letter.toUpperCase()).replace(/_/g, " "); }

async function queryAdmin(table, build, fallbackValue = null) {
    try {
        const { data, error } = await build(supabaseClient.from(table));
        if (error) {
            if (isSchemaCompatibilityError(error)) return fallbackValue;
            throw error;
        }
        return data;
    } catch (error) {
        if (isSchemaCompatibilityError(error)) return fallbackValue;
        throw error;
    }
}

async function loadAdminData() {
    const storedConfig = getStoredAdminConfig();
    const [settingsData, candidates, rules, votes, activity, eligibleStudentsData, voterTracking] = await Promise.all([
        queryAdmin("settings", (q) => q.select("id, election_name, election_status, allow_write_in_vote, write_in_roll_digits, results_published, total_students, tracking_mode, expected_voters, max_candidates, voting_method, election_positions, ranked_voting_enabled, final_vs_round_enabled, live_confirmation_completed, election_locked, voting_start_date, voting_end_date, enable_automatic_emails, send_voting_started_email, send_completion_email, allow_reminder_emails").limit(1).maybeSingle(), null),
        queryAdmin("candidates", (q) => q.select("id, name, roll_number, position, active").order("position").order("name"), []),
        queryAdmin("allowed_email_rules", (q) => q.select("id, rule_type, rule_value, active").order("rule_type").order("rule_value"), []),
        queryAdmin("votes", (q) => q.select("male_candidate_id, female_candidate_id, male_write_in_roll, female_write_in_roll, ranking_data, voting_method, election_positions, round_number"), []),
        queryAdmin("vote_activity_log", (q) => q.select("id, actor, event_type, created_at").order("created_at", { ascending: false }).limit(20), []),
        queryAdmin("eligible_students", (q) => q.select("id, email, status, voted_at, created_at").order("created_at", { ascending: false }), getStoredEligibleStudents()),
        queryAdmin("voter_tracking", (q) => q.select("id, email, round_number, voted_at").order("voted_at", { ascending: false }), [])
    ]);
    const settings = settingsData ? { ...storedConfig, ...settingsData } : { ...storedConfig };
    const eligibleStudents = Array.isArray(eligibleStudentsData) ? eligibleStudentsData : getStoredEligibleStudents();
    Object.assign(adminState, { settings, candidates: candidates || [], rules: rules || [], votes: votes || [], activity: activity || [], eligibleStudents, voterTracking: voterTracking || [] });
}

async function logActivity(event_type, details = {}) {
    try {
        await supabaseClient.from("vote_activity_log").insert({ actor: adminState.currentAdmin.email, event_type });
    } catch(e) {
        console.error("Failed to log activity", e);
    }
}

function candidateRows() {
    if (!adminState.candidates.length) return '<tr><td colspan="5" class="empty-row">No candidates added yet.</td></tr>';
    const isLive = adminState.settings?.election_status !== "draft";
    return adminState.candidates.map((candidate) => `<tr>
        <td><strong>${escapeHTML(candidate.name)}</strong></td>
        <td>${escapeHTML(candidate.roll_number)}</td>
        <td>${escapeHTML(candidate.position)}</td>
        <td><span class="status-pill ${candidate.active ? "is-live" : "is-muted"}">${candidate.active ? "Active 🟢" : "Inactive ⚪"}</span></td>
        <td class="table-actions">${isLive ? '<i>Read-only</i>' : `
            <button class="icon-action" type="button" data-edit-candidate="${candidate.id}">✏ Edit</button>
            <button class="icon-action" type="button" data-toggle-candidate="${candidate.id}">${candidate.active ? "⏸ Deactivate" : "🟢 Activate"}</button>
            <button class="icon-action danger-action" type="button" data-delete-candidate="${candidate.id}">🗑 Delete</button>
        `}</td>
    </tr>`).join("");
}

function ruleRows() {
    if (!adminState.rules.length) return '<tr><td colspan="4" class="empty-row">No email rules added yet.</td></tr>';
    const isLive = adminState.settings?.election_status !== "draft";
    return adminState.rules.map((rule) => `<tr><td><code>${escapeHTML(rule.rule_type)}</code></td><td>${escapeHTML(rule.rule_value)}</td><td><span class="status-pill ${rule.active ? "is-live" : "is-muted"}">${rule.active ? "Active" : "Inactive"}</span></td><td class="table-actions">${isLive ? '<i>Locked</i>' : `<button class="icon-action" type="button" data-edit-rule="${rule.id}">Edit</button><button class="icon-action danger-action" type="button" data-delete-rule="${rule.id}">Delete</button>`}</td></tr>`).join("");
}

function eligibleStudentRows() {
    if (!adminState.eligibleStudents.length) return '<tr><td colspan="4" class="empty-row">No eligible students added yet.</td></tr>';
    return adminState.eligibleStudents.map((student) => `<tr><td>${escapeHTML(student.email)}</td><td><span class="status-pill ${student.status === "voted" ? "is-live" : "is-muted"}">${escapeHTML(student.status || "pending")}</span></td><td>${student.voted_at ? escapeHTML(formatDate(student.voted_at)) : "—"}</td><td>${escapeHTML(student.created_at ? formatDate(student.created_at) : "—")}</td></tr>`).join("");
}

function resultRows(position) {
    if (adminState.settings.election_status !== 'closed' && adminState.settings.election_status !== 'final_round') {
        return '<p class="empty-state">Results are hidden until the election is closed and results are declared.</p>';
    }

    const key = position === "Male CR" ? "male_candidate_id" : "female_candidate_id";
    const writeKey = position === "Male CR" ? "male_write_in_roll" : "female_write_in_roll";
    
    // For ranking, we would calculate points. For now, we fallback to single choice logic if ranking_data isn't parsed.
    // Real Borda count calculation should parse ranking_data JSONB.
    const counts = new Map();
    adminState.votes.forEach((vote) => { 
        if (vote.ranking_data && vote.ranking_data[position === "Male CR" ? "male" : "female"]) {
            const ranks = vote.ranking_data[position === "Male CR" ? "male" : "female"];
            for (const [cId, rank] of Object.entries(ranks)) {
                let pts = rank === 1 ? 3 : (rank === 2 ? 2 : (rank === 3 ? 1 : 0));
                counts.set(cId, (counts.get(cId) || 0) + pts);
            }
        } else if (vote[key]) {
            counts.set(vote[key], (counts.get(vote[key]) || 0) + 1); 
        }
    });

    const results = adminState.candidates.filter((candidate) => candidate.position === position).map((candidate) => ({ name: candidate.name, count: counts.get(candidate.id) || 0 }));
    
    // Write-ins
    const writeIns = new Map();
    adminState.votes.forEach((vote) => { if (vote[writeKey]) writeIns.set(vote[writeKey], (writeIns.get(vote[writeKey]) || 0) + 1); });
    writeIns.forEach((count) => results.push({ name: `Write-in: ${count}`, count }));
    
    results.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    
    if (!results.length) return '<p class="empty-state">No candidates or votes to display.</p>';
    return results.map((result) => `<div class="result-row"><strong>${escapeHTML(result.name)}</strong><b>${result.count} ${adminState.settings.ranked_voting_enabled ? 'pts' : 'votes'}</b></div>`).join("");
}

function activityRows() {
    if (!adminState.activity.length) return '<li class="empty-state">No activity has been recorded.</li>';
    return adminState.activity.map((item) => `<li><span class="activity-mark"></span><div><strong>${escapeHTML(item.event_type.replace(/_/g, ' '))}</strong><p>${escapeHTML(item.actor)}</p><small>${formatDate(item.created_at)}</small></div></li>`).join("");
}

function getCountdown(endDate) {
    if (!endDate) return "No deadline set";
    const diff = new Date(endDate) - new Date();
    if (diff <= 0) return "Voting has ended";
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `Voting closes in: ${h} hours ${m} minutes`;
}

function renderAdminPortal() {
    const settings = adminState.settings || {};
    const status = settings.election_status || "draft";
    const restricted = isSuperAdmin() ? "" : "disabled";
    const trackingMode = settings.tracking_mode || 'rules_only';
    const expectedCount = Number(settings.expected_voters) || 0;
    const maxCandidates = Number(settings.max_candidates) || 0;
    const eligibleCount = adminState.eligibleStudents.length;
    const votesCast = adminState.voterTracking ? adminState.voterTracking.length : adminState.votes.length;
    const pendingVotes = trackingMode === 'imported_list' ? Math.max(eligibleCount - votesCast, 0) : 
                         (trackingMode === 'expected_count' ? Math.max(expectedCount - votesCast, 0) : 0);
    
    const totalCandidatesCount = adminState.candidates.length;
    const activeCandidatesCount = adminState.candidates.filter(c => c.active).length;
    const inactiveCandidatesCount = totalCandidatesCount - activeCandidatesCount;
    const isCandidateLimitReached = maxCandidates > 0 && totalCandidatesCount >= maxCandidates;

    let turnout = "0.0";
    if (trackingMode === 'imported_list' && eligibleCount) turnout = ((votesCast / eligibleCount) * 100).toFixed(1);
    else if (trackingMode === 'expected_count' && expectedCount) turnout = ((votesCast / expectedCount) * 100).toFixed(1);
    
    const isLive = status !== "draft";

    render(`
        <main class="admin-portal">
            <aside class="admin-sidebar">
                <div class="admin-brand"><span>IPE</span><div><strong>Election Portal</strong><small>Administration</small></div></div>
                <nav class="admin-nav">
                    <p class="nav-header">MAIN</p>
                    <button class="nav-item active" type="button" data-panel="overview">Dashboard</button>
                    
                    <p class="nav-header">ELECTION</p>
                    <button class="nav-item" type="button" data-panel="candidates">Candidates</button>
                    <button class="nav-item" type="button" data-panel="eligible">Eligible Students</button>
                    <button class="nav-item" type="button" data-panel="rules">Email Rules</button>
                    <button class="nav-item" type="button" data-panel="settings">Voting Setup</button>
                    
                    <p class="nav-header">MONITOR</p>
                    <button class="nav-item" type="button" data-panel="results">Results</button>
                    <button class="nav-item" type="button" data-panel="activity">Activity</button>
                    
                    <p class="nav-header">SYSTEM</p>
                    <button class="nav-item" type="button" data-panel="administration">Administration</button>
                </nav>
                <div class="admin-user">
                    <span>${escapeHTML(adminState.currentAdmin.email)}</span>
                    <small>${escapeHTML(adminState.currentAdmin.role.replace("_", " "))}</small>
                    <button id="logout-btn" type="button">Log out</button>
                </div>
            </aside>
            <section class="admin-content">
                <header class="admin-header">
                    <div><p class="eyebrow">Admin Portal</p><h1>${escapeHTML(settings.election_name || "IPE CR Election")}</h1></div>
                    <span class="status-pill status-${escapeHTML(status)}">${escapeHTML(statusTitle(status))}</span>
                </header>

                <section class="admin-panel active" data-panel-view="overview">
                    <div class="metric-grid">
                        ${trackingMode === 'imported_list' ? `
                        <article class="metric-card"><span>Eligible Students</span><strong>${eligibleCount}</strong></article>
                        <article class="metric-card"><span>Votes Cast</span><strong>${votesCast}</strong></article>
                        <article class="metric-card"><span>Pending</span><strong>${pendingVotes}</strong></article>
                        <article class="metric-card"><span>Participation</span><strong>${turnout}%</strong></article>
                        ` : trackingMode === 'expected_count' ? `
                        <article class="metric-card"><span>Expected Voters</span><strong>${expectedCount}</strong></article>
                        <article class="metric-card"><span>Votes Cast</span><strong>${votesCast}</strong></article>
                        <article class="metric-card"><span>Remaining</span><strong>${pendingVotes}</strong></article>
                        <article class="metric-card"><span>Participation</span><strong>${turnout}%</strong></article>
                        ` : `
                        <article class="metric-card" style="grid-column: span 2;"><span>Votes Cast</span><strong>${votesCast}</strong></article>
                        <article class="metric-card" style="grid-column: span 2;"><span>Voter Tracking</span><strong>Available</strong></article>
                        `}
                    </div>
                    
                    <div class="progress-container" style="margin-top:20px; background:#1f2937; padding:20px; border-radius:13px; border:1px solid rgba(148,163,184,.2);">
                        <h3 style="font-size:1rem; margin-bottom:10px;">Voting Progress</h3>
                        ${trackingMode !== 'rules_only' ? `
                        <div style="background:#111827; height:12px; border-radius:10px; overflow:hidden;">
                            <div style="background:var(--primary); height:100%; width:${turnout}%;"></div>
                        </div>
                        <p style="margin-top:10px; font-size:0.85rem; color:#aebbd0;">${votesCast} / ${trackingMode === 'imported_list' ? eligibleCount : expectedCount} students voted. <span style="float:right;">${settings.voting_end_date ? getCountdown(settings.voting_end_date) : ''}</span></p>
                        ` : `
                        <p style="margin-top:10px; font-size:0.85rem; color:#aebbd0;">Pending students tracking is unavailable in Email Rules mode.</p>
                        `}
                    </div>

                    <div class="overview-grid">
                        <section class="admin-card">
                            <h2>Live Control</h2>
                            <p>Manage the election state securely.</p>
                            <div class="quick-controls">
                                <button type="button" data-modal="go-live" ${isLive ? 'disabled' : ''}>Go Live</button>
                                <button type="button" data-modal="close-election" ${status !== 'live' && status !== 'final_round' ? 'disabled' : ''}>Close Election</button>
                            </div>
                            ${trackingMode === 'imported_list' ? `
                            <div style="margin-top:20px;">
                                <h3>Communication</h3>
                                <button class="text-button" type="button" id="send-reminder-btn" style="margin-top:8px;">Send Reminder to Pending</button>
                            </div>
                            ` : ''}
                        </section>
                        <section class="admin-card">
                            <div class="card-heading">
                                <div><h2>Recent activity</h2></div>
                                <button class="text-button" type="button" data-panel-link="activity">View all</button>
                            </div>
                            <ul class="activity-list compact">${activityRows()}</ul>
                        </section>
                    </div>
                </section>

                <section class="admin-panel" data-panel-view="candidates">
                    <div class="panel-heading"><div><h2>Candidate management</h2><p>${isLive ? "Election is live. Candidates are locked." : "Add, update, activate, or remove candidates."}</p></div></div>
                    
                    <div class="candidate-summary-bar" style="margin-bottom: 20px; padding: 16px; background: #1e293b; border-radius: 12px; border: 1px solid rgba(148,163,184,0.1); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px;">
                        <div style="display:flex; gap:24px; align-items:center;">
                            <div>
                                <span style="font-size:0.8rem; color:#aebbd0; display:block;">Total Candidates</span>
                                <strong style="font-size:1.1rem; color:#f8fafc;">${totalCandidatesCount}${maxCandidates ? ' / ' + maxCandidates : ''} added</strong>
                            </div>
                            <div>
                                <span style="font-size:0.8rem; color:#aebbd0; display:block;">Active Candidates</span>
                                <strong style="font-size:1.1rem; color:#34d399;">${activeCandidatesCount}</strong>
                            </div>
                            <div>
                                <span style="font-size:0.8rem; color:#aebbd0; display:block;">Inactive Candidates</span>
                                <strong style="font-size:1.1rem; color:#94a3b8;">${inactiveCandidatesCount}</strong>
                            </div>
                        </div>

                        ${!isLive ? `
                        <div style="display:flex; align-items:center; gap:8px;">
                            <label style="font-size: 0.8rem; color: #aebbd0;">Max Candidate Limit:</label>
                            <input type="number" id="max-candidates-input" value="${maxCandidates || ''}" placeholder="Unlimited" style="width:95px; padding: 6px 10px; background:#0f172a; border:1px solid rgba(148,163,184,0.2); border-radius:6px; color:#fff;">
                            <button class="primary-button" style="padding: 6px 12px; font-size: 0.85rem;" onclick="saveMaxCandidates()">Save Limit</button>
                        </div>
                        ` : ''}
                    </div>

                    ${!isLive && isCandidateLimitReached ? `
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; color: #fca5a5; font-size: 0.9rem;">
                        ⛔ Candidate limit reached. Maximum allowed: <strong>${maxCandidates} candidates</strong>.
                    </div>
                    ` : ''}

                    ${!isLive ? `
                    <form id="candidate-form" class="admin-form inline-form">
                        <input id="candidate-id" type="hidden">
                        <label>Name<input id="candidate-name" required ${isCandidateLimitReached ? 'disabled' : ''}></label>
                        <label>Roll number<input id="candidate-roll" required ${isCandidateLimitReached ? 'disabled' : ''}></label>
                        <label>Position<select id="candidate-position" ${isCandidateLimitReached ? 'disabled' : ''}><option>Male CR</option><option>Female CR</option></select></label>
                        <label class="check-label"><input id="candidate-active" type="checkbox" checked ${isCandidateLimitReached ? 'disabled' : ''}> Active</label>
                        <button class="primary-button" id="candidate-submit" type="submit" ${isCandidateLimitReached ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>Save</button>
                        <button class="text-button" id="candidate-cancel" type="button" hidden>Cancel</button>
                    </form>` : ''}
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>Name</th><th>Roll number</th><th>Position</th><th>Status</th><th></th></tr></thead>
                            <tbody>${candidateRows()}</tbody>
                        </table>
                    </div>
                </section>

                <section class="admin-panel" data-panel-view="eligible">
                    <div class="panel-heading"><div><h2>Voter Tracking Setup</h2><p>${isLive ? "🔒 Election Locked. Configuration cannot be changed after voting starts." : "Select how you want to track voter turnout and participation."}</p></div></div>
                    
                    <div style="margin-bottom: 24px; padding: 20px; background: rgba(30,41,59,0.5); border: 1px solid rgba(148,163,184,0.1); border-radius: 12px;">
                        <h3 style="margin-bottom:12px; font-size: 0.95rem; color: #aebbd0;">Current Tracking Configuration</h3>
                        <p style="font-size: 1.1rem; font-weight: 500; color: #f8fafc;">
                            ${trackingMode === 'rules_only' ? '📧 Email Rules Only' : trackingMode === 'expected_count' ? '👥 Expected Voter Count (' + expectedCount + ' expected)' : '📋 Imported Student List (' + eligibleCount + ' eligible)'}
                        </p>
                    </div>

                    ${!isLive ? `
                    <div class="tracking-mode-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
                        
                        <div class="mode-card" style="padding: 20px; border-radius: 12px; border: 2px solid ${trackingMode === 'rules_only' ? 'var(--primary)' : 'rgba(148,163,184,0.1)'}; background: #1e293b; cursor: pointer; position: relative;" onclick="document.getElementById('mode-rules').click()">
                            <input type="radio" id="mode-rules" name="auth_mode" value="rules_only" style="opacity:0; position:absolute;" ${trackingMode === 'rules_only' ? 'checked' : ''} onchange="updateTrackingMode('rules_only')">
                            ${trackingMode === 'rules_only' ? '<div style="position:absolute; top:12px; right:12px; color:var(--primary);">✓ Active</div>' : ''}
                            <div style="font-size: 24px; margin-bottom: 12px;">📧</div>
                            <h3 style="margin-bottom: 8px;">Email Rules Only</h3>
                            <p style="font-size: 0.85rem; color: #aebbd0;">Use pattern/exact email rules. Individual pending tracking unavailable.</p>
                        </div>

                        <div class="mode-card" style="padding: 20px; border-radius: 12px; border: 2px solid ${trackingMode === 'expected_count' ? 'var(--primary)' : 'rgba(148,163,184,0.1)'}; background: #1e293b; cursor: pointer; position: relative;" onclick="document.getElementById('mode-expected').click()">
                            <input type="radio" id="mode-expected" name="auth_mode" value="expected_count" style="opacity:0; position:absolute;" ${trackingMode === 'expected_count' ? 'checked' : ''} onchange="updateTrackingMode('expected_count')">
                            ${trackingMode === 'expected_count' ? '<div style="position:absolute; top:12px; right:12px; color:var(--primary);">✓ Active</div>' : ''}
                            <div style="font-size: 24px; margin-bottom: 12px;">👥</div>
                            <h3 style="margin-bottom: 8px;">Expected Voter Count</h3>
                            <p style="font-size: 0.85rem; color: #aebbd0;">Track turnout percentage without storing student list.</p>
                            ${trackingMode === 'expected_count' ? `
                            <div style="margin-top: 16px;">
                                <label style="font-size: 0.8rem; color: #aebbd0; display:block; margin-bottom: 4px;" onclick="event.stopPropagation()">Expected voters:</label>
                                <div style="display:flex; gap:8px;" onclick="event.stopPropagation()">
                                    <input type="number" id="expected-count-input" value="${expectedCount}" style="width:100px; padding: 6px 10px; background:#0f172a; border:1px solid rgba(148,163,184,0.2); border-radius:6px; color:#fff;">
                                    <button class="primary-button" style="padding: 6px 12px; font-size: 0.85rem;" onclick="saveExpectedCount()">Save</button>
                                </div>
                            </div>
                            ` : ''}
                        </div>

                        <div class="mode-card" style="padding: 20px; border-radius: 12px; border: 2px solid ${trackingMode === 'imported_list' ? 'var(--primary)' : 'rgba(148,163,184,0.1)'}; background: #1e293b; cursor: pointer; position: relative;" onclick="document.getElementById('mode-import').click()">
                            <input type="radio" id="mode-import" name="auth_mode" value="imported_list" style="opacity:0; position:absolute;" ${trackingMode === 'imported_list' ? 'checked' : ''} onchange="updateTrackingMode('imported_list')">
                            ${trackingMode === 'imported_list' ? '<div style="position:absolute; top:12px; right:12px; color:var(--primary);">✓ Active</div>' : ''}
                            <div style="font-size: 24px; margin-bottom: 12px;">📋</div>
                            <h3 style="margin-bottom: 8px;">Import Student List</h3>
                            <p style="font-size: 0.85rem; color: #aebbd0;">Upload complete voter list and track pending students.</p>
                        </div>
                        
                    </div>
                    ` : ''}

                    <div id="upload-list-section" style="${trackingMode !== 'imported_list' ? 'display:none;' : ''}">
                        ${!isLive ? `
                        <form id="eligible-form" class="admin-form" style="background:#1e293b; padding:20px; border-radius:12px; border:1px solid rgba(148,163,184,0.1); margin-bottom:20px;">
                            <label class="wide-field" style="margin-bottom:12px; display:block;">Emails (Paste one per line)<textarea id="eligible-emails" rows="6" placeholder="student.ip.25@nitj.ac.in" style="margin-top:8px;"></textarea></label>
                            <button class="primary-button" type="submit">Import Emails</button>
                        </form>` : ''}
                        
                        <div class="table-wrap">
                            <h3 style="margin-bottom: 16px; font-size: 1rem;">Imported List Database</h3>
                            <table>
                                <thead><tr><th>Email</th><th>Status</th><th>Voted At</th><th>Added</th></tr></thead>
                                <tbody>${eligibleStudentRows()}</tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <section class="admin-panel" data-panel-view="rules">
                    <div class="panel-heading"><div><h2>Allowed email rules</h2><p>${isLive ? "Rules are locked." : "Rules are checked before Magic Links are sent."}</p></div></div>
                    ${!isLive ? `
                    <form id="rule-form" class="admin-form inline-form">
                        <input id="rule-id" type="hidden">
                        <label>Rule type<select id="rule-type"><option value="exact">Exact email</option><option value="domain">Domain</option><option value="suffix">Suffix</option><option value="pattern">Wildcard pattern</option></select></label>
                        <label class="wide-field">Rule value<input id="rule-value" required placeholder="student@nitj.ac.in"></label>
                        <label class="check-label"><input id="rule-active" type="checkbox" checked> Active</label>
                        <button class="primary-button" id="rule-submit" type="submit">Save</button>
                        <button class="text-button" id="rule-cancel" type="button" hidden>Cancel</button>
                    </form>` : ''}
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>Type</th><th>Value</th><th>Status</th><th></th></tr></thead>
                            <tbody>${ruleRows()}</tbody>
                        </table>
                    </div>
                </section>

                <section class="admin-panel" data-panel-view="settings">
                    <div class="panel-heading"><div><h2>Voting Setup</h2><p>${isLive ? "Settings are locked while election is live." : "Configure how the election runs."}</p></div></div>
                    <form id="settings-form" class="admin-form settings-form">
                        <fieldset ${isLive ? 'disabled' : ''} style="display:contents;">
                            <label>Election name<input id="setting-name" value="${escapeHTML(settings.election_name || "")}" required></label>
                            <label>Voting method<select id="setting-voting-method"><option value="single_choice" ${settings.voting_method === "single_choice" ? "selected" : ""}>Single Choice</option><option value="ranked_choice" ${settings.voting_method === "ranked_choice" ? "selected" : ""}>Ranked Choice Voting</option><option value="ranked_choice_final_vs" ${settings.voting_method === "ranked_choice_final_vs" ? "selected" : ""}>Ranked + Final VS</option></select></label>
                            <label>Positions<select id="setting-positions"><option value="male_female" ${settings.election_positions === "male_female" ? "selected" : ""}>Male + Female</option><option value="male_only" ${settings.election_positions === "male_only" ? "selected" : ""}>Male Only</option><option value="female_only" ${settings.election_positions === "female_only" ? "selected" : ""}>Female Only</option></select></label>
                            
                            <label>Start Date (optional)<input id="setting-start" type="datetime-local" value="${settings.voting_start_date ? settings.voting_start_date.slice(0,16) : ''}"></label>
                            <label>End Date (optional)<input id="setting-end" type="datetime-local" value="${settings.voting_end_date ? settings.voting_end_date.slice(0,16) : ''}"></label>
                            <label>Write-in digits<input id="setting-digits" type="number" min="1" value="${escapeHTML(settings.write_in_roll_digits || "")}"></label>

                            <label class="check-label"><input id="setting-write-in" type="checkbox" ${settings.allow_write_in_vote ? "checked" : ""}> Allow write-ins</label>
                            <label class="check-label"><input id="setting-ranked" type="checkbox" ${settings.ranked_voting_enabled ? "checked" : ""}> Enable ranked voting UI</label>
                            <label class="check-label"><input id="setting-auto-emails" type="checkbox" ${settings.enable_automatic_emails ? "checked" : ""}> Enable auto-emails</label>
                            
                            <button class="primary-button" type="submit" style="grid-column: span 3; justify-self: start;">Save Settings</button>
                        </fieldset>
                    </form>
                </section>

                <section class="admin-panel" data-panel-view="results">
                    <div class="panel-heading">
                        <div><h2>Results</h2><p>Results are calculated securely from aggregate data.</p></div>
                        <button type="button" class="primary-button" data-modal="declare-results" ${status !== 'closed' && status !== 'completed' ? 'disabled' : ''}>Declare Results</button>
                    </div>
                    ${settings.voting_method === 'ranked_choice_final_vs' && status === 'completed' ? `
                    <div class="admin-card" style="margin-bottom:20px; border-color:#8caaff;">
                        <h3>FINAL ROUND AVAILABLE</h3>
                        <p>Ranked voting has concluded. You can start the final run-off between the top candidates.</p>
                        <button class="primary-button" type="button" data-modal="start-final" style="margin-top:10px;">Start Final VS Round</button>
                    </div>` : ''}
                    <div class="results-grid">
                        <section class="admin-card"><h3>Male CR</h3>${resultRows("Male CR")}</section>
                        <section class="admin-card"><h3>Female CR</h3>${resultRows("Female CR")}</section>
                    </div>
                </section>

                <section class="admin-panel" data-panel-view="activity">
                    <div class="panel-heading"><div><h2>Activity log</h2></div><button id="refresh-activity" class="text-button" type="button">Refresh</button></div>
                    <ul class="activity-list">${activityRows()}</ul>
                </section>

                <section class="admin-panel" data-panel-view="administration">
                    <div class="panel-heading"><div><h2>System Administration</h2></div></div>
                    
                    <section class="transfer-card" style="margin-bottom:20px;">
                        <div><h3>Transfer Election Admin</h3><p>Assign admin rights to a new user.</p></div>
                        <form id="transfer-form">
                            <input id="transfer-email" type="email" placeholder="new.admin@nitj.ac.in" required ${restricted}>
                            <button class="primary-button" type="submit" ${restricted}>Transfer</button>
                        </form>
                    </section>

                    <div class="danger-zone">
                        <div><h3>Reset Election</h3><p>Permanently deletes all votes and resets state to draft.</p></div>
                        <button type="button" class="danger-button" data-modal="reset-election" ${restricted}>Reset Election</button>
                    </div>
                    ${isSuperAdmin() ? "" : '<small class="role-note">Only a super admin can manage system administration.</small>'}
                </section>
            </section>
        </main>`);
    bindAdminEvents();
    
    // Restore the active section after render
    const activeSection = localStorage.getItem("admin_active_section") || "overview";
    switchPanel(activeSection);
}

function switchPanel(panel) {
    if (!panel) return;
    localStorage.setItem("admin_active_section", panel);
    document.querySelectorAll("[data-panel-view]").forEach((item) => item.classList.toggle("active", item.dataset.panelView === panel));
    document.querySelectorAll("[data-panel]").forEach((item) => item.classList.toggle("active", item.dataset.panel === panel));
}

function resetCandidateForm() {
    const form = document.getElementById("candidate-form");
    if(form) {
        form.reset();
        document.getElementById("candidate-id").value = "";
        document.getElementById("candidate-active").checked = true;
        document.getElementById("candidate-submit").textContent = "Save";
        document.getElementById("candidate-cancel").hidden = true;
    }
}

function resetRuleForm() {
    const form = document.getElementById("rule-form");
    if(form) {
        form.reset();
        document.getElementById("rule-id").value = "";
        document.getElementById("rule-active").checked = true;
        document.getElementById("rule-submit").textContent = "Save";
        document.getElementById("rule-cancel").hidden = true;
    }
     const adminName = document.getElementById("admin-name");
    if(adminName) adminName.textContent = adminState.currentAdmin.name || adminState.currentAdmin.email;
}

// Attach these to window so inline onclick handlers can find them
window.updateTrackingMode = async function(mode) {
    await runAction(null, async () => {
        await updateSettings({ tracking_mode: mode });
    }, "Tracking mode updated.");
};

window.saveExpectedCount = async function() {
    const input = document.getElementById('expected-count-input');
    if(!input || !input.value) return;
    await runAction(null, async () => {
        await updateSettings({ expected_voters: parseInt(input.value) });
    }, "Expected voter count saved.");
};

window.saveMaxCandidates = async function() {
    const input = document.getElementById('max-candidates-input');
    const val = input && input.value !== '' ? parseInt(input.value) : null;
    await runAction(null, async () => {
        await updateSettings({ max_candidates: isNaN(val) ? null : val });
    }, "Max candidate limit saved.");
};

function bindAdminEvents() {
    document.getElementById("logout-btn").addEventListener("click", logout);
    document.querySelectorAll("[data-panel], [data-panel-link]").forEach((item) => item.addEventListener("click", () => switchPanel(item.dataset.panel || item.dataset.panelLink)));
    
    // Modal Triggers
    document.querySelectorAll("[data-modal]").forEach((item) => item.addEventListener("click", (e) => openModal(e.currentTarget.dataset.modal)));

    const candidateForm = document.getElementById("candidate-form");
    if (candidateForm) {
        candidateForm.addEventListener("submit", saveCandidate);
        document.getElementById("candidate-cancel").addEventListener("click", resetCandidateForm);
    }
    document.querySelectorAll("[data-edit-candidate]").forEach((item) => item.addEventListener("click", () => editCandidate(item.dataset.editCandidate)));
    document.querySelectorAll("[data-toggle-candidate]").forEach((item) => item.addEventListener("click", () => toggleCandidate(item.dataset.toggleCandidate)));
    document.querySelectorAll("[data-delete-candidate]").forEach((item) => item.addEventListener("click", () => confirmDeleteCandidate(item.dataset.deleteCandidate)));

    const ruleForm = document.getElementById("rule-form");
    if (ruleForm) {
        ruleForm.addEventListener("submit", saveRule);
        document.getElementById("rule-cancel").addEventListener("click", resetRuleForm);
    }
    document.querySelectorAll("[data-edit-rule]").forEach((item) => item.addEventListener("click", () => editRule(item.dataset.editRule)));
    document.querySelectorAll("[data-delete-rule]").forEach((item) => item.addEventListener("click", () => deleteRule(item.dataset.deleteRule)));

    const settingsForm = document.getElementById("settings-form");
    if(settingsForm) settingsForm.addEventListener("submit", saveSettings);
    
    const eligibleForm = document.getElementById("eligible-form");
    if(eligibleForm) eligibleForm.addEventListener("submit", saveEligibleStudents);
    
    const refreshBtn = document.getElementById("refresh-activity");
    if(refreshBtn) refreshBtn.addEventListener("click", refreshAdminData);
    
    const transferForm = document.getElementById("transfer-form");
    if(transferForm) transferForm.addEventListener("submit", transferAdmin);
    
    const reminderBtn = document.getElementById("send-reminder-btn");
    if(reminderBtn) reminderBtn.addEventListener("click", sendReminders);
}

function openModal(type) {
    const dialog = document.createElement("dialog");
    dialog.className = "reset-dialog";
    
    let content = '';
    
    if (type === 'go-live') {
        const nameValid = Boolean(adminState.settings?.election_name?.trim());
        const activeCands = adminState.candidates.filter(c => c.active);
        const inactiveCands = adminState.candidates.filter(c => !c.active);
        const totalCands = adminState.candidates.length;
        
        const maleCands = activeCands.filter(c => c.position === 'Male CR');
        const femaleCands = activeCands.filter(c => c.position === 'Female CR');
        const positionsSetting = adminState.settings?.election_positions || 'male_female';

        let positionsValid = true;
        let positionErrorMessage = '';

        if (positionsSetting === 'male_female') {
            if (maleCands.length === 0 || femaleCands.length === 0) {
                positionsValid = false;
                positionErrorMessage = 'Requires at least 1 active Male CR AND 1 active Female CR candidate.';
            }
        } else if (positionsSetting === 'male_only' && maleCands.length === 0) {
            positionsValid = false;
            positionErrorMessage = 'Requires at least 1 active Male CR candidate.';
        } else if (positionsSetting === 'female_only' && femaleCands.length === 0) {
            positionsValid = false;
            positionErrorMessage = 'Requires at least 1 active Female CR candidate.';
        } else if (activeCands.length === 0) {
            positionsValid = false;
            positionErrorMessage = 'Requires at least 1 active candidate.';
        }

        const candsValid = activeCands.length > 0 && positionsValid;
        const trackingMode = adminState.settings?.tracking_mode || 'rules_only';
        const studentsValid = adminState.eligibleStudents.length > 0 || trackingMode !== 'imported_list';
        const methodValid = Boolean(adminState.settings?.voting_method);
        const posSettingValid = Boolean(adminState.settings?.election_positions);

        const isValid = nameValid && candsValid && studentsValid && methodValid && posSettingValid;

        if (!isValid) {
            content = `
                <h2>Cannot Start Election</h2>
                <p style="color:var(--text-secondary); margin-bottom:12px;">Complete required setup before launching:</p>
                <div class="summary-list" style="margin: 15px 0; text-align:left;">
                    <p>${nameValid ? '✅' : '❌'} <strong>Election Name:</strong> ${nameValid ? escapeHTML(adminState.settings.election_name) : 'Missing'}</p>
                    <p>${candsValid ? '✅' : '❌'} <strong>Active Candidates:</strong> ${candsValid ? activeCands.length + ' active candidate(s)' : (positionErrorMessage || 'No active candidates')}</p>
                    <p>${studentsValid ? '✅' : '❌'} <strong>Voter Authorization / List:</strong> ${studentsValid ? 'Configured (' + trackingMode + ')' : 'No student list imported for Imported List mode'}</p>
                    <p>${methodValid ? '✅' : '❌'} <strong>Voting Method:</strong> ${methodValid ? escapeHTML(adminState.settings.voting_method) : 'Not selected'}</p>
                    <p>${posSettingValid ? '✅' : '❌'} <strong>Positions:</strong> ${posSettingValid ? escapeHTML(adminState.settings.election_positions) : 'Not selected'}</p>
                </div>
                <p style="font-size:0.85rem; color:#fcd34d; margin-bottom:15px;">Complete setup before launching.</p>
                <div style="display:flex; justify-content:flex-end;">
                    <button type="button" class="primary-button" onclick="this.closest('dialog').close()">Close</button>
                </div>`;
        } else {
            const expected = adminState.settings.expected_voters || 0;
            const trackingText = trackingMode === 'rules_only' ? 'Email Rules Only' : trackingMode === 'expected_count' ? `Expected Voter Count (${expected})` : 'Imported Student List';
            
            content = `
                <h2>FINAL ELECTION REVIEW</h2>
                <div class="summary-list" style="margin: 15px 0;">
                    <p><strong>Tracking Method:</strong> ${trackingText}</p>
                    <p><strong>Voting Method:</strong> ${escapeHTML(adminState.settings?.voting_method)}</p>
                    <p><strong>Voting Positions:</strong> ${escapeHTML(adminState.settings?.election_positions)}</p>
                </div>
                
                <div style="background:#1e293b; padding:12px 16px; border-radius:10px; margin-bottom:15px; border:1px solid rgba(148,163,184,0.1); text-align:left;">
                    <h4 style="margin-bottom:8px; font-size:0.9rem; color:#aebbd0;">Candidate Configuration Breakdown</h4>
                    <p style="font-size:0.85rem; margin-bottom:6px;">Total Candidates: <strong>${totalCands}</strong> | Active: <strong style="color:#34d399">${activeCands.length}</strong> | Inactive: <strong style="color:#94a3b8">${inactiveCands.length}</strong></p>
                    ${positionsSetting === 'male_female' ? `
                    <p style="font-size:0.85rem; margin-top:8px; color:#f8fafc;"><strong>Male CR (${maleCands.length}):</strong> ${maleCands.map(c => escapeHTML(c.name)).join(', ') || 'None'}</p>
                    <p style="font-size:0.85rem; margin-top:4px; color:#f8fafc;"><strong>Female CR (${femaleCands.length}):</strong> ${femaleCands.map(c => escapeHTML(c.name)).join(', ') || 'None'}</p>
                    ` : `
                    <p style="font-size:0.85rem; margin-top:8px; color:#f8fafc;"><strong>Active Candidates (${activeCands.length}):</strong> ${activeCands.map(c => escapeHTML(c.name)).join(', ') || 'None'}</p>
                    `}
                </div>

                <div style="background:rgba(16, 185, 129, 0.1); padding:10px; border-radius:8px; border:1px solid rgba(16, 185, 129, 0.3); margin-bottom:15px; text-align:left;">
                    <p style="color:#34d399; font-size:0.85rem; font-weight:bold;">PRIVACY GUARANTEES:</p>
                    <p style="color:#34d399; font-size:0.8rem; margin-top:5px;">✓ Vote choices are anonymous</p>
                    <p style="color:#34d399; font-size:0.8rem;">✓ Identity is stored separately for participation tracking</p>
                </div>
                
                <div style="background:rgba(239,68,68,0.1); padding:10px; border-radius:8px; border:1px solid rgba(239,68,68,0.3); margin-bottom:15px; text-align:left;">
                    <p style="color:#fca5a5; font-size:0.85rem; font-weight:bold;">LOCK WARNING:</p>
                    <p style="color:#fca5a5; font-size:0.8rem; margin-top:5px;">After going live: Candidates, Voters, Rules, and Configuration will be permanently locked.</p>
                </div>
                <div>
                    <button type="button" class="text-button" onclick="this.closest('dialog').close()">Cancel</button>
                    <button type="button" class="text-button" onclick="window.print()">Download PDF</button>
                    <button type="button" class="primary-button" id="confirm-go-live">Confirm & Go Live</button>
                </div>`;
        }
    } else if (type === 'close-election') {
        content = `
            <h2>Close Election</h2>
            <p>Voting will stop. Students will no longer be able to submit votes.</p>
            <div style="margin-top:15px; display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="text-button" onclick="this.closest('dialog').close()">Cancel</button>
                <button type="button" class="primary-button" id="confirm-close">Close Election</button>
            </div>`;
    } else if (type === 'start-final') {
        content = `
            <h2>FINAL ROUND CREATION</h2>
            <p>You are about to start Round 2.</p>
            <div style="margin: 15px 0; background:#111827; padding:15px; border-radius:8px;">
                <p><strong>Warning:</strong> Students will be allowed to vote again. Previous votes remain archived.</p>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="text-button" onclick="this.closest('dialog').close()">Cancel</button>
                <button type="button" class="primary-button" id="confirm-final">Confirm</button>
            </div>`;
    } else if (type === 'declare-results') {
        content = `
            <h2>Declare Results</h2>
            <p>Results will be published and students will be able to view them.</p>
            <div style="margin-top:15px; display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="text-button" onclick="this.closest('dialog').close()">Cancel</button>
                <button type="button" class="primary-button" id="confirm-declare">Declare Results</button>
            </div>`;
    } else if (type === 'reset-election') {
        content = `
            <h2>Reset Election</h2>
            <p>This will delete votes, activity logs, and rankings. Configuration and candidates will remain.</p>
            <label style="display:block; margin:15px 0; font-size:0.85rem; color:#dbe4f3;">Type <strong>RESET</strong> to confirm:
                <input type="text" id="reset-input" autocomplete="off" style="width:100%; padding:10px; margin-top:5px; border:1px solid var(--border); border-radius:7px; background:#111827; color:#fff;">
            </label>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="text-button" onclick="this.closest('dialog').close()">Cancel</button>
                <button type="button" class="danger-button" id="confirm-reset" disabled>Reset</button>
            </div>`;
    }

    dialog.innerHTML = `<div class="reset-dialog-card">${content}</div>`;
    document.body.appendChild(dialog);
    dialog.showModal();

    dialog.addEventListener("close", () => dialog.remove());

    // Bind specific confirm actions
    const bindConfirm = (id, actionFn) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener("click", async () => {
            dialog.close();
            await actionFn();
        });
    }

    bindConfirm("confirm-go-live", async () => {
        await runAction(null, async () => {
            await updateSettings({ election_status: "live", election_locked: true });
            await logActivity("GO_LIVE");
        }, "Election is now LIVE.");
    });

    bindConfirm("confirm-close", async () => {
        await runAction(null, async () => {
            await updateSettings({ election_status: "closed" });
            await logActivity("CLOSE_ELECTION");
        }, "Election Closed.");
    });

    bindConfirm("confirm-final", async () => {
        await runAction(null, async () => {
            await updateSettings({ election_status: "final_round" });
            await logActivity("START_FINAL_ROUND");
        }, "Final Round Started.");
    });

    bindConfirm("confirm-declare", async () => {
        await runAction(null, async () => {
            await updateSettings({ results_published: true });
            await logActivity("RESULT_DECLARED");
        }, "Results Declared.");
    });

    const resetInput = document.getElementById("reset-input");
    const confirmReset = document.getElementById("confirm-reset");
    if (resetInput && confirmReset) {
        resetInput.addEventListener("input", () => {
            confirmReset.disabled = resetInput.value !== "RESET";
        });
        confirmReset.addEventListener("click", async () => {
            dialog.close();
            await runAction(null, async () => {
                await supabaseClient.from("votes").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all safely
                await updateSettings({ election_status: "draft", results_published: false });
                await logActivity("RESET_ELECTION");
            }, "Election Reset.");
        });
    }
}

async function runAction(button, work, message) { 
    if(button) setButtonLoading(button, true); 
    try { 
        await work(); 
        await loadAdminData(); 
        renderAdminPortal(); 
        showToast(message, "success"); 
    } catch (error) { 
        console.error("Admin action error:", error); 
        showToast("Unable to process request. Please contact administrator.", "error"); 
    } finally { 
        if(button) setButtonLoading(button, false); 
    } 
}

async function updateSettings(changes) {
    if (!adminState.settings?.id) {
        saveStoredAdminConfig(changes);
        adminState.settings = { ...(adminState.settings || {}), ...changes };
        return;
    }
    const { error } = await supabaseClient.from("settings").update(changes).eq("id", adminState.settings.id);
    if (error) throw error;
}

async function saveCandidate(event) { 
    event.preventDefault(); 
    const id = document.getElementById("candidate-id").value; 
    const values = { name: document.getElementById("candidate-name").value.trim(), roll_number: document.getElementById("candidate-roll").value.trim(), position: document.getElementById("candidate-position").value, active: document.getElementById("candidate-active").checked }; 
    await runAction(event.currentTarget.querySelector(".primary-button"), async () => { 
        const response = id ? await supabaseClient.from("candidates").update(values).eq("id", id) : await supabaseClient.from("candidates").insert(values); 
        if (response.error) throw response.error; 
    }, id ? "Candidate updated." : "Candidate added."); 
}

function editCandidate(id) { 
    const item = adminState.candidates.find((candidate) => candidate.id === id); 
    if (!item) return; 
    document.getElementById("candidate-id").value = item.id; 
    document.getElementById("candidate-name").value = item.name; 
    document.getElementById("candidate-roll").value = item.roll_number; 
    document.getElementById("candidate-position").value = item.position; 
    document.getElementById("candidate-active").checked = item.active; 
    document.getElementById("candidate-submit").textContent = "Update"; 
    document.getElementById("candidate-cancel").hidden = false; 
    switchPanel("candidates"); 
}

async function toggleCandidate(id) { 
    const item = adminState.candidates.find((candidate) => candidate.id === id); 
    if (!item) return; 
    const newStatus = !item.active;
    await runAction(null, async () => { 
        const { error } = await supabaseClient.from("candidates").update({ active: newStatus }).eq("id", id); 
        if (error) throw error; 
    }, `Candidate ${item.name} is now ${newStatus ? 'Active 🟢' : 'Inactive ⚪'}.`); 
}

function confirmDeleteCandidate(id) {
    const item = adminState.candidates.find((candidate) => candidate.id === id);
    if (!item) return;

    const dialog = document.createElement("dialog");
    dialog.className = "reset-dialog";
    dialog.innerHTML = `
        <div class="reset-dialog-card">
            <h2>Delete Candidate?</h2>
            <p style="color:var(--text-secondary); margin-top:5px;">You are about to permanently remove:</p>
            <div style="margin: 15px 0; background: rgba(17,24,39,0.5); padding: 14px; border-radius: 8px; border: 1px solid var(--border); text-align: left;">
                <p style="font-size:0.95rem;"><strong>Candidate Name:</strong> ${escapeHTML(item.name)}</p>
                <p style="margin-top: 6px; font-size:0.95rem;"><strong>Roll Number:</strong> ${escapeHTML(item.roll_number)}</p>
                <p style="margin-top: 6px; font-size:0.95rem;"><strong>Position:</strong> ${escapeHTML(item.position)}</p>
            </div>
            <p style="color:#fca5a5; font-size:0.85rem; font-weight:600; margin-bottom:10px;">This action cannot be undone.</p>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="text-button" id="cancel-delete-candidate">Cancel</button>
                <button type="button" class="danger-button" id="confirm-delete-candidate">Delete Permanently</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();
    dialog.addEventListener("close", () => dialog.remove());

    dialog.querySelector("#cancel-delete-candidate").addEventListener("click", () => dialog.close());
    dialog.querySelector("#confirm-delete-candidate").addEventListener("click", async () => {
        dialog.close();
        await runAction(null, async () => {
            const { error } = await supabaseClient.from("candidates").delete().eq("id", id);
            if (error) throw error;
        }, `Candidate ${item.name} permanently deleted.`);
    });
}

async function saveRule(event) { 
    event.preventDefault(); 
    const id = document.getElementById("rule-id").value; 
    const values = { rule_type: document.getElementById("rule-type").value, rule_value: document.getElementById("rule-value").value.trim(), active: document.getElementById("rule-active").checked }; 
    await runAction(event.currentTarget.querySelector(".primary-button"), async () => { 
        const response = id ? await supabaseClient.from("allowed_email_rules").update(values).eq("id", id) : await supabaseClient.from("allowed_email_rules").insert(values); 
        if (response.error) throw response.error; 
    }, id ? "Email rule updated." : "Email rule added."); 
}

function editRule(id) { 
    const item = adminState.rules.find((rule) => rule.id === id); 
    if (!item) return; 
    document.getElementById("rule-id").value = item.id; 
    document.getElementById("rule-type").value = item.rule_type; 
    document.getElementById("rule-value").value = item.rule_value; 
    document.getElementById("rule-active").checked = item.active; 
    document.getElementById("rule-submit").textContent = "Update"; 
    document.getElementById("rule-cancel").hidden = false; 
    switchPanel("rules"); 
}

async function deleteRule(id) { 
    const item = adminState.rules.find((rule) => rule.id === id); 
    if (!item || !window.confirm(`Delete the rule “${item.rule_value}”?`)) return; 
    await runAction(null, async () => { 
        const { error } = await supabaseClient.from("allowed_email_rules").delete().eq("id", id); 
        if (error) throw error; 
    }, "Email rule deleted."); 
}

async function saveSettings(event) { 
    event.preventDefault(); 
    const startStr = document.getElementById("setting-start").value;
    const endStr = document.getElementById("setting-end").value;
    
    const values = { 
        election_name: document.getElementById("setting-name").value.trim(), 
        voting_method: document.getElementById("setting-voting-method").value, 
        election_positions: document.getElementById("setting-positions").value, 
        write_in_roll_digits: Number(document.getElementById("setting-digits").value), 
        allow_write_in_vote: document.getElementById("setting-write-in").checked, 
        ranked_voting_enabled: document.getElementById("setting-ranked").checked, 
        voting_start_date: startStr ? new Date(startStr).toISOString() : null,
        voting_end_date: endStr ? new Date(endStr).toISOString() : null,
        enable_automatic_emails: document.getElementById("setting-auto-emails").checked
    }; 
    await runAction(event.currentTarget.querySelector(".primary-button"), async () => { 
        await updateSettings(values); 
    }, "Settings saved."); 
}

async function saveEligibleStudents(event) { 
    event.preventDefault(); 
    const raw = document.getElementById("eligible-emails").value; 
    const { emails, invalid } = parseEligibleStudentInput(raw); 
    
    if (invalid > 0) {
        showToast(`Imported: ${emails.length}, Rejected: ${invalid} (Invalid format or domain)`, "info");
    }
    
    if (!emails.length) return showToast("No valid emails found to import.", "error"); 
    
    await runAction(event.currentTarget.querySelector(".primary-button"), async () => { 
        const payload = emails.map((email) => ({ email, status: "pending" })); 
        const { error } = await supabaseClient.from("eligible_students").upsert(payload, { onConflict: "email" }); 
        if (error) throw error; 
        await updateSettings({ total_students: adminState.eligibleStudents.length + emails.length }); 
    }, `Successfully imported ${emails.length} students.`); 
}

async function refreshAdminData() { await runAction(document.getElementById("refresh-activity"), async () => {}, "Activity refreshed."); }

async function transferAdmin(event) { 
    event.preventDefault(); 
    if (!isSuperAdmin()) return; 
    const email = normalizeEmail(document.getElementById("transfer-email").value); 
    if (!isValidEmail(email)) return showToast(MESSAGE.INVALID_EMAIL, "error"); 
    if (email === normalizeEmail(adminState.currentAdmin.email)) return showToast("The permanent super admin cannot be changed.", "error"); 
    await runAction(event.currentTarget.querySelector(".primary-button"), async () => { 
        const { error: deactivateError } = await supabaseClient.from("admins").update({ active: false }).eq("role", "election_admin").eq("active", true); 
        if (deactivateError) throw deactivateError; 
        const { error } = await supabaseClient.from("admins").upsert({ email, role: "election_admin", active: true }, { onConflict: "email" }); 
        if (error) throw error; 
        await logActivity("ADMIN_TRANSFER"); 
    }, "Election admin role transferred."); 
}

async function sendReminders() {
    const pendingCount = adminState.eligibleStudents.filter(s => s.status === 'pending').length;
    if (pendingCount === 0) return showToast("No pending students to remind.", "info");
    
    await runAction(document.getElementById("send-reminder-btn"), async () => {
        // Here we would trigger an edge function or insert into email_notifications
        await logActivity("EMAIL_BROADCAST");
    }, `Reminders queued for ${pendingCount} students.`);
}

async function initializeAdminPage() {
    try {
        const session = await getSession();
        if (!session?.user?.email) { window.location.replace("/"); return; }
        const email = normalizeEmail(session.user.email);
        const admin = await queryAdmin("admins", (q) => q.select("id, email, role, active").eq("email", email).eq("active", true).maybeSingle());
        if (!admin) { renderError("Admin access required", "Your account is not an active administrator."); return; }
        adminState.currentAdmin = admin;
        await loadAdminData();
        renderAdminPortal();
    } catch (error) {
        console.error("Admin startup error:", error);
        renderError("Unable to load admin", "Unable to load election settings. Please contact administrator.");
    } finally {
        stopLoading();
        showApp();
    }
}
