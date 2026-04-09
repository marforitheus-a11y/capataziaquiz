const state = {
  pdfs: [],
  subjects: [],
  questionsByFile: {},
  selectedFile: null,
  uploadedQuestions: null
};

const el = {
  pdfAdminList: document.getElementById('pdfAdminList'),
  pdfNameInput: document.getElementById('pdfNameInput'),
  pdfFileInput: document.getElementById('pdfFileInput'),
  addPdfBtn: document.getElementById('addPdfBtn'),
  subjectAdminList: document.getElementById('subjectAdminList'),
  subjectNameInput: document.getElementById('subjectNameInput'),
  subjectFileInput: document.getElementById('subjectFileInput'),
  addSubjectBtn: document.getElementById('addSubjectBtn'),
  subjectSelect: document.getElementById('subjectSelect'),
  questionStats: document.getElementById('questionStats'),
  questionsFileUpload: document.getElementById('questionsFileUpload'),
  appendQuestionsBtn: document.getElementById('appendQuestionsBtn'),
  replaceQuestionsBtn: document.getElementById('replaceQuestionsBtn'),
  editQuestionIdInput: document.getElementById('editQuestionIdInput'),
  editQuestionPromptInput: document.getElementById('editQuestionPromptInput'),
  updateQuestionBtn: document.getElementById('updateQuestionBtn'),
  questionList: document.getElementById('questionList'),
  downloadPdfIndexBtn: document.getElementById('downloadPdfIndexBtn'),
  downloadSubjectIndexBtn: document.getElementById('downloadSubjectIndexBtn'),
  downloadSelectedQuestionsBtn: document.getElementById('downloadSelectedQuestionsBtn'),
  adminFeedback: document.getElementById('adminFeedback')
};

function setFeedback(message, isError = false) {
  el.adminFeedback.textContent = message;
  el.adminFeedback.style.color = isError ? '#d63031' : '#0f766e';
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function fetchJson(url, fallback = []) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Falha ao carregar ' + url);
    return await response.json();
  } catch (error) {
    console.error(error);
    return fallback;
  }
}

function renderPdfs() {
  el.pdfAdminList.innerHTML = '';
  state.pdfs.forEach((pdf, index) => {
    const item = document.createElement('li');
    item.className = 'admin-list-item';
    item.innerHTML = `
      <div>
        <strong>${pdf.name}</strong>
        <div class="admin-muted">${pdf.file}</div>
      </div>
      <button class="button-ghost" data-pdf-index="${index}">Remover</button>
    `;
    el.pdfAdminList.appendChild(item);
  });
}

function renderSubjects() {
  el.subjectAdminList.innerHTML = '';
  el.subjectSelect.innerHTML = '';

  state.subjects.forEach((subject, index) => {
    const item = document.createElement('li');
    item.className = 'admin-list-item';
    item.innerHTML = `
      <div>
        <strong>${subject.name}</strong>
        <div class="admin-muted">${subject.file}</div>
      </div>
      <button class="button-ghost" data-subject-index="${index}">Remover</button>
    `;
    el.subjectAdminList.appendChild(item);

    const option = document.createElement('option');
    option.value = subject.file;
    option.textContent = subject.name;
    el.subjectSelect.appendChild(option);
  });

  if (!state.selectedFile && state.subjects.length > 0) {
    state.selectedFile = state.subjects[0].file;
  }

  if (state.selectedFile) {
    el.subjectSelect.value = state.selectedFile;
  }
}

function getSelectedQuestions() {
  if (!state.selectedFile) return [];
  if (!state.questionsByFile[state.selectedFile]) {
    state.questionsByFile[state.selectedFile] = [];
  }
  return state.questionsByFile[state.selectedFile];
}

function renderQuestions() {
  const questions = getSelectedQuestions();
  el.questionStats.textContent = `${questions.length} questão(ões) nesta matéria.`;

  if (questions.length === 0) {
    el.questionList.innerHTML = '<p class="admin-muted">Nenhuma questão cadastrada.</p>';
    return;
  }

  el.questionList.innerHTML = '';
  questions.forEach((q, index) => {
    const row = document.createElement('div');
    row.className = 'question-row';
    row.innerHTML = `
      <div>
        <div><strong>ID:</strong> ${q.id ?? 'sem id'}</div>
        <div>${q.enunciado ?? 'Questão sem enunciado.'}</div>
      </div>
      <button class="button-ghost" data-remove-question-index="${index}">Remover</button>
    `;
    el.questionList.appendChild(row);
  });
}

async function loadInitialData() {
  state.pdfs = await fetchJson('/data/pdf/index.json', []);
  state.subjects = await fetchJson('/data/index.json', []);

  for (const subject of state.subjects) {
    state.questionsByFile[subject.file] = await fetchJson(`/data/${subject.file}`, []);
  }

  renderPdfs();
  renderSubjects();
  renderQuestions();
  setFeedback('Painel carregado.');
}

el.addPdfBtn.addEventListener('click', () => {
  const name = el.pdfNameInput.value.trim();
  const file = el.pdfFileInput.value.trim();

  if (!name || !file) {
    setFeedback('Informe nome e arquivo do PDF.', true);
    return;
  }

  state.pdfs.push({ name, file });
  el.pdfNameInput.value = '';
  el.pdfFileInput.value = '';
  renderPdfs();
  setFeedback('PDF adicionado.');
});

el.pdfAdminList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-pdf-index]');
  if (!button) return;
  const index = Number(button.dataset.pdfIndex);
  state.pdfs.splice(index, 1);
  renderPdfs();
  setFeedback('PDF removido.');
});

el.addSubjectBtn.addEventListener('click', () => {
  const name = el.subjectNameInput.value.trim();
  const file = el.subjectFileInput.value.trim();

  if (!name || !file) {
    setFeedback('Informe nome e arquivo JSON da matéria.', true);
    return;
  }

  state.subjects.push({ name, file });
  if (!state.questionsByFile[file]) state.questionsByFile[file] = [];
  state.selectedFile = file;

  el.subjectNameInput.value = '';
  el.subjectFileInput.value = '';

  renderSubjects();
  renderQuestions();
  setFeedback('Matéria adicionada.');
});

el.subjectAdminList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-subject-index]');
  if (!button) return;

  const index = Number(button.dataset.subjectIndex);
  const removed = state.subjects.splice(index, 1)[0];

  if (removed && state.selectedFile === removed.file) {
    state.selectedFile = state.subjects[0]?.file || null;
  }

  renderSubjects();
  renderQuestions();
  setFeedback('Matéria removida do índice.');
});

el.subjectSelect.addEventListener('change', () => {
  state.selectedFile = el.subjectSelect.value;
  renderQuestions();
});

el.questionsFileUpload.addEventListener('change', async () => {
  const file = el.questionsFileUpload.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      setFeedback('O JSON deve ser um array de questões.', true);
      state.uploadedQuestions = null;
      return;
    }

    state.uploadedQuestions = parsed;
    setFeedback(`Arquivo carregado com ${parsed.length} questão(ões).`);
  } catch (error) {
    console.error(error);
    state.uploadedQuestions = null;
    setFeedback('Erro ao ler JSON de questões.', true);
  }
});

el.appendQuestionsBtn.addEventListener('click', () => {
  if (!state.selectedFile) {
    setFeedback('Selecione uma matéria.', true);
    return;
  }

  if (!Array.isArray(state.uploadedQuestions)) {
    setFeedback('Faça upload do JSON de questões antes.', true);
    return;
  }

  const current = getSelectedQuestions();
  state.questionsByFile[state.selectedFile] = [...current, ...state.uploadedQuestions];
  renderQuestions();
  setFeedback('Questões adicionadas na matéria selecionada.');
});

el.replaceQuestionsBtn.addEventListener('click', () => {
  if (!state.selectedFile) {
    setFeedback('Selecione uma matéria.', true);
    return;
  }

  if (!Array.isArray(state.uploadedQuestions)) {
    setFeedback('Faça upload do JSON de questões antes.', true);
    return;
  }

  state.questionsByFile[state.selectedFile] = [...state.uploadedQuestions];
  renderQuestions();
  setFeedback('Banco de questões substituído para esta matéria.');
});

el.questionList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-remove-question-index]');
  if (!button) return;

  const index = Number(button.dataset.removeQuestionIndex);
  const questions = getSelectedQuestions();
  questions.splice(index, 1);
  renderQuestions();
  setFeedback('Questão removida.');
});

el.updateQuestionBtn.addEventListener('click', () => {
  const targetId = Number(el.editQuestionIdInput.value);
  const newPrompt = el.editQuestionPromptInput.value.trim();

  if (!targetId || !newPrompt) {
    setFeedback('Informe ID e novo enunciado.', true);
    return;
  }

  const questions = getSelectedQuestions();
  const target = questions.find((q) => Number(q.id) === targetId);

  if (!target) {
    setFeedback('Questão não encontrada para este ID.', true);
    return;
  }

  target.enunciado = newPrompt;
  renderQuestions();
  setFeedback('Enunciado atualizado.');
});

el.downloadPdfIndexBtn.addEventListener('click', () => {
  downloadJson('index.json', state.pdfs);
  setFeedback('Download de data/pdf/index.json iniciado.');
});

el.downloadSubjectIndexBtn.addEventListener('click', () => {
  downloadJson('index.json', state.subjects);
  setFeedback('Download de data/index.json iniciado.');
});

el.downloadSelectedQuestionsBtn.addEventListener('click', () => {
  if (!state.selectedFile) {
    setFeedback('Selecione uma matéria para exportar as questões.', true);
    return;
  }

  downloadJson(state.selectedFile, getSelectedQuestions());
  setFeedback(`Download de ${state.selectedFile} iniciado.`);
});

loadInitialData();
