/**
 * Monta a allowlist de origens do frontend para dev local, ngrok e Docker.
 * Partilhado entre o CORS do HTTP (main.ts) e o CORS do WebSocket gateway,
 * para que as duas camadas de transporte nunca aceitem origens diferentes.
 */
export function buildCorsOrigins(): string[] {
  /** FRONTEND_URL é o destino usado no redirect OAuth -> React. */
  const frontendUrl = process.env.FRONTEND_URL;

  /** CORS_ORIGINS permite acrescentar domínios separados por vírgula sem mexer no código. */
  const configuredOrigins =
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  /** Defaults seguros para o Vite local usado no projecto. */
  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(frontendUrl ? [frontendUrl] : []),
    ...configuredOrigins,
  ];
}
