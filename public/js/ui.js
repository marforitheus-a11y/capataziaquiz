/* ====== CÓDIGO COMPLETO E CORRIGIDO PARA: js/ui.js ====== */

function renderQuestion() {
  const quizDiv = document.getElementById("quiz");
  const q = questions[currentQuestion];
  
  const userAnswer = userAnswers[q.id];
  const isAnswered = (userAnswer !== undefined);

  // 1. Monta o HTML das alternativas
  const optionsHtml = Object.entries(q.alternativas || {}).map(([key, value]) => {
    let classes = 'option';
    
    let clickEvent = `onclick="selectOption('${q.id}', '${key}')"`;
    let dataAttrs = `data-qid="${q.id}" data-key="${key}"`;
    
    if (quizMode === 'solo') {
      if (isAnswered) {
        clickEvent = ''; 
        if (key === q.resposta_correta) {
          classes += ' correct';
        } else if (key === userAnswer) {
          classes += ' wrong';
        }
      }
    } else {
      if (isAnswered && key === userAnswer) {
        classes += ' selected-challenge';
      }
    }
    
    return `<li class="${classes}" ${dataAttrs} ${clickEvent}>${key}) ${value}</li>`;
  }).join('');

  // 2. Monta o HTML do feedback (SÓ PARA MODO SOLO)
  let feedbackHtml = '';
  if (isAnswered && quizMode === 'solo') {
    const isCorrect = (userAnswer === q.resposta_correta);
    
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

  const navHtml = `
    <div class="quiz-nav">
      <button onclick="goToPrev()" ${prevDisabled} data-translate-key="prevButton">Anterior</button>
      <span>${currentQuestion + 1} de ${questions.length}</span>
      <button onclick="goToNext()" data-translate-key="${nextKey}">${nextButtonText}</button>
    </div>
  `;

  // 4. Monta o HTML final e insere na página
  const formattedEnunciado = (q.enunciado || '').replace(/\n/g, "<br>");
  
  const timerHtml = (quizMode === 'challenge')
    ? `<div id="quizTimer" style="font-size: 1.2rem; font-weight: 600; color: var(--wrong); text-align: center; margin-bottom: 15px;">Tempo: --:--</div>`
    : '';
    
  quizDiv.innerHTML = `
    ${timerHtml} 
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
  
  translatePage(); 
}

// -------------------------------------------------------------------

function showResults() {
  let correctCount = 0;
  const errorsByDiscipline = {}; 
  const wrongQuestions = []; 

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

  if (correctCount === questions.length && questions.length > 0) {
    setTimeout(playVictoryVideo, 100); 
  }

  let resultHTML = `
    <h2 data-translate-key="resultsTitle">Resultado Final</h2>
    <div class="charts-container">
      <div class="chart-box" style="max-width: 350px;">
        <h3 data-translate-key="chartsGeneral">Desempenho Geral</h3>
        <canvas id="pizzaChart"></canvas>
      </div>
      <div class="chart-box" style="max-width: 500px;">
        <h3 data-translate-key="chartsErrors">Tópicos com Mais Erros</h3>
        <canvas id="barChart"></canvas>
      </div>
    </div>
    <hr style="border:0; border-top: 2px solid #f0f3f7; margin: 25px 0;">
  `;

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

  const quizDiv = document.getElementById("quiz");
  quizDiv.innerHTML = resultHTML;
  quizDiv.scrollIntoView({ behavior: 'smooth' });

  requestAnimationFrame(() => {
    
    const btn = document.getElementById('retryBtn');
    if (btn) btn.addEventListener('click', () => location.reload()); 

    const printBtn = document.getElementById('printErrorsBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        generatePrintPage(wrongQuestions); 
      });
    }

    const pizzaCtx = document.getElementById('pizzaChart');
    if (pizzaCtx) {
      new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
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
    
    translatePage();
  });
}

// -------------------------------------------------------------------

/* ====== seleção de subitem (UI) ====== */
function clearSelectionUI() {
  window.selectedSubjects = []; // MUDANÇA AQUI
  document.querySelectorAll('.subitem.selected').forEach(el => el.classList.remove('selected'));
  updateSelectedSummary();
}

/**
 * Atualiza o sumário com base em 'window.selectedSubjects'.
 */
function updateSelectedSummary() {
  const summaryDiv = document.getElementById('selectedSummary');
  
  // MUDANÇA AQUI
  if (window.selectedSubjects.length === 0) {
    summaryDiv.textContent = translations[currentLang].noneSelected; 
  } else if (window.selectedSubjects.length === 1) {
    summaryDiv.textContent = window.selectedSubjects[0].name; // MUDANÇA AQUI
  } else {
    // MUDANÇA AQUI
    const total = window.selectedSubjects.reduce((acc, s) => acc + s.count, 0);
    summaryDiv.textContent = `${window.selectedSubjects.length} matérias selecionadas (${total} questões)`;
  }
}


// -------------------------------------------------------------------

/**
 * ===================================================================
 * ===== FUNÇÃO generatePrintPage CORRIGIDA (com SVGs e Estilos) =====
 * ===================================================================
 */
function generatePrintPage(questionsToPrint) {
  const dict = translations[currentLang];
  const iconQuestion = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-help-circle"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  const iconAnswer = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  const iconComment = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-info"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

  let printHtml = `
    <!DOCTYPE html>
    <html lang="${currentLang}">
    <head>
      <meta charset="UTF-8">
      <title>${dict.printTitle}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        :root {
          --primary: #0984e3;
          --correct: #00b894;
          --bg-light: #f5f6fa;
          --text-dark: #2d3436;
          --text-light: #555;
        }
        body {
          font-family: "Poppins", sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          color: var(--text-dark);
          background: var(--bg-light); 
        }
        h1 { color: var(--primary); text-align: center; font-weight: 700; }
        p.info {
          text-align: center;
          font-size: 1.1rem;
          padding-bottom: 15px;
          border-bottom: 2px solid #eee;
          margin-bottom: 30px;
        }
        .card-container {
          width: 100%;
          max-width: 700px; 
          margin: 20px auto;
          page-break-inside: avoid; 
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #e0e0e0;
          box-shadow: 0 5px 15px rgba(0,0,0,0.05);
          overflow: hidden; 
        }
        .card-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 99px;
          margin-bottom: 12px;
          color: white;
        }
        .card-tag svg { stroke: white; }
        .card-front { padding: 25px 30px; }
        .tag-question { background-color: var(--primary); }
        .question-text { font-size: 1.1rem; font-weight: 500; color: var(--text-dark); }
        .card-back {
          padding: 25px 30px;
          background: #fdfdfd;
          border-top: 2px dashed #ddd; 
        }
        .answer-wrapper { margin-bottom: 20px; }
        .tag-answer { background-color: var(--correct); }
        .answer-text { font-size: 1.1rem; font-weight: 600; color: var(--correct); }
        .tag-comment { background-color: #777; }
        .comment-text { font-size: 0.95rem; color: var(--text-light); font-style: italic; }
        @media print {
          body { margin: 15px; background: #fff; padding: 0; }
          h1 { font-size: 1.5rem; }
          p.info { font-size: 0.9rem; }
          .card-container { border: 1px solid #aaa; box-shadow: none; max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <h1>${dict.printTitle}</h1>
      <p class="info" data-translate-key="printInfo" data-total="${questionsToPrint.length}">
        ${dict.printInfo.replace('{total}', questionsToPrint.length)}<br>
        <strong>Instrução:</strong> Imprima, recorte cada card e dobre na linha tracejada.
      </p>
    `;

  questionsToPrint.forEach((q) => { 
    const formattedEnunciado = (q.enunciado || '').replace(/\n/g, "<br>");
    const correctAnswerKey = q.resposta_correta;
    const correctAnswerText = (q.alternativas && q.alternativas[correctAnswerKey]) ? q.alternativas[correctAnswerKey] : 'N/A';
    const formattedComentario = (q.comentario || '').replace(/\n/g, '<br>');

    printHtml += `
      <div class="card-container">
        <div class="card-front">
          <div class="card-tag tag-question">
            ${iconQuestion}
            <span>${dict.feedbackQuestion || 'PERGUNTA'}</span> 
          </div>
          <div class="question-text">
            ${formattedEnunciado}
          </div>
        </div>
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

  const printWindow = window.open('', '_blank');
  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
  
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

// -------------------------------------------------------------------
/* ====== FUNÇÃO DO VÍDEO DE VITÓRIA ====== */
function playVictoryVideo() {
  const overlay = document.getElementById('easterEggOverlay');
  const video = document.getElementById('easterEggVideo');
  const unmuteText = document.getElementById('unmuteText');

  if (!overlay || !video) {
    console.error("Elementos do vídeo de vitória não encontrados.");
    return;
  }
  
  overlay.style.display = 'flex';
  video.volume = 1.0; 
  const playPromise = video.play();

  if (playPromise !== undefined) {
    playPromise.then(() => {
      unmuteText.style.display = 'none';
    }).catch(error => {
      console.warn("Autoplay com som bloqueado. Tocando mutado.", error);
      video.muted = true;
      video.play();
      unmuteText.style.display = 'block'; 
      unmuteText.textContent = "O navegador bloqueou o som. Clique para ativar.";
      
      overlay.addEventListener('click', () => {
        video.muted = false;
        video.volume = 1.0;
        unmuteText.style.display = 'none';
      }, { once: true }); 
    });
  }
  
  const closeBtn = document.getElementById('closeEasterEgg'); 
  if(closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); 
      video.pause();
      video.currentTime = 0; 
      overlay.style.display = 'none';
      unmuteText.style.display = 'none'; 
    });
  }
}

// -------------------------------------------------------------------
// FUNÇÕES DO MODAL DE DESAFIO (Novas)
// -------------------------------------------------------------------

/**
 * Mostra o modal de desafio (lobby/espera)
 */
function showChallengeModal(title, contentHtml) {
  const modal = document.getElementById('challengeModal');
  const titleEl = document.getElementById('challengeTitle');
  const contentEl = document.getElementById('challengeContent');
  
  titleEl.textContent = title;
  contentEl.innerHTML = contentHtml;
  modal.style.display = 'flex';
}

function hideChallengeModal() {
  const modal = document.getElementById('challengeModal');
  modal.style.display = 'none';
}

/**
 * Mostra uma tela de espera após o jogador terminar
 */
function showChallengeWaitingScreen(message) {
  const quizDiv = document.getElementById("quiz");
  quizDiv.innerHTML = `
    <div class='result' style="padding: 40px 20px;">
      <h2>Desafio Enviado!</h2>
      <p style="font-size: 1.1rem;">${message}</p>
    </div>
  `;
}

/**
 * Mostra o resultado final do desafio (jogador vs jogador)
 */
function showChallengeResults(challengeDoc) {
  const p1_id = challengeDoc.createdBy;
  const p2_id = challengeDoc.invited;
  
  const p1_answers = challengeDoc.answers[p1_id] || {};
  const p2_answers = challengeDoc.answers[p2_id] || {};
  const questions = challengeDoc.questions; 
  
  let p1_score = 0;
  let p2_score = 0;
  
  questions.forEach(q => {
    if (p1_answers[q.id] === q.resposta_correta) p1_score++;
    if (p2_answers[q.id] === q.resposta_correta) p2_score++;
  });
  
  let winnerMessage = "";
  if (p1_score > p2_score) {
    winnerMessage = `🏆 ${p1_id.toUpperCase()} VENCEU! 🏆`;
  } else if (p2_score > p1_score) {
    winnerMessage = `🏆 ${p2_id.toUpperCase()} VENCEU! 🏆`;
  } else {
    winnerMessage = "🎌 EMPATE! 🎌";
  }
  
  const quizDiv = document.getElementById("quiz");
  quizDiv.innerHTML = `
    <div class='result' style="padding: 40px 20px; text-align: center;">
      <h2 data-translate-key="resultsTitle">Resultado do Desafio</h2>
      <h1 style="color: var(--primary); margin: 20px 0;">${winnerMessage}</h1>
      
      <div style="display: flex; justify-content: space-around; font-size: 1.5rem; font-weight: 600; margin: 30px 0;">
        <div>
          <span style="text-transform: capitalize;">${p1_id}</span><br/>
          ${p1_score} / ${questions.length}
        </div>
        <div>
          <span style="text-transform: capitalize;">${p2_id}</span><br/>
          ${p2_score} / ${questions.length}
        </div>
      </div>
      
      <div class="button-row" style="justify-content: center; margin-top: 30px;">
        <button onclick="location.reload()">Voltar ao Início</button>
      </div>
    </div>
  `;
  hideChallengeModal();
}
