
// Constantes
const GRID_SIZE = 50;
const DEFAULT_RADIUS = 20;
const HANDLE_RADIUS = 6;

const scriptmodal = (() => {
  const overlay = document.getElementById('scriptModalOverlay');
  const textarea = document.getElementById('scriptTextArea');
  const closeBtn = document.getElementById('scriptClose');

  const show = script => {
    textarea.value = script;
    overlay.classList.add('show');
  };
  const hide = () => overlay.classList.remove('show');

  closeBtn.addEventListener('click', hide);
  overlay.addEventListener('click', e => e.target === overlay && hide());

  return { show };
})();

// Editor principal
class GraphEditor {
  constructor({
    canvasId,
    addButtonId,
    deleteButtonId,
    deleteEdgeButtonId,
    linkButtonId,
    helpOverlayId,
    helpCloseId,
    modalOverlayId,
    modalTitleId,
    modalInputId,
    modalOkId,
    modalCancelId,
    loadInputId,
    saveButtonId,
    loadButtonId,
    fileHelpButtonId,
    masonButtonId
  }) {
    // Canvas e contexto
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Estado
    this.circles = [];
    this.edges = [];
    this.selectedCircles = [];
    this.circleIdCounter = 0;
    this.mode = 'none';
    this.dragging = false;
    this.draggingHandle = false;
    this.activeEdge = null;
    this.selectedCircle = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.modalCallback = null;

    // Elementos de UI
    this.addButton = document.getElementById(addButtonId);
    this.deleteButton = document.getElementById(deleteButtonId);
    this.deleteEdgeButton = document.getElementById(deleteEdgeButtonId);
    this.linkButton = document.getElementById(linkButtonId);

    this.helpOverlay = document.getElementById(helpOverlayId);
    this.helpClose = document.getElementById(helpCloseId);
    this.modalOverlay = document.getElementById(modalOverlayId);
    this.modalTitle = document.getElementById(modalTitleId);
    this.modalInput = document.getElementById(modalInputId);
    this.modalOk = document.getElementById(modalOkId);
    this.modalCancel = document.getElementById(modalCancelId);
    this.loadInput = document.getElementById(loadInputId);
    this.saveButton = document.getElementById(saveButtonId);
    this.loadButton = document.getElementById(loadButtonId);
    this.fileHelpButton = document.getElementById(fileHelpButtonId);
    this.masonButton = document.getElementById(masonButtonId);


    this.init();
  }

  init() {
    // Eventos de janela
    window.addEventListener('resize', () => this.resize());
    this.resize();

    // mason.js
    this.masonButton.addEventListener('click', () => this.runMason());

    // Eventos de arquivo
    this.saveButton.addEventListener('click', () => {
      this.saveGraph();
    });

    this.loadButton.addEventListener('click', () => {
      document.getElementById('loadInput').click();
    });

    this.fileHelpButton.addEventListener('click', () => this.helpOverlay.classList.add('show'));


    // Eventos de UI
    this.addButton.addEventListener('click', () => this.enterAddMode());
    this.linkButton.addEventListener('click', () => this.promptLinkWeight());
    this.deleteButton.addEventListener('click', () => this.deleteSelection());
    // (deleteEdgeButton faz a mesma coisa via tecla Delete)

    this.helpClose.addEventListener('click', () => this.helpOverlay.classList.remove('show'));

    this.modalOk.addEventListener('click', () => {
      if (this.modalCallback) this.modalCallback(this.modalInput.value);
      this.hideModal();
    });
    this.modalCancel.addEventListener('click', () => this.hideModal());
    this.modalInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.modalOk.click();
      if (e.key === 'Escape') this.hideModal();
    });

    this.loadInput.addEventListener('change', e => {
      if (e.target.files[0]) this.loadGraph(e.target.files[0]);
    });

    // Atalhos de teclado
    window.addEventListener('keydown', e => {
      if (e.target !== document.body) return;
      switch (e.key) {
        case 'a': case 'A': this.addButton.click(); break;
        case 'l': case 'L': this.linkButton.click(); break;
        case 'Delete': case 'Backspace': this.deleteSelection(); break;
      }
    });

    // Eventos de mouse
    this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('dblclick', e => this.onDoubleClick(e));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.draw();
  }

  enterAddMode() {
    this.mode = 'add';
    this.addButton.disabled = true;
    this.deleteButton.disabled = false;
    this.deleteEdgeButton.disabled = false;
    this.linkButton.style.display = 'none';
    this.selectedCircles.length = 0;
    this.activeEdge = null;
    this.draw();
  }

  promptLinkWeight() {
    this.showModal('Peso da ligação:', '1', val => {
      this.edges.push(new Edge(this.selectedCircles[0], this.selectedCircles[1], val.trim()));
      this.resetMode();
      this.draw();
    });
  }

  deleteSelection() {
    if (this.selectedCircles.length) {
      for (const c of this.selectedCircles) {
        this.circles = this.circles.filter(x => x !== c);
        this.edges = this.edges.filter(e => e.from !== c && e.to !== c);
      }
      this.selectedCircles = [];
    } else if (this.activeEdge) {
      this.edges = this.edges.filter(e => e !== this.activeEdge);
      this.activeEdge = null;
    }
    this.draw();
  }

  onMouseDown(e) {
    if (e.button !== 0) return;
    const pos = this.getMousePos(e);

    if (this.mode === 'add') {
      if (!this.findCircle(pos)) {
        this.circles.push(new Circle(this.circleIdCounter++, snap(pos.x), snap(pos.y)));
      }
      this.resetMode();
      this.draw();
      return;
    }

    const clickedEdge = this.findEdge(pos);
    if (clickedEdge) {
      this.activeEdge = clickedEdge;
      return this.draw();
    }

    if (this.findHandle(pos)) {
      this.draggingHandle = true;
      return;
    }

    if (!e.shiftKey) {
      this.selectedCircles = [];
      this.activeEdge = null;
      this.linkButton.style.display = 'none';
      this.draw();
    }

    const hit = this.findCircle(pos);
    if (hit && e.shiftKey) {
      const idx = this.selectedCircles.indexOf(hit);
      idx < 0 ? this.selectedCircles.push(hit) : this.selectedCircles.splice(idx, 1);
      this.draw();
      if (this.selectedCircles.length === 2) this.linkButton.style.display = 'inline-block';
      return;
    }

    if (hit && !e.shiftKey) {
      this.dragging = true;
      this.selectedCircle = hit;
      this.offsetX = pos.x - hit.x;
      this.offsetY = pos.y - hit.y;
    }
  }

  onMouseMove(e) {
    const pos = this.getMousePos(e);

    if (this.draggingHandle && this.activeEdge) {
      const { from, to } = this.activeEdge;
      const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
      const len = distance(from.x, from.y, to.x, to.y) || 1;
      const nx = -(to.y - from.y) / len, ny = (to.x - from.x) / len;
      this.activeEdge.offset = (pos.x - mx) * nx + (pos.y - my) * ny;
      return this.draw();
    }

    if (this.dragging && this.selectedCircle) {
      this.selectedCircle.x = snap(pos.x - this.offsetX);
      this.selectedCircle.y = snap(pos.y - this.offsetY);
      return this.draw();
    }
  }

  onMouseUp() {
    this.dragging = false;
    this.draggingHandle = false;
    this.selectedCircle = null;
  }

  onDoubleClick(e) {
    const pos = this.getMousePos(e);
    const c = this.findCircle(pos);
    if (c) {
      this.showModal('Label do círculo:', c.label, val => {
        c.label = val;
        this.draw();
      });
    }
  }

  resetMode() {
    this.mode = 'none';
    this.addButton.disabled = false;
    this.selectedCircles = [];
    this.activeEdge = null;
    this.linkButton.style.display = 'none';
  }

  showModal(title, defaultValue = '', callback) {
    this.modalTitle.textContent = title;
    this.modalInput.value = defaultValue;
    this.modalOverlay.classList.add('show');
    this.modalInput.focus();
    this.modalCallback = callback;
  }

  hideModal() {
    this.modalOverlay.classList.remove('show');
    this.modalCallback = null;
  }

  getMousePos(evt) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  findCircle({ x, y }) {
    return this.circles.find(c => distance(x, y, c.x, c.y) <= c.r);
  }

  findEdge(pos) {
    for (const edge of this.edges) {
      const { from, to, offset } = edge;
      const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
      const len = distance(from.x, from.y, to.x, to.y) || 1;
      const nx = -(to.y - from.y) / len, ny = (to.x - from.x) / len;
      const cx = mx + nx * offset, cy = my + ny * offset;
      for (let t = 0; t <= 1; t += 0.05) {
        const x = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t ** 2 * to.x;
        const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t ** 2 * to.y;
        if (distance(pos.x, pos.y, x, y) <= 8) return edge;
      }
    }
    return null;
  }

  findHandle({ x, y }) {
    if (!this.activeEdge) return null;
    const { from, to, offset } = this.activeEdge;
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    const len = distance(from.x, from.y, to.x, to.y) || 1;
    const nx = -(to.y - from.y) / len, ny = (to.x - from.x) / len;
    const cx = mx + nx * offset, cy = my + ny * offset;
    return distance(x, y, cx, cy) <= HANDLE_RADIUS + 2 ? this.activeEdge : null;
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.drawGrid();
    this.drawEdges();
    this.drawCircles();
  }

  drawGrid() {
    const { ctx, canvas } = this;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }

  drawCircles() {
    const { ctx } = this;
    for (const c of this.circles) {
      if (this.selectedCircles.includes(c)) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r + 4, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (c.label) {
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(c.label, c.x, c.y - c.r - 8);
      }
    }
  }

  drawEdges() {
    const { ctx } = this;
    for (const edge of this.edges) {
      const { from, to, weight, offset } = edge;
      const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
      const len = distance(from.x, from.y, to.x, to.y) || 1;
      const nx = -(to.y - from.y) / len, ny = (to.x - from.x) / len;
      const cx = mx + nx * offset, cy = my + ny * offset;

      // Curva
      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(cx, cy, to.x, to.y);
      ctx.stroke();

      // Seta
      const t = 0.95;
      const x1 = from.x + (cx - from.x) * t, y1 = from.y + (cy - from.y) * t;
      const x2 = cx + (to.x - cx) * t, y2 = cy + (to.y - cy) * t;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const tipX = to.x - Math.cos(angle) * to.r;
      const tipY = to.y - Math.sin(angle) * to.r;
      const baseX = tipX - Math.cos(angle) * 10;
      const baseY = tipY - Math.sin(angle) * 10;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(baseX - 6 * Math.sin(angle), baseY + 6 * Math.cos(angle));
      ctx.lineTo(baseX + 6 * Math.sin(angle), baseY - 6 * Math.cos(angle));
      ctx.closePath();
      ctx.fillStyle = '#0f0';
      ctx.fill();

      // Peso
      const labelX = (from.x + 2 * cx + to.x) / 4 + nx * 10;
      const labelY = (from.y + 2 * cy + to.y) / 4 + ny * 10;
      ctx.fillStyle = '#0f0';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(weight, labelX, labelY);

      // Handle ativo
      if (edge === this.activeEdge) {
        ctx.beginPath();
        ctx.arc(cx, cy, HANDLE_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  saveGraph() {
    const data = {
      circles: this.circles.map(c => ({ id: c.id, x: c.x, y: c.y, r: c.r, label: c.label })),
      edges: this.edges.map(e => ({ from: e.from.id, to: e.to.id, weight: e.weight, offset: e.offset }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  loadGraph(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        this.circles = data.circles.map(c => new Circle(c.id, c.x, c.y, c.r, c.label));
        this.circleIdCounter = Math.max(...this.circles.map(c => c.id)) + 1;
        this.edges = data.edges
          .map(e => {
            const from = this.circles.find(c => c.id === e.from);
            const to = this.circles.find(c => c.id === e.to);
            return from && to ? new Edge(from, to, e.weight, e.offset) : null;
          })
          .filter(e => e);
        this.selectedCircles = [];
        this.activeEdge = null;
        this.draw();
      } catch (err) {
        alert('Erro ao carregar o grafo: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  runMason() {
    if (this.selectedCircles.length === 2) {
      const [src, dst] = this.selectedCircles.map(c => c.id);
      const script = new GraphAnalyzer(this.circles, this.edges)
        .generateMatlabScript(src, dst);
      scriptmodal.show(script);
    } else {
      alert('Selecione exatamente dois círculos para aplicar Mason.');
    }
  }
}

// Inicializa o editor
window.graphEditor = new GraphEditor({
  canvasId: 'canvas',
  addButtonId: 'addButton',
  deleteButtonId: 'deleteButton',
  deleteEdgeButtonId: 'deleteEdgeButton',
  linkButtonId: 'linkButton',
  helpOverlayId: 'helpOverlay',
  helpCloseId: 'helpClose',
  modalOverlayId: 'modalOverlay',
  modalTitleId: 'modalTitle',
  modalInputId: 'modalInput',
  modalOkId: 'modalOk',
  modalCancelId: 'modalCancel',
  loadInputId: 'loadInput',
  saveButtonId: 'saveButton',
  loadButtonId: 'loadButton',
  fileHelpButtonId: 'fileHelpButton',
  masonButtonId: 'masonButton'
});
