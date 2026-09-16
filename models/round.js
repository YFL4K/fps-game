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

  /* ================= v11.13 性能公共设施：几何体缓存 + 同材质合批 =================
   * 实测（v11.12 基线，无头 640×360 真实游戏页）：一帧 1068~1095 次 draw call、
   * 1326 个唯一几何体、661 个唯一材质 —— 掉帧主因不是着色器，而是"每个小零件一个网格、
   * 每个实体一套几何体/材质"。摩天轮 2 个实体 232 个网格，台阶 60 个 120 个网格。
   * ============================================================================== */
  var _geoCache = {};
  /** 按 key 缓存几何体（跨实例共享）。标 __shared 让主程序销毁单个实体时不会释放它。 */
  function geo(key, make) {
    var g = _geoCache[key];
    if (!g) { g = _geoCache[key] = make(); g.__shared = true; }
    return g;
  }
  var _m4 = null, _m3 = null, _q = null, _e = null, _vp = null, _vn = null, _p3 = null, _s3 = null;
  function tmp() {
    if (_m4) return;
    _m4 = new T.Matrix4(); _m3 = new T.Matrix3(); _q = new T.Quaternion(); _e = new T.Euler();
    _vp = new T.Vector3(); _vn = new T.Vector3(); _p3 = new T.Vector3(); _s3 = new T.Vector3();
  }
  /** 把若干部件（{geo, p, r, s}）烘焙成一个几何体（保留 position/normal/uv） */
  function merge(list) {
    tmp();
    var pa = [], na = [], ua = [], ix = [], vo = 0;
    for (var i = 0; i < list.length; i++) {
      var it = list[i], gg = it.geo;
      if (it.m) {                       // 已烘焙好的矩阵（用于嵌套变换，如吊舱内的零件）
        _m4.copy(it.m);
      } else {
        var p = it.p || [0, 0, 0], r = it.r || [0, 0, 0], s = it.s || [1, 1, 1];
        _e.set(r[0], r[1], r[2]); _q.setFromEuler(_e);
        _p3.set(p[0], p[1], p[2]); _s3.set(s[0], s[1], s[2]);
        _m4.compose(_p3, _q, _s3);
      }
      _m3.getNormalMatrix(_m4);
      var pos = gg.attributes.position, nor = gg.attributes.normal, uvs = gg.attributes.uv;
      var n = pos.count;
      for (var v = 0; v < n; v++) {
        _vp.fromBufferAttribute(pos, v).applyMatrix4(_m4); pa.push(_vp.x, _vp.y, _vp.z);
        if (nor) { _vn.fromBufferAttribute(nor, v).applyMatrix3(_m3).normalize(); na.push(_vn.x, _vn.y, _vn.z); }
        else na.push(0, 1, 0);
        if (uvs) ua.push(uvs.getX(v), uvs.getY(v)); else ua.push(0, 0);
      }
      var gi = gg.index;
      if (gi) { for (var k = 0; k < gi.count; k++) ix.push(gi.array[k] + vo); }
      else { for (var k2 = 0; k2 < n; k2++) ix.push(k2 + vo); }
      vo += n;
    }
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pa, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(na, 3));
    out.setAttribute('uv', new T.Float32BufferAttribute(ua, 2));
    out.setIndex(ix);
    out.computeBoundingSphere();
    out.__shared = true;
    return out;
  }
  /**
   * 合批器：模型把部件先 add 进 (父节点, 材质) 桶里，flush 时每个桶只产出 1 个网格。
   * 需要单独动画/单独开关的零件不要走这里（照旧 new Mesh 直接挂）。
   */
  function batcher() {
    var buckets = [];   // {parent, mat, list}
    function find(parent, mat) {
      for (var i = 0; i < buckets.length; i++) if (buckets[i].parent === parent && buckets[i].mat === mat) return buckets[i];
      var b = { parent: parent, mat: mat, list: [] }; buckets.push(b); return b;
    }
    return {
      add: function (parent, g2, mat, p, r, s) {
        find(parent, mat).list.push({ geo: g2, p: p, r: r, s: s });
      },
      // 该桶只有一个零件时不必烘焙，直接复用原几何体（省一次顶点拷贝）
      flush: function () {
        for (var i = 0; i < buckets.length; i++) {
          var b = buckets[i];
          if (!b.list.length) continue;
          var geoOut = b.list.length === 1 ? b.list[0].geo : merge(b.list);
          var mesh = new T.Mesh(geoOut, b.mat);
          if (b.list.length === 1) {
            var it = b.list[0];
            if (it.p) mesh.position.set(it.p[0], it.p[1], it.p[2]);
            if (it.r) mesh.rotation.set(it.r[0], it.r[1], it.r[2]);
            if (it.s) mesh.scale.set(it.s[0], it.s[1], it.s[2]);
          }
          mesh.castShadow = false; mesh.receiveShadow = false;
          b.parent.add(mesh);
        }
        buckets = [];
      },
      count: function () { return buckets.length; }
    };
  }

  /* v11.13 三个形状工厂默认带参数缓存：全工程几十处 "每个实体 new 一份几何体" 的写法
   * 因此自动变成共享（实测基线 1188 个唯一几何体 → 大量为同尺寸重复品，如 60 级塔台阶
   * 各建一套、26 棵树各建一套）。已核实没有任何模型在运行时改写几何体顶点内容。 */
  function boxC(w, h, d, r, seg) { return geo('RB|' + w + '|' + h + '|' + d + '|' + r + '|' + (seg || 3), function () { return roundedBox(w, h, d, r, seg); }); }
  function cylC(rt, rb, len, seg) { return geo('RC2|' + rt + '|' + rb + '|' + len + '|' + seg, function () { return roundedCyl(rt, rb, len, seg); }); }
  function cylZC(rt, rb, len, seg) { return geo('RZ2|' + rt + '|' + rb + '|' + len + '|' + seg, function () { return cylZ(rt, rb, len, seg); }); }

  global.ROUND = {
    roundedBox: boxC,
    roundedCyl: cylC,
    cylZ: cylZC,
    geo: geo,
    merge: merge,
    batcher: batcher,
    // 常用基础形状的一行缓存版（模型里直接替换 new T.XxxGeometry(...) 即可共享）
    box: function (w, h, d) { return geo('x|' + w + '|' + h + '|' + d, function () { return new T.BoxGeometry(w, h, d); }); },
    sph: function (r, a, b2) { return geo('s|' + r + '|' + (a || 16) + '|' + (b2 || 12), function () { return new T.SphereGeometry(r, a || 16, b2 || 12); }); },
    cyl: function (rt, rb, len, seg) { return geo('y|' + rt + '|' + rb + '|' + len + '|' + (seg || 14), function () { return new T.CylinderGeometry(rt, rb, len, seg || 14); }); },
    cone: function (r, h, seg) { return geo('n|' + r + '|' + h + '|' + (seg || 8), function () { return new T.ConeGeometry(r, h, seg || 8); }); },
    rbox: function (w, h, d, r) { return geo('R|' + w + '|' + h + '|' + d + '|' + r, function () { return roundedBox(w, h, d, r); }); },
    rcyl: function (rt, rb, len, seg) { return geo('RC|' + rt + '|' + rb + '|' + len + '|' + seg, function () { return roundedCyl(rt, rb, len, seg); }); },
    rcylZ: function (rt, rb, len, seg) { return geo('RZ|' + rt + '|' + rb + '|' + len + '|' + seg, function () { return cylZ(rt, rb, len, seg); }); }
  };
})(window);
