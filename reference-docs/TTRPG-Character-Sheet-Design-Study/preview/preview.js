const resourceData = [
  { id: "health", label: "Health", value: 520, max: 650, tone: "health", icon: "♥" },
  { id: "mana", label: "Mana", value: 140, max: 200, tone: "mana", icon: "◆" },
  { id: "actions", label: "Actions", value: 6, max: 10, tone: "action", icon: "ϟ" },
  { id: "reactions", label: "Reactions", value: 2, max: 3, tone: "reaction", icon: "↻" }
];

const stats = [
  ["Strength", 70, "Power and physical force", [["Lifting",84],["Carry Weight",280,"lb"]]],
  ["Dexterity",55,"Speed and coordination",[["Acrobatics",61],["Stamina",63],["Reaction Time",68]]],
  ["Constitution",65,"Health and endurance",[["Health",650],["Endurance",64],["Pain Tolerance",67]]],
  ["Perception",68,"Awareness and processing",[["Sight Distance",74],["Intuition",71],["Registration",73]]],
  ["Arcane",34,"Magic capacity and control",[["Mana",200],["Control",49],["Sensitivity",53]]],
  ["Will",76,"Resolve and presence",[["Charisma",72],["Mental Fortitude",81],["Courage",78]]]
];

const actions = [
  { name:"Longsword Strike", category:"Attack", summary:"Resolve a strength-based weapon attack and send the result to the table log.", cost:"1 action", tags:["Strength","Slashing"], label:"Roll damage", favorite:true },
  { name:"Parry", category:"Defense", summary:"Contest an incoming physical attack with the equipped weapon proficiency.", cost:"1 reaction", tags:["Weapon","Counter"], label:"Roll parry", favorite:true },
  { name:"Dodge", category:"Defense", summary:"Contest the attack using Dexterity. Melee attempts may be disadvantaged.", cost:"1 reaction", tags:["Dexterity","Movement"], label:"Roll dodge" },
  { name:"Block", category:"Defense", summary:"Contest with Strength to reduce incoming damage.", cost:"1 reaction", tags:["Strength","Shield"], label:"Roll block", disabled:"No compatible shield or weapon equipped" },
  { name:"Focus Mana", category:"Magic", summary:"Steady the flow of mana before a difficult spell or control check.", cost:"1 action", tags:["Arcane","Control"], label:"Make check" },
  { name:"Disengage", category:"Utility", summary:"Move out of an enemy’s reach without allowing an opportunity attack.", cost:"1 action", tags:[], label:"Use action" }
];

let activeCategory = "All";
let favoritesOnly = false;
let toastTimer;
function toast(message) { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),1800); }

function renderResources() {
  document.querySelector('#resources').innerHTML = resourceData.map((r) => `
    <section class="cs-resource cs-resource--${r.tone}">
      <div class="cs-resource__top"><span class="cs-resource__label"><span>${r.icon}</span>${r.label}</span><output class="cs-resource__value"><strong>${r.value}</strong><span> / ${r.max}</span></output></div>
      <div class="cs-resource__track" role="progressbar" aria-label="${r.label}" aria-valuemin="0" aria-valuemax="${r.max}" aria-valuenow="${r.value}"><span style="--cs-meter-percent:${Math.max(0,Math.min(100,r.value/r.max*100))}%"></span></div>
      ${["health","mana"].includes(r.id) ? `<div class="cs-resource__controls"><button class="cs-icon-button" data-resource="${r.id}" data-delta="-1" aria-label="Reduce ${r.label}">−</button><span class="cs-resource__state">Adjust</span><button class="cs-icon-button" data-resource="${r.id}" data-delta="1" aria-label="Increase ${r.label}">+</button></div>` : ""}
    </section>`).join('');
  document.querySelectorAll('[data-resource]').forEach((button) => button.addEventListener('click', () => {
    const resource=resourceData.find(r=>r.id===button.dataset.resource); resource.value=Math.max(0,Math.min(resource.max,resource.value+Number(button.dataset.delta)*10)); renderResources(); toast(`${resource.label} intent preview: ${resource.value}/${resource.max}`);
  }));
}

function renderStats() {
  document.querySelector('#stats').innerHTML = stats.map(([name,value,hint,subs]) => `
    <section class="cs-stat-cluster preview-rollable" data-roll="${name}">
      <div class="cs-stat-cluster__main cs-stat-cluster__main--rollable"><span class="cs-stat-cluster__label">${name}</span><span class="cs-stat-cluster__value-line"><strong>${value}</strong><span>◈</span></span><span class="cs-stat-cluster__hint">${hint}</span></div>
      <div class="cs-stat-cluster__subs">${subs.map(([label,val,unit])=>`<div class="cs-substat"><span class="cs-substat__copy"><span>${label}</span>${unit?`<small>${unit}</small>`:''}</span><span class="cs-substat__number"><strong>${val}</strong></span></div>`).join('')}</div>
    </section>`).join('');
  document.querySelectorAll('[data-roll]').forEach(el=>el.addEventListener('click',()=>toast(`Roll intent: ${el.dataset.roll}`)));
}

function renderFilters() {
  const categories=["All",...new Set(actions.map(a=>a.category))];
  document.querySelector('#filters').innerHTML=categories.map(c=>`<button class="cs-filter-chip ${activeCategory===c?'cs-filter-chip--active':''}" aria-pressed="${activeCategory===c}" data-category="${c}">${c}</button>`).join('');
  document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{activeCategory=b.dataset.category; renderFilters(); renderActions();}));
}

function renderActions() {
  const q=document.querySelector('#action-search').value.trim().toLowerCase();
  const visible=actions.filter(a=>(activeCategory==='All'||a.category===activeCategory)&&(!favoritesOnly||a.favorite)&&(!q||[a.name,a.summary,a.category,...a.tags].join(' ').toLowerCase().includes(q)));
  document.querySelector('#action-count').textContent=`${visible.length} shown`;
  document.querySelector('#actions').innerHTML=visible.map((a,index)=>`<article class="cs-action-card ${a.disabled?'cs-action-card--disabled':''}"><header class="cs-action-card__header"><div><p class="cs-action-card__category">${a.category}</p><h3>${a.name}</h3></div><button class="cs-favorite ${a.favorite?'cs-favorite--active':''}" data-favorite="${actions.indexOf(a)}" aria-pressed="${!!a.favorite}" aria-label="Toggle favorite">☆</button></header><p class="cs-action-card__summary">${a.summary}</p><div class="cs-action-card__meta"><span><strong>Cost</strong> ${a.cost}</span>${a.tags.map(t=>`<span class="cs-tag">${t}</span>`).join('')}</div>${a.disabled?`<p class="cs-action-card__reason">Unavailable — ${a.disabled}</p>`:''}<button class="cs-action-card__perform" data-perform="${a.name}" ${a.disabled?'disabled':''}>◈ <span>${a.label}</span></button></article>`).join('') || '<p class="cs-empty">No actions match the current filters.</p>';
  document.querySelectorAll('[data-favorite]').forEach(b=>b.addEventListener('click',()=>{actions[Number(b.dataset.favorite)].favorite=!actions[Number(b.dataset.favorite)].favorite;renderActions();}));
  document.querySelectorAll('[data-perform]').forEach(b=>b.addEventListener('click',()=>toast(`Action intent: ${b.dataset.perform}`)));
}

function setTab(id) {
  document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===id;b.classList.toggle('cs-tab--active',active);b.setAttribute('aria-selected',String(active));});
  document.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==id);
}

document.querySelectorAll('[data-tab]').forEach((button,index,all)=>{
  button.addEventListener('click',()=>setTab(button.dataset.tab));
  button.addEventListener('keydown',event=>{let next=null;if(event.key==='ArrowRight')next=(index+1)%all.length;if(event.key==='ArrowLeft')next=(index-1+all.length)%all.length;if(event.key==='Home')next=0;if(event.key==='End')next=all.length-1;if(next!==null){event.preventDefault();all[next].focus();setTab(all[next].dataset.tab);}});
});

document.querySelector('#action-search').addEventListener('input',renderActions);
document.querySelector('#favorites-filter').addEventListener('click',event=>{favoritesOnly=!favoritesOnly;event.currentTarget.classList.toggle('cs-filter-toggle--active',favoritesOnly);event.currentTarget.setAttribute('aria-pressed',String(favoritesOnly));renderActions();});
document.querySelector('#theme-toggle').addEventListener('click',event=>{const body=document.body;const light=body.classList.toggle('cs-theme--parchment');body.classList.toggle('cs-theme--command',!light);event.currentTarget.textContent=light?'Use command theme':'Use parchment bridge';});

renderResources();renderStats();renderFilters();renderActions();
