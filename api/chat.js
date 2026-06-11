const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const memoryStore = {};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function getMems(userId) { return memoryStore[userId] || []; }
function addMems(userId, newMems) {
  const existing = getMems(userId);
  const deduped = newMems.filter(nm => {
    const nw = nm.content.toLowerCase().split(/\s+/);
    return !existing.some(em => {
      const ew = em.content.toLowerCase().split(/\s+/);
      return nw.filter(w=>ew.includes(w)).length / Math.max(nw.length,ew.length) > 0.72;
    });
  });
  memoryStore[userId] = [...existing, ...deduped];
  return deduped;
}
function retrieve(memories, query) {
  const stop = new Set(["i","a","the","is","to","of","in","on","for","my","you","it","do","be","not"]);
  const clean = s => s.toLowerCase().replace(/[^a-z0-9 ]/g,"").split(/\s+/).filter(w=>w.length>2&&!stop.has(w));
  const qw = clean(query);
  return memories.map(m=>{
    const mw = new Set(clean(m.content));
    return {...m, _s: qw.filter(w=>mw.has(w)).length/Math.max(mw.size,qw.length||1)};
  }).sort((a,b)=>b._s-a._s).filter(m=>m._s>0).slice(0,5);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,x-api-key");
  if (req.method==="OPTIONS") return res.status(200).end();
  if (req.method!=="POST") return res.status(405).end();
  if (req.headers["x-api-key"]!==process.env.API_SECRET) return res.status(401).json({error:"Unauthorized"});

  const { userId, message, history=[] } = req.body;
  if (!userId||!message) return res.status(400).json({error:"missing fields"});

  const memories = getMems(userId);
  const retrieved = retrieve(memories, message);

  const system = `You are the Gonsave AI assistant — professional advisor on cost insights, employee retention, and business performance. Be concise and direct.

EVERYTHING YOU KNOW ABOUT THIS USER:
${memories.length ? memories.map(m=>`[${m.category}] ${m.content}`).join("\n") : "(nothing yet)"}

MOST RELEVANT FOR THIS MESSAGE:
${retrieved.length ? retrieved.map(m=>`- ${m.content}`).join("\n") : "(none)"}

After your reply, if user shared something worth remembering, add on a new line:
SAVE_MEM:{"items":[{"content":"fact","category":"preference|personal|fact|goal"}]}
Omit entirely if nothing new to save. Be direct and helpful.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", max_tokens: 1000,
      messages: [
        { role:"system", content:system },
        ...history.slice(-12),
        { role:"user", content:message }
      ]
    });

    const full = completion.choices[0].message.content || "";
    const i = full.indexOf("SAVE_MEM:");
    const reply = i!==-1 ? full.slice(0,i).trim() : full.trim();
    let newMems = [];
    if (i!==-1) {
      try {
        const parsed = JSON.parse(full.slice(i+9).trim());
        newMems = addMems(userId, (parsed.items||[]).map(nm=>({
          id:uid(), content:nm.content, category:nm.category||"fact",
          createdAt:Date.now(), updatedAt:Date.now()
        })));
      } catch(e) {}
    }
    res.json({ reply, retrieved:retrieved.map(({_s,...m})=>m), newMemories:newMems });
  } catch(err) {
    res.status(500).json({ error:err.message });
  }
}
