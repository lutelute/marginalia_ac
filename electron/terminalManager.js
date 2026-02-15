const pty = require('node-pty');
const crypto = require('crypto');

const sessions = new Map();

function getDefaultShell() {
  if (process.platform === 'win32') return 'powershell.exe';
  return process.env.SHELL || '/bin/zsh';
}

function createSession(cwd, onData, onExit) {
  const sessionId = crypto.randomUUID();
  const shell = getDefaultShell();
  const args = process.platform === 'win32' ? [] : ['-l'];

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: cwd || process.env.HOME,
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  sessions.set(sessionId, { pty: ptyProcess, cwd });

  ptyProcess.onData((data) => onData(sessionId, data));
  ptyProcess.onExit(({ exitCode, signal }) => {
    sessions.delete(sessionId);
    onExit(sessionId, exitCode, signal);
  });

  return { sessionId, pid: ptyProcess.pid };
}

function writeToSession(sessionId, data) {
  const session = sessions.get(sessionId);
  if (session) {
    session.pty.write(data);
  }
}

function resizeSession(sessionId, cols, rows) {
  const session = sessions.get(sessionId);
  if (session) {
    session.pty.resize(cols, rows);
  }
}

function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.pty.kill();
    sessions.delete(sessionId);
  }
}

function destroyAll() {
  for (const [sessionId, session] of sessions) {
    session.pty.kill();
  }
  sessions.clear();
}

module.exports = { createSession, writeToSession, resizeSession, destroySession, destroyAll };
