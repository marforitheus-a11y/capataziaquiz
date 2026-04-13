/* ====== Lógica Principal (COM CHAT V5 + DESAFIO V1) - VERSÃO CORRIGIDA ====== */

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

// --- 2. INICIALIZAÇÃO DO FIREBASE (v8/compat) ---
let db;
let storage;
let auth;

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.firestore();
  storage = firebase.storage();
  auth = firebase.auth();
  console.log("Firebase conectado com sucesso!");
} catch (error) {
  console.error("Erro ao inicializar o Firebase:", error);
  alert("Falha crítica ao conectar com o Firebase. Verifique a firebaseConfig.");
}

// --- 3. VARS GLOBAIS ---
let currentUser = null;          // alias visual: matheus, hugo, lucao
let currentAuthUid = null;       // uid real do Firebase Auth
let otherUser = null;
let activeChatTarget = null;     // userId ou "group"
let chatRoomId = null;
let userDocRef = null;
let otherUserDocRef = null;

let stopPresenceListener = () => {};
let stopGroupPresenceListeners = [];
let stopNotificationListener = () => {};
let stopMessagesListener = () => {};
let stopChallengeListener = () => {};
let stopChallengeInviteListener = () => {};

let presenceIntervalId = null;

const profilePics = {
  matheus: '/video/matheus.jpg',
  hugo: '/video/hugo.jpg',
  lucao: '/video/lucao.jpg',
  group: 'https://placehold.co/220x220/6c5ce7/FFFFFF?text=Grupo'
};

const supportedUsers = ['matheus', 'hugo', 'lucao'];

let otherUserIsOnline = false;
let myUnreadCount = 0;
let lastReactionTimestamp = null;
let activeChallengeId = null;

const notificationSound = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");

// --- HELPERS ---
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

function sanitizeFileName(fileName) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]/g, "_");
}

async function ensureFirebaseAuth() {
  if (!auth) throw new Error("Firebase Auth não inicializado.");

  if (auth.currentUser) {
    currentAuthUid = auth.currentUser.uid;
    return auth.currentUser;
  }

  const result = await auth.signInAnonymously();
  currentAuthUid = result.user.uid;
  console.log("Auth anônimo OK:", currentAuthUid);
  return result.user;
}

async function ensureUserDoc(userName) {
  const ref = db.collection("users").doc(userName);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      name: userName,
      createdAt: new Date().toISOString(),
      stats: { totalQuestions: 0, correct: 0, wrong: 0 },
      errorTopics: {},
      unreadMessagesFrom: {},
      unreadChats: {},
      dailyPerformance: {},
      lastReaction: null,
      lastActivity: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return ref;
}

// Reset apenas do usuário atual, não global
async function resetCurrentUserStatsIfNeeded() {
  if (!userDocRef) return;

  const resetVersion = 'gcm-stats-reset-2026-04-08-user-only';
  try {
    const snap = await userDocRef.get();
    const data = snap.exists ? snap.data() : {};
    if (data.statsResetVersion === resetVersion) return;

    await userDocRef.set({
      stats: { totalQuestions: 0, correct: 0, wrong: 0 },
      errorTopics: {},
      dailyPerformance: {},
      statsResetVersion: resetVersion,
      resetAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('Reset aplicado somente ao usuário atual.');
  } catch (error) {
    console.error('Erro ao resetar estatísticas do usuário atual:', error);
  }
}

function getAvailableChatTargets() {
  if (!currentUser) return [];
  const directTargets = supportedUsers
    .filter((userId) => userId !== currentUser)
    .map((userId) => ({ id: userId, label: `Conversa com ${userId}` }));

  return [...directTargets, { id: 'group', label: 'Chat em grupo' }];
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

// ======================================================
// DOM READY
// ======================================================
document.addEventListener('DOMContentLoaded', async () => {
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
  const challengeBtn = document.getElementById('challengeBtn');

  function isChatWidgetOpen() {
    return !!(chatWidget && chatWidget.style.display !== 'none');
  }

  function populateChatTargetOptions() {
    if (!chatTargetSelect) return;
    const targets = getAvailableChatTargets();
    chatTargetSelect.innerHTML = targets
      .map((target) => `<option value="${target.id}">${target.label}</option>`)
      .join('');
  }

  async function bootstrapAuth() {
    try {
      if (userGate) userGate.style.opacity = 0.6;
      await ensureFirebaseAuth();
      console.log("Sessão Firebase pronta.");
    } catch (error) {
      console.error("Erro ao autenticar no Firebase:", error);
      alert("Não foi possível autenticar no Firebase. Ative o login anônimo no console.");
    } finally {
      if (userGate) userGate.style.opacity = 1;
    }
  }

  async function selectUser(userName) {
    if (!db || !auth) return;

    try {
      if (!auth.currentUser) {
        await ensureFirebaseAuth();
      }

      currentUser = userName;
      userDocRef = await ensureUserDoc(currentUser);

      const defaultTarget = supportedUsers.find((user) => user !== currentUser) || 'group';

      populateChatTargetOptions();
      if (chatTargetSelect) chatTargetSelect.value = defaultTarget;
      setChatContext(defaultTarget);

      if (currentUserDisplay) currentUserDisplay.textContent = userName;
      if (userGate) userGate.style.opacity = 0.5;

      await resetCurrentUserStatsIfNeeded();

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
      listenForChallenges();
    } catch (error) {
      console.error("Erro ao selecionar usuário:", error);
      alert("Erro ao conectar no Firebase. Verifique autenticação e regras.");
      if (userGate) userGate.style.opacity = 1;
    }
  }

  if (userMatheus) userMatheus.addEventListener('click', () => selectUser('matheus'));
  if (userHugo) userHugo.addEventListener('click', () => selectUser('hugo'));
  if (userLucao) userLucao.addEventListener('click', () => selectUser('lucao'));

  function startPresenceHeartbeat() {
    if (presenceIntervalId) {
      clearInterval(presenceIntervalId);
      presenceIntervalId = null;
    }

    updatePresence();
    presenceIntervalId = setInterval(updatePresence, 20000);
  }

  async function updatePresence() {
    if (!userDocRef) return;
    try {
      await userDocRef.set({
        lastActivity: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Erro ao atualizar presença:", e.message);
    }
  }

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
            if (diffInSeconds < 60) isOnline = true;
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
          if (!isChatWidgetOpen()) {
            notificationSound.play().catch((e) => console.warn("Erro ao tocar som:", e));
          }
        }
      }

      if (isChatWidgetOpen() && unreadCount > 0) {
        unreadCount = 0;
        resetUnreadForCurrentChat();
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

    if (!isChatWidgetOpen() && myUnreadCount > 0) {
      chatBadge.textContent = myUnreadCount;
      chatBadge.style.display = 'flex';
    } else {
      chatBadge.style.display = 'none';
    }
  }

  async function resetUnreadForCurrentChat() {
    if (!userDocRef || !chatRoomId) return;

    const payload = {
      [`unreadChats.${chatRoomId}`]: 0
    };

    if (otherUser) {
      payload[`unreadMessagesFrom.${otherUser}`] = 0;
    }

    try {
      await userDocRef.set(payload, { merge: true });
      if (otherUser) {
        await markMessagesAsRead();
      }
    } catch (e) {
      console.error("Erro ao resetar não lidas:", e);
    }
  }

  if (chatTargetSelect) {
    chatTargetSelect.addEventListener('change', async (e) => {
      if (!currentUser) return;
      setChatContext(e.target.value);
      myUnreadCount = 0;
      startChatListeners();
      updateChatHead();

      if (chatWidget && chatWidget.style.display !== 'none') {
        chatWithUser.textContent = activeChatTarget === 'group' ? 'Chat em grupo' : `Chat com ${otherUser}`;
        listenForMessages();
        await resetUnreadForCurrentChat();
      }
    });
  }

  if (chatHead) {
    chatHead.addEventListener('click', async () => {
      if (!chatWidget) return;
      chatWidget.style.display = 'flex';
      if (chatWithUser) {
        chatWithUser.textContent = activeChatTarget === 'group' ? 'Chat em grupo' : `Chat com ${otherUser}`;
      }
      listenForMessages();
      await resetUnreadForCurrentChat();
    });
  }

  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => {
      if (chatWidget) chatWidget.style.display = 'none';
      stopMessagesListener();
    });
  }

  function listenForMessages() {
    stopMessagesListener();
    if (!chatRoomId || !chatMessages) return;

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
          bubble.textContent = msg.text || '';
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
    if (!chatRoomId || !messageIds.length) return;

    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    const batch = db.batch();

    messageIds.forEach((id) => {
      const msgRef = chatCollectionRef.doc(id);
      batch.update(msgRef, { status: 'delivered' });
    });

    try {
      await batch.commit();
    } catch (e) {
      console.error("Erro ao marcar delivered:", e);
    }
  }

  async function markMessagesAsRead() {
    if (!otherUser || !chatRoomId) return;

    const chatCollectionRef = db.collection("chats").doc(chatRoomId).collection("messages");
    const q = chatCollectionRef
      .where('senderId', '==', otherUser)
      .where('status', 'in', ['sent', 'delivered']);

    try {
      const querySnapshot = await q.get();
      if (querySnapshot.empty) return;

      const batch = db.batch();
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, { status: 'read' });
      });

      await batch.commit();
    } catch (e) {
      console.error("Erro ao marcar read:", e);
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
    if (!db || !chatRoomId || !currentUser) return;

    const recipients = getRecipientsForActiveChat();
    if (recipients.length === 0) return;

    const chatDocRef = db.collection("chats").doc(chatRoomId);
    const chatCollectionRef = chatDocRef.collection("messages");

    await chatDocRef.set({
      roomId: chatRoomId,
      type: activeChatTarget === 'group' ? 'group' : 'direct',
      participants: activeChatTarget === 'group'
        ? [...supportedUsers]
        : [currentUser, otherUser].sort(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

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
    if (!chatTextInput || !currentUser) return;

    const text = chatTextInput.value;
    if (!text || text.trim() === "") return;

    chatTextInput.value = '';

    await addMessageToDb({
      senderId: currentUser,
      text,
      type: 'text'
    });

    chatTextInput.style.height = 'auto';
  }

  async function uploadImage(file) {
    if (!file || !storage || !chatRoomId || !currentAuthUid || !chatMessages) return;

    const timestamp = Date.now();
    const safeName = sanitizeFileName(file.name);
    const storagePath = `chat_uploads/${currentAuthUid}/${chatRoomId}/${timestamp}-${safeName}`;
    const storageRef = storage.ref(storagePath);

    const tempId = `temp_${timestamp}`;
    chatMessages.innerHTML += `
      <div class="msg-row sent">
        <div class="msg-content">
          <div class="msg-bubble" id="${tempId}">Enviando imagem...</div>
        </div>
      </div>
    `;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const task = storageRef.put(file, {
      customMetadata: {
        senderAlias: currentUser,
        chatRoomId: chatRoomId
      }
    });

    task.on(
      'state_changed',
      () => {},
      (error) => {
        console.error("Erro no upload:", error);
        const tempBubble = document.getElementById(tempId);
        if (tempBubble) tempBubble.textContent = "Falha no envio.";
      },
      async () => {
        try {
          const downloadURL = await task.snapshot.ref.getDownloadURL();

          await addMessageToDb({
            senderId: currentUser,
            type: 'image',
            imageUrl: downloadURL,
            storagePath
          });

          const tempBubble = document.getElementById(tempId);
          if (tempBubble) {
            const row = tempBubble.closest('.msg-row');
            if (row) row.remove();
          }
        } catch (error) {
          console.error("Erro ao concluir upload:", error);
          const tempBubble = document.getElementById(tempId);
          if (tempBubble) tempBubble.textContent = "Falha no envio.";
        }
      }
    );
  }

  function autoGrowTextarea(e) {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
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

  if (chatUploadBtn) {
    chatUploadBtn.addEventListener('click', () => {
      if (imageUploadInput) imageUploadInput.click();
    });
  }

  if (imageUploadInput) {
    imageUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) uploadImage(file);
      e.target.value = null;
    });
  }

  window.sendQuizReaction = async (isCorrect) => {
    if (!userDocRef) return;

    const reaction = {
      type: isCorrect ? 'correct' : 'wrong',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await userDocRef.set({
        lastReaction: reaction
      }, { merge: true });
    } catch (e) {
      console.error("Erro ao enviar reação:", e);
    }
  };

  function triggerEmojiFloat(type) {
    const emojiContainer = document.getElementById('emojiContainer');
    if (!emojiContainer) return;

    const emoji = document.createElement('div');
    emoji.className = 'emoji-float';
    emoji.textContent = type === 'correct' ? '👍' : '👎';
    emojiContainer.appendChild(emoji);

    setTimeout(() => {
      emoji.remove();
    }, 2000);
  }

  function flattenErrorTopics(errorTopics, parentKey = '', output = {}) {
    if (!errorTopics || typeof errorTopics !== 'object') return output;

    Object.entries(errorTopics).forEach(([key, value]) => {
      const composedKey = parentKey ? `${parentKey}.${key}` : key;

      if (typeof value === 'number') {
        output[composedKey] = (output[composedKey] || 0) + value;
        return;
      }

      if (value && typeof value === 'object') {
        flattenErrorTopics(value, composedKey, output);
      }
    });

    return output;
  }

  function wrapChartLabel(label, maxLineLength = 28) {
    if (typeof label !== 'string' || label.length <= maxLineLength) return label;

    const words = label.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach((word) => {
      const candidateLine = currentLine ? `${currentLine} ${word}` : word;

      if (candidateLine.length <= maxLineLength) {
        currentLine = candidateLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  window.saveQuestionProgress = async (questionData, isCorrect) => {
    if (!userDocRef) return;

    const today = getTodayString();

    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(userDocRef);
        const data = snap.exists ? snap.data() : {};

        const nextStats = { ...(data.stats || {}) };
        nextStats.correct = Number(nextStats.correct || 0);
        nextStats.wrong = Number(nextStats.wrong || 0);
        nextStats.totalQuestions = Number(nextStats.totalQuestions || 0);

        if (isCorrect) {
          nextStats.correct += 1;
        } else {
          nextStats.wrong += 1;
        }
        nextStats.totalQuestions += 1;

        const nextDailyPerformance = { ...(data.dailyPerformance || {}) };
        const todayPerf = { ...(nextDailyPerformance[today] || {}) };
        todayPerf.correct = Number(todayPerf.correct || 0);
        todayPerf.wrong = Number(todayPerf.wrong || 0);
        if (isCorrect) {
          todayPerf.correct += 1;
        } else {
          todayPerf.wrong += 1;
        }
        nextDailyPerformance[today] = todayPerf;

        const updateData = {
          stats: nextStats,
          dailyPerformance: nextDailyPerformance,
          lastActivity: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!isCorrect && typeof getErrorTopic === 'function') {
          const topic = String(getErrorTopic(questionData, questionData.sourceFile) || 'Outros').trim();
          const nextErrorTopics = { ...(data.errorTopics || {}) };
          nextErrorTopics[topic] = Number(nextErrorTopics[topic] || 0) + 1;
          updateData.errorTopics = nextErrorTopics;
        }

        transaction.set(userDocRef, updateData, { merge: true });
      });
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

  function formatDuration(seconds) {
    if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '-';
    const value = Math.max(0, Number(seconds));
    const minutes = Math.floor(value / 60).toString().padStart(2, '0');
    const secs = Math.floor(value % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  }

  function renderChallengePerformance(data) {
    const challengeStatsEl = document.getElementById('challengeStatsSummary');
    const challengeHistoryEl = document.getElementById('challengeHistoryList');
    if (!challengeStatsEl || !challengeHistoryEl) return;

    const stats = data.challengeStats || {};
    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const draws = stats.draws || 0;
    const total = wins + losses + draws;

    challengeStatsEl.innerHTML = `
      <p><strong>Desafios ganhos:</strong> ${wins}</p>
      <p><strong>Desafios perdidos:</strong> ${losses}</p>
      <p><strong>Empates:</strong> ${draws}</p>
      <p><strong>Total finalizado:</strong> ${total}</p>
    `;

    const history = (data.challengeHistory || []).slice().reverse();
    if (history.length === 0) {
      challengeHistoryEl.innerHTML = '<p style="color: #8b949e;">Nenhum desafio finalizado ainda.</p>';
      return;
    }

    challengeHistoryEl.innerHTML = history.map((item) => {
      const resultLabel = item.result === 'win' ? 'Vitória' : (item.result === 'loss' ? 'Derrota' : 'Empate');
      return `
        <div style="border: 1px solid #e5eaf0; border-radius: 10px; padding: 12px; margin-bottom: 10px;">
          <p><strong>${resultLabel}</strong> • ${item.subjects || 'Sem matéria'} • ${item.questionCount || 0} questões</p>
          <p>${item.me} (${item.myScore ?? 0}) x (${item.opponentScore ?? 0}) ${item.opponent}</p>
          <p>Seu tempo: ${formatDuration(item.myElapsedSeconds)} • Tempo de ${item.opponent}: ${formatDuration(item.opponentElapsedSeconds)} • Limite: ${formatDuration(item.timeLimitSeconds)}</p>
        </div>
      `;
    }).join('');
  }

  async function loadPerformanceData() {
    if (!userDocRef) return;

    const snap = await userDocRef.get();
    if (!snap.exists) return;

    const data = snap.data();
    renderChallengePerformance(data);

    const stats = data.stats || { correct: 0, wrong: 0, totalQuestions: 0 };
    const unanswered = Math.max(0, stats.totalQuestions - stats.correct - stats.wrong);

    const pizzaCtx = document.getElementById('totalPizzaChart');
    if (pizzaCtx) {
      if (window.Chart && pizzaCtx.chart) pizzaCtx.chart.destroy();

      pizzaCtx.chart = new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
          labels: ['Acertos', 'Erros', 'Não Respondidas'],
          datasets: [{
            data: [stats.correct, stats.wrong, unanswered],
            backgroundColor: ['#00b894', '#d63031', '#bdc3c7'],
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

    const barCtx = document.getElementById('totalBarChart');
    if (barCtx) {
      if (window.Chart && barCtx.chart) barCtx.chart.destroy();

      const errorTopics = flattenErrorTopics(data.errorTopics || {});
      const errorEntries = Object.entries(errorTopics).sort((a, b) => b[1] - a[1]);

      if (errorEntries.length > 0) {
        const rawLabels = errorEntries.map((entry) => entry[0]);
        const wrappedLabels = rawLabels.map((label) => wrapChartLabel(label));

        barCtx.chart = new Chart(barCtx, {
          type: 'bar',
          data: {
            labels: wrappedLabels,
            datasets: [{
              label: 'Quantidade de Erros',
              data: errorEntries.map((entry) => entry[1]),
              backgroundColor: 'rgba(214, 48, 49, 0.6)',
              borderColor: '#d63031',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: (items) => {
                    if (!items.length) return '';
                    return rawLabels[items[0].dataIndex] || '';
                  }
                }
              }
            },
            scales: {
              x: {
                ticks: { maxRotation: 0, minRotation: 0, autoSkip: false }
              },
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            }
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

    const timeCtx = document.getElementById('timeSeriesChart');
    if (timeCtx) {
      if (window.Chart && timeCtx.chart) timeCtx.chart.destroy();

      const startDate = new Date("2026-04-13T00:00:00-03:00");
      const deadline = new Date("2026-08-30T23:59:59-03:00");
      const labels = getDateRange(startDate, deadline);
      const dailyData = data.dailyPerformance || {};

      let runningCorrect = 0;
      let runningTotal = 0;

      const performanceData = labels.map((date) => {
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
          labels,
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
                callback: function(value) {
                  return value + '%';
                }
              }
            }
          }
        }
      });
    }
  }

  if (navSimulado) {
    navSimulado.addEventListener('click', (e) => {
      e.preventDefault();
      showTab('simulado');
    });
  }

  if (navDesempenho) {
    navDesempenho.addEventListener('click', (e) => {
      e.preventDefault();
      showTab('desempenho');
    });
  }

  if (challengeBtn) {
    challengeBtn.addEventListener('click', showChallengeSetup);
  }

  function showChallengeSetup() {
    if (!window.selectedSubjects || window.selectedSubjects.length === 0) {
      return alert('Selecione pelo menos uma matéria para desafiar!');
    }

    const possibleOpponents = supportedUsers.filter((userId) => userId !== currentUser);
    if (possibleOpponents.length === 0) {
      return alert('Nenhum usuário disponível para desafiar.');
    }

    const defaultOpponent = otherUser && possibleOpponents.includes(otherUser)
      ? otherUser
      : possibleOpponents[0];

    const subjects = window.selectedSubjects.map((s) => s.name).join(', ');
    const count = document.getElementById('questionCount')?.value || 10;

    const opponentCards = possibleOpponents.map((userId) => `
      <button
        type="button"
        class="challenge-opponent-card ${userId === defaultOpponent ? 'is-selected' : ''}"
        data-opponent="${userId}"
      >
        <img src="${profilePics[userId]}" alt="${userId}">
        <span>${userId}</span>
      </button>
    `).join('');

    const content = `
      <p><strong>Escolha quem desafiar:</strong></p>
      <div id="challengeOpponentList" class="challenge-opponent-list">
        ${opponentCards}
      </div>
      <p><strong>Desafiado:</strong> <span id="challengeOpponentLabel">${defaultOpponent}</span></p>
      <p><strong>Matérias:</strong> ${subjects}</p>
      <p><strong>Questões:</strong> <input type="number" id="challenge_count" value="${count}" style="width: 80px;"></p>
      <p><strong>Tempo (min):</strong> <input type="number" id="challenge_time" value="5" style="width: 80px;"></p>
      <button id="sendChallengeBtn" style="width: 100%; margin-top: 15px; padding: 12px;">Enviar Desafio</button>
    `;

    showChallengeModal("Configurar Desafio", content);

    let invitedUser = defaultOpponent;
    const opponentList = document.getElementById('challengeOpponentList');
    const opponentLabel = document.getElementById('challengeOpponentLabel');

    if (opponentList) {
      opponentList.addEventListener('click', (event) => {
        const card = event.target.closest('.challenge-opponent-card');
        if (!card) return;

        invitedUser = card.dataset.opponent;
        opponentList.querySelectorAll('.challenge-opponent-card').forEach((btn) => {
          btn.classList.toggle('is-selected', btn === card);
        });

        if (opponentLabel) {
          opponentLabel.textContent = invitedUser;
        }
      });
    }

    document.getElementById('sendChallengeBtn').onclick = () => {
      if (!invitedUser) {
        return alert('Selecione um usuário para desafiar.');
      }
      const settings = {
        subjects: window.selectedSubjects,
        count: parseInt(document.getElementById('challenge_count').value, 10),
        time: parseInt(document.getElementById('challenge_time').value, 10)
      };
      createChallenge(settings, invitedUser);
    };
  }

  async function createChallenge(settings, invitedUser) {
    if (!db || !currentUser || !invitedUser) return;

    const challengeId = `${[currentUser, invitedUser].sort().join('_')}_${Date.now()}`;
    activeChallengeId = challengeId;

    const challengeDoc = {
      createdBy: currentUser,
      invited: invitedUser,
      participants: [currentUser, invitedUser].sort(),
      status: 'pending',
      settings,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      questions: [],
      answers: { [currentUser]: {}, [invitedUser]: {} },
      submissions: {},
      finisher: null,
      historySaved: false
    };

    try {
      await db.collection('challenges').doc(challengeId).set(challengeDoc);
      showChallengeModal("Desafio Enviado", `<p>Aguardando ${invitedUser} aceitar...</p>`);
      listenToActiveGame(challengeId);
    } catch (e) {
      console.error("Erro ao criar desafio:", e);
      alert("Erro ao enviar desafio.");
      hideChallengeModal();
    }
  }

  function listenForChallenges() {
    if (!db || !currentUser) return;

    stopChallengeInviteListener();

    stopChallengeInviteListener = db.collection('challenges')
      .where('invited', '==', currentUser)
      .where('status', '==', 'pending')
      .onSnapshot((snapshot) => {
        if (snapshot.empty) return;
        if (activeChallengeId) return;

        const latestDoc = snapshot.docs[snapshot.docs.length - 1];
        const challenge = latestDoc.data();
        const challengeId = latestDoc.id;
        const settings = challenge.settings;

        const content = `
          <p><strong>${challenge.createdBy}</strong> está te desafiando!</p>
          <p><strong>Matérias:</strong> ${settings.subjects.map((s) => s.name).join(', ')}</p>
          <p><strong>Questões:</strong> ${settings.count}</p>
          <p><strong>Tempo:</strong> ${settings.time} min</p>
          <div style="display:flex; gap: 10px; margin-top: 20px;">
            <button id="acceptBtn" style="flex:1; padding: 12px;">Aceitar</button>
            <button id="rejectBtn" class="button-ghost" style="flex:1; padding: 12px;">Recusar</button>
          </div>
        `;

        showChallengeModal("Novo Desafio!", content);

        document.getElementById('acceptBtn').onclick = () => joinChallenge(challengeId, challenge.createdBy);
        document.getElementById('rejectBtn').onclick = () => rejectChallenge(challengeId);
      });
  }

  async function joinChallenge(challengeId, creatorAlias) {
    activeChallengeId = challengeId;
    otherUser = creatorAlias;
    otherUserDocRef = db.collection("users").doc(otherUser);

    showChallengeModal("Desafio Aceito!", `<p>Aguardando ${otherUser} iniciar e carregar as questões...</p>`);

    try {
      await db.collection('challenges').doc(challengeId).update({ status: 'accepted' });
      listenToActiveGame(challengeId);
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

  async function loadQuestionsAndStartGame(challengeId, settings) {
    console.log("Criador está carregando as questões...");
    try {
      if (typeof loadQuizFile !== 'function') {
        console.error("loadQuizFile não está definida!");
        return;
      }

      const allFilesData = await Promise.all(
        settings.subjects.map(async (sub) => {
          const questionsArray = await loadQuizFile(sub.file);
          return questionsArray.map((question) => ({
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

  function listenToActiveGame(challengeId) {
    stopChallengeListener();

    stopChallengeListener = db.collection('challenges').doc(challengeId).onSnapshot(async (doc) => {
      if (!doc.exists) {
        console.warn("Desafio foi deletado.");
        stopChallengeListener();
        return;
      }

      const challenge = doc.data();

      if (challenge.status === 'accepted' && challenge.createdBy === currentUser) {
        await loadQuestionsAndStartGame(challengeId, challenge.settings);
      }

      if (challenge.status === 'active' && window.quizMode === 'solo') {
        hideChallengeModal();
        startChallengeQuiz(challenge.questions, challenge.settings.time * 60);
      }

      if (challenge.status === 'finished') {
        stopChallengeListener();

        if (typeof stopTimer === 'function') {
          stopTimer();
        }

        const mySubmission = challenge.submissions?.[currentUser];
        if (window.quizMode === 'challenge' && !mySubmission) {
          await window.finishChallenge(window.userAnswers || {});
        }

        showChallengeResults(challenge);
      }
    });
  }

  function buildChallengeResult(challengeId, challengeData) {
    const p1 = challengeData.createdBy;
    const p2 = challengeData.invited;
    const questions = challengeData.questions || [];
    const submissions = challengeData.submissions || {};
    const p1Submission = submissions[p1] || {};
    const p2Submission = submissions[p2] || {};
    const p1Answers = p1Submission.answers || {};
    const p2Answers = p2Submission.answers || {};

    let p1Score = 0;
    let p2Score = 0;

    questions.forEach((q) => {
      if (p1Answers[q.id] === q.resposta_correta) p1Score++;
      if (p2Answers[q.id] === q.resposta_correta) p2Score++;
    });

    let winner = null;
    if (p1Score > p2Score) winner = p1;
    if (p2Score > p1Score) winner = p2;

    return {
      challengeId,
      winner,
      loser: winner ? (winner === p1 ? p2 : p1) : null,
      isDraw: p1Score === p2Score,
      scores: { [p1]: p1Score, [p2]: p2Score },
      elapsedSeconds: {
        [p1]: p1Submission.elapsedSeconds ?? null,
        [p2]: p2Submission.elapsedSeconds ?? null
      },
      subjects: (challengeData.settings?.subjects || []).map((s) => s.name).join(', '),
      questionCount: challengeData.settings?.count || questions.length,
      timeLimitSeconds: (challengeData.settings?.time || 0) * 60,
      finishedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  async function persistChallengeHistoryIfNeeded(challengeId, challengeData, result) {
    if (!result) return;

    const p1 = challengeData.createdBy;
    const p2 = challengeData.invited;
    const p1Result = result.winner === p1 ? 'win' : (result.winner === p2 ? 'loss' : 'draw');
    const p2Result = result.winner === p2 ? 'win' : (result.winner === p1 ? 'loss' : 'draw');

    const p1Entry = {
      challengeId,
      result: p1Result,
      me: p1,
      opponent: p2,
      myScore: result.scores[p1] || 0,
      opponentScore: result.scores[p2] || 0,
      myElapsedSeconds: result.elapsedSeconds[p1] ?? null,
      opponentElapsedSeconds: result.elapsedSeconds[p2] ?? null,
      subjects: result.subjects,
      questionCount: result.questionCount,
      timeLimitSeconds: result.timeLimitSeconds,
      finishedAt: new Date().toISOString()
    };

    const p2Entry = {
      challengeId,
      result: p2Result,
      me: p2,
      opponent: p1,
      myScore: result.scores[p2] || 0,
      opponentScore: result.scores[p1] || 0,
      myElapsedSeconds: result.elapsedSeconds[p2] ?? null,
      opponentElapsedSeconds: result.elapsedSeconds[p1] ?? null,
      subjects: result.subjects,
      questionCount: result.questionCount,
      timeLimitSeconds: result.timeLimitSeconds,
      finishedAt: new Date().toISOString()
    };

    const challengeRef = db.collection('challenges').doc(challengeId);

    await db.runTransaction(async (transaction) => {
      const challengeDoc = await transaction.get(challengeRef);
      if (!challengeDoc.exists) return;

      if (challengeDoc.data().historySaved) return;

      transaction.set(db.collection('users').doc(p1), {
        challengeHistory: firebase.firestore.FieldValue.arrayUnion(p1Entry),
        challengeStats: {
          wins: firebase.firestore.FieldValue.increment(p1Result === 'win' ? 1 : 0),
          losses: firebase.firestore.FieldValue.increment(p1Result === 'loss' ? 1 : 0),
          draws: firebase.firestore.FieldValue.increment(p1Result === 'draw' ? 1 : 0)
        }
      }, { merge: true });

      transaction.set(db.collection('users').doc(p2), {
        challengeHistory: firebase.firestore.FieldValue.arrayUnion(p2Entry),
        challengeStats: {
          wins: firebase.firestore.FieldValue.increment(p2Result === 'win' ? 1 : 0),
          losses: firebase.firestore.FieldValue.increment(p2Result === 'loss' ? 1 : 0),
          draws: firebase.firestore.FieldValue.increment(p2Result === 'draw' ? 1 : 0)
        }
      }, { merge: true });

      transaction.update(challengeRef, { historySaved: true });
    });
  }

  window.finishChallenge = async (myAnswers, extra = {}) => {
    if (!activeChallengeId) return;
    if (window.quizMode !== 'challenge' && window.quizMode !== 'finished') return;
    if (window.challengeSubmitted) return;

    console.log("Enviando respostas do desafio...");
    window.quizMode = 'finished';
    window.challengeSubmitted = true;

    const challengeRef = db.collection('challenges').doc(activeChallengeId);
    const answerKey = `answers.${currentUser}`;
    const submissionKey = `submissions.${currentUser}`;

    try {
      await challengeRef.update({
        [answerKey]: myAnswers,
        [submissionKey]: {
          answers: myAnswers,
          reason: extra.reason || 'completed',
          elapsedSeconds: extra.elapsedSeconds ?? null,
          completedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      });

      const doc = await challengeRef.get();
      if (!doc.exists) return;

      const challenge = doc.data();

      if (!challenge.finisher) {
        await challengeRef.update({
          finisher: currentUser
        });
      } else {
        const result = buildChallengeResult(activeChallengeId, challenge);
        await challengeRef.update({
          result,
          status: 'finished'
        });
        await persistChallengeHistoryIfNeeded(activeChallengeId, challenge, result);
      }
    } catch (e) {
      console.error("Erro ao finalizar desafio:", e);
      window.challengeSubmitted = false;
    }
  };

  window.resetMyProgress = async () => {
    if (!userDocRef || !currentUser) {
      console.error("Por favor, faça login primeiro.");
      return;
    }

    const resetData = {
      stats: { totalQuestions: 0, correct: 0, wrong: 0 },
      errorTopics: {},
      unreadMessagesFrom: {},
      unreadChats: {},
      dailyPerformance: {},
      lastReaction: null
    };

    console.warn(`ATENÇÃO: Você está prestes a apagar TODO o progresso de '${currentUser}'.`);
    console.log("Se tem certeza, copie e cole o seguinte comando e pressione Enter:");
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

  await bootstrapAuth();
});
