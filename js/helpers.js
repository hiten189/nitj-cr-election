/* ==========================================================
   IPE Voting System
   helpers.js
========================================================== */


/* -----------------------------
   DOM Helpers
------------------------------ */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => document.querySelectorAll(selector);


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

function isAdmin(email) {

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

    div.innerText = text;

    return div.innerHTML;

}