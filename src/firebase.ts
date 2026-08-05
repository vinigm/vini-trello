import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCzSQl_YZrTkAtI6MibvmBE3gaq0WFPkYY",
  authDomain: "vini-trello.firebaseapp.com",
  projectId: "vini-trello",
  storageBucket: "vini-trello.firebasestorage.app",
  messagingSenderId: "938597989983",
  appId: "1:938597989983:web:c4f2e0a9882919740f65ea",
};

const firebaseApp = initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
