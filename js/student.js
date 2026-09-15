function isMaleCandidate(candidate) {
    const position = String(candidate.position || "").toLowerCase().replace(/[^a-z]/g, "");
    return position === "male" || position === "malecr";
}

function isFemaleCandidate(candidate) {
    const position = String(candidate.position || "").toLowerCase().replace(/[^a-z]/g, "");
    return position === "female" || position === "femalecr";
}

function candidateCard(candidate, category, type = "radio", totalCandidates = 1) {
    const initial = escapeHTML((candidate.name || "?").charAt(0).toUpperCase());
    if (type === "drag") {
        return `
            <div class="candidate-card drag-card haptic-press" draggable="true" data-id="${candidate.id}">
                <div class="drag-handle" aria-hidden="true" title="Drag to reorder">⣿</div>
                <span class="candidate-mark" aria-hidden="true">${initial}</span>
                <span class="candidate-details">
                    <strong>${escapeHTML(candidate.name)}</strong>
                    ${candidate.roll_number ? `<small>Roll No. ${escapeHTML(candidate.roll_number)}</small>` : ''}
                </span>
                <select class="rank-select" aria-label="Rank for ${escapeHTML(candidate.name)}">
                    ${Array.from({ length: totalCandidates }, (_, i) => `<option value="${i + 1}">Rank ${i + 1}</option>`).join("")}
                </select>
                <div class="rank-badge"></div>
            </div>`;
    }

    return `
        <label class="candidate-card haptic-press" for="${category}-${candidate.id}">
            <input id="${category}-${candidate.id}" type="radio" name="${category}_candidate" value="${candidate.id}">
            <span class="candidate-radio" aria-hidden="true"></span>
            <span class="candidate-mark" aria-hidden="true">${initial}</span>
            <span class="candidate-details">
                <strong>${escapeHTML(candidate.name)}</strong>
                ${candidate.roll_number ? `<small>Roll No. ${escapeHTML(candidate.roll_number)}</small>` : ''}
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
    const icons = { lock: '&#128274;', check: '&#9989;', wait: '&#8987;' };
    const icon = icons[type] || icons.lock;
    render(`
        <main class="success-page">
            <section class="state-card">
                <div class="state-icon" aria-hidden="true">${icon}</div>
                <h2>${escapeHTML(title)}</h2>
                <p>${escapeHTML(message)}</p>
                <small>Signed in as ${escapeHTML(email)}</small>
                <button id="logout-btn" class="logout-button" type="button" style="width:100%; margin-top:12px;">Sign out</button>
            </section>
        </main>`);
    document.getElementById("logout-btn").addEventListener("click", logout);
}

function renderElectionNotStarted(email, settings) {
    const startDate = settings.voting_start_date ? new Date(settings.voting_start_date) : null;
    const startStr = startDate
        ? startDate.toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "Admin will announce when voting begins.";

    render(`
        <main class="success-page">
            <section class="state-card">
                <div class="state-icon" aria-hidden="true">&#128274;</div>
                <h2>Voting Hasn&rsquo;t Opened Yet</h2>
                ${startDate ? `
                <p>Election opens on:<br><strong>${escapeHTML(startStr)}</strong></p>
                <div class="countdown-timer" id="countdown-timer">
                    <div class="countdown-unit"><strong id="cd-h">--</strong><span>Hours</span></div>
                    <div class="countdown-unit"><strong id="cd-m">--</strong><span>Mins</span></div>
                    <div class="countdown-unit"><strong id="cd-s">--</strong><span>Secs</span></div>
                </div>` : `<p>${escapeHTML(startStr)}</p>`}
                <small>Signed in as ${escapeHTML(email)}</small>
                <button id="logout-btn" class="logout-button" type="button" style="width:100%; margin-top:12px;">Sign out</button>
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

function isRankedMode(settings) {
    if (!settings) return false;
    const status = String(settings.election_status || "").toLowerCase();
    if (status === "final_round") return false; // Final round is a run-off (single choice)
    const method = String(settings.voting_method || "").toLowerCase();
    return method.includes("ranked");
}

function renderVotingDashboard(email, settings, candidates) {
    const maleCandidates = candidates.filter(isMaleCandidate);
    const femaleCandidates = candidates.filter(isFemaleCandidate);

    const isFinalRound = settings.election_status === "final_round";

    const writeInEnabled = !isFinalRound && settings.allow_write_in_vote === true;
    const writeInDigits = Number(settings.write_in_roll_digits);
    const isRanked = isRankedMode(settings);

    const positions = settings.election_positions || "male_female";
    const allowMale = positions !== "female_only";
    const allowFemale = positions !== "male_only";
    const showMale = allowMale && (maleCandidates.length > 0 || writeInEnabled);
    const showFemale = allowFemale && (femaleCandidates.length > 0 || writeInEnabled);

    // Build the email display
    const emailInitial = escapeHTML((email || '').charAt(0).toUpperCase());
    const emailDisplay = escapeHTML(email || '');

    let sectionIndex = 0;

    render(`
        <main class="election-shell">
            <header class="election-header">
                <div class="election-header-text">
                    <span class="eyebrow">${isFinalRound ? '&#9876; FINAL ROUND' : '&#11044; LIVE ELECTION'}</span>
                    <h1>${escapeHTML(settings.election_name || "NITJ CR Election")}</h1>
                    <div class="voter-badge">
                        <span class="voter-avatar">${emailInitial}</span>
                        <span class="voter-email">${emailDisplay}</span>
                    </div>
                </div>
                <button id="logout-btn" class="logout-button" type="button" title="Sign out">Sign out</button>
            </header>

            <form id="vote-form" class="vote-form" novalidate>
                ${isRanked ? `<div class="rank-instruction">
                    <p><strong>Ranked Choice:</strong> Drag candidates to rank in order of preference.</p>
                </div>` : ''}
                
                ${showMale ? `
                <section class="vote-section">
                    <div class="section-heading">
                        <div><h2>Male CR</h2><p>${isRanked ? "Rank by preference" : "Tap to choose"}</p></div>
                    </div>
                    <div class="candidate-grid ${isRanked ? 'drag-container' : ''}" id="male-container">
                        ${maleCandidates.map((c) => candidateCard(c, "male", isRanked ? "drag" : "radio", maleCandidates.length)).join("")}
                    </div>
                    ${writeInEnabled && !isRanked ? writeInField("male", writeInDigits) : ""}
                </section>` : ''}

                ${showFemale ? `
                <section class="vote-section">
                    <div class="section-heading">
                        <div><h2>Female CR</h2><p>${isRanked ? "Rank by preference" : "Tap to choose"}</p></div>
                    </div>
                    <div class="candidate-grid ${isRanked ? 'drag-container' : ''}" id="female-container">
                        ${femaleCandidates.map((c) => candidateCard(c, "female", isRanked ? "drag" : "radio", femaleCandidates.length)).join("")}
                    </div>
                    ${writeInEnabled && !isRanked ? writeInField("female", writeInDigits) : ""}
                </section>` : ''}

                <p id="vote-error" class="vote-error" role="alert" aria-live="polite"></p>
                <button id="review-vote" class="submit-vote haptic-press" type="submit">Cast Your Vote &rarr;</button>
            </form>
        </main>
        <div id="confirmation-modal" class="modal" hidden aria-hidden="true">
            <div class="modal-backdrop"></div>
            <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
                <div class="modal-icon" aria-hidden="true">&#10003;</div>
                <h2 id="confirmation-title">Confirm Your Vote</h2>
                <p class="modal-intro">Review your choices before confirming.</p>
                <div id="vote-review" class="vote-review"></div>
                <p class="vote-warning">This cannot be changed after you confirm.</p>
                <div class="modal-actions">
                    <button id="cancel-vote" class="secondary-button haptic-press" type="button">Go Back</button>
                    <button id="confirm-vote" class="submit-vote haptic-press" type="button">Confirm &amp; Submit</button>
                </div>
            </section>
        </div>`);

    document.getElementById("logout-btn").addEventListener("click", logout);

    if (isRanked) {
        if (showMale) initDragAndDrop("male-container");
        if (showFemale) initDragAndDrop("female-container");
    } else {
        const categoriesToBind = [];
        if (showMale) categoriesToBind.push("male");
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
        if (!showMale) vote.election_positions = "female_only";
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
        const total = cards.length;
        cards.forEach((card, index) => {
            const rank = index + 1;
            const badge = card.querySelector('.rank-badge');
            if (badge) {
                if (rank === 1) badge.innerHTML = "🥇 Rank 1";
                else if (rank === 2) badge.innerHTML = "🥈 Rank 2";
                else if (rank === 3) badge.innerHTML = "🥉 Rank 3";
                else badge.innerHTML = `Rank ${rank}`;
            }

            const select = card.querySelector('.rank-select');
            if (select) {
                if (select.children.length !== total) {
                    select.innerHTML = Array.from({ length: total }, (_, i) => `<option value="${i + 1}">Rank ${i + 1}</option>`).join("");
                }
                select.value = rank;
            }
        });
    };

    updateRanks();

    // Listen for Rank Dropdown selection changes (alternative to drag-and-drop)
    container.addEventListener('change', (e) => {
        if (e.target.classList.contains('rank-select')) {
            const card = e.target.closest('.drag-card');
            if (!card) return;
            const targetRank = parseInt(e.target.value, 10);
            const cards = Array.from(container.querySelectorAll('.drag-card'));
            const currentIndex = cards.indexOf(card);
            const targetIndex = targetRank - 1;

            if (currentIndex !== targetIndex && targetIndex >= 0 && targetIndex < cards.length) {
                if (targetIndex > currentIndex) {
                    container.insertBefore(card, cards[targetIndex].nextSibling);
                } else {
                    container.insertBefore(card, cards[targetIndex]);
                }
                updateRanks();
            }
        }
    });

    // Touch support for mobile drag and drop (Android Chrome and iPhone Safari)
    container.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.drag-handle');
        const target = e.target.closest('.drag-card');
        if (!target || !handle) return;

        isDragging = true;
        draggingEle = target;

        const rect = draggingEle.getBoundingClientRect();

        placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = `${rect.height}px`;

        draggingEle.classList.add('is-dragging');
        draggingEle.style.width = `${rect.width}px`;

        draggingEle.parentNode.insertBefore(placeholder, draggingEle);
        document.body.style.overflow = 'hidden';
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging || !draggingEle) return;
        e.preventDefault();

        const touch = e.touches[0];

        draggingEle.style.position = 'fixed';
        draggingEle.style.top = `${touch.clientY - 25}px`;
        draggingEle.style.left = `${touch.clientX - 25}px`;
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
    }, { passive: false });

    document.addEventListener('touchend', () => {
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

    container.addEventListener('dragend', () => {
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
        const rankArr = Object.entries(rankings[categoryKey]).sort((a, b) => a[1] - b[1]);
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

    return `
        <section class="review-selection">
            <p class="review-category">${escapeHTML(title)}</p>
            <strong>${escapeHTML(name)}</strong>
            ${(writeInRoll || candidate?.roll_number) ? `<span>Roll No. ${escapeHTML(writeInRoll || candidate.roll_number)}</span>` : ''}
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

function renderAlreadyVoted() {
    render(`
        <main class="success-page">
            <section class="success-card">
                <div class="success-tick" aria-hidden="true">&#10003;</div>
                <h1>Vote Already Recorded</h1>
                <p>Your ballot for this round is securely on record. It&rsquo;s anonymous and tamper-proof.</p>
                <button id="logout-btn" class="logout-button" type="button" style="width:100%; margin-top:16px;">Sign out</button>
            </section>
        </main>`);
    document.getElementById("logout-btn").addEventListener("click", logout);
}

function renderVoteSuccess() {
    const timestamp = new Date().toLocaleString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
    render(`
        <main class="success-page" style="animation: fadeUp 0.4s ease; min-height: 100dvh; display: grid; place-items: center; padding: 24px;">
            <section class="success-card" style="text-align: center; width: 100%; max-width: 400px;">
                <div class="success-tick" id="success-tick" aria-hidden="true">&#10003;</div>
                <h1 style="font-family: var(--font-display); font-size: clamp(1.3rem, 4vw, 1.6rem); margin-bottom: 10px;">Vote Recorded!</h1>
                <p style="color: var(--text-2); font-size: clamp(0.82rem, 2.2vw, 0.9rem); line-height: 1.6; margin-bottom: 16px;">Your anonymous ballot was securely submitted. Your identity cannot be linked to your vote.</p>
                <span class="vote-timestamp">&#128197; ${escapeHTML(timestamp)}</span>
                <button id="logout-btn" class="btn btn-primary haptic-press" type="button" style="width:100%; margin-top:22px;">Done &mdash; Sign out</button>
            </section>
        </main>`);

    // Haptic feedback
    if (navigator.vibrate) { navigator.vibrate([30, 40, 60, 40, 120]); }

    // Web Audio chime (no external file needed)
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const playTone = (freq, start, duration, gain = 0.25) => {
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            gainNode.gain.setValueAtTime(0, ctx.currentTime + start);
            gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + duration);
        };
        playTone(523, 0, 0.18);    // C5
        playTone(659, 0.14, 0.18); // E5
        playTone(784, 0.26, 0.30); // G5
        playTone(1047, 0.40, 0.45, 0.2); // C6
    } catch (_) { /* Audio not supported */ }

    // Confetti burst
    if (typeof confetti === 'function') {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.55 }, colors: ['#ffd60a', '#3b82f6', '#32d74b', '#ffffff', '#6366f1'] });
        setTimeout(() => confetti({ particleCount: 40, spread: 100, origin: { y: 0.5 }, scalar: 0.7 }), 350);
    }

    setTimeout(() => {
        const logoutBtn = document.getElementById("logout-btn");
        if (logoutBtn) logoutBtn.addEventListener("click", logout);
    }, 0);
}

function filterTop2CandidatesForFinalRound(candidates, votes) {
    const round1Votes = votes.filter(v => v.round_number === 1 || !v.round_number);
    const maleRes = calculatePositionResults("Male CR", candidates, round1Votes);
    const femaleRes = calculatePositionResults("Female CR", candidates, round1Votes);

    const topMaleIds = new Set(maleRes.results.slice(0, 2).map(r => r.id));
    const topFemaleIds = new Set(femaleRes.results.slice(0, 2).map(r => r.id));

    return candidates.filter(c => {
        if (c.position === "Male CR") return topMaleIds.has(c.id);
        if (c.position === "Female CR") return topFemaleIds.has(c.id);
        return true;
    });
}

async function renderStudentDashboard(email) {
    console.log("Loading settings for student dashboard...");
    const settings = await SettingsAPI.get();

    const status = String(settings.election_status || "draft").toLowerCase();
    const roundNum = status === "final_round" ? 2 : 1;

    if (settings.results_published) {
        await loadAndRenderResults();
        return;
    }

    if (status === "draft") {
        renderElectionNotStarted(email, settings);
        return;
    }

    if (status === "closed" || status === "completed") {
        renderElectionState("Voting Has Ended", "Results will be announced by the administrator soon.", email, 'check');
        return;
    }

    if (await hasAlreadyVoted(email, roundNum)) {
        renderAlreadyVoted();
        return;
    }

    if (status !== "live" && status !== "final_round") {
        renderElectionNotStarted(email, settings);
        return;
    }

    let candidates = await CandidatesAPI.getActive();

    if (status === "final_round") {
        try {
            const { data: round1Votes } = await supabaseClient.from("votes").select("*");
            candidates = filterTop2CandidatesForFinalRound(candidates, round1Votes || []);
        } catch (err) {
            console.error("Failed to filter top candidates for final round:", err);
        }
    }

    renderVotingDashboard(email, settings, candidates);
}
