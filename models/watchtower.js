/**
 * watchtower.js — 木质瞭望塔（v11.1 新增）
 * 注册: window.MODELS.watchtower
 * 参考：四腿高脚木塔 + 交叉拉杆 + 顶部围栏平台 + 坡屋顶；侧面楼梯由 scene-layout 的
 *   step 实体提供（可攀爬碰撞体），本模型自身 collision:false 且不可破坏。
 * 平台顶面高度 PH=3.36，需与 layout 中台阶/平台碰撞体顶面对齐。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.watchtower = {
    name: 'watchtower',
    create: function (config) {
      const T = global.THREE;
      const R = global.ROUND;
      const g = new T.Group();
      const PH = 3.36;                 // 平台顶面高度（与碰撞台阶对齐）
      const L = 1.35;                  // 腿半距

      const wood = new window.MARIO.mat({ color: 0x7a5230, roughness: 0.82 });
      const woodDark = new window.MARIO.mat({ color: 0x563a20, roughness: 0.85 });
      const roofMat = new window.MARIO.mat({ color: 0x4a3320, roughness: 0.8 });

      function rb(mat, w, h, d, r, x, y, z) { var m = new T.Mesh(R.roundedBox(w, h, d, r), mat); m.position.set(x, y, z); g.add(m); return m; }
      function strut(mat, ax, ay, az, bx, by, bz, r) {
        var a = new T.Vector3(ax, ay, az), b = new T.Vector3(bx, by, bz);
        var dir = b.clone().sub(a); var len = dir.length();
        var m = new T.Mesh(new T.CylinderGeometry(r, r, len, 8), mat);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
        g.add(m); return m;
      }

      // 四腿
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) strut(wood, sx * L, 0, sz * L, sx * L, PH, sz * L, 0.14);
      // 底部地脚
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) rb(woodDark, 0.5, 0.2, 0.5, 0.06, sx * L, 0.1, sz * L);
      // 四面水平围檩 + 交叉斜撑
      for (const y of [1.1, 2.3]) {
        strut(woodDark, -L, y, -L, L, y, -L, 0.06);
        strut(woodDark, -L, y, L, L, y, L, 0.06);
        strut(woodDark, -L, y, -L, -L, y, L, 0.06);
        strut(woodDark, L, y, -L, L, y, L, 0.06);
      }
      strut(woodDark, -L, 0.3, -L, L, 2.9, -L, 0.05);
      strut(woodDark, L, 0.3, -L, -L, 2.9, -L, 0.05);
      strut(woodDark, -L, 0.3, L, L, 2.9, L, 0.05);
      strut(woodDark, L, 0.3, L, -L, 2.9, L, 0.05);

      // 平台地板
      rb(wood, 3.1, 0.18, 3.1, 0.05, 0, PH - 0.09, 0);
      // 平台下支撑
      strut(woodDark, -L, PH, -L, L, PH, L, 0.06);
      strut(woodDark, L, PH, -L, -L, PH, L, 0.06);

      // 上部立柱（屋顶支撑）
      const TH = PH + 1.5;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) strut(wood, sx * L, PH, sz * L, sx * L, TH, sz * L, 0.09);

      // 围栏（三面完整，+z 楼梯侧留缺口）
      const RH = PH + 0.95;
      strut(woodDark, -L, RH, -L, L, RH, -L, 0.06);           // 后
      strut(woodDark, -L, RH, -L, -L, RH, L, 0.06);           // 左
      strut(woodDark, L, RH, -L, L, RH, L, 0.06);             // 右
      strut(woodDark, -L, RH, L, -0.55, RH, L, 0.06);          // 前左段
      strut(woodDark, 0.55, RH, L, L, RH, L, 0.06);           // 前右段（中间留门）
      strut(woodDark, -L, PH + 0.5, -L, L, PH + 0.5, -L, 0.05);
      strut(woodDark, -L, PH + 0.5, -L, -L, PH + 0.5, L, 0.05);
      strut(woodDark, L, PH + 0.5, -L, L, PH + 0.5, L, 0.05);
      // 立柱竖杆
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) strut(woodDark, sx * L, PH, sz * L, sx * L, RH, sz * L, 0.05);

      // 坡屋顶（四棱锥，出檐）
      const roof = new T.Mesh(new T.ConeGeometry(2.7, 1.1, 4), roofMat);
      roof.position.set(0, TH + 0.5, 0);
      roof.rotation.y = Math.PI / 4;
      g.add(roof);
      rb(woodDark, 2.9, 0.12, 2.9, 0.03, 0, TH + 0.02, 0);    // 屋檐板

      g.userData = { kind: 'watchtower' };
      return g;
    }
  };
})(window);
