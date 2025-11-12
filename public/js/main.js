/* ====== Estado Global ====== */
let allQuestions = [];
let questions = [];
let currentQuestion = 0; // Agora é o "ponteiro" da questão atual
let userAnswers = {};
let lockSelection = false; // Não vamos mais usar isso, mas pode ficar

// Removido AUTO_DELAY_MS, não é mais necessário
let subjectsIndex = []; 
let selectedSubjects = []; 

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

    // agrupar
    const groups = {};
    enriched.forEach(item => {
      const key = getGroupKey(item.name); // Função do helpers.js
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    // ordenar grupos por nome
    const root = document.getElementById('foldersRoot');
    root.innerHTML = '';
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
  questions = shuffled.slice(0, count);
  currentQuestion = 0;
  userAnswers = {}; // Reseta as respostas
  document.getElementById('quiz').style.display = 'block';
  document.getElementById('quiz').scrollIntoView({ behavior: 'smooth' });
  renderQuestion(); // Função do ui.js
}

/**
 * NOVA LÓGICA: selectOption apenas registra a resposta e
 * renderiza novamente a questão no estado "respondido".
 */
function selectOption(questionId, optionKey) {
  // Se a questão já foi respondida, não faz nada
  if (userAnswers[questionId]) {
    return;
  }
  
  // Registra a resposta do usuário
  userAnswers[questionId] = optionKey;
  
  // Renderiza a mesma questão novamente, agora com a resposta
  renderQuestion();
}


/**
 * NOVO: Função para o botão "Próxima / Finalizar".
 */
function goToNext() {
  if (currentQuestion < questions.length - 1) {
    // Ainda há questões, avança
    currentQuestion++;
    renderQuestion();
  } else {
    // É a última questão, mostra os resultados
    showResults();
  }
}

/**
 * NOVO: Função para o botão "Anterior".
 */
function goToPrev() {
  if (currentQuestion > 0) {
    // Volta uma questão
    currentQuestion--;
    renderQuestion();
  }
}


/* ====== Inicialização e Event Listeners ====== */

document.getElementById('startBtn').addEventListener('click', async () => {
  const count = parseInt(document.getElementById('questionCount').value);
  
  if (selectedSubjects.length === 0) return alert('Selecione pelo menos uma matéria.');
  if (isNaN(count) || count < 1) return alert('Digite uma quantidade válida.');

  try {
    const allFilesData = await Promise.all(
      selectedSubjects.map(sub => loadQuizFile(sub.file))
    );
    
    const combinedQuestions = allFilesData.flat(); 
    startQuiz(combinedQuestions, count);
    
  } catch (e) {
    alert('Erro ao carregar os arquivos de quiz.');
    console.error(e);
  }
});

document.getElementById('clearSelection').addEventListener('click', () => {
  clearSelectionUI(); // Função da ui.js
});

// A inicialização (loadSubjects/loadPDFs) é chamada pelo seu 'gate.js' ou 'app.js',
// Se você removeu esses arquivos, descomente as 2 linhas abaixo:
loadSubjects();
loadPDFs();
