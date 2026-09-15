/* ==========================================================
   IPE Voting System
   admin-activity.js
========================================================== */

const AdminActivity = {
    init() {
        logDebug("AdminActivity init");
        const panel = document.querySelector('[data-panel-view="activity"]');
        if (panel) {
            panel.addEventListener("click", (e) => {
                if (e.target.closest("#refresh-activity")) {
                    this.refresh();
                }
            });
        }
    },

    async load() {
        logDebug("AdminActivity load");
        await window.ElectionState.refreshActivity();
    },

    render() {
        logDebug("AdminActivity render");
        const container = document.querySelector('[data-panel-view="activity"]');
        if (!container) return;

        const activity = window.ElectionState.activity;
        let activityListHTML = "";

        if (!activity || !activity.length) {
            activityListHTML = UI.EmptyState("No activity has been recorded.");
        } else {
            const items = activity.map((item) => `
                <li style="display:flex; gap:12px; margin-bottom:14px; align-items:flex-start;">
                    <span style="width:8px; height:8px; border-radius:50%; background:var(--primary); margin-top:6px; flex: 0 0 auto;"></span>
                    <div>
                        <strong style="display:block; margin-bottom:2px;">${escapeHTML(item.event_type.replace(/_/g, ' '))}</strong>
                        <p style="margin:0; font-size:0.8rem; color:var(--text-2);">${escapeHTML(item.actor)}</p>
                        <small style="font-size:0.76rem; color:var(--text-muted);">${formatDate(item.created_at)}</small>
                    </div>
                </li>
            `).join("");
            activityListHTML = `<ul style="list-style:none; padding:0; margin:0;">${items}</ul>`;
        }

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px;">
                <div>
                    <h2 style="font-size: 1.2rem; font-weight: 700;">Activity log</h2>
                </div>
                <button id="refresh-activity" class="btn btn-ghost" type="button" style="padding: 4px 8px; font-size: 0.8rem;">Refresh</button>
            </div>
            <div class="ui-card">
                ${activityListHTML}
            </div>
        `;
    },

    async refresh() {
        logDebug("AdminActivity refresh");
        const btn = document.getElementById("refresh-activity");
        UI.setButtonLoading(btn, true);
        try {
            await this.load();
            this.render();
        } finally {
            UI.setButtonLoading(btn, false);
        }
    }
};

window.AdminActivity = AdminActivity;
