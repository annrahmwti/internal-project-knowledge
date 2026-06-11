import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "gonsave-internal-2026";
const USER_ID = process.env.NEXT_PUBLIC_USER_ID || "user_001";

const C = { orange:"#cb3c04", dark:"#2c2c2c", teal:"#37b09b", white:"#ffffff", border:"#ede9eb", muted:"#888", hint:"#bbb" };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,5);
const fmtTime = ts => new Date(ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
const fmtDate = ts => new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric"});
const H = { "Content-Type":"application/json", "x-api-key": API_KEY };

const api = {
  async chat(message, history) {
    const r = await fetch("/api/chat", { method:"POST", headers:H, body:JSON.stringify({userId:USER_ID,message,history}) });
    if (!r.ok) throw new Error((await r.json()).error || "API error");
    return r.json();
  },
  async getMemories() {
    const r = await fetch(`/api/memories?userId=${USER_ID}`, { headers:H });
    return (await r.json()).memories || [];
  },
  async deleteMemory(id) { await fetch(`/api/memories?userId=${USER_ID}&memId=${id}`, { method:"DELETE", headers:H }); },
  async editMemory(id, content) { await fetch(`/api/memories?userId=${USER_ID}&memId=${id}`, { method:"PATCH", headers:H, body:JSON.stringify({content}) }); },
  async clearAll() { await fetch(`/api/memories?userId=${USER_ID}`, { method:"DELETE", headers:H }); }
};

const catStyle = {
  preference:{ bg:"#e9f7f4", color:"#0a7a67", border:"1px solid #c0e8e0" },
  personal:  { bg:"#fdf0eb", color:"#8c3200", border:"1px solid #f5c8b5" },
  fact:      { bg:"#f3f0fe", color:"#4a3eaa", border:"1px solid #cbc7f0" },
  goal:      { bg:"#f5f9e8", color:"#3a6010", border:"1px solid #c5da8a" },
};

function Bubble({ msg }) {
  const u = msg.role === "user";
  return (
    <div style={{display:"flex",gap:10,alignItems:"flex-end",flexDirection:u?"row-reverse":"row",marginBottom:14}}>
      <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,background:u?C.teal:C.orange,color:C.white}}>{u?"AY":"G"}</div>
      <div style={{maxWidth:"75%"}}>
        {!u && msg.retrieved?.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",marginBottom:4}}>
            {msg.retrieved.map((m,i)=>(
              <span key={i} style={{fontSize:10,padding:"2px 7px",borderRadius:99,margin:"2px 2px 0 0",background:"#e9f7f4",color:"#0a7a67",border:"1px solid #c0e8e0"}}>
                {m.content.length>32?m.content.slice(0,32)+"…":m.content}
              </span>
            ))}
          </div>
        )}
        <div style={{padding:"10px 14px",borderRadius:u?"14px 14px 4px 14px":"14px 14px 14px 4px",background:u?C.orange:"#f7f4f5",border:`1px solid ${u?"#a83203":C.border}`,color:u?C.white:C.dark,fontSize:13,lineHeight:1.55}}>
          {msg.content.split("\n").map((l,i,a)=><span key={i}>{l}{i<a.length-1&&<br/>}</span>)}
        </div>
        {!u && msg.newMemories?.length > 0 && (
          <div style={{display:"flex",flexWrap:"wrap",marginTop:4}}>
            {msg.newMemories.map((m,i)=>(
              <span key={i} style={{fontSize:10,padding:"2px 7px",borderRadius:99,margin:"2px 2px 0 0",background:"#fdf0eb",color:"#a33000",border:"1px solid #f5c8b5"}}>
                Remembered: {m.content.length>30?m.content.slice(0,30)+"…":m.content}
              </span>
            ))}
          </div>
        )}
        <div style={{fontSize:10,color:C.hint,marginTop:3,textAlign:u?"right":"left"}}>{fmtTime(msg.ts)}</div>
      </div>
    </div>
  );
}

function MemCard({ m, onDelete, onEdit }) {
  const cs = catStyle[m.category] || catStyle.fact;
  return (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 11px",marginBottom:7}}>
      <div style={{fontSize:12,color:C.dark,lineHeight:1.5}}>{m.content}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6}}>
        <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,fontWeight:500,background:cs.bg,color:cs.color,border:cs.border}}>{m.category}</span>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>onEdit(m.id,m.content)} style={{width:22,height:22,borderRadius:6,border:`1px solid ${C.border}`,background:C.white,cursor:"pointer",fontSize:11,color:C.hint}}>✏️</button>
          <button onClick={()=>onDelete(m.id)} style={{width:22,height:22,borderRadius:6,border:`1px solid ${C.border}`,background:C.white,cursor:"pointer",fontSize:11,color:C.hint}}>🗑️</button>
        </div>
      </div>
      <div style={{fontSize:10,color:C.hint,marginTop:3}}>{fmtDate(m.createdAt)}</div>
    </div>
  );
}

export default function Home() {
  const [memories, setMemories] = useState([]);
  const [messages, setMessages] = useState([{id:uid(),role:"assistant",content:"Hello — I'm your Gonsave AI assistant. I remember context across sessions so I can give sharper insights over time.\n\nAsk me about cost reduction, retention strategy, or team performance.",ts:Date.now()}]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMem, setShowMem] = useState(false);
  const [memSearch, setMemSearch] = useState("");
  const [memFilter, setMemFilter] = useState("all");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(()=>{ api.getMemories().then(setMemories).catch(()=>{}); },[]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text||loading) return;
    setInput(""); setError("");
    const userMsg = {id:uid(),role:"user",content:text,ts:Date.now()};
    setMessages(p=>[...p,userMsg]);
    setLoading(true);
    try {
      const history = messages.slice(-12).map(m=>({role:m.role,content:m.content}));
      const {reply,retrieved,newMemories} = await api.chat(text,history);
      if (newMemories?.length) setMemories(p=>[...p,...newMemories]);
      setMessages(p=>[...p,{id:uid(),role:"assistant",content:reply,ts:Date.now(),retrieved,newMemories}]);
    } catch(e) { setError(e.message); }
    setLoading(false);
    inputRef.current?.focus();
  };

  const filtered = memories.filter(m=>(memFilter==="all"||m.category===memFilter)&&(!memSearch||m.content.toLowerCase().includes(memSearch.toLowerCase())));

  return (
    <>
      <Head>
        <title>Gonsave AI Assistant</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.7.0/tabler-icons.min.css"/>
      </Head>
      <div style={{display:"flex",height:"100vh",fontFamily:"'Mulish',sans-serif",background:C.white,overflow:"hidden"}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700&display=swap');*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#ddd;border-radius:99px}@keyframes dp{0%,80%,100%{transform:scale(1);opacity:.5}40%{transform:scale(1.3);opacity:1}}`}</style>

        <div style={{width:210,background:C.dark,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"18px 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:30,height:30,background:C.orange,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:C.white}}>G</div>
              <div style={{fontSize:16,fontWeight:700,color:C.white}}><span style={{color:C.orange}}>Go</span>nsave</div>
            </div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:3,lineHeight:1.4}}>Insights that Improve Costs,<br/>Retention & Performance</div>
          </div>
          <div style={{flex:1,padding:"10px 0"}}>
            {[["message-2","AI assistant",true],["chart-bar","Analytics",false],["users","Retention",false],["coin","Cost insights",false]].map(([icon,label,active])=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",fontSize:12.5,color:active?C.orange:"rgba(255,255,255,0.6)",background:active?"rgba(203,60,4,0.18)":"transparent",borderRight:active?`2px solid ${C.orange}`:"2px solid transparent",cursor:"pointer"}}>
                <i className={`ti ti-${icon}`} aria-hidden="true" style={{fontSize:14}}/>{label}
              </div>
            ))}
            <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:".8px",padding:"12px 16px 4px",fontWeight:600}}>MEMORY</div>
            <div onClick={()=>setShowMem(p=>!p)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",fontSize:12.5,color:showMem?C.orange:"rgba(255,255,255,0.6)",background:showMem?"rgba(203,60,4,0.18)":"transparent",borderRight:showMem?`2px solid ${C.orange}`:"2px solid transparent",cursor:"pointer"}}>
              <i className="ti ti-brain" aria-hidden="true" style={{fontSize:14}}/>Your memories
              {memories.length>0&&<span style={{marginLeft:"auto",background:C.orange,color:C.white,fontSize:9,padding:"1px 6px",borderRadius:99,fontWeight:600}}>{memories.length}</span>}
            </div>
          </div>
          <div style={{padding:"12px 16px",borderTop:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:C.orange,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:C.white}}>AY</div>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontWeight:500}}>Annisa</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>Strategy team</div>
            </div>
          </div>
        </div>

        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
          <div style={{height:50,background:C.white,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",padding:"0 18px",gap:10,flexShrink:0}}>
            <div style={{fontSize:14,fontWeight:600,color:C.dark,flex:1}}><span style={{color:C.orange}}>Go</span>nsave AI — strategy assistant</div>
            <button onClick={()=>setMessages([{id:uid(),role:"assistant",content:"Chat cleared. Memories intact.",ts:Date.now()}])} style={{height:28,padding:"0 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,fontSize:11,cursor:"pointer",color:C.muted,fontFamily:"inherit"}}>New chat</button>
            <button onClick={()=>setShowMem(p=>!p)} style={{height:28,padding:"0 10px",borderRadius:8,border:`1px solid ${showMem?C.orange:C.border}`,background:showMem?C.orange:C.white,fontSize:11,cursor:"pointer",color:showMem?C.white:C.muted,fontFamily:"inherit"}}>
              Memories {memories.length>0&&memories.length}
            </button>
          </div>
          <div style={{background:"#fdf8f7",borderBottom:`1px solid ${C.border}`,padding:"5px 18px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",minHeight:34}}>
            <span style={{fontSize:10,color:"#999",fontWeight:600}}>Active context:</span>
            {memories.length===0
              ?<span style={{fontSize:11,color:C.hint,fontStyle:"italic"}}>No memories yet — start chatting</span>
              :memories.slice(-4).map(m=>(
                <span key={m.id} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:99,background:C.white,border:`1px solid ${C.border}`,fontSize:11,color:"#555"}}>
                  {m.content.length>24?m.content.slice(0,24)+"…":m.content}
                  <span onClick={()=>{api.deleteMemory(m.id);setMemories(p=>p.filter(x=>x.id!==m.id));}} style={{fontSize:11,color:C.hint,cursor:"pointer"}}>×</span>
                </span>
              ))
            }
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"18px 18px 10px"}}>
            {messages.length===1&&(
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
                {["My team has high churn — where do I start?","We overspent on vendors last quarter","I prefer concise data-driven responses"].map(h=>(
                  <button key={h} onClick={()=>{setInput(h);inputRef.current?.focus();}} style={{fontSize:11,padding:"5px 10px",borderRadius:99,border:`1px solid ${C.border}`,background:C.white,cursor:"pointer",color:C.muted,fontFamily:"inherit"}}>{h}</button>
                ))}
              </div>
            )}
            {messages.map(m=><Bubble key={m.id} msg={m}/>)}
            {loading&&(
              <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:C.orange,color:C.white,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600}}>G</div>
                <div style={{padding:"12px 14px",borderRadius:"14px 14px 14px 4px",background:"#f7f4f5",border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex",gap:4}}>
                    {[0,.2,.4].map((d,i)=><span key={i} style={{width:5,height:5,borderRadius:"50%",background:C.hint,display:"inline-block",animation:`dp 1.2s ${d}s infinite`}}/>)}
                  </div>
                </div>
              </div>
            )}
            {error&&<div style={{fontSize:12,color:"#a33000",background:"#fdf0eb",border:"1px solid #f5c8b5",borderRadius:8,padding:"8px 12px",marginTop:8}}>{error}</div>}
            <div ref={bottomRef}/>
          </div>
          <div style={{padding:"10px 14px",background:C.white,borderTop:`1px solid ${C.border}`,display:"flex",gap:8,flexShrink:0}}>
            <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Ask about costs, retention, or strategy…" disabled={loading} style={{flex:1,height:36,border:`1px solid ${C.border}`,borderRadius:10,padding:"0 12px",fontSize:13,fontFamily:"inherit",outline:"none",color:C.dark}}/>
            <button onClick={sendMessage} disabled={loading||!input.trim()} style={{width:36,height:36,borderRadius:10,background:loading||!input.trim()?"#e0dce0":C.orange,border:"none",cursor:loading||!input.trim()?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className="ti ti-send" aria-hidden="true" style={{fontSize:15,color:C.white}}/>
            </button>
          </div>
        </div>

        {showMem&&(
          <div style={{width:250,borderLeft:`1px solid ${C.border}`,background:"#fdfcfc",display:"flex",flexDirection:"column",flexShrink:0}}>
            <div style={{padding:"13px 14px 9px",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:13,fontWeight:600,color:C.dark}}>Your memories</div>
              <div style={{fontSize:11,color:"#999",marginTop:1}}>{memories.length} facts stored</div>
            </div>
            <div style={{padding:"7px 12px",borderBottom:`1px solid ${C.border}`}}>
              <input value={memSearch} onChange={e=>setMemSearch(e.target.value)} placeholder="Search…" style={{width:"100%",height:28,border:`1px solid ${C.border}`,borderRadius:8,padding:"0 10px",fontSize:12,fontFamily:"inherit",outline:"none",color:C.dark}}/>
            </div>
            <div style={{padding:"5px 12px 7px",display:"flex",gap:4,flexWrap:"wrap",borderBottom:`1px solid ${C.border}`}}>
              {["all","preference","personal","fact","goal"].map(f=>(
                <button key={f} onClick={()=>setMemFilter(f)} style={{fontSize:10,padding:"2px 7px",borderRadius:99,cursor:"pointer",fontFamily:"inherit",background:memFilter===f?C.teal:C.white,border:`1px solid ${memFilter===f?C.teal:C.border}`,color:memFilter===f?C.white:"#666"}}>{f}</button>
              ))}
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"7px 12px"}}>
              {filtered.length===0
                ?<div style={{textAlign:"center",color:C.hint,fontSize:12,marginTop:20}}>{memories.length===0?"No memories yet":"No matches"}</div>
                :filtered.map(m=><MemCard key={m.id} m={m}
                    onDelete={id=>{api.deleteMemory(id);setMemories(p=>p.filter(x=>x.id!==id));}}
                    onEdit={(id,old)=>{const v=window.prompt("Edit:",old);if(v?.trim()){api.editMemory(id,v.trim());setMemories(p=>p.map(x=>x.id===id?{...x,content:v.trim()}:x));}}}
                  />)
              }
            </div>
            {memories.length>0&&(
              <div style={{padding:"9px 12px",borderTop:`1px solid ${C.border}`}}>
                <button onClick={()=>{if(window.confirm("Delete all?"))api.clearAll().then(()=>setMemories([]));}} style={{width:"100%",height:28,borderRadius:8,border:"1px solid #f5c8b5",background:C.white,fontSize:11,cursor:"pointer",color:C.orange,fontFamily:"inherit"}}>
                  Clear all memories
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
