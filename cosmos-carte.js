// cosmos-carte.js — la page Cosmos : pièces (cosmos) et terrains (mini-cosmos), dessinés avec React Flow.
// Script classique, sans build : attend window.React, window.ReactDOM et window.ReactFlow (UMD @xyflow/react).
// Trois canaux, jamais mélangés : le point dit le poids, le contour dit la date (vert tenue, bleu test en cours,
// ambre en tension, rouge en retard), les lentilles disent ce qui relie les terrains à travers les pièces.
// Pas de flèches ni de points d'accroche : ce sont les lentilles qui font les liens.
(function () {
  const R = window.React, RF = window.ReactFlow;
  if (!R || !RF) { console.error('cosmos-carte.js : React ou ReactFlow manquant'); return; }
  const h = R.createElement;
  const { ReactFlow: Flow, Background, Controls, MiniMap, useNodesState } = RF;
  const MONO = "'JetBrains Mono',monospace", SANS = 'Inter,system-ui,sans-serif';

  const CARD = [252, 112];                       // même taille pour toutes les cartes
  const BG = '#151518';                          // même fond : le poids se lit au point seul
  const COLS = 2, GAP = 14, PAD = 16, HEAD = 48, GROUP_GAP = 48, GROUP_COLS = 3;
  const ZONE_BORDER = { ok: '#34d399', sas: '#818cf8', tension: '#fbbf24', jourj: '#fafafa', retard: '#fb7185' };
  const ALARM = { retard: '#fb7185', jourj: '#fbbf24', tension: '#fbbf24' };
  const STATUT_ORDER = { Actif: 0, SAS: 1, Pause: 2, 'Clôturé': 3 }, POIDS_ORDER = { vital: 0, important: 1, normal: 2 };
  const DOT = { vital: ['#fafafa', '#fafafa', '0 0 6px rgba(250,250,250,0.6)'], important: ['#71717a', '#71717a', 'none'], normal: ['transparent', '#3f3f46', 'none'] };

  // disposition déterministe : chaque pièce est une grille de COLS colonnes, les pièces sont rangées par GROUP_COLS
  function layout(cosmos, rows) {
    const byCosmos = new Map(cosmos.map(c => [c.name, []]));
    rows.forEach(r => { if (!byCosmos.has(r.cosmos)) byCosmos.set(r.cosmos, []); byCosmos.get(r.cosmos).push(r); });
    const groups = [...byCosmos.entries()].map(([name, list]) => {
      const c = cosmos.find(x => x.name === name) || { name, color: '#a1a1aa' };
      list.sort((a, b) => ((STATUT_ORDER[a.statut] ?? 9) - (STATUT_ORDER[b.statut] ?? 9)) || (POIDS_ORDER[a.poids] - POIDS_ORDER[b.poids]) || (a.position - b.position));
      const cells = []; let y = HEAD + PAD, rowH = 0;   // un espace entre le trait du titre et la première rangée
      list.forEach((r, i) => { const [w, hg] = CARD; const col = i % COLS; if (col === 0 && i > 0) { y += rowH + GAP; rowH = 0; }
        cells.push({ r, x: PAD + col * (CARD[0] + GAP), y, w, h: hg }); rowH = Math.max(rowH, hg); });
      return { name, color: c.color, paused: c.paused || 0, list, cells, width: PAD * 2 + COLS * CARD[0] + (COLS - 1) * GAP, height: list.length ? y + rowH + PAD : HEAD + PAD * 2 + 20 };
    });
    const nodes = []; let gx = 0, gy = 0, rowMax = 0;
    groups.forEach((g, i) => {
      const col = i % GROUP_COLS; if (col === 0 && i > 0) { gy += rowMax + GROUP_GAP; rowMax = 0; gx = 0; }
      const vitals = g.list.filter(r => r.poids === 'vital').length, importants = g.list.filter(r => r.poids === 'important').length;
      const alarm = g.list.filter(r => r.poids === 'vital' && ALARM[r.zone]).map(r => r.zone);
      const thermo = { ok: g.list.filter(r => r.zone === 'ok').length, test: g.list.filter(r => r.zone === 'sas').length, warn: g.list.filter(r => r.zone === 'tension' || r.zone === 'jourj').length, bad: g.list.filter(r => r.zone === 'retard').length, cont: g.list.filter(r => r.zone === 'continu').length };
      nodes.push({ id: 'cosmos:' + g.name, type: 'cosmos', position: { x: gx, y: gy }, draggable: false, selectable: false, connectable: false, style: { width: g.width, height: g.height },
        data: { name: g.name, color: g.color, count: g.list.length, paused: g.paused, vitals, importants, thermo, alarm: alarm.includes('retard') ? '#fb7185' : alarm.length ? '#fbbf24' : null, w: g.width, h: g.height } });
      g.cells.forEach(c => nodes.push({ id: c.r.id, type: 'mini', parentId: 'cosmos:' + g.name, extent: 'parent', position: { x: c.x, y: c.y }, draggable: false, connectable: false, style: { width: c.w, height: c.h },
        data: { ...c.r, w: c.w, h: c.h, cosmosColor: g.color } }));
      gx += g.width + GROUP_GAP; rowMax = Math.max(rowMax, g.height);
    });
    return nodes;
  }

  function CosmosNode({ data }) {
    const dots = [];
    for (let i = 0; i < data.vitals; i++) dots.push(h('span', { key: 'v' + i, style: { width: 8, height: 8, borderRadius: 99, background: '#fafafa', boxShadow: '0 0 6px rgba(250,250,250,0.6)' } }));
    for (let i = 0; i < data.importants; i++) dots.push(h('span', { key: 'i' + i, style: { width: 8, height: 8, borderRadius: 99, background: '#71717a' } }));
    const t = data.thermo;
    return h('div', { style: { width: data.w, height: data.h, boxSizing: 'border-box', borderRadius: 18, border: '1px solid ' + (data.alarm ? data.alarm + '80' : 'rgba(39,39,42,0.9)'), background: 'rgba(24,24,27,0.5)', fontFamily: SANS, cursor: 'pointer' } },
      h('div', { onClick: data.onClick, title: 'Voir ' + data.name + ' dans le tableau', style: { display: 'flex', alignItems: 'center', gap: 10, height: HEAD, padding: '0 16px', cursor: 'pointer', borderBottom: '1px solid rgba(39,39,42,0.8)' } },
        h('span', { style: { width: 3, height: 14, borderRadius: 2, background: data.color, flex: 'none' } }),
        h('span', { style: { fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fafafa' } }, data.name),
        h('span', { style: { fontFamily: MONO, fontSize: 10.5, color: '#52525b' } }, data.count + ' mini-cosmos' + (data.paused ? ' · ' + data.paused + ' en pause' : '')),
        h('span', { title: t.ok + ' tenus · ' + t.test + ' en test · ' + t.warn + ' en tension · ' + t.bad + ' en retard · ' + t.cont + ' sans date', style: { display: 'flex', width: 72, height: 5, borderRadius: 3, overflow: 'hidden', background: '#27272a', marginLeft: 6 } },
          [['ok', '#34d399'], ['test', '#818cf8'], ['warn', '#fbbf24'], ['bad', '#fb7185'], ['cont', '#3f3f46']].map(([k, c]) => t[k] ? h('span', { key: k, style: { flex: t[k], background: c } }) : null)),
        h('span', { style: { display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' } }, dots,
          data.alarm ? h('span', { title: 'un terrain vital est en tension ou en retard', style: { width: 8, height: 8, borderRadius: 99, marginLeft: 6, background: data.alarm, boxShadow: '0 0 8px ' + data.alarm } }) : null)));
  }

  function MiniNode({ data, selected }) {
    const d = data, dot = DOT[d.poids] || DOT.normal, zoneBorder = ZONE_BORDER[d.zone];
    const border = zoneBorder ? '2.5px solid ' + zoneBorder : '1px solid rgba(63,63,70,0.9)';
    const tags = d.tags || [], shown = tags.slice(0, 2), more = tags.length - shown.length;   // lentilles en haut à droite : deux au plus, le reste en « +n »
    return h('div', { onClick: d.onClick, title: d.name + ' — ' + (d.zoneLabel || '') + ' — ouvrir', style: { width: d.w, height: d.h, boxSizing: 'border-box', borderRadius: 12, border,
        background: BG, boxShadow: selected ? '0 0 0 2px #fafafa' : 'none', opacity: d.pause ? 0.55 : 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, cursor: 'pointer', fontFamily: SANS, position: 'relative' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
        h('span', { style: { width: 8, height: 8, borderRadius: 99, flex: 'none', background: dot[0], border: '1.5px solid ' + dot[1], boxShadow: dot[2] } }),
        h('span', { style: { fontSize: 12.5, fontWeight: 600, color: '#fafafa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } }, d.name),
        h('span', { style: { display: 'flex', gap: 5, marginLeft: 'auto', flex: 'none', alignItems: 'center' } },
          shown.map(t => h('span', { key: t.name, title: 'lentille ' + t.name, style: { fontSize: 11, fontWeight: 600, padding: '1px 9px', borderRadius: 99, color: t.color, border: '1px solid ' + t.color + '73', background: t.color + '24', whiteSpace: 'nowrap' } }, t.name)),
          more > 0 ? h('span', { title: tags.slice(2).map(t => t.name).join(', '), style: { fontSize: 10.5, color: '#71717a', whiteSpace: 'nowrap' } }, '+' + more) : null)),
      // objectif et valeur actuelle : deux lignes alignées, étiquette discrète à gauche, comme le bloc Gouvernance du volet
      h('div', { style: { display: 'grid', gridTemplateColumns: '48px 1fr', rowGap: 1, columnGap: 6, paddingLeft: 16, alignItems: 'baseline' } },
        h('span', { style: { fontFamily: MONO, fontSize: 9.5, color: '#52525b', letterSpacing: '0.04em' } }, 'objectif'),
        h('span', { title: d.objectif, style: { fontSize: 11, color: '#d4d4d8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, d.objectif || '—'),
        h('span', { style: { fontFamily: MONO, fontSize: 9.5, color: '#52525b', letterSpacing: '0.04em' } }, 'actuel'),
        h('span', { title: d.actuel, style: { fontFamily: MONO, fontSize: 11, color: '#fafafa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, d.actuel || '—')),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16 } },
        h('span', { style: { flex: 1, height: 4, borderRadius: 2, background: '#27272a', overflow: 'hidden' } },
          h('span', { style: { display: 'block', height: '100%', borderRadius: 2, width: (d.pct || 0) + '%', background: d.zoneColor } })),
        h('span', { style: { fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: d.zoneColor, whiteSpace: 'nowrap', minWidth: 44, textAlign: 'right' } }, d.days || '')));
  }

  function CosmosCarte(props) {
    const nodeTypes = R.useMemo(() => ({ cosmos: CosmosNode, mini: MiniNode }), []);
    const computed = R.useMemo(() => layout(props.cosmos, props.rows).map(n => {
      if (n.type === 'cosmos') n.data.onClick = () => props.onCosmos(n.data.name);
      else { n.data.onClick = () => props.onOpen(n.id); if (props.lens && !(n.data.tags || []).some(t => t.name === props.lens)) n.style = { ...n.style, opacity: 0.2 }; }
      return n; }), [props.cosmos, props.rows, props.lens, props.onOpen, props.onCosmos]);
    const [nodes, setNodes, onNodesChange] = useNodesState(computed);
    R.useEffect(() => { setNodes(computed); }, [computed, setNodes]);
    const onNodeClick = R.useCallback((e, node) => { if (node.type === 'cosmos') props.onCosmos(node.data.name); }, [props.onCosmos]);
    // Vue d'ouverture sans aucun recadrage après coup : la dernière position enregistrée dans ce navigateur, sinon un cadrage
    // calculé à l'avance (la disposition est déterministe, les cartes ont une taille fixe) reculé d'un cran (facteur 1,2).
    const KEY = 'cosmos-carte-vue';
    const defaultViewport = R.useMemo(() => {
      try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && isFinite(v.zoom) && v.zoom >= 0.2 && v.zoom <= 2 && isFinite(v.x) && isFinite(v.y)) return v; } catch (e) {}
      const el = props.container; const w = el ? el.clientWidth : 1200, hgt = el ? el.clientHeight : 700;
      const groups = computed.filter(nd => nd.type === 'cosmos');
      if (!groups.length) return { x: 40, y: 40, zoom: 0.8 };
      const bw = Math.max(...groups.map(g => g.position.x + g.style.width)), bh = Math.max(...groups.map(g => g.position.y + g.style.height));
      const zoom = Math.max(0.2, Math.min(2, Math.min((w * 0.9) / bw, (hgt * 0.9) / bh) / 1.2));
      return { x: (w - bw * zoom) / 2, y: (hgt - bh * zoom) / 2, zoom };
    }, []);
    const onMoveEnd = R.useCallback((e, v) => { try { localStorage.setItem(KEY, JSON.stringify({ x: v.x, y: v.y, zoom: v.zoom })); } catch (err) {} }, []);
    return h(Flow, { nodes, edges: [], nodeTypes, onNodesChange, onNodeClick, onMoveEnd, defaultViewport, colorMode: 'dark',
        minZoom: 0.2, maxZoom: 2, nodesDraggable: false, nodesConnectable: false, elementsSelectable: true, zoomOnDoubleClick: false, style: { background: '#0c0c0e' } },
      h(Background, { color: '#27272a', gap: 24, size: 1 }),
      h(Controls, { showInteractive: false }),
      h(MiniMap, { pannable: true, zoomable: true, nodeColor: n => n.type === 'cosmos' ? 'rgba(39,39,42,0.9)' : ((n.data && n.data.cosmosColor) || '#52525b'), maskColor: 'rgba(9,9,11,0.72)', style: { background: '#09090b', border: '1px solid #27272a', borderRadius: 12 } }));
  }
  window.CosmosCarte = CosmosCarte;
})();
