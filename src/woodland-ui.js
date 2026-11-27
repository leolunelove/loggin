import {PLACES,restored} from './exploration.js';
import {PROJECT,FINDS,available,projectReady,cartCapacity,connected,packedLunch} from './woodland.js';
import {canSleep} from './daylight.js';

const specialties=['Orchard kitchen','River depot','Timber workshop'];
const descriptions=['Fresh apples for a longer stride on the trail.','A shared stacking rack across the water, beside the eastern grove.','Dress the axe edge and fit stronger wheels to your handcart.'];
const button=(kind,label,enabled=true)=>'<button class="journal-button" data-outpost="'+kind+'" '+(enabled?'':'disabled')+'>'+label+'</button>';
const progress=(n,max)=>'<progress value="'+n+'" max="'+max+'"></progress>';
const line=(name,body,actions='')=>'<section class="journal-row"><h3>'+name+'</h3><p>'+body+'</p>'+actions+'</section>';
const nav=(tabs,active)=>'<nav class="journal-nav" aria-label="Home ledger">'+tabs.map(([key,name])=>'<button data-outpost="tab-'+key+'" aria-pressed="'+(active===key)+'">'+name+'</button>').join('')+'</nav>';
export function stockLine(s){return '<div class="stock-line"><span>Shared stock</span><b>'+(s.wood-s.hardwood)+' logs</b><b>'+s.hardwood+' hardwood</b><b>'+s.planks+' planks</b></div>';}
export function outpostPage(s,i,tab='home'){
  const p=s.places[i],w=s.woodland;
  if(!restored(p))return stockLine(s)+line('Restore the home',descriptions[i],progress(p.wood+p.planks,32)+'<p>Timber '+p.wood+' / 24 · Planks '+p.planks+' / 8</p>'+
    (p.wood<24?button('wood','Repair · up to 6 logs',available(s,1,0)):button('planks','Finish · up to 2 planks',s.planks>0)));
  let body='';
  if(tab==='home'){
    if(i===0)body=line(specialties[i],'The orchard yields one lunch each morning. Sprint 16% faster for three camp hours.',button('meal',w.lastMeal===s.day?(packedLunch(s)?'Lunch packed · Boost active':'More apples tomorrow'):'Eat an orchard lunch',w.lastMeal<s.day));
    if(i===1)body=line(specialties[i],descriptions[i]+' Empty your bag there while working on the far bank. Every home can spend the timber immediately.');
    if(i===2)body=line('Dress the axe edge','A hardened bevel bites 35% deeper into oak and maple.',button('edge',w.edge?'Edge dressed':'Dress edge · 8 hardwood + 4 planks',!w.edge&&s.hardwood>=8&&s.planks>=4))+
      line('Reinforce the axle','Iron bands and a new axle raise cart capacity from 192 to 288 and speed up the hauler.',button('axle',w.axle?'Axle reinforced':w.cart.built?'Fit axle · 6 planks':'Build a handcart first',w.cart.built&&!w.axle&&s.planks>=6));
    body+=line('Supplies & rest',s.carried+' logs in your bag.',button('unload','Empty bag into shared stock',s.carried>0)+button('sleep','Sleep until morning',canSleep(s)));
  } else if(tab==='trail'){
    body=line('Trail to camp',p.trail+' / 40 logs · Walk 25% faster along a completed route.',progress(p.trail,40)+button('trail',connected(p)?'Trail connected':'Lay trail · up to 8 logs',!connected(p)&&available(s,1,0)));
    if(!w.cart.built)body+=line('Trail handcart','Carry three woodshed bags. Pull it yourself or hire someone to run the connected trails.',button('cart','Build handcart · 8 planks',connected(p)&&s.planks>=8));
    else body+=line('Handcart',haulStatus(s)+(w.freight[i]?' · '+w.freight[i]+' logs stacked here for the next run.':'.')+
      ' Use R beside the cart to pull it or put it on rounds.',!w.cart.hired&&connected(p)?button('hire','Hire hauler · 16 logs',available(s,16,0)):'');
  } else {
    for(const [key,proj] of Object.entries(PROJECT))if(proj.place===i){
      const n=w.projects[key],done=n===proj.stages,missing=proj.clue&&!w.finds.includes(proj.clue);
      let hint=proj.benefit+' '+n+' / '+proj.stages+' stages.';
      if(missing)hint+=' Look for '+FINDS[proj.clue].name.toLowerCase()+(proj.clue==='kiln'?' on the lodge ridge.':' just west of the orchard veranda.');
      body+=line(proj.name,hint,progress(n,proj.stages)+button(key,done?'Built':missing?'Plan undiscovered':'Build stage · '+proj.logs+' logs + '+proj.planks+' '+(proj.planks===1?'plank':'planks'),projectReady(s,key)&&available(s,proj.logs,proj.planks)));
    }
  }
  return stockLine(s)+nav([['home','Home'],['trail','Trail & cart'],['projects','Projects']],tab)+body;
}
export function haulStatus(s){
  const c=s.woodland.cart;
  if(!c.built)return 'No handcart built';
  if(c.running)return c.returning?'Hauler returning from '+PLACES[c.route].name:'Hauler bound for '+PLACES[c.route].name;
  return 'Handcart parked'+(c.hired?' · Hauler available':'');
}
export function cartPage(game){
  const s=game.state,c=s.woodland.cart,cart=game.cart,n=cart.nearestRoute(),route=n&&game.exploration.routes[n.i],onRoute=n&&n.distance<2.5;
  const depot=onRoute&&Math.min(n.progress,1-n.progress)*route.length<3;
  return stockLine(s)+line(cart.towing?'Pulling the cart':haulStatus(s),c.load+' / '+cartCapacity(s)+' logs aboard · '+s.carried+' in your bag.',progress(c.load,cartCapacity(s))+
    button('stow','Stow bag · Credit shared stock',c.load<cartCapacity(s)&&s.carried>0)+button('tip','Stack load at this stop',!!depot&&c.load>0)+button('hitch',cart.towing?'Park handcart':'Take the handles'))+
    line('Trail hauler',onRoute?'A hired hand travels between connected homes and collects the stacks you have left there.':'Pull the cart onto a connected trail to start a round.',
      c.hired?button('dispatch',c.running?'On rounds':'Send on rounds',!c.running&&onRoute):button('hire','Hire hauler · 16 logs',available(s,16,0)&&onRoute));
}
