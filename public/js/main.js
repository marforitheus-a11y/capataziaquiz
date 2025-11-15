/* ====== Início do js/main.js (Corrigido) ====== */

/* ====== Estado Global ====== */
let allQuestions = [];
let questions = [];
let currentQuestion = 0; 
let userAnswers = {};
let lockSelection = false; 

let subjectsIndex = []; 
let selectedSubjects = []; 

/* ====== Carregar Dados (API/JSON) ====== */

async function loadSubjects(userName) { // Passa o userName
  try {
    const res = await fetch('/data/index.json'); 
    if (!res.ok) throw new Error('Falha ao carregar index.json');
    const allSubjects = await res.json(); 

    // Lógica de Filtragem (para o login)
    const filteredSubjects = allSubjects.filter(subject => {
      if (!subject.users) {
        return true; 
      }
      return subject.users.includes(userName);
    });
    // Fim da Lógica de Filtragem

    const enriched = await Promise.all(filteredSubjects.map(async s => {
      try {
        const r = await fetch(`/data/${s.file}`); 
        if (!r.ok) throw new Error();
        const data = await r.json();
        return { name: s.name, file: s.file, count: (Array.isArray(data) ? data.length : 0) };
      } catch (e) {
        return { name: s.name, file: s.file, count: 0 };
      }
    }));

    // (O resto da função de agrupar)
    const groups = {};
    enriched.forEach(item => {
      const key = getGroupKey(item.name); // Função do helpers.js
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    const root = document.getElementById('foldersRoot');
    root.innerHTML = '';
    
    if (enriched.length === 0) {
      document.getElementById('foldersLoading').textContent = 'Nenhum conteúdo encontrado para este perfil.';
      return;
    }
    
    Object.keys(groups).sort().forEach(groupName => {
      const arr = groups[groupName]; 
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

function toggleSelectSubitem(sub, element) {
  const index = selectedSubjects.findIndex(s => s.file === sub.file);
  
  if (index > -1) {
    selectedSubjects.splice(index, 1);
    element.classList.remove('selected');
  } else {
    selectedSubjects.push(sub);
    element.classList.add('selected');
  }
  
  updateSelectedSummary(); // Função da ui.js
}

function toggleSelectFolder(subsInFolder, folderElement) {
  const subitemElements = folderElement.querySelectorAll('.subitem');
  
  const allAlreadySelected = subsInFolder.every(
    sub => selectedSubjects.find(s => s.file === sub.file)
  );

  if (allAlreadySelected) {
    subsInFolder.forEach(sub => {
      const index = selectedSubjects.findIndex(s => s.file === sub.file);
      if (index > -1) {
        selectedSubjects.splice(index, 1);
      }
    });
    subitemElements.forEach(el => el.classList.remove('selected'));
  } else {
    subsInFolder.forEach(sub => {
      const index = selectedSubjects.findIndex(s => s.file === sub.file);
      if (index === -1) { 
        selectedSubjects.push(sub);
      }
    });
    subitemElements.forEach(el => el.classList.add('selected'));
  }

  updateSelectedSummary(); // Função da ui.js
}


function startQuiz(data, count) {
  allQuestions = data; 
  const shuffled = allQuestions.slice().sort(() => 0.5 - Math.random());
  
  // Verifica se a contagem pedida é maior que o pool único
  const numToDraw = Math.min(count, allQuestions.length);
  
  questions = shuffled.slice(0, numToDraw);
  currentQuestion = 0;
  userAnswers = {};
  document.getElementById('quiz').style.display = 'block';
  document.getElementById('quiz').scrollIntoView({ behavior: 'smooth' });
  renderQuestion(); // Função do ui.js
}

function selectOption(questionId, optionKey) {
  if (userAnswers[questionId]) {
    return;
  }
  
  userAnswers[questionId] = optionKey;
  
  const q = questions.find(item => item.id == questionId); 
  
  if (!q) {
    console.error(`Erro: Questão com ID ${questionId} não encontrada.`);
    return; 
  }

  const isCorrect = (optionKey === q.resposta_correta);
  
  if (isCorrect) {
    setLanguage('pt-BR'); 
  } else {
    setLanguage('ja-JP'); 
  }
  
  // Envia a reação
  if (window.sendQuizReaction) {
    window.sendQuizReaction(isCorrect);
  }
  
  // Salva o progresso
  if (window.saveQuestionProgress) {
    window.saveQuestionProgress(q, isCorrect);
  }

  renderQuestion();
}


function goToNext() {
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  } else {
    setLanguage('pt-BR'); 
    showResults();
  }
}

function goToPrev() {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
}


/* ====== Inicialização e Event Listeners ====== */

document.getElementById('startBtn').addEventListener('click', async () => {
  const countInput = document.getElementById('questionCount');
  let count = parseInt(countInput.value);
  
  if (selectedSubjects.length === 0) {
    alert('Selecione pelo menos uma matéria.');
    return;
  }

  try {
    const allFilesData = await Promise.all(
      selectedSubjects.map(async (sub) => {
        const questionsArray = await loadQuizFile(sub.file);
        
        return questionsArray.map(question => ({
          ...question, 
          sourceFile: sub.file 
        }));
      })
    );
    
    const combinedQuestions = allFilesData.flat(); 

    // --- CORREÇÃO: LÓGICA DE DE-DUPLICAÇÃO ---
    // Cria um 'Map' para guardar questões únicas pela 'id'
    const uniqueQuestionsMap = new Map();
    combinedQuestions.forEach(question => {
      // Usa o 'id' da questão como chave.
      // Isto garante que se a mesma 'id' aparecer várias vezes,
      // apenas a última versão é guardada.
      uniqueQuestionsMap.set(question.id, question);
    });
    
    // Converte o Map de volta para um array
    const uniqueCombinedQuestions = Array.from(uniqueQuestionsMap.values());
    // --- FIM DA LÓGICA DE DE-DUPLICAÇÃO ---

    // Se o utilizador não digitou uma contagem, usa TODAS as questões únicas
    if (isNaN(count) || count < 1) {
        count = uniqueCombinedQuestions.length;
        countInput.value = count; // Atualiza o input para mostrar o total
    }

    // Inicia o quiz com o array de-duplicado
    startQuiz(uniqueCombinedQuestions, count);
    
  } catch (e) {
    alert('Erro ao carregar os arquivos de quiz.');
    console.error(e);
  }
});

document.getElementById('clearSelection').addEventListener('click', () => {
  clearSelectionUI(); // Função da ui.js
});

// As linhas loadSubjects() e loadPDFs() foram removidas daqui.
// O 'app.js' agora é responsável por chamá-las.

/* ====== Fim do js/main.js ====== */
