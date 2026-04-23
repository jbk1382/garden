const { useState, useEffect } = React;

const EMOJIS = ["🥬","🍅","🥒","🌽","🍆","🥕","🫑","🧅","🧄","🍓","🌿","🥦","🫛","🌱","🍠"];
const UNITS = ["개","봉","단","kg","g","줄기","포기"];

const now = new Date();
const DAYS = ["일","월","화","수","목","금","토"];
const DATE_STR = `${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 (${DAYS[now.getDay()]})`;

const DEFAULT_CROPS = [
  { id: 1, name: "상추", emoji: "🥬", imageUrl: "", available: 10, unit: "봉", reserved: 0 },
  { id: 2, name: "토마토", emoji: "🍅", imageUrl: "", available: 20, unit: "개", reserved: 0 },
  { id: 3, name: "오이", emoji: "🥒", imageUrl: "", available: 15, unit: "개", reserved: 0 },
  { id: 4, name: "방울토마토", emoji: "🍅", imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Cherry_Tomatoes.jpg/320px-Cherry_Tomatoes.jpg", available: 30, unit: "개", reserved: 0 },
];

// localStorage 기반 저장 (Vercel 환경)
const storage = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
};

function App() {
  const [tab, setTab] = useState("order");
  const [adminTab, setAdminTab] = useState("crops");
  const [crops, setCrops] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState({});
  const [step, setStep] = useState("browse");
  const [form, setForm] = useState({ name: "", contact: "", memo: "" });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newCrop, setNewCrop] = useState({ name: "", emoji: "🌱", imageUrl: "", available: 5, unit: "개" });

  useEffect(() => {
    const cr = storage.get("tg-crops");
    setCrops(cr || DEFAULT_CROPS);
    const or = storage.get("tg-orders");
    if (or) setOrders(or);
    setLoading(false);
  }, []);

  function saveCrops(c) { setCrops(c); storage.set("tg-crops", c); }
  function saveOrders(o) { setOrders(o); storage.set("tg-orders", o); }

  function avail(crop) { return Math.max(0, crop.available - crop.reserved); }
  function setQty(id, qty) {
    const crop = crops.find(c => c.id === id);
    if (!crop) return;
    setCart(prev => ({ ...prev, [id]: Math.min(avail(crop), Math.max(0, qty)) }));
  }

  const cartItems = crops.filter(c => (cart[c.id] || 0) > 0).map(c => ({ ...c, qty: cart[c.id] }));

  function submitOrder() {
    if (!form.name.trim() || !form.contact.trim() || cartItems.length === 0) return;
    const items = cartItems.map(c => ({ cropId: c.id, name: c.name, emoji: c.emoji, imageUrl: c.imageUrl||"", qty: c.qty, unit: c.unit }));
    const order = { id: Date.now(), ...form, items, date: new Date().toLocaleDateString("ko-KR"), status: "접수" };
    const updatedCrops = crops.map(c => { const it = items.find(i => i.cropId === c.id); return it ? { ...c, reserved: c.reserved + it.qty } : c; });
    saveCrops(updatedCrops); saveOrders([...orders, order]);
    setCart({}); setForm({ name: "", contact: "", memo: "" }); setStep("done");
  }

  function addCrop() {
    if (!newCrop.name.trim()) return;
    const crop = { id: Date.now(), ...newCrop, available: parseInt(newCrop.available) || 0, reserved: 0 };
    saveCrops([...crops, crop]);
    setNewCrop({ name: "", emoji: "🌱", imageUrl: "", available: 5, unit: "개" }); setShowAdd(false);
  }

  function updateAvail(id, delta) { saveCrops(crops.map(c => c.id === id ? { ...c, available: Math.max(c.reserved, c.available + delta) } : c)); }
  function deleteCrop(id) { saveCrops(crops.filter(c => c.id !== id)); }
  function updateStatus(orderId, status) { saveOrders(orders.map(o => o.id === orderId ? { ...o, status } : o)); }
  function deleteOrder(id) {
    const order = orders.find(o => o.id === id);
    if (order) saveCrops(crops.map(c => { const it = order.items.find(i => i.cropId === c.id); return it ? { ...c, reserved: Math.max(0, c.reserved - it.qty) } : c; }));
    saveOrders(orders.filter(o => o.id !== id));
  }

  const totalOrders = orders.length;
  const byStatus = { 접수: 0, 준비중: 0, 완료: 0 };
  orders.forEach(o => { if (byStatus[o.status] !== undefined) byStatus[o.status]++; });
  const cropStats = {};
  orders.forEach(o => o.items.forEach(it => {
    if (!cropStats[it.name]) cropStats[it.name] = { emoji: it.emoji, imageUrl: it.imageUrl||"", total: 0, unit: it.unit };
    cropStats[it.name].total += it.qty;
  }));
  const cropStatsList = Object.entries(cropStats).sort((a, b) => b[1].total - a[1].total);
  const statusStyle = (s) => ({ 접수: { bg:"#fffbeb", color:"#b45309", border:"#fcd34d" }, 준비중: { bg:"#eff6ff", color:"#1d4ed8", border:"#93c5fd" }, 완료: { bg:"#f0fdf4", color:"#15803d", border:"#86efac" } }[s] || {});

  const CropIcon = ({ crop, size = 48 }) => crop.imageUrl
    ? <img src={crop.imageUrl} alt={crop.name} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", border:"2px solid #e5e7eb" }} onError={e => e.target.style.display="none"} />
    : <span style={{ fontSize: size * 0.7 }}>{crop.emoji}</span>;

  if (loading) return <div style={{minHeight:"100vh",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:"1.5rem",color:"#16a34a"}}>🌱 불러오는 중...</span></div>;

  return (
    <div style={{ minHeight:"100vh", background:"#f0fdf4", fontFamily:"'Apple SD Gothic Neo', sans-serif" }}>
      <div style={{ background:"linear-gradient(135deg,#166534,#16a34a)", color:"#fff", padding:"14px 20px", boxShadow:"0 2px 10px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:"1.4rem", fontWeight:700 }}>🌿 다운 텃밭 나눔</div>
            <div style={{ fontSize:"0.78rem", color:"#bbf7d0", marginTop:2 }}>신선한 작물을 신청해보세요</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
            <div style={{ fontSize:"0.78rem", color:"#d1fae5", background:"rgba(255,255,255,0.15)", borderRadius:12, padding:"4px 10px" }}>{DATE_STR}</div>
            <button onClick={() => { setTab(tab==="order"?"admin":"order"); setStep("browse"); }}
              style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:20, padding:"5px 12px", fontSize:"0.78rem", cursor:"pointer" }}>
              {tab==="order" ? "⚙️ 관리자" : "← 주문 화면"}
            </button>
          </div>
        </div>
      </div>

      {tab === "order" ? (
        <div style={{ maxWidth:480, margin:"0 auto", padding:"16px 16px 100px" }}>
          {step === "browse" && <>
            <div style={{ color:"#166534", fontWeight:600, fontSize:"1rem", marginBottom:12, marginTop:8 }}>오늘의 작물 🌾</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {crops.map(crop => {
                const av = avail(crop); const qty = cart[crop.id] || 0;
                return (
                  <div key={crop.id} style={{ background:"#fff", borderRadius:18, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.08)", display:"flex", alignItems:"center", gap:12, opacity:av===0?0.5:1 }}>
                    <div style={{ width:52, height:52, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><CropIcon crop={crop} size={52} /></div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:"1rem", color:"#1f2937" }}>{crop.name}</div>
                      <div style={{ fontSize:"0.78rem", color:av>0?"#16a34a":"#ef4444", marginTop:2 }}>{av>0?`남은 수량: ${av}${crop.unit}`:"마감되었어요"}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <button onClick={() => setQty(crop.id,qty-1)} disabled={qty===0} style={{ width:32,height:32,borderRadius:"50%",border:"none",background:qty===0?"#f3f4f6":"#dcfce7",color:qty===0?"#d1d5db":"#166534",fontSize:"1.2rem",fontWeight:700,cursor:qty===0?"not-allowed":"pointer" }}>−</button>
                      <span style={{ width:28,textAlign:"center",fontWeight:700,fontSize:"1rem",color:"#166534" }}>{qty}</span>
                      <button onClick={() => setQty(crop.id,qty+1)} disabled={qty>=av} style={{ width:32,height:32,borderRadius:"50%",border:"none",background:qty>=av?"#f3f4f6":"#16a34a",color:qty>=av?"#d1d5db":"#fff",fontSize:"1.2rem",fontWeight:700,cursor:qty>=av?"not-allowed":"pointer" }}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {cartItems.length > 0 && (
              <div style={{ position:"fixed", bottom:24, left:0, right:0, display:"flex", justifyContent:"center", zIndex:10 }}>
                <button onClick={() => setStep("form")} style={{ background:"#16a34a",color:"#fff",border:"none",borderRadius:30,padding:"14px 40px",fontSize:"1.05rem",fontWeight:700,boxShadow:"0 4px 20px rgba(22,163,74,0.4)",cursor:"pointer" }}>신청하기 ({cartItems.length}종 선택)</button>
              </div>
            )}
          </>}
          {step === "form" && <>
            <button onClick={() => setStep("browse")} style={{ background:"none",border:"none",color:"#16a34a",cursor:"pointer",marginTop:8,marginBottom:12,fontSize:"0.9rem" }}>← 목록으로</button>
            <div style={{ color:"#166534",fontWeight:600,fontSize:"1rem",marginBottom:12 }}>신청 정보 입력</div>
            <div style={{ background:"#fff",borderRadius:18,padding:16,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize:"0.82rem",fontWeight:600,color:"#6b7280",marginBottom:8 }}>선택한 작물</div>
              {cartItems.map(c => (
                <div key={c.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f3f4f6" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center" }}><CropIcon crop={c} size={28} /></div>
                    <span style={{ fontSize:"0.9rem" }}>{c.name}</span>
                  </div>
                  <span style={{ fontWeight:700,color:"#16a34a",fontSize:"0.9rem" }}>{c.qty}{c.unit}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {[["이름 *","name"],["연락처 *","contact"]].map(([ph,key]) => (
                <input key={key} placeholder={ph} value={form[key]} onChange={e => setForm({...form,[key]:e.target.value})} style={{ border:"1.5px solid #e5e7eb",borderRadius:14,padding:"12px 16px",fontSize:"0.95rem",outline:"none",width:"100%",boxSizing:"border-box" }} />
              ))}
              <textarea placeholder="메모 (선택)" rows={2} value={form.memo} onChange={e => setForm({...form,memo:e.target.value})} style={{ border:"1.5px solid #e5e7eb",borderRadius:14,padding:"12px 16px",fontSize:"0.95rem",outline:"none",resize:"none",width:"100%",boxSizing:"border-box" }} />
              <button onClick={submitOrder} disabled={!form.name.trim()||!form.contact.trim()} style={{ background:form.name.trim()&&form.contact.trim()?"#16a34a":"#d1d5db",color:"#fff",border:"none",borderRadius:14,padding:"14px",fontSize:"1rem",fontWeight:700,cursor:form.name.trim()&&form.contact.trim()?"pointer":"not-allowed" }}>신청 완료</button>
            </div>
          </>}
          {step === "done" && (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",marginTop:80,textAlign:"center" }}>
              <div style={{ fontSize:"4rem",marginBottom:16 }}>🎉</div>
              <div style={{ fontSize:"1.5rem",fontWeight:700,color:"#166534",marginBottom:8 }}>신청 완료!</div>
              <div style={{ color:"#6b7280",marginBottom:32,lineHeight:1.6 }}>연락처로 수령 일정을 안내드릴게요.<br/>감사합니다 😊</div>
              <button onClick={() => setStep("browse")} style={{ background:"#16a34a",color:"#fff",border:"none",borderRadius:30,padding:"12px 36px",fontSize:"1rem",fontWeight:700,cursor:"pointer" }}>처음으로</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth:620, margin:"0 auto", padding:"0 16px 32px" }}>
          <div style={{ display:"flex", gap:0, borderBottom:"2px solid #d1fae5", marginBottom:16, marginTop:12 }}>
            {[["crops","🌱 작물 관리"],["orders","📋 신청 목록"],["stats","📊 누적 통계"]].map(([key,label]) => (
              <button key={key} onClick={() => setAdminTab(key)} style={{ flex:1,padding:"10px 4px",border:"none",background:"transparent",fontWeight:adminTab===key?700:400,color:adminTab===key?"#166534":"#9ca3af",borderBottom:adminTab===key?"3px solid #16a34a":"3px solid transparent",marginBottom:-2,cursor:"pointer",fontSize:"0.88rem" }}>{label}</button>
            ))}
          </div>
          {adminTab === "crops" && <>
            <div style={{ display:"flex",justifyContent:"flex-end",marginBottom:12 }}>
              <button onClick={() => setShowAdd(!showAdd)} style={{ background:"#16a34a",color:"#fff",border:"none",borderRadius:20,padding:"6px 16px",fontSize:"0.85rem",cursor:"pointer" }}>{showAdd?"닫기":"+ 작물 추가"}</button>
            </div>
            {showAdd && (
              <div style={{ background:"#fff",borderRadius:18,padding:16,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
                <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:12 }}>{EMOJIS.map(em => <button key={em} onClick={() => setNewCrop({...newCrop,emoji:em})} style={{ fontSize:"1.5rem",padding:"4px 6px",borderRadius:10,border:newCrop.emoji===em?"2px solid #16a34a":"2px solid transparent",background:newCrop.emoji===em?"#dcfce7":"transparent",cursor:"pointer" }}>{em}</button>)}</div>
                <div style={{ display:"flex",gap:8,marginBottom:8 }}>
                  <input placeholder="작물 이름" value={newCrop.name} onChange={e => setNewCrop({...newCrop,name:e.target.value})} style={{ flex:1,border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 12px",fontSize:"0.9rem",outline:"none" }} />
                  <input type="number" value={newCrop.available} onChange={e => setNewCrop({...newCrop,available:parseInt(e.target.value)||0})} style={{ width:68,border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 8px",fontSize:"0.9rem",outline:"none" }} />
                  <select value={newCrop.unit} onChange={e => setNewCrop({...newCrop,unit:e.target.value})} style={{ border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 8px",fontSize:"0.9rem",outline:"none",background:"#fff" }}>{UNITS.map(u => <option key={u}>{u}</option>)}</select>
                </div>
                <input placeholder="이미지 URL (선택)" value={newCrop.imageUrl} onChange={e => setNewCrop({...newCrop,imageUrl:e.target.value})} style={{ width:"100%",border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 12px",fontSize:"0.85rem",outline:"none",marginBottom:8,boxSizing:"border-box" }} />
                <button onClick={addCrop} disabled={!newCrop.name.trim()} style={{ width:"100%",background:newCrop.name.trim()?"#16a34a":"#d1d5db",color:"#fff",border:"none",borderRadius:12,padding:"10px",fontWeight:700,cursor:newCrop.name.trim()?"pointer":"not-allowed" }}>추가하기</button>
              </div>
            )}
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {crops.map(crop => (
                <div key={crop.id} style={{ background:"#fff",borderRadius:16,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",display:"flex",alignItems:"center",gap:10 }}>
                  <div style={{ width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><CropIcon crop={crop} size={44} /></div>
                  <div style={{ flex:1 }}><div style={{ fontWeight:700,fontSize:"0.95rem" }}>{crop.name}</div><div style={{ fontSize:"0.75rem",color:"#6b7280" }}>예약 {crop.reserved} / 전체 {crop.available}{crop.unit}</div></div>
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <button onClick={() => updateAvail(crop.id,-1)} style={{ width:28,height:28,borderRadius:"50%",border:"none",background:"#f3f4f6",color:"#374151",fontSize:"1rem",fontWeight:700,cursor:"pointer" }}>−</button>
                    <span style={{ width:32,textAlign:"center",fontWeight:700,color:"#166534" }}>{crop.available}</span>
                    <button onClick={() => updateAvail(crop.id,1)} style={{ width:28,height:28,borderRadius:"50%",border:"none",background:"#dcfce7",color:"#166534",fontSize:"1rem",fontWeight:700,cursor:"pointer" }}>+</button>
                  </div>
                  <button onClick={() => deleteCrop(crop.id)} style={{ background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"0.8rem",fontWeight:600 }}>삭제</button>
                </div>
              ))}
            </div>
          </>}
          {adminTab === "orders" && <>
            <div style={{ color:"#166534",fontWeight:600,fontSize:"0.95rem",marginBottom:12 }}>신청 목록 ({orders.length}건)</div>
            {orders.length === 0 ? <div style={{ textAlign:"center",color:"#9ca3af",padding:"40px 0" }}>아직 신청이 없어요</div> : (
              <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                {[...orders].reverse().map(order => { const ss = statusStyle(order.status); return (
                  <div key={order.id} style={{ background:"#fff",borderRadius:18,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                      <div><span style={{ fontWeight:700,fontSize:"0.95rem" }}>{order.name}</span><span style={{ color:"#6b7280",fontSize:"0.82rem",marginLeft:8 }}>{order.contact}</span></div>
                      <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                        <select value={order.status} onChange={e => updateStatus(order.id,e.target.value)} style={{ fontSize:"0.75rem",padding:"3px 8px",borderRadius:20,border:`1.5px solid ${ss.border}`,background:ss.bg,color:ss.color,cursor:"pointer",outline:"none" }}><option>접수</option><option>준비중</option><option>완료</option></select>
                        <button onClick={() => deleteOrder(order.id)} style={{ background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"0.78rem" }}>삭제</button>
                      </div>
                    </div>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:4 }}>
                      {order.items.map((it,i) => <div key={i} style={{ display:"flex",alignItems:"center",gap:4,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:20,padding:"3px 10px" }}>{it.imageUrl?<img src={it.imageUrl} style={{ width:18,height:18,borderRadius:"50%",objectFit:"cover" }} />:<span style={{ fontSize:"0.85rem" }}>{it.emoji}</span>}<span style={{ fontSize:"0.8rem",color:"#166534" }}>{it.name} {it.qty}{it.unit}</span></div>)}
                    </div>
                    {order.memo && <div style={{ fontSize:"0.78rem",color:"#9ca3af",marginTop:4 }}>메모: {order.memo}</div>}
                    <div style={{ fontSize:"0.75rem",color:"#d1d5db",marginTop:4 }}>{order.date}</div>
                  </div>
                );})}
              </div>
            )}
          </>}
          {adminTab === "stats" && <>
            <div style={{ color:"#166534",fontWeight:600,fontSize:"0.95rem",marginBottom:14 }}>누적 통계</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:20 }}>
              {[["전체","📋",totalOrders,"#f0fdf4","#166534"],["접수","🟡",byStatus["접수"],"#fffbeb","#b45309"],["준비중","🔵",byStatus["준비중"],"#eff6ff","#1d4ed8"],["완료","✅",byStatus["완료"],"#f0fdf4","#15803d"]].map(([label,icon,count,bg,color]) => (
                <div key={label} style={{ background:bg,borderRadius:16,padding:"14px 8px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize:"1.2rem" }}>{icon}</div>
                  <div style={{ fontSize:"1.5rem",fontWeight:800,color }}>{count}</div>
                  <div style={{ fontSize:"0.72rem",color:"#6b7280",marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ background:"#fff",borderRadius:18,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.08)",marginBottom:16 }}>
              <div style={{ fontWeight:700,color:"#374151",marginBottom:12,fontSize:"0.9rem" }}>작물별 누적 신청량</div>
              {cropStatsList.length === 0 ? <div style={{ textAlign:"center",color:"#9ca3af",padding:"20px 0",fontSize:"0.85rem" }}>아직 신청 데이터가 없어요</div> : (() => {
                const maxVal = cropStatsList[0][1].total;
                return cropStatsList.map(([name,info]) => (
                  <div key={name} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>{info.imageUrl?<img src={info.imageUrl} style={{ width:24,height:24,borderRadius:"50%",objectFit:"cover" }} />:<span style={{ fontSize:"1.1rem" }}>{info.emoji}</span>}<span style={{ fontSize:"0.88rem",fontWeight:600 }}>{name}</span></div>
                      <span style={{ fontSize:"0.88rem",fontWeight:700,color:"#16a34a" }}>{info.total}{info.unit}</span>
                    </div>
                    <div style={{ background:"#f3f4f6",borderRadius:20,height:8,overflow:"hidden" }}><div style={{ background:"linear-gradient(90deg,#16a34a,#4ade80)",height:"100%",borderRadius:20,width:`${(info.total/maxVal)*100}%` }} /></div>
                  </div>
                ));
              })()}
            </div>
          </>}
        </div>
      )}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
