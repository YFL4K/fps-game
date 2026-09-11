/**
 * gun.js — 第一人称枪械模型（程序化，挂在相机下，多武器类型）
 * 注册: window.MODELS.gun
 *
 * v9.2 更新：
 *   1. 取消双手模型——屏幕上不再显示玩家手部（纯净枪械视角）
 *   2. 取消枪管准星发光点（sightGlow 红绿色标）
 *   3. 枪械外观细节提升
 *
 * v9.1 CS 风格全面重做：
 *   1. 材质体系重建：枪械钢（高金属度暗灰）、聚合物（哑黑/FDE沙色）、
 *      木质（深褐带纹理感）、铬钢枪管（亮金属）、黄铜弹匣、战术橙。
 *   2. 六把枪全部参考 CS/CS:GO 真实枪械比例重做：
 *      沙漠之鹰 .50AE / AK-47 / Nova 霰弹 / 喷火器 / AWP 狙击 / 火箭筒。
 *   3. 新增细节：导轨、消焰器、气体调节器、弹匣卡笋、拉机柄、
 *      前握把、战术灯、瞄准镜遮光罩、两脚架、背带扣等。
 *
 * 主程序用法不变：
 * - camera.add(gunInst)；gunInst.position 由 userData.basePos 决定
 * - 开枪时设置 gunInst.userData.recoil = 1（后坐力 + 枪口闪光）
 * - gunInst.userData.muzzle 是枪口 Object3D（曳光弹起点）
 * - gunInst.userData.eject 是抛壳窗 Object3D（抛壳起点）
 * - 换弹时主程序调 gunInst.userData.beginReload(duration)
 * - update 由主程序通用实体循环调用
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var STYLES = {
    pistol: {
      len: 0.40, barrelLen: 0.14, pos: [0.22, -0.16, -0.40],
      scope: false, recoilKick: 1.0, casing: true
    },
    rifle: {
      len: 0.54, barrelLen: 0.30, pos: [0.24, -0.18, -0.42],
      scope: false, recoilKick: 0.75, casing: true
    },
    shotgun: {
      len: 0.58, barrelLen: 0.36, pos: [0.25, -0.18, -0.44],
      scope: false, recoilKick: 1.5, casing: true, pump: true
    },
    flamethrower: {
      len: 0.52, barrelLen: 0.42, pos: [0.25, -0.17, -0.42],
      scope: false, recoilKick: 0.8, casing: false
    },
    sniper: {
      len: 0.64, barrelLen: 0.40, pos: [0.23, -0.19, -0.44],
      scope: true, recoilKick: 2.2, casing: true
    },
    rocket: {
      len: 0.58, barrelLen: 0.34, pos: [0.25, -0.20, -0.44],
      scope: true, recoilKick: 3.4, casing: true, tubeReload: true
    }
  };

  // v9.1 CS 风格材质体系：多色 + 高质感
  function mats(global) {
    var T = global.THREE;
    return {
      // 枪械钢 — 亮银金属（马里奥圆润机械感）
      gunmetal: new window.MARIO.mat({ color: 0x5a6b7a, metalness: 0.7, roughness: 0.25 }),
      // 聚合物 — 哑光深灰（握把/护木/枪托）
      polymer: new window.MARIO.mat({ color: 0x2a2d33, roughness: 0.45 }),
      // FDE 沙色聚合物 — 亮沙色
      fde: new window.MARIO.mat({ color: 0xc8a878, roughness: 0.4 }),
      // 铬钢 — 亮镜面金属（枪管/导气管）
      chrome: new window.MARIO.mat({ color: 0xa8b8c8, metalness: 0.9, roughness: 0.15 }),
      // 亮银 — 高光金属（消焰器/管口装置）
      bright: new window.MARIO.mat({ color: 0xd8e0e8, metalness: 0.95, roughness: 0.1 }),
      // 木质 — 亮橙棕抛光（AK/霰弹枪护木枪托）
      wood: new window.MARIO.mat({ color: 0xc07a3a, roughness: 0.4 }),
      // 深木 — 枪托深色暖木
      woodDark: new window.MARIO.mat({ color: 0x8a5220, roughness: 0.4 }),
      // 黄铜 — 亮金弹匣/弹链
      brass: new window.MARIO.mat({ color: 0xe8b830, metalness: 0.8, roughness: 0.2 }),
      // 战术橙 — 喷火器/火箭筒标识（更鲜艳）
      tacOrange: new window.MARIO.mat({ color: 0xff6a00, roughness: 0.35 }),
      // 黑橡胶 — 握把纹理
      rubber: new window.MARIO.mat({ color: 0x1a1a1e, roughness: 0.55 }),
      // 透镜（彩色玻璃反光）
      lens: new window.MARIO.basic({ color: 0x66ccff }),
      // 红点
      redDot: new window.MARIO.basic({ color: 0xff3322 })
    };
  }

  // 枪口喷火（多层锥形火焰）
  function buildMuzzleFlash(T, muzzlePos) {
    var flameGroup = new T.Group();
    flameGroup.position.copy(muzzlePos);
    flameGroup.rotation.x = -Math.PI / 2;
    var layers = [];
    var colors = [0xffe066, 0xffaa33, 0xff6633];
    for (var i = 0; i < 3; i++) {
      var cone = new T.Mesh(
        new T.ConeGeometry(0.028 + i * 0.016, 0.22 - i * 0.05, 8),
        new window.MARIO.basic({ color: colors[i], transparent: true, opacity: 0, depthWrite: false })
      );
      cone.position.z = -0.06 - i * 0.035;
      cone.position.y = 0.01;
      flameGroup.add(cone);
      layers.push(cone);
    }
    // 火花环
    var spark = new T.Mesh(
      new T.RingGeometry(0.02, 0.05, 8),
      new window.MARIO.basic({ color: 0xffdd44, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide })
    );
    spark.position.z = -0.12;
    spark.rotation.y = 0;
    flameGroup.add(spark);
    layers.push(spark);
    flameGroup.visible = false;
    return { group: flameGroup, layers: layers };
  }

  // 导轨齿纹生成器（CS 风格皮卡汀尼导轨）
  function addRailTeeth(g, T, M, x, y, z, len, count, w) {
    var w = w || 0.05;
    var step = len / count;
    for (var i = 0; i < count; i++) {
      var tooth = new T.Mesh(new T.BoxGeometry(w, 0.008, step * 0.6), M.gunmetal);
      tooth.position.set(x, y, z - i * step + step * 0.5);
      g.add(tooth);
    }
  }

  // 防滑纹生成器（握把表面）
  function addGripTexture(g, T, M, cx, cy, cz, rows, cols, mat) {
    var mat = mat || M.rubber;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var dot = new T.Mesh(new T.BoxGeometry(0.008, 0.008, 0.008), mat);
        dot.position.set(cx + (c - cols / 2) * 0.012, cy - r * 0.014, cz);
        g.add(dot);
      }
    }
  }

  // ============ 沙漠之鹰 .50AE（CS 风格：棱角滑套 + 棱纹枪管 + 战术导轨） ============
  function buildDesertEagle(g, M, T, st) {
    var L = st.len;
    var anim = { mag: null, pump: null, bolt: null, tube: null };

    // —— 马里奥沙鹰：粗壮圆润方圆结合套筒 + 圆弧倒角 + 加大圆角枪口 + 饱满防滑握把 ——
    var slide = new T.Mesh(new T.CylinderGeometry(0.045, 0.05, 0.24, 16), M.bright);
    slide.rotation.x = Math.PI / 2;
    slide.position.set(0, 0.02, -L * 0.4 - 0.02);
    g.add(slide);
    var slideTop = new T.Mesh(new T.BoxGeometry(0.06, 0.02, 0.2), M.bright);
    slideTop.position.set(0, 0.055, -L * 0.4 - 0.02);
    g.add(slideTop);
    for (var si = 0; si < 5; si++) {
      var ser = new T.Mesh(new T.SphereGeometry(0.006, 6, 5), M.polymer);
      ser.position.set(0, 0.03, -L * 0.4 - 0.07 - si * 0.028);
      g.add(ser);
    }
    var muzzle = new T.Mesh(new T.CylinderGeometry(0.035, 0.04, 0.08, 14), M.chrome);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.015, -L * 0.4 - 0.2);
    muzzle.userData.part = 'barrel';
    g.add(muzzle);
    var muzzleTip = new T.Mesh(new T.SphereGeometry(0.038, 12, 10), M.chrome);
    muzzleTip.position.set(0, 0.015, -L * 0.4 - 0.24);
    g.add(muzzleTip);

    var grip = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.14, 12), M.polymer);
    grip.position.set(0, -0.1, -0.02);
    grip.rotation.x = 0.25;
    g.add(grip);
    for (var gi = 0; gi < 3; gi++) {
      var rib = new T.Mesh(new T.CylinderGeometry(0.042, 0.042, 0.012, 12), M.rubber);
      rib.position.set(0, -0.13 - gi * 0.02, -0.02 + gi * 0.005);
      rib.rotation.x = 0.25;
      g.add(rib);
    }
    var guard = new T.Mesh(new T.TorusGeometry(0.025, 0.008, 8, 14, Math.PI), M.polymer);
    guard.position.set(0, -0.02, -0.08);
    guard.rotation.x = Math.PI / 2;
    g.add(guard);
    var trigger = new T.Mesh(new T.CylinderGeometry(0.008, 0.01, 0.03, 8), M.chrome);
    trigger.position.set(0, -0.03, -0.09);
    g.add(trigger);
    var hammer = new T.Mesh(new T.SphereGeometry(0.018, 10, 8), M.chrome);
    hammer.position.set(0, 0.06, -0.005);
    g.add(hammer);
    var frontSight = new T.Mesh(new T.SphereGeometry(0.006, 8, 6), M.redDot);
    frontSight.position.set(0, 0.07, -L * 0.4 - 0.22);
    g.add(frontSight);

    var mag = new T.Mesh(new T.CylinderGeometry(0.035, 0.04, 0.1, 12), M.gunmetal);
    mag.position.set(0, -0.16, -L * 0.4 - 0.02);
    mag.rotation.x = 0.12;
    g.add(mag);
    var magBase = new T.Mesh(new T.SphereGeometry(0.04, 10, 8), M.polymer);
    magBase.scale.set(1, 0.6, 1);
    magBase.position.set(0, -0.21, -L * 0.4 - 0.01);
    g.add(magBase);
    anim.mag = mag;

    return anim;
  }

  function buildAK47(g, M, T, st) {
    var L = st.len;
    var anim = { mag: null, pump: null, bolt: null, tube: null };

    // —— 马里奥 AK：饱满弧形亮色木托/护木 + 加粗圆弧弹匣 + 圆角机匣 ——
    var receiver = new T.Mesh(new T.BoxGeometry(0.07, 0.08, 0.3), M.gunmetal);
    receiver.position.set(0, 0.01, -L * 0.42);
    g.add(receiver);
    var dustCover = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.3, 12), M.chrome);
    dustCover.rotation.x = Math.PI / 2;
    dustCover.position.set(0, 0.05, -L * 0.42);
    g.add(dustCover);

    var handguard = new T.Mesh(new T.CylinderGeometry(0.045, 0.05, 0.18, 14), M.wood);
    handguard.rotation.x = Math.PI / 2;
    handguard.position.set(0, -0.01, -L * 0.42 - 0.24);
    g.add(handguard);

    var barrel = new T.Mesh(new T.CylinderGeometry(0.028, 0.03, 0.22, 14), M.chrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -L * 0.42 - 0.36);
    barrel.userData.part = 'barrel';
    g.add(barrel);
    var muzzle = new T.Mesh(new T.CylinderGeometry(0.035, 0.032, 0.06, 12), M.bright);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.01, -L * 0.42 - 0.48);
    g.add(muzzle);

    var mag = new T.Mesh(new T.CylinderGeometry(0.045, 0.04, 0.14, 14), M.brass);
    mag.rotation.x = 0.5;
    mag.position.set(0, -0.08, -L * 0.42 + 0.02);
    g.add(mag);
    var magTip = new T.Mesh(new T.SphereGeometry(0.04, 10, 8), M.brass);
    magTip.position.set(0, -0.14, -L * 0.42 + 0.08);
    g.add(magTip);
    anim.mag = mag;
    // 圆角拉机柄（bolt，供换弹动画）
    var bolt = new T.Mesh(new T.SphereGeometry(0.02, 10, 8), M.chrome);
    bolt.position.set(0.04, 0.04, -L * 0.42 + 0.05);
    g.add(bolt);
    anim.bolt = bolt;

    var stock = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.2, 12), M.woodDark);
    stock.rotation.x = Math.PI / 2;
    stock.position.set(0, 0.0, -L * 0.42 + 0.28);
    g.add(stock);
    var butt = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.03, 12), M.rubber);
    butt.rotation.x = Math.PI / 2;
    butt.position.set(0, 0.0, -L * 0.42 + 0.4);
    g.add(butt);

    var grip = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.1, 10), M.polymer);
    grip.position.set(0, -0.09, -L * 0.42 + 0.12);
    grip.rotation.x = 0.3;
    g.add(grip);

    var frontSight = new T.Mesh(new T.SphereGeometry(0.006, 8, 6), M.redDot);
    frontSight.position.set(0, 0.065, -L * 0.42 - 0.46);
    g.add(frontSight);
    var rearSight = new T.Mesh(new T.BoxGeometry(0.04, 0.015, 0.01), M.polymer);
    rearSight.position.set(0, 0.06, -L * 0.42 + 0.08);
    g.add(rearSight);

    return anim;
  }

  function buildShotgun(g, M, T, st) {
    var L = st.len;
    var anim = { mag: null, pump: null, bolt: null, tube: null };

    // —— 木质枪托（含贴腮板）——
    var stock = new T.Mesh(new T.BoxGeometry(0.06, 0.085, 0.14), M.woodDark);
    stock.position.set(0, -0.01, -0.06);
    stock.userData.part = 'stock';
    g.add(stock);
    // 枪托底板
    var butt = new T.Mesh(new T.BoxGeometry(0.062, 0.09, 0.012), M.gunmetal);
    butt.position.set(0, -0.01, 0.01);
    butt.userData.part = 'stock';
    g.add(butt);
    // 贴腮板
    var cheek = new T.Mesh(new T.BoxGeometry(0.05, 0.015, 0.1), M.wood);
    cheek.position.set(0, 0.04, -0.05);
    cheek.userData.part = 'stock';
    g.add(cheek);

    // —— 机匣（钢制）——
    var receiver = new T.Mesh(new T.BoxGeometry(0.062, 0.075, 0.15), M.gunmetal);
    receiver.position.set(0, 0.005, -L * 0.34);
    g.add(receiver);
    // 机匣顶部导轨
    addRailTeeth(g, T, M, 0, 0.045, -L * 0.34 - 0.05, 0.12, 6, 0.05);

    // —— 枪管（粗管）——
    var barrel = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, st.barrelLen + 0.08, 10), M.chrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -L * 0.34 - 0.08 - (st.barrelLen + 0.08) / 2);
    barrel.userData.part = 'barrel';
    g.add(barrel);
    // 枪管喉部（连接机匣处略粗）
    var barrelH = new T.Mesh(new T.CylinderGeometry(0.028, 0.022, 0.04, 10), M.gunmetal);
    barrelH.rotation.x = Math.PI / 2;
    barrelH.position.set(0, 0.02, -L * 0.34 - 0.08);
    barrelH.userData.part = 'barrel';
    g.add(barrelH);

    // —— 弹仓管（下方）——
    var magTube = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, st.barrelLen - 0.04, 8), M.gunmetal);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.025, -L * 0.33 - (st.barrelLen - 0.04) / 2);
    magTube.userData.part = 'barrel';
    g.add(magTube);
    // 弹仓管帽
    var tubeCap = new T.Mesh(new T.CylinderGeometry(0.022, 0.018, 0.025, 8), M.bright);
    tubeCap.rotation.x = Math.PI / 2;
    tubeCap.position.set(0, -0.025, -L * 0.33 - (st.barrelLen - 0.04));
    tubeCap.userData.part = 'barrel';
    g.add(tubeCap);

    // —— 木质泵动护木（换弹动画）——
    var pump = new T.Mesh(new T.BoxGeometry(0.058, 0.07, 0.12), M.wood);
    pump.position.set(0, -0.012, -L * 0.4 - 0.05);
    g.add(pump);
    // 泵动护木防滑纹
    for (var pi = 0; pi < 5; pi++) {
      var pg = new T.Mesh(new T.BoxGeometry(0.06, 0.006, 0.01), M.woodDark);
      pg.position.set(0, -0.012, -L * 0.4 - 0.01 - pi * 0.022);
      g.add(pg);
    }
    anim.pump = pump;

    // —— 握把 + 扳机护圈 ——
    var grip = new T.Mesh(new T.BoxGeometry(0.046, 0.09, 0.05), M.woodDark);
    grip.position.set(0, -0.085, -L * 0.34 + 0.01);
    grip.rotation.x = 0.22;
    g.add(grip);
    var guard = new T.Mesh(new T.TorusGeometry(0.022, 0.005, 6, 10, Math.PI), M.gunmetal);
    guard.position.set(0, -0.025, -L * 0.34 - 0.04);
    guard.rotation.x = Math.PI / 2;
    g.add(guard);

    // —— 前端珠形准星 ——
    var bead = new T.Mesh(new T.SphereGeometry(0.008, 6, 5), M.bright);
    bead.position.set(0, 0.05, -L * 0.34 - 0.08 - (st.barrelLen + 0.08));
    g.add(bead);

    return anim;
  }

  // ============ 喷火器（CS 风格：双燃料罐 + 阀门 + 引火管 + 战术握把） ============
  function buildFlamethrower(g, M, T, st) {
    var L = st.len;
    var anim = { mag: null, pump: null, bolt: null, tube: null };

    // —— 马里奥喷火器：肥嘟嘟圆柱双气罐(黄色危险标志) + 弯曲圆角管道 + 圆环遮罩喷火口 ——
    // 主体圆柱枪身
    var body = new T.Mesh(new T.CylinderGeometry(0.05, 0.055, 0.3, 14), M.polymer);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0.0, -L * 0.42);
    g.add(body);

    // 肥嘟嘟双气罐（上下两个粗圆柱，战术橙 + 黄色危险标志）
    var tank1 = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.16, 16), M.tacOrange);
    tank1.rotation.x = Math.PI / 2;
    tank1.position.set(0, -0.03, -L * 0.42 + 0.12);
    g.add(tank1);
    var tank2 = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.16, 16), M.polymer);
    tank2.rotation.x = Math.PI / 2;
    tank2.position.set(0, -0.03, -L * 0.42 + 0.3);
    g.add(tank2);
    // 黄色危险标志（圆片）
    var hazard1 = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.02, 12), M.brass);
    hazard1.rotation.x = Math.PI / 2;
    hazard1.position.set(0, -0.03, -L * 0.42 + 0.12);
    g.add(hazard1);
    var hazard2 = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.02, 12), M.brass);
    hazard2.rotation.x = Math.PI / 2;
    hazard2.position.set(0, -0.03, -L * 0.42 + 0.3);
    g.add(hazard2);
    // 气罐圆角端盖
    var cap1 = new T.Mesh(new T.SphereGeometry(0.06, 12, 10), M.rubber);
    cap1.position.set(0, -0.03, -L * 0.42 + 0.2);
    g.add(cap1);
    var cap2 = new T.Mesh(new T.SphereGeometry(0.06, 12, 10), M.rubber);
    cap2.position.set(0, -0.03, -L * 0.42 + 0.38);
    g.add(cap2);

    // 弯曲圆角管道（弧形圆柱，导气）
    var pipe = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.2, 10), M.chrome);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0.02, 0.03, -L * 0.42 + 0.2);
    g.add(pipe);

    // 圆环遮罩喷火口（圆环 + 中央火口）
    var nozzle = new T.Mesh(new T.TorusGeometry(0.05, 0.018, 8, 14), M.gunmetal);
    nozzle.position.set(0, 0.0, -L * 0.42 - 0.18);
    g.add(nozzle);
    var flameTip = new T.Mesh(new T.SphereGeometry(0.035, 12, 10), M.tacOrange);
    flameTip.position.set(0, 0.0, -L * 0.42 - 0.18);
    flameTip.userData.part = 'barrel';
    g.add(flameTip);

    // 圆润握把
    var grip = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 0.1, 10), M.rubber);
    grip.position.set(0, -0.08, -L * 0.42 - 0.02);
    grip.rotation.x = 0.3;
    g.add(grip);

    return anim;
  }

  function buildSniper(g, M, T, st) {
    var L = st.len;
    var anim = { mag: null, pump: null, bolt: null, tube: null };

    // —— 马里奥 AWP 狙击：夸张拉长圆柱重型枪管 + 巨大双层圆角高倍镜(彩色玻璃反光) + 折叠圆角双脚架 ——
    // 长圆柱重型枪管（亮镜面）
    var barrel = new T.Mesh(new T.CylinderGeometry(0.03, 0.032, 0.4, 16), M.chrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -L * 0.42 - 0.22);
    barrel.userData.part = 'barrel';
    g.add(barrel);
    // 消音器（粗圆角）
    var suppressor = new T.Mesh(new T.CylinderGeometry(0.04, 0.045, 0.15, 14), M.gunmetal);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.01, -L * 0.42 - 0.48);
    g.add(suppressor);
    var supTip = new T.Mesh(new T.SphereGeometry(0.045, 12, 10), M.gunmetal);
    supTip.position.set(0, 0.01, -L * 0.42 - 0.56);
    g.add(supTip);

    // 机匣（圆润金属）
    var receiver = new T.Mesh(new T.BoxGeometry(0.06, 0.08, 0.22), M.polymer);
    receiver.position.set(0, 0.01, -L * 0.42 + 0.05);
    g.add(receiver);

    // 巨大双层圆角高倍镜（两个圆筒镜身 + 彩色玻璃反光镜头）
    var scopeBody = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.18, 16), M.gunmetal);
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.position.set(0, 0.09, -L * 0.42 + 0.02);
    g.add(scopeBody);
    var scopeInner = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.19, 16), M.polymer);
    scopeInner.rotation.x = Math.PI / 2;
    scopeInner.position.set(0, 0.09, -L * 0.42 + 0.02);
    g.add(scopeInner);
    // 双层镜头（彩色玻璃反光：前蓝后紫）
    var lensFront = new T.Mesh(new T.SphereGeometry(0.045, 14, 12), M.lens);
    lensFront.scale.set(1, 1, 0.4);
    lensFront.position.set(0, 0.09, -L * 0.42 - 0.07);
    g.add(lensFront);
    var lensRear = new T.Mesh(new T.SphereGeometry(0.048, 14, 12), new window.MARIO.basic({ color: 0xcc88ff }));
    lensRear.scale.set(1, 1, 0.4);
    lensRear.position.set(0, 0.09, -L * 0.42 + 0.12);
    g.add(lensRear);

    // 折叠圆角双脚架（两根细圆柱 + 圆角支脚）
    var bipodL = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.2, 8), M.gunmetal);
    bipodL.position.set(-0.04, -0.04, -L * 0.42 - 0.3);
    bipodL.rotation.z = 0.5;
    g.add(bipodL);
    var bipodR = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.2, 8), M.gunmetal);
    bipodR.position.set(0.04, -0.04, -L * 0.42 - 0.3);
    bipodR.rotation.z = -0.5;
    g.add(bipodR);
    var footL = new T.Mesh(new T.SphereGeometry(0.02, 8, 6), M.rubber);
    footL.position.set(-0.1, -0.14, -L * 0.42 - 0.3);
    g.add(footL);
    var footR = new T.Mesh(new T.SphereGeometry(0.02, 8, 6), M.rubber);
    footR.position.set(0.1, -0.14, -L * 0.42 - 0.3);
    g.add(footR);

    // 圆润枪栓（bolt，供换弹动画）
    var bolt = new T.Mesh(new T.SphereGeometry(0.025, 10, 8), M.chrome);
    bolt.position.set(0.03, 0.02, -L * 0.42 + 0.15);
    g.add(bolt);
    anim.bolt = bolt;

    // 圆角弹匣（mag，供换弹动画）
    var mag = new T.Mesh(new T.CylinderGeometry(0.035, 0.04, 0.1, 12), M.gunmetal);
    mag.position.set(0, -0.1, -L * 0.42 + 0.06);
    mag.rotation.x = 0.1;
    g.add(mag);
    anim.mag = mag;

    // 圆润枪托
    var stock = new T.Mesh(new T.CylinderGeometry(0.04, 0.045, 0.18, 12), M.polymer);
    stock.rotation.x = Math.PI / 2;
    stock.position.set(0, 0.0, -L * 0.42 + 0.3);
    g.add(stock);
    var butt = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.03, 12), M.rubber);
    butt.rotation.x = Math.PI / 2;
    butt.position.set(0, 0.0, -L * 0.42 + 0.4);
    g.add(butt);

    // 握把
    var grip = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.1, 10), M.rubber);
    grip.position.set(0, -0.08, -L * 0.42 + 0.1);
    grip.rotation.x = 0.25;
    g.add(grip);

    return anim;
  }

  function buildRocket(g, M, T, st) {
    var L = st.len;
    var anim = { mag: null, pump: null, bolt: null, tube: null };

    // —— 马里奥火箭筒：粗大圆筒炮身 + Bullet Bill 凶恶眼睛圆头火箭弹 ——
    // 粗大圆筒炮身（战术橙主色 + 金属）
    var tube = new T.Mesh(new T.CylinderGeometry(0.09, 0.1, 0.5, 18), M.tacOrange);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.0, -L * 0.42 - 0.05);
    g.add(tube);
    // 炮口圆角环
    var muzzleRing = new T.Mesh(new T.TorusGeometry(0.1, 0.02, 8, 18), M.gunmetal);
    muzzleRing.position.set(0, 0.0, -L * 0.42 - 0.3);
    g.add(muzzleRing);
    // 炮尾圆角（后座）
    var breech = new T.Mesh(new T.SphereGeometry(0.1, 14, 12), M.gunmetal);
    breech.scale.set(1, 1, 0.5);
    breech.position.set(0, 0.0, -L * 0.42 + 0.2);
    g.add(breech);

    // Bullet Bill 凶恶眼睛圆头火箭弹（露出炮口）
    var warhead = new T.Mesh(new T.SphereGeometry(0.085, 16, 14), M.bright);
    warhead.scale.set(1, 1, 1.3);
    warhead.position.set(0, 0.0, -L * 0.42 - 0.35);
    warhead.userData.part = 'barrel';
    g.add(warhead);
    // 白色眼白
    var eyeWhiteL = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), new window.MARIO.mat({ color: 0xffffff }));
    eyeWhiteL.position.set(-0.035, 0.025, -L * 0.42 - 0.4);
    g.add(eyeWhiteL);
    var eyeWhiteR = new T.Mesh(new T.SphereGeometry(0.03, 10, 8), new window.MARIO.mat({ color: 0xffffff }));
    eyeWhiteR.position.set(0.035, 0.025, -L * 0.42 - 0.4);
    g.add(eyeWhiteR);
    // 凶恶黑色瞳孔
    var pupilL = new T.Mesh(new T.SphereGeometry(0.015, 8, 6), new window.MARIO.basic({ color: 0x111111 }));
    pupilL.position.set(-0.035, 0.025, -L * 0.42 - 0.45);
    g.add(pupilL);
    var pupilR = new T.Mesh(new T.SphereGeometry(0.015, 8, 6), new window.MARIO.basic({ color: 0x111111 }));
    pupilR.position.set(0.035, 0.025, -L * 0.42 - 0.45);
    g.add(pupilR);
    // 凶恶眉毛（斜方块）
    var browL = new T.Mesh(new T.BoxGeometry(0.04, 0.012, 0.012), new window.MARIO.mat({ color: 0x222222 }));
    browL.position.set(-0.035, 0.06, -L * 0.42 - 0.42);
    browL.rotation.z = 0.4;
    g.add(browL);
    var browR = new T.Mesh(new T.BoxGeometry(0.04, 0.012, 0.012), new window.MARIO.mat({ color: 0x222222 }));
    browR.position.set(0.035, 0.06, -L * 0.42 - 0.42);
    browR.rotation.z = -0.4;
    g.add(browR);
    anim.tube = warhead;

    // 圆润握把 + 前握把
    var gripRear = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 0.12, 10), M.rubber);
    gripRear.position.set(0, -0.12, -L * 0.42 + 0.1);
    gripRear.rotation.x = 0.3;
    g.add(gripRear);
    var gripFront = new T.Mesh(new T.CylinderGeometry(0.03, 0.035, 0.08, 10), M.polymer);
    gripFront.position.set(0, -0.1, -L * 0.42 - 0.1);
    g.add(gripFront);

    // 圆角光学瞄具（小）
    var sight = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.08, 10), M.gunmetal);
    sight.rotation.x = Math.PI / 2;
    sight.position.set(0, 0.13, -L * 0.42);
    g.add(sight);
    var sightLens = new T.Mesh(new T.SphereGeometry(0.024, 10, 8), M.lens);
    sightLens.scale.set(1, 1, 0.5);
    sightLens.position.set(0, 0.13, -L * 0.42 - 0.05);
    g.add(sightLens);

    return anim;
  }

  function buildHands(g, T, type, anim) {
    var skin = new window.MARIO.mat({ color: 0xd9a37f});
    var skin2 = new window.MARIO.mat({ color: 0xc98d5f});
    var sleeve = new window.MARIO.mat({ color: 0x2b303a});
    var glove = new window.MARIO.mat({ color: 0x1a1c20});

    function makeHand(mat, sleeveOn, gloveOn) {
      var h = new T.Group();
      // 手掌
      var palm = new T.Mesh(new T.BoxGeometry(0.07, 0.05, 0.065), gloveOn ? glove : mat);
      palm.position.set(0, -0.008, 0);
      palm.userData.isHand = true;
      h.add(palm);
      // 4 根手指
      for (var fi = 0; fi < 4; fi++) {
        var finger = new T.Mesh(new T.CylinderGeometry(0.0105, 0.0115, 0.075, 6), gloveOn ? glove : mat);
        finger.position.set(-0.027 + fi * 0.018, -0.042, 0.006);
        finger.rotation.x = 0.55 + fi * 0.05;
        finger.userData.isHand = true;
        h.add(finger);
      }
      // 拇指
      var thumb = new T.Mesh(new T.CylinderGeometry(0.012, 0.013, 0.05, 6), gloveOn ? glove : mat);
      thumb.position.set(0.044, -0.02, 0.0);
      thumb.rotation.z = -0.7;
      thumb.userData.isHand = true;
      h.add(thumb);
      // 前臂
      var forearm = new T.Mesh(new T.CylinderGeometry(0.036, 0.052, 0.34, 8), sleeveOn ? sleeve : mat);
      forearm.position.set(0, -0.19, 0.05);
      forearm.rotation.x = 0.62;
      forearm.userData.isHand = true;
      h.add(forearm);
      return h;
    }

    var grip, support;
    switch (type) {
      case 'pistol': grip = [0, -0.05, -0.04]; support = [0, -0.13, -0.02]; break;
      case 'rifle': grip = [0, -0.07, -L_pos(type)]; support = [0, -0.02, -0.31]; break;
      case 'shotgun': grip = [0, -0.07, -0.15]; support = [0, -0.02, -0.29]; break;
      case 'flamethrower': grip = [0, -0.07, -0.06]; support = [0, 0.0, -0.26]; break;
      case 'sniper': grip = [0, -0.06, -0.22]; support = [0, 0.0, -0.33]; break;
      case 'rocket': grip = [0, -0.08, -0.24]; support = [0, -0.06, -0.34]; break;
      default: grip = [0, -0.05, -0.04]; support = [0, -0.13, -0.02];
    }

    var handR = makeHand(skin, true, true);
    handR.position.set(grip[0], grip[1], grip[2]);
    g.add(handR);

    var handL = makeHand(skin2, false, true);
    handL.position.set(support[0], support[1], support[2]);
    g.add(handL);

    anim.handR = handR;
    anim.handL = handL;
    anim.handRBase = new T.Vector3(grip[0], grip[1], grip[2]);
    anim.handLBase = new T.Vector3(support[0], support[1], support[2]);
  }

  // 辅助：根据枪型获取握把 z 位置
  function L_pos(type) {
    var st = STYLES[type] || STYLES.pistol;
    return st.len * 0.38;
  }

  global.MODELS.gun = {
    name: 'gun',

    create: function (config) {
      var T = global.THREE;
      var type = (config && config.type) || 'pistol';
      var st = STYLES[type] || STYLES.pistol;
      var M = mats(global);
      var g = new T.Group();
      var L = st.len;

      var anim;
      if (type === 'rifle') anim = buildAK47(g, M, T, st);
      else if (type === 'shotgun') anim = buildShotgun(g, M, T, st);
      else if (type === 'sniper') anim = buildSniper(g, M, T, st);
      else if (type === 'flamethrower') anim = buildFlamethrower(g, M, T, st);
      else if (type === 'rocket') anim = buildRocket(g, M, T, st);
      else anim = buildDesertEagle(g, M, T, st);

      // 枪口锚点（曳光弹起点）
      var muzzle = new T.Object3D();
      muzzle.position.set(0, 0.015, -L * 0.42 - st.barrelLen - 0.08);
      g.add(muzzle);

      // v9.2 取消枪管准星发光点（sightGlow）

      // 枪口喷火
      var flame = buildMuzzleFlash(T, muzzle.position);
      g.add(flame.group);

      // 抛壳锚点（右侧抛壳窗）
      var eject = new T.Object3D();
      eject.position.set(0.06, 0.04, -L * 0.42);
      g.add(eject);

      // v9.2 取消双手模型（屏幕不显示手部）
      // buildHands(g, T, type, anim);

      // 换弹动画状态
      var animBase = {};
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

      // v9.2 取消准星发光点变色

      // 后坐恢复 + 枪口喷火脉冲
      if (u.recoil > 0) {
        u.recoil -= dt * (u.kick * 4.2);
        var r = Math.max(0, u.recoil);
        var k = r * r;
        inst.position.z = u.basePos.z + Math.sin(r * Math.PI) * 0.09 * u.kick;
        inst.position.y = u.basePos.y + k * 0.045 * u.kick;
        inst.position.x = u.basePos.x + k * 0.025 * u.kick + (Math.random() - 0.5) * 0.004;
        inst.rotation.x = k * 0.07 * u.kick;
        inst.rotation.z = (Math.random() - 0.5) * 0.015 * u.kick;
        u.flash.visible = true;
        for (var i = 0; i < u.flameLayers.length; i++) {
          var layer = u.flameLayers[i];
          layer.material.opacity = Math.min(1, u.recoil * (2.2 - i * 0.5)) * 0.9;
          var fs = 1 + k * 0.8 + Math.random() * 0.25;
          layer.scale.set(fs, fs * (0.8 + Math.random() * 0.4), fs);
        }
      } else {
        inst.position.z = u.basePos.z;
        inst.rotation.x = 0;
        inst.rotation.z = 0;
        u.flash.visible = false;
      }

      // 换弹动画
      if (u.reloading) {
        u.reloadT += dt;
        var pr = Math.min(1, u.reloadT / u.reloadDur);
        if (pr >= 1) u.reloading = false;
        inst.rotation.x += 0.07;

        if (u.anim.mag && u.anim.mag.userData) {
          var bp = u.anim.mag.userData.basePos;
          var mp;
          if (pr < 0.28) mp = -0.15 * (pr / 0.28);
          else if (pr < 0.55) mp = -0.15;
          else if (pr < 0.8) mp = -0.15 + 0.15 * ((pr - 0.55) / 0.25);
          else mp = 0;
          u.anim.mag.position.y = bp.y + mp;
          u.anim.mag.position.z = bp.z + Math.abs(mp) * 0.2;
        }
        if (u.anim.pump && u.anim.pump.userData) {
          var bp2 = u.anim.pump.userData.basePos;
          var pp = 0;
          if (pr >= 0.15 && pr < 0.45) pp = 0.11 * Math.sin(((pr - 0.15) / 0.3) * Math.PI);
          else if (pr >= 0.45 && pr < 0.7) pp = -0.09 * Math.sin(((pr - 0.45) / 0.25) * Math.PI);
          u.anim.pump.position.z = bp2.z + pp;
        }
        if (u.anim.bolt && u.anim.bolt.userData) {
          var bp3 = u.anim.bolt.userData.basePos;
          var b3 = (pr >= 0.55 && pr < 0.8) ? 0.09 * Math.sin(((pr - 0.55) / 0.25) * Math.PI) : 0;
          u.anim.bolt.position.z = bp3.z + b3;
        }
        if (u.anim.tube && u.anim.tube.userData) {
          var bp4 = u.anim.tube.userData.basePos;
          var tp;
          if (pr < 0.35) tp = 0.12 * (pr / 0.35);
          else if (pr < 0.65) tp = 0.12;
          else tp = 0.12 * (1 - (pr - 0.65) / 0.35);
          u.anim.tube.position.z = bp4.z + tp;
        }
        // v9.2 取消换弹时手部动画
      }
      // v9.2 取消非换弹手部复位

      // 移动晃动 + 呼吸
      var bob = moving ? 1 : 0.25;
      inst.position.x = u.basePos.x + Math.sin(u.phase * 8) * 0.004 * bob;
      inst.position.y = (u.recoil > 0 ? inst.position.y : u.basePos.y) + Math.cos(u.phase * 10) * 0.004 * bob;
    }
  };
})(window);
