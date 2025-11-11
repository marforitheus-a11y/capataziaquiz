function renderQuestion() {
  const quizDiv = document.getElementById("quiz");
  const q = questions[currentQuestion];
  lockSelection = false;

  const formattedEnunciado = (q.enunciado || '').replace(/\n/g, "<br>");

  const optionsHtml = Object.entries(q.alternativas || {}).map(([key, value]) => `
    <li class="option" data-key="${key}" onclick="selectOption('${q.id}', '${key}', this)">
      ${key}) ${value}
    </li>
  `).join('');

  quizDiv.innerHTML = `
    <div class="meta">
      <strong>Disciplina:</strong> ${q.disciplina || 'N/I'} • 
      <strong>Banca:</strong> ${q.banca || 'N/I'} • 
      <strong>Ano:</strong> ${q.ano || 'N/I'}
    </div>
    <div class="question">
      <h2>${currentQuestion + 1}. ${formattedEnunciado}</h2>
      <ul class="options">${optionsHtml}</ul>
      <div id="feedback"></div>
    </div>
  `;
}

/* ====== SUBSTITUA SUA FUNÇÃO showResults() EM js/ui.js POR ESTA ====== */

function showResults() {
  let correctCount = 0;
  const errorsByDiscipline = {}; 
  const wrongQuestions = []; // <-- NOVO: Array para guardar questões erradas

  // 1. Processar dados para os gráficos
  questions.forEach(q => {
    const user = userAnswers[q.id];
    const right = q.resposta_correta;
    const topic = getErrorTopic(q); // Função do helpers.js

    if (user === right) {
      correctCount++;
    } else {
      // É um erro, registrar para o gráfico de barras
      if (!errorsByDiscipline[topic]) {
        errorsByDiscipline[topic] = 0;
      }
      errorsByDiscipline[topic]++;
      wrongQuestions.push(q); // <-- NOVO: Adiciona a questão errada ao array
    }
  });

  const wrongCount = questions.length - correctCount;

  // 2. Construir o HTML dos Resultados
  let resultHTML = `
    <h2>Resultado Final</h2>
    <div class="charts-container" style="display: flex; gap: 20px; margin: 24px 0; flex-wrap: wrap; justify-content: center;">
      <div class="chart-box" style="flex: 1; min-width: 250px; max-width: 350px; background: #fbfdff; padding: 15px; border-radius: 10px; border: 1px solid #eef3fb;">
        <h3 style="margin-top:0; text-align:center; color: #27455a;">Desempenho Geral</h3>
        <canvas id="pizzaChart"></canvas>
      </div>
      <div class="chart-box" style="flex: 1.5; min-width: 300px; max-width: 500px; background: #fbfdff; padding: 15px; border-radius: 10px; border: 1px solid #eef3fb;">
        <h3 style="margin-top:0; text-align:center; color: #27455a;">Tópicos com Erros</h3>
        <canvas id="barChart"></canvas>
      </div>
    </div>
    <hr style="border:0; border-top: 2px solid #f0f3f7; margin: 25px 0;">
  `;

  // Resumo e Botões de Ação
  resultHTML += `
    <div class='result' style="padding-bottom: 20px;">
      <h3>Você acertou ${correctCount} de ${questions.length} questões.</h3>
      
      <div class="button-row" style="justify-content: center; margin-top: 15px;">
        <button id="retryBtn">Refazer</button>
        
        <button id="printErrorsBtn" class="button-ghost" style="${wrongQuestions.length === 0 ? 'display:none;' : ''}">
          Imprimir Erradas (${wrongQuestions.length})
        </button>
      </div>
    </div>`;

  // Lista de Questões (como antes)
  questions.forEach((q, index) => {
    // ... (O restante deste loop continua o mesmo) ...
    const user = userAnswers[q.id];
    const right = q.resposta_correta;
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
        ${q.comentario ? `<div class="comentario"><strong>Comentário:</strong> ${q.comentario.replace(/\n/g,'<br>')}</div>` : ""}
      </div>`;
  });

  // 3. Renderizar o HTML na área do quiz
  const quizDiv = document.getElementById("quiz");
  quizDiv.innerHTML = resultHTML;
  quizDiv.scrollIntoView({ behavior: 'smooth' });

  // 4. Renderizar Gráficos e Adicionar Listener
  requestAnimationFrame(() => {
    
    // Listener do botão Refazer
    const btn = document.getElementById('retryBtn');
    if (btn) btn.addEventListener('click', () => location.reload());

    // <-- NOVO: Listener para o botão de impressão -->
    const printBtn = document.getElementById('printErrorsBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        // Chama a nova função que vamos criar
        generatePrintPage(wrongQuestions); 
      });
    }
    // <-- FIM DA NOVA SEÇÃO -->

    // --- Renderizar Gráfico de Pizza ---
    // ... (o código dos gráficos permanece o mesmo) ...
    const pizzaCtx = document.getElementById('pizzaChart');
    if (pizzaCtx) {
      new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
          labels: ['Acertos', 'Erros'],
          datasets: [{
            data: [correctCount, wrongCount],
            backgroundColor: ['#00b894', '#d63031'], 
            hoverOffset: 4
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    // --- Renderizar Gráfico de Barras ---
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
  });
}

/* ====== seleção de subitem (UI) ====== */
function clearSelectionUI() {
  selectedFile = null;
  document.getElementById('selectedSummary').textContent = 'Nenhuma selecionada';
  // remover destaque
  document.querySelectorAll('.subitem.selected').forEach(el => el.classList.remove('selected'));
  /* ====== ADICIONE ESTA NOVA FUNÇÃO AO FINAL DE js/ui.js ====== */

/**
 * Gera uma nova página com as questões erradas e abre a janela de impressão.
 * @param {Array} questionsToPrint - Um array de objetos de questão (apenas as erradas).
 */

}
@param {Array} questionsToPrint - Um array de objetos de questão (apenas as erradas).
 */
function generatePrintPage(questionsToPrint) {
  let printHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Revisão de Questões</title>
      <style>
        body {
          font-family: "Poppins", sans-serif;
          line-height: 1.6;
          margin: 40px;
          color: #2d3436;
        }
        .flashcard {
          page-break-inside: avoid; /* Evita que o card quebre entre páginas */
          border: 1px solid #ccc;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 20px;
          background: #fdfdfd;
        }
        .question {
          font-weight: 600;
          font-size: 1.1rem;
          margin-bottom: 14px;
        }
        .answer {
          background: #f0f7ff;
          border-left: 4px solid #0984e3; /* Cor primária */
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 1rem;
        }
        .answer strong {
          color: #00b894; /* Cor correta */
          font-weight: 600;
        }
        .comment {
          font-style: italic;
          font-size: 0.95rem;
          color: #555;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed #eee;
        }
        h1 {
          color: #0984e3;
        }
        @media print {
          body { margin: 25px; }
          h1 { font-size: 1.5rem; }
          .flashcard { border: 1px solid #aaa; box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <h1>Revisão de Questões Erradas</h1>
      <p>Total de ${questionsToPrint.length} questões para revisar.</p>
      <hr>
    `;

  // Loop nas questões e cria um "card" para cada
  questionsToPrint.forEach((q, index) => {
    const formattedEnunciado = (q.enunciado || '').replace(/\n/g, "<br>");
    const correctAnswerKey = q.resposta_correta;
    const correctAnswerText = (q.alternativas && q.alternativas[correctAnswerKey]) ? q.alternativas[correctAnswerKey] : 'N/A';
    const formattedComentario = (q.comentario || '').replace(/\n/g, '<br>');

    printHtml += `
      <div class="flashcard">
        <div class="question">${index + 1}. ${formattedEnunciado}</div>
        <div class="answer">
          <strong>Resposta Correta: ${correctAnswerKey})</strong> ${correctAnswerText}
        </div>
        ${q.comentario ? `<div class="comment"><strong>Comentário:</strong> ${formattedComentario}</div>` : ''}
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
  
  // Chamar a impressão (um pequeno delay ajuda a garantir que o CSS carregou)
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
