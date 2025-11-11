/* ====== CÓDIGO COMPLETO E CORRIGIDO PARA: js/ui.js ====== */

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

// -------------------------------------------------------------------

/* ====== SUBSTITUA SUA FUNÇÃO showResults() POR ESTA VERSÃO DE TESTE ====== */

function showResults() {
  let correctCount = 0;
  const errorsByDiscipline = {}; 
  const wrongQuestions = []; 

  console.log("--- INICIANDO showResults() ---"); // TESTE
  console.log("Total de questões no quiz:", questions.length); // TESTE

  // 1. Processar dados para os gráficos
  questions.forEach((q, index) => {
    const user = userAnswers[q.id];
    const right = q.resposta_correta;
    const topic = getErrorTopic(q); 

    if (user === right) {
      correctCount++;
      console.log(`Questão ${index + 1}: CORRETA`); // TESTE
    } else {
      // É um erro
      if (!errorsByDiscipline[topic]) {
        errorsByDiscipline[topic] = 0;
      }
      errorsByDiscipline[topic]++;
      wrongQuestions.push(q);
      
      // ESTA É A LINHA DE TESTE MAIS IMPORTANTE
      console.log(`Questão ${index + 1}: ERRADA. Adicionando ao array. Enunciado:`, q.enunciado);
    }
  });

  const wrongCount = questions.length - correctCount;
  
  // TESTE FINAL ANTES DE IMPRIMIR
  console.log("--- VERIFICAÇÃO FINAL ---");
  console.log("Total de acertos:", correctCount);
  console.log("Total de erros:", wrongCount);
  console.log("Array 'wrongQuestions' que será enviado para impressão:", wrongQuestions);
  
  // ---------------------------------------------------
  // O RESTANTE DA FUNÇÃO (HTML, GRÁFICOS) É IGUAL
  // ---------------------------------------------------

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
    if (btn) btn.addEventListener('click', () => location.reload());

    const printBtn = document.getElementById('printErrorsBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        // A função generatePrintPage usará o array que testamos
        generatePrintPage(wrongQuestions); 
      });
    }

    // --- Gráfico de Pizza ---
    const pizzaCtx = document.getElementById('pizzaChart');
    if (pizzaCtx) {
      new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
          labels: ['Acertos', 'Erros'],
          datasets: [{ data: [correctCount, wrongCount], backgroundColor: ['#00b894', '#d63031'], hoverOffset: 4 }]
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
/* ====== seleção de subitem (UI) ====== */
function clearSelectionUI() {
  selectedFile = null;
  document.getElementById('selectedSummary').textContent = 'Nenhuma selecionada';
  // remover destaque
  document.querySelectorAll('.subitem.selected').forEach(el => el.classList.remove('selected'));
}

// -------------------------------------------------------------------

/**
 * Gera uma nova página com as questões erradas em formato de flashcard (frente/verso).
 * @param {Array} questionsToPrint - Um array de objetos de questão (apenas as erradas).
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
          /* --- MUDANÇAS AQUI --- */
          max-width: 500px; /* Define uma largura máxima para o card */
          margin: 15px auto; /* Centraliza o card na página */
          /* --- FIM DAS MUDANÇAS --- */
          
          width: 100%;
          page-break-inside: avoid;
          margin-bottom: 15px;
          border-radius: 10px;
          border: 1px solid #aaa;
          background: #fff;
          overflow: hidden;
        }
        
        .card-front, .card-back {
          /* --- MUDANÇAS AQUI --- */
          padding: 14px 18px; /* Reduz o preenchimento */
          min-height: 70px;  /* Reduz a altura mínima */
          /* --- FIM DAS MUDANÇAS --- */
          box-sizing: border-box; 
        }

        .card-front {
          /* --- MUDANÇAS AQUI --- */
          font-weight: 500;
          font-size: 0.55rem; /* Reduz a fonte da pergunta */
          /* --- FIM DAS MUDANÇAS --- */
        }

        .card-back {
          border-top: 2px dashed #aaa;
          background: #fdfdfd;
        }
        
        .answer-title {
          /* --- MUDANÇAS AQUI --- */
          font-weight: 600;
          color: #00b894;
          font-size: 0.55rem; /* Reduz a fonte da resposta */
          /* --- FIM DAS MUDANÇAS --- */
        }
        
        .comment {
          /* --- MUDANÇAS AQUI --- */
          font-style: italic;
          font-size: 0.5rem; /* Reduz a fonte do comentário */
          margin-top: 10px;
          padding-top: 10px;
          /* --- FIM DAS MUDANÇAS --- */
          color: #555;
          border-top: 1px solid #eee;
        }

        h1 {
          color: #0984e3;
          text-align: center;
          font-size: 1.8rem; /* Reduz o título principal */
        }
        
        p.info {
          text-align: center;
          font-size: 1rem; /* Reduz o texto de info */
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
            max-width: 90%; /* Ocupa mais da página de impressão */
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

  // O loop de geração de HTML permanece o mesmo
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

  // A lógica de abertura da janela permanece a mesma
  const printWindow = window.open('', '_blank');
  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
