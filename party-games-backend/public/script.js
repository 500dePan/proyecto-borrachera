// public/script.js

const socket = io(); 

document.addEventListener('DOMContentLoaded', () => {
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const roomCodeInput = document.getElementById('roomCodeInput');

    // Recupera el nombre de usuario o lo pide, y lo guarda
    let username = sessionStorage.getItem('username');

    // 🛑 LÓGICA DE GESTIÓN DE NOMBRE CORREGIDA 🛑
    if (!username) {
        // Si no hay nombre en la sesión, solicitamos uno
        username = prompt("¡Bienvenido! Ingresa tu nombre de usuario para empezar:");
        
        // Si el usuario presiona Cancelar o deja el campo vacío:
        if (!username || username.trim() === "") {
            username = `Jugador${Math.floor(Math.random() * 100)}`; // Asigna un nombre por defecto
            alert(`No ingresaste un nombre. Usaremos: ${username}`);
        }
        
        // Guardamos el nombre (el que el usuario ingresó o el generado por defecto)
        sessionStorage.setItem('username', username);
    }

    // --- Funciones para crear y unirse ---
    
    function createRoom() {
        socket.emit('createRoom', username); 
    }

    function joinRoom() {
        const code = roomCodeInput.value.trim().toUpperCase();

        if (code === "") {
            alert("Por favor, ingresa un código de sala.");
            return;
        }

        socket.emit('joinRoom', { roomCode: code, username: username });
    }

    createRoomBtn.addEventListener('click', createRoom);
    joinRoomBtn.addEventListener('click', joinRoom);
    roomCodeInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            joinRoom();
        }
    });

    // --- Escuchar las respuestas del servidor ---

    socket.on('roomCreated', (data) => {
        // Guarda la información y marca como anfitrión antes de redirigir
        sessionStorage.setItem('roomCode', data.code);
        sessionStorage.setItem('isHost', 'true'); 
        
        window.location.href = `/lobby?code=${data.code}`;
    });

    socket.on('roomJoined', (data) => {
        // Guarda la información y marca como invitado antes de redirigir
        sessionStorage.setItem('roomCode', data.code);
        sessionStorage.setItem('isHost', 'false');
        
        window.location.href = `/lobby?code=${data.code}`;
    });

    socket.on('roomError', (message) => {
        alert(`⚠️ Error al unirse: ${message}`);
    });
});