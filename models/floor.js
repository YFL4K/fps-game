/**
 * floor.js — 程序化地形（v11.12：±约6m 起伏 + 台地式压平 + groundAt 贴渲染面落地 + 多生物群系纹理 + 动画水面）
 * 注册: window.MODELS.floor ；并暴露
 *   window.TERRAIN = { heightAt, groundAt, waterLevel, size, flatten, resetPads, reseed, env }
 *
 * v11.12 彻底修悬空/陷地（三处根因）：
 *  1. 落地改走 groundAt()：直接对地形网格的顶点高度表做双线性采样，落地面 == 渲染面。
 *     旧版实体按连续解析噪声 heightAt 落地，而网格只是 1.875m 间隔的线性插值面，
 *     两者必然错位（±10m 起伏时可达数十厘米~1m+）→ 树/建筑/敌人/玩家悬空或陷地。
 *  2. flatten 由"强行压到 y=0"改为"局部高度的平整台地"（中心=该处原高度，外缘平滑过渡）：
 *     旧版在山坡上等于挖坑，建筑/瞭望塔因此整体沉到地面以下。
 *  3. 压平点不再跨关卡累加：由主程序每关重建前 resetPads() 后只应用本关 layout.flattens，
 *     既消除无关坑洞，也消除 heightAt 遍历随重开无限增长造成的卡顿。
 *  地形幅度按用户授权由 ±10m 降到 ±约6m，顶点间隔加密到 1.5m。
 * 地形本身 collision:false；玩家/敌人/地面实体由 index.html 调 TERRAIN.groundAt 落地。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  var THREE = global.THREE;

  var seed = Math.floor(Math.random() * 100000) + 1;
  var WATER = -1.0;
  // v11.12 压平点：{x,z,r(外缘),rc(平核心),base(该处原始地形高度)}
  // 关键修正①：旧版把中心强行压到 y=0 —— 在山丘上等于挖一个坑，建筑/塔因此"陷进地面以下"。
  //             现在压平＝保持局部高度的"平整台地"，中心严格等于 base，外缘平滑过渡回自然地形。
  // 关键修正②：旧版 6 份关卡布局在加载时把压平点全部累加进同一列表且从不 reset → 地形被挖出
  //             大量无关坑洞、heightAt 遍历成本随重开无限增长（掉帧来源之一）。现由主程序每关
  //             重建前调 resetPads() 后只应用本关 layout.flattens。
  var FLATTEN = [];
  var SIZE = 300, SEG = 200;              // v11.12 顶点间隔 1.5m（原 1.875m）
  var GRID = null, NP = SEG + 1, STEP = SIZE / SEG, HALF = SIZE / 2;

  // ---------- 值噪声（确定性，随每关种子变化） ----------
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
  // v11.12 幅度由 ±约10m 降到 ±约6m（用户反馈 ±10m 是悬空/陷地的放大因子，坡也太陡）。
  // v11.12 关键修复：这套 sin-hash 值噪声的**统计中心随种子漂移**（实测不同种子水面占比 0%~66%），
  // 有的局整张图都掉到水位以下 → 围墙/建筑/树整片"泡在水里"，看起来就是"陷入地面以下"。
  // 解决：加载时先按网格采样标定本种子的中位数与有效跨度，再把高度场**归一到设计高程带**，
  // 使每一局的起伏幅度与水面占比稳定一致（湖面按 lakeField 自身分位数取盆，同样与种子无关）。
  var SPAN = 6.4;        // 标定后 3%~97% 高程跨度（米）
  var LAND_BASE = 1.3;   // 陆地中位数高出水位的高度
  var LAKE_DEPTH = 4.2;  // 湖盆最大下切
  var CAL = { med: 0, sc: 1, l0: 0.9, l1: 1.0 };

  function baseField(x, z) {
    // 大起伏波长约 77m（坡缓）+ 低幅细节：8~16m 跨度内的高差压到 ~0.4m 级，
    // 刚性长条物体（围墙段）不会一头抬一头埋
    return (fbm(x * 0.013, z * 0.013) - 0.5) * 9.0 + (fbm(x * 0.045 + 10, z * 0.045) - 0.5) * 2.0;
  }
  function lakeField(x, z) { return fbm(x * 0.012 + 40, z * 0.012 + 40); }
  function pct(a, q) { return a[Math.round((a.length - 1) * Math.max(0, Math.min(1, q)))]; }
  function calibrate() {
    var bs = [], ls = [], M = 30;
    for (var a = 0; a < M; a++) {
      for (var b = 0; b < M; b++) {
        var x = -70 + 140 * a / (M - 1), z = -70 + 140 * b / (M - 1);
        bs.push(baseField(x, z)); ls.push(lakeField(x, z));
      }
    }
    bs.sort(function (p, q) { return p - q; });
    ls.sort(function (p, q) { return p - q; });
    CAL.med = pct(bs, 0.5);
    CAL.sc = SPAN / Math.max(0.5, pct(bs, 0.97) - pct(bs, 0.03));
    CAL.l0 = pct(ls, 0.90);                        // 约 10% 面积起盆成湖
    CAL.l1 = Math.max(CAL.l0 + 0.004, pct(ls, 0.995));
  }
  calibrate();

  function rawHeight(x, z) {
    var h = (baseField(x, z) - CAL.med) * CAL.sc + LAND_BASE;
    var lf = lakeField(x, z);
    if (lf > CAL.l0) {
      var u = Math.min(1, (lf - CAL.l0) / (CAL.l1 - CAL.l0));
      h -= u * u * (3 - 2 * u) * LAKE_DEPTH;
    }
    // 边界带保持陆地：湖盆不在地图边缘成形，否则外围围墙必然泡水/沉地（用户明确报过这条）
    // 从 e=44 起逐渐抬干，到 e≈58 完全抬到水位之上 —— 围墙在 ±64，必定站在干地上
    var e = Math.max(Math.abs(x), Math.abs(z));
    if (e > 44) {
      var k = Math.min(1, (e - 44) / 14);
      var minLand = WATER + 0.8;
      if (h < minLand) h += (minLand - h) * k;
    }
    return h;
  }
  function heightAt(x, z) {
    var h = rawHeight(x, z);
    for (var i = 0; i < FLATTEN.length; i++) {
      var fl = FLATTEN[i];
      var dx = x - fl.x, dz = z - fl.z;
      if (dx > fl.r || dx < -fl.r || dz > fl.r || dz < -fl.r) continue;   // 粗筛（每帧/每顶点都跑，省 sqrt）
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < fl.r) {
        var k = (d - fl.rc) / (fl.r - fl.rc);
        var t = k <= 0 ? 0 : (k >= 1 ? 1 : k * k * (3 - 2 * k));   // 0=平核心 → 1=自然地形
        h = fl.base * (1 - t) + h * t;
      }
    }
    return h;
  }

  // v11.12 核心修复：实体/玩家落地必须走"真正渲染出来的网格面"，而不是解析高度场。
  // 连续噪声场在 1.5m 间隔顶点之间只能是线性插值面，解析 heightAt 与之必然存在偏差
  // （±10m 起伏时可达数十厘米到 1m 以上）→ 这正是树/建筑/敌人/玩家悬空与陷地的根因。
  function groundAt(x, z) {
    if (!GRID) return heightAt(x, z);
    var gi = (x + HALF) / STEP, gj = (z + HALF) / STEP;
    if (gi < 0) gi = 0;
    if (gj < 0) gj = 0;
    if (gi > NP - 1.001) gi = NP - 1.001;
    if (gj > NP - 1.001) gj = NP - 1.001;
    var i0 = gi | 0, j0 = gj | 0, fx = gi - i0, fz = gj - j0;
    var r0 = j0 * NP, r1 = r0 + NP;
    var h00 = GRID[r0 + i0], h10 = GRID[r0 + i0 + 1];
    var h01 = GRID[r1 + i0], h11 = GRID[r1 + i0 + 1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  }

  global.TERRAIN = {
    waterLevel: WATER,
    heightAt: heightAt,     // 解析高度：仅供生成期判水/判坡
    groundAt: groundAt,     // 落地唯一入口：与渲染网格面严格一致
    size: SIZE,
    flatten: function (x, z, r) {
      var rr = (r || 6) + 3;
      FLATTEN.push({ x: x, z: z, r: rr, rc: rr * 0.72, base: rawHeight(x, z) });
    },
    resetPads: function () { FLATTEN.length = 0; GRID = null; },
    reseed: function () { seed = Math.floor(Math.random() * 100000) + 1; FLATTEN.length = 0; GRID = null; calibrate(); },
    env: null               // v11.12 昼夜系统挂载点 {mat, waterMat}
  };

  // ---------- 程序化生物群系纹理（canvas，自包含、随地形重生成） ----------
  function hash2(x, y, s) {
    var n = Math.sin(x * 127.1 + y * 311.7 + s * 0.137) * 43758.5453;
    return n - Math.floor(n);
  }
  function vn2(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  function fbm2(x, y, s) {
    var sum = 0, amp = 0.5, f = 1;
    for (var o = 0; o < 4; o++) { sum += vn2(x * f, y * f, s + o * 17) * amp; amp *= 0.5; f *= 2; }
    return sum;
  }
  // 生成一张尺寸 size 的生物群系纹理：base 基础色；scale 纹理缩放；contrast 噪声对比；speckle 颗粒；tint2 暗斑
  function biomeTexture(opts) {
    var size = 256;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(size, size);
    var d = img.data;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var n = fbm2(x / opts.scale, y / opts.scale, opts.seed);
        var n2 = fbm2(x / opts.scale * 2.7 + 50, y / opts.scale * 2.7 + 50, opts.seed + 9);
        var t = n * 0.7 + n2 * 0.3;                  // 0..1 主纹理
        var sp = (hash2(x, y, opts.seed + 3) - 0.5);  // -0.5..0.5 颗粒
        var blot = fbm2(x / (opts.scale * 2.2) + 200, y / (opts.scale * 2.2) + 200, opts.seed + 21);
        var i = (y * size + x) * 4;
        for (var ch = 0; ch < 3; ch++) {
          var v = opts.base[ch]
            + (t - 0.5) * opts.contrast[ch]
            + sp * opts.speckle[ch]
            + (blot - 0.5) * opts.blot[ch];
          v = v < 0 ? 0 : (v > 1 ? 1 : v);
          d[i + ch] = (v * 255) | 0;
        }
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  // 水面纹理（蓝色基底 + 亮色波纹）
  function waterTexture() {
    var size = 256;
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#2f86d6';
    ctx.fillRect(0, 0, size, size);
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var n = fbm2(x / 18 + 11, y / 18 + 11, 77);
        var n2 = fbm2(x / 7 + 33, y / 7 + 33, 91);
        var v = (n * 0.6 + n2 * 0.4);
        if (v > 0.62) {
          var a = (v - 0.62) / 0.38;
          ctx.fillStyle = 'rgba(180,225,255,' + (a * 0.5).toFixed(3) + ')';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  global.MODELS.floor = {
    name: 'floor',
    create: function (cfg) {
      const T = THREE;
      const g = new T.Group();
      const sc = (cfg && cfg.scale) || [1, 1, 1];   // 布局固定 [1,1,1]

      // ---- 地形网格 ----
      // v11.12：顶点高度同时写入 GRID，供 groundAt() 双线性采样 —— 保证"落地高度"
      // 与"真正渲染出来的表面"严格一致（解析 heightAt 与插值面之间的偏差正是悬空/陷地根因）。
      const geo = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG);
      geo.rotateX(-Math.PI / 2);     // 水平；顶点 y = 高度
      GRID = new Float32Array(NP * NP);
      (function () {
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i) * sc[0];
          const z = pos.getZ(i) * sc[2];
          const h = heightAt(x, z);
          pos.setY(i, h);
          const gi = Math.round((x + HALF) / STEP), gj = Math.round((z + HALF) / STEP);
          if (gi >= 0 && gi < NP && gj >= 0 && gj < NP) GRID[gj * NP + gi] = h;
        }
      })();
      geo.computeVertexNormals();

      // 生物群系纹理
      var texGrass = biomeTexture({ base: [0.26, 0.46, 0.20], scale: 22, contrast: [0.10, 0.16, 0.08], speckle: [0.05, 0.07, 0.04], blot: [0.06, 0.10, 0.05], seed: 3 });
      var texSand  = biomeTexture({ base: [0.80, 0.72, 0.50], scale: 16, contrast: [0.10, 0.09, 0.07], speckle: [0.06, 0.05, 0.04], blot: [0.05, 0.04, 0.03], seed: 11 });
      var texMud   = biomeTexture({ base: [0.36, 0.28, 0.18], scale: 18, contrast: [0.10, 0.08, 0.06], speckle: [0.05, 0.04, 0.03], blot: [0.08, 0.06, 0.04], seed: 23 });
      var texRock  = biomeTexture({ base: [0.46, 0.46, 0.50], scale: 14, contrast: [0.12, 0.12, 0.13], speckle: [0.07, 0.07, 0.07], blot: [0.06, 0.06, 0.07], seed: 31 });
      var texUnder = biomeTexture({ base: [0.18, 0.15, 0.10], scale: 20, contrast: [0.06, 0.05, 0.03], speckle: [0.04, 0.03, 0.02], blot: [0.05, 0.04, 0.02], seed: 41 });

      var mat = new T.ShaderMaterial({
        uniforms: {
          uGrass: { value: texGrass },
          uSand: { value: texSand },
          uMud: { value: texMud },
          uRock: { value: texRock },
          uUnder: { value: texUnder },
          uWater: { value: WATER },
          uTexScale: { value: 0.07 },
          uLightDir: { value: new T.Vector3(25, 40, 15).normalize() },
          uLightColor: { value: new T.Vector3(1.15, 1.08, 1.0) },
          uAmbient: { value: new T.Vector3(0.29, 0.33, 0.40) },
          uFogColor: { value: new T.Vector3(0.86, 0.93, 1.0) },
          uFogNear: { value: 90.0 },
          uFogFar: { value: 340.0 },
          uCameraPos: { value: new T.Vector3(0, 2, 14) }
        },
        vertexShader: [
          'varying vec3 vWorld;',
          'varying vec3 vNormal;',
          'varying float vH;',
          'void main(){',
          '  vec4 wp = modelMatrix * vec4(position, 1.0);',
          '  vWorld = wp.xyz;',
          '  vH = position.y;',
          '  vNormal = normalize(normalMatrix * normal);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform sampler2D uGrass, uSand, uMud, uRock, uUnder;',
          'uniform float uWater, uTexScale, uFogNear, uFogFar;',
          'uniform vec3 uLightDir, uLightColor, uAmbient, uFogColor, uCameraPos;',
          'varying vec3 vWorld, vNormal;',
          'varying float vH;',
          'void main(){',
          '  vec2 uv = vWorld.xz * uTexScale;',
          '  vec3 cGrass = texture2D(uGrass, uv).rgb;',
          '  vec3 cSand  = texture2D(uSand, uv).rgb;',
          '  vec3 cMud   = texture2D(uMud, uv).rgb;',
          '  vec3 cRock  = texture2D(uRock, uv).rgb;',
          '  vec3 cUnder = texture2D(uUnder, uv).rgb;',
          '  float h = vH;',
          '  float wUnder = 1.0 - smoothstep(uWater - 1.1, uWater - 0.25, h);',
          '  float wSand  = smoothstep(uWater - 0.9, uWater - 0.15, h) * (1.0 - smoothstep(uWater + 0.15, uWater + 0.8, h));',
          '  float wGrass = smoothstep(uWater + 0.05, uWater + 0.5, h) * (1.0 - smoothstep(1.8, 3.0, h));',
          '  float wMud   = smoothstep(1.8, 3.0, h) * (1.0 - smoothstep(3.4, 4.4, h));',
          '  float wRock  = smoothstep(3.4, 4.4, h);',
          '  float sum = wUnder + wSand + wGrass + wMud + wRock + 1e-4;',
          '  vec3 col = (cUnder*wUnder + cSand*wSand + cGrass*wGrass + cMud*wMud + cRock*wRock) / sum;',
          '  float slope = 1.0 - clamp(vNormal.y, 0.0, 1.0);',
          '  col = mix(col, cRock, smoothstep(0.20, 0.42, slope));',
          '  float ndl = max(dot(normalize(vNormal), normalize(uLightDir)), 0.0);',
          '  vec3 lit = col * (uAmbient + uLightColor * ndl);',
          '  float dist = distance(vWorld, uCameraPos);',
          '  float fog = smoothstep(uFogNear, uFogFar, dist);',
          '  lit = mix(lit, uFogColor, fog);',
          '  gl_FragColor = vec4(lit, 1.0);',
          '}'
        ].join('\n'),
        fog: false
      });
      var mesh = new T.Mesh(geo, mat);
      mesh.receiveShadow = false;
      mesh.name = 'floorTerrain';   // v11.12 贴地校验按名字精确取地形面，避免射线被水面干扰
      g.add(mesh);

      // ---- 水面（动画波纹，半透明蓝） ----
      var wtex = waterTexture();
      var wgeo = new T.PlaneGeometry(SIZE, SIZE);
      wgeo.rotateX(-Math.PI / 2);
      var wmat = new T.MeshStandardMaterial({
        color: 0x2f86d6, map: wtex, transparent: true, opacity: 0.74,
        roughness: 0.25, metalness: 0.0, depthWrite: false
      });
      var water = new T.Mesh(wgeo, wmat);
      water.position.y = WATER;
      water.name = 'floorWater';
      water.raycast = function () {};   // v11.12 水面不参与射线检测：贴地校验必须命中真正的地面
      g.add(water);

      g.userData = { waterMat: wmat, waterTex: wtex, mat: mat, t: 0 };
      // v11.12 暴露给昼夜系统：地形 shader 的光向/光色/环境光/雾色 + 水面色随太阳走
      global.TERRAIN.env = { mat: mat, waterMat: wmat, baseWaterColor: wmat.color.clone() };
      return g;
    },
    update: function (inst, dt, ctx) {
      const u = inst.userData;
      u.t += dt;
      // 水面波纹滚动
      if (u.waterTex) {
        u.waterTex.offset.x = (u.t * 0.015) % 1;
        u.waterTex.offset.y = (u.t * 0.01) % 1;
      }
      // 相机位置 → 雾/光照一致
      if (u.mat && ctx && ctx.player && ctx.player.pos) {
        u.mat.uniforms.uCameraPos.value.set(ctx.player.pos.x, ctx.player.pos.y, ctx.player.pos.z);
      }
    }
  };
})(window);
