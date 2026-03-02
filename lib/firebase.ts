// Firebase configuration for Aadinath Industries Sales Dashboard
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCBXxSsvjnFzGMMFbHCYouokIQydObeElo",
  authDomain: "ais-production-e013c.firebaseapp.com",
  projectId: "ais-production-e013c",
  storageBucket: "ais-production-e013c.firebasestorage.app",
  messagingSenderId: "565647781984",
  appId: "1:565647781984:web:0f05c2436afdcc7a0b1305",
  measurementId: "G-3WZFKGL4FC",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Analytics (only on client-side)
let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}
export { analytics };
