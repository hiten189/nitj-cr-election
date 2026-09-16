/* ==========================================================
   IPE Voting System
   admin-candidates.js
========================================================== */

const AdminCandidates = {
    init() {
        logDebug("AdminCandidates init");
        
        // Use event delegation for candidate actions within the panel
        const panel = document.querySelector('[data-panel-view="candidates"]');
        if (panel) {
            panel.addEventListener("click", (e) => {
                const target = e.target;
                if (target.closest("#candidate-cancel")) {
                    this.resetForm();
                } else if (target.closest("[data-edit-candidate]")) {
                    this.edit(target.closest("[data-edit-candidate]").dataset.editCandidate);
                } else if (target.closest("[data-delete-candidate]")) {
                    this.confirmDelete(target.closest("[data-delete-candidate]").dataset.deleteCandidate);
                }
            });

            panel.addEventListener("submit", (e) => {
                if (e.target.id === "candidate-form") {
                    e.preventDefault();
                    this.save(e.target);
                }
            });
        }
    },

    async load() {
        logDebug("AdminCandidates load");
        await window.ElectionState.refreshCandidates();
        await window.ElectionState.refreshSettings();
    },

    render() {
        logDebug("AdminCandidates render");
        const container = document.querySelector('[data-panel-view="candidates"]');
        if (!container) return;

        const state = window.ElectionState;
        const isLive = state.settings?.election_status !== ELECTION_STATUS.DRAFT;
        const candidates = state.candidates;
        const positions = state.settings?.election_positions || "male_female";

        // Determine which positions are configured
        const allowMale   = positions !== "female_only";
        const allowFemale = positions !== "male_only";

        const configuredPositions = [];
        if (allowMale)   configuredPositions.push({ key: "male",   label: "Male CR",   position: POSITION.MALE });
        if (allowFemale) configuredPositions.push({ key: "female", label: "Female CR", position: POSITION.FEMALE });

        // Build position dropdown options (filtered to configured positions only)
        const positionOptions = configuredPositions
            .map(p => `<option value="${p.position}">${escapeHTML(p.label)}</option>`)
            .join("");

        const formHTML = !isLive ? `
            <form id="candidate-form" class="admin-form" style="display: grid; grid-template-columns: 1.2fr 1fr 150px auto auto; gap: 14px; align-items: end; margin-bottom: 18px; padding: 16px;">
                <input id="candidate-id" type="hidden">
                <label style="display:grid; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Name
                    <input id="candidate-name" required style="padding:8px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                </label>
                <label style="display:grid; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Roll number (Optional)
                    <input id="candidate-roll" style="padding:8px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                </label>
                <label style="display:grid; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Position
                    <select id="candidate-position" style="padding:8px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                        ${positionOptions}
                    </select>
                </label>
                <button class="btn btn-primary" id="candidate-submit" type="submit">Save</button>
                <button class="btn btn-ghost" id="candidate-cancel" type="button" style="display:none;">Cancel</button>
            </form>
        ` : '';

        // Build per-position grouped sections
        const groupedHTML = configuredPositions.map(({ key, label, position }) => {
            const positionCandidates = candidates.filter(c => c.position === position);
            const count = positionCandidates.length;
            const bannerClass = count > 0 ? "ok" : "warn";
            const bannerText  = count > 0
                ? `✓ ${count} candidate${count !== 1 ? 's' : ''}`
                : "⚠ No candidates added";

            // Responsive layout: wide screens use table, narrow/mobile use cards
            const tableHTML = `
                <div class="table-wrap">
                    <table>
                        <thead><tr>
                            <th>Name</th>
                            <th>Roll Number</th>
                            ${!isLive ? '<th></th>' : ''}
                        </tr></thead>
                        <tbody>
                            ${positionCandidates.length
                                ? positionCandidates.map(c => `
                                    <tr>
                                        <td><strong>${escapeHTML(c.name)}</strong></td>
                                        <td>${escapeHTML(c.roll_number || '—')}</td>
                                        ${!isLive ? `<td style="text-align:right;">
                                            <button class="btn btn-ghost" type="button" data-edit-candidate="${c.id}" style="padding:4px 8px; font-size:0.75rem;">✏ Edit</button>
                                            <button class="btn btn-danger" type="button" data-delete-candidate="${c.id}" style="padding:4px 8px; font-size:0.75rem;">🗑 Delete</button>
                                        </td>` : ''}
                                    </tr>`).join('')
                                : `<tr><td colspan="${isLive ? 2 : 3}" style="text-align:center; color:var(--text-muted); padding:20px;">No candidates for this position.</td></tr>`
                            }
                        </tbody>
                    </table>
                </div>`;

            return `
                <div class="position-group" data-position="${key}">
                    <div class="position-group-header">
                        <span class="position-group-title">${escapeHTML(label)}</span>
                        <span class="position-status-banner ${bannerClass}">${bannerText}</span>
                    </div>
                    ${tableHTML}
                </div>`;
        }).join('');

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px;">
                <div>
                    <h2 style="font-size: 1.2rem; font-weight: 700;">Candidate management</h2>
                    <p style="color:var(--text-2); font-size:0.87rem; margin-top:4px;">${isLive ? "Election is live. Candidates are locked." : "Add, update, or remove candidates."}</p>
                </div>
            </div>
            ${formHTML}
            ${groupedHTML}
        `;
    },


    async refresh() {
        logDebug("AdminCandidates refresh");
        await this.load();
        this.render();
    },

    // --- Actions ---

    resetForm() {
        const form = document.getElementById("candidate-form");
        if(form) {
            form.reset();
            document.getElementById("candidate-id").value = "";
            document.getElementById("candidate-submit").textContent = "Save";
            document.getElementById("candidate-cancel").style.display = "none";
        }
    },

    edit(id) {
        const item = window.ElectionState.candidates.find(c => c.id === id);
        if (!item) return;
        document.getElementById("candidate-id").value = item.id;
        document.getElementById("candidate-name").value = item.name;
        document.getElementById("candidate-roll").value = item.roll_number;
        document.getElementById("candidate-position").value = item.position;
        document.getElementById("candidate-submit").textContent = "Update";
        document.getElementById("candidate-cancel").style.display = "inline-flex";
        
    },

    async save(form) {
        const id = document.getElementById("candidate-id").value;
        const values = {
            name: document.getElementById("candidate-name").value.trim(),
            roll_number: document.getElementById("candidate-roll").value.trim() || null,
            position: document.getElementById("candidate-position").value,
            active: true // Always set active to true as it's required by the backend
        };
        const submitBtn = document.getElementById("candidate-submit");
        
        UI.setButtonLoading(submitBtn, true);
        try {
            await CandidatesAPI.save(values, id || null);
            await AdminUtils.logActivity(id ? "CANDIDATE_UPDATED" : "CANDIDATE_ADDED");
            UI.showToast(id ? "Candidate updated." : "Candidate added.", "success");
            await this.refresh();
        } catch (error) {
            UI.showToast(error.message || "Failed to save candidate", "error");
        } finally {
            UI.setButtonLoading(submitBtn, false);
        }
    },

    async confirmDelete(id) {
        const item = window.ElectionState.candidates.find(c => c.id === id);
        if (!item) return;

        const confirmed = await UI.confirmDialog(
            "Delete Candidate?",
            `You are about to permanently remove ${item.name} (${item.roll_number}). This action cannot be undone.`,
            "Delete Permanently",
            "Cancel",
            true // isDanger
        );

        if (confirmed) {
            try {
                await CandidatesAPI.delete(id);
                await AdminUtils.logActivity("CANDIDATE_DELETED", { candidate_id: id });
                UI.showToast(`Candidate ${item.name} deleted.`, "success");
                await this.refresh();
            } catch (error) {
                UI.showToast(error.message || "Failed to delete candidate", "error");
            }
        }
    }
};

window.AdminCandidates = AdminCandidates;
