/* ====== Lógica Principal com Firebase (COM CHAT e Sintaxe v8 CORRIGIDA) ====== */

// --- 1. CONFIGURAÇÃO DO FIREBASE ---
// ======================================================
// ===== COLE A SUA 'firebaseConfig' DO FIREBASE AQUI =====
const firebaseConfig = {
  apiKey: "AIzaSyAYi7oQ6oyS_fQS-gGuGT495NdxfMcffY0",
  authDomain: "capatazia-4391a.firebaseapp.com",
  projectId: "capatazia-4391a",
  storageBucket: "capatazia-4391a.firebasestorage.app",
  messagingSenderId: "248581392094",
  appId: "1:248581392094:web:ecb618ca575f1806bfe44f",
  measurementId: "G-47R4KNRSQF"
};
// ======================================================


// --- 2. INICIALIZAÇÃO DO FIREBASE (Sintaxe v8/compat) ---
let db;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log("Firebase conectado com sucesso!"); 
} catch (error) {
  console.error("Erro ao inicializar o Firebase:", error);
  alert("Falha crítica ao conectar com o banco de dados. Verifique o console (F12) e a sua 'firebaseConfig' no app.js.");
}

// --- 3. LÓGICA DO APP (COM CHAT) ---

let currentUser = null;
let otherUser = null; 
let chatRoomId = null; 
let userDocRef = null; 
let otherUserDocRef = null; 

let stopPresenceListener = () => {};
let stopMessagesListener = () => {};

// NOVO: Fotos de Perfil
const profilePics = {
  ithalo: 'https://placehold.co/60x60/0984e3/FFF?text=I', // Substitua pela sua URL
  matheus: 'https://placehold.co/60x60/2d3436/FFF?text=M' // Substitua pela sua URL
};

// Espera o HTML carregar
document.addEventListener('DOMContentLoaded', () => {
  
  // Elementos do Login
  const userGate = document.getElementById('userGate');
  const userIthalo = document.getElementById('userIthalo');
  const userMatheus = document.getElementById('userMatheus');
  
  // Elementos do App
  const mainContent = document.getElementById('mainContent');
  const currentUserDisplay = document.querySelector('#currentUserDisplay span');
  const navSimulado = document.getElementById('navSimulado');
  const navDesempenho = document.getElementById('navDesempenho');
  const quizContainer = document.getElementById('quizContainer');
  const desempenhoContainer = document.getElementById('desempenhoContainer');
  
  // Elementos do Chat
  const chatHead = document.getElementById('chatHead');
  const chatHeadImg = document.querySelector('#chatHead img');
  const chatBadge = document.getElementById('chatBadge');
  const chatWidget = document.getElementById('chatWidget');
  const chatWithUser = document.getElementById('chatWithUser');
  const closeChatBtn = document.getElementById('closeChatBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatTextInput = document.getElementById('chatTextInput');
  const chatSendBtn = document.getElementById('chatSendBtn');


  // --- 1. SELEÇÃO DE UTILIZADOR (Modificado) ---
  async function selectUser(userName) {
    if (!db) return;
    
    currentUser = userName;
    otherUser = (currentUser === 'ithalo') ? 'matheus' : 'ithalo';
    chatRoomId = [currentUser, otherUser].sort().join('_');
    
    if (currentUserDisplay) currentUserDisplay.textContent = userName;
    
    userDocRef = db.collection("users").doc(currentUser); 
    otherUserDocRef = db.collection("users").doc(otherUser);
    
    if (userGate) userGate.style.opacity = 0.5;

    try {
      const docSnap = await userDocRef.get();
      if (!docSnap.exists) {
        await userDocRef.set({
          name: userName,
          createdAt: new Date().toISOString(),
          stats: { totalQuestions: 0, correct: 0, wrong: 0 },
          errorTopics: {},
          unreadMessagesFrom: {} 
        });
      }

      if (userGate) userGate.style.display = 'none';
      if (mainContent) mainContent.style.display = 'block';
      
      if (typeof loadSubjects === 'function') {
        loadSubjects(userName);
        loadPDFs();
      }
      
      showTab('simulado');
      
      // --- INICIA OS SERVIÇOS DE CHAT ---
      startPresenceHeartbeat();
      listenToOtherUser();
      
    } catch (error) {
      console.error("Erro ao conectar no Firebase (Firestore):", error);
      alert("Erro de conexão. Verifique sua internet ou as regras do Firestore.");
      if (userGate) userGate.style.opacity = 1;
    }
  }

  if (userIthalo) userIthalo.addEventListener('click', () => selectUser('ithalo'));
  if (userMatheus) userMatheus.addEventListener('click', () => selectUser('matheus'));


  // --- 2. LÓGICA DE PRESENÇA (Heartbeat) ---
  
  function startPresenceHeartbeat() {
    updatePresence(); 
    setInterval(updatePresence, 20000); 
  }
  
  async function updatePresence() {
    if (!userDocRef) return;
    try {
      await userDocRef.update({
        // CORREÇÃO: Usa a sintaxe v8 para timestamp
        lastActivity: firebase.firestore.FieldValue.serverTimestamp() 
      });
    } catch (e) {
      console.warn("Erro ao atualizar presença:", e.message);
    }
  }

  // --- 3. LÓGICA DE ESCUTA (Outro Utilizador) ---
  
  function listenToOtherUser() {
    if (!otherUserDocRef) return;
    stopPresenceListener(); 
    
    // CORREÇÃO: Usa a sintaxe v8 para onSnapshot
    stopPresenceListener = otherUserDocRef.onSnapshot((doc) => {
      if (!doc.exists) {
        chatHead.style.display = 'none'; 
        return;
      }
      
      const data = doc.data();
      
      // 1. Verificar Presença
      const lastActivity = data.lastActivity ? data.lastActivity.toDate() : null;
      let isOnline = false;
      if (lastActivity) {
        const now = new Date();
        const diffInSeconds = (now.getTime() - lastActivity.getTime()) / 1000;
        if (diffInSeconds < 60) {
          isOnline = true;
        }
      }
      
      // 2. Verificar Mensagens Não Lidas (do outro utilizador para mim)
      // Esta lógica estava invertida, vamos corrigir
      const myData = docSnap.data(); // Precisa dos MEUS dados
      const unreadMap = myData.unreadMessagesFrom || {};
      const unreadCount = unreadMap[otherUser] || 0;
      
      // 3. Atualizar a UI
      updateChatHead(isOnline, unreadCount);
    });
  }

  // --- 4. LÓGICA DE UI DO CHAT ---
  
  function updateChatHead(isOnline, unreadCount) {
    if (isOnline) {
      chatHead.style.display = 'block';
      chatHeadImg.src = profilePics[otherUser]; 
      
      if (unreadCount > 0) {
        chatBadge.textContent = unreadCount;
        chatBadge.style.display = 'flex';
      } else {
        chatBadge.style.display = 'none';
      }
    } else {
      chatHead.style.display = 'none';
      if (chatWidget) chatWidget.style.display = 'none';
    }
  }
  
  // Abrir o Chat
  chatHead.addEventListener('click', () => {
    chatWidget.style.display = 'flex';
    chatWithUser.textContent = `Chat com ${otherUser}`;
    
    listenForMessages();
    
    // Zera a contagem de mensagens NÃO LIDAS
    // (no MEU documento)
    const myUnreadMapKey = `unreadMessagesFrom.${otherUser}`;
    userDocRef.update({
      [myUnreadMapKey]: 0
    });
  });

  // Fechar o Chat
  closeChatBtn.addEventListener('click', () => {
    chatWidget.style.display = 'none';
    stopMessagesListener(); 
  });
  
  // --- 5. LÓGICA DE MENSAGENS (Enviar/Receber) ---
  
  function listenForMessages() {
    stopMessagesListener(); 
    
    // CORREÇÃO: Sintaxe v8 para collection e query
    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    const q = chatCollectionRef.orderBy("timestamp", "asc");

    // CORREÇÃO: Sintaxe v8 para onSnapshot
    stopMessagesListener = q.onSnapshot((querySnapshot) => {
      chatMessages.innerHTML = ''; 
      querySnapshot.forEach((doc) => {
        const msg = doc.data();
        
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.textContent = msg.text;
        
        if (msg.senderId === currentUser) {
          bubble.classList.add('msg-sent');
        } else {
          bubble.classList.add('msg-received');
        }
        
        chatMessages.appendChild(bubble);
      });
      
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }
  
  // Enviar Mensagem
  async function sendMessage() {
    const text = chatTextInput.value;
    if (text.trim() === "") return;
    
    chatTextInput.value = ''; 

    // 1. Adiciona a mensagem à coleção
    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    // CORREÇÃO: Sintaxe v8 para addDoc e serverTimestamp
    await chatCollectionRef.add({
      senderId: currentUser,
      text: text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 2. Incrementa a contagem de "não lidos" DO OUTRO UTILIZADOR
    const otherUserUnreadKey = `unreadMessagesFrom.${currentUser}`;
    // CORREÇÃO: Sintaxe v8 para increment
    await otherUserDocRef.update({
      [otherUserUnreadKey]: firebase.firestore.FieldValue.increment(1)
    });
  }

  chatSendBtn.addEventListener('click', sendMessage);
  chatTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });


  // --- FUNÇÕES ANTIGAS (Salvamento de progresso, abas, etc.) ---
  
  window.saveQuestionProgress = async (questionData, isCorrect) => {
    if (!userDocRef) return; 

    try {
      const snap = await userDocRef.get();
      const data = snap.data();
      const currentStats = data.stats || { correct: 0, wrong: 0, totalQuestions: 0 };
      const currentErrorTopics = data.errorTopics || {};

      const newStats = {
        totalQuestions: currentStats.totalQuestions + 1,
        correct: currentStats.correct + (isCorrect ? 1 : 0),
        wrong: currentStats.wrong + (isCorrect ? 0 : 1)
      };

      let updateData = {
        stats: newStats,
        lastActivity: new Date().toISOString() // Mantém isto para um fallback
      };

      if (!isCorrect && typeof getErrorTopic === 'function') {
        const topic = getErrorTopic(questionData, questionData.sourceFile); 
        const currentTopicCount = currentErrorTopics[topic] || 0;
        currentErrorTopics[topic] = currentTopicCount + 1;
        updateData.errorTopics = currentErrorTopics;
      }

      await userDocRef.update(updateData);
      console.log("Progresso detalhado salvo na nuvem!");

    } catch (e) {
      console.error("Erro ao salvar progresso:", e);
    }
  };

  function showTab(tabName) {
    if (tabName === 'simulado') {
      if (quizContainer) quizContainer.style.display = 'block';
      if (desempenhoContainer) desempenhoContainer.style.display = 'none';
      if (navSimulado) navSimulado.classList.add('active');
      if (navDesempenho) navDesempenho.classList.remove('active');
    } else if (tabName === 'desempenho') {
      if (quizContainer) quizContainer.style.display = 'none';
      if (desempenhoContainer) desempenhoContainer.style.display = 'block';
      if (navSimulado) navSimulado.classList.remove('active');
      if (navDesempenho) navDesempenho.classList.add('active');
      loadPerformanceData();
    }
  }
  
  async function loadPerformanceData() {
    if (!userDocRef) return;
    const snap = await userDocRef.get();
    if (!snap.exists) {
      console.error("Documento do usuário não encontrado.");
      return;
    }

    const data = snap.data();
    const stats = data.stats || { correct: 0, wrong: 0, totalQuestions: 0 };
    const unanswered = stats.totalQuestions - stats.correct - stats.wrong;

    const pizzaCtx = document.getElementById('totalPizzaChart');
    if (pizzaCtx) {
      if (window.Chart && pizzaCtx.chart) pizzaCtx.chart.destroy(); 
      pizzaCtx.chart = new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
          labels: ['Acertos', 'Erros', 'Não Respondidas (se houver)'],
          datasets: [{
            data: [stats.correct, stats.wrong, unanswered],
            backgroundColor: ['#00b894', '#d63031', '#bdc3c7'],
            hoverOffset: 4
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const barCtx = document.getElementById('totalBarChart');
    if (barCtx) {
        if (window.Chart && barCtx.chart) barCtx.chart.destroy(); 
        
        const errorTopics = data.errorTopics || {};
        const errorEntries = Object.entries(errorTopics); 

        if (errorEntries.length > 0) {
          barCtx.chart = new Chart(barCtx, {
            type: 'bar',
            data: {
              labels: errorEntries.map(entry => entry[0]),
              datasets: [{
                label: 'Quantidade de Erros',
                data: errorEntries.map(entry => entry[1]),
                backgroundColor: 'rgba(214, 48, 49, 0.6)',
                borderColor: '#d63031',
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
          });
        } else {
            const context = barCtx.getContext('2d');
            context.clearRect(0, 0, barCtx.width, barCtx.height);
            context.textAlign = 'center';
            context.fillStyle = '#8b949e'; // Cor --muted
            context.font = "16px 'Poppins', sans-serif";
            context.fillText('Ainda não há dados de tópicos de erro.', barCtx.width / 2, barCtx.height / 2);
        }
    }
  }

  if (navSimulado) navSimulado.addEventListener('click', (e) => { e.preventDefault(); showTab('simulado'); });
  if (navDesempenho) navDesempenho.addEventListener('click', (e) => { e.preventDefault(); showTab('desempenho'); });

  // -----------------------------------------------------------------
  // ----- FUNÇÃO DE RESET (opcional, mas bom ter) -----
  // -----------------------------------------------------------------
  window.resetMyProgress = async () => {
    if (!userDocRef || !currentUser) {
      console.error("ERRO: Por favor, faça login primeiro.");
      return;
    }
    const resetData = {
      stats: { totalQuestions: 0, correct: 0, wrong: 0 },
      errorTopics: {},
      unreadMessagesFrom: {} // Zera as mensagens também
    };
    console.warn(`ATENÇÃO: Você está prestes a apagar TODO o progresso de '${currentUser}'.`);
    console.log("Se tem a certeza, copie e cole o seguinte comando e prima Enter:");
    console.log("%c window.confirmReset()", "background: #2d3436; color: #74b9ff; font-weight: bold; padding: 2px 5px; border-radius: 3px;");

    window.confirmReset = async () => {
      try {
        await userDocRef.update(resetData);
        console.log(`%cSUCESSO! O progresso de '${currentUser}' foi zerado.`, "color: #00b894; font-weight: bold; font-size: 1.2em;");
        loadPerformanceData();
        delete window.confirmReset;
      } catch (e) {
        console.error("Erro ao tentar zerar o progresso:", e);
      }
    };
  };

});
