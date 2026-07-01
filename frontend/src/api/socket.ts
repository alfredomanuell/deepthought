import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from '../config/api'
import { refreshToken } from './refresh'

let socket: Socket | null = null

/** Liga (ou devolve a ligação já existente) ao gateway WebSocket do mundo. */
export function connectSocket(): Socket {
  if (socket) return socket

  socket = io(API_BASE_URL, {
    // Função em vez de valor estático: cada reconexão relê o token actual,
    // que pode já ter sido rodado pelo refresh.ts entretanto.
    auth: (cb) => cb({ token: localStorage.getItem('token') }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  socket.on('client:auth_error', () => {
    refreshToken()
  })

  return socket
}

export function getSocket(): Socket | null {
  return socket
}

export function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}
