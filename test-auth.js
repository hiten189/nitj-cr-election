const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkAuth() {
    const supabaseUrl = "https://tcozghdncexmqambecrz.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjb3pnaGRuY2V4bXFhbWJlY3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNjU0NzAsImV4cCI6MjEwMDc0MTQ3MH0.iKSg_NAqDCemlHShSpByIqi-0qV-vDc7pp2XK6GLo2M";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const email = "hitena.ip.25@nitj.ac.in";
    
    // Check RPC
    const { data, error } = await supabase.rpc("is_allowed_voter", { user_email: email });
    console.log("is_allowed_voter returns:", data);
    if (error) console.error("Error calling RPC:", error);

    // Also try to query eligible_students if readable
    const res = await supabase.from("eligible_students").select("email").limit(5);
    console.log("Eligible students readable?", res.data ? "Yes" : "No", res.data || res.error.message);
    
    const resRules = await supabase.from("allowed_email_rules").select("*").limit(5);
    console.log("Rules readable?", resRules.data ? "Yes" : "No", resRules.data || resRules.error.message);

    const resSettings = await supabase.from("settings").select("*");
    console.log("Settings:", resSettings.data);
}

checkAuth();
