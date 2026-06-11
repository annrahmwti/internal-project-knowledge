const { Redis } = require("@upstash/redis");
const redis = Redis.fromEnv();

async function getMems(userId) {
  try { return (await redis.get(`mems:${userId}`)) || []; }
  catch(e) { return []; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,DELETE,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,x-api-key");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.headers["x-api-key"]!==process.env.API_SECRET) return res.status(401).json({error:"Unauthorized"});

  const { userId, memId } = req.query;
  if (req.method==="GET") return res.json({ memories: await getMems(userId) });
  if (req.method==="DELETE" && memId) {
    const mems = (await getMems(userId)).filter(m=>m.id!==memId);
    await redis.set(`mems:${userId}`, mems);
    return res.json({ok:true});
  }
  if (req.method==="DELETE") {
    await redis.set(`mems:${userId}`, []);
    return res.json({ok:true});
  }
  if (req.method==="PATCH") {
    const mems = (await getMems(userId)).map(m=>m.id===memId?{...m,content:req.body.content,updatedAt:Date.now()}:m);
    await redis.set(`mems:${userId}`, mems);
    return res.json({ok:true});
  }
  res.status(405).end();
}
