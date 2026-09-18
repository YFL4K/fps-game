/**
 * enemy.js — 敌人模型 + AI + 动画 + 投射物（全自包含，v3：三类敌人；v6.5：机甲 BOSS）
 * 注册: window.MODELS.enemy
 *
 * 三大类敌人（config.enemyType）：
 *   'human'   人类士兵：持枪向玩家射击（散布较大，精准度低）
 *   'monster' 怪物：从口中喷射火球，体型更大、血量/伤害更高
 *   'boss'    BOSS：体型巨大（config.scale 放大）
 *             - 旧版人形 BOSS：火球 + 三向子弹
 *             - v6.5 机甲 BOSS（config.bossKind === 'mech'）：巨型机器人造型（每关不同配色），
 *               防御×2（defense=2，伤害减半），武器为火箭炮（AoE 爆炸）
 *
 * 主程序契约：
 *   1. create(config, ctx) 创建实例
 *   2. update(inst, dt, ctx) 每帧 AI/动画/投射物
 *   3. onHit(inst, point, ctx) 玩家子弹命中 → 返回 true 表示爆头
 *   4. inst.userData.takeDamage(dmg) 外部范围伤害（爆炸/火箭/核弹）
 *   5. inst.userData.respawnReady === true → 主程序移除（cfg.respawn=0 不重生）
 *   6. 死亡 → ctx.onEnemyKilled(pos, type)（BOSS 额外 ctx.onBossKilled(pos)）
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var LOOKS = {
    human:   { body: 0x3d5a80, dark: 0x293241, eye: 0xff3b3b },
    monster: { body: 0x7a3b58, dark: 0x4a2236, eye: 0xffe24a },
    boss:    { body: 0x4a1f2c, dark: 0x2a1016, eye: 0xff2a2a },
    spider:  { body: 0x2d1f1f, dark: 0x1a1212, eye: 0xff4444, leg: 0x3d2b2b }
  };

  // v6.5 机甲 BOSS 配色（每关不同造型）：红 / 蓝 / 绿 / 紫 / 金
  var MECH_SKINS = [
    { main: 0xb03a2e, dark: 0x5a1d16, accent: 0xffd166, visor: 0xff5533 },  // 红（第3关）
    { main: 0x2e5fb0, dark: 0x16305a, accent: 0x8fd3ff, visor: 0x66ccff },  // 蓝（第4关）
    { main: 0x2e8f4e, dark: 0x12401f, accent: 0xb6ff8f, visor: 0x88ff66 },  // 绿（第5关）
    { main: 0x7a3bb0, dark: 0x38155a, accent: 0xe6b8ff, visor: 0xd488ff },  // 紫（无尽随机）
    { main: 0xc9a227, dark: 0x5c4708, accent: 0xfff3c4, visor: 0xffcc33 }   // 金（无尽随机）
  ];

  /* ================= v11.13 机器人（X战警「哨兵」风格）建模基础设施 =================
   * 旧版士兵每生成一只就 new 二十多个 Geometry：一波 20 只 = 几百次 GPU 上载，死亡时再逐个
   * dispose → 上载/释放反复横跳，是刷怪瞬间掉帧的主因之一。这里做两件事：
   *  1) 基础形状按参数全局缓存（跨实例共享，标 __shared，主程序单体销毁时不会释放它）；
   *  2) 同一枢轴内、同一材质的所有部件**烘焙合并成一个 BufferGeometry**（保留 position/normal/uv），
   *     于是每只机器人只剩个位数 draw call，且全场共用同一批合并后的几何体（0 次重复上载）。
   * =============================================================================== */
  var GEOC = {};
  function cachedGeo(key, make) {
    var g = GEOC[key];
    if (!g) { g = GEOC[key] = make(); g.__shared = true; }
    return g;
  }
  function gbBox(R, w, h, d, r) { return cachedGeo('B|' + w + '|' + h + '|' + d + '|' + r, function () { return R.roundedBox(w, h, d, r); }); }
  function gbCyl(R, rad, len, seg) { return cachedGeo('Y|' + rad + '|' + len + '|' + seg, function () { return R.roundedCyl(rad, rad, len, seg); }); }
  function gbCylZ(R, rad, len, seg) { return cachedGeo('Z|' + rad + '|' + len + '|' + seg, function () { return R.cylZ(rad, rad, len, seg); }); }
  function gbSph(T, r, a, b) { return cachedGeo('S|' + r + '|' + a + '|' + b, function () { return new T.SphereGeometry(r, a, b); }); }
  function gbCone(T, r, h, seg) { return cachedGeo('N|' + r + '|' + h + '|' + seg, function () { return new T.ConeGeometry(r, h, seg); }); }

  var _m4 = null, _m3 = null, _q = null, _e = null, _vp = null, _vn = null, _p3 = null, _s3 = null;
  function ensureTmp(T) {
    if (_m4) return;
    _m4 = new T.Matrix4(); _m3 = new T.Matrix3(); _q = new T.Quaternion(); _e = new T.Euler();
    _vp = new T.Vector3(); _vn = new T.Vector3(); _p3 = new T.Vector3(); _s3 = new T.Vector3();
  }
  // 把一批部件（{geo,p:[x,y,z],r:[rx,ry,rz],s:[sx,sy,sz]}）合并为一个几何体；结果同样按 key 缓存
  function mergeGeo(T, R, key, list) {
    return cachedGeo('M|' + key, function () {
      ensureTmp(T);
      var pa = [], na = [], ua = [], ix = [], vo = 0;
      for (var i = 0; i < list.length; i++) {
        var it = list[i], geo = it.geo;
        var p = it.p || [0, 0, 0], r = it.r || [0, 0, 0], s = it.s || [1, 1, 1];
        _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e);
        _p3.set(p[0], p[1], p[2]); _s3.set(s[0], s[1], s[2]);
        _m4.compose(_p3, _q, _s3);
        _m3.getNormalMatrix(_m4);
        var pos = geo.attributes.position, nor = geo.attributes.normal, uvs = geo.attributes.uv;
        var n = pos.count;
        for (var v = 0; v < n; v++) {
          _vp.fromBufferAttribute(pos, v).applyMatrix4(_m4);
          pa.push(_vp.x, _vp.y, _vp.z);
          if (nor) { _vn.fromBufferAttribute(nor, v).applyMatrix3(_m3).normalize(); na.push(_vn.x, _vn.y, _vn.z); }
          else na.push(0, 1, 0);
          if (uvs) ua.push(uvs.getX(v), uvs.getY(v)); else ua.push(0, 0);
        }
        var gi = geo.index;
        if (gi) { for (var k = 0; k < gi.count; k++) ix.push(gi.array[k] + vo); }
        else { for (var k2 = 0; k2 < n; k2++) ix.push(k2 + vo); }
        vo += n;
      }
      var out = new T.BufferGeometry();
      out.setAttribute('position', new T.Float32BufferAttribute(pa, 3));
      out.setAttribute('normal', new T.Float32BufferAttribute(na, 3));
      out.setAttribute('uv', new T.Float32BufferAttribute(ua, 2));
      out.setIndex(ix);
      out.computeBoundingSphere();
      return out;   // cachedGeo 外层会补 __shared
    });
  }
  function meshOf(geo, mat) { var m = new global.THREE.Mesh(geo, mat); m.castShadow = false; m.receiveShadow = false; return m; }

  // v11.15 水深采样：返回该点水面以下深度（米），陆地/浅水(<=0.5m)视为可通行返回 0 判定用
  function waterDepth(x, z) {
    if (!global.TERRAIN || global.TERRAIN.waterLevel == null || !global.TERRAIN.groundAt) return 0;
    var g = global.TERRAIN.groundAt(x, z);
    return g < global.TERRAIN.waterLevel ? (global.TERRAIN.waterLevel - g) : 0;
  }
  // v11.15 敌人移动避水：向 (dirX,dirZ) 走 stepLen；若落点在深水(>0.5m)则左右滑动绕行，
  // 四周皆深水则原地不动。返回是否实际移动。
  function stepAvoidWater(inst, dirX, dirZ, stepLen) {
    var nx = inst.position.x + dirX * stepLen;
    var nz = inst.position.z + dirZ * stepLen;
    if (waterDepth(nx, nz) <= 0.5) {
      inst.position.x = nx;
      inst.position.z = nz;
      return true;
    }
    var px = -dirZ, pz = dirX;   // 垂直方向
    var lx = inst.position.x + px * stepLen, lz = inst.position.z + pz * stepLen;
    var rx = inst.position.x - px * stepLen, rz = inst.position.z - pz * stepLen;
    var dl = waterDepth(lx, lz), dr = waterDepth(rx, rz);
    if (dl <= 0.5 && dl <= dr) { inst.position.x = lx; inst.position.z = lz; return true; }
    if (dr <= 0.5) { inst.position.x = rx; inst.position.z = rz; return true; }
    return false;
  }

  /* ---- 哨兵机器人：外壳/内骨骼/发光/涂装 四组材质，一台机器人一次构建 ---- */
  // 4 套涂装让同批敌人互相有别（外形一致、配色不同）
  var ROBOT_SCHEMES = [
    { shell: 0x9fb0c2, dark: 0x2a2f38, glow: 0xff3b30, accent: 0xd9e2ec, name: 'steel' },
    { shell: 0x6d7f95, dark: 0x1e242c, glow: 0x4ad1ff, accent: 0xb8c6d6, name: 'cobalt' },
    { shell: 0x8a7f5c, dark: 0x33301f, glow: 0xffb020, accent: 0xcfc7a6, name: 'olive' },
    { shell: 0xd6dbe2, dark: 0x3a3f47, glow: 0x9b5cff, accent: 0xffffff, name: 'chrome' }
  ];

  // 返回 { pivots, gunPivot, muzzleLocal, meshes }：外形与主程序契约完全一致
  function buildRobot(g, T, R, scheme) {
    var mats = {
      // bodyMat 必须"每实例独占"：受击闪红直接改它的 emissive（共享会让全场敌人一起闪）
      body: new window.MARIO.mat({ color: scheme.shell }),
      dark: new window.MARIO.mat({ color: scheme.dark }),
      glow: new window.MARIO.mat({ color: scheme.glow, emissive: scheme.glow, emissiveIntensity: 2.0 }),
      accent: new window.MARIO.mat({ color: scheme.accent })
    };
    var sk = scheme.name;

    /* 躯干 + 头（不单独动，全部并入 root）*/
    var shell = [
      { geo: gbBox(R, 0.62, 0.62, 0.44, 0.13), p: [0, 1.42, 0.02] },                 // 胸甲
      { geo: gbBox(R, 0.5, 0.2, 0.46, 0.09), p: [0, 1.74, 0.0] },                    // 上胸/领口
      { geo: gbBox(R, 0.26, 0.22, 0.4, 0.1), p: [-0.46, 1.62, 0], r: [0, 0, 0.22] }, // 左肩甲
      { geo: gbBox(R, 0.26, 0.22, 0.4, 0.1), p: [0.46, 1.62, 0], r: [0, 0, -0.22] }, // 右肩甲
      { geo: gbSph(T, 0.19, 16, 12), p: [0, 1.95, 0.01], s: [1.0, 1.02, 1.3] },      // 哨兵头（拉长）
      { geo: gbBox(R, 0.34, 0.12, 0.3, 0.05), p: [0, 1.88, -0.02] },                 // 面颊护板
      { geo: gbBox(R, 0.05, 0.22, 0.36, 0.02), p: [0, 2.14, -0.03], r: [-0.18, 0, 0] }, // 头顶冠鳍
      { geo: gbBox(R, 0.14, 0.34, 0.16, 0.06), p: [-0.34, 1.06, 0.02] },             // 左髋甲
      { geo: gbBox(R, 0.14, 0.34, 0.16, 0.06), p: [0.34, 1.06, 0.02] }               // 右髋甲
    ];
    var dark = [
      { geo: gbCyl(R, 0.075, 0.2, 10), p: [0, 1.8, 0] },                             // 颈
      { geo: gbCyl(R, 0.1, 0.16, 10), p: [-0.33, 1.56, 0], r: [0, 0, 1.57] },        // 左肩关节
      { geo: gbCyl(R, 0.1, 0.16, 10), p: [0.33, 1.56, 0], r: [0, 0, 1.57] },         // 右肩关节
      { geo: gbBox(R, 0.44, 0.3, 0.34, 0.1), p: [0, 1.08, 0] },                      // 腹节
      { geo: gbBox(R, 0.5, 0.2, 0.36, 0.08), p: [0, 0.88, 0] },                      // 骨盆
      { geo: gbCylZ(R, 0.07, 0.24, 8), p: [-0.15, 1.44, -0.28] },                    // 背部排气
      { geo: gbCylZ(R, 0.07, 0.24, 8), p: [0.15, 1.44, -0.28] },                     // 背部排气
      { geo: gbBox(R, 0.2, 0.05, 0.06, 0.02), p: [0, 1.86, 0.18] },                  // 口部栅格
      { geo: gbBox(R, 0.5, 0.07, 0.34, 0.03), p: [0, 0.79, 0] }                      // 腰轴
    ];
    var glow = [
      { geo: gbBox(R, 0.3, 0.055, 0.06, 0.02), p: [0, 1.99, 0.19] },                 // 目镜光带
      { geo: gbSph(T, 0.045, 12, 10), p: [-0.1, 1.99, 0.2] },                        // 左眼
      { geo: gbSph(T, 0.045, 12, 10), p: [0.1, 1.99, 0.2] },                         // 右眼
      { geo: gbSph(T, 0.1, 14, 12), p: [0, 1.45, 0.24] },                            // 胸口聚变核心
      { geo: gbCyl(R, 0.12, 0.07, 12), p: [0, 1.28, -0.3], r: [1.57, 0, 0] }         // 推进器环
    ];
    var accent = [
      { geo: gbBox(R, 0.08, 0.3, 0.03, 0.015), p: [-0.17, 1.45, 0.24] },
      { geo: gbBox(R, 0.08, 0.3, 0.03, 0.015), p: [0.17, 1.45, 0.24] },
      { geo: gbBox(R, 0.28, 0.045, 0.42, 0.02), p: [-0.47, 1.73, 0], r: [0, 0, 0.22] },
      { geo: gbBox(R, 0.28, 0.045, 0.42, 0.02), p: [0.47, 1.73, 0], r: [0, 0, -0.22] }
    ];
    g.add(meshOf(mergeGeo(T, R, 'body_shell_', shell), mats.body));
    g.add(meshOf(mergeGeo(T, R, 'body_dark_', dark), mats.dark));
    g.add(meshOf(mergeGeo(T, R, 'body_glow_', glow), mats.glow));
    g.add(meshOf(mergeGeo(T, R, 'body_accent_', accent), mats.accent));

    /* 手臂（持枪姿势，与旧契约一致：pivot 在肩，rotation.x≈-1.15） */
    function armPivot(side) {
      var pv = new T.Group();
      pv.position.set(0.33 * side, 1.53, 0.08);
      pv.rotation.x = -1.15; pv.rotation.y = -0.18 * side;
      var dparts = [
        { geo: gbCyl(R, 0.075, 0.4, 10), p: [0, -0.24, 0] },                         // 上臂液压
        { geo: gbSph(T, 0.085, 12, 10), p: [0, -0.47, 0] },                          // 肘关节
        { geo: gbCone(T, 0.05, 0.14, 6), p: [-0.045 * side, -0.6, 0.14], r: [2.4, 0, 0.2 * side] },
        { geo: gbCone(T, 0.05, 0.14, 6), p: [0.045 * side, -0.6, 0.14], r: [2.4, 0, -0.2 * side] }
      ];
      var sparts = [
        { geo: gbBox(R, 0.15, 0.32, 0.17, 0.06), p: [0, -0.64, 0.01] },              // 护臂
        { geo: gbBox(R, 0.12, 0.06, 0.16, 0.02), p: [0, -0.51, 0.03] }               // 腕环
      ];
      pv.add(meshOf(mergeGeo(T, R, 'arm_dark_', dparts), mats.dark));
      pv.add(meshOf(mergeGeo(T, R, 'arm_shell_', sparts), mats.body));
      g.add(pv);
      return pv;
    }
    /* 腿（活塞式关节 + 金属胫甲 + 楔形脚） */
    function legPivot(side) {
      var pv = new T.Group();
      pv.position.set(0.165 * side, 0.8, 0);
      var dparts = [
        { geo: gbCyl(R, 0.085, 0.34, 10), p: [0, -0.2, 0] },                         // 大腿活塞
        { geo: gbSph(T, 0.075, 12, 10), p: [0, -0.4, 0] }                            // 膝关节
      ];
      var sparts = [
        { geo: gbBox(R, 0.17, 0.4, 0.2, 0.07), p: [0, -0.62, 0.02] },                // 胫甲
        { geo: gbBox(R, 0.2, 0.1, 0.34, 0.04), p: [0, -0.85, 0.07] },                // 楔形脚
        { geo: gbBox(R, 0.13, 0.06, 0.2, 0.02), p: [0, -0.44, 0.02] }                // 踝护板
      ];
      pv.add(meshOf(mergeGeo(T, R, 'leg_dark_', dparts), mats.dark));
      pv.add(meshOf(mergeGeo(T, R, 'leg_shell_', sparts), mats.body));
      g.add(pv);
      return pv;
    }
    /* 步枪（独立 pivot 供后坐力动画；枪口朝 +Z 与 muzzleLocal 对齐） */
    var gunPivot = new T.Group();
    gunPivot.position.set(0, 1.38, 0.5);
    var gd = [
      { geo: gbBox(R, 0.1, 0.14, 0.5, 0.035), p: [0, 0, 0.06] },                     // 机匣
      { geo: gbCylZ(R, 0.032, 0.44, 10), p: [0, 0.02, 0.5] },                        // 枪管
      { geo: gbBox(R, 0.06, 0.16, 0.09, 0.02), p: [0, -0.13, 0.02] },                // 握把
      { geo: gbBox(R, 0.07, 0.09, 0.2, 0.02), p: [0, 0.1, -0.12] }                   // 托/尾部
    ];
    var gg = [
      { geo: gbSph(T, 0.05, 12, 10), p: [0, 0.02, 0.74] },                           // 枪口发光器
      { geo: gbBox(R, 0.05, 0.04, 0.16, 0.015), p: [0, 0.09, 0.28] }                 // 能量导轨
    ];
    gunPivot.add(meshOf(mergeGeo(T, R, 'gun_dark_', gd), mats.dark));
    gunPivot.add(meshOf(mergeGeo(T, R, 'gun_glow_', gg), mats.glow));
    g.add(gunPivot);

    return {
      armPivotL: armPivot(-1), armPivotR: armPivot(1),
      legPivotL: legPivot(-1), legPivotR: legPivot(1),
      gunPivot: gunPivot,
      muzzleLocal: new T.Vector3(0, 1.4, 1.25),
      bodyMat: mats.body
    };
  }



  global.MODELS.enemy = {
    name: 'enemy',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const type = cfg.enemyType || 'human';
      const look = LOOKS[type] || LOOKS.human;
      const isMonster = (type === 'monster');
      const isBoss = (type === 'boss');
      // v6.5 机甲 BOSS
      const isMech = isBoss && cfg.bossKind === 'mech';
      const skinIdx = Math.max(0, Math.min(MECH_SKINS.length - 1, (cfg.bossSkin || 1) - 1));
      const skin = MECH_SKINS[skinIdx];
      const g = new T.Group();
      var R = global.ROUND;
      function rb(p, mat, w, h, d, r, x, y, z, rx, ry, rz) { var m = new T.Mesh(R.roundedBox(w, h, d, r), mat); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); p.add(m); return m; }
      function cap(p, mat, radius, len, x, y, z, rx, ry, rz) { var m = new T.Mesh(R.roundedCyl(radius, radius, len, 12), mat); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); p.add(m); return m; }
      function sph(p, mat, r, x, y, z, sx, sy, sz) { var m = new T.Mesh(new T.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, z); if (sx !== undefined) m.scale.set(sx, sy, sz); p.add(m); return m; }
      function cone(p, mat, r, h, seg, x, y, z, rx, ry, rz) { var m = new T.Mesh(new T.ConeGeometry(r, h, seg), mat); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); p.add(m); return m; }

      const matBody = new window.MARIO.mat({ color: isMech ? skin.main : look.body});
      const matDark = new window.MARIO.mat({ color: isMech ? skin.dark : look.dark});
      const matEye = new window.MARIO.mat({ color: look.eye, emissive: look.eye, emissiveIntensity: 1.6 });
      const matGun = new window.MARIO.mat({ color: 0x1b1e23});
      const matHand = new window.MARIO.mat({ color: 0x2e3d52});
      const matAccent = new window.MARIO.mat({ color: (skin && skin.accent) || 0xffd166});
      const matVisor = new window.MARIO.mat({ color: (skin && skin.visor) || 0xff5533, emissive: (skin && skin.visor) || 0xff5533, emissiveIntensity: 2.2 });

      // ---- 共享枢轴（机甲 / 人形共用） ----
      var gunPivot, armPivotL, armPivotR, legPivotL, legPivotR, muzzleLocal = null, gunZ = 0.6;
      var robotBodyMat = null;   // v11.13 机器人本体材质（受击闪红用；其余材质同实例共享）

      if (isMech) {
        // ===== v10.6 机甲 BOSS：酷霸王(Bowser)机甲风格（圆润厚重 + 刺球肩 + 履带重足 + 半透明座舱）=====
        gunZ = 0.55;
        var warnMat = new window.MARIO.mat({ color: 0xffc107 });   // 警示黄
        var redMat = new window.MARIO.mat({ color: 0xa02222 });    // 暗红
        var cockpitMat = new window.MARIO.mat({ color: 0x7a1f1f, transparent: true, opacity: 0.55 }); // 半透明暗红座舱盖

        // 腿 + 圆角履带重足
        legPivotL = new T.Group(); legPivotL.position.set(-0.38, 0.95, 0);
        var legL = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 0.95, 16), matDark);
        legL.position.y = -0.45; legL.castShadow = true; legPivotL.add(legL);
        var trackL = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.5, 20), warnMat);
        trackL.rotation.x = Math.PI / 2; trackL.position.set(0, -0.98, 0.06); legPivotL.add(trackL);
        g.add(legPivotL);

        legPivotR = new T.Group(); legPivotR.position.set(0.38, 0.95, 0);
        var legR = new T.Mesh(new T.CylinderGeometry(0.2, 0.24, 0.95, 16), matDark);
        legR.position.y = -0.45; legR.castShadow = true; legPivotR.add(legR);
        var trackR = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.5, 20), warnMat);
        trackR.rotation.x = Math.PI / 2; trackR.position.set(0, -0.98, 0.06); legPivotR.add(trackR);
        g.add(legPivotR);

        // 髋部（圆润）
        var hip = new T.Mesh(new T.SphereGeometry(0.55, 20, 16), matDark);
        hip.scale.set(1.6, 0.6, 1.0); hip.position.y = 1.05; hip.castShadow = true; g.add(hip);

        // 躯干（厚重圆润）
        var torso = new T.Mesh(new T.SphereGeometry(0.85, 24, 20), matBody);
        torso.scale.set(1.0, 1.15, 0.85); torso.position.y = 1.85; torso.castShadow = true; g.add(torso);
        var chestPlate = new T.Mesh(new T.SphereGeometry(0.5, 18, 14), warnMat);
        chestPlate.scale.set(1.1, 0.9, 0.5); chestPlate.position.set(0, 1.95, 0.5); g.add(chestPlate);
        var core = new T.Mesh(new T.SphereGeometry(0.16, 14, 12), matVisor);
        core.position.set(0, 1.95, 0.68); g.add(core);

        // 刺球肩膀（球体 + 尖刺）
        function makeSpikedShoulder(side) {
          var grp = new T.Group();
          var ball = new T.Mesh(new T.SphereGeometry(0.45, 20, 16), matDark);
          grp.add(ball);
          for (var si = 0; si < 8; si++) {
            var a = (si / 8) * Math.PI * 2;
            var spike = new T.Mesh(new T.ConeGeometry(0.09, 0.35, 8), warnMat);
            spike.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0);
            spike.rotation.z = a;
            grp.add(spike);
          }
          grp.position.set(side * 1.05, 2.45, 0);
          return grp;
        }
        g.add(makeSpikedShoulder(-1), makeSpikedShoulder(1));

        // 头 + 半透明座舱盖 + 发光复眼核心
        var head = new T.Mesh(new T.SphereGeometry(0.42, 20, 16), matDark);
        head.scale.set(1.0, 0.85, 0.9); head.position.y = 2.72; head.castShadow = true; g.add(head);
        var cockpit = new T.Mesh(new T.SphereGeometry(0.34, 20, 16), cockpitMat);
        cockpit.scale.set(0.9, 0.7, 0.8); cockpit.position.set(0, 2.7, 0.2); g.add(cockpit);
        var eyeCore = new T.Mesh(new T.SphereGeometry(0.12, 12, 10), matVisor);
        eyeCore.position.set(0, 2.72, 0.38); g.add(eyeCore);

        // 粗圆柱机械臂
        armPivotL = new T.Group();
        armPivotL.position.set(-1.1, 2.0, 0.15);
        armPivotL.rotation.x = -1.15; armPivotL.rotation.y = 0.22;
        var armL = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.95, 14), matDark);
        armL.position.y = -0.475; armL.castShadow = true; armPivotL.add(armL);
        var fistL = new T.Mesh(new T.SphereGeometry(0.24, 16, 14), redMat);
        fistL.position.y = -0.95; armPivotL.add(fistL);
        g.add(armPivotL);

        armPivotR = new T.Group();
        armPivotR.position.set(1.1, 2.0, 0.15);
        armPivotR.rotation.x = -1.15; armPivotR.rotation.y = -0.22;
        var armR = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 0.95, 14), matDark);
        armR.position.y = -0.475; armR.castShadow = true; armPivotR.add(armR);
        var fistR = new T.Mesh(new T.SphereGeometry(0.24, 16, 14), redMat);
        fistR.position.y = -0.95; armPivotR.add(fistR);
        g.add(armPivotR);

        // 火箭炮主武器（粗圆筒 + 圆头）
        gunPivot = new T.Group();
        gunPivot.position.set(0, 1.75, 0.55);
        var launcher = new T.Mesh(new T.CylinderGeometry(0.26, 0.3, 1.3, 16), matDark);
        launcher.rotation.x = Math.PI / 2; launcher.position.z = 0.35; launcher.castShadow = true; gunPivot.add(launcher);
        var barrel = new T.Mesh(new T.CylinderGeometry(0.15, 0.17, 0.8, 14), matGun);
        barrel.rotation.x = Math.PI / 2; barrel.position.z = 1.0; barrel.castShadow = true; gunPivot.add(barrel);
        var muzzle = new T.Mesh(new T.SphereGeometry(0.18, 14, 12), warnMat);
        muzzle.position.z = 1.42; gunPivot.add(muzzle);
        var grip = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.3, 10), matGun);
        grip.position.set(0, -0.3, 0.3); gunPivot.add(grip);
        var finL = new T.Mesh(new T.BoxGeometry(0.08, 0.32, 0.5), warnMat);
        finL.position.set(-0.24, 0, 0.5); gunPivot.add(finL);
        var finR = finL.clone(); finR.position.x = 0.24; gunPivot.add(finR);
        g.add(gunPivot);
        muzzleLocal = new T.Vector3(0, 1.75, 1.55);
      } else {
      // ===== v11.1 圆润 + 差异化人形（人类士兵 / 怪物 / 旧版BOSS）=====
      var helmetMat = new window.MARIO.mat({ color: 0x2b3550 });
      var armorMat = new window.MARIO.mat({ color: 0x33405e });
      var skinMat = new window.MARIO.mat({ color: isMonster ? 0x8a4a6a : 0xc9a07a });
      var bootMat = new window.MARIO.mat({ color: 0x14161a });
      var hornMat = new window.MARIO.mat({ color: 0xd8d8e0 });

      if (isMonster) {
        // 怪物：弓背巨躯 + 小头 + 巨臂巨拳 + 肩背尖刺（与士兵轮廓明显不同）
        rb(g, matBody, 0.95, 0.9, 0.66, 0.3, 0, 1.32, 0, -0.12, 0, 0);
        sph(g, matBody, 0.5, 0, 1.32, 0.16, 1.1, 0.9, 1.0);
        sph(g, matDark, 0.42, 0, 0.98, 0.0, 1.15, 0.7, 1.0);
        for (var ms = -1; ms <= 1; ms += 2) {
          sph(g, matDark, 0.3, ms * 0.62, 1.62, 0);
          for (var k = 0; k < 3; k++) cone(g, matDark, 0.07, 0.32, 6, ms * 0.62 + (k - 1) * 0.16, 1.86, 0, -0.2, 0, ms * 0.2);
        }
        for (var bs = 0; bs < 4; bs++) cone(g, matDark, 0.08, 0.34, 6, 0, 1.55, -0.28 - bs * 0.18, -0.6, 0, 0);
        sph(g, matBody, 0.26, 0, 1.95, 0.16);
        rb(g, matDark, 0.3, 0.16, 0.24, 0.06, 0, 1.82, 0.34);
        cone(g, matDark, 0.06, 0.34, 6, -0.16, 2.12, 0.12, -0.4, 0, -0.4);
        cone(g, matDark, 0.06, 0.34, 6, 0.16, 2.12, 0.12, -0.4, 0, 0.4);
        sph(g, matEye, 0.06, -0.1, 1.98, 0.36);
        sph(g, matEye, 0.06, 0.1, 1.98, 0.36);
        armPivotL = new T.Group(); armPivotL.position.set(-0.55, 1.55, 0.1); armPivotL.rotation.x = -0.6;
        cap(armPivotL, matBody, 0.17, 0.6, 0, -0.3, 0);
        sph(armPivotL, matDark, 0.26, 0, -0.66, 0);
        g.add(armPivotL);
        armPivotR = new T.Group(); armPivotR.position.set(0.55, 1.55, 0.1); armPivotR.rotation.x = -0.6;
        cap(armPivotR, matBody, 0.17, 0.6, 0, -0.3, 0);
        sph(armPivotR, matDark, 0.26, 0, -0.66, 0);
        g.add(armPivotR);
        legPivotL = new T.Group(); legPivotL.position.set(-0.26, 0.85, 0);
        cap(legPivotL, matDark, 0.16, 0.6, 0, -0.32, 0);
        rb(legPivotL, bootMat, 0.26, 0.16, 0.4, 0.06, 0, -0.66, 0.08);
        g.add(legPivotL);
        legPivotR = new T.Group(); legPivotR.position.set(0.26, 0.85, 0);
        cap(legPivotR, matDark, 0.16, 0.6, 0, -0.32, 0);
        rb(legPivotR, bootMat, 0.26, 0.16, 0.4, 0.06, 0, -0.66, 0.08);
        g.add(legPivotR);
        gunPivot = new T.Group(); gunPivot.position.set(0, 1.42, 0.6); g.add(gunPivot);
      } else if (!isBoss) {
        // v11.13 普通敌人士兵 → 机器人（X战警「哨兵」风格）：拉长头盔 + 头顶冠鳍 + 发光目镜带
        // + 胸口聚变核心 + 背部推进器/排气 + 活塞关节 + 爪手 + 能量步枪；4 套涂装互相有别。
        // 几何体全部走全局缓存并做同材质合批，刷怪不再反复上载/dispose（掉帧主因之一）。
        var sch = ROBOT_SCHEMES[(typeof cfg.skinIdx === 'number') ? (cfg.skinIdx % ROBOT_SCHEMES.length)
          : Math.floor(Math.random() * ROBOT_SCHEMES.length)];
        var rb2 = buildRobot(g, T, R, sch);
        armPivotL = rb2.armPivotL; armPivotR = rb2.armPivotR;
        legPivotL = rb2.legPivotL; legPivotR = rb2.legPivotR;
        gunPivot = rb2.gunPivot; muzzleLocal = rb2.muzzleLocal;
        robotBodyMat = rb2.bodyMat;
        gunZ = 0.5;
      } else {
        // 旧版人形 BOSS（v6.5 起 BOSS 已改用机甲，此处仅作兜底保留）：圆润军姿 + 头盔 + 战术背心 + 步枪
        var sc = isBoss ? 1.15 : 1.0;
        rb(g, matBody, 0.6 * sc, 0.72 * sc, 0.42 * sc, 0.14, 0, 1.25, 0);
        rb(g, armorMat, 0.5 * sc, 0.42 * sc, 0.12, 0.06, 0, 1.32, 0.24);
        rb(g, armorMat, 0.44 * sc, 0.36 * sc, 0.1, 0.05, 0, 1.2, -0.26);
        sph(g, matDark, 0.15 * sc, -0.34 * sc, 1.52, 0);
        sph(g, matDark, 0.15 * sc, 0.34 * sc, 1.52, 0);
        cap(g, skinMat, 0.1, 0.36, 0, 1.73, 0.02);   // 脖子：连接躯干与头，消除头悬空
        sph(g, skinMat, 0.17, 0, 1.9, 0.02);
        sph(g, helmetMat, 0.21, 0, 1.99, 0.0, 1.0, 0.82, 1.05);
        rb(g, helmetMat, 0.42, 0.05, 0.44, 0.02, 0, 1.94, 0.0);
        rb(g, matDark, 0.3, 0.06, 0.06, 0.02, 0, 1.99, -0.19);
        sph(g, matEye, 0.045, -0.07, 1.9, 0.16);
        sph(g, matEye, 0.045, 0.07, 1.9, 0.16);
        if (isBoss) {
          cone(g, hornMat, 0.08, 0.4, 8, -0.16, 2.16, 0.0, -0.3, 0, -0.5);
          cone(g, hornMat, 0.08, 0.4, 8, 0.16, 2.16, 0.0, -0.3, 0, 0.5);
          rb(g, matDark, 1.5, 0.3, 0.7, 0.12, 0, 1.6, 0);
        }
        armPivotL = new T.Group(); armPivotL.position.set(-0.32, 1.5, 0.05); armPivotL.rotation.x = -1.15; armPivotL.rotation.y = 0.18;
        cap(armPivotL, matDark, 0.09, 0.5, 0, -0.25, 0);
        sph(armPivotL, matHand, 0.1, 0, -0.52, 0);
        g.add(armPivotL);
        armPivotR = new T.Group(); armPivotR.position.set(0.32, 1.5, 0.05); armPivotR.rotation.x = -1.15; armPivotR.rotation.y = -0.18;
        cap(armPivotR, matDark, 0.09, 0.5, 0, -0.25, 0);
        sph(armPivotR, matHand, 0.1, 0, -0.52, 0);
        g.add(armPivotR);
        gunPivot = new T.Group(); gunPivot.position.set(0, 1.42, 0.6);
        rb(gunPivot, matGun, 0.09, 0.13, 0.5, 0.03, 0, 0, -0.05);
        var gbar = new T.Mesh(R.cylZ(0.025, 0.025, 0.35, 10), matGun); gbar.position.set(0, 0.02, -0.42); gunPivot.add(gbar);
        rb(gunPivot, matGun, 0.06, 0.16, 0.08, 0.02, 0, -0.12, 0.02);
        var gtip = new T.Mesh(new T.SphereGeometry(0.04, 8, 6), new window.MARIO.basic({ color: 0xff8844 })); gtip.position.set(0, 0.02, -0.6); gunPivot.add(gtip);
        g.add(gunPivot);
        legPivotL = new T.Group(); legPivotL.position.set(-0.16, 0.85, 0);
        cap(legPivotL, matDark, 0.11, 0.62, 0, -0.32, 0);
        rb(legPivotL, bootMat, 0.18, 0.14, 0.32, 0.05, 0, -0.66, 0.06);
        g.add(legPivotL);
        legPivotR = new T.Group(); legPivotR.position.set(0.16, 0.85, 0);
        cap(legPivotR, matDark, 0.11, 0.62, 0, -0.32, 0);
        rb(legPivotR, bootMat, 0.18, 0.14, 0.32, 0.05, 0, -0.66, 0.06);
        g.add(legPivotR);
      }
      }  // end humanoid (非机甲) body

      // ---- 运行时状态 ----
      const u = {
        kind: 'enemy',
        type: type,
        health: cfg.health || 100,
        maxHealth: cfg.health || 100,
        speed: cfg.speed || 1.5,
        damage: cfg.damage || 10,
        // v6.5: 防御倍率（机甲 BOSS defense=2 → 受到的伤害减半）
        defense: cfg.defense || 1,
        weapon: cfg.weapon || 'bullet',   // 'bullet' | 'fireball'(怪物) | 'rocket'(机甲)
        muzzleLocal: muzzleLocal,
        gunZ: gunZ,
        shootRange: cfg.shootRange || 20,
        shootCooldown: cfg.shootCooldown || 2,
        baseStopDist: cfg.stopDist || 5,
        score: cfg.score || 100,
        walkPhase: 0,
        hitFlash: 0,
        dead: false,
        deathTimer: 0,
        respawnReady: false,
        shootTimer: Math.random() * 1.5,
        projectiles: [],
        bodyMat: robotBodyMat || matBody,   // v11.13 机器人本体材质（闪红只改这一份）
        gunPivot: gunPivot,
        pivots: { armL: armPivotL, armR: armPivotR, legL: legPivotL, legR: legPivotR },
        _ctx: null
      };
      u.takeDamage = function (dmg) {
        if (u.dead) return;
        // v6.5 防御：机甲 BOSS 防御 ×2 → 伤害 ÷2
        u.health -= dmg / u.defense;
        u.hitFlash = 0.18;
        const c = u._ctx;
        if (c && c.sfx) c.sfx.playHit();
        if (u.health <= 0) {
          u.dead = true;
          u.deathTimer = 0;
          if (c && c.sfx) c.sfx.playDeath();
          if (c && c.onEnemyKilled) c.onEnemyKilled(g.position.clone(), u.type);
          if (c && c.onBossKilled && u.type === 'boss') c.onBossKilled(g.position.clone());
        }
      };
      g.userData = u;
      return g;
    },

    /** 玩家子弹命中；返回 true 表示爆头（v11.22 爆头 ×10，2% 概率秒杀） */
    onHit: function (inst, point, ctx) {
      const u = inst.userData;
      if (u.dead) return false;
      u._ctx = ctx;
      const s = inst.scale.x || 1;
      const headBottom = inst.position.y + 1.68 * s;
      const head = !!(point && point.y > headBottom);
      let dmg = (ctx && ctx.currentDamage) || 15;
      if (head) {
        dmg *= 10;
        if (Math.random() < 0.02 && u.type !== 'boss') dmg = 99999;   // v11.22 爆头2%概率秒杀
      }
      if (ctx && ctx.oneShotKill && u.type !== 'boss') dmg = 99999;
      u.takeDamage(dmg);
      if (ctx && ctx.sfx && head) ctx.sfx.playHeadshot();
      return head;
    },

    /** 主程序每帧调用 */
    update: function (inst, dt, ctx) {
      const T = global.THREE;
      const u = inst.userData;
      u._ctx = ctx;
      const player = ctx.player;
      if (!player) return;
      const pr = ctx.playerRadius || 0.5;
      const ph = ctx.playerHeight || 1.7;
      const s = inst.scale.x || 1;

      // ---- 投射物更新（子弹 / 火球） ----
      updateProjectiles(u, inst, dt, ctx, pr, ph);

      // ---- 死亡动画：倒下 + 下沉 ----
      if (u.dead) {
        u.deathTimer += dt;
        const k = Math.min(1, u.deathTimer / 1.3);
        inst.rotation.z = -k * Math.PI / 2;
        inst.position.y = -k * 0.5;
        if (k >= 1) u.respawnReady = true;
        return;
      }

      // ---- 受击闪红 ----
      if (u.hitFlash > 0) {
        u.hitFlash -= dt;
        u.bodyMat.emissive.setHex(0xff2222);
        u.bodyMat.emissiveIntensity = 1.2;
      } else {
        u.bodyMat.emissive.setHex(0x000000);
        u.bodyMat.emissiveIntensity = 0;
      }

      // ---- 朝向玩家 ----
      const dx = player.pos.x - inst.position.x;
      const dz = player.pos.z - inst.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 1e-4) inst.rotation.y = Math.atan2(dx, dz);

      // ---- 移动：太远靠近，太近后退（v11.15 避开水深>0.5m 水域，沿水岸滑动绕行）----
      const stopDist = u.baseStopDist * s;
      let moving = false;
      if (dist > stopDist) {
        moving = stepAvoidWater(inst, dx / dist, dz / dist, u.speed * dt);
      } else if (u.type !== 'boss' && dist < stopDist * 0.55 && dist > 1e-4) {
        moving = stepAvoidWater(inst, -dx / dist, -dz / dist, u.speed * dt * 0.5);
      }

      // v10.3 BOSS 撞开前方障碍物（前进时自动破坏挡路的墙/房/箱）
      if (u.type === 'boss' && moving && dist > stopDist && ctx.breakObstacleAhead) {
        u._ramT = (u._ramT || 0) + dt;
        if (u._ramT > 0.25) {
          u._ramT = 0;
          ctx.breakObstacleAhead(inst.position, dx / dist, dz / dist, 4.0 * s, 400);
        }
      }

      // ---- 动画 ----
      u.walkPhase += dt * (moving ? 8 : 2);
      const swing = Math.sin(u.walkPhase) * (moving ? 0.85 : 0.1);
      u.pivots.legL.rotation.x = -swing;
      u.pivots.legR.rotation.x = swing;

      if (isMonsterType(u)) {
        // 怪物：抬臂蓄力 + 手掌前推
        const k = moving ? 0.08 : 0.03;
        u.pivots.armL.rotation.x = -0.5 + Math.sin(u.walkPhase * 0.5) * k;
        u.pivots.armR.rotation.x = -0.5 - Math.sin(u.walkPhase * 0.5) * k;
      } else {
        // 人类/BOSS/机甲：持枪姿势
        const k2 = moving ? 0.05 : 0.015;
        u.pivots.armL.rotation.x = -1.15 + Math.sin(u.walkPhase * 0.5) * k2;
        u.pivots.armR.rotation.x = -1.15 - Math.sin(u.walkPhase * 0.5) * k2;
        if (u.gunKick > 0) {
          u.gunKick -= dt * 8;
          u.gunPivot.position.z = u.gunZ - Math.max(0, u.gunKick) * 0.12;
        } else {
          u.gunPivot.position.z = u.gunZ;
        }
      }

      // ---- 攻击（先检查视线：被墙/建筑/车辆等挡住则不开枪） ----
      // v11.20 玩家驾驶直升机时，所有敌人优先攻击（射程 ×1.5，冷却 ×0.6）
      var heliActive = player.heli && player.heli.active;
      var effectiveRange = heliActive ? u.shootRange * 1.5 : u.shootRange;
      var effectiveCd = heliActive ? u.shootCooldown * 0.6 : u.shootCooldown;
      u.shootTimer -= dt;
      if (u.shootTimer <= 0 && dist < effectiveRange && !player.dead && canSeePlayer(inst, ctx, player)) {
        u.shootTimer = effectiveCd;
        if (isMonsterType(u)) {
          fireFireball(u, inst, ctx, player);
        } else if (u.weapon === 'rocket') {
          // v6.5 机甲 BOSS：火箭炮（AoE 爆炸）
          fireRocket(u, inst, ctx, player);
        } else {
          fireBullet(u, inst, ctx, player, dist);
          if (u.type === 'boss') {
            // 旧版人形 BOSS：额外两发偏转子弹（三向）
            fireBullet(u, inst, ctx, player, dist, -0.24);
            fireBullet(u, inst, ctx, player, dist, 0.24);
          }
        }
      }

      function isMonsterType(uu) { return uu.type === 'monster'; }
    }
  };

  /** 视线检测：从敌人头部到玩家躯干，中间若被存活碰撞体（墙/建筑/车/箱）挡住则不可见 */
  function canSeePlayer(inst, ctx, player) {
    if (!ctx.scene || !ctx.findEntityById) return true;
    const T = global.THREE;
    const from = inst.position.clone();
    from.y += (inst.scale.x || 1) * 1.6;
    const to = new T.Vector3(player.pos.x, player.pos.y + 0.85, player.pos.z);
    const dir = to.clone().sub(from);
    const d = dir.length();
    if (d < 0.01) return true;
    dir.normalize();
    const ray = new T.Raycaster(from, dir, 0, d);
    const hits = ray.intersectObjects(ctx.scene.children, true);
    for (let i = 0; i < hits.length; i++) {
      const o = hits[i].object;
      if (o.userData && o.userData.noHit) continue;
      const id = o.userData && o.userData.entityId;
      if (!id) continue;
      const rec = ctx.findEntityById(id);
      if (rec && rec.alive && rec.cfg.collision && rec.cfg.model !== 'sky' && rec.cfg.model !== 'floor') {
        return false;
      }
    }
    return true;
  }

  // ---- 投射物更新 ----
  function updateProjectiles(u, inst, dt, ctx, pr, ph) {
    const T = global.THREE;
    for (let i = u.projectiles.length - 1; i >= 0; i--) {
      const b = u.projectiles[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      if (b.kind === 'fireball') {
        b.mesh.rotation.x += dt * 8;
        b.mesh.rotation.z += dt * 6;
      }

      const hdx = b.mesh.position.x - ctx.player.pos.x;
      const hdz = b.mesh.position.z - ctx.player.pos.z;
      const hd = Math.sqrt(hdx * hdx + hdz * hdz);
      const by = b.mesh.position.y;
      const hitR = (b.kind === 'fireball' ? 0.55 : b.kind === 'rocket' ? 0.75 : 0.22) + pr;

      // ---- 火箭弹（机甲 BOSS）：命中或到期 → 爆炸（范围伤害） ----
      if (b.kind === 'rocket') {
        const directHit = hd < hitR && by > -0.3 && by < ph;
        const expired = b.life <= 0 || hd > u.shootRange * 3;
        if (directHit || expired) {
          if (ctx.spawnSparks) ctx.spawnSparks(b.mesh.position.clone(), 0xff8844);
          // 爆炸范围：以弹着点为中心 3.4m 内对玩家造成全额伤害
          const d2p = Math.sqrt(
            (b.mesh.position.x - ctx.player.pos.x) * (b.mesh.position.x - ctx.player.pos.x) +
            (b.mesh.position.z - ctx.player.pos.z) * (b.mesh.position.z - ctx.player.pos.z)
          );
          if (d2p < 3.4) {
            if (ctx.hitPlayer) ctx.hitPlayer(b.damage);
          }
          if (ctx.explode) ctx.explode(b.mesh.position.clone(), 2.8, b.damage * 0.3, { noPlayer: true, quiet: true });
          ctx.scene.remove(b.mesh);
          u.projectiles.splice(i, 1);
          continue;
        }
      }

      if (hd < hitR && by > -0.3 && by < ph) {
        if (ctx.hitPlayer) ctx.hitPlayer(b.damage * 0.5);   // 敌人伤害已减半
        if (ctx.spawnSparks) ctx.spawnSparks(b.mesh.position.clone(), b.kind === 'fireball' ? 0xff7722 : 0xffaa55);
        ctx.scene.remove(b.mesh);
        u.projectiles.splice(i, 1);
        continue;
      }
      if (b.life <= 0 || hd > u.shootRange * 3) {
        ctx.scene.remove(b.mesh);
        u.projectiles.splice(i, 1);
      }
    }
  }

  // ---- 火箭炮（v6.5 机甲 BOSS）：体积大、速度快、爆炸范围伤害 ----
  function fireRocket(u, inst, ctx, player) {
    const T = global.THREE;
    const muzzle = (u.muzzleLocal || new T.Vector3(0, 1.42, 0.98)).clone();
    inst.localToWorld(muzzle);
    const aim = new T.Vector3(
      player.pos.x - muzzle.x + (Math.random() - 0.5) * 1.2,
      (player.pos.y + 0.9) - muzzle.y + (Math.random() - 0.5) * 0.6,
      player.pos.z - muzzle.z + (Math.random() - 0.5) * 1.2
    ).normalize();
    if (ctx.sfx) ctx.sfx.playEnemyShot();
    u.gunKick = 1;
    if (ctx.spawnTracer) ctx.spawnTracer(muzzle, muzzle.clone().addScaledVector(aim, 9), 0xff8844);

    const bmesh = new T.Mesh(
      new T.CylinderGeometry(0.09, 0.09, 0.8, 8),
      new window.MARIO.mat({ color: 0x3a3f45, emissive: 0xff6622, emissiveIntensity: 0.7 })
    );
    bmesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), aim.clone());
    bmesh.position.copy(muzzle);
    ctx.scene.add(bmesh);
    u.projectiles.push({ mesh: bmesh, vel: aim.multiplyScalar(19), life: 5, damage: u.damage, kind: 'rocket' });
  }

  // ---- 子弹（人类 / BOSS）：大散布 = 低精准度 ----
  function fireBullet(u, inst, ctx, player, dist, yawOffset) {
    const T = global.THREE;
    const muzzle = new T.Vector3(0, 1.42, 0.98);
    inst.localToWorld(muzzle);
    // 精准度降低：瞄向玩家躯干时加入 ±1.2 单位的随机散布
    const aim = new T.Vector3(
      player.pos.x - muzzle.x + (Math.random() - 0.5) * 2.4,
      (player.pos.y + 0.85) - muzzle.y + (Math.random() - 0.5) * 1.4,
      player.pos.z - muzzle.z + (Math.random() - 0.5) * 2.4
    ).normalize();
    if (yawOffset) {
      const cos = Math.cos(yawOffset), sin = Math.sin(yawOffset);
      const nx = aim.x * cos - aim.z * sin;
      const nz = aim.x * sin + aim.z * cos;
      aim.set(nx, aim.y, nz).normalize();
    }
    if (ctx.sfx) ctx.sfx.playEnemyShot();
    u.gunKick = 1;
    if (ctx.spawnTracer) ctx.spawnTracer(muzzle, muzzle.clone().addScaledVector(aim, dist), 0xff6633);

    const bmesh = new T.Mesh(
      new T.CylinderGeometry(0.03, 0.03, 0.5, 6),
      new window.MARIO.basic({ color: 0xffaa55 })
    );
    bmesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), aim.clone());
    bmesh.position.copy(muzzle);
    ctx.scene.add(bmesh);
    u.projectiles.push({ mesh: bmesh, vel: aim.multiplyScalar(26), life: 3, damage: u.damage, kind: 'bullet' });
  }

  // ---- 火球（怪物 / BOSS）：体积大、速度慢、伤害高 ----
  function fireFireball(u, inst, ctx, player) {
    const T = global.THREE;
    const s = inst.scale.x || 1;
    const muzzle = new T.Vector3(0, 1.95 * s, 0.42 * s);
    inst.localToWorld(muzzle);
    const aim = new T.Vector3(
      player.pos.x - muzzle.x + (Math.random() - 0.5) * 1.6,
      (player.pos.y + 0.9) - muzzle.y + (Math.random() - 0.5) * 1.0,
      player.pos.z - muzzle.z + (Math.random() - 0.5) * 1.6
    ).normalize();
    if (ctx.sfx) ctx.sfx.playEnemyShot();

    // 蓄力动作
    u.pivots.armL.rotation.x = -1.25;
    u.pivots.armR.rotation.x = -1.25;

    if (ctx.spawnTracer) ctx.spawnTracer(muzzle, muzzle.clone().addScaledVector(aim, 6), 0xff5522);

    const R = 0.34 * s;
    const bmesh = new T.Mesh(
      new T.SphereGeometry(R, 10, 10),
      new window.MARIO.basic({ color: 0xff6a1a, transparent: true, opacity: 0.95 })
    );
    const glow = new T.Mesh(
      new T.SphereGeometry(R * 1.55, 10, 10),
      new window.MARIO.basic({ color: 0xff9944, transparent: true, opacity: 0.3 })
    );
    bmesh.add(glow);
    bmesh.position.copy(muzzle);
    ctx.scene.add(bmesh);
    u.projectiles.push({ mesh: bmesh, vel: aim.multiplyScalar(15), life: 4, damage: u.damage, kind: 'fireball' });
  }
})(window);
