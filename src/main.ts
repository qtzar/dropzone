const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.fillStyle = '#0ff';
ctx.font = '32px monospace';
ctx.fillText('DROPZONE', 40, 60);
