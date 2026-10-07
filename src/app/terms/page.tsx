import LegalDocument from '@/components/legal/LegalDocument';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
    return (
        <LegalDocument title="Terms of Service">
            <p><strong>Draft:</strong> These proposed terms describe rules for using Event Planner. They are not final until reviewed and adopted by the service operator.</p>

            <h2>Using the service</h2>
            <p>Event Planner provides tools for organizing events, coordinating collaborators, managing guests and vendors, and working with event-related information. You must be legally able to accept applicable terms to create an account.</p>
            <p>You are responsible for keeping your sign-in credentials secure and for activity carried out through your account. Provide accurate account information and tell the service operator if you believe your account has been accessed without permission.</p>

            <h2>Workspace content and invitations</h2>
            <p>You are responsible for the information, files, invitations, and other content you add or share. Only upload or share information you are authorized to use, and obtain any permissions or notices required before entering information about guests or collaborators.</p>
            <p>Workspace access depends on the roles and permissions configured for the workspace. Review recipients and access settings before sharing event information or public RSVP links.</p>

            <h2>Acceptable use</h2>
            <p>Do not use the service to violate laws or another person’s rights, interfere with its operation or security, or submit malicious, unlawful, or unauthorized content.</p>

            <h2>Third-party services and generated content</h2>
            <p>Some features may rely on third-party services. Their own terms and privacy practices may apply. AI-generated suggestions are informational drafts; review them for accuracy and suitability before relying on or sharing them.</p>

            <h2>Availability and changes</h2>
            <p>The service and its features may change over time. This draft does not promise uninterrupted availability, a particular feature, or a particular data-retention period.</p>

            <h2>Suspension and termination</h2>
            <p>Account suspension, termination, and handling of workspace content after an account ends must be governed by the final terms adopted by the service operator. This section requires review before launch.</p>

            <h2>Questions and operator details</h2>
            <p>The service operator’s legal name, address, governing law, dispute process, liability terms, and contact details must be added and reviewed before these terms are adopted.</p>
        </LegalDocument>
    );
}
