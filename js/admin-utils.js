/* ==========================================================
   IPE Voting System
   admin-utils.js - Shared Admin Utilities
========================================================== */

const AdminUtils = {
    isSuperAdmin() {
        return true; // All admins have full capabilities now
    },

    statusTitle(status) {
        return String(status || "draft")
            .replace(/^./, (letter) => letter.toUpperCase())
            .replace(/_/g, " ");
    },

    getCountdown(endDate) {
        if (!endDate) return "No deadline set";
        const diff = new Date(endDate) - new Date();
        if (diff <= 0) return "Voting has ended";
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `Voting closes in: ${h} hours ${m} minutes`;
    },

    async logActivity(event_type, details = {}) {
        try {
            const adminEmail = window.ElectionState?.currentAdmin?.email || "unknown";
            await ActivityAPI.log(adminEmail, event_type);
            logDebug(`Activity logged: ${event_type}`);
        } catch (e) {
            console.error("Failed to log activity", e);
        }
    },

    switchPanel(panel) {
        if (!panel) return;
        logDebug(`Switching to panel: ${panel}`);
        localStorage.setItem("admin_active_section", panel);
        document.querySelectorAll("[data-panel-view]").forEach((item) => {
            item.classList.toggle("active", item.dataset.panelView === panel);
        });
        document.querySelectorAll("[data-panel]").forEach((item) => {
            item.classList.toggle("active", item.dataset.panel === panel);
        });
        AdminUtils.updateNavPill();
        if (typeof triggerHaptic === "function") triggerHaptic("light");
    },

    updateNavPill() {
        const track = document.querySelector(".nav-glass-track");
        const pill = document.getElementById("nav-liquid-pill");
        const active = document.querySelector(".nav-item.active");
        if (!track || !pill || !active) return;
        const trackBox = track.getBoundingClientRect();
        const itemBox = active.getBoundingClientRect();
        pill.style.width = `${itemBox.width}px`;
        pill.style.height = `${itemBox.height}px`;
        pill.style.transform = `translate(${itemBox.left - trackBox.left}px, ${itemBox.top - trackBox.top}px)`;
    }
};

window.AdminUtils = AdminUtils;
