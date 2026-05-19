import { Server } from 'socket.io';
import { parseCookies } from '../utils/cookies.js';
import { AUTH_COOKIE } from '../utils/authCookies.js';
import { verifyAuthToken } from '../middleware/auth.js';
import constants from '../config/constants.js';
import logger from '../config/logger.js';

let io = null;

function extractSocketToken(socket) {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    if (cookies[AUTH_COOKIE]) return cookies[AUTH_COOKIE];

    // Temporary dual-auth migration support for old clients.
    return socket.handshake.auth?.token || null;
}

export function initSocket(server) {
    const ALLOWED_ORIGINS = [
        'http://localhost:5173',
        'https://smart-spend-ochre-two.vercel.app',
        constants.frontendUrl
    ];

    io = new Server(server, {
        cors: {
            origin: ALLOWED_ORIGINS,
            credentials: true,
            methods: ['GET', 'POST', 'OPTIONS'],
        },
    });

    io.use(async (socket, next) => {
        const token = extractSocketToken(socket);
        if (!token) return next(new Error('Authentication required'));

        try {
            const { user } = await verifyAuthToken(token);
            socket.userId = String(user._id);
            next();
        } catch {
            next(new Error('Invalid or revoked session'));
        }
    });

    io.on('connection', (socket) => {
        if (socket.userId) socket.join(socket.userId);
    });

    logger.info('Socket.io initialized');
    return io;
}

export function emitToUser(userId, event, data) {
    if (io) io.to(String(userId)).emit(event, data);
}

export function disconnectUserSockets(userId) {
    if (!io) return;
    const room = io.sockets.adapter.rooms.get(String(userId));
    if (!room) return;
    for (const socketId of room) {
        const socket = io.sockets.sockets.get(socketId);
        socket?.emit('session_revoked');
        socket?.disconnect(true);
    }
}

export function getIO() {
    return io;
}

