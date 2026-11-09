(() => {
  "use strict";
  const D = window.RR_DATA;
  const COMM = (window.RR_COMMUNITY && window.RR_COMMUNITY.items) || {};
  const FAN = window.RR_FAN || { items: {}, cargo: {}, barters: {}, fenceBonus: [], smugglerBonus: [], source: {} };
  const SRC = `<a href="${FAN.source.url || "#"}" target="_blank" rel="noopener" class="src">robrun.info</a>`;
  const $app = document.getElementById("app");
  const LS_KEY = "rrwiki.values.v1";

  /* ---------------- helpers ---------------- */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rich = s => esc(s || "")
    .replace(/&lt;color=[^&]*?&gt;/g, "<b>").replace(/&lt;\/color&gt;/g, "</b>")
    .replace(/&lt;\/?[a-z]+[^&]*?&gt;/gi, "")
    .replace(/\\n|\n/g, "<br>");
  const loc = k => (D.loc[k] && D.loc[k].pt) || "";
  const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fmtMoney = v => "$" + Number(v).toLocaleString("pt-BR");

  const ITEM = Object.fromEntries(D.items.map(i => [i.id, i]));
  const CARGO = Object.fromEntries(D.cargo.map(c => [c.id, c]));
  const BLD = Object.fromEntries(D.buildings.map(b => [b.id, b]));
  // where each item appears
  const SOURCES = {};
  D.buildings.forEach(b => b.rewards.forEach(r => (SOURCES[r] = SOURCES[r] || []).push(b.id)));
  // items with no known source anywhere (game files, robrun.info): unconfirmed leads, shown as such
  const ITEM_HINTS = {
    vial_7: {
      leads: [
        ["cargo", "cargo_medicine", "Caixote de Medicamentos: o jogo diz que contém “muitos medicamentos”, e os outros frascos são da linha médica."],
        ["place", "city_pharmacy_shop_east", "Farmácia (leste): tem a Ampola Medicinal (outro frasco) em destaque."],
        ["place", "city_pharmacy_shop_west", "Farmácia (oeste): tem a Ampola Cosmética (outro frasco) em destaque."],
        ["place", "city_drug_house", "Casa das Drogas: por ser droga ilegal."]
      ]
    }
  };

  const RARITIES = [
    ["common", "Comum"], ["uncommon", "Incomum"], ["rare", "Raro"],
    ["epic", "Épico"], ["legendary", "Lendário"], ["exotic", "Exótico"]
  ];
  const RNAME = Object.fromEntries(RARITIES);

  /* ---------- community / user values ---------- */
  let local = {};
  try { local = JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch (e) { local = {}; }
  const saveLocal = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(local)); } catch (e) {} };
  // fan source value for an item or cargo: {price, priceMax, rarity}
  function fanVal(id) {
    const f = FAN.items[id];
    if (f) return { price: f.sell ?? null, priceMax: null, rarity: f.rarity || null };
    const c = FAN.cargo[id];
    if (c && c.length) {
      const ps = c.map(x => x.price);
      return { price: Math.min(...ps), priceMax: Math.max(...ps) > Math.min(...ps) ? Math.max(...ps) : null, rarity: c[c.length - 1].rarity };
    }
    return { price: null, priceMax: null, rarity: null };
  }
  function vals(id) {
    const c = COMM[id] || {}, l = local[id] || {}, f = fanVal(id);
    const own = l.price ?? c.price ?? null;
    return {
      price: own ?? f.price,
      priceMax: own != null ? null : f.priceMax,
      priceFromFan: own == null && f.price != null,
      rarity: l.rarity ?? c.rarity ?? f.rarity ?? null,
      chances: Object.assign({}, c.chances || {}, l.chances || {})
    };
  }
  const priceHtml = id => {
    const v = vals(id);
    if (v.price == null || v.price === "") return `<span class="unknown">—</span>`;
    return `<span class="pill price">${fmtMoney(v.price)}${v.priceMax ? " – " + fmtMoney(v.priceMax) : ""}</span>`;
  };
  const levelTable = (base, bonuses, who) => `
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Notoriedade</th><th>Bônus</th><th class="num">${esc(who)} paga</th></tr></thead><tbody>
    ${bonuses.map(b => `<tr><td>Nível ${b.level}</td><td class="muted">${b.bonus ? "+" + b.bonus + "%" : "—"}</td><td class="num"><b>${fmtMoney(Math.round(base * (1 + b.bonus / 100)))}</b></td></tr>`).join("")}
    </tbody></table></div>`;
  const rarityHtml = id => {
    const r = vals(id).rarity;
    return r ? `<span class="pill r-${r}">${RNAME[r] || r}</span>` : `<span class="unknown">—</span>`;
  };

  /* ---------- names / links ---------- */
  const bName = b => {
    const n = b.name.pt || b.id;
    const dup = D.buildings.filter(x => x.name.pt === b.name.pt).length > 1;
    return dup ? `${n} (${b.id.replace(/^city_/, "").replace(/_/g, " ")})` : n;
  };
  const itemLink = (id, extra = "") => {
    const i = ITEM[id];
    if (!i) return `<span class="node">${esc(id)}</span>`;
    return `<a class="node ${extra}" href="#/item/${id}"><img src="${i.icon}" alt="" loading="lazy">${esc(i.name.pt)}${i.tier ? ` <small class="muted">#${i.tier}</small>` : ""}</a>`;
  };
  // cargo icons extracted from the game client (img/cargo/<id>.webp); cargos without an icon fall back to 📦
  const CARGO_NO_IMG = new Set();
  const cargoImg = (id, cls = "") => CARGO[id] && !CARGO_NO_IMG.has(id)
    ? `<img ${cls ? `class="${cls}" ` : ""}src="img/cargo/${id}.webp" alt="" loading="lazy">` : "📦";
  const cargoLink = (id, extra = "") => {
    const c = CARGO[id];
    const n = c ? c.name.pt : id;
    return `<a class="node ${extra}" href="#/carga/${id}">${cargoImg(id)} ${esc(n)} <small class="muted">${esc(id.replace(/^cargo_/, ""))}</small></a>`;
  };
  const textNode = (t, ico = "") => `<span class="node">${ico} ${esc(t)}</span>`;
  const arrow = `<span class="arrow">→</span>`;

  /* ---------------- workbenches ---------------- */
  const BENCHES = [
    {
      id: "bancada-de-carga", icon: "cargo_workbench_1", name: "Bancada de Carga",
      kind: "Abertura de cargas", place: "Sua base (terreno)",
      what: "Abre as cargas roubadas (caixotes, cofres, malas, sacos de dinheiro) e libera os itens que estão dentro delas. Cada carga ocupa um espaço da bancada e leva um tempo para abrir.",
      hint: "hints_cargo_open_workbench_description",
      gain: "Os itens de dentro da carga (joias, eletrônicos, álcool, remédios, peças de carro, equipamentos, armas, dinheiro), que depois você vende ao Receptador ou usa em coleções.",
      inputs: [["cargo", "cargo_box"], ["cargo", "cargo_jewelry"], ["cargo", "cargo_minimarket"], ["cargo", "cargo_medicine"], ["cargo", "cargo_carparts"], ["cargo", "cargo_electronics"], ["cargo", "cargo_equip"], ["cargo", "cargo_weapon_box_1"], ["cargo", "cargo_suitcase"], ["cargo", "cargo_suitcase_2"], ["cargo", "cargo_suitcase_3"], ["cargo", "cargo_safe"], ["cargo", "cargo_safe_legendary"], ["cargo", "cargo_cashbag"]],
      outputs: [["text", "Joias"], ["text", "Eletrônicos"], ["text", "Álcool"], ["text", "Medicamentos"], ["text", "Peças de carro"], ["text", "Equipamentos"], ["text", "Peças de arma"], ["item", "cash_1"]],
      outputCats: ["loot"],
      upgrades: [
        ["cargo_workbench_slot_1", "+1 espaço de carga (abre mais cargas ao mesmo tempo)"],
        ["cargo_workbench_toolbox_1", "Acelera a abertura de cargas"],
        ["cargo_workbench_circular_saw_1", "Acelera a abertura + permite abrir malas roubadas"],
        ["cargo_workbench_plasma_cutter_1", "Acelera a abertura + permite abrir cofres roubados"]
      ],
      steps: [
        "Roube uma carga (caixote, cofre, mala…) em um assalto e leve no porta-malas ou carregando.",
        "Na sua base, interaja com a Bancada de Carga e coloque a carga em um espaço livre.",
        "Espere o tempo de abertura (as ferramentas instaladas aceleram).",
        "Vasculhe a carga aberta e pegue os itens. Venda ao Receptador ou junte em coleções."
      ],
      tip: "Malas precisam da Serra de Carga e cofres precisam do Cortador de Plasma. Sem essas melhorias você não consegue abri-los."
    },
    {
      id: "mesa-de-colecoes", icon: "collection_table", name: "Mesa de Coleções",
      kind: "Montagem de coleções", place: "Sua base (terreno)",
      what: "Junta vários itens roubados de uma lista (coleção) e embala tudo num Caixote de Coleção. Uma coleção completa vale mais do que os itens vendidos separados.",
      hint: "hints_craft_workbench_description",
      gain: "Um Caixote de Coleção (Básica, Incomum, Especial ou Única), vendido ao Contrabandista.",
      inputs: [["text", "Itens roubados pedidos pela lista de coleção"]],
      outputs: [["cargo", "collection_reward_cargo"], ["cargo", "collection_reward_cargo_2"], ["cargo", "collection_reward_cargo_3"], ["cargo", "collection_reward_cargo_4"]],
      upgrades: [
        ["collection_upgrade_1", "Libera a lista de Coleção Incomum (adicional)"],
        ["collection_upgrade_2", "Libera a lista de Coleção Especial"],
        ["collection_upgrade_3", "Libera a lista de Coleção Única"]
      ],
      steps: [
        "Abra a Mesa de Coleções e veja a lista de itens pedidos em cada aba (Básica / Incomum / Especial / Única).",
        "Coloque os itens pedidos na mesa.",
        "Com a lista completa, clique em Embalar: você recebe um Caixote de Coleção.",
        "Leve o caixote ao Contrabandista e venda. Use “Atualizar coleção” para trocar a lista."
      ],
      tip: "As abas Incomum, Especial e Única só aparecem depois de instalar o documento de melhoria correspondente."
    },
    {
      id: "bancada-de-contrabando", icon: "cargo_exchange_workbench_1", name: "Bancada de Contrabando",
      kind: "Reembalagem de cargas", place: "Sua base (terreno)",
      what: "Reembala carga contrabandeada danificada numa embalagem bonita. A carga reembalada vale bem mais na venda.",
      hint: "hints_cargo_buyer_description",
      gain: "Carga Premium ou Carga Rara, que vale bem mais ao vender para o Contrabandista.",
      inputs: [["cargo", "cargo_alcohol_grade_1"]],
      outputs: [["cargo", "cargo_alcohol_grade_2"], ["cargo", "cargo_alcohol_grade_3"]],
      upgrades: [
        ["cargo_exchange_workbench_speedup_upgrade_1", "Impressora de Etiquetas: acelera a reembalagem"],
        ["cargo_exchange_workbench_speedup_upgrade_2", "Impressora de Etiquetas melhor: acelera mais"],
        ["cargo_exchange_workbench_additional_slot_upgrade", "Caixa de Ferramentas: +1 espaço de carga"],
        ["cargo_exchange_workbench_additional_double_slot_upgrade", "Caixa de Ferramentas: +2 espaços de carga"]
      ],
      steps: [
        "Compre Carga Contrabandeada do Lenny ou no Centro de Vendas.",
        "Coloque na Bancada de Contrabando para reembalar.",
        "Espere o processo e pegue a Carga Premium ou Rara.",
        "Venda no Furgão do Contrabandista. O bônus de venda depende do local e da sua notoriedade."
      ],
      tip: "O resultado pode sair Premium ou Rara. A Rara vale mais."
    },
    {
      id: "mesa-de-lavagem", icon: "money_workbench_speedup_1", name: "Mesa de Lavagem de Dinheiro",
      kind: "Lavagem de dinheiro", place: "Sua base (terreno)",
      what: "Converte dinheiro sujo em créditos limpos na sua conta bancária. Dinheiro na conta não pode ser roubado.",
      hint: "hints_money_workbench_description",
      gain: "Créditos (dinheiro limpo) transferidos para sua conta bancária, protegidos de roubo.",
      inputs: [["item", "cash_1"]],
      outputs: [["text", "Créditos na conta bancária", "🏦"]],
      upgrades: [
        ["money_workbench_speedup_1", "Contador de Cédulas: acelera a lavagem"],
        ["money_workbench_speedup_2", "Contador de Cédulas (melhor): acelera mais"],
        ["money_workbench_speedup_3", "Contador de Cédulas (máximo): acelera mais ainda"]
      ],
      steps: [
        "Abra uma conta no Banco de Looty Bay (sem conta a mesa fica bloqueada).",
        "Deposite seu dinheiro sujo no armazenamento da mesa.",
        "Clique em Iniciar lavagem. A velocidade aparece por hora.",
        "Pegue as cédulas limpas e clique em Transferir para minha conta."
      ],
      tip: "No Motel do Lenny você também lava dinheiro, mas o Lenny cobra uma taxa. Na sua base não tem taxa. A velocidade sobe com os módulos, com o volume depositado e com o Controle (territórios)."
    },
    {
      id: "reator-quimico", icon: "cargo_production_workbench_1", name: "Reator Químico",
      kind: "Produção (laboratório)", place: "Laboratório Químico na sua base",
      what: "Sintetiza reagentes num líquido concentrado (Concentrado Cristalino). É o primeiro passo da cadeia do laboratório.",
      hint: "hints_lab_workbench_description",
      gain: "Concentrado Cristalino. A qualidade (1, 2 ou 3) depende da sorte e das melhorias instaladas.",
      building: "meth_lab_1",
      tiers: ["cargo_production_workbench_1", "cargo_production_workbench_2", "cargo_production_workbench_3"],
      inputs: [["text", "Reagentes", "🧪"], ["cargo", "cargo_reagents_2"]],
      outputs: [["cargo", "cargo_soft_crystal_1"], ["cargo", "cargo_soft_crystal_2"], ["cargo", "cargo_soft_crystal_3"]],
      upgrades: [
        ["cargo_production_workbench_upgrade_engine_1", "Motor Industrial: aumenta um pouco a chance de cristais de qualidade maior"],
        ["cargo_production_workbench_upgrade_thermometer_1", "Termômetro Industrial: aumenta bastante a chance de qualidade maior"],
        ["cargo_production_workbench_upgrade_converter_1", "Conversor Químico: aumenta muito a chance de qualidade maior"]
      ],
      steps: [
        "Construa o Laboratório Químico na sua base e coloque um Reator Químico.",
        "Adicione reagentes (Reagentes de Qualidade dão cristais melhores).",
        "Espere a produção. A fumaça em cima do prédio mostra que o laboratório está ativo e outros jogadores podem ver.",
        "Pegue o Concentrado Cristalino e leve para o Freezer Industrial."
      ],
      tip: "Se você mover o reator no meio da produção, a carga cai no chão e o reagente que estava no reator é perdido. Reatores Mk2 e Mk3 produzem mais e mais rápido."
    },
    {
      id: "freezer-industrial", icon: "cargo_charge_workbench_lab_freezer_1", name: "Freezer Industrial",
      kind: "Carregamento (congelamento)", place: "Laboratório Químico na sua base",
      what: "Congela o Concentrado Cristalino para estabilizar a estrutura e transformá-lo em Cristais Sólidos.",
      hint: "cargo_charge_workbench_lab_freezer_1_description",
      gain: "Cristais Sólidos, que já valem dinheiro ou podem ir para a Mesa de Laboratório.",
      building: "meth_lab_1",
      tiers: ["cargo_charge_workbench_lab_freezer_1", "cargo_charge_workbench_lab_freezer_2", "cargo_charge_workbench_lab_freezer_3"],
      inputs: [["cargo", "cargo_soft_crystal_1"], ["cargo", "cargo_soft_crystal_2"], ["cargo", "cargo_soft_crystal_3"]],
      outputs: [["cargo", "cargo_hard_crystal_1"], ["cargo", "cargo_hard_crystal_2"], ["cargo", "cargo_hard_crystal_3"]],
      upgrades: [
        ["cargo_charge_workbench_upgrade_evaporator_1", "Evaporador Melhorado: congela mais rápido"],
        ["cargo_charge_workbench_upgrade_refrigerant_1", "Refrigerante de Qualidade: congela mais rápido"]
      ],
      steps: [
        "Coloque o Concentrado Cristalino no freezer.",
        "Espere o congelamento (melhorias aceleram).",
        "Pegue os Cristais Sólidos e venda, ou leve para a Mesa de Laboratório."
      ],
      tip: "A qualidade do concentrado (1, 2, 3) é mantida no cristal."
    },
    {
      id: "mesa-de-laboratorio", icon: "cargo_workbench_lab_table_1", name: "Mesa de Laboratório",
      kind: "Processamento final", place: "Laboratório Químico na sua base",
      what: "Tritura e embala os Cristais Sólidos em Pó Cristalino para venda no varejo. É o último passo da cadeia do laboratório.",
      hint: "cargo_open_workbench_lab_table_1_description",
      gain: "Pó Cristalino (qualidades 1, 2 e 3), o produto final do laboratório.",
      building: "meth_lab_1",
      inputs: [["cargo", "cargo_hard_crystal_1"], ["cargo", "cargo_hard_crystal_2"], ["cargo", "cargo_hard_crystal_3"]],
      outputs: [["item", "lab_crystal_1"], ["item", "lab_crystal_2"], ["item", "lab_crystal_3"]],
      upgrades: [
        ["cargo_open_workbench_upgrade_additional_slot_2", "Balança de Laboratório: +1 espaço para processar mais cristais"]
      ],
      steps: [
        "Coloque os Cristais Sólidos na mesa.",
        "Espere o processamento.",
        "Pegue o Pó Cristalino e venda."
      ],
      tip: "Ao pegar um Saco de Pólvora produzido no laboratório, você enche o Conjunto de Frascos de Laboratório (item cumulativo). Cheio, ele vale muito mais."
    },
    {
      id: "mesa-de-cultivo", icon: "cargo_charge_workbench_garden_bed", name: "Mesa de Cultivo",
      kind: "Carregamento (cultivo)", place: "Sala de Cultivo na sua base",
      what: "Cultiva plantas grandes. Você coloca um Arbusto Florido, ele cresce até virar um Arbusto Maduro, e a colheita rende Pacotes de Colheita.",
      hint: "cargo_charge_workbench_garden_bed_description",
      gain: "Pacote de Colheita, que dá mais lucro vendido no atacado.",
      building: "narco_farm_1",
      inputs: [["cargo", "cargo_bush_growing_1"]],
      middle: [["cargo", "cargo_bush_mature_1"]],
      outputs: [["item", "bush_drugs_1"], ["item", "bush_drugs_2"], ["item", "bush_drugs_3"]],
      upgrades: [
        ["uv_lamp_3", "Lâmpada UV: aumenta a velocidade de crescimento"],
        ["water_pump_2", "Bomba d'Água: aumenta a velocidade de crescimento"],
        ["fan_1", "Ventilador: aumenta a velocidade de crescimento"]
      ],
      steps: [
        "Construa a Sala de Cultivo e coloque a Mesa de Cultivo.",
        "Coloque o Arbusto Florido na mesa.",
        "Espere crescer (lâmpada, bomba e ventilador aceleram).",
        "Colha o Arbusto Maduro e pegue os Pacotes de Colheita."
      ],
      tip: "Se não houver nada pronto, aparece “Nada para coletar”."
    }
  ];
  const BENCH = Object.fromEntries(BENCHES.map(b => [b.id, b]));
  // reverse index: item/cargo id -> benches that use/produce it
  const USEDBY = {}, MADEBY = {}, UPGRADEOF = {};
  BENCHES.forEach(b => {
    (b.inputs || []).forEach(([t, id]) => t !== "text" && (USEDBY[id] = USEDBY[id] || []).push(b.id));
    [...(b.outputs || []), ...(b.middle || [])].forEach(([t, id]) => t !== "text" && (MADEBY[id] = MADEBY[id] || []).push(b.id));
    (b.upgrades || []).forEach(([id]) => (UPGRADEOF[id] = UPGRADEOF[id] || []).push(b.id));
    [b.icon, ...(b.tiers || [])].forEach(id => (UPGRADEOF["__bench_" + id] = b.id));
  });
  const nodeOf = ([t, id, ico]) => t === "item" ? itemLink(id) : t === "cargo" ? cargoLink(id) : textNode(id, ico || "•");

  /* ---------------- NPCs ---------------- */
  const NPCS = [
    { id: "receptador", name: "Receptador (Fence)", ico: "🕴️", text: "hints_trader_description", extra: "Compra os itens roubados (joias, eletrônicos, álcool…) por dinheiro sujo. O valor sobe com seu nível de notoriedade e com o bônus do local de venda.", sells: "Itens roubados" },
    { id: "contrabandista", name: "Contrabandista (Furgão)", ico: "🚐", text: "hints_cargo_seller_description", extra: "Compra cargas: contrabando, cargas reembaladas e Caixotes de Coleção. O lucro depende da quantidade, do valor da carga, do local e da notoriedade.", sells: "Cargas" },
    { id: "lenny", name: "Lenny (Motel do Lenny)", ico: "🍸", text: "laundering_trader_info_description", extra: "Barman do covil. Vende Carga Contrabandeada, lava dinheiro cobrando uma taxa e oferece vários serviços.", sells: "Serviços" },
    { id: "porta", name: "Porta Suspeita (Escambo)", ico: "🚪", text: "codex_barter_description", extra: "Troca seus itens por equipamento de assalto: perfuratrizes, chaves e outras ferramentas.", sells: "Troca" },
    { id: "mercado", name: "Mercado Clandestino / Remessas", ico: "💻", text: "codex_vendor_tree_description", extra: "Pelo laptop você desbloqueia Remessas, que liberam armas, veículos e itens para comprar no Mercado Clandestino. Algumas exigem tempo de prisão ou morar em assentamento de nível alto.", sells: "Compra" },
    { id: "banco", name: "Banco / Caixas eletrônicos", ico: "🏦", text: "codex_cash_withdrawal_description", extra: "Abra uma conta para usar a Mesa de Lavagem. Saque créditos como dinheiro sujo com funcionários do banco ou em caixas eletrônicos.", sells: "Saque" }
  ];

  /* ---------------- views ---------------- */
  function setNav(name) {
    document.querySelectorAll(".mainnav a").forEach(a => a.classList.toggle("active", a.dataset.nav === name));
    document.getElementById("mainnav").classList.remove("open");
  }

  function viewHome() {
    setNav("");
    const nPrice = Object.keys(Object.assign({}, COMM, local)).filter(k => vals(k).price != null).length;
    $app.innerHTML = `
      <section class="hero">
        <h1>ROB RUN Wiki</h1>
        <p>Enciclopédia de fã montada direto dos arquivos do jogo, com todos os itens e ícones originais, as mesas de produção e o que cada uma faz, os locais onde cada item aparece, as cargas, os NPCs e o guia do Códice. Os textos são os oficiais em português.</p>
        <div class="stats">
          <div class="stat"><b>${D.items.length}</b>itens</div>
          <div class="stat"><b>${BENCHES.length}</b>mesas</div>
          <div class="stat"><b>${D.buildings.filter(b => b.rewards.length).length}</b>locais de saque</div>
          <div class="stat"><b>${D.cargo.length}</b>cargas</div>
          <div class="stat"><b>${nPrice}</b>preços preenchidos</div>
        </div>
      </section>
      <div class="grid wide">
        ${[["#/itens", "🎒", "Itens", "Todos os itens com ícone, descrição, categoria, preço e locais."],
           ["#/cargas", "📦", "Cargas", "Caixotes, cofres, malas e produtos do laboratório."],
           ["#/locais", "🗺️", "Locais", "Prédios de Looty Bay e o saque de cada um."],
           ["#/mesas", "🧪", "Negócios", "Laboratório, cultivo e as mesas da sua base, com tutorial passo a passo."],
           ["#/npcs", "🕴️", "NPCs e Venda", "Para quem vender cada coisa."],
           ["#/guia", "📖", "Guia", "Códice, efeitos e dicas oficiais do jogo."]]
          .map(([h, i, t, d]) => `<a class="card" href="${h}"><div class="tile-ico">${i}</div><div class="title">${t}</div><div class="sub">${d}</div></a>`).join("")}
      </div>`;
  }

  const RRANK = Object.fromEntries(RARITIES.map(([k], i) => [k, i + 1]));
  let itemState = { q: "", cat: "all", sort: "rarity" };
  function viewItems() {
    setNav("itens");
    const counts = {};
    D.items.forEach(i => counts[i.cat] = (counts[i.cat] || 0) + 1);
    const cats = Object.keys(D.categories).filter(c => counts[c]);
    $app.innerHTML = `
      <h1>Itens</h1>
      <div class="toolbar">
        <input id="iq" type="search" placeholder="Filtrar por nome…" value="${esc(itemState.q)}">
        <select id="isort">
          <option value="rarity">Ordenar: Qualidade (mais raro)</option>
          <option value="name">Ordenar: Nome</option>
          <option value="price">Ordenar: Preço (maior)</option>
          <option value="cat">Ordenar: Categoria</option>
          <option value="src">Ordenar: Nº de locais</option>
        </select>
      </div>
      <div class="with-side">
        <aside class="sidebar" id="ichips">
          <div class="side-title">Categorias</div>
          <button class="chip ${itemState.cat === "all" ? "on" : ""}" data-c="all">Todos<span class="n">${D.items.length}</span></button>
          ${cats.map(c => `<button class="chip ${itemState.cat === c ? "on" : ""}" data-c="${c}">${D.categories[c]}<span class="n">${counts[c]}</span></button>`).join("")}
        </aside>
        <div class="grid" id="igrid"></div>
      </div>`;
    const $g = document.getElementById("igrid");
    const sortSel = document.getElementById("isort");
    sortSel.value = itemState.sort;
    const draw = () => {
      const q = norm(itemState.q);
      let list = D.items.filter(i => (itemState.cat === "all" || i.cat === itemState.cat) &&
        (!q || norm(i.name.pt + " " + i.name.en + " " + i.id).includes(q)));
      const s = itemState.sort;
      list.sort((a, b) =>
        s === "rarity" ? (RRANK[vals(b.id).rarity] || 0) - (RRANK[vals(a.id).rarity] || 0) ||
          (vals(b.id).price ?? -1) - (vals(a.id).price ?? -1) || a.name.pt.localeCompare(b.name.pt) :
        s === "price" ? (vals(b.id).price ?? -1) - (vals(a.id).price ?? -1) :
        s === "cat" ? D.categories[a.cat].localeCompare(D.categories[b.cat]) || a.name.pt.localeCompare(b.name.pt) :
        s === "src" ? (SOURCES[b.id] || []).length - (SOURCES[a.id] || []).length :
        a.name.pt.localeCompare(b.name.pt) || (a.tier || 0) - (b.tier || 0));
      $g.innerHTML = list.map(i => {
        const r = vals(i.id).rarity;
        const src = (SOURCES[i.id] || []).length;
        return `<a class="card ${r ? "r-" + r : ""}" href="#/item/${i.id}">
          <div class="thumb"><img src="${i.icon}" alt="" loading="lazy"></div>
          <div class="title">${esc(i.name.pt)}${i.tier ? ` <small class="muted">#${i.tier}</small>` : ""}</div>
          <div class="sub">${esc(D.categories[i.cat])}${src ? ` · 📍${src} ${src > 1 ? "locais" : "local"}` : ""}</div>
          <div class="meta">${priceHtml(i.id)}${r ? rarityHtml(i.id) : ""}</div>
        </a>`;
      }).join("") || `<p class="muted">Nenhum item encontrado.</p>`;
    };
    document.getElementById("iq").oninput = e => { itemState.q = e.target.value; draw(); };
    sortSel.onchange = e => { itemState.sort = e.target.value; draw(); };
    document.getElementById("ichips").onclick = e => {
      const b = e.target.closest(".chip"); if (!b) return;
      itemState.cat = b.dataset.c;
      document.querySelectorAll("#ichips .chip").forEach(x => x.classList.toggle("on", x === b));
      draw();
    };
    draw();
  }

  function viewItem(id) {
    setNav("itens");
    const i = ITEM[id];
    if (!i) return notFound();
    const v = vals(id);
    const F = FAN.items[id];
    const TAGS = { destaque: "⭐ Destaque", fixo: "📌 Ponto fixo", sorteio: "🎲 Sorteado" };
    const where = D.buildings.map(b => [b.id, placeLoot(b.id)[id]]).filter(([, t]) => t);
    const srcs = where.map(([b]) => b);
    const hint = ITEM_HINTS[id];
    const used = USEDBY[id] || [], made = MADEBY[id] || [], upg = UPGRADEOF[id] || [];
    const benchOf = UPGRADEOF["__bench_" + id];
    const variants = D.items.filter(x => x.id !== id && x.name.pt === i.name.pt);
    $app.innerHTML = `
      <div class="crumbs"><a href="#/itens">Itens</a> › ${esc(D.categories[i.cat])} › ${esc(i.name.pt)}</div>
      <div class="detail">
        <div class="art"><img src="${i.icon}" alt="${esc(i.name.pt)}"></div>
        <div>
          <h1>${esc(i.name.pt)}${i.tier ? ` <small class="muted">#${i.tier}</small>` : ""}</h1>
          <p class="en">${esc(i.name.en)}</p>
          <div class="panel"><p class="desc">${rich(i.desc.pt) || '<span class="unknown">Sem descrição no jogo.</span>'}</p></div>
          <div class="panel">
            <div class="row" style="justify-content:space-between"><h3 style="margin:0">Informações</h3><button class="btn small" id="btnEdit">✏️ Editar valores</button></div>
            <dl class="kv" style="margin-top:12px">
              <dt>Categoria</dt><dd>${esc(D.categories[i.cat])}</dd>
              <dt>Raridade</dt><dd>${rarityHtml(id)}</dd>
              <dt>Venda ao Receptador</dt><dd>${priceHtml(id)} ${v.priceFromFan ? `<small class="muted">nível 1 · fonte ${SRC}</small>` : ""}</dd>
              ${F && F.base ? `<dt>Preço base</dt><dd>${fmtMoney(F.base)} <small class="muted">(a venda paga ${Math.round((F.sellMult || 0.4) * 100)}% disso)</small></dd>` : ""}
              ${F && F.stack ? `<dt>Pilha</dt><dd>${F.stack} por espaço</dd>` : ""}
              <dt>Variante / nível</dt><dd>${i.tier ? "#" + i.tier : "—"}</dd>
            </dl>
            ${v.price == null ? `<div class="note">Este item não tem preço de venda (não pode ser vendido ao Receptador, ou o valor não é público).</div>` : ""}
          </div>
          ${F && F.sell ? `<div class="panel"><h3>Quanto o Receptador paga</h3>${levelTable(F.sell, FAN.fenceBonus, "Receptador")}
            <p class="muted" style="font-size:.85rem">Preço × (1 + bônus do nível de notoriedade). Bônus do jogo via ${SRC}; o bônus de área de venda não está incluído.</p></div>` : ""}
          <div class="panel">
            <h3>Onde encontrar</h3>
            ${srcs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Local</th><th>Tipo</th><th>Como sai</th><th class="num">Chance de drop</th></tr></thead><tbody>
              ${where.map(([b, t]) => `<tr><td><a href="#/local/${b}">${esc(bName(BLD[b]))}</a></td><td class="muted">${esc(BLD[b].size.pt)}</td><td>${[...t].map(x => TAGS[x]).join(" · ")}</td>
              <td class="num">${v.chances[b] != null && v.chances[b] !== "" ? `<b class="hl">${v.chances[b]}%</b>` : '<span class="unknown">não divulgada</span>'}</td></tr>`).join("")}
              </tbody></table></div>
              <p class="muted" style="font-size:.85rem">⭐ destaque do mapa do jogo · 📌 ponto fixo · 🎲 pode sair num ponto sorteado daquele tipo (pontos de saque: ${SRC}, mapa). A % de drop não é pública (o servidor sorteia). Se você medir, preencha em <b>Editar valores</b>.</p>`
            : hint ? `<p style="margin:0 0 6px"><b>Pistas (não confirmadas):</b></p>
              <ul class="hint-list">${hint.leads.map(([k, ref, txt]) => `<li>${k === "cargo" ? `<a href="#/carga/${ref}">${esc(CARGO[ref].name.pt)}</a>` :`<a href="#/local/${ref}">${esc(bName(BLD[ref]))}</a>`}<span class="muted"> ${esc(txt.replace(/^[^:]+:\s*/, ""))}</span></li>`).join("")}</ul>`
            : (F && (F.points.length || F.buys.length || F.barters.length)) ? `<p class="muted">Não aparece no saque dos prédios, mas tem outras fontes abaixo.</p>`
            : `<p class="muted">Não aparece no saque de nenhum prédio. Pode vir de cargas abertas, produção, recompensas ou outros meios.</p>`}
          </div>
          ${F && F.points.length ? `<div class="panel"><h3>Pontos de saque fixos</h3>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Prédio</th><th>Região</th><th>Ponto</th><th class="num">Qtd. por ponto</th><th class="num">Nº de pontos</th><th class="num">Chance de aparecer</th></tr></thead><tbody>
            ${F.points.map(p => `<tr><td>${esc(p.building)}</td><td class="muted">${esc(p.region)}</td><td>${esc(p.spot)}</td><td class="num">${p.min === p.max ? p.min : p.min + "–" + p.max}</td><td class="num">${p.count}</td>
              <td class="num">${p.spawn != null ? `<b class="hl">${Math.round(p.spawn * 100)}%</b>` : '<span class="unknown">—</span>'}</td></tr>`).join("")}
            </tbody></table></div><p class="muted" style="font-size:.85rem">Pontos decodificados do jogo por ${SRC}. A chance é a probabilidade do ponto ter saque.</p></div>` : ""}
          ${F && F.buys.length ? `<div class="panel"><h3>Onde comprar</h3>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vendedor</th><th class="num">Preço</th><th>Condições</th></tr></thead><tbody>
            ${F.buys.map(b => `<tr><td>${esc(b.vendorPt)}</td><td class="num">${b.price != null ? `<b>${fmtMoney(b.price)}</b>` : "—"}</td>
              <td class="muted">${[b.citizensOnly ? "só civis" : "", b.needsUnlock ? `precisa desbloquear Remessa${b.unlockCash ? " (" + fmtMoney(b.unlockCash) + ")" : ""}` : "", b.tier ? "tier " + b.tier : "", b.years ? b.years + " anos de prisão" : ""].filter(Boolean).join(" · ") || "—"}</td></tr>`).join("")}
            </tbody></table></div><p class="muted" style="font-size:.85rem">Preço = preço base × multiplicador do vendedor. Fonte: ${SRC}. O preço de desbloqueio pode mudar por servidor.</p></div>` : ""}
          ${F && (F.barters.length || F.usedInBarters.length) ? `<div class="panel"><h3>Troca na Porta Suspeita</h3>
            ${[...F.barters, ...F.usedInBarters].filter((x, k, a) => a.indexOf(x) === k).map(rid => { const r = FAN.barters[rid]; if (!r) return "";
              return `<div class="flow">${r.ingredients.map(g => g.id === "cash_1" ? textNode(fmtMoney(g.amount), "💵") : itemLink(g.id).replace("</a>", ` ×${g.amount}</a>`)).join(" + ")}${arrow}${itemLink(r.result, "bench")}</div>`; }).join("")}
          </div>` : ""}
          ${benchOf ? `<div class="panel"><h3>É uma mesa</h3><div class="flow"><a class="node bench" href="#/mesa/${benchOf}">🛠️ Ver como funciona: ${esc(BENCH[benchOf].name)}</a></div></div>` : ""}
          ${upg.length ? `<div class="panel"><h3>Melhoria de mesa</h3><div class="flow">${upg.map(b => `<a class="node bench" href="#/mesa/${b}">🛠️ ${esc(BENCH[b].name)}</a>`).join("")}</div>
            <p>${esc(BENCH[upg[0]].upgrades.find(u => u[0] === id)[1])}</p></div>` : ""}
          ${made.length ? `<div class="panel"><h3>Produzido em</h3><div class="flow">${made.map(b => `<a class="node bench" href="#/mesa/${b}">🛠️ ${esc(BENCH[b].name)}</a>`).join("")}</div></div>` : ""}
          ${used.length ? `<div class="panel"><h3>Usado em</h3><div class="flow">${used.map(b => `<a class="node bench" href="#/mesa/${b}">🛠️ ${esc(BENCH[b].name)}</a>`).join("")}</div></div>` : ""}
          ${variants.length ? `<div class="panel"><h3>Outras variantes</h3><div class="flow">${variants.map(x => itemLink(x.id)).join("")}</div></div>` : ""}
        </div>
      </div>`;
    document.getElementById("btnEdit").onclick = () => editValues(id, srcs);
  }

  function viewBenches() {
    setNav("mesas");
    $app.innerHTML = `
      <h1>Negócios</h1>
      <div class="guide-heroes">
        <div class="gh-col">
          <a class="guide-hero lab" href="#/laboratorio">
            <img src="${ITEM.meth_lab_1 ? ITEM.meth_lab_1.icon : "img/cargo/cargo_hard_crystal_3.webp"}" alt="">
            <div><div class="gh-kicker">Tutorial</div><div class="gh-title">Laboratório Químico</div>
            <div class="gh-sub">Dos reagentes ao Saco de Pólvora: reator, freezer e mesa de laboratório, passo a passo.</div></div>
          </a>
          <button class="time-btn" data-times="lab">⏱️ Tempo <span class="muted">· produção e melhorias</span></button>
        </div>
        <div class="gh-col">
          <a class="guide-hero farm" href="#/cultivo">
            <img src="${ITEM.narco_farm_1 ? ITEM.narco_farm_1.icon : "img/cargo/cargo_bush_mature_1.webp"}" alt="">
            <div><div class="gh-kicker">Tutorial</div><div class="gh-title">Sala de Cultivo</div>
            <div class="gh-sub">Do Arbusto Florido ao Pacote de Colheita: mesa de cultivo e melhorias, passo a passo.</div></div>
          </a>
          <button class="time-btn" data-times="farm">⏱️ Tempo <span class="muted">· cultivo e melhorias</span></button>
        </div>
      </div>
      <h2>Todas as mesas</h2>
      <div class="grid wide">
        ${BENCHES.map(b => `<a class="card" href="#/mesa/${b.id}">
          <div class="thumb"><img src="${ITEM[b.icon].icon}" alt="" loading="lazy"></div>
          <div class="title">${esc(b.name)}</div>
          <div class="sub">${esc(b.kind)} · ${esc(b.place)}</div>
          <div>${esc(b.what)}</div>
        </a>`).join("")}
      </div>`;
    $app.querySelectorAll("[data-times]").forEach(btn => btn.onclick = () => showTimes(btn.dataset.times));
  }

  /* ---------- production times (robrun.info item stats) ---------- */
  const fmtSec = s => {
    if (s < 60 && Math.abs(s - Math.round(s)) > .05) return String(Math.round(s * 10) / 10).replace(".", ",") + " s";
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h ? `${h} h ${String(m).padStart(2, "0")} min` : m ? `${m} min${r ? ` ${String(r).padStart(2, "0")} s` : ""}` : `${r} s`;
  };
  const pct = b => "+" + String(Math.round(b * 1000) / 10).replace(".", ",") + "%";
  const tImg = id => ITEM[id] ? `<img src="${ITEM[id].icon}" alt="" class="t-ico">` : "";
  const tName = id => ITEM[id] ? `<a href="#/item/${id}">${esc(ITEM[id].name.pt)}</a>` : esc(id);
  // rows: [label html, total bonus]; base: seconds per tick
  // key: enables the "Tempo total" column, fed by the total time (no upgrades) typed by the player
  const boostTable = (base, rows, key, what) => `
    ${key ? `<div class="t-total-in"><label for="tt_${key}">⏱️ Tempo total ${what} <b>sem melhorias</b>, como aparece no jogo:</label>
      <span><input id="tt_${key}" data-total="${key}" type="text" inputmode="numeric" placeholder="ex.: 45:00" autocomplete="off"> <small class="muted">min:seg</small></span></div>` : ""}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Melhorias instaladas</th><th class="num">Velocidade</th><th class="num">Tempo por tick</th>${key ? '<th class="num">Tempo total</th>' : ""}<th class="num">Economia</th></tr></thead><tbody>
    ${rows.map(([lab, b]) => `<tr${b === rows[rows.length - 1][1] && b ? ' class="t-best"' : ""}><td>${lab}</td><td class="num">${b ? pct(b) : "—"}</td><td class="num">${fmtSec(base / (1 + b))}</td>${key ? `<td class="num"><b data-tt="${key}" data-b="${b}">—</b></td>` : ""}<td class="num">${b ? `−${Math.round((1 - 1 / (1 + b)) * 100)}%` : "—"}</td></tr>`).join("")}
    </tbody></table></div>`;
  // "45", "45:30", "1:05:00" → seconds (a single number = minutes)
  const parseDur = v => {
    const p = String(v || "").trim().replace(",", ".").split(":").map(Number);
    if (!p.length || p.some(isNaN) || !p[0] && p.length === 1) return null;
    const s = p.length === 1 ? p[0] * 60 : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
    return s > 0 ? s : null;
  };
  function wireTotals(root) {
    root.querySelectorAll("[data-total]").forEach(inp => {
      const key = inp.dataset.total, sk = "rr_total_" + key;
      const draw = () => {
        const s = parseDur(inp.value);
        root.querySelectorAll(`[data-tt="${key}"]`).forEach(el => el.textContent = s ? fmtSec(s / (1 + Number(el.dataset.b))) : "—");
      };
      try { inp.value = localStorage.getItem(sk) || ""; } catch (e) {}
      inp.addEventListener("input", () => { try { localStorage.setItem(sk, inp.value); } catch (e) {} draw(); });
      draw();
    });
  }
  const TIMES = {
    lab: () => {
      const R = [["cargo_production_workbench_1", 900, 4], ["cargo_production_workbench_2", 530, 6], ["cargo_production_workbench_3", 337, 8]];
      const ev = "cargo_charge_workbench_upgrade_evaporator_1", rf = "cargo_charge_workbench_upgrade_refrigerant_1";
      return `
        <h3>${tImg("cargo_production_workbench_1")} Reator Químico</h3>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Versão</th><th class="num">Ciclo</th><th class="num">Ciclos</th><th class="num">Tempo do lote</th></tr></thead><tbody>
        ${R.map(([id, c, n], k) => `<tr${k === 2 ? ' class="t-best"' : ""}><td>${tImg(id)} ${tName(id)} <small class="muted">Mk${k + 1}</small></td><td class="num">${fmtSec(c)}</td><td class="num">${n}</td><td class="num"><b>${fmtSec(c * n)}</b></td></tr>`).join("")}
        </tbody></table></div>
        <p class="muted t-note">O Motor Industrial, o Termômetro Industrial e o Conversor Químico <b>não mudam o tempo</b> do reator: eles só aumentam a chance de sair qualidade maior.</p>
        <h3>${tImg("cargo_charge_workbench_lab_freezer_1")} Freezer Industrial</h3>
        <p class="t-note">Tick de <b>6 min</b> · 4 espaços de carga · coleta em 5 s.</p>
        ${boostTable(360, [["Sem melhoria", 0], [`${tImg(ev)} ${tName(ev)}`, .117], [`${tImg(rf)} ${tName(rf)}`, .13], [`${tImg(ev)}${tImg(rf)} As duas juntas`, .247]], "freezer", "para congelar")}
        <h3>${tImg("cargo_workbench_lab_table_1")} Mesa de Laboratório</h3>
        <p class="t-note">2 espaços (3 com a ${tName("cargo_open_workbench_upgrade_additional_slot_2")}). O tempo de embalagem não é divulgado.</p>`;
    },
    farm: () => {
      const f = "fan_1", w = "water_pump_2", u = "uv_lamp_3";
      return `
        <h3>${tImg("cargo_charge_workbench_garden_bed")} Mesa de Cultivo</h3>
        <p class="t-note">Tick de <b>36 s</b> · 6 espaços para plantas · coleta em 5 s. Cada tick faz a planta avançar no crescimento.</p>
        ${boostTable(36, [["Sem melhoria", 0], [`${tImg(f)} ${tName(f)}`, .12], [`${tImg(w)} ${tName(w)}`, .14], [`${tImg(u)} ${tName(u)}`, .24],
          [`${tImg(f)}${tImg(w)} Ventilador + Bomba`, .26], [`${tImg(f)}${tImg(u)} Ventilador + Lâmpada`, .36], [`${tImg(w)}${tImg(u)} Bomba + Lâmpada`, .38],
          [`${tImg(f)}${tImg(w)}${tImg(u)} Todas as três`, .5]], "farm", "da planta")}
        <p class="muted t-note">O jogo não divulga quantos ticks a planta precisa para amadurecer: digite acima o tempo total que aparece no relógio da mesa (sem melhorias) e a coluna <b>Tempo total</b> calcula na hora quanto fica com cada melhoria. Com as três, cai para 2/3 do normal.</p>`;
    }
  };
  function showTimes(kind) {
    const dlg = document.createElement("dialog");
    dlg.className = "time-dlg";
    dlg.innerHTML = `
      <div class="t-head"><h2 style="margin:0">⏱️ Tempos · ${kind === "lab" ? "Laboratório Químico" : "Sala de Cultivo"}</h2><button class="btn small" data-close>✕</button></div>
      ${TIMES[kind]()}
      <p class="muted t-note" style="margin-top:14px">Tempos e bônus: ${SRC} (dados do jogo). Com melhorias: tempo ÷ (1 + soma dos bônus).</p>`;
    document.body.appendChild(dlg);
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.querySelector("[data-close]").onclick = close;
    dlg.addEventListener("click", e => { if (e.target === dlg) close(); });
    dlg.addEventListener("cancel", () => setTimeout(() => dlg.remove(), 0));
    dlg.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
    wireTotals(dlg);
    dlg.showModal();
  }

  function viewBench(id) {
    setNav("mesas");
    const b = BENCH[id];
    if (!b) return notFound();
    const outIds = (b.outputs || []).filter(o => o[0] !== "text").map(o => o[1]);
    $app.innerHTML = `
      <div class="crumbs"><a href="#/mesas">Negócios</a> › ${esc(b.name)}</div>
      <div class="bench-head">
        <img src="${ITEM[b.icon].icon}" alt="">
        <div><h1>${esc(b.name)}</h1><p class="muted" style="margin:0">${esc(b.kind)} · ${esc(b.place)}</p></div>
      </div>
      <div class="panel" style="margin-top:18px">
        <h2>O que faz</h2>
        <p class="desc">${esc(b.what)}</p>
        ${b.hint && loc(b.hint) ? `<div class="note"><b>Texto do jogo:</b> ${rich(loc(b.hint))}</div>` : ""}
        ${b.building ? `<p>Fica dentro de: ${itemLink(b.building)}</p>` : ""}
      </div>
      <div class="panel">
        <h2>Transformação</h2>
        <div class="flow">
          <div class="flow">${b.inputs.map(nodeOf).join("")}</div>
          ${arrow}<span class="node bench">🛠️ ${esc(b.name)}</span>${arrow}
          ${b.middle ? `<div class="flow">${b.middle.map(nodeOf).join("")}</div>${arrow}` : ""}
          <div class="flow">${b.outputs.map(nodeOf).join("")}</div>
        </div>
        <h3 style="margin-top:14px">O que você ganha</h3>
        <p>${esc(b.gain)}</p>
      </div>
      ${outIds.length ? `<div class="panel">
        <h2>Valor de venda do que ela produz</h2>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Produto</th><th>Raridade</th><th class="num">Venda ao NPC</th><th></th></tr></thead><tbody>
        ${outIds.map(o => {
          const it = ITEM[o], cg = CARGO[o];
          const n = it ? it.name.pt : cg ? cg.name.pt : o;
          const href = it ? `#/item/${o}` : `#/carga/${o}`;
          return `<tr><td>${it ? `<img src="${it.icon}" alt="">` : cargoImg(o)}</td><td><a href="${href}">${esc(n)}</a> <small class="muted">${esc(o)}</small></td>
            <td>${rarityHtml(o)}</td><td class="num">${priceHtml(o)}</td><td><button class="btn small" data-edit="${o}">✏️</button></td></tr>`;
        }).join("")}
        </tbody></table></div>
        <p class="muted" style="font-size:.85rem">Os preços vêm do servidor e são preenchidos pela comunidade. Clique em ✏️ para informar.</p>
      </div>` : ""}
      ${b.tiers ? `<div class="panel"><h2>Versões da mesa</h2>${b.tiers.map(t => `<div class="row" style="margin-bottom:10px">${itemLink(t)}<span>${rich(ITEM[t].desc.pt)}</span></div>`).join("")}</div>` : ""}
      <div class="panel">
        <h2>Melhorias</h2>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Melhoria</th><th>Efeito</th></tr></thead><tbody>
          ${b.upgrades.map(([u, eff]) => `<tr><td><img src="${ITEM[u].icon}" alt=""></td><td><a href="#/item/${u}">${esc(ITEM[u].name.pt)}</a> <small class="muted">#${ITEM[u].tier || 1}</small></td><td>${esc(eff)}</td></tr>`).join("")}
        </tbody></table></div>
      </div>
      <div class="panel">
        <h2>Como usar, passo a passo</h2>
        <ol class="steps">${b.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
        ${b.tip ? `<div class="note">💡 ${esc(b.tip)}</div>` : ""}
      </div>`;
    $app.querySelectorAll("[data-edit]").forEach(btn => btn.onclick = () => editValues(btn.dataset.edit, []));
  }

  /* ---------------- tutorials: laboratório e cultivo ---------------- */
  // purchase info from the fan source (Laptop / Mercado Clandestino)
  const buyOf = id => { const f = FAN.items[id]; return f && f.buys && f.buys[0] ? f.buys[0] : null; };
  const buyHtml = id => {
    const b = buyOf(id);
    if (!b) return "";
    return `<span class="pill price">Compra: ${fmtMoney(b.price)}</span>${b.needsUnlock && b.unlockCash ? ` <span class="pill">Remessa: ${fmtMoney(b.unlockCash)}</span>` : ""}`;
  };
  const gImg = id => ITEM[id] ? `<a class="g-img" href="#/item/${id}" title="${esc(ITEM[id].name.pt)}"><img src="${ITEM[id].icon}" alt=""><span>${esc(ITEM[id].name.pt)}${ITEM[id].tier ? ` #${ITEM[id].tier}` : ""}</span></a>`
    : CARGO[id] ? `<a class="g-img" href="#/carga/${id}" title="${esc(CARGO[id].name.pt)}">${cargoImg(id)}<span>${rname(id, esc(CARGO[id].name.pt) + ((/_(?:soft|hard)_crystal_(\d)$/.exec(id) || [])[1] ? " Q" + /_(\d)$/.exec(id)[1] : ""))}</span></a>` : "";
  const gStep = (n, title, imgs, body, extra = "") => `
    <div class="g-step">
      <div class="g-num">${n}</div>
      <div class="g-body">
        <h3>${title}</h3>
        ${imgs.length ? `<div class="g-imgs">${imgs.map(gImg).join("")}</div>` : ""}
        <div class="g-text">${body}</div>
        ${extra}
      </div>
    </div>`;
  const qTable = (rows, cols) => `
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Qualidade</th>${cols.map(c => `<th class="num">${c}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(([q, ids]) => `<tr><td><b>${q}</b></td>${ids.map(id => `<td class="num">${id ? priceHtml(id) : '<span class="muted">—</span>'}</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>`;
  const upTable = ids => `
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Melhoria</th><th>Efeito</th><th class="num">Preço</th></tr></thead><tbody>
    ${ids.filter(([id]) => ITEM[id]).map(([id, eff]) => `<tr><td><img src="${ITEM[id].icon}" alt=""></td><td><a href="#/item/${id}">${esc(ITEM[id].name.pt)}</a>${ITEM[id].tier ? ` <small class="muted">#${ITEM[id].tier}</small>` : ""}</td><td>${esc(eff)}</td><td class="num">${buyHtml(id) || '<span class="muted">—</span>'}</td></tr>`).join("")}
    </tbody></table></div>`;

  function viewLabGuide() {
    setNav("mesas");
    $app.innerHTML = `
      <div class="crumbs"><a href="#/mesas">Negócios</a> › Laboratório Químico</div>
      <div class="g-head lab">
        ${ITEM.meth_lab_1 ? `<img src="${ITEM.meth_lab_1.icon}" alt="">` : ""}
        <div><div class="gh-kicker">Tutorial</div><h1>Laboratório Químico</h1>
        <p>Transforme reagentes em cristais e sacos de pólvora para vender. São 3 máquinas em sequência dentro do laboratório.</p></div>
      </div>
      <div class="panel">
        <h2>Resumo da cadeia</h2>
        <div class="flow">
          ${cargoLink("cargo_reagents_2")}${arrow}<a class="node bench" href="#/mesa/reator-quimico">🛠️ Reator Químico</a>${arrow}
          ${cargoLink("cargo_soft_crystal_1")}${arrow}<a class="node bench" href="#/mesa/freezer-industrial">🛠️ Freezer Industrial</a>${arrow}
          ${cargoLink("cargo_hard_crystal_1")}${arrow}<a class="node bench" href="#/mesa/mesa-de-laboratorio">🛠️ Mesa de Laboratório</a>${arrow}${cargoLink("cargo_drugbag")}
        </div>
      </div>
      <h2>Passo a passo</h2>
      ${gStep(1, "Compre o Laboratório Químico", ["meth_lab_1"],
        `<p>É uma garagem reformada que você coloca no terreno da sua base. Compre pelo <b>Laptop (Mercado Clandestino)</b>. Antes, desbloqueie a <b>Remessa</b> dele.</p>`,
        `<div class="g-pills">${buyHtml("meth_lab_1")}</div>`)}
      ${gStep(2, "Instale as 3 máquinas dentro dele", ["cargo_production_workbench_1", "cargo_charge_workbench_lab_freezer_1", "cargo_workbench_lab_table_1"],
        `<p>Você precisa das três, uma para cada etapa: <b>Reator Químico</b> → <b>Freezer Industrial</b> → <b>Mesa de Laboratório</b>. Todas são compradas no Laptop.</p>`,
        `<div class="g-pills"><span class="muted">Reator:</span> ${buyHtml("cargo_production_workbench_1")} <span class="muted">Freezer:</span> ${buyHtml("cargo_charge_workbench_lab_freezer_1")} <span class="muted">Mesa:</span> ${buyHtml("cargo_workbench_lab_table_1")}</div>`)}
      ${gStep(3, "Consiga os reagentes", ["cargo_reagents_2"],
        `<p>O reator funciona com <b>reagentes</b>. Os <b>Reagentes de Qualidade</b> aumentam a chance de sair cristal de qualidade maior (Q2 e Q3), que vale bem mais.</p>`)}
      ${gStep(4, "Reator Químico: faça o Concentrado Cristalino", ["cargo_production_workbench_1", "cargo_soft_crystal_1", "cargo_soft_crystal_2", "cargo_soft_crystal_3"],
        `<p>Despeje os reagentes no reator e espere. Ele sintetiza tudo num líquido: o <b>Concentrado Cristalino</b>, que sai em qualidade 1, 2 ou 3.</p>
         <p>⚠️ Enquanto produz, sai <b>fumaça em cima do prédio</b> e outros jogadores conseguem ver que o laboratório está ativo.</p>
         <p>⚠️ <b>Não mova o reator</b> no meio da produção: a carga cai no chão e o reagente que estava dentro é perdido.</p>`)}
      ${gStep(5, "Freezer Industrial: congele em Cristais Sólidos", ["cargo_charge_workbench_lab_freezer_1", "cargo_hard_crystal_1", "cargo_hard_crystal_2", "cargo_hard_crystal_3"],
        `<p>Pegue o Concentrado e coloque no freezer. Ele congela o líquido e vira <b>Cristais Sólidos</b>. A qualidade do concentrado (1, 2 ou 3) <b>continua a mesma</b> no cristal.</p>
         <p>Os Cristais Sólidos <b>já podem ser vendidos</b> assim, ou seguir para a última etapa.</p>`)}
      ${gStep(6, "Mesa de Laboratório: triture e embale", ["cargo_workbench_lab_table_1", "cargo_drugbag", "cargo_drugbag_1", "cargo_drugbag_2", "lab_crystal_1"],
        `<p>Coloque os Cristais Sólidos na mesa. Ela tritura e embala tudo em pacotes de <b>Pó Cristalino</b> para venda no varejo. O resultado é o <b>Saco de Pólvora</b>: Comum (Q1), Pura (Q2) ou Perfeita (Q3).</p>
         <p>💡 Ao pegar um Saco de Pólvora feito no laboratório, você enche o <b>Conjunto de Frascos de Laboratório</b> (item cumulativo). Cheio, ele vale muito mais.</p>`)}
      ${gStep(7, "Venda", [],
        `<p>Cargas (Cristais Sólidos, Sacos de Pólvora) vão para o <b>Contrabandista</b> no furgão. O valor sobe com a sua notoriedade e com o bônus do local de venda.</p>`)}
      <div class="panel">
        <h2>Quanto vale cada qualidade</h2>
        ${qTable([["Q1", ["cargo_soft_crystal_1", "cargo_hard_crystal_1", "cargo_drugbag"]], ["Q2", ["cargo_soft_crystal_2", "cargo_hard_crystal_2", "cargo_drugbag_1"]], ["Q3", ["cargo_soft_crystal_3", "cargo_hard_crystal_3", "cargo_drugbag_2"]]],
          ["Concentrado Cristalino", "Cristais Sólidos", "Saco de Pólvora"])}
        <p class="muted" style="font-size:.85rem">Preço base de venda ao Contrabandista (notoriedade nível 1). Fonte: robrun.info.</p>
      </div>
      <div class="panel">
        <h2>Melhorias</h2>
        ${upTable([
          ["cargo_production_workbench_2", "Reator Mk2: produz mais e mais rápido"],
          ["cargo_production_workbench_3", "Reator Mk3: volume e velocidade máximos"],
          ["cargo_production_workbench_upgrade_engine_1", "Reator: um pouco mais de chance de qualidade maior"],
          ["cargo_production_workbench_upgrade_thermometer_1", "Reator: bastante chance de qualidade maior"],
          ["cargo_production_workbench_upgrade_converter_1", "Reator: muita chance de qualidade maior"],
          ["cargo_charge_workbench_upgrade_evaporator_1", "Freezer: congela mais rápido"],
          ["cargo_charge_workbench_upgrade_refrigerant_1", "Freezer: congela mais rápido"],
          ["cargo_open_workbench_upgrade_additional_slot_2", "Mesa de Laboratório: +1 espaço para processar mais cristais"]
        ])}
      </div>`;
  }

  function viewFarmGuide() {
    setNav("mesas");
    const boosts = [["uv_lamp_1", "Acelera o crescimento"], ["uv_lamp_2", "Acelera o crescimento"], ["uv_lamp_3", "Acelera o crescimento"],
      ["water_pump_1", "Acelera o crescimento"], ["water_pump_2", "Acelera o crescimento"], ["water_pump_3", "Acelera o crescimento"], ["fan_1", "Acelera o crescimento"]];
    $app.innerHTML = `
      <div class="crumbs"><a href="#/mesas">Negócios</a> › Sala de Cultivo</div>
      <div class="g-head farm">
        ${ITEM.narco_farm_1 ? `<img src="${ITEM.narco_farm_1.icon}" alt="">` : ""}
        <div><div class="gh-kicker">Tutorial</div><h1>Sala de Cultivo</h1>
        <p>Plante arbustos raros, espere crescer e colha os Pacotes de Colheita. Quanto melhor o equipamento, mais rápido a planta cresce.</p></div>
      </div>
      <div class="panel">
        <h2>Resumo da cadeia</h2>
        <div class="flow">
          ${cargoLink("cargo_bush_growing_1")}${arrow}<a class="node bench" href="#/mesa/mesa-de-cultivo">🛠️ Mesa de Cultivo</a>${arrow}
          ${cargoLink("cargo_bush_mature_1")}${arrow}${itemLink("bush_drugs_1")}
        </div>
      </div>
      <h2>Passo a passo</h2>
      ${gStep(1, "Compre a Sala de Cultivo", ["narco_farm_1"],
        `<p>Uma pequena fazenda escondida que você coloca no terreno da sua base. Compre pelo <b>Laptop (Mercado Clandestino)</b>. Antes, desbloqueie a <b>Remessa</b> dela.</p>`,
        `<div class="g-pills">${buyHtml("narco_farm_1")}</div>`)}
      ${gStep(2, "Instale a Mesa de Cultivo", ["cargo_charge_workbench_garden_bed"],
        `<p>A mesa reforçada onde a planta cresce. Também é comprada no Laptop e vai dentro da Sala de Cultivo.</p>`,
        `<div class="g-pills">${buyHtml("cargo_charge_workbench_garden_bed")}</div>`)}
      ${gStep(3, "Coloque os equipamentos na mesa", ["uv_lamp_3", "water_pump_2", "fan_1"],
        `<p>A <b>Lâmpada UV</b>, a <b>Bomba d'Água</b> e o <b>Ventilador</b> encaixam na mesa e <b>aceleram o crescimento</b>. Não são obrigatórios, mas sem eles a planta demora bem mais.</p>`)}
      ${gStep(4, "Plante o Arbusto Florido", ["cargo_bush_growing_1"],
        `<p>Coloque o <b>Arbusto Florido</b> na Mesa de Cultivo. Ele vem em qualidade 1, 2 ou 3. Quanto maior a qualidade, mais vale a colheita.</p>`)}
      ${gStep(5, "Espere crescer", ["cargo_bush_mature_1"],
        `<p>Quando o ciclo termina, a planta vira um <b>Arbusto Maduro</b>, pronto para a colheita. Se ainda não terminou, a mesa mostra “Nada para coletar”.</p>`)}
      ${gStep(6, "Colha", ["bush_drugs_1", "bush_drugs_2", "bush_drugs_3"],
        `<p>Colha o Arbusto Maduro e pegue os <b>Pacotes de Colheita</b>, que também saem em qualidade 1, 2 ou 3.</p>`)}
      ${gStep(7, "Venda", [],
        `<p>O produto da colheita é vendido ao <b>Receptador</b>. Vender no atacado (vários de uma vez) dá muito mais lucro do que vender aos poucos.</p>`)}
      <div class="panel">
        <h2>Quanto vale cada qualidade</h2>
        ${qTable([["Q1", ["bush_drugs_1"]], ["Q2", ["bush_drugs_2"]], ["Q3", ["bush_drugs_3"]]], ["Pacote de Colheita (cada)"])}
        <p class="muted" style="font-size:.85rem">Preço de venda de referência. Fonte: robrun.info.</p>
      </div>
      <div class="panel">
        <h2>Equipamentos da mesa</h2>
        ${upTable(boosts)}
      </div>`;
  }

  function viewPlaces() {
    setNav("locais");
    const list = D.buildings.filter(b => b.rewards.length).sort((a, b) => a.name.pt.localeCompare(b.name.pt));
    const other = D.buildings.filter(b => !b.rewards.length);
    $app.innerHTML = `
      <h1>Locais</h1>
      <p class="muted">Prédios de Looty Bay que podem ser roubados. Clique num local para ver todos os itens que podem sair nele.</p>
      <div class="grid wide">
        ${list.map(b => `<a class="card" href="#/local/${b.id}">
          <div class="title">📍 ${esc(bName(b))}</div>
          <div class="sub">${esc(b.size.pt)} · ${Object.keys(placeLoot(b.id)).length} itens possíveis</div>
          <div class="flow">${b.rewards.map(r => ITEM[r] ? `<img src="${ITEM[r].icon}" alt="${esc(ITEM[r].name.pt)}" title="${esc(ITEM[r].name.pt)}" style="width:56px;height:40px;object-fit:contain">` : "").join("")}</div>
        </a>`).join("")}
      </div>
      <h2>Outros locais</h2>
      <div class="grid wide">${other.map(b => `<a class="card" href="#/local/${b.id}"><div class="title">${esc(bName(b))}</div><div class="sub">${esc(b.size.pt)}</div></a>`).join("")}</div>`;
  }

  /* ---------- full loot per place (robrun.info map points, see loot-data.js) ---------- */
  const LOOT = (window.RR_LOOT && window.RR_LOOT.places) || {};
  const fam = (...prefixes) => D.items.filter(i => prefixes.some(p => new RegExp("^" + p + "(_m?\\d+)?$").test(i.id))).map(i => i.id);
  const W_SMG = ["jp7", "cb45", "mc10", "pdw90", "apscalar"], W_RIFLE = ["rc556", "kl545", "drm14", "starh", "srreaper", "lmg"],
    W_SHOT = ["harris500", "ordr12", "tag12k"], W_PISTOL = ["dp9", "lbr44", "vulture50"], W_ALL = [...W_SMG, ...W_RIFLE, ...W_SHOT, ...W_PISTOL];
  const PICS = ["picture_tube", "picture_fake"], JEWEL = ["earrings", "ring", "necklace", "watch"], GREN = ["frag_grenade", "gas_grenade", "flash_grenade", "smoke_grenade"];
  // random loot group -> [label, item families, rarities allowed (optional)]
  const LOOT_GROUPS = {
    Picture: ["Pinturas", PICS], PictureLow: ["Pinturas (grupo básico)", PICS], PictureRoom: ["Pinturas (sala trancada)", PICS],
    Alcohol: ["Álcool", ["alcohol"]], Alcohol_room: ["Álcool (sala trancada)", ["alcohol"]], Alcohol_roomgolden: ["Álcool (sala dourada)", ["alcohol"]],
    BundleNarco: ["Drogas", ["drugs"]], Bundle: ["Pacotes", []],
    JewelryBust: ["Joias no expositor", JEWEL], Jewelry1x1: ["Joias", JEWEL],
    Phones: ["Celulares", ["phone"]], Phones_stand: ["Celulares na vitrine", ["phone"]], Phones_roomgolden: ["Celulares (sala dourada)", ["phone"]],
    Laptops: ["Laptops", ["laptop"]], Laptops_roomgolden: ["Laptops (sala dourada)", ["laptop"]],
    HeadPhones: ["Fones de ouvido", ["headphones"]], GameConsoles: ["Consoles", ["console"]], Toaster: ["Torradeiras", ["toaster"]], Hairdryer: ["Secador de cabelo", ["hairdryer"]],
    Cigar: ["Charutos", ["cigar"]], Cigar_room: ["Charutos (sala trancada)", ["cigar"]], Cigar_roomgolden: ["Charutos (sala dourada)", ["cigar"]],
    Antique: ["Antiguidades", ["antique"]], Antique_goldroom: ["Antiguidades (sala dourada)", ["antique"]],
    Medicine: ["Remédios", ["painkiller", "injector", "afak"]], Cash: ["Dinheiro", ["cash"]],
    Vest: ["Coletes", ["vest1", "vest2", "vest3", "vest4", "vest5"]], VestPolice: ["Coletes da polícia", ["vest1", "vest2", "vest3", "vest4", "vest5"]],
    Grenades: ["Granadas", GREN], Grenades_arsenal: ["Granadas do arsenal", GREN],
    // a single loose weapon in ordinary shops/houses: the game does not say which model, so it is not expanded into every weapon
    WeaponsOpen: ["Arma solta", [], null, "Uma arma qualquer (o jogo não informa o modelo)"], WeaponsOpenLow: ["Arma solta (grupo básico)", [], null, "Uma arma qualquer (o jogo não informa o modelo)"],
    WeaponsGreen: ["Armas (verdes)", W_ALL, ["uncommon"]],
    WeaponsPoliceDepartment: ["Armas da delegacia", W_ALL], WeaponsPoliceDeaprtmentSide: ["Armas da delegacia (área lateral)", W_ALL],
    WeaponsLegendaryPoliceDepartment: ["Armas lendárias da delegacia", W_ALL, ["legendary"]],
    WeaponsArsenalEpic: ["Armas épicas do arsenal", W_ALL, ["epic"]], WeaponsArsenalPistol: ["Pistolas do arsenal", W_PISTOL],
    WeaponsKeyRoomSmgEpic: ["Submetralhadoras épicas (sala trancada)", W_SMG, ["epic"]], WeaponsKeyRoomSmgGreen: ["Submetralhadoras verdes (sala trancada)", W_SMG, ["uncommon"]],
    WeaponsKeyRoomAssaultGreenEpic: ["Fuzis verdes/épicos (sala trancada)", W_RIFLE, ["uncommon", "epic"]], WeaponsKeyRoomAssaultGreen: ["Fuzis verdes (sala trancada)", W_RIFLE, ["uncommon"]],
    WeaponsKeyRoomShotgunEpic: ["Espingardas épicas (sala trancada)", W_SHOT, ["epic"]], WeaponsKeyRoomShotgunGreen: ["Espingardas verdes (sala trancada)", W_SHOT, ["uncommon"]],
    WeaponsKeyRoomPistol: ["Pistolas (sala trancada)", W_PISTOL], WeaponRelic: ["Arma relíquia", []]
  };
  const groupItems = g => {
    const spec = LOOT_GROUPS[g];
    if (!spec) return [];
    const ids = fam(...spec[1]);
    const byRar = spec[2] ? ids.filter(i => spec[2].includes(vals(i).rarity)) : ids;
    return byRar.length ? byRar : ids;
  };
  const OTHER_PT = [["Cabinet", "Armário / contêiner"], ["Safe", "Cofre"], ["Door with a key", "Porta com chave"], ["Computer", "Computador (hack com USB)"],
    ["Bank deposit box", "Cofre de depósito do banco"], ["Fridge", "Geladeira"], ["Dresser", "Cômoda"], ["Gear container", "Contêiner de equipamento"],
    ["Office desk", "Mesa de escritório"], ["Built-in safe", "Cofre embutido"], ["Bank safe", "Cofre do banco"], ["Vault door", "Porta do cofre-forte"],
    ["ATM", "Caixa eletrônico"], ["Search node", "Ponto de busca"], ["Cargo container", "Contêiner de carga"], ["Cash node", "Dinheiro"]];
  const otherPt = n => (OTHER_PT.find(([k]) => n.startsWith(k)) || [, n])[1];
  // every item that can come out of a place: featured + fixed points + random groups
  function placeLoot(id) {
    const b = BLD[id], L = LOOT[id], out = {};
    const add = (iid, tag) => { if (!ITEM[iid]) return; (out[iid] = out[iid] || new Set()).add(tag); };
    (b ? b.rewards : []).forEach(r => add(r, "destaque"));
    if (L) {
      L.confirmed.forEach(([iid]) => add(iid, "fixo"));
      L.groups.forEach(([g]) => groupItems(g).forEach(iid => add(iid, "sorteio")));
    }
    return out;
  }

  function viewPlace(id) {
    setNav("locais");
    const b = BLD[id];
    if (!b) return notFound();
    const L = LOOT[id];
    const all = placeLoot(id);
    const ids = Object.keys(all).sort((x, y) => (RRANK[vals(y).rarity] || 0) - (RRANK[vals(x).rarity] || 0) ||
      (vals(y).price ?? -1) - (vals(x).price ?? -1) || ITEM[x].name.pt.localeCompare(ITEM[y].name.pt));
    const TAGS = { destaque: "⭐ Destaque do mapa", fixo: "📌 Ponto fixo", sorteio: "🎲 Sorteado" };
    $app.innerHTML = `
      <div class="crumbs"><a href="#/locais">Locais</a> › ${esc(bName(b))}</div>
      <h1>📍 ${esc(bName(b))}</h1>
      <p class="muted">${esc(b.size.pt)}${L ? ` · ${L.points} pontos de saque` : ""}</p>
      ${b.desc.pt ? `<div class="panel"><p class="desc">${rich(b.desc.pt)}</p></div>` : ""}
      ${ids.length ? `
        <h2>Todos os itens que podem sair aqui <span class="muted">(${ids.length})</span></h2>
        <div class="loot-legend"><span>⭐ Destaque do mapa</span><span>📌 Ponto fixo (sempre o mesmo item)</span><span>🎲 Sorteado em um ponto aleatório</span></div>
        <div class="grid">
          ${ids.map(i => { const it = ITEM[i], r = vals(i).rarity; return `<a class="card ${r ? "r-" + r : ""}" href="#/item/${i}">
            <div class="thumb"><img src="${it.icon}" alt="" loading="lazy"></div>
            <div class="title">${esc(it.name.pt)}${it.tier ? ` <small class="muted">#${it.tier}</small>` : ""}</div>
            <div class="sub">${[...all[i]].map(t => TAGS[t]).join(" · ")}</div>
            <div class="meta">${priceHtml(i)}${r ? rarityHtml(i) : ""}</div>
          </a>`; }).join("")}
        </div>` : `<div class="panel"><p class="muted">Este local não tem saque (é uma área social, de base ou de serviço).</p></div>`}
      ${L ? `<div class="panel" style="margin-top:22px">
        <h2>Pontos de saque</h2>
        ${L.confirmed.length ? `<h3>📌 Pontos fixos</h3>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Item</th><th class="num">Pontos</th><th class="num">Quantidade por ponto</th></tr></thead><tbody>
          ${L.confirmed.filter(([i]) => ITEM[i]).map(([i, n, mn, mx]) => `<tr><td><img src="${ITEM[i].icon}" alt=""></td><td><a href="#/item/${i}">${esc(ITEM[i].name.pt)}</a></td><td class="num">${n}</td><td class="num">${mn === mx ? mn : mn + "–" + mx}</td></tr>`).join("")}
          </tbody></table></div>` : ""}
        ${L.groups.length ? `<h3>🎲 Pontos sorteados</h3>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tipo de saque</th><th class="num">Pontos</th><th>Pode sair</th></tr></thead><tbody>
          ${L.groups.map(([g, n]) => { const gi = groupItems(g); return `<tr><td>${esc((LOOT_GROUPS[g] || [g])[0])}</td><td class="num">${n}</td>
            <td><div class="mini-icons">${gi.length ? gi.map(i => `<a href="#/item/${i}" title="${esc(ITEM[i].name.pt)}"><img src="${ITEM[i].icon}" alt=""></a>`).join("") : `<span class="muted">${esc((LOOT_GROUPS[g] || [])[3] || "Conteúdo desconhecido")}</span>`}</div></td></tr>`; }).join("")}
          </tbody></table></div>` : ""}
        ${L.other.length ? `<h3>🔒 Outros pontos</h3>
          <div class="chips">${L.other.map(([n, c]) => `<span class="chip">${esc(otherPt(n))}<span class="n">${c}</span></span>`).join("")}</div>
          <p class="muted" style="font-size:.85rem">Armários, cofres, gavetas e afins: o conteúdo é sorteado pelo servidor e não aparece nos arquivos do jogo.</p>` : ""}
        <p class="muted" style="font-size:.85rem">Pontos de saque: <a href="https://robrun.info/en/map/" target="_blank" rel="noopener">mapa do robrun.info</a>. O jogo sorteia o item de cada ponto aleatório no servidor, então a lista “Pode sair” mostra os itens daquele tipo, não a chance exata.</p>
      </div>` : ""}`;
  }

  // cargo categories (the game has none, so they are grouped by hand)
  const CARGO_CATS = [
    ["caixotes", "Caixotes de Saque", ["cargo_minimarket", "cargo_electronics", "cargo_equip", "cargo_jewelry", "cargo_medicine", "cargo_carparts", "cargo_weapon_box_1", "cargo_box"]],
    ["valores", "Cofres, Malas e Valores", ["cargo_safe", "cargo_safe_legendary", "cargo_statue", "cargo_suitcase", "cargo_suitcase_2", "cargo_suitcase_3", "cargo_cashbag"]],
    ["contrabando", "Contrabando", ["cargo_alcohol_grade_1", "cargo_alcohol_grade_2", "cargo_alcohol_grade_3", "cargo_contraband_bag_1", "cargo_contraband_bag_2", "cargo_manifest_1_cumulative"]],
    ["lab", "Laboratório", ["cargo_drugbag", "cargo_drugbag_1", "cargo_drugbag_2", "cargo_hard_crystal_1", "cargo_hard_crystal_2", "cargo_hard_crystal_3", "cargo_soft_crystal_1", "cargo_soft_crystal_2", "cargo_soft_crystal_3", "cargo_reagents_2"]],
    ["cultivo", "Cultivo", ["cargo_bush_growing_1", "cargo_bush_mature_1"]],
    ["colecoes", "Coleções", ["collection_reward_cargo", "collection_reward_cargo_2", "collection_reward_cargo_3", "collection_reward_cargo_4"]]
  ];
  const CARGO_CAT = {};
  CARGO_CATS.forEach(([k, , ids]) => ids.forEach(id => (CARGO_CAT[id] = k)));
  const cargoCat = id => CARGO_CAT[id] || "outros";
  const rname = (id, text) => { const r = vals(id).rarity; return `<span class="rname ${r ? "r-" + r : ""}">${text}</span>`; };

  let cargoState = { q: "", cat: "all", sort: "rarity" };
  function viewCargos() {
    setNav("cargas");
    const counts = {};
    D.cargo.forEach(c => counts[cargoCat(c.id)] = (counts[cargoCat(c.id)] || 0) + 1);
    const cats = [...CARGO_CATS.map(([k, n]) => [k, n]), ["outros", "Outros"]].filter(([k]) => counts[k]);
    $app.innerHTML = `
      <h1>Cargas</h1>
      <div class="toolbar">
        <input id="cq" type="search" placeholder="Filtrar por nome…" value="${esc(cargoState.q)}">
        <select id="csort">
          <option value="rarity">Ordenar: Qualidade (mais raro)</option>
          <option value="name">Ordenar: Nome</option>
          <option value="price">Ordenar: Preço (maior)</option>
          <option value="cat">Ordenar: Categoria</option>
        </select>
      </div>
      <div class="with-side">
        <aside class="sidebar" id="cchips">
          <div class="side-title">Categorias</div>
          <button class="chip ${cargoState.cat === "all" ? "on" : ""}" data-c="all">Todas<span class="n">${D.cargo.length}</span></button>
          ${cats.map(([k, n]) => `<button class="chip ${cargoState.cat === k ? "on" : ""}" data-c="${k}">${n}<span class="n">${counts[k]}</span></button>`).join("")}
        </aside>
        <div class="grid" id="cgrid"></div>
      </div>`;
    const CATNAME = Object.fromEntries(cats);
    const CATIDX = Object.fromEntries(cats.map(([k], i) => [k, i]));
    const sortSel = document.getElementById("csort");
    sortSel.value = cargoState.sort;
    const draw = () => {
      const q = norm(cargoState.q);
      const list = D.cargo.filter(c => (cargoState.cat === "all" || cargoCat(c.id) === cargoState.cat) &&
        (!q || norm(c.name.pt + " " + c.name.en + " " + c.id).includes(q)));
      const s = cargoState.sort;
      const byRarity = (a, b) => (RRANK[vals(b.id).rarity] || 0) - (RRANK[vals(a.id).rarity] || 0);
      const byPrice = (a, b) => (vals(b.id).price ?? -1) - (vals(a.id).price ?? -1);
      const byName = (a, b) => a.name.pt.localeCompare(b.name.pt);
      list.sort((a, b) =>
        s === "name" ? byName(a, b) :
        s === "price" ? byPrice(a, b) || byName(a, b) :
        s === "cat" ? CATIDX[cargoCat(a.id)] - CATIDX[cargoCat(b.id)] || byRarity(a, b) || byPrice(a, b) || byName(a, b) :
        byRarity(a, b) || byPrice(a, b) || byName(a, b));
      document.getElementById("cgrid").innerHTML = list.map(c => {
        const r = vals(c.id).rarity;
        return `<a class="card ${r ? "r-" + r : ""}" href="#/carga/${c.id}">
          <div class="thumb">${CARGO_NO_IMG.has(c.id) ? `<span class="thumb-ico">📦</span>` : `<img src="img/cargo/${c.id}.webp" alt="" loading="lazy">`}</div>
          <div class="title">${rname(c.id, esc(c.name.pt))}</div>
          <div class="sub">${esc(CATNAME[cargoCat(c.id)] || "")}</div>
          <div class="meta">${priceHtml(c.id)}${r ? rarityHtml(c.id) : ""}</div>
        </a>`;
      }).join("") || `<p class="muted">Nenhuma carga encontrada.</p>`;
    };
    document.getElementById("cq").oninput = e => { cargoState.q = e.target.value; draw(); };
    sortSel.onchange = e => { cargoState.sort = e.target.value; draw(); };
    document.getElementById("cchips").onclick = e => {
      const b = e.target.closest(".chip"); if (!b) return;
      cargoState.cat = b.dataset.c;
      document.querySelectorAll("#cchips .chip").forEach(x => x.classList.toggle("on", x === b));
      draw();
    };
    draw();
  }

  function viewCargo(id) {
    setNav("cargas");
    const c = CARGO[id];
    if (!c) return notFound();
    const used = USEDBY[id] || [], made = MADEBY[id] || [];
    $app.innerHTML = `
      <div class="crumbs"><a href="#/cargas">Cargas</a> › ${esc(c.name.pt)}</div>
      <div class="detail">
        <div class="art">${CARGO_NO_IMG.has(id) ? `<span class="big-ico">📦</span>` : `<img src="img/cargo/${id}.webp" alt="${esc(c.name.pt)}">`}</div>
        <div>
          <h1>${rname(id, esc(c.name.pt))}</h1><p class="en">${esc(c.name.en)}</p>
          <div class="panel"><p class="desc">${rich(c.desc.pt) || '<span class="unknown">Sem descrição.</span>'}</p></div>
          <div class="panel">
            <div class="row" style="justify-content:space-between"><h3 style="margin:0">Informações</h3><button class="btn small" id="btnEdit">✏️ Editar valores</button></div>
            <dl class="kv" style="margin-top:12px">
              <dt>Raridade</dt><dd>${rarityHtml(id)}</dd>
              <dt>Venda ao Contrabandista</dt><dd>${priceHtml(id)} ${vals(id).priceFromFan ? `<small class="muted">nível 1 · fonte <a href="${FAN.source.cargoUrl}" target="_blank" rel="noopener">robrun.info</a></small>` : ""}</dd>
            </dl>
          </div>
          ${FAN.cargo[id] ? `<div class="panel"><h3>Quanto o Contrabandista paga</h3>
            <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Variante</th><th>Raridade</th>${FAN.smugglerBonus.map(b => `<th class="num">Nv ${b.level}${b.bonus ? " (+" + b.bonus + "%)" : ""}</th>`).join("")}</tr></thead><tbody>
            ${FAN.cargo[id].map(c => `<tr><td>${esc(c.name)}</td><td><span class="pill r-${c.rarity}">${RNAME[c.rarity] || c.rarity}</span></td>
              ${FAN.smugglerBonus.map(b => `<td class="num">${fmtMoney(Math.round(c.price * (1 + b.bonus / 100)))}</td>`).join("")}</tr>`).join("")}
            </tbody></table></div>
            <p class="muted" style="font-size:.85rem">Preço base × (1 + bônus de notoriedade). O bônus do local de venda não está incluído. Fonte: <a href="${FAN.source.cargoUrl}" target="_blank" rel="noopener">robrun.info</a>.</p></div>` : ""}
          ${made.length ? `<div class="panel"><h3>Produzida em</h3><div class="flow">${made.map(b => `<a class="node bench" href="#/mesa/${b}">🛠️ ${esc(BENCH[b].name)}</a>`).join("")}</div></div>` : ""}
          ${used.length ? `<div class="panel"><h3>Usada em</h3><div class="flow">${used.map(b => `<a class="node bench" href="#/mesa/${b}">🛠️ ${esc(BENCH[b].name)}</a>`).join("")}</div></div>` : ""}
        </div>
      </div>`;
    document.getElementById("btnEdit").onclick = () => editValues(id, []);
  }

  function viewNpcs() {
    setNav("npcs");
    $app.innerHTML = `
      <h1>NPCs e onde vender</h1>
      <div class="grid wide">
        ${NPCS.map(n => `<div class="card"><div class="tile-ico">${n.ico}</div><div class="title">${esc(n.name)}</div>
          <div>${esc(n.extra)}</div>${loc(n.text) ? `<div class="note">${rich(loc(n.text))}</div>` : ""}</div>`).join("")}
      </div>
      <div class="panel" style="margin-top:18px">
        <h2>Bônus de venda</h2>
        <p>${rich(loc("buyer_dialog_tooltip_description"))}</p>
        <p>${rich(loc("buyer_dialog_tooltip_description2"))}</p>
        <p>${rich(loc("cargo_exchanger_tooltip"))}</p>
      </div>`;
  }

  function viewGuide() {
    setNav("guia");
    const hints = D.codex.filter(c => !c.buff && c.desc.pt);
    const buffs = D.codex.filter(c => c.buff && c.desc.pt);
    $app.innerHTML = `
      <h1>Guia do jogo</h1>
      <p class="muted">Textos oficiais do Códice do jogo.</p>
      <h2>Dicas</h2>
      <div class="grid wide">${hints.map(c => `<div class="card"><div class="title">${esc(c.title.pt)}</div><div>${rich(c.desc.pt)}</div></div>`).join("")}</div>
      <h2>Efeitos</h2>
      <div class="grid wide">${buffs.map(c => `<div class="card"><div class="title">${esc(c.title.pt)}</div><div>${rich(c.desc.pt)}</div></div>`).join("")}</div>
      <h2>Dicas da tela de carregamento</h2>
      <div class="panel"><ul class="tips">${D.tips.filter(t => t.pt).map(t => `<li>${rich(t.pt)}</li>`).join("")}</ul></div>`;
  }

  function notFound() {
    $app.innerHTML = `<h1>Página não encontrada</h1><p><a href="#/">Voltar ao início</a></p>`;
  }

  /* ---------------- editing ---------------- */
  function editValues(id, srcs) {
    const v = vals(id);
    const name = ITEM[id] ? ITEM[id].name.pt : CARGO[id] ? CARGO[id].name.pt : id;
    const dlg = document.createElement("dialog");
    dlg.innerHTML = `
      <h3>Editar valores: ${esc(name)}</h3>
      <p class="muted" style="font-size:.85rem">Salvo só neste navegador. Use Exportar na página inicial para compartilhar.</p>
      <div class="field"><label>Preço de venda ao NPC ($)</label><input id="fPrice" type="number" min="0" step="1" value="${v.price ?? ""}"></div>
      <div class="field"><label>Raridade</label><select id="fRar"><option value="">—</option>${RARITIES.map(([k, n]) => `<option value="${k}" ${v.rarity === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      ${srcs.length ? `<h4>Chance de drop por local (%)</h4>${srcs.map(b => `<div class="field"><label>${esc(bName(BLD[b]))}</label><input type="number" min="0" max="100" step="0.01" data-ch="${b}" value="${v.chances[b] ?? ""}"></div>`).join("")}` : ""}
      <div class="dlg-actions"><button class="btn" value="cancel" id="fCancel">Cancelar</button><button class="btn" id="fClear">Limpar</button><button class="btn primary" id="fSave">Salvar</button></div>`;
    document.body.appendChild(dlg);
    dlg.showModal();
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.querySelector("#fCancel").onclick = close;
    dlg.querySelector("#fClear").onclick = () => { delete local[id]; saveLocal(); close(); route(); };
    dlg.querySelector("#fSave").onclick = () => {
      const p = dlg.querySelector("#fPrice").value;
      const chances = {};
      dlg.querySelectorAll("[data-ch]").forEach(i => { if (i.value !== "") chances[i.dataset.ch] = Number(i.value); });
      local[id] = { price: p === "" ? null : Number(p), rarity: dlg.querySelector("#fRar").value || null, chances };
      saveLocal(); close(); route();
    };
  }
  function exportValues() {
    const merged = {};
    new Set([...Object.keys(COMM), ...Object.keys(local)]).forEach(k => {
      const v = vals(k);
      if (v.price != null || v.rarity || Object.keys(v.chances).length) merged[k] = v;
    });
    const txt = "window.RR_COMMUNITY = " + JSON.stringify({ items: merged }, null, 2) + ";\n";
    const blob = new Blob([txt], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "community-data.js"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importValues() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".js,.json";
    inp.onchange = async () => {
      const t = await inp.files[0].text();
      try {
        const json = JSON.parse(t.replace(/^[\s\S]*?=\s*/, "").replace(/;\s*$/, ""));
        Object.assign(local, json.items || json); saveLocal(); route();
        alert("Valores importados.");
      } catch (e) { alert("Arquivo inválido."); }
    };
    inp.click();
  }

  /* ---------------- search ---------------- */
  const INDEX = [
    ...D.items.map(i => ({ t: i.name.pt + (i.tier ? " #" + i.tier : ""), s: norm(i.name.pt + " " + i.name.en + " " + i.id), h: "#/item/" + i.id, img: i.icon, k: "Item" })),
    ...BENCHES.map(b => ({ t: b.name, s: norm(b.name + " mesa bancada"), h: "#/mesa/" + b.id, img: ITEM[b.icon].icon, k: "Mesa" })),
    ...D.buildings.map(b => ({ t: bName(b), s: norm(b.name.pt + " " + b.id), h: "#/local/" + b.id, k: "Local" })),
    ...D.cargo.map(c => ({ t: c.name.pt, s: norm(c.name.pt + " " + c.name.en + " " + c.id), h: "#/carga/" + c.id, k: "Carga" }))
  ];
  const $s = document.getElementById("globalSearch"), $r = document.getElementById("searchResults");
  let sel = -1;
  $s.addEventListener("input", () => {
    const q = norm($s.value.trim());
    sel = -1;
    if (q.length < 2) { $r.hidden = true; return; }
    const res = INDEX.filter(x => x.s.includes(q)).slice(0, 14);
    $r.innerHTML = res.map(x => `<a href="${x.h}">${x.img ? `<img src="${x.img}" alt="">` : "<span style='width:40px;text-align:center'>•</span>"}<span>${esc(x.t)}</span><span class="kind">${x.k}</span></a>`).join("") || `<a>Nada encontrado</a>`;
    $r.hidden = false;
  });
  $s.addEventListener("keydown", e => {
    const links = [...$r.querySelectorAll("a[href]")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sel = Math.max(0, Math.min(links.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1)));
      links.forEach((l, i) => l.classList.toggle("sel", i === sel));
    } else if (e.key === "Enter" && links.length) {
      location.hash = links[Math.max(0, sel)].getAttribute("href");
    } else if (e.key === "Escape") { $r.hidden = true; }
  });
  document.addEventListener("click", e => { if (!e.target.closest(".search-wrap")) $r.hidden = true; });
  $r.addEventListener("click", () => { $r.hidden = true; $s.value = ""; });
  document.getElementById("menuBtn").onclick = () => document.getElementById("mainnav").classList.toggle("open");

  /* ---------------- router ---------------- */
  function route() {
    const [, page, arg] = (location.hash || "#/").split("/");
    const a = arg ? decodeURIComponent(arg) : "";
    ({
      "": viewHome, itens: viewItems, item: () => viewItem(a), mesas: viewBenches, mesa: () => viewBench(a),
      laboratorio: viewLabGuide, cultivo: viewFarmGuide,
      locais: viewPlaces, local: () => viewPlace(a), cargas: viewCargos, carga: () => viewCargo(a),
      npcs: viewNpcs, guia: viewGuide
    }[page] || notFound)();
  }
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  route();
})();
