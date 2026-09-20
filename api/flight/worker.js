import {redis,decrypt,json,workerSecret} from "./_common.js";
function authorised(req){const got=String(req.headers["x-bridge-secret"]||"");return got&&got===workerSecret();}
export default async function handler(req,res){
  if(!authorised(req)) return json(res,401,{error:"Invalid bridge secret"});
  try{
    if(req.method==="GET"){
      const id=await redis("LPOP","avimiles:flight:queue");
      if(!id) return json(res,200,{job:null});
      const enc=await redis("GET",`avimiles:job:${id}`);
      if(!enc) return json(res,200,{job:null});
      const job=decrypt(enc);
      const raw=await redis("GET",`avimiles:meta:${id}`);
      if(raw){const m=JSON.parse(raw);m.status="processing";await redis("SET",`avimiles:meta:${id}`,JSON.stringify(m),"EX","300");}
      return json(res,200,{job});
    }
    if(req.method==="POST"){
      const b=typeof req.body==="string"?JSON.parse(req.body):req.body||{};
      const id=String(b.request_id||"");
      const raw=await redis("GET",`avimiles:meta:${id}`);
      if(!raw) return json(res,404,{error:"Request expired"});
      const m=JSON.parse(raw);
      m.status="done";m.ok=!!b.ok;m.http_status=Number(b.http_status||500);m.data=b.data??null;
      await redis("SET",`avimiles:meta:${id}`,JSON.stringify(m),"EX","300");
      await redis("DEL",`avimiles:job:${id}`);
      return json(res,200,{ok:true});
    }
    return json(res,405,{error:"Method not allowed"});
  }catch(e){console.error(e);return json(res,500,{error:"Worker bridge failed"});}
}
