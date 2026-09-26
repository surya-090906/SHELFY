const fs=require('fs'),assert=require('node:assert/strict'),path=require('path');
const dir=path.resolve(__dirname,'../src/locales'),en=JSON.parse(fs.readFileSync(path.join(dir,'en.json'),'utf8')),keys=Object.keys(en).sort();
for(const lang of ['en','hi','ta','te','ml','kn']){
 const d=JSON.parse(fs.readFileSync(path.join(dir,lang+'.json'),'utf8'));
 assert.deepEqual(Object.keys(d).sort(),keys,lang+' has the same keys as English');
 for(const key of keys){assert.ok(typeof d[key]==='string'&&d[key].trim(),lang+' has text for '+key);assert.deepEqual((d[key].match(/\{\{[^}]+\}\}/g)||[]).sort(),(en[key].match(/\{\{[^}]+\}\}/g)||[]).sort(),lang+' preserves interpolation for '+key);}
 console.log('PASS '+lang+': '+keys.length+' keys and interpolation tokens');
}
