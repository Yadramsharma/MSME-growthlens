const form = document.getElementById("assessmentForm");
const steps = [...document.querySelectorAll(".form-step")];
const stepLabel = document.getElementById("stepLabel");
const stepCount = document.getElementById("stepCount");
const progressBar = document.getElementById("progressBar");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const submitBtn = document.getElementById("submitBtn");
const analysis = document.getElementById("analysis");
const dashboard = document.getElementById("dashboard");
let currentStep = 0;
let latestData = null;
let latestResult = null;

const labels = ["Business Profile","Financial Health","Sales & Customers","Operations","Digital & Technology","Challenges & Review"];

document.querySelectorAll("[data-scroll]").forEach(btn => btn.addEventListener("click", () => {
  document.querySelector(btn.dataset.scroll)?.scrollIntoView({behavior:"smooth"});
}));

function getArray(name){
  return [...form.querySelectorAll(`input[name="${name}[]"]:checked`)].map(x=>x.value);
}
function formDataObject(){
  const fd = new FormData(form);
  const o = {};
  for(const [k,v] of fd.entries()){
    if(k.endsWith("[]")) continue;
    o[k] = v;
  }
  o.ops = getArray("ops");
  o.digital = getArray("digital");
  o.challenges = getArray("challenges");
  return o;
}
function updateStep(){
  steps.forEach((s,i)=>s.classList.toggle("active",i===currentStep));
  stepLabel.textContent = labels[currentStep];
  stepCount.textContent = `${currentStep+1} / ${steps.length}`;
  progressBar.style.width = `${((currentStep+1)/steps.length)*100}%`;
  prevBtn.style.visibility = currentStep===0 ? "hidden" : "visible";
  nextBtn.classList.toggle("hidden",currentStep===steps.length-1);
  submitBtn.classList.toggle("hidden",currentStep!==steps.length-1);
  if(currentStep===steps.length-1) buildReview();
}
function validateStep(){
  const active = steps[currentStep];
  const required = [...active.querySelectorAll("[required]")];
  for(const el of required){
    if(!el.value.trim()){
      el.focus();
      showToast("Please complete the required fields.");
      return false;
    }
  }
  return true;
}
nextBtn.addEventListener("click",()=>{ if(validateStep() && currentStep<steps.length-1){currentStep++;updateStep();} });
prevBtn.addEventListener("click",()=>{if(currentStep>0){currentStep--;updateStep();}});
function money(n){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number(n||0));}
function buildReview(){
  const d=formDataObject();
  document.getElementById("reviewBox").innerHTML = `
    <b>Review:</b> ${esc(d.business_name)} • ${esc(d.industry)} • ${d.employees||0} employees<br>
    Revenue: <b>${money(d.annual_revenue)}</b> • Profit: <b>${money(d.annual_profit)}</b> • Sales growth: <b>${d.sales_growth||0}%</b><br>
    Digital capabilities: <b>${d.digital.length}/8</b> • Operational issues selected: <b>${d.ops.length}</b>
  `;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

let analysisRunning=false;
async function startDiagnostic(){
  if(analysisRunning) return;
  if(!validateStep()) return;
  latestData=formDataObject();
  analysisRunning=true;
  submitBtn.disabled=true;
  submitBtn.textContent="Analyzing…";
  try{ await runAnalysis(latestData); }
  catch(err){
    console.error("Growth diagnostic error:",err);
    analysis.classList.add("hidden");
    document.getElementById("analyze").classList.remove("hidden");
    showToast("The diagnostic could not be completed. Please try again.");
  }
  finally{
    analysisRunning=false;
    submitBtn.disabled=false;
    submitBtn.textContent="Run Growth Diagnostic →";
  }
}
form.addEventListener("submit",e=>{e.preventDefault();startDiagnostic();});
submitBtn.addEventListener("click",startDiagnostic);

async function runAnalysis(d){
  document.getElementById("analyze").classList.add("hidden");
  analysis.classList.remove("hidden");
  analysis.scrollIntoView({behavior:"smooth",block:"start"});
  const ids=["a1","a2","a3","a4","a5","a6"];
  ids.forEach((id,i)=>{
    const el=document.getElementById(id);
    if(el){
      el.classList.remove("done");
      el.textContent=[
        "○ Business profile analyzed",
        "○ Financial indicators analyzed",
        "○ Sales & customer indicators analyzed",
        "○ Operational indicators analyzed",
        "○ Digital readiness analyzed",
        "○ Identifying growth constraints..."
      ][i];
    }
  });
  for(let i=0;i<ids.length;i++){
    await new Promise(r=>setTimeout(r,350));
    const el=document.getElementById(ids[i]);
    if(el){el.classList.add("done");el.textContent="✓ "+el.textContent.replace(/^○\s*/,"");}
  }
  latestResult=diagnose(d);
  try{ await saveToDatabase(d,latestResult); }catch(err){ console.warn("Local save failed:",err); }
  renderDashboard(d,latestResult);
  analysis.classList.add("hidden");
  dashboard.classList.remove("hidden");
  dashboard.scrollIntoView({behavior:"smooth",block:"start"});
}

function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}
function diagnose(d){
  const revenue=+d.annual_revenue||0, expenses=+d.annual_expenses||0, profit=+d.annual_profit||0;
  const margin=revenue?profit/revenue*100:0;
  const expenseRatio=revenue?expenses/revenue*100:100;
  const debtRatio=revenue?(+d.debt||0)/revenue*100:0;
  const finance=clamp(45 + margin*4 + (+d.working_capital||2)*7 + (+d.cash_flow||3)*4 - debtRatio*.35);
  const sales=clamp(25 + (+d.sales_growth||0)*4 + (+d.repeat_customers||0)*.45 + Math.min((+d.new_customers||0)*1.3,25));
  const capacity= (+d.capacity||0)>0 ? clamp((+d.output||0)/(+d.capacity||1)*100) : 60;
  const ops=clamp(capacity*.55 + Math.max(0,100-d.ops.length*10)*.45);
  const marketing=clamp(35 + Math.min((+d.marketing_spend||0)/(Math.max(revenue/1200,1)),25) + (d.digital.includes("Social Media")?15:0) + (d.digital.includes("Website")?10:0) + (d.digital.includes("Online Sales")?10:0));
  const digital=clamp(d.digital.length/8*100);
  const workforce=clamp(78 - Math.max(0,d.employees?0:25) - d.ops.includes("Productivity")*18);
  const areas=[
    {key:"Finance",score:Math.round(finance),reason:"Cash flow, profitability, working capital and debt indicators."},
    {key:"Sales & Customers",score:Math.round(sales),reason:"Sales growth, customer acquisition and repeat-customer indicators."},
    {key:"Operations",score:Math.round(ops),reason:"Capacity utilization and operational issues."},
    {key:"Marketing",score:Math.round(marketing),reason:"Marketing investment and market-reach indicators."},
    {key:"Technology",score:Math.round(digital),reason:"Digital tools and online business capabilities."},
    {key:"Workforce",score:Math.round(workforce),reason:"Employee availability and productivity indicators."}
  ];
  const overall=Math.round(areas.reduce((a,b)=>a+b.score,0)/areas.length);
  const bottleneck=[...areas].sort((a,b)=>a.score-b.score);
  const primary=bottleneck[0], secondary=bottleneck.slice(1,4);
  const recommendations = recommendationMap(primary.key,d);
  return {overall,areas,primary,secondary,recommendations,metrics:{margin,expenseRatio,debtRatio,capacity}};
}
function recommendationMap(key,d){
  const maps={
    "Sales & Customers":[
      ["Set customer acquisition targets","Track new leads, conversions and customer acquisition by channel every month."],
      ["Strengthen retention","Create a repeat-purchase or customer follow-up process and measure repeat-customer rate."],
      ["Measure sales funnel","Track enquiry → lead → order conversion so weak points can be identified."],
      ["Test channels","Compare offline, social, website and marketplace channels using measurable results."]
    ],
    "Marketing":[
      ["Track marketing ROI","Record spend and resulting leads/orders for each marketing channel."],
      ["Improve digital reach","Maintain a consistent website/social presence and clear product information."],
      ["Use targeted campaigns","Test small campaigns with a defined customer segment and measurable objective."],
      ["Build a simple content calendar","Plan weekly product, customer and educational content."]
    ],
    "Finance":[
      ["Monitor cash flow","Create a monthly cash-in/cash-out statement and rolling cash forecast."],
      ["Review cost structure","Separate fixed and variable costs and identify high-cost categories."],
      ["Protect working capital","Set minimum cash and inventory thresholds before expansion."],
      ["Track margins","Review product/service-level margins rather than revenue alone."]
    ],
    "Operations":[
      ["Measure capacity utilization","Compare available capacity with actual output each month."],
      ["Reduce bottlenecks","Track delays, rework, supplier issues and idle time."],
      ["Improve inventory controls","Set reorder points and monitor slow-moving inventory."],
      ["Standardize processes","Document repeatable production/service workflows and quality checks."]
    ],
    "Technology":[
      ["Start with digital basics","Use digital accounting, payments and structured business records."],
      ["Build customer visibility","Use a simple CRM or spreadsheet to track leads and repeat customers."],
      ["Digitize inventory","Track stock, reorder levels and movement electronically."],
      ["Measure online sales","Use website/marketplace analytics to understand customer behavior."]
    ],
    "Workforce":[
      ["Define roles","Document responsibilities and measurable outputs for each role."],
      ["Track productivity","Monitor output, quality and turnaround time by process."],
      ["Identify skill gaps","List critical skills and plan focused training."],
      ["Improve communication","Use simple daily/weekly operating reviews."]
    ]
  };
  return maps[key]||maps["Sales & Customers"];
}
function renderDashboard(d,r){
  document.getElementById("dashName").textContent=d.business_name;
  document.getElementById("dashMeta").textContent=`${d.industry||"Business"} • ${d.location||"Location not specified"} • ${d.employees||0} employees`;

  const score=r.overall;
  document.getElementById("overallScore").textContent=score;
  const ring=document.getElementById("scoreRing");
  ring.style.background=`conic-gradient(var(--primary) 0 ${score}%, #e9edf3 ${score}% 100%)`;
  const label=score>=75?"Strong":score>=55?"Moderate":"Needs attention";
  document.getElementById("scoreLabel").textContent=label;
  document.getElementById("statusPill").textContent=label;
  document.getElementById("statusPill").className="status-pill "+(score>=75?"status-strong":score>=55?"status-moderate":"status-attention");

  document.getElementById("snapRevenue").textContent=money(d.annual_revenue);
  document.getElementById("snapProfit").textContent=money(d.annual_profit);
  document.getElementById("snapEmployees").textContent=d.employees||0;
  document.getElementById("snapGrowth").textContent=(d.sales_growth||0)+"%";

  const bars=document.getElementById("healthBars");
  bars.innerHTML="";
  r.areas.forEach(a=>{
    const cls=a.score>=75?"good":a.score>=55?"mid":"low";
    bars.innerHTML+=`
      <div class="health-row enhanced-health-row">
        <div class="health-label"><span>${esc(a.key)}</span><small>${a.score>=75?"Healthy":a.score>=55?"Moderate":"Attention"}</small></div>
        <div class="track"><div class="fill ${cls}" style="width:${a.score}%"></div></div>
        <strong>${a.score}</strong>
      </div>`;
  });

  document.getElementById("primaryTitle").textContent=r.primary.key;
  document.getElementById("primaryScore").textContent=100-r.primary.score;
  document.getElementById("primaryReason").textContent=r.primary.reason;

  const indicators={
    "Sales & Customers":[`Sales growth: ${d.sales_growth||0}%`,`New customers/month: ${d.new_customers||0}`,`Repeat customers: ${d.repeat_customers||0}%`,`Marketing spend/month: ${money(d.marketing_spend)}`],
    "Finance":[`Profit margin: ${r.metrics.margin.toFixed(1)}%`,`Expense ratio: ${r.metrics.expenseRatio.toFixed(1)}%`,`Debt/revenue: ${r.metrics.debtRatio.toFixed(1)}%`,`Working capital level: ${d.working_capital||"—"}`],
    "Operations":[`Capacity utilization: ${r.metrics.capacity.toFixed(1)}%`,`Operational issues selected: ${d.ops.length}`,`Current output/month: ${d.output||0}`],
    "Marketing":[`Marketing spend/month: ${money(d.marketing_spend)}`,`Social media: ${d.digital.includes("Social Media")?"Yes":"No"}`,`Website: ${d.digital.includes("Website")?"Yes":"No"}`,`Online sales: ${d.digital.includes("Online Sales")?"Yes":"No"}`],
    "Technology":[`Digital capabilities: ${d.digital.length}/8`,`Online sales: ${d.digital.includes("Online Sales")?"Yes":"No"}`,`Digital accounting: ${d.digital.includes("Accounting")?"Yes":"No"}`],
    "Workforce":[`Employees: ${d.employees||0}`,`Productivity issue: ${d.ops.includes("Productivity")?"Selected":"Not selected"}`]
  };
  const ind=document.getElementById("primaryIndicators");
  ind.innerHTML=(indicators[r.primary.key]||[]).map(x=>`<li>${esc(x)}</li>`).join("");

  const sec=document.getElementById("secondaryList");
  sec.innerHTML=r.secondary.map((a,i)=>{
    const cls=a.score>=75?"good":a.score>=55?"mid":"low";
    return `<div class="secondary-item">
      <div class="secondary-top"><span>${i+2}. ${esc(a.key)}</span><strong>${a.score}</strong></div>
      <div class="mini-track"><i class="${cls}" style="width:${a.score}%"></i></div>
      <p>${esc(a.reason)}</p>
    </div>`;
  }).join("");

  document.getElementById("opportunityText").textContent =
    r.primary.score<55
      ? `Your lowest-scoring area is ${r.primary.key}. Addressing this constraint first can make later growth investments more measurable.`
      : `Your scores are relatively balanced. Focus on ${r.primary.key} first and monitor the next three indicators monthly.`;

  const rec=document.getElementById("recommendations");
  rec.innerHTML=r.recommendations.map((x,i)=>`
    <article class="rec enhanced-rec">
      <div class="rec-num">${String(i+1).padStart(2,"0")}</div>
      <div class="rec-content"><h4>${esc(x[0])}</h4><p>${esc(x[1])}</p></div>
      <span class="rec-arrow">→</span>
    </article>`).join("");

  const kpis=document.getElementById("kpiGrid");
  const kpiData=[
    ["Profit margin",`${r.metrics.margin.toFixed(1)}%`,"Finance"],
    ["Capacity utilization",`${r.metrics.capacity.toFixed(1)}%`,"Operations"],
    ["Repeat customers",`${d.repeat_customers||0}%`,"Sales"],
    ["Digital adoption",`${Math.round(d.digital.length/8*100)}%`,"Technology"],
    ["Debt / revenue",`${r.metrics.debtRatio.toFixed(1)}%`,"Finance"],
    ["Operational issues",`${d.ops.length}`,"Operations"]
  ];
  kpis.innerHTML=kpiData.map(k=>`<div class="kpi-card"><span>${esc(k[0])}</span><strong>${esc(k[1])}</strong><small>${esc(k[2])}</small></div>`).join("");

  setupSimulator(d);
}

function setupSimulator(d){
  const m=document.getElementById("simMarketing"), ret=document.getElementById("simRetention"), cap=document.getElementById("simCapacity");
  function update(){
    const revenue=+d.annual_revenue||0;
    const marketingBoost=(+m.value/(Math.max(+d.marketing_spend||1,1))-1)*.08;
    const retentionBoost=((+ret.value-(+d.repeat_customers||0))/100)*.18;
    const capacityBoost=((+cap.value-(latestResult.metrics.capacity||50))/100)*.12;
    const low=Math.max(0,revenue*(1+marketingBoost+retentionBoost+capacityBoost));
    const high=low*1.12;
    document.getElementById("simMarketingOut").textContent=money(m.value);
    document.getElementById("simRetentionOut").textContent=ret.value+"%";
    document.getElementById("simCapacityOut").textContent=cap.value+"%";
    document.getElementById("scenarioRevenue").textContent=`${money(low)} – ${money(high)}`;
  }
  [m,ret,cap].forEach(x=>x.oninput=update); update();
}
async function saveToDatabase(d,r){
  try{
    const record={saved_at:new Date().toISOString(),business:d,diagnostic:r};
    localStorage.setItem("msmeGrowthLensLatest",JSON.stringify(record));
    const history=JSON.parse(localStorage.getItem("msmeGrowthLensHistory")||"[]");
    history.unshift(record);
    localStorage.setItem("msmeGrowthLensHistory",JSON.stringify(history.slice(0,20)));
  }catch(err){ console.warn("Local save skipped:",err.message); }
}

document.getElementById("newAssessment").addEventListener("click",()=>{
  form.reset();
  currentStep=0;
  updateStep();
  dashboard.classList.add("hidden");
  analysis.classList.add("hidden");
  document.getElementById("analyze").classList.remove("hidden");
  document.getElementById("analyze").scrollIntoView({behavior:"smooth"});
});

function showToast(msg){
  const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);
  setTimeout(()=>t.remove(),2800);
}
window.addEventListener("error",e=>{
  console.error(e.error||e.message);
});
window.addEventListener("unhandledrejection",e=>{
  console.error(e.reason);
});

updateStep();
