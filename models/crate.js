/**
 * crate.js — 木箱模型（程序化，Canvas 木纹 + 边框线）
 * 注册: window.MODELS.crate
 * 默认尺寸: 1 x 1 x 1，中心在原点（layout position.y = 0.5 放地面）
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.crate = {
    name: 'crate',
    create: function () {
      const T = global.THREE;
      const g = new T.Group();

      // Canvas 木箱纹理
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#8a6b3c';
      ctx.fillRect(0, 0, 256, 256);
      // 木板条纹
      ctx.strokeStyle = '#6b4f28';
      ctx.lineWidth = 8;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
      }
      // 斜向加固条
      ctx.strokeStyle = '#5a3f1e';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(248, 248); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(248, 8); ctx.lineTo(8, 248); ctx.stroke();
      // 铆钉
      ctx.fillStyle = '#3d3326';
      for (let i = 0; i <= 4; i++)
        for (let j = 0; j <= 4; j++) {
          ctx.beginPath(); ctx.arc(i * 64, j * 64, 6, 0, 7); ctx.fill();
        }

      const tex = new T.CanvasTexture(c);
      const box = new T.Mesh(
        new T.BoxGeometry(1, 1, 1),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0.1 })
      );
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);

      // 高亮边框
      const edges = new T.LineSegments(
        new T.EdgesGeometry(box.geometry),
        new T.LineBasicMaterial({ color: 0xd8b56a })
      );
      g.add(edges);
      return g;
    }
  };
})(window);
