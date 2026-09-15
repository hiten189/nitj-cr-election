/* ==========================================================
   IPE Voting System
   validation.js
========================================================== */


/* -----------------------------
   Email Validation
------------------------------ */

function isValidEmail(email) {

    if (!email)
        return false;

    email = normalizeEmail(email);

    return NIT_EMAIL_REGEX.test(email);

}


/* -----------------------------
   Required Field
------------------------------ */

function isRequired(value) {

    return value !== null &&
           value !== undefined &&
           value.toString().trim() !== "";

}


/* -----------------------------
   Roll Number
------------------------------ */

function isValidRollNumber(roll) {

    if (!roll)
        return false;

    return roll.trim().length >= 2;

}


/* -----------------------------
   Candidate Selection
------------------------------ */

function hasSelectedCandidate(candidateId, writeInRoll) {

    return isRequired(candidateId) || isRequired(writeInRoll);

}


/* -----------------------------
   Vote Validation
------------------------------ */

function validateVote(vote) {

    if (!vote)
        return {
            valid: false,
            message: "Vote data not found."
        };

    if (!hasSelectedCandidate(vote.male_candidate_id, vote.male_write_in_roll)) {

        return {
            valid: false,
            message: "Please select or enter a Male CR candidate."
        };

    }

    if (!hasSelectedCandidate(vote.female_candidate_id, vote.female_write_in_roll)) {

        return {
            valid: false,
            message: "Please select or enter a Female CR candidate."
        };

    }

    return {
        valid: true,
        message: ""
    };

}


/* -----------------------------
   Settings Validation
------------------------------ */

function validateSettings(settings) {

    if (!settings)
        return false;

    return true;

}

function isValidWriteInRoll(roll, requiredDigits) {

    const value = String(roll || "").trim();
    const digits = Number(requiredDigits);

    return Number.isInteger(digits) &&
           digits > 0 &&
           value.length === digits &&
           Array.from(value).every((character) => character >= "0" && character <= "9");

}
