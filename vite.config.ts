import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';

// Only runtime snapshots belong in the public site; source workbooks and audit
// records stay in the repository. Keep this list aligned with App's data reads.
const runtimeDataFiles = [
  'catalog.json',
  'bidding-history.json',
  'reviews.json',
  'review-sources.json',
  'enrollment-history.json',
  'exchange-history.json',
  'nonsom-history.json',
];

export default defineConfig({base:'./',plugins:[react(),{name:'project-data',configureServer(server){server.middlewares.use('/data',(req,res,next)=>{const name=path.basename((req.url??'').split('?')[0]);if(!name.endsWith('.json'))return next();try{res.setHeader('Content-Type','application/json');res.end(readFileSync(path.resolve('data',name)));}catch{res.statusCode=404;res.end(JSON.stringify({error:'资料尚未准备好'}));}});},closeBundle(){mkdirSync('dist/data',{recursive:true});for(const name of runtimeDataFiles)copyFileSync(path.join('data',name),path.join('dist/data',name));}}],server:{host:'0.0.0.0',port:5173},build:{target:'es2022'}});
