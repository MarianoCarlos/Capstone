// lib/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
	apiKey: "AIzaSyAK3lLrIiX55iLjT1gBVQ9TpiK3TzWSd8E",
	authDomain: "capstone-project-93e53.firebaseapp.com",
	projectId: "capstone-project-93e53",
	storageBucket: "capstone-project-93e53.firebasestorage.app",
	messagingSenderId: "396580016477",
	appId: "1:396580016477:web:10db8e6845aa4491ef18b4",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = getFirestore(app);
