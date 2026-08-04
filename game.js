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

function setEl(id,val,isHTML=false){let el=document.getElementById(id);if(el){isHTML?el.innerHTML=val:el.innerText=val;}}

const MAX_LOG_LINES = 150;
let logLines = [];
function log(msg,color="#c5d4e8"){
  let box = document.getElementById("log-box");
  if(!box) return;
  let t = new Date().toLocaleTimeString('tr-TR',{hour12:false});
  logLines.push(`<div style="color:${color};border-bottom:1px solid #1a2b42;padding:3px 0;">[${t}] ${msg}</div>`);
  if(logLines.length > MAX_LOG_LINES) logLines = logLines.slice(logLines.length - MAX_LOG_LINES);
  box.innerHTML = logLines.join("");
  box.scrollTop = box.scrollHeight;
}

const P5_MEMBERS = ["USA","RUS","CHN","GBR","FRA"];
const RESOLUTION_LABELS = {embargo:"Ambargo Kararı", peacekeeping:"Barış Gücü Kararı", condemnation:"Kınama Kararı", intervention:"Müdahale Yetkisi", nuclear_cap:"Nükleer Denetim Kararı"};

const WEAPON_CONFIG = {
  drone_swarm:      {range:1500,  dmg:8,   cost:3000,   turns:1, label:"Sürü Drone"},
  ballistic_short:  {range:2000,  dmg:18,  cost:20000,  turns:1, label:"Balistik Füze (Kısa)"},
  ballistic_medium: {range:5000,  dmg:24,  cost:45000,  turns:2, label:"Balistik Füze (Orta)"},
  ballistic_icbm:   {range:12000, dmg:30,  cost:110000, turns:4, requiresTech:"icbm", label:"Kıtalararası Füze"},
  tank:             {cost:40000,  turns:2, label:"Tank", noAttack:true},
  kara_birligi:     {range:3000,  dmg:30,  cost:10000,  turns:1, manpowerCost:50000, label:"Piyade Tümeni"},
  frigate:          {cost:100000, turns:3, label:"Fırkateyn", noAttack:true},
  gen5_jet:         {range:3000,  dmg:25,  cost:150000, turns:3, label:"5. Nesil Uçak"},
  nuke:             {range:12000, dmg:999, cost:500000, turns:5, requiresTech:"nuclear", requiresIcbm:true, uraniumCost:1, label:"Nükleer Başlık"}
};

const RESEARCH_COSTS = {nuclear:120000, cyber:45000, radar:60000, hss_adv:70000, gen5_jet:90000, mrbm:80000, icbm:150000, air_refuel:100000};

/* Bir mühimmatın hangi hava savunma katmanı tarafından karşılanacağı.
   kara_birligi kara birliği olduğu için hava savunmasına hiç takılmaz
   (gameLoop'ta zaten ayrıca hariç tutuluyor). */
function getDefenseLayer(type){
  if(type==='drone_swarm') return 'short';
  if(type==='ballistic_icbm' || type==='nuke') return 'long';
  return 'medium'; // ballistic_short, ballistic_medium, gen5_jet
}
function freshLayeredHSS(cap){
  return { short:{cap,current:cap}, medium:{cap,current:cap}, long:{cap,current:cap} };
}

function buildInitialState(playerId){
  let stats = STARTING_STATS[playerId];
  let countries = {};

  for(let id in GEO_DATA){
    let g = GEO_DATA[id];
    let relation = id===playerId ? 100 : ((BASE_RELATIONS[playerId] && BASE_RELATIONS[playerId][id]!==undefined) ? BASE_RELATIONS[playerId][id] : 50);
    countries[id] = {
      name:g.name, color:g.color, isBloc:false, canDeclareWar:true,
      relation, stability:START_STABILITY[id],
      casusBelli:false, embargo:false, armsEmbargo:false, freeTrade:false, defensePact:false,
      alliedWithPlayer:id===playerId, scouted:false,
      eliminated:false, warTurns:0, blockaded:0, radarJammed:0,
      cities: g.cities.map(c => ({ name:c.name, lat:c.lat, lon:c.lon, hp:100, owner:id, hss:freshLayeredHSS(c.hssCap) }))
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
      cities: b.cities.map(c => ({ name:c.name, lat:c.lat, lon:c.lon, hp:100, owner:id, hss:freshLayeredHSS(c.hssCap) }))
    };
  }

  let inventory = {}; for(let k in BASE_INVENTORY) inventory[k] = Math.round(BASE_INVENTORY[k]*stats.invMult);
  return {
    turn:1, globalTension:0, playerID:playerId, selectedID: Object.keys(GEO_DATA).find(id=>id!==playerId),
    gameOver:false, sanctionRemaining:0,
    taxRate:30, refugeeLevel:0, unResolutions:[], unNukeCap:5,
    player:{
      budget:stats.budget, manpower:stats.manpower, stability:100, publicSupport:100, uranium:stats.uranium,
      tech:{nuclear:!!stats.nuclear, cyber:false, radar:false, gen5_jet:false, hss_adv:false, mrbm:false, icbm:false, air_refuel:false},
      inventory, customLoadout:{}, productionQueue:[]
    },
    countries
  };
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
      ui.buildMap(); ui.updateAll();
      log("📂 Kayıt yüklendi.","#00ff66");
    }catch(e){ log("❌ Kayıt okunamadı (bozuk veri).","red"); }
  },
  reset(){ try{ localStorage.removeItem("tayfun_save_v13"); }catch(e){} location.reload(); }
};

/* ---- BM Güvenlik Konseyi yardımcıları ---- */
function resolveUNVote(targetId){
  let player = state.playerID;
  let voters = Object.keys(state.countries).filter(id=>id!==player && id!==targetId && !state.countries[id].eliminated);
  let votesFor=0, votesAgainst=0, vetoers=[];
  voters.forEach(id=>{
    let c = state.countries[id];
    if(c.relation>=50) votesFor++; else votesAgainst++;
    if(P5_MEMBERS.includes(id) && c.relation<40) vetoers.push(c.name);
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
  renderCountrySelect(){
    let box = document.getElementById("country-cards");
    box.innerHTML = "";
    for(let id in GEO_DATA){
      let g = GEO_DATA[id];
      let s = STARTING_STATS[id];
      let card = document.createElement("div");
      card.className = "country-card";
      card.innerHTML = `
        <div style="font-size:2.2rem;">${FLAGS[id]}</div>
        <h3 style="border:none;padding:0;margin:6px 0;color:#fff;font-size:1rem;">${g.name}</h3>
        <div class="small-note">Güç Kademesi: Tier ${s.tier}${s.nuclear?" · ☢️ Nükleer":""}</div>
        <div class="small-note">Şehirler: ${g.cities.map(c=>c.name).join(", ")}</div>
        <div class="small-note" style="margin-top:6px;">💰 ${s.budget.toLocaleString()}$ · 👥 ${s.manpower.toLocaleString()} · ☢️ ${s.uranium} Uranyum</div>
      `;
      card.onclick = () => engine.startGame(id);
      box.appendChild(card);
    }
  },

  init(){
    setEl("hq-title", `${FLAGS[state.playerID]} ${state.countries[state.playerID].name} — Karargâh`);
    let taxSlider = document.getElementById("tax-rate-slider");
    if(taxSlider) taxSlider.value = state.taxRate;
    setEl("tax-rate-label","%"+state.taxRate);
    let refuelBox = document.getElementById("use-refuel");
    if(refuelBox) refuelBox.addEventListener("change", ()=>ui.updateAll());

    this.buildMap(); this.updateAll();
    setTimeout(()=>ui.buildMap(), 100); // layout geç oturursa haritayı garanti altına al
    log(`Sistem Aktif: TAYFUN v13 — ${state.countries[state.playerID].name} olarak Kara Kartal Doktrini devrede.`,"#00ff66");
    engine.calcProdTime();
  },

  switchTab(which){
    document.getElementById("left-panel").classList.toggle("mobile-active", which==="left");
    document.getElementById("right-panel").classList.toggle("mobile-active", which==="right");
    document.getElementById("tab-left").classList.toggle("active", which==="left");
    document.getElementById("tab-right").classList.toggle("active", which==="right");
    let tabUn = document.getElementById("tab-un"); if(tabUn) tabUn.classList.toggle("active", which==="un");
    let unPanel = document.getElementById("un-panel");
    if(unPanel){
      if(which==="un"){ unPanel.classList.add("open"); document.body.classList.add("un-open"); this.updateUNPanel(); }
      else { unPanel.classList.remove("open"); document.body.classList.remove("un-open"); }
    }
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
          circle.setAttribute("r", city.owner===state.playerID?6:5);
          circle.setAttribute("fill", city.owner===state.playerID?"#00ff66":state.countries[city.owner].color);
          circle.setAttribute("stroke","#fff"); circle.setAttribute("stroke-width","1.5");
          circle.style.pointerEvents="none"; svg.appendChild(circle);
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

    let invHTML=""; for(let k in p.inventory) invHTML+=`<div style="margin:3px 0;background:#152234;padding:4px;border-radius:3px;">${(WEAPON_CONFIG[k]?WEAPON_CONFIG[k].label:k).toUpperCase()}: <b>${p.inventory[k]}</b></div>`;
    setEl("inventory-list",invHTML,true);

    let qHTML = p.productionQueue.length===0?"Aktif üretim yok":p.productionQueue.map(q=>`[${(WEAPON_CONFIG[q.item]?WEAPON_CONFIG[q.item].label:q.item).toUpperCase()}] T${q.tier} — ${q.turnsLeft} tur kaldı`).join("<br>");
    setEl("queue-box",qHTML,true);

    setEl("tech-status", "Sahip: "+(Object.keys(p.tech).filter(k=>p.tech[k]).join(", ")||"Henüz yok"));
    document.getElementById("btn-nuclear").disabled = p.tech.nuclear;
    document.getElementById("btn-cyber").disabled = p.tech.cyber;
    document.getElementById("btn-radar").disabled = p.tech.radar;
    document.getElementById("btn-hss").disabled = p.tech.hss_adv;
    document.getElementById("btn-jet").disabled = p.tech.gen5_jet;
    let btnMrbm=document.getElementById("btn-mrbm"); if(btnMrbm) btnMrbm.disabled = p.tech.mrbm;
    let btnIcbm=document.getElementById("btn-icbm"); if(btnIcbm) btnIcbm.disabled = p.tech.icbm || !p.tech.mrbm;
    let btnRefuel=document.getElementById("btn-refuel"); if(btnRefuel) btnRefuel.disabled = p.tech.air_refuel;

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

    let tc=state.countries[state.selectedID];
    if(tc){
      let badges = (tc.eliminated?'<span class="badge" style="background:#333;">ÇÖKMÜŞ</span>':'') +
                   (tc.relation<=0&&!tc.eliminated&&state.selectedID!==state.playerID?'<span class="badge badge-war">SAVAŞTA</span>':'') +
                   (tc.embargo?'<span class="badge badge-embargo">AMBARGO</span>':'') +
                   (tc.armsEmbargo?'<span class="badge badge-embargo">SİLAH AMBARGOSU</span>':'') +
                   (tc.radarJammed>0?'<span class="badge badge-jam">RADAR KÖR</span>':'') +
                   (tc.blockaded>0?'<span class="badge badge-blockade">ABLUKA</span>':'');
      setEl("target-country-name", tc.name + " " + badges, true);
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

      // menzil bilgisi + özelleştirme + yakıt ikmali
      let weapon = document.getElementById("attack-weapon").value;
      let cfg = WEAPON_CONFIG[weapon];
      let refuelRow = document.getElementById("refuel-row");
      if(refuelRow) refuelRow.style.display = weapon==='gen5_jet' ? "flex" : "none";
      let useRefuelChecked = weapon==='gen5_jet' && document.getElementById("use-refuel") && document.getElementById("use-refuel").checked;

      let nearest = nearestOwnedCity(state.playerID, city);
      let rangeBox = document.getElementById("range-info");
      if(nearest && cfg && rangeBox){
        let loadout = state.player.customLoadout[weapon];
        let effRange = cfg.range!==undefined ? Math.round(cfg.range*((loadout&&loadout.rangeMult)||1)) : cfg.range;
        let d = Math.round(nearest.dist);
        if(useRefuelChecked && state.player.tech.air_refuel){
          rangeBox.className = "range-info";
          rangeBox.innerText = `${nearest.city.name} → ${city.name}: ${d} km · ⛽ Yakıt İkmali Aktif — Menzil Sınırsız`;
        } else {
          let ok = d <= effRange;
          rangeBox.className = "range-info" + (ok?"":" range-bad");
          rangeBox.innerText = `${nearest.city.name} → ${city.name}: ${d} km (Menzil: ${effRange} km) ${ok?"✔ Menzil dahilinde":"✘ MENZİL DIŞI"}`;
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

const engine = {
  startGame(countryId){
    state = buildInitialState(countryId);
    document.getElementById("country-select-screen").style.display="none";
    document.getElementById("game-container").style.display="flex";
    ui.init();
    setTimeout(resizeCanvas, 50);
    if(!animator.loopStarted){ animator.loopStarted=true; gameLoop(); }
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

  research(item){
    const cost = RESEARCH_COSTS[item];
    if(state.player.tech[item]) return;
    if(item==='icbm' && !state.player.tech.mrbm) return log("Önce Orta Menzil Roket Programı geliştirilmeli!","red");
    if(state.player.budget < cost) return log("Ar-Ge için bütçe yetersiz!","red");
    state.player.budget -= cost;
    state.player.tech[item] = true;
    if(item==='hss_adv'){
      state.countries[state.playerID].cities.forEach(c=>{ ['short','medium','long'].forEach(l=>{ c.hss[l].cap+=20; c.hss[l].current+=20; }); });
      log("🛡️ HSS Modernizasyonu tamamlandı! Tüm şehirlerin katmanlı hava savunma kapasitesi arttı.","#00ff66");
    } else if(item==='nuclear'){
      log("☢️ Nükleer program tamamlandı! (Kıtalararası fırlatma için ayrıca ICBM teknolojisi gerekir)","#00ff66");
    } else if(item==='cyber'){
      log("💻 Siber İstihbarat Ağı aktif! Düşman şehirlerinin HSS durumunu ve teknoloji çalma imkânını kazandınız.","#00ff66");
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
    setEl("prod-info", `Süre: ${turns} tur · Maliyet: ${cost.toLocaleString()}$${extra}${reqTxt}${icbmTxt}`);
  },

  startProduction(){
    let item=document.getElementById("prod-item").value;
    let tier=parseInt(document.getElementById("prod-tier").value)||1;
    let cfg = WEAPON_CONFIG[item];
    if(!cfg) return log("Geçerli bir ürün seçilmedi.","red");
    let cost=cfg.cost*tier;
    if(item==='gen5_jet' && state.player.tech.gen5_jet) cost = Math.round(cost*0.8);
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
      }
    } else if(mode==='satellite'){
      if(p.budget<35000) return log("Uydu keşfi için 35.000$ gerekli.","red");
      p.budget-=35000; target.scouted = true;
      log(`🛰️ Uydu keşfi tamamlandı: ${target.name} şehir savunma bilgileri artık görünür (ifşa riski yok).`,"#1e3a5f");
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
    }
    else if(action==='send_envoy'){
      if(p.budget<15000) return log("Elçi göndermek için 15.000$ gerekli.","red");
      p.budget-=15000; target.relation=Math.min(100,target.relation+15);
      log(`🕊️ Elçi gönderildi: ${target.name} ile ilişkiler gelişti (+15).`,"#38bdf8");
    }
    else if(action==='alliance'){
      if(target.relation<70) return log("İttifak için ilişki seviyesi en az %70 olmalı.","yellow");
      if(p.budget<30000) return log("İttifak anlaşması için 30.000$ gerekli.","red");
      p.budget-=30000; target.alliedWithPlayer=true;
      log(`🤝 ${target.name} ile resmi ittifak kuruldu! Artık birbirinize saldıramazsınız.`,"#3fb87f");
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
    let targetCountry=state.countries[state.selectedID];
    if(state.selectedID===state.playerID) return log("Kendi ülkenize saldıramazsınız.","yellow");
    if(targetCountry.alliedWithPlayer) return log(`${targetCountry.name} müttefikinizdir!`,"red");
    let idx=document.getElementById("target-city-select").value;
    let targetCity=targetCountry.cities[idx]||targetCountry.cities[0];
    if(targetCountry.relation>0) return log("Önce Savaş İlan etmelisiniz!","yellow");

    let cfg = WEAPON_CONFIG[type];
    if(!cfg) return log("Geçerli bir mühimmat seçilmedi.","red");
    let loadout = state.player.customLoadout[type];
    let effRange = cfg.range!==undefined ? cfg.range*((loadout&&loadout.rangeMult)||1) : cfg.range;
    let effDmg = cfg.dmg!==undefined ? Math.round(cfg.dmg*((loadout&&loadout.dmgMult)||1)) : cfg.dmg;

    // YENİ: Havada yakıt ikmali — sadece uçak, menzil sınırını kaldırır
    let refuelBox = document.getElementById("use-refuel");
    let useRefuel = type==='gen5_jet' && refuelBox && refuelBox.checked;
    if(useRefuel && !state.player.tech.air_refuel) return log("Yakıt ikmali için önce Havada Yakıt İkmali Programı geliştirilmeli!","red");
    const REFUEL_COST = 50000;
    if(useRefuel && state.player.budget<REFUEL_COST) return log(`Yakıt ikmali için ek ${REFUEL_COST.toLocaleString()}$ gerekli.`,"red");

    let nearest = nearestOwnedCity(state.playerID, targetCity);
    if(!nearest) return log("Saldırıyı fırlatacak sahip olduğunuz bir şehir kalmadı!","red");
    if(!useRefuel && nearest.dist > effRange) return log(`MENZİL DIŞI: ${nearest.city.name} → ${targetCity.name} mesafesi ${Math.round(nearest.dist)} km, bu silahın menzili ${Math.round(effRange)} km.`,"red");

    if(type==='nuke'){
      if(!state.player.tech.icbm) return log("Nükleer başlığın bu mesafeye taşınabilmesi için ICBM teknolojisi gerekli!","red");
      if(state.player.inventory.nuke<1) return log("Envanterde nükleer başlık yok! Önce üretmelisiniz.","red");
      state.player.inventory.nuke--;
      applyInternationalReaction();
      state.player.stability = Math.max(0,state.player.stability-15);
      log("☢️ NÜKLEER FIRLATMA! Global tansiyon kritik seviyeye ulaştı, dünya kınama mesajları yağdırıyor.","#ff3344");
    } else if(type==='kara_birligi'){
      if(state.player.inventory.kara_birligi<1) return log("Envanterde piyade tümeni yok!","red");
      state.player.inventory.kara_birligi--;
    } else {
      if(!state.player.inventory[type] || state.player.inventory[type]<=0) return log(`Envanterde ${cfg.label.toUpperCase()} kalmadı! Üretim yapmalısınız.`,"red");
      state.player.inventory[type]--;
    }

    if(useRefuel){ state.player.budget-=REFUEL_COST; log(`⛽ Yakıt ikmali kullanıldı: ${nearest.city.name} → ${targetCity.name} (${Math.round(nearest.dist)} km, menzil sınırı yok).`,"#facc15"); }

    log(`🚀 ${nearest.city.name}'den ${targetCity.name} hedefine ${cfg.label.toUpperCase()} sevk edildi! (${Math.round(nearest.dist)} km)`,"#ff3344");
    animator.spawnAttack(nearest.city,targetCity,type,state.playerID,effDmg);
    ui.updateAll();
  },

  nextTurn(){
    if(state.gameOver) return;
    state.turn++;
    const p = state.player;

    // ---- Ekonomi (vergi oranı + serbest ticaret + ambargo dahil) ----
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
    let upkeep = Object.values(p.inventory).reduce((a,b)=>a+b,0)*80 + p.productionQueue.length*500;
    p.budget = Math.max(0, p.budget + income - upkeep);

    p.manpower += (p.publicSupport<30? 8000 : 15000);

    // Üretim kuyruğu
    for(let i=p.productionQueue.length-1;i>=0;i--){
      let q=p.productionQueue[i]; q.turnsLeft--;
      if(q.turnsLeft<=0){
        p.inventory[q.item]=(p.inventory[q.item]||0)+1;
        if(q.custom) p.customLoadout[q.item] = q.custom;
        log(`✅ Üretim tamamlandı: ${WEAPON_CONFIG[q.item].label.toUpperCase()} envantere eklendi!`,"#00ff66");
        p.productionQueue.splice(i,1);
      }
    }

    // HSS rejenerasyonu (3 katman), radar jam / abluka süresi, çökme kontrolü,
    // tier'a göre AI savunma büyümesi (Aşama 2) ve rejim değişikliği riski
    for(let id in state.countries){
      let c = state.countries[id];
      c.cities.forEach(city=>{
        ['short','medium','long'].forEach(l=>{
          if(city.hss[l].current<city.hss[l].cap) city.hss[l].current = Math.min(city.hss[l].cap, city.hss[l].current + Math.ceil(city.hss[l].cap*0.15));
        });
      });
      if(c.radarJammed>0) c.radarJammed--;
      if(c.blockaded>0){ c.blockaded--; c.stability = Math.max(10, c.stability-3); }

      if(id!==state.playerID && !c.eliminated){
        if(c.relation>0 && c.stability<90) c.stability = Math.min(90,c.stability+2);
        c.warTurns = c.relation<=0 ? c.warTurns+1 : 0;
        if(getOwnedCities(id).length===0){ c.eliminated=true; c.relation=100; log(`💀 ${c.name} tamamen çökmüş durumda, savaş dışı kaldı.`,"#888"); }

        if(!c.isBloc){
          // Aşama 2: tier'a göre otomatik savunma büyümesi (basitleştirilmiş
          // "ülkeler pasif kalmayacak" modeli — tam bir AI ekonomisi simüle
          // edilmiyor, ama şehir savunmaları zamanla güçleniyor)
          let tier = STARTING_STATS[id] ? STARTING_STATS[id].tier : 3;
          let rate = TIER_GROWTH_RATE[tier] || 1.01;
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
      if(enemy.relation<=0){
        let playerCities = getPlayerCities();
        let enemyCities = getAllCitiesOwnedBy(id);
        if(playerCities.length===0 || enemyCities.length===0) continue;
        let targetCity = playerCities[Math.floor(Math.random()*playerCities.length)];
        let source = nearestOwnedCity(id, targetCity);
        if(!source) continue;
        let options = ['ballistic_medium','kara_birligi'].filter(t => source.dist <= WEAPON_CONFIG[t].range);
        if(enemy.armsEmbargo) options = options.filter(t=>t!=='ballistic_medium'); // silah ambargosu gelişmiş mühimmatı kesti
        if(options.length===0) continue;
        let attackType = options[Math.floor(Math.random()*options.length)];
        log(`🚨 DÜŞMAN TAARRUZU: ${enemy.name}, ${targetCity.name} şehrimize ${WEAPON_CONFIG[attackType].label.toUpperCase()} saldırısı başlattı!`,"red");
        animator.spawnAttack(source.city,targetCity,attackType,id);
      }
      if(enemy.relation<=0 && enemy.stability<40 && Math.random()<0.3){
        enemy.relation=30;
        log(`🕊️ BARIŞ TEKLİFİ: ${enemy.name} ağır kayıplar sonrası savaşı sonlandırmak istiyor! İlişkiler düzeldi.`,"#38bdf8");
      }
    }

    // İç isyan riski
    if(p.stability<25 && Math.random()<0.2){
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

    advancedSystem.checkEvents();

    // Kazanma / kaybetme koşulları
    let ownedByPlayer = getPlayerCities().length;
    let totalCities=0; for(let id in state.countries) totalCities += state.countries[id].cities.length;
    if(ownedByPlayer===0){ ui.gameOver("🏳️ YENİLGİ","Tüm şehirleriniz düştü. Ülkeniz savunmasını kaybetti."); return; }
    if(p.stability<=0){ ui.gameOver("💥 İÇ ÇÖKÜŞ","İstikrar sıfıra düştü, ülke iç kargaşaya sürüklendi."); return; }
    if(p.publicSupport<=0){ ui.gameOver("🪧 HÜKÜMET DÜŞTÜ","Halk desteği tükendi, uzayan savaşlar sonucu hükümet istifaya zorlandı."); return; }
    if(ownedByPlayer >= totalCities*0.6){ ui.gameOver("🏆 ZAFER","Dünya haritasının %60'ından fazlasını kontrol ediyorsunuz. Kara Kartal Doktrini zaferle sonuçlandı!"); return; }

    ui.updateAll();
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

const advancedSystem = {
  lastCrisisType: null,
  opecTriggerCount: 0,
  checkEvents(){
    if(state.turn % 7 !== 0) return;
    let events = [
      {key:"opec", title:"OPEC Petrol Krizi", effect:()=>{
        advancedSystem.opecTriggerCount++;
        let bonus = Math.max(25000, 100000 - (advancedSystem.opecTriggerCount-1)*15000);
        state.player.budget+=bonus;
        log(`🛢️ Kriz: Petrol fiyatları arttı (+${bonus.toLocaleString()}$).`,"#f59e0b");
      }},
      {key:"border", title:"Sınır İhlali Krizi", effect:()=>{state.player.stability=Math.min(100,state.player.stability+8); log("🎯 Kriz: Halk desteği arttı (%+8 istikrar).","#10b981");}},
      {key:"cyber", title:"Siber Casusluk Tehdidi", effect:()=>{state.player.budget=Math.max(0,state.player.budget-50000); log("💻 Kriz: Siber savunma onarımı 50.000$ maliyet çıkardı.","#ef4444");}},
      {key:"wheat", title:"Küresel Buğday Kıtlığı", effect:()=>{state.player.stability=Math.max(0,state.player.stability-6); log("🌾 Kriz: Gıda fiyatları arttı (%-6 istikrar).","#f59e0b");}}
    ];
    let pool = events.filter(e => e.key !== advancedSystem.lastCrisisType);
    let ev = pool[Math.floor(Math.random()*pool.length)];
    advancedSystem.lastCrisisType = ev.key;
    log(`⚠️ JEOPOLİTİK KRİZ: ${ev.title}`,"#facc15");
    ev.effect();
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
  spawnAttack(srcCity,tgtCity,type,attackerID,dmgOverride){
    let src = project(srcCity.lat, srcCity.lon);
    let tgt = project(tgtCity.lat, tgtCity.lon);
    projectiles.push({
      id: nextProjId++,
      x:src.x, y:src.y, sx:src.x, sy:src.y, tx:tgt.x, ty:tgt.y, prog:0,
      speed: type==='nuke'?0.0035:(type==='kara_birligi'?0.0018:(type.startsWith('ballistic_icbm')?0.003:0.006)),
      type, tgtCity, hssHit:false, attackerID, frozen:false, dmgOverride,
      curve: type==='kara_birligi'?(Math.random()-0.5)*10:(Math.random()-0.5)*150
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

    if(p.type!=='kara_birligi' && p.prog>0.55 && p.prog<0.62 && !p.hssHit){
      p.hssHit=true;
      let layer = getDefenseLayer(p.type);
      let hssLayer = p.tgtCity.hss[layer];
      if(targetCountry.radarJammed<=0 && hssLayer.current>0){
        hssLayer.current--;
        let radarBonus = (p.tgtCity.owner===state.playerID && state.player.tech.radar) ? 0.15:0;
        let chance = (p.type==='nuke'?0.15:0.30) + radarBonus;
        if(Math.random()<chance){
          p.frozen = true;
          let cityPos = project(p.tgtCity.lat, p.tgtCity.lon);
          interceptors.push({sx:cityPos.x, sy:cityPos.y, x:cityPos.x, y:cityPos.y, tx:p.x, ty:p.y, prog:0, speed:0.09, targetId:p.id});
        }
      }
    }

    let scr = mapToScreen(p.x,p.y);
    ctx.beginPath();
    if(p.type==='kara_birligi'){ ctx.fillStyle="#4ade80"; ctx.fillRect(scr.x-3*scr.s,scr.y-3*scr.s,6*scr.s,6*scr.s); }
    else{ ctx.arc(scr.x,scr.y,(p.type==='nuke'?5:3)*scr.s,0,Math.PI*2); ctx.fillStyle = p.type==='nuke'?"#00ff66":(p.type==='gen5_jet'?"#38bdf8":"#ff3344"); ctx.fill(); }

    if(p.prog>=1){
      createExplosion(p.tx,p.ty,p.type);
      let dmg = p.dmgOverride!==undefined ? p.dmgOverride : (WEAPON_CONFIG[p.type] ? WEAPON_CONFIG[p.type].dmg : 20);
      if(p.type==='gen5_jet' && p.attackerID===state.playerID && state.player.tech.gen5_jet) dmg = Math.round(dmg*1.3);
      let damage = p.type==='nuke' ? 999 : dmg;
      p.tgtCity.hp = Math.max(0, p.tgtCity.hp - damage);
      if(p.tgtCity.hp===0){
        p.tgtCity.owner = p.attackerID; p.tgtCity.hp=60;
        ['short','medium','long'].forEach(l=>{ p.tgtCity.hss[l].current = Math.round(p.tgtCity.hss[l].cap*0.3); });
        ui.buildMap();
        log(`🏳️ ŞEHİR DÜŞTÜ: ${p.tgtCity.name} ele geçirildi!`,"#00ff66");
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
};
