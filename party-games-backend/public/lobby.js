// public/lobby.js

const socket = io();

// La lógica de conexión va en el manejador del evento 'connect'
socket.on('connect', () => {
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    const playersList = document.getElementById('playersList');
    const playerCountSpan = document.getElementById('playerCount');
    const gameCards = document.querySelectorAll('.game-card');
    
    // 🛑 CLAVE: Recuperar datos del sessionStorage
    const currentRoomCode = sessionStorage.getItem('roomCode');
    const username = sessionStorage.getItem('username');
    const isHost = sessionStorage.getItem('isHost') === 'true'; 

    if (currentRoomCode && username) {
        roomCodeDisplay.textContent = currentRoomCode;

        // 1. Intentar UNIR el socket al canal Y REINGRESAR el jugador al objeto 'rooms'
        socket.emit('reEnterRoom', { roomCode: currentRoomCode, username: username, isHost: isHost });
        
    } else {
        // Si no hay datos, redirigir a la página de inicio
        window.location.href = '/'; 
    }

    // --- Escuchadores de Eventos ---

    // Escucha la actualización de la lista de jugadores
    socket.on('updatePlayersList', ({ players }) => {
        playersList.innerHTML = '';
        let hostIndicator = isHost ? " (Anfitrión)" : "";

        players.forEach(player => {
            const li = document.createElement('li');
            
            // Marca al jugador actual con un estilo
            const nameText = player.username + (player.id === socket.id ? " (Tú)" : "");
            
            li.textContent = nameText;
            playersList.appendChild(li);
        });
        playerCountSpan.textContent = players.length;
    });

    // Escucha el evento para empezar un juego
    socket.on('redirectToGame', ({ gameType }) => {
        alert(`¡Comenzando el juego: ${gameType}!`);
        window.location.href = `/${gameType}?code=${currentRoomCode}`;
    });

    // Manejamos los clics en los botones de juego (Solo para el host)
    gameCards.forEach(card => {
        card.addEventListener('click', () => {
            if (isHost) {
                 const gameType = card.dataset.game;
                 socket.emit('startGame', { roomCode: currentRoomCode, gameType });
            } else {
                alert("Solo el anfitrión puede iniciar un juego.");
            }
        });
    });

    // Manejamos errores del servidor
    socket.on('roomError', (message) => {
        alert(`⚠️ Error en la sala: ${message}`);
    });
});