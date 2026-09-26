let io=null;
const initSocket=server=>{
 io=new (require('socket.io').Server)(server,{cors:{origin:process.env.FRONTEND_URL||'http://localhost:5173',credentials:true}});
 io.use(async(socket,next)=>{
  try{const d=require('jsonwebtoken').verify(socket.handshake.auth.token,process.env.JWT_SECRET||'stocksense_jwt_access_secret_super_secure_key_123!');
   const u=await require('../config/database').$raw.user.findFirst({where:{id:d.userId,tenant_id:d.tenant_id||-1}});
   if(!u||u.token_version!==d.version)throw new Error('Unauthorized');socket.data={tenant_id:u.tenant_id,user_id:u.id};
   socket.data.expires_at=d.exp*1000;next();
  }catch{next(new Error('Authentication required'));}
 });
 io.on('connection',socket=>{socket.join(`tenant:${socket.data.tenant_id}`);socket.join(`user:${socket.data.user_id}`);const timer=setTimeout(()=>socket.disconnect(true),Math.max(1,socket.data.expires_at-Date.now()));socket.on('disconnect',()=>clearTimeout(timer));});return io;
};
const emitEvent=(event,data)=>{if(io)io.to(`tenant:${require('../config/tenant').current().tenant_id}`).emit(event,data);};
const disconnectUser=id=>io?.in(`user:${id}`).disconnectSockets(true);
module.exports={initSocket,getSocket:()=>io,emitEvent,disconnectUser};
