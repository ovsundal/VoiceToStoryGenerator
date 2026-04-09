import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../resources/icons/icon.svg');
const outPath = join(__dirname, '../resources/icons/icon.png');

mkdirSync(dirname(outPath), { recursive: true });
const svg = readFileSync(svgPath, 'utf-8');
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } });
const pngData = resvg.render();
writeFileSync(outPath, pngData.asPng());
console.log('Icon written to', outPath);
