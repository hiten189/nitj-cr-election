/* ==========================================================
   IPE Voting System
   ui.js - Reusable UI Components
========================================================== */

const UI = {
    // -------------------------
    // Toast Notification
    // -------------------------
    showToast(message, type = "info") {
        let toast = document.getElementById("toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "toast";
            document.body.appendChild(toast);
        }
        toast.className = `${type} show`;
        if (typeof triggerHaptic === "function") {
            triggerHaptic(type === "error" ? "heavy" : type === "success" ? "success" : "light");
        }
        
        let icon = "ℹ️";
        if (type === "success") icon = "✅";
        if (type === "error") icon = "❌";
        if (type === "warning") icon = "⚠️";

        toast.innerHTML = `<span>${icon}</span> <span>${escapeHTML(message)}</span>`;
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => toast.classList.remove("show"), 4000);
    },

    // -------------------------
    // Full Screen Loaders
    // -------------------------
    startLoading() {
        const loader = document.getElementById("loader");
        if (loader) loader.style.display = "flex";
    },
    stopLoading() {
        const loader = document.getElementById("loader");
        if (loader) loader.style.display = "none";
    },

    setButtonLoading(button, loading) {
        if (!button) return;
        if (loading) {
            button.dataset.label = button.textContent;
            button.disabled = true;
            button.innerHTML = '<span class="loader-spinner-small"></span> <span>Wait...</span>';
        } else {
            button.disabled = false;
            button.textContent = button.dataset.label || "Submit";
        }
    },

    // -------------------------
    // Action Sheets (Mobile Modals)
    // -------------------------
    showModal(title, contentHTML, footerHTML = "") {
        const dialog = document.createElement("dialog");
        dialog.className = "ui-modal";
        dialog.innerHTML = `
            <div class="ui-modal-card">
                <header class="ui-modal-header">
                    <h2>${escapeHTML(title)}</h2>
                    <button class="ui-modal-close" aria-label="Close">&times;</button>
                </header>
                <div class="ui-modal-body">${contentHTML}</div>
                ${footerHTML ? `<footer class="ui-modal-footer">${footerHTML}</footer>` : ""}
            </div>
        `;
        document.body.appendChild(dialog);
        dialog.showModal();

        // Close when clicking the backdrop
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.close();
            }
        });

        const closeBtn = dialog.querySelector(".ui-modal-close");
        if (closeBtn) closeBtn.onclick = () => dialog.close();

        dialog.addEventListener("close", () => dialog.remove());
        return dialog;
    },

    confirmDialog(title, message, confirmText = "Confirm", cancelText = "Cancel", isDanger = false) {
        return new Promise((resolve) => {
            const footerHTML = `
                <button class="btn btn-ghost" id="confirm-cancel">${escapeHTML(cancelText)}</button>
                <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'} haptic-press" id="confirm-proceed">${escapeHTML(confirmText)}</button>
            `;
            // Simple haptic trigger attempt (works on some Androids)
            if (navigator.vibrate && isDanger) navigator.vibrate([50, 100, 50]);

            const dialog = UI.showModal(title, `<p>${escapeHTML(message)}</p>`, footerHTML);
            
            dialog.querySelector("#confirm-cancel").onclick = () => {
                dialog.close();
                resolve(false);
            };
            dialog.querySelector("#confirm-proceed").onclick = () => {
                dialog.close();
                resolve(true);
            };
        });
    },

    // -------------------------
    // Basic Components
    // -------------------------
    Badge(text, type = "default") {
        return `<span class="ui-badge ui-badge-${type}">${escapeHTML(text)}</span>`;
    },

    Card(title, bodyHTML, extraClass = "") {
        return `
            <div class="ui-card ${extraClass}">
                ${title ? `<h3 class="ui-card-title">${escapeHTML(title)}</h3>` : ""}
                <div class="ui-card-body">${bodyHTML}</div>
            </div>
        `;
    },

    StatCard(label, value, subtext = "", icon = "") {
        return `
            <div class="ui-stat-card">
                ${icon ? `<div class="ui-stat-icon">${icon}</div>` : ""}
                <div class="ui-stat-content">
                    <span class="ui-stat-label">${escapeHTML(label)}</span>
                    <strong class="ui-stat-value">${escapeHTML(String(value))}</strong>
                    ${subtext ? `<small class="ui-stat-subtext">${escapeHTML(subtext)}</small>` : ""}
                </div>
            </div>
        `;
    },

    EmptyState(message, icon = "📁") {
        return `
            <div class="ui-empty-state">
                <div class="ui-empty-icon">${icon}</div>
                <p class="ui-empty-text">${escapeHTML(message)}</p>
            </div>
        `;
    },

    Skeleton() {
        return `<div class="ui-skeleton"></div>`;
    },

    ProgressBar(percentage) {
        const pct = Math.max(0, Math.min(100, percentage));
        return `
            <div class="ui-progress-container">
                <div class="ui-progress-bar" style="width: ${pct}%"></div>
            </div>
        `;
    },

    // -------------------------
    // Forms
    // -------------------------
    InputGroup(id, label, type, value, placeholder = "") {
        return `
            <div class="ui-input-group">
                <label for="${id}">${escapeHTML(label)}</label>
                <input type="${type}" id="${id}" value="${escapeHTML(String(value || ''))}" placeholder="${escapeHTML(placeholder)}">
            </div>
        `;
    },

    ToggleSwitch(id, label, checked) {
        return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding: 12px 16px; background: rgba(0,0,0,0.2); border-radius: var(--r-md); border: 1px solid var(--border); margin-bottom: 12px; transition: all var(--t-fast);" onactive="this.style.transform='scale(0.98)'">
                <label for="${id}" style="font-weight:600; font-size:0.9rem; color:var(--text); cursor:pointer; flex: 1;">${escapeHTML(label)}</label>
                <label class="ui-switch haptic-press">
                    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
                    <span class="ui-switch-slider"></span>
                </label>
            </div>
        `;
    },

    // -------------------------
    // Table (Converting to Grid where appropriate later, but keep as fallback)
    // -------------------------
    Table(headers, rowsData, renderRowFn) {
        if (!rowsData || rowsData.length === 0) return UI.EmptyState("No data available.");
        
        const thead = headers.map(h => `<th>${escapeHTML(h)}</th>`).join("");
        const tbody = rowsData.map((row, index) => `<tr>${renderRowFn(row, index)}</tr>`).join("");
        
        return `
            <div class="ui-table-container">
                <table class="ui-table">
                    <thead><tr>${thead}</tr></thead>
                    <tbody>${tbody}</tbody>
                </table>
            </div>
        `;
    },

    // -------------------------
    // Layout Interactions (legacy stub — nav is always visible, no hide-on-scroll)
    // -------------------------
    setupDynamicBottomNav(navSelector = ".admin-sidebar") {
        // Intentionally empty: the nav bar is always visible.
        // Hide-on-scroll was removed as it degraded UX on mobile
        // (nav appeared to disappear randomly during voting/admin tasks).
    }
};

window.UI = UI;

// Maintain backwards compatibility
window.showToast = UI.showToast;
window.startLoading = UI.startLoading;
window.stopLoading = UI.stopLoading;
window.setButtonLoading = UI.setButtonLoading;

function renderError(title, message) { 
    document.getElementById("app").innerHTML = `<main class="center-screen"><h1>${escapeHTML(title)}</h1><p>${escapeHTML(message)}</p></main>`; 
}

function renderSuccess(title, message, includeLogout = false) {
    document.getElementById("app").innerHTML = `<main class="center-screen"><h1>${escapeHTML(title)}</h1><p>${escapeHTML(message)}</p>${includeLogout ? '<button class="btn btn-ghost haptic-press" id="logout-btn" type="button" style="margin-top: 16px; width: 100%;">Log out</button>' : ""}</main>`;
    const logoutButton = document.getElementById("logout-btn");
    if (logoutButton) logoutButton.addEventListener("click", AuthAPI.signOut);
}
