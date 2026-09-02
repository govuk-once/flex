/* Everything project-specific comes from explorer.config.json, injected as CONFIG. */
const REPO=CONFIG.repo;
const STAGES=CONFIG.stages;
/* Named deployStage, not stage: `stage` is already the diagram canvas element. */
let deployStage="dev";
const stageLabel=()=>STAGES.find(s=>s.id===deployStage).label;

/* RES is built once from the Resources view, so the inventory is the single
   source of truth for both the table and every badge. */
const RES=new Map(), RES_GROUP=new Map();
function indexResources(){
  const rv=VIEWS.find(v=>v.id===CONFIG.inventoryView);
  rv.groups.forEach(g=>(g.items||[]).forEach(it=>{RES.set(it.id,it);RES_GROUP.set(it.id,g.name);}));
}
function countOf(item){
  if(item.n===null||item.n===undefined)return null;      // varies — never summed
  return typeof item.n==="number"?item.n:(item.n[deployStage]??0);
}
function boxTotal(ids){
  let sum=0,varies=false;
  (ids||[]).forEach(id=>{const it=RES.get(id);if(!it)return;const c=countOf(it);c===null?varies=true:sum+=c;});
  return {sum,varies};
}
/* The icon a CloudFormation type implies. Nothing outside the diagram boxes is tagged
   by hand — the type string already says which service it is. */
function iconForType(t){
  if(!t)return null;
  if(TYPE_ICON[t])return TYPE_ICON[t];
  const m=/^AWS::([A-Za-z0-9]+)::/.exec(t);
  return m&&SERVICE_ICON[m[1]]?SERVICE_ICON[m[1]]:null;
}
/* Inline markup, so it drops straight into the strings the inspector already builds. */
function iconTag(id,cls){
  if(!id||!ICON_IDS.includes(id))return "";
  return `<svg class="ic ${cls||""}" viewBox="0 0 64 64" aria-hidden="true"><use href="#i-${id}"/></svg>`;
}

/* ---- Export the canvas as an image -------------------------------------------------
   The diagram is live SVG, so an export has to be made self-contained first: the page
   stylesheet has to come with it, and the icon <symbol>s live in a different document
   from the canvas, so the ones in use have to be copied in or every <use> resolves to
   nothing. Then it is rasterised through a canvas at 2x. */
/* The bands the export adds around the drawing. On screen these live in the panel, where
   they cost no diagram space — an earlier version put the legend on the canvas and it
   collided with boxes. A PNG has no panel, though, so a bare drawing leaves the reader
   with no idea which view, which stage, or what the colours mean. */
const CAP_TOP=64, CAP_BOT=44, CAP_PAD=26;

function exportBands(w,h){
  const kinds=KIND_ORDER.filter(k=>view.nodes.some(n=>n.kind===k));
  const planes=PLANE_ORDER.filter(p=>view.nodes.some(n=>(n.plane||"request")===p));
  const t=(x,y,cls,txt)=>`<text x="${x}" y="${y}" class="${cls}">${esc(txt)}</text>`;
  let out=`<g class="cap">`
    +`<rect x="0" y="0" width="${w}" height="${CAP_TOP}" class="cap-bg"/>`
    +t(CAP_PAD,27,"cap-title",`${CONFIG.title} · ${view.name}`)
    +t(CAP_PAD,46,"cap-sub",`${view.audience} — ${stageLabel()} stage`)
    +`<line x1="0" y1="${CAP_TOP}" x2="${w}" y2="${CAP_TOP}" class="cap-rule"/>`
    +`<rect x="0" y="${h-CAP_BOT}" width="${w}" height="${CAP_BOT}" class="cap-bg"/>`
    +`<line x1="0" y1="${h-CAP_BOT}" x2="${w}" y2="${h-CAP_BOT}" class="cap-rule"/>`;
  let x=CAP_PAD, y=h-CAP_BOT+27;
  for(const k of kinds){
    out+=`<rect x="${x}" y="${y-9}" width="11" height="11" rx="2.5" fill="${kindVar(k)}"/>`
        +t(x+18,y,"cap-lg",KIND_LABEL[k]);
    x+=18+KIND_LABEL[k].length*6.6+24;
  }
  if(planes.length>1){
    x+=6;
    for(const pl of planes){
      out+=`<line x1="${x}" y1="${y-4}" x2="${x+16}" y2="${y-4}" class="cap-pl"`
          +(pl==="control"?` stroke-dasharray="5 3"`:``)+`/>`
          +t(x+23,y,"cap-lg",PLANE_LABEL[pl]);
      x+=23+PLANE_LABEL[pl].length*6.6+24;
    }
  }
  return out+`</g>`;
}

function standaloneSvg(){
  const src=document.getElementById("svg");
  const svg=src.cloneNode(true);
  const [,,w,vh]=(src.getAttribute("viewBox")||"0 0 1400 900").split(/\s+/).map(Number);
  const h=vh+CAP_TOP+CAP_BOT;
  svg.setAttribute("width",w); svg.setAttribute("height",h);
  svg.setAttribute("viewBox",`0 0 ${w} ${h}`);
  svg.removeAttribute("style");   /* re-set below, with the resolved theme */
  /* The live canvas is panned and zoomed by a transform; the export is the whole thing. */
  const root=svg.querySelector("#root");
  if(root)root.setAttribute("transform",`translate(0 ${CAP_TOP})`);

  /* Only the symbols this view actually references. */
  const used=[...new Set([...svg.querySelectorAll("use")]
    .map(u=>(u.getAttribute("href")||"").replace("#","")).filter(Boolean))];
  if(used.length){
    const defs=document.createElementNS("http://www.w3.org/2000/svg","defs");
    used.forEach(id=>{const sym=document.getElementById(id); if(sym)defs.appendChild(sym.cloneNode(true));});
    svg.insertBefore(defs,svg.firstChild);
  }

  /* Paint a ground: the page background is on <body>, which is not coming along. */
  const bg=document.createElementNS("http://www.w3.org/2000/svg","rect");
  bg.setAttribute("width",w); bg.setAttribute("height",h);
  bg.setAttribute("fill",getComputedStyle(document.body).getPropertyValue("--canvas").trim()||"#fff");
  svg.insertBefore(bg,svg.firstChild);

  const bands=document.createElementNS("http://www.w3.org/2000/svg","g");
  bands.innerHTML=exportBands(w,h);
  svg.appendChild(bands);

  /* Freeze the theme. The exported SVG carries the page stylesheet, but its :root is the
     <svg> — not <html> — so the data-theme attribute does not travel, and the
     prefers-color-scheme query is re-evaluated by whatever renders the image. Forcing
     light on a dark machine therefore produced a light canvas with dark boxes. Resolving
     every custom property here and pinning it inline settles it before it leaves. */
  const names=new Set();
  for(const el of document.querySelectorAll("style"))
    for(const m of el.textContent.matchAll(/(--[a-z0-9-]+)\s*:/g))names.add(m[1]);
  const live=getComputedStyle(document.documentElement);
  svg.setAttribute("style",[...names]
    .map(n=>`${n}:${live.getPropertyValue(n).trim()}`)
    .filter(d=>!d.endsWith(":")).join(";"));

  const style=document.createElementNS("http://www.w3.org/2000/svg","style");
  style.textContent=[...document.querySelectorAll("style")].map(s2=>s2.textContent).join("\n");
  svg.insertBefore(style,svg.firstChild);
  if(document.body.classList.contains("icons-on"))svg.classList.add("icons-on");
  return {markup:new XMLSerializer().serializeToString(svg),w,h};
}

function exportPng(){
  const {markup,w,h}=standaloneSvg();
  const SCALE=2;
  const img=new Image();
  img.onload=()=>{
    const c=document.createElement("canvas");
    c.width=w*SCALE; c.height=h*SCALE;
    const ctx=c.getContext("2d");
    ctx.scale(SCALE,SCALE);
    ctx.drawImage(img,0,0);
    c.toBlob(blob=>{
      if(!blob)return;
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download=`${CONFIG.slug}-${view.id}-${deployStage}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    },"image/png");
  };
  img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(markup);
}

/* Reverse index: which boxes, in which views, a resource appears in. */
const RES_PLACES=new Map();
function indexPlaces(){
  for(const vid in PLACEMENT) for(const nid in PLACEMENT[vid])
    PLACEMENT[vid][nid].forEach(rid=>{
      if(!RES_PLACES.has(rid))RES_PLACES.set(rid,[]);
      RES_PLACES.get(rid).push({view:vid,node:nid});
    });
}

/* Four ownership kinds, not nine mixed categories: who owns a box is the thing a
   reader must not get wrong. Plane (request vs control) rides on the border. */
const KIND_LABEL=Object.fromEntries(CONFIG.kinds.map(k=>[k.id,k.label]));
/* Fixed order. Insertion order put the same swatch in a different slot on every tab,
   which makes a legend unscannable — you cannot learn where to look. */
const KIND_ORDER=CONFIG.kinds.map(k=>k.id);
/* kind id -> palette colour, so nothing but the config knows which is which. */
const KIND_COLOUR=Object.fromEntries(CONFIG.kinds.map(k=>[k.id,k.colour]));
const kindVar=k=>`var(--legend-${KIND_COLOUR[k]})`;
const PLANE_ORDER=["request","control"];
/* Not "control plane": that term means the management API layer, and this flag also
   covers source files, runbooks, observability and people. What it encodes is only
   whether a thing serves live traffic, so the labels say only that. */
const PLANE_LABEL={request:"on the request path",control:"off the request path"};

/* ============================ RENDER ============================ */
const SVGNS="http://www.w3.org/2000/svg";
const svg=document.getElementById("svg"), root=document.getElementById("root");
const stage=document.getElementById("stage"), insp=document.getElementById("insp");
const doc=document.getElementById("doc"), hint=document.getElementById("hint"), ctrls=document.querySelector(".ctrls");
let filter="";
/* A set of resource ids carried over from a diagram box, so the Resources tab can show
   just that box's inventory. Cleared by the chip, or by switching tab. */
let pin=null;
let view=VIEWS[0], sel=null, nodeById=new Map(), edgeEls=new Map(), nodeEls=new Map(), zoneEls=new Map(), adj=new Map();
let vp={x:0,y:0,k:1};

const el=(n,a={})=>{const e=document.createElementNS(SVGNS,n);for(const k in a)e.setAttribute(k,a[k]);return e;};

function anchors(n){return{
  t:{x:n.x+n.w/2,y:n.y,nx:0,ny:-1}, b:{x:n.x+n.w/2,y:n.y+n.h,nx:0,ny:1},
  l:{x:n.x,y:n.y+n.h/2,nx:-1,ny:0}, r:{x:n.x+n.w,y:n.y+n.h/2,nx:1,ny:0}};}

function pickSides(a,b){
  const ac={x:a.x+a.w/2,y:a.y+a.h/2}, bc={x:b.x+b.w/2,y:b.y+b.h/2};
  const dx=bc.x-ac.x, dy=bc.y-ac.y;
  if(Math.abs(dx)>Math.abs(dy)*1.15) return dx>0?["r","l"]:["l","r"];
  return dy>0?["b","t"]:["t","b"];
}

function curve(a,b,sa,sb,mult){
  const p=anchors(a)[sa], q=anchors(b)[sb];
  const d=Math.hypot(q.x-p.x,q.y-p.y);
  const o=Math.max(34,Math.min(190,d*mult));
  return {d:`M ${p.x} ${p.y} C ${p.x+p.nx*o} ${p.y+p.ny*o}, ${q.x+q.nx*o} ${q.y+q.ny*o}, ${q.x} ${q.y}`,p,q};
}

/* A straight bezier between two boxes in the same column runs straight through
   whatever sits between them, which reads as a line touching a box it has no
   relationship with. So each edge is routed by trying the natural anchor pair,
   the perpendicular pair, and a wider bow of each, then keeping whichever
   sampled path clips the fewest unrelated boxes. */
function routeEdge(a,b,obstacles,probe){
  const [s1,t1]=pickSides(a,b);
  const horizontal=s1==="r"||s1==="l";
  const perp=horizontal
    ? (b.y+b.h/2>a.y+a.h/2?["b","t"]:["t","b"])
    : (b.x+b.w/2>a.x+a.w/2?["r","l"]:["l","r"]);
  /* Candidate order matters: direct routes are tried first so a tie always keeps
     the natural shape. The same-side pairs at the end leave from and arrive at
     the same face, which bows the line right around whatever sits between the
     two boxes — the only way past an obstacle directly in the way. */
  const direct=[[s1,t1],perp];
  const detour=horizontal?[["t","t"],["b","b"]]:[["l","l"],["r","r"]];
  let best=null;
  for(const [sa,sb] of direct)
    for(const mult of [0.42,0.85]){
      const cand=curve(a,b,sa,sb,mult);
      const score=clipCount(cand.d,obstacles,probe);
      if(!best||score<best.score)best={...cand,score};
      if(score===0)return best;
    }
  if(best.score>0)
    for(const [sa,sb] of detour)
      for(const mult of [0.55,1.0]){
        const cand=curve(a,b,sa,sb,mult);
        const score=clipCount(cand.d,obstacles,probe);
        if(score<best.score)best={...cand,score};
        if(score===0)return best;
      }
  return best;
}
function clipCount(d,obstacles,probe){
  probe.setAttribute("d",d);
  const L=probe.getTotalLength();
  if(!L)return 0;
  let hits=0;
  for(let i=1;i<L;i+=8){
    const pt=probe.getPointAtLength(i);
    for(const o of obstacles)
      if(pt.x>o.x+2&&pt.x<o.x+o.w-2&&pt.y>o.y+2&&pt.y<o.y+o.h-2){hits++;break;}
  }
  return hits;
}

function build(){
  const isDoc=view.type==="doc";
  svg.hidden=isDoc; doc.hidden=!isDoc; hint.hidden=isDoc; /* Only zoom and export depend on a canvas. Icons show on the inventory rows too, and
     the theme is page-wide — hiding those left a reader able to see icons on the
     Resources tab with no way to turn them off. */
  ctrls.querySelectorAll(".canvas-only").forEach(g=>{g.hidden=isDoc;});
  svg.style.display=isDoc?"none":"block";
  /* The stage selector only means something where per-stage counts are shown. */
  const staged=isDoc?view.id===CONFIG.inventoryView:Object.keys(PLACEMENT[view.id]||{}).length>0;
  document.querySelector(".stagepick").hidden=!staged;
  renderTables(); renderViewHeader();
  /* Clear whichever pane is not in use. A hidden pane that keeps its DOM leaves
     stale rows addressable — they index into a view that no longer has groups. */
  if(isDoc){root.textContent="";nodeEls=new Map();edgeEls=new Map();zoneEls=new Map();buildDoc();return;}
  doc.textContent="";
  root.textContent=""; nodeById=new Map(); edgeEls=new Map(); nodeEls=new Map(); zoneEls=new Map(); adj=new Map();
  svg.setAttribute("viewBox",`0 0 ${view.w} ${view.h}`);
  view.nodes.forEach(n=>{nodeById.set(n.id,n);adj.set(n.id,[]);});

  /* Detached measuring path — never rendered, removed once routing is done. */
  const probe=el("path"); probe.setAttribute("fill","none"); probe.setAttribute("stroke","none");
  root.appendChild(probe);

  const defs=el("defs");
  ["arrow","arrowsel"].forEach(id=>{
    const m=el("marker",{id,viewBox:"0 0 10 10",refX:"9",refY:"5",markerWidth:"6",markerHeight:"6",orient:"auto-start-reverse"});
    m.appendChild(el("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:id==="arrow"?"var(--line-strong)":"var(--accent)"}));
    defs.appendChild(m);
  });
  root.appendChild(defs);

  /* Four layers: zones, edge lines, nodes, then edge labels on top. Labels are
     drawn last because a label hidden behind a box is worse than one that clips
     a box edge — the line itself still sits under the nodes. */
  const gz=el("g"), ge=el("g"), gn=el("g"), gl=el("g");
  root.append(gz,ge,gn,gl);

  view.zones.forEach(z=>{
    const zres=z.id&&PLACEMENT[view.id]?.[z.id];
    const g=el("g",{class:`zone ${z.hard?"hard":"soft"}`+(zres?" clickable":"")});
    g.appendChild(el("rect",{x:z.x,y:z.y,width:z.w,height:z.h,rx:12}));
    const t=el("text",{x:z.x+16,y:z.y+24}); t.textContent=z.label; g.appendChild(t);
    if(zres){
      g.setAttribute("tabindex","0"); g.setAttribute("role","button"); g.setAttribute("aria-label",z.label);
      const {sum,varies}=boxTotal(zres);
      const txt=varies&&!sum?"~":String(sum)+(varies?"+":"");
      const w=Math.max(22,txt.length*7+14);
      g.appendChild(el("rect",{class:"badge",x:z.x+z.w-w/2-6,y:z.y-8,width:w,height:17,rx:8.5}));
      const bt=el("text",{class:"badge-t",x:z.x+z.w-6,y:z.y+4}); bt.textContent=txt; g.appendChild(bt);
      const pick=ev=>{if(window.__panned)return;ev.stopPropagation();select({t:"zone",id:z.id});};
      g.addEventListener("click",pick);
      g.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();pick(ev);}});
      zoneEls.set(z.id,{g,z});
    }
    gz.appendChild(g);
  });

  const placedLabels=[];
  const obstacles=view.nodes.map(n=>({x:n.x,y:n.y,w:n.w,h:n.h}));
  view.edges.forEach((e,i)=>{
    const a=nodeById.get(e.from), b=nodeById.get(e.to);
    if(!a||!b) return;
    const id=`e${i}`; e._id=id;
    const {d}=routeEdge(a,b,view.nodes.filter(n=>n.id!==a.id&&n.id!==b.id),probe);
    const g=el("g",{class:`edge ${e.style||""}`,tabindex:"0",role:"button","aria-label":`${a.label} to ${b.label}${e.label?": "+e.label:""}`});
    const line=el("path",{d,class:"line","marker-end":"url(#arrow)"});
    if(e.dir==="both") line.setAttribute("marker-start","url(#arrow)");
    g.appendChild(el("path",{d,class:"hit"}));
    g.appendChild(line);
    ge.appendChild(g);

    /* A bundled edge deliberately carries no label — one label speaks for the whole
       trunk. It still gets a hit area, a name and an inspector entry. */
    let lg=null;
    if(e.label){
      const L=line.getTotalLength();
      lg=el("g",{class:`edgelbl ${e.style||""}`});
      const bg=el("rect",{class:"lblbg",rx:3}), tx=el("text",{class:"lbl","text-anchor":"middle"});
      tx.textContent=e.label; lg.append(bg,tx);
      gl.appendChild(lg);
      /* Slide the label along its own path until it stops colliding with one already
         placed. Two labels sitting on top of each other is unreadable in a way that a
         label 15% off-centre never is. */
      let best=null,bestScore=Infinity;
      for(const t of [0.5,0.4,0.6,0.3,0.7,0.22,0.78,0.15,0.85]){
        const pt=line.getPointAtLength(L*t);
        tx.setAttribute("x",pt.x); tx.setAttribute("y",pt.y+3.5);
        const b=tx.getBBox();
        const box={x:b.x-4,y:b.y-2,w:b.width+8,h:b.height+4};
        const overlap=o=>Math.max(0,Math.min(box.x+box.w,o.x+o.w)-Math.max(box.x,o.x))
                        *Math.max(0,Math.min(box.y+box.h,o.y+o.h)-Math.max(box.y,o.y));
        // A label on another label is worse than a label clipping a box corner.
        let score=0;
        placedLabels.forEach(o=>{score+=overlap(o)*3;});
        obstacles.forEach(o=>{score+=overlap(o);});
        if(score<bestScore){bestScore=score;best=box;}
        if(score===0)break;
      }
      /* If the best position still buries the label under something, do not draw it.
         An unreadable label is worse than none: the edge stays clickable and the
         inspector carries the protocol, the auth and what travels over it. */
      if(bestScore>best.w*best.h*0.25){
        lg.remove(); lg=null;
        g.setAttribute("aria-label",`${a.label} to ${b.label}: ${e.label}`);
      }
      if(lg){
        tx.setAttribute("x",best.x+best.w/2); tx.setAttribute("y",best.y+best.h-4);
        bg.setAttribute("x",best.x);bg.setAttribute("y",best.y);
        bg.setAttribute("width",best.w);bg.setAttribute("height",best.h);
        placedLabels.push(best);
      }
      if(lg){
        lg.addEventListener("click",ev=>{if(window.__panned)return;ev.stopPropagation();select({t:"edge",id});});
        lg.addEventListener("mouseenter",()=>{if(!sel)focus(new Set([a.id,b.id]),new Set([id]));});
        lg.addEventListener("mouseleave",()=>{if(!sel)clearFocus();});
      }
    }

    edgeEls.set(id,{g,lg,e});
    adj.get(a.id).push({e,other:b,out:true});
    adj.get(b.id).push({e,other:a,out:false});
    g.addEventListener("click",ev=>{if(window.__panned)return;ev.stopPropagation();select({t:"edge",id});});
    g.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();select({t:"edge",id});}});
    g.addEventListener("mouseenter",()=>{if(!sel)focus(new Set([a.id,b.id]),new Set([id]));});
    g.addEventListener("mouseleave",()=>{if(!sel)clearFocus();});
  });

  probe.remove();

  view.nodes.forEach(n=>{
    const g=el("g",{class:`node n-${n.kind} p-${n.plane||"request"}`,tabindex:"0",role:"button",
      "aria-label":n.label,style:`--kind:${kindVar(n.kind)}`});
    g.appendChild(el("rect",{class:"box",x:n.x,y:n.y,width:n.w,height:n.h,rx:8}));
    g.appendChild(el("rect",{class:"bar",x:n.x,y:n.y,width:4,height:n.h,rx:2}));
    const hasSub=!!n.sub;
    const t=el("text",{class:"t",x:n.x+16,y:n.y+(hasSub?n.h/2-2:n.h/2+5)}); t.textContent=n.label; g.appendChild(t);
    if(hasSub){const s=el("text",{class:"s",x:n.x+16,y:n.y+n.h/2+15}); s.textContent=n.sub; g.appendChild(s);}

    /* Service icon on the top-left corner, mirroring the count badge opposite. Riding
       the corner keeps it clear of the label, so turning icons on never reflows text
       and the box widths stay valid either way. */
    /* An explicit icon wins; otherwise the CloudFormation type says which service it is. */
    const nicon=n.icon||iconForType(n.d.type);
    if(nicon&&ICON_IDS.includes(nicon)){
      const ic=el("g",{class:"icon"});
      ic.appendChild(el("rect",{class:"icon-bg",x:n.x+8,y:n.y-11,width:22,height:22,rx:5}));
      const u=el("use",{x:n.x+11,y:n.y-8,width:16,height:16});
      u.setAttribute("href","#i-"+nicon);
      ic.appendChild(u); g.appendChild(ic);
    }

    /* Count badge, centred on the top-right corner so it can never collide with
       the label text no matter how wide that label is. */
    const ids=PLACEMENT[view.id]?.[n.id];
    if(ids&&ids.length){
      const {sum,varies}=boxTotal(ids);
      const txt=varies&&!sum?"~":String(sum)+(varies?"+":"");
      const w=Math.max(22,txt.length*7+14);
      g.appendChild(el("rect",{class:"badge"+(varies?" partial":""),x:n.x+n.w-w/2-6,y:n.y-8,width:w,height:17,rx:8.5}));
      const bt=el("text",{class:"badge-t",x:n.x+n.w-6,y:n.y+4}); bt.textContent=txt; g.appendChild(bt);
      if(sum===0&&!varies)g.classList.add("absent");
    }
    gn.appendChild(g); nodeEls.set(n.id,{g,n});
    g.addEventListener("click",ev=>{if(window.__panned)return;ev.stopPropagation();select({t:"node",id:n.id});});
    g.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();select({t:"node",id:n.id});}});
    g.addEventListener("mouseenter",()=>{if(!sel)focusNode(n.id);});
    g.addEventListener("mouseleave",()=>{if(!sel)clearFocus();});
  });
}

function focus(nodeIds,edgeIds){
  nodeEls.forEach((v,id)=>v.g.classList.toggle("dim",!nodeIds.has(id)));
  edgeEls.forEach((v,id)=>{const d=!edgeIds.has(id);v.g.classList.toggle("dim",d);v.lg&&v.lg.classList.toggle("dim",d);});
}
function focusNode(id){
  const ns=new Set([id]), es=new Set();
  (adj.get(id)||[]).forEach(({e,other})=>{ns.add(other.id);es.add(e._id);});
  focus(ns,es);
}
function clearFocus(){
  nodeEls.forEach(v=>v.g.classList.remove("dim"));
  edgeEls.forEach(v=>{v.g.classList.remove("dim");v.lg&&v.lg.classList.remove("dim");});
}
function clearSel(){
  sel=null; clearFocus();
  nodeEls.forEach(v=>v.g.classList.remove("sel"));
  zoneEls.forEach(v=>v.g.classList.remove("sel"));
  edgeEls.forEach(v=>{v.g.classList.remove("sel");v.lg&&v.lg.classList.remove("sel");});
  renderIdle();
}

function select(s){
  sel=s;
  nodeEls.forEach(v=>v.g.classList.remove("sel"));
  edgeEls.forEach(v=>{v.g.classList.remove("sel");v.lg&&v.lg.classList.remove("sel");});
  zoneEls.forEach(v=>v.g.classList.remove("sel"));
  if(s.t==="zone"){
    const {g,z}=zoneEls.get(s.id); g.classList.add("sel"); clearFocus(); renderZone(z);
  }
  else if(s.t==="node"){nodeEls.get(s.id).g.classList.add("sel");focusNode(s.id);renderNode(nodeById.get(s.id));}
  else{
    const {g,lg,e}=edgeEls.get(s.id); g.classList.add("sel"); lg&&lg.classList.add("sel");
    focus(new Set([e.from,e.to]),new Set([s.id])); renderEdge(e);
  }
  insp.scrollTop=0;
}

/* ============================ INSPECTOR ============================ */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
/* Authored copy is full of literal angle brackets — /gateways/<name>/{proxy+},
   /<env>/<service>/…, <stage>.<zone> — so everything is escaped first and only the three
   inline tags this file actually uses are restored. Escaping alone would show the
   markup; not escaping would silently swallow <name> as an unknown element. */
const RICH_TAGS=/&lt;(\/?)(b|code|i)&gt;/g;
const rich=t=>esc(t).replace(RICH_TAGS,"<$1$2>");
const facts=a=>a&&a.length?`<ul class="facts">${a.map(f=>`<li>${rich(f)}</li>`).join("")}</ul>`:"";
const codes=a=>a&&a.length?`<div class="sect"><div class="eyebrow">In the repo</div><div class="code">${a.map(([l,p])=>`<a href="${REPO}${p}" target="_blank" rel="noopener">${esc(l)}</a>`).join("")}</div></div>`:"";

function renderIdle(){
  if(view.type==="doc"){
    const n=view.groups.reduce((a,g)=>a+(g.items||[]).length,0);
    const t=view.groups.filter(g=>g.table).length;
    insp.innerHTML=`
      <div>
        <div class="eyebrow">${esc(view.name)} view</div>
        <h1 class="insp-title">${esc(view.name)}</h1>
        <p class="insp-sub">${esc(view.blurb)}</p>
      </div>
      <div class="card">
        <div class="eyebrow" style="margin-bottom:9px">How to read it</div>
        <ul class="facts">
          <li>Pick any row to open its full configuration here.</li>
          <li>Filter matches names, counts, scope tags and every fact — so <code>isolated</code>, <code>us-east-1</code> or <code>365 days</code> all work.</li>
          <li>Tables are the reference data itself and need no clicking.</li>
        </ul>
      </div>
      <div class="sect">
        <div class="eyebrow">This view</div>
        <dl class="kv"><dt>Sections</dt><dd>${view.groups.length}</dd><dt>Entries</dt><dd>${n}</dd><dt>Tables</dt><dd>${t}</dd></dl>
      </div>`;
    return;
  }
  const kinds=[...new Set(view.nodes.map(n=>n.kind))];
  const planes=[...new Set(view.nodes.map(n=>n.plane||"request"))];
  insp.innerHTML=`
    <div>
      <div class="eyebrow">${esc(view.name)} view</div>
      <h1 class="insp-title">${esc(view.name)}</h1>
      <p class="insp-sub">${esc(view.blurb)}</p>
    </div>
    <div class="card">
      <div class="eyebrow" style="margin-bottom:9px">How to read it</div>
      <ul class="facts">
        <li>Click any box to see what it is and everything it connects to.</li>
        <li>Click any line to see the protocol, the auth and what actually travels over it.</li>
        <li>Hover to isolate one thing; press Escape to clear the selection.</li>
      </ul>
    </div>
    <div class="sect">
      <div class="eyebrow">This view</div>
      <dl class="kv"><dt>Boxes</dt><dd>${view.nodes.length}</dd><dt>Lines</dt><dd>${view.edges.length}</dd></dl>
    </div>`;
}

function renderNode(n){
  const links=(adj.get(n.id)||[]).map(({e,other,out})=>
    `<button class="conn" data-edge="${e._id}"><span class="arw">${out?"→":"←"}</span><span><b>${esc(other.label)}</b> · ${esc(e.label)}</span></button>`).join("");
  insp.innerHTML=`
    <div>
      <span class="chip" style="color:${kindVar(n.kind)}"><i></i>${esc(KIND_LABEL[n.kind])}</span>
      <h1 class="insp-title">${esc(n.label)}</h1>
      ${n.sub?`<p class="insp-sub mono">${esc(n.sub)}</p>`:""}
    </div>
    <dl class="kv"><dt>Type</dt><dd>${esc(n.d.type)}</dd><dt>Technology</dt><dd>${iconTag(n.icon||iconForType(n.d.type))}${esc(n.d.tech)}</dd><dt>Plane</dt><dd>${esc(PLANE_LABEL[n.plane||"request"])}</dd></dl>
    <p style="margin:0;font-size:14px;color:var(--ink-2)">${esc(n.d.role)}</p>
    ${facts(n.d.facts)}
    ${resourcesHere(n.id)}
    ${links?`<hr><div class="sect"><div class="eyebrow">Connections · ${(adj.get(n.id)||[]).length}</div><div class="conns">${links}</div></div>`:""}
    ${codes(n.d.code)}`;
  wireConns(); wireRes();
}

function renderZone(z){
  insp.innerHTML=`
    <div>
      <span class="chip" style="color:var(--accent)"><i></i>Boundary</span>
      <h1 class="insp-title">${esc(z.label)}</h1>
    </div>
    <dl class="kv"><dt>Type</dt><dd>${esc(z.d?.type||"Grouping")}</dd><dt>Technology</dt><dd>${esc(z.d?.tech||"—")}</dd></dl>
    ${z.d?.role?`<p style="margin:0;font-size:14px;color:var(--ink-2)">${esc(z.d.role)}</p>`:""}
    ${facts(z.d?.facts)}
    ${resourcesHere(z.id)}`;
  wireRes();
}
function resourcesHere(nodeId){
  const ids=PLACEMENT[view.id]?.[nodeId];
  if(!ids||!ids.length)return "";
  const {sum,varies}=boxTotal(ids);
  const rows=ids.map(id=>{
    const it=RES.get(id); if(!it)return "";
    const c=countOf(it);
    return `<button class="resrow" data-res="${id}" data-from="${nodeId}">
      <span class="num${c===0?" zero":""}">${c===null?"~":c}</span>
        ${iconTag(iconForType(it.d.type),"sm")}
      <span>${esc(it.name)}</span></button>`;
  }).join("");
  return `<hr>
    <div class="sect">
      <div class="eyebrow">Resources in this box · ${esc(stageLabel())}</div>
      <div class="total"><b>${sum}${varies?"+":""}</b><span>AWS resources across ${ids.length} entr${ids.length===1?"y":"ies"}${varies?", plus some that vary per stack":""}</span></div>
      <div class="reslist">${rows}</div>
      <button class="btn wide" data-pin="${nodeId}" type="button">Open these in the Resources tab</button>
    </div>`;
}
function wireRes(){
  insp.querySelectorAll("[data-res]").forEach(b=>b.addEventListener("click",()=>{
    renderItem(RES.get(b.dataset.res),RES_GROUP.get(b.dataset.res),{node:b.dataset.from});
    insp.scrollTop=0;
  }));
  insp.querySelectorAll("[data-pin]").forEach(b=>b.addEventListener("click",()=>{
    const nodeId=b.dataset.pin;
    const ids=PLACEMENT[view.id]?.[nodeId]||[];
    const label=nodeById.get(nodeId)?.label||nodeId;
    const rv=VIEWS.find(v=>v.id===CONFIG.inventoryView);
    const tab=[...tabs.children].find(c=>c.textContent===rv.name);
    if(tab)tab.click();                       /* resets view, filter and pin */
    pin={ids:new Set(ids),label};
    buildDoc();
  }));
  insp.querySelectorAll("[data-back]").forEach(b=>b.addEventListener("click",()=>select({t:"node",id:b.dataset.back})));
  insp.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>{
    const [vid,nid]=b.dataset.goto.split("|");
    const tab=[...tabs.children].find(c=>c.textContent===VIEWS.find(v=>v.id===vid).name);
    if(tab&&view.id!==vid)tab.click();
    select({t:"node",id:nid});
  }));
}
function renderEdge(e){
  const a=nodeById.get(e.from), b=nodeById.get(e.to);
  insp.innerHTML=`
    <div>
      <span class="chip" style="color:var(--accent)"><i></i>Relationship</span>
      <h1 class="insp-title">${esc(e.label||`${a.label} → ${b.label}`)}</h1>
      <p class="insp-sub mono">${esc(a.label)} ${e.dir==="both"?"↔":"→"} ${esc(b.label)}</p>
    </div>
    <dl class="kv">
      <dt>Protocol</dt><dd>${esc(e.d.protocol)}</dd>
      <dt>Auth</dt><dd>${esc(e.d.auth)}</dd>
      <dt>Carries</dt><dd>${esc(e.d.carries)}</dd>
    </dl>
    ${facts(e.d.facts)}
    <hr>
    <div class="sect"><div class="eyebrow">Endpoints</div><div class="conns">
      <button class="conn" data-node="${a.id}"><span class="arw">from</span><span><b>${esc(a.label)}</b></span></button>
      <button class="conn" data-node="${b.id}"><span class="arw">to</span><span><b>${esc(b.label)}</b></span></button>
    </div></div>
    ${codes(e.d.code)}`;
  wireConns();
}

function wireConns(){
  insp.querySelectorAll("[data-edge]").forEach(b=>b.addEventListener("click",()=>select({t:"edge",id:b.dataset.edge})));
  insp.querySelectorAll("[data-node]").forEach(b=>b.addEventListener("click",()=>select({t:"node",id:b.dataset.node})));
}

/* A merged diagram + reference tab (Network) keeps its tables under the drawing
   rather than in the 372px inspector, where a six-column table is unreadable. */
/* Collapsed by default: the drawing is the point, the tables are the drill-down.
   The choice persists across tabs so someone reading tables is not re-opening them. */
let tablesOpen=false;
/* Mutates state in place rather than re-rendering. Rebuilding the strip destroyed the
   button holding focus, so a keyboard user could open the tables but never close them. */
function setTablesOpen(open){
  tablesOpen=open;
  const head=document.querySelector("#tbl-toggle");
  stage.classList.toggle("split",open);
  if(head){
    head.setAttribute("aria-expanded",String(open));
    head.querySelector(".tbl-hint").textContent=open?"hide":"show";
  }
  fit();                                   // the canvas just changed size
  if(open){const body=document.getElementById("tbl-body"); if(body)body.scrollTop=0;}
}
function renderTables(){
  const box=document.getElementById("tables");
  const t=view.type!=="doc"&&Array.isArray(view.tables)?view.tables:[];
  box.hidden=!t.length;
  stage.classList.toggle("has-tables",!!t.length);
  stage.classList.toggle("split",!!t.length&&tablesOpen);
  if(!t.length){box.textContent="";return;}
  const names=t.map(x=>x.name).join(" · ");
  box.innerHTML=`
    <button class="tbl-head" id="tbl-toggle" aria-expanded="${tablesOpen}" aria-controls="tbl-body">
      <span class="caret" aria-hidden="true"></span>
      <span class="tbl-title">Reference tables</span>
      <span class="tbl-names">${esc(names)}</span>
      <span class="tbl-hint">${tablesOpen?"hide":"show"}</span>
    </button>
    <div class="tbl-body" id="tbl-body">${
      t.map(x=>`<section class="grp"><h2>${esc(x.name)}</h2>${x.note?`<p class="gnote">${rich(x.note)}</p>`:""}${tableHtml(x)}${codes(x.code)}</section>`).join("")
    }</div>`;
  box.querySelector("#tbl-toggle").addEventListener("click",()=>setTablesOpen(!tablesOpen));
}

/* Colour carries ownership, border carries plane. They are two axes, so the legend
   shows them as two groups rather than one flat list of peers. */
function legendHtml(){
  if(view.type==="doc"||!view.nodes)return "";
  const kinds=KIND_ORDER.filter(k=>view.nodes.some(n=>n.kind===k));
  const planes=PLANE_ORDER.filter(p=>view.nodes.some(n=>(n.plane||"request")===p));
  return `<div class="legend">`
    +kinds.map(k=>`<span class="lg-item" style="color:${kindVar(k)}"><i class="sw"></i>${esc(KIND_LABEL[k])}</span>`).join("")
    +(planes.length>1?`<span class="lg-sep"></span>`+planes.map(p=>
       `<span class="lg-item"><i class="sw pl-${p}"></i>${esc(PLANE_LABEL[p])}</span>`).join(""):"")
    +`</div>`;
}

/* Pinned to the top of the panel, so it is still there once something is selected. */
function renderViewHeader(){
  document.getElementById("viewhdr").innerHTML=`
    <div class="eyebrow">${esc(view.name)}</div>
    ${view.audience?`<p class="audience"><span>For</span>${esc(view.audience)}</p>`:""}
    ${legendHtml()}`;
}

/* ============================ DOC VIEWS ============================ */
function matches(item,q){
  if(pin&&!pin.ids.has(item.id))return false;
  if(!q)return true;
  const hay=[item.id,item.name,(item.meta||[]).join(" "),item.d.type,item.d.tech,item.d.role,(item.d.facts||[]).join(" ")].join(" ").toLowerCase();
  return q.split(/\s+/).filter(Boolean).every(t=>hay.includes(t));
}
function buildDoc(){
  const q=filter.trim().toLowerCase();
  let shown=0,total=0;
  const groups=view.groups.map((g,gi)=>{
    const items=(g.items||[]);
    total+=items.length;
    const keep=items.filter(it=>matches(it,q));
    shown+=keep.length;
    const tableVisible=!pin&&(!q||g.name.toLowerCase().includes(q));
    if(!keep.length&&!(g.table&&tableVisible))return "";
    const rows=keep.map(it=>{
      const gi2=gi, ii=items.indexOf(it), c=countOf(it), note=!it.id;
      return `<button class="row${!note&&c===0?" zero":""}" data-g="${gi2}" data-i="${ii}">
        <span>${iconTag(iconForType(it.d.type),"sm")}<b>${esc(it.name)}</b></span>
        <span class="rcount">${note?"design note":c===null?"varies":c===0?`none in ${esc(stageLabel().toLowerCase())}`:`${c}\u00d7`}</span>
        <span class="rmeta">${(it.meta||[]).map(m=>`<span class="tag">${esc(m)}</span>`).join("")}</span>
      </button>`;}).join("");
    return `<section class="grp">
      <h2>${esc(g.name)}</h2>
      ${g.note?`<p class="gnote">${rich(g.note)}</p>`:""}
      ${g.table&&tableVisible?tableHtml(g.table):""}
      ${rows?`<div class="rows">${rows}</div>`:""}
    </section>`;
  }).join("");
  doc.innerHTML=`
    <div class="doc-head">
      <h1>${esc(view.name)}</h1>
      <p>${esc(view.blurb)}</p>
      ${view.note?`<div class="doc-note">${rich(view.note)}</div>`:""}
    </div>
    <div class="filterbar">
      <input id="q" type="search" placeholder="${esc(CONFIG.filterHint)}" value="${esc(filter)}" aria-label="Filter resources">
      <span class="count">${shown} of ${total} entries${view.id===CONFIG.inventoryView&&!pin?` · ${stageTotal()} resources in ${esc(stageLabel().toLowerCase())}`:""}</span>
        ${pin?`<span class="pinchip">Showing only what is in <b>${esc(pin.label)}</b><button id="unpin" type="button" aria-label="Show all resources">Clear</button></span>`:""}
    </div>
    ${groups||`<p class="empty">Nothing matches “${esc(filter)}”.</p>`}`;
  const qi=doc.querySelector("#q");
  qi.addEventListener("input",()=>{
    const pos=qi.selectionStart; filter=qi.value; buildDoc();
    const nq=doc.querySelector("#q"); nq.focus(); nq.setSelectionRange(pos,pos);
  });
  const un=doc.querySelector("#unpin");
  if(un)un.addEventListener("click",()=>{pin=null;buildDoc();});
  doc.querySelectorAll(".row").forEach(b=>b.addEventListener("click",()=>{
    doc.querySelectorAll(".row").forEach(r=>r.classList.remove("sel"));
    b.classList.add("sel");
    renderItem(view.groups[+b.dataset.g].items[+b.dataset.i],view.groups[+b.dataset.g].name);
    insp.scrollTop=0;
  }));
}
function tableHtml(t){
  return `<div class="tbl-wrap"><table>
    <thead><tr>${t.cols.map(c=>`<th>${rich(c)}</th>`).join("")}</tr></thead>
    <tbody>${t.rows.map(r=>`<tr>${r.map(c=>`<td>${rich(c)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}
function renderItem(it,groupName,ctx){
  const c=countOf(it);
  const places=(RES_PLACES.get(it.id)||[]).filter(pl=>!(ctx&&ctx.node===pl.node&&view.id===pl.view));
  const placeRows=places.map(pl=>{
    const v=VIEWS.find(x=>x.id===pl.view);
    const nd=v.nodes.find(x=>x.id===pl.node);
    return nd?`<button class="resrow" data-goto="${pl.view}|${pl.node}"><span>${esc(v.name)} → <b>${esc(nd.label)}</b></span></button>`:"";
  }).join("");
  insp.innerHTML=`
    ${ctx&&ctx.node?`<button class="backlink" data-back="${ctx.node}">← back to ${esc((view.nodes.find(x=>x.id===ctx.node)||{}).label||"the box")}</button>`:""}
    <div>
      <span class="chip" style="color:var(--accent)"><i></i>${esc(groupName)}</span>
      <h1 class="insp-title">${esc(it.name)}</h1>
    </div>
    ${it.id?`<div class="total"><b>${c===null?"~":c}</b><span>${c===null?"varies — counted per stack, not summed":`in ${esc(stageLabel())}${c===0?" this resource is not created":""}`}</span></div>`:""}
    <dl class="kv"><dt>Resource</dt><dd class="mono" style="font-size:12px">${iconTag(iconForType(it.d.type))}${esc(it.d.type)}</dd><dt>Config</dt><dd>${rich(it.d.tech)}</dd></dl>
    <p style="margin:0;font-size:14px;color:var(--ink-2)">${esc(it.d.role)}</p>
    ${facts(it.d.facts)}
    ${(it.meta||[]).length?`<div class="sect"><div class="eyebrow">Scope</div><div class="rmeta" style="justify-content:flex-start">${it.meta.map(m=>`<span class="tag">${esc(m)}</span>`).join("")}</div></div>`:""}
    ${placeRows?`<hr><div class="sect"><div class="eyebrow">Also shown in</div><div class="reslist">${placeRows}</div></div>`:""}
    ${it.id&&!places.length&&!(ctx&&ctx.node)?`<div class="sect"><div class="eyebrow">Placement</div><p class="insp-sub">Not drawn as its own box in any diagram — it is cross-cutting.</p></div>`:""}
    ${codes(it.d.code)}`;
  wireRes();
}


/* ============================ PAN / ZOOM ============================ */
let fitK=1;
function apply(){root.setAttribute("transform",`translate(${vp.x} ${vp.y}) scale(${vp.k})`);
  document.getElementById("zval").textContent=Math.round(vp.k/fitK*100)+"%";}

/* The viewBox maps to the stage with the default xMidYMid meet, so viewBox units and
   the root transform share one coordinate space and the stage centre is always the
   viewBox centre. Fit therefore measures the real content bounds and scales them to
   fill the stage — content pushed into the letterbox bands still renders, so the
   drawing can use the whole frame instead of just the viewBox's aspect-matched part. */
function fit(){
  if(view.type==="doc")return;
  const r=stage.getBoundingClientRect();
  const prev=root.getAttribute("transform"); root.removeAttribute("transform");
  const bb=root.getBBox();
  if(prev)root.setAttribute("transform",prev);
  if(!bb.width||!bb.height||!r.width){vp={k:1,x:0,y:0};fitK=1;return apply();}
  const m=Math.min(r.width/view.w,r.height/view.h);        // viewBox units -> css px
  const stageW=r.width/m, stageH=r.height/m;               // stage size in viewBox units
  const k=Math.min(stageW/bb.width,stageH/bb.height)*0.95;
  fitK=k;
  vp={k,x:view.w/2-(bb.x+bb.width/2)*k,y:view.h/2-(bb.y+bb.height/2)*k};
  apply();
}
function ctm(){return svg.getScreenCTM();}
function screenToVB(cx,cy){
  const m=ctm(); if(!m) return {x:view.w/2,y:view.h/2};
  const pt=svg.createSVGPoint(); pt.x=cx; pt.y=cy;
  return pt.matrixTransform(m.inverse());
}
function pxPerUnit(){const m=ctm();return m&&m.a?m.a:1;}
function zoomBy(f,cx,cy){
  const k2=Math.max(fitK*0.5,Math.min(fitK*6,vp.k*f));
  if(cx===undefined){cx=view.w/2;cy=view.h/2;}
  vp.x=cx-(cx-vp.x)*(k2/vp.k); vp.y=cy-(cy-vp.y)*(k2/vp.k); vp.k=k2; apply();
}
/* Drag pans from anywhere, including from on top of a box. A gesture only counts
   as a pan once it travels past DRAG_SLOP, and that same flag suppresses the click
   that follows, so a drag never selects and a tap never pans. */
const DRAG_SLOP=4;
let drag=null; window.__panned=false;
/* Deliberately no setPointerCapture: capturing on the svg retargets the click that
   follows, which would swallow every box and line selection. Window listeners give
   the same "keep dragging outside the frame" behaviour without touching click targets. */
svg.addEventListener("pointerdown",ev=>{
  if(ev.pointerType==="mouse"&&ev.button!==0)return;
  drag={sx:ev.clientX,sy:ev.clientY,ox:vp.x,oy:vp.y,u:pxPerUnit()}; window.__panned=false;
});
addEventListener("pointermove",ev=>{
  if(!drag)return;
  const dx=ev.clientX-drag.sx, dy=ev.clientY-drag.sy;
  if(!window.__panned&&Math.hypot(dx,dy)<DRAG_SLOP)return;
  if(!window.__panned){window.__panned=true;stage.classList.add("dragging");}
  vp.x=drag.ox+dx/drag.u; vp.y=drag.oy+dy/drag.u; apply();
});
["pointerup","pointercancel"].forEach(t=>addEventListener(t,()=>{drag=null;stage.classList.remove("dragging");}));
svg.addEventListener("wheel",ev=>{ev.preventDefault();const p=screenToVB(ev.clientX,ev.clientY);zoomBy(ev.deltaY<0?1.12:1/1.12,p.x,p.y);},{passive:false});
svg.addEventListener("click",ev=>{
  if(window.__panned)return;
  if(!ev.target.closest(".node")&&!ev.target.closest(".edge")&&!ev.target.closest(".zone.clickable"))clearSel();
});
document.getElementById("zin").onclick=()=>zoomBy(1.25);
document.getElementById("zout").onclick=()=>zoomBy(1/1.25);
document.getElementById("zfit").onclick=fit;
addEventListener("keydown",ev=>{
  if(ev.target.matches("input,textarea,[type=search]"))return;
  if(ev.key==="Escape")clearSel();
  else if(ev.key==="+"||ev.key==="=")zoomBy(1.25);
  else if(ev.key==="-")zoomBy(1/1.25);
  else if(ev.key==="0")fit();
});

/* ============================ TABS ============================ */
const tabs=document.getElementById("tabs");
let lastGroup=null;
VIEWS.forEach((v,i)=>{
  /* A divider wherever the group changes: the zoom ladder, the views that cut
     across it, and the lookup table are three different kinds of thing. */
  if(v.group&&v.group!==lastGroup){
    const sep=document.createElement("span");
    sep.className="tabgroup"; sep.textContent=v.group; sep.setAttribute("aria-hidden","true");
    tabs.appendChild(sep); lastGroup=v.group;
  }
  const b=document.createElement("button");
  b.className="tab"; b.textContent=v.name; b.setAttribute("role","tab");
  b.setAttribute("aria-selected",i===0?"true":"false");
  b.onclick=()=>{
    view=v; sel=null; filter=""; pin=null;
    [...tabs.children].forEach(c=>c.setAttribute("aria-selected",c===b?"true":"false"));
    build(); fit(); renderIdle();
  };
  tabs.appendChild(b);
});

function stageTotal(){
  let n=0;
  VIEWS.find(v=>v.id===CONFIG.inventoryView).groups.forEach(g=>(g.items||[]).forEach(it=>{const c=countOf(it);if(c)n+=c;}));
  return n;
}
/* Icons are off by default so the diagrams read as they always have; an architect who
   wants them keeps them. localStorage can throw outright in some embedded contexts, so
   every access is guarded and the page renders correctly with no stored value. */
/* Namespaced by project, so two explorers served from one origin do not fight. */
/* Three states, not two: someone who overrides the theme needs a way back to following
   the system. The CSS was written for this — :root[data-theme] blocks existed from the
   start — but nothing ever set the attribute, so the override half was never reachable. */
const THEME_KEY=`${CONFIG.slug}-arch-theme`;
const THEMES=[
  {id:"system",label:"Match system",
   d:'<rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M6 14h4M8 11v3"/>'},
  {id:"light",label:"Light",
   d:'<circle cx="8" cy="8" r="3"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1"/>'},
  {id:"dark",label:"Dark",
   d:'<path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.9 5.9 0 1 0 7.1 7.1Z"/>'},
];
const themeBtn=document.getElementById("themetoggle");
{
  const read=()=>{try{return localStorage.getItem(THEME_KEY);}catch{return null;}};
  let i=Math.max(0,THEMES.findIndex(t=>t.id===read()));
  const paint=()=>{
    const t=THEMES[i];
    if(t.id==="system")document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme",t.id);
    themeBtn.innerHTML=`<svg viewBox="0 0 16 16" aria-hidden="true">${t.d}</svg>`;
    themeBtn.title=`Theme: ${t.label}`;
    themeBtn.setAttribute("aria-label",`Theme: ${t.label}. Click to change.`);
  };
  paint();
  themeBtn.addEventListener("click",()=>{
    i=(i+1)%THEMES.length; paint();
    try{localStorage.setItem(THEME_KEY,THEMES[i].id);}catch{/* private mode */}
  });
}

const ICON_KEY=`${CONFIG.slug}-arch-icons`;
const iconBtn=document.getElementById("icontoggle");
if(!ICON_IDS.length){ if(iconBtn)iconBtn.hidden=true; }
else{
  const read=()=>{try{return localStorage.getItem(ICON_KEY)==="1";}catch{return false;}};
  const paint=on=>{
    document.body.classList.toggle("icons-on",on);
    iconBtn.setAttribute("aria-pressed",on?"true":"false");
    iconBtn.title=`${on?"Hide":"Show"} ${CONFIG.iconLabel}`;
  };
  let on=read(); paint(on);
  iconBtn.addEventListener("click",()=>{
    on=!on; paint(on);
    try{localStorage.setItem(ICON_KEY,on?"1":"0");}catch{/* private mode */}
  });
}

document.getElementById("brand").innerHTML=
  `<b>${esc(CONFIG.title)}</b><span>${esc(CONFIG.tagline)}</span>`;
iconBtn.setAttribute("aria-label",CONFIG.iconLabel);
svg.setAttribute("aria-label",`Interactive ${CONFIG.title} diagram`);
document.getElementById("savepng").addEventListener("click",exportPng);

const stageBar=document.getElementById("stages");
STAGES.forEach(st=>{
  const b=document.createElement("button");
  b.textContent=st.label; b.setAttribute("aria-pressed",st.id===deployStage?"true":"false");
  b.onclick=()=>{
    deployStage=st.id;
    [...stageBar.children].forEach(c=>c.setAttribute("aria-pressed",c===b?"true":"false"));
    const keep=sel; build(); if(view.type!=="doc"&&keep&&keep.t==="node"&&nodeEls.has(keep.id))select(keep); else renderIdle();
  };
  stageBar.appendChild(b);
});

indexResources(); indexPlaces();
build(); fit(); renderIdle();
