/* ====== Estado Global ====== */
let allQuestions = [];
let questions = [];
let currentQuestion = 0; 
let userAnswers = {};
let lockSelection = false; 

window.selectedSubjects = []; // Tornando global
window.selectedQuestionFilters = []; // artigos/assuntos selecionados para filtro quando houver 1 matéria
window.activeFilterMode = null; // 'article' | 'topic' | null

let quizMode = 'solo'; // 'solo' ou 'challenge'
let quizTimerInterval = null; // Referência para o timer
let challengeDurationSeconds = null;
let challengeStartedAt = null;
window.quizMode = quizMode;
window.userAnswers = userAnswers;
let articleFilterRequestId = 0;

const BASIC_SUBJECT_KEYWORDS = ['matemática', 'matematica', 'português', 'portugues'];

function normalizeSearchText(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isBasicKnowledgeSubject(subjectName) {
  const normalizedName = normalizeSearchText(subjectName);
  return BASIC_SUBJECT_KEYWORDS.some((keyword) => normalizedName.includes(normalizeSearchText(keyword)));
}

/* ====== Carregar Dados (API/JSON) ====== */
async function loadSubjects() {
  try {
    const res = await fetch('/data/index.json'); 
    if (!res.ok) throw new Error('Falha ao carregar index.json');
    const subjects = await res.json();
    subjectsIndex = subjects;

    const enriched = await Promise.all(subjects.map(async s => {
      try {
        const r = await fetch(`/data/${s.file}`); 
        if (!r.ok) throw new Error();
        const data = await r.json();
        return { name: s.name, file: s.file, count: (Array.isArray(data) ? data.length : 0) };
      } catch (e) {
        return { name: s.name, file: s.file, count: 0 };
      }
    }));

    // agrupar por área de conhecimento
  

    const basicSubjectKeywords = ['matemática', 'matematica', 'português', 'portugues'];
    const groups = {
      'Conhecimentos Básicos': [],
      'Conhecimentos Específicos': []
    };

    enriched.forEach(item => {
  const isBasic = isBasicKnowledgeSubject(item.name);
  const targetGroup = isBasic ? 'Conhecimentos Básicos' : 'Conhecimentos Específicos';
  groups[targetGroup].push(item);
});


    // ordenar grupos por nome
    const root = document.getElementById('foldersRoot');
    root.innerHTML = '';
    Object.keys(groups).forEach(groupName => {
      const arr = groups[groupName]; 
      if (arr.length === 0) return;
      arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      const folder = document.createElement('div');
      folder.className = 'folder';
      folder.innerHTML = `
        <div class="folder-header">
          <div class="folder-icon">${groupName.split(' ').slice(0,1)[0].slice(0,1).toUpperCase()}</div>
          <div style="display:flex;align-items:center;gap:10px;width:100%">
            <div class="folder-title">${groupName}</div>
            <div class="folder-count">${arr.reduce((a,b)=>a+b.count,0)} questões</div>
            <div class="caret" style="margin-left:auto;">▶</div>
          </div>
        </div>
        <ul class="sublist" style="display:none"></ul>
      `;
      const sublist = folder.querySelector('.sublist');

      // popular subitens
      arr.forEach(sub => {
        const li = document.createElement('li');
        li.className = 'subitem';
        li.innerHTML = `<div class="name">${sub.name}</div><div class="meta">${sub.count} questões</div>`;
        
        li.addEventListener('click', (e) => {
          e.stopPropagation(); 
          toggleSelectSubitem(sub, li); 
        });
        sublist.appendChild(li);
      });

      // Lógica de clique do header
      const header = folder.querySelector('.folder-header');
      header.addEventListener('click', () => {
        const isOpen = folder.classList.toggle('open');
        sublist.style.display = isOpen ? 'block' : 'none';
        toggleSelectFolder(arr, folder); 
      });

      root.appendChild(folder);
    });

    document.getElementById('foldersLoading').style.display = 'none';
    root.style.display = 'block';
  } catch (err) {
    console.error('Erro ao carregar matérias:', err);
    document.getElementById('foldersLoading').textContent = 'Erro ao carregar matérias.';
  }
}
async function loadQuizFile(filename) {
  const response = await fetch(`/data/${filename}`);
  if (!response.ok) throw new Error('Erro ao carregar o arquivo JSON');
  const data = await response.json();
  return data;
}

function normalizeArticleRef(rawRef) {
  return rawRef
    .replace(/\s+/g, '')
    .replace(/[º°]/g, 'º')
    .toUpperCase();
}

function extractArticleReferencesFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const refs = new Set();
  const regex = /\b(?:art(?:igo)?\.?)\s*(\d+[A-Za-z]?)(?:\s*[º°])?/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    refs.add(normalizeArticleRef(match[1]));
  }

  return [...refs];
}

function extractArticleReferencesFromQuestion(question) {
  const refs = new Set();

  function walk(value) {
    if (typeof value === 'string') {
      extractArticleReferencesFromText(value).forEach((ref) => refs.add(ref));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  }

  walk(question);
  return [...refs];
}

function sortArticleRefs(articleRefs) {
  return articleRefs.sort((a, b) => {
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    if (aNum !== bNum) return aNum - bNum;
    return a.localeCompare(b, 'pt-BR', { numeric: true });
  });
}

function collectArticlesFromQuestions(questionsArray) {
  const refs = new Set();
  questionsArray.forEach((question) => {
    extractArticleReferencesFromQuestion(question).forEach((ref) => refs.add(ref));
  });
  return sortArticleRefs([...refs]);
}

function collectArticleQuestionCounts(questionsArray) {
  const articleCountMap = new Map();

  questionsArray.forEach((question) => {
    const refs = new Set(extractArticleReferencesFromQuestion(question));
    refs.forEach((ref) => {
      const current = articleCountMap.get(ref) || 0;
      articleCountMap.set(ref, current + 1);
    });
  });

  return articleCountMap;
}

function collectTopicQuestionCounts(questionsArray) {
  const topicCountMap = new Map();

  questionsArray.forEach((question) => {
    const topic = (question?.assunto || '').toString().trim();
    if (!topic || topic.toUpperCase() === 'N/I') return;

    const current = topicCountMap.get(topic) || 0;
    topicCountMap.set(topic, current + 1);
  });

  return topicCountMap;
}

function resetArticleFilterUI(message = 'Disponível apenas quando 1 matéria estiver selecionada.') {
  const wrap = document.getElementById('articleFilterWrap');
  const select = document.getElementById('articleFilterSelect');
  const hint = document.getElementById('articleFilterHint');
  const label = document.getElementById('articleFilterLabel');
  if (!wrap || !select || !hint) return;

  window.selectedQuestionFilters = [];
  window.activeFilterMode = null;
  select.innerHTML = '';
  if (label) label.textContent = 'Filtrar por artigos da lei';
  hint.textContent = message;
  wrap.style.display = 'none';
}

async function refreshArticleFilterOptions() {
  const wrap = document.getElementById('articleFilterWrap');
  const select = document.getElementById('articleFilterSelect');
  const hint = document.getElementById('articleFilterHint');
  const label = document.getElementById('articleFilterLabel');
  if (!wrap || !select || !hint) return;

  if (!window.selectedSubjects || window.selectedSubjects.length !== 1) {
    resetArticleFilterUI();
    return;
  }

  const requestId = ++articleFilterRequestId;
  const selectedSubject = window.selectedSubjects[0];

  try {
    const subjectQuestions = await loadQuizFile(selectedSubject.file);
    if (requestId !== articleFilterRequestId) return;

    const isBasicSubject = isBasicKnowledgeSubject(selectedSubject.name);
    window.selectedQuestionFilters = [];
    select.innerHTML = '';

    if (isBasicSubject) {
      const topicCountMap = collectTopicQuestionCounts(subjectQuestions);
      const topics = [...topicCountMap.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      window.activeFilterMode = 'topic';
      if (label) label.textContent = 'Filtrar por assunto';

      if (topics.length === 0) {
        hint.textContent = 'Nenhum assunto identificado automaticamente nessa matéria.';
        wrap.style.display = 'block';
        return;
      }

      topics.forEach((topic) => {
        const option = document.createElement('option');
        option.value = topic;
        const questionCount = topicCountMap.get(topic) || 0;
        option.textContent = `${topic} (${questionCount} questões)`;
        select.appendChild(option);
      });

      hint.textContent = 'Selecione um ou mais assuntos (Ctrl/Cmd + clique para múltiplos).';
      wrap.style.display = 'block';
      return;
    }

    const articleCountMap = collectArticleQuestionCounts(subjectQuestions);
    const articles = sortArticleRefs([...articleCountMap.keys()]);
    window.activeFilterMode = 'article';
    if (label) label.textContent = 'Filtrar por artigos da lei';

    if (articles.length === 0) {
      hint.textContent = 'Nenhum artigo identificado automaticamente nessa matéria.';
      wrap.style.display = 'block';
      return;
    }

    articles.forEach((articleRef) => {
      const option = document.createElement('option');
      option.value = articleRef;
      const questionCount = articleCountMap.get(articleRef) || 0;
      option.textContent = `Art. ${articleRef} (${questionCount} questões)`;
      select.appendChild(option);
    });

    hint.textContent = 'Selecione um ou mais artigos (Ctrl/Cmd + clique para múltiplos).';
    wrap.style.display = 'block';
  } catch (error) {
    console.error('Erro ao carregar artigos da matéria selecionada:', error);
    resetArticleFilterUI('Não foi possível carregar os artigos desta matéria.');
  }
}
window.refreshArticleFilterOptions = refreshArticleFilterOptions;
async function loadPDFs() {
  const list = document.getElementById('pdfList');
  try {
    const response = await fetch('/data/pdf/index.json');
    if (!response.ok) throw new Error('Erro ao carregar lista de PDFs');
    const pdfs = await response.json();

    if (!pdfs || pdfs.length === 0) {
      list.innerHTML = '<li>Nenhum PDF encontrado.</li>';
      return;
    }

    list.innerHTML = '';
    pdfs.forEach(file => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${file.name}</span>
        <a href="/data/pdf/${file.file}" target="_blank">Abrir</a>
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = '<li>Erro ao carregar arquivos PDF.</li>';
  }
}

/* ====== Lógica do Quiz (Controladores) ====== */

function startQuiz(data, count) {
  quizMode = 'solo';
  window.quizMode = quizMode;
  window.challengeSubmitted = false;
  challengeDurationSeconds = null;
  challengeStartedAt = null;
  allQuestions = data; 
  const shuffled = allQuestions.slice().sort(() => 0.5 - Math.random());
  questions = shuffled.slice(0, count);
  currentQuestion = 0;
  userAnswers = {};
  window.userAnswers = userAnswers;
  document.getElementById('quiz').style.display = 'block';
  document.getElementById('quiz').scrollIntoView({ behavior: 'smooth' });
  renderQuestion();
}

function startChallengeQuiz(challengeQuestions, durationInSeconds) {
  quizMode = 'challenge';
  window.quizMode = quizMode;
  window.challengeSubmitted = false;
  challengeDurationSeconds = durationInSeconds;
  challengeStartedAt = Date.now();
  questions = challengeQuestions; 
  currentQuestion = 0;
  userAnswers = {};
  window.userAnswers = userAnswers;
  document.getElementById('quiz').style.display = 'block';
  document.getElementById('quiz').scrollIntoView({ behavior: 'smooth' });
  
  // ******** A CORREÇÃO ESTÁ AQUI ********
  // 1. Renderiza a pergunta (que cria o div do timer)
  renderQuestion(); 
  // 2. Inicia o timer (que agora encontra o div)
  startTimer(durationInSeconds); 
  // **************************************
}

function getChallengeElapsedSeconds() {
  if (!challengeStartedAt || !challengeDurationSeconds) return null;
  const elapsed = Math.floor((Date.now() - challengeStartedAt) / 1000);
  return Math.max(0, Math.min(elapsed, challengeDurationSeconds));
}


function toggleSelectSubitem(sub, element) {
  const index = window.selectedSubjects.findIndex(s => s.file === sub.file);
  
  if (index > -1) {
    window.selectedSubjects.splice(index, 1); 
    element.classList.remove('selected');
  } else {
    window.selectedSubjects.push(sub); 
    element.classList.add('selected');
  }
  
  updateSelectedSummary(); // Função da ui.js
  refreshArticleFilterOptions();
}
function toggleSelectFolder(subsInFolder, folderElement) {
  const subitemElements = folderElement.querySelectorAll('.subitem');
  
  const allAlreadySelected = subsInFolder.every(
    sub => window.selectedSubjects.find(s => s.file === sub.file)
  );

  if (allAlreadySelected) {
    subsInFolder.forEach(sub => {
      const index = window.selectedSubjects.findIndex(s => s.file === sub.file);
      if (index > -1) {
        window.selectedSubjects.splice(index, 1); 
      }
    });
    subitemElements.forEach(el => el.classList.remove('selected'));
  } else {
    subsInFolder.forEach(sub => {
      const index = window.selectedSubjects.findIndex(s => s.file === sub.file);
      if (index === -1) { 
        window.selectedSubjects.push(sub); 
      }
    });
    subitemElements.forEach(el => el.classList.add('selected'));
  }

  updateSelectedSummary(); // Função da ui.js
  refreshArticleFilterOptions();
}

function selectOption(questionId, optionKey) {
  if (userAnswers[questionId] !== undefined) {
    return;
  }
  userAnswers[questionId] = optionKey;

  if (quizMode === 'solo') {
    const q = questions.find(item => item.id == questionId);
    const isCorrect = (optionKey === q.resposta_correta);
    
    if (isCorrect) {
      setLanguage('pt-BR');
    } else {
      setLanguage('ja-JP');
    }
 
    if (window.saveQuestionProgress) {
        window.saveQuestionProgress(q, isCorrect);
      }
      if (window.sendQuizReaction) {
        window.sendQuizReaction(isCorrect);
      }
    
    renderQuestion();
    
  } else {
    const options = document.querySelectorAll(`.option[data-question-id="${questionId}"]`);
    options.forEach(opt => opt.classList.remove('selected-challenge'));
    
    const selectedEl = document.querySelector(`.option[data-question-id="${questionId}"][data-option-key="${optionKey}"]`);
    if(selectedEl) {
      selectedEl.classList.add('selected-challenge');
    }
  }
}


function goToNext() {
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  } else {
    stopTimer(); 
    
    if (quizMode === 'challenge') {
      if (window.finishChallenge) {
        window.finishChallenge(userAnswers, {
          reason: 'completed',
          elapsedSeconds: getChallengeElapsedSeconds()
        });
        showChallengeWaitingScreen("Desafio finalizado. Aguardando o outro usuário para disponibilizar o resultado...");
      }
    } else {
      setLanguage('pt-BR'); 
      showResults();
    }
  }
}

function goToPrev() {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
}

// Funções do Timer (Adicionar ao main.js)
function startTimer(durationInSeconds) {
  stopTimer(); 
  let timer = durationInSeconds;
  let timerEl = document.getElementById('quizTimer');
  
  if (!timerEl) {
      const metaEl = document.querySelector('#quiz .meta');
      if (metaEl) {
        timerEl = document.createElement('div');
        timerEl.id = 'quizTimer';
        timerEl.className = 'quiz-timer';
        metaEl.prepend(timerEl);
      } else {
        console.error("Elemento do Timer não encontrado! O renderQuestion foi chamado?");
        return;
      }
  }

  timerEl.style.display = 'block';
  
  function updateDisplay() {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    if(timerEl) timerEl.textContent = `Tempo: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  updateDisplay(); 
  
  quizTimerInterval = setInterval(() => {
    timer--;
    updateDisplay();
    
    if (timer <= 0) {
      stopTimer();
      alert("O tempo acabou!");
      if (quizMode === 'challenge' && window.finishChallenge) {
        window.finishChallenge(userAnswers, {
          reason: 'timeout',
          elapsedSeconds: challengeDurationSeconds
        });
        showChallengeWaitingScreen("Desafio finalizado. Aguardando o outro usuário para disponibilizar o resultado...");
      } else {
        goToNext();
      }
    }
  }, 1000);
}

function stopTimer() {
  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }
}


/* ====== Inicialização e Event Listeners ====== */
document.getElementById('startBtn').addEventListener('click', async () => {
  const count = parseInt(document.getElementById('questionCount').value);
  
  if (window.selectedSubjects.length === 0) return alert('Selecione pelo menos uma matéria.');
  if (isNaN(count) || count < 1) return alert('Digite uma quantidade válida.');

  try {
    const allFilesData = await Promise.all(
      window.selectedSubjects.map(async (sub) => {
        const questionsArray = await loadQuizFile(sub.file);
        
        return questionsArray.map(question => ({
          ...question, 
          sourceFile: sub.file 
        }));
      })
    );
    
    const combinedQuestions = allFilesData.flat();
    let filteredQuestions = combinedQuestions;

    if (
      window.selectedSubjects.length === 1 &&
      Array.isArray(window.selectedQuestionFilters) &&
      window.selectedQuestionFilters.length > 0
    ) {
      if (window.activeFilterMode === 'topic') {
        filteredQuestions = combinedQuestions.filter((question) =>
          window.selectedQuestionFilters.includes((question?.assunto || '').toString().trim())
        );
      } else {
        filteredQuestions = combinedQuestions.filter((question) => {
          const refs = extractArticleReferencesFromQuestion(question);
          return window.selectedQuestionFilters.some((selectedRef) => refs.includes(selectedRef));
        });
      }
    }

    if (filteredQuestions.length === 0) {
      return alert(
        window.activeFilterMode === 'topic'
          ? 'Nenhuma questão encontrada para os assuntos selecionados.'
          : 'Nenhuma questão encontrada para os artigos selecionados.'
      );
    }

    startQuiz(filteredQuestions, count);
    
  } catch (e) {
    alert('Erro ao carregar os arquivos de quiz.');
    console.error(e);
  }
});

document.getElementById('clearSelection').addEventListener('click', () => {
  clearSelectionUI(); // Função da ui.js
  resetArticleFilterUI();
});

const articleFilterSelect = document.getElementById('articleFilterSelect');
if (articleFilterSelect) {
  articleFilterSelect.addEventListener('change', (event) => {
    window.selectedQuestionFilters = Array
      .from(event.target.selectedOptions)
      .map((option) => option.value);
  });
}
