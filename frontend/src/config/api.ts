/**
 * URL pública do backend usada pelo browser.
 *
 * Em produção/dev com ngrok. O fallback mantém o
 * domínio que já está configurado no botão OAuth, evitando POST OTP para
 * localhost quando o backend real está atrás do ngrok.
 */
export const API_BASE_URL = 'https://premiere-crook-saggy.ngrok-free.dev';
