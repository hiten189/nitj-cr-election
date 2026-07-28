function attachLoginEvents() {

    const continueButton = document.getElementById("continue-btn");

    continueButton.addEventListener("click", handleLogin);

}

async function handleLogin() {

    const emailInput = document.getElementById("email-input");

    const errorMessage = document.getElementById("email-error");

    const email = emailInput.value.trim();

    errorMessage.textContent = "";
    errorMessage.style.color = "var(--danger)";

    if (email === "") {

        errorMessage.textContent = "Please enter your official NIT email address.";

        emailInput.focus();

        return;

    }

    if (!isValidNitEmail(email)) {

        errorMessage.textContent = "Please enter a valid NIT email address.";

        emailInput.focus();

        return;

    }

    await sendMagicLink(email);

}

async function sendMagicLink(email) {

    const continueButton = document.getElementById("continue-btn");

    const errorMessage = document.getElementById("email-error");

    continueButton.disabled = true;

    continueButton.textContent = "Sending...";

    const { error } = await supabaseClient.auth.signInWithOtp({

        email,

        options: {

            emailRedirectTo: window.location.origin

        }

    });

    continueButton.disabled = false;

    continueButton.textContent = "Continue";

    if (error) {

        errorMessage.textContent = error.message;

        return;

    }

    errorMessage.style.color = "var(--success)";

    errorMessage.textContent = "Magic link sent! Please check your email.";

}

async function logoutStudent() {

    await supabaseClient.auth.signOut();

    location.reload();

}