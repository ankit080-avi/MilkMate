// ────────────────────────────────────────────────────────────────────
// Firebase config for FCM (Cloud Messaging).
// Fill these in from your Firebase project once it's created:
//   1. https://console.firebase.google.com/ → Add project (free)
//   2. Project settings → Your apps → Web → register app → copy the config
//   3. Project settings → Cloud Messaging → Web Push certificates →
//      generate VAPID key pair → copy the public key into vapidKey below
//
// Uses `self` so the same file works inside the firebase-messaging service
// worker AND on the main page (in browsers, window === self).
//
// SAFE TO COMMIT — these are public values. The SERVER-SIDE service-account
// JSON used by the Edge Function to send pushes is NEVER placed here; it
// lives only as a Supabase Edge Function secret.
// ────────────────────────────────────────────────────────────────────
self.FIREBASE_CONFIG = {
  apiKey: '',                 // e.g. 'AIzaSyB...'
  authDomain: '',             // e.g. 'milkmate-xxx.firebaseapp.com'
  projectId: '',              // e.g. 'milkmate-xxx'
  storageBucket: '',          // e.g. 'milkmate-xxx.appspot.com'
  messagingSenderId: '',      // e.g. '1234567890'
  appId: '',                  // e.g. '1:1234567890:web:abcdef'
  vapidKey: ''                // e.g. 'BNZ3...' (Web Push public key)
};
