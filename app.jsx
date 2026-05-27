// ✅ Firestore 실시간 연동 버전
const { useState, useEffect, useRef } = React;

// ══════════════════════════════════════════
// 🔥 Firebase 설정 — 본인 값으로 교체하세요
// ══════════════════════════════════════════
const firebaseConfig = {
  apiKey:            "AIzaSyA1biDAx3uRu56rhmpjMBPPU03FhO5Kl4M",
  authDomain:        "daun-garden.firebaseapp.com",
  projectId:         "daun-garden",
  storageBucket:     "daun-garden.firebasestorage.app",
  messagingSenderId: "394498485480",
  appId:             "1:394498485480:web:544d26a0ddb55f993e6d5d"
};
firebase.initializeApp(firebaseConfig);
const db      = firebase.firestore();
const DATA_REF = db.collection("daun-garden").doc("main"); // Firestore 저장 위치

// ══════════════════════════════════════════
// 상수 및 유틸
// ══════════════════════════════════════════
const EMOJIS  = ["🥬","🍅","🥒","🌽","🍆","🥕","🫑","🧅","🧄","🍓","🌿","🥦","🫛","🌱","🍠"];
const UNITS   = ["개","봉","단","kg","g","줄기","포기"];
const DAYS_KR = ["일","월","화","수","목","금","토"];

const KR_HOLIDAYS = new Set([
  "2026-01-01","2026-01-28","2026-01-29","2026-01-30",
  "2026-03-01","2026-03-02","2026-05-05","2026-05-24","2026-05-25",
  "2026-06-06","2026-08-15","2026-08-17",
  "2026-09-24","2026-09-25","2026-09-26",
  "2026-10-03","2026-10-05","2026-10-09","2026-12-25",
  "2027-01-01","2027-02-17","2027-02-18","2027-02-19",
  "2027-03-01","2027-05-05","2027-05-13","2027-06-06","2027-08-15",
  "2027-10-03","2027-10-09","2027-10-14","2027-10-15","2027-10-16","2027-12-25",
]);

function toKey(d){ return d.toISOString().slice(0,10); }
function isBusinessDay(d){ const w=d.getDay(); return w!==0&&w!==6&&!KR_HOLIDAYS.has(toKey(d)); }
function getAvailDates(){
  const res=[]; const base=new Date(); base.setHours(0,0,0,0);
  for(let i=0;i<=3;i++){const d=new Date(base);d.setDate(base.getDate()+i);if(isBusinessDay(d))res.push(d);}
  return res;
}
function fmtFull(d){ return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${DAYS_KR[d.getDay()]})`; }

const AVAIL_DATES  = getAvailDates();
const TODAY_STR    = fmtFull(new Date());

const DEFAULT_CROPS = [
  {id:1,name:"상추",     emoji:"🥬",imageUrl:"",available:10,unit:"봉",reserved:0},
  {id:2,name:"토마토",   emoji:"🍅",imageUrl:"",available:20,unit:"개",reserved:0},
  {id:3,name:"오이",     emoji:"🥒",imageUrl:"",available:15,unit:"개",reserved:0},
  {id:4,name:"방울토마토",emoji:"🍅",
    imageUrl:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Cherry_Tomatoes.jpg/320px-Cherry_Tomatoes.jpg",
    available:30,unit:"개",reserved:0},
];
const EMPTY_CROP = {name:"",iconMode:"emoji",emoji:"🌱",imageUrl:"",available:5,unit:"개"};

// localStorage — 기기별 설정값 (알림토큰, 학교이미지)
function lsGet(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null; }catch{ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} }

// ══════════════════════════════════════════
// 알림 전송 함수
// ══════════════════════════════════════════
async function sendTG(token,chatId,order){
  const lines=order.items.map(it=>`  • ${it.emoji} ${it.name} ${it.qty}${it.unit}`).join("\n");
  const text=`🌿 다운 텃밭 나눔 — 새 신청!\n\n👤 신청자: ${order.name}\n📅 수령일: ${order.date}\n🛒 신청 작물:\n${lines}${order.memo?`\n📝 메모: ${order.memo}`:""}`;
  try{
    const r=await fetch(`https://api.telegram.org/bot${token.trim()}/sendMessage`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({chat_id:chatId.trim(),text}),
    });
    const d=await r.json().catch(()=>({}));
    return d.ok?{ok:true}:{ok:false,error:d.description||`HTTP ${r.status}`};
  }catch(e){ return {ok:false,error:e?.message||"네트워크 오류"}; }
}
async function sendKakao(token,order){
  const items=order.items.map(it=>`${it.emoji} ${it.name} ${it.qty}${it.unit}`).join(", ");
  const text=`🌿 다운 텃밭 나눔 — 새 신청!\n\n👤 ${order.name}\n📅 ${order.date}\n🛒 ${items}${order.memo?`\n📝 ${order.memo}`:""}`;
  const tmpl=JSON.stringify({object_type:"text",text,link:{}});
  try{
    const r=await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send",{
      method:"POST",
      headers:{"Authorization":`Bearer ${token.trim()}`,"Content-Type":"application/x-www-form-urlencoded"},
      body:`template_object=${encodeURIComponent(tmpl)}`,
    });
    const d=await r.json().catch(()=>({}));
    return r.ok?{ok:true}:{ok:false,error:d.msg||`HTTP ${r.status}`};
  }catch(e){ return {ok:false,error:e?.message||"오류"}; }
}
async function sendNtfy(topic,order){
  if(!topic.trim()) return {ok:false,error:"채널명을 입력해주세요"};
  const lines=order.items.map(it=>`${it.emoji} ${it.name} ${it.qty}${it.unit}`).join(" | ");
  const body=`👤 ${order.name} | 📅 ${order.date}\n🛒 ${lines}${order.memo?`\n📝 ${order.memo}`:""}`;
  try{
    const r=await fetch(`https://ntfy.sh/${topic.trim()}`,{
      method:"POST",
      headers:{"Title":"🌿 다운 텃밭 나눔 — 새 신청!","Priority":"high","Tags":"seedling"},
      body,
    });
    return r.ok?{ok:true}:{ok:false,error:`HTTP ${r.status}`};
  }catch(e){ return {ok:false,error:e?.message||"오류"}; }
}

// ══════════════════════════════════════════
// 컴포넌트
// ══════════════════════════════════════════
function CropIcon({crop,size=48}){
  const [failed,setFailed]=useState(false);
  if(crop.imageUrl&&!failed)
    return React.createElement("img",{src:crop.imageUrl,alt:crop.name,
      style:{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:"2px solid #e5e7eb"},
      onError:()=>setFailed(true)});
  return React.createElement("span",{style:{fontSize:size*0.68,lineHeight:1}},crop.emoji||"🌱");
}

function NBadge({status,label}){
  if(!status||status==="off") return null;
  const c={sending:{bg:"#eff6ff",bd:"#93c5fd",cl:"#1d4ed8",tx:`⏳ ${label} 전송 중...`},ok:{bg:"#f0fdf4",bd:"#86efac",cl:"#15803d",tx:`✅ ${label} 전송 완료`},fail:{bg:"#fef2f2",bd:"#fca5a5",cl:"#b91c1c",tx:`⚠️ ${label} 전송 실패`}}[status];
  if(!c) return null;
  return React.createElement("div",{style:{background:c.bg,border:`1px solid ${c.bd}`,borderRadius:12,padding:"7px 14px",fontSize:"0.8rem",color:c.cl,marginBottom:6}},c.tx);
}

function SchoolFooter({imgData}){
  if(!imgData) return null;
  return React.createElement("div",{style:{width:"100%",marginTop:32,overflow:"hidden",borderRadius:"18px 18px 0 0",position:"relative"}},
    React.createElement("img",{src:imgData,alt:"학교",style:{width:"100%",maxHeight:160,objectFit:"cover",objectPosition:"center 40%",display:"block"}}),
    React.createElement("div",{style:{position:"absolute",bottom:0,left:0,right:0,height:60,background:"linear-gradient(transparent,rgba(22,101,52,0.7))",display:"flex",alignItems:"flex-end",padding:"12px 16px"}},
      React.createElement("span",{style:{color:"#fff",fontSize:"0.82rem",fontWeight:600}},"🌿 다운 텃밭 나눔"))
  );
}

// ══════════════════════════════════════════
// 메인 앱
// ══════════════════════════════════════════
function App(){
  const [tab,setTab]=useState("order");
  const [adminTab,setAdminTab]=useState("crops");
  const [crops,setCrops]=useState([]);
  const [orders,setOrders]=useState([]);
  const [cart,setCart]=useState({});
  const [step,setStep]=useState("browse");
  const [form,setForm]=useState({name:"",memo:"",date:AVAIL_DATES.length>0?fmtFull(AVAIL_DATES[0]):""});
  const [loading,setLoading]=useState(true);
  const [showAdd,setShowAdd]=useState(false);
  const [newCrop,setNewCrop]=useState(EMPTY_CROP);
  const [tgToken,setTgToken]=useState(()=>lsGet("tg-token")||"");
  const [tgChatId,setTgChatId]=useState(()=>lsGet("tg-chatid")||"");
  const [kkToken,setKkToken]=useState(()=>lsGet("kk-token")||"");
  const [ntfyTopic,setNtfyTopic]=useState(()=>lsGet("ntfy-topic")||"");
  const [schoolImg,setSchoolImg]=useState(()=>lsGet("school-img")||"");
  const [nStatus,setNStatus]=useState({tg:"",kakao:"",ntfy:""});
  const [tTest,setTTest]=useState({tg:"",kakao:"",ntfy:""});
  const [tErr,setTErr]=useState({tg:"",kakao:"",ntfy:""});
  const [saveOk,setSaveOk]=useState(false);
  const [fsStatus,setFsStatus]=useState(""); // Firestore 연결 상태
  const fileRef=useRef();

  // ✅ Firestore 실시간 리스너 — 모든 기기에서 자동 동기화
  useEffect(()=>{
    const unsub = DATA_REF.onSnapshot(doc=>{
      if(doc.exists){
        const d=doc.data();
        setCrops(d.crops||DEFAULT_CROPS);
        setOrders(d.orders||[]);
        setFsStatus("connected");
      } else {
        // 첫 실행: 기본값으로 문서 생성
        DATA_REF.set({crops:DEFAULT_CROPS,orders:[]});
        setFsStatus("connected");
      }
      setLoading(false);
    }, err=>{
      console.error("Firestore 오류:", err);
      setFsStatus("error");
      setCrops(DEFAULT_CROPS);
      setLoading(false);
    });
    return ()=>unsub(); // 컴포넌트 종료 시 리스너 해제
  },[]);

  // ✅ Firestore 저장 함수
  function saveCrops(c){
    setCrops(c);
    DATA_REF.update({crops:c}).catch(console.error);
  }
  function saveOrders(o){
    setOrders(o);
    DATA_REF.update({orders:o}).catch(console.error);
  }

  function saveSettings(){
    lsSet("tg-token",tgToken.trim());
    lsSet("tg-chatid",tgChatId.trim());
    lsSet("kk-token",kkToken.trim());
    lsSet("ntfy-topic",ntfyTopic.trim());
    setSaveOk(true); setTimeout(()=>setSaveOk(false),2500);
  }

  function handleSchoolImg(e){
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{const data=ev.target.result;setSchoolImg(data);lsSet("school-img",data);};
    reader.readAsDataURL(file);
  }
  function removeSchoolImg(){setSchoolImg("");lsSet("school-img","");}

  const avail=c=>Math.max(0,c.available-c.reserved);
  const setQty=(id,qty)=>{
    const crop=crops.find(c=>c.id===id);if(!crop)return;
    setCart(p=>({...p,[id]:Math.min(avail(crop),Math.max(0,qty))}));
  };
  const cartItems=crops.filter(c=>(cart[c.id]||0)>0).map(c=>({...c,qty:cart[c.id]}));

  function changeIconMode(mode){
    if(mode==="emoji")setNewCrop(p=>({...p,iconMode:"emoji",imageUrl:""}));
    else setNewCrop(p=>({...p,iconMode:"image",emoji:"🌱"}));
  }

  async function submitOrder(){
    if(!form.name.trim()||!form.date||cartItems.length===0)return;
    const items=cartItems.map(c=>({cropId:c.id,name:c.name,emoji:c.emoji,imageUrl:c.imageUrl||"",qty:c.qty,unit:c.unit}));
    const order={id:Date.now(),name:form.name.trim(),memo:form.memo,date:form.date,status:"접수",items};
    saveCrops(crops.map(c=>{const it=items.find(i=>i.cropId===c.id);return it?{...c,reserved:c.reserved+it.qty}:c;}));
    saveOrders([...orders,order]);
    setCart({});setForm({name:"",memo:"",date:AVAIL_DATES.length>0?fmtFull(AVAIL_DATES[0]):""});
    setStep("done");
    const ns={tg:"off",kakao:"off",ntfy:"off"};
    if(tgToken&&tgChatId)ns.tg="sending";
    if(kkToken)ns.kakao="sending";
    if(ntfyTopic)ns.ntfy="sending";
    setNStatus({...ns});
    if(tgToken&&tgChatId)sendTG(tgToken,tgChatId,order).then(r=>setNStatus(p=>({...p,tg:r.ok?"ok":"fail"})));
    if(kkToken)sendKakao(kkToken,order).then(r=>setNStatus(p=>({...p,kakao:r.ok?"ok":"fail"})));
    if(ntfyTopic)sendNtfy(ntfyTopic,order).then(r=>setNStatus(p=>({...p,ntfy:r.ok?"ok":"fail"})));
  }

  function addCrop(){
    if(!newCrop.name.trim())return;
    saveCrops([...crops,{id:Date.now(),name:newCrop.name,
      emoji:newCrop.iconMode==="emoji"?newCrop.emoji:"🌱",
      imageUrl:newCrop.iconMode==="image"?newCrop.imageUrl:"",
      available:parseInt(newCrop.available)||0,unit:newCrop.unit,reserved:0}]);
    setNewCrop(EMPTY_CROP);setShowAdd(false);
  }
  function moveCrop(idx,dir){
    const next=[...crops];const swap=idx+dir;
    if(swap<0||swap>=next.length)return;
    [next[idx],next[swap]]=[next[swap],next[idx]];
    saveCrops(next);
  }
  function updateAvail(id,d){saveCrops(crops.map(c=>c.id===id?{...c,available:Math.max(c.reserved,c.available+d)}:c));}
  function deleteCrop(id){saveCrops(crops.filter(c=>c.id!==id));}
  function updateStatus(oid,s){saveOrders(orders.map(o=>o.id===oid?{...o,status:s}:o));}
  function deleteOrder(id){
    const o=orders.find(x=>x.id===id);
    if(o)saveCrops(crops.map(c=>{const it=o.items.find(i=>i.cropId===c.id);return it?{...c,reserved:Math.max(0,c.reserved-it.qty)}:c;}));
    saveOrders(orders.filter(x=>x.id!==id));
  }

  const TEST_ORDER={name:"홍길동",date:TODAY_STR,items:[{emoji:"🥬",name:"상추",qty:2,unit:"봉"},{emoji:"🍅",name:"방울토마토",qty:5,unit:"개"}],memo:"테스트"};
  async function testNotify(type){
    setTTest(p=>({...p,[type]:"sending"}));setTErr(p=>({...p,[type]:""}));
    let r;
    if(type==="tg")r=await sendTG(tgToken,tgChatId,TEST_ORDER);
    if(type==="kakao")r=await sendKakao(kkToken,TEST_ORDER);
    if(type==="ntfy")r=await sendNtfy(ntfyTopic,TEST_ORDER);
    setTTest(p=>({...p,[type]:r.ok?"ok":"fail"}));
    if(!r.ok)setTErr(p=>({...p,[type]:r.error||"오류"}));
  }

  const totalOrders=orders.length;
  const byStatus={접수:0,준비중:0,완료:0};
  orders.forEach(o=>{if(byStatus[o.status]!==undefined)byStatus[o.status]++;});
  const cropStatsMap={};
  orders.forEach(o=>o.items.forEach(it=>{
    if(!cropStatsMap[it.name])cropStatsMap[it.name]={emoji:it.emoji,imageUrl:it.imageUrl||"",total:0,unit:it.unit};
    cropStatsMap[it.name].total+=it.qty;
  }));
  const cropStatsList=Object.entries(cropStatsMap).sort((a,b)=>b[1].total-a[1].total);
  const ssB=s=>({접수:{bg:"#fffbeb",color:"#b45309",border:"#fcd34d"},준비중:{bg:"#eff6ff",color:"#1d4ed8",border:"#93c5fd"},완료:{bg:"#f0fdf4",color:"#15803d",border:"#86efac"}}[s]||{});

  if(loading) return React.createElement("div",{style:{minHeight:"100vh",background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}},
    React.createElement("span",{style:{fontSize:"1.5rem"}},"🌱"),
    React.createElement("span",{style:{color:"#16a34a",fontSize:"1rem"}},"Firebase 연결 중...")
  );

  const Header=()=>React.createElement("div",{style:{background:"linear-gradient(135deg,#166534,#16a34a)",color:"#fff",padding:"14px 20px",boxShadow:"0 2px 10px rgba(0,0,0,0.15)"}},
    React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"}},
      React.createElement("div",null,
        React.createElement("div",{style:{fontSize:"1.4rem",fontWeight:700}},"🌿 다운 텃밭 나눔"),
        React.createElement("div",{style:{fontSize:"0.78rem",color:"#bbf7d0",marginTop:2,display:"flex",alignItems:"center",gap:6}},
          "신선한 작물을 신청해보세요",
          React.createElement("span",{style:{background:fsStatus==="connected"?"rgba(255,255,255,0.2)":"rgba(255,100,100,0.3)",borderRadius:10,padding:"1px 7px",fontSize:"0.7rem"}},
            fsStatus==="connected"?"🟢 실시간":"🔴 연결 끊김")
        )
      ),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}},
        React.createElement("div",{style:{fontSize:"0.78rem",color:"#d1fae5",background:"rgba(255,255,255,0.15)",borderRadius:12,padding:"4px 10px"}},TODAY_STR),
        React.createElement("button",{onClick:()=>{setTab(tab==="order"?"admin":"order");setStep("browse");},
          style:{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",borderRadius:20,padding:"5px 12px",fontSize:"0.78rem",cursor:"pointer"}},
          tab==="order"?"⚙️ 관리자":"← 주문 화면")
      )
    )
  );

  const btnStyle=(active,color="#16a34a")=>({
    background:active?color:"#d1d5db",color:"#fff",border:"none",borderRadius:14,
    padding:"14px",fontSize:"1rem",fontWeight:700,
    cursor:active?"pointer":"not-allowed",width:"100%",
  });

  // ── 주문 화면 ──
  if(tab==="order") return React.createElement("div",{style:{minHeight:"100vh",background:"#f0fdf4",fontFamily:"'Apple SD Gothic Neo',sans-serif",display:"flex",flexDirection:"column"}},
    React.createElement(Header),
    React.createElement("div",{style:{flex:1,maxWidth:480,margin:"0 auto",width:"100%",padding:"16px 16px 24px",boxSizing:"border-box"}},

      // BROWSE
      step==="browse"&&React.createElement("div",null,
        React.createElement("div",{style:{color:"#166534",fontWeight:600,fontSize:"1rem",marginBottom:12,marginTop:8}},"오늘의 작물 🌾"),
        crops.length===0
          ?React.createElement("div",{style:{textAlign:"center",color:"#9ca3af",padding:"60px 0"}},"아직 등록된 작물이 없어요 🌱")
          :React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:10}},
            ...crops.map(crop=>{
              const av=avail(crop),qty=cart[crop.id]||0;
              return React.createElement("div",{key:crop.id,style:{background:"#fff",borderRadius:18,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",display:"flex",alignItems:"center",gap:12,opacity:av===0?0.5:1}},
                React.createElement("div",{style:{width:54,height:54,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},React.createElement(CropIcon,{crop,size:54})),
                React.createElement("div",{style:{flex:1}},
                  React.createElement("div",{style:{fontWeight:700,fontSize:"1rem",color:"#1f2937"}},crop.name),
                  React.createElement("div",{style:{fontSize:"0.78rem",color:av>0?"#16a34a":"#ef4444",marginTop:2}},av>0?`남은 수량: ${av}${crop.unit}`:"마감되었어요")
                ),
                React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
                  React.createElement("button",{onClick:()=>setQty(crop.id,qty-1),disabled:qty===0,style:{width:32,height:32,borderRadius:"50%",border:"none",background:qty===0?"#f3f4f6":"#dcfce7",color:qty===0?"#d1d5db":"#166534",fontSize:"1.2rem",fontWeight:700,cursor:qty===0?"not-allowed":"pointer"}},"−"),
                  React.createElement("span",{style:{width:28,textAlign:"center",fontWeight:700,fontSize:"1rem",color:"#166534"}},qty),
                  React.createElement("button",{onClick:()=>setQty(crop.id,qty+1),disabled:qty>=av,style:{width:32,height:32,borderRadius:"50%",border:"none",background:qty>=av?"#f3f4f6":"#16a34a",color:qty>=av?"#d1d5db":"#fff",fontSize:"1.2rem",fontWeight:700,cursor:qty>=av?"not-allowed":"pointer"}},"+")
                )
              );
            })
          ),
        cartItems.length>0&&React.createElement("div",{style:{position:"fixed",bottom:schoolImg?172:24,left:0,right:0,display:"flex",justifyContent:"center",zIndex:10}},
          React.createElement("button",{onClick:()=>setStep("form"),style:{background:"#16a34a",color:"#fff",border:"none",borderRadius:30,padding:"14px 40px",fontSize:"1.05rem",fontWeight:700,boxShadow:"0 4px 20px rgba(22,163,74,0.4)",cursor:"pointer"}},`신청하기 (${cartItems.length}종 선택)`)
        )
      ),

      // FORM
      step==="form"&&React.createElement("div",null,
        React.createElement("button",{onClick:()=>setStep("browse"),style:{background:"none",border:"none",color:"#16a34a",cursor:"pointer",marginTop:8,marginBottom:12,fontSize:"0.9rem"}},"← 목록으로"),
        React.createElement("div",{style:{color:"#166534",fontWeight:600,fontSize:"1rem",marginBottom:12}},"신청 정보 입력"),
        React.createElement("div",{style:{background:"#fff",borderRadius:18,padding:16,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}},
          React.createElement("div",{style:{fontSize:"0.82rem",fontWeight:600,color:"#6b7280",marginBottom:8}},"선택한 작물"),
          ...cartItems.map(c=>React.createElement("div",{key:c.id,style:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f3f4f6"}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
              React.createElement("div",{style:{width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement(CropIcon,{crop:c,size:28})),
              React.createElement("span",{style:{fontSize:"0.9rem"}},c.name)
            ),
            React.createElement("span",{style:{fontWeight:700,color:"#16a34a",fontSize:"0.9rem"}},`${c.qty}${c.unit}`)
          ))
        ),
        React.createElement("div",{style:{background:"#fff",borderRadius:18,padding:16,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}},
          React.createElement("div",{style:{fontSize:"0.82rem",fontWeight:600,color:"#374151",marginBottom:4}},"📅 수령일 선택"),
          React.createElement("div",{style:{fontSize:"0.75rem",color:"#9ca3af",marginBottom:12}},"오늘로부터 3일 이내 · 평일만 · 공휴일 제외"),
          AVAIL_DATES.length===0
            ?React.createElement("div",{style:{textAlign:"center",color:"#9ca3af",padding:"14px 0",fontSize:"0.85rem"}},"선택 가능한 날짜가 없어요")
            :React.createElement("div",{style:{display:"flex",gap:8}},
              ...AVAIL_DATES.map(d=>{
                const key=fmtFull(d),sel=form.date===key,isToday=toKey(d)===toKey(new Date());
                return React.createElement("button",{key,onClick:()=>setForm(f=>({...f,date:key})),
                  style:{flex:1,padding:"12px 6px",borderRadius:16,cursor:"pointer",textAlign:"center",
                    border:sel?"2.5px solid #16a34a":"2px solid #e5e7eb",
                    background:sel?"#dcfce7":"#f9fafb",
                    boxShadow:sel?"0 2px 8px rgba(22,163,74,0.2)":"none"}},
                  isToday&&React.createElement("div",{style:{fontSize:"0.65rem",fontWeight:700,color:sel?"#15803d":"#9ca3af",marginBottom:2}},"오늘"),
                  React.createElement("div",{style:{fontSize:"0.95rem",fontWeight:700,color:sel?"#166534":"#374151"}},`${d.getMonth()+1}월 ${d.getDate()}일`),
                  React.createElement("div",{style:{fontSize:"0.75rem",color:sel?"#16a34a":"#9ca3af",marginTop:2}},`${DAYS_KR[d.getDay()]}요일`)
                );
              })
            )
        ),
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:10}},
          React.createElement("input",{placeholder:"이름 *",value:form.name,onChange:e=>setForm({...form,name:e.target.value}),
            style:{border:"1.5px solid #e5e7eb",borderRadius:14,padding:"12px 16px",fontSize:"0.95rem",outline:"none",width:"100%",boxSizing:"border-box"}}),
          React.createElement("textarea",{placeholder:"메모 (선택사항)",rows:2,value:form.memo,onChange:e=>setForm({...form,memo:e.target.value}),
            style:{border:"1.5px solid #e5e7eb",borderRadius:14,padding:"12px 16px",fontSize:"0.95rem",outline:"none",resize:"none",width:"100%",boxSizing:"border-box"}}),
          React.createElement("button",{onClick:submitOrder,disabled:!form.name.trim()||!form.date,
            style:btnStyle(form.name.trim()&&form.date)},"신청 완료")
        )
      ),

      // DONE
      step==="done"&&React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",marginTop:60,textAlign:"center"}},
        React.createElement("div",{style:{fontSize:"4rem",marginBottom:16}},"🎉"),
        React.createElement("div",{style:{fontSize:"1.5rem",fontWeight:700,color:"#166534",marginBottom:8}},"신청 완료!"),
        React.createElement("div",{style:{color:"#6b7280",marginBottom:20,lineHeight:1.6}},"감사합니다 😊",React.createElement("br"),"수령 일정은 별도로 안내드릴게요."),
        React.createElement("div",{style:{width:"100%",maxWidth:320,marginBottom:16}},
          React.createElement(NBadge,{status:nStatus.tg,label:"📨 텔레그램"}),
          React.createElement(NBadge,{status:nStatus.kakao,label:"💬 카카오톡"}),
          React.createElement(NBadge,{status:nStatus.ntfy,label:"🔔 푸시알림"})
        ),
        React.createElement("button",{onClick:()=>{setStep("browse");setNStatus({tg:"",kakao:"",ntfy:""});},
          style:{background:"#16a34a",color:"#fff",border:"none",borderRadius:30,padding:"12px 36px",fontSize:"1rem",fontWeight:700,cursor:"pointer"}},"처음으로")
      )
    ),
    React.createElement(SchoolFooter,{imgData:schoolImg})
  );

  // ── 관리자 화면 ──
  return React.createElement("div",{style:{minHeight:"100vh",background:"#f0fdf4",fontFamily:"'Apple SD Gothic Neo',sans-serif",display:"flex",flexDirection:"column"}},
    React.createElement(Header),
    React.createElement("div",{style:{flex:1,maxWidth:620,margin:"0 auto",width:"100%",padding:"0 16px 40px",boxSizing:"border-box"}},
      React.createElement("div",{style:{display:"flex",borderBottom:"2px solid #d1fae5",marginBottom:16,marginTop:12}},
        ...([["crops","🌱 작물"],["orders","📋 신청"],["stats","📊 통계"],["settings","⚙️ 알림"]]).map(([key,label])=>
          React.createElement("button",{key,onClick:()=>setAdminTab(key),
            style:{flex:1,padding:"10px 4px",border:"none",background:"transparent",
              fontWeight:adminTab===key?700:400,color:adminTab===key?"#166534":"#9ca3af",
              borderBottom:adminTab===key?"3px solid #16a34a":"3px solid transparent",
              marginBottom:-2,cursor:"pointer",fontSize:"0.82rem"}},label)
        )
      ),

      // 작물 관리 탭
      adminTab==="crops"&&React.createElement("div",null,
        React.createElement("div",{style:{display:"flex",justifyContent:"flex-end",marginBottom:12}},
          React.createElement("button",{onClick:()=>{setShowAdd(!showAdd);setNewCrop(EMPTY_CROP);},
            style:{background:"#16a34a",color:"#fff",border:"none",borderRadius:20,padding:"6px 16px",fontSize:"0.85rem",cursor:"pointer"}},
            showAdd?"닫기":"+ 작물 추가")
        ),
        showAdd&&React.createElement("div",{style:{background:"#fff",borderRadius:18,padding:16,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}},
          React.createElement("div",{style:{display:"flex",gap:8,marginBottom:14}},
            React.createElement("input",{placeholder:"작물 이름",value:newCrop.name,onChange:e=>setNewCrop(p=>({...p,name:e.target.value})),style:{flex:1,border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 12px",fontSize:"0.9rem",outline:"none"}}),
            React.createElement("input",{type:"number",value:newCrop.available,onChange:e=>setNewCrop(p=>({...p,available:parseInt(e.target.value)||0})),style:{width:68,border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 8px",fontSize:"0.9rem",outline:"none"}}),
            React.createElement("select",{value:newCrop.unit,onChange:e=>setNewCrop(p=>({...p,unit:e.target.value})),style:{border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 8px",fontSize:"0.9rem",outline:"none",background:"#fff"}},
              ...UNITS.map(u=>React.createElement("option",{key:u},u)))
          ),
          React.createElement("div",{style:{display:"flex",gap:8,marginBottom:12}},
            ...[["emoji","😊 이모지"],["image","🖼️ 이미지 URL"]].map(([mode,lbl])=>
              React.createElement("button",{key:mode,onClick:()=>changeIconMode(mode),
                style:{flex:1,padding:"9px 0",borderRadius:12,cursor:"pointer",fontSize:"0.85rem",fontWeight:600,
                  border:newCrop.iconMode===mode?"2px solid #16a34a":"2px solid #e5e7eb",
                  background:newCrop.iconMode===mode?"#dcfce7":"#f9fafb",
                  color:newCrop.iconMode===mode?"#166534":"#9ca3af"}},lbl)
            )
          ),
          newCrop.iconMode==="emoji"&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14,background:"#f9fafb",borderRadius:12,padding:10}},
            ...EMOJIS.map(em=>React.createElement("button",{key:em,onClick:()=>setNewCrop(p=>({...p,emoji:em})),
              style:{fontSize:"1.5rem",padding:"4px 6px",borderRadius:10,cursor:"pointer",
                border:newCrop.emoji===em?"2px solid #16a34a":"2px solid transparent",
                background:newCrop.emoji===em?"#dcfce7":"transparent"}},em))
          ),
          newCrop.iconMode==="image"&&React.createElement("div",{style:{marginBottom:14}},
            React.createElement("input",{placeholder:"이미지 URL 붙여넣기",value:newCrop.imageUrl,onChange:e=>setNewCrop(p=>({...p,imageUrl:e.target.value})),style:{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 12px",fontSize:"0.85rem",outline:"none",boxSizing:"border-box"}}),
            newCrop.imageUrl&&React.createElement("div",{style:{marginTop:10,display:"flex",alignItems:"center",gap:10}},
              React.createElement(CropIcon,{crop:{imageUrl:newCrop.imageUrl,emoji:"🌱"},size:52}),
              React.createElement("span",{style:{fontSize:"0.78rem",color:"#16a34a"}},"미리보기"))
          ),
          React.createElement("button",{onClick:addCrop,disabled:!newCrop.name.trim(),style:btnStyle(newCrop.name.trim())},"추가하기")
        ),
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8}},
          ...crops.map((crop,idx)=>React.createElement("div",{key:crop.id,style:{background:"#fff",borderRadius:16,padding:"12px 16px",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",display:"flex",alignItems:"center",gap:10}},
            React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:2}},
              React.createElement("button",{onClick:()=>moveCrop(idx,-1),disabled:idx===0,style:{width:24,height:24,border:"none",borderRadius:6,background:idx===0?"#f3f4f6":"#e5e7eb",color:idx===0?"#d1d5db":"#374151",fontSize:"0.75rem",cursor:idx===0?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}},"▲"),
              React.createElement("button",{onClick:()=>moveCrop(idx,1),disabled:idx===crops.length-1,style:{width:24,height:24,border:"none",borderRadius:6,background:idx===crops.length-1?"#f3f4f6":"#e5e7eb",color:idx===crops.length-1?"#d1d5db":"#374151",fontSize:"0.75rem",cursor:idx===crops.length-1?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}},"▼")
            ),
            React.createElement("div",{style:{width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},React.createElement(CropIcon,{crop,size:44})),
            React.createElement("div",{style:{flex:1}},
              React.createElement("div",{style:{fontWeight:700,fontSize:"0.95rem"}},crop.name),
              React.createElement("div",{style:{fontSize:"0.75rem",color:"#6b7280"}},`예약 ${crop.reserved} / 전체 ${crop.available}${crop.unit}`)
            ),
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
              React.createElement("button",{onClick:()=>updateAvail(crop.id,-1),style:{width:28,height:28,borderRadius:"50%",border:"none",background:"#f3f4f6",color:"#374151",fontSize:"1rem",fontWeight:700,cursor:"pointer"}},"−"),
              React.createElement("span",{style:{width:32,textAlign:"center",fontWeight:700,color:"#166534"}},crop.available),
              React.createElement("button",{onClick:()=>updateAvail(crop.id,1),style:{width:28,height:28,borderRadius:"50%",border:"none",background:"#dcfce7",color:"#166534",fontSize:"1rem",fontWeight:700,cursor:"pointer"}},"+")
            ),
            React.createElement("button",{onClick:()=>deleteCrop(crop.id),style:{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"0.8rem",fontWeight:600}},"삭제")
          ))
        )
      ),

      // 신청 목록 탭
      adminTab==="orders"&&React.createElement("div",null,
        React.createElement("div",{style:{color:"#166534",fontWeight:600,fontSize:"0.95rem",marginBottom:12}},`신청 목록 (${orders.length}건)`),
        orders.length===0
          ?React.createElement("div",{style:{textAlign:"center",color:"#9ca3af",padding:"40px 0"}},"아직 신청이 없어요")
          :React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:10}},
            ...[...orders].reverse().map(order=>{
              const s=ssB(order.status);
              return React.createElement("div",{key:order.id,style:{background:"#fff",borderRadius:18,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}},
                React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}},
                  React.createElement("div",null,
                    React.createElement("span",{style:{fontWeight:700,fontSize:"0.95rem"}},order.name),
                    React.createElement("span",{style:{color:"#9ca3af",fontSize:"0.78rem",marginLeft:8}},`📅 ${order.date}`)
                  ),
                  React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
                    React.createElement("select",{value:order.status,onChange:e=>updateStatus(order.id,e.target.value),
                      style:{fontSize:"0.75rem",padding:"3px 8px",borderRadius:20,border:`1.5px solid ${s.border}`,background:s.bg,color:s.color,cursor:"pointer",outline:"none"}},
                      React.createElement("option",null,"접수"),React.createElement("option",null,"준비중"),React.createElement("option",null,"완료")),
                    React.createElement("button",{onClick:()=>deleteOrder(order.id),style:{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:"0.78rem"}},"삭제")
                  )
                ),
                React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6,marginBottom:4}},
                  ...order.items.map((it,i)=>React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:4,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:20,padding:"3px 10px"}},
                    React.createElement(CropIcon,{crop:it,size:18}),
                    React.createElement("span",{style:{fontSize:"0.8rem",color:"#166534"}},`${it.name} ${it.qty}${it.unit}`)
                  ))
                ),
                order.memo&&React.createElement("div",{style:{fontSize:"0.78rem",color:"#9ca3af",marginTop:4}},`📝 ${order.memo}`)
              );
            })
          )
      ),

      // 통계 탭
      adminTab==="stats"&&React.createElement("div",null,
        React.createElement("div",{style:{color:"#166534",fontWeight:600,fontSize:"0.95rem",marginBottom:14}},"누적 통계"),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:20}},
          ...[["전체","📋",totalOrders,"#f0fdf4","#166534"],["접수","🟡",byStatus["접수"],"#fffbeb","#b45309"],["준비중","🔵",byStatus["준비중"],"#eff6ff","#1d4ed8"],["완료","✅",byStatus["완료"],"#f0fdf4","#15803d"]].map(([lbl,icon,count,bg,color])=>
            React.createElement("div",{key:lbl,style:{background:bg,borderRadius:16,padding:"14px 8px",textAlign:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}},
              React.createElement("div",{style:{fontSize:"1.2rem"}},icon),
              React.createElement("div",{style:{fontSize:"1.5rem",fontWeight:800,color}},count),
              React.createElement("div",{style:{fontSize:"0.72rem",color:"#6b7280",marginTop:2}},lbl)
            )
          )
        ),
        React.createElement("div",{style:{background:"#fff",borderRadius:18,padding:16,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}},
          React.createElement("div",{style:{fontWeight:700,color:"#374151",marginBottom:12,fontSize:"0.9rem"}},"작물별 누적 신청량"),
          cropStatsList.length===0
            ?React.createElement("div",{style:{textAlign:"center",color:"#9ca3af",padding:"20px 0",fontSize:"0.85rem"}},"아직 신청 데이터가 없어요")
            :React.createElement("div",null,
              ...(() => {
                const mx=cropStatsList[0][1].total;
                return cropStatsList.map(([name,info])=>React.createElement("div",{key:name,style:{marginBottom:12}},
                  React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}},
                    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
                      React.createElement(CropIcon,{crop:info,size:26}),
                      React.createElement("span",{style:{fontSize:"0.88rem",fontWeight:600}},name)
                    ),
                    React.createElement("span",{style:{fontSize:"0.88rem",fontWeight:700,color:"#16a34a"}},`${info.total}${info.unit}`)
                  ),
                  React.createElement("div",{style:{background:"#f3f4f6",borderRadius:20,height:8,overflow:"hidden"}},
                    React.createElement("div",{style:{background:"linear-gradient(90deg,#16a34a,#4ade80)",height:"100%",borderRadius:20,width:`${(info.total/mx)*100}%`}})
                  )
                ));
              })()
            )
        )
      ),

      // 알림 설정 탭
      adminTab==="settings"&&React.createElement("div",null,
        // 학교 이미지
        React.createElement("div",{style:{background:"#fff",borderRadius:18,padding:18,boxShadow:"0 1px 4px rgba(0,0,0,0.08)",marginBottom:12}},
          React.createElement("div",{style:{fontWeight:700,color:"#374151",fontSize:"0.95rem",marginBottom:4}},"🏫 학교 이미지 (앱 하단)"),
          React.createElement("div",{style:{fontSize:"0.75rem",color:"#9ca3af",marginBottom:12}},"이미지는 이 기기에만 저장돼요"),
          schoolImg
            ?React.createElement("div",{style:{position:"relative",marginBottom:12}},
              React.createElement("img",{src:schoolImg,style:{width:"100%",height:120,objectFit:"cover",objectPosition:"center 40%",borderRadius:12}}),
              React.createElement("button",{onClick:removeSchoolImg,style:{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",borderRadius:20,padding:"4px 10px",fontSize:"0.75rem",cursor:"pointer"}},"✕ 삭제")
            )
            :React.createElement("div",{onClick:()=>fileRef.current.click(),style:{border:"2px dashed #d1fae5",borderRadius:12,padding:"24px",textAlign:"center",cursor:"pointer",background:"#f9fafb",marginBottom:12}},
              React.createElement("div",{style:{fontSize:"2rem",marginBottom:6}},"📷"),
              React.createElement("div",{style:{fontSize:"0.85rem",color:"#6b7280"}},"클릭하여 이미지 업로드")
            ),
          React.createElement("input",{ref:fileRef,type:"file",accept:"image/*",onChange:handleSchoolImg,style:{display:"none"}}),
          !schoolImg&&React.createElement("button",{onClick:()=>fileRef.current.click(),style:{width:"100%",background:"#16a34a",color:"#fff",border:"none",borderRadius:12,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:"0.88rem"}},"📁 이미지 선택")
        ),
        // ntfy
        React.createElement("div",{style:{background:"#fff",borderRadius:18,padding:18,boxShadow:"0 1px 4px rgba(0,0,0,0.08)",marginBottom:12}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
            React.createElement("span",{style:{fontSize:"1.4rem"}},"🔔"),
            React.createElement("div",{style:{flex:1}},
              React.createElement("div",{style:{fontWeight:700,color:"#374151",fontSize:"0.95rem"}},"ntfy 푸시알림"),
              React.createElement("div",{style:{fontSize:"0.75rem",color:"#9ca3af"}},"채널명만 입력하면 끝!")
            ),
            ntfyTopic&&React.createElement("span",{style:{fontSize:"0.7rem",background:"#f0fdf4",color:"#15803d",border:"1px solid #86efac",borderRadius:20,padding:"3px 10px",fontWeight:600}},"✅ 설정됨")
          ),
          React.createElement("input",{placeholder:"채널명 (예: daun-garden-2026)",value:ntfyTopic,onChange:e=>setNtfyTopic(e.target.value),style:{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 12px",fontSize:"0.83rem",outline:"none",boxSizing:"border-box",marginBottom:8}}),
          tErr.ntfy&&React.createElement("div",{style:{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"8px 12px",fontSize:"0.78rem",color:"#b91c1c",marginBottom:8}},`❌ ${tErr.ntfy}`),
          React.createElement("div",{style:{display:"flex",gap:8}},
            React.createElement("button",{onClick:saveSettings,style:{flex:1,background:saveOk?"#4ade80":"#16a34a",color:"#fff",border:"none",borderRadius:12,padding:"9px",fontWeight:700,cursor:"pointer",fontSize:"0.85rem"}},saveOk?"✅ 저장됨":"💾 저장"),
            React.createElement("button",{onClick:()=>testNotify("ntfy"),disabled:!ntfyTopic.trim()||tTest.ntfy==="sending",style:{flex:1,background:ntfyTopic?"#f0fdf4":"#f3f4f6",color:ntfyTopic?"#166534":"#9ca3af",border:`1px solid ${ntfyTopic?"#86efac":"#e5e7eb"}`,borderRadius:12,padding:"9px",fontWeight:600,cursor:"pointer",fontSize:"0.82rem"}},
              tTest.ntfy==="sending"?"⏳...":tTest.ntfy==="ok"?"✅ 성공":tTest.ntfy==="fail"?"❌ 실패":"📨 테스트")
          )
        ),
        // 텔레그램
        React.createElement("div",{style:{background:"#fff",borderRadius:18,padding:18,boxShadow:"0 1px 4px rgba(0,0,0,0.08)",marginBottom:12}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:"1.4rem"}},"✈️"),
            React.createElement("div",{style:{flex:1}},
              React.createElement("div",{style:{fontWeight:700,color:"#374151",fontSize:"0.95rem"}},"텔레그램 알림"),
              React.createElement("div",{style:{fontSize:"0.75rem",color:"#9ca3af"}},"Bot Token + Chat ID")
            ),
            tgToken&&tgChatId&&React.createElement("span",{style:{fontSize:"0.7rem",background:"#f0fdf4",color:"#15803d",border:"1px solid #86efac",borderRadius:20,padding:"3px 10px",fontWeight:600}},"✅ 설정됨")
          ),
          React.createElement("input",{placeholder:"Bot Token",value:tgToken,onChange:e=>setTgToken(e.target.value),style:{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 12px",fontSize:"0.83rem",outline:"none",boxSizing:"border-box",marginBottom:8}}),
          React.createElement("input",{placeholder:"Chat ID",value:tgChatId,onChange:e=>setTgChatId(e.target.value),style:{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 12px",fontSize:"0.83rem",outline:"none",boxSizing:"border-box",marginBottom:12}}),
          tErr.tg&&React.createElement("div",{style:{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"8px 12px",fontSize:"0.78rem",color:"#b91c1c",marginBottom:8}},`❌ ${tErr.tg}`),
          React.createElement("div",{style:{display:"flex",gap:8}},
            React.createElement("button",{onClick:saveSettings,style:{flex:1,background:saveOk?"#4ade80":"#16a34a",color:"#fff",border:"none",borderRadius:12,padding:"9px",fontWeight:700,cursor:"pointer",fontSize:"0.85rem"}},saveOk?"✅ 저장됨":"💾 저장"),
            React.createElement("button",{onClick:()=>testNotify("tg"),disabled:!tgToken.trim()||!tgChatId.trim()||tTest.tg==="sending",style:{flex:1,background:tgToken&&tgChatId?"#f0fdf4":"#f3f4f6",color:tgToken&&tgChatId?"#166534":"#9ca3af",border:`1px solid ${tgToken&&tgChatId?"#86efac":"#e5e7eb"}`,borderRadius:12,padding:"9px",fontWeight:600,cursor:"pointer",fontSize:"0.82rem"}},
              tTest.tg==="sending"?"⏳...":tTest.tg==="ok"?"✅ 성공":tTest.tg==="fail"?"❌ 실패":"📨 테스트")
          )
        ),
        // 카카오
        React.createElement("div",{style:{background:"#fff",borderRadius:18,padding:18,boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:"1.4rem"}},"💬"),
            React.createElement("div",{style:{flex:1}},
              React.createElement("div",{style:{fontWeight:700,color:"#374151",fontSize:"0.95rem"}},"카카오톡 알림"),
              React.createElement("div",{style:{fontSize:"0.75rem",color:"#9ca3af"}},"Access Token")
            ),
            kkToken&&React.createElement("span",{style:{fontSize:"0.7rem",background:"#fefce8",color:"#854d0e",border:"1px solid #fde047",borderRadius:20,padding:"3px 10px",fontWeight:600}},"✅ 설정됨")
          ),
          React.createElement("input",{placeholder:"Kakao Access Token",value:kkToken,onChange:e=>setKkToken(e.target.value),style:{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:12,padding:"10px 12px",fontSize:"0.83rem",outline:"none",boxSizing:"border-box",marginBottom:12}}),
          tErr.kakao&&React.createElement("div",{style:{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:10,padding:"8px 12px",fontSize:"0.78rem",color:"#b91c1c",marginBottom:8}},`❌ ${tErr.kakao}`),
          React.createElement("div",{style:{display:"flex",gap:8}},
            React.createElement("button",{onClick:saveSettings,style:{flex:1,background:saveOk?"#fbbf24":"#eab308",color:"#fff",border:"none",borderRadius:12,padding:"9px",fontWeight:700,cursor:"pointer",fontSize:"0.85rem"}},saveOk?"✅ 저장됨":"💾 저장"),
            React.createElement("button",{onClick:()=>testNotify("kakao"),disabled:!kkToken.trim()||tTest.kakao==="sending",style:{flex:1,background:kkToken?"#fefce8":"#f3f4f6",color:kkToken?"#854d0e":"#9ca3af",border:`1px solid ${kkToken?"#fde047":"#e5e7eb"}`,borderRadius:12,padding:"9px",fontWeight:600,cursor:"pointer",fontSize:"0.82rem"}},
              tTest.kakao==="sending"?"⏳...":tTest.kakao==="ok"?"✅ 성공":tTest.kakao==="fail"?"❌ 실패":"📨 테스트")
          )
        )
      )
    ),
    React.createElement(SchoolFooter,{imgData:schoolImg})
  );
}

ReactDOM.render(React.createElement(App), document.getElementById("root"));