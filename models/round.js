/**
 * round.js — 圆角几何体工具（v11，去除方块感）
 * 注册: window.ROUND
 * 仅提供程序化圆角基础体，不改变任何逻辑/碰撞/动画契约。
 *
 * 思路：用 ExtrudeGeometry + bevel 生成真正带圆角的长方体（12 条棱都倒角），
 * 再由 .center() 居中，得到尺寸精确 (w,h,d)、四角半径 r 的圆角方块。
 * 圆角圆柱用 CapsuleGeometry 近似（端面天然半球倒角）。
 *
 * 性能：所有几何体在模型 create() 时一次性构建，不进入每帧循环，不会掉帧。
 */
(function (global) {
  var T = global.THREE;

  /** 圆角长方体。w=宽(x) h=高(y) d=深(z) r=四角半径(自动夹紧到边长一半)。seg=倒角细分。
   *  注意：ExtrudeGeometry 的 bevel 会沿轮廓向外扩展 bevelSize，故基础形状需收缩 2r，
   *  最终尺寸才精确等于 (w,h,d)。 */
  function roundedBox(w, h, d, r, seg) {
    r = Math.min(r, w / 2, h / 2, d / 2);
    if (r < 0.0008) r = 0.0008;
    seg = seg || 3;
    var curve = Math.max(4, Math.round(seg * 2));
    var wsh = Math.max(0.0008, w - 2 * r);   // 基础形状需收缩 2r，bevel 会外扩 r
    var hsh = Math.max(0.0008, h - 2 * r);
    var x = -wsh / 2, y = -hsh / 2;

    var shape = new T.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + wsh - r, y);
    shape.quadraticCurveTo(x + wsh, y, x + wsh, y + r);
    shape.lineTo(x + wsh, y + hsh - r);
    shape.quadraticCurveTo(x + wsh, y + hsh, x + wsh - r, y + hsh);
    shape.lineTo(x + r, y + hsh);
    shape.quadraticCurveTo(x, y + hsh, x, y + hsh - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);

    var depth = Math.max(0.0008, d - 2 * r);
    var geo = new T.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: true,
      bevelThickness: r,
      bevelSize: r,
      bevelSegments: seg,
      steps: 1,
      curveSegments: curve
    });
    geo.center();
    return geo;
  }

  /** 圆角圆柱（端面半球倒角）。rt/rb=两端半径 len=总长轴长度(含两端半球)。seg=径向分段。轴为 Y。 */
  function roundedCyl(rt, rb, len, seg) {
    var r = Math.min(rt, rb);
    var cyl = Math.max(0.0008, len - 2 * r);
    return new T.CapsuleGeometry(r, cyl, 4, seg || 14);
  }

  /** 平端圆柱（轴向 Z，便于做枪管/护木），仅做轴向旋转封装。 */
  function cylZ(rt, rb, len, seg) {
    var g = new T.CylinderGeometry(rt, rb, len, seg || 14, 1, false);
    g.rotateX(Math.PI / 2); // Y 轴 -> Z 轴，使圆柱沿 -Z(前向) 延伸
    return g;
  }

  global.ROUND = {
    roundedBox: roundedBox,
    roundedCyl: roundedCyl,
    cylZ: cylZ
  };
})(window);
