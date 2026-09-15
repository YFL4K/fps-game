/**
 * watchtower.js — 木质瞭望塔（v11.2：增高 2 倍 + 螺旋楼梯 + 顶层加高 50%）
 * 注册: window.MODELS.watchtower
 * 平台顶面 PH=6.72（与 scene-layout 台阶/平台碰撞体对齐）。楼梯本身由 scene-layout 的
 *   climbOnly step 实体盘旋上升；本模型绘制中央立柱 + 螺旋扶手 + 四腿 + 平台 + 围栏 + 坡屋顶。
 * 顶层（平台面→屋顶）净高 = 2.25m（原 1.5m 的 1.5 倍），确保玩家可站立进入。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.watchtower = {
    name: 'watchtower',
    create: function (config) {
      const T = global.THREE;
      const R = global.ROUND;
      const g = new T.Group();
      const PH = 6.72;            // 平台顶面
      const TH = PH + 2.25;       // 上部立柱顶（屋顶底）——净高 2.25m
      const L = 1.35;             // 腿半距
      const SR = 2.0, SD = 24 * Math.PI / 180, N = 24;  // 螺旋参数（与 layout 一致）

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
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { strut(sx * L, 0, sz * L, sx * L, PH, sz * L, 0.16); rb(woodDark, 0.6, 0.24, 0.6, 0.07, sx * L, 0.12, sz * L); }
      // 中央立柱（螺旋楼梯绕其盘旋）
      strut(0, 0, 0, 0, TH, 0, 0.24, woodDark);
      // 腿间水平围檩 + 交叉斜撑（多层）
      for (const y of [1.6, 3.2, 4.8, 6.4]) {
        strut(-L, y, -L, L, y, -L, 0.07, woodDark); strut(-L, y, L, L, y, L, 0.07, woodDark);
        strut(-L, y, -L, -L, y, L, 0.07, woodDark); strut(L, y, -L, L, y, L, 0.07, woodDark);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        strut(sx * L, 0.4, sz * L, -sx * L, 3.2, sz * L, 0.05, woodDark);
        strut(sx * L, 3.6, sz * L, -sx * L, 6.4, sz * L, 0.05, woodDark);
      }

      // 螺旋扶手（每级台阶一根栏杆柱 + 顶部螺旋扶手）
      const RO = SR + 0.75;
      let px = RO * Math.sin(-SD), py = 0, pz = RO * Math.cos(-SD);
      for (let s = 0; s < N; s++) {
        const th = s * SD, bx = RO * Math.sin(th), bz = RO * Math.cos(th), base = 0.28 * (s + 1);
        strut(bx, base, bz, bx, base + 0.95, bz, 0.05, woodDark);   // 栏杆柱
        strut(px, py, pz, bx, base + 0.95, bz, 0.06, wood);         // 螺旋扶手段
        px = bx; py = base + 0.95; pz = bz;
      }

      // 平台地板（顶面 = PH）
      rb(wood, 3.2, 0.2, 3.2, 0.05, 0, PH - 0.1, 0);
      strut(-L, PH, -L, L, PH, L, 0.07, woodDark); strut(L, PH, -L, -L, PH, L, 0.07, woodDark);

      // 上部立柱（屋顶支撑）+ 围栏（+z 楼梯入口留缺口）
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) strut(sx * L, PH, sz * L, sx * L, TH, sz * L, 0.1);
      const RH = PH + 1.0;
      strut(-L, RH, -L, L, RH, -L, 0.06, woodDark);
      strut(-L, RH, -L, -L, RH, L, 0.06, woodDark);
      strut(L, RH, -L, L, RH, L, 0.06, woodDark);
      strut(-L, RH, L, -0.6, RH, L, 0.06, woodDark);
      strut(0.6, RH, L, L, RH, L, 0.06, woodDark);
      for (const sx of [-1, 1]) { strut(sx * L, PH, -L, sx * L, RH, -L, 0.05, woodDark); strut(sx * L, PH, L, sx * L, RH, L, 0.05, woodDark); }
      strut(-L, PH, -L, -L, RH, -L, 0.05, woodDark); strut(L, PH, -L, L, RH, -L, 0.05, woodDark);

      // 坡屋顶（出檐）
      const roof = new T.Mesh(new T.ConeGeometry(3.0, 1.3, 4), roofMat);
      roof.position.set(0, TH + 0.6, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
      rb(woodDark, 3.3, 0.14, 3.3, 0.03, 0, TH + 0.02, 0);

      g.userData = { kind: 'watchtower' };
      return g;
    }
  };
})(window);
