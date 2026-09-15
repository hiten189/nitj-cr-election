/* ==========================================================
   IPE Voting System
   admin-settings.js
========================================================== */

const AdminSettings = {
    init() {
        logDebug("AdminSettings init");
        const panel = document.querySelector('[data-panel-view="settings"]');
        if (panel) {
            panel.addEventListener("submit", (e) => {
                if (e.target.id === "settings-form") {
                    e.preventDefault();
                    this.saveGeneralSettings(e.target);
                }
            });
        }
    },

    async load() {
        logDebug("AdminSettings load");
        await window.ElectionState.refreshSettings();
    },

    render() {
        logDebug("AdminSettings render");
        const container = document.querySelector('[data-panel-view="settings"]');
        if (!container) return;

        const state = window.ElectionState;
        const settings = state.settings || {};
        const isLive = settings.election_status !== ELECTION_STATUS.DRAFT;
        /* Legacy tracking controls are intentionally removed: authorization and
           participation tracking are configured together in AdminRules. */
        /* const trackingMode = settings.tracking_mode || TRACKING_MODE.RULES_ONLY;
        const expectedCount = Number(settings.expected_voters) || 0;

        const renderModeCard = (mode, icon, title, desc, isActive) => `
            <div data-tracking-mode="${mode}" style="position:relative; padding:20px; border-radius:var(--r-md); border:2px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; background:${isActive ? 'var(--primary-dim)' : 'var(--bg-card)'}; cursor:pointer; transition:var(--t-base);">
                ${isActive ? '<div style="position:absolute; top:12px; right:12px; font-size:0.8rem; color:var(--primary); font-weight:700;">✓ Active</div>' : ''}
                <div style="font-size:1.8rem; margin-bottom:10px;">${icon}</div>
                <h3 style="font-size:0.95rem; font-weight:700; margin-bottom:6px;">${title}</h3>
                <p style="font-size:0.82rem; color:var(--text-2); margin:0;">${desc}</p>
                ${(isActive && mode === TRACKING_MODE.EXPECTED_COUNT) ? `
                <div style="margin-top:12px;" onclick="event.stopPropagation()">
                    <label style="font-size:0.78rem; color:var(--text-2); display:block; margin-bottom:4px;">Expected voters count:</label>
                    <div style="display:flex; gap:8px;">
                        <input type="number" id="expected-count-input" value="${expectedCount}" style="width:110px; padding:6px 10px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--r-sm); color:var(--text);">
                        <button class="btn btn-primary" id="save-expected-count" style="padding:6px 12px; font-size:0.82rem;">Save Count</button>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        let modeHTML = false && !isLive ? `
            <div class="ui-card" style="margin-bottom:24px;">
                <h3 class="ui-card-title">Voter Authorization &amp; Tracking Mode</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
                    ${renderModeCard(TRACKING_MODE.RULES_ONLY, '📧', 'Email Rules Only', 'Authorize voters via wildcard/suffix rules. No student list import needed.', trackingMode === TRACKING_MODE.RULES_ONLY)}
                    ${renderModeCard(TRACKING_MODE.EXPECTED_COUNT, '👥', 'Expected Voter Count', 'Track turnout percentage by setting an expected voter population.', trackingMode === TRACKING_MODE.EXPECTED_COUNT)}
                    ${renderModeCard(TRACKING_MODE.IMPORTED_LIST, '📋', 'Import Student List', 'Upload student email list to track individual pending/voted statuses.', trackingMode === TRACKING_MODE.IMPORTED_LIST)}
                </div>
                ${trackingMode === TRACKING_MODE.IMPORTED_LIST ? `
                <form id="eligible-form-setup" style="display:grid; gap:8px; margin-top:16px; padding:16px; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--r-md);">
                    <label style="font-size:.86rem; font-weight:700;">Paste student emails for turnout tracking (one per line)
                        <textarea id="eligible-emails-setup" rows="5" placeholder="student1@nitj.ac.in&#10;student2@nitj.ac.in" style="display:block; width:100%; margin-top:6px; padding:10px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-sm); color:var(--text);"></textarea>
                    </label>
                    <small style="color:var(--text-muted);">This list is used only for participation and pending-voter tracking.</small>
                    <button class="btn btn-primary" type="submit" style="justify-self:start;">Import Student List</button>
                </form>` : ''}
            </div>
        ` : '';

        */
        const modeHTML = '';

        let generalSettingsHTML = `
            <form id="settings-form" style="display: grid; gap: 24px;">
                <fieldset ${isLive ? 'disabled' : ''} style="display:contents; border:none; padding:0; margin:0;">
                    
                    <div class="ui-card">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                            <span style="font-size:1.3rem;">⚙️</span>
                            <h3 class="ui-card-title" style="margin:0; font-size:1.1rem;">General</h3>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                            <label style="display:grid; gap:8px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Election Name
                                <input id="setting-name" value="${escapeHTML(settings.election_name || "")}" required style="padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text); transition:border-color var(--t-base);">
                            </label>
                            <label style="display:grid; gap:8px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Voting Method
                                <select id="setting-voting-method" style="padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text); transition:border-color var(--t-base);">
                                    <option value="${VOTING_METHOD.SINGLE}" ${settings.voting_method === VOTING_METHOD.SINGLE ? "selected" : ""}>Single Choice</option>
                                    <option value="${VOTING_METHOD.RANKED}" ${settings.voting_method === VOTING_METHOD.RANKED ? "selected" : ""}>Ranked Choice Voting</option>
                                    <option value="${VOTING_METHOD.RANKED_FINAL_VS}" ${settings.voting_method === VOTING_METHOD.RANKED_FINAL_VS ? "selected" : ""}>Ranked + Final VS</option>
                                </select>
                            </label>
                            <label style="display:grid; gap:8px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Positions
                                <select id="setting-positions" style="padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text); transition:border-color var(--t-base);">
                                    <option value="${ELECTION_POSITIONS.MALE_FEMALE}" ${settings.election_positions === ELECTION_POSITIONS.MALE_FEMALE ? "selected" : ""}>Male + Female</option>
                                    <option value="${ELECTION_POSITIONS.MALE_ONLY}" ${settings.election_positions === ELECTION_POSITIONS.MALE_ONLY ? "selected" : ""}>Male Only</option>
                                    <option value="${ELECTION_POSITIONS.FEMALE_ONLY}" ${settings.election_positions === ELECTION_POSITIONS.FEMALE_ONLY ? "selected" : ""}>Female Only</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    <div class="ui-card">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                            <span style="font-size:1.3rem;">📅</span>
                            <h3 class="ui-card-title" style="margin:0; font-size:1.1rem;">Schedule</h3>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                            <label style="display:grid; gap:8px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Start Date (optional)
                                <input id="setting-start" type="datetime-local" value="${settings.voting_start_date ? settings.voting_start_date.slice(0,16) : ''}" style="padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text); transition:border-color var(--t-base);">
                            </label>
                            <label style="display:grid; gap:8px; font-size:0.85rem; font-weight:600; color:var(--text-2);">End Date (optional)
                                <input id="setting-end" type="datetime-local" value="${settings.voting_end_date ? settings.voting_end_date.slice(0,16) : ''}" style="padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text); transition:border-color var(--t-base);">
                            </label>
                        </div>
                    </div>

                    <div class="ui-card">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 12px;">
                            <span style="font-size:1.3rem;">🛠️</span>
                            <h3 class="ui-card-title" style="margin:0; font-size:1.1rem;">Options</h3>
                        </div>
                        <div style="display: grid; gap: 20px;">
                            <label style="display:grid; gap:8px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Write-in Digits
                                <input id="setting-digits" type="number" min="1" value="${escapeHTML(settings.write_in_roll_digits || "")}" style="padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text); max-width: 250px; transition:border-color var(--t-base);">
                            </label>
                            
                            <label style="display:flex; align-items:flex-start; gap:12px; cursor:pointer;">
                                <input id="setting-write-in" type="checkbox" ${settings.allow_write_in_vote ? "checked" : ""} style="width:20px; height:20px; margin-top:2px; cursor:pointer;">
                                <div>
                                    <span style="display:block; font-size:0.95rem; font-weight:600; color:var(--text);">Allow write-ins</span>
                                    <span style="display:block; font-size:0.85rem; color:var(--text-2); margin-top:2px;">Permit students to cast votes for non-listed candidates using their roll number.</span>
                                </div>
                            </label>
                            
                        </div>
                    </div>

                    <div style="margin-top: 10px;">
                        <button class="btn btn-primary" type="submit" style="padding:12px 28px; font-size:0.95rem;">Save Settings</button>
                    </div>
                </fieldset>
            </form>
        `;

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px;">
                <div>
                    <h2 style="font-size: 1.4rem; font-weight: 800; font-family:var(--font-display);">Voting Setup</h2>
                    <p style="color:var(--text-2); font-size:0.9rem; margin-top:6px;">${isLive ? "🔒 Settings are locked while election is live." : "Configure voting rules, positions, tracking mode, and limits."}</p>
                </div>
            </div>
            ${modeHTML}
            ${generalSettingsHTML}
        `;
    },

    async refresh() {
        logDebug("AdminSettings refresh");
        await this.load();
        this.render();
    },

    async updateTrackingMode(mode) {
        if (window.ElectionState.settings?.election_status !== ELECTION_STATUS.DRAFT) return;
        try {
            await SettingsAPI.update(window.ElectionState.settings.id, { tracking_mode: mode });
            await AdminUtils.logActivity("TRACKING_MODE_UPDATED", { mode });
            UI.showToast("Tracking mode updated.", "success");
            await this.refresh();
        } catch (e) {
            UI.showToast(e.message || "Failed to update mode", "error");
        }
    },

    async saveExpectedCount() {
        const input = document.getElementById("expected-count-input");
        if (!input || !input.value) return;
        const val = parseInt(input.value);
        try {
            await SettingsAPI.update(window.ElectionState.settings.id, { expected_voters: val });
            await AdminUtils.logActivity("EXPECTED_VOTERS_UPDATED", { count: val });
            UI.showToast("Expected voter count saved.", "success");
            await this.refresh();
        } catch (e) {
            UI.showToast(e.message || "Failed to save count", "error");
        }
    },

    async saveGeneralSettings(form) {
        const changes = {
            election_name: document.getElementById("setting-name").value,
            voting_method: document.getElementById("setting-voting-method").value,
            election_positions: document.getElementById("setting-positions").value,
            allow_write_in_vote: document.getElementById("setting-write-in").checked,
            write_in_roll_digits: document.getElementById("setting-digits").value ? parseInt(document.getElementById("setting-digits").value) : null,
            voting_start_date: document.getElementById("setting-start").value ? new Date(document.getElementById("setting-start").value).toISOString() : null,
            voting_end_date: document.getElementById("setting-end").value ? new Date(document.getElementById("setting-end").value).toISOString() : null
        };
        const submitBtn = form.querySelector('button[type="submit"]');
        UI.setButtonLoading(submitBtn, true);
        try {
            await SettingsAPI.update(window.ElectionState.settings.id, changes);
            await AdminUtils.logActivity("SETTINGS_UPDATED", changes);
            UI.showToast("Settings updated successfully.", "success");
            await this.refresh();
        } catch (e) {
            UI.showToast(e.message || "Failed to update settings", "error");
        } finally {
            UI.setButtonLoading(submitBtn, false);
        }
    },

    async importStudents(form) {
        const textarea = form.querySelector("textarea");
        const { emails, invalid } = parseEligibleStudentInput(textarea?.value);
        if (!emails.length) return UI.showToast("Enter at least one valid institute email.", "error");
        const submitBtn = form.querySelector('button[type="submit"]');
        UI.setButtonLoading(submitBtn, true);
        try {
            await EligibleStudentsAPI.importEmails(emails);
            await AdminUtils.logActivity("TRACKING_LIST_IMPORTED", { count: emails.length });
            UI.showToast(`${emails.length} student${emails.length === 1 ? "" : "s"} imported for tracking${invalid.length ? `; ${invalid.length} invalid entries skipped` : ""}.`, invalid.length ? "warning" : "success");
            await this.refresh();
        } catch (error) {
            UI.showToast(error.message || "Failed to import the tracking list.", "error");
        } finally {
            UI.setButtonLoading(submitBtn, false);
        }
    }
};

window.AdminSettings = AdminSettings;
