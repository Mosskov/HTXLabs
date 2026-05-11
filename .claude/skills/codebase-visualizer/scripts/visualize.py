#!/usr/bin/env python3
"""Generate an interactive collapsible tree + dependency graph visualization.

Usage:
  visualize.py [PATH] [--include-tests]

By default, test files (*.test.*, *.spec.*, __tests__/, __mocks__/) are excluded
from both the tree and the dependency graph. Pass --include-tests to include them.
"""

import json
import re
import sys
import webbrowser
from html import escape
from pathlib import Path
from collections import Counter, defaultdict

IGNORE = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build'}
DEP_EXTS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py'}
TRY_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py']
TRY_INDEX = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', '__init__.py']
TEST_DIRS = {'__tests__', '__mocks__', 'test', 'tests'}

# Palette for directory-based node coloring (distinct hues, all readable on dark bg).
PALETTE = [
    '#3178c6', '#f7df1e', '#61dafb', '#4caf50', '#e91e63', '#ff9800',
    '#9c27b0', '#00bcd4', '#cddc39', '#f44336', '#795548', '#90a4ae',
]


def is_test_filename(name):
    n = name.lower()
    return '.test.' in n or '.spec.' in n or n.startswith('test_') or n.endswith('_test.py')


def scan(path, stats, include_tests, _root=None):
    if _root is None:
        _root = path
    result = {"name": path.name, "children": [], "size": 0}
    try:
        for item in sorted(path.iterdir()):
            if item.name in IGNORE or item.name.startswith('.'):
                continue
            if not include_tests:
                if item.is_dir() and item.name in TEST_DIRS:
                    continue
                if item.is_file() and is_test_filename(item.name):
                    continue
            if item.is_file():
                size = item.stat().st_size
                ext = item.suffix.lower() or '(no ext)'
                result["children"].append({"name": item.name, "size": size, "ext": ext})
                result["size"] += size
                stats["files"] += 1
                stats["extensions"][ext] += 1
                stats["ext_sizes"][ext] += size
            elif item.is_dir():
                stats["dirs"] += 1
                child = scan(item, stats, include_tests, _root)
                if child["children"]:
                    result["children"].append(child)
                    result["size"] += child["size"]
    except PermissionError:
        pass
    return result


def collect_dep_files(root, include_tests):
    """Walk the tree, pruning ignored/hidden/test dirs in place (avoids descending into node_modules)."""
    out = []
    stack = [root]
    while stack:
        d = stack.pop()
        try:
            for item in d.iterdir():
                if item.name in IGNORE or item.name.startswith('.'):
                    continue
                if item.is_dir():
                    if not include_tests and item.name in TEST_DIRS:
                        continue
                    stack.append(item)
                elif item.is_file():
                    if not include_tests and is_test_filename(item.name):
                        continue
                    if item.suffix.lower() in DEP_EXTS:
                        out.append(item)
        except PermissionError:
            pass
    return out


def parse_imports(file):
    try:
        text = file.read_text(encoding='utf-8', errors='ignore')
    except OSError:
        return []
    specs = []
    if file.suffix.lower() in {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}:
        for m in re.finditer(r"""(?:from|import)\s+['"]([^'"]+)['"]""", text):
            specs.append(m.group(1))
        for m in re.finditer(r"""require\s*\(\s*['"]([^'"]+)['"]\s*\)""", text):
            specs.append(m.group(1))
    elif file.suffix.lower() == '.py':
        for m in re.finditer(r'^from\s+([\w.]+)\s+import', text, re.MULTILINE):
            specs.append(m.group(1).replace('.', '/'))
        for m in re.finditer(r'^import\s+([\w.]+)', text, re.MULTILINE):
            specs.append(m.group(1).replace('.', '/'))
    return specs


def resolve_import(importer, spec, file_set, root):
    if spec.startswith('@/'):
        base = (root / 'src' / spec[2:]).resolve()
    elif spec.startswith('.'):
        base = (importer.parent / spec).resolve()
    elif importer.suffix.lower() == '.py':
        # Python: absolute import resolved against project root
        base = (root / spec).resolve()
    else:
        return None
    if base in file_set:
        return base
    for ext in TRY_EXTS:
        c = Path(str(base) + ext)
        if c in file_set:
            return c
    for idx in TRY_INDEX:
        c = base / idx
        if c in file_set:
            return c
    return None


def file_group(rel):
    """Top-level grouping for coloring: src/<subdir> if under src/, else top-level dir."""
    parts = rel.split('/')
    if len(parts) == 1:
        return '.'
    if parts[0] == 'src' and len(parts) >= 3:
        return f'{parts[0]}/{parts[1]}'
    return parts[0]


def build_deps(root, include_tests):
    files = collect_dep_files(root, include_tests)
    file_set = set(files)
    edges_raw = []
    seen_nodes = set()

    for f in files:
        rel = f.relative_to(root).as_posix()
        seen_nodes.add(rel)
        for spec in parse_imports(f):
            resolved = resolve_import(f, spec, file_set, root)
            if resolved and resolved != f:
                target = resolved.relative_to(root).as_posix()
                edges_raw.append((rel, target))
                seen_nodes.add(target)

    degree = defaultdict(int)
    for s, t in edges_raw:
        degree[s] += 1
        degree[t] += 1

    groups = sorted({file_group(f) for f in seen_nodes})
    group_color = {g: PALETTE[i % len(PALETTE)] for i, g in enumerate(groups)}

    nodes = [
        {"id": f, "degree": degree[f], "group": file_group(f), "color": group_color[file_group(f)]}
        for f in sorted(seen_nodes)
    ]
    seen_edges = set()
    edges = []
    for s, t in edges_raw:
        if (s, t) not in seen_edges:
            seen_edges.add((s, t))
            edges.append({"source": s, "target": t})

    legend = [{"name": g, "color": group_color[g]} for g in groups]
    return {"nodes": nodes, "edges": edges, "groups": legend}


def generate_html(tree, stats, deps, output, include_tests):
    ext_sizes = stats["ext_sizes"]
    total_size = sum(ext_sizes.values()) or 1
    sorted_exts = sorted(ext_sizes.items(), key=lambda x: -x[1])[:8]
    ext_colors = {
        '.js': '#f7df1e', '.ts': '#3178c6', '.py': '#3776ab', '.go': '#00add8',
        '.rs': '#dea584', '.rb': '#cc342d', '.css': '#264de4', '.html': '#e34c26',
        '.json': '#6b7280', '.md': '#083fa1', '.yaml': '#cb171e', '.yml': '#cb171e',
        '.mdx': '#083fa1', '.tsx': '#3178c6', '.jsx': '#61dafb', '.sh': '#4eaa25',
    }
    lang_bars = "".join(
        f'<div class="bar-row"><span class="bar-label">{ext}</span>'
        f'<div class="bar" style="width:{(size/total_size)*100:.1f}%;background:{ext_colors.get(ext,"#6b7280")}"></div>'
        f'<span class="bar-pct">{(size/total_size)*100:.1f}%</span></div>'
        for ext, size in sorted_exts
    )
    legend_html = "".join(
        f'<div class="legend-row"><span class="legend-dot" style="background:{g["color"]}"></span>'
        f'<span class="legend-name">{escape(g["name"])}</span></div>'
        for g in deps["groups"]
    )

    def fmt(b):
        if b < 1024: return f"{b} B"
        if b < 1048576: return f"{b/1024:.1f} KB"
        return f"{b/1048576:.1f} MB"

    data_js = (
        "const TREE_DATA = " + json.dumps(tree) + ";\n"
        "const TREE_COLORS = " + json.dumps(ext_colors) + ";\n"
        "const GRAPH_NODES = " + json.dumps(deps['nodes']) + ";\n"
        "const GRAPH_EDGES = " + json.dumps(deps['edges']) + ";\n"
    )

    logic_js = r"""
// ---- Tree ----
function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}
function esc(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderTree(node, parent) {
  if (node.children) {
    const det = document.createElement('details');
    det.open = (parent === document.getElementById('root'));
    det.innerHTML = `<summary><span class="folder">📁 ${esc(node.name)}</span><span class="size">${fmtSize(node.size)}</span></summary>`;
    const ul = document.createElement('ul');
    ul.className = 'tree';
    node.children.sort((a, b) => (b.children ? 1 : 0) - (a.children ? 1 : 0) || a.name.localeCompare(b.name));
    node.children.forEach(c => renderTree(c, ul));
    det.appendChild(ul);
    const li = document.createElement('li');
    li.appendChild(det);
    parent.appendChild(li);
  } else {
    const li = document.createElement('li');
    li.className = 'file';
    li.innerHTML = `<span class="dot" style="background:${TREE_COLORS[node.ext] || '#6b7280'}"></span>${esc(node.name)}<span class="size">${fmtSize(node.size)}</span>`;
    parent.appendChild(li);
  }
}
TREE_DATA.children.forEach(c => renderTree(c, document.getElementById('root')));

// ---- Tabs ----
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'graph-panel' && !graphInitialized) initGraph();
  });
});

// ---- Force Graph ----
let graphInitialized = false;

function initGraph() {
  graphInitialized = true;
  const svg = document.getElementById('graph-svg');
  const rect0 = svg.getBoundingClientRect();
  const W = rect0.width || window.innerWidth - 280;
  const H = rect0.height || window.innerHeight - 80;

  // Initial seed: spread on a circle so warm-up doesn't have to undo a random clump
  const nodeById = {};
  const nodes = GRAPH_NODES.map((n, i) => {
    const angle = (i / GRAPH_NODES.length) * 2 * Math.PI;
    const r = Math.min(W, H) * 0.35;
    const obj = {
      id: n.id, degree: n.degree, color: n.color,
      x: W / 2 + r * Math.cos(angle),
      y: H / 2 + r * Math.sin(angle),
      vx: 0, vy: 0, i
    };
    nodeById[n.id] = obj;
    return obj;
  });
  const edges = GRAPH_EDGES
    .map(e => ({ source: nodeById[e.source], target: nodeById[e.target] }))
    .filter(e => e.source && e.target);

  // Adjacency for highlighting
  const neighborsOf = nodes.map(() => new Set());
  edges.forEach(e => { neighborsOf[e.source.i].add(e.target.i); neighborsOf[e.target.i].add(e.source.i); });

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = '<marker id="arr" viewBox="0 0 10 10" refX="20" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#666"/></marker>';
  svg.appendChild(defs);

  const contentG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(contentG);
  const edgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  contentG.appendChild(edgeG);
  contentG.appendChild(nodeG);

  const edgeEls = edges.map(() => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', '#3d3d5c');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-opacity', '0.6');
    line.setAttribute('marker-end', 'url(#arr)');
    edgeG.appendChild(line);
    return line;
  });

  const tip = document.getElementById('graph-tip');
  let draggingNode = null;
  let selectedNode = null;

  const nodeEls = nodes.map(n => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('cursor', 'pointer');
    const r = 10 + Math.min(n.degree * 1.3, 26);
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', r);
    circle.setAttribute('fill', n.color);
    circle.setAttribute('stroke', '#1a1a2e');
    circle.setAttribute('stroke-width', '2');
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.textContent = n.id.split('/').pop();
    label.setAttribute('x', r + 6);
    label.setAttribute('y', 6);
    label.setAttribute('font-size', '18');
    label.setAttribute('font-weight', '600');
    label.setAttribute('fill', '#f5f5f5');
    label.setAttribute('stroke', '#1a1a2e');
    label.setAttribute('stroke-width', '5');
    label.setAttribute('stroke-linejoin', 'round');
    label.setAttribute('paint-order', 'stroke fill');
    label.setAttribute('pointer-events', 'none');
    g.appendChild(circle);
    g.appendChild(label);

    g.addEventListener('mouseenter', () => { tip.style.display = 'block'; tip.textContent = n.id; });
    g.addEventListener('mousemove', e => {
      const sr = svg.getBoundingClientRect();
      tip.style.left = (e.clientX - sr.left + 14) + 'px';
      tip.style.top = (e.clientY - sr.top - 10) + 'px';
    });
    g.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    g.addEventListener('mousedown', e => {
      draggingNode = n; n.vx = 0; n.vy = 0;
      e.preventDefault(); e.stopPropagation();
      start();
    });
    g.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('graph-search').value = '';
      selectedNode = (selectedNode === n) ? null : n;
      applyHighlight();
    });
    nodeG.appendChild(g);
    return { g, circle, label };
  });

  function setNodeDim(i, dim) {
    nodeEls[i].circle.setAttribute('opacity', dim ? '0.12' : '1');
    nodeEls[i].label.setAttribute('opacity', dim ? '0.15' : '1');
  }

  function applyHighlight() {
    const q = document.getElementById('graph-search').value.toLowerCase().trim();
    if (selectedNode) {
      const conn = new Set([selectedNode.i, ...neighborsOf[selectedNode.i]]);
      edgeEls.forEach((l, i) => {
        const e = edges[i];
        const active = e.source === selectedNode || e.target === selectedNode;
        l.setAttribute('stroke', active ? '#f7df1e' : '#3d3d5c');
        l.setAttribute('stroke-opacity', active ? '1' : '0.06');
      });
      nodeEls.forEach((_, i) => setNodeDim(i, !conn.has(i)));
    } else if (q) {
      const matches = new Set();
      nodes.forEach((n, i) => { if (n.id.toLowerCase().includes(q)) matches.add(i); });
      edgeEls.forEach((l, i) => {
        const e = edges[i];
        const active = matches.has(e.source.i) && matches.has(e.target.i);
        l.setAttribute('stroke', active ? '#f7df1e' : '#3d3d5c');
        l.setAttribute('stroke-opacity', active ? '0.9' : '0.04');
      });
      nodeEls.forEach((_, i) => setNodeDim(i, !matches.has(i)));
    } else {
      edgeEls.forEach(l => { l.setAttribute('stroke', '#3d3d5c'); l.setAttribute('stroke-opacity', '0.6'); });
      nodeEls.forEach((_, i) => setNodeDim(i, false));
    }
  }

  svg.addEventListener('click', () => { selectedNode = null; applyHighlight(); });

  // ---- Pan / zoom ----
  let scale = 1, tx = 0, ty = 0, panning = false, px = 0, py = 0;
  function applyTransform() { contentG.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`); }

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const sr = svg.getBoundingClientRect();
    const mx = e.clientX - sr.left, my = e.clientY - sr.top;
    // Normalize deltaY so trackpads and wheels feel similar
    const ns = Math.max(0.05, Math.min(20, scale * Math.exp(-e.deltaY * 0.002)));
    tx = mx - (mx - tx) * (ns / scale);
    ty = my - (my - ty) * (ns / scale);
    scale = ns;
    applyTransform();
  }, { passive: false });

  svg.addEventListener('mousedown', e => {
    if (!e.target.closest('g[cursor="pointer"]')) { panning = true; px = e.clientX - tx; py = e.clientY - ty; }
  });
  window.addEventListener('mouseup', () => { panning = false; draggingNode = null; });
  window.addEventListener('mousemove', e => {
    if (panning) { tx = e.clientX - px; ty = e.clientY - py; applyTransform(); }
    if (draggingNode) {
      const sr = svg.getBoundingClientRect();
      draggingNode.x = (e.clientX - sr.left - tx) / scale;
      draggingNode.y = (e.clientY - sr.top - ty) / scale;
    }
  });

  // ---- Auto-fit ----
  function autoFit() {
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      if (!isFinite(n.x) || !isFinite(n.y)) return;
      if (n.x < minX) minX = n.x; if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x; if (n.y > maxY) maxY = n.y;
    });
    if (!isFinite(minX)) { scale = 1; tx = 0; ty = 0; applyTransform(); return; }
    const bw = Math.max(maxX - minX, 100);
    const bh = Math.max(maxY - minY, 100);
    const pad = 80;
    let s = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
    s = Math.max(0.1, Math.min(5, s));
    scale = s;
    tx = W / 2 - ((minX + maxX) / 2) * s;
    ty = H / 2 - ((minY + maxY) / 2) * s;
    applyTransform();
  }

  // ---- Simulation ----
  // Repulsion is modulated by alpha so the whole system cools together; otherwise
  // springs/gravity decay while repulsion keeps pushing nodes off-screen forever.
  const REPEL = 500, SPRING_LEN = 45, SPRING_K = 0.5, GRAVITY = 0.025, DAMP = 0.82;
  const V_MAX = 40;

  function simStep(alpha) {
    const repelMul = 0.3 + 0.7 * alpha;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 1;
        const f = REPEL * repelMul / d2;
        a.vx -= f * dx; a.vy -= f * dy;
        b.vx += f * dx; b.vy += f * dy;
      }
    }
    edges.forEach(e => {
      const dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - SPRING_LEN) / d * SPRING_K * alpha;
      e.source.vx += f * dx; e.source.vy += f * dy;
      e.target.vx -= f * dx; e.target.vy -= f * dy;
    });
    nodes.forEach(n => {
      if (n === draggingNode) { n.vx = 0; n.vy = 0; return; }
      n.vx += (W / 2 - n.x) * GRAVITY * alpha;
      n.vy += (H / 2 - n.y) * GRAVITY * alpha;
      n.vx *= DAMP; n.vy *= DAMP;
      if (n.vx > V_MAX) n.vx = V_MAX; else if (n.vx < -V_MAX) n.vx = -V_MAX;
      if (n.vy > V_MAX) n.vy = V_MAX; else if (n.vy < -V_MAX) n.vy = -V_MAX;
      n.x += n.vx; n.y += n.vy;
    });
  }

  function render() {
    edges.forEach((e, i) => {
      edgeEls[i].setAttribute('x1', e.source.x.toFixed(1));
      edgeEls[i].setAttribute('y1', e.source.y.toFixed(1));
      edgeEls[i].setAttribute('x2', e.target.x.toFixed(1));
      edgeEls[i].setAttribute('y2', e.target.y.toFixed(1));
    });
    nodes.forEach((n, i) => nodeEls[i].g.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`));
  }

  // Synchronous warm-up: cool alpha from 1 down toward 0 so forces actually settle
  for (let i = 0; i < 300; i++) simStep(Math.max(0.04, 1 - i / 300));
  autoFit();
  render();

  // Run a short visible animation after first paint so any residual motion finishes on-screen
  let alpha = 0.35, running = false;
  function tick() {
    if (alpha < 0.004 && !draggingNode) { running = false; return; }
    simStep(alpha);
    if (!draggingNode) alpha *= 0.96;
    render();
    requestAnimationFrame(tick);
  }
  function start() { if (!running) { running = true; requestAnimationFrame(tick); } }
  start();

  // ---- UI controls ----
  document.getElementById('graph-search').addEventListener('input', () => {
    selectedNode = null;
    applyHighlight();
  });
  document.getElementById('graph-reset').addEventListener('click', () => {
    document.getElementById('graph-search').value = '';
    selectedNode = null;
    applyHighlight();
    alpha = 0.3; start();
    setTimeout(autoFit, 50);
  });
  document.getElementById('graph-refit').addEventListener('click', autoFit);
}
"""

    node_count = len(deps["nodes"])
    edge_count = len(deps["edges"])
    test_note = "(tests included)" if include_tests else "(tests excluded)"

    html = f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><title>Codebase Explorer</title>
<style>
* {{ box-sizing: border-box; }}
body {{ font: 14px/1.5 system-ui, sans-serif; margin: 0; background: #1a1a2e; color: #eee; }}
.container {{ display: flex; height: 100vh; overflow: hidden; }}
.sidebar {{ width: 280px; background: #252542; padding: 20px; border-right: 1px solid #3d3d5c; overflow-y: auto; flex-shrink: 0; }}
.main {{ flex: 1; display: flex; flex-direction: column; min-width: 0; }}
.tabs {{ display: flex; border-bottom: 1px solid #3d3d5c; background: #252542; flex-shrink: 0; }}
.tab-btn {{ padding: 10px 20px; border: none; background: none; color: #888; cursor: pointer; font: 14px system-ui; border-bottom: 2px solid transparent; margin-bottom: -1px; }}
.tab-btn.active {{ color: #eee; border-bottom-color: #f7df1e; }}
.tab-btn:hover:not(.active) {{ color: #ccc; }}
.tab-panel {{ display: none; flex: 1; overflow: auto; padding: 20px; }}
.tab-panel.active {{ display: flex; flex-direction: column; }}
#graph-panel {{ padding: 0; position: relative; overflow: hidden; }}
.graph-toolbar {{ position: absolute; top: 12px; left: 12px; right: 12px; display: flex; gap: 8px; z-index: 5; pointer-events: none; }}
.graph-toolbar > * {{ pointer-events: auto; }}
#graph-search {{ flex: 0 0 280px; background: #252542; border: 1px solid #3d3d5c; color: #eee; padding: 6px 10px; border-radius: 4px; font: 13px system-ui; }}
#graph-search:focus {{ outline: none; border-color: #f7df1e; }}
.tb-btn {{ background: #252542; border: 1px solid #3d3d5c; color: #ccc; padding: 6px 12px; border-radius: 4px; font: 13px system-ui; cursor: pointer; }}
.tb-btn:hover {{ color: #eee; border-color: #555; }}
.tb-spacer {{ flex: 1; }}
.tb-meta {{ background: #252542cc; border: 1px solid #3d3d5c; border-radius: 4px; padding: 6px 10px; font-size: 12px; color: #888; }}
#graph-svg {{ width: 100%; flex: 1; display: block; height: 100%; }}
#graph-tip {{ position: absolute; background: #252542; border: 1px solid #3d3d5c; border-radius: 4px; padding: 4px 8px; font-size: 12px; pointer-events: none; display: none; max-width: 420px; word-break: break-all; z-index: 10; }}
.graph-hint {{ position: absolute; bottom: 12px; right: 12px; background: #252542cc; border: 1px solid #3d3d5c; border-radius: 4px; padding: 6px 10px; font-size: 11px; color: #666; pointer-events: none; line-height: 1.7; }}
h1 {{ margin: 0 0 10px; font-size: 18px; }}
h2 {{ margin: 18px 0 8px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .05em; }}
.stat {{ display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #3d3d5c; font-size: 13px; }}
.stat-value {{ font-weight: 600; }}
.bar-row {{ display: flex; align-items: center; margin: 5px 0; }}
.bar-label {{ width: 50px; font-size: 12px; color: #aaa; }}
.bar {{ height: 16px; border-radius: 3px; min-width: 2px; }}
.bar-pct {{ margin-left: 7px; font-size: 11px; color: #666; }}
.tree {{ list-style: none; padding-left: 18px; margin: 0; }}
details {{ cursor: pointer; }}
summary {{ padding: 3px 6px; border-radius: 3px; user-select: none; }}
summary:hover {{ background: #2d2d44; }}
.folder {{ color: #ffd700; }}
.file {{ display: flex; align-items: center; padding: 3px 6px; border-radius: 3px; }}
.file:hover {{ background: #2d2d44; }}
.size {{ color: #666; margin-left: auto; font-size: 11px; padding-left: 8px; white-space: nowrap; }}
.dot {{ width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; flex-shrink: 0; }}
.legend-row {{ display: flex; align-items: center; margin: 4px 0; font-size: 12px; }}
.legend-dot {{ width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; flex-shrink: 0; }}
.legend-name {{ color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
.note {{ font-size: 11px; color: #666; margin-top: 4px; }}
</style>
</head><body>
<div class="container">
  <div class="sidebar">
    <h1>📊 Summary</h1>
    <div class="stat"><span>Files</span><span class="stat-value">{stats["files"]:,}</span></div>
    <div class="stat"><span>Directories</span><span class="stat-value">{stats["dirs"]:,}</span></div>
    <div class="stat"><span>Total size</span><span class="stat-value">{fmt(tree["size"])}</span></div>
    <div class="stat"><span>File types</span><span class="stat-value">{len(stats["extensions"])}</span></div>
    <h2>Dependencies <span style="text-transform:none;font-weight:normal;color:#666">{test_note}</span></h2>
    <div class="stat"><span>Nodes</span><span class="stat-value">{node_count:,}</span></div>
    <div class="stat"><span>Edges</span><span class="stat-value">{edge_count:,}</span></div>
    <h2>Groups</h2>
    {legend_html}
    <h2>By file type</h2>
    {lang_bars}
  </div>
  <div class="main">
    <div class="tabs">
      <button class="tab-btn active" data-tab="tree-panel">🌳 File Tree</button>
      <button class="tab-btn" data-tab="graph-panel">🔗 Dependencies</button>
    </div>
    <div class="tab-panel active" id="tree-panel">
      <h1>📁 {escape(tree["name"])}</h1>
      <ul class="tree" id="root"></ul>
    </div>
    <div class="tab-panel" id="graph-panel">
      <div class="graph-toolbar">
        <input id="graph-search" type="text" placeholder="filter by filename…" />
        <button class="tb-btn" id="graph-refit">fit</button>
        <button class="tb-btn" id="graph-reset">reset</button>
        <div class="tb-spacer"></div>
        <div class="tb-meta">{node_count} nodes · {edge_count} edges · {test_note}</div>
      </div>
      <svg id="graph-svg"></svg>
      <div id="graph-tip"></div>
      <div class="graph-hint">
        scroll to zoom · drag background to pan<br>
        click node to focus · drag node to move
      </div>
    </div>
  </div>
</div>
<script>
{data_js}
{logic_js}
</script>
</body></html>"""

    output.write_text(html, encoding='utf-8')


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser(
        description='Generate codebase-map.html — interactive file tree + dependency graph.',
    )
    p.add_argument('path', nargs='?', default='.', help='Project root (default: current directory)')
    p.add_argument(
        '--include-tests', action='store_true',
        help='Include *.test.*, *.spec.*, __tests__/, __mocks__/ (excluded by default)',
    )
    args = p.parse_args()
    target = Path(args.path).resolve()
    if not target.is_dir():
        sys.exit(f'error: {target} is not a directory')

    stats = {"files": 0, "dirs": 0, "extensions": Counter(), "ext_sizes": Counter()}
    tree = scan(target, stats, args.include_tests)
    deps = build_deps(target, args.include_tests)
    out = Path('codebase-map.html')
    generate_html(tree, stats, deps, out, args.include_tests)
    tag = "with tests" if args.include_tests else "tests excluded"
    print(f'Generated {out.absolute()} — {len(deps["nodes"])} nodes, {len(deps["edges"])} edges ({tag})')
    webbrowser.open(out.absolute().as_uri())
