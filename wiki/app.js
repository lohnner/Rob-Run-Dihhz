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
  const cargoLink = (id, extra = "") => {
    const c = CARGO[id];
    const n = c ? c.name.pt : id;
    return `<a class="node ${extra}" href="#/carga/${id}">📦 ${esc(n)} <small class="muted">${esc(id.replace(/^cargo_/, ""))}</small></a>`;
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
           ["#/mesas", "🛠️", "Mesas", "O que cada mesa faz, o que entra, o que sai e as melhorias."],
           ["#/locais", "🗺️", "Locais", "Prédios de Looty Bay e o saque de cada um."],
           ["#/cargas", "📦", "Cargas", "Caixotes, cofres, malas e produtos do laboratório."],
           ["#/npcs", "🕴️", "NPCs e Venda", "Para quem vender cada coisa."],
           ["#/guia", "📖", "Guia", "Códice, efeitos e dicas oficiais do jogo."]]
          .map(([h, i, t, d]) => `<a class="card" href="${h}"><div class="tile-ico">${i}</div><div class="title">${t}</div><div class="sub">${d}</div></a>`).join("")}
      </div>
      <div class="panel" style="margin-top:22px">
        <h2>Preços, raridade e chance de drop</h2>
        <p>Preço de venda, raridade, preço de compra, trocas e pontos de saque fixos vêm da wiki de fãs ${SRC}, que extraiu esses dados do jogo (build ${esc(FAN.source.build || "?")}, ${esc(FAN.source.date || "?")}). Preços de carga vêm do <a href="${FAN.source.cargoUrl}" target="_blank" rel="noopener">artigo de cargas</a> deles.</p>
        <p>A <b>% de drop</b> dos itens sorteados nos prédios não é pública em nenhuma fonte: o servidor faz o sorteio e nem as wikis de fãs conseguiram extrair. Se você medir no jogo, use <b>Editar valores</b>. Sua edição tem prioridade sobre a fonte e fica salva neste navegador. Para compartilhar, exporte e cole em <code>community-data.js</code>.</p>
        <div class="row" style="max-width:520px">
          <button class="btn" id="btnExport">Exportar valores (JSON)</button>
          <button class="btn" id="btnImport">Importar valores</button>
        </div>
      </div>`;
    document.getElementById("btnExport").onclick = exportValues;
    document.getElementById("btnImport").onclick = importValues;
  }

  let itemState = { q: "", cat: "all", sort: "name" };
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
          <option value="name">Ordenar: Nome</option>
          <option value="price">Ordenar: Preço (maior)</option>
          <option value="cat">Ordenar: Categoria</option>
          <option value="src">Ordenar: Nº de locais</option>
        </select>
      </div>
      <div class="chips" id="ichips">
        <button class="chip ${itemState.cat === "all" ? "on" : ""}" data-c="all">Todos<span class="n">${D.items.length}</span></button>
        ${cats.map(c => `<button class="chip ${itemState.cat === c ? "on" : ""}" data-c="${c}">${D.categories[c]}<span class="n">${counts[c]}</span></button>`).join("")}
      </div>
      <div class="grid" id="igrid"></div>`;
    const $g = document.getElementById("igrid");
    const sortSel = document.getElementById("isort");
    sortSel.value = itemState.sort;
    const draw = () => {
      const q = norm(itemState.q);
      let list = D.items.filter(i => (itemState.cat === "all" || i.cat === itemState.cat) &&
        (!q || norm(i.name.pt + " " + i.name.en + " " + i.id).includes(q)));
      const s = itemState.sort;
      list.sort((a, b) =>
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
    const srcs = SOURCES[id] || [];
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
            ${srcs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Local</th><th>Tipo</th><th class="num">Chance de drop</th></tr></thead><tbody>
              ${srcs.map(b => `<tr><td><a href="#/local/${b}">${esc(bName(BLD[b]))}</a></td><td class="muted">${esc(BLD[b].size.pt)}</td>
              <td class="num">${v.chances[b] != null && v.chances[b] !== "" ? `<b class="hl">${v.chances[b]}%</b>` : '<span class="unknown">não divulgada</span>'}</td></tr>`).join("")}
              </tbody></table></div>
              <p class="muted" style="font-size:.85rem">Locais: lista oficial de saque do mapa do jogo. A % de drop desses itens sorteados não está nos arquivos nem nas wikis de fãs (o servidor sorteia). Se você medir, preencha em <b>Editar valores</b>.</p>`
            : (F && (F.points.length || F.buys.length || F.barters.length)) ? `<p class="muted">Não aparece no saque em destaque dos prédios, mas tem outras fontes abaixo.</p>`
            : `<p class="muted">Não aparece no saque em destaque de nenhum prédio. Pode vir de cargas abertas, produção, recompensas ou outros meios.</p>`}
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
      <h1>Mesas e bancadas</h1>
      <p class="muted">Mesas que você instala na sua base. Clique numa para ver o que ela faz, o que entra, o que sai, as melhorias e o passo a passo.</p>
      <div class="panel">
        <h3>Cadeia do laboratório</h3>
        <div class="flow">
          ${textNode("Reagentes", "🧪")}${arrow}<a class="node bench" href="#/mesa/reator-quimico">🛠️ Reator Químico</a>${arrow}
          ${cargoLink("cargo_soft_crystal_1")}${arrow}<a class="node bench" href="#/mesa/freezer-industrial">🛠️ Freezer Industrial</a>${arrow}
          ${cargoLink("cargo_hard_crystal_1")}${arrow}<a class="node bench" href="#/mesa/mesa-de-laboratorio">🛠️ Mesa de Laboratório</a>${arrow}${itemLink("lab_crystal_1")}
        </div>
      </div>
      <div class="grid wide">
        ${BENCHES.map(b => `<a class="card" href="#/mesa/${b.id}">
          <div class="thumb"><img src="${ITEM[b.icon].icon}" alt="" loading="lazy"></div>
          <div class="title">${esc(b.name)}</div>
          <div class="sub">${esc(b.kind)} · ${esc(b.place)}</div>
          <div>${esc(b.what)}</div>
        </a>`).join("")}
      </div>`;
  }

  function viewBench(id) {
    setNav("mesas");
    const b = BENCH[id];
    if (!b) return notFound();
    const outIds = (b.outputs || []).filter(o => o[0] !== "text").map(o => o[1]);
    $app.innerHTML = `
      <div class="crumbs"><a href="#/mesas">Mesas</a> › ${esc(b.name)}</div>
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
          return `<tr><td>${it ? `<img src="${it.icon}" alt="">` : "📦"}</td><td><a href="${href}">${esc(n)}</a> <small class="muted">${esc(o)}</small></td>
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

  function viewPlaces() {
    setNav("locais");
    const list = D.buildings.filter(b => b.rewards.length).sort((a, b) => a.name.pt.localeCompare(b.name.pt));
    const other = D.buildings.filter(b => !b.rewards.length);
    $app.innerHTML = `
      <h1>Locais</h1>
      <p class="muted">Prédios de Looty Bay que podem ser roubados, com o saque em destaque que o jogo mostra no mapa.</p>
      <div class="grid wide">
        ${list.map(b => `<a class="card" href="#/local/${b.id}">
          <div class="title">📍 ${esc(bName(b))}</div>
          <div class="sub">${esc(b.size.pt)}</div>
          <div class="flow">${b.rewards.map(r => ITEM[r] ? `<img src="${ITEM[r].icon}" alt="${esc(ITEM[r].name.pt)}" title="${esc(ITEM[r].name.pt)}" style="width:56px;height:40px;object-fit:contain">` : "").join("")}</div>
        </a>`).join("")}
      </div>
      <h2>Outros locais</h2>
      <div class="grid wide">${other.map(b => `<a class="card" href="#/local/${b.id}"><div class="title">${esc(bName(b))}</div><div class="sub">${esc(b.size.pt)}</div></a>`).join("")}</div>`;
  }

  function viewPlace(id) {
    setNav("locais");
    const b = BLD[id];
    if (!b) return notFound();
    $app.innerHTML = `
      <div class="crumbs"><a href="#/locais">Locais</a> › ${esc(bName(b))}</div>
      <h1>📍 ${esc(bName(b))}</h1>
      <p class="muted">${esc(b.size.pt)} · <code>${esc(b.id)}</code></p>
      ${b.desc.pt ? `<div class="panel"><p class="desc">${rich(b.desc.pt)}</p></div>` : ""}
      ${b.rewards.length ? `<div class="panel">
        <h2>Saque em destaque</h2>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Item</th><th>Raridade</th><th class="num">Venda ao NPC</th><th class="num">Chance aqui</th><th></th></tr></thead><tbody>
        ${b.rewards.map(r => {
          const it = ITEM[r]; const v = vals(r);
          return `<tr><td>${it ? `<img src="${it.icon}" alt="">` : ""}</td>
            <td>${it ? `<a href="#/item/${r}">${esc(it.name.pt)}</a>` : `<span class="muted">${esc(r)}</span>`}</td>
            <td>${rarityHtml(r)}</td><td class="num">${priceHtml(r)}</td>
            <td class="num">${v.chances[id] != null && v.chances[id] !== "" ? `<b class="hl">${v.chances[id]}%</b>` : '<span class="unknown">—</span>'}</td>
            <td>${it ? `<button class="btn small" data-edit="${r}">✏️</button>` : ""}</td></tr>`;
        }).join("")}
        </tbody></table></div>
        <p class="muted" style="font-size:.85rem">Lista oficial do mapa do jogo. O prédio pode ter mais saque além desses. Chances e preços são preenchidos pela comunidade.</p>
      </div>` : `<div class="panel"><p class="muted">Este local não tem saque em destaque (é uma área social, de base ou de serviço).</p></div>`}`;
    $app.querySelectorAll("[data-edit]").forEach(btn => btn.onclick = () => editValues(btn.dataset.edit, SOURCES[btn.dataset.edit] || []));
  }

  function viewCargos() {
    setNav("cargas");
    $app.innerHTML = `
      <h1>Cargas</h1>
      <p class="muted">Cargas são objetos grandes que você carrega nas mãos ou no porta-malas. Algumas são abertas em mesas, outras são vendidas direto ao Contrabandista.</p>
      <div class="note">${rich(loc("hints_stolen_cargo_description"))}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Carga</th><th>Descrição</th><th>Mesa</th><th class="num">Venda</th></tr></thead><tbody>
      ${D.cargo.slice().sort((a, b) => a.name.pt.localeCompare(b.name.pt)).map(c => {
        const ub = [...(USEDBY[c.id] || []), ...(MADEBY[c.id] || [])];
        return `<tr><td><a href="#/carga/${c.id}">📦 ${esc(c.name.pt)}</a><br><small class="muted">${esc(c.id)}</small></td>
          <td>${rich(c.desc.pt)}</td>
          <td>${[...new Set(ub)].map(b => `<a href="#/mesa/${b}">${esc(BENCH[b].name)}</a>`).join("<br>") || '<span class="muted">—</span>'}</td>
          <td class="num">${priceHtml(c.id)}</td></tr>`;
      }).join("")}
      </tbody></table></div>`;
  }

  function viewCargo(id) {
    setNav("cargas");
    const c = CARGO[id];
    if (!c) return notFound();
    const used = USEDBY[id] || [], made = MADEBY[id] || [];
    $app.innerHTML = `
      <div class="crumbs"><a href="#/cargas">Cargas</a> › ${esc(c.name.pt)}</div>
      <div class="detail">
        <div class="art"><span class="big-ico">📦</span></div>
        <div>
          <h1>${esc(c.name.pt)}</h1><p class="en">${esc(c.name.en)}</p>
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
      locais: viewPlaces, local: () => viewPlace(a), cargas: viewCargos, carga: () => viewCargo(a),
      npcs: viewNpcs, guia: viewGuide
    }[page] || notFound)();
  }
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  route();
})();
