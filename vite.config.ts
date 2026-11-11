import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
export default defineConfig({base:'./',plugins:[react(),{name:'project-data',configureServer(server){server.middlewares.use('/data',(req,res,next)=>{const name=path.basename((req.url??'').split('?')[0]);if(!name.endsWith('.json'))return next();try{res.setHeader('Content-Type','application/json');res.end(readFileSync(path.resolve('data',name)));}catch{res.statusCode=404;res.end(JSON.stringify({error:'资料尚未准备好'}));}});},closeBundle(){mkdirSync('dist/data',{recursive:true});for(const name of readdirSync('data').filter(f=>f.endsWith('.json')))copyFileSync(path.join('data',name),path.join('dist/data',name));}}],server:{host:'0.0.0.0',port:5173},build:{target:'es2022'}});
