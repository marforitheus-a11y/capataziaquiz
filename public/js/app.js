/* ====== Lógica Principal com Firebase ====== */

// Pega as funções do módulo window (definido no index.html)
const { doc, getDoc, setDoc, updateDoc } = window.firebaseModules;

// Estado
let currentUser = null;
let userDocRef = null; // Referência ao documento do usuário no banco

document.addEventListener('DOMContentLoaded', () => {
  
  // Elementos
  const userGate = document.getElementById('userGate');
  const userIthalo = document.getElementById('userIthalo');
  const userMatheus = document.getElementById('userMatheus');
  const mainContent = document.getElementById('mainContent');
  const currentUserDisplay = document.querySelector('#currentUserDisplay span'); // Seletor corrigido
  
  const navSimulado = document.getElementById('navSimulado');
  const navDesempenho = document.getElementById('navDesempenho');
  const quizContainer = document.getElementById('quizContainer');
  const desempenhoContainer = document.getElementById('desempenhoContainer');

  // --- 1. SELEÇÃO DE USUÁRIO E CARREGAMENTO DE DADOS ---

  async function selectUser(userName) {
    currentUser = userName;
    currentUserDisplay.textContent = userName; // Mostra o nome na nav
    
    // Define onde os dados desse usuário ficam no banco
    // Coleção: 'users', Documento: 'ithalo' ou 'matheus'
    userDocRef = doc(window.db, "users", userName);

    // Mostra loading visual (opcional)
    userGate.style.opacity = 0.5;

    try {
      // Tenta buscar os dados do usuário no Firebase
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        console.log("Dados recuperados do Firebase:", docSnap.data());
        // Carrega o progresso recuperado
        const data = docSnap.data();
        
        // Se você tiver variáveis globais de estatística em main.js, atualize-as aqui
        // Exemplo:
        // globalStats = data.stats || {};
        
      } else {
        console.log("Novo usuário! Criando registro no banco...");
        // Cria o documento inicial se não existir
        await setDoc(userDocRef, {
          name: userName,
          createdAt: new Date().toISOString(),
          stats: {
            totalQuestions: 0,
            correct: 0,
            wrong: 0
          },
          history: [] // Lista de questões respondidas
        });
      }

      // Libera o acesso
      userGate.style.display = 'none';
      mainContent.style.display = 'block';
      
      // Inicia o carregamento do simulado
      if (typeof loadSubjects === 'function') loadSubjects();
      if (typeof loadPDFs === 'function') loadPDFs();
      
      showTab('simulado');

    } catch (error) {
      console.error("Erro ao conectar no Firebase:", error);
      alert("Erro de conexão. Verifique sua internet ou o console.");
      userGate.style.opacity = 1;
    }
  }

 // Adiciona listeners aos botões de login (com verificação)
  if (userIthalo) userIthalo.addEventListener('click', () => selectUser('ithalo'));
  if (userMatheus) userMatheus.addEventListener('click', () => selectUser('matheus'));


  // --- 2. SALVAR PROGRESSO (Função Global) ---
  
  // Vamos expor essa função para ser chamada pelo main.js/ui.js
  window.saveQuestionProgress = async (questionData, isCorrect) => {
    if (!userDocRef) return;

    try {
      // Atualiza apenas os campos necessários no banco
      // Nota: updateDoc é inteligente, não sobrescreve tudo
      
      // 1. Atualiza contadores
      // Precisamos ler primeiro para incrementar (ou usar increment do firebase, mas vamos simplificar)
      const snap = await getDoc(userDocRef);
      const currentStats = snap.data().stats || { correct: 0, wrong: 0, totalQuestions: 0 };
      
      const newStats = {
        totalQuestions: currentStats.totalQuestions + 1,
        correct: currentStats.correct + (isCorrect ? 1 : 0),
        wrong: currentStats.wrong + (isCorrect ? 0 : 1)
      };

      // 2. Salva no Firebase
      await updateDoc(userDocRef, {
        stats: newStats,
        // Adiciona um log simples no histórico (sobrescreve o array history com o novo item)
        // Para arrays grandes, usa-se arrayUnion, mas para começar está bom
        lastActivity: new Date().toISOString()
      });
      
      console.log("Progresso salvo na nuvem!");

    } catch (e) {
      console.error("Erro ao salvar progresso:", e);
    }
  };


  // --- 3. LÓGICA DE ABAS ---

  function showTab(tabName) {
    if (tabName === 'simulado') {
      quizContainer.style.display = 'block';
      desempenhoContainer.style.display = 'none';
      navSimulado.classList.add('active');
      navDesempenho.classList.remove('active');
    } else if (tabName === 'desempenho') {
      quizContainer.style.display = 'none';
      desempenhoContainer.style.display = 'block';
      navSimulado.classList.remove('active');
      navDesempenho.classList.add('active');
      
      // Carregar gráficos de desempenho aqui (Ler do Firebase novamente para garantir dados frescos)
      loadPerformanceData();
    }
  }
  
  async function loadPerformanceData() {
    if (!userDocRef) return;
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      // Aqui você chamaria uma função para desenhar os gráficos na tela de desempenho
      // drawTotalPerformanceChart(data.stats); (Exemplo)
      console.log("Dados para gráficos:", data.stats);
    }
  }

// Adiciona listeners às abas (com verificação)
  if (navSimulado) navSimulado.addEventListener('click', (e) => { e.preventDefault(); showTab('simulado'); });
  if (navDesempenho) navDesempenho.addEventListener('click', (e) => { e.preventDefault(); showTab('desempenho'); });

});
