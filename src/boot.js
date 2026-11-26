// Loggin’ keeps the original autumn painting and adds a small lumberjack game.
document.documentElement.dataset.scene = 'autumn';
import('./main.js').catch(error => {
  console.error(error);
  document.getElementById('loading-label').textContent = 'The forest could not load.';
  const retry=document.getElementById('reload-forest');retry.hidden=false;retry.onclick=()=>location.reload();
});
