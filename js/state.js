/* ==========================================================
   IPE Voting System
   state.js - Centralized State Manager
========================================================== */

window.DEBUG = true;

function logDebug(...args) {
    if (window.DEBUG) {
        console.log("[DEBUG]", ...args);
    }
}

class ElectionStateManager {
    constructor() {
        this.settings = null;
        this.currentAdmin = null;
        this.candidates = [];
        this.votes = [];
        this.activity = [];
        this.eligibleStudents = [];
        this.voterTracking = [];
        this.rules = [];
    }

    async loadAll() {
        logDebug("Loading all state data...");
        const [
            settings,
            candidates,
            votes,
            activity,
            rules,
            voterTracking,
            eligibleStudents
        ] = await Promise.all([
            SettingsAPI.get(),
            CandidatesAPI.getAll(),
            VotesAPI.getAll(),
            ActivityAPI.getAll(),
            RulesAPI.getAll(),
            VoterTrackingAPI.getAll().catch(() => []), // Might be restricted
            EligibleStudentsAPI.getAll()
        ]);

        this.settings = settings || {};
        this.candidates = candidates || [];
        this.votes = votes || [];
        this.activity = activity || [];
        this.rules = rules || [];
        this.voterTracking = voterTracking || [];
        this.eligibleStudents = eligibleStudents || [];
        logDebug("All state loaded.");
    }

    async refreshSettings() {
        logDebug("Refreshing settings...");
        this.settings = await SettingsAPI.get();
    }

    async refreshCandidates() {
        logDebug("Refreshing candidates...");
        this.candidates = await CandidatesAPI.getAll();
    }

    async refreshVotes() {
        logDebug("Refreshing votes...");
        this.votes = await VotesAPI.getAll();
    }

    async refreshActivity() {
        logDebug("Refreshing activity...");
        this.activity = await ActivityAPI.getAll();
    }

    async refreshRules() {
        logDebug("Refreshing rules...");
        this.rules = await RulesAPI.getAll();
    }

    async refreshEligibleStudents() {
        logDebug("Refreshing eligible students...");
        this.eligibleStudents = await EligibleStudentsAPI.getAll();
    }

    async refreshDashboard() {
        logDebug("Refreshing dashboard (settings, votes, activity, voter tracking)...");
        await Promise.all([
            this.refreshSettings(),
            this.refreshVotes(),
            this.refreshActivity(),
            this.refreshVoterTracking(),
            this.refreshEligibleStudents()
        ]);
    }

    async refreshVoterTracking() {
        logDebug("Refreshing voter tracking...");
        this.voterTracking = await VoterTrackingAPI.getAll().catch(() => []);
    }

    clearElectionData() {
        this.votes = [];
        this.activity = [];
        this.eligibleStudents = [];
        this.voterTracking = [];
        this.rules = [];
        this.candidates = [];
        this.settings = null;
        this.currentAdmin = null;
    }

    // --- Helper Methods ---

    isDraft() {
        return this.settings?.election_status === ELECTION_STATUS.DRAFT;
    }

    isLive() {
        return this.settings?.election_status === ELECTION_STATUS.LIVE;
    }

    isClosed() {
        return this.settings?.election_status === ELECTION_STATUS.CLOSED;
    }

    isFinalRound() {
        return this.settings?.election_status === ELECTION_STATUS.FINAL_ROUND;
    }

    isCompleted() {
        return this.settings?.election_status === ELECTION_STATUS.COMPLETED;
    }

    getVotingMethod() {
        return this.settings?.voting_method || VOTING_METHOD.SINGLE;
    }
}

window.ElectionState = new ElectionStateManager();
