/**
 * floor.js — 程序化地形（v11.9：高低起伏 + 多生物群系 + 水面，替代纯平地板）
 * 注册: window.MODELS.floor ；并暴露 window.TERRAIN = { heightAt, waterLevel, flatten }
 *
 * 高度场用确定性值噪声（每关随机种子），顶点按高度着色：水下泥 / 沙滩 / 草地 / 高地泥土岩石。
 * 低洼处放一片半透明水面。地形本身 collision:false；玩家/敌人由 index.html 调 TERRAIN.heightAt 落地。
 * 大型建筑/瞭望塔登记 flatten 圆，使其脚下地面压平，避免坡地穿模/悬空。
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var seed = Math.floor(Math.random() * 100000) + 1;
  var WATER = -0.55;
  var FLATTEN = [];   // {x,z,r}

  function hash(x, z) {
    var n = Math.sin(x * 127.1 + z * 311.7 + seed * 0.017) * 43758.5453;
    return n - Math.floor(n);
  }
  function vnoise(x, z) {
    var xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    var a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  function fbm(x, z) {
    var s = 0, amp = 1, f = 1, norm = 0;
    for (var o = 0; o < 4; o++) { s += vnoise(x * f, z * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }
  function rawHeight(x, z) {
    var n1 = fbm(x * 0.022, z * 0.022);       // 大起伏
    var n2 = fbm(x * 0.075 + 10, z * 0.075);  // 细节
    var h = (n1 - 0.5) * 5.2 + (n2 - 0.5) * 1.4;
    // 一处湖泊盆地（用低频噪声压低中心附近）
    var lake = fbm(x * 0.012 + 40, z * 0.012 + 40);
    if (lake > 0.62) h -= (lake - 0.62) * 6.0;
    return h;
  }
  function heightAt(x, z) {
    var h = rawHeight(x, z);
    for (var i = 0; i < FLATTEN.length; i++) {
      var f = FLATTEN[i];
      var dx = x - f.x, dz = z - f.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < f.r) {
        var k = d / f.r;               // 0 中心 → 1 边缘
        var t = k * k * (3 - 2 * k);   // smoothstep
        h = h * t;                     // 中心压到 0
      }
    }
    return h;
  }
  global.TERRAIN = {
    waterLevel: WATER,
    heightAt: heightAt,
    flatten: function (x, z, r) { FLATTEN.push({ x: x, z: z, r: r }); },
    reseed: function () { seed = Math.floor(Math.random() * 100000) + 1; FLATTEN.length = 0; }
  };

  function biome(h) {
    // 返回 [r,g,b] 0..1
    if (h < WATER - 0.35) return [0.24, 0.20, 0.13];          // 深水底泥
    if (h < WATER + 0.15) return [0.83, 0.74, 0.50];          // 沙滩
    if (h < 1.1) {                                             // 草地（带明暗变化）
      var g = 0.52 + Math.min(0.18, (h + 0.6) * 0.12);
      return [0.24, g, 0.20];
    }
    if (h < 2.2) return [0.42, 0.34, 0.22];                   // 泥土
    return [0.46, 0.46, 0.50];                                // 高地岩石
  }

  global.MODELS.floor = {
    name: 'floor',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();
      const SIZE = 300, SEG = 150;   // 覆盖放大后的地图并留边缘
      const geo = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG);
      geo.rotateX(-Math.PI / 2);     // 水平
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const h = heightAt(x, z);
        pos.setY(i, h);
        const c = biome(h);
        colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
      }
      geo.setAttribute('color', new T.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mat = new T.MeshLambertMaterial({ vertexColors: true });
      const mesh = new T.Mesh(geo, mat);
      mesh.receiveShadow = false;
      g.add(mesh);

      // 水面（半透明蓝，覆盖全图，低于水面的地形处显现）
      const wgeo = new T.PlaneGeometry(SIZE, SIZE);
      wgeo.rotateX(-Math.PI / 2);
      const wmat = new T.MeshLambertMaterial({ color: 0x2f86d6, transparent: true, opacity: 0.72 });
      const water = new T.Mesh(wgeo, wmat);
      water.position.y = WATER;
      g.add(water);

      return g;
    }
  };
})(window);
