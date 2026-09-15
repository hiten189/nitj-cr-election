document.addEventListener("DOMContentLoaded", async () => {
    try {
        await routeAuthenticatedUser();
    } catch (error) {
        console.error("Application startup error:", error);
        renderError("Unable to load", error.message || MESSAGE.UNKNOWN_ERROR);
    } finally {
        stopLoading();
        showApp();
    }
});

supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") routeAuthenticatedUser().catch(console.error);
});
