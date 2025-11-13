/* ====== Lógica Principal com Firebase ====== */

// --- 1. IMPORTAÇÕES DO FIREBASE ---
// (Estas linhas substituem o <script> inline que estava no index.html)
import { initializeApp } from "[https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js](https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js)";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "[https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js](https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js)";

// --- 2. CONFIGURAÇÃO DO FIREBASE ---
// ======================================================
// ===== COLE A SUA 'firebaseConfig' DO FIREBASE AQUI =====
// (Esta é a const firebaseConfig = { ... } que você copiou do site do Firebase)
// ======================================================
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
// ======================================================


// --- 3. INICIALIZAÇÃO DO FIREBASE ---
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  // ESTA É A MENSAGEM QUE DEVE APARECER
  console.log("Firebase conectado com sucesso!"); 
} catch (error) {
  console.error("Erro ao inicializar o Firebase:", error);
  if (error.code === 'duplicate-app') {
    // Isto pode acontecer em alguns modos de desenvolvimento, mas não deve mais
    console.warn("Firebase já inicializado.");
  } else {
    alert("Falha crítica ao conectar com o banco de dados. Verifique o console (F12) e a sua 'firebaseConfig' no app.js.");
  }
}

// --- 4. LÓGICA DO APP ---

let currentUser = null;
let userDocRef = null; 

// Espera o HTML carregar para encontrar os elementos
document.addEventListener('DOMContentLoaded', () => {
  
  // Elementos
  const userGate = document.getElementById('userGate');
  const userIthalo = document.getElementById('userIthalo');
  const userMatheus = document.getElementById('userMatheus');
  const mainContent = document.getElementById('mainContent');
  const currentUserDisplay = document.querySelector('#currentUserDisplay span');
  
  const navSimulado = document.getElementById('navSimulado');
  const navDesempenho = document.getElementById('navDesempenho');
  const quizContainer = document.getElementById('quizContainer');
  const desempenhoContainer = document.getElementById('desempenhoContainer');

  // --- Seleção de Usuário ---
  async function selectUser(userName) {
    if (!db) {
      console.error("Banco de dados não inicializado. Verifique a firebaseConfig.");
      return;
    }
    
    currentUser = userName;
    if (currentUserDisplay) {
        currentUserDisplay.textContent = userName;
    }
    
    userDocRef = doc(db, "users", userName); 
    if (userGate) userGate.style.opacity = 0.5;

    try {
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        console.log("Dados recuperados do Firebase:", docSnap.data());
      } else {
        console.log("Novo usuário! Criando registro no banco...");
        await setDoc(userDocRef, {
          name: userName,
          createdAt: new Date().toISOString(),
          stats: { totalQuestions: 0, correct: 0, wrong: 0 },
          errorTopics: {}
        });
      }

      if (userGate) userGate.style.display = 'none';
      if (mainContent) mainContent.style.display = 'block';
      
      // Chama as funções do main.js (que já devem ter sido carregadas)
      if (typeof loadSubjects === 'function') {
        loadSubjects();
        loadPDFs();
      } else {
        console.error("Função loadSubjects() não encontrada. Verifique a ordem dos scripts no index.html.");
      }
      
      showTab('simulado');

    } catch (error) {
      console.error("Erro ao conectar no Firebase (Firestore):", error);
      alert("Erro de conexão. Verifique sua internet ou as regras do Firestore.");
      if (userGate) userGate.style.opacity = 1;
    }
  }

  // Adiciona listeners aos botões de login (com verificação)
  if (userIthalo) userIthalo.addEventListener('click', () => selectUser('ithalo'));
  if (userMatheus) userMatheus.addEventListener('click', () => selectUser('matheus'));

  // --- Salvar Progresso (Função Global) ---
  // (Esta função é chamada pelo main.js)
  window.saveQuestionProgress = async (questionData, isCorrect) => {
    if (!userDocRef) return; // Não faz nada se o utilizador não estiver logado

    try {
      const snap = await getDoc(userDocRef);
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

      // (Certifique-se que 'helpers.js' foi carregado e 'getErrorTopic' existe)
      if (!isCorrect && typeof getErrorTopic === 'function') {
        const topic = getErrorTopic(questionData); 
        const currentTopicCount = currentErrorTopics[topic] || 0;
        // Usamos notação de ponto para o Firebase entender o objeto aninhado
        updateData[`errorTopics.${topic}`] = currentTopicCount + 1;
      }

      await updateDoc(userDocRef, updateData);
      console.log("Progresso detalhado salvo na nuvem!");

    } catch (e) {
      console.error("Erro ao salvar progresso:", e);
    }
  };


  // --- Lógica de Abas ---
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
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      console.error("Documento do usuário não encontrado.");
      return;
    }

    const data = snap.data();
    const stats = data.stats || { correct: 0, wrong: 0, totalQuestions: 0 };
    const unanswered = stats.totalQuestions - stats.correct - stats.wrong;

    // --- Gráfico de Pizza Total ---
    const pizzaCtx = document.getElementById('totalPizzaChart');
    if (pizzaCtx) {
      // Destrói o gráfico anterior para evitar sobreposição
      if (window.Chart && pizzaCtx.chart) pizzaCtx.chart.destroy(); 
      // Salva a nova instância do gráfico no elemento para destruí-la depois
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

    // --- Gráfico de Barras Total ---
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
            // Limpa o canvas e mostra uma mensagem se não houver dados
            const context = barCtx.getContext('2d');
            context.clearRect(0, 0, barCtx.width, barCtx.height);
            context.textAlign = 'center';
            context.fillStyle = '#8b949e'; // Cor --muted
            context.font = "16px 'Poppins', sans-serif";
            context.fillText('Ainda não há dados de tópicos de erro.', barCtx.width / 2, barCtx.height / 2);
        }
    }
  }

  // Adiciona listeners às abas (com verificação)
  if (navSimulado) navSimulado.addEventListener('click', (e) => { e.preventDefault(); showTab('simulado'); });
  if (navDesempenho) navDesempenho.addEventListener('click', (e) => { e.preventDefault(); showTab('desempenho'); });

});
