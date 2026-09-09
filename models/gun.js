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
      // 枪械钢 — 深灰高金属度（CS 标准机匣色）
      gunmetal: new T.MeshLambertMaterial({ color: 0x2a2d33, emissive: 0x0a0b0d, emissiveIntensity: 0.25 }),
      // 聚合物 — 哑光黑（握把/护木/枪托）
      polymer: new T.MeshLambertMaterial({ color: 0x1a1c20, emissive: 0x050507, emissiveIntensity: 0.2 }),
      // FDE 沙色聚合物 — 战术色（CS:GO 风格）
      fde: new T.MeshLambertMaterial({ color: 0x8c7355, emissive: 0x1a1408, emissiveIntensity: 0.2 }),
      // 铬钢 — 亮金属（枪管/导气管）
      chrome: new T.MeshLambertMaterial({ color: 0x3d4248, emissive: 0x0c0e10, emissiveIntensity: 0.3 }),
      // 亮银 — 高光金属（消焰器/管口装置）
      bright: new T.MeshLambertMaterial({ color: 0x555a62, emissive: 0x10121a, emissiveIntensity: 0.3 }),
      // 木质 — 深褐带暖色（AK/霰弹枪护木枪托）
      wood: new T.MeshLambertMaterial({ color: 0x6b4226, emissive: 0x180c04, emissiveIntensity: 0.2 }),
      // 深木 — 枪托深色
      woodDark: new T.MeshLambertMaterial({ color: 0x4a2d18, emissive: 0x100804, emissiveIntensity: 0.2 }),
      // 黄铜 — 弹匣/弹链
      brass: new T.MeshLambertMaterial({ color: 0xb8860b, emissive: 0x2a1c00, emissiveIntensity: 0.25 }),
      // 战术橙 — 喷火器/火箭筒标识
      tacOrange: new T.MeshLambertMaterial({ color: 0xe0530f, emissive: 0x3a1000, emissiveIntensity: 0.35 }),
      // 黑橡胶 — 握把纹理
      rubber: new T.MeshLambertMaterial({ color: 0x141416, emissive: 0x040404, emissiveIntensity: 0.15 }),
      // 透镜
      lens: new T.MeshBasicMaterial({ color: 0x88ccff }),
      // 红点
      redDot: new T.MeshBasicMaterial({ color: 0xff3322 })
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
        new T.MeshBasicMaterial({ color: colors[i], transparent: true, opacity: 0, depthWrite: false })
      );
      cone.position.z = -0.06 - i * 0.035;
      cone.position.y = 0.01;
      flameGroup.add(cone);
      layers.push(cone);
    }
    // 火花环
    var spark = new T.Mesh(
      new T.RingGeometry(0.02, 0.05, 8),
      new T.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide })
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

    // —— 滑套（棱角分明，前窄后宽）——
    var slide = new T.Mesh(new T.BoxGeometry(0.075, 0.085, 0.22), M.gunmetal);
    slide.position.set(0, 0.025, -L * 0.4 - 0.03);
    g.add(slide);
    // 滑套侧面棱纹（CS 风格防滑）
    for (var si = 0; si < 5; si++) {
      var ser = new T.Mesh(new T.BoxGeometry(0.077, 0.006, 0.008), M.polymer);
      ser.position.set(0, 0.068, -L * 0.4 - 0.08 - si * 0.03);
      g.add(ser);
    }
    // 滑套前部收窄
    var slideFront = new T.Mesh(new T.BoxGeometry(0.06, 0.07, 0.06), M.gunmetal);
    slideFront.position.set(0, 0.022, -L * 0.4 - 0.17);
    g.add(slideFront);

    // —— 棱纹枪管（外露，CS 标志性三角棱纹）——
    var barrel = new T.Mesh(new T.CylinderGeometry(0.024, 0.028, 0.13, 6), M.chrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -L * 0.4 - 0.22);
    barrel.userData.part = 'barrel';
    g.add(barrel);
    // 棱纹（6 道纵向沟槽）
    for (var fi = 0; fi < 6; fi++) {
      var a = (fi / 6) * Math.PI * 2;
      var fin = new T.Mesh(new T.BoxGeometry(0.004, 0.006, 0.1), M.bright);
      fin.position.set(Math.cos(a) * 0.026, 0.015 + Math.sin(a) * 0.026, -L * 0.4 - 0.22);
      fin.rotation.z = a;
      g.add(fin);
    }
    // 枪口制退器（CS 风格）
    var muzzleBrake = new T.Mesh(new T.CylinderGeometry(0.034, 0.03, 0.04, 8), M.bright);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.015, -L * 0.4 - 0.3);
    muzzleBrake.userData.part = 'barrel';
    g.add(muzzleBrake);

    // —— 握把（大角度倾斜，沙鹰标志）——
    var grip = new T.Mesh(new T.BoxGeometry(0.07, 0.12, 0.08), M.polymer);
    grip.position.set(0, -0.09, -0.02);
    grip.rotation.x = 0.2;
    g.add(grip);
    // 握把防滑橡胶面
    addGripTexture(g, T, M, 0.036, -0.04, -0.01, 5, 3, M.rubber);
    addGripTexture(g, T, M, -0.036, -0.04, -0.01, 5, 3, M.rubber);

    // —— 扳机护圈 + 扳机 ——
    var guard = new T.Mesh(new T.TorusGeometry(0.022, 0.006, 6, 10, Math.PI), M.gunmetal);
    guard.position.set(0, -0.025, -0.08);
    guard.rotation.x = Math.PI / 2;
    g.add(guard);
    var trigger = new T.Mesh(new T.BoxGeometry(0.012, 0.03, 0.008), M.polymer);
    trigger.position.set(0, -0.035, -0.095);
    g.add(trigger);

    // —— 击锤 ——
    var hammer = new T.Mesh(new T.BoxGeometry(0.035, 0.04, 0.014), M.chrome);
    hammer.position.set(0, 0.045, -0.005);
    hammer.rotation.x = -0.25;
    g.add(hammer);

    // —— 战术导轨 + 准星 ——
    addRailTeeth(g, T, M, 0, 0.075, -L * 0.4 - 0.05, 0.1, 5, 0.05);
    var frontSight = new T.Mesh(new T.BoxGeometry(0.014, 0.025, 0.009), M.polymer);
    frontSight.position.set(0, 0.07, -L * 0.4 - 0.27);
    g.add(frontSight);
    var frontSightDot = new T.Mesh(new T.SphereGeometry(0.004, 6, 4), M.redDot);
    frontSightDot.position.set(0, 0.083, -L * 0.4 - 0.27);
    g.add(frontSightDot);
    // 照门
    var rearSight = new T.Mesh(new T.BoxGeometry(0.04, 0.02, 0.012), M.polymer);
    rearSight.position.set(0, 0.07, -L * 0.4 + 0.02);
    g.add(rearSight);

    // —— 弹匣（换弹动画）——
    var mag = new T.Mesh(new T.BoxGeometry(0.048, 0.09, 0.06), M.gunmetal);
    mag.position.set(0, -0.15, -L * 0.4 - 0.02);
    mag.rotation.x = 0.12;
    g.add(mag);
    // 弹匣底板
    var magBase = new T.Mesh(new T.BoxGeometry(0.052, 0.012, 0.064), M.polymer);
    magBase.position.set(0, -0.195, -L * 0.4 - 0.01);
    magBase.rotation.x = 0.12;
    g.add(magBase);
    anim.mag = mag;

    return anim;
  }

  // ============ AK-47（CS 风格：冲压机匣 + 木护木 + 弧形弹匣 + 斜切消焰器） ============
  function buildAK47(g, M, T, st) {
    var L = st.len;
    var anim = { mag: null, pump: null, bolt: null, tube: null };

    // —— 机匣（冲压钢，CS 标志性长方形）——
    var receiver = new T.Mesh(new T.BoxGeometry(0.068, 0.075, 0.2), M.gunmetal);
    receiver.position.set(0, 0.02, -L * 0.38);
    g.add(receiver);
    // 机匣顶盖（略小，可拆卸感）
    var topCover = new T.Mesh(new T.BoxGeometry(0.064, 0.015, 0.18), M.chrome);
    topCover.position.set(0, 0.063, -L * 0.38);
    g.add(topCover);
    // 顶盖纵向加强筋
    for (var ri = 0; ri < 3; ri++) {
      var rib = new T.Mesh(new T.BoxGeometry(0.004, 0.004, 0.17), M.gunmetal);
      rib.position.set(-0.02 + ri * 0.02, 0.071, -L * 0.38);
      g.add(rib);
    }

    // —— 木质下护木 ——
    var handguard = new T.Mesh(new T.BoxGeometry(0.062, 0.055, 0.12), M.wood);
    handguard.position.set(0, -0.018, -L * 0.52);
    g.add(handguard);
    // 护木防滑纹
    for (var hi = 0; hi < 4; hi++) {
      var hg = new T.Mesh(new T.BoxGeometry(0.064, 0.006, 0.01), M.woodDark);
      hg.position.set(0, -0.018, -L * 0.48 - hi * 0.03);
      g.add(hg);
    }

    // —— 导气管 + 气体调节器 ——
    var gasTube = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.16, 8), M.chrome);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.04, -L * 0.54);
    gasTube.userData.part = 'barrel';
    g.add(gasTube);
    // 气块
    var gasBlock = new T.Mesh(new T.BoxGeometry(0.04, 0.05, 0.04), M.gunmetal);
    gasBlock.position.set(0, 0.02, -L * 0.62);
    g.add(gasBlock);

    // —— 枪管 ——
    var barrel = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, st.barrelLen, 8), M.chrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.005, -L * 0.38 - 0.1 - st.barrelLen / 2);
    barrel.userData.part = 'barrel';
    g.add(barrel);

    // —— 斜切消焰器（AK-47 标志）——
    var muzzle = new T.Mesh(new T.CylinderGeometry(0.022, 0.02, 0.045, 8), M.bright);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.005, -L * 0.38 - 0.1 - st.barrelLen - 0.02);
    muzzle.userData.part = 'barrel';
    g.add(muzzle);
    // 斜切口
    var muzzleCut = new T.Mesh(new T.BoxGeometry(0.05, 0.015, 0.02), M.bright);
    muzzleCut.position.set(0, 0.02, -L * 0.38 - 0.1 - st.barrelLen - 0.04);
    muzzleCut.rotation.x = -0.35;
    g.add(muzzleCut);

    // —— 准星柱（AK 标志性倾斜准星）——
    var frontSight = new T.Mesh(new T.BoxGeometry(0.018, 0.045, 0.014), M.gunmetal);
    frontSight.position.set(0, 0.055, -L * 0.62);
    frontSight.rotation.x = -0.1;
    g.add(frontSight);
    // 照门（滑槽式）
    var rearSight = new T.Mesh(new T.BoxGeometry(0.05, 0.025, 0.02), M.gunmetal);
    rearSight.position.set(0, 0.06, -L * 0.38 + 0.02);
    g.add(rearSight);
    var rearNotch = new T.Mesh(new T.BoxGeometry(0.012, 0.01, 0.022), M.polymer);
    rearNotch.position.set(0, 0.072, -L * 0.38 + 0.02);
    g.add(rearNotch);

    // —— 弧形弹匣（AK 标志，CS 经典橙色/钢色）——
    var mag = new T.Mesh(new T.BoxGeometry(0.04, 0.14, 0.07), M.bright);
    mag.position.set(0, -0.12, -L * 0.38 - 0.05);
    mag.rotation.x = -0.35;
    g.add(mag);
    // 弹匣弧线（底部前倾）
    var magCurve = new T.Mesh(new T.BoxGeometry(0.04, 0.05, 0.06), M.bright);
    magCurve.position.set(0, -0.18, -L * 0.38 - 0.01);
    magCurve.rotation.x = -0.55;
    g.add(magCurve);
    anim.mag = mag;

    // —— 木质枪托 ——
    var stock = new T.Mesh(new T.BoxGeometry(0.058, 0.08, 0.13), M.woodDark);
    stock.position.set(0, -0.005, -0.06);
    stock.userData.part = 'stock';
    g.add(stock);
    // 枪托底板
    var buttPlate = new T.Mesh(new T.BoxGeometry(0.06, 0.085, 0.015), M.gunmetal);
    buttPlate.position.set(0, -0.005, 0.005);
    buttPlate.userData.part = 'stock';
    g.add(buttPlate);

    // —— 握把（聚合物）——
    var grip = new T.Mesh(new T.BoxGeometry(0.042, 0.09, 0.05), M.polymer);
    grip.position.set(0, -0.085, -L * 0.38 + 0.02);
    grip.rotation.x = 0.22;
    g.add(grip);
    addGripTexture(g, T, M, 0.024, -0.045, -L * 0.38 + 0.025, 4, 2, M.rubber);
    addGripTexture(g, T, M, -0.024, -0.045, -L * 0.38 + 0.025, 4, 2, M.rubber);

    // —— 扳机护圈 ——
    var guard = new T.Mesh(new T.TorusGeometry(0.02, 0.005, 6, 10, Math.PI), M.gunmetal);
    guard.position.set(0, -0.025, -L * 0.38 - 0.02);
    guard.rotation.x = Math.PI / 2;
    g.add(guard);

    // —— 拉机柄（右后侧，CS 标志性大拨片）——
    var bolt = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.06, 6), M.chrome);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0.05, 0.05, -L * 0.38 + 0.06);
    g.add(bolt);
    var boltHandle = new T.Mesh(new T.SphereGeometry(0.014, 6, 5), M.bright);
    boltHandle.position.set(0.06, 0.05, -L * 0.38 + 0.06);
    g.add(boltHandle);
    anim.bolt = bolt;

    return anim;
  }

  // ============ Nova 泵动霰弹枪（CS 风格：木泵 + 双管轮廓 + 弹仓管） ============
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

    // —— 喷嘴（锥形管口 + 引火器）——
    var nozzle = new T.Mesh(new T.CylinderGeometry(0.038, 0.028, 0.16, 10), M.gunmetal);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.015, -L * 0.42 - 0.08);
    nozzle.userData.part = 'barrel';
    g.add(nozzle);
    // 喷口帽（战术橙）
    var cap = new T.Mesh(new T.CylinderGeometry(0.044, 0.038, 0.04, 10), M.tacOrange);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, 0.015, -L * 0.42 - 0.18);
    cap.userData.part = 'barrel';
    g.add(cap);
    // 引火口（小管）
    var pilot = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.08, 6), M.bright);
    pilot.rotation.x = Math.PI / 2;
    pilot.position.set(0.02, 0.04, -L * 0.42 - 0.15);
    pilot.userData.part = 'barrel';
    g.add(pilot);

    // —— 连接管（喷嘴到罐体）——
    var pipe = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 0.2, 8), M.chrome);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(0, -0.02, -L * 0.42 - 0.02);
    g.add(pipe);

    // —— 双燃料罐（主罐 + 副罐，CS 风格圆筒造型）——
    var tankMain = new T.Mesh(new T.CylinderGeometry(0.085, 0.085, 0.24, 12), M.tacOrange);
    tankMain.rotation.x = Math.PI / 2;
    tankMain.position.set(-0.055, -0.06, -0.02);
    g.add(tankMain);
    // 罐体端盖
    var capA = new T.Mesh(new T.CylinderGeometry(0.087, 0.085, 0.025, 12), M.gunmetal);
    capA.rotation.x = Math.PI / 2;
    capA.position.set(-0.055, -0.06, 0.1);
    g.add(capA);
    var capB = new T.Mesh(new T.CylinderGeometry(0.087, 0.085, 0.025, 12), M.gunmetal);
    capB.rotation.x = Math.PI / 2;
    capB.position.set(-0.055, -0.06, -0.14);
    g.add(capB);

    // 副罐（钢色，稍小）
    var tankSub = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.2, 12), M.gunmetal);
    tankSub.rotation.x = Math.PI / 2;
    tankSub.position.set(0.06, -0.06, -0.02);
    g.add(tankSub);
    var capC = new T.Mesh(new T.CylinderGeometry(0.072, 0.07, 0.02, 12), M.bright);
    capC.rotation.x = Math.PI / 2;
    capC.position.set(0.06, -0.06, 0.1);
    g.add(capC);

    // 阀门（黄铜）
    var valve = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, 0.04, 8), M.brass);
    valve.rotation.z = Math.PI / 2;
    valve.position.set(-0.02, 0.02, -0.02);
    g.add(valve);
    // 阀轮
    var wheel = new T.Mesh(new T.TorusGeometry(0.016, 0.005, 6, 8), M.brass);
    wheel.position.set(0.0, 0.02, -0.02);
    g.add(wheel);

    // —— 气压表 ——
    var gauge = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.01, 8), M.bright);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0.035, 0.02, -L * 0.25);
    g.add(gauge);
    var gaugeFace = new T.Mesh(new T.CircleGeometry(0.014, 8), new T.MeshBasicMaterial({ color: 0x111111 }));
    gaugeFace.position.set(0.035, 0.02, -L * 0.25 - 0.006);
    gaugeFace.rotation.y = Math.PI / 2;
    g.add(gaugeFace);

    // —— 肩托（前移）——
    var brace = new T.Mesh(new T.BoxGeometry(0.05, 0.07, 0.1), M.gunmetal);
    brace.position.set(0, 0.015, -0.04);
    brace.userData.part = 'stock';
    g.add(brace);
    var pad = new T.Mesh(new T.BoxGeometry(0.052, 0.075, 0.02), M.rubber);
    pad.position.set(0, 0.015, 0.01);
    pad.userData.part = 'stock';
    g.add(pad);

    // —— 握把 + 扳机 ——
    var grip = new T.Mesh(new T.BoxGeometry(0.046, 0.1, 0.05), M.polymer);
    grip.position.set(0, -0.09, -L * 0.18);
    grip.rotation.x = 0.18;
    g.add(grip);
    addGripTexture(g, T, M, 0.025, -0.05, -L * 0.18 + 0.025, 4, 2, M.rubber);
    addGripTexture(g, T, M, -0.025, -0.05, -L * 0.18 + 0.025, 4, 2, M.rubber);
    var guard = new T.Mesh(new T.TorusGeometry(0.02, 0.005, 6, 10, Math.PI), M.gunmetal);
    guard.position.set(0, -0.025, -L * 0.18 - 0.04);
    guard.rotation.x = Math.PI / 2;
    g.add(guard);

    return anim;
  }

  // ============ AWP 狙击（CS 风格：长枪管 + 消音器 + 大倍率镜 + 两脚架 + 战术枪托） ============
  function buildSniper(g, M, T, st) {
    var L = st.len;
    var anim = { mag: null, pump: null, bolt: null, tube: null };

    // —— 长枪管 ——
    var barrel = new T.Mesh(new T.CylinderGeometry(0.015, 0.017, st.barrelLen + 0.06, 10), M.chrome);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.012, -L * 0.38 - 0.08 - (st.barrelLen + 0.06) / 2);
    barrel.userData.part = 'barrel';
    g.add(barrel);
    // 枪管喉部
    var barrelH = new T.Mesh(new T.CylinderGeometry(0.024, 0.017, 0.04, 10), M.gunmetal);
    barrelH.rotation.x = Math.PI / 2;
    barrelH.position.set(0, 0.012, -L * 0.38 - 0.08);
    barrelH.userData.part = 'barrel';
    g.add(barrelH);
    // 消音器（CS AWP 标志）
    var suppressor = new T.Mesh(new T.CylinderGeometry(0.026, 0.024, 0.12, 12), M.gunmetal);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.012, -L * 0.38 - 0.08 - (st.barrelLen + 0.06) - 0.06);
    suppressor.userData.part = 'barrel';
    g.add(suppressor);
    // 消音器纹理（环形槽）
    for (var si2 = 0; si2 < 6; si2++) {
      var ring = new T.Mesh(new T.CylinderGeometry(0.027, 0.027, 0.006, 12), M.bright);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.012, -L * 0.38 - 0.08 - (st.barrelLen + 0.06) - 0.02 - si2 * 0.018);
      ring.userData.part = 'barrel';
      g.add(ring);
    }

    // —— 机匣 ——
    var receiver = new T.Mesh(new T.BoxGeometry(0.058, 0.07, 0.18), M.gunmetal);
    receiver.position.set(0, 0.01, -L * 0.4);
    g.add(receiver);
    // 机匣顶部导轨（长）
    addRailTeeth(g, T, M, 0, 0.048, -L * 0.4 - 0.06, 0.18, 9, 0.05);

    // —— 战术枪托（CS 风格可调底板）——
    var stock = new T.Mesh(new T.BoxGeometry(0.05, 0.09, 0.16), M.polymer);
    stock.position.set(0, -0.012, -0.07);
    stock.userData.part = 'stock';
    g.add(stock);
    // 贴腮垫
    var cheek = new T.Mesh(new T.BoxGeometry(0.042, 0.025, 0.12), M.rubber);
    cheek.position.set(0, 0.035, -0.07);
    cheek.userData.part = 'stock';
    g.add(cheek);
    // 底板
    var butt = new T.Mesh(new T.BoxGeometry(0.052, 0.095, 0.015), M.rubber);
    butt.position.set(0, -0.012, 0.01);
    butt.userData.part = 'stock';
    g.add(butt);
    // 缓冲垫
    var pad = new T.Mesh(new T.BoxGeometry(0.05, 0.08, 0.01), M.fde);
    pad.position.set(0, -0.012, 0.018);
    pad.userData.part = 'stock';
    g.add(pad);

    // —— 大倍率瞄准镜（CS AWP 标志性长筒镜）——
    var scope = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.24, 12), M.gunmetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.075, -L * 0.44);
    g.add(scope);
    // 镜筒前后端
    var scopeFront = new T.Mesh(new T.CylinderGeometry(0.035, 0.028, 0.03, 12), M.gunmetal);
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.position.set(0, 0.075, -L * 0.44 - 0.13);
    g.add(scopeFront);
    var scopeRear = new T.Mesh(new T.CylinderGeometry(0.032, 0.028, 0.025, 12), M.gunmetal);
    scopeRear.rotation.x = Math.PI / 2;
    scopeRear.position.set(0, 0.075, -L * 0.44 + 0.13);
    g.add(scopeRear);
    // 遮光罩
    var sunshade = new T.Mesh(new T.CylinderGeometry(0.03, 0.035, 0.04, 12), M.bright);
    sunshade.rotation.x = Math.PI / 2;
    sunshade.position.set(0, 0.075, -L * 0.44 - 0.16);
    g.add(sunshade);
    // 透镜
    var lens = new T.Mesh(new T.CircleGeometry(0.026, 12), M.lens);
    lens.rotation.y = Math.PI / 2;
    lens.position.set(0, 0.075, -L * 0.44 - 0.14);
    g.add(lens);
    // 镜架环
    for (var rsi = 0; rsi < 2; rsi++) {
      var sr = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.015, 8), M.bright);
      sr.rotation.x = Math.PI / 2;
      sr.position.set(0, 0.075, -L * 0.44 - 0.06 + rsi * 0.12);
      g.add(sr);
    }
    // 镜上调节旋钮
    var knob = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.018, 8), M.bright);
    knob.position.set(0, 0.108, -L * 0.44);
    g.add(knob);

    // —— 拉机柄（右侧，球状把手）——
    var bolt = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.05, 6), M.chrome);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0.04, 0.035, -L * 0.4 + 0.05);
    g.add(bolt);
    var boltKnob = new T.Mesh(new T.SphereGeometry(0.013, 6, 5), M.bright);
    boltKnob.position.set(0.052, 0.035, -L * 0.4 + 0.05);
    g.add(boltKnob);
    anim.bolt = bolt;

    // —— 握把 + 弹匣 ——
    var grip = new T.Mesh(new T.BoxGeometry(0.04, 0.08, 0.045), M.polymer);
    grip.position.set(0, -0.08, -L * 0.4 + 0.01);
    grip.rotation.x = 0.2;
    g.add(grip);
    addGripTexture(g, T, M, 0.022, -0.045, -L * 0.4 + 0.015, 3, 2, M.rubber);
    addGripTexture(g, T, M, -0.022, -0.045, -L * 0.4 + 0.015, 3, 2, M.rubber);
    var mag = new T.Mesh(new T.BoxGeometry(0.034, 0.055, 0.045), M.gunmetal);
    mag.position.set(0, -0.1, -L * 0.4 - 0.01);
    mag.rotation.x = 0.06;
    g.add(mag);
    anim.mag = mag;

    // —— 两脚架（折叠状态，贴枪管）——
    for (var bi2 = 0; bi2 < 2; bi2++) {
      var leg = new T.Mesh(new T.CylinderGeometry(0.005, 0.004, 0.08, 5), M.gunmetal);
      leg.position.set((bi2 === 0 ? -0.03 : 0.03), -0.02, -L * 0.38 - 0.18);
      leg.rotation.x = -0.3;
      leg.rotation.z = (bi2 === 0 ? 0.2 : -0.2);
      leg.userData.part = 'barrel';
      g.add(leg);
    }

    // —— 扳机护圈 ——
    var guard = new T.Mesh(new T.TorusGeometry(0.018, 0.005, 6, 10, Math.PI), M.gunmetal);
    guard.position.set(0, -0.022, -L * 0.4 - 0.02);
    guard.rotation.x = Math.PI / 2;
    g.add(guard);

    return anim;
  }

  // ============ 火箭筒（CS 风格：粗发射管 + 喇叭口 + 光学瞄具 + 肩垫） ============
  function buildRocket(g, M, T, st) {
    var L = st.len;
    var anim = { mag: null, pump: null, bolt: null, tube: null };

    // —— 主发射管 ——
    var tube = new T.Mesh(new T.CylinderGeometry(0.05, 0.048, L * 0.92, 12), M.gunmetal);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.0, -L * 0.55);
    tube.userData.part = 'barrel';
    g.add(tube);
    // 管体纹理环（CS 风格段纹）
    for (var ti2 = 0; ti2 < 4; ti2++) {
      var tring = new T.Mesh(new T.CylinderGeometry(0.052, 0.052, 0.008, 12), M.bright);
      tring.rotation.x = Math.PI / 2;
      tring.position.set(0, 0, -L * 0.2 - ti2 * L * 0.18);
      tring.userData.part = 'barrel';
      g.add(tring);
    }

    // —— 喇叭口 ——
    var flare = new T.Mesh(new T.CylinderGeometry(0.08, 0.05, 0.1, 12), M.gunmetal);
    flare.rotation.x = Math.PI / 2;
    flare.position.set(0, 0.0, -L * 0.55 - 0.1);
    flare.userData.part = 'barrel';
    g.add(flare);
    // 喇叭口内圈
    var flareInner = new T.Mesh(new T.CylinderGeometry(0.07, 0.04, 0.08, 12), M.polymer);
    flareInner.rotation.x = Math.PI / 2;
    flareInner.position.set(0, 0.0, -L * 0.55 - 0.09);
    flareInner.userData.part = 'barrel';
    g.add(flareInner);

    // —— 弹头/火箭弹（换弹动画）——
    var warhead = new T.Mesh(new T.CylinderGeometry(0.038, 0.024, 0.22, 10), M.tacOrange);
    warhead.rotation.x = Math.PI / 2;
    warhead.position.set(0, 0.0, -0.02);
    g.add(warhead);
    // 弹头尖端
    var warTip = new T.Mesh(new T.ConeGeometry(0.024, 0.06, 10), M.bright);
    warTip.rotation.x = -Math.PI / 2;
    warTip.position.set(0, 0.0, -0.15);
    g.add(warTip);
    anim.tube = warhead;

    // —— 握把（大手枪式，带扳机）——
    var grip = new T.Mesh(new T.BoxGeometry(0.07, 0.15, 0.075), M.polymer);
    grip.position.set(0, -0.11, -L * 0.42);
    grip.rotation.x = 0.14;
    g.add(grip);
    addGripTexture(g, T, M, 0.038, -0.07, -L * 0.42 + 0.02, 5, 3, M.rubber);
    addGripTexture(g, T, M, -0.038, -0.07, -L * 0.42 + 0.02, 5, 3, M.rubber);
    // 扳机
    var trigger = new T.Mesh(new T.BoxGeometry(0.012, 0.028, 0.008), M.polymer);
    trigger.position.set(0, -0.05, -L * 0.42 - 0.02);
    g.add(trigger);
    var guard = new T.Mesh(new T.TorusGeometry(0.02, 0.005, 6, 10, Math.PI), M.gunmetal);
    guard.position.set(0, -0.03, -L * 0.42 - 0.04);
    guard.rotation.x = Math.PI / 2;
    g.add(guard);

    // —— 光学瞄具 ——
    var scopeBase = new T.Mesh(new T.BoxGeometry(0.05, 0.02, 0.08), M.gunmetal);
    scopeBase.position.set(0, 0.055, -L * 0.36);
    g.add(scopeBase);
    var scope = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.1, 10), M.gunmetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.08, -L * 0.36);
    g.add(scope);
    // 瞄具透镜
    var scopeLens = new T.Mesh(new T.CircleGeometry(0.024, 10), M.lens);
    scopeLens.rotation.y = Math.PI / 2;
    scopeLens.position.set(0, 0.08, -L * 0.36 - 0.052);
    g.add(scopeLens);
    // 瞄具遮光罩
    var scopeHood = new T.Mesh(new T.CylinderGeometry(0.036, 0.032, 0.03, 10), M.bright);
    scopeHood.rotation.x = Math.PI / 2;
    scopeHood.position.set(0, 0.08, -L * 0.36 - 0.06);
    g.add(scopeHood);

    // —— 肩垫 ——
    var pad = new T.Mesh(new T.BoxGeometry(0.06, 0.045, 0.06), M.rubber);
    pad.position.set(0, -0.015, -0.05);
    pad.userData.part = 'stock';
    g.add(pad);
    var pad2 = new T.Mesh(new T.BoxGeometry(0.058, 0.04, 0.01), M.fde);
    pad2.position.set(0, -0.015, -0.02);
    pad2.userData.part = 'stock';
    g.add(pad2);

    // —— 前握把（战术风格）——
    var foregrip = new T.Mesh(new T.CylinderGeometry(0.02, 0.018, 0.08, 8), M.polymer);
    foregrip.position.set(0, -0.06, -L * 0.6);
    foregrip.rotation.x = 0.15;
    foregrip.userData.part = 'barrel';
    g.add(foregrip);

    return anim;
  }

  // v9.1 CS 风格双手持枪：右手握把 + 左手护木/弹匣
  function buildHands(g, T, type, anim) {
    var skin = new T.MeshLambertMaterial({ color: 0xd9a37f});
    var skin2 = new T.MeshLambertMaterial({ color: 0xc98d5f});
    var sleeve = new T.MeshLambertMaterial({ color: 0x2b303a});
    var glove = new T.MeshLambertMaterial({ color: 0x1a1c20});

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
