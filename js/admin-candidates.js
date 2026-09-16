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
            <form id="candidate-form" class="admin-form" style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 18px; padding: 16px; border: 1px solid var(--border); border-radius: var(--r-md); background: var(--glass-bg);">
                <input id="candidate-id" type="hidden">
                <label style="display:grid; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Name
                    <input id="candidate-name" required placeholder="Candidate Name" style="padding:10px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                </label>
                <label style="display:grid; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Roll number (Optional)
                    <input id="candidate-roll" placeholder="Roll Number" style="padding:10px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                </label>
                <label style="display:grid; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Position
                    <select id="candidate-position" style="padding:10px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                        ${positionOptions}
                    </select>
                </label>
                <div style="display: flex; gap: 10px; margin-top: 4px;">
                    <button class="primary-button" id="candidate-submit" type="submit" style="flex: 1;">Confirm</button>
                    <button class="btn btn-ghost" id="candidate-cancel" type="button" style="display:none; flex: 1; padding: 12px; border: 1px solid var(--border); border-radius: var(--r-md);">Cancel</button>
                </div>
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

            // Responsive layout: use cards for all screens (small boxes, mobile friendly)
            const tableHTML = `
                <div class="candidates-list" style="display: flex; flex-direction: column; gap: 8px;">
                    ${positionCandidates.length
                        ? positionCandidates.map(c => `
                            <div class="candidate-card-mobile">
                                <div class="candidate-card-mobile-info">
                                    <strong>${escapeHTML(c.name)}</strong>
                                    ${c.roll_number ? `<small>Roll No. ${escapeHTML(c.roll_number)}</small>` : '<small>—</small>'}
                                </div>
                                ${!isLive ? `
                                <div class="candidate-card-mobile-actions">
                                    <button class="btn btn-ghost" type="button" data-edit-candidate="${c.id}" style="padding:6px 10px; font-size:0.8rem; border-radius:var(--r-sm); border:1px solid var(--border);">✏ Edit</button>
                                    <button class="btn btn-danger" type="button" data-delete-candidate="${c.id}" style="padding:6px 10px; font-size:0.8rem; border-radius:var(--r-sm);">🗑 Remove</button>
                                </div>` : ''}
                            </div>
                        `).join('')
                        : `<div style="text-align:center; color:var(--text-muted); padding:20px; border: 1px dashed var(--border); border-radius: var(--r-md);">No candidates for this position.</div>`
                    }
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
