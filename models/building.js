/**
 * building.js — 程序化建筑（小屋/仓库）
 * 注册: window.MODELS.building
 * 挂载点: 模型底部中心在原点（position.y 表示地面高度）
 * config: w/d/h 尺寸，color 外墙色，roofColor 屋顶色
 * 带窗户发光（夜晚感）、门洞造型、坡屋顶
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.building = {
    name: 'building',
    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const w = cfg.w || 5;
      const d = cfg.d || 5;
      const h = cfg.h || 3.4;

      const wallMat = new T.MeshStandardMaterial({
        color: cfg.color || 0x8a9bb0,
        roughness: 0.9,
        metalness: 0.05
      });
      const roofMat = new T.MeshStandardMaterial({
        color: cfg.roofColor || 0x5d4a3a,
        roughness: 0.85,
        metalness: 0.1
      });
      const windowMat = new T.MeshStandardMaterial({
        color: 0xffe9a8,
        emissive: 0xffcf6e,
        emissiveIntensity: 0.9
      });

      const g = new T.Group();

      // 主体（四面墙整体，底部在 y=0）
      const body = new T.Mesh(new T.BoxGeometry(w, h, d), wallMat);
      body.position.y = h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      // 屋顶：四棱锥（坡屋顶），盖在主体上方
      const roof = new T.Mesh(new T.ConeGeometry(Math.max(w, d) * 0.72, h * 0.55, 4), roofMat);
      roof.position.y = h + h * 0.275;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      g.add(roof);

      // 窗户（正面 + 背面，各两扇；发黄光）
      const winW = Math.min(0.8, w * 0.22);
      const winH = 0.7;
      const winY = h * 0.62;
      const winZ = d / 2 + 0.01;
      const off = Math.min(w * 0.24, 1.2);
      [
        [-off, winY, winZ, 0, 0, 0],
        [off, winY, winZ, 0, 0, 0],
        [-off, winY, -winZ, 0, Math.PI, 0],
        [off, winY, -winZ, 0, Math.PI, 0]
      ].forEach(function (p) {
        const win = new T.Mesh(
          new T.BoxGeometry(winW, winH, 0.06),
          new T.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffcf6e, emissiveIntensity: 0.9 })
        );
        win.position.set(p[0], p[1], p[2]);
        win.rotation.set(p[3], p[4], p[5]);
        g.add(win);
      });

      // 门（正面：门框 + 暗色门板）
      const doorW = Math.min(1.2, w * 0.3);
      const doorH = 1.9;
      const doorMat = new T.MeshStandardMaterial({ color: 0x3a2f24, roughness: 0.9 });
      const door = new T.Mesh(new T.BoxGeometry(doorW, doorH, 0.08), doorMat);
      door.position.set(0, doorH / 2, d / 2 + 0.01);
      g.add(door);

      // 檐口线（装饰）
      const eave = new T.Mesh(new T.BoxGeometry(w + 0.4, 0.14, d + 0.4), roofMat);
      eave.position.y = h;
      g.add(eave);

      g.userData = {};
      return g;
    }
  };
})(window);
