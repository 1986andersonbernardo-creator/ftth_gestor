const firebaseConfig = {

  apiKey: "AIzaSyBIcbR_uOCHVGyoL9AoodlyfbOt7rylkZM",

  authDomain: "ftth-gestor.firebaseapp.com",

  projectId: "ftth-gestor",

  storageBucket: "ftth-gestor.firebasestorage.app",

  messagingSenderId: "969986580777",

  appId: "1:969986580777:web:8568cdb78aae83b20e1738"

};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

const auth = firebase.auth();

const functions = firebase.functions();