/* ====== Lógica Principal com Firebase (COM CHAT, REAÇÕES e v8 CORRIGIDA) ====== */

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

// --- 3. LÓGICA DO APP (COM CHAT E REAÇÕES) ---

let currentUser = null;
let otherUser = null; 
let chatRoomId = null; 
let userDocRef = null; 
let otherUserDocRef = null; 

let stopPresenceListener = () => {};
let stopNotificationListener = () => {};
let stopMessagesListener = () => {};

const profilePics = {
  ithalo: '/video/ithalo.jpg',
  matheus: '/video/matheus.jpg'
};

let otherUserIsOnline = false;
let myUnreadCount = 0;

// NOVO: Guarda o timestamp da última reação para evitar repetições
let lastReactionTimestamp = null; 

// --- FUNÇÃO HELPER DE DATA ---
function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function getDateRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate.getTime());
  currentDate.setUTCHours(0, 0, 0, 0);
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

// Espera o HTML carregar
document.addEventListener('DOMContentLoaded', () => {
  
  // (Definição de todos os seus elementos HTML (userGate, chatHead, etc.))
  const userGate = document.getElementById('userGate');
  const userIthalo = document.getElementById('userIthalo');
  const userMatheus = document.getElementById('userMatheus');
  const mainContent = document.getElementById('mainContent');
  const currentUserDisplay = document.querySelector('#currentUserDisplay span');
  const navSimulado = document.getElementById('navSimulado');
  const navDesempenho = document.getElementById('navDesempenho');
  const quizContainer = document.getElementById('quizContainer');
  const desempenhoContainer = document.getElementById('desempenhoContainer');
  const chatHead = document.getElementById('chatHead');
  const chatHeadImg = document.querySelector('#chatHead img');
  const chatBadge = document.getElementById('chatBadge');
  const chatWidget = document.getElementById('chatWidget');
  const chatWithUser = document.getElementById('chatWithUser');
  const closeChatBtn = document.getElementById('closeChatBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatTextInput = document.getElementById('chatTextInput');
  const chatSendBtn = document.getElementById('chatSendBtn');


  // --- 1. SELEÇÃO DE UTILIZADOR ---
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
          unreadMessagesFrom: {},
          dailyPerformance: {},
          lastReaction: null // NOVO: Campo para reações
        });
      }

      if (userGate) userGate.style.display = 'none';
      if (mainContent) mainContent.style.display = 'block';
      
      if (typeof loadSubjects === 'function') {
        loadSubjects(userName);
        loadPDFs();
      }
      
      showTab('simulado');
      startPresenceHeartbeat();
      startChatListeners();
      
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
        lastActivity: firebase.firestore.FieldValue.serverTimestamp() 
      });
    } catch (e) {
      console.warn("Erro ao atualizar presença:", e.message);
    }
  }

  // --- 3. LÓGICA DE ESCUTA (MODIFICADA para Reações) ---
  
  function startChatListeners() {
    if (!otherUserDocRef || !userDocRef) return;
    
    stopPresenceListener(); 
    stopNotificationListener();

    // Listener 1: Escuta o OUTRO utilizador (para status online E REAÇÕES)
    stopPresenceListener = otherUserDocRef.onSnapshot((doc) => {
      let isOnline = false;
      if (doc.exists) {
        const data = doc.data();
        
        // --- LÓGICA DE PRESENÇA ---
        const lastActivity = data.lastActivity ? data.lastActivity.toDate() : null;
        if (lastActivity) {
          const now = new Date();
          const diffInSeconds = (now.getTime() - lastActivity.getTime()) / 1000;
          if (diffInSeconds < 60) {
            isOnline = true;
          }
        }
        
        // --- LÓGICA DE REAÇÃO (NOVO) ---
        const reaction = data.lastReaction;
        if (reaction && reaction.timestamp) {
          const reactionTime = reaction.timestamp.toDate();
          // Se a reação for nova (não a vimos antes)
          if (lastReactionTimestamp === null || reactionTime.getTime() > lastReactionTimestamp.getTime()) {
            lastReactionTimestamp = reactionTime; // Guarda o timestamp da última reação
            triggerEmojiFloat(reaction.type); // Dispara a animação
          }
        }
      }
      otherUserIsOnline = isOnline;
      updateChatHead();
    });
    
    // Listener 2: Escuta o MEU documento (para mensagens não lidas)
    stopNotificationListener = userDocRef.onSnapshot((doc) => {
      let unreadCount = 0;
      if (doc.exists) {
         const data = doc.data();
         const unreadMap = data.unreadMessagesFrom || {};
         unreadCount = unreadMap[otherUser] || 0;
      }
      myUnreadCount = unreadCount;
      updateChatHead();
    });
  }

  // --- 4. LÓGICA DE UI DO CHAT ---
  function updateChatHead() {
    // (Esta função permanece a mesma)
    if (otherUserIsOnline) {
      chatHead.style.display = 'block';
      chatHeadImg.src = profilePics[otherUser]; 
      
      if (myUnreadCount > 0) {
        chatBadge.textContent = myUnreadCount;
        chatBadge.style.display = 'flex';
      } else {
        chatBadge.style.display = 'none';
      }
    } else {
      chatHead.style.display = 'none';
      if (chatWidget) chatWidget.style.display = 'none';
    }
  }
  
  // (O resto da UI do chat: Abrir, Fechar - permanece o mesmo)
  chatHead.addEventListener('click', () => {
    chatWidget.style.display = 'flex';
    chatWithUser.textContent = `Chat com ${otherUser}`;
    listenForMessages();
    const myUnreadMapKey = `unreadMessagesFrom.${otherUser}`;
    userDocRef.update({ [myUnreadMapKey]: 0 });
  });
  closeChatBtn.addEventListener('click', () => {
    chatWidget.style.display = 'none';
    stopMessagesListener(); 
  });

  // --- 5. LÓGICA DE MENSAGENS E REAÇÕES ---
  
  function listenForMessages() {
    // (Esta função permanece a mesma)
    stopMessagesListener(); 
    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    const q = chatCollectionRef.orderBy("timestamp", "asc");
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
  
  async function sendMessage() {
    // (Esta função permanece a mesma)
    const text = chatTextInput.value;
    if (text.trim() === "") return;
    chatTextInput.value = ''; 
    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    await chatCollectionRef.add({
      senderId: currentUser,
      text: text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    const otherUserUnreadKey = `unreadMessagesFrom.${currentUser}`;
    await otherUserDocRef.update({
      [otherUserUnreadKey]: firebase.firestore.FieldValue.increment(1)
    });
  }

  chatSendBtn.addEventListener('click', sendMessage);
  chatTextInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
  
  // --- NOVA FUNÇÃO DE ENVIAR REAÇÃO ---
  // --- NOVA FUNÇÃO DE ENVIAR REAÇÃO (Corrigida) ---
  window.sendQuizReaction = async (isCorrect) => { // <-- "async" ESTÁ AQUI
    if (!userDocRef) return; 
    
    const reaction = {
      type: isCorrect ? 'correct' : 'wrong',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
      // Agora o "await" é válido
      await userDocRef.update({ 
        lastReaction: reaction
      });
    } catch (e) {
      console.error("Erro ao enviar reação:", e);
    }
  };
  
    }
  
  // --- NOVA FUNÇÃO DE ANIMAÇÃO DE EMOJI ---
  function triggerEmojiFloat(type) {
    const emojiContainer = document.getElementById('emojiContainer');
    if (!emojiContainer) return;

    const emoji = document.createElement('div');
    emoji.className = 'emoji-float';
    
    if (type === 'correct') {
      emoji.textContent = '👍'; // Ou '✅', '🎉'
    } else {
      emoji.textContent = '👎'; // Ou '❌', '😢'
    }
    
    emojiContainer.appendChild(emoji);
    
    // Remove o emoji após a animação (2 segundos, como no CSS)
    setTimeout(() => {
      emoji.remove();
    }, 2000);
  }


  // --- FUNÇÕES ANTIGAS (Salvamento de progresso, abas, etc.) ---
  
  window.saveQuestionProgress = async (questionData, isCorrect) => {
    // (Esta função permanece a mesma)
    if (!userDocRef) return; 
    const today = getTodayString();
    const statsKey = isCorrect ? 'correct' : 'wrong';
    let updateData = {
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    };
    updateData[`stats.${statsKey}`] = firebase.firestore.FieldValue.increment(1);
    updateData['stats.totalQuestions'] = firebase.firestore.FieldValue.increment(1);
    updateData[`dailyPerformance.${today}.${statsKey}`] = firebase.firestore.FieldValue.increment(1);
    if (!isCorrect && typeof getErrorTopic === 'function') {
      const topic = getErrorTopic(questionData, questionData.sourceFile);
      updateData[`errorTopics.${topic}`] = firebase.firestore.FieldValue.increment(1);
    }
    try {
      await userDocRef.update(updateData);
      console.log("Progresso detalhado salvo na nuvem!");
    } catch (e) {
      console.error("Erro ao salvar progresso:", e);
    }
  };

  function showTab(tabName) {
    // (Esta função permanece a mesma)
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
    // (Esta função permanece a mesma)
    if (!userDocRef) return;
    const snap = await userDocRef.get();
    if (!snap.exists) {
      console.error("Documento do usuário não encontrado.");
      return;
    }
    const data = snap.data();
    // (Gráfico 1 & 2 (Pizza e Barras))
    const stats = data.stats || { correct: 0, wrong: 0, totalQuestions: 0 };
    const unanswered = stats.totalQuestions - stats.correct - stats.wrong;
    const pizzaCtx = document.getElementById('totalPizzaChart');
    if (pizzaCtx) {
      if (window.Chart && pizzaCtx.chart) pizzaCtx.chart.destroy(); 
      pizzaCtx.chart = new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
          labels: ['Acertos', 'Erros', 'Não Respondidas (se houver)'],
          datasets: [{ data: [stats.correct, stats.wrong, unanswered], backgroundColor: ['#00b894', '#d63031', '#bdc3c7'], hoverOffset: 4 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }
    const barCtx = document.getElementById('totalBarChart');
    if (barCtx) {
        if (window.Chart && barCtx.chart) barCtx.chart.destroy(); 
        const errorTopics = data.errorTopics || {};
        const errorEntries = Object.entries(errorTopics).sort((a, b) => b[1] - a[1]);
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
            context.fillStyle = '#8b949e';
            context.font = "16px 'Poppins', sans-serif";
            context.fillText('Ainda não há dados de tópicos de erro.', barCtx.width / 2, barCtx.height / 2);
        }
    }
    // (Gráfico 3 (Linha do Tempo))
    const timeCtx = document.getElementById('timeSeriesChart');
    if (timeCtx) {
      if (window.Chart && timeCtx.chart) timeCtx.chart.destroy(); 
      const startDate = data.createdAt ? new Date(data.createdAt) : new Date("2025-11-13T12:00:00-03:00");
      const deadline = new Date("2025-12-13T12:00:00-03:00"); 
      const labels = getDateRange(startDate, deadline);
      const dailyData = data.dailyPerformance || {};
      let runningCorrect = 0;
      let runningTotal = 0;
      const performanceData = labels.map(date => {
        const day = dailyData[date];
        if (day) {
          runningCorrect += (day.correct || 0);
          runningTotal += (day.correct || 0) + (day.wrong || 0);
        }
        if (runningTotal === 0) return 0;
        return (runningCorrect / runningTotal) * 100;
      });
      timeCtx.chart = new Chart(timeCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Taxa de Acerto Acumulada (%)',
            data: performanceData,
            fill: true,
            borderColor: 'rgb(9, 132, 227)',
            backgroundColor: 'rgba(9, 132, 227, 0.1)',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function(value) { return value + '%' }
              }
            }
          }
        }
      });
    }
  }

  // --- Listeners de Abas ---
  if (navSimulado) navSimulado.addEventListener('click', (e) => { e.preventDefault(); showTab('simulado'); });
  if (navDesempenho) navDesempenho.addEventListener('click', (e) => { e.preventDefault(); showTab('desempenho'); });

  // --- Função de Reset ---
  window.resetMyProgress = async () => {
    // (Esta função permanece a mesma)
    if (!userDocRef || !currentUser) {
      console.error("ERRO: Por favor, faça login primeiro.");
      return;
    }
    const resetData = {
      stats: { totalQuestions: 0, correct: 0, wrong: 0 },
      errorTopics: {},
      unreadMessagesFrom: {},
      dailyPerformance: {},
      lastReaction: null // Zera as reações também
    };
    console.warn(`ATENÇÃO: Você está prestes a apagar TODO o progresso de '${currentUser}'.`);
    console.log("Se tem a certeza, copie e cole o seguinte comando e prima Enter:");
    console.log("%c window.confirmReset()", "background: #2d3436; color: #74b9ff; font-weight: bold; padding: 2px 5px; border-radius: 3px;");

    window.confirmReset = async () => {
      try {
        await userDocRef.set(resetData, { merge: true }); 
        console.log(`%cSUCESSO! O progresso de '${currentUser}' foi zerado.`, "color: #00b894; font-weight: bold; font-size: 1.2em;");
        loadPerformanceData();
        delete window.confirmReset;
      } catch (e) {
        console.error("Erro ao tentar zerar o progresso:", e);
      }
    };
  };

});
