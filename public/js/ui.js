/* ====== CÓDIGO COMPLETO PARA: js/ui.js ====== */
// (selectedSubjects é uma var global definida em main.js)

function renderQuestion() {
  const quizDiv = document.getElementById("quiz");
  const q = questions[currentQuestion];
  
  const userAnswer = userAnswers[q.id];
  const isAnswered = (userAnswer !== undefined);

  // 1. Monta o HTML das alternativas (sem alteração)
  const optionsHtml = Object.entries(q.alternativas || {}).map(([key, value]) => {
    let classes = 'option';
    let clickEvent = `onclick="selectOption('${q.id}', '${key}')"`;
    if (isAnswered) {
      clickEvent = '';
      if (key === q.resposta_correta) {
        classes += ' correct';
      } else if (key === userAnswer) {
        classes += ' wrong';
      }
    }
    return `<li class="${classes}" ${clickEvent}>${key}) ${value}</li>`;
  }).join('');

  // 2. Monta o HTML do feedback (comentário)
  let feedbackHtml = '';
  if (isAnswered) {
    const isCorrect = (userAnswer === q.resposta_correta);
    
    // --- MUDANÇA AQUI: Adiciona data-translate-key ---
    const feedbackTitle = isCorrect
      ? `<p class="feedback correct" data-translate-key="feedbackCorrect">✅ Correto!</p>`
      : `<p class="feedback wrong" data-translate-key="feedbackWrong">❌ Errado! Resposta correta: ${q.resposta_correta})</p>`;
    
    const feedbackComment = q.comentario
      ? `<div class="comentario"><strong data-translate-key="feedbackComment">Comentário:</strong> ${q.comentario.replace(/\n/g,'<br>')}</div>`
      : '';
      
    feedbackHtml = feedbackTitle + feedbackComment;
  }
  
  // 3. Monta o HTML da Navegação
  const prevDisabled = (currentQuestion === 0) ? 'disabled' : '';
  const nextKey = (currentQuestion === questions.length - 1) ? 'finishButton' : 'nextButton';
  const nextButtonText = (currentQuestion === questions.length - 1) ? 'Finalizar' : 'Próxima';

  // --- MUDANÇA AQUI: Adiciona data-translate-key ---
  const navHtml = `
    <div class="quiz-nav">
      <button onclick="goToPrev()" ${prevDisabled} data-translate-key="prevButton">Anterior</button>
      <span>${currentQuestion + 1} de ${questions.length}</span>
      <button onclick="goToNext()" data-translate-key="${nextKey}">${nextButtonText}</button>
    </div>
  `;

  // 4. Monta o HTML final e insere na página
  const formattedEnunciado = (q.enunciado || '').replace(/\n/g, "<br>");
  
  // --- MUDANÇA AQUI: Adiciona data-translate-key ---
  quizDiv.innerHTML = `
    <div class="meta">
      <strong data-translate-key="metaDiscipline">Disciplina:</strong> ${q.disciplina || 'N/I'} • 
      <strong data-translate-key="metaBanca">Banca:</strong> ${q.banca || 'N/I'} • 
      <strong data-translate-key="metaAno">Ano:</strong> ${q.ano || 'N/I'}
    </div>
    <div class="question">
      <h2>${currentQuestion + 1}. ${formattedEnunciado}</h2>
      <ul class="options">${optionsHtml}</ul>
      <div id="feedback">${feedbackHtml}</div>
    </div>
    ${navHtml}
  `;
  
  // --- MUDANÇA AQUI: Chama o tradutor ---
  translatePage(); // Traduz a UI recém-renderizada
}

// -------------------------------------------------------------------

function showResults() {
  let correctCount = 0;
  const errorsByDiscipline = {}; 
  const wrongQuestions = []; 

  // ... (cálculo de erros sem alteração) ...
  questions.forEach(q => {
    const user = userAnswers[q.id];
    const right = q.resposta_correta;
    const topic = getErrorTopic(q); 

    if (user === right) {
      correctCount++;
    } else {
      if (user) { 
        if (!errorsByDiscipline[topic]) {
          errorsByDiscipline[topic] = 0;
        }
        errorsByDiscipline[topic]++;
        wrongQuestions.push(q);
      }
    }
  });
  const wrongCount = wrongQuestions.length;
  const unansweredCount = questions.length - correctCount - wrongCount;

  // 2. Construir o HTML dos Resultados
  // --- MUDANÇA AQUI: Adiciona data-translate-key ---
  let resultHTML = `
    <h2 data-translate-key="resultsTitle">Resultado Final</h2>
    <div class="charts-container" style="display: flex; gap: 20px; margin: 24px 0; flex-wrap: wrap; justify-content: center;">
      <div class="chart-box" style="flex: 1; min-width: 250px; max-width: 350px; background: #fbfdff; padding: 15px; border-radius: 10px; border: 1px solid #eef3fb;">
        <h3 style="margin-top:0; text-align:center; color: #27455a;" data-translate-key="chartsGeneral">Desempenho Geral</h3>
        <canvas id="pizzaChart"></canvas>
      </div>
      <div class="chart-box" style="flex: 1.5; min-width: 300px; max-width: 500px; background: #fbfdff; padding: 15px; border-radius: 10px; border: 1px solid #eef3fb;">
        <h3 style="margin-top:0; text-align:center; color: #27455a;" data-translate-key="chartsErrors">Tópicos com Erros</h3>
        <canvas id="barChart"></canvas>
      </div>
    </div>
    <hr style="border:0; border-top: 2px solid #f0f3f7; margin: 25px 0;">
  `;

  // --- MUDANÇA AQUI: Adiciona data-translate-key e data-total/data-correct ---
  resultHTML += `
    <div class='result' style="padding-bottom: 20px;">
      <h3 data-translate-key="resultsSummary" data-correct="${correctCount}" data-total="${questions.length}">
        Você acertou ${correctCount} de ${questions.length} questões.
      </h3>
      <div class="button-row" style="justify-content: center; margin-top: 15px;">
        <button id="retryBtn" data-translate-key="retryButton">Refazer</button>
        <button id="printErrorsBtn" class="button-ghost" style="${wrongQuestions.length === 0 ? 'display:none;' : ''}" data-translate-key="printButton">
          Imprimir Erradas (${wrongQuestions.length})
        </button>
      </div>
    </div>`;

  // ... (loop de questões sem alteração) ...
  questions.forEach((q, index) => {
    const user = userAnswers[q.id];
    const right = q.resposta_correta;
    if (!user) return; 
    resultHTML += `
      <div class="question" style="text-align:left; margin-bottom:14px; background: #fdfdfd; padding: 10px; border-radius: 8px; border: 1px solid #f1f6fb;">
        <h3 style="margin:6px 0 10px 0; font-size: 1rem;">${index + 1}. ${(q.enunciado || '').replace(/\n/g, "<br>")}</h3>
        <ul class="options">
          ${Object.entries(q.alternativas || {}).map(([k,v]) => {
            const classes = [];
            if (k === right) classes.push('correct');
            if (user === k && user !== right) classes.push('wrong');
            let bgStyle = '#f1f2f6'; 
            if (k === right) bgStyle = '#daf7e8'; 
            else if (user === k) bgStyle = '#ffe7e7'; 
            return `<li class="option ${classes.join(' ')}" style="cursor:default; transform:none; background: ${bgStyle};">${k}) ${v}</li>`;
          }).join('')}
        </ul>
        ${q.comentario ? `<div class="comentario"><strong data-translate-key="feedbackComment">Comentário:</strong> ${q.comentario.replace(/\n/g,'<br>')}</div>` : ""}
      </div>`;
  });

  // 3. Renderizar o HTML na área do quiz
  const quizDiv = document.getElementById("quiz");
  quizDiv.innerHTML = resultHTML;
  quizDiv.scrollIntoView({ behavior: 'smooth' });

  // 4. Renderizar Gráficos e Adicionar Listener
  requestAnimationFrame(() => {
    
    const btn = document.getElementById('retryBtn');
    if (btn) btn.addEventListener('click', () => location.reload()); 

    const printBtn = document.getElementById('printErrorsBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        generatePrintPage(wrongQuestions); 
      });
    }

    // --- Gráfico de Pizza ---
    const pizzaCtx = document.getElementById('pizzaChart');
    if (pizzaCtx) {
      new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
          // --- MUDANÇA AQUI: Usa o dicionário para os labels ---
          labels: [
            translations[currentLang].chartsCorrect,
            translations[currentLang].chartsWrong,
            translations[currentLang].chartsUnanswered
          ],
          datasets: [{
            data: [correctCount, wrongCount, unansweredCount],
            backgroundColor: ['#00b894', '#d63031', '#bdc3c7'], 
            hoverOffset: 4
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    // --- Gráfico de Barras (sem alteração) ---
    const barCtx = document.getElementById('barChart');
    const errorEntries = Object.entries(errorsByDiscipline); 
    if (barCtx && errorEntries.length > 0) {
      new Chart(barCtx, {
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
    } else if (barCtx) {
      barCtx.parentElement.innerHTML += '<p style="text-align:center; color:var(--muted); margin-top:20px;">Nenhum erro registrado. Parabéns!</p>';
      barCtx.remove(); 
    }
    
    // --- MUDANÇA AQUI: Chama o tradutor no final ---
    translatePage();
  });
}

// -------------------------------------------------------------------

/* ====== seleção de subitem (UI) ====== */
function clearSelectionUI() {
  selectedSubjects = []; 
  document.querySelectorAll('.subitem.selected').forEach(el => el.classList.remove('selected'));
  updateSelectedSummary();
}

/**
 * Atualiza o texto do sumário com base no array 'selectedSubjects'.
 */
function updateSelectedSummary() {
  const summaryDiv = document.getElementById('selectedSummary');
  
  if (selectedSubjects.length === 0) {
    summaryDiv.textContent = translations[currentLang].noneSelected; // Traduzido
  } else if (selectedSubjects.length === 1) {
    summaryDiv.textContent = selectedSubjects[0].name; // Nome da matéria
  } else {
    const total = selectedSubjects.reduce((acc, s) => acc + s.count, 0);
    // Texto complexo, melhor não traduzir por enquanto
    summaryDiv.textContent = `${selectedSubjects.length} matérias selecionadas (${total} questões)`;
  }
}


// -------------------------------------------------------------------

/**
 * MODIFICADO: generatePrintPage agora usa o tradutor
 */
function generatePrintPage(questionsToPrint) {
  
  // Pega o dicionário do idioma atual
  const dict = translations[currentLang];

  // --- Ícones SVG (sem alteração) ---
  const iconQuestion = `<svg ...></svg>`; // (código completo omitido por brevidade)
  const iconAnswer = `<svg ...></svg>`;
  const iconComment = `<svg ...></svg>`;

  let printHtml = `
    <!DOCTYPE html>
    <html lang="${currentLang}">
    <head>
      <meta charset="UTF-8">
      <title>${dict.printTitle}</title>
      <style>
        /* ... (todo o seu CSS de flashcard sem alteração) ... */
      </style>
    </head>
    <body>
      <h1>${dict.printTitle}</h1>
      <p class="info" data-translate-key="printInfo" data-total="${questionsToPrint.length}">
        ${dict.printInfo.replace('{total}', questionsToPrint.length)}
      </p>
    `;

  // Loop nas questões
  questionsToPrint.forEach((q) => { 
    // ... (código de formatação de texto sem alteração) ...
    const formattedEnunciado = (q.enunciado || '').replace(/\n/g, "<br>");
    const correctAnswerKey = q.resposta_correta;
    const correctAnswerText = (q.alternativas && q.alternativas[correctAnswerKey]) ? q.alternativas[correctAnswerKey] : 'N/A';
    const formattedComentario = (q.comentario || '').replace(/\n/g, '<br>');

    printHtml += `
      <div class="card-container">
        <!-- FRENTE (Pergunta) -->
        <div class="card-front">
          <div class="card-tag tag-question">
            ${iconQuestion}
            <span>${dict.feedbackQuestion || 'PERGUNTA'}</span> <!-- (Adicionar 'feedbackQuestion' ao dict se quiser) -->
          </div>
          <div class="question-text">
            ${formattedEnunciado}
          </div>
        </div>
        
        <!-- VERSO (Resposta) -->
        <div class="card-back">
          <div class="answer-wrapper">
            <div class="card-tag tag-answer">
              ${iconAnswer}
              <span>${dict.feedbackWrong.split(':')[0] || 'RESPOSTA CORRETA'}</span>
            </div>
            <div class="answer-text">
              ${correctAnswerKey}) ${correctAnswerText}
            </div>
          </div>
          
          ${q.comentario ? `
            <div class="comment-wrapper">
              <div class="card-tag tag-comment">
                ${iconComment}
                <span>${dict.feedbackComment.replace(':','')}</span>
              </div>
              <div class="comment-text">
                ${formattedComentario}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  });

  printHtml += `
    </body>
    </html>
  `;

  // Abrir em uma nova janela e chamar a impressão
  const printWindow = window.open('', '_blank');
  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
