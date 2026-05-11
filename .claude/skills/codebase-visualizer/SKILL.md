---
name: codebase-visualizer
description: Generate an interactive collapsible tree visualization of your codebase. Use when exploring a new repo, understanding project structure, or identifying large files.
allowed-tools: Bash(python3 *), Bash(python *)
---

# Codebase Visualizer

Generate an interactive HTML file with two tabs: a collapsible file tree and a force-directed dependency graph.

## Usage

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/visualize.py .
```

Test files (`*.test.*`, `*.spec.*`, `__tests__/`, `__mocks__/`) are excluded by default. Add `--include-tests` to include them:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/visualize.py . --include-tests
```

Creates `codebase-map.html` in the current directory and opens it.

## What the visualization shows

**🌳 File Tree tab**
- Collapsible directories with sizes
- Color-coded dots by file type

**🔗 Dependencies tab**
- Force-directed graph of import relationships (resolves `./relative` and `@/` alias imports)
- Nodes are **coloured by top-level source directory** (e.g. `src/lab-guide` vs `src/simulations`) so clusters are visible at a glance
- Node size = number of connections (degree)
- Labels with a dark halo so they stay readable over edges
- **Auto-fit** scales the graph to the viewport on load (no more lost-in-empty-space)
- **Search box** dims everything except matching filenames
- **Fit** button re-centres after dragging; **Reset** restarts the simulation
- Click a node to focus its direct connections; click background to clear
- Scroll to zoom (normalized for trackpad/mouse), drag background to pan, drag nodes to reposition
