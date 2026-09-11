/**
 * _pixel.js — Minecraft 像素风格工具（v10.5）
 * 提供 MC 风格方块/像素纹理组件，全部基于 BoxGeometry（禁止圆柱/球/圆环）
 * 注册: window.PIXEL
 *
 * 契约：只改变视觉表现，不影响 userData/碰撞/逻辑（由各模型自行保证）
 */
(function (global) {
  var T = global.THREE;

  function hexToRgb(hex) {
    if (typeof hex === 'number') hex = hex.toString(16);
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var v = parseInt(hex, 16);
    if (isNaN(v)) return { r: 128, g: 128, b: 128 };
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }

  /** 生成低分辨率像素噪点纹理，强制 NearestFilter（像素方块质感） */
  function makeTex(color, size, noise) {
    size = size || 16;
    noise = noise === undefined ? 0.14 : noise;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var rgb = hexToRgb(color);
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var n = (Math.random() - 0.5) * 255 * noise;
        var r = Math.max(0, Math.min(255, rgb.r + n));
        var g = Math.max(0, Math.min(255, rgb.g + n));
        var b = Math.max(0, Math.min(255, rgb.b + n));
        ctx.fillStyle = 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    var tex = new T.CanvasTexture(c);
    tex.magFilter = T.NearestFilter;
    tex.minFilter = T.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  /** MC 像素材质（MeshLambertMaterial + 像素纹理） */
  function mat(color, opts) {
    opts = opts || {};
    var m = new T.MeshLambertMaterial({
      color: color,
      map: makeTex(color, opts.size || 16, opts.noise)
    });
    if (opts.emissive) m.emissive = new T.Color(opts.emissive);
    if (opts.emissiveIntensity) m.emissiveIntensity = opts.emissiveIntensity;
    if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity || 0.5; }
    return m;
  }

  /** 发光材质（MeshBasicMaterial，用于灯/提示光晕等） */
  function glowMat(color, opacity) {
    var m = new T.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity === undefined ? 0.9 : opacity });
    return m;
  }

  /** 纯立方体（带像素纹理） */
  function box(w, h, d, material) {
    return new T.Mesh(new T.BoxGeometry(w, h, d), material || mat(0xcccccc));
  }

  /** 带像素纹理的立方体（按颜色创建材质） */
  function boxColor(w, h, d, color, opts) {
    return box(w, h, d, mat(color, opts));
  }

  /** MC 像素球：方块拼接（遍历立方网格取球面层方块） */
  function sphere(r, material, cellOverride) {
    var g = new T.Group();
    var steps = Math.max(3, Math.round(r * 2.6));
    var cell = (r * 2) / steps;
    cell = cellOverride || cell;
    var half = (r * 2) / 2;
    for (var i = 0; i < steps; i++) {
      var x = -half + cell * (i + 0.5);
      for (var j = 0; j < steps; j++) {
        var y = -half + cell * (j + 0.5);
        for (var k = 0; k < steps; k++) {
          var z = -half + cell * (k + 0.5);
          var d2 = x * x + y * y + z * z;
          var r2 = r * r;
          // 只保留表面附近的方块（MC 阶梯球效果）
          if (d2 <= r2 && d2 > r2 - cell * 2.2 * r && d2 > (r - cell * 1.2) * (r - cell * 1.2)) {
            var blk = box(cell * 1.02, cell * 1.02, cell * 1.02, material);
            blk.position.set(x, y, z);
            g.add(blk);
          }
        }
      }
    }
    // 空球兜底：中心放一小块
    if (g.children.length === 0) {
      var c = box(cell * 2, cell * 2, cell * 2, material);
      g.add(c);
    }
    return g;
  }

  /** MC 像素球（按颜色） */
  function sphereColor(r, color, opts) {
    opts = opts || {};
    return sphere(r, mat(color, opts), opts.cell);
  }

  /** MC 像素方柱：替代 CylinderGeometry 的简化方形柱（MC 风格） */
  function pillar(w, h, d, color, opts) {
    return boxColor(w, h, d, color, opts);
  }

  /** MC 像素方块环（上下环带，用于车轮/指示环等，替代 TorusGeometry） */
  function ringGroup(r, thickness, color, opts) {
    opts = opts || {};
    var g = new T.Group();
    var n = Math.max(8, Math.round(r * 6));
    var cell = thickness || Math.max(0.16, r * 0.35);
    var m = mat(color, opts);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var b = box(cell, cell, cell, m);
      b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      g.add(b);
    }
    return g;
  }

  /** MC 像素圆柱（方形垛堆近似：中心柱 + 四周环，可替代 CylinderGeometry） */
  function cylinderGroup(rTop, rBottom, h, color, opts) {
    opts = opts || {};
    var g = new T.Group();
    var layers = Math.max(2, Math.round(h * 2.5));
    var cellH = h / layers;
    var m = mat(color, opts);
    var r = Math.max(rTop, rBottom) * 0.85;
    // 中心实心柱
    var core = box(r * 1.5, h, r * 1.5, m);
    core.position.y = 0;
    g.add(core);
    // 环绕外层方块（阶梯感）
    var ringN = 4;
    for (var layer = 0; layer < layers; layer++) {
      var ly = -h / 2 + cellH * (layer + 0.5);
      for (var i = 0; i < ringN; i++) {
        var a = (i / ringN) * Math.PI * 2;
        var bx = Math.cos(a) * r;
        var bz = Math.sin(a) * r;
        var b = box(r * 0.55, cellH * 1.02, r * 0.55, m);
        b.position.set(bx, ly, bz);
        g.add(b);
      }
    }
    return g;
  }

  /** 方形准星光晕（替代 CenterLight/环形光晕）：十字方块 */
  function crossGlow(size, color, opts) {
    opts = opts || {};
    var g = new T.Group();
    var s = size || 0.5;
    var m = glowMat(color, opts.opacity === undefined ? 0.75 : opts.opacity);
    var a = box(s, s * 3, s, m);
    var b = box(s * 3, s, s, m);
    g.add(a, b);
    return g;
  }

  /** 像素纹理缓存（同色同尺寸复用，减少重复创建） */
  var texCache = {};
  function cachedTex(color, size, noise) {
    var key = String(color) + '_' + (size || 16) + '_' + (noise === undefined ? 0.14 : noise);
    if (!texCache[key]) texCache[key] = makeTex(color, size, noise);
    return texCache[key];
  }

  /** MeshLambertMaterial 兼容替换：保留全部原参数，追加像素噪点纹理 */
  function matCompat(params) {
    params = params || {};
    if (params.map) {
      try {
        if (params.map.magFilter !== undefined) { params.map.magFilter = T.NearestFilter; params.map.minFilter = T.NearestFilter; params.map.generateMipmaps = false; }
      } catch (e) {}
      return new T.MeshLambertMaterial(params);
    }
    var copy = {};
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) copy[k] = params[k];
    copy.map = cachedTex(params.color === undefined ? 0xcccccc : params.color);
    return new T.MeshLambertMaterial(copy);
  }

  /** MeshBasicMaterial 兼容替换（发光提示等）：保留原参数，追加像素纹理 */
  function basicCompat(params) {
    params = params || {};
    var copy = {};
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) copy[k] = params[k];
    if (!copy.map) copy.map = cachedTex(params.color === undefined ? 0xffffff : params.color);
    return new T.MeshBasicMaterial(copy);
  }

  global.PIXEL = {
    makeTex: makeTex,
    mat: mat,
    glowMat: glowMat,
    matCompat: matCompat,
    basicCompat: basicCompat,
    box: box,
    boxColor: boxColor,
    sphere: sphere,
    sphereColor: sphereColor,
    pillar: pillar,
    ringGroup: ringGroup,
    cylinderGroup: cylinderGroup,
    crossGlow: crossGlow
  };
})(window);