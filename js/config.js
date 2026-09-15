/* ==========================================================
   IPE Voting System
   config.js
========================================================== */

/* -----------------------------
   Supabase
------------------------------ */

const SUPABASE_URL = "https://tcozghdncexmqambecrz.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjb3pnaGRuY2V4bXFhbWJlY3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjU0NzAsImV4cCI6MjEwMDc0MTQ3MH0.iKSg_NAqDCemlHShSpByIqi-0qV-vDc7pp2XK6GLo2M";

/* -----------------------------
   Application
------------------------------ */

const APP_NAME = "IPE Voting System";

const ADMIN_EMAIL = "hitenaggarwal18@gmail.com";

// Shared login validation rule. It accepts student addresses such as
// hitena.ip.25@nitj.ac.in and is loaded before validation.js on both pages.
const NIT_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@nitj\.ac\.in$/i;
window.NIT_EMAIL_REGEX = NIT_EMAIL_REGEX;

/* -----------------------------
   Authentication
------------------------------ */

const MAGIC_LINK_REDIRECT = window.location.origin;

/* -----------------------------
   Election Status
------------------------------ */

const ELECTION_STATUS = {
    DRAFT: "draft",
    LIVE: "live",
    CLOSED: "closed"
};

/* -----------------------------
   Candidate Positions
------------------------------ */

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

/* -----------------------------
   Toast Types
------------------------------ */

const TOAST = {
    SUCCESS: "success",
    ERROR: "error",
    INFO: "info",
    WARNING: "warning"
};

/* -----------------------------
   Messages
------------------------------ */

const MESSAGE = {

    INVALID_EMAIL:
        "Please enter your NIT Jalandhar email.",

    NOT_ALLOWED:
        "You are not authorised to vote.",

    MAGIC_LINK_SENT:
        "Magic Link sent successfully. Check your email.",

    LOGIN_FAILED:
        "Unable to login.",

    SESSION_EXPIRED:
        "Session expired.",

    ALREADY_VOTED:
        "Your vote has already been recorded.",

    VOTE_SUCCESS:
        "Vote submitted successfully.",

    SOMETHING_WENT_WRONG:
        "Something went wrong."

};

Object.freeze(ELECTION_STATUS);
Object.freeze(POSITION);
Object.freeze(VOTING_METHOD);
Object.freeze(ELECTION_POSITIONS);
Object.freeze(TOAST);
Object.freeze(MESSAGE);
