// Reads structure, stronghold and spawn positions for seeds out of Chunkbase's seed map (needs Playwright and network access).
// usage: node scripts/harvest-chunkbase.mjs <out.json> <Bedrock|Java> <chunkbaseVersionNumber> <radiusChunks> <seed...>
import { createRequire } from 'module'; import fs from 'fs'; const { chromium } = createRequire(import.meta.url)('playwright');
const [out, edition, version, radius, ...seeds] = process.argv.slice(2);
const TYPES=['spawn','stronghold','village','ancientCity','netherFortress','ruinedPortalOverworld','woodlandMansion','jungleTemple','shipwreck','trialChamber','desertTemple','oceanMonument'];
const b=await chromium.launch({proxy:{server:process.env.HTTPS_PROXY}});
const p=await b.newPage();
await p.goto('https://www.chunkbase.com/apps/seed-map',{waitUntil:'domcontentloaded',timeout:60000});
const res=await p.evaluate(async ({edition,version,radius,seeds,TYPES})=>{
  const w=new Worker('https://www.chunkbase.com/_astro/bW8BL6AR9MDZ.js',{type:'module'});
  let n=0; const pend=new Map();
  w.onmessage=e=>{ const r=pend.get(e.data.id); if(r){pend.delete(e.data.id); r(e.data);} };
  const call=(path,args)=>new Promise((res,rej)=>{ const id='h'+(n++); pend.set(id,res); w.postMessage({id,type:'APPLY',path:[path],argumentList:args.map(v=>({type:'RAW',value:v}))}); setTimeout(()=>rej(new Error('timeout '+path)),120000); });
  await call('initWorker',[]);
  const outp=[]; const R=+radius;
  for(const seed of seeds){
    const cfg= edition==='Bedrock'?{seed,edition,bedrockVersion:+version,config:{}}:{seed,edition,javaVersion:+version,config:{}};
    const pois={};
    for(const t of TYPES){ try{ const r=await call('getPois',[cfg,[t],-R,-R,2*R,2*R]); pois[t]=(r.value&&r.value[t])||('ERR '+JSON.stringify(r).slice(0,120)); }catch(e){ pois[t]='ERR '+e.message; } }
    outp.push({seed,edition,version:+version,radiusChunks:R,pois});
  }
  return outp;
},{edition,version,radius,seeds,TYPES});
fs.writeFileSync(out,JSON.stringify(res));
for(const r of res){ console.log(r.seed, Object.entries(r.pois).map(([k,v])=>k+':'+(typeof v==='string'?v:v.length)).join(' ')); }
await b.close();
