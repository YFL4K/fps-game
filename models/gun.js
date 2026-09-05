/**
 * gun.js — 第一人称枪械模型（程序化，挂在相机下，多武器类型）
 * 注册: window.MODELS.gun
 *
 * v6.7 重做真实枪械外观：
 *   手枪   → 沙漠之鹰（沙鹰：方正滑套+大型握把+击锤+瞄具导轨）
 *   步枪   → AK-47（木护木+木枪托+弧形弹匣+导气管+准星）
 *   霰弹枪 → 泵动霰弹枪（木质枪托+泵动护木+枪管下弹仓）
 *   狙击枪 → 栓动狙击（长枪管+高倍镜+贴腮枪托）
 *   喷火器 → 双燃料罐+粗喷嘴
 *   火箭筒 → 粗发射管+喇叭口+弹头
 *
 * 主程序用法：
 * - camera.add(gunInst)；gunInst.position 由 userData.basePos 决定
 * - 开枪时设置 gunInst.userData.recoil = 1（后坐力 + 枪口闪光）
 * - gunInst.userData.muzzle 是枪口 Object3D，主程序用 getWorldPosition 生成曳光弹/火花
 * - config.type: 'pistol' | 'rifle' | 'shotgun' | 'sniper'，决定外观/尺寸/颜色/后坐
 * - update 由主程序通用实体循环调用（做后坐恢复 + 移动晃动 + 呼吸）
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var STYLES = {
    pistol: {
      bodyColor: 0x3a3f4a, accentColor: 0xd35400,
      len: 0.42, barrelLen: 0.26, pos: [0.28, -0.26, -0.5],
      scope: false, recoilKick: 1.0
    },
    rifle: {
      bodyColor: 0x3a2f23, accentColor: 0x8b5a2b,
      len: 0.66, barrelLen: 0.42, pos: [0.30, -0.30, -0.55],
      scope: false, recoilKick: 0.75
    },
    shotgun: {
      bodyColor: 0x3a2f23, accentColor: 0x6b4a2f,
      len: 0.7, barrelLen: 0.5, pos: [0.30, -0.31, -0.56],
      scope: false, recoilKick: 1.5
    },
    flamethrower: {
      bodyColor: 0x4a4a4a, accentColor: 0xff6600,
      len: 0.58, barrelLen: 0.55, pos: [0.30, -0.28, -0.52],
      scope: false, recoilKick: 0.8, tankSize: 0.12
    },
    sniper: {
      bodyColor: 0x2b3550, accentColor: 0x1e90ff,
      len: 0.82, barrelLen: 0.55, pos: [0.28, -0.32, -0.62],
      scope: true, recoilKick: 2.2
    },
    rocket: {
      bodyColor: 0x3a3a26, accentColor: 0xd4a017,
      len: 0.72, barrelLen: 0.5, pos: [0.30, -0.36, -0.6],
      scope: true, recoilKick: 3.4
    }
  };

  // 通用小部件材料
  function mats(global, st) {
    const T = global.THREE;
    return {
      dark: new T.MeshStandardMaterial({ color: st.bodyColor, roughness: 0.4, metalness: 0.7 }),
      accent: new T.MeshStandardMaterial({ color: st.accentColor, roughness: 0.5, metalness: 0.5 }),
      wood: new T.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.85, metalness: 0.05 }),
      woodDark: new T.MeshStandardMaterial({ color: 0x4e3018, roughness: 0.9, metalness: 0.02 }),
      steel: new T.MeshStandardMaterial({ color: 0x23262c, roughness: 0.35, metalness: 0.85 }),
      lens: new T.MeshBasicMaterial({ color: 0x66ccff })
    };
  }

  // ============ 沙漠之鹰 ============
  function buildDesertEagle(g, M, T, st) {
    const L = st.len;
    // 滑套（方正、带顶部锯齿纹）
    const slide = new T.Mesh(new T.BoxGeometry(0.075, 0.085, 0.24), M.dark);
    slide.position.set(0, 0.03, -L * 0.42 - 0.05);
    slide.castShadow = true;
    g.add(slide);
    for (let i = 0; i < 4; i++) {
      const serration = new T.Mesh(new T.BoxGeometry(0.076, 0.012, 0.006), M.steel);
      serration.position.set(0, 0.075, -L * 0.42 - 0.02 - i * 0.035);
      g.add(serration);
    }
    // 外露枪管（滑套前段下方）
    const barrel = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 0.16, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.01, -L * 0.42 - 0.2);
    g.add(barrel);
    // 枪口
    const muzzleRing = new T.Mesh(new T.CylinderGeometry(0.042, 0.042, 0.03, 8), M.dark);
    muzzleRing.rotation.x = Math.PI / 2;
    muzzleRing.position.set(0, -0.01, -L * 0.42 - 0.3);
    g.add(muzzleRing);
    // 大型握把（沙鹰标志性）
    const grip = new T.Mesh(new T.BoxGeometry(0.085, 0.22, 0.1), M.dark);
    grip.position.set(0, -0.13, 0.03);
    grip.rotation.x = 0.22;
    g.add(grip);
    // 握把防滑纹
    for (let i = 0; i < 4; i++) {
      const groove = new T.Mesh(new T.BoxGeometry(0.09, 0.01, 0.008), M.steel);
      groove.position.set(0, -0.06 - i * 0.04, 0.09);
      groove.rotation.x = 0.22;
      g.add(groove);
    }
    // 扳机护圈 + 扳机
    const guard = new T.Mesh(new T.BoxGeometry(0.09, 0.05, 0.02), M.steel);
    guard.position.set(0, -0.02, -0.02);
    guard.rotation.x = 0.1;
    g.add(guard);
    const trigger = new T.Mesh(new T.BoxGeometry(0.02, 0.04, 0.012), M.dark);
    trigger.position.set(0, -0.05, -0.045);
    trigger.rotation.x = 0.3;
    g.add(trigger);
    // 击锤
    const hammer = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.02), M.steel);
    hammer.position.set(0, 0.045, 0.08);
    hammer.rotation.x = -0.4;
    g.add(hammer);
    // 瞄具导轨 + 准星
    const rail = new T.Mesh(new T.BoxGeometry(0.05, 0.015, 0.12), M.steel);
    rail.position.set(0, 0.09, -L * 0.4 - 0.02);
    g.add(rail);
    const frontSight = new T.Mesh(new T.BoxGeometry(0.02, 0.035, 0.015), M.dark);
    frontSight.position.set(0, 0.085, -L * 0.42 - 0.26);
    g.add(frontSight);
  }

  // ============ AK-47 ============
  function buildAK47(g, M, T, st) {
    const L = st.len;
    // 机匣
    const receiver = new T.Mesh(new T.BoxGeometry(0.08, 0.095, 0.24), M.dark);
    receiver.position.set(0, 0.02, -L * 0.42 - 0.04);
    receiver.castShadow = true;
    g.add(receiver);
    // 木质护木（上下两片）
    const handguard = new T.Mesh(new T.BoxGeometry(0.075, 0.08, 0.14), M.wood);
    handguard.position.set(0, -0.01, -L * 0.55 - 0.02);
    g.add(handguard);
    // 导气管
    const gasTube = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.3, 8), M.steel);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.06, -L * 0.58);
    g.add(gasTube);
    // 枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.024, 0.024, st.barrelLen, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.0, -L * 0.42 - 0.12 - st.barrelLen / 2);
    g.add(barrel);
    // 准星 + 缺口照门
    const frontSight = new T.Mesh(new T.BoxGeometry(0.024, 0.05, 0.02), M.dark);
    frontSight.position.set(0, 0.075, -L * 0.42 - st.barrelLen + 0.02);
    g.add(frontSight);
    const rearSight = new T.Mesh(new T.BoxGeometry(0.03, 0.04, 0.02), M.dark);
    rearSight.position.set(0, 0.07, -L * 0.42 - 0.15);
    g.add(rearSight);
    // 弧形弹匣（AK 标志）
    const mag = new T.Mesh(new T.BoxGeometry(0.06, 0.18, 0.1), M.accent);
    mag.position.set(0, -0.14, -L * 0.42 - 0.06);
    mag.rotation.x = -0.55;
    mag.rotation.z = 0.12;
    g.add(mag);
    // 木质枪托
    const stock = new T.Mesh(new T.BoxGeometry(0.07, 0.1, 0.22), M.woodDark);
    stock.position.set(0, -0.005, 0.12);
    stock.rotation.x = -0.02;
    g.add(stock);
    // 手枪握把（木/棕）
    const grip = new T.Mesh(new T.BoxGeometry(0.055, 0.13, 0.07), M.wood);
    grip.position.set(0, -0.13, -L * 0.42 + 0.02);
    grip.rotation.x = 0.32;
    g.add(grip);
    // 扳机护圈
    const guard = new T.Mesh(new T.BoxGeometry(0.06, 0.04, 0.015), M.steel);
    guard.position.set(0, -0.035, -L * 0.42 - 0.02);
    g.add(guard);
  }

  // ============ 泵动霰弹枪 ============
  function buildShotgun(g, M, T, st) {
    const L = st.len;
    // 木质枪托
    const stock = new T.Mesh(new T.BoxGeometry(0.07, 0.11, 0.2), M.woodDark);
    stock.position.set(0, -0.01, 0.13);
    stock.rotation.x = -0.04;
    g.add(stock);
    // 机匣
    const receiver = new T.Mesh(new T.BoxGeometry(0.075, 0.1, 0.18), M.steel);
    receiver.position.set(0, 0.0, -L * 0.38);
    g.add(receiver);
    // 枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, st.barrelLen + 0.1, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.035, -L * 0.38 - 0.1 - (st.barrelLen + 0.1) / 2);
    g.add(barrel);
    // 弹仓管（枪管下方）
    const magTube = new T.Mesh(new T.CylinderGeometry(0.022, 0.022, st.barrelLen - 0.05, 8), M.dark);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.035, -L * 0.36 - (st.barrelLen - 0.05) / 2);
    g.add(magTube);
    // 泵动护木（木质）
    const pump = new T.Mesh(new T.BoxGeometry(0.07, 0.09, 0.16), M.wood);
    pump.position.set(0, -0.01, -L * 0.45 - 0.12);
    g.add(pump);
    // 握把 + 扳机护圈
    const grip = new T.Mesh(new T.BoxGeometry(0.055, 0.12, 0.07), M.woodDark);
    grip.position.set(0, -0.12, -L * 0.38 + 0.02);
    grip.rotation.x = 0.3;
    g.add(grip);
    const guard = new T.Mesh(new T.BoxGeometry(0.06, 0.04, 0.015), M.steel);
    guard.position.set(0, -0.03, -L * 0.38 - 0.02);
    g.add(guard);
    // 前端准星
    const bead = new T.Mesh(new T.SphereGeometry(0.012, 5, 4), M.accent);
    bead.position.set(0, 0.065, -L * 0.38 - 0.1 - (st.barrelLen + 0.1));
    g.add(bead);
  }

  // ============ 栓动狙击 ============
  function buildSniper(g, M, T, st) {
    const L = st.len;
    // 长枪管
    const barrel = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, st.barrelLen + 0.08, 8), M.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -L * 0.4 - 0.1 - (st.barrelLen + 0.08) / 2);
    g.add(barrel);
    // 机匣
    const receiver = new T.Mesh(new T.BoxGeometry(0.07, 0.09, 0.22), M.dark);
    receiver.position.set(0, 0.01, -L * 0.42);
    g.add(receiver);
    // 枪托（带贴腮板）
    const stock = new T.Mesh(new T.BoxGeometry(0.07, 0.12, 0.26), M.woodDark);
    stock.position.set(0, -0.02, 0.14);
    g.add(stock);
    const cheek = new T.Mesh(new T.BoxGeometry(0.06, 0.04, 0.16), M.wood);
    cheek.position.set(0, 0.045, 0.13);
    g.add(cheek);
    // 高倍镜（双环）
    const scope = new T.Mesh(new T.CylinderGeometry(0.038, 0.038, 0.26, 10), M.dark);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.085, -L * 0.48);
    g.add(scope);
    const scopeFront = new T.Mesh(new T.CylinderGeometry(0.028, 0.028, 0.05, 10), M.dark);
    scopeFront.rotation.x = Math.PI / 2;
    scopeFront.position.set(0, 0.085, -L * 0.48 - 0.15);
    g.add(scopeFront);
    const lens = new T.Mesh(new T.CircleGeometry(0.036, 10), M.lens);
    lens.rotation.y = Math.PI / 2;
    lens.position.set(0, 0.085, -L * 0.48 - 0.13);
    g.add(lens);
    // 镜环 ×2
    for (let i = 0; i < 2; i++) {
      const ring = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.02, 8), M.steel);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.085, -L * 0.48 - 0.06 + i * 0.12);
      g.add(ring);
    }
    // 握把 + 弹匣 + 脚架
    const grip = new T.Mesh(new T.BoxGeometry(0.05, 0.11, 0.06), M.dark);
    grip.position.set(0, -0.11, -L * 0.4);
    grip.rotation.x = 0.28;
    g.add(grip);
    const mag = new T.Mesh(new T.BoxGeometry(0.04, 0.08, 0.06), M.accent);
    mag.position.set(0, -0.13, -L * 0.38);
    g.add(mag);
    const bipodL = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.16, 5), M.steel);
    bipodL.position.set(-0.035, -0.18, -L * 0.3);
    bipodL.rotation.z = 0.5;
    g.add(bipodL);
    const bipodR = bipodL.clone();
    bipodR.position.x = 0.035;
    bipodR.rotation.z = -0.5;
    g.add(bipodR);
  }

  // ============ 喷火器 ============
  function buildFlamethrower(g, M, T, st) {
    const L = st.len;
    // 粗喷嘴
    const nozzle = new T.Mesh(new T.CylinderGeometry(0.05, 0.035, st.barrelLen, 8), M.dark);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.01, -L * 0.45 - st.barrelLen / 2);
    g.add(nozzle);
    // 喷口帽
    const cap = new T.Mesh(new T.CylinderGeometry(0.055, 0.05, 0.05, 8), M.accent);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, 0.01, -L * 0.45 - st.barrelLen - 0.02);
    g.add(cap);
    // 双燃料罐
    const tankA = new T.Mesh(new T.CylinderGeometry(st.tankSize, st.tankSize, 0.26, 10), M.accent);
    tankA.rotation.x = Math.PI / 2;
    tankA.position.set(-0.07, -0.1, 0.06);
    g.add(tankA);
    const tankB = new T.Mesh(new T.CylinderGeometry(st.tankSize * 0.85, st.tankSize * 0.85, 0.22, 10), M.dark);
    tankB.rotation.x = Math.PI / 2;
    tankB.position.set(0.07, -0.1, 0.06);
    g.add(tankB);
    // 肩托
    const brace = new T.Mesh(new T.BoxGeometry(0.05, 0.1, 0.16), M.dark);
    brace.position.set(0, 0.02, 0.14);
    g.add(brace);
    // 握把 + 扳机
    const grip = new T.Mesh(new T.BoxGeometry(0.055, 0.12, 0.07), M.dark);
    grip.position.set(0, -0.12, -L * 0.2);
    grip.rotation.x = 0.25;
    g.add(grip);
  }

  // ============ 火箭筒 ============
  function buildRocket(g, M, T, st) {
    const L = st.len;
    const tube = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, L * 1.1, 10), M.dark);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.0, -L * 0.7);
    g.add(tube);
    const flare = new T.Mesh(new T.CylinderGeometry(0.09, 0.055, 0.12, 10), M.dark);
    flare.rotation.x = Math.PI / 2;
    flare.position.set(0, 0.0, -L * 0.7 - 0.12);
    g.add(flare);
    const warhead = new T.Mesh(new T.CylinderGeometry(0.05, 0.03, 0.3, 10), M.accent);
    warhead.rotation.x = Math.PI / 2;
    warhead.position.set(0, 0.0, L * 0.15);
    g.add(warhead);
    const grip = new T.Mesh(new T.BoxGeometry(0.09, 0.18, 0.1), M.dark);
    grip.position.set(0, -0.15, -L * 0.55);
    grip.rotation.x = 0.2;
    g.add(grip);
    // 光学瞄具
    const rscope = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.16, 10), M.dark);
    rscope.rotation.x = Math.PI / 2;
    rscope.position.set(0, 0.08, -L * 0.45);
    g.add(rscope);
    // 肩垫
    const pad = new T.Mesh(new T.BoxGeometry(0.07, 0.05, 0.1), M.accent);
    pad.position.set(0, -0.02, L * 0.1);
    g.add(pad);
  }

  global.MODELS.gun = {
    name: 'gun',

    create: function (config) {
      const T = global.THREE;
      const type = (config && config.type) || 'pistol';
      const st = STYLES[type] || STYLES.pistol;
      const M = mats(global, st);
      const g = new T.Group();
      const L = st.len;

      if (type === 'rifle') buildAK47(g, M, T, st);
      else if (type === 'shotgun') buildShotgun(g, M, T, st);
      else if (type === 'sniper') buildSniper(g, M, T, st);
      else if (type === 'flamethrower') buildFlamethrower(g, M, T, st);
      else if (type === 'rocket') buildRocket(g, M, T, st);
      else buildDesertEagle(g, M, T, st);

      // 枪口锚点（曳光弹起点）—— 位置与旧版一致，保证射击逻辑不变
      const muzzle = new T.Object3D();
      muzzle.position.set(0, 0.02, -L * 0.45 - st.barrelLen - 0.05);
      g.add(muzzle);

      // 枪口闪光（击发时透明度脉冲）
      const flashMat = new T.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0 });
      const flash = new T.Mesh(new T.SphereGeometry(0.07, 6, 6), flashMat);
      flash.position.copy(muzzle.position);
      g.add(flash);

      g.userData = {
        type: type,
        muzzle: muzzle,
        flash: flash,
        flashMat: flashMat,
        recoil: 0,
        phase: 0,
        basePos: new T.Vector3(st.pos[0], st.pos[1], st.pos[2]),
        kick: st.recoilKick
      };
      return g;
    },

    update: function (inst, dt, ctx) {
      const u = inst.userData;
      u.phase += dt;

      // 移动状态（决定晃动幅度）
      const p = (ctx && ctx.player) || null;
      const moving = p && (Math.abs(p.vel.x) + Math.abs(p.vel.z)) > 0.1;

      // 后坐恢复 + 枪口闪光（kick 由武器类型决定）
      if (u.recoil > 0) {
        u.recoil -= dt * (u.kick * 4.2);
        const r = Math.max(0, u.recoil);
        const k = r * r;
        inst.position.z = u.basePos.z + Math.sin(r * Math.PI) * 0.09 * u.kick;
        inst.position.y = u.basePos.y + k * 0.045 * u.kick;
        inst.position.x = u.basePos.x + k * 0.025 * u.kick + (Math.random() - 0.5) * 0.004;
        inst.rotation.x = k * 0.07 * u.kick;
        inst.rotation.z = (Math.random() - 0.5) * 0.015 * u.kick;
        u.flashMat.opacity = Math.min(1, u.recoil * 2.5);
        u.flash.visible = true;
        u.flash.scale.setScalar(1 + k * 0.9);
      } else {
        inst.position.z = u.basePos.z;
        inst.rotation.x = 0;
        inst.rotation.z = 0;
        u.flashMat.opacity = 0;
        u.flash.visible = false;
        u.flash.scale.setScalar(1);
      }

      // 移动晃动（走路时明显）+ 轻微呼吸
      const bob = moving ? 1 : 0.25;
      inst.position.x = u.basePos.x + Math.sin(u.phase * 8) * 0.004 * bob;
      inst.position.y = (u.recoil > 0 ? inst.position.y : u.basePos.y) + Math.cos(u.phase * 10) * 0.004 * bob;
    }
  };
})(window);
