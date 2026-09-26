// Run from backend: node scripts/migrate-supabase.cjs --check | --apply
// Credentials are read from ignored environment files; never printed or passed as command-line URLs.
require('dotenv').config();
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {PrismaClient,Prisma}=require('@prisma/client');
const root=path.resolve(__dirname,'..'),tables=Prisma.dmmf.datamodel.models.map(m=>m.dbName||m.name);
const skip=new Set(['refresh_sessions','otp_codes']);
const quote=name=>'"'+name.replaceAll('"','""')+'"';
function pgEnvironment(url){
 return {...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:url.searchParams.get('sslmode')||'prefer'};
}
function runPg(program,args,url){
 const binary=process.env.PG_BIN?path.join(process.env.PG_BIN,program+(process.platform==='win32'?'.exe':'')):program;
 execFileSync(binary,args,{env:pgEnvironment(url),stdio:['ignore','ignore','pipe']});
}
async function counts(client){const result={};for(const table of tables)if(!skip.has(table))result[table]=Number((await client.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM ${quote(table)}`))[0].count);return result;}
async function main(){
 const apply=process.argv.includes('--apply');
 if(!apply&&!process.argv.includes('--check'))throw Error('Use --check to inspect or --apply to migrate into an empty Supabase project.');
 if(!process.env.SUPABASE_DIRECT_URL)throw Error('Set SUPABASE_DIRECT_URL in backend/.env to the target session pooler (5432) or direct connection.');
 const sourceUrl=new URL(process.env.DIRECT_URL||process.env.DATABASE_URL),targetUrl=new URL(process.env.SUPABASE_DIRECT_URL);
 if(!/\.(supabase\.co|pooler\.supabase\.com)$/.test(targetUrl.hostname))throw Error('The target must be a Supabase database host.');
 if(targetUrl.port==='6543')throw Error('Use a session pooler or direct connection for migration, not transaction pooling.');
 if((sourceUrl.searchParams.get('schema')||'public')!=='public'||(targetUrl.searchParams.get('schema')||'public')!=='public')throw Error('This migration tool supports the public Shelfy schema only.');
 targetUrl.searchParams.set('sslmode','require');
 const source=new PrismaClient({datasourceUrl:sourceUrl.toString()}),target=new PrismaClient({datasourceUrl:targetUrl.toString()});
 try{
  const existing=await target.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  const conflicts=existing.filter(row=>tables.includes(row.tablename)||row.tablename==='_prisma_migrations');
  if(conflicts.length)throw Error('Target already contains application tables. Refusing to overwrite or merge data. Use an empty project.');
  const before=await counts(source);
  console.log('Source records:',JSON.stringify(before));console.log('Target is empty of Shelfy tables.');
  if(!apply){console.log('Preflight passed. No records were changed.');return;}
  const folder=path.resolve(root,'../artifacts','supabase-migration-'+Date.now());fs.mkdirSync(folder,{recursive:true});
  runPg('pg_dump',['--format=custom','--schema=public','--no-owner','--no-acl','--file='+path.join(folder,'source-backup.dump')],sourceUrl);
  runPg('pg_dump',['--format=custom','--data-only','--schema=public','--no-owner','--no-acl','--exclude-table-data=public._prisma_migrations',...Array.from(skip,t=>'--exclude-table-data=public.'+t),'--file='+path.join(folder,'inventory-data.dump')],sourceUrl);
  console.log('Local backup saved. Applying schema to the empty target.');
  execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:targetUrl.toString(),DIRECT_URL:targetUrl.toString()},stdio:['ignore','ignore','pipe']});
  runPg('pg_restore',['--data-only','--no-owner','--no-acl','--exit-on-error','--single-transaction','--dbname='+decodeURIComponent(targetUrl.pathname.slice(1)),path.join(folder,'inventory-data.dump')],targetUrl);
  const after=await counts(target);if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Record counts differ. Connection settings were not switched.');
  fs.writeFileSync(path.join(folder,'verification.json'),JSON.stringify({before,after,verifiedAt:new Date().toISOString()},null,2));
  console.log('Migration verified: all business table counts match. Source database is unchanged.');
  console.log('Set DATABASE_URL to your Supabase runtime connection and DIRECT_URL to your Supabase session/direct connection, then restart the backend.');
 }finally{await source.$disconnect();await target.$disconnect();}
}
main().catch(error=>{console.error(error.code?'Migration command failed ('+error.code+'). Source is unchanged; connection settings were not switched.':error.message);process.exitCode=1;});
