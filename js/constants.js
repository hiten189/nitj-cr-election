/* ==========================================================
   IPE Voting System
   constants.js
========================================================== */

const ELECTION_STATUS = {
    DRAFT: "draft",
    LIVE: "live",
    CLOSED: "closed",
    FINAL_ROUND: "final_round",
    COMPLETED: "completed"
};

const POSITION = {
    MALE: "Male CR",
    FEMALE: "Female CR"
};

const VOTING_METHOD = {
    SINGLE: "single_choice",
    RANKED: "ranked_choice",
    RANKED_FINAL_VS: "ranked_choice_final_vs"
};

const ELECTION_POSITIONS = {
    MALE_FEMALE: "male_female",
    MALE_ONLY: "male_only",
    FEMALE_ONLY: "female_only"
};

const TRACKING_MODE = {
    RULES_ONLY: "rules_only",
    EXPECTED_COUNT: "expected_count",
    IMPORTED_LIST: "imported_list"
};

const TOAST = {
    SUCCESS: "success",
    ERROR: "error",
    INFO: "info",
    WARNING: "warning"
};

const STATUS_COLOR = {
    LIVE: "var(--success)",
    DRAFT: "var(--text-muted)",
    CLOSED: "var(--warning)",
    FINAL_ROUND: "var(--primary)",
    COMPLETED: "var(--primary)"
};

const MESSAGE = {
    INVALID_EMAIL: "Please enter your NIT Jalandhar email.",
    NOT_ALLOWED: "You are not authorised to vote.",
    MAGIC_LINK_SENT: "Magic Link sent successfully. Check your email.",
    LOGIN_FAILED: "Unable to login.",
    SESSION_EXPIRED: "Session expired.",
    ALREADY_VOTED: "Your vote has already been recorded.",
    VOTE_SUCCESS: "Vote submitted successfully.",
    SOMETHING_WENT_WRONG: "Something went wrong."
};

const APP_NAME = "NITJ Voting System";

// Admin email for local development only - loaded from config.js (window.APP_CONFIG)
// In production, admin status is determined solely by the admins table in the database
const ADMIN_EMAIL = (window.APP_CONFIG && window.APP_CONFIG.ADMIN_EMAIL) || "";

// Shared login validation rule
const NIT_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@nitj\.ac\.in$/i;
window.NIT_EMAIL_REGEX = NIT_EMAIL_REGEX;

const MAGIC_LINK_REDIRECT = window.location.origin;

Object.freeze(ELECTION_STATUS);
Object.freeze(POSITION);
Object.freeze(VOTING_METHOD);
Object.freeze(ELECTION_POSITIONS);
Object.freeze(TRACKING_MODE);
Object.freeze(TOAST);
Object.freeze(STATUS_COLOR);
Object.freeze(MESSAGE);
