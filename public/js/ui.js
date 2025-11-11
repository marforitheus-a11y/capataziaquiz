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

function showResults() {
  let correctCount = 0;
  const errorsByDiscipline = {}; 

  // 1. Processar dados para os gráficos
  questions.forEach(q => {
    const user = userAnswers[q.id];
    const right = q.resposta_correta;
    const topic = getErrorTopic(q); 

    if (user === right) {
      correctCount++;
    } else {
      if (!errorsByDiscipline[topic]) {
        errorsByDiscipline[topic] = 0;
      }
      errorsByDiscipline[topic]++;
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

  // Resumo e Botão de Refazer
  resultHTML += `
    <div class='result' style="padding-bottom: 20px;">
      <h3>Você acertou ${correctCount} de ${questions.length} questões.</h3>
      <button id="retryBtn">Refazer</button>
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

    // --- Renderizar Gráfico de Pizza ---
    const pizzaCtx = document.getElementById('pizzaChart');
    if (pizzaCtx) {
      new Chart(pizzaCtx, {
        type: 'doughnut',
        data: {
          labels: ['Acertos', 'Erros'],
          datasets: [{
            label: 'Desempenho',
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
}
