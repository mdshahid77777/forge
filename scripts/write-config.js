const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public');
const targetFile = path.join(targetDir, 'config.js');
const apiUrl = process.env.FORGE_API_URL || process.env.VITE_API_URL || '';

const content = `window.FORGE_API_URL = ${JSON.stringify(apiUrl)};\n`;
fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetFile, content, 'utf8');
console.log(`Wrote ${targetFile} with FORGE_API_URL=${apiUrl || '(relative same-origin)'}`);
