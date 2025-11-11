/**
 * Tenta extrair um tópico de erro (ex: "Art. 5") do texto da questão.
 * Se não encontrar, tenta extrair Leis/Decretos.
 * Se não encontrar, usa a disciplina da questão como fallback.
 */
function getErrorTopic(question) {
  // Texto onde vamos procurar (enunciado ou comentário)
  const textToSearch = `${question.enunciado || ''} ${question.comentario || ''}`;
  
  // 1. Prioridade 1: Buscar "Art." ou "Artigo"
  const regexArtigo = /(Art\.|Artigo)\s+(\d+)/i;
  const matchArtigo = textToSearch.match(regexArtigo);
  if (matchArtigo) {
    return `Art. ${matchArtigo[2]}`;
  }

  // 2. Prioridade 2: Buscar "Lei X" ou "Decreto X"
  const regexLeiDecreto = /(Lei|Decreto)\s+(?:Nº?\s*)?(\d{3,6}\b)/i;
  const matchLeiDecreto = textToSearch.match(regexLeiDecreto);
  if (matchLeiDecreto) {
    return `${matchLeiDecreto[1]} ${matchLeiDecreto[2]}`;
  }
  
  // 3. Prioridade 3: Fallback para a disciplina
  return question.disciplina || 'Outros';
}

/* ====== Helpers para agrupamento ====== */
function getGroupKey(name) {
  // Tenta identificar algo como "Lei 12815" ou "Decreto 8033" ou pega antes do '—' se existir.
  if (!name) return 'Outros';
  // remove contagem final " — X questões"
  const clean = name.split('—')[0].trim();
  // tenta encontrar um número representativo (por ex. 12815)
  const numMatch = clean.match(/\b(\d{3,6})\b/);
  if (numMatch) {
    // também pega um prefix como "Lei" ou "Decreto" se existir
    const prefixMatch = clean.match(/\b(Lei|Decreto|Lei Federal|Decreto Federal|Portaria|Resolução)\b/i);
    const prefix = prefixMatch ? prefixMatch[0] : '';
    return (prefix + ' ' + numMatch[1]).trim();
  }
  // fallback: usa texto antes do hífen/traço se houver
  const dashParts = clean.split('-')[0].trim();
  if (dashParts.length > 0) return dashParts;
  // ultimate fallback
  return clean || 'Outros';
}
