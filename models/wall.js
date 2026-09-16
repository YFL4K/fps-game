/**
 * wall.js — 墙板模型（程序化，Canvas 砖块纹理）
 * 注册: window.MODELS.wall
 * 默认尺寸: 8 x 4 x 0.5（layout 可用 scale/rotation 拼接任意墙体）
 * 挂载点: 模型底部中心在原点（position.y 表示地面高度）
 *
 * v11.13 性能：砖纹贴图 / 盒体几何 / 材质 提升为模块级单例。
 * 一张地图有 32 段边界围墙 + 几十段掩体墙，旧版每段都重画 canvas 并新建
 * CanvasTexture + BoxGeometry + 材质 → 上百次纹理上载（v11.12 基线里 wall 家族
 * 独占 68 个唯一几何体与 68 个唯一材质）。
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var _tex = null;
  function brickTex() {
    var T = global.THREE;
    if (_tex) return _tex;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6b5a48';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#3d3328';
    ctx.lineWidth = 3;
    const bw = 64, bh = 32;
    for (let row = 0; row < 4; row++) {
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col < 5; col++) ctx.strokeRect(col * bw + off, row * bh, bw, bh);
    }
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#000';
    for (let r2 = 0; r2 < 4; r2++)
      for (let c2 = 0; c2 < 4; c2++)
        if ((r2 + c2) % 2 === 0) ctx.fillRect(c2 * 64 + 6, r2 * 32 + 6, 52, 20);
    ctx.globalAlpha = 1;
    _tex = new T.CanvasTexture(c);
    _tex.wrapS = _tex.wrapT = T.RepeatWrapping;
    _tex.repeat.set(4, 2);
    _tex.__shared = true;
    return _tex;
  }

  global.MODELS.wall = {
    name: 'wall',
    create: function () {
      const T = global.THREE;
      const R = global.ROUND;
      const g = new T.Group();
      const box = new T.Mesh(R.box(8, 4, 0.5), new window.MARIO.matS({ map: brickTex() }));
      box.position.y = 2;   // 底部中心在原点
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);
      return g;
    }
  };
})(window);
