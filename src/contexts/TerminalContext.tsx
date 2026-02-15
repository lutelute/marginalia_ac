import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Types
interface TerminalSession {
  id: string;
  title: string;
  pid: number;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
}

type TerminalAction =
  | { type: 'CREATE_SESSION'; payload: TerminalSession }
  | { type: 'DESTROY_SESSION'; payload: string }
  | { type: 'SET_ACTIVE_SESSION'; payload: string }
  | { type: 'TOGGLE_BOTTOM_PANEL' }
  | { type: 'SET_BOTTOM_PANEL_HEIGHT'; payload: number }
  | { type: 'SET_SESSION_TITLE'; payload: { sessionId: string; title: string } };

interface TerminalContextValue {
  state: TerminalState;
  createTerminal: (cwd?: string) => Promise<void>;
  destroyTerminal: (sessionId: string) => Promise<void>;
  setActiveSession: (sessionId: string) => void;
  toggleBottomPanel: () => void;
  setBottomPanelHeight: (h: number) => void;
  setSessionTitle: (sessionId: string, title: string) => void;
}

const initialState: TerminalState = {
  sessions: [],
  activeSessionId: null,
  bottomPanelOpen: false,
  bottomPanelHeight: 250,
};

function terminalReducer(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'CREATE_SESSION':
      return {
        ...state,
        sessions: [...state.sessions, action.payload],
        activeSessionId: action.payload.id,
        bottomPanelOpen: true,
      };
    case 'DESTROY_SESSION': {
      const filtered = state.sessions.filter((s) => s.id !== action.payload);
      let nextActive = state.activeSessionId;
      if (state.activeSessionId === action.payload) {
        nextActive = filtered.length > 0 ? filtered[filtered.length - 1].id : null;
      }
      return {
        ...state,
        sessions: filtered,
        activeSessionId: nextActive,
        bottomPanelOpen: filtered.length > 0 ? state.bottomPanelOpen : false,
      };
    }
    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSessionId: action.payload };
    case 'TOGGLE_BOTTOM_PANEL':
      return { ...state, bottomPanelOpen: !state.bottomPanelOpen };
    case 'SET_BOTTOM_PANEL_HEIGHT':
      return { ...state, bottomPanelHeight: action.payload };
    case 'SET_SESSION_TITLE':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.payload.sessionId ? { ...s, title: action.payload.title } : s
        ),
      };
    default:
      return state;
  }
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

let sessionCounter = 0;

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(terminalReducer, initialState);

  const createTerminal = useCallback(async (cwd?: string) => {
    const api = window.electronAPI;
    if (!api?.terminalCreate) return;

    const result = await api.terminalCreate(cwd);
    sessionCounter++;
    dispatch({
      type: 'CREATE_SESSION',
      payload: {
        id: result.sessionId,
        title: `Terminal ${sessionCounter}`,
        pid: result.pid,
      },
    });
  }, []);

  const destroyTerminal = useCallback(async (sessionId: string) => {
    const api = window.electronAPI;
    if (!api?.terminalDestroy) return;

    await api.terminalDestroy(sessionId);
    dispatch({ type: 'DESTROY_SESSION', payload: sessionId });
  }, []);

  const setActiveSession = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
  }, []);

  const toggleBottomPanel = useCallback(() => {
    dispatch({ type: 'TOGGLE_BOTTOM_PANEL' });
  }, []);

  const setBottomPanelHeight = useCallback((h: number) => {
    dispatch({ type: 'SET_BOTTOM_PANEL_HEIGHT', payload: h });
  }, []);

  const setSessionTitle = useCallback((sessionId: string, title: string) => {
    dispatch({ type: 'SET_SESSION_TITLE', payload: { sessionId, title } });
  }, []);

  const value: TerminalContextValue = {
    state,
    createTerminal,
    destroyTerminal,
    setActiveSession,
    toggleBottomPanel,
    setBottomPanelHeight,
    setSessionTitle,
  };

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminal(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return ctx;
}
