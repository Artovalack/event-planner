export default function PageLoading({ fullPage = false }: { fullPage?: boolean }) {
    return (
        <main className={`page-loading${fullPage ? ' page-loading-full' : ''}`} role="status" aria-live="polite">
            <span className="page-loading-indicator" aria-hidden="true" />
            <p>Loading your workspace…</p>
        </main>
    );
}
