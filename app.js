/* Urban Scale VR starter (A-Frame 1.8.0): one webpage, eight scenes, no PC required by students.
 * Demo mode: procedural models with exact dimensions. Production mode: external GLB files.
 * UI: PC buttons and VR controller ray-click. No joystick locomotion or physical walking.
 */
(function () {
  'use strict';
  const cfg = window.URBAN_VR_CONFIG;
  if (!cfg || !Array.isArray(cfg.rounds)) { throw Error('config.js is not loaded'); }
  const scene = document.getElementById('scene');
  const env = document.getElementById('environment');
  const rig = document.getElementById('rig');
  const vrMenu = document.getElementById('vrMenu');
  const status = document.getElementById('status');
  const state = { round: cfg.start.round, variant: cfg.start.variant, view: 'P1', token: 0 };
  let roundButtons=[], variantButtons=[], viewButtons=[];

  function E(tag, attrs, parent) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k,v]) => e.setAttribute(k, String(v)));
    if (parent) parent.appendChild(e);
    return e;
  }
  function currentRound(){ return cfg.rounds.find(r => r.number === state.round); }
  function currentVariant(){ return currentRound().variants.find(v => v.id === state.variant); }
  function message(msg, error){ status.textContent=msg; status.style.color=error?'#ffbfab':'#b6f0d1'; const t=document.getElementById('vrStatus'); if(t){t.setAttribute('value', error?'FILE ERROR':msg.slice(0,25).toUpperCase());} }
  function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }
  function box(parent, pos, size, color, extra={}) {
    return E('a-box', { position:`${pos[0]} ${pos[1]} ${pos[2]}`,
      width:size[0], height:size[1], depth:size[2], color, ...extra }, parent);
  }
  function cyl(parent, pos, height=1.7, color='#D49360'){
    return E('a-cylinder', {position:`${pos[0]} ${pos[1]} ${pos[2]}`,
      radius:0.18,height,color},parent);
  }
  function ground(parent){ box(parent,[0,-.18,0],[140,.3,140],'#91A39A'); }
  function windows(parent,x,h,length,facadeSide){
    const rows=Math.min(6,Math.floor((h-2.5)/3));
    const n=Math.min(6,Math.floor(length/7));
    for(let i=0;i<rows;i++) for(let j=0;j<n;j++){
      const z=-length/2+4+j*7, y=3.3+i*3;
      box(parent,[x+facadeSide*0.06,y,z],[.06,1.2,2.4],'#B4D6E4');
    }
  }
  function buildStreet(parent,v,zShift=0,segmentLength=null){
    const w=v.width, h=v.height, len=segmentLength || v.length || 42;
    box(parent,[0,-.015,zShift],[w,.035,len],'#A9B0B6');
    const bx=w/2+3;
    box(parent,[-bx,h/2,zShift],[6,h,len],'#8C9EAF');
    box(parent,[bx,h/2,zShift],[6,h,len],'#90A5B5');
    box(parent,[-w/2-.015,1.5,zShift],[.09,3,len],'#D7BA8B');
    box(parent,[w/2+.015,1.5,zShift],[.09,3,len],'#D7BA8B');
    windows(parent,-w/2,h,len,+1); windows(parent,w/2,h,len,-1);
    cyl(parent,[Math.min(w/2-1.0,2),.85,zShift-3.5]);
    box(parent,[Math.min(w/2-1.2,3),.38,zShift+4],[1.2,.75,.55],'#7D6D5E');
  }
  function buildPlaza(parent, width, depth, cz=0){
    box(parent,[0,.02,cz],[width,.07,depth],'#C4BDAA');
    const treeX=width/2-2.3, treeZ=depth/2-2.3;
    [[-treeX,-treeZ],[treeX,-treeZ],[-treeX,treeZ],[treeX,treeZ]].forEach(([x,z])=>{
      box(parent,[x,.7,cz+z],[.28,1.4,.28],'#836C53');
      E('a-sphere',{position:`${x} 2.0 ${cz+z}`,radius:1.15,color:'#6E9274',segmentsWidth:7,segmentsHeight:5},parent);
    });
    cyl(parent,[1.1,.85,cz+1.1]);
    box(parent,[-1,.34,cz-1.5],[1.5,.68,.55],'#9A8768');
    // Back facade supplies visual enclosure without trying to recreate the whole city.
    box(parent,[0,6,cz-depth/2-3.0],[width+5,12,6],'#8F9FAE');
  }
  function buildPodium(parent,v){
    const w=v.width, h=v.height, len=v.length || 50;
    box(parent,[0,-0.015,0],[w,.04,len],'#A9B0B6');
    const plinthH=10, retreat=5;
    for (const side of [-1,1]) {
      const podiumCenter=side*(w/2+9);
      const upperCenter=side*(w/2+retreat+5);
      box(parent,[podiumCenter,plinthH/2,0],[18,plinthH,len],'#A1B7C8');
      box(parent,[upperCenter,plinthH+(h-plinthH)/2,0],[10,h-plinthH,len],'#7D94A6');
    }
    cyl(parent,[1.4,.85,4]);
  }
  function makeDemo(v){
    const group=E('a-entity',{},env); ground(group);
    if(v.type==='street') buildStreet(group,v);
    else if(v.type==='podium') buildPodium(group,v);
    else if(v.type==='plaza') buildPlaza(group,v.plazaWidth,v.plazaDepth);
    else if(v.type==='mixed'){
      // The street ends at z=-12. The plaza begins there and extends in -Z.
      buildStreet(group,v,8,40);
      buildPlaza(group,v.plazaWidth,v.plazaDepth,-12-v.plazaDepth/2);
    }
    return group;
  }
  function makeProduction(v,token){
    const group=E('a-entity',{},env);
    const model=E('a-entity',{},group);
    const timeout=setTimeout(()=>{
      if(token===state.token){message('GLB 장시간 로딩: 파일 크기·Wi-Fi 확인',true);}
    },12000);
    model.addEventListener('model-loaded',()=>{clearTimeout(timeout);if(token===state.token)message(`R${state.round} ${state.variant} / GLB loaded`);},{once:true});
    model.addEventListener('model-error',()=>{clearTimeout(timeout);if(token===state.token)message(`R${state.round} ${state.variant}: GLB FILE ERROR`,true);},{once:true});
    model.setAttribute('gltf-model',`url(${v.file})`);
    return group;
  }
  function goView(id){
    const v=currentVariant(); const p=v.views.find(a=>a.id===id)||v.views[0];
    state.view=p.id;
    // Camera remains a 1.6m child of the rig. HMD orientation remains physical.
    rig.setAttribute('position',`${p.x} 0 ${p.z}`);
    updateButtons();
  }
  function show(roundNum,variantId){
    const r=cfg.rounds.find(x=>x.number===roundNum); if(!r)return;
    const v=r.variants.find(x=>x.id===variantId)||r.variants[0];
    state.round=r.number;state.variant=v.id;state.view='P1';state.token++;
    const token=state.token;
    clearChildren(env);
    if(cfg.mode==='demo') {makeDemo(v);message(`R${state.round} ${state.variant} / DEMO`);}
    else {message(`R${state.round} ${state.variant} / LOADING`);makeProduction(v,token);}
    goView(v.views[0].id); renderDesktop(); renderVrMenu();
  }
  function mkBtn(parent,label,active,fn){
    const b=document.createElement('button');b.textContent=label;
    if(active)b.classList.add('active');b.addEventListener('click',fn);parent.appendChild(b);return b;
  }
  function renderDesktop(){
    const rb=document.getElementById('roundButtons'),vb=document.getElementById('variantButtons'),pb=document.getElementById('viewButtons');
    clearChildren(rb);clearChildren(vb);clearChildren(pb);
    roundButtons=cfg.rounds.map(r=>mkBtn(rb,`R${r.number} ${r.label}`,r.number===state.round,()=>show(r.number,r.variants[0].id)));
    variantButtons=currentRound().variants.map(v=>mkBtn(vb,`SPACE ${v.id}`,v.id===state.variant,()=>show(state.round,v.id)));
    viewButtons=currentVariant().views.map(p=>mkBtn(pb,`VIEW ${p.id}`,p.id===state.view,()=>goView(p.id)));
  }
  function updateButtons(){
    viewButtons.forEach((b,i)=>b.classList.toggle('active',currentVariant().views[i]?.id===state.view));
    for(const c of vrMenu.querySelectorAll('[data-view]')){
      c.setAttribute('color',c.dataset.view===state.view?'#EFB56C':'#436B7C');
    }
  }
  function vrButton(x,y,label,cb,active=false,view='',buttonWidth=.285,textWidth=1.6){
    const rect=E('a-plane',{
      position:`${x} ${y} 0.016`,
      width:buttonWidth,
      height:.155,
      color:active?'#EFB56C':'#436B7C',
      material:'shader:flat',
      class:'vr-clickable'
    },vrMenu);

    if(view) rect.dataset.view=view;

    E('a-text',{
      value:label,
      align:'center',
      color:active?'#172B38':'#FFFFFF',
      width:textWidth,
      position:`${x} ${y-.014} 0.023`
    },vrMenu);

    rect.addEventListener('click',cb);
    return rect;
  }

  function renderVrMenu(){
    clearChildren(vrMenu);

    E('a-plane',{
      width:1.95,
      height:.62,
      color:'#183047',
      opacity:.89,
      material:'transparent:true;shader:flat'
    },vrMenu);

    E('a-text',{
      id:'vrTitle',
      value:`R${state.round} ${currentRound().label} | SPACE ${state.variant} | ${state.view}`,
      width:2.1,
      align:'center',
      color:'#FFFFFF',
      position:'0 0.225 0.022'
    },vrMenu);

    const rXs=[-.69,-.23,.23,.69];

    cfg.rounds.forEach((r,i)=>vrButton(
      rXs[i],.06,`R${r.number} ${r.label}`,
      ()=>show(r.number,r.variants[0].id),
      r.number===state.round,'',.43,1.05
    ));

    const varXs=[-.67,-.32,.03];

    currentRound().variants.forEach((v,i)=>vrButton(
      varXs[i],-.14,v.id,
      ()=>show(state.round,v.id),
      v.id===state.variant
    ));

    currentVariant().views.forEach((p,i)=>vrButton(
      .43+i*.35,-.14,p.id,
      ()=>goView(p.id),
      p.id===state.view,p.id
    ));

    E('a-text',{
      id:'vrStatus',
      value:cfg.mode==='demo'?'DEMO':'GLB',
      width:1.15,
      align:'center',
      color:'#B6F0D1',
      position:'0 -0.274 0.022'
    },vrMenu);
  }
  function init(){
    const c=cfg.rounds.find(r=>r.number===state.round)||cfg.rounds[0];
    show(c.number,state.variant);
    window.addEventListener('keydown',e=>{
      if(['1','2','3','4'].includes(e.key)){const r=cfg.rounds[Number(e.key)-1];if(r)show(r.number,r.variants[0].id);}
      else if(['a','b','c'].includes(e.key.toLowerCase()))show(state.round,e.key.toUpperCase());
      else if(e.key.toLowerCase()==='p')goView('P1');
      else if(e.key.toLowerCase()==='v')goView('P2');
    });
  }
  if(scene.hasLoaded) init(); else scene.addEventListener('loaded',init,{once:true});
})();
