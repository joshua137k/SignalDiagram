
class GraphAnalyzer {
  constructor(circles, edges) {
    this.circles = circles;
    this.edges = edges;
    this.adj = this.buildAdjacencyList();
  }

  buildAdjacencyList() {
    const adj = new Map();
    this.circles.forEach(c => adj.set(c.id, []));
    this.edges.forEach(e => {
      adj.get(e.from.id).push({ to: e.to.id, weight: e.weight });
    });
    return adj;
  }

  // Encontra todos ciclos simples (Johnson)
  findAllSimpleCycles() {
    const cycles = [];
    const blocked = new Set();
    const B = new Map();
    const stack = [];
    const nodes = Array.from(this.adj.keys()).sort((a,b) => a - b);

    const unblock = u => {
      blocked.delete(u);
      (B.get(u) || new Set()).forEach(w => blocked.has(w) && unblock(w));
      B.set(u, new Set());
    };

    const circuit = (v, start) => {
      let found = false;
      stack.push(v);
      blocked.add(v);
      for (const { to: w } of this.adj.get(v)) {
        if (w === start) {
          cycles.push([...stack]);
          found = true;
        } else if (!blocked.has(w) && circuit(w, start)) {
          found = true;
        }
      }

      if (found) unblock(v);
      else {
        for (const { to: w } of this.adj.get(v)) {
          B.set(w, (B.get(w) || new Set()).add(v));
        }
      }

      stack.pop();
      return found;
    };

    nodes.forEach((start, idx) => {
      // Subgrafo com nós >= start
      this.adj.forEach((list, u) => {
        B.set(u, new Set());
        blocked.delete(u);
      });
      circuit(start, start);
    });
    return cycles;
  }

  // Normaliza rotações e reverte para remover duplicados
  normalizeCycle(cycle) {
    const min = Math.min(...cycle);
    const rotations = [];

    const variants = [cycle, [...cycle].reverse()];
    variants.forEach(arr => {
      arr.forEach((_, i) => {
        if (arr[i] === min) {
          rotations.push(arr.slice(i).concat(arr.slice(0, i)));
        }
      });
    });
    return rotations.sort((a,b) => a.join().localeCompare(b.join()))[0];
  }

  dedupeCycles(cycles) {
    const seen = new Set();
    return cycles.filter(cyc => {
      if (cyc.length < 2) return false;
      const key = this.normalizeCycle(cyc).join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Extrai variantes de arestas para cada ciclo de nós
  getLoopEdgeVariants(nodeCycles) {
    return nodeCycles.flatMap(cycle => {
      const options = cycle.map((u, i) => {
        const v = cycle[(i+1) % cycle.length];
        return this.edges.filter(e => e.from.id === u && e.to.id === v);
      });
      return options.reduce((acc, list) => (
        acc.flatMap(prev => list.map(e => [...prev, e]))
      ), [[]]);
    });
  }

  // DFS para todos caminhos simples de src a dst
  findAllPaths(src, dst) {
    const paths = [];
    const visit = (u, cur) => {
      if (u === dst) { paths.push([...cur]); return; }
      for (const edge of this.adj.get(u) || []) {
        if (!cur.some(e => e.to === edge.to)) {
          cur.push(edge);
          visit(edge.to, cur);
          cur.pop();
        }
      }
    };
    visit(src, []);
    return paths;
  }

  // Monta expressão de ganho L
  gainExpr(edges) {
    return edges.map(e => `(${e.weight})`).join(' * ');
  }

  // Formata Δ (Delta) global
  formatGlobalDelta(loopCount, nonTouchIdx) {
    let expr = '1';
    expr += loopCount > 0
      ? ` - (${Array.from({ length: loopCount }, (_, i) => `L${i+1}`).join(' + ')})`
      : '';

    Object.entries(nonTouchIdx).forEach(([k, groups]) => {
      if (!groups.length) return;
      const sign = (parseInt(k) % 2 === 0) ? ' + ' : ' - ';
      const terms = groups.map(gr => gr.map(i => `L${i+1}`).join(' * ')).join(' + ');
      expr += sign + `(${terms})`;
    });

    return expr;
  }

  // Gera script MATLAB completo
  generateMatlabScript(srcId, dstId) {


    const vars = new Set();
    this.edges.forEach(e => {
      const toks = e.weight.match(/\b[A-Za-z]\w*\b/g);
      if (toks) toks.forEach(v => vars.add(v));
    });
    vars.add('s');
    const symsLine = `syms ${[...vars].join(' ')};`;

    const paths = this.findAllPaths(srcId, dstId);
    const cycles = this.findAllSimpleCycles();
    const uniqueCycles = this.dedupeCycles(cycles);
    const loops = this.getLoopEdgeVariants(uniqueCycles);

    // Expressões de loops e caminhos
    const loopExprs = loops.map((loop, i) => `L${i+1} = ${this.gainExpr(loop)};`);
    const pathExprs = paths.map((p, i) => `T${i+1} = ${this.gainExpr(p)};`);

    // Cálculo de não-tocantes e Delta global
    const computeNonTouch = computeNonTouchingIndicesFromEdges(loops);
    const deltaExpr = this.formatGlobalDelta(loops.length, computeNonTouch);

    // Deltas individuais
    const deltaPaths = paths.map((p, i) => {
      const touching = idx => !touchesLoop(loops[idx], new Set([srcId, ...p.map(e => e.to)]));
      const nt = loops.map((_, j) => touching(j) ? j : -1).filter(j => j >= 0);
      return `d${i+1} = ${formatDeltaForDI(nt, computeNonTouch)};`;
    });

    return [
      symsLine,
      '% --- Loops', ...loopExprs, 
      '% --- Paths', ...pathExprs,
      '% --- Determinantes',
      `D = ${deltaExpr};`,
      ...deltaPaths,
      '% --- Função de transferência',
      `num = ${paths.map((_,i) => `T${i+1}*d${i+1}`).join(' + ')};`,
      'Gs = num / D;',
      'simplify(Gs);'
    ].join('\n');
  }
}

