/**
 * gun.js — 第一人称枪械模型（v11 圆润重做：去除方块感 + 修复枪管/枪身穿模）
 * 注册: window.MODELS.gun
 *
 * v11 改动：
 *   1. 全部主体由 BoxGeometry 改为真正的圆角长方体（ROUND.roundedBox，12 棱倒角），外观圆润。
 *   2. 枪管(圆柱)与机匣(圆角方块)采用「相互嵌入」方式衔接，消除共面 z-fighting / 穿模。
 *   3. 材质由 MeshLambertMaterial 升级为 MeshStandardMaterial(metalness 0)，圆润表面更有体积感。
 *   4. 狙击 AWP 瞄准镜：蓝色镜片只在镜尾(目镜)显示，镜首(物镜)的蓝色玻璃移除（仅保留深色镜筒）。
 *   5. 持枪视角/后坐/抛壳/换弹动画契约(userData)完全不变。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  var R = global.ROUND;

  // 持枪视角：整枪局部坐标 枪尾z≈0 → 枪口z≈-0.6；basePos 保证全部件在相机前方完整可见
  var STYLES = {
    pistol: { len: 0.30, barrelLen: 0.30, pos: [0.17, -0.105, -0.26], scope: false, recoilKick: 1.0, casing: true },
    rifle: { len: 0.53, barrelLen: 0.53, pos: [0.19, -0.12, -0.27], scope: false, recoilKick: 0.75, casing: true },
    shotgun: { len: 0.52, barrelLen: 0.52, pos: [0.20, -0.12, -0.27], scope: false, recoilKick: 1.5, casing: true, pump: true },
    flamethrower: { len: 0.53, barrelLen: 0.53, pos: [0.20, -0.12, -0.27], scope: false, recoilKick: 0.8, casing: false },
    sniper: { len: 0.58, barrelLen: 0.58, pos: [0.19, -0.12, -0.28], scope: true, recoilKick: 2.2, casing: true },
    rocket: { len: 0.52, barrelLen: 0.52, pos: [0.20, -0.13, -0.28], scope: true, recoilKick: 3.4, casing: true, tubeReload: true }
  };

  // 圆润金属/聚合物材质（保留 v10.8 R6 真实军色，改用 Standard 让圆角更有体积感）
  function mats(global) {
    var T = global.THREE;
    function sm(p) {
      p = p || {};
      var c = {};
      for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) c[k] = p[k];
      c.metalness = (c.metalness !== undefined) ? c.metalness : 0.0;
      c.roughness = (c.roughness !== undefined) ? c.roughness : 0.55;
      return new T.MeshStandardMaterial(c);
    }
    return {
      steel: sm({ color: 0x3d4249 }),
      polymer: sm({ color: 0x1c1e22 }),
      dark: sm({ color: 0x0e1013 }),
      ss: sm({ color: 0x6e7883 }),
      gunblue: sm({ color: 0x2b2f34 }),
      green: sm({ color: 0x4a5236 }),
      wood: sm({ color: 0x5a3a1e }),
      brass: sm({ color: 0x8a6a20 }),
      orange: sm({ color: 0x9a4408 }),
      lens: new T.MeshBasicMaterial({ color: 0x2a5a7a }),     // 瞄具镜片（蓝）
      redDot: new T.MeshBasicMaterial({ color: 0xcc2211 })    // 准星红点
    };
  }

  // —— 通用建模小工具 ——（圆角方块 / 圆角圆柱(沿Z) / 圆角胶囊(沿Z)）
  function box(g, M, w, h, d, r, x, y, z, rx, ry, rz) {
    var m = new global.THREE.Mesh(R.roundedBox(w, h, d, r), M);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
    g.add(m);
    return m;
  }
  function tube(g, M, rt, rb, len, x, y, z, seg) {
    var m = new global.THREE.Mesh(R.cylZ(rt, rb, len, seg || 14), M);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  function capMesh(g, M, r, len, x, y, z, seg) {
    var m = new global.THREE.Mesh(R.roundedCyl(r, r, len, seg || 14), M);
    m.rotation.x = Math.PI / 2;          // 胶囊 Y 轴 -> Z 轴（沿枪管前向）
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  // 皮卡汀尼导轨齿纹（沿 -Z 排布，圆角小齿）
  function addRail(g, M, x, y, zStart, len, count, w) {
    var step = len / count;
    for (var i = 0; i < count; i++) {
      var tooth = new global.THREE.Mesh(R.roundedBox(w, 0.008, step * 0.55, 0.003), M);
      tooth.position.set(x, y, zStart - i * step - step * 0.5);
      g.add(tooth);
    }
  }

  // 枪口喷火：严格挂在枪口锚点，锥体沿 -Z（枪管轴线向前）
  function buildMuzzleFlash(T, muzzlePos) {
    var flameGroup = new T.Group();
    flameGroup.position.copy(muzzlePos);
    var layers = [];
    var colors = [0xfff2a0, 0xffaa33, 0xff5a22];
    for (var i = 0; i < 3; i++) {
      var cone = new T.Mesh(
        new T.ConeGeometry(0.024 + i * 0.014, 0.20 - i * 0.045, 10),
        new global.window.MARIO.basic({ color: colors[i], transparent: true, opacity: 0, depthWrite: false })
      );
      cone.rotation.x = -Math.PI / 2;
      cone.position.z = -0.04 - i * 0.03;
      flameGroup.add(cone);
      layers.push(cone);
    }
    var ball = new T.Mesh(
      new T.SphereGeometry(0.03, 10, 8),
      new global.window.MARIO.basic({ color: 0xffe066, transparent: true, opacity: 0, depthWrite: false })
    );
    ball.position.z = -0.015;
    flameGroup.add(ball);
    layers.push(ball);
    flameGroup.visible = false;
    return { group: flameGroup, layers: layers };
  }

  // ============ 1. 沙漠之鹰 .50AE（圆润滑套 + 外露枪管 + 环形击锤 + 弧形弹匣） ============
  function buildDesertEagle(g, M, T, st) {
    var anim = { mag: null, pump: null, bolt: null, tube: null };
    var r = 0.011;
    box(g, M.ss, 0.05, 0.054, 0.20, r, 0, 0.012, -0.14);                 // 滑套
    box(g, M.ss, 0.032, 0.012, 0.20, 0.004, 0, 0.044, -0.14);            // 滑套顶脊
    for (var si = 0; si < 4; si++) {                                    // 前后防滑纹
      box(g, M.dark, 0.054, 0.058, 0.006, 0.002, 0, 0.012, -0.235 + si * 0.012);
      box(g, M.dark, 0.054, 0.058, 0.006, 0.002, 0, 0.012, -0.085 + si * 0.012);
    }
    var barrel = tube(g, M.gunblue, 0.016, 0.016, 0.11, 0, 0.004, -0.27, 12); // 外露枪管
    barrel.userData.part = 'barrel';
    box(g, M.polymer, 0.046, 0.03, 0.18, 0.01, 0, -0.028, -0.13);       // 套筒座
    var guard = new T.Mesh(new T.TorusGeometry(0.022, 0.007, 10, 18), M.polymer); // 扳机护圈(圆)
    guard.position.set(0, -0.05, -0.105);
    g.add(guard);
    box(g, M.ss, 0.008, 0.026, 0.01, 0.003, 0, -0.058, -0.105, -0.2, 0, 0); // 扳机
    box(g, M.polymer, 0.044, 0.11, 0.054, 0.012, 0, -0.08, -0.04, 0.16, 0, 0); // 握把
    for (var gi = 0; gi < 3; gi++) box(g, M.dark, 0.046, 0.008, 0.056, 0.003, 0, -0.05 - gi * 0.02, -0.043, 0.16, 0, 0); // 防滑纹
    var hammer = new T.Mesh(new T.TorusGeometry(0.012, 0.004, 8, 14), M.gunblue); // 环形击锤
    hammer.position.set(0, 0.006, -0.01);
    g.add(hammer);
    box(g, M.redDot, 0.008, 0.014, 0.01, 0.003, 0, 0.052, -0.235);      // 前准星
    box(g, M.ss, 0.01, 0.014, 0.01, 0.003, -0.015, 0.052, -0.06);       // 后准星
    box(g, M.ss, 0.01, 0.014, 0.01, 0.003, 0.015, 0.052, -0.06);
    var mag = box(g, M.ss, 0.038, 0.062, 0.046, 0.01, 0, -0.13, -0.05, 0.16, 0, 0); // 弹匣
    box(g, M.dark, 0.042, 0.012, 0.05, 0.004, 0, -0.16, -0.055, 0.16, 0, 0);
    anim.mag = mag;
    g.userData.muzzleZ = -0.325;
    g.userData.ejectPos = new T.Vector3(0.05, 0.005, -0.12);
    return anim;
  }

  // ============ 2. M4A1 卡宾枪（圆润机匣 + 全长导轨 + 伸缩枪托 + 弧型弹匣） ============
  function buildM4A1(g, M, T, st) {
    var anim = { mag: null, pump: null, bolt: null, tube: null };
    var r = 0.011;
    box(g, M.steel, 0.048, 0.046, 0.18, r, 0, 0.01, -0.17);             // 上机匣
    box(g, M.dark, 0.038, 0.014, 0.19, 0.005, 0, 0.036, -0.17);        // 顶导轨座
    addRail(g, M.dark, 0, 0.044, -0.09, 0.17, 9, 0.038);               // 顶齿纹
    box(g, M.steel, 0.022, 0.01, 0.034, 0.004, 0, 0.022, -0.095);      // 拉机柄
    box(g, M.dark, 0.022, 0.016, 0.044, 0.004, 0.024, 0.006, -0.14);   // 抛壳窗
    box(g, M.steel, 0.046, 0.042, 0.14, r, 0, -0.03, -0.155);          // 下机匣
    box(g, M.steel, 0.042, 0.03, 0.05, 0.01, 0, -0.058, -0.135);       // 弹匣井
    tube(g, M.dark, 0.017, 0.017, 0.11, 0, 0, -0.04, 12);              // 缓冲管
    box(g, M.polymer, 0.042, 0.052, 0.12, r, 0, -0.008, 0.02);         // 伸缩枪托
    box(g, M.dark, 0.044, 0.02, 0.05, 0.006, 0, 0.01, 0.02);           // 托孔
    box(g, M.dark, 0.046, 0.072, 0.016, 0.008, 0, -0.012, 0.074);      // 托底板
    box(g, M.polymer, 0.036, 0.082, 0.044, 0.01, 0, -0.078, -0.085, 0.22, 0, 0); // 握把
    var tg = new T.Mesh(new T.TorusGeometry(0.018, 0.006, 8, 14), M.steel); // 扳机护圈
    tg.position.set(0, -0.052, -0.115); g.add(tg);
    box(g, M.steel, 0.008, 0.022, 0.008, 0.003, 0, -0.06, -0.118, -0.25, 0, 0); // 扳机
    var mag = new T.Group();                                            // STANAG 弧型弹匣
    box(mag, M.polymer, 0.034, 0.05, 0.05, 0.01, 0, -0.085, -0.135, 0.08, 0, 0);
    box(mag, M.polymer, 0.034, 0.05, 0.05, 0.01, 0, -0.128, -0.131, 0.2, 0, 0);
    box(mag, M.polymer, 0.034, 0.046, 0.05, 0.01, 0, -0.168, -0.122, 0.32, 0, 0);
    g.add(mag); anim.mag = mag;
    box(g, M.polymer, 0.046, 0.05, 0.16, r, 0, -0.002, -0.32);         // 四方护木
    addRail(g, M.dark, 0, 0.028, -0.25, 0.14, 8, 0.044);
    addRail(g, M.dark, 0, -0.03, -0.25, 0.14, 8, 0.044);
    addRail(g, M.dark, -0.025, -0.002, -0.25, 0.14, 8, 0.01);
    addRail(g, M.dark, 0.025, -0.002, -0.25, 0.14, 8, 0.01);
    var barrel = tube(g, M.gunblue, 0.013, 0.013, 0.20, 0, 0.006, -0.45, 12); // 枪管
    barrel.userData.part = 'barrel';
    tube(g, M.steel, 0.016, 0.016, 0.04, 0, 0.006, -0.555, 10);        // 消焰器
    for (var fi = 0; fi < 4; fi++) box(g, M.dark, 0.005, 0.02, 0.03, 0.002, 0, 0.006, -0.555, 0, fi * Math.PI / 4, 0);
    box(g, M.steel, 0.01, 0.014, 0.014, 0.003, 0, 0.03, -0.395);       // 三角前准星座
    var fs = new T.Mesh(new T.ConeGeometry(0.007, 0.02, 8), M.steel); fs.position.set(0, 0.046, -0.395); fs.rotation.x = Math.PI; g.add(fs);
    box(g, M.dark, 0.03, 0.016, 0.016, 0.004, 0, 0.048, -0.10);        // 折叠照门
    g.userData.muzzleZ = -0.575;
    g.userData.ejectPos = new T.Vector3(0.05, 0.01, -0.13);
    return anim;
  }

  // ============ 3. M870 霰弹枪（钢机匣 + 木质圆润枪托 + 管状弹仓 + 肋纹泵把） ============
  function buildM870(g, M, T, st) {
    var anim = { mag: null, pump: null, bolt: null, tube: null };
    box(g, M.steel, 0.048, 0.054, 0.15, 0.012, 0, 0, -0.14);           // 机匣
    box(g, M.dark, 0.05, 0.02, 0.046, 0.004, 0, 0.008, -0.12);         // 抛壳口
    addRail(g, M.dark, 0, 0.032, -0.085, 0.1, 5, 0.03);
    box(g, M.wood, 0.042, 0.058, 0.16, 0.014, 0, -0.018, 0.005, -0.07, 0, 0); // 木托
    box(g, M.wood, 0.04, 0.064, 0.05, 0.014, 0, -0.06, -0.055, 0.3, 0, 0);     // 握把
    box(g, M.dark, 0.044, 0.078, 0.014, 0.008, 0, -0.026, 0.082);      // 托底板
    var sling = new T.Mesh(new T.TorusGeometry(0.013, 0.003, 6, 10), M.steel);
    sling.position.set(0, -0.05, 0.06); sling.rotation.y = Math.PI / 2; g.add(sling);
    var tg = new T.Mesh(new T.TorusGeometry(0.016, 0.006, 8, 12), M.steel);
    tg.position.set(0, -0.042, -0.09); g.add(tg);
    box(g, M.steel, 0.008, 0.02, 0.008, 0.003, 0, -0.05, -0.093, -0.25, 0, 0);
    box(g, M.steel, 0.012, 0.018, 0.014, 0.004, 0, 0.02, -0.065, 0.5, 0, 0); // 击锤
    var barrel = tube(g, M.gunblue, 0.014, 0.014, 0.34, 0, 0.016, -0.37, 12); // 枪管
    barrel.userData.part = 'barrel';
    var bead = new T.Mesh(new T.SphereGeometry(0.006, 8, 6), M.redDot); bead.position.set(0, 0.034, -0.54); g.add(bead);
    tube(g, M.steel, 0.012, 0.012, 0.30, 0, -0.012, -0.35, 10);        // 管状弹仓
    box(g, M.steel, 0.014, 0.014, 0.02, 0.004, 0, -0.012, -0.505);     // 弹仓帽
    var pump = box(g, M.wood, 0.044, 0.046, 0.11, 0.012, 0, -0.002, -0.27); // 泵把
    for (var pi = 0; pi < 5; pi++) box(g, M.dark, 0.046, 0.007, 0.01, 0.003, 0, -0.002, -0.235 - pi * 0.018);
    anim.pump = pump;
    g.userData.muzzleZ = -0.54;
    g.userData.ejectPos = new T.Vector3(0.05, 0.01, -0.12);
    return anim;
  }

  // ============ 4. M2 喷火器（圆润喷枪 + 喇叭喷口 + 侧挂双燃料罐 + 软管） ============
  function buildFlamethrower(g, M, T, st) {
    var anim = { mag: null, pump: null, bolt: null, tube: null };
    box(g, M.steel, 0.05, 0.058, 0.16, 0.014, 0, 0, -0.12);            // 枪身
    var barrel = tube(g, M.gunblue, 0.014, 0.014, 0.32, 0, 0.005, -0.34, 12); // 喷枪管
    barrel.userData.part = 'barrel';
    var noz = new T.Mesh(R.cylZ(0.044, 0.018, 0.07, 16), M.steel); noz.position.set(0, 0.005, -0.505); g.add(noz); // 喇叭喷口
    var nozIn = new T.Mesh(R.cylZ(0.04, 0.04, 0.012, 16), M.dark); nozIn.position.set(0, 0.005, -0.538); g.add(nozIn);
    function tank(x) {                                                // 侧挂燃料罐(胶囊=圆润)
      var grp = new T.Group();
      var t = new T.Mesh(R.roundedCyl(0.032, 0.032, 0.12, 12), M.orange); t.rotation.x = Math.PI / 2; grp.add(t);
      var b1 = new T.Mesh(new T.TorusGeometry(0.033, 0.005, 6, 14), M.steel); b1.position.z = 0.04; grp.add(b1);
      var b2 = b1.clone(); b2.position.z = -0.04; grp.add(b2);
      var v = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.025, 8), M.brass); v.position.set(0, 0.04, -0.02); grp.add(v);
      grp.position.set(x, -0.015, -0.06); g.add(grp);
    }
    tank(-0.05); tank(0.05);
    var h1 = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.06, 6), M.dark); h1.rotation.z = Math.PI / 2; h1.position.set(-0.024, 0.01, -0.08); g.add(h1);
    var h2 = new T.Mesh(new T.CylinderGeometry(0.007, 0.007, 0.05, 6), M.dark); h2.rotation.x = Math.PI / 2.5; h2.position.set(-0.005, 0.02, -0.09); g.add(h2);
    box(g, M.polymer, 0.036, 0.078, 0.044, 0.01, 0, -0.062, -0.075, 0.2, 0, 0); // 握把
    var tg = new T.Mesh(new T.TorusGeometry(0.016, 0.006, 8, 12), M.steel); tg.position.set(0, -0.038, -0.10); g.add(tg);
    box(g, M.polymer, 0.032, 0.062, 0.036, 0.01, 0, -0.05, -0.22);     // 前握把
    box(g, M.dark, 0.026, 0.022, 0.042, 0.006, 0, 0.036, -0.16);       // 点火器
    var el = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.03, 6), M.brass); el.rotation.x = Math.PI / 2; el.position.set(0, 0.02, -0.48); g.add(el);
    g.userData.muzzleZ = -0.54;
    g.userData.ejectPos = new T.Vector3(0.05, 0.01, -0.12);
    return anim;
  }

  // ============ 5. AWP 狙击（军绿圆润枪托 + 重枪管 + 大瞄准镜｜蓝镜片仅镜尾） ============
  function buildAWP(g, M, T, st) {
    var anim = { mag: null, pump: null, bolt: null, tube: null };
    box(g, M.green, 0.044, 0.052, 0.25, 0.014, 0, -0.012, -0.02);     // 拇指孔枪托
    var th = new T.Mesh(new T.TorusGeometry(0.024, 0.009, 8, 16), M.dark); th.position.set(0, -0.012, -0.05); th.rotation.y = Math.PI / 2; th.scale.set(1, 0.7, 1); g.add(th);
    box(g, M.green, 0.038, 0.018, 0.10, 0.006, 0, 0.022, 0.0);        // 贴腮板
    box(g, M.dark, 0.032, 0.032, 0.02, 0.006, 0, -0.005, 0.105);      // 可调托底
    box(g, M.dark, 0.046, 0.074, 0.016, 0.008, 0, -0.012, 0.12);      // 托底板
    box(g, M.green, 0.042, 0.042, 0.11, 0.012, 0, -0.012, -0.24);     // 前护木
    box(g, M.steel, 0.046, 0.05, 0.14, 0.012, 0, 0.012, -0.19);       // 机匣
    box(g, M.dark, 0.02, 0.018, 0.05, 0.004, 0.023, 0.016, -0.17);    // 抛壳窗
    addRail(g, M.dark, 0, 0.042, -0.14, 0.11, 5, 0.034);
    var barrel = tube(g, M.gunblue, 0.016, 0.018, 0.32, 0, 0.012, -0.41, 12); // 重枪管
    barrel.userData.part = 'barrel';
    tube(g, M.steel, 0.022, 0.022, 0.03, 0, 0.012, -0.575, 10);        // 双室制退器
    tube(g, M.steel, 0.022, 0.022, 0.03, 0, 0.012, -0.605, 10);
    box(g, M.dark, 0.046, 0.008, 0.06, 0.003, 0, 0.012, -0.59);
    // —— 瞄准镜：深色镜筒 + 物镜钟(深色) + 目镜(深色) + 蓝镜片仅镜尾(目镜) ——
    tube(g, M.dark, 0.022, 0.022, 0.17, 0, 0.078, -0.18, 16);          // 镜筒
    var objBell = new T.Mesh(R.cylZ(0.028, 0.022, 0.045, 16), M.dark); objBell.position.set(0, 0.078, -0.285); g.add(objBell); // 物镜钟(无蓝玻璃)
    var eyeBell = new T.Mesh(R.cylZ(0.026, 0.022, 0.035, 16), M.dark); eyeBell.position.set(0, 0.078, -0.075); g.add(eyeBell); // 目镜座
    var eyeGlass = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.006, 16), M.lens); eyeGlass.rotation.x = Math.PI / 2; eyeGlass.position.set(0, 0.078, -0.058); g.add(eyeGlass); // 蓝镜片(仅镜尾)
    tube(g, M.steel, 0.01, 0.01, 0.016, 0, 0.104, -0.18, 10);          // 顶调节钮
    var sideT = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.016, 10), M.steel); sideT.rotation.z = Math.PI / 2; sideT.position.set(0.026, 0.078, -0.18); g.add(sideT);
    box(g, M.steel, 0.032, 0.03, 0.014, 0.006, 0, 0.058, -0.24);      // 镜架
    box(g, M.steel, 0.032, 0.03, 0.014, 0.006, 0, 0.058, -0.12);
    var legL = new T.Mesh(new T.CylinderGeometry(0.004, 0.004, 0.12, 6), M.steel); legL.position.set(-0.03, -0.025, -0.30); legL.rotation.set(0.5, 0, 0.35); g.add(legL); // 两脚架
    var legR = legL.clone(); legR.position.x = 0.03; legR.rotation.z = -0.35; g.add(legR);
    var mag = box(g, M.dark, 0.034, 0.056, 0.05, 0.01, 0, -0.052, -0.16); anim.mag = mag;
    var bolt = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.05, 8), M.ss); bolt.position.set(0.03, 0.0, -0.13); bolt.rotation.z = 0.9; g.add(bolt); // 下弯拉柄
    var bk = new T.Mesh(new T.SphereGeometry(0.01, 8, 6), M.ss); bk.position.set(0.05, -0.012, -0.13); g.add(bk); anim.bolt = bolt;
    g.userData.muzzleZ = -0.62;
    g.userData.ejectPos = new T.Vector3(0.05, 0.02, -0.16);
    return anim;
  }

  // ============ 6. AT4 火箭筒（军绿玻璃钢圆润筒身 + 前后喇叭口 + 肩托框） ============
  function buildAT4(g, M, T, st) {
    var anim = { mag: null, pump: null, bolt: null, tube: null };
    tube(g, M.green, 0.033, 0.033, 0.40, 0, 0, -0.24, 16);            // 主筒身
    for (var ri = 0; ri < 4; ri++) {                                  // 加强环
      var ring = new T.Mesh(new T.TorusGeometry(0.034, 0.005, 6, 16), M.steel);
      ring.position.z = -0.12 - ri * 0.09; g.add(ring);
    }
    var fF = new T.Mesh(R.cylZ(0.05, 0.033, 0.07, 16), M.green); fF.position.set(0, 0, -0.475); g.add(fF); // 前喇叭口
    var fB = new T.Mesh(R.cylZ(0.033, 0.055, 0.09, 16), M.green); fB.position.set(0, 0, 0.005); g.add(fB); // 后喇叭口
    var warhead = new T.Group();                                      // 火箭弹(换弹动画)
    var wh = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.10, 12), M.orange); wh.rotation.x = Math.PI / 2; wh.position.z = -0.05; warhead.add(wh);
    var tip = new T.Mesh(new T.ConeGeometry(0.024, 0.06, 12), M.ss); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.13; tip.userData.part = 'barrel'; warhead.add(tip);
    for (var wi = 0; wi < 4; wi++) {
      var fin = new T.Mesh(new T.BoxGeometry(0.004, 0.035, 0.06), M.steel);
      fin.position.z = 0.03; fin.rotation.z = wi * Math.PI / 2;
      fin.position.x = Math.sin(wi * Math.PI / 2) * 0.02; fin.position.y = Math.cos(wi * Math.PI / 2) * 0.02;
      warhead.add(fin);
    }
    warhead.position.set(0, 0, -0.30); g.add(warhead); anim.tube = warhead;
    box(g, M.dark, 0.052, 0.062, 0.03, 0.01, 0, -0.01, 0.05);         // 肩托框
    box(g, M.dark, 0.056, 0.078, 0.014, 0.008, 0, -0.015, 0.068);     // 肩托垫
    box(g, M.polymer, 0.032, 0.072, 0.036, 0.01, 0, -0.062, -0.14, 0.15, 0, 0); // 前握把
    var tg = new T.Mesh(new T.TorusGeometry(0.016, 0.006, 8, 12), M.steel); tg.position.set(0, -0.038, -0.165); g.add(tg);
    box(g, M.steel, 0.008, 0.018, 0.008, 0.003, 0, -0.046, -0.163, -0.25, 0, 0);
    box(g, M.steel, 0.02, 0.032, 0.008, 0.003, 0, 0.04, -0.40);       // 前瞄
    box(g, M.steel, 0.024, 0.028, 0.008, 0.003, 0, 0.038, -0.06);     // 后瞄
    var loop = new T.Mesh(new T.TorusGeometry(0.01, 0.003, 6, 10), M.steel); loop.position.set(-0.035, 0.01, -0.2); loop.rotation.y = Math.PI / 2; g.add(loop);
    g.userData.muzzleZ = -0.51;
    g.userData.ejectPos = new T.Vector3(0.05, 0.01, -0.14);
    return anim;
  }

  global.MODELS.gun = {
    name: 'gun',

    create: function (config) {
      var T = global.THREE;
      var type = (config && config.type) || 'pistol';
      var st = STYLES[type] || STYLES.pistol;
      var M = mats(global);
      var g = new T.Group();

      var anim;
      if (type === 'rifle') anim = buildM4A1(g, M, T, st);
      else if (type === 'shotgun') anim = buildM870(g, M, T, st);
      else if (type === 'sniper') anim = buildAWP(g, M, T, st);
      else if (type === 'flamethrower') anim = buildFlamethrower(g, M, T, st);
      else if (type === 'rocket') anim = buildAT4(g, M, T, st);
      else anim = buildDesertEagle(g, M, T, st);

      // 枪口锚点（曳光弹起点 + 火焰中心）——严格对齐枪管轴线前端
      var mz = (g.userData.muzzleZ !== undefined) ? g.userData.muzzleZ : -st.barrelLen - 0.06;
      var muzzle = new T.Object3D();
      muzzle.position.set(0, 0.005, mz);
      g.add(muzzle);

      var flame = buildMuzzleFlash(T, muzzle.position);
      g.add(flame.group);

      var eject = new T.Object3D();
      if (g.userData.ejectPos) eject.position.copy(g.userData.ejectPos);
      else eject.position.set(0.045, 0.01, -0.15);
      g.add(eject);

      if (anim.mag) { anim.mag.userData = anim.mag.userData || {}; anim.mag.userData.basePos = anim.mag.position.clone(); }
      if (anim.pump) { anim.pump.userData = anim.pump.userData || {}; anim.pump.userData.basePos = anim.pump.position.clone(); }
      if (anim.bolt) { anim.bolt.userData = anim.bolt.userData || {}; anim.bolt.userData.basePos = anim.bolt.position.clone(); }
      if (anim.tube) { anim.tube.userData = anim.tube.userData || {}; anim.tube.userData.basePos = anim.tube.position.clone(); }

      var u = {
        type: type,
        muzzle: muzzle,
        eject: eject,
        flash: flame.group,
        flameLayers: flame.layers,
        anim: anim,
        recoil: 0,
        phase: 0,
        basePos: new T.Vector3(st.pos[0], st.pos[1], st.pos[2]),
        kick: st.recoilKick,
        reloading: false,
        reloadT: 0,
        reloadDur: 1
      };
      u.beginReload = function (dur) {
        u.reloading = true;
        u.reloadT = 0;
        u.reloadDur = dur || 1;
      };
      g.userData = u;
      return g;
    },

    update: function (inst, dt, ctx) {
      var u = inst.userData;
      u.phase += dt;

      var p = (ctx && ctx.player) || null;
      var moving = p && p.vel && (Math.abs(p.vel.x) + Math.abs(p.vel.z)) > 0.1;

      // 后坐：z 位移限制 ≤0.05（不穿 near 平面），枪口上跳用 rotation 表现
      if (u.recoil > 0) {
        u.recoil -= dt * (u.kick * 4.2);
        var r = Math.max(0, u.recoil);
        var k = r * r;
        var kickZ = Math.min(0.05, 0.03 + u.kick * 0.008);
        inst.position.z = u.basePos.z + Math.sin(r * Math.PI) * kickZ;
        inst.position.y = u.basePos.y + k * 0.03;
        inst.position.x = u.basePos.x + (Math.random() - 0.5) * 0.003;
        inst.rotation.x = k * 0.09 * Math.min(2.2, u.kick);
        inst.rotation.z = (Math.random() - 0.5) * 0.012;
        u.flash.visible = true;
        for (var i = 0; i < u.flameLayers.length; i++) {
          var layer = u.flameLayers[i];
          layer.material.opacity = Math.min(1, u.recoil * (2.2 - i * 0.5)) * 0.9;
          var fs = 1 + k * 0.8 + Math.random() * 0.25;
          layer.scale.set(fs, fs, fs);
        }
      } else {
        inst.position.z = u.basePos.z;
        inst.position.y = u.basePos.y;
        inst.rotation.x = 0;
        inst.rotation.z = 0;
        u.flash.visible = false;
      }

      // 换弹动画
      if (u.reloading) {
        u.reloadT += dt;
        var pr = Math.min(1, u.reloadT / u.reloadDur);
        if (pr >= 1) u.reloading = false;
        inst.rotation.x += 0.06;

        if (u.anim.mag && u.anim.mag.userData) {
          var bp = u.anim.mag.userData.basePos;
          var mp;
          if (pr < 0.28) mp = -0.14 * (pr / 0.28);
          else if (pr < 0.55) mp = -0.14;
          else if (pr < 0.8) mp = -0.14 + 0.14 * ((pr - 0.55) / 0.25);
          else mp = 0;
          u.anim.mag.position.y = bp.y + mp;
        }
        if (u.anim.pump && u.anim.pump.userData) {
          var bp2 = u.anim.pump.userData.basePos;
          var pp = 0;
          if (pr >= 0.15 && pr < 0.45) pp = 0.1 * Math.sin(((pr - 0.15) / 0.3) * Math.PI);
          else if (pr >= 0.45 && pr < 0.7) pp = -0.08 * Math.sin(((pr - 0.45) / 0.25) * Math.PI);
          u.anim.pump.position.z = bp2.z + pp;
        }
        if (u.anim.bolt && u.anim.bolt.userData) {
          var bp3 = u.anim.bolt.userData.basePos;
          var b3 = (pr >= 0.55 && pr < 0.8) ? 0.07 * Math.sin(((pr - 0.55) / 0.25) * Math.PI) : 0;
          u.anim.bolt.position.z = bp3.z + b3;
        }
        if (u.anim.tube && u.anim.tube.userData) {
          var bp4 = u.anim.tube.userData.basePos;
          var tp;
          if (pr < 0.35) tp = 0.1 * (pr / 0.35);
          else if (pr < 0.65) tp = 0.1;
          else tp = 0.1 * (1 - (pr - 0.65) / 0.35);
          u.anim.tube.position.z = bp4.z + tp;
        }
      }

      // 移动晃动 + 呼吸
      var bob = moving ? 1 : 0.25;
      inst.position.x = u.basePos.x + Math.sin(u.phase * 8) * 0.004 * bob;
      if (u.recoil <= 0) {
        inst.position.y = u.basePos.y + Math.cos(u.phase * 10) * 0.004 * bob;
      }
    }
  };
})(window);
