// server.js - Versión Final Corregida y Robusta

// 1. Importaciones: Asegúrate de tener estas tres dependencias instaladas (express, http, socket.io)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // Importa el módulo 'path' para construir rutas seguras

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- ALMACENAMIENTO DE DATOS ---
const rooms = {};

// --- CONFIGURACIÓN DE RUTAS DE EXPRESS ---

// Servir los archivos estáticos de tu frontend (CSS, JS, imágenes) desde la carpeta 'public'
// path.join(__dirname, 'public') asegura la ruta absoluta correcta.
app.use(express.static(path.join(__dirname, 'public'))); 


// Definición de las rutas específicas para los archivos HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/lobby', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'lobby.html'));
});

app.get('/trivia', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'trivia.html'));
});

app.get('/carta-alta', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'carta-alta.html'));
});

const suits = ['♣', '♦', '♥', '♠']; // Tréboles, Diamantes, Corazones, Picas
const ranks = [
    { name: '2', value: 2 },
    { name: '3', value: 3 },
    { name: '4', value: 4 },
    { name: '5', value: 5 },
    { name: '6', value: 6 },
    { name: '7', value: 7 },
    { name: '8', value: 8 },
    { name: '9', value: 9 },
    { name: '10', value: 10 },
    { name: 'J', value: 11 }, // Jotas
    { name: 'Q', value: 12 }, // Reinas
    { name: 'K', value: 13 }, // Reyes
    { name: 'A', value: 14 }  // As (el valor más alto)
];

// Función para obtener una carta aleatoria
const getRandomCard = () => {
    const randomSuit = suits[Math.floor(Math.random() * suits.length)];
    const randomRank = ranks[Math.floor(Math.random() * ranks.length)];
    return {
        suit: randomSuit,
        rank: randomRank.name,
        value: randomRank.value,
        symbol: randomRank.name + randomSuit // Ej: "A♠"
    };
};

// --- LÓGICA DE SOCKET.IO (Se mantiene la lógica robusta de reingreso) ---

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    const generateRoomCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    // 1. CREACIÓN DE SALA
    socket.on('createRoom', (username) => {
        let roomCode = generateRoomCode();
        while (rooms[roomCode]) {
            roomCode = generateRoomCode();
        }

        rooms[roomCode] = {
            hostId: socket.id,
            players: [{ id: socket.id, username: username }],
            gameStatus: 'waiting',
            currentGame: null,
            code: roomCode
        };

        socket.join(roomCode);
        console.log(`Sala creada: ${roomCode} por ${username}`);
        socket.emit('roomCreated', { code: roomCode, players: rooms[roomCode].players });
    });

    // 2. UNIÓN A SALA
    socket.on('joinRoom', ({ roomCode, username }) => {
        const room = rooms[roomCode];

        if (!room) {
            socket.emit('roomError', 'La sala no existe.');
            return;
        }

        if (room.players.some(p => p.username === username)) {
            socket.emit('roomError', 'Ese nombre de usuario ya está en la sala.');
            return;
        }

        socket.join(roomCode);
        room.players.push({ id: socket.id, username: username });
        
        console.log(`${username} se unió a la sala ${roomCode}`);

        socket.emit('roomJoined', { code: roomCode, players: room.players });
        io.to(roomCode).emit('updatePlayersList', { players: room.players });
    });

    // 3. REINGRESO DE JUGADOR (Después de redirección/recarga)
    socket.on('reEnterRoom', ({ roomCode, username, isHost }) => {
        const room = rooms[roomCode];

        if (!room) {
            socket.emit('roomError', 'La sala no existe al intentar reingresar.');
            return;
        }

        socket.join(roomCode);
        let playerFound = false;

        for (let i = 0; i < room.players.length; i++) {
            if (room.players[i].username === username) {
                room.players[i].id = socket.id;
                
                if (isHost) {
                     room.hostId = socket.id;
                }
                playerFound = true;
                break;
            }
        }

        if (!playerFound) {
             room.players.push({ id: socket.id, username: username });
        }

        console.log(`Jugador ${username} (${socket.id}) reingresó/actualizó ID en sala ${roomCode}`);
        io.to(roomCode).emit('updatePlayersList', { players: room.players });
    });

    // 4. INICIO DE JUEGO
    socket.on('startGame', ({ roomCode, gameType }) => {
        const room = rooms[roomCode];
        
        if (room && room.hostId === socket.id) {
            room.gameStatus = 'in-progress';
            room.currentGame = gameType;
            
            console.log(`Sala ${roomCode} iniciando juego: ${gameType}`);

            io.to(roomCode).emit('redirectToGame', { gameType });
        } else if (room) {
            socket.emit('roomError', 'Solo el anfitrión puede iniciar el juego.');
        } else {
             socket.emit('roomError', 'La sala no existe.');
        }
    });

    socket.on('hostEndingGame', (roomCode) => {
    const room = rooms[roomCode];

    if (!room) return; 

    // 1. Verificar que el socket solicitante sea el anfitrión
    if (room.hostId === socket.id) {
        
        // 2. Actualizar el estado de la sala
        room.gameStatus = 'waiting';
        room.currentGame = null;
        
        // 3. Notificar a TODOS los demás en la sala para que regresen al lobby
        // Usamos broadcast.emit para excluir al emisor (el anfitrión)
        socket.to(roomCode).emit('redirectToLobby', { roomCode: roomCode }); 

        console.log(`Anfitrión de sala ${roomCode} finalizó el juego y envió a todos al lobby.`);
    }
});
    
    // 5. DESCONEXIÓN
    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        
        for (const code in rooms) {
            const room = rooms[code];
            
            if (room.hostId === socket.id) {
                const remainingPlayers = room.players.filter(p => p.id !== socket.id);
                if (remainingPlayers.length > 0) {
                    room.hostId = remainingPlayers[0].id;
                    io.to(room.hostId).emit('newHost', 'Eres el nuevo anfitrión.');
                }
            }
            // NOTA: La eliminación del jugador de la lista se maneja en el reEnterRoom para simplificar.
            // Si el host se fue y era el último, la sala queda inactiva, pero no la eliminamos para
            // permitir una reconexión rápida, a menos que el servidor se reinicie.
        }
    });

    // 1. Manejador para iniciar la ronda de Carta Alta (solo host)
socket.on('startCartaAltaRound', (roomCode) => {
    const room = rooms[roomCode];

    if (!room || room.hostId !== socket.id) {
        socket.emit('gameError', 'No tienes permiso para iniciar la ronda.');
        return;
    }
    
    if (room.players.length < 2) {
        socket.emit('gameError', 'Necesitas al menos dos jugadores.');
        return;
    }
    
    // --- LÓGICA DE REPARTO ---
    let lowestCard = null;
    let loserPlayer = null;
    
    const playersWithCards = room.players.map(player => {
        const card = getRandomCard(); // Obtener carta aleatoria
        
        // 1. Determinar la carta más baja (perdedor)
        if (!loserPlayer || card.value < lowestCard.value) {
            lowestCard = card;
            loserPlayer = player;
        } 
        
        return {
            username: player.username,
            card: card,
            id: player.id
        };
    });

    // 2. Determinar la cantidad de tragos
    const takeAmount = lowestCard.value;
    const isEven = takeAmount % 2 === 0;
    const finalTakeAmount = isEven ? takeAmount * 2 : takeAmount;

    // 3. Enviar resultados
    const results = {
        loser: loserPlayer,
        takeAmount: finalTakeAmount
    };
    
    // Enviar las cartas y los resultados a TODOS
    io.to(roomCode).emit('updateCardTable', playersWithCards);
    io.to(roomCode).emit('roundResultCartaAlta', results);
});


// 4. Actualizar el manejador 'startGame' para incluir Carta Alta

socket.on('startGame', ({ roomCode, gameType }) => {
    const room = rooms[roomCode];
    
    if (room && room.hostId === socket.id) {
        room.gameStatus = 'in-progress';
        room.currentGame = gameType;
        
        console.log(`Sala ${roomCode} iniciando juego: ${gameType}`);

        io.to(roomCode).emit('redirectToGame', { gameType });
        
        if (gameType === 'carta-alta') {
             // Iniciar la primera ronda automáticamente (opcional, el host puede querer esperar)
             // setTimeout(() => { startCartaAltaRound(roomCode); }, 2000); 
        } 
        // ... Lógica para otros juegos (Trivia) ...
    }
    // ... (el resto de la lógica de error) ...
});
});

// --- INICIAR EL SERVIDOR ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});