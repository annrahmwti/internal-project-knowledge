const memoryStore = {};
function getMems(userId) { return memoryStore[userId] || []; }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,DELETE,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,x-api-key");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.headers["x-api-key"]!==process.env.API_SECRET) return res.status(401).json({error:"Unauthorized"});

  const { userId, memId } = req.query;
  if (req.method==="GET") return res.json({ memories: getMems(userId) });
  if (req.method==="DELETE" && memId) { memoryStore[userId]=(getMems(userId)).filter(m=>m.id!==memId); return res.json({ok:true}); }
  if (req.method==="DELETE") { memoryStore[userId]=[]; return res.json({ok:true}); }
  if (req.method==="PATCH") { memoryStore[userId]=(getMems(userId)).map(m=>m.id===memId?{...m,content:req.body.content,updatedAt:Date.now()}:m); return res.json({ok:true}); }
  res.status(405).end();
}
