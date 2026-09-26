const bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),crypto=require('crypto');
const prisma=require('../config/database'),{run,current}=require('../config/tenant'),redis=require('../config/redis');
const raw=prisma.$raw;
const accessSecret=process.env.JWT_SECRET||'stocksense_jwt_access_secret_super_secure_key_123!';
const refreshSecret=process.env.JWT_REFRESH_SECRET||'stocksense_jwt_refresh_secret_super_secure_key_456!';
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const strong=p=>typeof p==='string'&&/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/.test(p);
const profile=async u=>{const {password_hash,token_version,...user}=u;return {...user,company:await raw.company.findUnique({where:{id:u.tenant_id}})};};
const tokens=async u=>{
 const jti=crypto.randomUUID();await prisma.refreshSession.create({data:{id:jti,user_id:u.id,expires_at:new Date(Date.now()+604800000)}});
 const payload={userId:u.id,tenant_id:u.tenant_id,role:u.role,version:u.token_version};
 return {accessToken:jwt.sign(payload,accessSecret,{expiresIn:'15m'}),refreshToken:jwt.sign({...payload,jti},refreshSecret,{expiresIn:'7d'})};
};
const cookie=(res,t)=>res.cookie('refreshToken',t,{httpOnly:true,secure:process.env.COOKIE_SECURE==='true',sameSite:'lax',maxAge:604800000});
const finish=async(user,res,status=200)=>{const t=await tokens(user);cookie(res,t.refreshToken);res.status(status).json({success:true,user:await profile(user),accessToken:t.accessToken});};
const wrap=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){next(e);}};
const company=async code=>raw.company.findUnique({where:{short_code:String(code||'').trim().toUpperCase()}});
const signup=wrap(async(req,res)=>{
 const b=req.body;
 if(!/^[A-Za-z0-9_]{6,12}$/.test(b.login_id||''))fail('Login Id must be 6–12 letters, digits or underscores');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email||''))fail('Enter a valid Email Id');
 if(!strong(b.password)||b.password!==b.confirm_password)fail('Passwords must match and contain uppercase, lowercase and a special character, with at least 8 characters');
 const password_hash=await bcrypt.hash(b.password,10);
 let user;
 await raw.$transaction(async tx=>{
  let tenant,role;
  if(b.invite_code){
   const invite=await tx.invite.findUnique({where:{code_hash:hash(String(b.invite_code))}});
   if(!invite||invite.used||invite.expires_at<new Date()||invite.email&&invite.email!==b.email.trim().toLowerCase())fail('Invalid or expired invitation');
   const consumed=await tx.invite.updateMany({where:{id:invite.id,used:false},data:{used:true}});if(!consumed.count)fail('Invalid or expired invitation');
   const {code_hash:secret,...safe}=invite;
   await tx.auditLog.create({data:{tenant_id:invite.tenant_id,action:'invite.update',entity_type:'invite',entity_id:String(invite.id),before:JSON.parse(JSON.stringify(safe)),after:JSON.parse(JSON.stringify({...safe,used:true})),ip_address:req.ip}});
   tenant=await tx.company.findUnique({where:{id:invite.tenant_id}});role=invite.role;
  }else{
   if(!b.company_name?.trim()||! /^[A-Za-z0-9_-]{2,12}$/.test(b.company_code||''))fail('Company name and a short code (2–12 letters, digits, _ or -) are required');
   tenant=await tx.company.create({data:{name:b.company_name.trim(),short_code:b.company_code.toUpperCase()}});role='manager';
   await tx.auditLog.create({data:{tenant_id:tenant.id,action:'company.create',entity_type:'company',entity_id:String(tenant.id),after:tenant,ip_address:req.ip}});
  }
  user=await tx.user.create({data:{tenant_id:tenant.id,name:b.name?.trim()||b.login_id,login_id:b.login_id.toLowerCase(),email:b.email.trim().toLowerCase(),password_hash,role}});
  const {password_hash:secret,...safe}=user;
  await tx.auditLog.create({data:{tenant_id:tenant.id,user_id:user.id,action:b.invite_code?'user.join':'user.create',entity_type:'user',entity_id:String(user.id),after:JSON.parse(JSON.stringify(safe)),ip_address:req.ip}});
  if(!b.invite_code){
   const warehouse=await tx.warehouse.create({data:{tenant_id:tenant.id,name:'Main Warehouse',short_code:tenant.short_code}});
   const location=await tx.location.create({data:{tenant_id:tenant.id,warehouse_id:warehouse.id,name:'Main Stock',short_code:'Stock1'}});
   const category=await tx.category.create({data:{tenant_id:tenant.id,name:'General'}});
   for(const [entity,row]of [['warehouse',warehouse],['location',location],['category',category]])await tx.auditLog.create({data:{tenant_id:tenant.id,user_id:user.id,action:entity+'.create',entity_type:entity,entity_id:String(row.id),after:JSON.parse(JSON.stringify(row)),ip_address:req.ip}});
  }
 });
 await run({tenant_id:user.tenant_id,user_id:user.id,ip_address:req.ip},()=>finish(user,res,201));
});
const login=wrap(async(req,res)=>{
 const t=await company(req.body.company_code);const id=String(req.body.login_id||'').trim().toLowerCase();
 const user=t&&await raw.user.findFirst({where:{tenant_id:t.id,OR:[{login_id:id},{email:id}]}});
 if(!user||typeof req.body.password!=='string'||!await bcrypt.compare(req.body.password,user.password_hash))fail('Invalid company, Login Id or Password',401);
 await run({tenant_id:t.id,user_id:user.id,ip_address:req.ip},()=>finish(user,res));
});
const refresh=wrap(async(req,res)=>{
 let d;try{d=jwt.verify(req.cookies.refreshToken,refreshSecret);}catch{fail('Invalid or expired refresh token',401);}
 const user=await raw.user.findFirst({where:{id:d.userId,tenant_id:d.tenant_id||-1}});
 if(!user||user.token_version!==d.version)fail('Invalid or expired refresh token',401);
 await run({tenant_id:user.tenant_id,user_id:user.id},async()=>{
  const consumed=await prisma.refreshSession.updateMany({where:{id:d.jti,user_id:user.id,revoked:false,expires_at:{gt:new Date()}},data:{revoked:true}});
  if(!consumed.count)fail('Invalid or expired refresh token',401);await finish(user,res);
 });
});
const forgotPassword=wrap(async(req,res)=>{
 const t=await company(req.body.company_code),email=String(req.body.email||'').trim().toLowerCase();
 const generic={success:true,message:'If an account exists, a code has been sent. It expires in 5 minutes.'};
 if(!t)return res.json(generic);
 await run({tenant_id:t.id,ip_address:req.ip},async()=>{
  const user=await prisma.user.findFirst({where:{email}});if(!user)return res.json(generic);
  const key=`ratelimit:otp:${email}`,attempts=Number(await redis.get(key)||0);if(attempts>=3)fail('Too many OTP requests. Please wait 15 minutes before requesting again.',429);
  const otp=String(crypto.randomInt(100000,1000000));await redis.set(key,attempts+1,'EX',900);
  await prisma.$transaction(async tx=>{await tx.otpCode.updateMany({where:{user_id:user.id,used:false},data:{used:true}});await tx.otpCode.create({data:{user_id:user.id,code_hash:hash(otp),expires_at:new Date(Date.now()+300000)}});});
  await require('../config/mailer').sendOtpEmail(email,otp);
  res.json({...generic,...(process.env.NODE_ENV==='development'&&{devOtpPreview:otp})});
 });
});
const resetPassword=wrap(async(req,res)=>{
 const b=req.body;if(!strong(b.newPassword)||b.newPassword!==b.confirm_password)fail('Passwords must match and contain uppercase, lowercase and a special character, with at least 8 characters');
 const t=await company(b.company_code);if(!t)fail('Invalid or expired OTP code');
 await run({tenant_id:t.id,ip_address:req.ip},async()=>{
  const user=await prisma.user.findFirst({where:{email:String(b.email||'').trim().toLowerCase()}});if(!user)fail('Invalid or expired OTP code');
  await prisma.$transaction(async tx=>{
   const match=await tx.otpCode.updateMany({where:{user_id:user.id,code_hash:hash(String(b.otp||'')),used:false,expires_at:{gt:new Date()}},data:{used:true}});if(!match.count)fail('Invalid or expired OTP code');
   await tx.user.update({where:{id:user.id},data:{password_hash:await bcrypt.hash(b.newPassword,10),token_version:{increment:1}}});
   await tx.refreshSession.updateMany({where:{user_id:user.id},data:{revoked:true}});
  });res.json({success:true,message:'Password reset. Sign in with your new password.'});
 });
});
const logout=wrap(async(req,res)=>{
 try{const d=jwt.verify(req.cookies.refreshToken,refreshSecret);await run({tenant_id:d.tenant_id},()=>prisma.refreshSession.updateMany({where:{id:d.jti,user_id:d.userId},data:{revoked:true}}));}catch{}
 res.clearCookie('refreshToken',{httpOnly:true,secure:process.env.COOKIE_SECURE==='true',sameSite:'lax'});res.json({success:true});
});
const getMe=(req,res)=>res.json({success:true,user:req.user});
module.exports={signup,login,refresh,forgotPassword,resetPassword,logout,getMe,profile,strong,fail};
