/**
 * floor.js — 程序化地形（v11.10：±约10m 起伏 + 多生物群系纹理 + 动画水面）
 * 注册: window.MODELS.floor ；并暴露 window.TERRAIN = { heightAt, waterLevel, flatten, reseed }
 *
 * v11.10 改动：
 *  - 山丘/洼地/湖泊/草地/沙滩/泥地/岩石 按高度分生物群系，各群系使用独立程序化纹理（草地斑驳、
 *    沙地颗粒、泥地斑块、岩石裂纹、湖底淤泥），在片元着色器中按高度平滑混合并叠加坡度岩石。
 *  - 水面改为带波纹的半透明动画材质（偏移滚动），更有水的质感。
 *  - 地形幅度提升到 ±约10m（大起伏 + 细节 + 湖盆下凹），同时保留 flatten 使建筑/塔脚/出生点平整，
 *    保证战斗与攀爬瞭望塔顺畅、不卡碰撞。
 * 地形本身 collision:false；玩家/敌人由 index.html 调 TERRAIN.heightAt 落地。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  var THREE = global.THREE;

  var seed = Math.floor(Math.random() * 100000) + 1;
  var WATER = -0.55;
  var FLATTEN = [];   // {x,z,r}

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
  // v11.10 幅度：大起伏 ±7 + 细节 ±2 ≈ ±9（约10m），湖盆额外下凹形成湖泊
  function rawHeight(x, z) {
    var n1 = fbm(x * 0.013, z * 0.013);       // 大起伏（频率调低→坡更缓，利于攀爬）
    var n2 = fbm(x * 0.045 + 10, z * 0.045);  // 细节
    var h = (n1 - 0.5) * 14 + (n2 - 0.5) * 4;
    // 一处湖泊盆地（低频噪声压低中心附近）
    var lake = fbm(x * 0.012 + 40, z * 0.012 + 40);
    if (lake > 0.58) h -= (lake - 0.58) * 9;
    return h;
  }
  function heightAt(x, z) {
    var h = rawHeight(x, z);
    for (var i = 0; i < FLATTEN.length; i++) {
      var fl = FLATTEN[i];
      var dx = x - fl.x, dz = z - fl.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < fl.r) {
        var k = d / fl.r;               // 0 中心 → 1 边缘
        var t = k * k * (3 - 2 * k);   // smoothstep
        h = h * t;                     // 中心压到 0（建筑/塔脚/出生点平整）
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
    create: function () {
      const T = THREE;
      const g = new T.Group();
      const SIZE = 300, SEG = 160;   // 覆盖放大后的地图并留边缘

      // ---- 地形网格 ----
      const geo = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG);
      geo.rotateX(-Math.PI / 2);     // 水平；顶点 y = 高度
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
          uFogColor: { value: new T.Vector3(0.56, 0.83, 1.0) },
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
          '  float wUnder = 1.0 - smoothstep(uWater - 1.2, uWater - 0.3, h);',
          '  float wSand  = smoothstep(uWater - 1.0, uWater - 0.2, h) * (1.0 - smoothstep(uWater + 0.2, uWater + 0.9, h));',
          '  float wGrass = smoothstep(uWater + 0.1, uWater + 0.6, h) * (1.0 - smoothstep(2.5, 4.5, h));',
          '  float wMud   = smoothstep(2.5, 4.5, h) * (1.0 - smoothstep(5.5, 7.5, h));',
          '  float wRock  = smoothstep(5.5, 7.5, h);',
          '  float sum = wUnder + wSand + wGrass + wMud + wRock + 1e-4;',
          '  vec3 col = (cUnder*wUnder + cSand*wSand + cGrass*wGrass + cMud*wMud + cRock*wRock) / sum;',
          '  float slope = 1.0 - clamp(vNormal.y, 0.0, 1.0);',
          '  col = mix(col, cRock, smoothstep(0.28, 0.55, slope));',
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
      g.add(water);

      g.userData = { waterMat: wmat, waterTex: wtex, mat: mat, t: 0 };
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
