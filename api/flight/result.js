import {redis,json} from "./_common.js";
export default async function handler(req,res){
  if(req.method!=="GET") return json(res,405,{error:"Method not allowed"});
  try{
    const id=String(req.query.id||""), token=String(req.headers["x-result-token"]||"");
    if(!id||!token) return json(res,400,{error:"Missing request credentials"});
    const raw=await redis("GET",`avimiles:meta:${id}`);
    if(!raw) return json(res,404,{error:"Request expired or not found"});
    const meta=JSON.parse(raw);
    if(meta.token!==token) return json(res,403,{error:"Invalid result token"});
    if(meta.status!=="done") return json(res,200,{status:meta.status});
    return json(res,200,{status:"done",ok:meta.ok,http_status:meta.http_status,data:meta.data});
  }catch(e){console.error(e);return json(res,500,{error:"Bridge result failed"});}
}
