// Translate static UI copy only. No user/company data is sent to this service.
const fs=require('fs'),path=require('path');
const dir=path.resolve(__dirname,'../src/locales'),source=JSON.parse(fs.readFileSync(path.join(dir,'en.json'),'utf8'));
const overrides={manager:'Inventory Manager',staff:'Warehouse Staff',in_stock:'In stock',low_stock:'Low stock',out_of_stock:'Out of stock',receipt:'Receipt',deliveryOrder:'Delivery',stockLedger:'Stock movement',receiptItem:'Receipt line',deliveryItem:'Delivery line',transferItem:'Transfer line',otpCode:'Password reset',refreshSession:'Session',referenceCounter:'Reference counter',user:'User',company:'Company',invite:'Invitation',create:'Created',update:'Updated',delete:'Deleted',join:'Joined',updateMany:'Updated',deleteMany:'Deleted',createMany:'Created'};
Object.assign(source,overrides);for(const k of Object.keys(source))if(source[k]===k&&/^[a-z_]+$/.test(k))source[k]=k.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
fs.writeFileSync(path.join(dir,'en.json'),JSON.stringify(source,null,2)+'\n');
async function translate(text,language){const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl='+language+'&dt=t&q='+encodeURIComponent(text);const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('Translation HTTP '+r.status);const j=await r.json();return j[0].map(row=>row[0]).join('');}
async function language(lang){const file=path.join(dir,lang+'.json');const out=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{},keys=Object.keys(source).filter(k=>!out[k]);
 for(let i=0;i<keys.length;i+=20){const group=keys.slice(i,i+20);const translated=(await translate(group.map(k=>source[k]).join('\n'),lang)).split('\n');
  if(translated.length===group.length)group.forEach((k,n)=>out[k]=translated[n]);
  else for(const k of group)out[k]=await translate(source[k],lang);
  // Preserve interpolation tokens exactly, even if translated by the service.
  for(const k of group){const original=source[k].match(/\{\{[^}]+\}\}/g)||[],matches=out[k].match(/\{\{[^}]+\}\}/g)||[];if(matches.length===original.length)matches.forEach((m,n)=>out[k]=out[k].replace(m,original[n]));else if(original.length)out[k]=source[k];}
  fs.writeFileSync(path.join(dir,lang+'.json'),JSON.stringify(out,null,2)+'\n');console.log(lang+': '+Math.min(i+20,keys.length)+'/'+keys.length);
 }
}
Promise.all(['hi','ta','te','ml','kn'].map(language)).catch(e=>{console.error(e);process.exitCode=1;});
