/**
 * watchtower.js — 木质瞭望塔（v11.5：再高 1 倍 + 螺旋楼梯 + 修复穿模）
 * 注册: window.MODELS.watchtower
 * 平台顶面 PH=13.44（与 scene-layout 台阶/平台碰撞体对齐）。
 * 楼梯由 scene-layout 的 climbOnly step 实体盘旋 2 圈上升，结束于 +z；
 *   本模型：四腿 + 交叉拉杆 + 中央立柱(仅到平台下方，避免塔顶穿模) + 平台 + 围栏(+z 入口缺口) + 坡屋顶。
 * 顶层净高 2.4m（平台→屋顶），玩家可站立移动。模型 collision:false，不可破坏。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.watchtower = {
    name: 'watchtower',
    create: function (config) {
      const T = global.THREE;
      const R = global.ROUND;
      const g = new T.Group();
      const PH = 13.44;          // 平台顶面
      const TH = PH + 2.4;       // 上部立柱顶（屋顶底）——净高 2.4m
      const L = 1.35;            // 腿半距

      const wood = new window.MARIO.mat({ color: 0x7a5230, roughness: 0.82 });
      const woodDark = new window.MARIO.mat({ color: 0x563a20, roughness: 0.85 });
      const roofMat = new window.MARIO.mat({ color: 0x4a3320, roughness: 0.8 });

      function rb(mat, w, h, d, r, x, y, z) { var m = new T.Mesh(R.roundedBox(w, h, d, r), mat); m.position.set(x, y, z); g.add(m); return m; }
      function strut(ax, ay, az, bx, by, bz, r, mat) {
        var a = new T.Vector3(ax, ay, az), b = new T.Vector3(bx, by, bz);
        var dir = b.clone().sub(a); var len = dir.length();
        var m = new T.Mesh(new T.CylinderGeometry(r, r, len, 8), mat || wood);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
        g.add(m); return m;
      }

      // 四腿 + 地脚
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { strut(sx * L, 0, sz * L, sx * L, PH, sz * L, 0.18); rb(woodDark, 0.7, 0.3, 0.7, 0.08, sx * L, 0.15, sz * L); }
      // 中央立柱：仅到平台下方（不穿过塔顶站立区，修复穿模）
      strut(0, 0, 0, 0, PH - 0.2, 0, 0.26, woodDark);
      // 多层水平围檩 + 交叉斜撑
      for (const y of [2.6, 5.2, 7.8, 10.4]) {
        strut(-L, y, -L, L, y, -L, 0.07, woodDark); strut(-L, y, L, L, y, L, 0.07, woodDark);
        strut(-L, y, -L, -L, y, L, 0.07, woodDark); strut(L, y, -L, L, y, L, 0.07, woodDark);
      }
      for (const sz of [-1, 1]) for (const seg of [0, 1, 2, 3]) {
        const y0 = 0.4 + seg * 2.6, y1 = y0 + 2.6;
        strut(-L, y0, sz * L, L, y1, sz * L, 0.05, woodDark);
        strut(L, y0, sz * L, -L, y1, sz * L, 0.05, woodDark);
      }

      // 平台地板（顶面 = PH，居中，与碰撞体对齐）
      rb(wood, 3.2, 0.2, 3.2, 0.05, 0, PH - 0.1, 0);
      strut(-L, PH, -L, L, PH, L, 0.07, woodDark); strut(L, PH, -L, -L, PH, L, 0.07, woodDark);

      // 上部立柱（屋顶支撑，位于四角，不挡中央）
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) strut(sx * L, PH, sz * L, sx * L, TH, sz * L, 0.1);
      // 围栏（+z 面留入口缺口，正对螺旋楼梯终点）
      const RH = PH + 1.0;
      strut(-L, RH, -L, L, RH, -L, 0.06, woodDark);          // 后
      strut(-L, RH, -L, -L, RH, L, 0.06, woodDark);          // 左
      strut(L, RH, -L, L, RH, L, 0.06, woodDark);            // 右
      strut(-L, RH, L, -0.7, RH, L, 0.06, woodDark);         // 前左段
      strut(0.7, RH, L, L, RH, L, 0.06, woodDark);           // 前右段（中间缺口）
      strut(-L, PH + 0.5, -L, L, PH + 0.5, -L, 0.05, woodDark);
      strut(-L, PH + 0.5, -L, -L, PH + 0.5, L, 0.05, woodDark);
      strut(L, PH + 0.5, -L, L, PH + 0.5, L, 0.05, woodDark);
      for (const sx of [-1, 1]) { strut(sx * L, PH, -L, sx * L, RH, -L, 0.05, woodDark); strut(sx * L, PH, L, sx * L, RH, L, 0.05, woodDark); }
      strut(-L, PH, -L, -L, RH, -L, 0.05, woodDark); strut(L, PH, -L, L, RH, -L, 0.05, woodDark);

      // 坡屋顶（出檐）
      const roof = new T.Mesh(new T.ConeGeometry(3.1, 1.5, 4), roofMat);
      roof.position.set(0, TH + 0.7, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
      rb(woodDark, 3.4, 0.16, 3.4, 0.03, 0, TH + 0.04, 0);

      g.userData = { kind: 'watchtower' };
      return g;
    }
  };
})(window);
