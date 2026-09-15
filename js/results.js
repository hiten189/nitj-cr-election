/* ==========================================================
   IPE Voting System
   results.js - Public Election Results Portal
   Historical Round 1 & Final VS Multi-Round Support
========================================================== */

async function loadAndRenderResults(containerId = "app") {
    try {
        const container = document.getElementById(containerId);
        if (!container) return;

        const [settings, candidates] = await Promise.all([
            SettingsAPI.get(),
            CandidatesAPI.getAll()
        ]);

        if (!settings?.results_published) {
            container.innerHTML = `
                <div class="results-not-published">
                    <section class="state-card">
                        <div class="state-icon">🔒</div>
                        <h2>Results Not Yet Published</h2>
                        <p>The election results have not been announced by the administrator yet. Please check back later.</p>
                        <button id="logout-btn" class="logout-button" type="button" style="margin-top:8px; width:100%;">Log out</button>
                    </section>
                </div>`;
            const logoutBtn = container.querySelector("#logout-btn");
            if (logoutBtn) logoutBtn.addEventListener("click", logout);
            return;
        }

        // Direct database query on votes table
        const { data: votesData, error: votesError } = await supabaseClient
            .from("votes")
            .select("male_candidate_id, female_candidate_id, male_write_in_roll, female_write_in_roll, ranking_data, round_number");

        let voteList = votesData || [];

        // RPC Fallback if direct select is restricted
        if (votesError || !votesData) {
            console.warn("Direct votes query returned error, trying RPC fallback:", votesError);
            try {
                const [resRes, writeRes, countRes] = await Promise.all([
                    supabaseClient.rpc("get_election_results"),
                    supabaseClient.rpc("get_write_in_results"),
                    supabaseClient.rpc("get_election_ballot_count")
                ]);

                if (!resRes.error && resRes.data) {
                    container.innerHTML = renderResultsFromRPCData(settings, candidates, resRes.data || [], writeRes.data || [], Number(countRes.data) || 0);
                    triggerConfetti();
                    const logoutBtn = document.getElementById("logout-btn");
                    if (logoutBtn) logoutBtn.addEventListener("click", logout);
                    return;
                }
            } catch (rpcErr) {
                console.error("RPC fallback error:", rpcErr);
            }
        }

        container.innerHTML = renderResultsHTML(settings, candidates, voteList);
        triggerConfetti();

        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) logoutBtn.addEventListener("click", logout);
    } catch (error) {
        console.error("Error loading results:", error);
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="results-not-published">
                    <section class="state-card">
                        <div class="state-icon">⚠️</div>
                        <h2>Unable to Load Results</h2>
                        <p>${escapeHTML(error.message || MESSAGE.SOMETHING_WENT_WRONG)}</p>
                    </section>
                </div>`;
        }
    }
}

/* ==========================================
   CALCULATION HELPERS
========================================== */

function calculatePositionResults(position, candidates, votes) {
    const catKey   = position === "Male CR" ? "male"   : "female";
    const key      = position === "Male CR" ? "male_candidate_id"    : "female_candidate_id";
    const writeKey = position === "Male CR" ? "male_write_in_roll"   : "female_write_in_roll";

    const isRankedVotes = votes.some(v => v.ranking_data && v.ranking_data[catKey] && Object.keys(v.ranking_data[catKey]).length > 0);

    const counts = new Map();
    let totalVotes = 0;

    if (isRankedVotes) {
        votes.forEach(vote => {
            const ranks = vote.ranking_data?.[catKey];
            if (!ranks) return;
            totalVotes++;
            for (const [cId, rank] of Object.entries(ranks)) {
                const pts = rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0;
                counts.set(cId, (counts.get(cId) || 0) + pts);
            }
        });
    } else {
        votes.forEach(vote => {
            if (vote[key]) {
                counts.set(vote[key], (counts.get(vote[key]) || 0) + 1);
                totalVotes++;
            } else if (vote[writeKey]) {
                totalVotes++;
            }
        });
    }

    const results = candidates
        .filter(c => c.position === position)
        .map(c => ({
            id: c.id,
            name: c.name,
            roll_number: c.roll_number,
            count: counts.get(c.id) || 0
        }));

    const writeIns = new Map();
    votes.forEach(vote => {
        if (vote[writeKey]) {
            writeIns.set(vote[writeKey], (writeIns.get(vote[writeKey]) || 0) + 1);
        }
    });
    writeIns.forEach((count, roll) => {
        results.push({ id: `writein-${roll}`, name: `Write-in (${roll})`, roll_number: roll, count });
    });

    results.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return { results, totalVotes, isRanked: isRankedVotes };
}

/* ==========================================
   RPC FALLBACK CALCULATOR
========================================== */

function calculatePositionResultsFromRPC(position, candidates, rpcResults, writeInResults) {
    const counts = new Map();
    rpcResults.filter(r => r.position_name === position)
        .forEach(r => counts.set(r.candidate_id, Number(r.vote_count) || 0));

    const results = candidates
        .filter(c => c.position === position)
        .map(c => ({
            id: c.id,
            name: c.name,
            roll_number: c.roll_number,
            count: counts.get(c.id) || 0
        }));

    writeInResults.filter(r => r.position_name === position).forEach(r => {
        results.push({ id: `writein-${r.roll_number}`, name: `Write-in (${r.roll_number})`, roll_number: r.roll_number, count: Number(r.vote_count) || 0 });
    });

    results.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return { results, totalVotes: results.reduce((sum, r) => sum + r.count, 0), isRanked: false };
}

/* ==========================================
   WINNER CARD HTML
========================================== */

function renderWinnerCard(positionLabel, data, isOfficialWinner = false) {
    if (!data.results.length || data.totalVotes === 0) return '';
    const winner = data.results[0];
    const pct    = data.totalVotes > 0 ? ((winner.count / data.totalVotes) * 100).toFixed(1) : "0.0";
    const initial = (winner.name || '?').charAt(0).toUpperCase();
    const unit    = data.isRanked ? 'pts' : 'votes';
    const labelTitle = isOfficialWinner ? `Official Winner — ${positionLabel}` : `${positionLabel} Winner`;

    return `
        <article class="winner-card">
            <span class="winner-trophy">🏆</span>
            <span class="winner-position-label">${escapeHTML(labelTitle)}</span>
            <div class="winner-avatar">${initial}</div>
            <h2 class="winner-name">${escapeHTML(winner.name)}</h2>
            <p class="winner-announcement">Congratulations to <strong>${escapeHTML(winner.name)}</strong> for winning <strong>${escapeHTML(positionLabel)}</strong>.</p>
            <p class="winner-roll">Roll No. ${escapeHTML(winner.roll_number || '—')}</p>
            <div class="winner-stats">
                <div class="winner-stat">
                    <span>Votes Received</span>
                    <strong>${winner.count} ${unit}</strong>
                </div>
                <div class="winner-stat highlight">
                    <span>Winning Share</span>
                    <strong>${pct}%</strong>
                </div>
            </div>
        </article>`;
}

/* ==========================================
   LEADERBOARD CARD HTML
========================================== */

function renderLeaderboardCard(positionLabel, data, sectionTitle = "") {
    const topCount = data.results.length > 0 ? data.results[0].count : 0;
    const unit     = data.isRanked ? 'pts' : 'votes';
    const title = sectionTitle || `${positionLabel} Standings`;

    const itemsHTML = data.results.length > 0
        ? data.results.map((r, idx) => {
            const isWinner = topCount > 0 && r.count === topCount && idx === 0;
            const pct = data.totalVotes > 0 ? ((r.count / data.totalVotes) * 100).toFixed(1) : "0.0";
            const rankDisplay = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;

            return `
                <div class="result-item ${isWinner ? 'winner-item' : ''}">
                    <div class="result-rank">${rankDisplay}</div>
                    <div class="result-info">
                        <strong>${escapeHTML(r.name)}</strong>
                        <small>Roll No. ${escapeHTML(r.roll_number || '—')}</small>
                    </div>
                    <div class="result-right">
                        <strong>${r.count} <small>${unit}</small></strong>
                        <small class="${isWinner ? 'winner-pct' : ''}">${pct}%</small>
                    </div>
                </div>
                <div class="result-bar-container">
                    <div class="result-bar-track">
                        <div class="result-bar-fill" style="width: ${pct}%"></div>
                    </div>
                </div>`;
        }).join("")
        : `<p class="results-empty">No votes recorded for this position.</p>`;

    return `
        <section class="leaderboard-card">
            <div class="leaderboard-header">
                <h2>${escapeHTML(title)}</h2>
                <span class="total-votes-badge">${data.totalVotes} ${unit} cast</span>
            </div>
            ${data.isRanked ? `<div class="ranked-note">📊 Borda-count ranked results</div>` : ''}
            <div class="leaderboard-body">
                ${itemsHTML}
            </div>
        </section>`;
}

/* ==========================================
   FULL RESULTS HTML
========================================== */

function renderResultsHTML(settings, candidates, votes) {
    const positions   = settings.election_positions || "male_female";
    const showMale    = positions !== "female_only";
    const showFemale  = positions !== "male_only";

    // Partition Round 1 vs Round 2 (Final VS) votes
    const round1Votes = votes.filter(v => v.round_number === 1 || !v.round_number);
    const round2Votes = votes.filter(v => v.round_number === 2);
    const hasFinalVsRound = round2Votes.length > 0;

    // Active dataset for Official Winner determination
    const activeVotes = hasFinalVsRound ? round2Votes : round1Votes;

    const maleWinnerRes   = showMale   ? calculatePositionResults("Male CR",   candidates, activeVotes) : null;
    const femaleWinnerRes = showFemale ? calculatePositionResults("Female CR", candidates, activeVotes) : null;

    const maleRound1Res   = showMale   ? calculatePositionResults("Male CR",   candidates, round1Votes) : null;
    const femaleRound1Res = showFemale ? calculatePositionResults("Female CR", candidates, round1Votes) : null;

    const maleRound2Res   = (hasFinalVsRound && showMale)   ? calculatePositionResults("Male CR",   candidates, round2Votes) : null;
    const femaleRound2Res = (hasFinalVsRound && showFemale) ? calculatePositionResults("Female CR", candidates, round2Votes) : null;

    const totalVotesCast  = votes.length;
    const electionDate    = settings.voting_end_date
        ? new Date(settings.voting_end_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    return `
        <main class="results-shell">

            <!-- HERO -->
            <header class="results-hero">
                <button id="logout-btn" class="logout-btn-float" type="button">Log out</button>
                <div class="results-hero-badge">✓ Official Winner &amp; Election Results</div>
                <h1>${escapeHTML(settings.election_name || "Class Representative Election")}</h1>
                <p>Results declared on ${electionDate} &nbsp;·&nbsp; Verified by NITJ Election System</p>
            </header>

            ${hasFinalVsRound ? `
            <div class="final-round-banner">
                ⚔️ &nbsp; FINAL VS RUN-OFF CONCLUDED — OFFICIAL WINNERS DECLARED
            </div>` : ''}

            <!-- OFFICIAL WINNERS PODIUM -->
            <div class="winners-section">
                ${showMale   && maleWinnerRes   ? renderWinnerCard("Male CR",   maleWinnerRes,   true) : ''}
                ${showFemale && femaleWinnerRes ? renderWinnerCard("Female CR", femaleWinnerRes, true) : ''}
            </div>

            ${hasFinalVsRound ? `
            <!-- FINAL VS RESULTS SECTION -->
            <div style="margin-top: 32px; margin-bottom: 12px;">
                <h2 style="font-size: 1.25rem; font-weight: 700; color: #f8fafc;">⚔️ Final VS Results (Round 2)</h2>
                <p style="font-size: 0.86rem; color: #aebbd0;">Direct 1-on-1 run-off results between top Round 1 candidates.</p>
            </div>
            <div class="leaderboard-section">
                ${showMale   && maleRound2Res   ? renderLeaderboardCard("Male CR",   maleRound2Res,   "Final VS Results — Male CR")   : ''}
                ${showFemale && femaleRound2Res ? renderLeaderboardCard("Female CR", femaleRound2Res, "Final VS Results — Female CR") : ''}
            </div>

            <!-- HISTORICAL ROUND 1 RESULTS SECTION -->
            <div style="margin-top: 40px; margin-bottom: 12px;">
                <h2 style="font-size: 1.25rem; font-weight: 700; color: #f8fafc;">📊 Round 1 Results (Historical)</h2>
                <p style="font-size: 0.86rem; color: #aebbd0;">Initial election standings prior to Final VS run-off.</p>
            </div>
            <div class="leaderboard-section">
                ${showMale   && maleRound1Res   ? renderLeaderboardCard("Male CR",   maleRound1Res,   "Round 1 Results — Male CR")   : ''}
                ${showFemale && femaleRound1Res ? renderLeaderboardCard("Female CR", femaleRound1Res, "Round 1 Results — Female CR") : ''}
            </div>
            ` : `
            <!-- ROUND 1 STANDINGS SECTION -->
            <div style="margin-top: 32px; margin-bottom: 12px;">
                <h2 style="font-size: 1.25rem; font-weight: 700; color: #f8fafc;">📊 Round 1 Results</h2>
            </div>
            <div class="leaderboard-section">
                ${showMale   && maleRound1Res   ? renderLeaderboardCard("Male CR",   maleRound1Res,   "Round 1 Results — Male CR")   : ''}
                ${showFemale && femaleRound1Res ? renderLeaderboardCard("Female CR", femaleRound1Res, "Round 1 Results — Female CR") : ''}
            </div>
            `}

            <!-- PARTICIPATION STATS -->
            <div class="participation-section">
                <div class="participation-stat">
                    <span class="stat-value">${totalVotesCast}</span>
                    <span class="stat-label">Total Votes Cast</span>
                </div>
                ${showMale && maleRound1Res ? `
                <div class="participation-stat">
                    <span class="stat-value">${maleRound1Res.results.length}</span>
                    <span class="stat-label">Male Candidates</span>
                </div>` : ''}
                ${showFemale && femaleRound1Res ? `
                <div class="participation-stat">
                    <span class="stat-value">${femaleRound1Res.results.length}</span>
                    <span class="stat-label">Female Candidates</span>
                </div>` : ''}
                <div class="participation-stat">
                    <span class="stat-value">${hasFinalVsRound ? 'Round 1 + Final VS' : (maleRound1Res?.isRanked || femaleRound1Res?.isRanked ? 'Ranked' : 'Single Choice')}</span>
                    <span class="stat-label">Voting Workflow</span>
                </div>
            </div>

            <!-- FOOTER -->
            <footer class="results-footer">
                <p>This is an official record of the NITJ CR Election results.</p>
                <p>Results are calculated directly from anonymous ballot records.</p>
            </footer>

        </main>
        <div class="confetti-container" id="confetti-container"></div>`;
}

function renderResultsFromRPCData(settings, candidates, rpcResults, writeInResults, totalBallotCount) {
    const positions  = settings.election_positions || "male_female";
    const showMale   = positions !== "female_only";
    const showFemale = positions !== "male_only";

    const maleRes   = showMale   ? calculatePositionResultsFromRPC("Male CR",   candidates, rpcResults, writeInResults) : null;
    const femaleRes = showFemale ? calculatePositionResultsFromRPC("Female CR", candidates, rpcResults, writeInResults) : null;

    const electionDate = settings.voting_end_date
        ? new Date(settings.voting_end_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    return `
        <main class="results-shell">

            <header class="results-hero">
                <button id="logout-btn" class="logout-btn-float" type="button">Log out</button>
                <div class="results-hero-badge">✓ Official Election Results</div>
                <h1>${escapeHTML(settings.election_name || "Class Representative Election")}</h1>
                <p>Results declared on ${electionDate} &nbsp;·&nbsp; Verified by NITJ Election System</p>
            </header>

            <div class="winners-section">
                ${showMale   && maleRes   ? renderWinnerCard("Male CR",   maleRes,   true) : ''}
                ${showFemale && femaleRes ? renderWinnerCard("Female CR", femaleRes, true) : ''}
            </div>

            <div class="leaderboard-section">
                ${showMale   && maleRes   ? renderLeaderboardCard("Male CR",   maleRes,   "Round 1 Results — Male CR")   : ''}
                ${showFemale && femaleRes ? renderLeaderboardCard("Female CR", femaleRes, "Round 1 Results — Female CR") : ''}
            </div>

            <div class="participation-section">
                <div class="participation-stat">
                    <span class="stat-value">${totalBallotCount}</span>
                    <span class="stat-label">Total Votes Cast</span>
                </div>
                <div class="participation-stat">
                    <span class="stat-value">Official</span>
                    <span class="stat-label">Voting Workflow</span>
                </div>
            </div>

            <footer class="results-footer">
                <p>This is an official record of the NITJ CR Election results.</p>
                <p>Results are calculated directly from anonymous ballot records.</p>
            </footer>

        </main>
        <div class="confetti-container" id="confetti-container"></div>`;
}

/* ==========================================
   CSS CONFETTI EFFECT
========================================== */

function triggerConfetti() {
    if (typeof confetti !== "undefined") {
        // Initial burst
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#ffd60a', '#3b7ef8', '#32d74b', '#5e5ce6', '#ff9f0a'] });
        
        // Side cannons with delay
        setTimeout(() => {
            confetti({ particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.65 }, colors: ['#ffd60a', '#3b7ef8', '#32d74b'] });
            confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.65 }, colors: ['#ffd60a', '#3b7ef8', '#32d74b'] });
        }, 250);
        
        // Sustained gentle rain
        var end = Date.now() + 3000;
        (function frame() {
            confetti({ particleCount: 3, angle: 60, spread: 45, origin: { x: 0, y: 0.5 }, colors: ['#ffd60a', '#3b7ef8'] });
            confetti({ particleCount: 3, angle: 120, spread: 45, origin: { x: 1, y: 0.5 }, colors: ['#ffd60a', '#3b7ef8'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }
}
