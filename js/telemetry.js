const Telemetry = {
    async logEvent(eventType) {
        try {
            if (typeof supabaseClient === 'undefined') return;

            const ua = navigator.userAgent || "";
            let os = "Unknown OS";
            if (ua.includes("Win")) os = "Windows";
            else if (ua.includes("Mac")) os = "MacOS";
            else if (ua.includes("Android")) os = "Android";
            else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
            else if (ua.includes("Linux")) os = "Linux";

            let browser = "Unknown Browser";
            if (ua.includes("Firefox")) browser = "Firefox";
            else if (ua.includes("SamsungBrowser")) browser = "Samsung Internet";
            else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";
            else if (ua.includes("Edg")) browser = "Edge";
            else if (ua.includes("Chrome")) browser = "Chrome";
            else if (ua.includes("Safari")) browser = "Safari";

            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
            const deviceType = isMobile ? "Mobile" : (window.innerWidth < 1024 ? "Tablet" : "Desktop");

            const resolution = `${window.screen.width}x${window.screen.height}`;
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown";
            const lang = navigator.language || "Unknown";

            await supabaseClient.from('visitor_analytics').insert([{
                event_type: eventType,
                user_agent: ua.substring(0, 255),
                device_type: deviceType,
                operating_system: os,
                browser: browser,
                screen_resolution: resolution,
                timezone: tz,
                language: lang
            }]);
        } catch (e) {
            // Silently fail as telemetry is non-critical
            console.error("Telemetry error:", e);
        }
    }
};

// Automatically log a page view when the script loads
document.addEventListener('DOMContentLoaded', () => {
    Telemetry.logEvent('page_view');
});
