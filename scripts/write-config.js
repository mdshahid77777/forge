const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'public');
const targetFile = path.join(targetDir, 'config.js');
const rawApiUrl = process.env.FORGE_API_URL || process.env.VITE_API_URL || '';
const isLocalApiUrl = /localhost|127\.0\.0\.1|::1/i.test(rawApiUrl);
const apiUrl = isLocalApiUrl ? rawApiUrl : '';

const content = `window.FORGE_API_URL = ${JSON.stringify(apiUrl)};\n`;
fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetFile, content, 'utf8');
console.log(`Wrote ${targetFile} with FORGE_API_URL=${apiUrl || '(relative same-origin)'}`);
