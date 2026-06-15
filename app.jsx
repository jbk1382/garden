// ✅ 다운 텃밭 나눔 — Firebase Firestore 실시간 연동
// Claude 아티팩트: localStorage 자동 폴백 / Vercel 배포: Firestore 실시간 연동

const { useState, useEffect, useRef, useCallback } = React;

// ══════════════════════════════════════════
// 🔥 Firebase 설정
// ══════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA1biDAx3uRu56rhmpjMBPPU03FhO5Kl4M",
  authDomain:        "daun-garden.firebaseapp.com",
  projectId:         "daun-garden",
  storageBucket:     "daun-garden.firebasestorage.app",
  messagingSenderId: "394498485480",
  appId:             "1:394498485480:web:544d26a0ddb55f993e6d5d"
};

const COL = "daun-garden";
const DOC = "main";

// Firebase 초기화 (실패 시 localStorage 폴백)
let db = null;
let IS_FIREBASE = false;
try {
  if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    IS_FIREBASE = true;
  }
} catch (e) {
  console.warn("Firebase 초기화 실패 → localStorage 사용:", e);
}

// ══════════════════════════════════════════
// 📦 기본 데이터
// ══════════════════════════════════════════
const DEFAULT_CROPS = [
  { id: "c1", icon: "🥬", name: "상추",       desc: "무농약 재배",         qty: 15, reserved: 0, unit: "묶음", order: 0 },
  { id: "c2", icon: "🍅", name: "방울토마토", desc: "달콤한 텃밭 직수확", qty: 20, reserved: 0, unit: "개",   order: 1 },
  { id: "c3", icon: "🥒", name: "오이",       desc: "아삭한 여름 오이",   qty: 8,  reserved: 0, unit: "개",   order: 2 },
  { id: "c4", icon: "🌿", name: "깻잎",       desc: "향긋한 깻잎",        qty: 12, reserved: 0, unit: "묶음", order: 3 },
  { id: "c5", icon: "🧅", name: "대파",       desc: "싱싱한 대파",        qty: 10, reserved: 0, unit: "묶음", order: 4 },
];
const DEFAULT_SETTINGS = {
  noticetitle: "이번 주 수확 안내",
  noticebody:  "상추, 방울토마토, 오이가 준비됐어요! 수량이 한정되어 있으니 빠르게 신청해주세요.",
  adminpw:     "1234",
  maxqty:      3,
  slots:       ["10:00","10:30","11:00","11:30","12:00"],
};
const DEFAULT_ORDERS = [];

// ══════════════════════════════════════════
// 💾 데이터 레이어 (Firestore ↔ localStorage)
// ══════════════════════════════════════════
const LS_KEY = "daun_garden_data";

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { crops: DEFAULT_CROPS, settings: DEFAULT_SETTINGS, orders: DEFAULT_ORDERS };
}
function saveLocal(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {}
}

// ══════════════════════════════════════════
// 🎨 스타일
// ══════════════════════════════════════════
const CSS = `
:root {
  --g1:#2d6a4f;--g2:#40916c;--g3:#52b788;--g4:#74c69d;--g5:#b7e4c7;--g6:#d8f3dc;
  --bg:#f8fdf8;--card:#fff;--border:#d0e8d4;--text:#1b3a2d;--muted:#5a7a6a;--hint:#9cb8ad;
  --r:14px;--rs:8px;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text)}
.app{max-width:420px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;position:relative}
.header{background:var(--g1);color:#fff;padding:env(safe-area-inset-top,14px) 16px 12px;padding-top:calc(env(safe-area-inset-top,0px) + 14px);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.header-title{font-size:17px;font-weight:700;letter-spacing:-.3px}
.header-sub{font-size:11px;opacity:.7;margin-top:1px}
.hbtn{background:rgba(255,255,255,.18);border:none;border-radius:20px;color:#fff;font-size:12px;padding:5px 12px;cursor:pointer;font-weight:600}
.screen{flex:1;overflow-y:auto;padding:12px 12px 90px}
.nav{background:var(--card);border-top:1px solid var(--border);display:flex;flex-shrink:0;position:sticky;bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px 8px;border:none;background:none;cursor:pointer;color:var(--muted);font-size:10px;transition:.15s}
.nav-btn.active{color:var(--g1)}
.nav-icon{font-size:22px;line-height:1}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:10px}
.notice{background:#eaf7ee;border:1px solid var(--g5);border-radius:12px;padding:12px;margin-bottom:10px}
.notice-title{font-size:13px;font-weight:700;color:var(--g1)}
.notice-body{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5}
.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:var(--rs);padding:10px;text-align:center}
.stat-num{font-size:20px;font-weight:700;color:var(--g1)}
.stat-label{font-size:10px;color:var(--muted);margin-top:2px}
.sec{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin:14px 0 8px;display:flex;align-items:center;gap:6px}
.sec::after{content:'';flex:1;height:1px;background:var(--border)}
.crop-item{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:8px;cursor:pointer;transition:.15s;-webkit-tap-highlight-color:transparent}
.crop-item:active{transform:scale(.98)}
.crop-icon{width:50px;height:50px;border-radius:12px;background:var(--g6);display:flex;align-items:center;justify-content:center;font-size:28px}
.crop-name{font-size:15px;font-weight:600;color:var(--text)}
.crop-desc{font-size:12px;color:var(--muted);margin-top:2px}
.crop-qty-box{text-align:center}
.qty-num{font-size:22px;font-weight:700;color:var(--g1);line-height:1}
.qty-label{font-size:10px;color:var(--hint);margin-top:1px}
.badge{display:inline-block;font-size:10px;padding:2px 7px;border-radius:20px;margin-top:3px}
.badge-green{background:var(--g6);color:var(--g1)}
.badge-amber{background:#fef3d0;color:#8a6000}
.badge-red{background:#fde8e8;color:#c0392b}
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;align-items:flex-end;justify-content:center}
.overlay.open{display:flex}
.modal{background:var(--card);border-radius:20px 20px 0 0;width:100%;max-width:420px;padding:20px;max-height:88vh;overflow-y:auto;padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))}
.modal-handle{width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px}
.modal-title{font-size:17px;font-weight:700;margin-bottom:16px;color:var(--text)}
.field{margin-bottom:12px}
.field label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px}
.field input,.field textarea,.field select{width:100%;border:1.5px solid var(--border);border-radius:8px;padding:9px 12px;font-size:14px;background:#fff;color:var(--text);outline:none;font-family:inherit}
.field input:focus,.field textarea:focus{border-color:var(--g2)}
.field textarea{resize:vertical;min-height:60px}
.btn{display:flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;padding:11px 16px;transition:.15s;width:100%}
.btn:active{transform:scale(.97)}
.btn-primary{background:var(--g1);color:#fff}
.btn-outline{background:transparent;color:var(--g1);border:1.5px solid var(--g1)}
.btn-red{background:#c0392b;color:#fff}
.btn-sm{padding:7px 14px;font-size:12px;border-radius:8px;width:auto;display:inline-flex}
.btn-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.slots{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.slot{padding:6px 12px;border:1.5px solid var(--border);border-radius:20px;font-size:12px;cursor:pointer;transition:.15s;color:var(--muted);user-select:none}
.slot.sel{background:var(--g1);color:#fff;border-color:var(--g1)}
.slot.full{background:#f0f0f0;color:#bbb;cursor:not-allowed}
.qty-row{display:flex;align-items:center;gap:12px;margin-top:4px}
.qty-btn{width:34px;height:34px;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--g1)}
.qty-val{font-size:18px;font-weight:700;min-width:28px;text-align:center}
.tabs{display:flex;background:#eef5ee;border-radius:10px;padding:3px;margin-bottom:12px;gap:2px}
.tab{flex:1;text-align:center;padding:7px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;color:var(--muted);border:none;background:none;transition:.15s}
.tab.active{background:var(--card);color:var(--g1)}
.admin-crop{display:grid;grid-template-columns:40px 1fr auto;gap:8px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:6px}
.admin-crop-icon{width:38px;height:38px;border-radius:8px;background:var(--g6);display:flex;align-items:center;justify-content:center;font-size:22px}
.icon-btn{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px}
.icon-btn.del{border-color:#fcc;color:#c0392b}
.req-item{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px}
.req-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.req-name{font-size:14px;font-weight:700}
.req-time{font-size:11px;color:var(--muted)}
.req-crop-tag{background:var(--g6);color:var(--g1);border-radius:6px;padding:3px 8px;font-size:12px;display:inline-block;margin:2px 3px 2px 0}
.status-badge{font-size:11px;padding:3px 8px;border-radius:20px;font-weight:600}
.s-wait{background:#fff3cd;color:#856404}
.s-done{background:#d1f5e0;color:#1a6335}
.s-cancel{background:#fde8e8;color:#c0392b}
.chart-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.chart-label{font-size:11px;color:var(--muted);width:44px;text-align:right;flex-shrink:0}
.chart-bar-bg{flex:1;height:16px;background:#eef5ee;border-radius:4px;overflow:hidden}
.chart-bar-fill{height:100%;background:var(--g2);border-radius:4px;transition:width .4s}
.chart-val{font-size:11px;color:var(--text);width:20px;flex-shrink:0}
.toggle-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)}
.toggle-row:last-child{border-bottom:none}
.toggle-label{font-size:14px;color:var(--text)}
.toggle-sub{font-size:11px;color:var(--muted);margin-top:1px}
.toggle{width:44px;height:24px;border-radius:12px;background:#ccc;border:none;cursor:pointer;position:relative;transition:.2s;flex-shrink:0}
.toggle.on{background:var(--g1)}
.toggle::after{content:'';width:20px;height:20px;border-radius:10px;background:#fff;position:absolute;top:2px;left:2px;transition:.2s}
.toggle.on::after{left:22px}
.empty{text-align:center;padding:40px 20px;color:var(--hint)}
.empty-icon{font-size:42px;margin-bottom:8px}
.empty-text{font-size:14px}
.toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1b3a2d;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:999;pointer-events:none;opacity:0;transition:opacity .3s}
.toast.show{opacity:1}
.fb-indicator{position:fixed;top:8px;right:8px;font-size:10px;padding:3px 8px;border-radius:10px;z-index:999}
.fb-on{background:#d1f5e0;color:#1a6335}
.fb-off{background:#fff3cd;color:#856404}
`;

// ══════════════════════════════════════════
// 🌱 메인 앱
// ══════════════════════════════════════════
export default function App() {
  const [screen, setScreen]       = useState("home");
  const [crops, setCrops]         = useState(DEFAULT_CROPS);
  const [orders, setOrders]       = useState([]);
  const [settings, setSettings]   = useState(DEFAULT_SETTINGS);
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminTab, setAdminTab]   = useState("crops");
  const [reqTab, setReqTab]       = useState("wait");
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState("");
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCropModal, setShowCropModal]   = useState(false);
  const [editingCrop, setEditingCrop]       = useState(null);
  const [selectedCropId, setSelectedCropId] = useState(null);

  // Order form state
  const [ordName, setOrdName]     = useState("");
  const [ordQty, setOrdQty]       = useState(1);
  const [ordDate, setOrdDate]     = useState(new Date().toISOString().split("T")[0]);
  const [ordSlot, setOrdSlot]     = useState("10:00");
  const [ordMemo, setOrdMemo]     = useState("");

  // Crop form state
  const [cropForm, setCropForm]   = useState({ icon:"🌿", name:"", desc:"", qty:10, unit:"묶음" });

  // Admin form
  const [adminPwInput, setAdminPwInput] = useState("");
  const [settingsForm, setSettingsForm] = useState(DEFAULT_SETTINGS);

  const toastTimer = useRef(null);

  // ── 데이터 로드 ──
  useEffect(() => {
    if (IS_FIREBASE) {
      const ref = db.collection(COL).doc(DOC);
      const unsub = ref.onSnapshot((snap) => {
        if (snap.exists) {
          const d = snap.data();
          if (d.crops)    setCrops(d.crops);
          if (d.orders)   setOrders(d.orders);
          if (d.settings) { setSettings(d.settings); setSettingsForm(d.settings); }
        } else {
          // 최초 초기화
          ref.set({ crops: DEFAULT_CROPS, orders: DEFAULT_ORDERS, settings: DEFAULT_SETTINGS });
        }
        setLoading(false);
      }, () => setLoading(false));
      return () => unsub();
    } else {
      const local = loadLocal();
      setCrops(local.crops || DEFAULT_CROPS);
      setOrders(local.orders || DEFAULT_ORDERS);
      setSettings(local.settings || DEFAULT_SETTINGS);
      setSettingsForm(local.settings || DEFAULT_SETTINGS);
      setLoading(false);
    }
  }, []);

  // ── 데이터 저장 ──
  const save = useCallback(async (newCrops, newOrders, newSettings) => {
    const data = {
      crops:    newCrops    ?? crops,
      orders:   newOrders   ?? orders,
      settings: newSettings ?? settings,
    };
    if (IS_FIREBASE) {
      try { await db.collection(COL).doc(DOC).set(data); } catch (e) { console.error(e); }
    } else {
      saveLocal(data);
    }
  }, [crops, orders, settings]);

  // ── 토스트 ──
  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2500);
  };

  // ── 작물 관련 ──
  const getAvail = (c) => Math.max(0, c.qty - c.reserved);
  const getBadge = (c) => {
    const a = getAvail(c);
    if (a <= 0)  return <span className="badge badge-red">품절</span>;
    if (a <= 3)  return <span className="badge badge-amber">잔여 {a}{c.unit}</span>;
    return <span className="badge badge-green">여유 {a}{c.unit}</span>;
  };

  const openOrderWith = (cropId) => {
    setSelectedCropId(cropId);
    setOrdQty(1);
    setOrdDate(new Date().toISOString().split("T")[0]);
    setOrdSlot(settings.slots?.[0] || "10:00");
    setOrdName("");
    setOrdMemo("");
    setShowOrderModal(true);
  };

  const submitOrder = async () => {
    if (!ordName.trim()) { showToast("이름을 입력해주세요"); return; }
    const crop = crops.find(c => c.id === selectedCropId);
    if (!crop) { showToast("작물을 선택해주세요"); return; }
    if (getAvail(crop) < ordQty) { showToast("재고가 부족해요"); return; }

    const newOrder = {
      id:     "o" + Date.now(),
      name:   ordName.trim(),
      cropId: crop.id,
      cropName: crop.name,
      cropIcon: crop.icon,
      qty:    ordQty,
      unit:   crop.unit,
      date:   ordDate,
      time:   ordSlot,
      memo:   ordMemo.trim(),
      status: "wait",
      createdAt: new Date().toISOString(),
    };
    const newCrops = crops.map(c =>
      c.id === crop.id ? { ...c, reserved: c.reserved + ordQty } : c
    );
    const newOrders = [newOrder, ...orders];
    setCrops(newCrops);
    setOrders(newOrders);
    await save(newCrops, newOrders, null);
    setShowOrderModal(false);
    showToast(`✅ ${ordName}님 신청 완료!`);
  };

  const confirmOrder = async (ordId) => {
    const ord = orders.find(o => o.id === ordId);
    if (!ord) return;
    const newOrders = orders.map(o => o.id === ordId ? { ...o, status: "done" } : o);
    setOrders(newOrders);
    await save(null, newOrders, null);
    showToast("✅ 수령 확인됐어요");
  };

  const cancelOrder = async (ordId) => {
    const ord = orders.find(o => o.id === ordId);
    if (!ord || ord.status !== "wait") return;
    const newCrops = crops.map(c =>
      c.id === ord.cropId ? { ...c, reserved: Math.max(0, c.reserved - ord.qty) } : c
    );
    const newOrders = orders.map(o => o.id === ordId ? { ...o, status: "cancel" } : o);
    setCrops(newCrops);
    setOrders(newOrders);
    await save(newCrops, newOrders, null);
    showToast("취소됐어요");
  };

  // ── 작물 편집 ──
  const openAddCrop = () => {
    setEditingCrop(null);
    setCropForm({ icon: "🌿", name: "", desc: "", qty: 10, unit: "묶음" });
    setShowCropModal(true);
  };
  const openEditCrop = (crop) => {
    setEditingCrop(crop);
    setCropForm({ icon: crop.icon, name: crop.name, desc: crop.desc, qty: crop.qty, unit: crop.unit });
    setShowCropModal(true);
  };
  const saveCrop = async () => {
    if (!cropForm.name.trim()) { showToast("작물 이름을 입력해주세요"); return; }
    let newCrops;
    if (editingCrop) {
      newCrops = crops.map(c => c.id === editingCrop.id ? { ...c, ...cropForm } : c);
    } else {
      const newCrop = { ...cropForm, id: "c" + Date.now(), reserved: 0, order: crops.length };
      newCrops = [...crops, newCrop];
    }
    setCrops(newCrops);
    await save(newCrops, null, null);
    setShowCropModal(false);
    showToast(editingCrop ? "수정됐어요" : "작물이 추가됐어요 🌱");
  };
  const deleteCrop = async (cropId) => {
    if (!window.confirm("정말 삭제할까요?")) return;
    const newCrops = crops.filter(c => c.id !== cropId);
    setCrops(newCrops);
    await save(newCrops, null, null);
    showToast("삭제됐어요");
  };
  const moveCrop = async (idx, dir) => {
    const arr = [...crops];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setCrops(arr);
    await save(arr, null, null);
  };
  const resetCropQty = async (cropId) => {
    const newCrops = crops.map(c => c.id === cropId ? { ...c, reserved: 0 } : c);
    setCrops(newCrops);
    await save(newCrops, null, null);
    showToast("예약 수량이 초기화됐어요");
  };

  // ── 설정 저장 ──
  const saveSettings = async () => {
    setSettings(settingsForm);
    await save(null, null, settingsForm);
    showToast("설정이 저장됐어요");
  };

  // ── 관리자 ──
  const checkAdmin = () => {
    if (adminPwInput === settings.adminpw) {
      setAdminLogged(true);
    } else {
      showToast("비밀번호가 틀렸어요");
    }
  };

  // ══════════════════════════════════════════
  // 🖥 렌더
  // ══════════════════════════════════════════
  if (loading) {
    return (
      <div className="app" style={{alignItems:"center",justifyContent:"center",height:"100vh"}}>
        <div style={{fontSize:"48px",marginBottom:"12px"}}>🌿</div>
        <div style={{fontSize:"15px",color:"var(--muted)"}}>불러오는 중...</div>
      </div>
    );
  }

  const totalOrders  = orders.length;
  const waitOrders   = orders.filter(o => o.status === "wait");
  const sortedCrops  = [...crops].sort((a,b) => (a.order||0) - (b.order||0));
  const filteredReqs = orders.filter(o => o.status === reqTab);

  return (
    <div className="app">
      <style>{CSS}</style>

      {/* Firebase 상태 표시 */}
      <div className={`fb-indicator ${IS_FIREBASE ? "fb-on" : "fb-off"}`}>
        {IS_FIREBASE ? "🔥 실시간 연결됨" : "💾 로컬 모드"}
      </div>

      {/* ── 헤더 ── */}
      <div className="header">
        <div>
          <div className="header-title">🌿 다운 텃밭 나눔</div>
          <div className="header-sub">신선한 수확물을 나눠요</div>
        </div>
        {screen === "home" && (
          <button className="hbtn" onClick={() => setScreen("home")}>
            {waitOrders.length > 0 ? `📋 대기 ${waitOrders.length}` : "📦 신청하기"}
          </button>
        )}
      </div>

      {/* ══ 홈 화면 ══ */}
      {screen === "home" && (
        <div className="screen">
          <div className="notice">
            <div className="notice-title">🌱 {settings.noticetitle}</div>
            <div className="notice-body">{settings.noticebody}</div>
          </div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-num">{crops.length}</div><div className="stat-label">수확 중인 작물</div></div>
            <div className="stat-card"><div className="stat-num">{waitOrders.length}</div><div className="stat-label">대기 중 신청</div></div>
            <div className="stat-card"><div className="stat-num">{totalOrders}</div><div className="stat-label">총 나눔 횟수</div></div>
          </div>
          <div className="sec">오늘 수령 가능 작물</div>
          {sortedCrops.length === 0 && (
            <div className="empty"><div className="empty-icon">🌱</div><div className="empty-text">등록된 작물이 없어요</div></div>
          )}
          {sortedCrops.map(c => (
            <div key={c.id} className="crop-item" onClick={() => openOrderWith(c.id)}>
              <div className="crop-icon">{c.icon}</div>
              <div>
                <div className="crop-name">{c.name}</div>
                <div className="crop-desc">{c.desc}</div>
                {getBadge(c)}
              </div>
              <div className="crop-qty-box">
                <div className="qty-num">{getAvail(c)}</div>
                <div className="qty-label">{c.unit} 남음</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ 내 신청 화면 ══ */}
      {screen === "my" && (
        <div className="screen">
          <div className="sec">내 신청 현황</div>
          {orders.length === 0 && (
            <div className="empty"><div className="empty-icon">📋</div><div className="empty-text">신청 내역이 없어요</div></div>
          )}
          {orders.slice(0,10).map(o => (
            <div key={o.id} className="req-item">
              <div className="req-header">
                <div className="req-name">{o.cropIcon} {o.cropName}</div>
                <div className="req-time">{o.date} {o.time}</div>
              </div>
              <div style={{marginBottom:"6px"}}>
                <span className="req-crop-tag">👤 {o.name}</span>
                <span className="req-crop-tag">📦 {o.qty}{o.unit}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:"12px",color:"var(--muted)"}}>{o.memo || "메모 없음"}</span>
                <span className={`status-badge ${o.status==="wait"?"s-wait":o.status==="done"?"s-done":"s-cancel"}`}>
                  {o.status==="wait"?"대기 중":o.status==="done"?"완료":"취소됨"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ 관리자 화면 ══ */}
      {screen === "admin" && (
        <div className="screen">
          {!adminLogged ? (
            <div className="card" style={{textAlign:"center",padding:"30px 20px"}}>
              <div style={{fontSize:"48px",marginBottom:"12px"}}>🔒</div>
              <div style={{fontSize:"16px",fontWeight:"700",marginBottom:"6px"}}>관리자 메뉴</div>
              <div style={{fontSize:"13px",color:"var(--muted)",marginBottom:"16px"}}>비밀번호를 입력하세요</div>
              <div className="field">
                <input type="password" placeholder="비밀번호"
                  style={{textAlign:"center",fontSize:"18px",letterSpacing:"6px"}}
                  value={adminPwInput}
                  onChange={e => setAdminPwInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && checkAdmin()}
                />
              </div>
              <button className="btn btn-primary" onClick={checkAdmin}>🔓 로그인</button>
            </div>
          ) : (
            <>
              <div className="tabs">
                {["crops","requests","stats","settings"].map(t => (
                  <button key={t} className={`tab ${adminTab===t?"active":""}`} onClick={() => setAdminTab(t)}>
                    {t==="crops"?"🥬 작물":t==="requests"?"📋 신청":t==="stats"?"📊 통계":"⚙️ 설정"}
                  </button>
                ))}
              </div>

              {/* 작물 관리 */}
              {adminTab === "crops" && (
                <div>
                  <button className="btn btn-outline" style={{marginBottom:"10px"}} onClick={openAddCrop}>
                    ➕ 작물 추가
                  </button>
                  {sortedCrops.map((c, idx) => (
                    <div key={c.id} className="admin-crop">
                      <div className="admin-crop-icon">{c.icon}</div>
                      <div>
                        <div style={{fontSize:"14px",fontWeight:"600"}}>{c.name}</div>
                        <div style={{fontSize:"11px",color:"var(--muted)"}}>재고 {c.qty} | 예약 {c.reserved} | 잔여 {getAvail(c)}</div>
                      </div>
                      <div style={{display:"flex",gap:"4px",flexWrap:"wrap",justifyContent:"flex-end"}}>
                        <button className="icon-btn" onClick={() => moveCrop(idx, -1)} title="위로">⬆️</button>
                        <button className="icon-btn" onClick={() => moveCrop(idx, 1)} title="아래로">⬇️</button>
                        <button className="icon-btn" onClick={() => openEditCrop(c)} title="수정">✏️</button>
                        <button className="icon-btn" onClick={() => resetCropQty(c.id)} title="예약초기화">🔄</button>
                        <button className="icon-btn del" onClick={() => deleteCrop(c.id)} title="삭제">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 신청 관리 */}
              {adminTab === "requests" && (
                <div>
                  <div className="tabs">
                    {["wait","done","cancel"].map(s => (
                      <button key={s} className={`tab ${reqTab===s?"active":""}`} onClick={() => setReqTab(s)}>
                        {s==="wait"?`대기 (${orders.filter(o=>o.status==="wait").length})`:s==="done"?"완료":"취소"}
                      </button>
                    ))}
                  </div>
                  {filteredReqs.length === 0 && (
                    <div className="empty"><div className="empty-icon">📋</div><div className="empty-text">신청 내역이 없어요</div></div>
                  )}
                  {filteredReqs.map(o => (
                    <div key={o.id} className="req-item">
                      <div className="req-header">
                        <div className="req-name">👤 {o.name}</div>
                        <div className="req-time">{o.date} {o.time}</div>
                      </div>
                      <div style={{marginBottom:"8px"}}>
                        <span className="req-crop-tag">{o.cropIcon} {o.cropName}</span>
                        <span className="req-crop-tag">📦 {o.qty}{o.unit}</span>
                      </div>
                      {o.memo && <div style={{fontSize:"12px",color:"var(--muted)",marginBottom:"8px"}}>💬 {o.memo}</div>}
                      <div style={{display:"flex",justifyContent:"flex-end"}}>
                        <span className={`status-badge ${o.status==="wait"?"s-wait":o.status==="done"?"s-done":"s-cancel"}`}>
                          {o.status==="wait"?"대기 중":o.status==="done"?"완료":"취소됨"}
                        </span>
                      </div>
                      {o.status === "wait" && (
                        <div className="btn-row" style={{marginTop:"8px"}}>
                          <button className="btn btn-primary" style={{fontSize:"12px",padding:"8px"}} onClick={() => confirmOrder(o.id)}>✅ 수령 확인</button>
                          <button className="btn btn-red" style={{fontSize:"12px",padding:"8px"}} onClick={() => cancelOrder(o.id)}>❌ 취소</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 통계 */}
              {adminTab === "stats" && (
                <div>
                  <div className="stats-grid">
                    <div className="stat-card"><div className="stat-num">{orders.filter(o=>o.status==="done").length}</div><div className="stat-label">완료 건수</div></div>
                    <div className="stat-card"><div className="stat-num">{waitOrders.length}</div><div className="stat-label">대기 건수</div></div>
                    <div className="stat-card"><div className="stat-num">{totalOrders}</div><div className="stat-label">전체 신청</div></div>
                  </div>
                  <div className="card">
                    <div style={{fontSize:"13px",fontWeight:"700",marginBottom:"10px"}}>작물별 신청 현황</div>
                    {crops.map(c => {
                      const cnt = orders.filter(o => o.cropId === c.id).length;
                      const max = Math.max(...crops.map(cc => orders.filter(o=>o.cropId===cc.id).length), 1);
                      return (
                        <div key={c.id} className="chart-bar-row">
                          <div className="chart-label">{c.icon} {c.name.slice(0,2)}</div>
                          <div className="chart-bar-bg"><div className="chart-bar-fill" style={{width:`${Math.round(cnt/max*100)}%`}}></div></div>
                          <div className="chart-val">{cnt}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="card">
                    <div style={{fontSize:"13px",fontWeight:"700",marginBottom:"10px"}}>시간대별 수령 현황</div>
                    {(settings.slots || DEFAULT_SETTINGS.slots).map(slot => {
                      const cnt = orders.filter(o => o.time === slot).length;
                      const max = Math.max(...(settings.slots||DEFAULT_SETTINGS.slots).map(s=>orders.filter(o=>o.time===s).length), 1);
                      return (
                        <div key={slot} className="chart-bar-row">
                          <div className="chart-label" style={{fontSize:"10px"}}>{slot}</div>
                          <div className="chart-bar-bg"><div className="chart-bar-fill" style={{width:`${Math.round(cnt/max*100)}%`}}></div></div>
                          <div className="chart-val">{cnt}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 설정 */}
              {adminTab === "settings" && (
                <div>
                  <div className="card">
                    <div style={{fontSize:"14px",fontWeight:"700",marginBottom:"12px"}}>📣 공지사항</div>
                    <div className="field"><label>제목</label>
                      <input type="text" value={settingsForm.noticetitle}
                        onChange={e => setSettingsForm({...settingsForm, noticetitle: e.target.value})}/>
                    </div>
                    <div className="field"><label>내용</label>
                      <textarea rows="3" value={settingsForm.noticebody}
                        onChange={e => setSettingsForm({...settingsForm, noticebody: e.target.value})}/>
                    </div>
                  </div>
                  <div className="card">
                    <div style={{fontSize:"14px",fontWeight:"700",marginBottom:"10px"}}>🛠 운영 설정</div>
                    <div className="field"><label>1인 최대 수령량</label>
                      <input type="number" min="1" max="10" value={settingsForm.maxqty}
                        onChange={e => setSettingsForm({...settingsForm, maxqty: Number(e.target.value)})}/>
                    </div>
                    <div className="field"><label>관리자 비밀번호 변경</label>
                      <input type="password" placeholder="새 비밀번호 입력" value={settingsForm.adminpw}
                        onChange={e => setSettingsForm({...settingsForm, adminpw: e.target.value})}/>
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{marginBottom:"8px"}} onClick={saveSettings}>💾 설정 저장</button>
                  <button className="btn btn-red" onClick={() => { setAdminLogged(false); setAdminPwInput(""); }}>🔒 로그아웃</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 하단 네비 ── */}
      <nav className="nav">
        {[
          { key:"home",  icon:"🏡", label:"홈" },
          { key:"my",    icon:"📋", label:"내 신청" },
          { key:"admin", icon:"🔧", label:"관리자" },
        ].map(n => (
          <button key={n.key} className={`nav-btn ${screen===n.key?"active":""}`} onClick={() => setScreen(n.key)}>
            <div className="nav-icon">{n.icon}</div>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* ══ 신청 모달 ══ */}
      {showOrderModal && (
        <div className="overlay open" onClick={e => e.target===e.currentTarget && setShowOrderModal(false)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">📦 작물 수령 신청</div>
            {selectedCropId && (() => {
              const crop = crops.find(c => c.id === selectedCropId);
              return crop ? (
                <div style={{background:"var(--g6)",borderRadius:"10px",padding:"10px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontSize:"28px"}}>{crop.icon}</span>
                  <div>
                    <div style={{fontWeight:"700",fontSize:"15px"}}>{crop.name}</div>
                    <div style={{fontSize:"12px",color:"var(--muted)"}}>잔여 {getAvail(crop)}{crop.unit}</div>
                  </div>
                </div>
              ) : null;
            })()}
            <div className="field"><label>이름</label>
              <input type="text" placeholder="홍길동" value={ordName} onChange={e => setOrdName(e.target.value)}/>
            </div>
            <div className="field"><label>수량</label>
              <div className="qty-row">
                <button className="qty-btn" onClick={() => setOrdQty(v => Math.max(1,v-1))}>−</button>
                <div className="qty-val">{ordQty}</div>
                <button className="qty-btn" onClick={() => setOrdQty(v => Math.min(settings.maxqty||3, v+1))}>+</button>
                <span style={{fontSize:"12px",color:"var(--muted)"}}>최대 {settings.maxqty||3}개</span>
              </div>
            </div>
            <div className="field"><label>수령 날짜</label>
              <input type="date" value={ordDate} onChange={e => setOrdDate(e.target.value)}/>
            </div>
            <div className="field"><label>수령 시간</label>
              <div className="slots">
                {(settings.slots || DEFAULT_SETTINGS.slots).map(s => (
                  <div key={s} className={`slot ${ordSlot===s?"sel":""}`} onClick={() => setOrdSlot(s)}>{s}</div>
                ))}
              </div>
            </div>
            <div className="field"><label>메모 (선택)</label>
              <textarea placeholder="알레르기 정보, 특이사항 등" value={ordMemo} onChange={e => setOrdMemo(e.target.value)}/>
            </div>
            <div className="btn-row">
              <button className="btn btn-outline" onClick={() => setShowOrderModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={submitOrder}>신청하기 🌿</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 작물 추가/수정 모달 ══ */}
      {showCropModal && (
        <div className="overlay open" onClick={e => e.target===e.currentTarget && setShowCropModal(false)}>
          <div className="modal">
            <div className="modal-handle"></div>
            <div className="modal-title">{editingCrop ? "✏️ 작물 수정" : "🌱 작물 추가"}</div>
            <div className="field"><label>이름</label>
              <input type="text" placeholder="예: 상추" value={cropForm.name}
                onChange={e => setCropForm({...cropForm, name: e.target.value})}/>
            </div>
            <div className="field"><label>이모지 아이콘</label>
              <input type="text" placeholder="🥬" style={{fontSize:"24px",textAlign:"center"}}
                value={cropForm.icon} onChange={e => setCropForm({...cropForm, icon: e.target.value})}/>
            </div>
            <div className="field"><label>재고 수량</label>
              <div className="qty-row">
                <button className="qty-btn" onClick={() => setCropForm({...cropForm, qty: Math.max(0, cropForm.qty-1)})}>−</button>
                <div className="qty-val">{cropForm.qty}</div>
                <button className="qty-btn" onClick={() => setCropForm({...cropForm, qty: cropForm.qty+1})}>+</button>
              </div>
            </div>
            <div className="field"><label>설명</label>
              <input type="text" placeholder="무농약 재배, 텃밭 직수확" value={cropForm.desc}
                onChange={e => setCropForm({...cropForm, desc: e.target.value})}/>
            </div>
            <div className="field"><label>단위</label>
              <div className="slots">
                {["묶음","개","kg","봉지"].map(u => (
                  <div key={u} className={`slot ${cropForm.unit===u?"sel":""}`}
                    onClick={() => setCropForm({...cropForm, unit: u})}>{u}</div>
                ))}
              </div>
            </div>
            <div className="btn-row">
              <button className="btn btn-outline" onClick={() => setShowCropModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={saveCrop}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
