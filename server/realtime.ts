import { WebSocket } from "ws";

// Shared registry of connected WebSocket clients, keyed by userId.
// Populated by server/index.ts; used by routes.ts to push real-time events.
export const wsClients = new Map<string, WebSocket>();

/** Send a message to every connected client (global broadcast). */
export function broadcast(msg: object): void {
  const raw = JSON.stringify(msg);
  for (const ws of wsClients.values()) {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw);
  }
}

/** Send a message to a specific user (targeted push). */
export function sendToUser(userId: string, msg: object): void {
  const ws = wsClients.get(String(userId));
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
