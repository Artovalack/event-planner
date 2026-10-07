import Link from 'next/link';
import type { ReactNode } from 'react';

export default function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
    return (
        <main className="legal-page">
            <article className="legal-document">
                <Link href="/signup" className="legal-back-link">← Back to sign up</Link>
                <p className="eyebrow">EVENT PLANNER · DRAFT FOR REVIEW</p>
                <h1>{title}</h1>
                <p className="legal-draft-notice">
                    This draft is provided for product review, not as legal advice. Have qualified counsel review and
                    approve it for your organization and jurisdictions before relying on it.
                </p>
                <div className="legal-document-content">{children}</div>
            </article>
        </main>
    );
}
