const router=require('express').Router(),prisma=require('../config/database'),{authenticate}=require('../middlewares/auth'),{requireRole}=require('../middlewares/role');
const {fail,profile,strong}=require('../controllers/authController'),bcrypt=require('bcryptjs'),crypto=require('crypto');
const wrap=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
const manager=requireRole(['manager']);router.use(authenticate);
router.get('/settings',wrap(async(req,res)=>res.json({success:true,data:req.user})));
router.put('/settings',wrap(async(req,res)=>{
 const b=req.body,data={};
 if(b.name!==undefined){if(!String(b.name).trim())fail('Name is required');data.name=String(b.name).trim();}
 if(b.language!==undefined){if(!['en','hi','ta','te','ml','kn'].includes(b.language))fail('Invalid language');data.language=b.language;}
 if(b.theme!==undefined){if(!['light','dark','system'].includes(b.theme))fail('Invalid theme');data.theme=b.theme;}
 if(b.font_scale!==undefined){if(!Number.isInteger(b.font_scale)||b.font_scale<90||b.font_scale>130)fail('Font scale must be between 90 and 130');data.font_scale=b.font_scale;}
 const u=await prisma.user.update({where:{id:req.user.id},data});res.json({success:true,user:await profile(u)});
}));
router.post('/settings/password',wrap(async(req,res)=>{
 const b=req.body,u=await prisma.user.findUnique({where:{id:req.user.id}});
 if(!strong(b.new_password)||b.new_password!==b.confirm_password)fail('Passwords must match and contain uppercase, lowercase and a special character, with at least 8 characters');
 if(!await bcrypt.compare(String(b.current_password||''),u.password_hash))fail('Current password is incorrect');
 await prisma.$transaction(async tx=>{await tx.user.update({where:{id:u.id},data:{password_hash:await bcrypt.hash(b.new_password,10),token_version:{increment:1}}});await tx.refreshSession.updateMany({where:{user_id:u.id},data:{revoked:true}});});
 require('../services/socketService').disconnectUser(u.id);res.json({success:true});
}));
router.get('/company',manager,wrap(async(req,res)=>res.json({success:true,data:await prisma.company.findUnique({where:{id:req.tenant_id}})})));
router.put('/company',manager,wrap(async(req,res)=>{
 if(!req.body.name?.trim()||! /^[A-Za-z0-9_-]{2,12}$/.test(req.body.short_code||''))fail('Company name and a short code (2–12 letters, digits, _ or -) are required');
 const data=await prisma.company.update({where:{id:req.tenant_id},data:{name:req.body.name.trim(),short_code:req.body.short_code.toUpperCase()}});res.json({success:true,data});
}));
router.get('/company/users',manager,wrap(async(req,res)=>res.json({success:true,data:await prisma.user.findMany({select:{id:true,name:true,email:true,login_id:true,role:true},orderBy:{id:'asc'}})})));
router.put('/company/users/:id/role',manager,wrap(async(req,res)=>{
 const id=Number(req.params.id),role=req.body.role;if(!['manager','staff'].includes(role))fail('Invalid role');
 await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(731943, ${req.tenant_id}::integer)`;
  const u=await tx.user.findUnique({where:{id}});if(!u)fail('Record not found',404);
  if(u.role==='manager'&&role==='staff'&&await tx.user.count({where:{role:'manager'}})<=1)fail('The company must retain at least one manager',409);
  await tx.user.update({where:{id},data:{role,token_version:{increment:1}}});await tx.refreshSession.updateMany({where:{user_id:id},data:{revoked:true}});
 });require('../services/socketService').disconnectUser(id);res.json({success:true});
}));
router.get('/company/invites',manager,wrap(async(req,res)=>res.json({success:true,data:await prisma.invite.findMany({select:{id:true,email:true,role:true,used:true,expires_at:true,created_at:true},orderBy:{id:'desc'}})})));
router.post('/company/invites',manager,wrap(async(req,res)=>{
 const role=req.body.role||'staff';if(!['manager','staff'].includes(role))fail('Invalid role');
 const email=req.body.email?.trim().toLowerCase()||null;if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Enter a valid Email Id');
 const code=crypto.randomBytes(24).toString('base64url');const data=await prisma.invite.create({data:{code_hash:crypto.createHash('sha256').update(code).digest('hex'),email,role,expires_at:new Date(Date.now()+604800000),created_by:req.user.id}});
 res.status(201).json({success:true,data:{id:data.id,code,role,email,expires_at:data.expires_at,link:`${process.env.FRONTEND_URL||'http://localhost:5173'}/?invite=${code}`}});
}));
router.delete('/company/invites/:id',manager,wrap(async(req,res)=>{await prisma.invite.update({where:{id:Number(req.params.id)},data:{used:true}});res.json({success:true});}));
router.get('/audit',manager,wrap(async(req,res)=>{
 const where={};for(const k of ['action','entity_type'])if(req.query[k])where[k]={contains:req.query[k],mode:'insensitive'};
 if(req.query.user_id)where.user_id=Number(req.query.user_id);
 if(req.query.from||req.query.to)where.created_at={...(req.query.from&&{gte:new Date(req.query.from)}),...(req.query.to&&{lte:new Date(`${req.query.to}T23:59:59.999Z`)})};
 const page=Math.max(1,Math.trunc(Number(req.query.page)||1)),total=await prisma.auditLog.count({where});
 const data=await prisma.auditLog.findMany({where,orderBy:{id:'desc'},take:50,skip:(page-1)*50});
 const users=await prisma.user.findMany({select:{id:true,name:true}});res.json({success:true,data:data.map(a=>({...a,user_name:users.find(u=>u.id===a.user_id)?.name||'System'})),pagination:{page,total,pages:Math.ceil(total/50)}});
}));
module.exports=router;
