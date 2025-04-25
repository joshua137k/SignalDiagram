// Funções utilitárias
const snap = v => Math.round(v / GRID_SIZE) * GRID_SIZE;
const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);


// --- Funções utilitárias para análise de grafo ---

// Combinações de loops não-tocantes por índices
function computeNonTouchingIndicesFromEdges(loopsEdges) {
    const n = loopsEdges.length;
    const result = {};
  
    function share(ia, ib) {
      const nodesA = new Set(loopsEdges[ia].flatMap(e => [e.from.id, e.to.id]));
      return loopsEdges[ib].some(e => nodesA.has(e.from.id) || nodesA.has(e.to.id));
    }
  
    function backtrack(start, combo, k) {
      if (combo.length === k) {
        if (!combo.some((i, a) => combo.slice(a + 1).some(j => share(i, j)))) {
          result[k].push(combo.slice());
        }
        return;
      }
      for (let i = start; i < n; i++) {
        combo.push(i);
        backtrack(i + 1, combo, k);
        combo.pop();
      }
    }
  
    for (let k = 2; k <= n; k++) {
      result[k] = [];
      backtrack(0, [], k);
    }
  
    return result;
  }
  
// Verifica se um loop toca nos nós de um path
function touchesLoop(loopEdges, pathNodes) {
    const loopNodes = new Set(loopEdges.flatMap(e => [e.from.id, e.to.id]));
    for (const n of pathNodes) {
        if (loopNodes.has(n)) return true;
    }
    return false;
}

// Formata Δ para cada caminho (sem gerar parênteses vazios)
function formatDeltaForDI(idxNotTouch, nonTouchIdx) {
    let expr = '1';

    if (idxNotTouch.length > 0) {
        expr += ' - (' + idxNotTouch.map(j => `L${j+1}`).join(' + ') + ')';
    }

    // termos combinados
    Object.keys(nonTouchIdx).forEach(k => {
        const groups = nonTouchIdx[k];
        const kval = Number(k);
        // filtra grupos que cabem em idxNotTouch
        const valid = groups.filter(g => g.every(j => idxNotTouch.includes(j)));
        if (valid.length === 0) return;

        const sign = (kval % 2 === 0 ? ' + ' : ' - ');
        const terms = valid.map(g => '(' + g.map(j => `L${j+1}`).join(' * ') + ')').join(' + ');
        expr += sign + terms;
});

return expr;
}