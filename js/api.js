/* ==========================================================
   IPE Voting System
   api.js - Centralized API Layer
========================================================== */

const AuthAPI = {
    async getSession() {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        return data.session;
    },
    async signOut() {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
    }
};

const PublicElectionAPI = {
    async getAvailability() {
        console.log("Checking public election availability...");
        const { data, error } = await supabaseClient.rpc("get_public_election_availability");
        console.log("Election availability response:", { data, error });
        if (error) {
            console.error("Election availability check failed:", error);
            throw error;
        }
        return {
            settingsConfigured: data?.settings_configured === true,
            authorizationConfigured: data?.authorization_configured === true,
            studentLoginsOpen: data?.student_logins_open === true
        };
    }
};

const AdminAPI = {
    async getCurrent(email) {
        const { data, error } = await supabaseClient
            .from("admins")
            .select("*")
            .eq("email", email)
            .eq("active", true)
            .maybeSingle();
        if (error) throw error;
        return data;
    },
    async getAll() {
        const { data, error } = await supabaseClient
            .from("admins")
            .select("*")
            .order("email");
        if (error) throw error;
        return data || [];
    },
    async add(email) {
        const { error } = await supabaseClient.from("admins").insert({
            email: email,
            active: true,
            role: "admin"
        });
        if (error) throw error;
    },
    async remove(email) {
        const { error } = await supabaseClient.from("admins").delete().eq("email", email);
        if (error) throw error;
    }
};

const SettingsAPI = {
    async get() {
        console.log("Loading settings...");
        const { data, error } = await supabaseClient
            .from("settings")
            .select("*")
            .limit(1)
            .maybeSingle();
        console.log("Settings response:", { data, error });
        if (error) {
            console.error("Settings load failed:", error);
            throw error;
        }
        if (!data) {
            const missingSettingsError = new Error(
                "No election settings row is visible. Verify that one settings row exists and that the authenticated read policy permits access."
            );
            missingSettingsError.code = "SETTINGS_NOT_VISIBLE";
            console.error("Settings load failed:", missingSettingsError);
            throw missingSettingsError;
        }
        return data;
    },
    async update(id, changes) {
        const { error } = await supabaseClient
            .from("settings")
            .update(changes)
            .eq("id", id);
        if (error) throw error;
    }
};

const CandidatesAPI = {
    async getAll() {
        const { data, error } = await supabaseClient
            .from("candidates")
            .select("*")
            .order("name");
        if (error) throw error;
        return data || [];
    },
    async getActive() {
        const { data, error } = await supabaseClient
            .from("candidates")
            .select("id, name, roll_number, position")
            .eq("active", true)
            .order("name");
        if (error) throw error;
        return data || [];
    },
    async save(values, id = null) {
        let response;
        if (id) {
            response = await supabaseClient.from("candidates").update(values).eq("id", id);
        } else {
            response = await supabaseClient.from("candidates").insert(values);
        }
        if (response.error) throw response.error;
    },
    async delete(id) {
        const { error } = await supabaseClient.from("candidates").delete().eq("id", id);
        if (error) throw error;
    }
};

const RulesAPI = {
    async getAll() {
        const { data, error } = await supabaseClient
            .from("allowed_email_rules")
            .select("*")
            .order("rule_value");
        if (error) throw error;
        return data || [];
    },
    async getActive() {
        const { data, error } = await supabaseClient
            .from("allowed_email_rules")
            .select("rule_type, rule_value")
            .eq("active", true);
        if (error) throw error;
        return data || [];
    },
    async save(values, id = null) {
        let response;
        if (id) {
            response = await supabaseClient.from("allowed_email_rules").update(values).eq("id", id);
        } else {
            response = await supabaseClient.from("allowed_email_rules").insert(values);
        }
        if (response.error) throw response.error;
    },
    async delete(id) {
        const { error } = await supabaseClient.from("allowed_email_rules").delete().eq("id", id);
        if (error) throw error;
    },
    async insertExactList(emails) {
        const { data: existing, error: readError } = await supabaseClient
            .from("allowed_email_rules")
            .select("rule_value")
            .eq("rule_type", "exact");
        if (readError) throw readError;
        const known = new Set((existing || []).map((rule) => normalizeEmail(rule.rule_value)));
        const rows = emails
            .filter((email) => !known.has(email))
            .map((email) => ({ rule_type: "exact", rule_value: email, active: true }));
        if (!rows.length) return 0;
        const { error } = await supabaseClient.from("allowed_email_rules").insert(rows);
        if (error) throw error;
        return rows.length;
    },
    async replaceAuthorizationRules(rows) {
        const { error: deleteError } = await supabaseClient
            .from("allowed_email_rules")
            .delete()
            .not("id", "is", null);
        if (deleteError) throw deleteError;
        if (!rows.length) return;
        const { error: insertError } = await supabaseClient.from("allowed_email_rules").insert(rows);
        if (insertError) throw insertError;
    }
};

const VotesAPI = {
    async hasVoted(email) {
        const { data, error } = await supabaseClient
            .from("votes")
            .select("student_email")
            .eq("student_email", email)
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return Boolean(data);
    },
    async save(vote) {
        const { error } = await supabaseClient.from("votes").insert(vote);
        if (error) throw error;
    },
    async getAll() {
        const { data, error } = await supabaseClient
            .from("votes")
            .select("male_candidate_id, female_candidate_id, male_write_in_roll, female_write_in_roll, ranking_data, round_number");
        if (error) throw error;
        return data || [];
    },
    async getRPCResults() {
        const [resRes, writeRes, countRes] = await Promise.all([
            supabaseClient.rpc("get_election_results"),
            supabaseClient.rpc("get_write_in_results"),
            supabaseClient.rpc("get_election_ballot_count")
        ]);
        return {
            results: resRes.data || [],
            writeIns: writeRes.data || [],
            count: Number(countRes.data) || 0,
            error: resRes.error || writeRes.error || countRes.error
        };
    }
};

const ActivityAPI = {
    async getAll() {
        const { data, error } = await supabaseClient
            .from("vote_activity_log")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100);
        if (error) throw error;
        return data || [];
    },
    async log(adminEmail, actionType) {
        const { error } = await supabaseClient.from("vote_activity_log").insert({
            actor: adminEmail,
            event_type: actionType
        });
        if (error) throw error;
    }
};

const VoterTrackingAPI = {
    async getAll() {
        const { data, error } = await supabaseClient
            .from("voter_tracking")
            .select("*");
        if (error) throw error;
        return data || [];
    }
};

const EligibleStudentsAPI = {
    async getAll() {
        const { data, error } = await supabaseClient
            .from("eligible_students")
            .select("*")
            .order("email");
        if (error) {
            if (typeof isSchemaCompatibilityError === "function" && isSchemaCompatibilityError(error)) {
                return typeof getStoredEligibleStudents === "function" ? getStoredEligibleStudents() : [];
            }
            throw error;
        }
        return data || [];
    },
    async importEmails(emails) {
        const rows = emails.map((email) => ({ email, status: "pending" }));
        const { error } = await supabaseClient
            .from("eligible_students")
            .upsert(rows, { onConflict: "email", ignoreDuplicates: true });
        if (error) {
            if (typeof isSchemaCompatibilityError === "function" && isSchemaCompatibilityError(error)) {
                const existing = typeof getStoredEligibleStudents === "function" ? getStoredEligibleStudents() : [];
                const known = new Set(existing.map((student) => normalizeEmail(student.email)));
                const additions = emails.filter((email) => !known.has(email)).map((email) => ({ email, status: "pending", created_at: new Date().toISOString() }));
                if (typeof saveStoredEligibleStudents === "function") saveStoredEligibleStudents([...existing, ...additions]);
                return;
            }
            throw error;
        }
    },
    async replaceAll(emails) {
        const { error: deleteError } = await supabaseClient
            .from("eligible_students")
            .delete()
            .not("id", "is", null);
        if (deleteError) throw deleteError;
        if (!emails.length) return;
        const { error: insertError } = await supabaseClient
            .from("eligible_students")
            .insert(emails.map((email) => ({ email, status: "pending" })));
        if (insertError) throw insertError;
    }
};

window.AuthAPI = AuthAPI;
window.PublicElectionAPI = PublicElectionAPI;
window.AdminAPI = AdminAPI;
window.SettingsAPI = SettingsAPI;
window.CandidatesAPI = CandidatesAPI;
window.RulesAPI = RulesAPI;
window.VotesAPI = VotesAPI;
window.ActivityAPI = ActivityAPI;
window.VoterTrackingAPI = VoterTrackingAPI;
window.EligibleStudentsAPI = EligibleStudentsAPI;

const EmailAPI = {
    async queueEmails(emails, type) {
        if (!emails || emails.length === 0) return;
        const uniqueEmails = [...new Set(emails.map(e => String(e || '').trim().toLowerCase()).filter(Boolean))];
        
        try {
            const { data: existing } = await supabaseClient
                .from('email_notifications')
                .select('recipient_email')
                .eq('notification_type', type)
                .in('status', ['sent', 'pending', 'processing']);
            
            const alreadyQueued = new Set((existing || []).map(r => String(r.recipient_email || '').toLowerCase()));
            const toQueue = uniqueEmails.filter(e => !alreadyQueued.has(e));
            
            if (toQueue.length === 0) {
                console.log(`All recipients already queued or sent for ${type}.`);
                return;
            }

            const records = toQueue.map(email => ({
                recipient_email: email,
                notification_type: type,
                status: 'pending'
            }));
            const { error } = await supabaseClient.from('email_notifications').insert(records);
            if (error) throw error;
        } catch (err) {
            console.error("Error queueing emails:", err);
            throw err;
        }
    },
    async triggerSend() {
        try {
            const { data, error } = await supabaseClient.functions.invoke('send-emails');
            if (error) console.error("Error triggering send-emails edge function:", error);
            return data;
        } catch (e) {
            console.error("Failed to invoke send-emails:", e);
        }
    }
};

window.EmailAPI = EmailAPI;
