/* ==========================================================
   IPE Voting System
   admin-dashboard.js
========================================================== */

const AdminDashboard = {
    init() {
        logDebug("AdminDashboard init");
        const container = document.querySelector('[data-panel-view="overview"]');
        if (container) {
            container.addEventListener('input', (e) => {
                if (e.target.id === 'voter-search') {
                    this.filterTable();
                }
            });
            container.addEventListener('change', (e) => {
                if (e.target.id === 'voter-filter') {
                    this.filterTable();
                }
            });
        }

        // Result aggregates are fetched separately from the initial admin state.
        this.startLiveUpdates();
        this.refresh();
    },

    startLiveUpdates() {
        if (this.liveUpdatesStarted) return;
        this.liveUpdatesStarted = true;

        const queueRefresh = () => this.scheduleRefresh();
        this.realtimeChannel = supabaseClient
            .channel("admin-live-voting")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes" }, queueRefresh)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "voter_tracking" }, queueRefresh)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, queueRefresh)
            .subscribe((status) => logDebug("Live voting subscription:", status));

        // Rely exclusively on Supabase Realtime for a buttery-smooth, efficient dashboard experience.
        window.addEventListener("beforeunload", () => {
            if (this.realtimeChannel) supabaseClient.removeChannel(this.realtimeChannel);
        }, { once: true });
    },

    scheduleRefresh() {
        window.clearTimeout(this.refreshDebounce);
        this.refreshDebounce = window.setTimeout(() => this.refresh(), 300);
    },

    async load() {
        logDebug("AdminDashboard load");
        await window.ElectionState.refreshDashboard();

        try {
            const { data, error } = await supabaseClient.rpc("get_election_results");
            if (error) throw error;
            this.liveResults = data || [];
        } catch (e) {
            console.error("Could not fetch live results", e);
            this.liveResults = this.getResultsFromVotes();
        }
    },

    getResultsFromVotes() {
        const candidatesById = new Map((window.ElectionState.candidates || []).map((candidate) => [candidate.id, candidate]));
        const counts = new Map();
        (window.ElectionState.votes || []).forEach((vote) => {
            [["Male CR", vote.male_candidate_id], ["Female CR", vote.female_candidate_id]].forEach(([position, id]) => {
                const candidate = candidatesById.get(id);
                if (!candidate) return;
                const key = `${position}:${id}`;
                const result = counts.get(key) || { position_name: position, candidate_name: candidate.name, vote_count: 0 };
                result.vote_count += 1;
                counts.set(key, result);
            });
        });
        return [...counts.values()];
    },

    render() {
        logDebug("AdminDashboard render");
        const container = document.querySelector('[data-panel-view="overview"]');
        if (!container) return;

        const state = window.ElectionState;
        const settings = state.settings || {};
        const status = settings.election_status || ELECTION_STATUS.DRAFT;
        const trackingMode = settings.tracking_mode || TRACKING_MODE.RULES_ONLY;

        const expectedCount = Number(settings.expected_voters) || 0;
        const eligibleCount = state.eligibleStudents.length;
        const votesCast = state.votes.length;

        const pendingVotes = trackingMode === TRACKING_MODE.IMPORTED_LIST ? Math.max(eligibleCount - votesCast, 0) :
            (trackingMode === TRACKING_MODE.EXPECTED_COUNT ? Math.max(expectedCount - votesCast, 0) : 0);

        let turnout = "0.0";
        if (trackingMode === TRACKING_MODE.IMPORTED_LIST && eligibleCount) turnout = ((votesCast / eligibleCount) * 100).toFixed(1);
        else if (trackingMode === TRACKING_MODE.EXPECTED_COUNT && expectedCount) turnout = ((votesCast / expectedCount) * 100).toFixed(1);

        const isLive = status !== ELECTION_STATUS.DRAFT;

        let metricCardsHTML = "";
        if (trackingMode === TRACKING_MODE.IMPORTED_LIST || trackingMode === TRACKING_MODE.EXPECTED_COUNT) {
            metricCardsHTML = `
                ${UI.StatCard("Votes Cast", votesCast, "", "🗳️")}
                ${UI.StatCard("Participation", turnout + "%", "", "📊")}
                ${UI.StatCard("Remaining Students", pendingVotes, "", "⏳")}
            `;
        } else {
            // Rules only without expected count - just show votes cast. No "Tracking Unavailable" card.
            metricCardsHTML = `
                ${UI.StatCard("Votes Cast", votesCast, "", "🗳️")}
            `;
        }

        let voterTableHTML = "";
        const votedEmails = new Set((state.voterTracking || []).map((entry) => String(entry.email || "").toLowerCase()));

        let displayList = [];
        if (trackingMode === TRACKING_MODE.IMPORTED_LIST) {
            displayList = [...state.eligibleStudents];
        } else {
            displayList = Array.from(votedEmails).map(email => ({ email }));
        }

        const renderVoterCard = (s, index) => {
            const email = typeof s === 'string' ? s : s.email;
            const hasVoted = votedEmails.has(String(email || "").toLowerCase());
            const initial = (email || '?').charAt(0).toUpperCase();
            return `
            <div class="voter-card" data-status="${hasVoted ? 'voted' : 'pending'}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:var(--r-md); background:rgba(255,255,255,0.03); border:1px solid var(--border); transition:var(--t-fast);">
                <div style="width:36px; height:36px; border-radius:50%; background:var(--bg-surface-2); display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--text-2); font-size:0.9rem;">${initial}</div>
                <div style="flex:1; min-width:0;">
                    <div class="voter-email" style="font-weight:600; font-size:0.9rem; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(email)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">#${index + 1}</div>
                </div>
                <div class="voter-status">
                    ${UI.Badge(hasVoted ? "✅ Voted" : "⏳ Pending", hasVoted ? "success" : "default")}
                </div>
            </div>
            `;
        };

        voterTableHTML = `
            <div class="ui-card" style="margin-top:24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap; gap:10px; margin-bottom: 16px;">
                    <div>
                        <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0; font-family:var(--font-display);">Voter Participation</h3>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center; width:100%; flex-wrap:wrap;">
                        <select id="voter-filter" style="padding:10px 14px; border-radius:var(--r-sm); border:1px solid var(--border); background:rgba(0,0,0,0.2); color:var(--text); font-size:0.9rem; flex:1;">
                            <option value="all">All</option>
                            <option value="voted">Voted</option>
                            <option value="pending">Remaining</option>
                        </select>
                        <input type="text" id="voter-search" placeholder="Search emails..." style="padding:10px 14px; border-radius:var(--r-sm); border:1px solid var(--border); background:rgba(0,0,0,0.2); color:var(--text); font-size:0.9rem; flex:2; min-width:180px;">
                    </div>
                </div>
                <div class="voter-grid" style="display:grid; gap:10px; max-height:400px; overflow-y:auto; padding-right:4px;">
                    ${displayList.length > 0 ? displayList.map((s, i) => renderVoterCard(s, i)).join('') : '<div class="ui-empty-state">No data available.</div>'}
                </div>
            </div>
        `;

        let controlsHTML = `
            <div class="ui-card" style="margin-bottom: 20px;">
                <h3 class="ui-card-title" style="margin-bottom:10px;">Election Controls</h3>
                <div style="display: flex; gap: 8px; flex-wrap:wrap;">
                    <button class="btn btn-primary" type="button" data-modal="go-live" ${isLive ? 'disabled' : ''}>Go Live</button>
                    <button class="btn btn-ghost" type="button" data-modal="close-election" ${status !== ELECTION_STATUS.LIVE && status !== ELECTION_STATUS.FINAL_ROUND ? 'disabled' : ''}>Stop Election</button>
                    <button class="btn btn-ghost" type="button" data-modal="declare-results" ${settings.results_published ? 'disabled' : ''}>Publish Results</button>
                    <button class="btn btn-ghost" type="button" id="btn-send-reminders" style="border-color:#ff9f0a; color:#ff9f0a;" ${!isLive ? 'disabled' : ''}>Send Reminders ⏰</button>
                </div>
            </div>
        `;

        let liveResultsHTML = '';
        const grouped = {};

        if (isLive && state.candidates && state.candidates.length > 0) {
            state.candidates.forEach(c => {
                if (!grouped[c.position]) grouped[c.position] = { total: 0, cands: [] };
                grouped[c.position].cands.push({
                    candidate_name: c.name,
                    candidate_roll: c.roll_number || '',
                    vote_count: 0
                });
            });

            if (this.liveResults && this.liveResults.length > 0) {
                this.liveResults.forEach(r => {
                    if (grouped[r.position_name]) {
                        const cand = grouped[r.position_name].cands.find(c => c.candidate_name === r.candidate_name);
                        if (cand) {
                            cand.vote_count = parseInt(r.vote_count);
                            grouped[r.position_name].total += cand.vote_count;
                        } else {
                            grouped[r.position_name].cands.push({
                                candidate_name: r.candidate_name,
                                candidate_roll: '',
                                vote_count: parseInt(r.vote_count)
                            });
                            grouped[r.position_name].total += parseInt(r.vote_count);
                        }
                    }
                });
            }

            // Build winner cards section when results are published
            let adminWinnerCardsHTML = '';
            if (settings.results_published) {
                const winnerCards = [];
                for (const [pos, data] of Object.entries(grouped)) {
                    data.cands.sort((a, b) => b.vote_count - a.vote_count);
                    if (data.cands.length > 0 && data.cands[0].vote_count > 0) {
                        const w = data.cands[0];
                        const pct = data.total > 0 ? ((w.vote_count / data.total) * 100).toFixed(1) : '0.0';
                        const initial = (w.candidate_name || '?').charAt(0).toUpperCase();
                        winnerCards.push(`
                            <article class="winner-card">
                                <span class="winner-trophy">🏆</span>
                                <span class="winner-position-label">Official Winner — ${escapeHTML(pos)}</span>
                                <div class="winner-avatar">${initial}</div>
                                <h2 class="winner-name">${escapeHTML(w.candidate_name)}</h2>
                                <p class="winner-announcement">Congratulations to <strong>${escapeHTML(w.candidate_name)}</strong> for winning <strong>${escapeHTML(pos)}</strong>.</p>
                                <p class="winner-roll">Roll No. ${escapeHTML(w.candidate_roll || '—')}</p>
                                <div class="winner-stats">
                                    <div class="winner-stat">
                                        <span>Votes Received</span>
                                        <strong>${w.vote_count} votes</strong>
                                    </div>
                                    <div class="winner-stat highlight">
                                        <span>Winning Share</span>
                                        <strong>${pct}%</strong>
                                    </div>
                                </div>
                            </article>`);
                    }
                }
                if (winnerCards.length > 0) {
                    adminWinnerCardsHTML = `<div class="winners-section" style="margin-bottom:24px;">${winnerCards.join('')}</div>`;
                }
            }

            liveResultsHTML = `
                <div class="admin-live-voting-card">
                    <h3 class="admin-live-title"><span class="live-dot"></span> LIVE VOTING</h3>
                    ${adminWinnerCardsHTML}
            `;

            for (const [pos, data] of Object.entries(grouped)) {
                liveResultsHTML += `<h4 class="admin-live-position">${escapeHTML(pos)}</h4>`;

                data.cands.sort((a, b) => b.vote_count - a.vote_count);

                let highestVotes = -1;
                if (settings.results_published && data.cands.length > 0 && data.cands[0].vote_count > 0) {
                    highestVotes = data.cands[0].vote_count;
                }

                data.cands.forEach(c => {
                    const isWinner = settings.results_published && c.vote_count === highestVotes && highestVotes > 0;
                    const pct = data.total > 0 ? ((c.vote_count / data.total) * 100).toFixed(1) : 0;

                    liveResultsHTML += `
                        <div class="admin-live-candidate ${isWinner ? 'is-winner' : ''}">
                            <div class="admin-live-candidate-header">
                                <span class="admin-live-candidate-name">${escapeHTML(c.candidate_name)} ${isWinner ? '<span class="admin-winner-badge">🏆 WINNER</span>' : ''}</span>
                                <span class="admin-live-candidate-votes ${isWinner ? 'gold' : ''}">
                                    <span>${c.vote_count} <small>votes</small></span>
                                    <span class="admin-live-candidate-pct">${pct}%</span>
                                </span>
                            </div>
                            <div class="ui-progress-container" style="height:10px; background:rgba(0,0,0,0.2); border-radius:var(--r-full); overflow:hidden;">
                                <div class="ui-progress-bar ${isWinner ? 'gold-bar' : ''}" style="height:100%; border-radius:var(--r-full); width: ${pct}%; transition: width 0.8s ease-out;"></div>
                            </div>
                        </div>
                    `;
                });
            }
            liveResultsHTML += `</div>`;
        } else {
            liveResultsHTML = `
                <div class="admin-live-voting-card" style="margin-bottom:20px;">
                    <h3 class="admin-live-title" style="margin-bottom:12px;">LIVE VOTING</h3>
                    <div class="ui-empty-state" style="border: 2px dashed var(--border); padding: 40px 16px; border-radius: var(--r-md);">
                        <div style="font-size: 2rem; margin-bottom: 8px;">📊</div>
                        <div style="font-size: 0.95rem; font-weight: 600; color: var(--text);">${!isLive ? "No votes have been cast yet." : "No candidates configured."}</div>
                        <div style="font-size: 0.84rem; color: var(--text-2); margin-top: 4px;">${!isLive ? "Live voting will appear once the election goes live." : "Please add candidates in Candidate Setup to view live voting."}</div>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            ${liveResultsHTML}
            ${controlsHTML}
            
            <h3 style="font-size:1.05rem; font-weight:700; margin: 20px 0 12px;">Participation</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
                ${metricCardsHTML}
            </div>
            
            ${voterTableHTML}
        `;

        const btnSendReminders = document.getElementById("btn-send-reminders");
        if (btnSendReminders) {
            btnSendReminders.addEventListener('click', async () => {
                if (!confirm("This will send an urgent closing warning email to all students who have not yet voted, and a pending list to your email. Proceed?")) return;
                
                const origText = btnSendReminders.textContent;
                btnSendReminders.textContent = "Sending...";
                btnSendReminders.disabled = true;
                
                try {
                    const { error } = await supabaseClient.rpc('send_closing_reminders');
                    if (error) throw error;
                    alert("Reminders have been securely queued for sending!");
                } catch (e) {
                    console.error(e);
                    alert("Failed to send reminders: " + e.message);
                } finally {
                    btnSendReminders.textContent = origText;
                    btnSendReminders.disabled = false;
                }
            });
        }
    },

    filterTable() {
        const searchInput = document.getElementById('voter-search');
        const filterInput = document.getElementById('voter-filter');

        const query = (searchInput ? searchInput.value.toLowerCase() : "");
        const statusFilter = (filterInput ? filterInput.value : "all");

        const rows = document.querySelectorAll('[data-panel-view="overview"] .voter-card');
        rows.forEach(row => {
            const emailCell = row.querySelector('.voter-email');
            if (!emailCell) return;

            const emailText = emailCell.textContent.toLowerCase();
            const rowStatus = row.dataset.status || "voted";

            const matchesSearch = emailText.includes(query);
            const matchesFilter = statusFilter === "all" || rowStatus === statusFilter;

            if (matchesSearch && matchesFilter) {
                row.style.display = 'flex';
            } else {
                row.style.display = 'none';
            }
        });
    },

    async refresh() {
        if (this.refreshInProgress) return;
        this.refreshInProgress = true;
        logDebug("AdminDashboard refresh");
        try {
            await this.load();
            this.render();
        } catch (error) {
            console.error("Could not refresh live dashboard", error);
        } finally {
            this.refreshInProgress = false;
        }
    }
};

window.AdminDashboard = AdminDashboard;
