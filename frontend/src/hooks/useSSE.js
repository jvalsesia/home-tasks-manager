import { useEffect, useRef } from 'react';

// Empty string = relative URL (nginx reverse proxy in Docker).
// Set VITE_API_BASE=http://localhost:3000 in .env.local for local dev.
const SSE_URL = `${import.meta.env.VITE_API_BASE ?? ''}/events`;

/**
 * Opens a persistent SSE connection and calls `onMessage` for each event.
 *
 * The connection is automatically re-established after disconnects (with a
 * 3-second back-off so we don't hammer the server).
 *
 * @param {(event: { type: string, [key: string]: any }) => void} onMessage
 */
export function useSSE(onMessage) {
  // Keep a stable ref so reconnect logic always calls the latest handler
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let es;
    let retryTimer;

    function connect() {
      es = new EventSource(SSE_URL);

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          handlerRef.current(payload);
        } catch {
          // ignore malformed frames (e.g. keep-alive pings)
        }
      };

      es.onerror = () => {
        es.close();
        // Reconnect after 3 s
        retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimer);
      es?.close();
    };
  }, []); // intentionally empty — we want one persistent connection
}
