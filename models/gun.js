/**
 * gun.js — 第一人称枪械模型（程序化，挂在相机下，多武器类型）
 * 注册: window.MODELS.gun
 *
 * v7.9 全面重做（修复"枪械残缺、仅右键瞄准才正常"的 bug）：
 *   1. 根因：旧版枪托/肩垫等部件 z>0（位于相机后方），宽 FOV 下透视投影翻转 +
 *      屏幕边缘裁切 → 部件残缺/消失；右键瞄准（FOV 缩小）时才恢复。
 *   2. 修复：所有部件 z 严格 < 0（相机前方），整体前移 + 上抬 + 微缩，
 *      保证默认 FOV 75° 下全部落在视锥内（可配合主程序 gunClipTest 钩子验证 NDC）。
 *   3. 外观重做：参考 PSX / LowPoly 游戏枪械造型（低多边形、轮廓清晰、色块鲜明），
 *      六把枪（沙鹰 / AK-47 / 泵动霰弹 / 喷火器 / 狙击 / 火箭筒）全部重新布局建模。
 *   4. 材质提亮（低金属度 + 弱自发光），杜绝暗部发黑"贴图显示不全"。
 *
 * 主程序用法：
 * - camera.add(gunInst)；gunInst.position 由 userData.basePos 决定
 * - 开枪时设置 gunInst.userData.recoil = 1（后坐力 + 枪口闪光）
 * - gunInst.userData.muzzle 是枪口 Object3D（曳光弹起点）
 * - gunInst.userData.eject 是抛壳窗 Object3D（抛壳起点）
 * - 换弹时主程序调 gunInst.userData.beginReload(duration) 播放换弹动画
 * - update 由主程序通用实体循环调用
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  // v7.9：枪身整体前移（z 更浅）+ 上抬（y 更高），全部部件保持在相机前方视锥内
  var STYLES = {
    pistol: {
      bodyColor: 0x3a3f4a, accentColor: 0xd35400,
      len: 0.38, barrelLen: 0.2, pos: [0.24, -0.2, -0.38],
      scope: false, recoilKick: 1.0, casing: true
    },
    rifle: {
      bodyColor: 0x3a2f23, accentColor: 0x8b5a2b,
      len: 0.5, barrelLen: 0.26, pos: [0.26, -0.21, -0.4],
      scope: false, recoilKick: 0.75, casing: true
    },
    shotgun: {
      bodyColor: 0x3a2f23, accentColor: 0x6b4a2f,
      len: 0.54, barrelLen: 0.32, pos: [0.26, -0.22, -0.42],
      scope: false, recoilKick: 1.5, casing: true, pump: true
    },
    flamethrower: {
      bodyColor: 0x4a4a4a, accentColor: 0xff6600,
      len: 0.5, barrelLen: 0.4, pos: [0.26, -0.21, -0.4],
      scope: false, recoilKick: 0.8, casing: false
    },
    sniper: {
      bodyColor: 0x2b3550, accentColor: 0x1e90ff,
      len: 0.6, barrelLen: 0.34, pos: [0.24, -0.22, -0.42],
      scope: true, recoilKick: 2.2, casing: true
    },
    rocket: {
      bodyColor: 0x3a3a26, accentColor: 0xd4a017,
      len: 0.56, barrelLen: 0.32, pos: [0.26, -0.24, -0.42],
      scope: true, recoilKick: 3.4, casing: true, tubeReload: true
    }
  };

  // 通用小部件材料（v6.9 提亮；v7.9 保持低金属度 + 弱自发光，杜绝暗部发黑"残缺"）
  function mats(global) {
    const T = global.THREE;
    return {
      dark: new T.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.55, metalness: 0.35, emissive: 0x101214, emissiveIntensity: 0.35 }),
      accent: new T.MeshStandardMaterial({ color: 0xd35400, roughness: 0.5, metalness: 0.3, emissive: 0x301400, emissiveIntensity: 0.3 }),
      wood: new T.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.85, metalness: 0.05, emissive: 0x1a1006, emissiveIntensity: 0.2 }),
      woodDark: new T.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9, metalness: 0.02, emissive: 0x120c04, emissiveIntensity: 0.2 }),
      steel: new T.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.4, metalness: 0.5, emissive: 0x14161a, emissiveIntensity: 0.3 }),
      lens: new T.MeshBasicMaterial({ color: 0x66ccff })
    };
  }

  // 枪口喷火（多层锥形火焰，开火时脉冲）
  function buildMuzzleFlash(T, muzzlePos) {
    var flameGroup = new T.Group();
    flameGroup.position.copy(muzzlePos);
    flameGroup.rotation.x = -Math.PI / 2;  // 尖端朝前（-Z）
    var layers = [];
    var colors = [0xffe066, 0xffaa33, 0xff6633];
    for (var i = 0; i < 3; i++) {
      var cone = new T.Mesh(
        new T.ConeGeometry(0.03 + i * 0.018, 0.2 - i * 0.045, 6),
        new T.MeshBasicMaterial({ color: colors[i], transparent: true, opacity: 0, depthWrite: false })
      );
      cone.position.z = -0.06 - i * 0.035;
      cone.position.y = 0.015;
      flameGroup.add(cone);
      layers.push(cone);
    }
    flameGroup.visible = false;
    return { group: flameGroup, layers: layers };
  }

  // ============ 沙漠之鹰（PSX 风格：方正滑套 + 外露枪管 + 大握把） ============
  function buildDesertEagle(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 滑套（方正，收敛在前方）
    const slide = new T.Mesh(new T.BoxGeometry(0.07, 0.08, 0.2), M.dark);
    slide.position.set(0, 0.02, -L * 0.42 - 0.04);
    g.add(slide);
    // 顶部锯齿纹
    for (let i = 0; i < 3; i++) {
      const ser = new T.Mesh(new T.BoxGeometry(0.071, 0.012, 0.007), M.steel);
      ser.position.set(0, 0.07, -L * 0.42 - 0.06 - i * 0.035);
      g.add(ser);
    }
    // 外露枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, 0.11, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.005, -L * 0.42 - 0.18);
    g.add(barrel);
    // 枪口帽
    const muzzleRing = new T.Mesh(new T.CylinderGeometry(0.036, 0.036, 0.03, 8), M.dark);
    muzzleRing.rotation.x = Math.PI / 2;
    muzzleRing.position.set(0, -0.005, -L * 0.42 - 0.25);
    g.add(muzzleRing);
    // 大型握把（沙鹰标志，整体前移）
    const grip = new T.Mesh(new T.BoxGeometry(0.076, 0.15, 0.085), M.dark);
    grip.position.set(0, -0.095, -0.03);
    grip.rotation.x = 0.18;
    g.add(grip);
    // 握把防滑纹
    for (let i = 0; i < 3; i++) {
      const groove = new T.Mesh(new T.BoxGeometry(0.08, 0.01, 0.006), M.steel);
      groove.position.set(0, -0.045 - i * 0.04, 0.03);
      groove.rotation.x = 0.18;
      g.add(groove);
    }
    // 扳机护圈 + 扳机
    const guard = new T.Mesh(new T.BoxGeometry(0.08, 0.04, 0.015), M.steel);
    guard.position.set(0, -0.016, -0.09);
    g.add(guard);
    const trigger = new T.Mesh(new T.BoxGeometry(0.017, 0.032, 0.01), M.dark);
    trigger.position.set(0, -0.04, -0.11);
    g.add(trigger);
    // 击锤
    const hammer = new T.Mesh(new T.BoxGeometry(0.042, 0.042, 0.017), M.steel);
    hammer.position.set(0, 0.04, -0.015);
    hammer.rotation.x = -0.3;
    g.add(hammer);
    // 瞄具导轨 + 准星
    const rail = new T.Mesh(new T.BoxGeometry(0.045, 0.013, 0.09), M.steel);
    rail.position.set(0, 0.078, -L * 0.4 - 0.06);
    g.add(rail);
    const frontSight = new T.Mesh(new T.BoxGeometry(0.017, 0.028, 0.011), M.dark);
    frontSight.position.set(0, 0.072, -L * 0.42 - 0.22);
    g.add(frontSight);
    // 弹匣（换弹动画）
    const mag = new T.Mesh(new T.BoxGeometry(0.05, 0.08, 0.055), M.steel);
    mag.position.set(0, -0.145, -L * 0.42 - 0.03);
    mag.rotation.x = 0.1;
    g.add(mag);
    anim.mag = mag;
    return anim;
  }

  // ============ AK-47（PSX 风格：机匣 + 木护木 + 导气管 + 弧形弹匣 + 前移枪托） ============
  function buildAK47(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 机匣
    const receiver = new T.Mesh(new T.BoxGeometry(0.072, 0.085, 0.18), M.dark);
    receiver.position.set(0, 0.015, -L * 0.42 - 0.02);
    g.add(receiver);
    // 木质护木
    const handguard = new T.Mesh(new T.BoxGeometry(0.068, 0.07, 0.11), M.wood);
    handguard.position.set(0, -0.013, -L * 0.55 - 0.03);
    g.add(handguard);
    // 导气管
    const gasTube = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.2, 8), M.steel);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.052, -L * 0.57);
    g.add(gasTube);
    // 枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, st.barrelLen, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.0, -L * 0.42 - 0.1 - st.barrelLen / 2);
    g.add(barrel);
    // 准星 + 照门
    const frontSight = new T.Mesh(new T.BoxGeometry(0.02, 0.04, 0.016), M.dark);
    frontSight.position.set(0, 0.06, -L * 0.42 - st.barrelLen + 0.02);
    g.add(frontSight);
    const rearSight = new T.Mesh(new T.BoxGeometry(0.026, 0.032, 0.016), M.dark);
    rearSight.position.set(0, 0.06, -L * 0.42 - 0.12);
    g.add(rearSight);
    // 弧形弹匣（AK 标志，换弹动画）
    const mag = new T.Mesh(new T.BoxGeometry(0.052, 0.13, 0.08), M.accent);
    mag.position.set(0, -0.11, -L * 0.42 - 0.06);
    mag.rotation.x = -0.42;
    mag.rotation.z = 0.1;
    g.add(mag);
    anim.mag = mag;
    // 木质枪托（前移！旧版 z=+0.1 在相机后方导致残缺）
    const stock = new T.Mesh(new T.BoxGeometry(0.062, 0.085, 0.12), M.woodDark);
    stock.position.set(0, -0.005, -0.07);
    g.add(stock);
    // 握把
    const grip = new T.Mesh(new T.BoxGeometry(0.048, 0.095, 0.055), M.wood);
    grip.position.set(0, -0.095, -L * 0.42 + 0.0);
    grip.rotation.x = 0.24;
    g.add(grip);
    // 扳机护圈
    const guard = new T.Mesh(new T.BoxGeometry(0.052, 0.032, 0.013), M.steel);
    guard.position.set(0, -0.026, -L * 0.42 - 0.04);
    g.add(guard);
    // 拉机柄（换弹动画）
    const bolt = new T.Mesh(new T.BoxGeometry(0.019, 0.023, 0.045), M.steel);
    bolt.position.set(0.042, 0.042, -L * 0.42 + 0.03);
    g.add(bolt);
    anim.bolt = bolt;
    return anim;
  }

  // ============ 泵动霰弹枪（PSX 风格：泵动护木 + 双管轮廓 + 前移枪托） ============
  function buildShotgun(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 木质枪托（前移！）
    const stock = new T.Mesh(new T.BoxGeometry(0.062, 0.09, 0.12), M.woodDark);
    stock.position.set(0, -0.01, -0.06);
    g.add(stock);
    // 机匣
    const receiver = new T.Mesh(new T.BoxGeometry(0.068, 0.085, 0.14), M.steel);
    receiver.position.set(0, 0.0, -L * 0.36);
    g.add(receiver);
    // 枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, st.barrelLen + 0.06, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.028, -L * 0.36 - 0.07 - (st.barrelLen + 0.06) / 2);
    g.add(barrel);
    // 弹仓管
    const magTube = new T.Mesh(new T.CylinderGeometry(0.019, 0.019, st.barrelLen - 0.02, 8), M.dark);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.028, -L * 0.35 - (st.barrelLen - 0.02) / 2);
    g.add(magTube);
    // 泵动护木（换弹动画）
    const pump = new T.Mesh(new T.BoxGeometry(0.062, 0.08, 0.11), M.wood);
    pump.position.set(0, -0.005, -L * 0.42 - 0.08);
    g.add(pump);
    anim.pump = pump;
    // 握把 + 护圈
    const grip = new T.Mesh(new T.BoxGeometry(0.048, 0.095, 0.055), M.woodDark);
    grip.position.set(0, -0.095, -L * 0.36 + 0.0);
    grip.rotation.x = 0.22;
    g.add(grip);
    const guard = new T.Mesh(new T.BoxGeometry(0.052, 0.032, 0.013), M.steel);
    guard.position.set(0, -0.024, -L * 0.36 - 0.04);
    g.add(guard);
    // 前端准星
    const bead = new T.Mesh(new T.SphereGeometry(0.01, 5, 4), M.accent);
    bead.position.set(0, 0.052, -L * 0.36 - 0.07 - (st.barrelLen + 0.06));
    g.add(bead);
    return anim;
  }

  // ============ 栓动狙击（PSX 风格：长枪管 + 高倍镜 + 前移枪托） ============
  function buildSniper(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 长枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.017, 0.017, st.barrelLen + 0.05, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.018, -L * 0.4 - 0.07 - (st.barrelLen + 0.05) / 2);
    g.add(barrel);
    // 机匣
    const receiver = new T.Mesh(new T.BoxGeometry(0.062, 0.08, 0.17), M.dark);
    receiver.position.set(0, 0.01, -L * 0.42);
    g.add(receiver);
    // 枪托（带贴腮板，前移！）
    const stock = new T.Mesh(new T.BoxGeometry(0.062, 0.1, 0.14), M.woodDark);
    stock.position.set(0, -0.018, -0.08);
    g.add(stock);
    const cheek = new T.Mesh(new T.BoxGeometry(0.052, 0.032, 0.1), M.wood);
    cheek.position.set(0, 0.038, -0.08);
    g.add(cheek);
    // 高倍镜
    const scope = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.2, 10), M.dark);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.075, -L * 0.48);
    g.add(scope);
    const scopeFront = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, 0.04, 10), M.dark);
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.position.set(0, 0.075, -L * 0.48 - 0.12);
    g.add(scopeFront);
    const lens = new T.Mesh(new T.CircleGeometry(0.03, 10), M.lens);
    lens.rotation.y = Math.PI / 2;
    lens.position.set(0, 0.075, -L * 0.48 - 0.1);
    g.add(lens);
    for (let i = 0; i < 2; i++) {
      const ring = new T.Mesh(new T.CylinderGeometry(0.042, 0.042, 0.016, 8), M.steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.075, -L * 0.48 - 0.05 + i * 0.09);
      g.add(ring);
    }
    // 拉机柄（换弹动画）
    const bolt = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 0.06, 6), M.steel);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(0.038, 0.047, -L * 0.42 + 0.03);
    g.add(bolt);
    const boltKnob = new T.Mesh(new T.SphereGeometry(0.016, 6, 5), M.steel);
    boltKnob.position.set(0.042, 0.042, -L * 0.42 + 0.06);
    g.add(boltKnob);
    anim.bolt = bolt;
    // 握把 + 弹匣
    const grip = new T.Mesh(new T.BoxGeometry(0.042, 0.09, 0.05), M.dark);
    grip.position.set(0, -0.09, -L * 0.4);
    grip.rotation.x = 0.22;
    g.add(grip);
    const mag = new T.Mesh(new T.BoxGeometry(0.036, 0.06, 0.05), M.accent);
    mag.position.set(0, -0.1, -L * 0.38);
    mag.rotation.x = 0.08;
    g.add(mag);
    anim.mag = mag;
    return anim;
  }

  // ============ 喷火器（PSX 风格：粗喷嘴 + 双燃料罐） ============
  function buildFlamethrower(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 粗喷嘴
    const nozzle = new T.Mesh(new T.CylinderGeometry(0.042, 0.03, st.barrelLen, 8), M.dark);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.01, -L * 0.45 - st.barrelLen / 2);
    g.add(nozzle);
    // 喷口帽
    const cap = new T.Mesh(new T.CylinderGeometry(0.047, 0.042, 0.04, 8), M.accent);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, 0.01, -L * 0.45 - st.barrelLen - 0.02);
    g.add(cap);
    // 双燃料罐（前移）
    const tankA = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.2, 10), M.accent);
    tankA.rotation.x = Math.PI / 2;
    tankA.position.set(-0.06, -0.08, -0.04);
    g.add(tankA);
    const tankB = new T.Mesh(new T.CylinderGeometry(0.082, 0.082, 0.17, 10), M.dark);
    tankB.rotation.x = Math.PI / 2;
    tankB.position.set(0.06, -0.08, -0.04);
    g.add(tankB);
    // 肩托（前移）
    const brace = new T.Mesh(new T.BoxGeometry(0.042, 0.08, 0.1), M.dark);
    brace.position.set(0, 0.02, -0.05);
    g.add(brace);
    // 握把 + 扳机
    const grip = new T.Mesh(new T.BoxGeometry(0.048, 0.1, 0.055), M.dark);
    grip.position.set(0, -0.1, -L * 0.18);
    grip.rotation.x = 0.2;
    g.add(grip);
    // 气压表
    const gauge = new T.Mesh(new T.CylinderGeometry(0.019, 0.019, 0.011, 8), M.steel);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0.038, 0.01, -L * 0.28);
    g.add(gauge);
    return anim;
  }

  // ============ 火箭筒（PSX 风格：粗发射管 + 喇叭口 + 弹头） ============
  function buildRocket(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    const tube = new T.Mesh(new T.CylinderGeometry(0.048, 0.048, L * 0.95, 10), M.dark);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.0, -L * 0.6);
    g.add(tube);
    const flare = new T.Mesh(new T.CylinderGeometry(0.078, 0.048, 0.1, 10), M.dark);
    flare.rotation.x = Math.PI / 2;
    flare.position.set(0, 0.0, -L * 0.6 - 0.1);
    g.add(flare);
    // 弹头（换弹动画：后抽再装入；整体在管口后方、相机前方）
    const warhead = new T.Mesh(new T.CylinderGeometry(0.042, 0.026, 0.24, 10), M.accent);
    warhead.rotation.x = Math.PI / 2;
    warhead.position.set(0, 0.0, -0.02);
    g.add(warhead);
    anim.tube = warhead;
    // 握把
    const grip = new T.Mesh(new T.BoxGeometry(0.076, 0.14, 0.08), M.dark);
    grip.position.set(0, -0.11, -L * 0.44);
    grip.rotation.x = 0.16;
    g.add(grip);
    // 光学瞄具
    const rscope = new T.Mesh(new T.CylinderGeometry(0.038, 0.038, 0.12, 10), M.dark);
    rscope.rotation.x = Math.PI / 2;
    rscope.position.set(0, 0.07, -L * 0.36);
    g.add(rscope);
    // 肩垫（前移！旧版 z=+0.09 在相机后方）
    const pad = new T.Mesh(new T.BoxGeometry(0.062, 0.042, 0.07), M.accent);
    pad.position.set(0, -0.018, -0.05);
    g.add(pad);
    return anim;
  }

  global.MODELS.gun = {
    name: 'gun',

    create: function (config) {
      const T = global.THREE;
      const type = (config && config.type) || 'pistol';
      const st = STYLES[type] || STYLES.pistol;
      const M = mats(global);
      const g = new T.Group();
      const L = st.len;

      var anim;
      if (type === 'rifle') anim = buildAK47(g, M, T, st);
      else if (type === 'shotgun') anim = buildShotgun(g, M, T, st);
      else if (type === 'sniper') anim = buildSniper(g, M, T, st);
      else if (type === 'flamethrower') anim = buildFlamethrower(g, M, T, st);
      else if (type === 'rocket') anim = buildRocket(g, M, T, st);
      else anim = buildDesertEagle(g, M, T, st);

      // 枪口锚点（曳光弹起点）
      const muzzle = new T.Object3D();
      muzzle.position.set(0, 0.02, -L * 0.45 - st.barrelLen - 0.05);
      g.add(muzzle);

      // 枪口喷火（v6.9 多层火焰）
      const flame = buildMuzzleFlash(T, muzzle.position);
      g.add(flame.group);

      // 抛壳锚点（右侧抛壳窗，v6.9）
      const eject = new T.Object3D();
      eject.position.set(0.06, 0.04, -L * 0.42);
      g.add(eject);

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
      const u = inst.userData;
      u.phase += dt;

      // 移动状态（决定晃动幅度）
      const p = (ctx && ctx.player) || null;
      const moving = p && p.vel && (Math.abs(p.vel.x) + Math.abs(p.vel.z)) > 0.1;

      // 后坐恢复 + 枪口喷火脉冲（kick 由武器类型决定）
      if (u.recoil > 0) {
        u.recoil -= dt * (u.kick * 4.2);
        const r = Math.max(0, u.recoil);
        const k = r * r;
        inst.position.z = u.basePos.z + Math.sin(r * Math.PI) * 0.09 * u.kick;
        inst.position.y = u.basePos.y + k * 0.045 * u.kick;
        inst.position.x = u.basePos.x + k * 0.025 * u.kick + (Math.random() - 0.5) * 0.004;
        inst.rotation.x = k * 0.07 * u.kick;
        inst.rotation.z = (Math.random() - 0.5) * 0.015 * u.kick;
        // 枪口火焰层：透明度随 recoil，尺寸抖动
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

      // 换弹动画：弹匣抽出/装入、泵动护木、拉机柄、火箭弹头（v6.9）
      if (u.reloading) {
        u.reloadT += dt;
        const pr = Math.min(1, u.reloadT / u.reloadDur);
        if (pr >= 1) u.reloading = false;
        inst.rotation.x += 0.07;   // 换弹时轻微低头看枪

        if (u.anim.mag && u.anim.mag.userData) {
          const bp = u.anim.mag.userData.basePos;
          var mp;
          if (pr < 0.28) mp = -0.15 * (pr / 0.28);
          else if (pr < 0.55) mp = -0.15;
          else if (pr < 0.8) mp = -0.15 + 0.15 * ((pr - 0.55) / 0.25);
          else mp = 0;
          u.anim.mag.position.y = bp.y + mp;
          u.anim.mag.position.z = bp.z + Math.abs(mp) * 0.2;
        }
        if (u.anim.pump && u.anim.pump.userData) {
          const bp2 = u.anim.pump.userData.basePos;
          var pp = 0;
          if (pr >= 0.15 && pr < 0.45) pp = 0.11 * Math.sin(((pr - 0.15) / 0.3) * Math.PI);
          else if (pr >= 0.45 && pr < 0.7) pp = -0.09 * Math.sin(((pr - 0.45) / 0.25) * Math.PI);
          u.anim.pump.position.z = bp2.z + pp;
        }
        if (u.anim.bolt && u.anim.bolt.userData) {
          const bp3 = u.anim.bolt.userData.basePos;
          var b3 = (pr >= 0.55 && pr < 0.8) ? 0.09 * Math.sin(((pr - 0.55) / 0.25) * Math.PI) : 0;
          u.anim.bolt.position.z = bp3.z + b3;
        }
        if (u.anim.tube && u.anim.tube.userData) {
          const bp4 = u.anim.tube.userData.basePos;
          var tp;
          if (pr < 0.35) tp = 0.12 * (pr / 0.35);
          else if (pr < 0.65) tp = 0.12;
          else tp = 0.12 * (1 - (pr - 0.65) / 0.35);
          u.anim.tube.position.z = bp4.z + tp;
        }
      }

      // 移动晃动 + 轻微呼吸
      const bob = moving ? 1 : 0.25;
      inst.position.x = u.basePos.x + Math.sin(u.phase * 8) * 0.004 * bob;
      inst.position.y = (u.recoil > 0 ? inst.position.y : u.basePos.y) + Math.cos(u.phase * 10) * 0.004 * bob;
    }
  };
})(window);
