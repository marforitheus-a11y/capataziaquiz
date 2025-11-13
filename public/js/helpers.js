/* ====== Início do js/helpers.js (O CÓDIGO CORRETO) ====== */

/**
 * Normaliza um número de lei.
 * Ex: "lei 12.815" -> "Lei n. 12815"
 */
function normalizeLaw(text) {
  const regex = /(Lei|Decreto)\s*(?:n[°º.]*\s*)?([\d\.]+)/i;
  const match = text.match(regex);

  if (match) {
    const type = match[1].toLowerCase() === 'lei' ? 'Lei' : 'Decreto';
    const number = match[2].replace(/\./g, ''); // Remove pontos
    return `${type} n. ${number}`;
  }
  return null;
}

/**
 * Procura um artigo no texto.
 */
function extractArticle(text) {
  const regex = /(Art\.|Artigo)\s+(\d+)/i;
  const match = text.match(regex);
  
  if (match) {
    return `Art. ${match[2]}`;
  }
  return null;
}

/**
 * Tenta extrair um número de lei do NOME DO FICHEIRO.
 */
function extractLawFromFilename(filename) {
  if (!filename) return null;
  
  const numRegex = /(\d{4,5})/; 
  const numMatch = filename.match(numRegex);
  
  if (numMatch) {
    const number = numMatch[1];
    if (filename.toLowerCase().includes('decreto')) {
      return `Decreto n. ${number}`;
    }
    return `Lei n. ${number}`;
  }
  return null;
}

/**
 * FUNÇÃO PRINCIPAL
 * Tenta encontrar a Lei e o Artigo de um erro.
 */
function getErrorTopic(question, sourceFilename) {
  const textToSearch = `${question.enunciado || ''} ${question.comentario || ''}`;
  
  let law = normalizeLaw(textToSearch);
  const article = extractArticle(textToSearch);

  if (!law) {
    law = extractLawFromFilename(sourceFilename);
  }

  if (law && article) {
    return `${law} - ${article}`; 
  }
  if (law) {
    return law; 
  }
  if (article) {
    return article; 
  }

  return question.disciplina || 'Outros';
}


/**
 * Função de agrupamento de pastas.
 */
function getGroupKey(name) {
  if (!name) return 'Outros';
  const clean = name.split('—')[0].trim();
  const numMatch = clean.match(/\b(\d{4,6})\b/); 
  if (numMatch) {
    const prefixMatch = clean.match(/\b(Lei|Decreto|Portaria|Resolução)\b/i);
    const prefix = prefixMatch ? prefixMatch[0] : '';
    return (prefix + ' ' + numMatch[1]).trim();
  }
  const dashParts = clean.split('-')[0].trim();
  if (dashParts.length > 0) return dashParts;
  return clean || 'Outros';
}

/* ====== Fim do js/helpers.js ====== */
