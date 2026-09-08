/**
 * sakura.js — 樱花树装饰模型（v9.2 重做：树干不错位 + 3层花冠完全覆盖）
 * 注册: window.MODELS.sakura
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var SIZE = { large: 1.5, medium: 1.0, small: 0.62 };

  var PETAL_COLORS = [
    0xffb7c5, 0xff9ebf, 0xffc0cb, 0xf8a4c4,
    0xffd1dc, 0xffbbaa, 0xffe4e9, 0xe88aa0
  ];

  global.MODELS.sakura = {
    name: 'sakura',

    create: function (config) {
      var T = global.THREE;
      var g = new T.Group();
      var cfg = config || {};
      var k = SIZE[cfg.variant] || SIZE.medium;

      var trunkMat  = new T.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.95, metalness: 0 });
      var branchMat = new T.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.9,  metalness: 0 });
      var darkMat   = new T.MeshStandardMaterial({ color: 0x3a2018, roughness: 1.0,   metalness: 0 });
      var petalMats = PETAL_COLORS.map(function (c) {
        return new T.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, flatShading: true });
      });

      var trunkH = 3.5 * k;

      // ===== 树干（直栈式，每段底部对齐上段顶部，不错位）=====
      var segH = trunkH / 3;
      var trunkTopX = 0, trunkTopZ = 0;
      for (var si = 0; si < 3; si++) {
        var rBot = 0.16 * k * (1 - si * 0.15);
        var rTop = 0.16 * k * (1 - (si + 1) * 0.15);
        var seg = new T.Mesh(new T.CylinderGeometry(rTop, rBot, segH, 7), si % 2 === 0 ? trunkMat : branchMat);
        // 微弯：每段向同方向偏移一点
        var offsetX = trunkTopX + Math.sin(si * 0.4) * 0.12 * k;
        seg.position.set(offsetX, si * segH + segH / 2, 0);
        seg.rotation.z = -Math.sin(si * 0.3) * 0.04;
        g.add(seg);
        trunkTopX = offsetX;
      }

      // ===== 树枝（隐藏在花冠内，仅做骨架）=====
      var branchTips = [];
      var branchCount = 6 + Math.floor(Math.random() * 3);
      for (var bi = 0; bi < branchCount; bi++) {
        var a = (bi / branchCount) * Math.PI * 2 + Math.random() * 0.4;
        var bLen = (1.0 + Math.random() * 0.5) * k;
        var bAng = 0.5 + Math.random() * 0.25;
        var bY = trunkH * (0.6 + Math.random() * 0.3);
        var bx = Math.cos(a) * bLen * Math.cos(bAng);
        var bz = Math.sin(a) * bLen * Math.cos(bAng);
        var by = bY + bLen * Math.sin(bAng);
        branchTips.push([bx + trunkTopX, by, bz]);

        // 单段树枝（简化，藏在花冠里）
        var midX = trunkTopX + (bx) * 0.5;
        var midZ = (bz) * 0.5;
        var midY = bY + (by - bY) * 0.5;
        var dx = bx + trunkTopX - trunkTopX;
        var branch = new T.Mesh(
          new T.CylinderGeometry(0.03 * k, 0.07 * k, bLen * 0.6, 5), branchMat
        );
        branch.position.set(midX, midY, midZ);
        branch.lookAt(new T.Vector3(bx + trunkTopX, by, bz));
        branch.rotateX(Math.PI / 2);
        g.add(branch);

        // 末端细枝
        var tip = new T.Mesh(
          new T.CylinderGeometry(0.015 * k, 0.03 * k, bLen * 0.4, 5), darkMat
        );
        tip.position.set(
          (midX + bx + trunkTopX) / 2,
          (midY + by) / 2,
          (midZ + bz) / 2
        );
        tip.lookAt(new T.Vector3(bx + trunkTopX, by, bz));
        tip.rotateX(Math.PI / 2);
        g.add(tip);
      }

      // ===== 3 层花冠（完全覆盖所有树枝）=====
      // 第1层（底层，最宽最大）
      buildCanopyLayer(g, T, petalMats, trunkTopX, trunkH, 2.2 * k, 0.5 * k, 1.0, k);
      // 第2层（中层）
      buildCanopyLayer(g, T, petalMats, trunkTopX, trunkH + 0.6 * k, 1.7 * k, 0.4 * k, 0.8, k);
      // 第3层（顶层，最小）
      buildCanopyLayer(g, T, petalMats, trunkTopX, trunkH + 1.1 * k, 1.2 * k, 0.3 * k, 0.6, k);

      // ===== 飘落花瓣粒子 =====
      var petalCount = 24;
      var petals = [];
      for (var pi = 0; pi < petalCount; pi++) {
        var pMat = new T.MeshBasicMaterial({
          color: PETAL_COLORS[pi % PETAL_COLORS.length],
          transparent: true, opacity: 0.85, depthWrite: false
        });
        var p = new T.Mesh(new T.PlaneGeometry(0.07 * k, 0.05 * k), pMat);
        p.visible = false;
        p.userData = {
          baseX: trunkTopX + (Math.random() - 0.5) * 3.5 * k,
          baseZ: (Math.random() - 0.5) * 3.5 * k,
          phase: Math.random() * Math.PI * 2,
          fallSpeed: 0.5 + Math.random() * 0.4,
          swayAmp: 0.12 + Math.random() * 0.15,
          rotSpeed: 0.5 + Math.random() * 0.8,
          lifeT: Math.random() * 7.0
        };
        g.add(p);
        petals.push(p);
      }

      g.userData = { kind: 'scenery', petals: petals, trunkH: trunkH + 1.4 * k, topX: trunkTopX };
      return g;
    },

    update: function (inst, dt) {
      var u = inst.userData;
      var petals = u.petals;
      if (!petals) return;
      var t = (u._t || 0) + dt;
      u._t = t;
      var canopyH = u.trunkH;
      var topX = u.topX || 0;
      petals.forEach(function (p) {
        var d = p.userData;
        d.lifeT += dt;
        var cycle = d.lifeT % 7.0;
        if (cycle < 0.15) {
          p.visible = true;
          p.position.set(d.baseX, canopyH * (0.6 + Math.random() * 0.35), d.baseZ);
          p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        } else if (cycle < 6.0) {
          p.position.y -= d.fallSpeed * dt;
          p.position.x = d.baseX + Math.sin(t * d.swayAmp * 3.0 + d.phase) * d.swayAmp;
          p.position.z = d.baseZ + Math.cos(t * d.swayAmp * 2.2 + d.phase) * d.swayAmp * 0.6;
          p.rotation.x += d.rotSpeed * dt;
          p.rotation.z += d.rotSpeed * 0.7 * dt;
        } else {
          p.visible = false;
        }
      });
      inst.rotation.z = Math.sin(t * 0.8) * 0.006;
      inst.rotation.x = Math.sin(t * 0.6 + 1.0) * 0.004;
    }
  };

  // 构建一层花冠：大量花球覆盖一个扁球形区域
  function buildCanopyLayer(g, T, petalMats, cx, cy, radius, height, density, k) {
    var clusterCount = Math.floor(14 * density) + 6;
    for (var i = 0; i < clusterCount; i++) {
      // 球面均匀分布
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);  // 0~PI
      var r = radius * (0.5 + Math.random() * 0.5);
      var x = cx + r * Math.sin(phi) * Math.cos(theta);
      var y = cy + height * Math.cos(phi) * (0.8 + Math.random() * 0.3);
      var z = r * Math.sin(phi) * Math.sin(theta);

      var cr = (0.3 + Math.random() * 0.25) * k;
      var pm = petalMats[Math.floor(Math.random() * petalMats.length)];
      var nSphere = 4 + Math.floor(Math.random() * 4);
      for (var ns = 0; ns < nSphere; ns++) {
        var sph = new T.Mesh(
          new T.IcosahedronGeometry(cr * (0.5 + Math.random() * 0.35), 1), pm
        );
        sph.position.set(
          x + (Math.random() - 0.5) * cr * 0.8,
          y + (Math.random() - 0.5) * cr * 0.7,
          z + (Math.random() - 0.5) * cr * 0.8
        );
        g.add(sph);
      }
    }
  }
})(window);
