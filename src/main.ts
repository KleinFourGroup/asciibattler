import { Game } from './Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
if (!canvas) throw new Error('Missing <canvas id="game-canvas"> in index.html');

const game = new Game(canvas);
game.start();
