/* ================= TAYFUN v13 — Kara Kartal Doktrini =================
   Bu sürümde eklenenler / düzeltilenler:
   - HARİTA BUGI DÜZELTİLDİ: canvas artık SVG ile aynı koordinat sistemini
     kullanıyor (mapToScreen()) — füzeler artık gerçek hedef şehre düşüyor.
   - Gerçek D3/TopoJSON dünya haritası + otomatik yedek harita.
   - 20 ülke + 6 kıta bloğu (bloklar savaş açamaz/gelişemez, ama oyuncu
     onlara saldırabilir — orta seviye sabit güçteler).
   - Katmanlı hava savunması (Kısa/Orta/Uzun menzil, ayrı yatırım).
   - Fog of War: Siber Ağ ya da Casus/Uydu keşfi olmadan düşman HSS'i gizli.
   - Yakıt ikmali: uçak saldırılarında menzil sınırını kaldırıyor.
   - Vergi oranı, silah özelleştirme (Menzil/Hasar/Hız), kademeli tech ağacı.
   - BM Güvenlik Konseyi (P5 veto, karar türleri, nükleer denetim rejimi).
   - Kolektif Savunma Paktı, Serbest Ticaret, Silah Ambargosu (ekonomik
     ambargodan ayrı).
   - Tier'a göre AI savunma büyümesi, rejim değişikliği, mülteci krizi.
*/

/* YENİ: Gerçek bayrak görseli + emoji yedeği. <img> yüklenemezse (nadir ağ
   sorunu) onerror ile otomatik emojiye döner — native <select><option>
   içinde <img> çalışmadığından dropdown listesi hâlâ sadece emoji kullanır. */
function flagImgHTML(id, sizeClass){
  let url = FLAG_IMAGES[id]; let emoji = FLAGS[id]||"";
  if(!url) return emoji;
  return `<img src="${url}" class="flag-icon ${sizeClass}" alt="${id}" onerror="if(this.parentNode) this.outerHTML='${emoji}'">`;
}

function setEl(id,val,isHTML=false){let el=document.getElementById(id);if(el){isHTML?el.innerHTML=val:el.innerText=val;}}
/* YENİ: AI'dan veya oyuncudan gelen serbest metni innerHTML içine
   basmadan önce kaçışlamak için — XSS'i ve yanlışlıkla HTML kırılmasını
   engeller. */
function escapeHTML(str){
  if(str===null||str===undefined) return "";
  return String(str).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

const MAX_LOG_LINES = 150;
let logLines = [];
// YENİ: Tur raporu artık logLines'ı indeksle dilimlemiyor (o dizi 150
// satırı aşınca öne doğru kırpılıyor, log hacmi arttıkça sabit bir indeks
// yanlış/boş sonuç veriyordu — "ilk birkaç tur verdi sonra vermedi" bugı
// buydu). Bunun yerine her turda sıfırlanan bağımsız bir tampon kullanılıyor.
let currentTurnBuffer = [];
function log(msg,color="#c5d4e8"){
  let box = document.getElementById("log-box");
  if(!box) return;
  let t = new Date().toLocaleTimeString('tr-TR',{hour12:false});
  let entry = `<div style="color:${color};border-bottom:1px solid #1a2b42;padding:3px 0;">[${t}] ${msg}</div>`;
  logLines.push(entry);
  currentTurnBuffer.push(entry);
  if(logLines.length > MAX_LOG_LINES) logLines = logLines.slice(logLines.length - MAX_LOG_LINES);
  box.innerHTML = logLines.join("");
  box.scrollTop = box.scrollHeight;
}

const P5_MEMBERS = ["USA","RUS","CHN","GBR","FRA"];
const RESOLUTION_LABELS = {embargo:"Ambargo Kararı", peacekeeping:"Barış Gücü Kararı", condemnation:"Kınama Kararı", intervention:"Müdahale Yetkisi", nuclear_cap:"Nükleer Denetim Kararı"};

const WEAPON_CONFIG = {
  drone_swarm:      {range:1500,  dmg:8,   cost:3000,   turns:1, label:"Sürü Drone"},
  /* YENİ: Seyir Füzesi — alçak/düz rotalı, orta menzilli füze. Gerçekte
     yavaş/alçak uçtuğu için hava savunmasına balistikten daha kolay
     yakalanır (bkz. INTERCEPT_BASE_CHANCE). */
  cruise_missile:   {range:2500,  dmg:20,  cost:15000,  turns:1, label:"Seyir Füzesi"},
  ballistic_short:  {range:2000,  dmg:18,  cost:20000,  turns:1, label:"Balistik Füze (Kısa)"},
  ballistic_medium: {range:5000,  dmg:24,  cost:45000,  turns:2, label:"Balistik Füze (Orta)"},
  ballistic_icbm:   {range:12000, dmg:30,  cost:110000, turns:4, requiresTech:"icbm", label:"Kıtalararası Füze"},
  tank:             {cost:40000,  turns:2, label:"Tank", noAttack:true},
  /* YENİ: capture:true — sadece bu üçü (kara/çıkarma/hava indirme) şehri
     gerçekten ele geçirebilir. Aynı piyade tümeni envanterini kullanırlar,
     sadece menzil/risk profilleri farklıdır. */
  kara_birligi:     {range:3000,  dmg:30,  cost:10000,  turns:1, manpowerCost:50000, capture:true, label:"Kara Harekâtı"},
  amphibious:       {range:20000, dmg:30,  capture:true, label:"Çıkarma Harekâtı"},
  airborne:         {range:20000, dmg:25,  capture:true, label:"Hava İndirme Harekâtı"},
  frigate:          {cost:100000, turns:3, label:"Fırkateyn", noAttack:true},
  gen5_jet:         {range:3000,  dmg:25,  cost:150000, turns:3, label:"5. Nesil Uçak"},
  /* YENİ: nuke artık "hp=999 -> anlık ilhak" yapmıyor — çok ağır hasar
     verir ve direnişi sıfıra yakın düşürür ama şehri SADECE kara/çıkarma/
     hava indirme harekâtı ele geçirebilir. */
  nuke:             {range:12000, dmg:95,  cost:500000, turns:5, requiresTech:"nuclear", requiresIcbm:true, uraniumCost:1, label:"Nükleer Başlık"}
};

/* ================= YENİ: HAVA SAVUNMASI — SİLAH TİPİNE ÖZEL VURULMA İHTİMALİ =================
   Eskiden tüm mühimmat türleri (nükleer hariç) tek bir taban ihtimal
   kullanıyordu. Artık her tip GERÇEKÇİ bir taban ihtimale sahip — seyir
   füzeleri yavaş/alçak uçtuğu için en kolay vurulan, balistik füzeler
   daha zor, nükleer neredeyse imkansız (dramatik ağırlığı korunuyor).
   Bu taban değer, Tier/radar/hava sahası bonuslarıyla HÂLÂ yukarı/aşağı
   oynar (bkz. gameLoop içindeki hesaplama) — burada sadece BAŞLANGIÇ
   noktası tanımlı. Kara ailesi (kara_birligi/amphibious/airborne) hava
   savunmasına hiç takılmaz — bu değişmedi. */
const INTERCEPT_BASE_CHANCE = {
  cruise_missile:   0.80,
  ballistic_short:  0.70,
  ballistic_medium: 0.70,
  ballistic_icbm:   0.70,
  drone_swarm:      0.60,
  gen5_jet:         0.40,
  nuke:             0.10
};

/* ================= YENİ: HARİTA/ANİMASYON İKONLARI =================
   Ekstra asset dosyası eklemeden (her tarayıcıda hazır bulunan emoji
   glifleriyle) küçük, sade, okunabilir simgeler — Canvas üzerine
   ctx.fillText ile çizilir. Harita okunabilirliğini bozmaması için
   HEPSİ küçük punto ile çiziliyor (bkz. animator/gameLoop çizim kodu). */
const UNIT_ICONS = {
  cruise_missile:"➤", ballistic_short:"🚀", ballistic_medium:"🚀", ballistic_icbm:"🚀",
  drone_swarm:"🛩", gen5_jet:"✈️", kara_birligi:"🪖", amphibious:"🚢", airborne:"✈️",
  nuke:"☢️", interceptor:"🛡️", paratrooper:"🪂", city:"🏙️", factory:"🏭",
  radar:"📡", cyber:"💻", base:"🎯"
};

const RESEARCH_COSTS = {nuclear:120000, cyber:45000, radar:60000, hss_adv:70000, gen5_jet:90000, mrbm:80000, icbm:150000, air_refuel:100000};

/* YENİ: Tutorial adımları — her adım farklı bir oyun mekaniğini anlatır. */
const TUTORIAL_STEPS = [
  {title:"Genel Bakış", body:"TAYFUN'da bir ülke yönetiyorsunuz. Sol panel (Karargâh) ekonominizi, sağ panel (Diplomasi) seçtiğiniz hedef ülkeyle ilişkilerinizi ve askeri harekâtlarınızı gösterir. Haritadan bir ülkeye tıklayarak onu hedef seçin."},
  {title:"Ekonomi ve Vergi", body:"Her tur Hazineniz vergi oranınıza, istikrarınıza ve fabrikalarınıza göre gelir kazanır. Vergiyi yükseltmek geliri artırır ama Halk Desteğini düşürür — dengeyi kendiniz kurun."},
  {title:"Kabine", body:"👥 Kabine panelinde 4 bakanlık bulunur: Maliye, Dışişleri, İçişleri ve Savunma. Her sekme, o alandaki durumunuzu özetleyen otomatik bir rapor sunar."},
  {title:"Ar-Ge ve Üretim", body:"Teknoloji ve mühimmat üretimi kuyruğa alınır ve birkaç tur sürer. Nükleer, ICBM, Radar gibi teknolojiler yeni yetenekler açar."},
  {title:"Hava Savunması ve Güç Kademesi (Tier)", body:"Her ülkenin bir Tier'i (1=süper güç, 5=zayıf) vardır. Tier ne kadar yüksekse (1'e yakınsa) hava savunmanız o kadar güçlüdür; güçlü bir saldıran ülke de savunmanızı kısmen zayıflatabilir."},
  {title:"Saldırı ve Lojistik", body:"Sağ panelde hedef şehri ve mühimmatı seçip kaç adet göndereceğinizi belirleyin. Ana bölgenizden uzak hedeflere yapılan saldırılar Lojistik cezasına uğrar: hasar ve başarı şansı mesafeyle birlikte düşer."},
  {title:"Siber Operasyonlar", body:"💻 Faaliyetler bölümünden 4 siber operasyon türü seçebilirsiniz: Radar Körletme, Üretim Sabotajı, Mali Sızma, Dezenformasyon. Hedef başına tur başına sadece 1 deneme hakkınız vardır, başarı şansı Tier farkına ve hedefin siber savunmasına bağlıdır."},
  {title:"İstihbarat / Fog of War", body:"🌫️ Keşfetmediğiniz ülkelerin hava savunması ve direniş bilgisi gizlidir. Casus veya Uydu göndererek ya da Siber İstihbarat Ağı teknolojisiyle bu sisi kaldırabilirsiniz."},
  {title:"BM Güvenlik Konseyi", body:"🇺🇳 BM panelinden kararlar önerebilirsiniz. P5 üyeleri (ABD, Rusya, Çin, İngiltere, Fransa) veto hakkına sahiptir."},
  {title:"Tur Sonu ve Krizler", body:"Her tur sonunda ekonomi, üretim ve olaylar işlenir. Zaman zaman jeopolitik krizler ekranın ortasında bir uyarı penceresiyle karşınıza çıkar — önemine göre turuncu ya da kırmızı renkte gösterilir."}
];

/* YENİ: 4 siber operasyon türü — engine.cyberOp() tarafından kullanılır. */
const CYBER_OPS = {
  jam:           {cost:40000, label:"Radar Körletme"},
  sabotage_prod: {cost:45000, label:"Üretim Sabotajı"},
  financial:     {cost:50000, label:"Mali Sızma"},
  disinfo:       {cost:35000, label:"Dezenformasyon"}
};

/* ================= YENİ: AI ENTEGRASYONU =================
   API anahtarı boşsa (aiEngine.isConfigured()===false) VEYA kullanıcı
   izin vermediyse (aiEngine.hasConsent()===false) oyunun HİÇBİR yerinde
   AI çağrısı tetiklenmez — panel sadece uyarı gösterir, oyunun kendisi
   tamamen normal, AI'sız haliyle çalışmaya devam eder. AI bağlantısı
   (fetch) başarısız olursa (400/401/403/404/429/kota/kredi/timeout/ağ/
   model bulunamadı/sağlayıcı çalışmıyor) her çağrı noktası try/catch ile
   sarılı — oyun ASLA çökmez, sadece anlaşılır bir Türkçe hata mesajı
   gösterir ve "oyun normal şekilde devam ediyor" ilkesi korunur. */

/* 3 büyük sağlayıcı — üçü de tarayıcıdan doğrudan (sunucusuz) fetch ile
   çağrılabiliyor. Kullanıcı hangisini seçtiyse SADECE onun anahtarı/
   modeli kullanılır; sağlayıcılar arası anahtarlar ayrı saklanır.
   YENİ: model listeleri güncel (Ağustos 2026) gerçek API model ID'leriyle
   eşleşiyor — dropdown'da görünen isim ile API'ye giden ID her zaman
   BİREBİR aynı değişkenden (aiEngine.getModel()) geliyor, koddaki başka
   hiçbir yerde eski bir model adı sabit yazılı değil. */
const AI_PROVIDERS = {
  anthropic: {
    label:"Anthropic (Claude)",
    models:[["claude-sonnet-5","Claude Sonnet 5 (önerilen)"],["claude-haiku-4-5-20251001","Claude Haiku 4.5 (hızlı/ucuz)"],["claude-opus-4-8","Claude Opus 4.8 (en güçlü)"]],
    defaultModel:"claude-sonnet-5",
    endpoint(){ return "https://api.anthropic.com/v1/messages"; },
    buildHeaders(key){ return {"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"}; },
    buildBody(model, system, userPrompt){ return JSON.stringify({model, max_tokens:900, system, messages:[{role:"user",content:userPrompt}]}); },
    extractText(data){ return ((data.content)||[]).filter(b=>b.type==='text').map(b=>b.text).join("\n"); },
    extractErr(data){ return data && data.error && data.error.message; },
    /* YENİ: sağlayıcıya özel kota/kredi metni tanıma — genel "API hatası"
       yerine kullanıcıya doğrudan anlaşılır bir mesaj vermek için. */
    isQuotaError(status, data){ let m=(data&&data.error&&data.error.message||"").toLowerCase(); return status===429 || m.includes("credit") || m.includes("quota") || m.includes("insufficient"); }
  },
  openai: {
    label:"OpenAI (GPT)",
    models:[["gpt-5.6-luna","GPT-5.6 Luna (önerilen, ucuz/hızlı)"],["gpt-5.6-terra","GPT-5.6 Terra (dengeli)"],["gpt-5.6-sol","GPT-5.6 Sol (en güçlü)"]],
    defaultModel:"gpt-5.6-luna",
    endpoint(){ return "https://api.openai.com/v1/chat/completions"; },
    buildHeaders(key){ return {"content-type":"application/json","authorization":"Bearer "+key}; },
    buildBody(model, system, userPrompt){ return JSON.stringify({model, max_tokens:900, messages:[{role:"system",content:system},{role:"user",content:userPrompt}]}); },
    extractText(data){ return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : ""; },
    extractErr(data){ return data && data.error && data.error.message; },
    isQuotaError(status, data){ let m=(data&&data.error&&data.error.message||"").toLowerCase(); let code=(data&&data.error&&data.error.code||"").toLowerCase(); return status===429 || code.includes("insufficient_quota") || m.includes("quota") || m.includes("credit") || m.includes("billing"); }
  },
  gemini: {
    label:"Google (Gemini)",
    /* YENİ: Gemini 2.0/2.5 serisi kademeli olarak emekliye ayrılıyor —
       varsayılan artık güncel 3.6 Flash. 2.5 Pro'nun ücretsiz kotası
       sık sık 0 olabildiği için BİLİNÇLİ OLARAK varsayılan yapılmadı. */
    models:[["gemini-3.6-flash","Gemini 3.6 Flash (önerilen)"],["gemini-3.5-flash-lite","Gemini 3.5 Flash-Lite (ucuz/hızlı)"],["gemini-3.1-pro","Gemini 3.1 Pro (en güçlü, ücretsiz kota kısıtlı olabilir)"]],
    defaultModel:"gemini-3.6-flash",
    endpoint(model,key){ return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`; },
    buildHeaders(){ return {"content-type":"application/json"}; },
    buildBody(model, system, userPrompt){ return JSON.stringify({contents:[{role:"user",parts:[{text:userPrompt}]}], systemInstruction:{parts:[{text:system}]}}); },
    extractText(data){ try{ return data.candidates[0].content.parts.map(p=>p.text).join("\n"); }catch(e){ return ""; } },
    extractErr(data){ return data && data.error && data.error.message; },
    isQuotaError(status, data){ let m=(data&&data.error&&data.error.message||"").toLowerCase(); return status===429 || m.includes("quota") || m.includes("resource_exhausted"); }
  }
};

const ADVISOR_ROLES = {
  finance:  {label:"Maliye Bakanı",              icon:"💰", cabinetTab:"finance"},
  foreign:  {label:"Dışişleri Bakanı",           icon:"🌍", cabinetTab:"foreign"},
  interior: {label:"İçişleri Bakanı",            icon:"⚖️", cabinetTab:"interior"},
  defense:  {label:"Savunma Bakanı",             icon:"🪖", cabinetTab:"defense"},
  cyber:    {label:"Siber Güvenlik Danışmanı",   icon:"💻", cabinetTab:null},
  strategy: {label:"Genel Strateji Danışmanı",   icon:"🧭", cabinetTab:null}
};

/* Her danışmanın odaklanacağı GERÇEK oyun verisi alanları — AI'a "sadece
   bu konulara bak" demek için. Kabine ekranındaki mevcut verilerle
   birebir aynı (madde: "Kabine verileri korunacak, danışmanlar bunu
   gerçekten kullanacak"). */
const ADVISOR_FOCUS = {
  finance:  "Bütçe, gelir/gider, fabrikalar, ekonomi, GSYH, kaynaklar.",
  foreign:  "Diplomatik ilişkiler, ittifaklar, savaşlar, anlaşmalar, ticaret, ambargolar, diplomatik durum.",
  defense:  "Ordu, silahlar, envanter, teknoloji, Tier, hava savunması, lojistik, istihbarat.",
  interior: "Halk desteği, istikrar, iç olaylar, ülkenin iç durumu.",
  cyber:    "Siber saldırılar, siber savunma, istihbarat, siber teknoloji.",
  strategy: "Ülkenin GENEL durumu — ekonomi, diplomasi, savaş, teknoloji ve diğer tüm alanları BİRLİKTE değerlendir."
};

/* YENİ: AI'ın önerebileceği/uygulayabileceği TEK yol bu tablo — AI asla
   kod çalıştırmaz, asla oyun kuralını değiştirmez; sadece bu ÖNCEDEN
   TANIMLI, halihazırda var olan motor fonksiyonlarından birinin adını
   döndürür. engine.applyAiAction() bu tabloyla eşleştirip, hedef/parametre
   geçerliliğini kontrol ettikten SONRA gerçek fonksiyonu çağırır. Böylece
   "işlemin geçerli olup olmadığını oyun motoru kontrol etsin" şartı motor
   seviyesinde, AI'dan bağımsız olarak sağlanır. */
const AI_ALLOWED_ACTIONS = {
  justify:                  {fn:()=>engine.diplomacy('justify'),                needsTarget:true},
  declare_war:              {fn:()=>engine.diplomacy('war'),                    needsTarget:true},
  send_envoy:               {fn:()=>engine.diplomacy('send_envoy'),             needsTarget:true},
  alliance:                 {fn:()=>engine.diplomacy('alliance'),               needsTarget:true},
  defense_pact:             {fn:()=>engine.diplomacy('defense_pact'),           needsTarget:true},
  free_trade:               {fn:()=>engine.diplomacy('free_trade'),             needsTarget:true},
  embargo:                  {fn:()=>engine.diplomacy('embargo'),                needsTarget:true},
  arms_embargo:              {fn:()=>engine.diplomacy('arms_embargo'),          needsTarget:true},
  sabotage:                 {fn:()=>engine.diplomacy('sabotage'),               needsTarget:true},
  blockade:                 {fn:()=>engine.diplomacy('blockade'),               needsTarget:true},
  steal_tech:               {fn:()=>engine.diplomacy('steal_tech'),             needsTarget:true},
  peace_offer_neutral:      {fn:()=>engine.diplomacy('peace_offer_neutral'),    needsTarget:true},
  peace_offer_reparations:  {fn:()=>engine.diplomacy('peace_offer_reparations'),needsTarget:true},
  peace_offer_cede:         {fn:()=>engine.diplomacy('peace_offer_cede'),       needsTarget:true},
  cyber_jam:                {fn:()=>engine.cyberOp('jam'),                     needsTarget:true},
  cyber_sabotage_prod:      {fn:()=>engine.cyberOp('sabotage_prod'),            needsTarget:true},
  cyber_financial:          {fn:()=>engine.cyberOp('financial'),                needsTarget:true},
  cyber_disinfo:            {fn:()=>engine.cyberOp('disinfo'),                  needsTarget:true},
  spy:                      {fn:()=>engine.doRecon('spy'),                      needsTarget:true},
  satellite:                {fn:()=>engine.doRecon('satellite'),                needsTarget:true},
  research:                 {fn:(a)=>engine.research(a.params.item),           needsTarget:false, needsParam:'item', validParam:v=>!!RESEARCH_COSTS[v]},
  set_tax:                  {fn:(a)=>{ state.taxRate = Math.max(0,Math.min(100, parseInt(a.params.value)||state.taxRate)); log(`🤖 AI komutu: Vergi oranı %${state.taxRate} olarak ayarlandı.`,"#a855f7"); ui.updateAll(); }, needsTarget:false, needsParam:'value'},
  none:                     {fn:()=>{}, needsTarget:false}
};

const aiEngine = {
  /* --- Ayarlar: SADECE tarayıcının kendi localStorage'ında saklanır,
     hiçbir Anthropic/Anthropic-dışı sunucuya gönderilmez. Kayıt kodu
     (generateCode) SADECE `state`'i içerir, bu anahtarlar state'in
     dışında olduğu için hiçbir paylaşılan kayıt koduna girmez. --- */
  getProvider(){ return localStorage.getItem('tayfun_ai_provider') || 'anthropic'; },
  setProvider(p){ if(AI_PROVIDERS[p]) localStorage.setItem('tayfun_ai_provider', p); },
  getApiKey(){ return localStorage.getItem('tayfun_ai_key_'+this.getProvider()) || ""; },
  setApiKey(k){ localStorage.setItem('tayfun_ai_key_'+this.getProvider(), (k||"").trim()); },
  clearApiKey(){ localStorage.removeItem('tayfun_ai_key_'+this.getProvider()); },
  getModel(){ return localStorage.getItem('tayfun_ai_model_'+this.getProvider()) || AI_PROVIDERS[this.getProvider()].defaultModel; },
  setModel(m){ localStorage.setItem('tayfun_ai_model_'+this.getProvider(), m); },
  isConfigured(){ return !!this.getApiKey(); },

  /* --- YENİ: AI İzni (madde 2) — API anahtarının GİRİLMİŞ olması bu izni
     OTOMATİK vermez, ayrı ayrı sorulur/saklanır. 3 durumu var:
     null   = henüz hiç sorulmadı (ilk kullanımda modal açılmalı)
     "yes"  = izin verildi
     "no"   = izin reddedildi --- */
  getConsent(){ return localStorage.getItem('tayfun_ai_consent'); },
  setConsent(v){ localStorage.setItem('tayfun_ai_consent', v ? "yes" : "no"); },
  hasConsent(){ return this.getConsent()==="yes"; },
  consentAsked(){ return this.getConsent()!==null; },

  /* Herhangi bir AI özelliği kullanılmadan HEMEN önce çağrılır. İzin
     hiç sorulmadıysa modalı açar ve false döner (çağıran taraf işlemi
     durdurmalı); izin zaten "hayır" ise kullanıcıya kısa bir hatırlatma
     gösterip false döner; "evet" ise true döner ve AI kullanılabilir. */
  ensureConsent(){
    if(!this.consentAsked()){ ui.openAiConsentModal(); return false; }
    if(!this.hasConsent()){ return false; }
    return true;
  },

  /* --- YENİ: Oyunun gerçek, o anki durumunu AI'a düzenli/güvenli
     biçimde aktarır. SADECE oyuncunun bilebileceği veriler gönderilir —
     Fog of War'a saygılı: istihbaratı/ittifakı olmayan ülkelerin
     asker/HSS detayı gönderilmez, sadece "bilinmiyor" yazılır. Böylece
     AI, oyuncunun elinde olmayan bilgiyi asla "biliyormuş gibi"
     davranamaz. Ayrıca AI'a HANGİ verinin mevcut olduğu açıkça
     belirtilir (madde 10) — olmayan bir geçmişi uydurması engellenir. */
  buildGameStateSummary(){
    if(!state) return {veriDurumu:"Şu anda aktif bir oyun YOK."};
    let p = state.player, me = state.countries[state.playerID];
    let digerUlkeler = [];
    for(let id in state.countries){
      if(id===state.playerID) continue;
      let c = state.countries[id];
      let canSee = c.alliedWithPlayer || (p.tech && p.tech.cyber) || c.scouted;
      digerUlkeler.push({
        id, isim:c.name, iliskiPuani:c.relation, savasHalindeMi:c.relation<=0,
        ittifakVar:!!c.alliedWithPlayer, eleGecirildi:!!c.eliminated,
        guçKademesiTier: (typeof countryTier==='function'?countryTier(id):null),
        istikrar: canSee ? c.stability : "bilinmiyor (istihbarat yok)"
      });
    }
    let totalFactories = getPlayerCities().reduce((a,c)=>a+(c.factories?Object.values(c.factories).reduce((x,y)=>x+y,0):0),0);
    return {
      veriDurumu:"Bu SADECE bu oturumdaki AKTİF oyunun güncel verisidir. Bundan önceki hiçbir oyunu/turu hatırlamıyorsun, hatırlıyormuş gibi davranma.",
      tur:state.turn, zorlukSeviyesi:state.difficulty, globalTansiyon:state.globalTension,
      oyuncu:{
        ulkeAdi:me.name, ulkeId:state.playerID, hazine:p.budget, gsyh:p.gdp,
        istikrar:p.stability, halkDestegi:Math.round(p.publicSupport), vergiOrani:state.taxRate,
        hammadde:p.resources, edinilmisTeknolojiler:Object.keys(p.tech).filter(k=>p.tech[k]),
        envanter:p.inventory, fabrikaSayisi:totalFactories,
        siberSavunmaSeviyesi:(typeof getEffectiveCyberDefense==='function'?getEffectiveCyberDefense():p.cyberDefenseLevel),
        sehirler:getPlayerCities().map(c=>({isim:c.name, sahip:c.owner===state.playerID}))
      },
      digerUlkeler
    };
  },

  /* YENİ: "Ülkeyle Konuş" sistemi için tek bir hedef ülkenin (veya grubun)
     bakış açısından ek bağlam — o ülkenin/grubun oyuncuyla ilişkisi,
     ittifakları, mevcut savaş durumu. Genel özete EK olarak gönderilir. */
  buildCountryContext(participantIds){
    if(!state) return {};
    return participantIds.map(id=>{
      let c = state.countries[id];
      if(!c) return {id, hata:"ülke bulunamadı"};
      return {
        id, isim:c.name, oyuncuIlliskisi:c.relation, oyuncuylaSavastaMi:c.relation<=0,
        oyuncuylaIttifaki:!!c.alliedWithPlayer, eleGecirildi:!!c.eliminated,
        guçKademesiTier: countryTier(id),
        diplomatikTon: (typeof DIPLOMATIC_TONE!=='undefined' && DIPLOMATIC_TONE[id]) || "nötr, resmi bir diplomatik ton"
      };
    });
  },

  SYSTEM_PROMPT_BASE:
    "Sen TAYFUN adlı bir jeopolitik strateji oyununda oyuncuya yardımcı olan bir yapay zekâ danışmansın. " +
    "SADECE sana JSON olarak verilen güncel oyun durumuna dayan; bu veri dışında HİÇBİR bilgi (gerçek dünya haberleri, " +
    "tahmini/uydurma rakamlar, oyunda olmayan sistemler, önceki bir oyun/oturuma dair anı) UYDURMA — bilmediğin bir şey " +
    "sorulursa veya sana verilmemiş bir geçmişse açıkça 'bu bilgi bende yok' de. Cevaplarını Türkçe, kısa ve somut ver.",

  /* ================= YENİ: GENİŞLETİLMİŞ HATA SINIFLANDIRMASI =================
     400/401/403/404/429/kota-kredi/model bulunamadı/timeout/ağ hatası/
     sağlayıcı çalışmıyor — HEPSİ ayrı ayrı yakalanıp anlaşılır bir Türkçe
     mesaja çevrilir. Hiçbir durumda oyun çökmez, her zaman "oyun normal
     şekilde devam ediyor" ile biter (o mesajı çağıran taraf ekler). */
  async callAI(systemPrompt, userPrompt, {timeoutMs=25000}={}){
    let providerId = this.getProvider();
    let provider = AI_PROVIDERS[providerId];
    let key = this.getApiKey();
    if(!key) throw new Error("API anahtarı girilmemiş. AI Merkezi → Ayarlar'dan ekleyebilirsiniz.");
    let model = this.getModel();
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), timeoutMs);
    let res;
    try{
      res = await fetch(provider.endpoint(model,key), {
        method:"POST",
        headers:provider.buildHeaders(key),
        body:provider.buildBody(model, systemPrompt, userPrompt),
        signal:controller.signal
      });
    } catch(e){
      clearTimeout(timer);
      if(e.name==='AbortError') throw new Error("AI isteği zaman aşımına uğradı (bağlantı çok yavaş ya da sağlayıcı yanıt vermiyor).");
      throw new Error("AI sunucusuna bağlanılamadı (internet bağlantınız yok ya da sağlayıcı şu anda geçici olarak ulaşılamıyor).");
    }
    clearTimeout(timer);
    let data = null;
    try{ data = await res.json(); }catch(e){ /* boş/parse edilemeyen cevap */ }
    if(!res.ok){
      if(provider.isQuotaError(res.status, data)){
        throw new Error(`${provider.label} API kredisi/kotası bulunmuyor. Sağlayıcı hesabınızı kontrol edin — oyun normal şekilde devam ediyor.`);
      }
      let providerMsg = data && provider.extractErr(data);
      const STATUS_MSG = {
        400:"İstek biçimi geçersiz (400) — muhtemelen seçili model bu sağlayıcıda artık desteklenmiyor.",
        401:"API anahtarı geçersiz veya yanlış (401) — Ayarlar'dan anahtarınızı kontrol edin.",
        403:"Bu işlem için yetkiniz yok (403) — API anahtarınızın izinlerini/faturalandırmasını kontrol edin.",
        404:"Seçili model bulunamadı (404) — bu model artık kullanılamıyor olabilir, Ayarlar'dan başka bir model seçin.",
        429:"İstek limiti aşıldı (429) — birkaç saniye sonra tekrar deneyin.",
        500:"Sağlayıcının sunucusunda geçici bir sorun var (500).",
        503:"Sağlayıcı şu anda geçici olarak hizmet veremiyor (503)."
      };
      let friendly = STATUS_MSG[res.status] || `HTTP ${res.status} hatası.`;
      throw new Error(`${provider.label}: ${friendly}${providerMsg?" ("+providerMsg+")":""}`);
    }
    let text = data ? provider.extractText(data) : "";
    if(!text || !text.trim()) throw new Error(`${provider.label}'dan boş/anlaşılamayan bir cevap geldi (model yanıt vermemiş olabilir).`);
    return text;
  },

  /* AI cevabının sonunda isteğe bağlı "###ACTION_JSON### {...}" bloğu
     olabilir — bu, cevabın gösterilecek metninden ayrıştırılıp somut bir
     "önerilen işlem"e çevrilir. Format hatalıysa sessizce yok sayılır
     (asla hata fırlatmaz), sadece metin gösterilir. */
  extractAction(text){
    const marker = "###ACTION_JSON###";
    let idx = text.indexOf(marker);
    if(idx===-1) return {display:text.trim(), action:null};
    let display = text.slice(0, idx).trim();
    let jsonPart = text.slice(idx+marker.length).trim().replace(/```json|```/g,"").trim();
    try{ return {display, action:JSON.parse(jsonPart)}; }
    catch(e){ return {display, action:null}; }
  },

  async askAdvisor(role){
    let allowedList = Object.keys(AI_ALLOWED_ACTIONS).filter(k=>k!=='none').join(", ");
    let sys = this.SYSTEM_PROMPT_BASE +
      `\nRolün: ${ADVISOR_ROLES[role].label}. SADECE şu alana odaklan, diğer alanlara girme: ${ADVISOR_FOCUS[role]} ` +
      `Cevabın en fazla 120 kelime, somut ve verilen JSON oyun durumuna dayanmalı. ` +
      `Eğer izinli eylemlerden biriyle somut bir işlem önerebiliyorsan, cevabının EN SONUNA yeni bir satırda "###ACTION_JSON###" yaz, ` +
      `ardından SADECE şu formatta bir JSON ekle (başka hiçbir açıklama ekleme): {"action":"<izinli eylem>","target":"<ülke id, gerekmiyorsa null>","params":{},"explanation":"<kısa Türkçe açıklama>"}. ` +
      `İzinli eylemler: ${allowedList}. target SADECE şu id'lerden biri olabilir: ${Object.keys(state.countries).join(", ")}. ` +
      `Somut bir öneri yoksa JSON bloğunu HİÇ ekleme.`;
    let userPrompt = "Güncel oyun durumu (JSON):\n" + JSON.stringify(this.buildGameStateSummary());
    let raw = await this.callAI(sys, userPrompt);
    return this.extractAction(raw);
  },

  async chat(userMessage){
    let allowedList = Object.keys(AI_ALLOWED_ACTIONS).filter(k=>k!=='none').join(", ");
    let sys = this.SYSTEM_PROMPT_BASE +
      `\nBu serbest bir sohbet. Oyuncunun sorularını verilen JSON oyun durumuna dayanarak Türkçe cevapla. ` +
      `JSON'da olmayan bilgiyi ASLA uydurma. Eğer oyuncunun isteği doğrudan somut bir oyun içi işlemse ` +
      `(örn. "X ülkesine savaş aç", "Y ile ticaret anlaşması yap"), cevabının sonuna "###ACTION_JSON###" ile ` +
      `{"action":"<izinli eylem>","target":"<ülke id ya da null>","params":{},"explanation":"<kısa>"} ekleyebilirsin ` +
      `(izinli eylemler: ${allowedList}; target id'leri: ${Object.keys(state.countries).join(", ")}), aksi halde eklemene gerek yok.`;
    let userPrompt = "Güncel oyun durumu (JSON):\n" + JSON.stringify(this.buildGameStateSummary()) + "\n\nOyuncunun mesajı: " + userMessage;
    let raw = await this.callAI(sys, userPrompt);
    return this.extractAction(raw);
  },

  /* Doğal dilde komut modu — burada AI'dan SADECE ham, saf JSON istiyoruz
     (marker'sız), çünkü bu mod başka bir metinle karışmayacak ayrı bir
     giriş alanı. Motor yine de marker'lı gelirse onu da tolere eder. */
  async parseCommand(commandText){
    let allowedList = Object.keys(AI_ALLOWED_ACTIONS).join(", ");
    let sys = this.SYSTEM_PROMPT_BASE +
      `\nGÖREV: Oyuncunun doğal dilde yazdığı komutu, oyun motorunun uygulayabileceği YAPILANDIRILMIŞ bir işleme çevir. ` +
      `SADECE şu JSON formatında cevap ver, başına/sonuna ASLA başka metin ekleme: ` +
      `{"action":"<izinli eylem>","target":"<ülke id ya da null>","params":{},"explanation":"<Türkçe kısa açıklama>"}. ` +
      `İzinli eylemler (başka HİÇBİR değer kabul edilmez): ${allowedList}. ` +
      `Komut bu eylemlerden hiçbirine uymuyorsa action:"none" döndür. ` +
      `target alanı SADECE şu ülke id'lerinden biri olabilir (başka değer YASAK): ${Object.keys(state.countries).join(", ")}.`;
    let userPrompt = "Güncel oyun durumu (JSON):\n" + JSON.stringify(this.buildGameStateSummary()) + "\n\nOyuncunun komutu: " + commandText;
    let raw = await this.callAI(sys, userPrompt);
    let cleaned = raw.replace(/```json|```/g,"").trim();
    try{ return JSON.parse(cleaned); }
    catch(e){
      let ext = this.extractAction(raw);
      if(ext.action) return ext.action;
      throw new Error("AI'dan geçerli bir komut formatı alınamadı (beklenmeyen cevap biçimi).");
    }
  },

  /* ================= YENİ: 🌍 ÜLKEYLE KONUŞ =================
     Tek ya da birden fazla ülke (grup) adına, o ülke(ler)in gerçek
     durumuna göre karakterli bir cevap üretir. Somut bir diplomatik
     teklifse (madde 7) ###ACTION_JSON### ile aynı formatta bir öneri
     eklenebilir — yine SADECE AI_ALLOWED_ACTIONS'taki eylemler. */
  async chatWithCountries(participantIds, history, userMessage){
    let names = participantIds.map(id=>state.countries[id]?state.countries[id].name:id);
    let isGroup = participantIds.length>1;
    let context = this.buildCountryContext(participantIds);
    let allowedList = Object.keys(AI_ALLOWED_ACTIONS).filter(k=>k!=='none').join(", ");
    let sys = this.SYSTEM_PROMPT_BASE +
      (isGroup
        ? `\nSen şu ülkelerden oluşan bir koalisyonu TEK bir ortak sesle temsil ediyorsun: ${names.join(", ")}. `
        : `\nSen ${names[0]} adlı ülkeyi (hükümetini) temsil ediyorsun. `) +
      `Aşağıda verilen "ulkeBaglami" içindeki gerçek ilişki/savaş/ittifak durumuna ve "diplomatikTon" alanına uygun, karakterli ama KISA (en fazla 80 kelime) bir cevap ver — oyuncunun temsil ettiği ülkenin bakış açısını YANSITMA, SEN karşı taraf olarak cevap ver. ` +
      `Oyuncunun mesajı somut bir diplomatik teklifse (ticaret anlaşması, ittifak, savunma anlaşması, barış, savaş tehdidi, ambargo, ekonomik yardım, kaynak/ekipman anlaşması, istihbarat paylaşımı vb.), cevabının EN SONUNA yeni bir satırda "###ACTION_JSON###" yaz, ardından SADECE şu formatta bir JSON ekle: {"action":"<izinli eylem>","target":"<ülke id>","params":{},"explanation":"<kısa Türkçe açıklama>"}. ` +
      `İzinli eylemler: ${allowedList}. target SADECE şu id'lerden biri olabilir: ${participantIds.join(", ")}` +
      (isGroup ? " (GRUP sohbetlerinde işlem önerisi SADECE tek bir hedefe yönelik olabilir, grubun tamamına birden değil)." : ".") +
      ` Somut bir teklif/cevap değilse JSON bloğunu HİÇ ekleme.`;
    let userPrompt = "Oyuncunun genel oyun durumu (JSON):\n" + JSON.stringify(this.buildGameStateSummary()) +
      "\n\nBu sohbetteki ülke(ler)in bağlamı (JSON):\n" + JSON.stringify(context) +
      "\n\nBu sohbetin önceki mesajları:\n" + JSON.stringify((history||[]).slice(-10)) +
      "\n\nOyuncunun yeni mesajı: " + userMessage;
    let raw = await this.callAI(sys, userPrompt);
    return this.extractAction(raw);
  }
};

/* Bir mühimmatın hangi hava savunma katmanı tarafından karşılanacağı.
   kara_birligi kara birliği olduğu için hava savunmasına hiç takılmaz
   (gameLoop'ta zaten ayrıca hariç tutuluyor). */
function getDefenseLayer(type){
  if(type==='drone_swarm' || type==='cruise_missile') return 'short';
  if(type==='ballistic_icbm' || type==='nuke') return 'long';
  return 'medium'; // ballistic_short, ballistic_medium, gen5_jet
}
/* YENİ: ownerId/playerId verilirse AI ülkelerinin ev sahibi savunma
   stoğu %30 daha fazla olur (senin ile aynı şehri oyuncu elinde
   tutsaydı bu bonus olmazdı) — bkz. buildInitialState ve
   resolveGroundAssault (ele geçirilince yeniden hesaplanıyor). Parametre
   verilmezse (eski çağrılar) davranış DEĞİŞMEZ — %100 aynı cap. */
function freshLayeredHSS(baseCap, ownerId, playerId){
  let mult = (ownerId!==undefined && playerId!==undefined && ownerId!==playerId) ? 1.3 : 1.0;
  let cap = Math.round(baseCap*mult);
  return { short:{cap,current:cap}, medium:{cap,current:cap}, long:{cap,current:cap} };
}

/* YENİ: Hedefe ulaşabilecek partiler arasından en "ekonomik" (en dar/yeterli
   menzilli) olanı seçer — 13.000km'lik nadir bir parti varsa onu sadece
   gerçekten gerektiğinde kullanır, günlük atışlarda 12.000km'lik standart
   partiyi tüketir. applyRangeMult=false ile çağrılırsa (çıkarma/hava indirme
   harekâtı gibi sabit menzilli silahlar için) menzil kontrolü çarpansız
   yapılır, sadece hasar profili için parti seçilir. */
function pickBestBatch(item, requiredRange, applyRangeMult=true, fixedRangeOverride=null){
  let cfg = WEAPON_CONFIG[item];
  let baseRange = fixedRangeOverride!==null ? fixedRangeOverride : cfg.range;
  let batches = (state.player.batches[item] || []).filter(b=>b.qty>0);
  if(batches.length===0) return {batch:null, reason:'empty'};
  let effRangeOf = b => applyRangeMult ? baseRange*(b.rangeMult||1) : baseRange;
  let reach = batches.filter(b => effRangeOf(b) >= requiredRange);
  if(reach.length===0){
    let maxRange = Math.max(...batches.map(effRangeOf));
    return {batch:null, reason:'range', maxRange};
  }
  reach.sort((a,b)=> effRangeOf(a)-effRangeOf(b));
  return {batch:reach[0], reason:'ok', effRange:effRangeOf(reach[0])};
}

/* YENİ: Yönetim Biçimi — devrimle değiştirilebilir, her biri farklı
   ekonomi/üretim/Ar-Ge/savaş-yorgunluğu dengesi sunar. */
/* YENİ: Zorluk seviyesi — AI'nin savaş açma agresifliğini, büyüme hızını
   ve küçük ülkelerin (düşük tier) ekonomik dezavantajını etkiler. */
const DIFFICULTY_CONFIG = {
  easy:  {label:"Kolay",  aiWarChanceMult:0.5, aiGrowthMult:0.8, smallCountryUpkeepMult:0.8},
  normal:{label:"Normal", aiWarChanceMult:1.0, aiGrowthMult:1.0, smallCountryUpkeepMult:1.0},
  hard:  {label:"Zor",    aiWarChanceMult:1.6, aiGrowthMult:1.3, smallCountryUpkeepMult:1.3}
};
/* YENİ: Tier'e göre ekonomi zorluğu — küçük/zayıf ülkeler (Tier 4-5) daha
   yüksek oransal bakım maliyeti öder, süper güçler (Tier 1) neredeyse hiç
   etkilenmez. Zorluk seviyesiyle çarpılır. */
function tierUpkeepMult(){
  let tier = STARTING_STATS[state.playerID] ? STARTING_STATS[state.playerID].tier : 3;
  let base = 1 + (tier-1)*0.12; // Tier1: 1.0x, Tier5: 1.48x
  return base * DIFFICULTY_CONFIG[state.difficulty||"normal"].smallCountryUpkeepMult;
}

/* YENİ: Hava Savunması artık Tier'a göre değişiyor — sabit %30/%15 önleme
   şansı kaldırıldı. Tier 1 (süper güç) çok daha güçlü hava savunmasına
   sahipken Tier 5 neredeyse savunmasız. Saldıranın Tier'i de savunmayı
   kısmen zayıflatır (güçlü saldırgan savunmayı daha kolay aşar). */
function countryTier(id){
  let s = STARTING_STATS[id];
  return s ? s.tier : 3; // bloklar/bilinmeyenler Tier 3 (orta) sayılır
}
function tierDefenseBonus(id){
  return (5 - countryTier(id)) * 0.045; // Tier1: +0.18, Tier3: +0.09, Tier5: 0
}
function tierAttackPenalty(id){
  return (5 - countryTier(id)) * 0.025; // güçlü saldırgan (düşük tier) savunmayı biraz zayıflatır
}

/* YENİ: Lojistik / Uzak Cephe Cezası — ana bölgeden (en yakın sahip
   olunan şehir) uzaklaştıkça saldırının etkinliği düşer. 2.500km'e kadar
   ceza yok, sonrasında kademeli olarak hasar/başarı azalır (en fazla ~%35). */
function logisticsDamageMult(distKm){
  let over = Math.max(0, distKm - 2500);
  return Math.max(0.6, 1 - over/32000);
}
function logisticsSuccessPenalty(distKm){
  let over = Math.max(0, distKm - 3000);
  return Math.min(0.3, over/40000);
}

/* YENİ: Fabrikalar — şehir bazlı inşa edilir, hammadde+para maliyeti var,
   her biri farklı bir ekonomik/askeri bonus sağlar. Haritada şehrin
   yanında küçük bir simge olarak görünür (bkz. ui.buildMap()). */
const FACTORY_CONFIG = {
  heavy_industry: {label:"Ağır Sanayi Kompleksi", icon:"🏭", cost:150000, resourceCost:15, incomeBonus:25000},
  trade_center:   {label:"Ticaret Merkezi",       icon:"🏛️", cost:300000, resourceCost:10, incomeBonus:60000},
  military_base:  {label:"Askeri Üs",             icon:"⛺", cost:200000, resourceCost:20, freeTroops:1},
  intel_agency:   {label:"İstihbarat Ajansı",     icon:"🛰️", cost:250000, resourceCost:12, cyberDefenseBonus:1},
  tech_institute: {label:"Teknoloji Enstitüsü",   icon:"🔬", cost:400000, resourceCost:25, researchSpeedBonus:0.08}
};

const IDEOLOGY_CONFIG = {
  democracy:   {label:"Demokrasi",  incomeMult:1.20, prodCostMult:1.0, researchMult:1.0,  warSupportPenaltyMult:1.3},
  autocracy:   {label:"Otokrasi",   incomeMult:0.95, prodCostMult:0.7, researchMult:1.0,  warSupportPenaltyMult:0.8},
  technocracy: {label:"Teknokrasi", incomeMult:1.0,  prodCostMult:1.0, researchMult:0.65, warSupportPenaltyMult:1.0}
};
/* YENİ: Yasalar — bağımsız açılıp kapatılabilir, kalıcı etkiler. */
const LAW_LABELS = {martial:"Sıkıyönetim", draft:"Zorunlu Askerlik", openborders:"Açık Sınırlar"};

/* YENİ: AI ülke doktrinleri — her AI artık aynı davranmıyor. Saldırgan
   düşük ilişkide çabuk savaşa girer, izolasyonist neredeyse hiç girmez,
   intikamcı sadece geçmişte kendisine saldırılmışsa (warTurns>0 olmuşsa)
   agresifleşir. Deterministik atanır (ülke id'sine göre) — aynı ülke her
   oyunda aynı doktrine sahip olur, bu da AI'yi "tanınabilir" kılar. */
const DOCTRINES = {
  aggressive:   {label:"Saldırgan",     warThreshold:25, warChance:0.08},
  isolationist: {label:"İzolasyonist",  warThreshold:-999, warChance:0.004},
  vengeful:     {label:"İntikamcı",     warThreshold:30, warChance:0.04}
};
/* ================= YENİ: DOKTRİN ATAMASI ARTIK RASTGELE =================
   ESKİ HATA: assignDoctrine() sadece ülke id'sinin harflerine bakan sabit
   bir hash kullanıyordu — yani örneğin İran HER OYUNDA birebir aynı
   doktrini (İntikamcı) alıyordu, hiç varyasyon yoktu. Düşük başlangıç
   ilişkisiyle (örn. İran-ABD) birleşince bu, "her oyunda aynı ülke bana
   savaş açıyor" hissine yol açıyordu. Artık her YENİ oyunda (buildInitialState
   çağrıldığında) gerçekten rastgele atanıyor — bir ülke bir oyunda
   Saldırgan, başka bir oyunda İzolasyonist olabilir. */
function assignDoctrine(id){
  let keys = Object.keys(DOCTRINES);
  return keys[Math.floor(Math.random()*keys.length)];
}

function buildInitialState(playerId, difficulty="normal"){
  let stats = STARTING_STATS[playerId];
  let countries = {};

  for(let id in GEO_DATA){
    let g = GEO_DATA[id];
    let relation = id===playerId ? 100 : ((BASE_RELATIONS[playerId] && BASE_RELATIONS[playerId][id]!==undefined) ? BASE_RELATIONS[playerId][id] : 50);
    /* YENİ: AI ülkeleri de oyuncu gibi GERÇEK bir envanterle başlar
       (BASE_INVENTORY * kendi invMult'u) ve her tur büyür (bkz. nextTurn
       içindeki "AI envanter büyümesi"). Savaşa girdiklerinde bu gerçek
       stoktan karşılık verirler — tek bir anlatısal "1 füze" değil. */
    let aiInv = {};
    let aiMult = (id!==playerId && STARTING_STATS[id]) ? STARTING_STATS[id].invMult : 0;
    if(id!==playerId) for(let k in BASE_INVENTORY) aiInv[k] = Math.round(BASE_INVENTORY[k]*aiMult*0.6);
    countries[id] = {
      name:g.name, color:g.color, isBloc:false, canDeclareWar:true,
      relation, stability:START_STABILITY[id],
      casusBelli:false, embargo:false, armsEmbargo:false, freeTrade:false, defensePact:false, airspaceBanned:false,
      alliedWithPlayer:id===playerId, scouted:false, doctrine:assignDoctrine(id), warBuildup:0,
      eliminated:false, warTurns:0, blockaded:0, radarJammed:0,
      inventory: id===playerId ? null : aiInv, // oyuncunun kendi envanteri zaten state.player.inventory'de tutuluyor
      // YENİ: baseHssCap = haritadaki HAM değer (sahiplik değişse de sabit
      // kalır) — hss ise o anki sahibe göre çarpanlı GERÇEK stok.
      cities: g.cities.map(c => ({ name:c.name, lat:c.lat, lon:c.lon, hp:100, resistance:100, owner:id, baseHssCap:c.hssCap, hss:freshLayeredHSS(c.hssCap, id, playerId), factories:{} }))
    };
  }
  /* YENİ: 6 kıta bloğu — orta seviye güçte, savaş açamaz/gelişemez ama
     oyuncu tarafından hedef alınabilir bir aktör olarak state.countries'e
     dahil ediliyor. */
  for(let id in BLOC_DATA){
    let b = BLOC_DATA[id];
    let relation = (BASE_RELATIONS[playerId] && BASE_RELATIONS[playerId][id]!==undefined) ? BASE_RELATIONS[playerId][id] : 50;
    countries[id] = {
      name:b.name, color:b.color, isBloc:true, canDeclareWar:false,
      relation, stability:BLOC_START_STABILITY[id],
      casusBelli:false, embargo:false, armsEmbargo:false, freeTrade:false, defensePact:false,
      alliedWithPlayer:false, scouted:false,
      eliminated:false, warTurns:0, blockaded:0, radarJammed:0,
      cities: b.cities.map(c => ({ name:c.name, lat:c.lat, lon:c.lon, hp:100, resistance:100, owner:id, baseHssCap:c.hssCap, hss:freshLayeredHSS(c.hssCap, id, playerId), factories:{} }))
    };
  }

  let inventory = {}; for(let k in BASE_INVENTORY) inventory[k] = Math.round(BASE_INVENTORY[k]*stats.invMult);
  /* YENİ: Parti (batch) bazlı envanter — customLoadout'un yerini alıyor.
     Her silah tipi artık {qty, rangeMult, dmgMult} partilerinden oluşan bir
     dizi tutuyor. Böylece "3 tane 12.000km'lik ICBM + 1 tane 13.000km'lik
     ICBM" gibi karışık envanterler GERÇEKTEN ayrı ayrı takip edilebiliyor —
     ATEŞLE'ye basınca sistem hedefe yetecek en ekonomik partiyi otomatik
     seçiyor (bkz. pickBestBatch()). Sadece menzilli/özelleştirilebilir
     silahlar (nuke/tank/frigate hariç) parti tutuyor. */
  let batches = {};
  for(let k of ["drone_swarm","ballistic_short","ballistic_medium","ballistic_icbm","kara_birligi","gen5_jet"]){
    batches[k] = inventory[k]>0 ? [{qty:inventory[k], rangeMult:1, dmgMult:1}] : [];
  }
  return {
    turn:1, globalTension:0, playerID:playerId, selectedID: Object.keys(GEO_DATA).find(id=>id!==playerId),
    gameOver:false, sanctionRemaining:0,
    taxRate:30, refugeeLevel:0, unResolutions:[], unNukeCap:5, govCrisisTurns:0, difficulty,
    // YENİ: Yönetim biçimi ve yasalar
    player:{
      budget:stats.budget, manpower:stats.manpower, stability:100, publicSupport:100, uranium:stats.uranium,
      // YENİ: GSYH artık Hazine'den (p.budget) TAMAMEN AYRI, gerçek bir
      // ekonomik büyüklük göstergesi. Hazine devletin harcanabilir nakdi,
      // GSYH ülkenin toplam ekonomik gücüdür — vergi/harcama GSYH'yi
      // doğrudan düşürmez, sadece nextTurn()'deki kendi büyüme formülüyle
      // değişir (bkz. nextTurn -> "YENİ: GSYH BÜYÜMESİ"). Başlangıç değeri
      // gerçek devlet bütçelerinin GSYH'nin bir kesri olması mantığıyla
      // Hazine'nin birkaç katı olarak kuruldu.
      gdp: Math.round(stats.budget*3.2),
      tech:{nuclear:!!stats.nuclear, cyber:false, radar:false, gen5_jet:false, hss_adv:false, mrbm:false, icbm:false, air_refuel:false},
      inventory, batches, productionQueue:[], researchQueue:[], pendingOps:[],
      ideology:"democracy", laws:{martial:false, draft:false, openborders:false},
      resources:stats.resources||10, cyberDefenseLevel:0, cyberAttemptsThisTurn:{},
      /* YENİ: AI sohbet/oturum verileri BİLİNÇLİ OLARAK state.player
         içinde tutulur (localStorage'daki API anahtarından TAMAMEN
         AYRI) — böylece: (1) yeni oyunda otomatik boş başlar, (2) kayıt
         kodu ile paylaşılırsa SADECE o kayda ait konuşmalar taşınır,
         (3) AI asla "önceki bir oyunu hatırlıyormuş" gibi davranamaz,
         çünkü elindeki veri fiziksel olarak bu oyunun state'inden başka
         bir yerden gelmiyor. */
      aiChatLog: [],        // 💬 Genel AI Sohbet geçmişi
      aiCountryChats: [],   // 🌍 Ülkeyle Konuş oturumları: [{id,participants,title,messages,createdTurn}]
      /* YENİ: Saldırı Gecikmesi — oyuncunun saldırıları artık ANINDA
         sonuçlanmıyor. Mermi görsel olarak hedefe ulaşır (createExplosion
         vs. hâlâ anında), ama gerçek hasar/ilhak SONUCU bu kuyruğa
         eklenir ve ancak bir sonraki tur raporu kapatıldıktan 1 saniye
         sonra işlenir (bkz. engine.processPendingAttacks, ui.closeTurnReport).
         Böylece oyuncu turu atlamadan tek turda tam ilhak yapamaz —
         düşmana karşılık verme fırsatı doğar. */
      pendingAttackResolutions: [],
      pendingNukeCrisis: false, // YENİ: nükleer üretim krizi bayrağı (bkz. checkNukeCrisis)
      history:{turn:[], budget:[], gdp:[], support:[], stability:[], tech:[]}
    },
    countries
  };
}

/* YENİ: Teknoloji Enstitüsü fabrikaları Ar-Ge süresini kısaltır (kümülatif,
   en fazla %60'a kadar). İstihbarat Ajansı fabrikaları siber savunma
   seviyesine eklenir. */
function getResearchSpeedMult(){
  let bonus = 0;
  getPlayerCities().forEach(city=>{ if(city.factories) bonus += (city.factories.tech_institute||0)*FACTORY_CONFIG.tech_institute.researchSpeedBonus; });
  return Math.max(0.4, 1-bonus);
}
function getEffectiveCyberDefense(){
  let bonus = 0;
  getPlayerCities().forEach(city=>{ if(city.factories) bonus += (city.factories.intel_agency||0)*FACTORY_CONFIG.intel_agency.cyberDefenseBonus; });
  return state.player.cyberDefenseLevel + bonus;
}

let state = null;

/* ---- yardımcı fonksiyonlar ---- */
function getOwnedCities(countryId){ return state.countries[countryId].cities.filter(c=>c.owner===countryId); }
function getAllCitiesOwnedBy(ownerId){
  let list = [];
  for(let id in state.countries) state.countries[id].cities.forEach(c => { if(c.owner===ownerId) list.push(c); });
  return list;
}
function getPlayerCities(){ return getAllCitiesOwnedBy(state.playerID); }
function nearestOwnedCity(ownerId, targetCity){
  let owned = getAllCitiesOwnedBy(ownerId);
  if(owned.length===0) return null;
  let best = owned[0], bestDist = distanceKm(best.lat,best.lon,targetCity.lat,targetCity.lon);
  for(let c of owned){ let d = distanceKm(c.lat,c.lon,targetCity.lat,targetCity.lon); if(d<bestDist){best=c; bestDist=d;} }
  return {city:best, dist:bestDist};
}

const QUOTES = {
  hostile: ["Sizinle görüşecek hiçbir şeyimiz kalmadı.","Bu saldırganlığın bedelini ödeyeceksiniz.","Ordumuz son askerine kadar direnecek.","Diplomasi kapısı sizin yüzünüze kapandı."],
  low: ["Niyetinizden şüpheliyiz.","Sınırlarımızdaki hareketliliği yakından izliyoruz.","Güven inşa etmek için somut adımlar bekliyoruz.","Bölgesel dengeyi bozacak adımlara karşıyız."],
  mid: ["İlişkilerimizin gelişmesinden memnunuz.","Karşılıklı çıkarlarımızı gözeten bir diyalog sürdürüyoruz.","Ticaret ve diplomasi kanallarımız açık.","Bölgesel istikrar için işbirliğine hazırız."],
  high: ["Sizi güvenilir bir ortak olarak görüyoruz.","Dostluğumuz iki halk için de değerli.","Her konuda yanınızdayız.","İttifakımız bölgesel barışın teminatı."],
  eliminated: ["...(hükümetten yanıt gelmiyor — devlet otoritesi çökmüş durumda)"]
};
function pickQuote(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

const saveSystem = {
  save(){
    try{
      localStorage.setItem("tayfun_save_v13", JSON.stringify(state));
      log("💾 Oyun kaydedildi. (Not: kayıt sadece bu tarayıcı/cihazda saklanır)","#00ff66");
    }catch(e){ log("❌ Kaydetme başarısız: tarayıcı depolaması engellenmiş olabilir (gizli sekme?).","red"); }
  },
  load(){
    try{
      let s = localStorage.getItem("tayfun_save_v13");
      if(!s){ log("Kayıt bulunamadı.","yellow"); return; }
      let parsed = JSON.parse(s);
      if(!parsed || !parsed.player || !parsed.countries){ log("❌ Kayıt bozuk veya eski bir sürümden kalma, yüklenemedi.","red"); return; }
      state = parsed;
      /* YENİ: aynı güvenlik ağı burada da — eski kayıtlarda bu alanlar
         olmayabilir (bkz. loadCode() üzerindeki aynı not). */
      if(!Array.isArray(state.player.aiChatLog)) state.player.aiChatLog = [];
      if(!Array.isArray(state.player.aiCountryChats)) state.player.aiCountryChats = [];
      if(!Array.isArray(state.player.pendingAttackResolutions)) state.player.pendingAttackResolutions = [];
      /* YENİ: eski kayıtlarda AI ülkelerinin gerçek envanteri hiç
         olmayabilir — eksikse güvenle sıfırdan oluştur. */
      for(let cid in state.countries){
        let c = state.countries[cid];
        if(cid!==state.playerID && !c.isBloc && !c.inventory){
          let inv={}; let m = STARTING_STATS[cid]?STARTING_STATS[cid].invMult:0.4;
          for(let k in BASE_INVENTORY) inv[k] = Math.round(BASE_INVENTORY[k]*m*0.6);
          c.inventory = inv;
        }
      }
      ui.buildMap(); ui.updateAll();
      log("📂 Kayıt yüklendi.","#00ff66");
    }catch(e){ log("❌ Kayıt okunamadı (bozuk veri).","red"); }
  },
  reset(){ try{ localStorage.removeItem("tayfun_save_v13"); }catch(e){} location.reload(); }
};

/* ---- BM Güvenlik Konseyi yardımcıları ---- */
function resolveUNVote(targetId){
  let player = state.playerID;
  // YENİ: hedef ülke artık oylamadan tamamen hariç tutulmuyor — kendi
  // aleyhine oy kullanır (ret) ve eğer P5 üyesiyse (ABD/Rusya/Çin/İngiltere/
  // Fransa) gerçek BM kuralları gibi kendine karşı kararı OTOMATİK veto eder.
  let voters = Object.keys(state.countries).filter(id=>id!==player && !state.countries[id].eliminated);
  let votesFor=0, votesAgainst=0, vetoers=[];
  voters.forEach(id=>{
    let c = state.countries[id];
    let isTarget = id===targetId;
    if(isTarget || c.relation<50) votesAgainst++; else votesFor++;
    if(P5_MEMBERS.includes(id) && (isTarget || c.relation<40)) vetoers.push(c.name);
  });
  let status = vetoers.length>0 ? 'vetoed' : (votesFor>votesAgainst ? 'passed' : 'failed');
  return {votesFor, votesAgainst, vetoers, status};
}
function applyResolutionEffect(targetId, type){
  let target = state.countries[targetId];
  if(type==='embargo'){ target.embargo=true; target.relation=Math.max(0,target.relation-5); }
  else if(type==='peacekeeping'){ target.stability=Math.min(100,target.stability+15); }
  else if(type==='condemnation'){ target.relation=Math.max(0,target.relation-10); target.stability=Math.max(0,target.stability-5); }
  else if(type==='intervention'){ target.cities.forEach(c=>{ ['short','medium','long'].forEach(l=>{ c.hss[l].current=Math.round(c.hss[l].current*0.7); }); }); }
  else if(type==='nuclear_cap'){ state.unNukeCap=Math.max(1,state.unNukeCap-1); target.relation=Math.max(0,target.relation-10); }
}

const ui = {
  /* YENİ: Kart ızgarası yerine tek dropdown + canlı önizleme (Pax Erenia
     tarzı seçim ekranı referansı). */
  renderCountrySelect(){
    let sel = document.getElementById("country-dropdown");
    if(!sel) return;
    sel.innerHTML = "";
    for(let id in GEO_DATA){
      let opt = document.createElement("option");
      opt.value = id; opt.innerText = `${FLAGS[id]} ${GEO_DATA[id].name}`;
      sel.appendChild(opt);
    }
    this.updateCountryPreview();
  },
  updateCountryPreview(){
    let sel = document.getElementById("country-dropdown");
    if(!sel) return;
    let id = sel.value; let g = GEO_DATA[id]; let s = STARTING_STATS[id];
    if(!g || !s) return;
    setEl("country-preview", `
      ${flagImgHTML(id,'flag-icon-lg')}<br>
      Güç Kademesi: <b>Tier ${s.tier}${s.nuclear?" · ☢️ Nükleer":""}</b><br>
      Şehirler: ${g.cities.map(c=>c.name).join(", ")}<br>
      💰 <b>${s.budget.toLocaleString()}$</b> · 👥 <b>${s.manpower.toLocaleString()}</b> · ☢️ <b>${s.uranium}</b> Uranyum
    `, true);
  },

  /* ================= YENİ: TUTORIAL ================= */
  _tutorialIdx: 0,
  openTutorial(){
    this._tutorialIdx = 0;
    this._renderTutorial();
    let panel = document.getElementById("tutorial-panel");
    if(panel) panel.classList.add("open");
  },
  closeTutorial(){
    let panel = document.getElementById("tutorial-panel");
    if(panel) panel.classList.remove("open");
  },
  tutorialNext(){ if(this._tutorialIdx < TUTORIAL_STEPS.length-1){ this._tutorialIdx++; this._renderTutorial(); } },
  tutorialPrev(){ if(this._tutorialIdx > 0){ this._tutorialIdx--; this._renderTutorial(); } },
  _renderTutorial(){
    let s = TUTORIAL_STEPS[this._tutorialIdx];
    setEl("tutorial-step-label", `${this._tutorialIdx+1}/${TUTORIAL_STEPS.length} — ${s.title}`);
    setEl("tutorial-body", `<div style="padding:6px 0;line-height:1.5;">${s.body}</div>`, true);
  },

  /* ================= YENİ: SALDIRI ADEDİ GİRİŞİ =================
     index.html'de bir "kaç adet gönderilecek" alanı yoktu — burada
     ATEŞLE butonunun hemen üstüne DOM üzerinden ekleniyor, böylece
     ayrıca HTML/CSS dosyasına dokunmaya gerek kalmıyor. */
  ensureAttackQtyInput(){
    if(document.getElementById("attack-qty")) return;
    let btn = document.querySelector(".btn-attack");
    if(!btn) return;
    let wrap = document.createElement("div");
    wrap.innerHTML = `<label>Gönderilecek Adet</label><input type="number" id="attack-qty" min="1" value="1" style="width:100%;margin-bottom:6px;">`;
    btn.parentNode.insertBefore(wrap, btn);
  },

  /* ================= YENİ: HARİTA ZOOM + PAN (tekerlek/sürükleme/pinch) =================
     Mevcut +/-/sıfırla zoom sistemiyle (mapZoom, zoomMap, resetMapZoom)
     birlikte çalışır — aynı transform içine pan (translate) de eklenir. */
  mapPanX:0, mapPanY:0,
  _clampPan(){
    let maxOffset = (this.mapZoom-1)*260;
    this.mapPanX = Math.max(-maxOffset, Math.min(maxOffset, this.mapPanX));
    this.mapPanY = Math.max(-maxOffset, Math.min(maxOffset, this.mapPanY));
  },
  initMapControls(){
    let wrap = document.getElementById("map-wrapper");
    if(!wrap || wrap._panInit) return;
    wrap._panInit = true;

    // Fare tekerleği ile zoom (ülke seçimi/tıklaması bozulmaz — sadece transform değişir)
    wrap.addEventListener("wheel", (e)=>{
      e.preventDefault();
      ui.zoomMap(e.deltaY < 0 ? 1.12 : 1/1.12);
    }, {passive:false});

    // Fare ile sürükleyerek gezinme (PAN) — yalnızca zoom>1 iken anlamlı
    let dragging=false, lastX=0, lastY=0, moved=false;
    wrap.addEventListener("mousedown", (e)=>{
      if(ui.mapZoom<=1) return;
      dragging=true; moved=false; lastX=e.clientX; lastY=e.clientY; wrap.style.cursor="grabbing";
    });
    window.addEventListener("mousemove", (e)=>{
      if(!dragging) return;
      let dx=e.clientX-lastX, dy=e.clientY-lastY;
      if(Math.abs(dx)>2||Math.abs(dy)>2) moved=true;
      ui.mapPanX += dx; ui.mapPanY += dy; lastX=e.clientX; lastY=e.clientY;
      ui._clampPan(); ui._applyMapZoom();
    });
    window.addEventListener("mouseup", ()=>{ dragging=false; wrap.style.cursor=""; });
    // Sürükleme bittiğinde, gerçekten hareket edildiyse altındaki ülkeye tıklamayı bir sonraki
    // click event'inde bir kereliğine engelle (yanlışlıkla ülke seçmesin diye).
    wrap.addEventListener("click", (e)=>{ if(moved){ e.stopPropagation(); moved=false; } }, true);

    // Mobil: tek parmak sürükleme (pan), iki parmak pinch-to-zoom
    let touchMode=null, lastDist=0, lastTX=0, lastTY=0;
    wrap.addEventListener("touchstart", (e)=>{
      if(e.touches.length===1){ touchMode='drag'; lastTX=e.touches[0].clientX; lastTY=e.touches[0].clientY; }
      else if(e.touches.length===2){ touchMode='pinch'; lastDist=ui._touchDist(e.touches); }
    }, {passive:true});
    wrap.addEventListener("touchmove", (e)=>{
      if(touchMode==='drag' && e.touches.length===1 && ui.mapZoom>1){
        let dx=e.touches[0].clientX-lastTX, dy=e.touches[0].clientY-lastTY;
        ui.mapPanX+=dx; ui.mapPanY+=dy; lastTX=e.touches[0].clientX; lastTY=e.touches[0].clientY;
        ui._clampPan(); ui._applyMapZoom(); e.preventDefault();
      } else if(touchMode==='pinch' && e.touches.length===2){
        let d = ui._touchDist(e.touches);
        if(lastDist>0) ui.zoomMap(d/lastDist);
        lastDist=d; e.preventDefault();
      }
    }, {passive:false});
    wrap.addEventListener("touchend", ()=>{ touchMode=null; lastDist=0; });
  },
  _touchDist(touches){
    let dx=touches[0].clientX-touches[1].clientX, dy=touches[0].clientY-touches[1].clientY;
    return Math.sqrt(dx*dx+dy*dy);
  },

  init(){
    setEl("hq-title", `${flagImgHTML(state.playerID,'flag-icon-sm')} ${state.countries[state.playerID].name} — Karargâh`, true);
    let taxSlider = document.getElementById("tax-rate-slider");
    if(taxSlider) taxSlider.value = state.taxRate;
    setEl("tax-rate-label","%"+state.taxRate);
    let refuelBox = document.getElementById("use-refuel");
    if(refuelBox) refuelBox.addEventListener("change", ()=>ui.updateAll());

    this.buildMap(); this.updateAll();
    setTimeout(()=>ui.buildMap(), 100); // layout geç oturursa haritayı garanti altına al
    this.ensureAttackQtyInput();
    this.initMapControls();
    log(`Sistem Aktif: TAYFUN v13 — ${state.countries[state.playerID].name} olarak Kara Kartal Doktrini devrede.`,"#00ff66");
    engine.calcProdTime();
    musicEngine.onEnterWorldMap(); // YENİ: oyun başlayınca dünya haritası müziği devreye girer
  },

  switchTab(which){
    document.getElementById("left-panel").classList.toggle("mobile-active", which==="left");
    document.getElementById("right-panel").classList.toggle("mobile-active", which==="right");
    document.getElementById("tab-left").classList.toggle("active", which==="left");
    document.getElementById("tab-right").classList.toggle("active", which==="right");
    let tabUn = document.getElementById("tab-un"); if(tabUn) tabUn.classList.toggle("active", which==="un");
    let tabCabinet = document.getElementById("tab-cabinet"); if(tabCabinet) tabCabinet.classList.toggle("active", which==="cabinet");
    let tabStats = document.getElementById("tab-stats"); if(tabStats) tabStats.classList.toggle("active", which==="stats");
    let unPanel = document.getElementById("un-panel");
    if(unPanel){
      if(which==="un"){ unPanel.classList.add("open"); document.body.classList.add("un-open"); this.updateUNPanel(); }
      else { unPanel.classList.remove("open"); document.body.classList.remove("un-open"); }
    }
    // YENİ: Kabine ve İstatistik sekmeleri de switchTab() tarafından destekleniyor.
    if(which==="cabinet") this.openCabinet(); else this.closeCabinet();
    if(which==="stats") this.openStats(); else this.closeStats();
  },

  /* ================= YENİ: KABİNE SİSTEMİ =================
     4 bakanlık sekmesi, her biri o anki oyun durumuna göre otomatik bir
     rapor + kısa değerlendirme üretir. */
  _cabinetTab: "finance",
  openCabinet(){
    let panel = document.getElementById("cabinet-panel");
    if(panel){ panel.classList.add("open"); document.body.classList.add("un-open"); }
    this.showCabinetTab(this._cabinetTab);
  },
  closeCabinet(){
    let panel = document.getElementById("cabinet-panel");
    if(panel) panel.classList.remove("open");
    if(!document.getElementById("stats-panel").classList.contains("open") && !document.getElementById("un-panel").classList.contains("open")) document.body.classList.remove("un-open");
  },
  showCabinetTab(which){
    this._cabinetTab = which;
    if(!state) return;
    let p = state.player, html = "";
    document.querySelectorAll("#cabinet-tabs button").forEach(b=>b.classList.remove("active"));
    let btn = document.querySelector(`#cabinet-tabs button[onclick="ui.showCabinetTab('${which}')"]`);
    if(btn) btn.classList.add("active");

    if(which==='finance'){
      html = `<div class="stat-box">🌐 GSYH <b>${p.gdp.toLocaleString('tr-TR')}$</b></div>
        <div class="stat-box">💰 Hazine <b>${p.budget.toLocaleString()}$</b></div>
        <div class="stat-box">⛏️ Hammadde <b>${p.resources}</b></div>
        <div class="stat-box">📈 Vergi Oranı <b>%${state.taxRate}</b></div>
        <div class="stat-box">🏭 Fabrika Sayısı <b>${getPlayerCities().reduce((a,c)=>a+(c.factories?Object.values(c.factories).reduce((x,y)=>x+y,0):0),0)}</b></div>
        <div class="small-note">📋 Maliye Bakanlığı Raporu: ${p.budget<50000 ? "Hazine kritik seviyede — harcamalara dikkat edilmeli, vergi oranı gözden geçirilebilir." : (p.budget>500000 ? "Ekonomi çok güçlü, yeni yatırımlar için alan var." : "Ekonomi istikrarlı görünüyor.")} GSYH'nin Hazine'ye oranı ${(p.gdp/Math.max(1,p.budget)).toFixed(1)}x.</div>`;
    } else if(which==='foreign'){
      let ids = Object.keys(state.countries).filter(id=>id!==state.playerID && !state.countries[id].isBloc);
      let atWar = ids.filter(id=>state.countries[id].relation<=0).length;
      let allies = ids.filter(id=>state.countries[id].alliedWithPlayer).length;
      html = `<div class="stat-box">⚔️ Savaş Halinde Olunan Ülke <b>${atWar}</b></div>
        <div class="stat-box">🤝 Müttefik Sayısı <b>${allies}</b></div>
        <div class="stat-box">🌍 Global Tansiyon <b>%${state.globalTension}</b></div>
        <div class="stat-box">🇺🇳 Geçen BM Kararı <b>${state.unResolutions.length}</b></div>
        <div class="small-note">📋 Dışişleri Bakanlığı Raporu: ${atWar>2 ? "Çok cepheli savaş riskli — diplomasi ve barış görüşmeleri önerilir." : (atWar===0 ? "Barış içindeyiz, ittifaklar geliştirilebilir." : "Diplomatik durum yönetilebilir seviyede.")}</div>`;
    } else if(which==='interior'){
      html = `<div class="stat-box">⚖️ İstikrar <b>%${p.stability}</b></div>
        <div class="stat-box">🫡 Halk Desteği <b>%${Math.round(p.publicSupport)}</b></div>
        <div class="stat-box">🏕️ Mülteci Seviyesi <b>%${state.refugeeLevel||0}</b></div>
        <div class="stat-box">👑 Yönetim Biçimi <b>${IDEOLOGY_CONFIG[p.ideology].label}</b></div>
        <div class="small-note">📋 İçişleri Bakanlığı Raporu: ${p.publicSupport<30 ? "⚠️ Halk desteği düşük — hükümet krizi riski var, vergi indirimi düşünülebilir." : "İç düzen kontrol altında."}</div>`;
    } else if(which==='defense'){
      let totalUnits = Object.values(p.inventory).reduce((a,b)=>a+b,0);
      html = `<div class="stat-box">🪖 Toplam Envanter <b>${totalUnits}</b></div>
        <div class="stat-box">💻 Siber Savunma Seviyesi <b>${getEffectiveCyberDefense()}</b></div>
        <div class="stat-box">👑 Güç Kademesi <b>Tier ${countryTier(state.playerID)}</b></div>
        <div class="stat-box">☢️ Nükleer Başlık <b>${p.inventory.nuke||0}</b></div>
        <div class="small-note">📋 Savunma Bakanlığı Raporu: ${totalUnits<20 ? "Envanter zayıf — üretim kuyruğuna öncelik verilmeli." : "Askeri kapasite yeterli seviyede."}</div>`;
    }
    /* ================= YENİ: Kabine ↔ AI Danışman bağlantısı (madde 4) =================
       finance/foreign/interior/defense sekmelerinin HER BİRİNDE, o
       bakanlığın gerçek AI danışmanından (ADVISOR_ROLES anahtarları
       birebir aynı) rapor isteyen bir buton. İKİNCİ bir sistem DEĞİL —
       askAdvisor() zaten var olan aynı fonksiyon, sadece sonucu
       #cabinet-ai-result'a yazıyor. */
    if(ADVISOR_ROLES[which]){
      html += `<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:8px;">
        <button onclick="ui.askAdvisor('${which}','cabinet-ai-result')">${ADVISOR_ROLES[which].icon} ${ADVISOR_ROLES[which].label}'dan Rapor İste</button>
        <div id="cabinet-ai-result" class="small-note" style="margin-top:6px;"></div>
      </div>`;
    }
    setEl("cabinet-body", html, true);
  },

  /* ================= YENİ: İSTATİSTİK SİSTEMİ =================
     Her tur sonunda kaydedilen p.history (GSYH/hazine, halk desteği,
     istikrar, teknoloji sayısı) verisiyle Canvas üzerinde gerçek bir
     çizgi grafiği çizer. */
  openStats(){
    let panel = document.getElementById("stats-panel");
    if(panel){ panel.classList.add("open"); document.body.classList.add("un-open"); }
    this.drawStatsChart();
  },
  closeStats(){
    let panel = document.getElementById("stats-panel");
    if(panel) panel.classList.remove("open");
    if(!document.getElementById("cabinet-panel").classList.contains("open") && !document.getElementById("un-panel").classList.contains("open")) document.body.classList.remove("un-open");
  },
  drawStatsChart(){
    let canvas = document.getElementById("stats-chart");
    if(!canvas || !state) return;
    let c2 = canvas.getContext("2d");
    c2.clearRect(0,0,canvas.width,canvas.height);
    let h = state.player.history;
    if(!h || !h.turn || h.turn.length<2){
      c2.fillStyle="#7d8fa3"; c2.font="13px sans-serif";
      c2.fillText("Yeterli veri yok — birkaç tur oynayın.",14,canvas.height/2);
      setEl("stats-legend","",true);
      return;
    }
    const SERIES = [
      {key:'gdp',      color:'#22c55e', label:'GSYH (Ekonomik Büyüklük)'},
      {key:'budget',   color:'#facc15', label:'Hazine (Harcanabilir)'},
      {key:'support',  color:'#38bdf8', label:'Halk Desteği (%)'},
      {key:'stability',color:'#4ade80', label:'İstikrar (%)'},
      {key:'tech',     color:'#a855f7', label:'Teknoloji Sayısı'}
    ];
    let pad=32, w=canvas.width-pad*2, hgt=canvas.height-pad*2, n=h.turn.length;
    // eksenler
    c2.strokeStyle="#2c3e54"; c2.lineWidth=1;
    c2.beginPath(); c2.moveTo(pad,pad); c2.lineTo(pad,pad+hgt); c2.lineTo(pad+w,pad+hgt); c2.stroke();
    let legendHTML = "";
    SERIES.forEach(s=>{
      let data = h[s.key]||[];
      if(data.length<2) return;
      let max = Math.max(...data), min = Math.min(...data);
      if(max===min){ max+=1; min-=1; }
      c2.beginPath(); c2.strokeStyle=s.color; c2.lineWidth=2;
      data.forEach((v,i)=>{
        let x = pad + (i/(n-1))*w;
        let y = pad + hgt - ((v-min)/(max-min))*hgt;
        i===0 ? c2.moveTo(x,y) : c2.lineTo(x,y);
      });
      c2.stroke();
      let last = data[data.length-1];
      legendHTML += `<span style="color:${s.color};">■ ${s.label}: <b>${typeof last==='number'?last.toLocaleString('tr-TR'):last}</b></span><br>`;
    });
    setEl("stats-legend", legendHTML, true);
  },

  /* ================= YENİ: AI MERKEZİ UI =================
     Tek modal, 4 alt sekme (Ayarlar/Danışmanlar/Sohbet/Komut). İçerik
     tamamen dinamik — index.html'de sadece boş #ai-tab-body kabuğu var. */
  _aiTab:"settings", _pendingAiAction:null,
  _countryChatView:"list", _countryChatPickedIds:[], _activeCountryChatId:null,

  /* ================= YENİ: ORTAK İZİN/YAPILANDIRMA KONTROLÜ =================
     Sohbet/Danışman/Ülkeyle Konuş/Komut'un HEPSİ bir AI çağrısından hemen
     önce bunu çağırır. İzin hiç sorulmadıysa modalı açar; "hayır"
     denmişse veya anahtar yoksa hedef elemente anlaşılır bir uyarı yazıp
     false döner — çağıran taraf işlemi orada durdurur, oyun etkilenmez. */
  _aiGateCheck(targetElId){
    if(!aiEngine.consentAsked()){ this.openAiConsentModal(); return false; }
    if(!aiEngine.hasConsent()){ setEl(targetElId, "⚠️ AI kullanımına izin vermediniz. AI Merkezi → Ayarlar'dan değiştirebilirsiniz. Oyun normal şekilde çalışmaya devam ediyor.", true); return false; }
    if(!aiEngine.isConfigured()){ setEl(targetElId, "⚠️ Önce AI Merkezi → Ayarlar'dan bir API anahtarı girmelisiniz.", true); return false; }
    return true;
  },

  /* ================= YENİ: AI İZNİ (rıza modalı) ================= */
  /* ================= YENİ: SES AYARLARI PANELİ =================
     Müzik/SFX seviyesi ve mute durumları localStorage'da tutulur (bkz.
     soundEngine/musicEngine) — kayıt kodunun bir PARÇASI DEĞİLDİR, çünkü
     bu bir oyun verisi değil, cihaz tercihidir. */
  openAudioSettings(){
    let panel = document.getElementById("audio-settings-panel");
    if(panel){ panel.classList.add("open"); document.body.classList.add("un-open"); }
    let mv = document.getElementById("music-vol-slider"), sv = document.getElementById("sfx-vol-slider");
    let mm = document.getElementById("music-mute-toggle"), sm = document.getElementById("sfx-mute-toggle");
    if(mv) mv.value = musicEngine.getMusicVolume();
    if(sv) sv.value = soundEngine.getSfxVolume();
    if(mm) mm.checked = musicEngine.isMusicMuted();
    if(sm) sm.checked = soundEngine.isSfxMuted();
    setEl("music-vol-label", "%"+musicEngine.getMusicVolume());
    setEl("sfx-vol-label", "%"+soundEngine.getSfxVolume());
    // YENİ: panel her açıldığında son müzik hatasını göster (varsa)
    let errEl = document.getElementById("music-error-status");
    if(errEl){
      if(musicEngine.lastError){ errEl.textContent = "⚠️ "+musicEngine.lastError; errEl.style.display="block"; }
      else errEl.style.display="none";
    }
  },
  closeAudioSettings(){
    let panel = document.getElementById("audio-settings-panel");
    if(panel) panel.classList.remove("open");
    document.body.classList.remove("un-open");
  },

  openAiConsentModal(){
    let modal = document.getElementById("ai-consent-modal");
    if(modal) modal.classList.add("open");
  },
  closeAiConsentModal(){
    let modal = document.getElementById("ai-consent-modal");
    if(modal) modal.classList.remove("open");
  },
  setAiConsent(granted){
    aiEngine.setConsent(granted);
    this.closeAiConsentModal();
    log(granted ? "🔐 AI'a oyun verisi gönderme izni verildi." : "🔐 AI izni reddedildi — AI özellikleri kullanılamayacak, oyunun kendisi normal şekilde çalışmaya devam ediyor.", granted?"#a855f7":"yellow");
    let panel = document.getElementById("ai-panel");
    if(panel && panel.classList.contains("open") && this._aiTab==='settings') this.renderAiSettingsTab();
  },

  openAiPanel(){
    let panel = document.getElementById("ai-panel");
    if(panel){ panel.classList.add("open"); document.body.classList.add("un-open"); }
    this.showAiTab(this._aiTab);
  },
  closeAiPanel(){
    let panel = document.getElementById("ai-panel");
    if(panel) panel.classList.remove("open");
    document.body.classList.remove("un-open");
  },
  /* YENİ: AI Merkezi artık SADECE Ayarlar + Danışmanlar. Sohbet/Komut/
     Ülkeyle Konuş — Pax Historia'daki gibi — haritanın sol altındaki
     ayrı butonlara taşındı (bkz. openAiChatPanel/openAiCommandPanel/
     openCountryChatPanel), burada İKİNCİ bir kopyaları yok (madde 9). */
  showAiTab(which){
    this._aiTab = which;
    document.querySelectorAll("#ai-tabs button").forEach(b=>b.classList.toggle("active", b.dataset.tab===which));
    if(which==='settings') this.renderAiSettingsTab();
    else if(which==='advisors') this.renderAiAdvisorsTab();
  },

  /* --- Ayarlar: sağlayıcı/model/anahtar + izin durumu --- */
  renderAiSettingsTab(){
    let providerId = aiEngine.getProvider();
    let provider = AI_PROVIDERS[providerId];
    let key = aiEngine.getApiKey();
    let masked = key ? (key.slice(0,4)+"••••••••"+key.slice(-4)) : "";
    let providerOptions = Object.keys(AI_PROVIDERS).map(id=>
      `<option value="${id}" ${id===providerId?'selected':''}>${AI_PROVIDERS[id].label}</option>`).join("");
    let modelOptions = provider.models.map(([val,label])=>
      `<option value="${val}" ${val===aiEngine.getModel()?'selected':''}>${label}</option>`).join("");
    let consentState = aiEngine.getConsent();
    let consentHtml = consentState==='yes'
      ? `<div id="ai-consent-status">✅ AI'a oyun verisi gönderme izni verildi. <button onclick="aiEngine.setConsent(false); ui.renderAiSettingsTab();" style="background:#7a1f1f;padding:4px 8px;">İptal Et</button></div>`
      : consentState==='no'
        ? `<div id="ai-consent-status" class="denied">❌ AI izni reddedilmiş — AI özellikleri devre dışı, oyun normal çalışıyor. <button onclick="ui.openAiConsentModal()" style="padding:4px 8px;">Tekrar Sor</button></div>`
        : `<div id="ai-consent-status">İzin henüz sorulmadı. <button onclick="ui.openAiConsentModal()" style="padding:4px 8px;">İzni Ayarla</button></div>`;
    setEl("ai-tab-body", `
      <div class="small-note">API anahtarınız SADECE bu tarayıcıda (localStorage) saklanır; hiçbir sunucuya, hiçbir kayıt koduna, başka hiçbir oyuncuya iletilmez.
      <b>Anahtarı boş bırakırsanız oyun tamamen AI'sız, şu anki haliyle normal çalışmaya devam eder.</b></div>
      ${consentHtml}
      <label>AI Sağlayıcı</label>
      <select id="ai-provider-input">${providerOptions}</select>
      <label>Model</label>
      <select id="ai-model-input">${modelOptions}</select>
      <label>API Anahtarı</label>
      <input type="password" id="ai-key-input" placeholder="${masked || (providerId==='anthropic'?'sk-ant-...':providerId==='openai'?'sk-...':'AIza...')}">
      <div style="display:flex;gap:6px;">
        <button onclick="ui.saveAiSettings()" style="flex:1;">💾 Kaydet</button>
        ${key ? `<button onclick="ui.forgetAiKey()" style="flex:1;background:#7a1f1f;">🗑️ Anahtarı Unut</button>` : ""}
      </div>
      <div id="ai-settings-status">${aiEngine.isConfigured() ? "✅ "+provider.label+" bağlantısı yapılandırılmış." : "⚠️ API anahtarı girilmedi — AI özellikleri devre dışı, oyun normal şekilde çalışır."}</div>
    `, true);
    let provSel = document.getElementById("ai-provider-input");
    if(provSel) provSel.onchange = ()=>{ aiEngine.setProvider(provSel.value); ui.renderAiSettingsTab(); };
  },
  saveAiSettings(){
    let provSel = document.getElementById("ai-provider-input");
    let keyInput = document.getElementById("ai-key-input");
    let modelInput = document.getElementById("ai-model-input");
    if(provSel) aiEngine.setProvider(provSel.value);
    if(keyInput && keyInput.value.trim()) aiEngine.setApiKey(keyInput.value);
    if(modelInput) aiEngine.setModel(modelInput.value);
    this.renderAiSettingsTab();
    log("🤖 AI ayarları kaydedildi.","#a855f7");
  },
  forgetAiKey(){
    aiEngine.clearApiKey();
    this.renderAiSettingsTab();
    log("🗑️ API anahtarı bu tarayıcıdan silindi.","#a855f7");
  },

  /* --- Danışmanlar (6 bakan/danışman) --- */
  renderAiAdvisorsTab(){
    let html = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">`;
    for(let key in ADVISOR_ROLES){
      html += `<button onclick="ui.askAdvisor('${key}')">${ADVISOR_ROLES[key].icon} ${ADVISOR_ROLES[key].label}</button>`;
    }
    html += `</div><div id="ai-advisor-result" class="small-note">Bir danışman seçin — o anki gerçek oyun durumunuza bakıp size özel bir değerlendirme yapacak.</div>`;
    setEl("ai-tab-body", html, true);
  },
  askAdvisor(role, resultElId){
    resultElId = resultElId || "ai-advisor-result";
    if(!state){ setEl(resultElId, "⚠️ Önce bir oyun başlatmalısınız.", true); return; }
    if(!this._aiGateCheck(resultElId)) return;
    setEl(resultElId, `⏳ ${ADVISOR_ROLES[role].label} oyunun durumunu inceliyor...`, true);
    aiEngine.askAdvisor(role).then(res=>{
      let html = `<div style="white-space:pre-wrap;">${escapeHTML(res.display)}</div>`;
      if(res.action && res.action.action && res.action.action!=='none'){
        ui._pendingAiAction = res.action;
        let tName = (res.action.target && state.countries[res.action.target]) ? state.countries[res.action.target].name : "";
        html += `<div class="ai-suggestion-box">
          <b>Önerilen işlem:</b> ${escapeHTML(res.action.action)}${tName?(' → '+escapeHTML(tName)):''}
          <div class="small-note">${escapeHTML(res.action.explanation||"")}</div>
          <div class="ai-action-buttons">
            <button onclick='ui.showAiActionDetail()'>🔍 İncele</button>
            <button onclick='ui.applyPendingAndRefresh("${resultElId}")'>✅ Uygula</button>
          </div>
        </div>`;
      }
      setEl(resultElId, html, true);
    }).catch(err=>{
      setEl(resultElId, `❌ AI isteği başarısız oldu: ${escapeHTML(err.message)} Oyun normal şekilde devam ediyor.`, true);
    });
  },
  showAiActionDetail(){
    if(!ui._pendingAiAction) return;
    alert(JSON.stringify(ui._pendingAiAction, null, 2));
  },
  /* YENİ: Uygula'ya basınca işlemi uygular ve sonucu (gerekiyorsa)
     danışman/komut kutusuna geri yazdırır — Kabine'deki mini-danışman
     kutusu da dahil aynı fonksiyonu paylaşır. */
  applyPendingAndRefresh(resultElId){
    engine.applyAiAction(ui._pendingAiAction);
    let el = document.getElementById(resultElId);
    if(el) el.insertAdjacentHTML("beforeend", `<div class="small-note" style="color:#4ade80;">✅ Uygulandı.</div>`);
  },

  /* ================= YENİ: 💬 AI SOHBET (ayrı panel, harita sol-alt) ================= */
  openAiChatPanel(){
    let panel = document.getElementById("ai-chat-panel");
    if(panel){ panel.classList.add("open"); document.body.classList.add("un-open"); }
    this.renderAiChatPanel();
  },
  closeAiChatPanel(){
    let panel = document.getElementById("ai-chat-panel");
    if(panel) panel.classList.remove("open");
    document.body.classList.remove("un-open");
  },
  clearAiChat(){
    if(state) state.player.aiChatLog = [];
    this.renderAiChatPanel();
  },
  renderAiChatPanel(){
    if(!state){ setEl("ai-chat-body", "⚠️ Önce bir oyun başlatmalısınız.", true); return; }
    let log_ = state.player.aiChatLog || (state.player.aiChatLog=[]);
    let html = `<div class="chip-row">
        <button class="chip" onclick="ui.sendAiChatMsg('Oyun özeti ver.')">📋 Oyun özeti</button>
        <button class="chip" onclick="ui.sendAiChatMsg('Stratejik tavsiye ver.')">🧭 Stratejik tavsiye</button>
        <button class="chip" onclick="ui.sendAiChatMsg('Tehdit değerlendirmesi yap.')">⚠️ Tehdit değerlendirmesi</button>
      </div>
      <div class="chat-log-box" id="ai-chat-log-box">`;
    if(log_.length===0) html += `<div class="empty-hint">Henüz mesaj yok</div>`;
    log_.forEach(m=>{
      html += m.role==='user'
        ? `<div class="chat-msg chat-msg-mine">${escapeHTML(m.text)}</div>`
        : `<div class="chat-msg chat-msg-theirs">${escapeHTML(m.text)}</div>`;
    });
    html += `</div>
      <div class="chat-input-row">
        <input type="text" id="ai-chat-input" placeholder="AI'a bir şey sor...">
        <button onclick="ui.sendAiChatMsgFromInput()">Gönder</button>
      </div>
      <div id="ai-chat-pending" class="small-note"></div>`;
    setEl("ai-chat-body", html, true);
    let input = document.getElementById("ai-chat-input");
    if(input) input.onkeydown = (e)=>{ if(e.key==='Enter') ui.sendAiChatMsgFromInput(); };
    let logBox = document.getElementById("ai-chat-log-box");
    if(logBox) logBox.scrollTop = logBox.scrollHeight;
  },
  sendAiChatMsgFromInput(){
    let input = document.getElementById("ai-chat-input");
    if(!input) return;
    let text = input.value.trim();
    if(!text) return;
    input.value="";
    this.sendAiChatMsg(text);
  },
  sendAiChatMsg(text){
    if(!state) return;
    if(!this._aiGateCheck("ai-chat-pending")) return;
    state.player.aiChatLog.push({role:'user', text});
    this.renderAiChatPanel();
    setEl("ai-chat-pending", "⏳ AI cevap yazıyor...", true);
    aiEngine.chat(text).then(res=>{
      state.player.aiChatLog.push({role:'ai', text:res.display});
      this.renderAiChatPanel();
      setEl("ai-chat-pending", "", true);
      if(res.action && res.action.action && res.action.action!=='none'){
        ui._pendingAiAction = res.action;
        let tName = (res.action.target && state.countries[res.action.target]) ? state.countries[res.action.target].name : "";
        let box = document.createElement("div");
        box.className = "ai-suggestion-box";
        box.innerHTML = `<b>Önerilen işlem:</b> ${escapeHTML(res.action.action)}${tName?(' → '+escapeHTML(tName)):''}
          <div class="ai-action-buttons"><button onclick='ui.applyPendingAndRefresh("ai-chat-pending")'>✅ Uygula</button></div>`;
        let body = document.getElementById("ai-chat-body");
        if(body) body.appendChild(box);
      }
    }).catch(err=>{
      setEl("ai-chat-pending", `❌ ${escapeHTML(err.message)} Oyun normal şekilde devam ediyor.`, true);
    });
  },

  /* ================= YENİ: 📝 KOMUT (ayrı panel, harita sol-alt) ================= */
  openAiCommandPanel(){
    let panel = document.getElementById("ai-command-panel");
    if(panel){ panel.classList.add("open"); document.body.classList.add("un-open"); }
    setEl("ai-command-body", `
      <textarea id="ai-command-input" rows="2" placeholder="Örnek: Pakistan ile ticaret anlaşması yap."></textarea>
      <button onclick="ui.submitAiCommandNew()">🧠 Analiz Et</button>
      <div class="command-result" id="ai-command-result-new"></div>
    `, true);
  },
  closeAiCommandPanel(){
    let panel = document.getElementById("ai-command-panel");
    if(panel) panel.classList.remove("open");
    document.body.classList.remove("un-open");
  },
  submitAiCommandNew(){
    let inputEl = document.getElementById("ai-command-input");
    if(!inputEl) return;
    let text = inputEl.value.trim();
    if(!text) return;
    if(!state){ setEl("ai-command-result-new", "⚠️ Önce bir oyun başlatmalısınız.", true); return; }
    if(!this._aiGateCheck("ai-command-result-new")) return;
    setEl("ai-command-result-new", "⏳ AI komutu analiz ediyor...", true);
    aiEngine.parseCommand(text).then(actionObj=>{
      ui._pendingAiAction = actionObj;
      let tName = (actionObj.target && state.countries[actionObj.target]) ? state.countries[actionObj.target].name : (actionObj.target||"—");
      setEl("ai-command-result-new", `
        <div class="small-note">Komutunuz: "${escapeHTML(text)}"</div>
        <div style="margin:6px 0;"><b>Anlaşılan işlem:</b> ${escapeHTML(actionObj.action)} ${actionObj.action!=='none'?('→ '+escapeHTML(tName)):''}</div>
        <div class="small-note">${escapeHTML(actionObj.explanation||"")}</div>
        ${actionObj.action!=='none' ? `<button onclick='ui.applyPendingAndRefresh("ai-command-result-new")'>✅ Onayla/Uygula</button>` : ""}
      `, true);
    }).catch(err=>{
      setEl("ai-command-result-new", `❌ Komut analiz edilemedi: ${escapeHTML(err.message)} Oyun normal şekilde devam ediyor.`, true);
    });
  },

  /* ================= YENİ: 🌍 ÜLKEYLE KONUŞ (ayrı panel, harita sol-alt) =================
     Liste (geçmiş oturumlar) → Seçim (22 ülkeden tekli/toplu) → Sohbet.
     Tüm oturumlar state.player.aiCountryChats içinde saklanır — bu sayede
     yeni oyunda otomatik boşalır, kayıtlı oyunla birlikte yüklenir/
     kaydedilir (madde 10). */
  openCountryChatPanel(){
    let panel = document.getElementById("country-chat-panel");
    if(panel){ panel.classList.add("open"); document.body.classList.add("un-open"); }
    this._countryChatView = "list";
    this.renderCountryChatList();
  },
  closeCountryChatPanel(){
    let panel = document.getElementById("country-chat-panel");
    if(panel) panel.classList.remove("open");
    document.body.classList.remove("un-open");
  },
  renderCountryChatList(){
    this._countryChatView = "list";
    setEl("country-chat-title", "🌍 Diplomatik Sohbetler");
    if(!state){ setEl("country-chat-body", "⚠️ Önce bir oyun başlatmalısınız.", true); return; }
    let sessions = state.player.aiCountryChats || (state.player.aiCountryChats=[]);
    let html = `<div class="chat-list-item chat-new-item" onclick="ui.showCountryPicker()">
        <div class="chat-flags"><span class="flag-fallback">✨</span></div>
        <div class="chat-info"><div class="chat-title">Yeni Sohbet Başlat</div><div class="chat-preview">${sessions.length===0?"Şu anda sohbet yok":"Yeni bir ülke/grup seçin"}</div></div>
      </div>`;
    if(sessions.length===0){
      html += `<div class="empty-hint">Henüz bir diplomatik sohbet başlatmadınız.</div>`;
    } else {
      [...sessions].reverse().forEach(s=>{
        let flagsHtml = s.participants.map(id=>flagImgHTML(id,'flag-icon-sm')).join("");
        let lastMsg = s.messages.length ? s.messages[s.messages.length-1].text : "(henüz mesaj yok)";
        html += `<div class="chat-list-item" onclick="ui.openCountrySession('${s.id}')">
          <div class="chat-flags">${flagsHtml}</div>
          <div class="chat-info"><div class="chat-title">${escapeHTML(s.title)}</div><div class="chat-preview">${escapeHTML(lastMsg)}</div></div>
          <div class="chat-time">Tur ${s.createdTurn}</div>
        </div>`;
      });
    }
    setEl("country-chat-body", html, true);
  },
  showCountryPicker(){
    this._countryChatView = "picker";
    this._countryChatPickedIds = [];
    this.renderCountryPicker();
  },
  renderCountryPicker(){
    setEl("country-chat-title", "🌍 Kimlerle Konuşmak İstiyorsunuz?");
    let ids = Object.keys(state.countries).filter(id=>id!==state.playerID && !state.countries[id].isBloc);
    let grid = ids.map(id=>{
      let c = state.countries[id];
      let sel = ui._countryChatPickedIds.includes(id);
      // YENİ: Bayrak resimleri bu ızgarada gerilip bozuk görünüyordu —
      // kaldırıldı, sadece ülke adı gösteriliyor (daha sade ve sorunsuz).
      return `<div class="country-pick-item ${sel?'selected':''}" onclick="ui.toggleCountryPick('${id}')">
        <span class="pick-name">${escapeHTML(c.name)}</span>
      </div>`;
    }).join("");
    let html = `
      <div class="small-note">Tek bir ülke ya da birden fazlasını (grup/toplu sohbet) seçebilirsiniz.</div>
      <div id="country-picker-grid">${grid}</div>
      <div id="country-picker-actions">
        <button onclick="ui.renderCountryChatList()" style="background:#374151;">← Geri</button>
        <button onclick="ui.confirmCountryPicker()" style="background:#0d6e63;">Sohbeti Başlat (${ui._countryChatPickedIds.length})</button>
      </div>`;
    setEl("country-chat-body", html, true);
  },
  toggleCountryPick(id){
    let i = this._countryChatPickedIds.indexOf(id);
    if(i===-1) this._countryChatPickedIds.push(id); else this._countryChatPickedIds.splice(i,1);
    this.renderCountryPicker();
  },
  confirmCountryPicker(){
    if(this._countryChatPickedIds.length===0) return;
    let ids = [...this._countryChatPickedIds];
    let names = ids.map(id=>state.countries[id].name);
    let session = {
      id: 'cc_'+Date.now()+'_'+Math.floor(Math.random()*1000),
      participants: ids,
      title: ids.length>1 ? names.join(" + ") : (names[0]+" ile Sohbet"),
      messages: [],
      createdTurn: state.turn
    };
    state.player.aiCountryChats.push(session);
    this.openCountrySession(session.id);
  },
  openCountrySession(sessionId){
    this._activeCountryChatId = sessionId;
    this._countryChatView = "session";
    this.renderCountrySession();
  },
  renderCountrySession(){
    let session = (state.player.aiCountryChats||[]).find(s=>s.id===this._activeCountryChatId);
    if(!session){ this.renderCountryChatList(); return; }
    setEl("country-chat-title", `<div class="chat-header-row"><button onclick="ui.renderCountryChatList()">←</button><span class="chat-header-title">${escapeHTML(session.title)}</span></div>`, true);
    let html = `<div class="chip-row">
        <button class="chip" onclick="ui.sendCountryChatMsg('Sizinle bir ticaret anlaşması yapmak istiyoruz.')">🤝 Ticaret teklif et</button>
        <button class="chip" onclick="ui.sendCountryChatMsg('Sizinle bir ittifak kurmak istiyoruz.')">⚔️ İttifak öner</button>
        <button class="chip" onclick="ui.sendCountryChatMsg('Barış görüşmesi yapmak istiyoruz.')">🕊️ Barış iste</button>
      </div>
      <div class="chat-log-box" id="country-session-log">`;
    if(session.messages.length===0) html += `<div class="empty-hint">Henüz mesaj yok</div>`;
    session.messages.forEach(m=>{
      html += m.role==='user'
        ? `<div class="chat-msg chat-msg-mine">${escapeHTML(m.text)}</div>`
        : `<div class="chat-msg chat-msg-theirs"><span class="chat-sender">${escapeHTML(session.title)}</span>${escapeHTML(m.text)}</div>`;
    });
    html += `</div>
      <div class="chat-input-row">
        <input type="text" id="country-chat-input" placeholder="Mesajınızı buraya yazın...">
        <button onclick="ui.sendCountryChatMsgFromInput()">Gönder</button>
      </div>
      <div id="country-chat-pending" class="small-note"></div>`;
    setEl("country-chat-body", html, true);
    let input = document.getElementById("country-chat-input");
    if(input) input.onkeydown = (e)=>{ if(e.key==='Enter') ui.sendCountryChatMsgFromInput(); };
    let logBox = document.getElementById("country-session-log");
    if(logBox) logBox.scrollTop = logBox.scrollHeight;
  },
  sendCountryChatMsgFromInput(){
    let input = document.getElementById("country-chat-input");
    if(!input) return;
    let text = input.value.trim();
    if(!text) return;
    input.value = "";
    this.sendCountryChatMsg(text);
  },
  sendCountryChatMsg(text){
    if(!this._aiGateCheck("country-chat-pending")) return;
    let session = (state.player.aiCountryChats||[]).find(s=>s.id===this._activeCountryChatId);
    if(!session) return;
    session.messages.push({role:'user', text});
    this.renderCountrySession();
    setEl("country-chat-pending", "⏳ Yanıt bekleniyor...", true);
    aiEngine.chatWithCountries(session.participants, session.messages, text).then(res=>{
      session.messages.push({role:'country', text:res.display});
      this.renderCountrySession();
      setEl("country-chat-pending", "", true);
      if(res.action && res.action.action && res.action.action!=='none'){
        ui._pendingAiAction = res.action;
        let tName = (res.action.target && state.countries[res.action.target]) ? state.countries[res.action.target].name : "";
        let box = document.createElement("div");
        box.className = "ai-suggestion-box";
        box.innerHTML = `<b>Önerilen diplomatik işlem:</b> ${escapeHTML(res.action.action)}${tName?(' → '+escapeHTML(tName)):''}
          <div class="small-note">${escapeHTML(res.action.explanation||"")}</div>
          <div class="ai-action-buttons"><button onclick='ui.applyPendingAndRefresh("country-chat-pending")'>✅ Onayla/Uygula</button></div>`;
        let body = document.getElementById("country-chat-body");
        if(body) body.appendChild(box);
      }
    }).catch(err=>{
      setEl("country-chat-pending", `❌ ${escapeHTML(err.message)} Oyun normal şekilde devam ediyor.`, true);
    });
  },

  /* YENİ: BM panelini açık bir butonla kapatma — önceden sadece sekme
     değiştirerek kapanıyordu, kullanıcı için belli değildi. */
  closeUNPanel(){
    let unPanel = document.getElementById("un-panel");
    if(unPanel) unPanel.classList.remove("open");
    document.body.classList.remove("un-open");
    document.getElementById("tab-left").classList.add("active");
    let tabUn = document.getElementById("tab-un"); if(tabUn) tabUn.classList.remove("active");
    document.getElementById("left-panel").classList.add("mobile-active");
    document.getElementById("right-panel").classList.remove("mobile-active");
  },

  /* YENİ: Harita yakınlaştırma — SVG/canvas'a AYNI CSS transform uygulanır,
     bu yüzden mapToScreen()'in kurduğu piksel-hassas hizalama bozulmaz
     (ikisi de aynı ölçekle büyür/küçülür). */
  mapZoom: 1,
  zoomMap(factor){
    this.mapZoom = Math.max(1, Math.min(6, this.mapZoom*factor));
    this._clampPan();
    this._applyMapZoom();
  },
  resetMapZoom(){ this.mapZoom = 1; this.mapPanX=0; this.mapPanY=0; this._applyMapZoom(); },
  _applyMapZoom(){
    // YENİ: zoom + pan aynı transform içinde birlikte uygulanır (translate önce, sonra scale).
    let t = `translate(${this.mapPanX}px, ${this.mapPanY}px) scale(${this.mapZoom})`;
    let svg = document.getElementById("game-map"); if(svg) svg.style.transform = t;
    let cv = document.getElementById("animCanvas"); if(cv) cv.style.transform = t;
  },

  /* YENİ: Tur Sonu Raporu — mevcut log akışından o turda üretilen satırları
     dilimleyip ayrı bir modalda gösterir (yeni bir loglama sistemi kurmaya
     gerek yok, zaten var olan logLines'tan besleniyor). */
  showTurnReport(entries, turnNo){
    setEl("turn-report-year", "Tur " + turnNo);
    setEl("turn-report-body", entries.length ? entries.join("") : "<div>Bu tur önemli bir olay yaşanmadı.</div>", true);
    let panel = document.getElementById("turn-report-panel");
    if(panel){ panel.classList.add("open"); document.body.classList.add("un-open"); }
  },
  closeTurnReport(){
    let panel = document.getElementById("turn-report-panel");
    if(panel) panel.classList.remove("open");
    document.body.classList.remove("un-open");
    /* ================= YENİ: SALDIRI GECİKMESİ =================
       Tur raporu kapatıldıktan 1 saniye sonra, önceki turda hedefe
       ulaşmış ama henüz SONUÇLANMAMIŞ oyuncu saldırıları şimdi işlenir
       (bkz. engine.processPendingAttacks). Bu sayede oyuncu turu
       atlamadan tek bir turda bir ülkeyi tamamen ele geçiremez. */
    setTimeout(()=>{ if(state && engine && engine.processPendingAttacks) engine.processPendingAttacks(); }, 1000);
  },

  /* ================= YENİ: KRİZ POP-UP =================
     advancedSystem.checkEvents() bir kriz tetiklediğinde çağrılır.
     severity: "warning" (turuncu) veya "critical" (kırmızı). */
  openCrisisPopup(title, bodyHTML, severity){
    let popup = document.getElementById("crisis-popup");
    if(!popup) return;
    setEl("crisis-title", (severity==='critical' ? "🔴 " : "🟠 ") + title);
    setEl("crisis-body", bodyHTML, true);
    popup.style.borderColor = severity==='critical' ? "#ff3344" : "#f59e0b";
    popup.classList.add("open");
    document.body.classList.add("un-open");
    // YENİ: Ayrı bir "kriz alarmı" efekt sesi KALDIRILDI — senin verdiğin
    // gerçek nükleer siren dosyası zaten musicEngine.onEnterCrisis() ile
    // kriz boyunca çalıyor, üstüne ikinci bir ses eklemek karışıklık
    // yaratıyordu.
    musicEngine.onEnterCrisis();
  },
  closeCrisisPopup(){
    let popup = document.getElementById("crisis-popup");
    let wasOpen = popup && popup.classList.contains("open");
    if(popup) popup.classList.remove("open");
    document.body.classList.remove("un-open");
    if(wasOpen) musicEngine.onExitCrisis();
  },

  buildMap(){
    let svg=document.getElementById("game-map"); if(!svg) return;
    try{
      svg.innerHTML = "";
      let usedReal = false;
      if(typeof worldMap !== "undefined" && worldMap.ready){
        try{ usedReal = worldMap.renderInto(svg, state, (id)=>engine.selectCountry(id)); }
        catch(e){ console.error("[TAYFUN] Gerçek harita çizilirken hata, yedek moda geçiliyor:", e); usedReal=false; }
      }

      if(!usedReal){
        // enlem/boylam ağı (görsel "dünya haritası" hissi için, sadece yedek modda)
        for(let gx=0; gx<=1000; gx+=100){
          let l=document.createElementNS("http://www.w3.org/2000/svg","line");
          l.setAttribute("x1",gx); l.setAttribute("y1",0); l.setAttribute("x2",gx); l.setAttribute("y2",500);
          l.setAttribute("stroke","#12233a"); l.setAttribute("stroke-width","1"); svg.appendChild(l);
        }
        for(let gy=0; gy<=500; gy+=100){
          let l=document.createElementNS("http://www.w3.org/2000/svg","line");
          l.setAttribute("x1",0); l.setAttribute("y1",gy); l.setAttribute("x2",1000); l.setAttribute("y2",gy);
          l.setAttribute("stroke","#12233a"); l.setAttribute("stroke-width","1"); svg.appendChild(l);
        }
        // Bloklar önce (arka plan), ülkeler üstte çizilsin diye sıra önemli
        let order = [...Object.keys(BLOC_DATA), ...Object.keys(GEO_DATA)];
        for(let id of order){
          let c = state.countries[id]; if(!c) continue;
          let path=document.createElementNS("http://www.w3.org/2000/svg","path");
          path.setAttribute("d", generateZonePath(id));
          path.setAttribute("fill", c.color); path.setAttribute("fill-opacity", c.isBloc?"0.4":"0.55");
          path.style.stroke = c.alliedWithPlayer? "#3fb87f" : (c.eliminated? "#555":"#233752");
          path.style.strokeWidth = c.alliedWithPlayer? "3":"2";
          path.style.opacity = c.eliminated? "0.35":"1";
          path.style.cursor="pointer"; path.onclick=()=>engine.selectCountry(id);
          svg.appendChild(path);

          let cap = project(c.cities[0].lat, c.cities[0].lon);
          let text=document.createElementNS("http://www.w3.org/2000/svg","text");
          text.setAttribute("x",cap.x-10); text.setAttribute("y",cap.y-16);
          text.setAttribute("fill","white"); text.setAttribute("font-size", c.isBloc?"10":"13");
          text.setAttribute("pointer-events","none");
          text.textContent=c.name+(c.eliminated?" 💀":(c.relation<=0&&id!==state.playerID?" ⚔":""));
          svg.appendChild(text);
        }
      }

      // Şehir noktaları — gerçek/yedek harita fark etmeksizin ortak, project()
      // hangi projeksiyon aktifse ona göre otomatik doğru konuma yerleşir.
      for(let id in state.countries){
        state.countries[id].cities.forEach(city=>{
          let p = project(city.lat, city.lon);
          let circle=document.createElementNS("http://www.w3.org/2000/svg","circle");
          circle.setAttribute("cx",p.x); circle.setAttribute("cy",p.y);
          // YENİ: şehir daireleri çapı yarıya düşürüldü (görsel netlik için)
          circle.setAttribute("r", city.owner===state.playerID?3:2.5);
          circle.setAttribute("fill", city.owner===state.playerID?"#00ff66":state.countries[city.owner].color);
          circle.setAttribute("stroke","#fff"); circle.setAttribute("stroke-width","0.75");
          circle.style.pointerEvents="none"; svg.appendChild(circle);

          // YENİ: Fabrikası olan şehrin yanında küçük bir simge — hangi
          // fabrika en son inşa edildiyse onu gösterir (yer kısıtlı).
          if(city.factories){
            let types = Object.keys(city.factories).filter(k=>city.factories[k]>0);
            if(types.length>0){
              let icon = FACTORY_CONFIG[types[types.length-1]].icon;
              let txt=document.createElementNS("http://www.w3.org/2000/svg","text");
              txt.setAttribute("x",p.x+7); txt.setAttribute("y",p.y+4);
              txt.setAttribute("font-size","10"); txt.style.pointerEvents="none";
              txt.textContent = icon + (types.length>1?`×${types.reduce((a,k)=>a+city.factories[k],0)}`:"");
              svg.appendChild(txt);
            }
          }
        });
      }
    }catch(e){ console.error("[TAYFUN] Harita çizilirken hata oluştu:", e); }
  },

  updateAll(){
    if(state.gameOver) return;
    const p=state.player;
    setEl("val-budget", p.budget.toLocaleString()+"$");
    setEl("val-manpower", p.manpower.toLocaleString());
    setEl("val-stability","%"+p.stability);
    setEl("val-support","%"+Math.round(p.publicSupport));
    setEl("val-uranium",p.uranium);
    setEl("val-turn",state.turn);
    setEl("val-tension","%"+state.globalTension+(state.sanctionRemaining>0?" 🚫":""));

    let refBox = document.getElementById("refugee-box");
    if(refBox){
      if((state.refugeeLevel||0)>0){ refBox.style.display="block"; setEl("val-refugee","%"+state.refugeeLevel); }
      else refBox.style.display="none";
    }

    // YENİ: Hükümet Krizi uyarı kutusu
    let govBox = document.getElementById("gov-crisis-box");
    if(govBox){
      if((state.govCrisisTurns||0)>0){ govBox.style.display="block"; setEl("val-gov-crisis", `${4-state.govCrisisTurns} tur kaldı`); }
      else govBox.style.display="none";
    }

    // YENİ: Yönetim biçimi + Yasalar göstergesi
    setEl("current-ideology", IDEOLOGY_CONFIG[p.ideology].label);
    let ideoSel = document.getElementById("ideology-select"); if(ideoSel) ideoSel.value = p.ideology;
    for(let key of ["martial","draft","openborders"]){
      let btn = document.getElementById("law-btn-"+key);
      if(btn){ btn.classList.toggle("active", p.laws[key]); btn.innerText = p.laws[key] ? "İPTAL ET" : "YASALAŞTIR"; }
    }

    // YENİ: Ar-Ge kuyruğu göstergesi
    let rqHTML = p.researchQueue.length===0 ? "Aktif Ar-Ge yok" : p.researchQueue.map(q=>`${q.item.toUpperCase()} — ${q.turnsLeft} tur kaldı`).join("<br>");
    setEl("research-queue-box", rqHTML, true);

    // YENİ: Devam eden çıkarma sevkiyatları göstergesi
    let opsBox = document.getElementById("ongoing-ops-box");
    if(opsBox){
      if(p.pendingOps.length===0){ opsBox.style.display="none"; }
      else {
        opsBox.style.display="block";
        opsBox.innerHTML = p.pendingOps.map(op=>{
          let tc = state.countries[op.targetCountryId]; let city = tc?tc.cities[op.targetCityIdx]:null;
          return `🚢 ${city?city.name:"?"} — ${op.turnsLeft} tur sonra sahile ulaşacak`;
        }).join("<br>");
      }
    }

    // YENİ: Tehdit İstihbaratı — AI'nin savaş açmadan önceki uyarı sinyalleri
    let threats = Object.keys(state.countries).filter(id=>state.countries[id].warBuildup>0);
    setEl("threat-warnings-box", threats.length===0 ? "Bilinen bir tehdit yok." :
      threats.map(id=>`⚠️ ${state.countries[id].name}: ${state.countries[id].warBuildup} tur içinde saldırabilir`).join("<br>"), true);

    // YENİ: Envanter artık parti (batch) kırılımını da gösteriyor
    let invHTML=""; for(let k in p.inventory){
      let label = (WEAPON_CONFIG[k]?WEAPON_CONFIG[k].label:k).toUpperCase();
      let bList = p.batches[k];
      let breakdown = "";
      if(bList && bList.length>1){
        breakdown = " ("+bList.filter(b=>b.qty>0).map(b=>{
          let cfg=WEAPON_CONFIG[k];
          let r = cfg.range!==undefined ? Math.round(cfg.range*(b.rangeMult||1)) : null;
          return `${b.qty}x${r?" "+r.toLocaleString()+"km":""}`;
        }).join(", ")+")";
      }
      invHTML+=`<div style="margin:3px 0;background:#152234;padding:4px;border-radius:3px;">${label}: <b>${p.inventory[k]}</b>${breakdown}</div>`;
    }
    setEl("inventory-list",invHTML,true);

    let qHTML = p.productionQueue.length===0?"Aktif üretim yok":p.productionQueue.map(q=>`[${(WEAPON_CONFIG[q.item]?WEAPON_CONFIG[q.item].label:q.item).toUpperCase()}] T${q.tier} — ${q.turnsLeft} tur kaldı`).join("<br>");
    setEl("queue-box",qHTML,true);

    setEl("tech-status", "Sahip: "+(Object.keys(p.tech).filter(k=>p.tech[k]).join(", ")||"Henüz yok"));
    document.getElementById("btn-nuclear").disabled = p.tech.nuclear || p.researchQueue.some(q=>q.item==='nuclear');
    document.getElementById("btn-cyber").disabled = p.tech.cyber || p.researchQueue.some(q=>q.item==='cyber');
    document.getElementById("btn-radar").disabled = p.tech.radar || p.researchQueue.some(q=>q.item==='radar');
    document.getElementById("btn-hss").disabled = p.tech.hss_adv || p.researchQueue.some(q=>q.item==='hss_adv');
    document.getElementById("btn-jet").disabled = p.tech.gen5_jet || p.researchQueue.some(q=>q.item==='gen5_jet');
    let btnMrbm=document.getElementById("btn-mrbm"); if(btnMrbm) btnMrbm.disabled = p.tech.mrbm || p.researchQueue.some(q=>q.item==='mrbm');
    let btnIcbm=document.getElementById("btn-icbm"); if(btnIcbm) btnIcbm.disabled = p.tech.icbm || !p.tech.mrbm || p.researchQueue.some(q=>q.item==='icbm');
    let btnRefuel=document.getElementById("btn-refuel"); if(btnRefuel) btnRefuel.disabled = p.tech.air_refuel || p.researchQueue.some(q=>q.item==='air_refuel');

    // YENİ: Hammadde göstergesi
    setEl("val-resources", p.resources);

    // YENİ: Fabrikalar paneli
    let factSelect = document.getElementById("factory-city-select");
    if(factSelect){
      let prevF = factSelect.value;
      factSelect.innerHTML="";
      getPlayerCities().forEach((city)=>{
        let opt=document.createElement("option"); opt.value=city.name; opt.innerText=city.name;
        factSelect.appendChild(opt);
      });
      if([...factSelect.options].some(o=>o.value===prevF)) factSelect.value = prevF;
      let selFCity = getPlayerCities().find(c=>c.name===factSelect.value) || getPlayerCities()[0];
      let flBox = document.getElementById("factory-list-box");
      if(flBox && selFCity){
        if(!selFCity.factories) selFCity.factories={};
        flBox.innerHTML = Object.keys(FACTORY_CONFIG).map(key=>{
          let cfg = FACTORY_CONFIG[key];
          let count = selFCity.factories[key]||0;
          return `<div class="factory-row"><div class="factory-info">${cfg.icon} ${cfg.label} <b>(${count})</b><br><span style="color:var(--muted);">${cfg.cost.toLocaleString()}$ + ${cfg.resourceCost} hammadde</span></div><button class="btn-tech" onclick="engine.buildFactory('${key}')">İnşa Et</button></div>`;
        }).join("");
      }
    }

    // Katmanlı hava savunması paneli
    let defSelect = document.getElementById("defense-city-select");
    if(defSelect){
      let prev = defSelect.value;
      defSelect.innerHTML="";
      getPlayerCities().forEach((city)=>{
        let opt=document.createElement("option");
        opt.value = city.name; opt.innerText = city.name;
        defSelect.appendChild(opt);
      });
      if([...defSelect.options].some(o=>o.value===prev)) defSelect.value = prev;
      let selCity = getPlayerCities().find(c=>c.name===defSelect.value) || getPlayerCities()[0];
      if(selCity){
        setEl("defense-layers-info", `Kısa: ${selCity.hss.short.current}/${selCity.hss.short.cap} · Orta: ${selCity.hss.medium.current}/${selCity.hss.medium.cap} · Uzun: ${selCity.hss.long.current}/${selCity.hss.long.cap}`);
      }
    }

    // YENİ: Siber Savunma seviyesi göstergesi
    setEl("cyber-defense-level", state.player.cyberDefenseLevel);

    let tc=state.countries[state.selectedID];
    if(tc){
      let badges = (tc.eliminated?'<span class="badge" style="background:#333;">ÇÖKMÜŞ</span>':'') +
                   (tc.relation<=0&&!tc.eliminated&&state.selectedID!==state.playerID?'<span class="badge badge-war">SAVAŞTA</span>':'') +
                   (tc.embargo?'<span class="badge badge-embargo">AMBARGO</span>':'') +
                   (tc.armsEmbargo?'<span class="badge badge-embargo">SİLAH AMBARGOSU</span>':'') +
                   (tc.radarJammed>0?'<span class="badge badge-jam">RADAR KÖR</span>':'') +
                   (tc.blockaded>0?'<span class="badge badge-blockade">ABLUKA</span>':'');
      setEl("target-country-name", flagImgHTML(state.selectedID,'flag-icon-sm') + " " + tc.name + " " + badges, true);
      setEl("target-relation", tc.relation);
      setEl("target-stability","%"+tc.stability);
      setEl("target-strength", getOwnedCities(state.selectedID).length+" şehir");
      setEl("target-alliance", tc.defensePact ? "🛡️ Savunma Paktı" : (tc.alliedWithPlayer? "✅ Müttefikimiz":"Yok"));
      setEl("target-tier", tc.isBloc ? "Blok (Orta)" : ("Tier "+(STARTING_STATS[state.selectedID]?STARTING_STATS[state.selectedID].tier:"?")));

      let select=document.getElementById("target-city-select");
      let prevIdx = select? select.value : 0;
      if(select){
        select.innerHTML="";
        tc.cities.forEach((city,idx)=>{
          let opt=document.createElement("option"); opt.value=idx;
          opt.innerText = `${city.name} (HP:%${city.hp})${city.owner!==state.selectedID?" ["+state.countries[city.owner].name+" işgalinde]":""}`;
          select.appendChild(opt);
        });
        if(prevIdx < tc.cities.length) select.value = prevIdx;
      }
      let city = tc.cities[document.getElementById("target-city-select").value] || tc.cities[0];

      // YENİ: Fog of War — Siber Ağ VEYA bu ülkeye özel keşif yapılmadıysa HSS gizli
      let canSeeHSS = state.player.tech.cyber || tc.scouted;
      setEl("recon-status", canSeeHSS ? `✅ İstihbarat mevcut — şehir savunma katmanları görünür.` : "🌫️ Bu ülke hakkında istihbaratınız yok — şehir savunma gücü bilinmiyor.");
      let hssTxt = canSeeHSS ? `Kısa:${city.hss.short.current}/${city.hss.short.cap} · Orta:${city.hss.medium.current}/${city.hss.medium.cap} · Uzun:${city.hss.long.current}/${city.hss.long.cap}` : "HSS: Bilinmiyor (🌫️ Fog of War)";
      setEl("target-city-info", tc.radarJammed>0 ? "📡 Radarları kör — savunmasız!" : hssTxt);
      // YENİ: Direniş göstergesi — sadece ilhak eden harekâtların başarı
      // şansını/kaybını etkiler, HSS gibi Fog of War'a tabi.
      setEl("target-resistance-info", canSeeHSS ? `🛡️ Direniş: %${city.resistance} (düşük direniş = daha kolay/ucuz ilhak)` : "Direniş: Bilinmiyor (🌫️ Fog of War)");
      // YENİ: AI doktrin göstergesi — Fog of War'a tabi, bloklarda yok
      setEl("target-doctrine", (!tc.isBloc && canSeeHSS && tc.doctrine) ? DOCTRINES[tc.doctrine].label : "Bilinmiyor");

      // menzil bilgisi + özelleştirme + yakıt ikmali
      let weapon = document.getElementById("attack-weapon").value;
      let cfg = WEAPON_CONFIG[weapon];
      let refuelRow = document.getElementById("refuel-row");
      if(refuelRow) refuelRow.style.display = weapon==='gen5_jet' ? "flex" : "none";
      let useRefuelChecked = weapon==='gen5_jet' && document.getElementById("use-refuel") && document.getElementById("use-refuel").checked;

      let nearest = nearestOwnedCity(state.playerID, city);
      let rangeBox = document.getElementById("range-info");
      if(nearest && cfg && rangeBox){
        let d = Math.round(nearest.dist);
        let isGroundFamily = (weapon==='kara_birligi'||weapon==='amphibious'||weapon==='airborne');
        let invItem = isGroundFamily ? 'kara_birligi' : weapon;
        let applyRangeMult = !(isGroundFamily && weapon!=='kara_birligi');
        if(useRefuelChecked && state.player.tech.air_refuel){
          rangeBox.className = "range-info";
          rangeBox.innerText = `${nearest.city.name} → ${city.name}: ${d} km · ⛽ Yakıt İkmali Aktif — Menzil Sınırsız`;
        } else if(weapon==='nuke'){
          let ok = d <= cfg.range;
          rangeBox.className = "range-info" + (ok?"":" range-bad");
          rangeBox.innerText = `${nearest.city.name} → ${city.name}: ${d} km (Menzil: ${cfg.range} km) ${ok?"✔ Menzil dahilinde":"✘ MENZİL DIŞI"}`;
        } else {
          // YENİ: Parti sistemi — envanterdeki en ekonomik/yeterli partiyi
          // otomatik gösterir, ayrı bir "hangi füzeyi kullanacağım" seçimi yok.
          let pick = pickBestBatch(invItem, weapon==='amphibious'?0:d, applyRangeMult, applyRangeMult ? null : cfg.range);
          if(pick.batch){
            let lm = logisticsDamageMult(d);
            let logTxt = lm<1 ? ` · 🚚 Lojistik cezası: hasar x${lm.toFixed(2)}` : "";
            rangeBox.className = "range-info";
            rangeBox.innerText = `${nearest.city.name} → ${city.name}: ${d} km (Kullanılacak model: ${Math.round(pick.effRange).toLocaleString()} km) ✔ Menzil dahilinde${logTxt}`;
          } else if(pick.reason==='empty'){
            rangeBox.className = "range-info range-bad";
            rangeBox.innerText = `Envanterde ${cfg.label.toUpperCase()} yok.`;
          } else {
            rangeBox.className = "range-info range-bad";
            rangeBox.innerText = `${nearest.city.name} → ${city.name}: ${d} km — envanterinizdeki en uzun menzilli model ${Math.round(pick.maxRange).toLocaleString()} km ✘ MENZİL DIŞI`;
          }
        }
      }
    }
  },

  updateUNPanel(){
    let sel = document.getElementById("un-target-select");
    if(sel){
      let prev = sel.value;
      sel.innerHTML="";
      for(let id in state.countries){
        if(id===state.playerID) continue;
        let opt = document.createElement("option"); opt.value=id;
        opt.innerText = state.countries[id].name + (state.countries[id].eliminated?" (çökmüş)":"");
        sel.appendChild(opt);
      }
      if([...sel.options].some(o=>o.value===prev)) sel.value=prev;
    }
    let list = document.getElementById("un-resolutions-list");
    if(list){
      if(state.unResolutions.length===0) list.innerHTML="Henüz bir karar önerilmedi.";
      else list.innerHTML = state.unResolutions.map(r=>{
        let cls = r.status==='vetoed'?'veto':(r.status==='passed'?'passed':'failed');
        let statusTxt = r.status==='vetoed'?`VETO (${r.vetoers.join(", ")})`:(r.status==='passed'?"KABUL EDİLDİ":"REDDEDİLDİ");
        return `<div class="resolution-item ${cls}">Tur ${r.turn} — ${r.typeLabel} → ${r.targetName}: <b>${statusTxt}</b> (${r.votesFor}-${r.votesAgainst})</div>`;
      }).join("");
    }
    setEl("un-nuke-cap", state.unNukeCap);
    setEl("un-sanction-warning", state.player.inventory.nuke > state.unNukeCap ? "⚠️ Nükleer envanteriniz BM sınırını aşıyor, yaptırım riski var!" : "");
  },

  gameOver(title,desc){
    state.gameOver = true;
    document.getElementById("gameover-screen").style.display="flex";
    setEl("go-title",title);
    // YENİ: Zafer/Yenilgi müziği — başlığa göre ayrılıyor. "🏆 ZAFER"
    // dışındaki TÜM bitiş ekranları (yenilgi, iç çöküş, hükümet düşmesi)
    // aynı "yenilgi" müziğini çalar — hepsi oyunun kaybedilmesi anlamına
    // geliyor.
    if(title.includes("ZAFER")) musicEngine.onVictory(); else musicEngine.onDefeat();
    let ownedByPlayer = getPlayerCities().length;
    let totalCities=0; for(let id in state.countries) totalCities += state.countries[id].cities.length;
    let pct = Math.round(ownedByPlayer/totalCities*100);
    let techCount = Object.values(state.player.tech).filter(Boolean).length;
    let scoreHTML = `${desc}<br><br>
      <b>Tur:</b> ${state.turn}<br>
      <b>Kontrol edilen toprak:</b> %${pct} (${ownedByPlayer}/${totalCities} şehir)<br>
      <b>Geliştirilen teknoloji:</b> ${techCount}/8<br>
      <b>Kalan hazine:</b> ${state.player.budget.toLocaleString()}$<br>
      <b>Halk desteği:</b> %${Math.round(state.player.publicSupport)}`;
    document.getElementById("score-card").innerHTML = scoreHTML;
    this._scoreText = `TAYFUN — ${title}\nTur: ${state.turn} | Toprak: %${pct} | Teknoloji: ${techCount}/8 | Halk Desteği: %${Math.round(state.player.publicSupport)}`;
  }
};

/* YENİ: Ar-Ge kuyruğu tamamlanınca çağrılır — teknolojiyi açar ve o
   teknolojiye özel bonus/log mesajını uygular. */
function applyResearchEffect(item){
  state.player.tech[item] = true;
  if(item==='hss_adv'){
    state.countries[state.playerID].cities.forEach(c=>{ ['short','medium','long'].forEach(l=>{ c.hss[l].cap+=20; c.hss[l].current+=20; }); });
    log("🛡️ HSS Modernizasyonu tamamlandı! Tüm şehirlerin katmanlı hava savunma kapasitesi arttı.","#00ff66");
  } else if(item==='nuclear'){
    log("☢️ Nükleer program tamamlandı! (Kıtalararası fırlatma için ayrıca ICBM teknolojisi gerekir)","#00ff66");
  } else if(item==='cyber'){
    log("💻 Siber İstihbarat Ağı aktif! Düşman şehirlerinin HSS durumunu ve teknoloji çalma imkânını kazandınız.","#00ff66");
    ui.buildMap(); // YENİ: siber teknolojisiyle gelen global görürlük fog of war katmanını haritada da kaldırsın
  } else if(item==='radar'){
    log("📡 Gelişmiş Radar devrede! Gelen saldırıları %15 daha iyi tespit ediyorsunuz.","#00ff66");
  } else if(item==='gen5_jet'){
    log("✈️ Hava Üstünlüğü Doktrini kazanıldı! Uçak üretim maliyeti düştü, saldırı hasarı arttı.","#00ff66");
  } else if(item==='mrbm'){
    log("🛰️ Orta Menzil Roket Programı tamamlandı! Artık ICBM teknolojisi geliştirilebilir.","#00ff66");
  } else if(item==='icbm'){
    log("🚀 Kıtalararası Füze Programı tamamlandı! Artık ICBM üretebilir ve nükleer başlığı kıtalararası mesafeye taşıyabilirsiniz.","#00ff66");
  } else if(item==='air_refuel'){
    log("⛽ Havada Yakıt İkmali Programı tamamlandı! Uçaklarınız artık ek maliyet karşılığında sınırsız menzile ulaşabilir.","#00ff66");
  }
}

/* YENİ: Kara/Çıkarma/Hava İndirme harekâtının ortak sonuç mantığı — hem
   anlık harekâtlar (gameLoop çarpışma anı) hem de gecikmeli çıkarma
   harekâtı (3 tur sonra nextTurn içinde) bunu çağırır. */
function resolveGroundAssault(tgtCity, attackerID, cfg, sourceBatch, dist, forceSize){
  dist = dist||0; forceSize = Math.max(1, forceSize||1);
  let resistance = tgtCity.resistance;
  tgtCity.lastHitTurn = state.turn; // YENİ: gerçek bir çarpışma oldu — bu şehir bu tur toparlanmaz
  // YENİ: Lojistik — mesafe arttıkça başarı şansı düşer, kayıplar artar.
  let logPenalty = logisticsSuccessPenalty(dist);
  // YENİ: Gönderilen kuvvet büyüklüğü (forceSize) başarı şansını hafifçe artırır.
  let forceBonus = Math.min(0.25, (forceSize-1)*0.02);
  let successChance = Math.max(0.05, Math.min(0.95, 0.35 + (1 - resistance/100) * 0.6 + forceBonus - logPenalty));
  let baseLosses = Math.max(1, Math.round((1 + (resistance/100) * 2) * (1+logPenalty))); // 1-3+ tümen, uzak cephede daha fazla
  let losses = Math.min(forceSize, baseLosses);
  let success = Math.random() < successChance;
  let isPlayerInvolved = (attackerID===state.playerID || tgtCity.owner===state.playerID);
  if(attackerID===state.playerID){
    state.player.inventory.kara_birligi = Math.max(0, state.player.inventory.kara_birligi - losses);
    if(sourceBatch) sourceBatch.qty = Math.max(0, sourceBatch.qty - losses);
    state.player.batches.kara_birligi = (state.player.batches.kara_birligi||[]).filter(b=>b.qty>0);
  }
  if(success){
    let prevOwnerWasPlayer = tgtCity.owner===state.playerID;
    tgtCity.owner = attackerID; tgtCity.hp = 60; tgtCity.resistance = 100;
    // YENİ: Sahiplik değiştiği için savunma stoğu da YENİ sahibe göre
    // yeniden hesaplanır (AI ev sahibiyken +%30, oyuncu iken normal) —
    // tgtCity.baseHssCap haritadaki HAM değer, hiç değişmez.
    let newMult = (attackerID!==state.playerID) ? 1.3 : 1.0;
    ['short','medium','long'].forEach(l=>{
      tgtCity.hss[l].cap = Math.round((tgtCity.baseHssCap||tgtCity.hss[l].cap)*newMult);
      tgtCity.hss[l].current = Math.round(tgtCity.hss[l].cap*0.3);
    });
    ui.buildMap();
    if(attackerID===state.playerID){
      log(`🏳️ ŞEHİR DÜŞTÜ: ${tgtCity.name} ${cfg.label.toUpperCase()} ile ele geçirildi! (${losses} tümen kaybı)`,"#00ff66");
    } else if(prevOwnerWasPlayer){
      log(`💀 ŞEHRİMİZ DÜŞTÜ: ${tgtCity.name}, ${state.countries[attackerID].name} tarafından ${cfg.label.toUpperCase()} ile ele geçirildi!`,"#ff3344");
    }
  } else if(isPlayerInvolved){
    if(attackerID===state.playerID) log(`💀 HAREKÂT BAŞARISIZ: ${tgtCity.name} alınamadı, ${losses} tümen kaybedildi. (Direniş: %${resistance})`,"#ff3344");
    else log(`🛡️ SAVUNMA BAŞARILI: ${state.countries[attackerID].name}'ın ${tgtCity.name}'e yönelik harekâtı püskürtüldü!`,"#3fb87f");
  }
}

/* ================= YENİ: NÜKLEER ÜRETİM KRİZİ + BM YAPTIRIM TEKLİFİ =================
   Oyuncu bir nükleer başlık ÜRETTİĞİNDE (bkz. üretim kuyruğu tamamlanma
   noktası, state.player.pendingNukeCrisis=true), BİR SONRAKİ turun
   başında bu fonksiyon çağrılır: en kötü ilişkili ülke öncülüğünde BM'ye
   bir yaptırım kararı sunulmuş gibi davranılır — mevcut resolveUNVote()
   (ilişki/P5 veto mantığı) AYNEN kullanılır, ikinci bir oylama sistemi
   YAZILMAZ. Kabul edilirse mevcut sanctionRemaining mekanizması (gelir
   -%30) 10 tur boyunca devreye girer. */
function checkNukeCrisis(){
  if(!state.player.pendingNukeCrisis) return;
  state.player.pendingNukeCrisis = false;
  let me = state.countries[state.playerID];
  let candidates = Object.keys(state.countries).filter(id=>id!==state.playerID && !state.countries[id].isBloc && !state.countries[id].eliminated);
  if(candidates.length===0) return;
  let worst = candidates.reduce((a,b)=> state.countries[a].relation <= state.countries[b].relation ? a : b);
  let worstC = state.countries[worst];
  let vote = resolveUNVote(state.playerID);
  let outcomeText, severity;
  if(vote.status==='vetoed'){
    outcomeText = `Karar VETO EDİLDİ (${vote.vetoers.join(', ')}). Herhangi bir yaptırım uygulanmadı.`;
    severity = 'warning';
  } else if(vote.status==='passed'){
    state.sanctionRemaining = Math.max(state.sanctionRemaining, 10);
    outcomeText = `BM Güvenlik Konseyi kararı KABUL EDİLDİ (${vote.votesFor} lehte, ${vote.votesAgainst} aleyhte). 10 tur boyunca ekonomik yaptırım uygulanacak (gelir -%30).`;
    severity = 'critical';
  } else {
    outcomeText = `Karar REDDEDİLDİ (${vote.votesFor} lehte, ${vote.votesAgainst} aleyhte). Herhangi bir yaptırım uygulanmadı.`;
    severity = 'warning';
  }
  log(`☢️ ${me.name} nükleer silah üretti! ${worstC.name} öncülüğünde BM'ye yaptırım kararı sunuldu.`, severity==='critical'?'#ef4444':'#f59e0b');
  ui.openCrisisPopup(
    `NÜKLEER GÜÇ: ${me.name} Nükleer Silah Üretti`,
    `<div>${me.name}'nin nükleer silah geliştirdiği uluslararası kamuoyuna yansıdı. En gergin ilişkili ülke <b>${worstC.name}</b> öncülüğünde BM Güvenlik Konseyi'ne bir yaptırım kararı sunuldu.</div><div style="margin-top:8px;">${outcomeText}</div>`,
    severity
  );
}

const engine = {
  startGame(countryId, difficulty="normal"){
    state = buildInitialState(countryId, difficulty);
    document.getElementById("country-select-screen").style.display="none";
    document.getElementById("game-container").style.display="flex";
    ui.init();
    setTimeout(resizeCanvas, 50);
    if(!animator.loopStarted){ animator.loopStarted=true; gameLoop(); }
  },

  /* YENİ: Yeni dropdown tabanlı seçim ekranından başlatma — zorluk seviyesi de okunur */
  startGameFromDropdown(){
    let sel = document.getElementById("country-dropdown");
    if(!sel || !sel.value) return alert("Lütfen bir ülke seçin.");
    let diffSel = document.getElementById("difficulty-select");
    this.startGame(sel.value, diffSel ? diffSel.value : "normal");
  },

  loadCodeFromStart(){
    let code = document.getElementById("start-sync-code").value.trim();
    if(!code) return alert("Önce kutuya bir kayıt kodu yapıştırmalısın.");
    try{
      let json = decodeURIComponent(escape(atob(code)));
      let parsed = JSON.parse(json);
      if(!parsed || !parsed.player || !parsed.countries){ alert("Kod geçersiz veya bozuk."); return; }
      state = parsed;
      document.getElementById("country-select-screen").style.display="none";
      document.getElementById("game-container").style.display="flex";
      ui.init();
      setTimeout(resizeCanvas, 50);
      if(!animator.loopStarted){ animator.loopStarted=true; gameLoop(); }
      log("📥 Oyun koddan başarıyla yüklendi!","#00ff66");
    }catch(e){ alert("Kod okunamadı — doğru kopyalandığından emin ol."); }
  },

  generateCode(){
    try{
      let json = JSON.stringify(state);
      let code = btoa(unescape(encodeURIComponent(json)));
      let box = document.getElementById("sync-code");
      box.value = code; box.select();
      log("🔗 Kayıt kodu oluşturuldu. Kutudaki metni kopyalayıp başka bir cihazda 'Koddan Yükle' kutusuna yapıştır.","#00ff66");
    }catch(e){ log("❌ Kod oluşturulamadı: "+e.message,"red"); }
  },
  loadCode(){
    try{
      let code = document.getElementById("sync-code").value.trim();
      if(!code) return log("Önce kutuya bir kayıt kodu yapıştırmalısın.","yellow");
      let json = decodeURIComponent(escape(atob(code)));
      let parsed = JSON.parse(json);
      if(!parsed || !parsed.player || !parsed.countries) return log("❌ Kod geçersiz veya bozuk.","red");
      state = parsed;
      /* YENİ: eski bir kayıt kodu (AI eklentisinden önce oluşturulmuş)
         bu alanları içermeyebilir — eksikse güvenle boş başlat. Bu
         sayede "yalnızca bu kayda ait AI verisi" kuralı her durumda
         korunur, hiçbir zaman undefined üzerinden hata fırlamaz. */
      if(!Array.isArray(state.player.aiChatLog)) state.player.aiChatLog = [];
      if(!Array.isArray(state.player.aiCountryChats)) state.player.aiCountryChats = [];
      if(!Array.isArray(state.player.pendingAttackResolutions)) state.player.pendingAttackResolutions = [];
      for(let cid in state.countries){
        let c = state.countries[cid];
        if(cid!==state.playerID && !c.isBloc && !c.inventory){
          let inv={}; let m = STARTING_STATS[cid]?STARTING_STATS[cid].invMult:0.4;
          for(let k in BASE_INVENTORY) inv[k] = Math.round(BASE_INVENTORY[k]*m*0.6);
          c.inventory = inv;
        }
      }
      document.getElementById("country-select-screen").style.display="none";
      document.getElementById("game-container").style.display="flex";
      ui.init();
      setTimeout(resizeCanvas, 50);
      if(!animator.loopStarted){ animator.loopStarted=true; gameLoop(); }
      log("📥 Oyun koddan başarıyla yüklendi!","#00ff66");
    }catch(e){ log("❌ Kod okunamadı — doğru kopyalandığından emin ol.","red"); }
  },

  selectCountry(id){ state.selectedID=id; setEl("quote-box","—"); ui.updateAll(); },

  getStatement(){
    let tc = state.countries[state.selectedID];
    if(state.selectedID===state.playerID) return;
    let pool;
    if(tc.eliminated) pool = QUOTES.eliminated;
    else if(tc.relation<=0) pool = QUOTES.hostile;
    else if(tc.relation<40) pool = QUOTES.low;
    else if(tc.relation<70) pool = QUOTES.mid;
    else pool = QUOTES.high;
    setEl("quote-box", `"${pickQuote(pool)}" — ${tc.name} Dışişleri`);
  },

  copyScore(){
    if(!navigator.clipboard || !navigator.clipboard.writeText){
      log("Kopyalama desteklenmiyor, sonucu elle not alabilirsin: "+(ui._scoreText||""), "yellow");
      return;
    }
    navigator.clipboard.writeText(ui._scoreText || "").then(()=>{
      log("📋 Sonuç panoya kopyalandı.","#00ff66");
    }).catch(()=>{
      log("Kopyalama için izin alınamadı, sonucu elle not alabilirsin: "+(ui._scoreText||""), "yellow");
    });
  },

  /* YENİ: Ar-Ge artık anlık değil, kuyrukta birkaç tur bekliyor. Teknokrasi
     ideolojisi süreyi kısaltır. Asıl bonus/log efektleri kuyruk tamamlanınca
     applyResearchEffect() ile (nextTurn içinden) uygulanır. */
  research(item){
    const cost = RESEARCH_COSTS[item];
    if(state.player.tech[item]) return log("Bu teknoloji zaten geliştirilmiş.","yellow");
    if(state.player.researchQueue.find(q=>q.item===item)) return log("Bu teknoloji zaten Ar-Ge kuyruğunda.","yellow");
    if(item==='icbm' && !state.player.tech.mrbm && !state.player.researchQueue.find(q=>q.item==='mrbm')) return log("Önce Orta Menzil Roket Programı geliştirilmeli!","red");
    if(state.player.budget < cost) return log("Ar-Ge için bütçe yetersiz!","red");
    state.player.budget -= cost;
    const BASE_RESEARCH_TURNS = {nuclear:6, cyber:2, radar:2, hss_adv:3, gen5_jet:4, mrbm:3, icbm:5, air_refuel:3};
    let turns = Math.max(1, Math.round((BASE_RESEARCH_TURNS[item]||3) * IDEOLOGY_CONFIG[state.player.ideology].researchMult * getResearchSpeedMult()));
    state.player.researchQueue.push({item, turnsLeft:turns});
    log(`🔬 Ar-Ge başladı: ${item.toUpperCase()} — ${turns} tur sürecek.`,"#00ccff");
    ui.updateAll();
  },

  /* YENİ: Menzil/Hasar/Hız kaydırıcıları her zaman toplamda %100 kalacak
     şekilde otomatik yeniden dengelenir. */
  rebalanceCustom(which){
    let vals = {
      range: parseInt(document.getElementById("custom-range").value)||0,
      dmg: parseInt(document.getElementById("custom-dmg").value)||0,
      speed: parseInt(document.getElementById("custom-speed").value)||0
    };
    let others = Object.keys(vals).filter(k=>k!==which);
    let remaining = 100 - vals[which];
    let othersSum = others.reduce((a,k)=>a+vals[k],0);
    if(othersSum<=0){ vals[others[0]] = Math.round(remaining/2); vals[others[1]] = remaining - vals[others[0]]; }
    else {
      vals[others[0]] = Math.round(vals[others[0]]/othersSum*remaining);
      vals[others[1]] = remaining - vals[others[0]];
    }
    document.getElementById("custom-range").value=vals.range;
    document.getElementById("custom-dmg").value=vals.dmg;
    document.getElementById("custom-speed").value=vals.speed;
    setEl("custom-range-val", vals.range+"%");
    setEl("custom-dmg-val", vals.dmg+"%");
    setEl("custom-speed-val", vals.speed+"%");
    engine.calcProdTime();
  },

  calcProdTime(){
    let item=document.getElementById("prod-item").value;
    let tier=parseInt(document.getElementById("prod-tier").value)||1;
    let cfg = WEAPON_CONFIG[item];
    if(!cfg) return;
    let cost=cfg.cost*tier;
    if(item==='gen5_jet' && state.player.tech.gen5_jet) cost = Math.round(cost*0.8);
    // YENİ: Yönetim biçimi + Sıkıyönetim üretim maliyetini etkiler
    cost = Math.round(cost * IDEOLOGY_CONFIG[state.player.ideology].prodCostMult * (state.player.laws.martial?0.5:1));
    let turns=cfg.turns*tier;

    let customizable = cfg.range!==undefined && item!=='nuke';
    let customBox = document.getElementById("custom-weapon-box");
    if(customBox) customBox.style.display = customizable ? "flex" : "none";
    if(customizable){
      let speedPct = parseInt(document.getElementById("custom-speed").value)||33;
      turns = Math.max(1, Math.round(turns * (1.3 - (speedPct/100)*0.6)));
    }

    let extra = cfg.uraniumCost ? ` + ${cfg.uraniumCost} Uranyum` : (cfg.manpowerCost ? ` + ${cfg.manpowerCost.toLocaleString()} Nüfus`:"");
    let reqTxt = cfg.requiresTech && !state.player.tech[cfg.requiresTech] ? ` ⚠️ ${cfg.requiresTech.toUpperCase()} teknolojisi gerekli` : "";
    let icbmTxt = cfg.requiresIcbm && !state.player.tech.icbm ? " ⚠️ ICBM teknolojisi gerekli" : "";
    let statsTxt = "";
    if(customizable){
      let rangePct = parseInt(document.getElementById("custom-range").value)||34;
      let dmgPct = parseInt(document.getElementById("custom-dmg").value)||33;
      let rangeMult = 0.7 + (rangePct/100)*0.6;
      let dmgMult = 0.7 + (dmgPct/100)*0.6;
      statsTxt = ` · Sonuç: Menzil ${Math.round(cfg.range*rangeMult).toLocaleString()}km (baz ${cfg.range.toLocaleString()}km), Hasar ${Math.round(cfg.dmg*dmgMult)} (baz ${cfg.dmg})`;
    }
    setEl("prod-info", `Süre: ${turns} tur · Maliyet: ${cost.toLocaleString()}$${extra}${reqTxt}${icbmTxt}${statsTxt}`);
  },

  startProduction(){
    let item=document.getElementById("prod-item").value;
    let tier=parseInt(document.getElementById("prod-tier").value)||1;
    let cfg = WEAPON_CONFIG[item];
    if(!cfg) return log("Geçerli bir ürün seçilmedi.","red");
    let cost=cfg.cost*tier;
    if(item==='gen5_jet' && state.player.tech.gen5_jet) cost = Math.round(cost*0.8);
    cost = Math.round(cost * IDEOLOGY_CONFIG[state.player.ideology].prodCostMult * (state.player.laws.martial?0.5:1));
    let turns=cfg.turns*tier;

    let customizable = cfg.range!==undefined && item!=='nuke';
    let custom = null;
    if(customizable){
      let rangePct = parseInt(document.getElementById("custom-range").value)||34;
      let dmgPct = parseInt(document.getElementById("custom-dmg").value)||33;
      let speedPct = parseInt(document.getElementById("custom-speed").value)||33;
      custom = { rangeMult: 0.7 + (rangePct/100)*0.6, dmgMult: 0.7 + (dmgPct/100)*0.6 };
      turns = Math.max(1, Math.round(turns * (1.3 - (speedPct/100)*0.6)));
    }

    if(cfg.requiresTech && !state.player.tech[cfg.requiresTech]) return log(`Önce ${cfg.requiresTech.toUpperCase()} teknolojisini geliştirmelisiniz!`,"red");
    if(cfg.requiresIcbm && !state.player.tech.icbm) return log("Nükleer başlığın kıtalararası menzile taşınabilmesi için ICBM teknolojisi gerekli!","red");
    if(state.player.budget<cost) return log("Bütçe yetersiz!","red");
    if(cfg.uraniumCost && state.player.uranium<cfg.uraniumCost) return log(`Bu üretim için ${cfg.uraniumCost} Uranyum gerekli!`,"red");
    if(cfg.manpowerCost && state.player.manpower<cfg.manpowerCost) return log(`Bu üretim için ${cfg.manpowerCost.toLocaleString()} nüfus gerekli!`,"red");

    state.player.budget-=cost;
    if(cfg.uraniumCost) state.player.uranium-=cfg.uraniumCost;
    if(cfg.manpowerCost) state.player.manpower-=cfg.manpowerCost;

    state.player.productionQueue.push({item,tier,turnsLeft:turns,custom});
    let customTxt = custom ? ` [Menzil x${custom.rangeMult.toFixed(2)}, Hasar x${custom.dmgMult.toFixed(2)}]` : "";
    log(`🏭 Üretime başlandı: ${cfg.label.toUpperCase()} (Tier ${tier})${customTxt} — ${turns} tur sürecek.`,"#00ccff");
    ui.updateAll();
  },

  upgradeDefense(layer){
    let name = document.getElementById("defense-city-select").value;
    let city = getPlayerCities().find(c=>c.name===name);
    if(!city) return log("Geçerli bir şehir seçilmedi.","red");
    const costs={short:50000,medium:90000,long:140000};
    const gains={short:15,medium:20,long:25};
    const labels={short:"Kısa Menzil",medium:"Orta Menzil",long:"Uzun Menzil"};
    let cost=costs[layer];
    if(state.player.budget<cost) return log(`${labels[layer]} savunma yükseltmesi için ${cost.toLocaleString()}$ gerekli.`,"red");
    state.player.budget -= cost;
    city.hss[layer].cap += gains[layer];
    city.hss[layer].current = city.hss[layer].cap;
    log(`🛡️ ${city.name} ${labels[layer]} hava savunması güçlendirildi! Yeni kapasite: ${city.hss[layer].cap}`,"#00ff66");
    ui.updateAll();
  },

  /* YENİ: Fabrika inşası — seçili şehre bir fabrika ekler, para+hammadde
     tüketir. Etkiler nextTurn içinde toplu olarak uygulanır. */
  buildFactory(type){
    const cfg = FACTORY_CONFIG[type];
    if(!cfg) return;
    let citySel = document.getElementById("factory-city-select");
    let city = citySel ? getPlayerCities().find(c=>c.name===citySel.value) : null;
    if(!city) return log("Geçerli bir şehir seçilmedi.","red");
    if(state.player.budget<cfg.cost) return log(`${cfg.label} için ${cfg.cost.toLocaleString()}$ gerekli.`,"red");
    if(state.player.resources<cfg.resourceCost) return log(`${cfg.label} için ${cfg.resourceCost} hammadde gerekli.`,"red");
    state.player.budget -= cfg.cost;
    state.player.resources -= cfg.resourceCost;
    if(!city.factories) city.factories = {};
    city.factories[type] = (city.factories[type]||0)+1;
    log(`${cfg.icon} ${cfg.label} inşa edildi: ${city.name}.`,"#00ff66");
    ui.buildMap(); ui.updateAll();
  },

  /* YENİ: Siber Savunma — düşmanın size yönelik siber operasyon başarı
     şansını kalıcı olarak düşürür (İstihbarat Ajansı fabrikalarıyla birlikte çalışır). */
  upgradeCyberDefense(){
    const cost = 60000;
    if(state.player.budget<cost) return log(`Siber savunma yükseltmesi için ${cost.toLocaleString()}$ gerekli.`,"red");
    state.player.budget -= cost;
    state.player.cyberDefenseLevel++;
    log(`🛡️💻 Siber Savunma güçlendirildi! Yeni seviye: ${state.player.cyberDefenseLevel}`,"#00ff66");
    ui.updateAll();
  },

  /* YENİ: Siber Operasyonlar — 4 tür (Radar Körletme, Üretim Sabotajı, Mali
     Sızma, Dezenformasyon). Hedef başına tur başı sadece 1 deneme hakkı var
     (cyberAttemptsThisTurn[targetId] o turun numarasını tutar). Başarı şansı
     saldıran/hedef Tier farkına ve hedefin siber savunmasına göre değişir. */
  cyberOp(type){
    let p = state.player;
    let target = state.countries[state.selectedID];
    if(!target) return log("Geçerli bir hedef seçilmedi.","red");
    if(state.selectedID===state.playerID) return log("Kendi ülkenize siber operasyon düzenleyemezsiniz.","yellow");
    if(!p.tech.cyber) return log("Önce Siber İstihbarat Ağı teknolojisi gerekli.","red");
    if((p.cyberAttemptsThisTurn[state.selectedID]||0) === state.turn) return log(`${target.name} için bu tur zaten bir siber operasyon denediniz (tur başına 1 hak).`,"yellow");
    let cfg = CYBER_OPS[type];
    if(!cfg) return log("Geçersiz siber operasyon türü.","red");
    if(p.budget<cfg.cost) return log(`${cfg.label} için ${cfg.cost.toLocaleString()}$ gerekli.`,"red");

    p.budget -= cfg.cost;
    p.cyberAttemptsThisTurn[state.selectedID] = state.turn;

    let atkTier = countryTier(state.playerID), defTier = countryTier(state.selectedID);
    let chance = 0.55 + (defTier-atkTier)*0.08 - getEffectiveCyberDefense()*0.03 - (target.cyberDefenseLevel||0)*0.05;
    chance = Math.max(0.1, Math.min(0.9, chance));
    let success = Math.random() < chance;
    soundEngine.play('cyber_attack');

    if(success){
      if(type==='jam'){ target.radarJammed = Math.max(target.radarJammed,3); log(`💻 SİBER SALDIRI BAŞARILI (${cfg.label}): ${target.name} radarları 3 tur boyunca kör edildi!`,"#a855f7"); }
      else if(type==='sabotage_prod'){ target.stability = Math.max(0,target.stability-8); log(`💻 SİBER SALDIRI BAŞARILI (${cfg.label}): ${target.name}'da üretim tesisleri sabote edildi (istikrar -8).`,"#a855f7"); }
      else if(type==='financial'){ let stolen = 30000+Math.round(Math.random()*30000); p.budget += stolen; log(`💻 SİBER SALDIRI BAŞARILI (${cfg.label}): ${target.name}'dan ${stolen.toLocaleString()}$ mali sızıntı yapıldı!`,"#a855f7"); }
      else if(type==='disinfo'){ target.relation = Math.max(0,target.relation-10); p.publicSupport = Math.min(100, p.publicSupport+3); log(`💻 SİBER SALDIRI BAŞARILI (${cfg.label}): ${target.name}'da dezenformasyon kampanyası ilişkileri sarstı (-10), size destek getirdi (+3).`,"#a855f7"); }
    } else {
      target.relation = Math.max(0, target.relation-5);
      log(`💻 SİBER SALDIRI BAŞARISIZ (${cfg.label}): Operasyon tespit edildi, ${target.name} ile ilişkiler bozuldu (-5), para boşa gitti.`,"#ef4444");
    }
    ui.updateAll();
  },

  /* ================= YENİ: AI → OYUN MOTORU KÖPRÜSÜ =================
     AI'ın önerdiği/döndürdüğü yapılandırılmış işlemi burada DOĞRULAYIP
     uygular. AI hiçbir zaman doğrudan kod çalıştırmaz veya bir motor
     fonksiyonunu bypass edemez — sadece AI_ALLOWED_ACTIONS tablosunda
     ÖNCEDEN TANIMLI bir anahtar döndürür, bu fonksiyon o anahtarı gerçek
     (zaten var olan, kendi doğrulamalarını da yapan) motor fonksiyonuna
     eşler. Hedef/parametre geçersizse veya çalışma anında bir hata
     oluşursa işlem sessizce reddedilir — oyun asla bundan çökmez. */
  applyAiAction(actionObj){
    try{
      if(!actionObj || typeof actionObj!=='object' || !actionObj.action){
        log("🤖 AI'dan geçerli bir komut alınamadı, hiçbir işlem uygulanmadı.","red"); return;
      }
      let def = AI_ALLOWED_ACTIONS[actionObj.action];
      if(!def){
        log(`🤖 AI'ın önerdiği işlem ("${escapeHTML(actionObj.action)}") oyun motoru tarafından tanınmıyor, uygulanmadı.`,"yellow"); return;
      }
      if(actionObj.action==='none'){
        log("🤖 AI bu istek için uygulanabilir bir oyun içi işlem önermedi.","#7d8fa3"); return;
      }
      if(def.needsTarget){
        let tid = actionObj.target;
        if(!tid || !state.countries[tid] || tid===state.playerID){
          log(`🤖 AI'ın belirttiği hedef ülke ("${escapeHTML(tid)}") geçersiz, işlem uygulanmadı.`,"red"); return;
        }
        state.selectedID = tid;
      }
      if(def.needsParam){
        let v = actionObj.params && actionObj.params[def.needsParam];
        if(def.validParam && !def.validParam(v)){
          log(`🤖 AI'ın önerdiği parametre ("${escapeHTML(v)}") geçersiz, işlem uygulanmadı.`,"red"); return;
        }
      }
      let targetName = (def.needsTarget && state.countries[actionObj.target]) ? state.countries[actionObj.target].name : "";
      def.fn(actionObj);
      log(`🤖 AI komutu uygulandı: ${escapeHTML(actionObj.action)}${targetName?(' → '+targetName):''}`,"#a855f7");
    } catch(e){
      log("🤖 AI komutu uygulanırken bir hata oluştu, HİÇBİR değişiklik yapılmadı: "+e.message,"red");
    }
  },

  /* ================= YENİ: SALDIRI GECİKMESİ SONUÇ İŞLEME =================
     ui.closeTurnReport() tarafından, tur raporu kapatıldıktan 1 saniye
     sonra çağrılır. state.player.pendingAttackResolutions kuyruğundaki
     TÜM bekleyen oyuncu saldırılarının gerçek hasar/ilhak sonucunu şimdi
     uygular. Hedef ülke/şehir bu süre içinde yok olmuş olabilir (örn.
     başka bir saldırıyla çökmüş) — bu durumda o iş sessizce ve güvenle
     atlanır, oyun asla çökmez. */
  processPendingAttacks(){
    let queue = state.player.pendingAttackResolutions || [];
    if(queue.length===0) return;
    state.player.pendingAttackResolutions = [];
    queue.forEach(job=>{
      try{
        let country = state.countries[job.targetCountryId];
        if(!country || country.eliminated){ log(`⚠️ Gecikmeli saldırı sonucu iptal edildi — hedef ülke artık mevcut değil.`,"yellow"); return; }
        let city = job.targetCityIdx>=0 ? country.cities[job.targetCityIdx] : null;
        if(!city){ log(`⚠️ Gecikmeli saldırı sonucu iptal edildi — hedef şehir artık mevcut değil.`,"yellow"); return; }
        if(job.isCapture){
          resolveGroundAssault(city, job.attackerID, WEAPON_CONFIG[job.type], job.sourceBatch, job.dist, job.forceSize);
        } else {
          city.hp = Math.max(0, city.hp - job.dmg);
          city.resistance = Math.max(0, city.resistance - job.dmg);
          city.lastHitTurn = state.turn; // YENİ: bu şehir bu tur toparlanmaz
          log(`💥 GECİKMELİ SONUÇ: ${city.name} vuruldu! HP:%${city.hp} Direniş:%${city.resistance} — ilhak için kara/çıkarma/hava indirme harekâtı gerekli.`,"#ff8800");
        }
      } catch(e){
        log("⚠️ Gecikmeli saldırı sonucu işlenirken bir hata oluştu, o iş atlandı: "+e.message,"yellow");
      }
    });
    ui.updateAll();
  },

  /* YENİ: İstihbarat / Fog of War — casus (riskli, ucuz) ya da uydu (garanti, pahalı) */
  doRecon(mode){
    let target = state.countries[state.selectedID];
    if(state.selectedID===state.playerID) return log("Kendi ülkenizi keşfe gerek yok.","yellow");
    if(target.eliminated) return log(`${target.name} zaten çökmüş durumda.`,"yellow");
    const p = state.player;
    if(mode==='spy'){
      if(p.budget<20000) return log("Casus göndermek için 20.000$ gerekli.","red");
      p.budget-=20000;
      if(Math.random()<0.25){
        target.relation = Math.max(0, target.relation-15);
        log(`🕵️ CASUS YAKALANDI: ${target.name} ile ilişkiler sert düştü (-15), istihbarat elde edilemedi.`,"red");
      } else {
        target.scouted = true;
        log(`🕵️ Casus başarıyla ${target.name} şehir savunma bilgilerini elde etti.`,"#00ccff");
        ui.buildMap(); // YENİ: fog of war katmanı haritada anında kalksın
      }
    } else if(mode==='satellite'){
      if(p.budget<35000) return log("Uydu keşfi için 35.000$ gerekli.","red");
      p.budget-=35000; target.scouted = true;
      log(`🛰️ Uydu keşfi tamamlandı: ${target.name} şehir savunma bilgileri artık görünür (ifşa riski yok).`,"#1e3a5f");
      ui.buildMap(); // YENİ: fog of war katmanı haritada anında kalksın
    }
    ui.updateAll();
  },

  diplomacy(action){
    let target = state.countries[state.selectedID];
    if(state.selectedID===state.playerID) return log("Kendi ülkenizle diplomasi yürütemezsiniz.","yellow");
    if(target.eliminated) return log(`${target.name} artık çökmüş durumda, diplomasi yürütülemez.`,"yellow");
    const p = state.player;

    if(action==='justify'){
      if(target.casusBelli) return log("Zaten bir casus belli mevcut.","yellow");
      if(p.budget<25000) return log("Bütçe yetersiz ($25K gerekli).","red");
      p.budget-=25000; target.casusBelli=true;
      log(`🕵️ ${target.name} için casus belli oluşturuldu. Savaş ilanı artık ilişkilere ve istikrara daha az zarar verecek (BM nezdinde de daha meşru sayılır).`,"#00ccff");
    }
    else if(action==='war'){
      if(target.alliedWithPlayer) return log(`${target.name} müttefikinizdir, önce ittifakı bozmalısınız.`,"yellow");
      let hadCasusBelli = target.casusBelli;
      let stabilityHit = hadCasusBelli ? 3 : 12;
      let supportHit = hadCasusBelli ? 2 : 8;
      target.relation = 0; target.casusBelli=false; target.warTurns=0; target.freeTrade=false;
      state.player.stability = Math.max(0, state.player.stability - stabilityHit);
      state.player.publicSupport = Math.max(0, state.player.publicSupport - supportHit);
      state.globalTension = Math.min(100, state.globalTension + 15);
      if(!hadCasusBelli) log(`⚠️ Casus belli olmadan açılan savaşlar BM nezdinde kınama ihtimalini artırır.`,"#facc15");
      log(`⚔️ ${target.name} ile SAVAŞ BAŞLADI! (İstikrar -${stabilityHit})`,"red");
      soundEngine.play('war_declare'); musicEngine.syncWarState();
    }
    else if(action==='send_envoy'){
      if(p.budget<15000) return log("Elçi göndermek için 15.000$ gerekli.","red");
      p.budget-=15000; target.relation=Math.min(100,target.relation+15);
      log(`🕊️ Elçi gönderildi: ${target.name} ile ilişkiler gelişti (+15).`,"#38bdf8");
      soundEngine.play('diplomacy_success');
    }
    else if(action==='alliance'){
      if(target.relation<70) return log("İttifak için ilişki seviyesi en az %70 olmalı.","yellow");
      if(p.budget<30000) return log("İttifak anlaşması için 30.000$ gerekli.","red");
      p.budget-=30000; target.alliedWithPlayer=true;
      log(`🤝 ${target.name} ile resmi ittifak kuruldu! Artık birbirinize saldıramazsınız.`,"#3fb87f");
      soundEngine.play('diplomacy_success');
    }
    else if(action==='defense_pact'){
      if(target.relation<70) return log("Kolektif savunma paktı için ilişki en az %70 olmalı.","yellow");
      if(p.budget<60000) return log("Savunma paktı için 60.000$ gerekli.","red");
      p.budget-=60000; target.alliedWithPlayer=true; target.defensePact=true;
      log(`🛡️ ${target.name} ile Kolektif Savunma Paktı imzalandı! Saldırıya uğradığınızda düzenli olarak destek gönderecek.`,"#0d4d3a");
    }
    else if(action==='free_trade'){
      if(target.relation<40) return log("Serbest ticaret için ilişki en az %40 olmalı.","yellow");
      if(p.budget<20000) return log("Anlaşma için 20.000$ gerekli.","red");
      p.budget-=20000; target.freeTrade=true;
      log(`📈 ${target.name} ile Serbest Ticaret Anlaşması imzalandı! Her tur ek gelir sağlayacak.`,"#065f46");
    }
    else if(action==='embargo'){
      target.embargo=!target.embargo;
      if(target.embargo){ target.relation-=10; target.freeTrade=false; log(`⚖️ ${target.name} ülkesine ekonomik ambargo uygulandı, ekonomisi zayıflıyor.`,"#b45309"); }
      else log(`⚖️ ${target.name} ile ticaret serbest bırakıldı.`,"#00ff66");
    }
    else if(action==='arms_embargo'){
      target.armsEmbargo=!target.armsEmbargo;
      if(target.armsEmbargo){ target.relation=Math.max(0,target.relation-8); log(`🔫 ${target.name} ülkesine silah ambargosu uygulandı — gelişmiş mühimmata erişimi kısıtlandı.`,"#4a1f3a"); }
      else log(`🔫 ${target.name} ile silah ticareti serbest bırakıldı.`,"#00ff66");
    }
    else if(action==='cyber_attack'){
      if(!p.tech.cyber) return log("Önce Siber İstihbarat Ağı teknolojisi gerekli.","red");
      if(p.budget<40000) return log("Siber operasyon için 40.000$ gerekli.","red");
      p.budget-=40000; target.radarJammed=3;
      log(`💻 SİBER SALDIRI: ${target.name} radarları 3 tur boyunca kör edildi!`,"#a855f7");
    }
    else if(action==='sabotage'){
      if(p.budget<30000) return log("Sabotaj için 30.000$ gerekli.","red");
      p.budget-=30000;
      if(Math.random()<0.3){
        target.relation = Math.max(0,target.relation-15);
        log(`🕵️ SABOTAJ AJANI YAKALANDI: ${target.name} ile ilişkiler sert düştü (-15), operasyon başarısız.`,"#be123c");
      } else {
        target.stability=Math.max(15,target.stability-10);
        log(`🕵️ SABOTAJ BAŞARILI: ${target.name} iç istikrarı sarsıldı! İstikrar: %${target.stability}`,"#be123c");
      }
    }
    else if(action==='blockade'){
      if(target.relation>0) return log("Abluka için savaş halinde olmalısınız.","yellow");
      if(p.inventory.frigate<1) return log("Abluka için en az 1 fırkateyn gerekli.","red");
      p.inventory.frigate--; target.blockaded=4;
      log(`🚢 DENİZ ABLUKASI: ${target.name} kıyıları 4 tur boyunca abluka altında, ekonomisi zayıflayacak.`,"#1f4e7a");
    }
    else if(action==='steal_tech'){
      if(!p.tech.cyber) return log("Teknoloji çalmak için Siber İstihbarat Ağı gerekli.","red");
      if(p.budget<50000) return log("Casusluk operasyonu için 50.000$ gerekli.","red");
      p.budget-=50000;
      let missing = Object.keys(p.tech).filter(k=>!p.tech[k] && k!=='cyber');
      if(missing.length===0){ log("Zaten tüm teknolojilere sahipsiniz.","yellow"); }
      else if(Math.random()<0.5){
        let stolen = missing[Math.floor(Math.random()*missing.length)];
        p.tech[stolen]=true;
        log(`🎯 CASUSLUK BAŞARILI: ${target.name}'dan "${stolen.toUpperCase()}" teknolojisi çalındı!`,"#0d6e63");
      } else {
        target.relation = Math.max(0, target.relation-20);
        log(`🎯 Casusluk operasyonu başarısız oldu, ajan yakalandı! İlişkiler sert düştü (-20) ve para boşa gitti.`,"red");
      }
    }
    /* YENİ: Barış müzakeresi — savaş halindeki bir ülkeye şartlı teklif.
       Kabul şansı hedefin istikrarına ve savaşın uzunluğuna bağlı, tazminat/
       şehir iadesi bu şansı artırır. */
    else if(action==='peace_offer_neutral' || action==='peace_offer_reparations' || action==='peace_offer_cede'){
      if(target.relation>0) return log("Barış teklifi için savaş halinde olmalısınız.","yellow");
      let acceptChance = 0.3 + (1-target.stability/100)*0.4 + Math.min(0.2, target.warTurns*0.02);
      let extra = "";
      if(action==='peace_offer_reparations'){
        let cost=60000;
        if(p.budget<cost) return log(`Tazminat teklifi için ${cost.toLocaleString()}$ gerekli.`,"red");
        p.budget -= cost; acceptChance += 0.3; extra = ` (${cost.toLocaleString()}$ tazminat ödendi)`;
      } else if(action==='peace_offer_cede'){
        let cededCity = target.cities.find(c=>c.owner===state.playerID);
        if(!cededCity) return log(`${target.name}'den ele geçirilmiş bir şehriniz yok, iade edecek bir şey bulunmuyor.`,"yellow");
        cededCity.owner = state.selectedID; cededCity.hp=70; cededCity.resistance=100;
        acceptChance += 0.35; extra = ` (${cededCity.name} geri verildi)`;
        ui.buildMap();
      }
      if(Math.random() < Math.min(0.95, acceptChance)){
        target.relation = 40; target.warTurns = 0; target.casusBelli = false;
        log(`🕊️ BARIŞ KABUL EDİLDİ: ${target.name} ile savaş sona erdi${extra}.`,"#3fb87f");
        soundEngine.play('diplomacy_success'); musicEngine.syncWarState();
      } else {
        log(`🕊️ BARIŞ TEKLİFİ REDDEDİLDİ: ${target.name} savaşı sürdürmek istiyor${extra}.`,"#7d8fa3");
      }
    }
    /* YENİ: Hava sahasını kapatma — bu ülkenin size yönelik saldırılarına
       karşı radar/önleme şansınızı kalıcı olarak artırır. */
    else if(action==='airspace_ban'){
      target.airspaceBanned = !target.airspaceBanned;
      if(target.airspaceBanned){ target.relation=Math.max(0,target.relation-5); log(`✈️🚫 ${target.name} için hava sahamız kapatıldı — bu ülkenin saldırılarına karşı önleme şansınız arttı.`,"#2b3a4a"); }
      else log(`✈️ ${target.name} için hava sahası yeniden açıldı.`,"#00ff66");
    }
    ui.updateAll();
  },

  /* YENİ: Devrim — yönetim biçimini değiştirir, her ideoloji farklı
     ekonomi/üretim/Ar-Ge/savaş-yorgunluğu dengesi sunar. */
  doRevolution(){
    let newId = document.getElementById("ideology-select").value;
    if(newId===state.player.ideology) return log("Zaten bu yönetim biçimindesiniz.","yellow");
    if(state.player.stability<25) return log("İstikrar çok düşükken devrim riskli, en az %25 istikrar gerekli.","red");
    state.player.stability = Math.max(0, state.player.stability-20);
    state.player.ideology = newId;
    log(`🔻 DEVRİM: Yönetim biçimi "${IDEOLOGY_CONFIG[newId].label}" olarak değiştirildi! (İstikrar -20)`,"#a855f7");
    ui.updateAll();
  },

  /* YENİ: Yasalar — bağımsız açılıp kapatılabilir, kalıcı ekonomi/üretim/
     isyan riski etkileri var (bkz. nextTurn ve calcProdTime/startProduction). */
  toggleLaw(key){
    state.player.laws[key] = !state.player.laws[key];
    log(`📜 ${LAW_LABELS[key]} ${state.player.laws[key] ? "YASALAŞTIRILDI" : "İPTAL EDİLDİ"}.`, state.player.laws[key] ? "#facc15" : "#7d8fa3");
    ui.updateAll();
  },

  setTaxRate(v){
    state.taxRate = parseInt(v);
    setEl("tax-rate-label", "%"+state.taxRate);
  },

  /* YENİ: BM Güvenlik Konseyi'ne karar önerme */
  proposeResolution(){
    let targetId = document.getElementById("un-target-select").value;
    let type = document.getElementById("un-resolution-type").value;
    if(!targetId) return log("Hedef seçilmedi.","yellow");
    if(state.player.budget<20000) return log("Karar önermek için 20.000$ gerekli.","red");
    state.player.budget -= 20000;

    let result = resolveUNVote(targetId);
    if(result.status==='passed') applyResolutionEffect(targetId, type);
    let target = state.countries[targetId];
    state.unResolutions.unshift({ turn:state.turn, targetName:target.name, typeLabel:RESOLUTION_LABELS[type], ...result });
    if(state.unResolutions.length>15) state.unResolutions.length=15;

    if(result.status==='vetoed') log(`🇺🇳 VETO: ${target.name} hakkındaki "${RESOLUTION_LABELS[type]}" önerisi ${result.vetoers.join(", ")} tarafından veto edildi.`,"#ff6b6b");
    else if(result.status==='passed') log(`🇺🇳 KARAR KABUL EDİLDİ: ${target.name} hakkında "${RESOLUTION_LABELS[type]}" (${result.votesFor}-${result.votesAgainst}) geçti.`,"#3fb87f");
    else log(`🇺🇳 KARAR REDDEDİLDİ: ${target.name} hakkında "${RESOLUTION_LABELS[type]}" (${result.votesFor}-${result.votesAgainst}) reddedildi.`,"#7d8fa3");

    ui.updateUNPanel(); ui.updateAll();
  },

  launchAttack(){
    let type=document.getElementById("attack-weapon").value;
    // YENİ: Gönderilecek adet — nükleer hariç tüm mühimmat/birlik türleri için.
    let qtyInput = document.getElementById("attack-qty");
    let qty = Math.max(1, parseInt(qtyInput ? qtyInput.value : 1) || 1);
    let targetCountry=state.countries[state.selectedID];
    let idx=document.getElementById("target-city-select").value;
    let targetCity=targetCountry.cities[idx]||targetCountry.cities[0];
    // YENİ: GERİ ALMA HAREKÂTI — bir şehriniz düşman tarafından ele
    // geçirildiğinde o şehir yapısal olarak hâlâ SİZİN ülke objenizin
    // cities listesinde durur (sadece owner değişir). Kendi ülkenizi
    // hedef seçip, işgal altındaki (owner'ı size ait olmayan) bir şehri
    // vuruyorsanız bu geri alma harekâtıdır — savaş ilanına/ittifak
    // kontrolüne tabi değildir (zaten işgalci ile savaştasınızdır).
    let isRecapture = (state.selectedID===state.playerID && targetCity.owner!==state.playerID);
    if(state.selectedID===state.playerID && !isRecapture) return log("Kendi ülkenize saldıramazsınız.","yellow");
    if(!isRecapture){
      if(targetCountry.alliedWithPlayer) return log(`${targetCountry.name} müttefikinizdir!`,"red");
      if(targetCountry.relation>0) return log("Önce Savaş İlan etmelisiniz!","yellow");
    }

    let cfg = WEAPON_CONFIG[type];
    if(!cfg) return log("Geçerli bir mühimmat seçilmedi.","red");
    let isGroundFamily = (type==='kara_birligi'||type==='amphibious'||type==='airborne');
    let invItem = isGroundFamily ? 'kara_birligi' : type;
    // YENİ: çıkarma/hava indirme sabit 20.000km menzilli — parti menzil
    // çarpanı sadece klasik kara harekâtına uygulanır.
    let applyRangeMult = !(isGroundFamily && type!=='kara_birligi');

    let refuelBox = document.getElementById("use-refuel");
    let useRefuel = type==='gen5_jet' && refuelBox && refuelBox.checked;
    if(useRefuel && !state.player.tech.air_refuel) return log("Yakıt ikmali için önce Havada Yakıt İkmali Programı geliştirilmeli!","red");
    const REFUEL_COST = 50000;
    if(useRefuel && state.player.budget<REFUEL_COST) return log(`Yakıt ikmali için ek ${REFUEL_COST.toLocaleString()}$ gerekli.`,"red");

    let nearest = nearestOwnedCity(state.playerID, targetCity);
    if(!nearest) return log("Saldırıyı fırlatacak sahip olduğunuz bir şehir kalmadı!","red");
    let requiredRange = nearest.dist;

    let pick = { batch:null };
    if(type==='nuke'){
      if(!state.player.tech.icbm) return log("Nükleer başlığın bu mesafeye taşınabilmesi için ICBM teknolojisi gerekli!","red");
      if(state.player.inventory.nuke<1) return log("Envanterde nükleer başlık yok! Önce üretmelisiniz.","red");
      if(!useRefuel && requiredRange>cfg.range) return log(`MENZİL DIŞI: ${nearest.city.name} → ${targetCity.name} mesafesi ${Math.round(requiredRange)} km, bu silahın menzili ${Math.round(cfg.range)} km.`,"red");
    } else {
      // YENİ: menzile göre parti otomatik seçimi — envanterde birden fazla
      // menzil profili varsa (ör. 3x 12.000km + 1x 13.000km ICBM), sistem
      // hedefe yetecek EN EKONOMİK partiyi kendisi seçer, ayrı bir "hangi
      // füzeyi atacağım" ekranı yok.
      pick = pickBestBatch(invItem, useRefuel ? 0 : requiredRange, applyRangeMult, applyRangeMult ? null : cfg.range);
      if(pick.batch===null){
        if(pick.reason==='empty') return log(`Envanterde ${cfg.label.toUpperCase()} kalmadı! Üretim yapmalısınız.`,"red");
        return log(`MENZİL DIŞI: ${nearest.city.name} → ${targetCity.name} mesafesi ${Math.round(requiredRange)} km, envanterinizdeki en uzun menzilli model ${Math.round(pick.maxRange)} km.`,"red");
      }
    }

    // YENİ: Lojistik — mesafe arttıkça hasar düşer (uzak cephe cezası).
    let logMult = logisticsDamageMult(requiredRange);
    let effDmg = pick.batch ? Math.round(cfg.dmg*(pick.batch.dmgMult||1)*logMult) : Math.round(cfg.dmg*logMult);

    // YENİ: nükleer her zaman tek başlık, diğerlerinde envanterdeki adetle sınırlı.
    if(type==='nuke') qty = 1;
    else if(pick.batch) qty = Math.min(qty, pick.batch.qty);

    if(type==='nuke'){
      state.player.inventory.nuke--;
      applyInternationalReaction();
      state.player.stability = Math.max(0,state.player.stability-15);
      log("☢️ NÜKLEER FIRLATMA! Global tansiyon kritik seviyeye ulaştı, dünya kınama mesajları yağdırıyor. (Şehri yok etmez, sadece ağır hasar verir — ilhak için kara/çıkarma/hava indirme harekâtı gerekir)","#ff3344");
    }

    if(useRefuel){ state.player.budget-=REFUEL_COST; log(`⛽ Yakıt ikmali kullanıldı: ${nearest.city.name} → ${targetCity.name} (${Math.round(requiredRange)} km, menzil sınırı yok).`,"#facc15"); }

    let logNote = logMult<1 ? ` (🚚 Lojistik cezası: hasar x${logMult.toFixed(2)})` : "";

    if(type==='amphibious'){
      // YENİ: Çıkarma Harekâtı artık ANINDA değil — gemiler yola çıkar,
      // 3 tur sonra sahile ulaşıp asıl çarpışma o zaman gerçekleşir.
      // Emredildiği an başlar, bu süre içinde iptal edilemez. qty = gönderilen tümen sayısı (forceSize).
      state.player.pendingOps.push({type:'amphibious', targetCountryId:state.selectedID, targetCityIdx:parseInt(idx), turnsLeft:3, sourceBatch:pick.batch, dist:requiredRange, forceSize:qty});
      log(`🚢 ÇIKARMA HAREKÂTI BAŞLATILDI: ${qty} tümen ${targetCity.name}'e doğru yola çıktı. 3 tur sonra sahile ulaşacaklar (bu süreçte iptal edilemez, deniz riski var).${logNote}`,"#38bdf8");
      soundEngine.play('naval_landing');
    } else if(isGroundFamily){
      // kara_birligi / airborne — TEK harekât olarak gönderilir, qty = gönderilen kuvvet büyüklüğü (forceSize).
      // Envanter düşümü ÇARPIŞMA ANINDA (gameLoop/resolveGroundAssault) yapılır.
      log(`🚀 ${nearest.city.name}'den ${targetCity.name} hedefine ${qty} birimlik ${cfg.label.toUpperCase()} sevk edildi! (${Math.round(requiredRange)} km)${logNote}`,"#ff3344");
      animator.spawnAttack(nearest.city,targetCity,type,state.playerID,effDmg,pick.batch,requiredRange,qty);
      soundEngine.play(type==='airborne' ? 'jet_takeoff' : 'ground_attack');
    } else {
      // YENİ: menzilli mühimmat (drone/füze/uçak/nükleer) — seçilen adet kadar ayrı sevkiyat.
      let launched = 0;
      for(let i=0;i<qty;i++){
        if(type!=='nuke'){
          if(!pick.batch || pick.batch.qty<=0) break;
          pick.batch.qty--; state.player.inventory[type] = Math.max(0,state.player.inventory[type]-1);
        }
        animator.spawnAttack(nearest.city,targetCity,type,state.playerID,effDmg,pick.batch,requiredRange,1);
        launched++;
      }
      if(type!=='nuke') state.player.batches[type] = state.player.batches[type].filter(b=>b.qty>0);
      log(`🚀 ${nearest.city.name}'den ${targetCity.name} hedefine ${launched} adet ${cfg.label.toUpperCase()} sevk edildi! (${Math.round(requiredRange)} km)${logNote}`,"#ff3344");
      // YENİ: fırlatma sesi — türe göre ayrılıyor (uçak/drone/füze farklı seslenir)
      soundEngine.play(type==='gen5_jet' ? 'jet_takeoff' : (type==='drone_swarm' ? 'drone_attack' : 'missile_launch'));
    }
    ui.updateAll();
  },

  nextTurn(){
    if(state.gameOver) return;
    soundEngine.play('ui_click', 400);
    /* YENİ: Bir önceki turdan kalan kriz penceresi hâlâ açıksa (oyuncu
       "Kapat"a basmadan tekrar "TUR ATLA" dediyse), yeni tur başlarken
       otomatik kapanır — artık bayat bir kriz ekranı yeni turun üstünde
       asılı kalmıyor. */
    ui.closeCrisisPopup();
    state.turn++;
    const p = state.player;
    currentTurnBuffer = []; // YENİ: bu turun rapor tamponu, index kaymasından etkilenmez
    // YENİ: Bir önceki turda nükleer üretim tamamlandıysa, kriz + BM
    // yaptırım teklifi ŞİMDİ (bir sonraki tur) tetiklenir.
    checkNukeCrisis();

    // ---- Ekonomi (vergi oranı + serbest ticaret + ambargo + ideoloji/yasalar dahil) ----
    let income = 70000;
    for(let id in state.countries){
      let c = state.countries[id];
      if(c.embargo) income -= 4000;
      if(c.freeTrade && !c.eliminated) income += 5000;
    }
    income += Math.round(p.stability*300);
    let taxMult = 0.6 + (state.taxRate/100)*0.9; // %0 vergi ~0.6x, %100 vergi ~1.5x gelir
    income = Math.round(income*taxMult);
    if(p.publicSupport<30) income = Math.round(income*0.85);
    if(state.sanctionRemaining>0) income = Math.round(income*0.7);
    // YENİ: Yönetim biçimi ve yasaların ekonomiye etkisi
    income = Math.round(income * IDEOLOGY_CONFIG[p.ideology].incomeMult);
    if(p.laws.draft) income = Math.round(income*0.9);
    if(p.laws.openborders) income = Math.round(income*1.1);
    let upkeep = Math.round((Object.values(p.inventory).reduce((a,b)=>a+b,0)*80 + p.productionQueue.length*500) * tierUpkeepMult());
    p.budget = Math.max(0, p.budget + income - upkeep);

    p.manpower += (p.publicSupport<30? 8000 : 15000);
    // YENİ: Hammadde üretimi + fabrika etkileri (gelir bonusu, bedava asker)
    p.resources += (STARTING_STATS[state.playerID] ? STARTING_STATS[state.playerID].resources : 5);
    let factoryIncome=0, freeTroopsFromBases=0;
    getPlayerCities().forEach(city=>{
      if(!city.factories) return;
      factoryIncome += (city.factories.heavy_industry||0)*FACTORY_CONFIG.heavy_industry.incomeBonus;
      factoryIncome += (city.factories.trade_center||0)*FACTORY_CONFIG.trade_center.incomeBonus;
      freeTroopsFromBases += (city.factories.military_base||0)*FACTORY_CONFIG.military_base.freeTroops;
    });
    if(factoryIncome>0) p.budget += factoryIncome;
    if(freeTroopsFromBases>0){
      p.inventory.kara_birligi = (p.inventory.kara_birligi||0)+freeTroopsFromBases;
      if(p.batches.kara_birligi){
        let base = p.batches.kara_birligi.find(b=>b.rangeMult===1 && b.dmgMult===1);
        if(base) base.qty+=freeTroopsFromBases; else p.batches.kara_birligi.push({qty:freeTroopsFromBases,rangeMult:1,dmgMult:1});
      }
    }

    // YENİ: GSYH BÜYÜMESİ — Hazine'den (p.budget) tamamen bağımsız çalışır.
    // GSYH, vergi/harcama ile DOĞRUDAN düşürülmez; sadece kendi büyüme
    // formülüyle her tur güncellenir. Büyüme = Tier'in temel oranı +
    // fabrikaların katkısı (endüstriyel kapasite) + istikrarın etkisi
    // (düşük istikrar büyümeyi frenler/negatife çevirebilir) - yaptırım
    // cezası (varsa).
    let totalFactories = getPlayerCities().reduce((a,c)=>a+(c.factories?Object.values(c.factories).reduce((x,y)=>x+y,0):0),0);
    let gdpTierGrowth = TIER_GROWTH_RATE[countryTier(state.playerID)] - 1; // örn. Tier1: 0.035
    let gdpStabilityFactor = (p.stability/100 - 0.5) * 0.03; // %100 istikrar: +0.015, %0 istikrar: -0.015
    let gdpFactoryFactor = totalFactories * 0.0012;
    let gdpSanctionPenalty = state.sanctionRemaining>0 ? 0.01 : 0;
    let gdpGrowthRate = gdpTierGrowth + gdpStabilityFactor + gdpFactoryFactor - gdpSanctionPenalty;
    p.gdp = Math.max(1000, Math.round(p.gdp * (1 + gdpGrowthRate)));

    // YENİ: İstatistik geçmişi (İstatistikler paneli çizgi grafiği için)
    p.history.turn.push(state.turn); p.history.budget.push(p.budget); p.history.gdp.push(p.gdp);
    p.history.support.push(Math.round(p.publicSupport)); p.history.stability.push(p.stability);
    p.history.tech.push(Object.values(p.tech).filter(Boolean).length);
    const MAX_HISTORY = 100;
    if(p.history.turn.length>MAX_HISTORY) for(let k in p.history) p.history[k]=p.history[k].slice(-MAX_HISTORY);

    // Zorunlu Askerlik yasası her tur bedava piyade tümeni verir
    if(p.laws.draft){
      p.inventory.kara_birligi = (p.inventory.kara_birligi||0)+3;
      if(p.batches.kara_birligi){
        let base = p.batches.kara_birligi.find(b=>b.rangeMult===1 && b.dmgMult===1);
        if(base) base.qty+=3; else p.batches.kara_birligi.push({qty:3,rangeMult:1,dmgMult:1});
      }
    }

    // Üretim kuyruğu
    for(let i=p.productionQueue.length-1;i>=0;i--){
      let q=p.productionQueue[i]; q.turnsLeft--;
      if(q.turnsLeft<=0){
        p.inventory[q.item]=(p.inventory[q.item]||0)+1;
        // YENİ: parti (batch) sistemi — aynı profildeki partiler birleşir,
        // farklı menzil/hasar profiline sahip olanlar ayrı takip edilir.
        if(p.batches[q.item]){
          let profile = q.custom || {rangeMult:1, dmgMult:1};
          let existing = p.batches[q.item].find(b=>b.rangeMult===profile.rangeMult && b.dmgMult===profile.dmgMult);
          if(existing) existing.qty++; else p.batches[q.item].push({qty:1, rangeMult:profile.rangeMult, dmgMult:profile.dmgMult});
        }
        log(`✅ Üretim tamamlandı: ${WEAPON_CONFIG[q.item].label.toUpperCase()} envantere eklendi!`,"#00ff66");
        // YENİ: Nükleer üretimi bir sonraki tur bir kriz + BM yaptırım
        // teklifi tetikler (bkz. checkNukeCrisis, nextTurn başında çağrılır).
        if(q.item==='nuke') state.player.pendingNukeCrisis = true;
        p.productionQueue.splice(i,1);
      }
    }

    // YENİ: Ar-Ge kuyruğu
    for(let i=p.researchQueue.length-1;i>=0;i--){
      let q=p.researchQueue[i]; q.turnsLeft--;
      if(q.turnsLeft<=0){
        applyResearchEffect(q.item);
        p.researchQueue.splice(i,1);
      }
    }

    // YENİ: Devam eden çıkarma harekâtları (3 tur sevkiyat + yolda deniz riski)
    for(let i=p.pendingOps.length-1;i>=0;i--){
      let op=p.pendingOps[i]; op.turnsLeft--;
      if(op.turnsLeft>0){
        // Basitleştirilmiş deniz riski: hedef AI ekonomisi tam simüle
        // edilmediğinden (fırkateyn sayısı takip edilmiyor), genel bir
        // "yolda saldırıya uğrama" ihtimali uygulanıyor.
        if(Math.random()<0.08){
          let lost = Math.min(op.sourceBatch?op.sourceBatch.qty:0, 1) || 1;
          if(op.sourceBatch) op.sourceBatch.qty = Math.max(0, op.sourceBatch.qty-lost);
          p.inventory.kara_birligi = Math.max(0, p.inventory.kara_birligi-lost);
          log(`🌊 DENİZ RİSKİ: Çıkarma konvoyu yolda saldırıya uğradı, ${lost} tümen kaybedildi.`,"#f59e0b");
        }
      } else {
        let tgtCountry = state.countries[op.targetCountryId];
        let tgtCity = tgtCountry.cities[op.targetCityIdx];
        log(`🚢 Çıkarma filosu ${tgtCity.name} kıyılarına ulaştı, harekât başlıyor!`,"#38bdf8");
        createExplosion(project(tgtCity.lat,tgtCity.lon).x, project(tgtCity.lat,tgtCity.lon).y, 'amphibious');
        resolveGroundAssault(tgtCity, state.playerID, WEAPON_CONFIG.amphibious, op.sourceBatch, op.dist, op.forceSize);
        p.batches.kara_birligi = (p.batches.kara_birligi||[]).filter(b=>b.qty>0);
        p.pendingOps.splice(i,1);
      }
    }

    // HSS rejenerasyonu (3 katman), radar jam / abluka süresi, çökme kontrolü,
    // tier'a göre AI savunma büyümesi (Aşama 2) ve rejim değişikliği riski
    for(let id in state.countries){
      let c = state.countries[id];
      c.cities.forEach(city=>{
        // YENİ: DENGE DÜZELTMESİ — yakın zamanda (bu veya bir önceki tur)
        // gerçekten vurulmuş bir şehir bu tur HİÇ toparlanmaz. Eskiden her
        // şehir savaş altında olsa bile sabit iyileşiyordu; hava savunması
        // artık çok daha güçlü olduğu için (bkz. INTERCEPT_BASE_CHANCE) bu,
        // "her ne atarsam atayım direniş hiç düşmüyor" hissine yol açıyordu.
        // Artık sürekli baskı gerçekten işe yarıyor.
        let recentlyHit = city.lastHitTurn!==undefined && (state.turn - city.lastHitTurn)<=1;
        if(!recentlyHit){
          ['short','medium','long'].forEach(l=>{
            if(city.hss[l].current<city.hss[l].cap) city.hss[l].current = Math.min(city.hss[l].cap, city.hss[l].current + Math.ceil(city.hss[l].cap*0.08));
          });
          // YENİ: HP ve Direniş zamanla yavaşça toparlanır (eskiden +3/+4
          // idi, dengeyi düzeltmek için düşürüldü) — bombaladıktan sonra
          // beklersen hedef yeniden güçlenir, ilhak için hız önemli.
          city.hp = Math.min(100, city.hp + 1);
          city.resistance = Math.min(100, city.resistance + 2);
        }
      });
      if(c.radarJammed>0) c.radarJammed--;
      if(c.blockaded>0){ c.blockaded--; c.stability = Math.max(10, c.stability-3); }

      if(id!==state.playerID && !c.eliminated){
        if(c.relation>0 && c.stability<90) c.stability = Math.min(90,c.stability+2);
        c.warTurns = c.relation<=0 ? c.warTurns+1 : 0;
        if(getOwnedCities(id).length===0){
          c.eliminated=true; c.relation=100;
          log(`💀 ${c.name} tamamen çökmüş durumda, savaş dışı kaldı.`,"#888");
          // YENİ: Bir ülkeyi TAMAMEN ele geçirerek (barışla değil, fetihle)
          // kazanılan savaş zaferi — 1 tur "Yelkenler Biçilecek" çalar,
          // sonra otomatik dünya haritası müziğine döner (bkz.
          // musicEngine._onTrackEnded). Genel oyun zaferinden (%60 dünya
          // kontrolü, ui.gameOver içinde) AYRI bir müzik anıdır.
          musicEngine.onWarVictory();
        }

        if(!c.isBloc){
          // Aşama 2: tier'a göre otomatik savunma büyümesi (basitleştirilmiş
          // "ülkeler pasif kalmayacak" modeli — tam bir AI ekonomisi simüle
          // edilmiyor, ama şehir savunmaları zamanla güçleniyor)
          let tier = STARTING_STATS[id] ? STARTING_STATS[id].tier : 3;
          let rate = 1 + ((TIER_GROWTH_RATE[tier]||1.01)-1) * DIFFICULTY_CONFIG[state.difficulty||"normal"].aiGrowthMult;
          if(Math.random()<0.25){
            c.cities.forEach(city=>{ ['short','medium','long'].forEach(l=>{ city.hss[l].cap = Math.min(120, Math.round(city.hss[l].cap*rate)); }); });
          }
          // Rejim değişikliği / darbe riski
          if(c.stability<20 && Math.random()<0.15){
            let oldRel = c.relation;
            c.stability = 45 + Math.round(Math.random()*15);
            c.relation = Math.max(0, Math.min(100, c.relation + (Math.random()<0.5? 20:-20)));
            c.warTurns = 0;
            log(`🪧 REJİM DEĞİŞİKLİĞİ: ${c.name}'de istikrarsızlık yeni bir hükümeti iş başına getirdi! (İlişkiler ${c.relation>oldRel?"iyileşti":"kötüleşti"})`,"#a855f7");
          }
        }
      }
    }

    // Halk desteği (savaş yorgunluğu + vergi baskısı)
    let warsActive = Object.keys(state.countries).filter(id=>id!==state.playerID && !state.countries[id].eliminated && state.countries[id].relation<=0).length;
    if(warsActive>0) p.publicSupport = Math.max(0, p.publicSupport - 2*warsActive);
    else p.publicSupport = Math.min(100, p.publicSupport + 3);
    let taxDelta = (state.taxRate-30)*0.06; // yüksek vergi desteği düşürür, düşük vergi biraz artırır
    p.publicSupport = Math.max(0, Math.min(100, p.publicSupport - taxDelta));

    // Müttefik / Kolektif Savunma Paktı desteği
    if(warsActive>0){
      for(let id in state.countries){
        let ally = state.countries[id];
        if(ally.eliminated || id===state.playerID) continue;
        if(ally.defensePact && Math.random()<0.35){
          p.budget += 35000;
          log(`🛡️ KOLEKTİF SAVUNMA PAKTI: ${ally.name} paktımız gereği acil destek gönderdi (+35.000$).`,"#0d4d3a");
        } else if(ally.alliedWithPlayer && !ally.defensePact && Math.random()<0.2){
          p.budget += 20000;
          log(`🤝 Müttefik desteği: ${ally.name} savaş çabalarınıza 20.000$ katkı sağladı.`,"#3fb87f");
        }
      }
    }

    // Uluslararası yaptırım süresi
    if(state.sanctionRemaining>0){
      state.sanctionRemaining--;
      if(state.sanctionRemaining===0) log("🚫 BM yaptırımları sona erdi, ekonomi normale dönüyor.","#00ff66");
    }

    // AI saldırı misillemesi — bloklar savaş başlatamadığı için hariç tutuluyor
    for(let id in state.countries){
      let enemy=state.countries[id];
      if(id===state.playerID || enemy.eliminated || enemy.isBloc) continue;
      /* ================= YENİ: AI ENVANTER BÜYÜMESİ =================
         Oyuncununkiyle AYNI mantık: her tur küçük bir üretim/stok artışı.
         Savaşta olsun ya da olmasın büyür — böylece bir savaş
         başladığında elinde zaten gerçek bir stok birikmiş olur, "1
         füze atıp geçiştirme" değil sağlam bir karşılık verebilir. */
      if(enemy.inventory){
        let growthRate = 0.025 + (countryTier(id)<=2 ? 0.015 : 0); // güçlü Tier daha hızlı üretir
        for(let k in enemy.inventory){
          enemy.inventory[k] = Math.round(enemy.inventory[k]*(1+growthRate)) + (enemy.inventory[k]===0 ? 1 : 0);
        }
      }
      if(enemy.relation<=0){
        let playerCities = getPlayerCities();
        let enemyCities = getAllCitiesOwnedBy(id);
        if(playerCities.length===0 || enemyCities.length===0) continue;
        /* ================= YENİ: DAHA SERT DÜŞMAN MİSİLLEMESİ =================
           Turda SADECE 1 rastgele saldırı yapıp geçiştirmiyor. Savaş
           uzadıkça (warTurns) ve ülke güçlüyken (Tier) aynı tur içinde
           2-4 ayrı saldırı dalgası gönderebilir; her dalga GERÇEK
           envanterinden (yukarıdaki enemy.inventory) belirli bir miktar
           (stoğun %15-35'i) kullanır ve o kadarını düşer — anlatısal
           değil, gerçekten sayılan bir stok. NOT: Bu sadece OYUNCUYA karşı
           misillemeyi güçlendiriyor; oyun AI-AI savaşını simüle etmiyor
           (relation alanı sadece oyuncuya göre tutuluyor), o yüzden
           ülkelerin birbirine saldırma sıklığı bundan etkilenmiyor. */
        enemy.warTurns = (enemy.warTurns||0)+1;
        // YENİ: taban saldırı sayısı 5'e çıkarıldı (eskiden 1-4'tü, "tek
        // füze atıp geçiştirme" hissi hâlâ vardı) — artık savaştaki her
        // ülke turda EN AZ 5, savaş uzadıkça/güçlüyse 10'a kadar saldırı
        // dalgası gönderiyor.
        let aggressionBonus = Math.min(5, Math.floor(enemy.warTurns/2)) + (countryTier(id)<=2 ? 2 : 0);
        let numAttacks = 5 + Math.floor(Math.random()*(1+aggressionBonus));
        numAttacks = Math.min(numAttacks, 10, playerCities.length+8);
        let firedAny = false, usedHeavy=false;
        for(let a=0; a<numAttacks; a++){
          let targetCity = playerCities[Math.floor(Math.random()*playerCities.length)];
          let source = nearestOwnedCity(id, targetCity);
          if(!source) continue;
          // YENİ: 'amphibious' menzili 20.000km olduğundan her zaman havuzda,
          // ama artık SADECE envanterinde o silahtan varsa seçilebiliyor.
          let candidateTypes = ['ballistic_medium','kara_birligi','amphibious','drone_swarm','gen5_jet','ballistic_icbm']
            .filter(t => WEAPON_CONFIG[t] && source.dist <= WEAPON_CONFIG[t].range && (enemy.inventory[t]||0) > 0);
          if(enemy.armsEmbargo) candidateTypes = candidateTypes.filter(t=>!['ballistic_medium','ballistic_icbm','gen5_jet'].includes(t)); // silah ambargosu gelişmiş mühimmatı kesti
          if(candidateTypes.length===0) continue;
          let attackType = candidateTypes[Math.floor(Math.random()*candidateTypes.length)];
          let available = enemy.inventory[attackType];
          // YENİ: tur başına artık 5-10 saldırı olduğu için, tek saldırının
          // stok tüketim yüzdesi düşürüldü (eskiden %15-35'ti — 10 saldırıyla
          // çarpılınca stok anında sıfırlanırdı). Artık %4-10 civarı.
          let useQty = Math.max(1, Math.round(available * (0.04 + Math.random()*0.06)));
          useQty = Math.min(useQty, available);
          enemy.inventory[attackType] -= useQty;
          if(useQty>=3) usedHeavy = true;
          log(`🚨 DÜŞMAN TAARRUZU (${a+1}/${numAttacks}): ${enemy.name}, ${targetCity.name} şehrimize ${useQty} adet ${WEAPON_CONFIG[attackType].label.toUpperCase()} gönderdi! (kalan stok: ${enemy.inventory[attackType]})`,"red");
          animator.spawnAttack(source.city,targetCity,attackType,id,undefined,null,source.dist,useQty);
          firedAny = true;
        }
        if(firedAny && (numAttacks>=3 || usedHeavy)){
          log(`⚠️ ${enemy.name} bu tur envanterinin büyük kısmını kullanarak yoğun bir saldırı dalgası başlattı!`,"#ff3344");
        }
      }
      if(enemy.relation<=0 && enemy.stability<40 && Math.random()<0.3){
        enemy.relation=30;
        log(`🕊️ BARIŞ TEKLİFİ: ${enemy.name} ağır kayıplar sonrası savaşı sonlandırmak istiyor! İlişkiler düzeldi.`,"#38bdf8");
      }
      // YENİ: AI artık size de savaş açabilir — ama önce bir "tehdit"
      // (uyarı) aşaması var, doğrudan sürpriz saldırı yapılmıyor. Doktrine
      // göre eşik/olasılık farklı (saldırgan çok daha hazırlıksız savaşa
      // girer, izolasyonist neredeyse hiç girmez).
      if(!enemy.isBloc && enemy.relation>0 && !enemy.eliminated){
        let doc = DOCTRINES[enemy.doctrine];
        // YENİ: oyunun ilk 4 turunda hiçbir AI ülke savaş hazırlığına
        // başlamaz — oyuncu daha ekonomisini kurmadan ani savaşla
        // karşılaşmasın diye.
        if(state.turn>4 && !enemy.warBuildup && enemy.relation < doc.warThreshold && Math.random() < doc.warChance*DIFFICULTY_CONFIG[state.difficulty||"normal"].aiWarChanceMult){
          enemy.warBuildup = 3;
          log(`⚠️ TEHDİT İSTİHBARATI: ${enemy.name} (${doc.label} doktrini) sınır bölgelerinde asker yığıyor!`,"#f59e0b");
        } else if(enemy.warBuildup>0){
          enemy.warBuildup--;
          if(enemy.warBuildup<=0){
            enemy.relation = 0; enemy.warTurns = 0;
            log(`⚔️ SAVAŞ İLANI: ${enemy.name} size savaş açtı!`,"#ff3344");
            soundEngine.play('war_declare');
          }
        }
      }
    }

    // İç isyan riski — Sıkıyönetim riski artırır, Açık Sınırlar azaltır
    let revoltChance = 0.2 + (p.laws.martial?0.08:0) - (p.laws.openborders?0.05:0);
    if(p.stability<25 && Math.random()<Math.max(0.02,revoltChance)){
      let cities = getPlayerCities();
      if(cities.length>0){
        let c = cities[Math.floor(Math.random()*cities.length)];
        c.hp = Math.max(10, c.hp-20);
        log(`🔥 İÇ İSYAN: Düşük istikrar nedeniyle ${c.name}'de ayaklanmalar çıktı! (HP -20)`,"#f59e0b");
      }
    }

    // Mülteci / insani kriz (uzayan savaşların yan etkisi)
    if(warsActive>0 && Math.random()<0.12){
      state.refugeeLevel = Math.min(100,(state.refugeeLevel||0)+15);
      p.stability = Math.max(0,p.stability-4);
      log("🏕️ MÜLTECİ KRİZİ: Uzayan savaş(lar) sınır bölgelerinde mülteci akınına yol açtı. (İstikrar -4)","#f59e0b");
    } else if((state.refugeeLevel||0)>0){
      state.refugeeLevel = Math.max(0, state.refugeeLevel-5);
    }

    // BM nükleer denetim rejimi ihlali
    if(p.inventory.nuke > state.unNukeCap && state.sanctionRemaining<=0){
      state.sanctionRemaining = 6;
      log(`☢️ BM NÜKLEER DENETİM İHLALİ: Nükleer başlık sayınız (${p.inventory.nuke}) BM sınırını (${state.unNukeCap}) aştı! 6 tur yaptırım başladı.`,"#ef4444");
    }

    // YENİ: Hükümet Krizi — ani çöküş yerine önceden gerilim biriktiren
    // aşamalı bir uyarı. Halk desteği kritik seviyede kaldığı sürece sayaç
    // artar; toparlanırsan sıfırlanır. Sayaç 4'e ulaşınca hükümet gerçekten
    // düşer.
    if(p.publicSupport<15){
      state.govCrisisTurns = (state.govCrisisTurns||0)+1;
      if(state.govCrisisTurns===1) log("⚠️ HÜKÜMET KRİZİ: Halk desteği kritik seviyede! Meclis güvenoyu istiyor — birkaç tur içinde toparlanmazsanız hükümet düşecek.","#ff3344");
    } else {
      if((state.govCrisisTurns||0)>0) log("✅ Hükümet krizi atlatıldı, halk desteği toparlandı.","#3fb87f");
      state.govCrisisTurns = 0;
    }

    advancedSystem.checkEvents();
    // YENİ: Savaş müziği durumu — bu tur içinde biten/başlayan savaşları
    // (barış, elimine olma, AI'nin savaş açması) yakalayan genel
    // güvenlik ağı. Aktif savaş yoksa ve savaş müziği çalıyorsa dünya
    // haritası müziğine döner; aktif savaş varsa ve çalmıyorsa başlatır.
    musicEngine.syncWarState();

    // Kazanma / kaybetme koşulları
    let ownedByPlayer = getPlayerCities().length;
    let totalCities=0; for(let id in state.countries) totalCities += state.countries[id].cities.length;
    if(ownedByPlayer===0){ ui.gameOver("🏳️ YENİLGİ","Tüm şehirleriniz düştü. Ülkeniz savunmasını kaybetti."); return; }
    if(p.stability<=0){ ui.gameOver("💥 İÇ ÇÖKÜŞ","İstikrar sıfıra düştü, ülke iç kargaşaya sürüklendi."); return; }
    if(state.govCrisisTurns>=4){ ui.gameOver("🪧 HÜKÜMET DÜŞTÜ","Halk desteği uzun süre kritik seviyede kaldı, hükümet istifaya zorlandı."); return; }
    if(ownedByPlayer >= totalCities*0.6){ ui.gameOver("🏆 ZAFER","Dünya haritasının %60'ından fazlasını kontrol ediyorsunuz. Kara Kartal Doktrini zaferle sonuçlandı!"); return; }

    ui.updateAll();
    // YENİ: Tur Sonu Raporu — bu turda üretilen tüm log satırlarını
    // ayrı bir modalda özetler.
    ui.showTurnReport(currentTurnBuffer, state.turn);
  }
};

function applyInternationalReaction(){
  state.globalTension = 100;
  for(let id in state.countries){
    let c = state.countries[id];
    if(id===state.playerID || c.alliedWithPlayer || c.eliminated) continue;
    c.relation = Math.max(0, c.relation - 15);
  }
  log("🌍 KÜRESEL KINAMA: Uluslararası toplum nükleer kullanımı sert bir dille kınadı.","#facc15");
  if(state.sanctionRemaining<=0){
    state.sanctionRemaining = 6;
    log("🚫 BM YAPTIRIMI: Ekonominiz 6 tur boyunca uluslararası yaptırımlarla zayıflayacak.","#ef4444");
  }
}

/* ================= YENİ: SES EFEKTİ SİSTEMİ (soundEngine) =================
   Harici ses dosyası GEREKTİRMEZ — Web Audio API osilatör/gürültü
   üreteçleriyle tüm efektler anlık üretilir (oyunun boyutunu artırmaz).
   Merkezi: her olay bir isimle çağrılır (soundEngine.play('explosion')),
   üretim mantığı SFX_GENERATORS'ta tek yerde. Cooldown ile aynı ses çok
   kısa sürede spam olmaz. Ayarlar'dan seviyesi ayrı kontrol edilir ve
   tamamen kapatılabilir — kapalıyken/tarayıcı Web Audio'yu
   desteklemiyorken sessizce hiçbir şey yapmaz, oyunu ETKİLEMEZ. */
function _playTone(ctx, dest, {freq=440, duration=0.15, type='sine', volume=0.3, freqEnd=null, delay=0}={}){
  let osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime+delay);
  if(freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd,1), ctx.currentTime+delay+duration);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime+delay);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume,0.0001), ctx.currentTime+delay+0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+delay+duration);
  osc.connect(gain); gain.connect(dest);
  osc.start(ctx.currentTime+delay); osc.stop(ctx.currentTime+delay+duration+0.05);
}
function _playNoise(ctx, dest, {duration=0.3, volume=0.4, filterFreq=1000, delay=0}={}){
  let bufferSize = Math.max(1,Math.floor(ctx.sampleRate*duration));
  let buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  let data = buffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
  let src = ctx.createBufferSource(); src.buffer = buffer;
  let filter = ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=filterFreq;
  let gain = ctx.createGain(); gain.gain.value = volume;
  src.connect(filter); filter.connect(gain); gain.connect(dest);
  src.start(ctx.currentTime+delay);
}
const SFX_GENERATORS = {
  missile_launch:(ctx,d)=>{ _playTone(ctx,d,{freq:170,freqEnd:650,duration:.35,type:'sawtooth',volume:.22}); _playNoise(ctx,d,{duration:.4,volume:.14,filterFreq:2000}); },
  ballistic_flight:(ctx,d)=>{ _playTone(ctx,d,{freq:320,freqEnd:150,duration:.5,type:'sine',volume:.1}); },
  air_defense_fire:(ctx,d)=>{ _playTone(ctx,d,{freq:700,freqEnd:950,duration:.12,type:'square',volume:.18}); },
  intercept:(ctx,d)=>{ _playTone(ctx,d,{freq:1000,duration:.08,type:'square',volume:.22}); _playTone(ctx,d,{freq:1300,duration:.1,type:'square',volume:.2,delay:.09}); },
  explosion:(ctx,d)=>{ _playNoise(ctx,d,{duration:.55,volume:.45,filterFreq:400}); _playTone(ctx,d,{freq:85,freqEnd:28,duration:.5,type:'sine',volume:.28}); },
  explosion_nuke:(ctx,d)=>{ _playNoise(ctx,d,{duration:1.4,volume:.6,filterFreq:250}); _playTone(ctx,d,{freq:50,freqEnd:18,duration:1.2,type:'sine',volume:.4}); },
  jet_takeoff:(ctx,d)=>{ _playTone(ctx,d,{freq:200,freqEnd:520,duration:.6,type:'sawtooth',volume:.13}); },
  jet_attack:(ctx,d)=>{ _playTone(ctx,d,{freq:520,freqEnd:200,duration:.3,type:'sawtooth',volume:.18}); _playNoise(ctx,d,{duration:.3,volume:.18,filterFreq:1500}); },
  drone_attack:(ctx,d)=>{ _playTone(ctx,d,{freq:220,duration:.3,type:'square',volume:.09}); _playTone(ctx,d,{freq:260,duration:.25,type:'square',volume:.07,delay:.08}); },
  ground_attack:(ctx,d)=>{ _playNoise(ctx,d,{duration:.35,volume:.22,filterFreq:600}); },
  naval_landing:(ctx,d)=>{ _playTone(ctx,d,{freq:100,freqEnd:55,duration:.5,type:'sine',volume:.18}); _playNoise(ctx,d,{duration:.4,volume:.14,filterFreq:300}); },
  cyber_attack:(ctx,d)=>{ for(let i=0;i<4;i++) _playTone(ctx,d,{freq:300+Math.random()*800,duration:.05,type:'square',volume:.13,delay:i*.06}); },
  war_declare:(ctx,d)=>{ _playTone(ctx,d,{freq:150,freqEnd:95,duration:.8,type:'sawtooth',volume:.28}); },
  diplomacy_success:(ctx,d)=>{ _playTone(ctx,d,{freq:523,duration:.15,type:'sine',volume:.18}); _playTone(ctx,d,{freq:659,duration:.2,type:'sine',volume:.18,delay:.12}); },
  crisis_alarm:(ctx,d)=>{ _playTone(ctx,d,{freq:800,freqEnd:400,duration:.4,type:'square',volume:.22}); },
  victory:(ctx,d)=>{ [523,659,784,1046].forEach((f,i)=>_playTone(ctx,d,{freq:f,duration:.3,type:'sine',volume:.22,delay:i*.15})); },
  defeat:(ctx,d)=>{ [400,350,300,200].forEach((f,i)=>_playTone(ctx,d,{freq:f,duration:.4,type:'sine',volume:.18,delay:i*.2})); },
  ui_click:(ctx,d)=>{ _playTone(ctx,d,{freq:600,duration:.05,type:'sine',volume:.08}); }
};
const soundEngine = {
  ctx:null, sfxGain:null, _cooldowns:{},
  _ensureCtx(){
    if(this.ctx) return this.ctx;
    try{
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.isSfxMuted()?0:(this.getSfxVolume()/100);
      this.sfxGain.connect(this.ctx.destination);
    }catch(e){ this.ctx=null; }
    return this.ctx;
  },
  isSfxMuted(){ return localStorage.getItem('tayfun_sfx_muted')==='1'; },
  setSfxMuted(muted){
    localStorage.setItem('tayfun_sfx_muted', muted?'1':'0');
    if(this.sfxGain) this.sfxGain.gain.value = muted?0:(this.getSfxVolume()/100);
  },
  getSfxVolume(){ let v=localStorage.getItem('tayfun_sfx_volume'); return v!==null?parseInt(v):80; },
  setSfxVolume(v){
    localStorage.setItem('tayfun_sfx_volume', v);
    if(this.sfxGain) this.sfxGain.gain.value = this.isSfxMuted()?0:(v/100);
    let label=document.getElementById('sfx-vol-label'); if(label) label.textContent='%'+v;
  },
  play(name, cooldownMs=180){
    try{
      if(this.isSfxMuted()) return;
      let ctx = this._ensureCtx();
      if(!ctx) return;
      if(ctx.state==='suspended') ctx.resume().catch(()=>{});
      let now = Date.now();
      if(this._cooldowns[name] && now-this._cooldowns[name]<cooldownMs) return; // YENİ: ses spam engelleme
      this._cooldowns[name] = now;
      let gen = SFX_GENERATORS[name];
      if(gen) gen(ctx, this.sfxGain);
    }catch(e){ /* ses üretimi başarısız olursa oyun ASLA etkilenmesin */ }
  }
};

/* ================= YENİ: MÜZİK SİSTEMİ (musicEngine) =================
   Oyun durumuna göre otomatik değişen, fade-in/fade-out'lu, aynı parçayı
   gereksiz yere baştan başlatmayan bir durum makinesi. Dosyalar
   /assets/music/ altında — SONRADAN TEK DOSYA DEĞİŞTİREREK kolayca
   güncellenebilir (bu obje dışında hiçbir yerde dosya adı sabit değil). */
const MUSIC_TRACKS = {
  menu:          {file:"assets/music/menu.mp3",          loop:true},
  worldmap:      {file:"assets/music/worldmap.mp3",       loop:true},
  crisis:        {file:"assets/music/crisis.mp3",         loop:true},
  war_start:     {file:"assets/music/war_start.mp3",      loop:false},
  war_ongoing_1: {file:"assets/music/war_ongoing_1.mp3",  loop:false}, // Ceddin Deden
  war_ongoing_2: {file:"assets/music/war_ongoing_2.mp3",  loop:false}, // Ey Şanlı Ordu
  victory:       {file:"assets/music/victory.mp3",        loop:false},
  defeat:        {file:"assets/music/defeat.mp3",         loop:false}
};
const musicEngine = {
  currentAudio:null, currentState:null, _preCrisisState:null,

  getMusicVolume(){ let v=localStorage.getItem('tayfun_music_volume'); return v!==null?parseInt(v):70; },
  setMusicVolume(v){
    localStorage.setItem('tayfun_music_volume', v);
    if(this.currentAudio) this.currentAudio.volume = this.isMusicMuted()?0:(v/100);
    let label=document.getElementById('music-vol-label'); if(label) label.textContent='%'+v;
  },
  isMusicMuted(){ return localStorage.getItem('tayfun_music_muted')==='1'; },
  setMusicMuted(muted){
    localStorage.setItem('tayfun_music_muted', muted?'1':'0');
    if(this.currentAudio) this.currentAudio.volume = muted?0:(this.getMusicVolume()/100);
  },

  /* which: MUSIC_TRACKS anahtarı. force:true -> aynı state olsa bile
     yeniden başlat (nadiren gerekir, örn. bir sonraki savaş şarkısına
     manuel geçiş). Normalde aynı state'e ikinci play() çağrısı HİÇBİR
     ŞEY yapmaz — "aynı müzik gereksiz yere sürekli baştan başlamasın"
     kuralı buradan geliyor. */
  lastError:null, // YENİ: son müzik hatası — Ses Ayarları panelinde görünür
  play(which, force){
    if(!MUSIC_TRACKS[which]) return;
    if(which===this.currentState && !force) return;
    this.currentState = which;
    this._swap(MUSIC_TRACKS[which], which);
  },
  _swap(track, stateKey){
    let old = this.currentAudio;
    let a;
    let absoluteUrl;
    try{
      a = new Audio(track.file);
      absoluteUrl = new URL(track.file, document.baseURI).href;
    }catch(e){
      this._reportError(`"${track.file}" için Audio nesnesi oluşturulamadı: ${e.message}`);
      return;
    }
    a.loop = !!track.loop;
    a.volume = 0;
    /* ================= YENİ: GERÇEK HATA YAKALAMA =================
       Eskiden sadece play().catch() vardı — bu autoplay engeli İLE
       gerçek 404/ağ hatasını AYIRT EDEMİYORDU, ikisi de sessizce yutuluyordu.
       Artık 'error' event'i (MediaError kodlarıyla — 404/CORS/format
       vb. NET olarak) ayrıca dinleniyor ve konsola + Ses Ayarları
       panelindeki durum satırına yazılıyor. Oyunun kendisi YİNE
       etkilenmez (try/catch + sessiz devam), ama artık NEDEN
       çalmadığını görebiliyoruz. */
    a.addEventListener('error', ()=>{
      let code = a.error ? a.error.code : '?';
      const CODE_MSG = {1:"işlem iptal edildi",2:"AĞ HATASI (dosya indirilemedi — yol yanlış veya sunucu erişilemez olabilir)",3:"DOSYA BOZUK/DECODE HATASI",4:"FORMAT DESTEKLENMİYOR veya DOSYA BULUNAMADI (404)"};
      this._reportError(`"${stateKey}" müziği yüklenemedi (${absoluteUrl}) — MediaError kod ${code}: ${CODE_MSG[code]||'bilinmeyen hata'}`);
    });
    let playPromise = a.play();
    if(playPromise && playPromise.catch){
      playPromise.catch(err=>{
        // YENİ: play() reddi genelde tarayıcının otomatik oynatmayı
        // engellemesinden gelir (NotAllowedError) — dosya sorunu 'error'
        // event'inde YUKARIDA ayrıca yakalanıyor. İkisini birbirinden
        // ayırmak için hata adını da logluyoruz.
        this._reportError(`"${stateKey}" müziği play() ile başlatılamadı (${absoluteUrl}) — ${err.name}: ${err.message}${err.name==='NotAllowedError' ? ' (tarayıcı otomatik oynatmayı engelledi — bir sonraki tıklamada genelde kendiliğinden düzelir)' : ''}`);
      });
    }
    this.currentAudio = a;
    let targetVol = this.isMusicMuted()?0:(this.getMusicVolume()/100);
    this._fade(a, 0, targetVol, 1100);
    if(old){ this._fade(old, old.volume, 0, 700, ()=>{ try{old.pause();}catch(e){} }); }
    if(!track.loop) a.onended = ()=>{ this._onTrackEnded(stateKey); };
  },
  _reportError(msg){
    this.lastError = msg;
    console.error("[TAYFUN müzik]", msg);
    let el = document.getElementById('music-error-status');
    if(el){ el.textContent = "⚠️ "+msg; el.style.display="block"; }
  },
  _fade(audio, from, to, ms, onDone){
    let steps=20, i=0;
    let iv = setInterval(()=>{
      i++;
      try{ audio.volume = Math.max(0,Math.min(1, from+(to-from)*(i/steps))); }catch(e){}
      if(i>=steps){ clearInterval(iv); if(onDone) onDone(); }
    }, ms/steps);
  },
  _onTrackEnded(finishedKey){
    if(finishedKey==='war_start') this.play('war_ongoing_1', true);
    else if(finishedKey==='war_ongoing_1') this.play('war_ongoing_2', true);
    else if(finishedKey==='war_ongoing_2') this.play('war_ongoing_1', true);
    else if(finishedKey==='victory' || finishedKey==='defeat') this.play('worldmap', true);
  },

  // === Durum makinesi tetikleyicileri — game.js olaylarından çağrılır ===
  onEnterMenu(){ this.play('menu'); },
  onEnterWorldMap(){ this.play('worldmap'); },
  onEnterCrisis(){ if(this.currentState!=='crisis'){ this._preCrisisState=this.currentState; this.play('crisis'); } },
  onExitCrisis(){ if(this.currentState==='crisis') this.play(this._preCrisisState||'worldmap', true); },
  /* Genel savaş durumu senkronizasyonu — her tur sonunda ve önemli
     diplomasi olaylarından sonra çağrılır (bkz. nextTurn/diplomacy). */
  syncWarState(){
    if(!state) return;
    let atWar = Object.values(state.countries).some(c=>!c.isBloc && c.relation<=0 && !c.eliminated);
    let inWarMusic = ['war_start','war_ongoing_1','war_ongoing_2'].includes(this.currentState);
    if(atWar && !inWarMusic && this.currentState!=='crisis') this.play('war_start', true);
    else if(!atWar && inWarMusic) this.play('worldmap', true);
  },
  /* Bir ülkeyi TAMAMEN fethederek kazanılan bireysel savaş zaferi — 1 tur
     "Yelkenler Biçilecek" çalar, parça bitince otomatik dünya haritasına
     döner (bkz. _onTrackEnded). Genel oyun zaferinden (%60 dünya
     kontrolü) AYRIDIR — o ui.gameOver() içinde onVictory() ile tetiklenir. */
  onWarVictory(){ this.play('victory', true); },
  onVictory(){ this.play('victory', true); },
  onDefeat(){ this.play('defeat', true); }
};

const advancedSystem = {
  lastCrisisType: null,
  opecTriggerCount: 0,
  checkEvents(){
    if(state.turn % 7 !== 0) return;
    let events = [
      {key:"opec", title:"OPEC Petrol Krizi", severity:"warning", desc:"Küresel petrol fiyatları ani bir arz kesintisi nedeniyle yükseldi.", effect:()=>{
        advancedSystem.opecTriggerCount++;
        let bonus = Math.max(25000, 100000 - (advancedSystem.opecTriggerCount-1)*15000);
        state.player.budget+=bonus;
        log(`🛢️ Kriz: Petrol fiyatları arttı (+${bonus.toLocaleString()}$).`,"#f59e0b");
        return `Hazineniz petrol gelirlerinden <b>+${bonus.toLocaleString()}$</b> kazandı.`;
      }},
      {key:"border", title:"Sınır İhlali Krizi", severity:"warning", desc:"Sınır bölgelerinde yaşanan gerginlik halkın millî birlik duygusunu güçlendirdi.", effect:()=>{
        state.player.stability=Math.min(100,state.player.stability+8);
        log("🎯 Kriz: Halk desteği arttı (%+8 istikrar).","#10b981");
        return "İstikrar <b>%+8</b> arttı.";
      }},
      {key:"cyber", title:"Siber Casusluk Tehdidi", severity:"warning", desc:"Devlet sistemlerine yönelik bir siber sızma girişimi tespit edildi.", effect:()=>{
        state.player.budget=Math.max(0,state.player.budget-50000);
        log("💻 Kriz: Siber savunma onarımı 50.000$ maliyet çıkardı.","#ef4444");
        return "Siber savunma onarımı <b>-50.000$</b>'a mal oldu.";
      }},
      {key:"wheat", title:"Küresel Buğday Kıtlığı", severity:"warning", desc:"Kuraklık ve lojistik aksaklıklar küresel gıda fiyatlarını yukarı çekti.", effect:()=>{
        state.player.stability=Math.max(0,state.player.stability-6);
        log("🌾 Kriz: Gıda fiyatları arttı (%-6 istikrar).","#f59e0b");
        return "Gıda fiyatları nedeniyle istikrar <b>%-6</b> düştü.";
      }},
      /* YENİ: Budapeşte Katliamı — daha ağır, "critical" seviyeli bir kriz. */
      {key:"budapest", title:"Budapeşte Katliamı", severity:"critical", desc:"Budapeşte'de sivillere yönelik bir saldırı küresel kamuoyunu sarstı, uluslararası tansiyon yükseldi.", effect:()=>{
        state.globalTension = Math.min(100, state.globalTension+12);
        state.player.publicSupport = Math.max(0, state.player.publicSupport-5);
        log("⚠️ Kriz: Budapeşte Katliamı küresel tansiyonu yükseltti (+12) ve halk desteğinizi sarstı (-5).","#ef4444");
        return "Global Tansiyon <b>%+12</b> arttı, Halk Desteğiniz <b>%-5</b> düştü.";
      }}
    ];
    let pool = events.filter(e => e.key !== advancedSystem.lastCrisisType);
    let ev = pool[Math.floor(Math.random()*pool.length)];
    advancedSystem.lastCrisisType = ev.key;
    log(`⚠️ JEOPOLİTİK KRİZ: ${ev.title}`,"#facc15");
    let resultText = ev.effect();
    // YENİ: Log satırında kaybolmaması için krizler artık ayrıca ekranın
    // ortasında bir pop-up ile de gösteriliyor (önemine göre turuncu/kırmızı).
    ui.openCrisisPopup(ev.title, `<div>${ev.desc}</div><div style="margin-top:8px;">${resultText||""}</div>`, ev.severity);
  }
};

/* ================= ANİMASYON (saldırı + önleyici füze) ================= */
const canvas=document.getElementById("animCanvas");
let ctx = canvas?canvas.getContext("2d"):null;
function resizeCanvas(){ if(canvas){ canvas.width=canvas.parentElement.clientWidth; canvas.height=canvas.parentElement.clientHeight; } }
if(canvas){ window.addEventListener("resize",resizeCanvas); setTimeout(resizeCanvas,300); }

/* HARİTA BUGI DÜZELTMESİ: SVG viewBox 1000x500 birimlik "dünya uzayında"
   çiziliyor ve preserveAspectRatio="xMidYMid meet" ile konteynıra ölçekli/
   ortalanmış basılıyor. Canvas ise ham piksel kullanıyordu — iki katman
   FARKLI koordinat sistemlerindeydi, bu yüzden füze SVG'deki şehre değil
   canvas'ın ham (x,y) pikseline düşüyordu. mapToScreen() canvas'ı da SVG
   ile birebir aynı ölçek+kaydırmaya tabi tutarak bunu çözer. */
function mapToScreen(vx,vy){
  if(!canvas || !canvas.width || !canvas.height) return {x:vx,y:vy,s:1};
  let s = Math.min(canvas.width/MAP_W, canvas.height/MAP_H);
  let ox = (canvas.width - MAP_W*s)/2, oy = (canvas.height - MAP_H*s)/2;
  return { x: ox+vx*s, y: oy+vy*s, s };
}

let projectiles=[], particles=[], interceptors=[], nextProjId=1;

const animator = {
  loopStarted:false,
  spawnAttack(srcCity,tgtCity,type,attackerID,dmgOverride,sourceBatch,dist,forceSize){
    let src = project(srcCity.lat, srcCity.lon);
    let tgt = project(tgtCity.lat, tgtCity.lon);
    const SPEEDS = { nuke:0.0035, kara_birligi:0.0018, amphibious:0.0018, airborne:0.0028, ballistic_icbm:0.003, cruise_missile:0.004 };
    // YENİ: seyir füzesi de kara ailesi gibi alçak/düz bir rota izler
    // (gerçekte de böyle uçar — bu da vurulmasının neden kolay olduğunun
    // görsel karşılığı).
    const LOW_CURVE = new Set(['kara_birligi','amphibious','airborne','cruise_missile']); // düz/alçak yol izleyenler
    projectiles.push({
      id: nextProjId++,
      x:src.x, y:src.y, sx:src.x, sy:src.y, tx:tgt.x, ty:tgt.y, prog:0,
      speed: SPEEDS[type] || 0.006,
      type, tgtCity, hssHit:false, attackerID, frozen:false, dmgOverride, sourceBatch,
      dist: dist||0, forceSize: forceSize||1,
      curve: LOW_CURVE.has(type) ? (Math.random()-0.5)*10 : (Math.random()-0.5)*150
    });
  }
};

function createExplosion(x,y,type){
  let isNuke = type==='nuke';
  if(isNuke){ document.body.classList.add("shake-active"); setTimeout(()=>document.body.classList.remove("shake-active"),1500); }
  for(let i=0;i<(isNuke?100:20);i++){
    particles.push({x,y,vx:(Math.random()-0.5)*(isNuke?12:4),vy:(Math.random()-0.5)*(isNuke?12:4),
      life:1, decay:isNuke?0.01:0.04, size:isNuke?Math.random()*5+2:Math.random()*3+1,
      color: type==='kara_birligi'?"#4ade80":(isNuke?"#00ff66":(type==='intercept'?"#38bdf8":"#ff8800"))});
  }
}

function gameLoop(){
  if(!ctx) return requestAnimationFrame(gameLoop);
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // --- tehdit füzeleri (fizik WORLD/viewBox uzayında, çizim mapToScreen ile) ---
  for(let i=projectiles.length-1;i>=0;i--){
    let p=projectiles[i];
    if(p.frozen){
      let s=mapToScreen(p.x,p.y);
      ctx.beginPath(); ctx.arc(s.x,s.y,(p.type==='nuke'?5:3)*s.s,0,Math.PI*2); ctx.fillStyle="#ffcc00"; ctx.fill();
      continue;
    }
    p.prog += p.speed;
    p.x = p.sx + (p.tx-p.sx)*p.prog;
    p.y = p.sy + (p.ty-p.sy)*p.prog - Math.sin(p.prog*Math.PI)*p.curve;

    let targetCountry = state.countries[p.tgtCity.owner];
    const GROUND_FAMILY = new Set(['kara_birligi','amphibious','airborne']);

    // YENİ: hava savunması artık sadece uçan mühimmatı (füze/drone/uçak/
    // nükleer) hedef alıyor — kara/çıkarma/hava indirme harekâtları
    // (karaya çıkan/inen birlikler) HSS tarafından değil, hedefin DİRENİŞ
    // seviyesine göre (aşağıda çarpışma anında) karşılanıyor.
    if(!GROUND_FAMILY.has(p.type) && p.prog>0.55 && p.prog<0.62 && !p.hssHit){
      p.hssHit=true;
      let layer = getDefenseLayer(p.type);
      let hssLayer = p.tgtCity.hss[layer];
      if(targetCountry.radarJammed<=0 && hssLayer.current>0){
        hssLayer.current--;
        let radarBonus = (p.tgtCity.owner===state.playerID && state.player.tech.radar) ? 0.15:0;
        // YENİ: Saldıran ülkeye karşı hava sahası kapatılmışsa önleme şansı artar
        let airspaceBonus = (p.tgtCity.owner===state.playerID && state.countries[p.attackerID] && state.countries[p.attackerID].airspaceBanned) ? 0.10:0;
        // YENİ: Tier'a göre hava savunması — sabit %30/%15 kaldırıldı.
        // Güçlü Tier (1) çok daha etkili savunur, saldıranın Tier'i de
        // savunmayı kısmen zayıflatır; fark savaş sonucunu gerçekten etkiler.
        let defTierBonus = tierDefenseBonus(p.tgtCity.owner);
        let atkTierPenalty = tierAttackPenalty(p.attackerID);
        // YENİ: silah tipine özel taban ihtimal (bkz. INTERCEPT_BASE_CHANCE) —
        // seyir füzesi en kolay vurulan (%80), balistik %70, drone %60,
        // 5.nesil uçak %40, nükleer %10 neredeyse imkansız.
        let base = INTERCEPT_BASE_CHANCE[p.type] !== undefined ? INTERCEPT_BASE_CHANCE[p.type] : 0.5;
        let chance = Math.max(0.03, Math.min(0.95, base + defTierBonus - atkTierPenalty + radarBonus + airspaceBonus));
        if(Math.random()<chance){
          p.frozen = true;
          let cityPos = project(p.tgtCity.lat, p.tgtCity.lon);
          interceptors.push({sx:cityPos.x, sy:cityPos.y, x:cityPos.x, y:cityPos.y, tx:p.x, ty:p.y, prog:0, speed:0.09, targetId:p.id});
          soundEngine.play('air_defense_fire'); // YENİ: radar kilitleyip önleyici fırlattığı an
        }
      }
    }

    let scr = mapToScreen(p.x,p.y);
    /* ================= YENİ: HARİTA İKONLARI =================
       Renkli nokta/kare yerine küçük, okunabilir emoji glifleri —
       ekstra asset dosyası olmadan (bkz. UNIT_ICONS). Drone sürüsü tek
       nokta değil, birbirine yakın birkaç ayrı drone gibi çizilir. */
    let icon = UNIT_ICONS[p.type] || "●";
    let fontSize = Math.max(9, (p.type==='nuke'?15:11) * scr.s);
    ctx.font = fontSize+"px sans-serif";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    if(p.type==='drone_swarm'){
      // YENİ: tek nokta yerine N ayrı drone — hafif dağınık bir sürü hissi
      let n = Math.min(5, Math.max(2, Math.round((p.forceSize||1))));
      if(!p._swarmOffsets){
        p._swarmOffsets = Array.from({length:n}, ()=>({dx:(Math.random()-0.5)*10, dy:(Math.random()-0.5)*10}));
      }
      p._swarmOffsets.forEach(o=>ctx.fillText(icon, scr.x+o.dx*scr.s, scr.y+o.dy*scr.s));
    } else if(p.type==='airborne' && p.prog>0.85){
      // YENİ: hava indirme — hedefe yaklaşınca uçak ikonunun yanına inen
      // paraşütçü ikonu eklenir (uçak devam eder, birlik aşağı iner).
      ctx.fillText(icon, scr.x, scr.y);
      ctx.font = Math.max(8,fontSize*0.8)+"px sans-serif";
      ctx.fillText(UNIT_ICONS.paratrooper, scr.x, scr.y+8*scr.s);
    } else {
      ctx.fillText(icon, scr.x, scr.y);
    }

    if(p.prog>=1){
      // YENİ: Uçak dönüş yolunda (p.returning) BURAYA tekrar ulaşırsa artık
      // hasar/patlama/kuyruk mantığı TEKRAR ÇALIŞMAZ — sadece sessizce
      // kaldırılır (üs bölgesinde sahte bir "patlama" görünmesin diye).
      if(p.returning){
        projectiles.splice(i,1);
        ui.updateAll();
        continue;
      }
      createExplosion(p.tx,p.ty,p.type);
      soundEngine.play(p.type==='nuke' ? 'explosion_nuke' : (p.type==='gen5_jet' ? 'jet_attack' : (GROUND_FAMILY.has(p.type) ? 'ground_attack' : 'explosion')));
      let cfg = WEAPON_CONFIG[p.type];
      let dmg = p.dmgOverride!==undefined ? p.dmgOverride : (cfg ? cfg.dmg : 20);
      if(p.type==='gen5_jet' && p.attackerID===state.playerID && state.player.tech.gen5_jet) dmg = Math.round(dmg*1.3);
      // YENİ: forceSize>1 olan TEK bir mermi (örn. düşmanın stoğundan bir
      // kerede birden fazla birim gönderdiği toplu saldırı dalgası) o kadar
      // katlanmış hasar verir — "1 füze atıp geçiştirme" yerine gerçek
      // envanterden gerçek miktarda karşılık.
      if((!cfg || !cfg.capture) && p.forceSize && p.forceSize>1) dmg = dmg * p.forceSize;

      if(p.attackerID===state.playerID){
        /* ================= YENİ: SALDIRI GECİKMESİ =================
           Oyuncunun saldırıları artık ANINDA sonuçlanmıyor. Mermi
           görsel olarak hedefe ulaşır (patlama efekti hâlâ anında
           oynar), ama gerçek hasar/ilhak SONUCU bir sonraki tur raporu
           kapatıldıktan 1 saniye sonra işlenir (bkz.
           engine.processPendingAttacks / ui.closeTurnReport). Bu sayede
           oyuncu turu atlamadan tek bir turda bir ülkeyi tamamen ele
           geçiremez — düşmana karşılık verme fırsatı doğar. Düşmanın
           OYUNCUYA yaptığı saldırılar bu geciktirmeye TABİ DEĞİL: onlar
           zaten sadece tur başına bir kez (nextTurn içinde) tetikleniyor,
           ek bir gecikme gerekmiyor. */
        state.player.pendingAttackResolutions.push({
          type:p.type, isCapture:!!(cfg&&cfg.capture), dmg,
          targetCountryId:p.tgtCity.owner,
          targetCityIdx: state.countries[p.tgtCity.owner] ? state.countries[p.tgtCity.owner].cities.indexOf(p.tgtCity) : -1,
          attackerID:p.attackerID, sourceBatch:p.sourceBatch, dist:p.dist, forceSize:p.forceSize,
          queuedTurn: state.turn
        });
        log(`🎯 ${p.tgtCity.name} hedefine ulaşıldı — kesin sonuç bir sonraki tur işlenecek.`,"#facc15");
      } else if(cfg && cfg.capture){
        resolveGroundAssault(p.tgtCity, p.attackerID, cfg, p.sourceBatch, p.dist, p.forceSize);
      } else {
        // YENİ: SUPPRESSION-ONLY — füze/drone/uçak/nükleer artık şehri asla
        // ele geçirmez, sadece hasar (hp) ve direniş (resistance) düşürür.
        p.tgtCity.hp = Math.max(0, p.tgtCity.hp - dmg);
        p.tgtCity.resistance = Math.max(0, p.tgtCity.resistance - dmg);
        p.tgtCity.lastHitTurn = state.turn; // YENİ: bu şehir bu tur toparlanmaz
        if(p.tgtCity.owner===state.playerID){
          log(`💥 ŞEHRİMİZ VURULDU: ${p.tgtCity.name} — HP:%${p.tgtCity.hp} Direniş:%${p.tgtCity.resistance}`,"#ff8800");
        }
      }
      /* ================= YENİ: 5. NESİL UÇAK — VURULMAZSA GERİ DÖNER =================
         Diğer tüm mühimmat türleri hedefe ulaşınca yok olur (mermi/drone
         tek kullanımlık), ama uçak öyle değil: hava savunmasını atlattıysa
         (buraya kadar geldiyse zaten atlatmış demektir — önlenen mermiler
         yukarıdaki interceptor mantığıyla ARRAY'DEN ÇIKARILIYOR, hiç bu
         satıra ulaşmıyor) saldırısını yapar ve ÜSSÜNE GERİ DÖNER. */
      if(p.type==='gen5_jet'){
        p.returning = true; p.prog = 0;
        let tmpX=p.sx, tmpY=p.sy; p.sx=p.tx; p.sy=p.ty; p.tx=tmpX; p.ty=tmpY;
        ui.updateAll();
        continue; // bu turda splice ETME — dönüş yolculuğu başladı
      }
      projectiles.splice(i,1);
      ui.updateAll();
    }
  }

  // --- önleyici füzeler ---
  for(let i=interceptors.length-1;i>=0;i--){
    let ic=interceptors[i];
    ic.prog += ic.speed;
    ic.x = ic.sx + (ic.tx-ic.sx)*ic.prog;
    ic.y = ic.sy + (ic.ty-ic.sy)*ic.prog;
    let s=mapToScreen(ic.x,ic.y);
    ctx.beginPath(); ctx.arc(s.x,s.y,2.5*s.s,0,Math.PI*2); ctx.fillStyle="#38bdf8"; ctx.fill();

    if(ic.prog>=1){
      createExplosion(ic.x,ic.y,'intercept');
      let idx = projectiles.findIndex(pp=>pp.id===ic.targetId);
      if(idx>=0){
        log(`🛡️ HSS ENGELLEDİ: Önleyici füze tehdidi havada imha etti!`,"#38bdf8");
        soundEngine.play('intercept');
        projectiles.splice(idx,1);
      }
      interceptors.splice(i,1);
      ui.updateAll();
    }
  }

  for(let i=particles.length-1;i>=0;i--){
    let pt=particles[i]; pt.x+=pt.vx; pt.y+=pt.vy; pt.life-=pt.decay;
    if(pt.life<=0){particles.splice(i,1); continue;}
    let s=mapToScreen(pt.x,pt.y);
    ctx.globalAlpha=pt.life; ctx.fillStyle=pt.color;
    ctx.beginPath(); ctx.arc(s.x,s.y,pt.size*s.s,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
  }
  requestAnimationFrame(gameLoop);
}

window.onload = ()=>{
  ui.renderCountrySelect();
  if(typeof worldMap !== "undefined"){
    worldMap.load(()=>{ if(state) ui.buildMap(); });
  }
  // YENİ: Ana menü müziği — tarayıcılar kullanıcı etkileşimi olmadan
  // otomatik ses oynatmayı engelleyebilir; bu durumda musicEngine._swap
  // sessizce başarısız olur (play().catch), oyun ETKİLENMEZ. İlk
  // tıklama/dokunuşta (örn. bir ülke seçmek) tarayıcı zaten sesi
  // serbest bırakır.
  musicEngine.onEnterMenu();
};
