function isMaleCandidate(candidate) {
    const position = String(candidate.position || "").toLowerCase().replace(/[^a-z]/g, "");
    return position === "male" || position === "malecr";
}

function isFemaleCandidate(candidate) {
    const position = String(candidate.position || "").toLowerCase().replace(/[^a-z]/g, "");
    return position === "female" || position === "femalecr";
}

function candidateCard(candidate, category, type = "radio") {
    if (type === "drag") {
        return `
            <div class="candidate-card drag-card" draggable="true" data-id="${candidate.id}">
                <div class="drag-handle" aria-hidden="true">⣿</div>
                <span class="candidate-details">
                    <strong>${escapeHTML(candidate.name)}</strong>
                    <small>Roll No. ${escapeHTML(candidate.roll_number)}</small>
                </span>
                <div class="rank-badge"></div>
            </div>`;
    }
    
    return `
        <label class="candidate-card" for="${category}-${candidate.id}">
            <input id="${category}-${candidate.id}" type="radio" name="${category}_candidate" value="${candidate.id}">
            <span class="candidate-radio" aria-hidden="true"></span>
            <span class="candidate-details">
                <strong>${escapeHTML(candidate.name)}</strong>
                <small>Roll No. ${escapeHTML(candidate.roll_number)}</small>
            </span>
        </label>`;
}

function writeInField(category, digits) {
    const title = category === "male" ? "Male CR" : "Female CR";
    return `
        <div class="write-in">
            <label for="${category}-write-in">Write-in Roll Number <span>(${digits} digits)</span></label>
            <input id="${category}-write-in" class="write-in-input" type="text" inputmode="numeric" maxlength="${digits}" autocomplete="off" placeholder="Enter ${title} roll number">
        </div>`;
}

function renderElectionState(title, message, email, type = 'lock') {
    const icon = type === 'lock' ? '🔒' : type === 'check' ? '✅' : '⌛';
    render(`
        <main class="success-page">
            <section class="state-card">
                <div class="state-icon" aria-hidden="true">${icon}</div>
                <h2>${escapeHTML(title)}</h2>
                <p>${escapeHTML(message)}</p>
                <small>Signed in as ${escapeHTML(email)}</small>
                <button id="logout-btn" class="logout-button" type="button" style="width:100%; margin-top:4px;">Log out</button>
            </section>
        </main>`);
    document.getElementById("logout-btn").addEventListener("click", logout);
}

function renderElectionNotStarted(email, settings) {
    const startDate = settings.voting_start_date ? new Date(settings.voting_start_date) : null;
    const startStr  = startDate
        ? startDate.toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "Admin will announce when voting begins.";

    render(`
        <main class="success-page">
            <section class="state-card">
                <div class="state-icon" aria-hidden="true">🔒</div>
                <h2>Voting Has Not Started</h2>
                ${startDate ? `
                <p>Election opens on:<br><strong>${escapeHTML(startStr)}</strong></p>
                <div class="countdown-timer" id="countdown-timer">
                    <div class="countdown-unit"><strong id="cd-h">--</strong><span>Hours</span></div>
                    <div class="countdown-unit"><strong id="cd-m">--</strong><span>Minutes</span></div>
                    <div class="countdown-unit"><strong id="cd-s">--</strong><span>Seconds</span></div>
                </div>` : `<p>${escapeHTML(startStr)}</p>`}
                <small>Signed in as ${escapeHTML(email)}</small>
                <button id="logout-btn" class="logout-button" type="button" style="width:100%; margin-top:8px;">Log out</button>
            </section>
        </main>`);

    document.getElementById("logout-btn").addEventListener("click", logout);

    if (startDate) {
        const tick = () => {
            const diff = startDate - new Date();
            if (diff <= 0) { clearInterval(timer); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            const hEl = document.getElementById("cd-h");
            const mEl = document.getElementById("cd-m");
            const sEl = document.getElementById("cd-s");
            if (hEl) hEl.textContent = String(h).padStart(2, "0");
            if (mEl) mEl.textContent = String(m).padStart(2, "0");
            if (sEl) sEl.textContent = String(s).padStart(2, "0");
        };
        tick();
        const timer = setInterval(tick, 1000);
    }
}

function renderVotingDashboard(email, settings, candidates) {
    const maleCandidates = candidates.filter(isMaleCandidate);
    const femaleCandidates = candidates.filter(isFemaleCandidate);
    
    // In final_round, we don't allow write-ins or ranking (it's a run-off)
    const isFinalRound = settings.election_status === "final_round";
    
    const writeInEnabled = !isFinalRound && settings.allow_write_in_vote === true;
    const writeInDigits = Number(settings.write_in_roll_digits);
    const isRanked = !isFinalRound && isRankedVotingMethod(settings.voting_method) && settings.ranked_voting_enabled === true;

    const positions = settings.election_positions || "male_female";
    // A section is shown only if:
    // 1. The positions setting includes it, AND
    // 2. Either there are actual candidates OR write-in is enabled for that slot.
    // This prevents showing an empty Female CR section when no female candidates exist.
    const allowMale   = positions !== "female_only";
    const allowFemale = positions !== "male_only";
    const showMale   = allowMale   && (maleCandidates.length > 0   || writeInEnabled);
    const showFemale = allowFemale && (femaleCandidates.length > 0 || writeInEnabled);

    // Build the email display — shows initial avatar + full email on one line
    const emailInitial = escapeHTML((email || '').charAt(0).toUpperCase());
    const emailDisplay = escapeHTML(email || '');

    let sectionIndex = 0;

    render(`
        <main class="election-shell">
            <header class="election-header">
                <div class="election-header-text">
                    <p class="eyebrow">IPE CR Election ${isFinalRound ? "— FINAL ROUND" : ""}</p>
                    <h1>Cast Your Vote</h1>
                    <div class="voter-badge">
                        <span class="voter-avatar">${emailInitial}</span>
                        <span class="voter-email">${emailDisplay}</span>
                    </div>
                </div>
                <button id="logout-btn" class="logout-button" type="button">Log out</button>
            </header>

            <form id="vote-form" class="vote-form" novalidate>
                ${isRanked ? `<div class="rank-instruction">
                    <p><strong>Ranked Choice Voting:</strong> Drag and drop the candidates to rank them in your order of preference.</p>
                </div>` : ''}
                
                ${showMale ? `
                <section class="vote-section">
                    <div class="section-heading">
                        <span class="section-num">${++sectionIndex}</span>
                        <div><h2>Male CR</h2><p>${isRanked ? "Drag to rank (top = 1st choice)." : "Select one candidate."}</p></div>
                    </div>
                    <div class="candidate-grid ${isRanked ? 'drag-container' : ''}" id="male-container">
                        ${maleCandidates.map((c) => candidateCard(c, "male", isRanked ? "drag" : "radio")).join("")}
                    </div>
                    ${writeInEnabled ? writeInField("male", writeInDigits) : ""}
                </section>` : ''}

                ${showFemale ? `
                <section class="vote-section">
                    <div class="section-heading">
                        <span class="section-num">${++sectionIndex}</span>
                        <div><h2>Female CR</h2><p>${isRanked ? "Drag to rank (top = 1st choice)." : "Select one candidate."}</p></div>
                    </div>
                    <div class="candidate-grid ${isRanked ? 'drag-container' : ''}" id="female-container">
                        ${femaleCandidates.map((c) => candidateCard(c, "female", isRanked ? "drag" : "radio")).join("")}
                    </div>
                    ${writeInEnabled ? writeInField("female", writeInDigits) : ""}
                </section>` : ''}

                <p id="vote-error" class="vote-error" role="alert" aria-live="polite"></p>
                <button id="review-vote" class="submit-vote" type="submit">Review &amp; Submit Vote</button>
            </form>
        </main>
        <div id="confirmation-modal" class="modal" hidden aria-hidden="true">
            <div class="modal-backdrop"></div>
            <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
                <div class="modal-icon" aria-hidden="true">🗳</div>
                <h2 id="confirmation-title">Confirm Your Vote</h2>
                <p class="modal-intro">Please review your selections carefully.</p>
                <div id="vote-review" class="vote-review"></div>
                <p class="vote-warning">⚠️ Once submitted, your vote cannot be changed.</p>
                <div class="modal-actions">
                    <button id="cancel-vote" class="secondary-button" type="button">Cancel</button>
                    <button id="confirm-vote" class="submit-vote" type="button">Confirm Vote</button>
                </div>
            </section>
        </div>`);

    document.getElementById("logout-btn").addEventListener("click", logout);
    
    if (isRanked) {
        if (showMale)   initDragAndDrop("male-container");
        if (showFemale) initDragAndDrop("female-container");
    } else {
        const categoriesToBind = [];
        if (showMale)   categoriesToBind.push("male");
        if (showFemale) categoriesToBind.push("female");
        categoriesToBind.forEach((category) => {
            const input = document.getElementById(`${category}-write-in`);
            if (!input) return;
            input.addEventListener("input", () => {
                if (input.value.trim()) {
                    document.querySelectorAll(`input[name="${category}_candidate"]`).forEach((r) => r.checked = false);
                }
            });
            document.querySelectorAll(`input[name="${category}_candidate"]`).forEach((r) => r.addEventListener("change", () => input.value = ""));
        });
    }

    document.getElementById("vote-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const vote = getVoteFromForm(email, writeInEnabled, writeInDigits, settings, isRanked);
        // Override election_positions based on what sections are ACTUALLY visible
        // so validation never requires a section that wasn't shown
        if (!showMale)   vote.election_positions = "female_only";
        if (!showFemale) vote.election_positions = "male_only";
        const error = validateStudentVote(vote, writeInEnabled, writeInDigits, isRanked);
        if (error) return showVoteError(error);
        showVoteError("");
        openConfirmation(vote, candidates, isRanked);
    });
}

function initDragAndDrop(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let draggingEle;
    let placeholder;
    let isDragging = false;

    const updateRanks = () => {
        const cards = container.querySelectorAll('.drag-card');
        cards.forEach((card, index) => {
            const badge = card.querySelector('.rank-badge');
            if(badge) {
                if(index === 0) badge.textContent = "🥇 1st";
                else if(index === 1) badge.textContent = "🥈 2nd";
                else if(index === 2) badge.textContent = "🥉 3rd";
                else badge.textContent = `${index + 1}th`;
            }
        });
    };
    
    updateRanks();

    // Touch support for mobile drag and drop
    container.addEventListener('touchstart', (e) => {
        const target = e.target.closest('.drag-card');
        if (!target) return;
        
        const handle = e.target.closest('.drag-handle');
        if (!handle) return; // Only drag by handle on touch devices to avoid scrolling issues
        
        isDragging = true;
        draggingEle = target;
        
        const rect = draggingEle.getBoundingClientRect();
        
        placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = `${rect.height}px`;
        
        draggingEle.classList.add('is-dragging');
        draggingEle.style.width = `${rect.width}px`;
        
        draggingEle.parentNode.insertBefore(placeholder, draggingEle);
        
        document.body.style.overflow = 'hidden'; // Prevent scroll
    }, {passive: false});

    document.addEventListener('touchmove', (e) => {
        if (!isDragging || !draggingEle) return;
        e.preventDefault(); // Stop scrolling
        
        const touch = e.touches[0];
        
        draggingEle.style.position = 'fixed';
        draggingEle.style.top = `${touch.clientY - 20}px`;
        draggingEle.style.left = `${touch.clientX - 20}px`;
        draggingEle.style.zIndex = '9999';
        
        const elementsUnder = document.elementsFromPoint(touch.clientX, touch.clientY);
        const droppable = elementsUnder.find(el => el.classList.contains('drag-card') && el !== draggingEle);
        
        if (droppable) {
            const rect = droppable.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (touch.clientY < midpoint) {
                droppable.parentNode.insertBefore(placeholder, droppable);
            } else {
                droppable.parentNode.insertBefore(placeholder, droppable.nextSibling);
            }
        }
    }, {passive: false});

    document.addEventListener('touchend', (e) => {
        if (!isDragging || !draggingEle) return;
        isDragging = false;
        
        draggingEle.style.position = '';
        draggingEle.style.top = '';
        draggingEle.style.left = '';
        draggingEle.style.width = '';
        draggingEle.style.zIndex = '';
        draggingEle.classList.remove('is-dragging');
        
        if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.insertBefore(draggingEle, placeholder);
            placeholder.parentNode.removeChild(placeholder);
        }
        
        document.body.style.overflow = '';
        updateRanks();
        draggingEle = null;
        placeholder = null;
    });

    // Desktop Drag and Drop
    container.addEventListener('dragstart', (e) => {
        const target = e.target.closest('.drag-card');
        if (!target) return;
        draggingEle = target;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
        setTimeout(() => target.classList.add('is-dragging'), 0);
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const target = e.target.closest('.drag-card');
        if (target && target !== draggingEle) {
            const rect = target.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (e.clientY < midpoint) {
                container.insertBefore(draggingEle, target);
            } else {
                container.insertBefore(draggingEle, target.nextSibling);
            }
        }
    });

    container.addEventListener('dragend', (e) => {
        if (draggingEle) {
            draggingEle.classList.remove('is-dragging');
            updateRanks();
        }
        draggingEle = null;
    });
}

function getVoteFromForm(email, writeInEnabled, writeInDigits, settings, isRanked) {
    const isFinalRound = settings.election_status === "final_round";
    const roundNumber = isFinalRound ? 2 : 1;

    let maleId = null;
    let femaleId = null;
    let maleWriteIn = writeInEnabled ? document.getElementById("male-write-in")?.value.trim() : null;
    let femaleWriteIn = writeInEnabled ? document.getElementById("female-write-in")?.value.trim() : null;
    let rankings = null;

    if (isRanked) {
        rankings = { male: {}, female: {} };
        const maleCards = document.querySelectorAll("#male-container .drag-card");
        maleCards.forEach((card, i) => rankings.male[card.dataset.id] = i + 1);

        const femaleCards = document.querySelectorAll("#female-container .drag-card");
        femaleCards.forEach((card, i) => rankings.female[card.dataset.id] = i + 1);
    } else {
        maleId = document.querySelector(`input[name="male_candidate"]:checked`)?.value || null;
        femaleId = document.querySelector(`input[name="female_candidate"]:checked`)?.value || null;
    }

    return {
        student_email: email,
        male_candidate_id: maleId,
        female_candidate_id: femaleId,
        male_write_in_roll: maleWriteIn || null,
        female_write_in_roll: femaleWriteIn || null,
        voted_at: new Date().toISOString(),
        writeInDigits,
        ranking_data: rankings,
        voting_method: settings.voting_method || VOTING_METHOD.SINGLE,
        election_positions: settings.election_positions || ELECTION_POSITIONS.MALE_FEMALE,
        round_number: roundNumber
    };
}

function validateStudentVote(vote, writeInEnabled, writeInDigits, isRanked) {
    if (!isRanked) {
        if (!vote.male_candidate_id && !vote.male_write_in_roll && vote.election_positions !== "female_only") return "Please select or enter a Male CR candidate.";
        if (!vote.female_candidate_id && !vote.female_write_in_roll && vote.election_positions !== "male_only") return "Please select or enter a Female CR candidate.";
        if (vote.male_candidate_id && vote.male_write_in_roll) return "Choose either a Male CR candidate or a write-in roll number.";
        if (vote.female_candidate_id && vote.female_write_in_roll) return "Choose either a Female CR candidate or a write-in roll number.";
        if (writeInEnabled && vote.male_write_in_roll && !isValidWriteInRoll(vote.male_write_in_roll, writeInDigits)) return `Male write-in roll number must contain exactly ${writeInDigits} digits.`;
        if (writeInEnabled && vote.female_write_in_roll && !isValidWriteInRoll(vote.female_write_in_roll, writeInDigits)) return `Female write-in roll number must contain exactly ${writeInDigits} digits.`;
    }
    return "";
}

function showVoteError(message) {
    const error = document.getElementById("vote-error");
    if (error) error.textContent = message;
}

function reviewSelection(title, candidateId, writeInRoll, candidates, rankings, categoryKey) {
    if (rankings && rankings[categoryKey] && Object.keys(rankings[categoryKey]).length > 0) {
        // Build Ranked review list
        const rankArr = Object.entries(rankings[categoryKey]).sort((a,b) => a[1] - b[1]);
        const items = rankArr.map(([cId, rank]) => {
            const cand = candidates.find(c => c.id === cId);
            return `<div style="margin-left:10px;">${rank}. ${escapeHTML(cand?.name || "Candidate")}</div>`;
        }).join("");
        
        return `
            <section class="review-selection">
                <p class="review-category">${escapeHTML(title)} (Ranked)</p>
                ${items}
            </section>`;
    }

    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate && !writeInRoll) return "";
    
    const name = writeInRoll ? "Write-in Candidate" : candidate?.name || "Selected Candidate";
    const rollNumber = writeInRoll || candidate?.roll_number || "—";
    
    return `
        <section class="review-selection">
            <p class="review-category">${escapeHTML(title)}</p>
            <strong>${escapeHTML(name)}</strong>
            <span>Roll No. ${escapeHTML(rollNumber)}</span>
        </section>`;
}

function openConfirmation(vote, candidates, isRanked) {
    const modal = document.getElementById("confirmation-modal");
    
    let html = "";
    if (vote.election_positions !== "female_only") {
        html += reviewSelection("Male CR", vote.male_candidate_id, vote.male_write_in_roll, candidates, vote.ranking_data, "male");
    }
    if (vote.election_positions !== "male_only") {
        html += reviewSelection("Female CR", vote.female_candidate_id, vote.female_write_in_roll, candidates, vote.ranking_data, "female");
    }

    document.getElementById("vote-review").innerHTML = html;
    
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("cancel-vote").onclick = () => { modal.hidden = true; modal.setAttribute("aria-hidden", "true"); };
    document.getElementById("confirm-vote").onclick = () => submitStudentVote(vote);
}

async function submitStudentVote(vote) {
    const button = document.getElementById("confirm-vote");
    setButtonLoading(button, true);
    try {
        const { writeInDigits, student_email, ...voteToSave } = vote;
        
        // Use atomic RPC to guarantee consistency and anonymity
        const { error } = await supabaseClient.rpc("submit_vote", { vote_payload: voteToSave });
        if (error) {
            if (error.message.includes("ALREADY_VOTED")) {
                document.getElementById("confirmation-modal").hidden = true;
                renderAlreadyVoted();
                return;
            }
            throw error;
        }

        await supabaseClient.from("vote_activity_log").insert({ actor: "anonymous_voter", event_type: "VOTE_CAST" });

        renderVoteSuccess();
    } catch (error) {
        console.error("Vote submission error:", error);
        showVoteError("An unexpected error occurred while securely recording your vote. Please try again or contact administration.");
        document.getElementById("confirmation-modal").hidden = true;
    } finally {
        setButtonLoading(button, false);
    }
}

async function hasAlreadyVoted(email, roundNumber) {
    try {
        const { data, error } = await supabaseClient.from("voter_tracking").select("id").eq("email", email).eq("round_number", roundNumber || 1).maybeSingle();
        return !!data;
    } catch (error) {
        console.error("Error checking vote status:", error);
        return false;
    }
}

function renderAlreadyVoted(showResultsOption = false) {
    render(`
        <main class="success-page">
            <section class="success-card">
                <div class="success-tick" aria-hidden="true">✓</div>
                <h1>Vote Already Recorded</h1>
                <p>Your vote for this round has already been securely recorded. Your ballot is anonymous and tamper-proof.</p>
                ${showResultsOption ? `<button id="view-results-btn" class="submit-vote" type="button" style="width:100%; margin-bottom:12px;">View Election Results</button>` : ''}
                <button id="logout-btn" class="logout-button" type="button" style="width:100%;">Log out</button>
            </section>
        </main>`);
    document.getElementById("logout-btn").addEventListener("click", logout);
    const viewBtn = document.getElementById("view-results-btn");
    if (viewBtn) viewBtn.addEventListener("click", () => loadAndRenderResults());
}

function renderVoteSuccess() {
    const timestamp = new Date().toLocaleString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
    render(`
        <main class="success-page">
            <section class="success-card">
                <div class="success-tick" aria-hidden="true">✓</div>
                <h1>Vote Recorded Successfully</h1>
                <p>Your anonymous ballot has been securely submitted. Your identity cannot be linked to your vote.</p>
                <span class="vote-timestamp">📅 ${escapeHTML(timestamp)}</span>
                <small>You will be logged out automatically in 5 seconds.</small>
            </section>
        </main>`);
    window.setTimeout(async () => {
        try { await signOut(); } finally { window.location.replace("/"); }
    }, 5000);
}

async function renderStudentDashboard(email) {
    const settings = await getElectionSettings();
    
    if (!settings) throw new Error("Election settings are not available.");
    
    const status   = String(settings.election_status || "draft").toLowerCase();
    const roundNum = status === "final_round" ? 2 : 1;

    if (settings.results_published && status === "closed") {
        await loadAndRenderResults();
        return;
    }
    
    if (status === "draft") {
        // Use the richer state with countdown timer
        renderElectionNotStarted(email, settings);
        return;
    }
    
    if (status === "closed" || status === "completed") {
        renderElectionState("Voting Has Ended", "Results will be announced by the administrator soon.", email, 'check');
        return;
    }
    
    if (await hasAlreadyVoted(email, roundNum)) {
        renderAlreadyVoted(settings?.results_published === true);
        return;
    }

    if (status !== "live" && status !== "final_round") {
        renderElectionNotStarted(email, settings);
        return;
    }
    
    const candidates = await getActiveCandidates();
    renderVotingDashboard(email, settings, candidates);
}
