/**
 * gun.js — 第一人称枪械模型（程序化，挂在相机下，多武器类型）
 * 注册: window.MODELS.gun
 *
 * v6.9 修复枪模残缺 + 新增动画：
 *   1. 紧凑化建模：所有部件收敛在相机视锥内（总长 ≤1.0m，防裁剪/残缺），材质提亮（低金属度+微自发光），杜绝暗部发黑
 *   2. 换弹夹动画：弹匣抽出/装入（霰弹=泵动护木、狙击=拉机柄、火箭筒=弹头后抽），由 ctx.player.reloading 自动驱动
 *   3. 枪口喷火动画：多层锥形火焰，开火时随 recoil 脉冲
 *   4. 抛壳锚点 eject：主程序开火时调用 spawnCasing 生成飞出的弹壳（喷火器除外）
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

  var STYLES = {
    pistol: {
      bodyColor: 0x3a3f4a, accentColor: 0xd35400,
      len: 0.42, barrelLen: 0.22, pos: [0.26, -0.24, -0.45],
      scope: false, recoilKick: 1.0, casing: true
    },
    rifle: {
      bodyColor: 0x3a2f23, accentColor: 0x8b5a2b,
      len: 0.62, barrelLen: 0.34, pos: [0.28, -0.26, -0.5],
      scope: false, recoilKick: 0.75, casing: true
    },
    shotgun: {
      bodyColor: 0x3a2f23, accentColor: 0x6b4a2f,
      len: 0.66, barrelLen: 0.4, pos: [0.28, -0.27, -0.5],
      scope: false, recoilKick: 1.5, casing: true, pump: true
    },
    flamethrower: {
      bodyColor: 0x4a4a4a, accentColor: 0xff6600,
      len: 0.58, barrelLen: 0.48, pos: [0.28, -0.25, -0.48],
      scope: false, recoilKick: 0.8, casing: false
    },
    sniper: {
      bodyColor: 0x2b3550, accentColor: 0x1e90ff,
      len: 0.78, barrelLen: 0.44, pos: [0.26, -0.27, -0.52],
      scope: true, recoilKick: 2.2, casing: true
    },
    rocket: {
      bodyColor: 0x3a3a26, accentColor: 0xd4a017,
      len: 0.7, barrelLen: 0.42, pos: [0.28, -0.3, -0.52],
      scope: true, recoilKick: 3.4, casing: true, tubeReload: true
    }
  };

  // 通用小部件材料（v6.9 提亮：低金属度 + 弱自发光，避免暗部发黑"残缺"）
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

  // ============ 沙漠之鹰 ============
  function buildDesertEagle(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 滑套（方正）
    const slide = new T.Mesh(new T.BoxGeometry(0.07, 0.08, 0.22), M.dark);
    slide.position.set(0, 0.02, -L * 0.42 - 0.02);
    g.add(slide);
    // 顶部锯齿纹
    for (let i = 0; i < 3; i++) {
      const ser = new T.Mesh(new T.BoxGeometry(0.071, 0.012, 0.007), M.steel);
      ser.position.set(0, 0.07, -L * 0.42 - 0.02 - i * 0.035);
      g.add(ser);
    }
    // 外露枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.13, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.005, -L * 0.42 - 0.17);
    g.add(barrel);
    // 枪口帽
    const muzzleRing = new T.Mesh(new T.CylinderGeometry(0.038, 0.038, 0.03, 8), M.dark);
    muzzleRing.rotation.x = Math.PI / 2;
    muzzleRing.position.set(0, -0.005, -L * 0.42 - 0.25);
    g.add(muzzleRing);
    // 大型握把（沙鹰标志）
    const grip = new T.Mesh(new T.BoxGeometry(0.078, 0.17, 0.09), M.dark);
    grip.position.set(0, -0.1, 0.02);
    grip.rotation.x = 0.2;
    g.add(grip);
    // 握把防滑纹
    for (let i = 0; i < 3; i++) {
      const groove = new T.Mesh(new T.BoxGeometry(0.082, 0.01, 0.006), M.steel);
      groove.position.set(0, -0.045 - i * 0.042, 0.08);
      groove.rotation.x = 0.2;
      g.add(groove);
    }
    // 扳机护圈 + 扳机
    const guard = new T.Mesh(new T.BoxGeometry(0.082, 0.045, 0.016), M.steel);
    guard.position.set(0, -0.018, -0.02);
    g.add(guard);
    const trigger = new T.Mesh(new T.BoxGeometry(0.018, 0.035, 0.01), M.dark);
    trigger.position.set(0, -0.042, -0.04);
    g.add(trigger);
    // 击锤
    const hammer = new T.Mesh(new T.BoxGeometry(0.045, 0.045, 0.018), M.steel);
    hammer.position.set(0, 0.04, 0.06);
    hammer.rotation.x = -0.35;
    g.add(hammer);
    // 瞄具导轨 + 准星
    const rail = new T.Mesh(new T.BoxGeometry(0.045, 0.014, 0.11), M.steel);
    rail.position.set(0, 0.082, -L * 0.4 - 0.02);
    g.add(rail);
    const frontSight = new T.Mesh(new T.BoxGeometry(0.018, 0.03, 0.012), M.dark);
    frontSight.position.set(0, 0.075, -L * 0.42 - 0.22);
    g.add(frontSight);
    // 弹匣（换弹动画）
    const mag = new T.Mesh(new T.BoxGeometry(0.055, 0.09, 0.06), M.steel);
    mag.position.set(0, -0.16, -L * 0.42 + 0.01);
    mag.rotation.x = 0.12;
    g.add(mag);
    anim.mag = mag;
    return anim;
  }

  // ============ AK-47 ============
  function buildAK47(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 机匣
    const receiver = new T.Mesh(new T.BoxGeometry(0.075, 0.09, 0.22), M.dark);
    receiver.position.set(0, 0.015, -L * 0.42 - 0.02);
    g.add(receiver);
    // 木质护木
    const handguard = new T.Mesh(new T.BoxGeometry(0.07, 0.075, 0.13), M.wood);
    handguard.position.set(0, -0.015, -L * 0.55 - 0.02);
    g.add(handguard);
    // 导气管
    const gasTube = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, 0.26, 8), M.steel);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.055, -L * 0.58);
    g.add(gasTube);
    // 枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, st.barrelLen, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.0, -L * 0.42 - 0.1 - st.barrelLen / 2);
    g.add(barrel);
    // 准星 + 照门
    const frontSight = new T.Mesh(new T.BoxGeometry(0.022, 0.045, 0.018), M.dark);
    frontSight.position.set(0, 0.065, -L * 0.42 - st.barrelLen + 0.03);
    g.add(frontSight);
    const rearSight = new T.Mesh(new T.BoxGeometry(0.028, 0.036, 0.018), M.dark);
    rearSight.position.set(0, 0.065, -L * 0.42 - 0.14);
    g.add(rearSight);
    // 弧形弹匣（AK 标志，换弹动画）
    const mag = new T.Mesh(new T.BoxGeometry(0.055, 0.16, 0.09), M.accent);
    mag.position.set(0, -0.13, -L * 0.42 - 0.05);
    mag.rotation.x = -0.5;
    mag.rotation.z = 0.12;
    g.add(mag);
    anim.mag = mag;
    // 木质枪托
    const stock = new T.Mesh(new T.BoxGeometry(0.065, 0.09, 0.19), M.woodDark);
    stock.position.set(0, -0.005, 0.1);
    g.add(stock);
    // 握把
    const grip = new T.Mesh(new T.BoxGeometry(0.05, 0.11, 0.06), M.wood);
    grip.position.set(0, -0.11, -L * 0.42 + 0.03);
    grip.rotation.x = 0.3;
    g.add(grip);
    // 扳机护圈
    const guard = new T.Mesh(new T.BoxGeometry(0.055, 0.035, 0.014), M.steel);
    guard.position.set(0, -0.03, -L * 0.42 - 0.03);
    g.add(guard);
    // 拉机柄（换弹动画）
    const bolt = new T.Mesh(new T.BoxGeometry(0.02, 0.025, 0.05), M.steel);
    bolt.position.set(0.045, 0.045, -L * 0.42 + 0.06);
    g.add(bolt);
    anim.bolt = bolt;
    return anim;
  }

  // ============ 泵动霰弹枪 ============
  function buildShotgun(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 木质枪托
    const stock = new T.Mesh(new T.BoxGeometry(0.065, 0.1, 0.18), M.woodDark);
    stock.position.set(0, -0.01, 0.12);
    g.add(stock);
    // 机匣
    const receiver = new T.Mesh(new T.BoxGeometry(0.07, 0.09, 0.17), M.steel);
    receiver.position.set(0, 0.0, -L * 0.38);
    g.add(receiver);
    // 枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.023, 0.023, st.barrelLen + 0.08, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -L * 0.38 - 0.08 - (st.barrelLen + 0.08) / 2);
    g.add(barrel);
    // 弹仓管
    const magTube = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, st.barrelLen - 0.03, 8), M.dark);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.03, -L * 0.36 - (st.barrelLen - 0.03) / 2);
    g.add(magTube);
    // 泵动护木（换弹动画）
    const pump = new T.Mesh(new T.BoxGeometry(0.065, 0.085, 0.14), M.wood);
    pump.position.set(0, -0.005, -L * 0.45 - 0.1);
    g.add(pump);
    anim.pump = pump;
    // 握把 + 护圈
    const grip = new T.Mesh(new T.BoxGeometry(0.05, 0.11, 0.06), M.woodDark);
    grip.position.set(0, -0.11, -L * 0.38 + 0.03);
    grip.rotation.x = 0.28;
    g.add(grip);
    const guard = new T.Mesh(new T.BoxGeometry(0.055, 0.035, 0.014), M.steel);
    guard.position.set(0, -0.025, -L * 0.38 - 0.03);
    g.add(guard);
    // 前端准星
    const bead = new T.Mesh(new T.SphereGeometry(0.011, 5, 4), M.accent);
    bead.position.set(0, 0.055, -L * 0.38 - 0.08 - (st.barrelLen + 0.08));
    g.add(bead);
    return anim;
  }

  // ============ 栓动狙击 ============
  function buildSniper(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 长枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, st.barrelLen + 0.06, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -L * 0.4 - 0.08 - (st.barrelLen + 0.06) / 2);
    g.add(barrel);
    // 机匣
    const receiver = new T.Mesh(new T.BoxGeometry(0.065, 0.085, 0.2), M.dark);
    receiver.position.set(0, 0.01, -L * 0.42);
    g.add(receiver);
    // 枪托（带贴腮板）
    const stock = new T.Mesh(new T.BoxGeometry(0.065, 0.11, 0.22), M.woodDark);
    stock.position.set(0, -0.02, 0.12);
    g.add(stock);
    const cheek = new T.Mesh(new T.BoxGeometry(0.055, 0.035, 0.14), M.wood);
    cheek.position.set(0, 0.04, 0.11);
    g.add(cheek);
    // 高倍镜
    const scope = new T.Mesh(new T.CylinderGeometry(0.034, 0.034, 0.24, 10), M.dark);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.08, -L * 0.48);
    g.add(scope);
    const scopeFront = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.045, 10), M.dark);
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.position.set(0, 0.08, -L * 0.48 - 0.14);
    g.add(scopeFront);
    const lens = new T.Mesh(new T.CircleGeometry(0.032, 10), M.lens);
    lens.rotation.y = Math.PI / 2;
    lens.position.set(0, 0.08, -L * 0.48 - 0.12);
    g.add(lens);
    for (let i = 0; i < 2; i++) {
      const ring = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.018, 8), M.steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.08, -L * 0.48 - 0.055 + i * 0.11);
      g.add(ring);
    }
    // 拉机柄（换弹动画）
    const bolt = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.07, 6), M.steel);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(0.04, 0.05, -L * 0.42 + 0.05);
    g.add(bolt);
    const boltKnob = new T.Mesh(new T.SphereGeometry(0.018, 6, 5), M.steel);
    boltKnob.position.set(0.045, 0.045, -L * 0.42 + 0.085);
    g.add(boltKnob);
    anim.bolt = bolt;
    // 握把 + 弹匣
    const grip = new T.Mesh(new T.BoxGeometry(0.045, 0.1, 0.055), M.dark);
    grip.position.set(0, -0.1, -L * 0.4);
    grip.rotation.x = 0.26;
    g.add(grip);
    const mag = new T.Mesh(new T.BoxGeometry(0.038, 0.07, 0.055), M.accent);
    mag.position.set(0, -0.12, -L * 0.38);
    mag.rotation.x = 0.1;
    g.add(mag);
    anim.mag = mag;
    // 脚架
    const bipodL = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.14, 5), M.steel);
    bipodL.position.set(-0.03, -0.15, -L * 0.28);
    bipodL.rotation.z = 0.5;
    g.add(bipodL);
    const bipodR = bipodL.clone();
    bipodR.position.x = 0.03;
    bipodR.rotation.z = -0.5;
    g.add(bipodR);
    return anim;
  }

  // ============ 喷火器 ============
  function buildFlamethrower(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    // 粗喷嘴
    const nozzle = new T.Mesh(new T.CylinderGeometry(0.045, 0.032, st.barrelLen, 8), M.dark);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.01, -L * 0.45 - st.barrelLen / 2);
    g.add(nozzle);
    // 喷口帽
    const cap = new T.Mesh(new T.CylinderGeometry(0.05, 0.045, 0.045, 8), M.accent);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, 0.01, -L * 0.45 - st.barrelLen - 0.02);
    g.add(cap);
    // 双燃料罐
    const tankA = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.24, 10), M.accent);
    tankA.rotation.x = Math.PI / 2;
    tankA.position.set(-0.065, -0.09, 0.05);
    g.add(tankA);
    const tankB = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.2, 10), M.dark);
    tankB.rotation.x = Math.PI / 2;
    tankB.position.set(0.065, -0.09, 0.05);
    g.add(tankB);
    // 肩托
    const brace = new T.Mesh(new T.BoxGeometry(0.045, 0.09, 0.14), M.dark);
    brace.position.set(0, 0.02, 0.13);
    g.add(brace);
    // 握把 + 扳机
    const grip = new T.Mesh(new T.BoxGeometry(0.05, 0.11, 0.06), M.dark);
    grip.position.set(0, -0.11, -L * 0.2);
    grip.rotation.x = 0.24;
    g.add(grip);
    // 气压表
    const gauge = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.012, 8), M.steel);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0.04, 0.01, -L * 0.3);
    g.add(gauge);
    return anim;
  }

  // ============ 火箭筒 ============
  function buildRocket(g, M, T, st) {
    const L = st.len;
    const anim = { mag: null, pump: null, bolt: null, tube: null };
    const tube = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, L * 1.05, 10), M.dark);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.0, -L * 0.68);
    g.add(tube);
    const flare = new T.Mesh(new T.CylinderGeometry(0.082, 0.05, 0.11, 10), M.dark);
    flare.rotation.x = Math.PI / 2;
    flare.position.set(0, 0.0, -L * 0.68 - 0.11);
    g.add(flare);
    // 弹头（换弹动画：后抽再装入）
    const warhead = new T.Mesh(new T.CylinderGeometry(0.045, 0.028, 0.28, 10), M.accent);
    warhead.rotation.x = Math.PI / 2;
    warhead.position.set(0, 0.0, L * 0.14);
    g.add(warhead);
    anim.tube = warhead;
    // 握把
    const grip = new T.Mesh(new T.BoxGeometry(0.08, 0.16, 0.09), M.dark);
    grip.position.set(0, -0.13, -L * 0.52);
    grip.rotation.x = 0.18;
    g.add(grip);
    // 光学瞄具
    const rscope = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.14, 10), M.dark);
    rscope.rotation.x = Math.PI / 2;
    rscope.position.set(0, 0.075, -L * 0.42);
    g.add(rscope);
    // 肩垫
    const pad = new T.Mesh(new T.BoxGeometry(0.065, 0.045, 0.09), M.accent);
    pad.position.set(0, -0.02, L * 0.09);
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
