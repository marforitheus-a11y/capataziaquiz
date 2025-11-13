/* ====== Lógica Principal com Firebase (COM CHAT) ====== */

// --- 1. PEGAR MÓDULOS DO FIREBASE (Forma Clássica) ---
const { initializeApp } = firebase;
// ADICIONADO: 'firebase.firestore.FieldValue' para o 'increment'
const { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, serverTimestamp, query, orderBy, increment } = firebase.firestore;

// --- 2. CONFIGURAÇÃO DO FIREBASE ---
// ======================================================
// ===== COLE A SUA 'firebaseConfig' DO FIREBASE AQUI =====
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
// ======================================================

// --- 3. INICIALIZAÇÃO DO FIREBASE (Sintaxe v8/compat) ---
let db;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log("Firebase conectado com sucesso!"); 
} catch (error) {
  console.error("Erro ao inicializar o Firebase:", error);
  alert("Falha crítica ao conectar com o banco de dados. Verifique o console (F12) e a sua 'firebaseConfig' no app.js.");
}

// --- 4. LÓGICA DO APP (COM CHAT) ---

let currentUser = null;
let otherUser = null; // NOVO: Nome do outro utilizador
let chatRoomId = null; // NOVO: ID da sala de chat
let userDocRef = null; 
let otherUserDocRef = null; // NOVO: Referência para o doc do outro utilizador

// NOVO: Variáveis para parar os 'listeners' quando o utilizador sai
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
    // Define quem é o *outro* utilizador
    otherUser = (currentUser === 'ithalo') ? 'matheus' : 'ithalo';
    
    // Cria um ID de sala de chat único e consistente
    // (Ex: 'ithalo_matheus')
    chatRoomId = [currentUser, otherUser].sort().join('_');
    
    if (currentUserDisplay) currentUserDisplay.textContent = userName;
    
    // Define as referências dos documentos
    userDocRef = db.collection("users").doc(currentUser); 
    otherUserDocRef = db.collection("users").doc(otherUser);
    
    if (userGate) userGate.style.opacity = 0.5;

    try {
      const docSnap = await userDocRef.get();
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          name: userName,
          createdAt: new Date().toISOString(),
          stats: { totalQuestions: 0, correct: 0, wrong: 0 },
          errorTopics: {},
          unreadMessagesFrom: {} // NOVO: Mapa de mensagens não lidas
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
  
  // Atualiza o 'lastActivity' a cada 20 segundos
  function startPresenceHeartbeat() {
    // Atualiza imediatamente ao logar
    updatePresence(); 
    // E depois atualiza a cada 20 segundos
    setInterval(updatePresence, 20000); 
  }
  
  async function updatePresence() {
    if (!userDocRef) return;
    try {
      // Atualiza o timestamp de atividade
      await userDocRef.update({
        lastActivity: serverTimestamp() 
      });
    } catch (e) {
      console.warn("Erro ao atualizar presença:", e.message);
    }
  }

  // --- 3. LÓGICA DE ESCUTA (Outro Utilizador) ---
  
  // Escuta as mudanças no documento DO OUTRO UTILIZADOR
  function listenToOtherUser() {
    if (!otherUserDocRef) return;
    
    // Cancela qualquer listener antigo
    stopPresenceListener(); 
    
    // Inicia um novo listener
    stopPresenceListener = onSnapshot(otherUserDocRef, (doc) => {
      if (!doc.exists()) {
        chatHead.style.display = 'none'; // Outro utilizador não tem doc
        return;
      }
      
      const data = doc.data();
      
      // 1. Verificar Presença
      const lastActivity = data.lastActivity ? data.lastActivity.toDate() : null;
      let isOnline = false;
      if (lastActivity) {
        const now = new Date();
        const diffInSeconds = (now.getTime() - lastActivity.getTime()) / 1000;
        // Considera "online" se a atividade foi nos últimos 60 segundos
        if (diffInSeconds < 60) {
          isOnline = true;
        }
      }
      
      // 2. Verificar Mensagens Não Lidas
      const unreadMap = data.unreadMessagesFrom || {};
      // Quantas mensagens o 'currentUser' enviou que o 'otherUser' ainda não leu
      const unreadCount = unreadMap[currentUser] || 0; 
      
      // 3. Atualizar a UI
      updateChatHead(isOnline, unreadCount);
    });
  }

  // --- 4. LÓGICA DE UI DO CHAT ---
  
  // Mostra/esconde o ícone e a contagem
  function updateChatHead(isOnline, unreadCount) {
    if (isOnline) {
      chatHead.style.display = 'block';
      chatHeadImg.src = profilePics[otherUser]; // Define a foto
      
      if (unreadCount > 0) {
        chatBadge.textContent = unreadCount;
        chatBadge.style.display = 'flex';
      } else {
        chatBadge.style.display = 'none';
      }
    } else {
      chatHead.style.display = 'none';
      // Se o outro utilizador fica offline, fecha o chat
      if (chatWidget) chatWidget.style.display = 'none';
    }
  }
  
  // Abrir o Chat
  chatHead.addEventListener('click', () => {
    chatWidget.style.display = 'flex';
    chatWithUser.textContent = `Chat com ${otherUser}`;
    
    // Começa a escutar as mensagens
    listenForMessages();
    
    // Zera a contagem de mensagens NÃO LIDAS
    // (Atenção: isto zera no *MEU* documento, não no do outro)
    const myUnreadMapKey = `unreadMessagesFrom.${otherUser}`; // ex: unreadMessagesFrom.matheus
    userDocRef.update({
      [myUnreadMapKey]: 0
    });
  });

  // Fechar o Chat
  closeChatBtn.addEventListener('click', () => {
    chatWidget.style.display = 'none';
    stopMessagesListener(); // Para de escutar as mensagens
  });
  
  // --- 5. LÓGICA DE MENSAGENS (Enviar/Receber) ---
  
  // Escuta a coleção de mensagens
  function listenForMessages() {
    stopMessagesListener(); // Para o listener antigo
    
    const chatCollectionRef = collection(db, "chats", chatRoomId, "messages");
    // Cria uma query para ordenar por 'timestamp'
    const q = query(chatCollectionRef, orderBy("timestamp", "asc"));

    stopMessagesListener = onSnapshot(q, (querySnapshot) => {
      chatMessages.innerHTML = ''; // Limpa as mensagens antigas
      querySnapshot.forEach((doc) => {
        const msg = doc.data();
        
        // Cria o balão da mensagem
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.textContent = msg.text;
        
        // Aplica o estilo (enviada ou recebida)
        if (msg.senderId === currentUser) {
          bubble.classList.add('msg-sent');
        } else {
          bubble.classList.add('msg-received');
        }
        
        chatMessages.appendChild(bubble);
      });
      
      // Rola para a mensagem mais recente
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }
  
  // Enviar Mensagem
  async function sendMessage() {
    const text = chatTextInput.value;
    if (text.trim() === "") return;
    
    chatTextInput.value = ''; // Limpa o input

    // 1. Adiciona a mensagem à coleção
    const chatCollectionRef = collection(db, "chats", chatRoomId, "messages");
    await addDoc(chatCollectionRef, {
      senderId: currentUser,
      text: text,
      timestamp: serverTimestamp()
    });
    
    // 2. Incrementa a contagem de "não lidos" DO OUTRO UTILIZADOR
    const otherUserUnreadKey = `unreadMessagesFrom.${currentUser}`; // ex: unreadMessagesFrom.ithalo
    await updateDoc(otherUserDocRef, {
      [otherUserUnreadKey]: increment(1)
    });
  }

  chatSendBtn.addEventListener('click', sendMessage);
  // Permite enviar com 'Enter'
  chatTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });


  // --- FUNÇÕES ANTIGAS (Salvamento de progresso, abas, etc.) ---
  
  // (O seu código 'window.saveQuestionProgress', 'showTab', 'loadPerformanceData' 
  // e os listeners das abas vêm aqui, sem alterações)

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
        lastActivity: new Date().toISOString()
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

});
