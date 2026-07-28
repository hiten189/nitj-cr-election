/* ==========================================================
   IPE Voting System
   config.js
========================================================== */

/* -----------------------------
   Supabase Configuration
------------------------------ */

const SUPABASE_URL = "yJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjb3pnaGRuY2V4bXFhbWJlY3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjU0NzAsImV4cCI6MjEwMDc0MTQ3MH0.iKSg_NAqDCemlHShSpByIqi-0qV-vDc7pp2XK6GLo2M";

const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";


/* -----------------------------
   Application
------------------------------ */

const APP_NAME = "IPE Voting System";

const APP_VERSION = "1.0.0";


/* -----------------------------
   Authentication
------------------------------ */

const ADMIN_EMAIL = "hitenaggarwal18@gmail.com";

const SESSION_TIMEOUT_MINUTES = 15;


/* -----------------------------
   Election
------------------------------ */

const MAX_SELECTIONS = 1;

const RESULTS_PAGE = "results";

const STUDENT_PAGE = "student";

const ADMIN_PAGE = "admin";


/* -----------------------------
   Validation
------------------------------ */

const NIT_EMAIL_REGEX =
    /^[a-zA-Z0-9._%+-]+\.ip\.25@nitj\.ac\.in$/i;


/* -----------------------------
   Messages
------------------------------ */

const MESSAGE = {

    INVALID_EMAIL:
        "Please enter a valid NIT Jalandhar email address.",

    NOT_ALLOWED:
        "You are not authorized to vote.",

    MAGIC_LINK_SENT:
        "Magic link sent. Please check your email.",

    LOGIN_SUCCESS:
        "Login successful.",

    LOGIN_FAILED:
        "Unable to login.",

    SESSION_EXPIRED:
        "Your session has expired.",

    ALREADY_VOTED:
        "Your vote has already been recorded.",

    VOTE_SUCCESS:
        "Your vote has been successfully submitted.",

    UNKNOWN_ERROR:
        "Something went wrong. Please try again."

};


/* -----------------------------
   Freeze Config
------------------------------ */

Object.freeze(MESSAGE);