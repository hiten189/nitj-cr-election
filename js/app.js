document.addEventListener("DOMContentLoaded", initializeApplication);

async function initializeApplication() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {

        renderLoginScreen();

        attachLoginEvents();

        return;

    }

    loadStudentDashboard(data.session.user.email);

}