const jwt=require('jsonwebtoken'),prisma=require('../config/database'),{run}=require('../config/tenant');
const authenticate=async(req,res,next)=>{
 try{
  const d=jwt.verify(req.headers.authorization?.split(' ')[1],process.env.JWT_SECRET||'stocksense_jwt_access_secret_super_secure_key_123!');
  if(require('../config/authProvider').clerkEnabled()&&d.provider!=='clerk')throw new Error('Email verification required');
  if(!Number.isInteger(d.tenant_id))throw new Error('Company required');
  const user=await prisma.$raw.user.findFirst({where:{id:d.userId,tenant_id:d.tenant_id}});
  if(!user||user.token_version!==d.version)throw new Error('Invalid session');
  req.user=await require('../controllers/authController').profile(user);req.tenant_id=user.tenant_id;
  run({tenant_id:user.tenant_id,user_id:user.id,ip_address:req.ip},next);
 }catch(e){res.status(401).json({success:false,message:'Authentication required',code:e.name==='TokenExpiredError'?'TOKEN_EXPIRED':'UNAUTHORIZED'});}
};
module.exports={authenticate};
