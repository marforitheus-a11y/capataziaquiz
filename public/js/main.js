/* ====== Estado Global ====== */
let allQuestions = [];
let questions = [];
let currentQuestion = 0;
let userAnswers = {};
let lockSelection = false;
const AUTO_DELAY_MS = 1000;

let subjectsIndex = []; 
// NOVO: Alterado para um array para suportar multisseleção
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
      const arr = groups[groupName]; // 'arr' contém todos os subitens desta pasta
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
        
        // MUDANÇA: Lógica de clique do subitem (toggle)
        li.addEventListener('click', (e) => {
          e.stopPropagation(); // Impede que o clique dispare o clique do 'header'
          toggleSelectSubitem(sub, li); // Nova função
        });
        sublist.appendChild(li);
      });

      // MUDANÇA: Lógica de clique do header (abrir/fechar E selecionar/desmarcar todos)
      const header = folder.querySelector('.folder-header');
      header.addEventListener('click', () => {
        // 1. Abrir/fechar
        const isOpen = folder.classList.toggle('open');
        sublist.style.display = isOpen ? 'block' : 'none';
        
        // 2. Selecionar/Desmarcar todos os filhos
        toggleSelectFolder(arr, folder); // Nova função
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
  // Não definimos allQuestions aqui, apenas retornamos os dados
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

/**
 * NOVO: Adiciona ou remove um único subitem da seleção.
 */
function toggleSelectSubitem(sub, element) {
  const index = selectedSubjects.findIndex(s => s.file === sub.file);
  
  if (index > -1) {
    // Já selecionado -> remover
    selectedSubjects.splice(index, 1);
    element.classList.remove('selected');
  } else {
    // Não selecionado -> adicionar
    selectedSubjects.push(sub);
    element.classList.add('selected');
  }
  
  updateSelectedSummary(); // Função da ui.js
}

/**
 * NOVO: Seleciona ou desmarca todos os subitens de uma pasta.
 */
function toggleSelectFolder(subsInFolder, folderElement) {
  const subitemElements = folderElement.querySelectorAll('.subitem');
  
  // Verifica se todos na pasta já estão selecionados
  const allAlreadySelected = subsInFolder.every(
    sub => selectedSubjects.find(s => s.file === sub.file)
  );

  if (allAlreadySelected) {
    // --- DESMARCAR TODOS ---
    subsInFolder.forEach(sub => {
      const index = selectedSubjects.findIndex(s => s.file === sub.file);
      if (index > -1) {
        selectedSubjects.splice(index, 1);
      }
    });
    subitemElements.forEach(el => el.classList.remove('selected'));
  } else {
    // --- MARCAR TODOS ---
    subsInFolder.forEach(sub => {
      const index = selectedSubjects.findIndex(s => s.file === sub.file);
      if (index === -1) { // Adiciona apenas se não estiver lá
        selectedSubjects.push(sub);
      }
    });
    subitemElements.forEach(el => el.classList.add('selected'));
  }

  updateSelectedSummary(); // Função da ui.js
}


function startQuiz(data, count) {
  // 'data' agora é o array combinado de todas as questões
  allQuestions = data; // Atualiza o allQuestions com a lista combinada
  const shuffled = allQuestions.slice().sort(() => 0.5 - Math.random());
  questions = shuffled.slice(0, count);
  currentQuestion = 0;
  userAnswers = {};
  document.getElementById('quiz').style.display = 'block';
  document.getElementById('quiz').scrollIntoView({ behavior: 'smooth' });
  renderQuestion(); // Função do ui.js
}

function selectOption(questionId, optionKey, element) {
  if (lockSelection) return;
  lockSelection = true;
  // MUDANÇA: Procura em 'questions' (o array do quiz atual)
  const q = questions.find(x => x.id == questionId);
  const correct = q.resposta_correta;
  userAnswers[questionId] = optionKey;

  const parent = element.parentElement;
  const options = parent.querySelectorAll('.option');
  options.forEach(opt => {
    const key = opt.getAttribute('data-key');
    if (key === correct) opt.classList.add('correct');
    if (key === optionKey && optionKey !== correct) opt.classList.add('wrong');
    opt.setAttribute('aria-disabled', 'true');
  });

  const feedbackDiv = document.getElementById('feedback');
  feedbackDiv.innerHTML = optionKey === correct
    ? `<p class="feedback correct">✅ Correto!</p>`
    : `<p class="feedback wrong">❌ Errado! Resposta correta: ${correct}) ${q.alternativas[correct]}</p>`;

  setTimeout(() => {
    if (currentQuestion < questions.length - 1) {
      currentQuestion++;
      renderQuestion(); // Função do ui.js
    } else {
      showResults(); // Função do ui.js
    }
  }, AUTO_DELAY_MS);
}


/* ====== Inicialização e Event Listeners ====== */

document.getElementById('startBtn').addEventListener('click', async () => {
  const count = parseInt(document.getElementById('questionCount').value);
  
  // MUDANÇA: Verifica o array 'selectedSubjects'
  if (selectedSubjects.length === 0) return alert('Selecione pelo menos uma matéria.');
  if (isNaN(count) || count < 1) return alert('Digite uma quantidade válida.');

  try {
    // MUDANÇA: Carrega TODOS os arquivos selecionados em paralelo
    const allFilesData = await Promise.all(
      selectedSubjects.map(sub => loadQuizFile(sub.file))
    );
    
    // MUDANÇA: Combina os arrays de questões em um só
    const combinedQuestions = allFilesData.flat(); // .flat() junta [[1,2], [3,4]] em [1,2,3,4]

    // Inicia o quiz com o array combinado
    startQuiz(combinedQuestions, count);
    
  } catch (e) {
    alert('Erro ao carregar os arquivos de quiz.');
    console.error(e);
  }
});

document.getElementById('clearSelection').addEventListener('click', () => {
  clearSelectionUI(); // Função do ui.js
});


