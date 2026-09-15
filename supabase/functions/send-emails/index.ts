// Supabase Edge Function for sending automated emails via Resend API
// Deploy with: supabase functions deploy send-emails --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const resendEndpoint = "https://api.resend.com/emails";

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req) => {
    try {
        // We can trigger this via cron or via webhook on `vote_activity_log` insert.
        // For this example, we fetch pending emails from `email_notifications`.
        
        const { data: pendingEmails, error: fetchError } = await supabase
            .from('email_notifications')
            .select('*')
            .eq('status', 'pending')
            .limit(50); // Batch size

        if (fetchError) throw fetchError;
        
        if (!pendingEmails || pendingEmails.length === 0) {
            return new Response(JSON.stringify({ message: "No pending emails" }), { headers: { "Content-Type": "application/json" } });
        }

        console.log(`Processing ${pendingEmails.length} emails...`);

        const results = await Promise.all(pendingEmails.map(async (emailRecord) => {
            let subject = "";
            let html = "";

            if (emailRecord.notification_type === 'VOTING_STARTED') {
                subject = "IPE CR Election - Voting Started";
                html = `<p>Dear Student,</p><p>The IPE CR Election voting portal is now live.</p><p>Please cast your vote before the deadline.</p><p><a href="https://your-election-url.vercel.app">Vote Here</a></p><p>Regards,<br>IPE Election Committee</p>`;
            } else if (emailRecord.notification_type === 'VOTING_COMPLETED') {
                subject = "IPE CR Election - Voting Concluded";
                html = `<p>The election has concluded successfully as all eligible students have voted.</p>`;
            } else if (emailRecord.notification_type === 'REMINDER_SENT') {
                subject = "IPE CR Election - Voting Reminder";
                html = `<p>Dear Student,</p><p>You have not cast your vote yet. Please do so before the deadline.</p><p><a href="https://your-election-url.vercel.app">Vote Here</a></p>`;
            }

            try {
                const res = await fetch(resendEndpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${RESEND_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'IPE Elections <elections@yourdomain.com>',
                        to: emailRecord.recipient_email,
                        subject: subject,
                        html: html
                    })
                });

                if (res.ok) {
                    await supabase.from('email_notifications').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', emailRecord.id);
                    return { id: emailRecord.id, status: 'success' };
                } else {
                    const errText = await res.text();
                    throw new Error(errText);
                }
            } catch (err) {
                const newRetryCount = (emailRecord.retry_count || 0) + 1;
                const newStatus = newRetryCount >= 3 ? 'failed' : 'pending'; // Max 3 retries
                
                await supabase.from('email_notifications').update({ 
                    status: newStatus, 
                    error_message: err.message,
                    retry_count: newRetryCount 
                }).eq('id', emailRecord.id);
                
                return { id: emailRecord.id, status: 'failed', error: err.message };
            }
        }));

        return new Response(JSON.stringify({ processed: results.length, results }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
