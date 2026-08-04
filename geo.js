/* ================= GEO.JS — Dünya Verisi + Harita Motoru =================
   20 tam simüle ülke + 6 pasif kıta bloğu + GERÇEK dünya haritası.

   Harita iki katmanlı çalışır:
   1) GERÇEK HARİTA (tercih edilen): D3.js + canlı TopoJSON (jsDelivr CDN,
      world-atlas 110m — gerçek kıyı şeritleri, sadeleştirilmiş ama coğrafi
      olarak doğru). İnternet varsa bu kullanılır.
   2) YEDEK HARİTA (fallback): CDN'e ulaşılamazsa (offline, engellenmiş ağ,
      script eksik vb.) elle tanımlı düşük çözünürlüklü ülke silüetleriyle
      OTOMATİK devreye girer. Oyun bu yüzden internet yokken de asla
      bomboş harita göstermez.

   ÖNEMLİ: project() tüm oyunun (harita çizimi + şehir noktaları + füze
   animasyonları) ortak koordinat dönüştürücüsüdür. Hangi harita aktifse
   (gerçek ya da yedek) diğer her şey otomatik ona hizalanır — bu sayede
   "füze yanlış yere düşüyor" tipi hizalama hataları yapısal olarak
   engellenmiş olur.
*/

/* ---------------- 20 OYNANABİLİR ÜLKE ---------------- */
const GEO_DATA = {
  USA:{ name:"ABD", color:"#1e3a8a", cities:[
    {name:"Washington DC", lat:38.9, lon:-77.0, hssCap:55},
    {name:"New York",      lat:40.7, lon:-74.0, hssCap:45},
    {name:"Los Angeles",   lat:34.0, lon:-118.2,hssCap:45},
    {name:"Chicago",       lat:41.9, lon:-87.6, hssCap:35}
  ]},
  RUS:{ name:"Rusya", color:"#7f1d1d", cities:[
    {name:"Moskova",        lat:55.75,lon:37.6,  hssCap:65},
    {name:"St. Petersburg", lat:59.9, lon:30.3,  hssCap:45},
    {name:"Novosibirsk",    lat:55.0, lon:82.9,  hssCap:40},
    {name:"Vladivostok",    lat:43.1, lon:131.9, hssCap:35}
  ]},
  CHN:{ name:"Çin", color:"#b45309", cities:[
    {name:"Pekin",    lat:39.9, lon:116.4, hssCap:65},
    {name:"Şanghay",  lat:31.2, lon:121.5, hssCap:55},
    {name:"Shenzhen", lat:22.5, lon:114.1, hssCap:45},
    {name:"Chengdu",  lat:30.6, lon:104.1, hssCap:45}
  ]},
  TUR:{ name:"Türkiye", color:"#065f46", cities:[
    {name:"Ankara",   lat:39.9, lon:32.8, hssCap:55},
    {name:"İstanbul", lat:41.0, lon:28.9, hssCap:45},
    {name:"İzmir",    lat:38.4, lon:27.1, hssCap:35},
    {name:"Antalya",  lat:36.9, lon:30.7, hssCap:35}
  ]},
  GRE:{ name:"Yunanistan", color:"#0284c7", cities:[
    {name:"Atina",   lat:37.9, lon:23.7, hssCap:40},
    {name:"Selanik", lat:40.6, lon:22.9, hssCap:30},
    {name:"Patras",  lat:38.2, lon:21.7, hssCap:25},
    {name:"Kandiye", lat:35.3, lon:25.1, hssCap:25}
  ]},
  ISR:{ name:"İsrail", color:"#6b21a8", cities:[
    {name:"Tel Aviv", lat:32.0, lon:34.8, hssCap:55},
    {name:"Kudüs",    lat:31.8, lon:35.2, hssCap:45},
    {name:"Hayfa",    lat:32.8, lon:34.9, hssCap:35},
    {name:"Aşdod",    lat:31.8, lon:34.6, hssCap:35}
  ]},
  EGY:{ name:"Mısır", color:"#a16207", cities:[
    {name:"Kahire",     lat:30.0, lon:31.2, hssCap:45},
    {name:"İskenderiye",lat:31.2, lon:29.9, hssCap:30}
  ]},
  LBY:{ name:"Libya", color:"#78716c", cities:[
    {name:"Trablus", lat:32.9, lon:13.2, hssCap:25},
    {name:"Bingazi", lat:32.1, lon:20.1, hssCap:20}
  ]},
  DZA:{ name:"Cezayir", color:"#166534", cities:[
    {name:"Cezayir (Alger)", lat:36.75,lon:3.06, hssCap:35},
    {name:"Oran",            lat:35.7, lon:-0.63,hssCap:25}
  ]},
  MAR:{ name:"Fas", color:"#c2410c", cities:[
    {name:"Rabat",     lat:34.0, lon:-6.83,hssCap:30},
    {name:"Kazablanka",lat:33.57,lon:-7.59,hssCap:30}
  ]},
  SOM:{ name:"Somali", color:"#57534e", cities:[
    {name:"Mogadişu", lat:2.04, lon:45.34,hssCap:15},
    {name:"Hargeisa", lat:9.56, lon:44.07,hssCap:15}
  ]},
  GBR:{ name:"İngiltere", color:"#1d4ed8", cities:[
    {name:"Londra",    lat:51.5, lon:-0.13,hssCap:50},
    {name:"Manchester",lat:53.48,lon:-2.24,hssCap:35}
  ]},
  FRA:{ name:"Fransa", color:"#2563eb", cities:[
    {name:"Paris",    lat:48.85,lon:2.35, hssCap:50},
    {name:"Marsilya", lat:43.30,lon:5.37, hssCap:35}
  ]},
  DEU:{ name:"Almanya", color:"#525252", cities:[
    {name:"Berlin", lat:52.52,lon:13.40,hssCap:50},
    {name:"Münih",  lat:48.14,lon:11.58,hssCap:35}
  ]},
  IND:{ name:"Hindistan", color:"#ea580c", cities:[
    {name:"Yeni Delhi", lat:28.61,lon:77.21,hssCap:50},
    {name:"Mumbai",     lat:19.08,lon:72.88,hssCap:40}
  ]},
  IRN:{ name:"İran", color:"#15803d", cities:[
    {name:"Tahran",  lat:35.69,lon:51.39,hssCap:45},
    {name:"İsfahan", lat:32.65,lon:51.68,hssCap:30}
  ]},
  SAU:{ name:"Suudi Arabistan", color:"#a16207", cities:[
    {name:"Riyad", lat:24.71,lon:46.68,hssCap:40},
    {name:"Cidde", lat:21.49,lon:39.19,hssCap:30}
  ]},
  JPN:{ name:"Japonya", color:"#dc2626", cities:[
    {name:"Tokyo", lat:35.68,lon:139.69,hssCap:55},
    {name:"Osaka", lat:34.69,lon:135.50,hssCap:40}
  ]},
  KOR:{ name:"Güney Kore", color:"#0369a1", cities:[
    {name:"Seul", lat:37.57,lon:126.98,hssCap:50},
    {name:"Busan",lat:35.18,lon:129.08,hssCap:35}
  ]},
  UKR:{ name:"Ukrayna", color:"#facc15", cities:[
    {name:"Kiev",   lat:50.45,lon:30.52,hssCap:40},
    {name:"Harkiv", lat:49.99,lon:36.23,hssCap:25}
  ]}
};

const FLAGS = {
  USA:"🇺🇸", RUS:"🇷🇺", CHN:"🇨🇳", TUR:"🇹🇷", GRE:"🇬🇷", ISR:"🇮🇱",
  EGY:"🇪🇬", LBY:"🇱🇾", DZA:"🇩🇿", MAR:"🇲🇦", SOM:"🇸🇴", GBR:"🇬🇧",
  FRA:"🇫🇷", DEU:"🇩🇪", IND:"🇮🇳", IRN:"🇮🇷", SAU:"🇸🇦", JPN:"🇯🇵",
  KOR:"🇰🇷", UKR:"🇺🇦"
};

/* ---------------- GÜÇ KADEMELERİ (Tier 1 = en güçlü) ----------------
   Ekonomi/nüfus bu kademeye göre asimetrik verildi. Her turdaki otomatik
   büyüme hızı (Aşama 2) de bu tier'a bağlanacak — game.js'te GROWTH_RATES
   olarak tier numarasını kullanacak. */
const STARTING_STATS = {
  USA:{budget:950000, manpower:8000000,  uranium:6, invMult:1.6, tier:1, nuclear:true},
  RUS:{budget:900000, manpower:7000000,  uranium:7, invMult:1.5, tier:1, nuclear:true},
  CHN:{budget:1000000,manpower:14000000, uranium:5, invMult:1.5, tier:1, nuclear:true},

  GBR:{budget:650000, manpower:2200000,  uranium:2, invMult:1.1, tier:2, nuclear:false},
  FRA:{budget:640000, manpower:2100000,  uranium:2, invMult:1.1, tier:2, nuclear:false},
  DEU:{budget:700000, manpower:2400000,  uranium:1, invMult:1.15,tier:2, nuclear:false},
  IND:{budget:680000, manpower:12000000, uranium:3, invMult:1.2, tier:2, nuclear:false},
  JPN:{budget:660000, manpower:2000000,  uranium:0, invMult:1.1, tier:2, nuclear:false},

  TUR:{budget:600000, manpower:5500000,  uranium:2, invMult:1.0, tier:3, nuclear:false},
  ISR:{budget:520000, manpower:650000,   uranium:3, invMult:0.85,tier:3, nuclear:true},
  IRN:{budget:520000, manpower:4200000,  uranium:2, invMult:0.9, tier:3, nuclear:false},
  SAU:{budget:600000, manpower:1300000,  uranium:1, invMult:0.95,tier:3, nuclear:false},
  EGY:{budget:480000, manpower:3800000,  uranium:1, invMult:0.8, tier:3, nuclear:false},
  KOR:{budget:560000, manpower:2500000,  uranium:1, invMult:0.95,tier:3, nuclear:false},
  UKR:{budget:400000, manpower:3000000,  uranium:1, invMult:0.75,tier:3, nuclear:false},

  GRE:{budget:320000, manpower:1000000,  uranium:0, invMult:0.55,tier:4, nuclear:false},
  DZA:{budget:380000, manpower:1900000,  uranium:0, invMult:0.6, tier:4, nuclear:false},
  MAR:{budget:340000, manpower:1400000,  uranium:0, invMult:0.55,tier:4, nuclear:false},

  LBY:{budget:180000, manpower:400000,   uranium:0, invMult:0.35,tier:5, nuclear:false},
  SOM:{budget:110000, manpower:300000,   uranium:0, invMult:0.25,tier:5, nuclear:false}
};

/* Tier'a göre her turdaki otomatik büyüme oranı (bütçe/nüfus çarpanı).
   Tier 1 en hızlı büyür (süper güç), Tier 5 en yavaş. game.js Aşama 2'de
   nextTurn() içinde AI ülkelere bunu uygulayacak. */
const TIER_GROWTH_RATE = {1:1.035, 2:1.025, 3:1.018, 4:1.012, 5:1.006};

const START_STABILITY = {
  USA:90, RUS:85, CHN:85, GBR:88, FRA:82, DEU:88, IND:75, JPN:90,
  TUR:100,ISR:95, IRN:70, SAU:78, EGY:60, KOR:85, UKR:55,
  GRE:80, DZA:65, MAR:75, LBY:35, SOM:25
};

const BASE_INVENTORY = {drone_swarm:100, ballistic_short:20, ballistic_medium:5, ballistic_icbm:0, kara_birligi:30, tank:15, frigate:5, gen5_jet:3, nuke:0};

/* ---------------- İLİŞKİ TABLOSU ----------------
   Varsayılan 50 (nötr); aşağıdaki liste sadece bilinen gerçek bölgesel
   yakınlık/gerginlikleri geçersiz kılar. Listede olmayan her çift 50 alır
   (buildInitialState zaten böyle bir varsayılan fallback içeriyor). */
const REL_OVERRIDES = [
  ["TUR","GRE",20], ["TUR","ISR",15], ["TUR","RUS",60], ["TUR","USA",50], ["TUR","IRN",45],
  ["ISR","IRN",5],  ["ISR","SAU",25], ["ISR","EGY",40], ["ISR","USA",80],
  ["IRN","SAU",15], ["IRN","USA",10], ["IRN","RUS",65],
  ["RUS","UKR",5],  ["RUS","USA",30], ["RUS","GBR",25], ["RUS","DEU",35], ["RUS","CHN",55],
  ["CHN","USA",30], ["CHN","IND",35], ["CHN","JPN",35], ["CHN","KOR",45],
  ["USA","GBR",90], ["USA","FRA",85], ["USA","DEU",85], ["USA","JPN",88], ["USA","KOR",85], ["USA","GRE",60],
  ["GBR","FRA",75], ["DEU","FRA",85],
  ["UKR","USA",70], ["UKR","GBR",70], ["UKR","DEU",65],
  ["MAR","DZA",30],
  ["SAU","EGY",60], ["SAU","USA",65],
  ["JPN","KOR",55],
  ["IND","USA",60], ["IND","RUS",60],
  ["LBY","EGY",45], ["LBY","DZA",45],
  ["SOM","EGY",40]
];
function buildRelationTable(){
  let allIds = Object.keys(GEO_DATA).concat(Object.keys(BLOC_DATA));
  let table = {};
  for(let a of allIds){ table[a] = {}; for(let b of allIds) if(a!==b) table[a][b] = 50; }
  for(let [a,b,v] of REL_OVERRIDES){ if(table[a]) table[a][b]=v; if(table[b]) table[b][a]=v; }
  return table;
}
/* ---------------- 6 KITA BLOĞU (yarı-aktif) ----------------
   İç uyumsuzluk gerekçesiyle güçleri kasıtlı olarak ORTA SEVİYEDE tutulur
   (yaklaşık Tier 3 ülke seviyesi) — büyük güçlerden asla daha kuvvetli
   olmazlar. İki kısıtları var:
     canDeclareWar:false → kendileri savaş başlatamaz (AI-AI/AI-oyuncu
       savaş sistemi bunları hep pas geçecek).
     canGrow:false       → her turki otomatik büyümeden (Aşama 2) muaf,
       Ar-Ge yapamazlar, sabit güçte kalırlar.
   OYUNCU bunlara normal bir ülkeymiş gibi savaş açıp saldırabilir —
   bu yüzden her birine hedef alınabilecek bir "başkent" şehri verildi.
   Antarktika kıta bloğu bile değil — tamamen sahipsiz, tıklanamaz, dekor
   (classifyContinent lat<-60 için null döner). */
const BLOC_DATA = {
  AFRICA:{ name:"Afrika Bloğu", color:"#4d4535", isBloc:true, canDeclareWar:false, canGrow:false,
    cities:[{name:"Afrika Bloğu Genel Merkezi", lat:5, lon:20, hssCap:30}] },
  EUROPE:{ name:"Avrupa Bloğu", color:"#3d4d5c", isBloc:true, canDeclareWar:false, canGrow:false,
    cities:[{name:"Avrupa Bloğu Genel Merkezi", lat:50, lon:15, hssCap:30}] },
  ASIA:{ name:"Asya Bloğu", color:"#4a3d5c", isBloc:true, canDeclareWar:false, canGrow:false,
    cities:[{name:"Asya Bloğu Genel Merkezi", lat:30, lon:90, hssCap:30}] },
  NORTH_AMERICA:{ name:"Kuzey Amerika Bloğu", color:"#3d5c4d", isBloc:true, canDeclareWar:false, canGrow:false,
    cities:[{name:"Kuzey Amerika Bloğu Genel Merkezi", lat:45, lon:-95, hssCap:30}] },
  SOUTH_AMERICA:{ name:"Güney Amerika Bloğu", color:"#5c4d3d", isBloc:true, canDeclareWar:false, canGrow:false,
    cities:[{name:"Güney Amerika Bloğu Genel Merkezi", lat:-15, lon:-60, hssCap:30}] },
  OCEANIA:{ name:"Okyanusya Bloğu", color:"#3d5c5c", isBloc:true, canDeclareWar:false, canGrow:false,
    cities:[{name:"Okyanusya Bloğu Genel Merkezi", lat:-25, lon:135, hssCap:30}] }
};
/* Orta seviye (Tier 3 ülke ortalamasına yakın) sabit güç — canGrow:false
   olduğu için bu rakamlar oyun boyunca değişmez. */
const BLOC_STARTING_STATS = {
  AFRICA:{budget:480000, manpower:4000000, uranium:0, invMult:0.85, nuclear:false},
  EUROPE:{budget:520000, manpower:3200000, uranium:0, invMult:0.9,  nuclear:false},
  ASIA:{budget:520000, manpower:4500000, uranium:0, invMult:0.9,  nuclear:false},
  NORTH_AMERICA:{budget:500000, manpower:3000000, uranium:0, invMult:0.88, nuclear:false},
  SOUTH_AMERICA:{budget:460000, manpower:3400000, uranium:0, invMult:0.82, nuclear:false},
  OCEANIA:{budget:420000, manpower:1200000, uranium:0, invMult:0.8,  nuclear:false}
};
/* İç uyumsuzluk vurgusu için istikrar orta-düşük tutuldu (ülkelere göre
   daha kırılgan, ama tamamen çökük değil). */
const BLOC_START_STABILITY = { AFRICA:45, EUROPE:60, ASIA:50, NORTH_AMERICA:55, SOUTH_AMERICA:50, OCEANIA:55 };

const BASE_RELATIONS = buildRelationTable();

/* Bir GeoJSON ülke merkezinin (centroid) enlem/boylamına göre kaba kıta
   sınıflandırması. Piksel-hassas siyasi coğrafya değil, dekoratif harita
   renklendirmesi + o bölgenin hangi BLOC_DATA girdisine ait olduğunu
   belirlemek için yeterli bir yaklaşımdır. */
function classifyContinent(lat, lon){
  if(lat < -60) return null; // Antarktika — sahipsiz, dekor, tıklanamaz
  if(lon <= -30) return lat > 12 ? "NORTH_AMERICA" : "SOUTH_AMERICA";
  if(lon <= 60)  return lat > 35 ? "EUROPE" : "AFRICA";
  return lat > -10 ? "ASIA" : "OCEANIA";
}

/* Kıta bloğu başkentleri için elle çizilmiş kaba dörtgen "bölge" şekilleri
   — sadece yedek (offline) harita modunda kullanılır, gerçek haritada
   worldMap.renderInto bu bölgeleri otomatik boyar. generateZonePath()
   hem ülke hem blok id'lerini aynı şekilde işleyebilsin diye
   COUNTRY_SHAPES ile aynı tabloya ekleniyor. */
const BLOC_SHAPES = {
  AFRICA:[[20,-15],[20,45],[-35,45],[-35,-15]],
  EUROPE:[[62,-10],[62,45],[36,45],[36,-10]],
  ASIA:[[55,60],[55,150],[-10,150],[-10,60]],
  NORTH_AMERICA:[[62,-125],[62,-55],[12,-55],[12,-125]],
  SOUTH_AMERICA:[[12,-82],[12,-35],[-56,-35],[-56,-82]],
  OCEANIA:[[-10,110],[-10,180],[-47,180],[-47,110]]
};

/* ---------------- 20 ÜLKE İÇİN ISO NUMERİK KODLAR ----------------
   world-atlas TopoJSON'undaki feature.id değerleriyle eşleştirme için
   kullanılır (ISO 3166-1 numeric — kamuya açık, evrensel standart kodlar,
   herhangi bir telif içeriği taşımaz). */
const ISO_NUMERIC = {
  USA:"840", RUS:"643", CHN:"156", TUR:"792", GRE:"300", ISR:"376",
  EGY:"818", LBY:"434", DZA:"012", MAR:"504", SOM:"706", GBR:"826",
  FRA:"250", DEU:"276", IND:"356", IRN:"364", SAU:"682", JPN:"392",
  KOR:"410", UKR:"804"
};

/* ---------------- YEDEK (offline) ÜLKE SİLÜETLERİ ----------------
   Gerçek harita CDN'den yüklenemezse kullanılan, elle tanımlı düşük
   çözünürlüklü ama gerçek koordinatlara yakın temsili şekiller (5-11
   noktalık, tanınabilir ama piksel-hassasiyetinde olmayan siluetler). */
const COUNTRY_SHAPES = {
  USA:[[49,-124],[49,-95],[46,-84],[44,-69],[38,-75],[30,-81],[25,-80],[29,-94],[26,-97],[32,-117],[42,-124]],
  RUS:[[70,30],[70,148],[55,148],[45,135],[42,130],[41,48],[45,38],[50,30]],
  CHN:[[53,120],[48,135],[22,110],[18,109],[26,97],[35,75],[40,80],[45,90],[50,110]],
  TUR:[[42,26],[42,44],[36,44],[35.5,34],[36,27]],
  GRE:[[41.5,20],[41,26],[35,26],[35,20.5],[38,20]],
  ISR:[[33.3,35.6],[33.3,34.2],[29.5,34.5],[29.5,35.2]],
  EGY:[[31.5,25],[31.5,35],[22,35],[22,25]],
  LBY:[[33,10],[33,25],[20,25],[20,10]],
  DZA:[[37,-2],[37,9],[19,12],[19,-4]],
  MAR:[[35.8,-6],[35,-1],[27.7,-9.5],[32.5,-9.8]],
  SOM:[[11.5,43],[11.5,51],[-1.7,42],[8,47]],
  GBR:[[58.6,-5],[55,-1.5],[51,1.5],[50,-5.7],[54,-8]],
  FRA:[[51,2],[48.5,7.6],[43.2,7.5],[42.5,3],[44,-1.2],[48.5,-4.8]],
  DEU:[[55,8.5],[54,14],[48,13],[47.5,7.5]],
  IND:[[35,74],[28,97],[8,77],[23,68]],
  IRN:[[39.5,44],[38,55],[25.5,61],[25,52]],
  SAU:[[29,35],[29,48.5],[16.5,53],[16,42]],
  JPN:[[45.5,141.7],[43,144],[35,140],[31,130],[34,131]],
  KOR:[[38.6,128],[37.5,129.5],[34.5,127],[35,126]],
  UKR:[[52.2,23.2],[52,40.2],[45.3,36],[44.5,33.5],[45.5,29]]
};
Object.assign(COUNTRY_SHAPES, BLOC_SHAPES); // 6 blok bölgesini de aynı tabloya ekle

/* Yedek haritanın enlem/boylam sınırları — 20 ülke + 6 blok başkentinin
   tamamını (Güney Amerika/Okyanusya'nın düşük enlemi dahil) rahat bir
   marjla kapsayacak şekilde ayarlandı. */
const MAP_BOUNDS = { lonMin:-125, lonMax:150, latMin:-40, latMax:65 };
const MAP_W = 1000, MAP_H = 500;

/* Gerçek harita (D3) başarıyla yüklendiğinde worldMap.load() burayı
   doldurur; yüklenene kadar / hata olursa null kalır ve project()
   otomatik olarak basit doğrusal yönteme (yedek harita) döner. */
let d3Projection = null;

function project(lat, lon){
  if(d3Projection){
    let p = d3Projection([lon, lat]); // d3 projeksiyonları [lon,lat] sırası bekler
    if(p) return { x:p[0], y:p[1] };
  }
  let x = (lon - MAP_BOUNDS.lonMin) / (MAP_BOUNDS.lonMax - MAP_BOUNDS.lonMin) * MAP_W;
  let y = (MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin) * MAP_H;
  return { x, y };
}

/* Haversine — iki nokta arası gerçek büyük daire mesafesi (km).
   Füze/uçak menzil hesapları buna dayanır; harita hangi modda olursa
   olsun bu hesap DEĞİŞMEZ (gerçek dünya km'si, projeksiyondan bağımsız). */
function distanceKm(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180, dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* Ülke siluetini COUNTRY_SHAPES'teki enlem/boylam noktalarından SVG
   path'e çevirir (sadece yedek harita modunda kullanılır). */
function generateZonePath(countryId){
  let shape = COUNTRY_SHAPES[countryId];
  if(!shape || shape.length===0) return "";
  let pts = shape.map(([lat,lon]) => project(lat,lon));
  let d = `M ${pts[0].x},${pts[0].y} `;
  for(let i=1;i<pts.length;i++) d += `L ${pts[i].x},${pts[i].y} `;
  return d + "Z";
}

/* ================= GERÇEK DÜNYA HARİTASI (D3 + TopoJSON) =================
   worldMap.load() bir kez, oyun başlarken çağrılır (index.html'de D3 ve
   topojson-client CDN script'leri geo.js'ten ÖNCE yüklü). Başarılıysa
   gerçek kıyı şeritleri + gerçek projeksiyon kullanılır ve şehir/füze
   koordinatları da otomatik bu projeksiyona hizalanır (project()
   üzerinden, yukarıda). Başarısız olursa (offline, CDN engelli, script
   eksik vb.) sessizce yedek moda düşülür — harita YİNE DE çizilir. */
const worldMap = {
  ready:false, features:[], failed:false,

  load(onDone){
    if(typeof d3 === "undefined" || typeof topojson === "undefined"){
      console.warn("[TAYFUN] D3/topojson kütüphaneleri bulunamadı — yedek harita kullanılacak. (index.html'de CDN script'lerinin geo.js'ten ÖNCE eklendiğinden emin ol.)");
      this.failed = true; onDone && onDone(false); return;
    }
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(world => {
        let obj = world.objects.countries || world.objects.land;
        let geo = topojson.feature(world, obj);
        this.features = geo.features;
        d3Projection = d3.geoNaturalEarth1().fitSize([MAP_W, MAP_H], {type:"Sphere"});
        this.ready = true;
        console.log(`[TAYFUN] Gerçek dünya haritası yüklendi (${this.features.length} ülke geometrisi).`);
        onDone && onDone(true);
      })
      .catch(err => {
        console.warn("[TAYFUN] Gerçek harita CDN'den yüklenemedi, yedek harita kullanılacak. Hata:", err);
        this.failed = true; onDone && onDone(false);
      });
  },

  /* Gerçek harita verisiyle tüm dünyayı + oynanabilir 20 ülkeyi + kıta
     bloklarını svg üzerine çizer. game.js -> ui.buildMap() bunu çağırıp
     false dönerse (henüz yüklenmedi/başarısız) kendisi yedek moda geçer. */
  renderInto(svg, state, onCountryClick){
    if(!this.ready) return false;
    let pathGen = d3.geoPath(d3Projection);
    let isoToId = {}; for(let id in ISO_NUMERIC) isoToId[String(Number(ISO_NUMERIC[id]))] = id;

    for(let feature of this.features){
      let fid = String(Number(feature.id));
      let playableId = isoToId[fid];
      let d = pathGen(feature);
      if(!d) continue;

      let path = document.createElementNS("http://www.w3.org/2000/svg","path");
      path.setAttribute("d", d);

      if(playableId && state.countries[playableId]){
        let c = state.countries[playableId];
        path.setAttribute("fill", c.color);
        path.setAttribute("fill-opacity","0.7");
        path.style.stroke = c.alliedWithPlayer ? "#3fb87f" : (c.eliminated ? "#555" : "#233752");
        path.style.strokeWidth = c.alliedWithPlayer ? "2" : "1";
        path.style.opacity = c.eliminated ? "0.35" : "1";
        path.style.cursor = "pointer";
        path.onclick = () => onCountryClick(playableId);
      } else {
        // Oynanamayan ülke: hangi kıta bloğuna aitse o blok rengiyle boyanır
        // ve o blok bir aktör olduğu için TIKLANABİLİR (oyuncu blok'a
        // saldırabilir/savaş açabilir — blok kendisi savaş açamaz).
        let centroid = d3.geoCentroid(feature);
        let bloc = classifyContinent(centroid[1], centroid[0]);
        let bc = bloc && state.countries[bloc];
        if(bc){
          path.setAttribute("fill", bc.color);
          path.setAttribute("fill-opacity","0.45");
          path.style.stroke = bc.eliminated ? "#555" : "#182436"; path.style.strokeWidth = "0.7";
          path.style.opacity = bc.eliminated ? "0.35" : "1";
          path.style.cursor = "pointer";
          path.onclick = () => onCountryClick(bloc);
        } else {
          // Antarktika ya da hiçbir bloğa girmeyen artık bölge: tamamen dekor
          path.setAttribute("fill", "#1a2230");
          path.setAttribute("fill-opacity","0.4");
          path.style.stroke = "#182436"; path.style.strokeWidth = "0.5";
          path.style.pointerEvents = "none";
        }
      }
      svg.appendChild(path);
    }
    return true;
  }
};
