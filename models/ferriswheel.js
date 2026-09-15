/**
 * ferriswheel.js — 摩天轮模型（v11.1 重做：更精致的支架/双轮缘/16 辐条/圆润吊舱）
 * 注册: window.MODELS.ferriswheel
 * 配置: scale 缩放；update 驱动轮盘缓慢自转
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.ferriswheel = {
    name: 'ferriswheel',
    create: function (config) {
      const T = global.THREE;
      const R = global.ROUND;
      const g = new T.Group();
      const sc = config && config.scale;
      const s = Array.isArray(sc) ? (sc[0] || 1) : (sc || 1);

      const steel = new window.MARIO.mat({ color: 0x6a7688, metalness: 0.5, roughness: 0.45 });
      const beam = new window.MARIO.mat({ color: 0xd8542f });
      const hub = new window.MARIO.mat({ color: 0x3a4250 });
      const glassMat = new window.MARIO.mat({ color: 0x9fd4ff, emissive: 0x224455, emissiveIntensity: 0.3 });
      const cabinColors = [0xe0563a, 0x2f80c4, 0xf2c14e, 0x3aa76d, 0x9b59b6, 0xe67e22];

      const Rr = 7.0 * s;      // 轮盘半径
      const HUB = 13.5 * s;    // 轮心高度
      const AX = 1.6 * s;      // 轮盘半厚（两侧支架间距）

      function beamCyl(r1, r2, len, mat) { return new T.Mesh(new T.CylinderGeometry(r1 * s, r2 * s, len * s, 10), mat); }

      // ---- A 型支架 ×2（前后各一组，倒 V 支撑轮轴）+ 交叉拉杆 + 地基 ----
      for (let az = -1; az <= 1; az += 2) {
        for (let side = -1; side <= 1; side += 2) {
          const leg = beamCyl(0.16, 0.26, 15.5, steel);
          leg.position.set(side * 3.0 * s, HUB - 1.2 * s, az * AX);
          leg.rotation.z = -side * 0.22;
          g.add(leg);
        }
        // 横梁（两腿之间）
        const cross = beamCyl(0.1, 0.1, 6.0, beam);
        cross.rotation.z = Math.PI / 2;
        cross.position.set(0, 5.5 * s, az * AX);
        g.add(cross);
        // 斜撑
        const brace = beamCyl(0.07, 0.07, 8.0, steel);
        brace.position.set(0, 8.5 * s, az * AX);
        brace.rotation.z = 0.6;
        g.add(brace);
        const brace2 = brace.clone(); brace2.rotation.z = -0.6; g.add(brace2);
        // 地基墩
        for (let side = -1; side <= 1; side += 2) {
          const foot = new T.Mesh(R.roundedBox(1.1 * s, 0.6 * s, 1.1 * s, 0.12 * s), hub);
          foot.position.set(side * 3.7 * s, 0.3 * s, az * AX);
          g.add(foot);
        }
      }
      // 前后支架顶部连接（轮轴）
      const axle = beamCyl(0.14, 0.14, 3.4, steel);
      axle.rotation.x = Math.PI / 2;
      axle.position.set(0, HUB, 0);
      g.add(axle);

      // ---- 轮盘组（自转，绕 Z 轴）----
      const wheel = new T.Group();
      wheel.position.set(0, HUB, 0);

      // 双轮缘 + 中间薄环
      const rimA = new T.Mesh(new T.TorusGeometry(Rr, 0.13 * s, 10, 48), steel);
      rimA.position.z = 0.5 * s; wheel.add(rimA);
      const rimB = new T.Mesh(new T.TorusGeometry(Rr, 0.13 * s, 10, 48), steel);
      rimB.position.z = -0.5 * s; wheel.add(rimB);
      const rimMid = new T.Mesh(new T.TorusGeometry(Rr * 0.82, 0.07 * s, 8, 40), beam);
      wheel.add(rimMid);

      // 辐条 + 吊舱
      const spokes = 16;
      for (let i = 0; i < spokes; i++) {
        const ang = (i / spokes) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        // 辐条（中心到轮缘）
        const spoke = beamCyl(0.05, 0.05, Rr, steel);
        spoke.rotation.z = ang + Math.PI / 2;
        spoke.position.set(ca * Rr / 2, sa * Rr / 2, 0);
        wheel.add(spoke);
        // 交叉张力弦（相邻辐条间）
        const chord = beamCyl(0.025, 0.025, Rr * 0.55, hub);
        const a2 = ((i + 1) / spokes) * Math.PI * 2;
        chord.position.set((ca + Math.cos(a2)) * Rr / 2, (sa + Math.sin(a2)) * Rr / 2, 0);
        chord.rotation.z = (ang + a2) / 2;
        wheel.add(chord);

        // 吊舱（圆润盒 + 窗 + 顶 + 挂臂）
        const cabin = new T.Group();
        const cc = cabinColors[i % cabinColors.length];
        const cmat = new window.MARIO.mat({ color: cc });
        const hang = beamCyl(0.03, 0.03, 0.7, steel);
        hang.position.y = 0.35 * s; cabin.add(hang);
        const box = new T.Mesh(R.roundedBox(1.0 * s, 0.8 * s, 0.9 * s, 0.22 * s), cmat);
        cabin.add(box);
        const win = new T.Mesh(R.roundedBox(1.02 * s, 0.34 * s, 0.5 * s, 0.08 * s), glassMat);
        win.position.y = 0.08 * s; cabin.add(win);
        const roof = new T.Mesh(new T.SphereGeometry(0.62 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hub);
        roof.scale.set(0.85, 0.5, 0.78); roof.position.y = 0.42 * s; cabin.add(roof);
        cabin.position.set(ca * Rr, sa * Rr, 0);
        cabin.rotation.z = -ang;   // 吊舱保持水平
        wheel.add(cabin);
      }

      // 轮心毂
      const hubCyl = new T.Mesh(new T.CylinderGeometry(0.7 * s, 0.7 * s, 1.2 * s, 16), hub);
      hubCyl.rotation.x = Math.PI / 2; wheel.add(hubCyl);
      const hubcap = new T.Mesh(new T.SphereGeometry(0.55 * s, 14, 10), beam);
      wheel.add(hubcap);

      g.add(wheel);

      g.userData = { wheel: wheel, spin: (Math.random() - 0.5) * 0.15, phase: Math.random() * 6.28 };
      return g;
    },
    update: function (inst, dt, ctx) {
      const u = inst.userData;
      if (u.wheel) u.wheel.rotation.z += u.spin * dt * 0.6;
    }
  };
})(window);
