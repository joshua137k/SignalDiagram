  // Modelos
  class Circle {
    constructor(id, x, y, r = DEFAULT_RADIUS, label = '') {
      this.id = id;
      this.x = x;
      this.y = y;
      this.r = r;
      this.label = label;
    }
  }

  class Edge {
    constructor(from, to, weight = '1', offset = 30) {
      this.from = from;
      this.to = to;
      this.weight = weight;
      this.offset = offset;
    }
  }
