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
  const normalizedFilename = filename.toLowerCase();

  const knownLawsByFile = [
    { key: 'ctb', law: 'Lei n. 9503 (CTB)' },
    { key: 'mariadapenha', law: 'Lei n. 11340 (Maria da Penha)' },
    { key: 'constituicao', law: 'Constituição Federal de 1988' },
    { key: 'penal', law: 'Decreto-Lei n. 2848 (Código Penal)' },
    { key: 'processo_penal', law: 'Decreto-Lei n. 3689 (Código de Processo Penal)' },
    { key: 'desarmamento', law: 'Lei n. 10826 (Estatuto do Desarmamento)' },
    { key: 'abuso', law: 'Lei n. 13869 (Abuso de Autoridade)' },
    { key: 'deficiente', law: 'Lei n. 13146 (Estatuto da Pessoa com Deficiência)' },
    { key: '13.022', law: 'Lei n. 13022 (Estatuto das Guardas Municipais)' },
    { key: '135', law: 'Lei n. 10741 (Estatuto da Pessoa Idosa)' }
  ];

  const knownLaw = knownLawsByFile.find((item) => normalizedFilename.includes(item.key));
  if (knownLaw) return knownLaw.law;
  
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
