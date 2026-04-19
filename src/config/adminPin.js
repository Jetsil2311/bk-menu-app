// FALLBACK ONLY — The source of truth for the admin PIN is Firestore: settings/general.adminPin
// This constant is used only on first launch when no PIN has been stored in Firestore yet.
// Once the PIN has been set via the admin panel it is stored in Firestore and this value is ignored.
export const ADMIN_PIN = '1234'
