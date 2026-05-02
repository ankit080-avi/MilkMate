// ────────────────────────────────────────────────────────────────────
// Firebase config for FCM (Cloud Messaging) — Project: milkmate-d77d6
//
// Uses `self` so the same file works inside the firebase-messaging service
// worker AND on the main page (in browsers, window === self).
//
// SAFE TO COMMIT — these are public values. The SERVER-SIDE service-account
// JSON used by the Edge Function to send pushes is NEVER placed here; it
// lives only as a Supabase Edge Function secret.
// ────────────────────────────────────────────────────────────────────
self.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBkK8z1RdmQdC23r5Spzll5a9335dp0VMg',
  authDomain: 'milkmate-d77d6.firebaseapp.com',
  projectId: 'milkmate-d77d6',
  storageBucket: 'milkmate-d77d6.firebasestorage.app',
  messagingSenderId: '719675567152',
  appId: '1:719675567152:web:12a7926e87780ca063d1f5',
  measurementId: 'G-LV4KWMBT3Q',
  vapidKey: 'BLJ2OhabpKKqH-Mm7bhbEHqDXA2jKZ_1ef_9iwKrbxAGKpa3JmR0_gN3_cZG7UKpDrC3F9WkYDyuoZWk7OvQjnM'
};
