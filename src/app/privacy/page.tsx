import LegalDocument from '@/components/legal/LegalDocument';

export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
    return (
        <LegalDocument title="Privacy Policy">
            <p><strong>Draft:</strong> This proposed notice outlines information the Event Planner product may handle. Confirm actual data flows, providers, retention, and legal requirements before adopting it.</p>

            <h2>Information in a workspace</h2>
            <p>Depending on the features used, a workspace may contain account details, event dates and locations, tasks, budgets, vendor information and documents, collaborator activity, and guest contact and RSVP details.</p>
            <p>Guest information can include meal preferences, allergies, and companion counts. Workspace administrators should collect only what they need and tell guests how their information will be used.</p>

            <h2>How information is used</h2>
            <p>Workspace information is used to provide and operate the planning features requested by users, including collaboration, RSVP tracking, reminders, exports, and AI-assisted drafts where those features are enabled.</p>
            <p>AI-generated content should be reviewed before use. Do not submit sensitive information to an AI feature unless you have confirmed that doing so is appropriate and permitted.</p>

            <h2>Service providers and sharing</h2>
            <p>The product may rely on third-party infrastructure and feature providers to host or process information. The service operator must document the providers actually used, the information shared with them, their locations, and the applicable safeguards before publication.</p>
            <p>Workspace members and people who receive public RSVP links may see information according to the relevant product permissions and sharing settings. Review those settings before sharing.</p>

            <h2>Security and retention</h2>
            <p>The service operator should describe the security controls and retention periods that apply to the deployed service. No specific retention period or security outcome is promised by this draft.</p>

            <h2>Your choices and requests</h2>
            <p>Available access, correction, export, deletion, and objection rights depend on applicable law and the final service process. Add instructions for making privacy requests and identify who handles them before adopting this policy.</p>

            <h2>Children and contact</h2>
            <p>The intended age requirements, operator identity, privacy contact, and any required regional representative details must be supplied by the service operator and reviewed before publication.</p>
        </LegalDocument>
    );
}
