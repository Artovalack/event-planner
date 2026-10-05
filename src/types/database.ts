export type EventRow = {
    id: string;
    title: string;
    description?: string | null;
    date?: string | null;
    location?: string | null;
    created_at?: string;
};

export type EventInput = {
    title: string;
    description: string | null;
    date: string | null;
    location: string | null;
};

export type SubtaskRow = {
    id: string;
    task_id: string;
    title: string;
    is_completed: boolean;
};

export type TaskRow = {
    id: string;
    event_id: string;
    title: string;
    category: string;
    due_date: string | null;
    status: 'pending' | 'completed';
    notes: string | null;
    created_at?: string;
    subtasks?: SubtaskRow[];
};

export type GuestRow = {
    id: string;
    event_id: string;
    name: string;
    email: string | null;
    invitation_status: 'sent' | 'not_sent';
    companion_adults: number;
    companion_children: number;
    companion_babies: number;
    total_companions: number;
    created_at?: string;
};

export type BudgetItemRow = {
    id: string;
    event_id: string;
    item_name: string;
    category: string;
    estimated_cost: number;
    actual_cost: number;
    payment_status: 'pending' | 'completed';
    created_at?: string;
};

export type VendorRow = {
    id: string;
    event_id: string;
    vendor_name: string;
    category: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    created_at?: string;
};
