import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

const args=['--no-sandbox','--enable-unsafe-webgpu','--use-angle=swiftshader','--disable-gpu-sandbox'];
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args});
const page=await browser.newPage();
const trustedTransport=process.argv.includes('--trusted-transport');
const network=[];
const messages=[];
page.on('requestfailed',r=>network.push({url:r.url(),error:r.failure()?.errorText}));
page.on('response',r=>{if(r.status()>=400)network.push({url:r.url(),status:r.status()})});
page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push({type:m.type(),text:m.text().slice(0,1000)})});
if(trustedTransport){
 await page.route('https://**',async route=>{
  try{
   const response=await route.fetch({timeout:25000});
   await route.fulfill({response});
  }catch(e){network.push({url:route.request().url(),transportError:String(e)});await route.abort('failed')}
 });
}
await page.goto('http://127.0.0.1:5173/');
const started=Date.now();
const result=await page.evaluate(async()=>{
 const adapter=await navigator.gpu?.requestAdapter();
 const info=adapter?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,shaderF16:adapter.features.has('shader-f16'),maxBufferSize:adapter.limits.maxBufferSize,maxStorageBufferBindingSize:adapter.limits.maxStorageBufferBindingSize}:null;
 const progress=[];
 try{
  const ai=await import('/src/ai.ts');
  const model=await Promise.race([ai.enableLocalModel(text=>progress.push(text)),new Promise((_,reject)=>setTimeout(()=>reject(Error('Controlled test initialization timed out after 60 seconds')),60000))]);
  const answer=await Promise.race([ai.askLocalModel('只回答OK。','仅测试本地模型运行，不提供课程事实。'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Controlled inference timed out after 30 seconds')),30000))]);
  return {adapter:info,initialized:true,model,inferenceSucceeded:!!answer,answer,progress};
 }catch(e){return {adapter:info,initialized:false,inferenceSucceeded:false,error:String(e),stack:e?.stack?.slice(0,3000),progress}}
});
const output={testedAt:new Date().toISOString(),target:'http://127.0.0.1:5173/',module:'/src/ai.ts',browser:await browser.version(),args,trustedTransport,elapsedMs:Date.now()-started,result,network,messages};
await writeFile(new URL(trustedTransport?'./trusted-transport-result.json':'./software-webgpu-result.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
await browser.close();
