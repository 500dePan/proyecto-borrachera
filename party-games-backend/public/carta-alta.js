const socket = io();

document.addEventListener('DOMContentLoaded', () => {
    const roomCode = sessionStorage.getItem('roomCode');
    const isHost = sessionStorage.getItem('isHost') === 'true';
    const username = sessionStorage.getItem('username');
    
    // Elementos de la interfaz
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    const cardTable = document.getElementById('cardTable');
    const resultsDisplay = document.getElementById('resultsDisplay');
    const loserMessage = document.getElementById('loserMessage');
    const takeMessage = document.getElementById('takeMessage');
    const nextRoundBtn = document.getElementById('nextRoundBtn');
    const waitingHost = document.getElementById('waitingHost');
    const backToLobbyBtn = document.getElementById('backToLobbyBtn');// Nuevo

    backToLobbyBtn.addEventListener('click', () => {
        if (!isHost) {
            alert("Solo el anfitrión puede finalizar el juego y volver al lobby.");
            return; 
        }
        
        const roomCode = sessionStorage.getItem('roomCode');
        if (roomCode) {
            // 🛑 CLAVE: Notificar al servidor que el anfitrión está terminando
            socket.emit('hostEndingGame', roomCode); 
            
            // El anfitrión se redirige inmediatamente después de la notificación
            window.location.href = `/lobby?code=${roomCode}`;
        } else {
            window.location.href = '/';
        }
    });

   if (!roomCode) {
        window.location.href = '/';
        return;
    }
    
    roomCodeDisplay.textContent = roomCode;
    
    // 🛑 NUEVO: Mostrar el botón de Lobby solo al anfitrión al cargar la página.
    if (isHost) {
        backToLobbyBtn.style.display = 'block';
    }

    if (!roomCode) {
        window.location.href = '/';
        return;
    }
    
    roomCodeDisplay.textContent = roomCode;


    socket.on('redirectToLobby', ({ roomCode }) => {
        alert("El anfitrión ha finalizado el juego. Regresando al lobby.");
        window.location.href = `/lobby?code=${roomCode}`;
    });

    // --- Configuración Inicial y Reconexión ---
    socket.on('connect', () => {
        socket.emit('reEnterRoom', { roomCode: roomCode, username: username, isHost: isHost });
    });

    // Configurar botón de siguiente ronda
    if (isHost) {
        nextRoundBtn.style.display = 'block';
        waitingHost.style.display = 'none';
        nextRoundBtn.addEventListener('click', () => {
             socket.emit('startCartaAltaRound', roomCode);
             nextRoundBtn.disabled = true;
        });
    }

    // --- Funciones de Interfaz ---

    function createCardHTML(cardData) {
        const colorClass = (cardData.suit === '♥' || cardData.suit === '♦') ? 'red' : '';
        
        return `
            <div class="card ${colorClass}" id="card-${cardData.player}">
                <div class="card-top">${cardData.rank}${cardData.suit}</div>
                <div class="card-center">${cardData.rank}</div>
                <div class="card-bottom">${cardData.rank}${cardData.suit}</div>
            </div>
        `;
    }

    // Función para renderizar la mesa de cartas
    socket.on('updateCardTable', (playersData) => {
        cardTable.innerHTML = '';
        resultsDisplay.style.display = 'none';
        nextRoundBtn.disabled = false; // Habilitar el botón para el host

        playersData.forEach(player => {
            const slot = document.createElement('div');
            slot.className = 'player-card-slot';
            
            // Si tiene carta, la muestra; si no, muestra una carta oculta
            if (player.card) {
                slot.innerHTML = createCardHTML(player.card);
            } else {
                slot.innerHTML = '<div class="card">🂠</div>'; // Carta genérica oculta
            }

            slot.innerHTML += `<p>${player.username} ${player.id === socket.id ? '(Tú)' : ''}</p>`;
            cardTable.appendChild(slot);
        });
    });

    // Función para mostrar el perdedor y las instrucciones
    socket.on('roundResultCartaAlta', (data) => {
        resultsDisplay.style.display = 'block';
        nextRoundBtn.disabled = false;
        
        // 1. Mostrar quién pierde y cuánto toma
        loserMessage.textContent = `¡El perdedor es ${data.loser.username} con un ${data.loser.card.symbol}!`;
        takeMessage.textContent = `Debe tomar ${data.takeAmount} trago${data.takeAmount > 1 ? 's' : ''}.`;
        
        // 2. Resaltar la carta perdedora en la mesa
        // Primero, eliminar cualquier resaltado anterior
        document.querySelectorAll('.card').forEach(c => c.classList.remove('loser-glow', 'winner-glow'));
        
        // Asumiendo que el ID de la carta es el nombre del perdedor (solo para este ejemplo simple)
        // Necesitaríamos IDs de ranura más robustos para un sistema de resaltado perfecto.
        backToLobbyBtn.style.display = 'block';
    });

    // 3. Notificación de error
    socket.on('gameError', (message) => {
        alert(`Error en el juego: ${message}`);
        nextRoundBtn.disabled = false;
    });
});