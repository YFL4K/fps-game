/**
 * gun.js — 第一人称枪械模型（程序化，挂在相机下，多武器类型）
 * 注册: window.MODELS.gun
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
      len: 0.4, barrelLen: 0.28, pos: [0.28, -0.26, -0.5],
      scope: false, recoilKick: 1.0
    },
    rifle: {
      bodyColor: 0x2e2e35, accentColor: 0x2e8b57,
      len: 0.62, barrelLen: 0.42, pos: [0.30, -0.30, -0.55],
      scope: false, recoilKick: 0.75
    },
    shotgun: {
      bodyColor: 0x4a3c2a, accentColor: 0x8b4513,
      len: 0.55, barrelLen: 0.5, pos: [0.30, -0.32, -0.5],
      scope: false, recoilKick: 1.8
    },
    sniper: {
      bodyColor: 0x2b3550, accentColor: 0x1e90ff,
      len: 0.8, barrelLen: 0.55, pos: [0.28, -0.32, -0.62],
      scope: true, recoilKick: 2.2
    }
  };

  global.MODELS.gun = {
    name: 'gun',

    create: function (config) {
      const T = global.THREE;
      const type = (config && config.type) || 'pistol';
      const st = STYLES[type] || STYLES.pistol;
      const g = new T.Group();

      const dark = new T.MeshStandardMaterial({ color: st.bodyColor, roughness: 0.4, metalness: 0.7 });
      const accent = new T.MeshStandardMaterial({ color: st.accentColor, roughness: 0.5, metalness: 0.5 });
      const L = st.len;

      // 枪身
      const body = new T.Mesh(new T.BoxGeometry(0.07, 0.12, L), dark);
      body.position.set(0, 0, -L * 0.45);
      body.castShadow = true;
      g.add(body);

      // 枪管
      const barrel = new T.Mesh(new T.CylinderGeometry(0.026, 0.026, st.barrelLen, 8), dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -L * 0.45 - st.barrelLen / 2);
      g.add(barrel);

      // 握把
      const grip = new T.Mesh(new T.BoxGeometry(0.06, 0.18, 0.08), dark);
      grip.position.set(0, -0.12, 0.02);
      grip.rotation.x = 0.2;
      g.add(grip);

      // 弹匣（颜色区分枪型）
      const mag = new T.Mesh(new T.BoxGeometry(0.05, 0.16, 0.09), accent);
      mag.position.set(0, -0.18, -0.08);
      mag.rotation.x = -0.1;
      g.add(mag);

      // 瞄具/准星
      const sight = new T.Mesh(new T.BoxGeometry(0.02, 0.04, 0.02), accent);
      sight.position.set(0, 0.07, -L * 0.3);
      g.add(sight);

      // 狙击镜（长管双筒造型）
      if (st.scope) {
        const scope = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.22, 10), dark);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.09, -L * 0.55);
        g.add(scope);
        const lens = new T.Mesh(
          new T.CircleGeometry(0.035, 10),
          new T.MeshBasicMaterial({ color: 0x66ccff })
        );
        lens.rotation.y = Math.PI / 2;
        lens.position.set(0, 0.09, -L * 0.55 - 0.11);
        g.add(lens);
      }

      // 枪口锚点（曳光弹起点）
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
