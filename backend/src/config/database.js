const { PrismaClient, Prisma } = require('@prisma/client');
const { current } = require('./tenant');

const prisma = new PrismaClient({
  log: process.env.DB_LOG_QUERIES === 'true' ? ['query', 'warn', 'error'] : [],
});

// This is the only application repository. Raw access is limited to public
// company discovery, verified authentication, migrations and test fixtures.
const models = new Map(Prisma.dmmf.datamodel.models.map(m => [m.name[0].toLowerCase()+m.name.slice(1), m]));
const privateModels = new Set(['refreshSession', 'otpCode', 'referenceCounter', 'auditLog']);
const clean = value => JSON.parse(JSON.stringify(value, (key,v) => /password|code_hash|token_version/i.test(key) ? undefined : v));
const missing = () => { throw Object.assign(new Error('Record not found'), { statusCode: 404 }); };
function scopeWhere(model, where = {}) {
 const c = current();
 // Composite unique selectors are flattened for tenant-scoped findFirst.
 const result={...where};
 for(const key of Object.keys(result)) if(key.startsWith('tenant_id_')) { Object.assign(result,result[key]); delete result[key]; }
 if(model==='company') return {AND:[result,{id:c.tenant_id}]};
 return {AND:[result,{tenant_id:c.tenant_id}]};
}
function dataFor(model, value, creating) {
 if(Array.isArray(value)) return value.map(v=>dataFor(model,v,creating));
 const c=current(), result={...value};
 if('tenant_id' in result && result.tenant_id!==c.tenant_id) throw Object.assign(new Error('Invalid company reference'),{statusCode:400});
 delete result.tenant_id;
 if(creating && model!=='company') result.tenant_id=c.tenant_id;
 for(const f of models.get(model)?.fields||[]) if(f.kind==='object' && result[f.name]) {
  const nested={...result[f.name]}, child=f.type[0].toLowerCase()+f.type.slice(1);
  // Prisma propagates tenant_id from the composite parent relation for nested
  // children. It is excluded from nested unchecked create inputs.
  for(const op of ['create','createMany']) if(nested[op]) nested[op]=op==='createMany'?{...nested[op],data:dataFor(child,nested[op].data,false)}:dataFor(child,nested[op],false);
  if(nested.deleteMany) nested.deleteMany=scopeWhere(child,nested.deleteMany);
  // Connect/disconnect/upsert are deliberately unsupported by this repository.
  if(Object.keys(nested).some(k=>!['create','createMany','deleteMany'].includes(k))) throw Object.assign(new Error('Unsupported nested mutation'),{statusCode:400});
  result[f.name]=nested;
 }
 return result;
}
function repository(client, transaction=false) {
 return new Proxy(client,{get(target,key){
  if(key==='$raw') return prisma;
  if(key==='$disconnect') return prisma.$disconnect.bind(prisma);
  if(key==='$transaction') return (fn,opts)=>{ current(); if(typeof fn!=='function') throw new Error('Use transaction callbacks'); return prisma.$transaction(tx=>fn(repository(tx,true)),opts); };
  if(typeof key==='string' && key.startsWith('$')) return target[key]?.bind(target);
  if(!models.has(key)) return target[key];
  return new Proxy(target[key],{get(delegate,operation){return async (args={})=>{
   current();
   const mutate=['create','createMany','update','updateMany','delete','deleteMany','upsert'].includes(operation);
   if(mutate && !transaction) return prisma.$transaction(tx=>repository(tx,true)[key][operation](args));
   const options={...args};
   const actual=operation==='findUnique'?'findFirst':operation==='findUniqueOrThrow'?'findFirstOrThrow':operation;
   if(!['create','createMany'].includes(operation)) options.where=scopeWhere(key,args.where);
   if(options.data) options.data=dataFor(key,options.data,operation.startsWith('create'));
   if(operation==='upsert') {
    const old=await delegate.findFirst({where:options.where});
    return old?repository(target,true)[key].update({where:{[key==='referenceCounter'?'key':'id']:old[key==='referenceCounter'?'key':'id']},data:args.update}):repository(target,true)[key].create({data:args.create});
   }
   const snapshotInclude=['receipt','deliveryOrder','transfer'].includes(key)?{items:true}:undefined;
   const before=mutate && !operation.startsWith('create')?await delegate.findMany({where:options.where,...(snapshotInclude&&{include:snapshotInclude})}):[];
   if(['update','delete'].includes(operation)){
    if(!before.length) missing();
    options.where={ [key==='referenceCounter'?'key':'id']:before[0][key==='referenceCounter'?'key':'id'], ...(key!=='company'&&{tenant_id:current().tenant_id}) };
   }
   const result=await delegate[actual](options);
   if(mutate && !privateModels.has(key)) {
    const after=operation.startsWith('delete')?[]:operation==='createMany'?options.data:await delegate.findMany({where:scopeWhere(key,{...(operation==='updateMany'?args.where:{[key==='referenceCounter'?'key':'id']:result[key==='referenceCounter'?'key':'id']})}),...(snapshotInclude&&{include:snapshotInclude})});
    const records=operation.startsWith('create')?after:before;
    for(const row of records) await target.auditLog.create({data:{tenant_id:current().tenant_id,user_id:current().user_id||null,action:`${key}.${operation}`,entity_type:key,entity_id:String(row.id??row.key),before:operation.startsWith('create')?undefined:clean(row),after:operation.startsWith('delete')?undefined:clean(after.find(a=>a.id===row.id)||result),ip_address:current().ip_address||null}});
   }
   return result;
  };}});
 }});
}
module.exports = repository(prisma);
