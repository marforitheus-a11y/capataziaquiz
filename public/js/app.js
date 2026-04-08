/* ====== Lógica Principal (COM CHAT V5 + DESAFIO V1) ====== */

// --- 1. CONFIGURAÇÃO DO FIREBASE ---
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
let storage;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  storage = firebase.storage();
  console.log("Firebase conectado com sucesso!"); 
} catch (error) {
  console.error("Erro ao inicializar o Firebase:", error);
  alert("Falha crítica ao conectar com o banco de dados. Verifique o console (F12) e a sua 'firebaseConfig' no app.js.");
}

// --- 3. LÓGICA DO APP (GLOBAL VARS) ---

let currentUser = null;
let otherUser = null; 
let activeChatTarget = null; // userId ou "group"
let chatRoomId = null; 
let userDocRef = null; 
let otherUserDocRef = null; 

let stopPresenceListener = () => {};
let stopGroupPresenceListeners = [];
let stopNotificationListener = () => {};
let stopMessagesListener = () => {};

const profilePics = {
  matheus: '/video/matheus.jpg',
  hugo: 'https://placehold.co/220x220/74b9ff/FFFFFF?text=Hugo',
  lucao: 'https://placehold.co/220x220/00b894/FFFFFF?text=Lucao',
  group: 'https://placehold.co/220x220/6c5ce7/FFFFFF?text=Grupo'
};

const supportedUsers = ['matheus', 'hugo', 'lucao'];

let otherUserIsOnline = false;
let myUnreadCount = 0;
let lastReactionTimestamp = null; 

const notificationSound = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");

// --- NOVAS VARS GLOBAIS DE DESAFIO ---
let activeChallengeId = null;
let stopChallengeListener = () => {}; 


// --- FUNÇÕES HELPER DE DATA ---
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
function formatTimestamp(fbTimestamp) {
  if (!fbTimestamp) return '';
  try {
    const date = fbTimestamp.toDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch (e) {
    console.error("Erro ao formatar timestamp:", e);
    return '';
  }
}

function getDirectChatRoomId(userA, userB) {
  return [userA, userB].sort().join('_');
}

function getGroupChatRoomId() {
  return `group_${[...supportedUsers].sort().join('_')}`;
}

// ======================================================
// --- O "CÉREBRO" DO APP - TUDO DENTRO DE DOMCONTENTLOADED ---
// ======================================================

document.addEventListener('DOMContentLoaded', () => {
  
  // --- 1. Seleção de Elementos ---
  const userGate = document.getElementById('userGate');
  const userMatheus = document.getElementById('userMatheus');
  const userHugo = document.getElementById('userHugo');
  const userLucao = document.getElementById('userLucao');
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
  const chatTargetSelect = document.getElementById('chatTargetSelect');
  const closeChatBtn = document.getElementById('closeChatBtn');
  const chatMessages = document.getElementById('chatMessages');
  const chatTextInput = document.getElementById('chatTextInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatUploadBtn = document.getElementById('chatUploadBtn');
  const imageUploadInput = document.getElementById('imageUpload');
  
  // NOVO ELEMENTO
  const challengeBtn = document.getElementById('challengeBtn');

  
  // --- 2. Lógica de Login ---


  async function resetAllUserStatsIfNeeded() {
    if (!db) return;

    const resetVersion = 'gcm-stats-reset-2026-04-08';
    const settingsRef = db.collection('appSettings').doc('global');

    try {
      const settingsSnap = await settingsRef.get();
      if (settingsSnap.exists && settingsSnap.data().statsResetVersion === resetVersion) {
        return;
      }

      const batch = db.batch();
      supportedUsers.forEach((userId) => {
        const userRef = db.collection('users').doc(userId);
        batch.set(userRef, {
          stats: { totalQuestions: 0, correct: 0, wrong: 0 },
          errorTopics: {},
          dailyPerformance: {},
          resetAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      batch.set(settingsRef, {
        statsResetVersion: resetVersion,
        statsResetAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();
      console.log('Estatísticas antigas zeradas para a nova fase do simulado.');
    } catch (error) {
      console.error('Erro ao resetar estatísticas globais:', error);
    }
  }

  function getAvailableChatTargets() {
    if (!currentUser) return [];
    const directTargets = supportedUsers
      .filter((userId) => userId !== currentUser)
      .map((userId) => ({ id: userId, label: `Conversa com ${userId}` }));
    return [...directTargets, { id: 'group', label: 'Chat em grupo' }];
  }

  function populateChatTargetOptions() {
    if (!chatTargetSelect) return;
    const targets = getAvailableChatTargets();
    chatTargetSelect.innerHTML = targets
      .map((target) => `<option value="${target.id}">${target.label}</option>`)
      .join('');
  }

  function setChatContext(targetId) {
    activeChatTarget = targetId;
    if (targetId === 'group') {
      otherUser = null;
      otherUserDocRef = null;
      chatRoomId = getGroupChatRoomId();
      return;
    }

    otherUser = targetId;
    otherUserDocRef = db.collection("users").doc(otherUser);
    chatRoomId = getDirectChatRoomId(currentUser, otherUser);
  }

  async function selectUser(userName) {
    if (!db) return;
    currentUser = userName;
    const defaultTarget = supportedUsers.find((user) => user !== currentUser);
    populateChatTargetOptions();
    if (chatTargetSelect) chatTargetSelect.value = defaultTarget;
    setChatContext(defaultTarget);
    if (currentUserDisplay) currentUserDisplay.textContent = userName;
    userDocRef = db.collection("users").doc(currentUser); 
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
          lastReaction: null 
        });
      }
      await resetAllUserStatsIfNeeded();
      if (userGate) userGate.style.display = 'none';
      if (mainContent) mainContent.style.display = 'block';
      if (typeof loadSubjects === 'function') {
        loadSubjects(userName);
        loadPDFs();
      }
      showTab('simulado');
      startPresenceHeartbeat();
      startChatListeners();
      updateChatHead();
      listenForChallenges(); // NOVO: Começa a ouvir por desafios
    } catch (error) {
      console.error("Erro ao conectar no Firebase (Firestore):", error);
      alert("Erro de conexão. Verifique sua internet ou as regras do Firestore.");
      if (userGate) userGate.style.opacity = 1;
    }
  }
  if (userMatheus) userMatheus.addEventListener('click', () => selectUser('matheus'));
  if (userHugo) userHugo.addEventListener('click', () => selectUser('hugo'));
  if (userLucao) userLucao.addEventListener('click', () => selectUser('lucao'));

  // --- 3. Lógica de Presença ---
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

  // --- 4. Lógica de Chat ---
  function startChatListeners() {
    if (!userDocRef || !chatRoomId) return;
    
    stopPresenceListener(); 
    stopGroupPresenceListeners.forEach((stopFn) => stopFn());
    stopGroupPresenceListeners = [];
    stopNotificationListener();

    if (activeChatTarget === 'group') {
      const otherUsers = supportedUsers.filter((userId) => userId !== currentUser);
      const onlineMap = {};
      otherUsers.forEach((userId) => {
        const ref = db.collection("users").doc(userId);
        const stopFn = ref.onSnapshot((doc) => {
          let isOnline = false;
          if (doc.exists) {
            const data = doc.data();
            const lastActivity = data.lastActivity ? data.lastActivity.toDate() : null;
            if (lastActivity) {
              const now = new Date();
              const diffInSeconds = (now.getTime() - lastActivity.getTime()) / 1000;
              if (diffInSeconds < 60) isOnline = true;
            }
          }
          onlineMap[userId] = isOnline;
          otherUserIsOnline = Object.values(onlineMap).some(Boolean);
          updateChatHead();
        });
        stopGroupPresenceListeners.push(stopFn);
      });
    } else if (otherUserDocRef) {
      stopPresenceListener = otherUserDocRef.onSnapshot((doc) => {
        let isOnline = false;
        if (doc.exists) {
          const data = doc.data();
          const lastActivity = data.lastActivity ? data.lastActivity.toDate() : null;
          if (lastActivity) {
            const now = new Date();
            const diffInSeconds = (now.getTime() - lastActivity.getTime()) / 1000;
            if (diffInSeconds < 60) {
              isOnline = true;
            }
          }
          
          const reaction = data.lastReaction;
          if (reaction && reaction.timestamp) {
            const reactionTime = reaction.timestamp.toDate();
            if (lastReactionTimestamp === null || reactionTime.getTime() > lastReactionTimestamp.getTime()) {
              lastReactionTimestamp = reactionTime; 
              triggerEmojiFloat(reaction.type); 
            }
          }
        }
        otherUserIsOnline = isOnline;
        updateChatHead();
      });
    }
    
    stopNotificationListener = userDocRef.onSnapshot((doc) => {
      let unreadCount = 0;
      if (doc.exists) {
         const data = doc.data();
         const unreadChats = data.unreadChats || {};
         const unreadMap = data.unreadMessagesFrom || {};
         unreadCount = unreadChats[chatRoomId] || ((activeChatTarget !== 'group' && otherUser) ? (unreadMap[otherUser] || 0) : 0);
         
         if (unreadCount > myUnreadCount) {
           if (chatWidget.style.display === 'none') {
             notificationSound.play().catch(e => console.warn("Erro ao tocar som:", e));
           }
         }
      }
      myUnreadCount = unreadCount;
      updateChatHead();
    });
  }

  function updateChatHead() {
    const indicator = document.getElementById('chatOnlineIndicator');

    if (!chatHead || !chatHeadImg || !chatBadge || !activeChatTarget) return;

    chatHead.style.display = 'block';
    chatHeadImg.src = profilePics[activeChatTarget] || profilePics.group;
    if (indicator) {
      if (otherUserIsOnline) indicator.classList.add('online');
      else indicator.classList.remove('online');
    }
    
    if (myUnreadCount > 0) {
      chatBadge.textContent = myUnreadCount;
      chatBadge.style.display = 'flex';
    } else {
      chatBadge.style.display = 'none';
    }
  }
  
  if (chatTargetSelect) chatTargetSelect.addEventListener('change', async (e) => {
    if (!currentUser) return;
    setChatContext(e.target.value);
    myUnreadCount = 0;
    startChatListeners();
    updateChatHead();
    if (chatWidget.style.display !== 'none') {
      chatWithUser.textContent = activeChatTarget === 'group' ? 'Chat em grupo' : `Chat com ${otherUser}`;
      listenForMessages();
      const unreadChatKey = `unreadChats.${chatRoomId}`;
      await userDocRef.update({ [unreadChatKey]: 0 });
      if (otherUser) {
        const myUnreadMapKey = `unreadMessagesFrom.${otherUser}`;
        await userDocRef.update({ [myUnreadMapKey]: 0 });
        markMessagesAsRead();
      }
    }
  });

  if (chatHead) chatHead.addEventListener('click', () => {
    chatWidget.style.display = 'flex';
    chatWithUser.textContent = activeChatTarget === 'group' ? 'Chat em grupo' : `Chat com ${otherUser}`;
    listenForMessages();
    const unreadChatKey = `unreadChats.${chatRoomId}`;
    userDocRef.update({ [unreadChatKey]: 0 });
    if (otherUser) {
      const myUnreadMapKey = `unreadMessagesFrom.${otherUser}`;
      userDocRef.update({ [myUnreadMapKey]: 0 });
      markMessagesAsRead();
    }
  });
  
  if (closeChatBtn) closeChatBtn.addEventListener('click', () => {
    chatWidget.style.display = 'none';
    stopMessagesListener(); 
  });

  function listenForMessages() {
    stopMessagesListener(); 
    if (!chatRoomId) return;
    const isGroupChat = activeChatTarget === 'group';
    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    const q = chatCollectionRef.orderBy("timestamp", "asc");

    stopMessagesListener = q.onSnapshot((querySnapshot) => {
      chatMessages.innerHTML = ''; 
      const messagesToMarkDelivered = [];
      querySnapshot.forEach((doc) => {
        const msg = doc.data();
        const msgId = doc.id; 
        const msgRow = document.createElement('div');
        msgRow.className = 'msg-row';
        const avatar = document.createElement('img');
        avatar.className = 'msg-avatar';
        avatar.src = profilePics[msg.senderId] || profilePics.matheus; 
        const msgContent = document.createElement('div');
        msgContent.className = 'msg-content';
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        const meta = document.createElement('div');
        meta.className = 'msg-meta';
        const timestamp = document.createElement('span');
        timestamp.className = 'msg-timestamp';
        timestamp.textContent = formatTimestamp(msg.timestamp);

        if (msg.type === 'image') {
          bubble.classList.add('msg-image');
          const img = document.createElement('img');
          img.src = msg.imageUrl;
          img.alt = 'Imagem enviada';
          img.onclick = () => window.open(msg.imageUrl, '_blank');
          bubble.appendChild(img);
        } else {
          bubble.textContent = msg.text;
        }
        
        meta.appendChild(timestamp);
        
        if (msg.senderId === currentUser) {
          msgRow.classList.add('sent');
          if (!isGroupChat) {
            const status = document.createElement('span');
            status.className = 'msg-status';
            if (msg.status === 'read') {
              status.textContent = '✓✓';
              status.classList.add('read'); 
            } else if (msg.status === 'delivered') {
              status.textContent = '✓✓';
            } else {
              status.textContent = '✓'; 
            }
            meta.appendChild(status);
          }
        } else {
          msgRow.classList.add('received');
          msgRow.appendChild(avatar);
          if (!isGroupChat && msg.status === 'sent') {
            messagesToMarkDelivered.push(msgId);
          }
        }
        msgContent.appendChild(bubble);
        msgContent.appendChild(meta);
        msgRow.appendChild(msgContent);
        chatMessages.appendChild(msgRow);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
      if (messagesToMarkDelivered.length > 0) {
        markMessagesAsDelivered(messagesToMarkDelivered);
      }
    });
  }
  
  async function markMessagesAsDelivered(messageIds) {
    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    const batch = db.batch();
    messageIds.forEach(id => {
      const msgRef = chatCollectionRef.doc(id);
      batch.update(msgRef, { status: 'delivered' });
    });
    try {
      await batch.commit();
    } catch (e) {
      console.error("Erro ao marcar 'delivered':", e);
    }
  }

  async function markMessagesAsRead() {
    if (!otherUser) return;
    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    const q = chatCollectionRef.where('senderId', '==', otherUser).where('status', '!=', 'read');
    try {
      const querySnapshot = await q.get();
      if (querySnapshot.empty) return;
      const batch = db.batch();
      querySnapshot.forEach(doc => {
        batch.update(doc.ref, { status: 'read' });
      });
      await batch.commit();
    } catch (e) {
      console.error("Erro ao marcar 'read':", e);
    }
  }
  
  function getRecipientsForActiveChat() {
    if (!currentUser) return [];
    if (activeChatTarget === 'group') {
      return supportedUsers.filter((userId) => userId !== currentUser);
    }
    return otherUser ? [otherUser] : [];
  }

  async function addMessageToDb(messageData) {
    if (!db || !chatRoomId) return;
    const recipients = getRecipientsForActiveChat();
    if (recipients.length === 0) return;
    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    await chatCollectionRef.add({
      ...messageData, 
      status: 'sent', 
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    const batch = db.batch();
    recipients.forEach((recipientId) => {
      const recipientRef = db.collection("users").doc(recipientId);
      batch.set(recipientRef, {
        unreadMessagesFrom: {
          [currentUser]: firebase.firestore.FieldValue.increment(1)
        },
        unreadChats: {
          [chatRoomId]: firebase.firestore.FieldValue.increment(1)
        }
      }, { merge: true });
    });
    await batch.commit();
  }
  
  async function sendTextMessage() {
    const text = chatTextInput.value;
    if (text.trim() === "") return;
    chatTextInput.value = ''; 
    await addMessageToDb({
      senderId: currentUser,
      text: text,
      type: 'text'
    });
    chatTextInput.style.height = 'auto'; // Reseta altura
  }
  
  async function uploadImage(file) {
    if (!file || !storage || !chatRoomId) return;
    const timestamp = Date.now();
    const storageRef = storage.ref(`chats/${chatRoomId}/${timestamp}-${file.name}`);
    const tempId = `temp_${timestamp}`;
    chatMessages.innerHTML += `<div class="msg-row sent"><div class="msg-content"><div class="msg-bubble" id="${tempId}">Enviando imagem...</div></div></div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    const task = storageRef.put(file); 
    task.on('state_changed', 
      (snapshot) => {}, 
      (error) => {
        document.getElementById(tempId).textContent = "Falha no envio.";
      }, 
      async () => {
        const downloadURL = await task.snapshot.ref.getDownloadURL();
        await addMessageToDb({
          senderId: currentUser,
          type: 'image',
          imageUrl: downloadURL
        });
        const tempBubble = document.getElementById(tempId);
        if (tempBubble) tempBubble.closest('.msg-row').remove();
      }
    );
  }

  function autoGrowTextarea(e) {
    const el = e.target;
    el.style.height = 'auto';                  
    el.style.height = el.scrollHeight + 'px';  
  }

  function handleInput(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  }

  if (chatSendBtn) chatSendBtn.addEventListener('click', sendTextMessage);
  if (chatTextInput) {
    chatTextInput.addEventListener('keypress', handleInput);
    chatTextInput.addEventListener('input', autoGrowTextarea);
  }
  if (chatUploadBtn) chatUploadBtn.addEventListener('click', () => {
    if (imageUploadInput) imageUploadInput.click();
  });
  if (imageUploadInput) imageUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadImage(file);
    }
    e.target.value = null; 
  });

  // --- 5. Lógica de Reações ---
  window.sendQuizReaction = async (isCorrect) => { 
    if (!userDocRef) return; 
    const reaction = {
      type: isCorrect ? 'correct' : 'wrong',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      await userDocRef.update({ 
        lastReaction: reaction
      });
    } catch (e) {
      console.error("Erro ao enviar reação:", e);
    }
  };

  function triggerEmojiFloat(type) {
    const emojiContainer = document.getElementById('emojiContainer');
    if (!emojiContainer) return;
    const emoji = document.createElement('div');
    emoji.className = 'emoji-float';
    emoji.textContent = (type === 'correct') ? '👍' : '👎';
    emojiContainer.appendChild(emoji);
    setTimeout(() => {
      emoji.remove();
    }, 2000);
  }

  // --- 6. Lógica de Navegação e Desempenho ---
  window.saveQuestionProgress = async (questionData, isCorrect) => {
    if (!userDocRef) return; 
    const today = getTodayString();
    const statsKey = isCorrect ? 'correct' : 'wrong';
    let updateData = {
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    };
    updateData[`stats.${statsKey}`] = firebase.firestore.FieldValue.increment(1);
    updateData['stats.totalQuestions'] = firebase.firestore.FieldValue.increment(1);
    updateData[`dailyPerformance.${today}.${statsKey}`] = firebase.firestore.FieldValue.increment(1);
    
    // Assegura que getErrorTopic existe (está em helpers.js)
    if (!isCorrect && typeof getErrorTopic === 'function') {
      const topic = getErrorTopic(questionData, questionData.sourceFile);
      updateData[`errorTopics.${topic}`] = firebase.firestore.FieldValue.increment(1);
    }
    try {
      await userDocRef.update(updateData);
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
    if (!snap.exists) return;
    const data = snap.data();
    
    // Gráfico 1 & 2 (Pizza e Barras)
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
              responsive: true, plugins: { legend: { display: false } },
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
    // Gráfico 3 (Linha do Tempo)
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
          responsive: true, plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true, max: 100,
              ticks: { callback: function(value) { return value + '%' } }
            }
          }
        }
      });
    }
  }

  if (navSimulado) navSimulado.addEventListener('click', (e) => { e.preventDefault(); showTab('simulado'); });
  if (navDesempenho) navDesempenho.addEventListener('click', (e) => { e.preventDefault(); showTab('desempenho'); });

  // --- 7. Lógica de Desafio (NOVO) ---
  
  if (challengeBtn) {
    challengeBtn.addEventListener('click', showChallengeSetup);
  }
  
  /**
   * 1. Mostra a tela de configuração do desafio
   */
  function showChallengeSetup() {
      if (!window.selectedSubjects || window.selectedSubjects.length === 0) {
          return alert('Selecione pelo menos uma matéria para desafiar!');
      }
      
      const subjects = window.selectedSubjects.map(s => s.name).join(', ');
      const count = document.getElementById('questionCount').value || 10;
      
      const content = `
          <p>Você está desafiando <strong>${otherUser}</strong> para:</p>
          <p><strong>Matérias:</strong> ${subjects}</p>
          <p><strong>Questões:</strong> <input type="number" id="challenge_count" value="${count}" style="width: 80px;"></p>
          <p><strong>Tempo (min):</strong> <input type="number" id="challenge_time" value="5" style="width: 80px;"></p>
          <button id="sendChallengeBtn" style="width: 100%; margin-top: 15px; padding: 12px;">Enviar Desafio</button>
      `;
      showChallengeModal("Configurar Desafio", content); // Função do ui.js
      
      // Adiciona o listener ao botão DENTRO do modal
      document.getElementById('sendChallengeBtn').onclick = () => {
          const settings = {
              subjects: window.selectedSubjects, 
              count: parseInt(document.getElementById('challenge_count').value),
              time: parseInt(document.getElementById('challenge_time').value)
          };
          createChallenge(settings);
      };
  }

  /**
   * 2. (CRIADOR) Cria o desafio no Firestore
   */
  async function createChallenge(settings) {
      if (!db) return;
      
      const challengeId = `${[currentUser, otherUser].sort().join('_')}_${Date.now()}`;
      activeChallengeId = challengeId;
      
      const challengeDoc = {
          createdBy: currentUser,
          invited: otherUser,
          status: 'pending', 
          settings: settings,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          questions: [],
          answers: { [currentUser]: {}, [otherUser]: {} },
          finisher: null
      };
      
      try {
          await db.collection('challenges').doc(challengeId).set(challengeDoc);
          showChallengeModal("Desafio Enviado", `<p>Aguardando ${otherUser} aceitar...</p>`);
          listenToActiveGame(challengeId); // Começa a ouvir o jogo
      } catch (e) {
          console.error("Erro ao criar desafio:", e);
          alert("Erro ao enviar desafio.");
          hideChallengeModal();
      }
  }

  /**
   * 3. (AMBOS) Escuta por convites ou mudanças de estado
   */
  function listenForChallenges() {
      if (!db || !currentUser) return; 
      
      // Escuta por desafios ONDE EU SOU O CONVIDADO e que estão PENDENTES
      db.collection('challenges')
        .where('invited', '==', currentUser)
        .where('status', '==', 'pending')
        .onSnapshot((snapshot) => {
            if (snapshot.empty) return;
            
            const challenge = snapshot.docs[snapshot.docs.length - 1].data();
            const challengeId = snapshot.docs[snapshot.docs.length - 1].id;
            
            if (activeChallengeId) return; // Já estou em um desafio
            
            const settings = challenge.settings;
            const content = `
                <p><strong>${challenge.createdBy}</strong> está te desafiando!</p>
                <p><strong>Matérias:</strong> ${settings.subjects.map(s => s.name).join(', ')}</p>
                <p><strong>Questões:</strong> ${settings.count}</p>
                <p><strong>Tempo:</strong> ${settings.time} min</p>
                <div style="display:flex; gap: 10px; margin-top: 20px;">
                    <button id="acceptBtn" style="flex:1; padding: 12px;">Aceitar</button>
                    <button id="rejectBtn" class="button-ghost" style="flex:1; padding: 12px;">Recusar</button>
                </div>
            `;
            showChallengeModal("Novo Desafio!", content); // Função do ui.js
            
            document.getElementById('acceptBtn').onclick = () => joinChallenge(challengeId);
            document.getElementById('rejectBtn').onclick = () => rejectChallenge(challengeId);
        });
  }

  /**
   * 4. (CONVIDADO) Aceita o desafio
   */
  async function joinChallenge(challengeId) {
      activeChallengeId = challengeId;
      showChallengeModal("Desafio Aceito!", `<p>Aguardando ${otherUser} iniciar e carregar as questões...</p>`);
      
      try {
          await db.collection('challenges').doc(challengeId).update({ status: 'accepted' });
          listenToActiveGame(challengeId); // Começa a ouvir o jogo
      } catch (e) {
          console.error("Erro ao aceitar desafio:", e);
      }
  }

  async function rejectChallenge(challengeId) {
    if (!db) return;
    try {
        await db.collection('challenges').doc(challengeId).update({ status: 'rejected' });
    } catch (e) {
        console.error("Erro ao rejeitar desafio:", e);
    }
    hideChallengeModal();
  }


  /**
   * 5. (CRIADOR) Carrega as questões e inicia o jogo
   */
  async function loadQuestionsAndStartGame(challengeId, settings) {
      console.log("Criador está carregando as questões...");
      try {
          // A função 'loadQuizFile' está no 'main.js'
          if (typeof loadQuizFile !== 'function') {
              console.error("loadQuizFile não está definida!");
              return;
          }

          const allFilesData = await Promise.all(
            settings.subjects.map(async (sub) => {
              const questionsArray = await loadQuizFile(sub.file); 
              return questionsArray.map(question => ({
                ...question,
                sourceFile: sub.file 
              }));
            })
          );
          
          const combinedQuestions = allFilesData.flat();
          const shuffled = combinedQuestions.sort(() => 0.5 - Math.random());
          const finalQuestions = shuffled.slice(0, settings.count);
          
          await db.collection('challenges').doc(challengeId).update({
              questions: finalQuestions,
              status: 'active'
          });
          
      } catch (e) {
          console.error("Erro ao carregar questões para o desafio:", e);
      }
  }

  /**
   * 6. (AMBOS) Listener principal do jogo
   */
  function listenToActiveGame(challengeId) {
      stopChallengeListener(); 
      
      stopChallengeListener = db.collection('challenges').doc(challengeId).onSnapshot(async (doc) => {
          if (!doc.exists) {
            console.warn("Desafio foi deletado.");
            stopChallengeListener();
            return;
          }
          
          const challenge = doc.data();
          
          // EVENTO 1: CRIADOR VIU QUE O CONVIDADO ACEITOU
          if (challenge.status === 'accepted' && challenge.createdBy === currentUser) {
              await loadQuestionsAndStartGame(challengeId, challenge.settings);
          }
          
          // EVENTO 2: JOGO INICIOU (Status mudou para 'active')
          // A var 'quizMode' vem do 'main.js'
          if (challenge.status === 'active' && quizMode !== 'challenge') {
              hideChallengeModal(); // Função do ui.js
              // Função do main.js
              startChallengeQuiz(challenge.questions, challenge.settings.time * 60); 
          }
          
          // EVENTO 3: O OPONENTE TERMINOU (Status 'finished')
          if (challenge.status === 'finished') {
              stopChallengeListener();
              stopTimer(); // Função do main.js
              
              if (quizMode === 'challenge') { 
                  // 'userAnswers' vem do main.js
                  await window.finishChallenge(userAnswers); 
              }
              
              showChallengeResults(challenge); // Função do ui.js
          }
      });
  }

  /**
   * 7. (AMBOS) Finaliza o desafio (exposto globalmente)
   */
  window.finishChallenge = async (myAnswers) => {
      if (!activeChallengeId || (quizMode !== 'challenge' && quizMode !== 'finished')) {
          if (quizMode !== 'finished') {
             console.warn("finishChallenge chamado mas o modo não é 'challenge'");
          }
          return; 
      }
      
      // Evita duplo envio
      if (quizMode === 'finished') return; 
      
      console.log("Enviando respostas do desafio...");
      quizMode = 'finished'; // Marca como finalizado localmente
      
      const challengeRef = db.collection('challenges').doc(activeChallengeId);
      const answerKey = `answers.${currentUser}`;
      
      try {
          await challengeRef.update({
              [answerKey]: myAnswers
          });
          
          const doc = await challengeRef.get();
          if (!doc.exists) return; 
          const challenge = doc.data();
          
          if (!challenge.finisher) {
              // Eu sou o primeiro!
              await challengeRef.update({
                  finisher: currentUser
              });
              // Agora eu espero o listener (listenToActiveGame) me avisar quando o outro terminar
          } else {
              // Eu sou o segundo, o jogo acabou.
              await challengeRef.update({
                  status: 'finished'
              });
              // O listener vai pegar essa mudança e chamar showChallengeResults
          }
          
      } catch (e) {
          console.error("Erro ao finalizar desafio:", e);
      }
  }


  // --- 8. Função de Reset (Miscelânea) ---
  window.resetMyProgress = async () => {
    if (!userDocRef || !currentUser) {
      console.error("ERRO: Por favor, faça login primeiro.");
      return;
    }
    const resetData = {
      stats: { totalQuestions: 0, correct: 0, wrong: 0 },
      errorTopics: {},
      unreadMessagesFrom: {},
      dailyPerformance: {},
      lastReaction: null 
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

}); // <-- FIM DO DOMCONTENTLOADED
