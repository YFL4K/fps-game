/**
 * crate.js — 木箱模型（程序化，Canvas 木纹 + 边框线）
 * 注册: window.MODELS.crate
 * 默认尺寸: 1 x 1 x 1，中心在原点（layout position.y = 0.5 放地面）
 *
 * v11.13 性能：木纹贴图/几何体/描边几何全部提升为模块级单例 ——
 * 旧版每个箱子都重画一张 256×256 canvas 并新建 CanvasTexture + BoxGeometry +
 * EdgesGeometry + 材质，一关几十个箱子 = 几十次 GPU 纹理上载（换关卡顿 + 显存浪费）。
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var _tex = null, _edges = null, _lineMat = null;
  function woodTex() {
    var T = global.THREE;
    if (_tex) return _tex;
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#8a6b3c';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#6b4f28';
    ctx.lineWidth = 8;
    for (var i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke(); }
    ctx.strokeStyle = '#5a3f1e';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(248, 248); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(248, 8); ctx.lineTo(8, 248); ctx.stroke();
    ctx.fillStyle = '#3d3326';
    for (var a = 0; a <= 4; a++) for (var b = 0; b <= 4; b++) { ctx.beginPath(); ctx.arc(a * 64, b * 64, 6, 0, 7); ctx.fill(); }
    _tex = new T.CanvasTexture(c);
    _tex.__shared = true;
    return _tex;
  }

  global.MODELS.crate = {
    name: 'crate',
    create: function () {
      const T = global.THREE;
      const R = global.ROUND;
      const g = new T.Group();

      const geo = R.box(1, 1, 1);
      const box = new T.Mesh(geo, new window.MARIO.matS({ map: woodTex() }));
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);

      // 高亮边框（几何体与线材质同样共享，注意 LineSegments 需要 LineBasicMaterial）
      if (!_edges) { _edges = new T.EdgesGeometry(geo); _edges.__shared = true; }
      if (!_lineMat) { _lineMat = new T.LineBasicMaterial({ color: 0xd8b56a }); _lineMat.__shared = true; }
      var lines = new T.LineSegments(_edges, _lineMat);
      lines.__sharedMat = true;
      g.add(lines);
      return g;
    }
  };
})(window);
