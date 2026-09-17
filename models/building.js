/**
 * building.js — 程序化建筑（v11.17 重做：多样造型 + 鲜艳多色 + 去方块感）
 * 注册: window.MODELS.building
 * 挂载点: 模型底部中心在原点（position.y = 地面高度）
 * config: w/d/h 尺寸；variant 0..4 造型（省略则随机）
 *
 * 造型库（全部走 ROUND.batcher 同材质烘焙 + 全局形状缓存，配合主程序 staticBatchMerge 进一步合批，
 * 单栋楼只按材质数出个位数网格，不掉帧）：
 *   0 人字顶小屋   1 两层阁楼   2 L形住宅   3 圆塔小屋   4 平房+门廊
 * 每种都带：底座裙边(避免盒子浮空感) + 圆角墙体 + 山墙/坡屋顶(挤出三棱) + 门框门板 +
 *   发光窗 + 窗框 + 烟囱/阳台/立柱等特征件，墙面与屋顶按调色板随机配色，彼此有别。
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  // 鲜艳墙面调色板（避免旧版 muddy 蓝灰）
  var WALLS = [0xd98b45, 0xe8dcc0, 0xc0563f, 0x6fb3a8, 0xd8b48a, 0xc98b8b, 0x8fa6c4, 0xe0c48a, 0x9fb37a, 0xcf6b4f, 0xefe7d6, 0x7a9e9f];
  var ROOFS = [0x5a2e2a, 0x3a3f47, 0x2f5d62, 0x6e4a2f, 0x8a3b2e, 0x40404a, 0x5d4a3a, 0x7a5230];
  var TRIM  = 0xf5f0e1;   // 暖白窗框/檐口
  var BASE  = 0x4a4038;   // 底座石裙

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // 三棱山墙屋顶几何：ridge 沿 X（坡面朝向 ±Z），带出檐 overhang
  function gableRoof(w, d, rise, overhang) {
    var T = global.THREE;
    var shape = new T.Shape();
    shape.moveTo(-(d / 2 + overhang), 0);
    shape.lineTo(d / 2 + overhang, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    var geo = new T.ExtrudeGeometry(shape, { depth: w + overhang * 2, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -(w + overhang * 2) / 2);
    geo.rotateY(Math.PI / 2);      // extrude 轴 -> 房屋 X（面宽）；shape X -> 房屋 Z（进深）
    geo.computeVertexNormals();
    return geo;
  }
  // 四坡金字塔屋顶（square-ish）：ridge 收成一点
  function hipRoof(w, d, rise) {
    var T = global.THREE;
    var geo = new T.ConeGeometry(0.5, rise, 4, 1);
    geo.rotateY(Math.PI / 4);
    geo.scale(w + 0.5, 1, d + 0.5);
    return geo;
  }

  global.MODELS.building = {
    name: 'building',
    create: function (config) {
      const T = global.THREE;
      const R = global.ROUND;
      const cfg = config || {};
      const w = cfg.w || 5;
      const d = cfg.d || 5;
      const h = cfg.h || 3.4;
      const variant = (typeof cfg.variant === 'number') ? cfg.variant : Math.floor(Math.random() * 5);

      const g = new T.Group();
      const wallHex = pick(WALLS);
      const roofHex = pick(ROOFS);

      const wallMat = new window.MARIO.matS({ color: wallHex, roughness: 0.7 });
      const wall2Mat = new window.MARIO.matS({ color: (variant % 2 ? roofHex : wallHex), roughness: 0.72 });  // 第二体块/侧翼，制造色差
      const roofMat = new window.MARIO.matS({ color: roofHex, roughness: 0.8 });
      const trimMat = new window.MARIO.matS({ color: TRIM });
      const baseMat = new window.MARIO.matS({ color: BASE, roughness: 0.9 });
      const doorMat = new window.MARIO.matS({ color: 0x5a3a20 });
      const winMat  = new window.MARIO.matS({ color: 0xffe9a8, emissive: 0xffcf6e, emissiveIntensity: 0.85 });
      const chimMat = new window.MARIO.matS({ color: 0x6b4a3a });
      const leafMat = new window.MARIO.matS({ color: 0x4f8f3a });

      const B = R.batcher();
      function box(p, mat, geo, x, y, z, rx, ry, rz, s) {
        var m = geo; B.add(p, m, mat, [x, y, z], (rx || ry || rz) ? [rx || 0, ry || 0, rz || 0] : null, s || null);
      }
      // 一个窗户：外框(略凸) + 发光玻璃
      function windowAt(matFrame, x, y, z, ry, ww, hh) {
        ww = ww || 0.7; hh = hh || 0.9;
        B.add(g, R.rbox(ww + 0.16, hh + 0.16, 0.12, 0.06), trimMat, [x, y, z], [0, ry, 0]);
        B.add(g, R.rbox(ww, hh, 0.16, 0.04), winMat, [x, y, z], [0, ry, 0]);
      }
      // 门 + 门框
      function doorAt(x, z, ry, dw, dh) {
        dw = dw || 1.1; dh = dh || 1.8;
        B.add(g, R.rbox(dw + 0.22, dh + 0.2, 0.16, 0.07), trimMat, [x, dh / 2, z], [0, ry, 0]);
        B.add(g, R.rbox(dw, dh, 0.18, 0.05), doorMat, [x, dh / 2, z], [0, ry, 0]);
        // 门槛
        B.add(g, R.rbox(dw + 0.3, 0.12, 0.5, 0.05), baseMat, [x, 0.06, z + (ry === 0 ? 0.2 : (Math.abs(ry) > 2 ? -0.2 : 0))], [0, ry, 0]);
      }
      function chimneyAt(x, z, topY) {
        B.add(g, R.rbox(0.5, topY - h + 1.4, 0.5, 0.06), chimMat, [x, (topY + (h - 1.4)) / 2 + 0.2, z]);
        B.add(g, R.rbox(0.66, 0.16, 0.66, 0.05), trimMat, [x, topY + 0.05, z]);
      }
      // 底座石裙（比墙体略宽，消除浮空盒子感）
      function baseSkirt(bw, bd, bh) {
        B.add(g, R.rbox(bw + 0.3, 0.5, bd + 0.3, 0.08), baseMat, [0, 0.25, 0]);
      }
      function frontZ() { return d / 2 + 0.02; }

      var roofBase;
      if (variant === 3) {
        // ---- 圆塔小屋：圆柱墙体 + 锥形顶 + 拱门 + 圆窗 ----
        const rr = Math.min(w, d) / 2;
        const wallH = h + 0.6;
        B.add(g, R.cyl(rr, rr * 1.04, wallH, 20), wallMat, [0, wallH / 2, 0]);
        baseSkirt(rr * 2, rr * 2, wallH);
        // 锥顶
        var cone = new T.ConeGeometry(rr + 0.55, wallH * 0.62, 20, 1);
        B.add(g, cone, roofMat, [0, wallH + wallH * 0.31, 0]);
        // 檐口
        B.add(g, R.cyl(rr + 0.35, rr + 0.35, 0.16, 20), trimMat, [0, wallH + 0.02, 0]);
        // 顶饰球
        B.add(g, R.sph(0.18, 12, 10), trimMat, [0, wallH + wallH * 0.62, 0]);
        // 门
        doorAt(0, rr + 0.02, 0, 1.1, 1.9);
        // 环形圆窗
        for (var a = 0; a < 4; a++) {
          var ang = a * Math.PI / 2 + Math.PI / 4;
          var wx = Math.sin(ang) * (rr + 0.05), wz = Math.cos(ang) * (rr + 0.05);
          B.add(g, R.sph(0.28, 12, 10), trimMat, [wx, wallH * 0.62, wz]);
          B.add(g, R.sph(0.22, 10, 8), winMat, [wx * 1.02, wallH * 0.62, wz * 1.02]);
        }
        roofBase = wallH;
      } else {
        // ---- 矩形主体（圆角墙 + 石裙）----
        var bodyH = (variant === 1) ? h + 1.6 : h;   // 两层更高
        B.add(g, R.rbox(w, bodyH, d, Math.min(0.16, w * 0.05)), wallMat, [0, bodyH / 2, 0]);
        baseSkirt(w, d, bodyH);
        // 腰线（两层分界 / 单层檐下装饰带）
        B.add(g, R.rbox(w + 0.18, 0.16, d + 0.18, 0.05), trimMat, [0, (variant === 1 ? h : bodyH - 0.25), 0]);

        if (variant === 2) {
          // L形：主块 + 侧翼（沿 +X 贴一小间），各自坡顶
          const lw = w * 0.62, ld = d * 0.7;
          const lx = w / 2 - lw / 2 + lw * 0.5 + 0.0, lz = -d / 2 + ld / 2 + 0.02;
          const lcx = w / 2 + lw / 2 - 0.2, lcz = -d / 2 + ld / 2;
          B.add(g, R.rbox(lw, bodyH * 0.82, ld, 0.12), wall2Mat, [lcx, bodyH * 0.41, lcz]);
          var wingRoof = gableRoof(lw, ld, bodyH * 0.5, 0.2);
          B.add(g, wingRoof, roofMat, [lcx, bodyH * 0.82, lcz]);
        }

        // 主屋顶
        if (variant === 4) {
          // 平房 + 门廊：四坡顶 + 前廊立柱 + 雨棚
          var hr = hipRoof(w, d, h * 0.5);
          B.add(g, hr, roofMat, [0, bodyH + h * 0.25, 0]);
          roofBase = bodyH + h * 0.5;
          // 门廊平台 + 两根立柱 + 雨棚
          var fz = d / 2 + 1.3;
          B.add(g, R.rbox(w * 0.7, 0.2, 1.6, 0.06), baseMat, [0, 0.1, fz - 0.6]);
          B.add(g, R.cyl(0.14, 0.14, h, 10), trimMat, [-w * 0.28, h / 2, fz]);
          B.add(g, R.cyl(0.14, 0.14, h, 10), trimMat, [w * 0.28, h / 2, fz]);
          B.add(g, R.rbox(w * 0.7 + 0.5, 0.16, 1.8, 0.05), roofMat, [0, h + 0.05, fz - 0.4], [-0.12, 0, 0]);
        } else {
          var gr = gableRoof(w, d, h * (variant === 1 ? 0.7 : 0.6), 0.28);
          B.add(g, gr, roofMat, [0, bodyH, 0]);
          roofBase = bodyH + h * (variant === 1 ? 0.7 : 0.6);
          if (variant === 2) { /* 主脊略低于侧翼已加 */ }
        }

        // 山墙端小窗（±X 面）
        windowAt(trimMat, w / 2 + 0.02, bodyH * 0.62, 0, Math.PI / 2, 0.55, 0.7);
        windowAt(trimMat, -(w / 2 + 0.02), bodyH * 0.62, 0, Math.PI / 2, 0.55, 0.7);
        // 正面门 + 窗
        doorAt(0, frontZ(), 0);
        windowAt(trimMat, -w * 0.28, h * 0.58, frontZ(), 0);
        windowAt(trimMat, w * 0.28, h * 0.58, frontZ(), 0);
        // 背面两窗
        windowAt(trimMat, -w * 0.25, h * 0.58, -(d / 2 + 0.02), 0);
        windowAt(trimMat, w * 0.25, h * 0.58, -(d / 2 + 0.02), 0);

        // 两层：二楼正面两窗 + 阳台
        if (variant === 1) {
          var y2 = h + 0.55;
          windowAt(trimMat, -w * 0.26, y2, frontZ(), 0);
          windowAt(trimMat, w * 0.26, y2, frontZ(), 0);
          // 阳台栏板 + 立柱
          B.add(g, R.rbox(w * 0.7, 0.9, 0.12, 0.04), trimMat, [0, h + 0.05, d / 2 + 0.5]);
          B.add(g, R.rbox(0.12, 0.9, 0.6, 0.04), trimMat, [-w * 0.35, h + 0.05, d / 2 + 0.25]);
          B.add(g, R.rbox(0.12, 0.9, 0.6, 0.04), trimMat, [w * 0.35, h + 0.05, d / 2 + 0.25]);
        }
      }

      // 烟囱（圆塔除外）
      if (variant !== 3) {
        var topY = roofBase;
        chimneyAt(-w * 0.28, -d * 0.18, topY + 0.4);
      }

      B.flush();
      g.userData = {};
      return g;
    }
  };
})(window);
