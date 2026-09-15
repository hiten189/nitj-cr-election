/* ==========================================================
   Student authorization and participation setup
========================================================== */

const AdminRules = {
    parseEmails(raw) {
        const emails = [];
        const invalid = [];
        const duplicates = [];
        const seen = new Set();
        
        String(raw || "").split(/\n|,|<br\s*\/?>|\s+/i).map((value) => normalizeEmail(value)).filter(Boolean).forEach((email) => {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                invalid.push({ email, reason: "Invalid format" });
            } else if (seen.has(email)) {
                duplicates.push(email);
            } else {
                seen.add(email);
                emails.push(email);
            }
        });
        
        return { emails, invalid, duplicates };
    },

    init() {
        const panel = document.querySelector('[data-panel-view="rules"]');
        if (!panel) return;

        panel.addEventListener("click", (event) => {
            const card = event.target.closest(".method-card");
            if (card && !card.querySelector("input").disabled) {
                card.querySelector("input").checked = true;
                this.updateMode(card.querySelector("input").value);
            }
        });

        panel.addEventListener("change", (event) => {
            if (event.target.name === "authorization-mode") this.updateMode(event.target.value);
            if (event.target.id === "expected-voters-enabled") this.updateExpectedVoters();
            if (event.target.id === "roster-file-input" && event.target.files.length) {
                this.handleFileUpload(event.target.files[0]);
                event.target.value = "";
            }
        });

        panel.addEventListener("dragover", (e) => {
            const dropZone = e.target.closest("#roster-drop-zone");
            if (dropZone) {
                e.preventDefault();
                dropZone.style.borderColor = "var(--primary)";
                dropZone.style.background = "var(--bg-active)";
            }
        });

        panel.addEventListener("dragleave", (e) => {
            const dropZone = e.target.closest("#roster-drop-zone");
            if (dropZone) {
                e.preventDefault();
                dropZone.style.borderColor = "var(--border)";
                dropZone.style.background = "var(--bg-surface)";
            }
        });

        panel.addEventListener("drop", (e) => {
            const dropZone = e.target.closest("#roster-drop-zone");
            if (dropZone) {
                e.preventDefault();
                dropZone.style.borderColor = "var(--border)";
                dropZone.style.background = "var(--bg-surface)";
                if (e.dataTransfer.files.length) {
                    this.handleFileUpload(e.dataTransfer.files[0]);
                }
            }
        });

        panel.addEventListener("click", (e) => {
            const dropZone = e.target.closest("#roster-drop-zone");
            const textarea = e.target.closest("textarea");
            if (dropZone && !textarea) {
                document.getElementById("roster-file-input")?.click();
            }
        });
        
        panel.addEventListener("input", (event) => {
            if (event.target.id === "special-emails") this.updateSummary("suffix");
            if (event.target.id === "complete-roster") this.updateSummary("roster");
        });

        panel.addEventListener("submit", (event) => {
            if (event.target.id !== "authorization-form") return;
            event.preventDefault();
            this.save(event.target);
        });
    },

    async load() {
        await Promise.all([
            window.ElectionState.refreshRules(),
            window.ElectionState.refreshSettings()
        ]);
    },

    render() {
        const container = document.querySelector('[data-panel-view="rules"]');
        if (!container) return;
        
        const state = window.ElectionState;
        const settings = state.settings || {};
        const isLive = settings.election_status !== ELECTION_STATUS.DRAFT;
        const rules = state.rules || [];
        
        const exactRules = rules.filter((rule) => ["exact", "email", "exact_email"].includes(String(rule.rule_type || "").toLowerCase()));
        const suffixRules = rules.filter((rule) => ["suffix", "domain", "email_domain"].includes(String(rule.rule_type || "").toLowerCase()));
        const suffixValues = suffixRules.length ? suffixRules.map(r => r.rule_value).join(", ") : "@nitj.ac.in";
        
        const rosterMode = (settings.tracking_mode || TRACKING_MODE.RULES_ONLY) === TRACKING_MODE.IMPORTED_LIST;
        const expectedMode = (settings.tracking_mode || TRACKING_MODE.RULES_ONLY) === TRACKING_MODE.EXPECTED_COUNT;

        // Populate previous lists
        let rosterEmails = [];
        if (rosterMode && state.eligibleStudents) {
            rosterEmails = state.eligibleStudents.map(s => s.email);
        }

        container.innerHTML = `
            <div style="margin-bottom:28px;">
                <h2 style="font-size:1.4rem; font-weight:800; font-family:var(--font-display);">Student Authorization</h2>
                <p style="color:var(--text-2); font-size:.9rem; margin-top:6px;">Configure how students are allowed to authenticate and participate in this election.</p>
            </div>
            
            ${isLive ? `<div class="ui-card" style="margin-bottom:24px; padding:16px 20px; background:var(--warning-dim); border:1px solid rgba(245, 158, 11, 0.3); border-radius:var(--r-md); display:flex; align-items:center; gap:12px;"><span style="font-size:1.5rem;">🔒</span><div><h3 style="margin:0; font-size:1rem; color:var(--warning);">Authorization Locked</h3><p style="margin:4px 0 0; color:var(--text-2); font-size:0.85rem;">The election is currently live. You can view the authorized emails below, but cannot modify them.</p></div></div>` : ``}
            
            <form id="authorization-form" style="display:grid; gap:20px;">
                
                <div class="method-cards">
                    <label class="method-card ${!rosterMode ? "active" : ""}">
                        <div class="method-card-check"></div>
                        <input type="radio" name="authorization-mode" value="suffix" ${!rosterMode ? "checked" : ""} style="display:none;">
                        <div class="method-card-icon">✉️</div>
                        <h3>Email Suffix <span style="font-size:0.7rem; color:var(--gold); font-weight:700; text-transform:uppercase; margin-left:6px; background:rgba(251, 191, 36, 0.1); padding:2px 6px; border-radius:4px;">Recommended</span></h3>
                        <p>Allow any student with a specific email domain (e.g. @nitj.ac.in). Optionally add individual exceptions.</p>
                    </label>

                    <label class="method-card ${rosterMode ? "active" : ""}">
                        <div class="method-card-check"></div>
                        <input type="radio" name="authorization-mode" value="roster" ${rosterMode ? "checked" : ""} style="display:none;">
                        <div class="method-card-icon">📋</div>
                        <h3>Complete Student List</h3>
                        <p>Upload a CSV, Excel, or TXT file, or paste your student list directly.</p>
                    </label>
                </div>

                <div class="ui-card">
                    
                    <!-- METHOD 1: SUFFIX -->
                    <div class="method-panel-wrapper ${!rosterMode ? "expanded" : ""}" data-authorization-panel="suffix">
                        <div class="method-panel-inner" style="display:grid; gap:18px; padding-bottom: ${!rosterMode ? '10px' : '0'};">
                            <h3 style="font-size:1.05rem; font-weight:700; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:4px;">Suffix Configuration</h3>
                            
                            <label style="display:grid; gap:6px; color:var(--text-2); font-size:.85rem; font-weight:600;">Institute Email Suffixes <span style="color:var(--text-muted); font-weight:400;">(Separate multiple with commas)</span>
                                <input id="authorization-suffix" value="${escapeHTML(suffixValues)}" placeholder="@nitj.ac.in, @gmail.com" style="padding:10px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                            </label>
                            
                            <label style="display:grid; gap:6px; color:var(--text-2); font-size:.85rem; font-weight:600;">Additional Allowed Emails <span style="color:var(--text-muted); font-weight:400;">(Optional, paste one per line)</span>
                                <textarea id="special-emails" rows="5" placeholder="student1@gmail.com&#10;student2.ip.24@nitj.ac.in" style="padding:10px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text); font-family:monospace; font-size:0.85rem;">${escapeHTML(exactRules.map((rule) => rule.rule_value).join("\n"))}</textarea>
                            </label>
                            
                            <div id="suffix-summary"></div>
                            
                            <div style="margin-top:8px; padding-top:16px; border-top:1px solid var(--border);">
                                <label style="display:flex; align-items:center; gap:8px; color:var(--text-2); font-size:.85rem; font-weight:600; cursor:pointer;">
                                    <input id="expected-voters-enabled" type="checkbox" ${expectedMode ? "checked" : ""}> 
                                    I know the expected total number of voters
                                </label>
                                <div class="method-panel-wrapper ${expectedMode ? "expanded" : ""}" id="expected-voters-wrapper">
                                    <div class="method-panel-inner" style="padding-top:12px;">
                                        <label style="display:grid; gap:6px; color:var(--text-2); font-size:.85rem;">Expected Voters Count
                                            <input id="expected-voters" type="number" min="1" value="${expectedMode ? Number(settings.expected_voters || "") : ""}" style="padding:10px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text); max-width:200px;">
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- METHOD 2: ROSTER -->
                    <div class="method-panel-wrapper ${rosterMode ? "expanded" : ""}" data-authorization-panel="roster">
                        <div class="method-panel-inner" style="display:grid; gap:14px; padding-bottom: ${rosterMode ? '10px' : '0'};">
                            <h3 style="font-size:1.05rem; font-weight:700; border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:4px;">Import Roster</h3>
                            
                            <div class="drop-zone" id="roster-drop-zone" style="border: 2px dashed var(--border-strong); border-radius: var(--r-md); padding: 40px 24px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--bg-surface-2);">
                                <div style="font-size: 2.5rem; margin-bottom: 12px; opacity:0.8;">📂</div>
                                <div style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 6px;">Drag & Drop CSV, TXT, or Excel file here</div>
                                <div style="font-size: 0.9rem; color: var(--text-2); margin-bottom: 12px;">or click to browse files</div>
                                <input type="file" id="roster-file-input" accept=".csv,.txt,.xlsx,.xls" style="display:none;">
                                
                                <div style="margin-top:24px; padding-top:24px; border-top:1px solid var(--border);">
                                    <label style="display:grid; gap:8px; color:var(--text-2); font-size:.9rem; font-weight:600; text-align: left;">Or Paste Student Emails <span style="color:var(--text-muted); font-weight:400; font-size:0.85rem;">(One email per line)</span>
                                        <textarea id="complete-roster" rows="6" placeholder="student1@nitj.ac.in&#10;student2@nitj.ac.in" style="padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-card); color:var(--text); font-family:monospace; font-size:0.9rem; width: 100%; box-sizing: border-box; transition:border-color var(--t-base);" onclick="event.stopPropagation();">${escapeHTML(rosterEmails.join("\n"))}</textarea>
                                    </label>
                                </div>
                            </div>
                            
                            <div id="roster-summary"></div>
                        </div>
                    </div>

                </div>
                
                
                ${!isLive ? `<div style="display:flex; justify-content:flex-start; margin-top:4px;">
                    <button class="btn btn-primary" type="submit" style="padding:12px 24px; font-size:0.95rem;">Save Authorization Configuration</button>
                </div>` : ``}
            </form>
        `;

        this.updateSummary("suffix");
        this.updateSummary("roster");
        
        if (isLive) {
            container.querySelectorAll('input[type="text"], input[type="number"], input[type="file"], textarea, button').forEach(el => el.disabled = true);
            container.querySelectorAll('#expected-voters-enabled').forEach(el => el.disabled = true);
        }
    },

    updateMode(mode) {
        document.querySelectorAll(".method-card").forEach(card => {
            const isMatch = card.querySelector('input').value === mode;
            card.classList.toggle("active", isMatch);
        });

        const isLive = window.ElectionState.settings?.election_status !== ELECTION_STATUS.DRAFT;

        document.querySelectorAll(".method-panel-wrapper[data-authorization-panel]").forEach((panel) => {
            const isMatch = panel.dataset.authorizationPanel === mode;
            panel.classList.toggle("expanded", isMatch);
            
            // Manage disabled state for form submission
            panel.querySelectorAll("input, textarea").forEach(input => {
                if (isLive) {
                    if (input.type !== 'radio') input.disabled = true;
                } else {
                    input.disabled = !isMatch;
                }
            });
            
            if (isMatch && mode === "suffix" && !isLive) {
                this.updateExpectedVoters();
            }
        });
    },

    updateExpectedVoters() {
        const enabled = document.getElementById("expected-voters-enabled")?.checked;
        const wrapper = document.getElementById("expected-voters-wrapper");
        if (wrapper) wrapper.classList.toggle("expanded", enabled);
        const input = document.getElementById("expected-voters");
        if (input) input.disabled = !enabled;
    },
    
    updateSummary(mode) {
        const textareaId = mode === "suffix" ? "special-emails" : "complete-roster";
        const summaryId = mode === "suffix" ? "suffix-summary" : "roster-summary";
        
        const textarea = document.getElementById(textareaId);
        const summaryDiv = document.getElementById(summaryId);
        if (!textarea || !summaryDiv) return;
        
        // Skip updating summary if disabled UNLESS it's the initial render where we want to show it.
        // We will just always run it since it reads from textarea.value.
        
        const raw = textarea.value.trim();
        if (!raw) {
            summaryDiv.innerHTML = '';
            return;
        }
        
        const { emails, invalid, duplicates } = this.parseEmails(raw);
        
        let html = '<div class="ui-card" style="margin-top:16px; padding: 20px; border-left: 4px solid ' + (invalid.length > 0 ? 'var(--warning)' : 'var(--success)') + ';">';
        html += '<h4 style="font-size:1.05rem; font-weight:700; margin-bottom:16px; display:flex; align-items:center; gap:8px;"><span style="font-size:1.2rem;">📋</span> ' + (mode === "suffix" ? "Additional Emails Summary" : "Import Summary") + '</h4>';
        html += '<div style="display:flex; flex-wrap:wrap; gap:24px; margin-bottom:16px;">';
        html += '<div style="display:flex; flex-direction:column; gap:4px;"><span style="font-size:1.5rem; font-weight:800; color:var(--success);">' + emails.length + '</span><span style="font-size:0.8rem; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.05em;">Valid Emails</span></div>';
        if (duplicates.length) html += '<div style="display:flex; flex-direction:column; gap:4px;"><span style="font-size:1.5rem; font-weight:800; color:var(--warning);">' + duplicates.length + '</span><span style="font-size:0.8rem; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.05em;">Duplicates</span></div>';
        if (invalid.length) html += '<div style="display:flex; flex-direction:column; gap:4px;"><span style="font-size:1.5rem; font-weight:800; color:var(--danger);">' + invalid.length + '</span><span style="font-size:0.8rem; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:0.05em;">Invalid Emails</span></div>';
        html += '</div>';
        
        if (invalid.length > 0) {
            html += '<div style="font-size:0.8rem; color:var(--text-2); max-height:120px; overflow-y:auto; padding:10px 12px; background:var(--bg-base); border:1px solid var(--border); border-radius:var(--r-sm); margin-top:8px;">';
            html += '<div style="font-weight:600; margin-bottom:6px; color:var(--text);">Invalid Emails Found:</div>';
            invalid.slice(0, 10).forEach(inv => {
                html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><code>' + escapeHTML(inv.email) + '</code> <span style="color:var(--danger); font-weight:500;">' + inv.reason + '</span></div>';
            });
            if (invalid.length > 10) html += '<div style="margin-top:6px; font-style:italic; color:var(--text-muted);">...and ' + (invalid.length - 10) + ' more</div>';
            html += '</div>';
        }

        if (duplicates.length > 0) {
            html += '<div style="font-size:0.8rem; color:var(--text-2); max-height:120px; overflow-y:auto; padding:10px 12px; background:var(--bg-base); border:1px solid var(--border); border-radius:var(--r-sm); margin-top:8px;">';
            html += '<div style="font-weight:600; margin-bottom:6px; color:var(--text);">Duplicate Emails Ignored:</div>';
            duplicates.slice(0, 10).forEach(dup => {
                html += '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><code>' + escapeHTML(dup) + '</code> <span style="color:var(--warning); font-weight:500;">Duplicate</span></div>';
            });
            if (duplicates.length > 10) html += '<div style="margin-top:6px; font-style:italic; color:var(--text-muted);">...and ' + (duplicates.length - 10) + ' more</div>';
            html += '</div>';
        }
        
        // Show valid emails list for suffix mode if they want to know what is authorized
        if (emails.length > 0 && mode === "suffix") {
            html += '<div style="font-size:0.8rem; color:var(--text-2); max-height:120px; overflow-y:auto; padding:10px 12px; background:var(--bg-base); border:1px solid var(--border); border-radius:var(--r-sm); margin-top:12px;">';
            html += '<div style="font-weight:600; margin-bottom:6px; color:var(--text);">Authorized Additional Emails:</div>';
            emails.slice(0, 15).forEach(e => {
                html += '<div style="margin-bottom:4px; display:flex; align-items:center; gap:8px;">✅ <code>' + escapeHTML(e) + '</code></div>';
            });
            if (emails.length > 15) html += '<div style="margin-top:6px; font-style:italic; color:var(--text-muted);">...and ' + (emails.length - 15) + ' more</div>';
            html += '</div>';
        }
        
        html += '</div>';
        
        summaryDiv.innerHTML = html;
    },

    async save(form) {
        const mode = form.querySelector('[name="authorization-mode"]:checked').value;
        const submitButton = form.querySelector('button[type="submit"]');
        let emails = [];
        let invalid = [];
        let rules = [];
        let settingsChanges;

        if (mode === "suffix") {
            const suffixRaw = document.getElementById("authorization-suffix").value;
            const suffixes = suffixRaw.split(",").map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
            
            if (!suffixes.length || suffixes.some(s => !s.includes("@"))) return UI.showToast("Enter valid institute email suffixes (e.g. @nitj.ac.in).", "error");
            
            ({ emails, invalid } = this.parseEmails(document.getElementById("special-emails").value));
            if (invalid.length > 0) return UI.showToast("Please fix invalid special emails before saving.", "error");
            
            rules = [
                ...suffixes.map(s => ({ rule_type: "suffix", rule_value: s, active: true })),
                ...emails.map((email) => ({ rule_type: "exact", rule_value: email, active: true }))
            ];
            
            const expected = document.getElementById("expected-voters-enabled").checked;
            const count = Number(document.getElementById("expected-voters").value);
            if (expected && (!Number.isInteger(count) || count < 1)) return UI.showToast("Enter a valid expected voter count.", "error");
            
            settingsChanges = { tracking_mode: expected ? TRACKING_MODE.EXPECTED_COUNT : TRACKING_MODE.RULES_ONLY, expected_voters: expected ? count : null };
        } else {
            ({ emails, invalid } = this.parseEmails(document.getElementById("complete-roster").value));
            if (!emails.length) return UI.showToast("Paste at least one valid institute email.", "error");
            if (invalid.length > 0) return UI.showToast("Please remove invalid emails from the roster before saving.", "error");
            
            rules = emails.map((email) => ({ rule_type: "exact", rule_value: email, active: true }));
            settingsChanges = { tracking_mode: TRACKING_MODE.IMPORTED_LIST, expected_voters: null };
        }

        UI.setButtonLoading(submitButton, true);
        try {
            await RulesAPI.replaceAuthorizationRules(rules);
            // A roster only belongs to roster authorization. Switching back to
            // suffix mode must not retain or display an old imported roster.
            await EligibleStudentsAPI.replaceAll(mode === "roster" ? emails : []);
            await SettingsAPI.update(window.ElectionState.settings.id, settingsChanges);
            await AdminUtils.logActivity("AUTHORIZATION_UPDATED", { mode, count: mode === "roster" ? emails.length : rules.length });
            await refreshAdminViews();
            UI.showToast("Authorization configuration saved successfully.", "success");
        } catch (error) {
            UI.showToast(error.message || "Failed to save authorization.", "error");
        } finally {
            UI.setButtonLoading(submitButton, false);
        }
    },

    handleFileUpload(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
                if (typeof XLSX === "undefined") {
                    UI.showToast("Excel parsing library not loaded. Please use CSV or TXT.", "error");
                    return;
                }
                try {
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const csv = XLSX.utils.sheet_to_csv(sheet);
                    this.appendEmailsToRoster(csv);
                } catch(err) {
                    UI.showToast("Failed to parse Excel file.", "error");
                }
            } else {
                this.appendEmailsToRoster(data);
            }
        };
        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
            reader.readAsBinaryString(file);
        } else {
            reader.readAsText(file);
        }
    },
    
    appendEmailsToRoster(text) {
        const textarea = document.getElementById("complete-roster");
        if (!textarea) return;
        
        const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        
        const existing = textarea.value.trim();
        if (matches.length > 0) {
            textarea.value = existing ? existing + "\n" + matches.join("\n") : matches.join("\n");
            this.updateSummary("roster");
            UI.showToast(`Found ${matches.length} emails in file.`, "success");
        } else {
            UI.showToast("No valid emails found in the file.", "warning");
        }
    },

    async refresh() {
        await this.load();
        this.render();
    }
};

window.AdminRules = AdminRules;
