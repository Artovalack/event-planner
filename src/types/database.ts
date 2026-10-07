export type EventRow = {
    id: string;
    user_id?: string | null;
    title: string;
    description?: string | null;
    date?: string | null;
    location?: string | null;
    currency_code?: string;
    timezone?: string;
    venue_name?: string | null;
    venue_address?: string | null;
    banner_path?: string | null;
    public_registration_enabled?: boolean;
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
    guest_tag?: 'guest' | 'vip' | 'family' | 'vendor' | 'sponsor';
    invitation_status: 'sent' | 'not_sent' | 'opened' | 'confirmed' | 'declined';
    rsvp_status?: 'pending' | 'confirmed' | 'declined';
    rsvp_companion_adults?: number;
    rsvp_companion_children?: number;
    rsvp_companion_babies?: number;
    meal_preference?: string | null;
    allergies?: string | null;
    rsvp_updated_at?: string | null;
    companion_adults: number;
    companion_children: number;
    companion_babies: number;
    total_companions: number;
    created_at?: string;
};

export type EventRegistrationRequestRow = {
    id: string;
    event_id: string;
    name: string;
    email: string;
    companion_adults: number;
    companion_children: number;
    companion_babies: number;
    note: string | null;
    status: 'pending' | 'approved' | 'declined';
    created_at: string;
    reviewed_at: string | null;
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

export type VendorPaymentMilestoneRow = {
    id: string;
    event_id: string;
    vendor_id: string;
    budget_item_id: string | null;
    label: string;
    amount: number;
    due_at: string;
    status: 'pending' | 'paid' | 'cancelled';
    paid_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
};

export type VendorContractRow = {
    id: string;
    event_id: string;
    vendor_id: string;
    storage_path: string;
    file_name: string;
    content_type: string;
    file_size: number;
    uploaded_at: string;
};

export type ScheduleItemRow = {
    id: string;
    event_id: string;
    title: string;
    description: string | null;
    starts_at: string;
    ends_at: string | null;
    location: string | null;
    responsible_person: string | null;
    sort_order: number;
    created_at?: string;
    updated_at?: string;
};

export type CalendarItem = {
    id: string;
    title: string;
    startsAt: string;
    allDay: boolean;
    kind: 'event' | 'task' | 'payment' | 'schedule';
    eventTitle: string;
};

export type SeatingTableRow = {
    id: string;
    event_id: string;
    name: string;
    capacity: number;
    shape: 'round' | 'rectangle';
    sort_order: number;
    created_at?: string;
};

export type SeatingAssignmentRow = {
    event_id: string;
    guest_id: string;
    seating_table_id: string;
    assigned_at: string;
};

export type ActivityRow = {
    id: string;
    event_id: string;
    actor_id: string | null;
    actor_email: string | null;
    action: 'created' | 'updated' | 'deleted';
    entity_type: string;
    created_at: string;
};
