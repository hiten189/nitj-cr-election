/* ==========================================================
   IPE Voting System
   admin-system.js
========================================================== */

const AdminSystem = {
    admins: [],

    init() {
        logDebug("AdminSystem init");
        const panel = document.querySelector('[data-panel-view="administration"]');
        if (panel) {
            panel.addEventListener("submit", (e) => {
                if (e.target.id === "add-admin-form") {
                    e.preventDefault();
                    this.addAdmin(e.target);
                }
            });
            panel.addEventListener("click", (e) => {
                const removeBtn = e.target.closest('.remove-admin-btn');
                if (removeBtn) {
                    this.removeAdmin(removeBtn.dataset.email);
                }
            });
        }
    },

    async load() {
        logDebug("AdminSystem load");
        await window.ElectionState.refreshActivity();
        try {
            this.admins = await AdminAPI.getAll();
        } catch(e) {
            console.error("Failed to load admins", e);
            this.admins = [];
        }

        try {
            const { data } = await supabaseClient.from('visitor_analytics').select('device_type, operating_system');
            this.telemetry = data || [];
        } catch (e) {
            console.error("Failed to load telemetry", e);
            this.telemetry = [];
        }
    },

    renderTelemetryHTML() {
        if (!this.telemetry || !this.telemetry.length) {
            return `<div style="font-size:0.85rem; color:var(--text-muted); padding:16px; text-align:center; border:1px dashed var(--border); border-radius:var(--r-sm); background:var(--bg-surface);">No telemetry data available</div>`;
        }
        
        const total = this.telemetry.length;
        const osCounts = {};
        const deviceCounts = {};
        
        this.telemetry.forEach(t => {
            const os = t.operating_system || 'Unknown';
            const dev = t.device_type || 'Unknown';
            osCounts[os] = (osCounts[os] || 0) + 1;
            deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;
        });

        const getTop = (obj) => {
            return Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0,3).map(([k,v]) => `<p style="margin-bottom:10px; display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:6px;"><strong>${k}</strong> <span>${Math.round((v/total)*100)}%</span></p>`).join('');
        };

        return `
            <div style="margin-top:16px; font-size: 0.9rem; color:var(--text-2);">
                <div style="margin-bottom:16px;">
                    <strong style="display:block; margin-bottom:8px; color:var(--text); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;">Top OS</strong>
                    ${getTop(osCounts)}
                </div>
                <div>
                    <strong style="display:block; margin-bottom:8px; color:var(--text); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;">Top Devices</strong>
                    ${getTop(deviceCounts)}
                </div>
                <div style="margin-top:12px; font-size:0.8rem; color:var(--text-muted); text-align:right;">Total Sessions: ${total}</div>
            </div>
        `;
    },

    render() {
        logDebug("AdminSystem render");
        const container = document.querySelector('[data-panel-view="administration"]');
        if (!container) return;

        const activity = window.ElectionState.activity;
        let activityListHTML = "";

        if (!activity || !activity.length) {
            activityListHTML = UI.EmptyState("No activity has been recorded.", "📭");
        } else {
            const items = activity.slice(0, 25).map((item) => `
                <li style="position:relative; padding-left:32px; padding-bottom:28px;">
                    <div style="position:absolute; left:0; top:6px; width:12px; height:12px; border-radius:50%; background:var(--primary); z-index:2; border: 2px solid var(--bg-card); box-shadow: 0 0 0 2px var(--primary-dim);"></div>
                    <div style="position:absolute; left:5px; top:16px; bottom:0; width:2px; background:var(--border); z-index:1;"></div>
                    <div>
                        <strong style="display:block; margin-bottom:4px; font-size:1rem; font-weight:700;">${escapeHTML(item.event_type.replace(/_/g, ' '))}</strong>
                        <p style="margin:0; font-size:0.9rem; color:var(--text-2);">${escapeHTML(item.actor)}</p>
                        <small style="font-size:0.8rem; color:var(--text-muted); display:block; margin-top:4px;">${formatDate(item.created_at)}</small>
                    </div>
                </li>
            `).join("");
            activityListHTML = `<ul style="list-style:none; padding:0; margin:0; margin-left:16px; margin-top:16px; overflow:hidden;">${items}</ul>`;
        }

        const permanentAdmins = ["hiten.aggarwal", "nitj.cr.election"]; // Hardcoded lock per user request
        
        let adminsListHTML = this.admins.map(admin => {
            const isPermanent = permanentAdmins.some(p => admin.email.toLowerCase().includes(p));
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px; border-bottom:1px solid var(--border-light);">
                    <div style="font-size: 0.9rem; color: var(--text);">${escapeHTML(admin.email)}</div>
                    ${isPermanent ? 
                        '<span class="ui-badge ui-badge-primary" style="font-size:0.75rem;">Permanent</span>' : 
                        `<button class="btn btn-ghost remove-admin-btn" data-email="${escapeHTML(admin.email)}" style="color:var(--danger); padding:4px 8px; font-size:0.8rem;">Remove</button>`
                    }
                </div>
            `;
        }).join("");

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px;">
                <div>
                    <h2 style="font-size:1.6rem; font-weight:800; font-family:var(--font-display);">System Administration</h2>
                    <p style="color:var(--text-2); font-size:0.95rem; margin-top:6px;">Manage global election settings and view system logs.</p>
                </div>
            </div>
            
            <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:20px; color:var(--text-2); text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid var(--border-light); padding-bottom:10px;">General Administration</h3>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-bottom: 40px;">
                <!-- Admin Management -->
                <div class="ui-card" style="grid-column: 1 / -1;">
                    <h3 class="ui-card-title" style="display:flex; align-items:center; gap:8px;"><span style="font-size:1.2rem;">👑</span> Manage Admins</h3>
                    <p style="color:var(--text-2); font-size:0.85rem; margin-bottom:20px;">Add or remove administrators. System owners cannot be removed.</p>
                    
                    <div style="background:var(--bg-surface-2); border-radius:var(--r-sm); border:1px solid var(--border); margin-bottom:20px;">
                        ${adminsListHTML}
                    </div>

                    <form id="add-admin-form" style="display:flex; gap:9px; align-items:center; flex-wrap:wrap;">
                        <input id="new-admin-email" type="email" placeholder="new.admin@nitj.ac.in" required style="flex: 1 1 200px; min-width:0; padding:12px; border-radius:var(--r-sm); border:1px solid var(--border); background:var(--bg-surface); color:var(--text); transition:border-color var(--t-base);">
                        <button class="btn btn-primary" type="submit" style="padding:12px 18px; white-space:nowrap;">Add Admin</button>
                    </form>
                </div>
                
                <!-- Email Logs -->
                <div class="ui-card">
                    <h3 class="ui-card-title" style="display:flex; align-items:center; gap:8px;"><span style="font-size:1.2rem;">✉️</span> Email Logs</h3>
                    <p style="color:var(--text-2); font-size:0.85rem; margin-bottom:16px;">Monitor outbound system emails.</p>
                    <div style="font-size:0.85rem; color:var(--text-muted); padding:16px; text-align:center; border:1px dashed var(--border); border-radius:var(--r-sm); background:var(--bg-surface);">No email logs available</div>
                </div>

                <!-- System Information -->
                <div class="ui-card">
                    <h3 class="ui-card-title" style="display:flex; align-items:center; gap:8px;"><span style="font-size:1.2rem;">💻</span> System Health</h3>
                    <div style="margin-top:16px; font-size: 0.9rem; color:var(--text-2);">
                        <p style="margin-bottom:14px; display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:8px;"><strong>App Version</strong> <span>v2.1.0</span></p>
                        <p style="margin-bottom:14px; display:flex; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:8px;"><strong>Environment</strong> <span>Production</span></p>
                        <p style="display:flex; justify-content:space-between;"><strong>Database</strong> <span style="color:var(--success); font-weight:600;">Connected</span></p>
                    </div>
                </div>

                <!-- Visitor Analytics -->
                <div class="ui-card">
                    <h3 class="ui-card-title" style="display:flex; align-items:center; gap:8px;"><span style="font-size:1.2rem;">📈</span> Visitor Analytics</h3>
                    <p style="color:var(--text-2); font-size:0.85rem; margin-bottom:16px;">Passive device and browser telemetry.</p>
                    ${this.renderTelemetryHTML()}
                </div>
                
                <!-- Reset Election -->
                <div class="ui-card" style="border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.02);">
                    <h3 class="ui-card-title" style="display:flex; align-items:center; gap:8px; color: var(--danger);"><span style="font-size:1.2rem;">⚠️</span> Reset Election</h3>
                    <p style="color:var(--text-2); font-size:0.85rem; margin-bottom:20px;">Permanently deletes all votes, logs, and resets state to draft.</p>
                    <button type="button" class="btn btn-danger" data-modal="reset-election" style="width:100%; padding:12px;">Reset Permanently</button>
                </div>
            </div>

            <h3 style="font-size:1.15rem; font-weight:700; margin-bottom:20px; color:var(--text-2); text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid var(--border-light); padding-bottom:10px;">Activity Timeline</h3>
            <div class="ui-card" style="margin-bottom: 24px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <p style="margin:0; font-size:0.9rem; color:var(--text-2);">Chronological record of system events and administrative actions.</p>
                    <button id="refresh-activity" class="btn btn-ghost" type="button" style="padding: 8px 16px; font-size: 0.85rem;" onclick="AdminSystem.refresh()">Refresh Logs</button>
                </div>
                <div style="background:var(--bg-surface); padding:24px; border-radius:var(--r-md); border:1px solid var(--border);">
                    ${activityListHTML}
                </div>
            </div>
        `;
    },

    async refresh() {
        logDebug("AdminSystem refresh");
        await this.load();
        this.render();
    },

    async addAdmin(form) {
        const newEmail = document.getElementById("new-admin-email").value.trim().toLowerCase();
        if (!newEmail) return;
        
        if (this.admins.some(a => a.email.toLowerCase() === newEmail)) {
            UI.showToast("Admin already exists.", "warning");
            return;
        }

        try {
            await AdminAPI.add(newEmail);
            UI.showToast("Admin added successfully.", "success");
            await this.refresh();
        } catch(e) {
            console.error("Failed to add admin", e);
            UI.showToast("Failed to add admin.", "error");
        }
    },

    async removeAdmin(email) {
        if (!confirm(`Are you sure you want to remove ${email} as an admin?`)) return;
        try {
            await AdminAPI.remove(email);
            UI.showToast("Admin removed successfully.", "success");
            await this.refresh();
        } catch(e) {
            console.error("Failed to remove admin", e);
            UI.showToast("Failed to remove admin.", "error");
        }
    }
};

window.AdminSystem = AdminSystem;
