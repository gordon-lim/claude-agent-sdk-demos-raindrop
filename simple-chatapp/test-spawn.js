import { spawn } from 'child_process';
import 'dotenv/config';

console.log('Testing claude-code spawn...');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY?.substring(0, 20) + '...');
console.log('PATH:', process.env.PATH?.split(':').slice(0, 3).join(':'));

const proc = spawn('claude-code', ['--version'], {
  env: process.env,
  stdio: 'pipe'
});

proc.stdout.on('data', (data) => {
  console.log('stdout:', data.toString());
});

proc.stderr.on('data', (data) => {
  console.log('stderr:', data.toString());
});

proc.on('exit', (code) => {
  console.log('Process exited with code:', code);
  process.exit(code);
});

proc.on('error', (error) => {
  console.error('Failed to spawn:', error);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout - killing process');
  proc.kill();
  process.exit(1);
}, 5000);
