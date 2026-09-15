function getStoredAdminConfig() {
    try {
        const parsed = JSON.parse(localStorage.getItem("ipe-election-config") || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function saveStoredAdminConfig(values) {
    const next = { ...getStoredAdminConfig(), ...values };
    localStorage.setItem("ipe-election-config", JSON.stringify(next));
    return next;
}

function isSchemaCompatibilityError(error) {
    const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(" ").toLowerCase();
    return Boolean(error) && (error?.status === 404 || error?.code === "42P01" || error?.code === "42703" || /does not exist|does not have a column|column.*does not exist|relation .* does not exist|not found/i.test(message));
}

function getStoredEligibleStudents() {
    try {
        const parsed = JSON.parse(localStorage.getItem("ipe-eligible-students") || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveStoredEligibleStudents(students) {
    localStorage.setItem("ipe-eligible-students", JSON.stringify(students));
}

function getVotingMethodLabel(method) {
    const value = String(method || "single_choice").toLowerCase();
    if (value === "ranked_choice" || value === "ranked") return "Ranked Choice Voting";
    if (value === "ranked_final_vs" || value === "ranked_choice_final_vs") return "Ranked Choice + Final VS Round";
    return "Single Choice";
}

function getElectionPositionLabel(positions) {
    if (positions === "male_only") return "Male Candidate";
    if (positions === "female_only") return "Female Candidate";
    if (positions === "male_female") return "Male Candidate + Female Candidate";
    return "Male Candidate + Female Candidate";
}

function isRankedVotingMethod(method) {
    const value = String(method || "single_choice").toLowerCase();
    return value === "ranked_choice" || value === "ranked" || value === "ranked_final_vs" || value === "ranked_choice_final_vs";
}

function parseEligibleStudentInput(raw) {
    const emails = [];
    const invalid = [];
    const seen = new Set();

    String(raw || "")
        .split(/\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => {
            const email = normalizeEmail(entry);
            if (!isValidEmail(email)) {
                invalid.push(entry);
                return;
            }
            if (!seen.has(email)) {
                seen.add(email);
                emails.push(email);
            }
        });

    return { emails, invalid };
}

function buildRankedVoteSummary(rankings) {
    if (!rankings) return [];
    const entries = [];
    Object.entries(rankings).forEach(([position, values]) => {
        Object.entries(values || {}).forEach(([candidateId, rank]) => {
            if (rank) entries.push({ position, candidateId, rank: Number(rank) });
        });
    });
    return entries.sort((a, b) => a.rank - b.rank || a.position.localeCompare(b.position));
}
