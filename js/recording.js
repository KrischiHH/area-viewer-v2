function slugify(label) {
  return (label || 'hotspot')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'');
}

export function initHotspots(state) {
  const mvEl = document.getElementById('ar-scene-element');
  if (!mvEl) return;
  const nodes = state.cfg?.clickableNodes;
  if (!Array.isArray(nodes) || nodes.length === 0) return;

  nodes.forEach((node, idx) => {
    if (!node.url) return;
    // Minimal: kein Positions-Upgrade (du hast position bereits, wir nutzen sie direkt)
    if (!node.position) return;

    const slotName = `hotspot-${slugify(node.label || ('link'+idx))}`;
    const btn = document.createElement('button');
    btn.setAttribute('slot', slotName);
    btn.className = 'Hotspot';
    btn.textContent = node.label || `Link ${idx+1}`;
    btn.setAttribute('data-position', `${node.position.x} ${node.position.y} ${node.position.z}`);
    btn.setAttribute('data-normal', '0 1 0');

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(node.url, '_blank');
    });

    mvEl.appendChild(btn);
  });
}
