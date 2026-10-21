// Lightweight liveness endpoint for the Docker/Coolify health check.
//
// This is a Nitro server route (not a Vue page), so it is matched directly by
// the server before the Nuxt renderer and the i18n `prefix` strategy. That
// keeps it instant: hitting "/health" must NOT fall through to the SSR
// catch-all, which redirects to "/de/health/" and triggers a slow TYPO3
// lookup, blowing past the health check timeout and marking the container
// unhealthy (-> Traefik 503).
export default defineEventHandler((event) => {
    setResponseHeader(event, "Content-Type", "application/json; charset=utf-8")
    setResponseHeader(event, "Cache-Control", "no-store")

    return {
        status: "ok",
        uptime: process.uptime(),
        timestamp: Date.now(),
    }
})
