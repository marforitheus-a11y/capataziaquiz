/* ====== CÓDIGO COMPLETO E CORRIGIDO PARA: js/ui.js ====== */
// (selectedSubjects é uma var global definida em main.js)

/**
 * NOVO: renderQuestion foi totalmente reescrito.
 * Agora ele verifica o estado da questão (respondida ou não)
 * antes de decidir o que mostrar.
 */
function renderQuestion() {
  const quizDiv = document.getElementById("quiz");
  const q = questions[currentQuestion];
  
  // Verifica se o usuário já respondeu esta questão
  const userAnswer = userAnswers[q.id];
  const isAnswered = (userAnswer !== undefined);

  // 1. Monta o HTML das alternativas
  const optionsHtml = Object.entries(q.alternativas || {}).map(([key, value]) => {
    
    let classes = 'option';
    let clickEvent = `onclick="selectOption('${q.id}', '${key}')"`;
    
    // Se a questão JÁ FOI RESPONDIDA
    if (isAnswered) {
      clickEvent = ''; // Desativa o clique
      
      // Marca a correta
      if (key === q.resposta_correta) {
        classes += ' correct';
      }
      // Se o usuário respondeu esta E ela está errada
      else if (key === userAnswer) {
        classes += ' wrong';
      }
    }
    
    return `<li class="${classes}" ${clickEvent}>${key}) ${value}</li>`;
    
  }).join('');

  // 2. Monta o HTML do feedback (comentário)
  let feedbackHtml = '';
  if (isAnswered) {
    // O usuário respondeu esta questão, então mostramos o gabarito
    const isCorrect = (userAnswer === q.resposta_correta);
    
    const feedbackTitle = isCorrect
      ? `<p class="feedback correct">✅ Correto!</p>`
      : `<p class="feedback wrong">❌ Errado! Resposta correta: ${q.resposta_correta})</p>`;
    
    const feedbackComment = q.comentario
      ? `<div class="comentario"><strong>Comentário:</strong> ${q.comentario.replace(/\n/g,'<br>')}</div>`
      : '';
      
    feedbackHtml = feedbackTitle + feedbackComment;
  }
  
  // 3. Monta o HTML da Navegação
  const prevDisabled = (currentQuestion === 0) ? 'disabled' : '';
  const nextButtonText = (currentQuestion === questions.length - 1) ? 'Finalizar' : 'Próxima';

  const navHtml = `
    <div class="quiz-nav">
      <button onclick="goToPrev()" ${prevDisabled}>Anterior</button>
      <span>${currentQuestion + 1} de ${questions.length}</span>
      <button onclick="goToNext()">${nextButtonText}</button>
    </div>
  `;

  // 4. Monta o HTML final e insere na página
  const formattedEnunciado = (q.enunciado || '').replace(/\n/g, "<br>");
  
  quizDiv.innerHTML = `
    <div class="meta">
      <strong>Disciplina:</strong> ${q.disciplina || 'N/I'} • 
      <strong>Banca:</strong> ${q.banca || 'N/I'} • 
      <strong>Ano:</strong> ${q.ano || 'N/I'}
    </div>
    <div class="question">
      <h2>${currentQuestion + 1}. ${formattedEnunciado}</h2>
      <ul class="options">${optionsHtml}</ul>
      <div id="feedback">${feedbackHtml}</div>
    </div>
    ${navHtml}
  `;
}

// -------------------------------------------------------------------
// O restante do arquivo (showResults, updateSelectedSummary, etc.)
// permanece o mesmo. Apenas colei eles aqui para garantir.
// -------------------------------------------------------------------

function showResults() {
  let correctCount = 0;
  const errorsByDiscipline = {}; 
  const wrongQuestions = []; 

  // 1. Processar dados para os gráficos
  questions.forEach(q => {
    const user = userAnswers[q.id];
    const right = q.resposta_correta;
    const topic = getErrorTopic(q); 

    if (user === right) {
      correctCount++;
    } else {
      // Se a questão foi respondida (mesmo que errada)
      if (user) { 
        if (!errorsByDiscipline[topic]) {
          errorsByDiscipline[topic] = 0;
        }
        errorsByDiscipline[topic]++;
        wrongQuestions.push(q);
      }
    }
  });

  const wrongCount = wrongQuestions.length; // Conta apenas as erradas
  const unansweredCount = questions.length - correctCount - wrongCount;

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

  // Lista de Questões
  questions.forEach((q, index) => {
    const user = userAnswers[q.id];
    const right = q.resposta_correta;
    
    // Se o usuário não respondeu, não mostra nada
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
        ${q.comentario ? `<div class="comentario"><strong>Comentário:</strong> ${q.comentario.replace(/\n/g,'<br>')}</div>` : ""}
      </div>`;
  });

  // 3. Renderizar o HTML na área do quiz
  const quizDiv = document.getElementById("quiz");
  quizDiv.innerHTML = resultHTML;
  quizDiv.scrollIntoView({ behavior: 'smooth' });

  // 4. Renderizar Gráficos e Adicionar Listener
  requestAnimationFrame(() => {
    
    const btn = document.getElementById('retryBtn');
    if (btn) btn.addEventListener('click', () => location.reload()); // Recarrega a página inteira para recomeçar

    const printBtn = document.getElementById('printErrorsBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        generatePrintPage(wrongQuestions); 
      });
    }

    // --- Gráfico de Pizza ---
    // NOVO: Adiciona "Não respondidas" ao gráfico
    const pizzaCtx = document.getElementById('pizzaChart');
    if (pizzaCtx) {
      new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
          labels: ['Acertos', 'Erros', 'Não Respondidas'],
          datasets: [{
            data: [correctCount, wrongCount, unansweredCount],
            backgroundColor: ['#00b894', '#d63031', '#bdc3c7'], 
            hoverOffset: 4
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    // --- Gráfico de Barras ---
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
    summaryDiv.textContent = 'Nenhuma selecionada';
  } else if (selectedSubjects.length === 1) {
    summaryDiv.textContent = selectedSubjects[0].name;
  } else {
    const total = selectedSubjects.reduce((acc, s) => acc + s.count, 0);
    summaryDiv.textContent = `${selectedSubjects.length} matérias selecionadas (${total} questões)`;
  }
}


// -------------------------------------------------------------------

/**
 * Gera uma nova página com as questões erradas em formato de flashcard (frente/verso).
 */
function generatePrintPage(questionsToPrint) {
  let printHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Revisão de Questões (Flashcards)</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
        
        body {
          font-family: "Poppins", sans-serif;
          line-height: 1.5;
          margin: 20px;
          color: #2d3436;
          background: #f5f6fa;
        }

        .card-container {
          max-width: 500px; 
          margin: 15px auto; 
          width: 100%;
          page-break-inside: avoid;
          margin-bottom: 15px;
          border-radius: 10px;
          border: 1px solid #aaa;
          background: #fff;
          overflow: hidden;
        }
        
        .card-front, .card-back {
          padding: 14px 18px; 
          min-height: 70px;  
          box-sizing: border-box; 
        }

        .card-front {
          font-weight: 500;
          font-size: 0.95rem; 
        }

        .card-back {
          border-top: 2px dashed #aaa;
          background: #fdfdfd;
        }
        
        .answer-title {
          font-weight: 600;
          color: #00b894;
          font-size: 0.95rem; 
        }
        
        .comment {
          font-style: italic;
          font-size: 0.9rem; 
          margin-top: 10px;
          padding-top: 10px;
          color: #555;
          border-top: 1px solid #eee;
        }

        h1 {
          color: #0984e3;
          text-align: center;
          font-size: 1.8rem; 
        }
        
        p.info {
          text-align: center;
          font-size: 1rem; 
          padding-bottom: 10px;
          border-bottom: 2px solid #eee;
        }

        @media print {
          body { 
            margin: 15px;
            background: #fff;
          }
          h1 { font-size: 1.5rem; }
          p.info { font-size: 0.9rem; }
          .card-container {
            border: 1px solid #aaa;
            box-shadow: none;
            max-width: 90%;
          }
          .card-back {
             background: #fdfdfd;
          }
        }
      </style>
    </head>
    <body>
      <h1>Flashcards para Revisão</h1>
      <p class="info">
        Total de ${questionsToPrint.length} questões para revisar.<br>
        <strong>Instrução:</strong> Imprima, recorte cada card e dobre na linha pontilhada.
      </p>
    `;

  // Loop nas questões e cria um "card" para cada
  questionsToPrint.forEach((q) => { 
    const formattedEnunciado = (q.enunciado || '').replace(/\n/g, "<br>");
    const correctAnswerKey = q.resposta_correta;
    const correctAnswerText = (q.alternativas && q.alternativas[correctAnswerKey]) ? q.alternativas[correctAnswerKey] : 'N/A';
    const formattedComentario = (q.comentario || '').replace(/\n/g, '<br>');

    printHtml += `
      <div class="card-container">
        <div class="card-front">
          ${formattedEnunciado}
        </div>
        
        <div class="card-back">
          <div class="answer-title">
            Resposta: ${correctAnswerKey}) ${correctAnswerText}
          </div>
          
          ${q.comentario ? `<div class="comment"><strong>Comentário:</strong> ${formattedComentario}</div>` : ''}
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

// A função playVictoryVideo foi removida, já que não foi mencionada
// na última solicitação de "voltar".
