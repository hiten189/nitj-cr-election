/* ==========================================================
   IPE Voting System
   results.js - Public Election Results Portal
   Premium layout, zero inline styles
========================================================== */

async function loadAndRenderResults(containerId = "app") {
    try {
        const container = document.getElementById(containerId);
        if (!container) return;

        const [settings, candidates, electionResults, writeInResults, ballotCount] = await Promise.all([
            getElectionSettings(),
            getActiveCandidates(),
            supabaseClient.rpc("get_election_results"),
            supabaseClient.rpc("get_write_in_results"),
            supabaseClient.rpc("get_election_ballot_count")
        ]);

        if (electionResults.error) throw electionResults.error;
        if (writeInResults.error) throw writeInResults.error;
        if (ballotCount.error) throw ballotCount.error;

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

        container.innerHTML = renderResultsHTML(settings, candidates, electionResults.data || [], writeInResults.data || [], Number(ballotCount.data) || 0);
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

function calculatePositionResults(position, candidates, electionResults, writeInResults) {
    const counts = new Map();
    electionResults.filter(result => result.position_name === position)
        .forEach(result => counts.set(result.candidate_id, Number(result.vote_count) || 0));

    const results = candidates
        .filter(c => c.position === position)
        .map(c => ({
            id: c.id,
            name: c.name,
            roll_number: c.roll_number,
            count: counts.get(c.id) || 0
        }));

    writeInResults.filter(result => result.position_name === position).forEach(result => {
        results.push({ id: `writein-${result.roll_number}`, name: `Write-in (${result.roll_number})`, roll_number: result.roll_number, count: Number(result.vote_count) || 0 });
    });

    results.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return { results, totalVotes: results.reduce((total, result) => total + result.count, 0), isRanked: false };
}

/* ==========================================
   WINNER CARD HTML
========================================== */

function renderWinnerCard(positionLabel, data) {
    if (!data.results.length || data.totalVotes === 0) return '';
    const winner = data.results[0];
    const pct    = data.totalVotes > 0 ? ((winner.count / data.totalVotes) * 100).toFixed(1) : "0.0";
    const initial = (winner.name || '?').charAt(0).toUpperCase();
    const unit    = data.isRanked ? 'pts' : 'votes';

    return `
        <article class="winner-card">
            <span class="winner-trophy">🏆</span>
            <span class="winner-position-label">${escapeHTML(positionLabel)} Winner</span>
            <div class="winner-avatar">${initial}</div>
            <h2 class="winner-name">${escapeHTML(winner.name)}</h2>
            <p class="winner-announcement">Congratulations to ${escapeHTML(winner.name)} for winning ${escapeHTML(positionLabel)}.</p>
            <p class="winner-roll">Roll No. ${escapeHTML(winner.roll_number || '—')}</p>
            <div class="winner-stats">
                <div class="winner-stat">
                    <span>Total ${unit}</span>
                    <strong>${winner.count}</strong>
                </div>
                <div class="winner-stat highlight">
                    <span>Share</span>
                    <strong>${pct}%</strong>
                </div>
            </div>
        </article>`;
}

/* ==========================================
   LEADERBOARD CARD HTML
========================================== */

function renderLeaderboardCard(positionLabel, data) {
    const topCount = data.results.length > 0 ? data.results[0].count : 0;
    const unit     = data.isRanked ? 'pts' : 'votes';

    const itemsHTML = data.results.length > 0
        ? data.results.map((r, idx) => {
            const isWinner = topCount > 0 && r.count === topCount && idx === 0;
            const pct = data.totalVotes > 0 ? ((r.count / data.totalVotes) * 100).toFixed(1) : "0.0";
            const initial = (r.name || '?').charAt(0).toUpperCase();
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
                <h2>${escapeHTML(positionLabel)}</h2>
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

function renderResultsHTML(settings, candidates, electionResults, writeInResults, ballotCount) {
    const positions   = settings.election_positions || "male_female";
    const showMale    = positions !== "female_only";
    const showFemale  = positions !== "male_only";
    const isFinalVs   = settings.election_status === "final_round";

    const maleRes   = showMale   ? calculatePositionResults("Male CR", candidates, electionResults, writeInResults) : null;
    const femaleRes = showFemale ? calculatePositionResults("Female CR", candidates, electionResults, writeInResults) : null;

    const totalVotesCast  = ballotCount;
    const electionDate    = settings.voting_end_date
        ? new Date(settings.voting_end_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

    return `
        <main class="results-shell">

            <!-- HERO -->
            <header class="results-hero">
                <button id="logout-btn" class="logout-btn-float" type="button">Log out</button>
                <div class="results-hero-badge">✓ Official Results</div>
                <h1>${escapeHTML(settings.election_name || "Class Representative Election")}</h1>
                <p>Results declared on ${electionDate} &nbsp;·&nbsp; Verified by IPE Election System</p>
            </header>

            ${isFinalVs ? `
            <div class="final-round-banner">
                ⚔️ &nbsp; FINAL ROUND (RUN-OFF) RESULTS
            </div>` : ''}

            <!-- WINNERS PODIUM -->
            <div class="winners-section">
                ${showMale   && maleRes   ? renderWinnerCard("Male CR",   maleRes)   : ''}
                ${showFemale && femaleRes ? renderWinnerCard("Female CR", femaleRes) : ''}
            </div>

            <!-- LEADERBOARD -->
            <div class="leaderboard-section">
                ${showMale   && maleRes   ? renderLeaderboardCard("Male CR Candidates",   maleRes)   : ''}
                ${showFemale && femaleRes ? renderLeaderboardCard("Female CR Candidates", femaleRes) : ''}
            </div>

            <!-- PARTICIPATION STATS -->
            <div class="participation-section">
                <div class="participation-stat">
                    <span class="stat-value">${totalVotesCast}</span>
                    <span class="stat-label">Total Votes Cast</span>
                </div>
                ${showMale && maleRes ? `
                <div class="participation-stat">
                    <span class="stat-value">${maleRes.results.length}</span>
                    <span class="stat-label">Male Candidates</span>
                </div>` : ''}
                ${showFemale && femaleRes ? `
                <div class="participation-stat">
                    <span class="stat-value">${femaleRes.results.length}</span>
                    <span class="stat-label">Female Candidates</span>
                </div>` : ''}
                <div class="participation-stat">
                    <span class="stat-value">${maleRes?.isRanked || femaleRes?.isRanked ? 'Ranked' : 'Simple'}</span>
                    <span class="stat-label">Voting Method</span>
                </div>
            </div>

            <!-- FOOTER -->
            <footer class="results-footer">
                <p>This is an official record of the IPE CR Election results.</p>
                <p>Results are calculated from anonymous, tamper-proof ballot data.</p>
            </footer>

        </main>
        <!-- CSS confetti container -->
        <div class="confetti-container" id="confetti-container"></div>`;
}

/* ==========================================
   CSS CONFETTI EFFECT
========================================== */

function triggerConfetti() {
    const container = document.getElementById("confetti-container");
    if (!container) return;

    const colors = ["#f5a623", "#3b7ef8", "#22c55e", "#7c6af7", "#ef4444", "#f8fafc"];
    const count  = 60;

    for (let i = 0; i < count; i++) {
        const piece = document.createElement("div");
        piece.className = "confetti-piece";
        piece.style.cssText = `
            left: ${Math.random() * 100}vw;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            width: ${6 + Math.random() * 8}px;
            height: ${6 + Math.random() * 8}px;
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            animation-delay: ${Math.random() * 1.5}s;
            animation-duration: ${2.5 + Math.random() * 2}s;
        `;
        container.appendChild(piece);
    }

    // Clean up after animation
    setTimeout(() => { container.innerHTML = ''; }, 5500);
}
