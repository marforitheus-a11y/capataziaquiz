/**
 * NOVO: Normaliza um número de lei.
 * Ex: "lei 12.815" -> "Lei n. 12815"
 * Ex: "decreto 8933" -> "Decreto n. 8933"
 * Esta é a chave para a unificação.
 */
function normalizeLaw(text) {
  // Encontra (Lei|Decreto) seguido por qualquer coisa (pontos, "n.", etc.) e o número
  const regex = /(Lei|Decreto)\s*(?:n[°º.]*\s*)?([\d\.]+)/i;
  const match = text.match(regex);

  if (match) {
    const type = match[1].toLowerCase() === 'lei' ? 'Lei' : 'Decreto';
    const number = match[2].replace(/\./g, ''); // Remove pontos (ex: 8.933 -> 8933)
    return `${type} n. ${number}`;
  }
  return null;
}

/**
 * NOVO: Procura um artigo no texto.
 * Ex: "Art. 5" ou "Artigo 23"
 */
function extractArticle(text) {
  const regex = /(Art\.|Artigo)\s+(\d+)/i;
  const match = text.match(regex);
  
  if (match) {
    return `Art. ${match[2]}`; // Retorna ex: "Art. 5"
  }
  return null;
}

/**
 * NOVO: Tenta extrair um número de lei (4-5 dígitos) do NOME DO FICHEIRO.
 * Ex: "lei-12815-parte-1.json" -> "Lei n. 12815"
 */
function extractLawFromFilename(filename) {
  if (!filename) return null;
  
  // Encontra um número de 4 ou 5 dígitos
  const numRegex = /(\d{4,5})/; 
  const numMatch = filename.match(numRegex);
  
  if (numMatch) {
    const number = numMatch[1];
    
    // Tenta adivinhar o tipo pelo nome do ficheiro
    if (filename.toLowerCase().includes('decreto')) {
      return `Decreto n. ${number}`;
    }
    // Padrão é Lei
    return `Lei n. ${number}`;
  }
  return null;
}

/**
 * FUNÇÃO PRINCIPAL (Agora muito mais inteligente)
 * Tenta encontrar a Lei e o Artigo de um erro.
 */
function getErrorTopic(question, sourceFilename) {
  const textToSearch = `${question.enunciado || ''} ${question.comentario || ''}`;
  
  // 1. Tenta encontrar a Lei e o Artigo no texto da questão
  let law = normalizeLaw(textToSearch);
  const article = extractArticle(textToSearch);

  // 2. Se a Lei não está no texto, tenta encontrar no NOME DO FICHEIRO
  if (!law) {
    law = extractLawFromFilename(sourceFilename);
  }

  // 3. Decide o que retornar
  if (law && article) {
    return `${law} - ${article}`; // Ex: "Lei n. 12815 - Art. 5" (Ideal)
  }
  if (law) {
    return law; // Ex: "Lei n. 12815" (Bom)
  }
  if (article) {
    return article; // Ex: "Art. 5" (O que você tinha antes)
  }

  // 4. Fallback final
  return question.disciplina || 'Outros';
}


/**
 * (Função antiga de agrupamento de pastas - não relacionada, mas necessária)
 */
function getGroupKey(name) {
  if (!name) return 'Outros';
  const clean = name.split('—')[0].trim();
  const numMatch = clean.match(/\b(\d{4,6})\b/); // Aumentado para 4-6 dígitos
  if (numMatch) {
    const prefixMatch = clean.match(/\b(Lei|Decreto|Portaria|Resolução)\b/i);
    const prefix = prefixMatch ? prefixMatch[0] : '';
    return (prefix + ' ' + numMatch[1]).trim();
  }
  const dashParts = clean.split('-')[0].trim();
  if (dashParts.length > 0) return dashParts;
  return clean || 'Outros';
}
```

---

### 2. Ficheiro `js/main.js` (Modificado)

Precisamos de "carimbar" cada questão com o nome do ficheiro de onde ela veio.

**Ação:** No seu `js/main.js`, localize o `addEventListener` do `startBtn` e **substitua** o bloco `try...catch` por este:

```javascript
// ACHE ESTE OUVINTE DE CLIQUE NO SEU main.js E SUBSTITUA O BLOCO try...catch

document.getElementById('startBtn').addEventListener('click', async () => {
  const count = parseInt(document.getElementById('questionCount').value);
  
  if (selectedSubjects.length === 0) return alert('Selecione pelo menos uma matéria.');
  if (isNaN(count) || count < 1) return alert('Digite uma quantidade válida.');

  try {
    // --- MUDANÇA SIGNIFICATIVA AQUI ---
    // 1. Carrega todos os ficheiros
    const allFilesData = await Promise.all(
      selectedSubjects.map(async (sub) => {
        const questionsArray = await loadQuizFile(sub.file);
        
        // 2. "Carimba" cada questão com o seu ficheiro de origem
        return questionsArray.map(question => ({
          ...question, // Mantém os dados da questão (id, enunciado, etc.)
          sourceFile: sub.file // <-- Adiciona o nome do ficheiro
        }));
      })
    );
    // --- FIM DA MUDANÇA ---
    
    // 3. Combina os arrays (agora com a info 'sourceFile' em cada questão)
    const combinedQuestions = allFilesData.flat(); 

    // Inicia o quiz com o array combinado
    startQuiz(combinedQuestions, count);
    
  } catch (e) {
    alert('Erro ao carregar os arquivos de quiz.');
    console.error(e);
  }
});
```

---

### 3. Ficheiro `js/app.js` (Modificado)

Finalmente, precisamos de dizer ao `saveQuestionProgress` para *usar* a nova informação que `getErrorTopic` precisa.

**Ação:** No seu `js/app.js`, localize a função `window.saveQuestionProgress` e modifique a linha onde `getErrorTopic` é chamada.

**Procure por isto:**
```javascript
// ...dentro de window.saveQuestionProgress...
      if (!isCorrect && typeof getErrorTopic === 'function') {
        const topic = getErrorTopic(questionData); // <--- LINHA ANTIGA
        const currentTopicCount = currentErrorTopics[topic] || 0;
// ...
```

**Substitua por isto:**
```javascript
// ...dentro de window.saveQuestionProgress...
      if (!isCorrect && typeof getErrorTopic === 'function') {
        // --- MUDANÇA AQUI ---
        // Passa a questão E o seu ficheiro de origem
        const topic = getErrorTopic(questionData, questionData.sourceFile); 
        // --- FIM DA MUDANÇA ---
        
        const currentTopicCount = currentErrorTopics[topic] || 0;
// ...
