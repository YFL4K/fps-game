/**
 * sakura.js — 樱花树装饰模型（v9.1 新增，替代椰子树 coconut）
 * 注册: window.MODELS.sakura
 *
 * 外观：深褐弯曲树干 + 伸展枝桠 + 粉色花簇（多色深浅樱花球）+ 飘落花瓣粒子。
 * 大/中/小三种尺寸由 config.variant（或 config.scale）控制。
 * 碰撞体：树干和主枝干参与碰撞（collision=true）。
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var SIZE = {
    large:  1.5,
    medium: 1.0,
    small:  0.62
  };

  // 樱花花瓣颜色表（多种粉色层次）
  var PETAL_COLORS = [
    0xffb7c5,  // 浅樱粉
    0xff9ebf,  // 樱粉
    0xffc0cb,  // 粉白
    0xf8a4c4,  // 深樱粉
    0xffd1dc,  // 淡粉
    0xffbbaa,  // 橙粉
    0xffe4e9,  // 极浅粉
    0xe88aa0   // 紫樱粉
  ];

  global.MODELS.sakura = {
    name: 'sakura',

    create: function (config) {
      var T = global.THREE;
      var g = new T.Group();
      var cfg = config || {};
      var k = SIZE[cfg.variant] || SIZE.medium;

      // — 材质 —
      var trunkMat  = new T.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.95, metalness: 0 });
      var branchMat = new T.MeshStandardMaterial({ color: 0x5a3a28, roughness: 0.9,  metalness: 0 });
      var darkMat   = new T.MeshStandardMaterial({ color: 0x3a2018, roughness: 1.0,   metalness: 0 });
      var petalMats = PETAL_COLORS.map(function (c) {
        return new T.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, flatShading: true });
      });

      var trunkH = 4.8 * k;

      // ===== 树干（3段微弯，上细下粗）=====
      var segs = 3;
      var y = 0;
      for (var si = 0; si < segs; si++) {
        var rBot = 0.18 * k * (1 - si * 0.18);
        var rTop = 0.18 * k * (1 - (si + 1) * 0.18);
        var segH = trunkH / segs;
        var seg  = new T.Mesh(new T.CylinderGeometry(rTop, rBot, segH, 7), si % 2 === 0 ? trunkMat : branchMat);
        var ox   = Math.sin(si * 0.45) * 0.35 * k;
        seg.position.set(ox, y + segH / 2, 0);
        seg.rotation.z = -Math.sin(si * 0.3) * 0.06;
        g.add(seg);
        y += segH;
      }

      // ===== 树枝（5~8 根斜向上伸出）=====
      var branchCount = 5 + Math.floor(Math.random() * 4);
      var branchTips = [];
      for (var bi = 0; bi < branchCount; bi++) {
        var a    = (bi / branchCount) * Math.PI * 2 + Math.random() * 0.6;
        var bLen = (1.1 + Math.random() * 0.7) * k;
        var bAng = 0.45 + Math.random() * 0.35;   // 仰角 26°~46°
        var bY   = trunkH * (0.52 + Math.random() * 0.42);
        var bend = Math.sin(bi * 1.7) * 0.25;

        var bx = Math.cos(a) * bLen * Math.cos(bAng);
        var bz = Math.sin(a) * bLen * Math.cos(bAng);
        var by = bY + bLen * Math.sin(bAng);
        branchTips.push([bx, by, bz]);

        // 树枝段（两段微弯）
        var midX = bx * 0.5 + bend;
        var midY = bY + (by - bY) * 0.55;
        var midZ = bz * 0.5;
        var branch1 = new T.Mesh(
          new T.CylinderGeometry(0.04 * k, 0.09 * k, bLen * 0.55, 5),
          branchMat
        );
        var dx1 = midX, dy1 = midY - bY / 2, dz1 = midZ;
        branch1.position.set(dx1, bY + dy1, dz1);
        branch1.lookAt(new T.Vector3(midX, midY, midZ));
        branch1.rotateX(Math.PI / 2);
        g.add(branch1);

        var branch2 = new T.Mesh(
          new T.CylinderGeometry(0.02 * k, 0.04 * k, bLen * 0.5, 5),
          darkMat
        );
        branch2.position.set(midX * 1.05, midY + (by - midY) * 0.5, midZ * 1.05);
        branch2.lookAt(new T.Vector3(bx, by, bz));
        branch2.rotateX(Math.PI / 2);
        g.add(branch2);
      }

      // ===== 花簇（每根树枝末端 + 树冠核心区多团）=====
      var clusterCount = 18 + Math.floor(Math.random() * 10);
      for (var ci = 0; ci < clusterCount; ci++) {
        var cx, cy, cz, cr;
        if (ci < branchTips.length && Math.random() > 0.3) {
          // 树枝顶端
          var tip = branchTips[ci % branchTips.length];
          cx = tip[0] + (Math.random() - 0.5) * 0.3 * k;
          cy = tip[1] + (Math.random() - 0.5) * 0.2 * k;
          cz = tip[2] + (Math.random() - 0.5) * 0.3 * k;
        } else {
          // 树冠随机分布
          var th = 0.55 + Math.random() * 0.45;   // 高度占比
          var tr = (0.4 + Math.random() * 0.6) * k;
          var ta = Math.random() * Math.PI * 2;
          cx = Math.cos(ta) * tr;
          cy = trunkH * th + (Math.random() - 0.5) * 0.3 * k;
          cz = Math.sin(ta) * tr;
        }
        cr = (0.28 + Math.random() * 0.32) * k;   // 花簇半径
        var pm = petalMats[ci % petalMats.length];
        // 每簇用 3~6 个小球拼成花团
        var nSphere = 3 + Math.floor(Math.random() * 4);
        for (var ns = 0; ns < nSphere; ns++) {
          var sph = new T.Mesh(new T.IcosahedronGeometry(cr * (0.55 + Math.random() * 0.3), 1), pm);
          sph.position.set(
            cx + (Math.random() - 0.5) * cr * 0.7,
            cy + (Math.random() - 0.5) * cr * 0.6,
            cz + (Math.random() - 0.5) * cr * 0.7
          );
          g.add(sph);
        }
      }

      // ===== 顶部嫩芽（浅粉）=====
      var topBud = new T.Mesh(new T.IcosahedronGeometry(0.22 * k, 1), petalMats[6]);
      topBud.position.y = trunkH + 0.1 * k;
      g.add(topBud);

      // ===== 下落花瓣粒子（每帧 update 驱动）=====
      var petalCount = 28;
      var petals = [];
      for (var pi = 0; pi < petalCount; pi++) {
        var pMat = new T.MeshBasicMaterial({
          color: PETAL_COLORS[pi % PETAL_COLORS.length],
          transparent: true, opacity: 0.85, depthWrite: false
        });
        var pGeo = new T.PlaneGeometry(0.08 * k, 0.06 * k);
        var p = new T.Mesh(pGeo, pMat);
        p.visible = false;
        p.userData = {
          baseX: (Math.random() - 0.5) * 3.0 * k,
          baseY: trunkH * (0.4 + Math.random() * 0.6),
          baseZ: (Math.random() - 0.5) * 3.0 * k,
          phase: Math.random() * Math.PI * 2,
          fallSpeed: 0.6 + Math.random() * 0.5,
          swayAmp: 0.15 + Math.random() * 0.2,
          rotSpeed: 0.5 + Math.random() * 1.0,
          lifeT: Math.random() * 6.0    // 初始相位错开
        };
        g.add(p);
        petals.push(p);
      }

      g.userData = { kind: 'scenery', petals: petals, trunkH: trunkH };
      return g;
    },

    update: function (inst, dt) {
      var u = inst.userData;
      var petals = u.petals;
      if (!petals) return;
      var t = (u._t || 0) + dt;
      u._t = t;
      var trunkH = u.trunkH;
      petals.forEach(function (p) {
        var d = p.userData;
        d.lifeT += dt;
        // 每 ~5 秒循环一次飘落
        var cycle = d.lifeT % 6.0;
        if (cycle < 0.15) {
          // 重生时机：重置到树冠附近
          p.visible = true;
          p.position.set(d.baseX, trunkH * (0.6 + Math.random() * 0.35), d.baseZ);
          p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        } else if (cycle < 5.0) {
          // 飘落中
          p.position.y -= d.fallSpeed * dt;
          p.position.x = d.baseX + Math.sin(t * d.swayAmp * 3.0 + d.phase) * d.swayAmp;
          p.position.z = d.baseZ + Math.cos(t * d.swayAmp * 2.2 + d.phase) * d.swayAmp * 0.6;
          p.rotation.x += d.rotSpeed * dt;
          p.rotation.z += d.rotSpeed * 0.7 * dt;
        } else {
          p.visible = false;
        }
      });
      // 树冠轻微摇摆（风）
      inst.rotation.z = Math.sin(t * 0.8) * 0.008;
      inst.rotation.x = Math.sin(t * 0.6 + 1.0) * 0.005;
    }
  };
})(window);
