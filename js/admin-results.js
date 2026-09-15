/* ==========================================================
   IPE Voting System
   admin-results.js
========================================================== */

const AdminResults = {
    init() {
        logDebug("AdminResults init");
    },

    async load() {
        logDebug("AdminResults load");
        await window.ElectionState.refreshVotes();
        await window.ElectionState.refreshCandidates();
        await window.ElectionState.refreshSettings();
    },

    render() {
        logDebug("AdminResults render");
        const container = document.querySelector('[data-panel-view="results"]');
        if (!container) return;

        const state = window.ElectionState;
        const settings = state.settings || {};
        const status = settings.election_status || ELECTION_STATUS.DRAFT;

        const renderRows = (position) => {
            if (status !== ELECTION_STATUS.CLOSED && status !== ELECTION_STATUS.FINAL_ROUND && status !== ELECTION_STATUS.COMPLETED) {
                return UI.EmptyState("Results are hidden until the election is closed and results are declared.");
            }
            const hasFinalVsRound = state.votes.some(v => v.round_number === 2);
            const activeVotes = state.votes.filter(v => hasFinalVsRound ? v.round_number === 2 : (v.round_number === 1 || !v.round_number));
            const res = calculatePositionResults(position, state.candidates, activeVotes);
            if (!res.results.length) return UI.EmptyState("No votes recorded.");
            
            return res.results.map((r, idx) => `
                <div style="display:grid; grid-template-columns:1fr auto; align-items:center; gap:10px; margin:12px 0;">
                    <span>${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} ${escapeHTML(r.name)}</span>
                    <strong style="text-align:right; font-size:0.9rem;">${r.count} ${res.isRanked ? 'pts' : 'votes'}</strong>
                </div>
            `).join("");
        };

        const showFinalVsBanner = settings.voting_method === VOTING_METHOD.RANKED_FINAL_VS && 
                                  settings.results_published && 
                                  (status === ELECTION_STATUS.CLOSED || status === ELECTION_STATUS.COMPLETED) && 
                                  !state.votes.some(v => v.round_number === 2);

        let finalVsBannerHTML = "";
        if (showFinalVsBanner) {
            finalVsBannerHTML = `
                <div class="ui-card" style="margin-bottom:24px; border-color:var(--primary); background:rgba(59,126,248,0.08);">
                    <h3 style="font-size:1.1rem; font-weight:700; color:var(--text); margin-bottom:6px;">⚔️ FINAL VS ELECTION AVAILABLE</h3>
                    <p style="font-size:0.88rem; color:var(--text-2); margin-bottom:14px;">Round 1 results have been declared. You can now launch Round 2 (Final VS Election) between the top 2 candidates per position.</p>
                    
                    <div style="margin-bottom:16px; padding:14px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-sm);">
                        <h4 style="font-size:0.85rem; font-weight:700; margin-bottom:8px; color:var(--text);">Top Advancing Candidates (Round 1 Standings):</h4>
                        ${getTop2AdvancingCandidatesHTML(state.candidates, state.votes)}
                    </div>
                    <button class="btn btn-primary" type="button" data-modal="start-final">Start Final VS Election (Round 2)</button>
                </div>
            `;
        }

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px;">
                <div>
                    <h2 style="font-size: 1.2rem; font-weight: 700;">Results &amp; Declaration</h2>
                    <p style="color:var(--text-2); font-size:0.87rem; margin-top:4px;">Publish election results publicly for students.</p>
                </div>
                <button type="button" class="btn btn-primary" data-modal="declare-results" ${status !== ELECTION_STATUS.CLOSED && status !== ELECTION_STATUS.COMPLETED ? 'disabled' : ''}>
                    Declare ${status === ELECTION_STATUS.FINAL_ROUND || (status === ELECTION_STATUS.CLOSED && state.votes.some(v => v.round_number === 2)) ? 'Final Results' : 'Round 1 Results'}
                </button>
            </div>
            ${finalVsBannerHTML}
            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
                ${UI.Card("Male CR", renderRows(POSITION.MALE))}
                ${UI.Card("Female CR", renderRows(POSITION.FEMALE))}
            </div>
        `;
    },

    async refresh() {
        logDebug("AdminResults refresh");
        await this.load();
        this.render();
    }
};

window.AdminResults = AdminResults;
