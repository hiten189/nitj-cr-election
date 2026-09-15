// Supabase Edge Function — send-emails
// Rewrote to be fully race-condition-proof:
//   • Only uses claim_pending_emails RPC (FOR UPDATE SKIP LOCKED)
//   • No fallback SELECT path — eliminates the 4x-duplicate-email root cause
//   • If RPC unavailable, exits cleanly (do not fall back to a racy SELECT)
//   • Dedup check is a last-resort safety net AFTER atomic claim
// Deploy: supabase functions deploy send-emails --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BREVO_API_KEY            = Deno.env.get("BREVO_API_KEY");
const BREVO_SENDER_EMAIL       = Deno.env.get("BREVO_SENDER_EMAIL") || "nitj.cr.election@gmail.com";
const SUPABASE_URL             = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SITE_URL                 = "https://nitj-cr-election.netlify.app";

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
const brevoEndpoint = "https://api.brevo.com/v3/smtp/email";

const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
//  EMAIL SHELL
// ============================================================
function emailShell(bodyRows: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="dark">
</head>
<body style="margin:0;padding:0;background:#05080f;width:100%;-webkit-text-size-adjust:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#05080f;">
  <tr><td align="center" style="padding:24px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:600px;background:#081221;border-radius:20px;overflow:hidden;border:1px solid #1c2b42;">
      ${bodyRows}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function emailBtn(href: string, label: string, bg: string, color: string): string {
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:8px 24px 0;">
    <a href="${href}"
       style="display:block;width:100%;box-sizing:border-box;background:${bg};color:${color};
              text-decoration:none;padding:17px 20px;font-weight:800;border-radius:14px;
              font-size:16px;letter-spacing:0.2px;text-align:center;
              font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${label}</a>
  </td></tr>
</table>`;
}

function pill(text: string, bg: string, color: string, border: string): string {
    return `<div style="display:inline-block;background:${bg};border:1px solid ${border};border-radius:999px;
                        padding:5px 14px;font-size:11px;font-weight:800;color:${color};letter-spacing:1.3px;
                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${text}</div>`;
}

function emailFooter(note = "NITJ Election System &middot; Secure &amp; anonymous voting"): string {
    return `
<tr><td style="padding:18px 24px;text-align:center;border-top:1px solid #1c2b42;background:#040c1a;">
  <p style="margin:0;font-size:12px;color:#3d5070;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${note}</p>
</td></tr>`;
}

// ============================================================
//  BUILD EMAIL PER TYPE
// ============================================================
async function buildEmail(
    notifType: string,
    magicLink: string,
    recipientEmail: string
): Promise<{ subject: string; html: string; plainText: string } | null> {

    if (notifType === "VOTING_STARTED") {
        const { data: candidates } = await supabase
            .from("candidates").select("name,position,roll_number").eq("active", true);

        const candidateRows = (candidates || []).map(c => {
            const init = (c.name || "?").charAt(0).toUpperCase();
            return `
<tr>
  <td style="padding:8px 14px;border-bottom:1px solid rgba(255,255,255,0.05);">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="width:30px;height:30px;border-radius:50%;background:rgba(59,126,248,0.18);
                 color:#3b7ef8;font-weight:800;font-size:12px;text-align:center;vertical-align:middle;">${init}</td>
      <td style="padding-left:10px;">
        <div style="font-weight:700;color:#e8f0ff;font-size:13px;">${c.name}</div>
        <div style="font-size:11px;color:#5e7799;margin-top:1px;">${c.position || ""} &middot; Roll ${c.roll_number || "n/a"}</div>
      </td>
    </tr></table>
  </td>
</tr>`;
        }).join("");

        const subject = "NITJ CR Election is LIVE — Cast your vote now";
        const html = emailShell(`
<tr>
  <td style="padding:36px 24px 28px;text-align:center;background:linear-gradient(180deg,#0d1b33 0%,#081221 100%);border-bottom:1px solid #1c2b42;">
    ${pill("&#9679; VOTING IS LIVE", "#113123", "#32d74b", "#165c38")}
    <h1 style="margin:16px 0 0;font-size:26px;line-height:1.15;font-weight:800;color:#fff;letter-spacing:-0.5px;">NITJ CR Election</h1>
    <p style="margin:10px 0 0;font-size:15px;color:#9fb3d1;line-height:1.5;">The portal is open. One tap &mdash; your ballot is waiting.</p>
  </td>
</tr>
<tr>
  <td style="padding:20px 16px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#111f36;border:1px solid #1c2b42;border-radius:14px;overflow:hidden;">
      <tr><td style="padding:10px 14px;border-bottom:1px solid #1c2b42;font-size:10px;font-weight:800;
                     color:#5e7799;letter-spacing:1.4px;">CANDIDATES ON THE BALLOT</td></tr>
      ${candidateRows || `<tr><td style="padding:12px 14px;color:#5e7799;font-size:13px;">No candidates listed yet.</td></tr>`}
    </table>
  </td>
</tr>
<tr>
  <td style="padding:20px 16px 28px;">
    ${emailBtn(magicLink, "Vote Now &rarr;", "#3b7ef8", "#ffffff")}
    <p style="text-align:center;margin:12px 0 0;font-size:12px;color:#5e7799;">Secure magic-link sign-in &middot; No password required</p>
  </td>
</tr>
${emailFooter()}`);
        return { subject, html, plainText: `${subject}\n\nVote here: ${magicLink}\n\nNITJ Election System` };
    }

    if (notifType === "VOTING_COMPLETED") {
        const subject = "NITJ CR Election — Results are live";
        const html = emailShell(`
<tr>
  <td style="padding:40px 24px 28px;text-align:center;background:linear-gradient(180deg,#1a180e,#081221);border-bottom:1px solid #332b10;">
    <div style="font-size:48px;line-height:1;margin-bottom:12px;">&#127942;</div>
    ${pill("RESULTS ANNOUNCED", "#332b10", "#ffd60a", "#4d4118")}
    <h1 style="margin:16px 0 0;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Winners Declared</h1>
    <p style="margin:10px 0 0;font-size:15px;color:#9fb3d1;line-height:1.5;">The election has concluded. Official results are now live.</p>
  </td>
</tr>
<tr><td style="padding:24px 16px 32px;">${emailBtn(magicLink, "View Results &rarr;", "#ffd60a", "#0a1424")}</td></tr>
${emailFooter()}`);
        return { subject, html, plainText: `${subject}\n\nResults: ${magicLink}\n\nNITJ Election System` };
    }

    if (notifType === "REMINDER_SENT") {
        const subject = "Reminder: Your NITJ CR Election vote is pending";
        const html = emailShell(`
<tr>
  <td style="padding:36px 24px 28px;text-align:center;background:linear-gradient(180deg,#1f150d,#081221);border-bottom:1px solid #332010;">
    ${pill("&#9200; REMINDER", "#332010", "#ff9f0a", "#4d2e11")}
    <h1 style="margin:16px 0 0;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Don&rsquo;t forget to vote</h1>
    <p style="margin:10px 0 0;font-size:15px;color:#9fb3d1;line-height:1.5;">You haven&rsquo;t cast your ballot yet. The window is still open.</p>
  </td>
</tr>
<tr>
  <td style="padding:20px 16px 28px;">
    <div style="background:#111f36;border:1px solid #1c2b42;border-radius:12px;padding:18px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#9fb3d1;line-height:1.6;">Your vote matters. It takes under a minute &mdash; tap below to authenticate and submit your ballot.</p>
    </div>
    ${emailBtn(magicLink, "Cast My Vote &rarr;", "#ff9f0a", "#0a1424")}
    <p style="text-align:center;margin:12px 0 0;font-size:12px;color:#5e7799;">Secure magic-link &middot; expires in 1 hour</p>
  </td>
</tr>
${emailFooter()}`);
        return { subject, html, plainText: `${subject}\n\nVote here: ${magicLink}\n\nNITJ Election System` };
    }

    if (notifType === "ALL_VOTED_ADMIN_ALERT") {
        const subject = "NITJ CR Election: 100% Voter Turnout Reached";
        const html = emailShell(`
<tr>
  <td style="padding:40px 24px 28px;text-align:center;background:#111f36;border-bottom:1px solid #1c2b42;">
    <div style="font-size:52px;line-height:1;margin-bottom:12px;">&#128202;</div>
    ${pill("100% TURNOUT", "#113123", "#32d74b", "#165c38")}
    <h1 style="margin:16px 0 0;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;">All Students Have Voted</h1>
    <p style="margin:10px 0 0;font-size:15px;color:#9fb3d1;line-height:1.5;">Every expected voter has submitted their ballot.</p>
  </td>
</tr>
<tr>
  <td style="padding:24px 16px 32px;">
    <div style="background:#0d1b2e;border:1px solid #1c2b42;border-radius:12px;padding:18px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#9fb3d1;line-height:1.6;">Log into the Admin Portal to review the results and declare the official winners.</p>
    </div>
    ${emailBtn(magicLink, "Open Admin Portal &rarr;", "#3b7ef8", "#ffffff")}
  </td>
</tr>
${emailFooter("NITJ Election System &middot; Administrator Alert")}`);
        return { subject, html, plainText: `${subject}\n\nAdmin Portal: ${magicLink}\n\nNITJ Election System` };
    }

    if (notifType === "CLOSING_WARNING") {
        const subject = "Urgent: NITJ CR Election is closing soon";
        const html = emailShell(`
<tr>
  <td style="padding:36px 24px 28px;text-align:center;background:linear-gradient(180deg,#1f0f13,#081221);border-bottom:1px solid #331a20;">
    ${pill("&#9888; URGENT", "#331a20", "#ff453a", "#4d2630")}
    <h1 style="margin:16px 0 0;font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Voting is Closing Soon</h1>
    <p style="margin:10px 0 0;font-size:15px;color:#9fb3d1;line-height:1.5;">Cast your vote immediately or it won&rsquo;t be counted.</p>
  </td>
</tr>
<tr>
  <td style="padding:24px 16px 32px;">
    <div style="background:#1a0a0d;border:1px solid #331a20;border-radius:12px;padding:18px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#ffb3b0;line-height:1.6;">Our records show you have not yet voted. The deadline is imminent &mdash; tap below now.</p>
    </div>
    ${emailBtn(magicLink, "Vote Immediately &rarr;", "#ff453a", "#ffffff")}
  </td>
</tr>
${emailFooter()}`);
        return { subject, html, plainText: `${subject}\n\nVote here: ${magicLink}\n\nNITJ Election System` };
    }

    if (notifType === "ADMIN_PENDING_LIST") {
        const { data: pendingStudents } = await supabase
            .from("eligible_students").select("email").eq("status", "pending");

        const rows = (pendingStudents || []).map(s => {
            const parts = (s.email || "").split("@")[0].split(".");
            const name = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "—";
            const branch = (parts[1] || "—").toUpperCase();
            return `
<tr>
  <td style="padding:9px 12px;border-bottom:1px solid #1c2b42;color:#e8f0ff;font-size:13px;">${name}</td>
  <td style="padding:9px 12px;border-bottom:1px solid #1c2b42;color:#9fb3d1;font-size:13px;">${branch}</td>
  <td style="padding:9px 12px;border-bottom:1px solid #1c2b42;color:#5e7799;font-size:12px;">${s.email}</td>
</tr>`;
        }).join("") || `<tr><td colspan="3" style="padding:14px;text-align:center;color:#32d74b;font-size:13px;">&#127881; All students have voted!</td></tr>`;

        const count = pendingStudents?.length ?? 0;
        const subject = `Admin Alert: ${count} student${count !== 1 ? "s" : ""} yet to vote`;
        const html = emailShell(`
<tr>
  <td style="padding:32px 24px 20px;text-align:center;background:#111f36;border-bottom:1px solid #1c2b42;">
    <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;">Pending Voters</h1>
    <p style="margin:8px 0 0;font-size:14px;color:#9fb3d1;">${count} student${count !== 1 ? "s" : ""} have not voted yet.</p>
  </td>
</tr>
<tr>
  <td style="padding:16px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"
           style="border:1px solid #1c2b42;border-radius:12px;overflow:hidden;">
      <thead>
        <tr>
          <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:800;color:#5e7799;letter-spacing:1px;border-bottom:1px solid #1c2b42;">NAME</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:800;color:#5e7799;letter-spacing:1px;border-bottom:1px solid #1c2b42;">BRANCH</th>
          <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:800;color:#5e7799;letter-spacing:1px;border-bottom:1px solid #1c2b42;">EMAIL</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </td>
</tr>
${emailFooter("NITJ Election System &middot; Administrator Report")}`);
        return { subject, html, plainText: `${subject}\n\nAdmin Portal: ${magicLink}\n\nNITJ Election System` };
    }

    return null;
}

// ============================================================
//  MAIN HANDLER
// ============================================================
serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // STEP 1: Atomically claim emails using FOR UPDATE SKIP LOCKED.
        // This is the ONLY path. No fallback SELECT — that was the source of 4x emails.
        const { data: claimed, error: claimError } = await supabase.rpc(
            "claim_pending_emails",
            { batch_size: 10 }
        );

        if (claimError) {
            console.error("claim_pending_emails RPC failed:", claimError.message);
            return new Response(
                JSON.stringify({
                    error: "claim_pending_emails RPC unavailable. Run fix_email_duplicates_constraint.sql in Supabase SQL Editor first.",
                    detail: claimError.message,
                }),
                { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const pendingEmails: any[] = Array.isArray(claimed) ? claimed : [];

        if (pendingEmails.length === 0) {
            return new Response(
                JSON.stringify({ message: "No pending emails." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Claimed ${pendingEmails.length} email(s) to process.`);

        if (!BREVO_API_KEY) {
            const ids = pendingEmails.map(e => e.id);
            await supabase.from("email_notifications")
                .update({ status: "failed", error_message: "BREVO_API_KEY not configured." })
                .in("id", ids);
            return new Response(
                JSON.stringify({ error: "BREVO_API_KEY secret missing." }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // STEP 2: Process each atomically-claimed email
        const results: any[] = [];

        for (const emailRecord of pendingEmails) {
            const recipientEmail: string = (emailRecord.recipient_email || "").toLowerCase().trim();
            const notifType: string = emailRecord.notification_type || "";

            // Last-resort safety net: check if already sent (covers DB restore edge cases)
            const { data: alreadySent } = await supabase
                .from("email_notifications")
                .select("id")
                .eq("recipient_email", recipientEmail)
                .eq("notification_type", notifType)
                .eq("status", "sent")
                .neq("id", emailRecord.id)
                .limit(1);

            if (alreadySent && alreadySent.length > 0) {
                await supabase.from("email_notifications")
                    .update({ status: "cancelled", error_message: "Already delivered to this recipient." })
                    .eq("id", emailRecord.id);
                results.push({ id: emailRecord.id, status: "skipped_already_sent", recipient: recipientEmail });
                console.log(`Skipped duplicate for ${recipientEmail} / ${notifType}`);
                continue;
            }

            // Generate magic link
            let magicLink = SITE_URL;
            try {
                const { data: linkData } = await supabase.auth.admin.generateLink({
                    type: "magiclink",
                    email: recipientEmail,
                    options: { redirectTo: SITE_URL },
                });
                if (linkData?.properties?.action_link) {
                    magicLink = linkData.properties.action_link;
                }
            } catch (linkErr) {
                console.warn(`Magic link gen failed for ${recipientEmail}:`, linkErr);
            }

            // Build email content
            const emailContent = await buildEmail(notifType, magicLink, recipientEmail);
            if (!emailContent) {
                await supabase.from("email_notifications")
                    .update({ status: "cancelled", error_message: `Unknown type: ${notifType}` })
                    .eq("id", emailRecord.id);
                results.push({ id: emailRecord.id, status: "skipped_unknown_type" });
                continue;
            }

            // Send via Brevo
            try {
                const res = await fetch(brevoEndpoint, {
                    method: "POST",
                    headers: {
                        "api-key":      BREVO_API_KEY,
                        "Content-Type": "application/json",
                        "accept":       "application/json",
                    },
                    body: JSON.stringify({
                        sender:      { name: "NITJ Elections", email: BREVO_SENDER_EMAIL },
                        to:          [{ email: recipientEmail }],
                        subject:     emailContent.subject,
                        htmlContent: emailContent.html,
                        textContent: emailContent.plainText,
                    }),
                });

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Brevo HTTP ${res.status}: ${errText}`);
                }

                await supabase.from("email_notifications")
                    .update({ status: "sent", sent_at: new Date().toISOString() })
                    .eq("id", emailRecord.id);

                results.push({ id: emailRecord.id, status: "sent", recipient: recipientEmail, type: notifType });
                console.log(`Sent ${notifType} to ${recipientEmail}`);

            } catch (sendErr: any) {
                const errMsg = sendErr?.message || String(sendErr);
                const retries = (emailRecord.retry_count || 0) + 1;
                // NEVER set back to pending — that re-triggers the duplicate problem
                await supabase.from("email_notifications")
                    .update({ status: "failed", error_message: errMsg, retry_count: retries })
                    .eq("id", emailRecord.id);
                results.push({ id: emailRecord.id, status: "failed", error: errMsg, recipient: recipientEmail });
                console.error(`Failed ${notifType} to ${recipientEmail}:`, errMsg);
            }
        }

        return new Response(
            JSON.stringify({ processed: results.length, results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err: any) {
        console.error("Fatal error:", err);
        return new Response(
            JSON.stringify({ error: err?.message || String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
