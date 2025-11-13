// js/firebase-config.js

// Aguarda o módulo carregar
const { initializeApp, getFirestore } = window.firebaseModules;

// --- COLE SUA CONFIGURAÇÃO DO FIREBASE AQUI ---
// Vai parecer com isso:
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "simulado-ogmo.firebaseapp.com",
  projectId: "simulado-ogmo",
  storageBucket: "simulado-ogmo.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
// ---------------------------------------------

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Disponibiliza o banco de dados globalmente
window.db = db;

console.log("Firebase conectado com sucesso!");
