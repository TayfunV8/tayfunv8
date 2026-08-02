// --- TAYVUN V7 - KUSURSUZ GRAND STRATEGY & DİPLOMASİ MOTORU ---

const style = document.createElement('style');
style.innerHTML = `
    @keyframes shake {
        0% { transform: translate(1px, 1px) rotate(0deg); }
        20% { transform: translate(-3px, 0px) rotate(1deg); }
        50% { transform: translate(-1px, 2px) rotate(-1deg); }
        100% { transform: translate(1px, -2px) rotate(-1deg); }
    }
    .shake-active { animation: shake 0.5s; animation-iteration-count: infinite; }
`;
document.head.appendChild(style);

function setEl(id, val, isHTML = false) {
    let el = document.getElementById(id);
    if (el) { if(isHTML) el.innerHTML = val; else el.innerText = val; }
}

function log(msg, color="#c5d4e8") {
    let box = document.getElementById("log-box");
    if (!box) return;
    let time = new Date().toLocaleTimeString('tr-TR', {hour12: false});
    box.innerHTML += `<div style="color:${color}; border-bottom:1px solid #1a2b42; padding:4px 0;">[${time}] ${msg}</div>`;
    box.scrollTop = box.scrollHeight;
}

let state = {
    turn: 1,
    globalTension: 0,
    playerID: "TUR",
    selectedID: "GRE",
    selectedCityIdx: 0,
    player: {
        budget: 600000,
        manpower: 5500000,
        stability: 100,
        uranium: 1,
        tech: { nuclear: false, cyber: false, radar: false, gen5_jet: false, hss_adv: false },
        inventory: { ballistic: 25, drone_swarm: 100, nuke: 0, kara_birligi: 30, tank: 15, frigate: 5, gen5_jet: 3 },
        productionQueue: []
    },
    countries: {
        "USA": { 
            name: "ABD", relation: 50, stability: 90, casusBelli: false, embargo: false, color: "#1e3a8a", radarJammed: false,
            svgPath: "M 50,50 L 350,50 L 350,250 L 50,250 Z",
            cities: [
                { name: "Washington DC", x: 300, y: 150, hp: 100, hss: { cap: 50, current: 50 } },
                { name: "New York", x: 320, y: 100, hp: 100, hss: { cap: 40, current: 40 } },
                { name: "Los Angeles", x: 100, y: 180, hp: 100, hss: { cap: 40, current: 40 } },
                { name: "Chicago", x: 200, y: 120, hp: 100, hss: { cap: 30, current: 30 } }
            ]
        },
        "RUS": {
            name: "Rusya", relation: 60, stability: 85, casusBelli: false, embargo: false, color: "#7f1d1d", radarJammed: false,
            svgPath: "M 600,20 L 1150,20 L 1150,200 L 600,200 Z",
            cities: [
                { name: "Moskova", x: 650, y: 100, hp: 100, hss: { cap: 60, current: 60 } },
                { name: "St. Petersburg", x: 620, y: 60, hp: 100, hss: { cap: 40, current: 40 } },
                { name: "Novosibirsk", x: 850, y: 120, hp: 100, hss: { cap: 40, current: 40 } },
                { name: "Vladivostok", x: 1100, y: 150, hp: 100, hss: { cap: 30, current: 30 } }
            ]
        },
        "CHN": {
            name: "Çin", relation: 40, stability: 85, casusBelli: false, embargo: false, color: "#b45309", radarJammed: false,
            svgPath: "M 750,250 L 1150,250 L 1150,500 L 750,500 Z",
            cities: [
                { name: "Pekin", x: 1000, y: 300, hp: 100, hss: { cap: 60, current: 60 } },
                { name: "Şanghay", x: 1080, y: 380, hp: 100, hss: { cap: 50, current: 50 } },
                { name: "Shenzhen", x: 950, y: 450, hp: 100, hss: { cap: 40, current: 40 } },
                { name: "Chengdu", x: 850, y: 380, hp: 100, hss: { cap: 40, current: 40 } }
            ]
        },
        "TUR": { 
            name: "Türkiye", relation: 100, stability: 100, casusBelli: false, embargo: false, color: "#065f46", radarJammed: false,
            svgPath: "M 400,280 L 580,270 L 600,340 L 450,350 L 390,320 Z",
            cities: [
                { name: "Ankara", x: 480, y: 310, hp: 100, hss: { cap: 50, current: 50 } },
                { name: "İstanbul", x: 420, y: 290, hp: 100, hss: { cap: 40, current: 40 } },
                { name: "İzmir", x: 405, y: 325, hp: 100, hss: { cap: 30, current: 30 } },
                { name: "Antalya", x: 450, y: 345, hp: 100, hss: { cap: 30, current: 30 } }
            ]
        },
        "GRE": {
            name: "Yunanistan", relation: 20, stability: 80, casusBelli: false, embargo: false, color: "#0284c7", radarJammed: false,
            svgPath: "M 340,280 L 385,290 L 395,345 L 360,400 L 330,350 Z",
            cities: [
                { name: "Atina", x: 375, y: 340, hp: 100, hss: { cap: 35, current: 35 } },
                { name: "Selanik", x: 360, y: 300, hp: 100, hss: { cap: 25, current: 25 } },
                { name: "Patras", x: 350, y: 335, hp: 100, hss: { cap: 20, current: 20 } },
                { name: "Kandiye", x: 385, y: 385, hp: 100, hss: { cap: 20, current: 20 } }
            ]
        },
        "ISR": {
            name: "İsrail", relation: 15, stability: 95, casusBelli: false, embargo: false, color: "#6b21a8", radarJammed: false,
            svgPath: "M 570,380 L 600,370 L 595,440 L 560,460 Z",
            cities: [
                { name: "Tel Aviv", x: 575, y: 400, hp: 100, hss: { cap: 50, current: 50 } },
                { name: "Kudüs", x: 585, y: 410, hp: 100, hss: { cap: 40, current: 40 } },
                { name: "Hayfa", x: 580, y: 385, hp: 100, hss: { cap: 30, current: 30 } },
                { name: "Aşdod", x: 572, y: 415, hp: 100, hss: { cap: 30, current: 30 } }
            ]
        }
    }
};

const saveSystem = {
    save() {
        localStorage.setItem("tayfun_save_v7", JSON.stringify(state));
        log("💾 Oyun başarıyla kaydedildi!", "#00ff66");
    },
    load() {
        let saved = localStorage.getItem("tayfun_save_v7");
        if(saved) {
            state = JSON.parse(saved);
            ui.buildMap();
            ui.updateAll();
            log("📂 Kayıtlı oyun yüklendi!", "#00ff66");
        } else {
            log("Kayıtlı oyun bulunamadı!", "yellow");
        }
    },
    reset() {
        localStorage.removeItem("tayfun_save_v7");
        location.reload();
    }
};

const ui = {
    init() {
        for(let id in state.countries) {
            state.countries[id].cities.forEach(c => c.owner = id);
        }
        this.injectUI();
        this.buildMap();
        this.updateAll();
        log("Sistem Aktif: Gelişmiş Diplomasi ve Savaş Yapay Zekası Devrede.", "#00ff66");
    },

    injectUI() {
        let leftPanel = document.getElementById("left-panel");
        if(leftPanel && !document.getElementById("save-load-box")) {
            let div = document.createElement("div");
            div.id = "save-load-box";
            div.style.cssText = "display:flex; gap:5px; margin-bottom:10px;";
            div.innerHTML = `
                <button onclick="saveSystem.save()" style="background:#0284c7; flex:1; padding:6px; font-size:0.8rem;">💾 Kaydet</button>
                <button onclick="saveSystem.load()" style="background:#0d9488; flex:1; padding:6px; font-size:0.8rem;">📂 Yükle</button>
                <button onclick="saveSystem.reset()" style="background:#991b1b; padding:6px; font-size:0.8rem;">🗑️ Sıfırla</button>
            `;
            leftPanel.insertBefore(div, leftPanel.firstChild);
        }

        let rightPanel = document.getElementById("right-panel");
        if(rightPanel && !document.getElementById("production-panel")) {
            let prodDiv = document.createElement("div");
            prodDiv.id = "production-panel";
            prodDiv.innerHTML = `
                <h3>🏭 ASKERİ FABRİKA & ÜRETİM</h3>
                <label>Ürün Seçimi:</label>
                <select id="prod-item" onchange="engine.calcProdTime()">
                    <option value="ballistic">Balistik Füze (Maliyet: 20.000$)</option>
                    <option value="drone_swarm">Sürü Drone (Maliyet: 3.000$)</option>
                    <option value="tank">Ana Muharebe Tankı (Maliyet: 40.000$)</option>
                    <option value="kara_birligi">🪖 Asker / Tümen (Maliyet: 10.000$ + 50K Nüfus)</option>
                    <option value="frigate">Fırkateyn (Maliyet: 100.000$)</option>
                    <option value="gen5_jet">5. Nesil Uçak (Maliyet: 150.000$)</option>
                    <option value="nuke">☢️ Nükleer Başlık (Maliyet: 500.000$ + 1 Uranyum)</option>
                </select>
                <label>Özelleştirme / Teknoloji Tier (1-5):</label>
                <input type="number" id="prod-tier" value="1" min="1" max="5" onchange="engine.calcProdTime()">
                <div id="prod-info" style="font-size:0.8rem; color:#38bdf8; margin:5px 0;">Süre: 1 Tur | Maliyet: 20.000$</div>
                <button class="btn-tech" onclick="engine.startProduction()">⚙️ ÜRETİMİ BAŞLAT</button>
                <div id="queue-box" style="font-size:0.8rem; background:#020617; padding:5px; border-radius:4px; max-height:70px; overflow-y:auto; margin-top:5px;">Aktif Üretim Yok</div>
            `;
            rightPanel.insertBefore(prodDiv, rightPanel.firstChild.nextSibling);
        }

        // Gelişmiş Diplomasi Butonları (Elçi, Ambargo, Sabotaj, Siber Saldırı)
        let dipSection = rightPanel.querySelector(".btn-war")?.parentNode;
        if(dipSection && !document.getElementById("btn-envoy")) {
            let dipExtra = document.createElement("div");
            dipExtra.style.cssText = "display:flex; flex-direction:column; gap:4px; margin-top:8px;";
            dipExtra.innerHTML = `
                <button class="btn-tech" style="background:#0284c7;" onclick="engine.diplomacy('send_envoy')">🕊️ Elçi Gönder / İlişki Düzelt (15.000$)</button>
                <button class="btn-tech" style="background:#b45309;" onclick="engine.diplomacy('embargo')">⚖️ Ekonomik Ambargo Uygula</button>
                <button class="btn-tech" style="background:#a855f7;" onclick="engine.diplomacy('cyber_attack')">💻 Siber Saldırı / Radarları Kör Et (40.000$)</button>
                <button class="btn-tech" style="background:#be123c;" onclick="engine.diplomacy('sabotage')">🕵️ Gizli Sabotaj Ajanı Gönder (30.000$)</button>
            `;
            dipSection.appendChild(dipExtra);
        }

        let weaponSelect = document.getElementById("attack-weapon");
        if(weaponSelect) {
            weaponSelect.innerHTML = `
                <option value="drone_swarm">Sürü Drone (HSS Tüketici)</option>
                <option value="ballistic">Balistik Füze (İsabet: %70)</option>
                <option value="gen5_jet">✈️ 5. Nesil Uçak Taarruzu</option>
                <option value="kara_birligi">🪖 Kara Birlikleri / Tank (HSS'ye Takılmaz!)</option>
                <option value="nuke">☢️ Nükleer Başlık (Şehri Yok Eder)</option>
            `;
        }
    },

    buildMap() {
        let svg = document.getElementById("game-map");
        if(!svg) return;
        svg.innerHTML = ""; 
        for(let id in state.countries) {
            let cData = state.countries[id];
            let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("id", id);
            path.setAttribute("d", cData.svgPath);
            path.setAttribute("fill", cData.color);
            path.style.stroke = "#233752";
            path.style.strokeWidth = "2";
            path.style.cursor = "pointer";
            path.onclick = () => engine.selectCountry(id);
            svg.appendChild(path);

            let text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", cData.cities[0].x - 10);
            text.setAttribute("y", cData.cities[0].y - 20);
            text.setAttribute("fill", "white");
            text.setAttribute("font-size", "14");
            text.setAttribute("pointer-events", "none");
            text.textContent = cData.name;
            svg.appendChild(text);

            cData.cities.forEach(city => {
                let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", city.x); 
                circle.setAttribute("cy", city.y);
                circle.setAttribute("r", city.owner === state.playerID ? 6 : 5); 
                circle.setAttribute("fill", city.owner === state.playerID ? "#00ff66" : state.countries[city.owner].color);
                circle.setAttribute("stroke", "#ffffff");
                circle.setAttribute("stroke-width", "1.5");
                circle.style.pointerEvents = "none";
                svg.appendChild(circle);
            });
        }
    },

    updateAll() {
        const p = state.player;
        setEl("val-budget", p.budget.toLocaleString() + "$");
        setEl("val-manpower", (p.manpower).toLocaleString());
        setEl("val-stability", "%" + p.stability);
        setEl("val-uranium", p.uranium);
        setEl("val-turn", state.turn);
        setEl("val-tension", "%" + state.globalTension);

        let invHTML = "";
        for(let k in p.inventory) {
            invHTML += `<div style="margin:3px 0; background:#1e293b; padding:4px; border-radius:3px; font-size:0.85rem;">
                <b>${k.toUpperCase().replace('_', ' ')}:</b> ${p.inventory[k]} Adet
            </div>`;
        }
        setEl("inventory-list", invHTML, true);

        let qHTML = "";
        if(p.productionQueue.length === 0) qHTML = "Aktif Üretim Yok";
        else {
            p.productionQueue.forEach((q) => {
                qHTML += `<div>[${q.item.toUpperCase()}] T${q.tier} - Kalan Tur: ${q.turnsLeft}</div>`;
            });
        }
        setEl("queue-box", qHTML, true);

        let tc = state.countries[state.selectedID];
        if(tc) {
            setEl("target-country-name", tc.name + (tc.embargo ? " ⚖️[AMBARGOLU]" : ""));
            setEl("target-relation", tc.relation);
            setEl("target-stability", "%" + tc.stability);

            let select = document.getElementById("target-city-select");
            if(select) {
                select.innerHTML = "";
                tc.cities.forEach((city, idx) => {
                    let opt = document.createElement("option");
                    opt.value = idx;
                    opt.innerText = `${city.name} (HP: %${city.hp})`;
                    select.appendChild(opt);
                });
            }
        }
    }
};

const engine = {
    selectCountry(id) { state.selectedID = id; ui.updateAll(); },

    calcProdTime() {
        let item = document.getElementById("prod-item").value;
        let tier = parseInt(document.getElementById("prod-tier").value) || 1;
        let baseCosts = { ballistic: 20000, drone_swarm: 3000, tank: 40000, kara_birligi: 10000, frigate: 100000, gen5_jet: 150000, nuke: 500000 };
        let baseTurns = { ballistic: 1, drone_swarm: 1, tank: 2, kara_birligi: 1, frigate: 3, gen5_jet: 3, nuke: 5 };

        let cost = (baseCosts[item] || 20000) * tier;
        let turns = (baseTurns[item] || 1) * tier;
        setEl("prod-info", `Süre: ${turns} Tur | Maliyet: ${cost.toLocaleString()}$`, true);
    },

    startProduction() {
        let item = document.getElementById("prod-item").value;
        let tier = parseInt(document.getElementById("prod-tier").value) || 1;
        let baseCosts = { ballistic: 20000, drone_swarm: 3000, tank: 40000, kara_birligi: 10000, frigate: 100000, gen5_jet: 150000, nuke: 500000 };
        let baseTurns = { ballistic: 1, drone_swarm: 1, tank: 2, kara_birligi: 1, frigate: 3, gen5_jet: 3, nuke: 5 };

        let cost = (baseCosts[item] || 20000) * tier;
        let turns = (baseTurns[item] || 1) * tier;

        if(state.player.budget < cost) return log("Bütçe yetersiz!", "red");
        if(item === 'nuke' && state.player.uranium < 1) return log("Nükleer üretimi için 1 Uranyum gerekli!", "red");

        state.player.budget -= cost;
        if(item === 'nuke') state.player.uranium--;

        state.player.productionQueue.push({ item: item, tier: tier, turnsLeft: turns });
        log(`🏭 Fabrika Üretime Başladı: ${item.toUpperCase()} (Tier ${tier}) - ${turns} Tur sürecek.`, "#00ccff");
        ui.updateAll();
    },

    diplomacy(action) {
        let target = state.countries[state.selectedID];
        if (state.selectedID === state.playerID) return;

        if(action === 'justify') {
            if(state.player.budget < 25000) return log("Bütçe yetersiz ($25K gerekli).", "red");
            state.player.budget -= 25000;
            target.casusBelli = true;
            log(`🕵️ ${target.name} için casus belli oluşturuldu.`, "#00ccff");
        } 
        else if(action === 'war') {
            target.relation = 0;
            log(`⚔️ ${target.name} ile SAVAŞ BAŞLADI!`, "red");
        } 
        else if(action === 'send_envoy') {
            if(state.player.budget < 15000) return log("Elçi göndermek için 15.000$ gerekli.", "red");
            state.player.budget -= 15000;
            target.relation = Math.min(100, target.relation + 15);
            log(`🕊️ Elçi Gönderildi: ${target.name} ile ilişkiler gelişti (+15).`, "#38bdf8");
        }
        else if(action === 'embargo') {
            target.embargo = !target.embargo;
            if(target.embargo) {
                target.relation -= 10;
                log(`⚖️ AMBARGO: ${target.name} ülkesine ekonomik ambargo uygulandı! Gelirleri kısıldı.`, "#b45309");
            } else {
                log(`⚖️ AMBARGO KALDIRILDI: ${target.name} ile ticaret serbest bırakıldı.`, "#00ff66");
            }
        }
        else if(action === 'cyber_attack') {
            if(state.player.budget < 40000) return log("Siber operasyon için 40.000$ gerekli.", "red");
            state.player.budget -= 40000;
            target.radarJammed = true;
            log(`💻 SİBER SALDIRI: ${target.name} radarları ve HSS ağları çökertildi!`, "#a855f7");
        }
        else if(action === 'sabotage') {
            if(state.player.budget < 30000) return log("Sabotaj için 30.000$ gerekli.", "red");
            state.player.budget -= 30000;
            target.stability = Math.max(20, target.stability - 10);
            log(`🕵️ SABOTAJ: ${target.name} iç istikrarı sarsıldı! İstikrar: %${target.stability}`, "#be123c");
        }
        ui.updateAll();
    },

    launchAttack() {
        let type = document.getElementById("attack-weapon").value;
        let targetCountry = state.countries[state.selectedID];
        let targetCitySelect = document.getElementById("target-city-select");
        let cityIdx = targetCitySelect ? targetCitySelect.value : 0;
        let targetCity = targetCountry.cities[cityIdx] || targetCountry.cities[0];

        if(targetCountry.relation > 20 && state.selectedID !== state.playerID) {
            return log("Önce Savaş İlan etmelisiniz!", "yellow");
        }

        if(type === 'nuke') {
            if(state.player.uranium < 1 && state.player.inventory.nuke < 1) return log("Envanterde nükleer başlık yok!", "red");
            if(state.player.inventory.nuke > 0) state.player.inventory.nuke--;
            else state.player.uranium--;
            state.globalTension = 100;
        } else {
            if(type === 'kara_birligi') {
                if(state.player.manpower < 50000) return log("Yetersiz insan gücü!", "red");
                state.player.manpower -= 50000;
            } else {
                if(!state.player.inventory[type] || state.player.inventory[type] <= 0) {
                    return log(`Envanterde ${type.toUpperCase()} kalmadı! Üretim yapmalısınız.`, "red");
                }
                state.player.inventory[type]--;
            }
        }

        log(`🚀 ${targetCity.name} hedefine ${type.toUpperCase()} sevk edildi!`, "#ff3344");
        let sourceCity = state.countries[state.playerID].cities[0];
        animator.spawnAttack(sourceCity, targetCity, type, state.playerID);
        ui.updateAll();
    },

    nextTurn() {
        state.turn++;
        
        // Ekonomik hesap (Ambargoları hesaba kat)
        let totalIncome = 70000;
        for(let id in state.countries) {
            if(state.countries[id].embargo) totalIncome -= 5000; // Ambargo yiyenler az kazandırır
        }
        state.player.budget += totalIncome + (state.player.stability * 300);

        // Üretim Kuyruğu
        for(let i = state.player.productionQueue.length - 1; i >= 0; i--) {
            let q = state.player.productionQueue[i];
            q.turnsLeft--;
            if(q.turnsLeft <= 0) {
                state.player.inventory[q.item] = (state.player.inventory[q.item] || 0) + 1;
                log(`✅ Üretim Tamamlandı: ${q.item.toUpperCase()} envantere eklendi!`, "#00ff66");
                state.player.productionQueue.splice(i, 1);
            }
        }

        // YAPAY ZEKA SALDIRI MİSİLEMESİ (DÜZELTİLDİ VE GÜÇLENDİRİLDİ)
        for(let id in state.countries) {
            let enemy = state.countries[id];
            if(enemy.relation === 0 && id !== state.playerID) {
                let targetCity = state.countries[state.playerID].cities[Math.floor(Math.random() * 4)];
                let sourceCity = enemy.cities[Math.floor(Math.random() * enemy.cities.length)];
                
                // Yapay zeka rastgele balistik füze veya kara birliği yollar
                let attackType = Math.random() > 0.5 ? 'ballistic' : 'kara_birligi';
                log(`🚨 DÜŞMAN TAARRUZU: ${enemy.name} ülkesi ${targetCity.name} şehrimize ${attackType.toUpperCase()} saldırısı başlattı!`, "red");
                animator.spawnAttack(sourceCity, targetCity, attackType, id);
            }
        }

        ui.updateAll();
    }
};

// ANİMASYON VE HSS MOTORU
const canvas = document.getElementById("animCanvas");
let ctx = canvas ? canvas.getContext("2d") : null;
if (canvas) {
    const resizeCanvas = () => { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; };
    window.addEventListener("resize", resizeCanvas);
    setTimeout(resizeCanvas, 500);
}

let projectiles = [], particles = [];

const animator = {
    spawnAttack(src, tgt, type, attackerID) {
        projectiles.push({
            x: src.x, y: src.y, sx: src.x, sy: src.y, tx: tgt.x, ty: tgt.y,
            prog: 0, speed: type === 'nuke' ? 0.003 : (type === 'kara_birligi' ? 0.0015 : 0.007),
            type: type, tgtCity: tgt, hssHit: false, attackerID: attackerID,
            curve: type === 'kara_birligi' ? (Math.random()-0.5)*10 : (Math.random() - 0.5) * 150
        });
    }
};

function createExplosion(x, y, type) {
    let isNuke = (type === 'nuke');
    if(isNuke) {
        document.body.classList.add("shake-active");
        setTimeout(() => document.body.classList.remove("shake-active"), 1500);
    }
    for(let i=0; i < (isNuke ? 100 : 20); i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * (isNuke ? 12 : 4),
            vy: (Math.random() - 0.5) * (isNuke ? 12 : 4),
            life: 1, decay: isNuke ? 0.01 : 0.04,
            size: isNuke ? Math.random()*5+2 : Math.random()*3+1,
            color: type === 'kara_birligi' ? "#4ade80" : (isNuke ? "#00ff66" : "#ff8800")
        });
    }
}

function gameLoop() {
    if (!ctx) return requestAnimationFrame(gameLoop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for(let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.prog += p.speed;
        p.x = p.sx + (p.tx - p.sx) * p.prog;
        p.y = p.sy + (p.ty - p.sy) * p.prog - Math.sin(p.prog * Math.PI) * p.curve;

        let targetCountry = state.countries[p.tgtCity.owner];

        // --- HSS SAVUNMA KONTROLÜ (KARA BİRLİKLERİ ASLA VURULMAZ!) ---
        if(p.type !== 'kara_birligi' && p.prog > 0.70 && p.prog < 0.80 && !p.hssHit) {
            p.hssHit = true;
            if(!targetCountry.radarJammed && p.tgtCity.hss.current > 0) {
                p.tgtCity.hss.current--;
                let hssInterceptionChance = (p.type === 'nuke') ? 0.15 : 0.30;
                
                if(Math.random() < hssInterceptionChance) {
                    createExplosion(p.x, p.y, 'intercept');
                    log(`🛡️ HSS ENGelledi: ${p.tgtCity.name} hava savunması füzeyi düşürdü!`, "#38bdf8");
                    projectiles.splice(i, 1);
                    continue;
                }
            }
        }

        // Birimi Çiz
        ctx.beginPath();
        if(p.type === 'kara_birligi') {
            ctx.fillStyle = "#4ade80";
            ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        } else {
            ctx.arc(p.x, p.y, p.type === 'nuke' ? 5 : 3, 0, Math.PI*2);
            ctx.fillStyle = p.type === 'nuke' ? "#00ff66" : (p.type === 'gen5_jet' ? "#38bdf8" : "#ff3344");
            ctx.fill();
        }

        // Hedefe Ulaşma
        if(p.prog >= 1) {
            createExplosion(p.tx, p.ty, p.type);
            let damage = p.type === 'nuke' ? 100 : (p.type === 'kara_birligi' ? 30 : 20);
            p.tgtCity.hp = Math.max(0, p.tgtCity.hp - damage);
            
            if(p.tgtCity.hp === 0) {
                p.tgtCity.owner = p.attackerID;
                p.tgtCity.hp = 60;
                ui.buildMap();
                log(`🏳️ ŞEHİR DÜŞTÜ: ${p.tgtCity.name} (${targetCountry.name}) ele geçirildi!`, "#00ff66");
            }
            projectiles.splice(i, 1);
            ui.updateAll();
        }
    }

    // Partiküller
    for(let i = particles.length - 1; i >= 0; i--) {
        let pt = particles[i];
        pt.x += pt.vx; pt.y += pt.vy; pt.life -= pt.decay;
        if(pt.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = pt.life; ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
    }

    requestAnimationFrame(gameLoop);
}

window.onload = () => { ui.init(); gameLoop(); };// --- TAYVUN V8 - KRİZ YÖNETİMİ, İTTİFAKLAR VE YAPAY ZEKA DİPLOMASİSİ ---

// Yeni Diplomatik ve Kriz Sistemleri
const advancedSystem = {
    checkEvents() {
        // Her 4 turda bir rastgele dünya krizi tetikle
        if (state.turn % 4 === 0) {
            let events = [
                {
                    title: "OPEC Petrol Krizi",
                    desc: "Küresel petrol fiyatları fırladı! Bütçeniz etkilendi ancak askeri sanayi kar elde etti.",
                    effect: () => { state.player.budget += 100000; log("🛢️ Kriz: Petrol fiyatları arttı (+100.000$ Bütçe).", "#f59e0b"); }
                },
                {
                    title: "Sınır İhlali Krizi",
                    desc: "Komşu ülkeler hava sahası ihlali nedeniyle geriliyor. Halkın milliyetçi duyguları kabardı.",
                    effect: () => { state.player.stability = Math.min(100, state.player.stability + 10); log("🎯 Kriz: Halkın istikrarı ve devlete bağlılığı arttı (%+10).", "#10b981"); }
                },
                {
                    title: "Siber Casusluk Tehdidi",
                    desc: "Bilinmeyen bir dış güç merkezî sunucularımıza sızmaya çalıştı!",
                    effect: () => { state.player.budget = Math.max(0, state.player.budget - 50000); log("💻 Kriz: Siber savunma onarımı 50.000$ maliyet çıkardı.", "#ef4444"); }
                }
            ];
            let ev = events[Math.floor(Math.random() * events.length)];
            log(`⚠️ JEOPOLİTİK KRİZ: ${ev.title} - ${ev.desc}`, "#facc15");
            ev.effect();
        }
    },

    evaluateAIBehaviors() {
        // Yapay zeka ülkelerin her tur durumunu güncelle ve oyuncuya tepki ver
        for (let id in state.countries) {
            if (id === state.playerID) continue;
            let country = state.countries[id];

            // Eğer ilişkiler sıfırsa ve savaşta değilse otomatik savaş ilan edebilir
            if (country.relation <= 0 && country.relation > -100) {
                // Savaş mantığı zaten ana döngüde işliyor
            }

            // Eğer oyuncunun askeri gücü çok yüksekse yapay zeka barış isteyebilir
            if (country.relation === 0 && country.stability < 40 && Math.random() < 0.3) {
                country.relation = 30;
                log(`🕊️ BARIŞ TEKLİFİ: ${country.name} ağır kayıplar vererek savaşı sonlandırmak istiyor! İlişkiler düzeldi.`, "#38bdf8");
            }
        }
    }
};

// NextTurn fonksiyonuna entegre edilecek ek tetikleyiciler
const originalNextTurn = engine.nextTurn;
engine.nextTurn = function() {
    originalNextTurn.call(this); // Mevcut tur döngüsünü çalıştır
    advancedSystem.checkEvents();
    advancedSystem.evaluateAIBehaviors();
};

log("🌟 Gelişmiş Kriz, Olay ve İttifak Modülü Yüklendi.", "#38bdf8");