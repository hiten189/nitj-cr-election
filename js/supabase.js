/* ==========================================================
   IPE Voting System
   supabase.js
========================================================== */

/* -----------------------------
   Create Client
------------------------------ */

const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


/* -----------------------------
   Authentication
------------------------------ */

async function getSession() {

    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error(error);
        return null;
    }

    return data.session;

}


async function getUser() {

    const { data, error } = await supabase.auth.getUser();

    if (error) {
        console.error(error);
        return null;
    }

    return data.user;

}


async function signOut() {

    await supabase.auth.signOut();

}


/* -----------------------------
   Database
------------------------------ */

async function getSettings() {

    const { data, error } = await supabase
        .from("settings")
        .select("*")
        .single();

    if (error)
        throw error;

    return data;

}


async function getCandidates() {

    const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("is_active", true)
        .order("candidate_name");

    if (error)
        throw error;

    return data;

}


async function hasAlreadyVoted(email) {

    const { data, error } = await supabase
        .from("votes")
        .select("student_email")
        .eq("student_email", email)
        .maybeSingle();

    if (error)
        throw error;

    return !!data;

}


async function submitVote(vote) {

    const { error } = await supabase
        .from("votes")
        .insert(vote);

    if (error)
        throw error;

}


/* -----------------------------
   Admin
------------------------------ */

async function getAllVotes() {

    const { data, error } = await supabase
        .from("votes")
        .select("*");

    if (error)
        throw error;

    return data;

}


async function getAllowedEmailRules() {

    const { data, error } = await supabase
        .from("allowed_email_rules")
        .select("*")
        .order("id");

    if (error)
        throw error;

    return data;

}


/* -----------------------------
   Auth State Listener
------------------------------ */

supabase.auth.onAuthStateChange((event) => {

    console.log("Auth Event:", event);

});