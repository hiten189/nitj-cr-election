document.addEventListener("DOMContentLoaded", async () => {
    console.log("App starting...");
    try {
        await routeAuthenticatedUser();
    } catch (error) {
        console.error("Application startup failed:", error);
        renderError("Unable to load", "The election configuration could not be loaded. Please contact the election administrator.");
    } finally {
        stopLoading();
        showApp();
    }
});

supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") routeAuthenticatedUser().catch(console.error);
});
