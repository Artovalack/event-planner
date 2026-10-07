export type NotificationPreferences = {
    email_deadlines: boolean;
    in_app_deadlines: boolean;
    email_guest_rsvps: boolean;
    in_app_guest_rsvps: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
    email_deadlines: false,
    in_app_deadlines: true,
    email_guest_rsvps: false,
    in_app_guest_rsvps: true,
};
