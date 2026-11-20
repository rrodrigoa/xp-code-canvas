import type { CanvasState, FromWebview, ToWebview } from '../shared/types';

interface VSCodeBridge { postMessage(message: FromWebview): void; getState(): unknown; setState(state: unknown): void; }
declare function acquireVsCodeApi(): VSCodeBridge;

export const bridge: VSCodeBridge = typeof acquireVsCodeApi === 'function'
  ? acquireVsCodeApi()
  : {
      postMessage: message => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('xp-mock-post', { detail: message })); },
      getState: () => undefined,
      setState: () => undefined,
    };

export function request(message: FromWebview): void { bridge.postMessage(message); }
export function persist(state: CanvasState): void { bridge.setState(state); }
export function subscribe(listener: (message: ToWebview) => void): () => void {
  const handler = (event: MessageEvent) => listener(event.data as ToWebview);
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}
