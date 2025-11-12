/* ===================================== */
/* ===== LÓGICA DO PORTÃO DE VERIFICAÇÃO ===== */
/* ===================================== */

// Espera o DOM carregar
document.addEventListener('DOMContentLoaded', () => {

  // Elementos do Portão
  const gate = document.getElementById('verificationGate');
  const startBtn = document.getElementById('startVerificationBtn');
  const statusText = document.getElementById('statusText');
  const videoFeed = document.getElementById('webcamFeed');
  const spinner = document.querySelector('.spinner');
  
  // Conteúdo Principal do Site
  const mainContent = document.getElementById('mainContent');
  
  let cameraStream = null;

  // 1. Inicia o processo ao clicar
  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    startBtn.style.opacity = 0.7;
    spinner.style.display = 'block';
    statusText.textContent = 'Solicitando acesso à localização...';
    statusText.className = 'status-info';
    
    // Inicia pedindo a localização
    requestLocation();
  });

  // 2. Pede Localização
  function requestLocation() {
    if (!navigator.geolocation) {
      handleError('Geolocalização não é suportada pelo seu navegador.');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Sucesso na localização
        statusText.textContent = 'Localização OK. Solicitando acesso à câmera...';
        // Próximo passo: pedir a câmera
        requestCamera();
      },
      (error) => {
        // Erro na localização
        handleError('Você precisa permitir o acesso à localização para continuar.');
      }
    );
  }

  // 3. Pede Câmera
  function requestCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      handleError('Seu navegador não suporta acesso à câmera.');
      return;
    }
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        // Sucesso na câmera
        cameraStream = stream; // Salva o stream para parar depois
        videoFeed.style.display = 'block';
        videoFeed.srcObject = stream;
        videoFeed.play();
        
        // Próximo passo: a verificação "fake"
        runFakeVerification();
      })
      .catch((error) => {
        handleError('Você precisa permitir o acesso à câmera para continuar.');
      });
  }

  // 4. Roda a verificação "Fake"
  function runFakeVerification() {
    statusText.textContent = 'Centralize seu rosto para a verificação...';
    spinner.style.display = 'none';

    // Espera 3 segundos (simulando a pessoa se ajeitando)
    setTimeout(() => {
      statusText.textContent = 'Analisando...';
      spinner.style.display = 'block';
      videoFeed.style.display = 'none';
      
      // Para a câmera (boa prática)
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      // Espera 2 segundos (simulando a "análise")
      setTimeout(() => {
        spinner.style.display = 'none';
        statusText.textContent = 'Acesso Autorizado! Bem-vindo.';
        statusText.className = 'status-success';
        
        // Próximo passo: mostrar o site
        setTimeout(grantAccess, 1000); // Espera 1s para o usuário ler a msg
        
      }, 2000);
      
    }, 3000);
  }

  // 5. Libera o acesso ao site
  function grantAccess() {
    // Esconde o portão com fade-out
    gate.classList.add('fade-out');
    
    // Mostra o conteúdo principal com fade-in
    mainContent.style.display = 'block';
    mainContent.classList.add('fade-in');
    
    // Esconde o portão permanentemente após a animação
    setTimeout(() => {
      gate.style.display = 'none';
    }, 500);
    
    // ========================================================
    // IMPORTANTE: INICIA O APP (funções do js/main.js)
    // ========================================================
    loadSubjects();
    loadPDFs();
  }
  
  // Função de Erro
  function handleError(message) {
    statusText.textContent = message;
    statusText.className = 'status-error';
    spinner.style.display = 'none';
    startBtn.disabled = false;
    startBtn.style.opacity = 1;
    
    // Se a câmera já foi ligada, desliga
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      videoFeed.style.display = 'none';
    }
  }

});
