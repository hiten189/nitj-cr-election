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
        const totalCandidatesCount = candidates.length;

        const summaryHTML = `
            <div class="candidate-summary-bar" style="margin-bottom: 20px; padding: 16px; background: var(--bg-surface-2); border-radius: 12px; border: 1px solid var(--border); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 16px;">
                <div style="display:flex; gap:24px; align-items:center;">
                    <div>
                        <span style="font-size:0.8rem; color:var(--text-2); display:block;">Total Candidates</span>
                        <strong style="font-size:1.1rem; color:var(--text);">${totalCandidatesCount} added</strong>
                    </div>
                </div>

            </div>
        `;

        const formHTML = !isLive ? `
            <form id="candidate-form" class="ui-card" style="display: grid; grid-template-columns: 1.2fr 1fr 150px auto auto; gap: 14px; align-items: end; margin-bottom: 18px; padding: 16px;">
                <input id="candidate-id" type="hidden">
                <label style="display:grid; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Name
                    <input id="candidate-name" required style="padding:8px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                </label>
                <label style="display:grid; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Roll number (Optional)
                    <input id="candidate-roll" style="padding:8px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                </label>
                <label style="display:grid; gap:6px; font-size:0.85rem; font-weight:600; color:var(--text-2);">Position
                    <select id="candidate-position" style="padding:8px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text);">
                        <option value="${POSITION.MALE}">Male CR</option>
                        <option value="${POSITION.FEMALE}">Female CR</option>
                    </select>
                </label>
                <button class="btn btn-primary" id="candidate-submit" type="submit">Save</button>
                <button class="btn btn-ghost" id="candidate-cancel" type="button" style="display:none;">Cancel</button>
            </form>
        ` : '';

        const renderRow = (c) => `
            <td><strong>${escapeHTML(c.name)}</strong></td>
            <td>${escapeHTML(c.roll_number)}</td>
            <td>${escapeHTML(c.position)}</td>
            ${!isLive ? `<td style="text-align:right;">
                <button class="btn btn-ghost" type="button" data-edit-candidate="${c.id}" style="padding:4px 8px; font-size:0.75rem;">✏ Edit</button>
                <button class="btn btn-danger" type="button" data-delete-candidate="${c.id}" style="padding:4px 8px; font-size:0.75rem;">🗑 Delete</button>
            </td>` : ''}
        `;

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px;">
                <div>
                    <h2 style="font-size: 1.2rem; font-weight: 700;">Candidate management</h2>
                    <p style="color:var(--text-2); font-size:0.87rem; margin-top:4px;">${isLive ? "Election is live. Candidates are locked." : "Add, update, or remove candidates."}</p>
                </div>
            </div>
            ${summaryHTML}
            ${formHTML}
            ${UI.Table(isLive ? ["Name", "Roll number", "Position"] : ["Name", "Roll number", "Position", ""], candidates, renderRow)}
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
