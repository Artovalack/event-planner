'use client';

import { useState, type FormEvent } from 'react';
import {
    deleteVendorContract,
    deleteVendorPaymentMilestone,
    saveVendorContract,
    saveVendorPaymentMilestone,
    setVendorPaymentStatus,
} from '@/actions/vendor-operations';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { BudgetItemRow, VendorContractRow, VendorPaymentMilestoneRow, VendorRow } from '@/types/database';

type MilestoneForm = {
    label: string;
    amount: string;
    dueAt: string;
    budgetItemId: string;
    notes: string;
};
type PendingConfirmation = {
    title: string;
    description: string;
    confirmLabel: string;
    execute: () => Promise<boolean>;
};

const blankMilestone: MilestoneForm = { label: '', amount: '', dueAt: '', budgetItemId: '', notes: '' };
const allowedContractTypes = new Map([
    ['application/pdf', 'pdf'],
    ['application/msword', 'doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
]);

function localDateTime(value: string) {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatDate(value: string, timezone: string) {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeZone: timezone,
    }).format(new Date(value));
}

export default function VendorOperations({
    eventId,
    vendor,
    milestones,
    contracts,
    budgetItems,
    currencyCode,
    timezone,
}: {
    eventId: string;
    vendor: VendorRow;
    milestones: VendorPaymentMilestoneRow[];
    contracts: VendorContractRow[];
    budgetItems: BudgetItemRow[];
    currencyCode: string;
    timezone: string;
}) {
    const [form, setForm] = useState<MilestoneForm>(blankMilestone);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);

    const resetForm = () => {
        setForm(blankMilestone);
        setEditingId(null);
        setShowForm(false);
    };

    const submitMilestone = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setNotice(null);
        setBusy(true);
        try {
            await saveVendorPaymentMilestone(eventId, vendor.id, {
                label: form.label,
                amount: Number(form.amount),
                due_at: new Date(form.dueAt).toISOString(),
                budget_item_id: form.budgetItemId || null,
                notes: form.notes,
            }, editingId ?? undefined);
            resetForm();
            setNotice(editingId ? 'Payment milestone updated.' : 'Payment milestone added.');
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to save payment milestone.');
        } finally {
            setBusy(false);
        }
    };

    const editMilestone = (milestone: VendorPaymentMilestoneRow) => {
        setForm({
            label: milestone.label,
            amount: String(milestone.amount),
            dueAt: localDateTime(milestone.due_at),
            budgetItemId: milestone.budget_item_id ?? '',
            notes: milestone.notes ?? '',
        });
        setEditingId(milestone.id);
        setShowForm(true);
        setError(null);
        setNotice(null);
    };

    const changeStatus = async (milestone: VendorPaymentMilestoneRow, status: 'pending' | 'paid' | 'cancelled') => {
        setError(null);
        setNotice(null);
        setBusy(true);
        try {
            await setVendorPaymentStatus(eventId, vendor.id, milestone.id, status);
            setNotice(status === 'paid' ? 'Payment marked as paid.' : status === 'cancelled' ? 'Payment cancelled.' : 'Payment marked as pending.');
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to update payment status.');
        } finally {
            setBusy(false);
        }
    };

    const removeMilestone = (milestone: VendorPaymentMilestoneRow) => {
        setConfirmation({
            title: 'Delete this payment milestone?',
            description: `"${milestone.label}" will be removed from the vendor payment schedule.`,
            confirmLabel: 'Delete milestone',
            execute: async () => {
                setError(null);
                setNotice(null);
                setBusy(true);
                try {
                    await deleteVendorPaymentMilestone(eventId, vendor.id, milestone.id);
                    setNotice('Payment milestone deleted.');
                    return true;
                } catch (caughtError) {
                    setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete payment milestone.');
                    return false;
                } finally {
                    setBusy(false);
                }
            },
        });
    };

    const uploadContract = async (file: File) => {
        setError(null);
        setNotice(null);
        const expectedExtension = allowedContractTypes.get(file.type);
        if (!expectedExtension) {
            setError('Contract must be a PDF, DOC, or DOCX file.');
            return;
        }
        if (file.size < 1 || file.size > 20 * 1024 * 1024) {
            setError('Contract file must be 20 MB or smaller.');
            return;
        }

        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension !== expectedExtension) {
            setError(`This file's extension does not match its ${expectedExtension.toUpperCase()} content type.`);
            return;
        }

        const path = `${eventId}/${vendor.id}/${crypto.randomUUID()}.${extension}`;
        setUploading(true);
        try {
            const { error: uploadError } = await getSupabaseClient()
                .storage.from('vendor-contracts')
                .upload(path, file, { contentType: file.type, upsert: false });
            if (uploadError) throw new Error(`Unable to upload contract: ${uploadError.message}`);

            try {
                await saveVendorContract(eventId, vendor.id, {
                    storage_path: path,
                    file_name: file.name.slice(0, 255),
                    content_type: file.type,
                    file_size: file.size,
                });
            } catch (metadataError) {
                const { error: cleanupError } = await getSupabaseClient().storage.from('vendor-contracts').remove([path]);
                const message = metadataError instanceof Error ? metadataError.message : 'Unable to save contract details.';
                if (cleanupError) throw new Error(`${message} Uploaded file cleanup failed: ${cleanupError.message}`);
                throw metadataError;
            }
            setNotice('Contract uploaded.');
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to upload contract.');
        } finally {
            setUploading(false);
        }
    };

    const downloadContract = async (contract: VendorContractRow) => {
        setError(null);
        setDownloadingId(contract.id);
        const tab = window.open('about:blank', '_blank');
        if (!tab) {
            setError('Your browser blocked the contract tab. Allow pop-ups for this site and try again.');
            setDownloadingId(null);
            return;
        }
        tab.opener = null;
        try {
            const { data, error: signedUrlError } = await getSupabaseClient()
                .storage.from('vendor-contracts')
                .createSignedUrl(contract.storage_path, 60);
            if (signedUrlError) throw new Error(`Unable to open contract: ${signedUrlError.message}`);
            tab.location.href = data.signedUrl;
        } catch (caughtError) {
            tab.close();
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to open contract.');
        } finally {
            setDownloadingId(null);
        }
    };

    const removeContract = (contract: VendorContractRow) => {
        setConfirmation({
            title: 'Delete this contract?',
            description: `"${contract.file_name}" will be removed from the contract vault.`,
            confirmLabel: 'Delete contract',
            execute: async () => {
                setError(null);
                setNotice(null);
                try {
                    const { storagePath } = await deleteVendorContract(eventId, vendor.id, contract.id);
                    const { error: storageError } = await getSupabaseClient().storage.from('vendor-contracts').remove([storagePath]);
                    if (storageError) {
                        setError(`Contract record removed, but stored file cleanup failed: ${storageError.message}`);
                    } else {
                        setNotice('Contract deleted.');
                    }
                    return true;
                } catch (caughtError) {
                    setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete contract.');
                    return false;
                }
            },
        });
    };

    const itemNames = new Map(budgetItems.map((item) => [item.id, item.item_name]));
    const currency = (amount: number) => new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 2,
    }).format(Number(amount));

    return (
        <div className="vendor-operations">
            <section className="vendor-operation-section">
                <header className="vendor-operation-heading">
                    <div><h3>Payment schedule</h3><p>Link payments to a budget item and track due dates.</p></div>
                    <button className="secondary-button" type="button" onClick={() => { setForm(blankMilestone); setEditingId(null); setShowForm(!showForm); setError(null); }}>
                        {showForm ? 'Close' : '+ Add payment'}
                    </button>
                </header>
                {showForm && <form className="planner-form-grid vendor-milestone-form" onSubmit={submitMilestone}>
                    <label>Milestone<input required maxLength={120} value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Deposit, final balance…" /></label>
                    <label>Amount ({currencyCode})<input required type="number" min="0" max="9999999999.99" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
                    <label>Due date<input required type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} /></label>
                    <label>Budget item<select value={form.budgetItemId} onChange={(event) => setForm({ ...form, budgetItemId: event.target.value })}><option value="">No linked budget item</option>{budgetItems.map((item) => <option key={item.id} value={item.id}>{item.item_name}</option>)}</select></label>
                    <label className="planner-form-wide">Notes<textarea rows={2} maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
                    <div className="planner-form-wide event-form-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save payment' : 'Add payment'}</button>{editingId && <button className="secondary-button" type="button" onClick={resetForm} disabled={busy}>Cancel</button>}</div>
                </form>}
                {!milestones.length ? <p className="vendor-operation-empty">No payment milestones recorded.</p> : <div className="vendor-milestone-list">
                    {milestones.map((milestone) => <article className="vendor-milestone-row" key={milestone.id}>
                        <div className="vendor-milestone-info">
                            <div className="vendor-milestone-title"><strong>{milestone.label}</strong><span className={`status-pill ${milestone.status === 'paid' ? 'completed' : 'pending'}`}>{milestone.status}</span></div>
                            <span>{currency(Number(milestone.amount))} · Due {formatDate(milestone.due_at, timezone)}</span>
                            {milestone.budget_item_id && <span>Budget: {itemNames.get(milestone.budget_item_id) ?? 'Linked budget item'}</span>}
                            {milestone.notes && <span>{milestone.notes}</span>}
                        </div>
                        <div className="planner-card-actions vendor-milestone-actions">
                            {milestone.status !== 'paid' && milestone.status !== 'cancelled' && <button type="button" className="text-button" disabled={busy} onClick={() => void changeStatus(milestone, 'paid')}>Mark paid</button>}
                            {milestone.status === 'paid' && <button type="button" className="text-button" disabled={busy} onClick={() => void changeStatus(milestone, 'pending')}>Reopen</button>}
                            <button type="button" className="text-button" disabled={busy} onClick={() => editMilestone(milestone)}>Edit</button>
                            <button type="button" className="danger-button" disabled={busy} onClick={() => void removeMilestone(milestone)}>Delete</button>
                        </div>
                    </article>)}
                </div>}
            </section>

            <section className="vendor-operation-section">
                <header className="vendor-operation-heading">
                    <div><h3>Contract vault</h3><p>Private files are only available to this event’s owner.</p></div>
                    <label className={`secondary-button vendor-contract-upload ${uploading ? 'vendor-contract-upload-busy' : ''}`}>
                        {uploading ? 'Uploading…' : '+ Upload contract'}
                        <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadContract(file); event.currentTarget.value = ''; }} />
                    </label>
                </header>
                {!contracts.length ? <p className="vendor-operation-empty">No contracts uploaded.</p> : <ul className="vendor-contract-list">
                    {contracts.map((contract) => <li key={contract.id}>
                        <div><strong>{contract.file_name}</strong><span>{Math.max(1, Math.ceil(contract.file_size / 1024))} KB · {formatDate(contract.uploaded_at, timezone)}</span></div>
                        <div className="planner-card-actions"><button className="text-button" type="button" disabled={downloadingId === contract.id} onClick={() => void downloadContract(contract)}>{downloadingId === contract.id ? 'Opening…' : 'Open'}</button><button className="danger-button" type="button" onClick={() => void removeContract(contract)}>Delete</button></div>
                    </li>)}
                </ul>}
            </section>
            {error && <p className="form-message form-message-error" role="alert">{error}</p>}
            {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
            {confirmation && <ConfirmDialog
                title={confirmation.title}
                description={confirmation.description}
                confirmLabel={confirmation.confirmLabel}
                error={error}
                onConfirm={confirmation.execute}
                onClose={() => setConfirmation(null)}
            />}
        </div>
    );
}
