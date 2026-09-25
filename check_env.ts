import fs from 'fs';
import path from 'path';

console.log("ENV VARS:", Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY')));
console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Search for json files that might be service account keys
const files = fs.readdirSync('.');
const jsonFiles = files.filter(f => f.endsWith('.json'));
console.log("JSON files in root:", jsonFiles);
