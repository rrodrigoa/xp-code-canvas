import * as vscode from 'vscode';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import type { SourceGraph } from '../shared/types';
import { parseGraph } from '../shared/contracts';

export interface TextInput { uri: string; root: string; text: string; version: number; }

/** Executes only a fixed, extension-shipped analyzer.py. Project code is NEVER loaded. */
export async function analyzePython(context: vscode.ExtensionContext, inputs: TextInput[], token?: vscode.CancellationToken): Promise<SourceGraph> {
  const configuration = vscode.workspace.getConfiguration('xpCodeCanvas');
  const binary = configuration.get<string>('pythonPath') || (process.platform === 'win32' ? 'python' : 'python3');
  const worker = context.asAbsolutePath(path.join('python', 'analyzer.py'));
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['-I', '-S', '-X', 'utf8', worker], { shell: false, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1' } });
    let output = '', errors = '';
    let settled = false;
    const finish = (error?: Error, result?: SourceGraph) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cancellation?.dispose();
      if (error) reject(error); else resolve(result!);
    };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Python analyzer timed out after 20 seconds')); }, 20_000);
    const cancellation = token?.onCancellationRequested(() => { child.kill(); finish(new Error('Indexing cancelled')); });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      if (output.length > 50 * 1024 * 1024) { child.kill(); finish(new Error('Analyzer response exceeded 50 MiB')); }
    });
    child.stderr.on('data', (chunk: string) => errors += chunk.slice(0, 2048));
    child.on('error', finish);
    child.on('close', code => {
      if (settled) return;
      if (code !== 0) return finish(new Error(`Analyzer exited ${code}: ${errors.slice(0, 4096)} ${output.slice(0, 500)}`));
      try {
        const response = JSON.parse(output) as { error?: string };
        if (response.error) throw new Error(response.error);
        finish(undefined, parseGraph(response));
      } catch (e) { finish(e as Error); }
    });
    child.stdin.on('error', () => { /* cancellation can close stdin before write completes */ });
    child.stdin.end(JSON.stringify({ schema: 1, files: inputs }));
  });
}
