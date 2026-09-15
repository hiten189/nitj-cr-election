// `window.supabase` belongs to the Supabase CDN. Keep the application client
// under a distinct name so it is created once and never shadows that global.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return data.session;
}

// Explicitly expose the shared session helper for every classic script on both pages.
window.getSession = getSession;

async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
}

async function getActiveEmailRules() {
    const { data, error } = await supabaseClient
        .from("allowed_email_rules")
        .select("rule_type, rule_value")
        .eq("active", true);
    if (error) throw error;
    return data || [];
}

async function hasAlreadyVoted(email) {
    const { data, error } = await supabaseClient
        .from("votes")
        .select("student_email")
        .eq("student_email", email)
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return Boolean(data);
}

async function getElectionSettings() {
    const { data, error } = await supabaseClient
        .from("settings")
        .select("election_name, election_status, allow_write_in_vote, write_in_roll_digits, results_published, voting_method, election_positions")
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function getActiveCandidates() {
    const { data, error } = await supabaseClient
        .from("candidates")
        .select("id, name, roll_number, position")
        .eq("active", true)
        .order("name");
    if (error) throw error;
    return data || [];
}

async function saveVote(vote) {
    const { error } = await supabaseClient.from("votes").insert(vote);
    if (error) throw error;
}
