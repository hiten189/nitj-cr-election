/* ==========================================================
   IPE Voting System
   helpers.js
========================================================== */


/* -----------------------------
   DOM Helpers
------------------------------ */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);

function render(html, containerId = "app") {
    const container = document.getElementById(containerId);
    if (!container) {
        throw new Error(`Render target #${containerId} was not found.`);
    }
    container.innerHTML = html;
}


/* -----------------------------
   Delay
------------------------------ */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/* -----------------------------
   Loader
------------------------------ */

function showLoader() {

    const loader = $("#loader");

    if (loader)
        loader.style.display = "flex";

}


function hideLoader() {

    const loader = $("#loader");

    if (loader)
        loader.style.display = "none";

}


/* -----------------------------
   App
------------------------------ */

function showApp() {

    const app = $("#app");

    if (app)
        app.hidden = false;

}


/* -----------------------------
   Email
------------------------------ */

function normalizeEmail(email) {

    return email.trim().toLowerCase();

}


/* -----------------------------
   Admin
------------------------------ */

// Admin check - uses configurable ADMIN_EMAIL (empty by default, can be set via config.local.js)
// In production, admin status should be verified via the database (isDatabaseAdmin in auth.js)
function isAdmin(email) {
    if (!ADMIN_EMAIL) return false;
    return normalizeEmail(email) === normalizeEmail(ADMIN_EMAIL);
}


/* -----------------------------
   Date & Time
------------------------------ */

function formatDate(date) {

    return new Date(date).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    });

}


/* -----------------------------
   Percentage
------------------------------ */

function percentage(value, total) {

    if (total === 0)
        return "0%";

    return ((value / total) * 100).toFixed(1) + "%";

}


/* -----------------------------
   Random ID
------------------------------ */

function randomId(length = 8) {

    return Math.random()
        .toString(36)
        .substring(2, 2 + length);

}


/* -----------------------------
   Escape HTML
------------------------------ */

function escapeHTML(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}

function triggerHaptic(kind = "light") {
    try {
        if (!navigator.vibrate) return;
        switch (kind) {
            case "success":
                navigator.vibrate([10, 35, 14, 35, 14]); // Success pattern
                break;
            case "heavy":
                navigator.vibrate([18, 10, 18]); // Heavy impact
                break;
            case "error":
                navigator.vibrate([15, 30, 15, 30, 15]); // Error pattern
                break;
            case "warning":
                navigator.vibrate([8, 20, 8]); // Warning pattern
                break;
            case "selection":
                navigator.vibrate([5, 15, 5]); // Selection pattern
                break;
            case "confirm":
                navigator.vibrate([12, 25, 12, 25, 12]); // Confirm pattern
                break;
            default:
                navigator.vibrate(8); // Light tap
        }
    } catch (_) {}
}

// Enhanced haptic feedback with visual feedback
function triggerFeedback(kind = "light", element = null, event = null) {
    triggerHaptic(kind);
    
    // Add visual ripple effect if element and event provided
    if (element && event) {
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
            width: 100px;
            height: 100px;
        `;
        
        const rect = element.getBoundingClientRect();
        ripple.style.left = `${event.clientX - rect.left - 50}px`;
        ripple.style.top = `${event.clientY - rect.top - 50}px`;
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    }
}

document.addEventListener("pointerdown", (event) => {
    const target = event.target.closest(".haptic-press, .nav-item, .candidate-card, .btn, .submit-vote, .logout-button, .option-card, .method-card");
    if (target) {
        triggerHaptic("light");
        triggerFeedback("light", target, event);
    }
}, { passive: true });
