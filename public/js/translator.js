// Dicionário de traduções
const translations = {
  "pt-BR": {
    "pageTitle": "Quiz de Questões",
    "mainTitle": "Marfori Corporations",
    "subTitle": "Simulado OGMO - CAPATAZIA",
    "selectSubject": "Selecione a matéria / parte:",
    "loading": "Carregando...",
    "selectedLabel": "Matéria selecionada",
    "noneSelected": "Nenhuma selecionada",
    "questionCountLabel": "Quantidade de questões",
    "startButton": "Iniciar Quiz",
    "clearButton": "Limpar",
    "hintText": "Dica: clique na pasta para abrir/fechar. Depois clique na parte/página para selecionar.",
    "pdfTitle": "📚 Conteúdos em PDF",
    "loadingPDFs": "Carregando PDFs...",
    "metaDiscipline": "Disciplina:",
    "metaBanca": "Banca:",
    "metaAno": "Ano:",
    "prevButton": "Anterior",
    "nextButton": "Próxima",
    "finishButton": "Finalizar",
    "feedbackCorrect": "✅ Correto!",
    "feedbackWrong": "❌ Errado! Resposta correta:",
    "feedbackComment": "Comentário:",
    "resultsTitle": "Resultado Final",
    "chartsGeneral": "Desempenho Geral",
    "chartsErrors": "Tópicos com Erros",
    "chartsCorrect": "Acertos",
    "chartsWrong": "Erros",
    "chartsUnanswered": "Não Respondidas",
    "resultsSummary": "Você acertou {correct} de {total} questões.",
    "retryButton": "Refazer",
    "printButton": "Imprimir Erradas",
    "printTitle": "Flashcards para Revisão",
    "printInfo": "Total de {total} questões para revisar."
  },
  "ja-JP": {
    "pageTitle": "問題クイズ",
    "mainTitle": "マーフォリ・コーポレーションズ",
    "subTitle": "OGMOシミュレーション - 荷役",
    "selectSubject": "主題/部分を選択:",
    "loading": "読み込み中...",
    "selectedLabel": "選択された主題",
    "noneSelected": "何も選択されていません",
    "questionCountLabel": "問題数",
    "startButton": "クイズを開始",
    "clearButton": "クリア",
    "hintText": "ヒント: フォルダをクリックして開閉し、サブアイテムをクリックして選択します。",
    "pdfTitle": "📚 PDFコンテンツ",
    "loadingPDFs": "PDFを読み込み中...",
    "metaDiscipline": "主題:",
    "metaBanca": "出題者:",
    "metaAno": "年:",
    "prevButton": "前へ",
    "nextButton": "次へ",
    "finishButton": "終了",
    "feedbackCorrect": "✅ 正解！",
    "feedbackWrong": "❌ 不正解！正解:",
    "feedbackComment": "コメント:",
    "resultsTitle": "最終結果",
    "chartsGeneral": "総合パフォーマンス",
    "chartsErrors": "間違ったトピック",
    "chartsCorrect": "正解",
    "chartsWrong": "不正解",
    "chartsUnanswered": "未回答",
    "resultsSummary": "{total}問中{correct}問正解しました。",
    "retryButton": "やり直す",
    "printButton": "間違いを印刷",
    "printTitle": "レビュー用フラッシュカード",
    "printInfo": "レビューする問題は合計{total}問です。"
  }
};

// Define o idioma padrão
let currentLang = "pt-BR";

/**
 * Muda o idioma global e traduz a página.
 * @param {'pt-BR' | 'ja-JP'} lang 
 */
function setLanguage(lang) {
  if (lang === currentLang) return; // Não faz nada se o idioma já for o atual
  
  currentLang = lang;
  document.documentElement.lang = currentLang; // Atualiza a tag <html lang="">
  translatePage();
}

/**
 * Traduz todos os elementos estáticos da página
 */
function translatePage() {
  const elements = document.querySelectorAll('[data-translate-key]');
  const dict = translations[currentLang];
  
  elements.forEach(el => {
    const key = el.dataset.translateKey;
    const translation = dict[key];
    
    if (translation) {
      // Substitui variáveis como {total}
      const text = translation.replace(/{(\w+)}/g, (match, varName) => {
        // Tenta encontrar a variável no dataset do elemento
        return el.dataset[varName] || match; 
      });
      
      // Define o texto
      el.textContent = text;
    }
  });
  
  // Traduz o título da página
  if (dict.pageTitle) {
    document.title = dict.pageTitle;
  }
}

// (Quando o DOM carregar, traduz para o idioma padrão - caso o usuário recarregue a página)
// document.addEventListener('DOMContentLoaded', translatePage); 
// Comentado pois o app.js/main.js agora controla o carregamento
