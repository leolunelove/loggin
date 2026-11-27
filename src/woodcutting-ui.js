import {TREES,milestones,skillProgress,orderInfo} from './woodcutting.js';

const number=n=>n.toLocaleString('en');
export function skillsPage(state){
  const skill=state.woodcutting,p=skillProgress(skill.xp),order=orderInfo(skill.order);
  const ranks=['Apprentice','Camp hand','Woodcutter','Timber hand','Sawyer','Journeyman','Veteran','Master woodcutter'];
  const rank=ranks[milestones.filter(([level])=>level<=p.level).length-1];
  const next=milestones.find(([level])=>level>p.level);
  const stats=[[state.felled,'Trees felled'],[skill.strokes,'Landed chops'],[skill.bucked,'Logs bucked'],[skill.orders,'Orders filled']];
  const job=order?`<section class="book-order"><small>Current camp order</small><h3>${order.title}</h3><div><span>${order.verb}</span><b>${order.done} / ${order.goal}</b></div><progress aria-label="Camp order progress" value="${order.done}" max="${order.goal}"></progress><p>Completing this order earns ${number(order.reward)} bonus XP.</p></section>`:
    '<section class="book-order"><small>Camp orders</small><p>Your first job opens at Woodcutting level 5.</p></section>';
  return `<div class="skill-spread"><section class="skill-summary sewn"><div class="level-emblem"><small>Level</small><b>${p.level}</b></div><div><small>${rank}</small><h3>Woodcutting</h3><p>${number(skill.xp)} total XP</p></div>
    <progress aria-label="Woodcutting level progress" max="100" value="${p.fraction*100}"></progress><div class="skill-caption"><b>${Math.floor(p.fraction*100)}%</b><span>${p.left?number(p.left)+' XP to level '+(p.level+1):'Level 99 reached'}</span></div></section>
    ${job}<dl class="skill-tallies">${stats.map(([value,name])=>`<div><dt>${name}</dt><dd>${number(value)}</dd></div>`).join('')}</dl>
    <section class="book-species"><h3>Felling record</h3>${[1,0,3,2].map(i=>`<div><span>${TREES[i].name}</span><b>${number(skill.species[i])}</b></div>`).join('')}
    ${skill.legacy?'<p>'+number(skill.legacy)+' earlier trees earned '+number(skill.legacy*26)+' starting XP. Your species tally starts here.</p>':''}</section>
    <details class="book-unlocks"><summary>${next?'Next unlock · Level '+next[0]+' · '+next[1]:'Woodcutting milestones'}</summary>${milestones.map(([level,name,desc])=>`<p class="${level<=p.level?'earned':''}"><b>Lv ${level} · ${name}</b><span>${desc}</span></p>`).join('')}</details></div>`;
}
