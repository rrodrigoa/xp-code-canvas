import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { parseGraph } from '../../shared/contracts';
import type { SourceGraph } from '../../shared/types';
export interface TextInput { uri: string; root: string; text: string; version: number; }

type Pending = { resolve: (graph: SourceGraph) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout>; };
/** Fixed extension-shipped, long-lived isolated Python worker, newline-delimited RPC. */
export class PythonWorkerClient implements vscode.Disposable {
  private process?: ChildProcessWithoutNullStreams;
  private buffer = '';
  private seq = 0;
  private pending = new Map<string, Pending>();
  private restartRequired = false;
  private disposed = false;
  constructor(private readonly context: vscode.ExtensionContext, private readonly replaySnapshots: () => TextInput[], private readonly timeoutMs = 30000) {}
  private start(): void {
    if (this.disposed) throw Error('Python worker disposed');
    if (this.process) return;
    const executable = vscode.workspace.getConfiguration('xpCodeCanvas').get<string>('pythonPath') || (process.platform === 'win32' ? 'python' : 'python3');
    const script = this.context.asAbsolutePath(path.join('python', 'entrypoint.py'));
    const child = spawn(executable, ['-I', '-S', '-u', '-X', 'utf8', script], { stdio: ['pipe','pipe','pipe'], shell: false, windowsHide: true,
      env: { ...process.env, PYTHONNOUSERSITE: '1', PYTHONDONTWRITEBYTECODE: '1' } });
    this.process = child;
    this.buffer = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (part: string) => {
      this.buffer += part;
      if (this.buffer.length > 64 * 1024 * 1024) { child.kill(); return; }
      let cursor = this.buffer.indexOf('\n');
      while (cursor >= 0) {
        const line = this.buffer.slice(0,cursor);
        this.buffer = this.buffer.slice(cursor+1);
        try {
          const response = JSON.parse(line) as { rpcVersion: number; requestId: string; result?: SourceGraph; error?: string };
          if (response.rpcVersion !== 2 || typeof response.requestId !== 'string') throw Error('Malformed worker envelope');
          const waiter = this.pending.get(response.requestId);
          if (waiter) {
            this.pending.delete(response.requestId);
            clearTimeout(waiter.timer);
            if (response.error) waiter.reject(Error(response.error));
            else waiter.resolve(parseGraph(response.result));
          }
        } catch (error) { this.failAll(Error(`Malformed worker reply: ${String(error)}`)); child.kill(); }
        cursor = this.buffer.indexOf('\n');
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (part: string) => { stderr = (stderr + part).slice(-2048); });
    child.on('error', error => this.failAll(error));
    child.on('close', code => {
      if (this.process === child) this.process = undefined;
      this.restartRequired = true;
      this.failAll(Error(`Python worker terminated (${code}): ${stderr}`));
    });
  }
  private failAll(error: Error): void {
    for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(error); }
    this.pending.clear();
  }
  async index(changes: TextInput[], removed: string[] = [], token?: vscode.CancellationToken): Promise<SourceGraph> {
    if (this.disposed) throw Error('Worker disposed');
    // Crash recovery reconstructs only from SourceRepository, avoiding a second cache of source bytes.
    const payload = this.restartRequired ? this.replaySnapshots() : changes;
    this.start();
    this.restartRequired = false;
    const requestId = String(++this.seq);
    return new Promise<SourceGraph>((resolve,reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        this.process?.kill();
        reject(Error('Python worker timed out; retrying will rebuild the index'));
      },this.timeoutMs);
      const subscription = token?.onCancellationRequested(() => {
        this.pending.delete(requestId); clearTimeout(timer);
        reject(Error('Analysis cancelled'));
      });
      this.pending.set(requestId,{ resolve: value => { subscription?.dispose(); resolve(value); }, reject: error => { subscription?.dispose(); reject(error); }, timer });
      const encoded = JSON.stringify({ rpcVersion: 2, requestId, method: 'index', files: payload, removed });
      if (encoded.length > 64 * 1024 * 1024) {
        clearTimeout(timer); this.pending.delete(requestId); reject(Error('Index request too large; batch source files')); return;
      }
      this.process!.stdin.write(encoded + '\n',error => { if (error) { clearTimeout(timer); this.pending.delete(requestId); reject(error); } });
    });
  }
  dispose(): void { this.disposed = true; this.process?.kill(); this.process = undefined; this.failAll(Error('Worker disposed')); }
}
