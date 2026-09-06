/**
 * mushroom.js — 蘑菇装饰模型（程序化生成，多颜色/多尺寸）
 * 注册: window.MODELS.mushroom
 *
 * v8.0 新增：作为地图随机装饰物，提升画面美感。
 * 结构：微锥菌柄 + 半球菌盖（可带白斑）；颜色/是否带斑由 config.variant 决定，
 *       尺寸由主程序 config.scale 控制。
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  // 菌盖配色（PSX 明快风）
  var VARIANTS = {
    red:      { cap: 0xd64541, stem: 0xf0e6d2, spotted: true },
    flyagaric:{ cap: 0xe8341f, stem: 0xf5efe0, spotted: true },
    brown:    { cap: 0x8a5a2b, stem: 0xe8dcc4, spotted: false },
    orange:   { cap: 0xe8853a, stem: 0xf2e3c9, spotted: false },
    purple:   { cap: 0x8e5aa0, stem: 0xe6d9ec, spotted: false },
    teal:     { cap: 0x3a9d8a, stem: 0xdcefea, spotted: false },
    yellow:   { cap: 0xe8c23a, stem: 0xf5ecc8, spotted: false },
    pink:     { cap: 0xd66a9a, stem: 0xf6e0ea, spotted: true },
    white:    { cap: 0xd8d4c8, stem: 0xefece2, spotted: false }
  };

  global.MODELS.mushroom = {
    name: 'mushroom',

    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();
      const cfg = config || {};

      const v = VARIANTS[cfg.variant] || VARIANTS.red;
      const capColor = (cfg.color != null) ? cfg.color : v.cap;
      const stemColor = (cfg.stemColor != null) ? cfg.stemColor : v.stem;
      const spotted = cfg.spotted != null ? cfg.spotted : v.spotted;

      // 菌柄（微锥圆柱，底部略宽）
      const stem = new T.Mesh(
        new T.CylinderGeometry(0.13, 0.22, 0.55, 8),
        new T.MeshStandardMaterial({ color: stemColor, roughness: 0.9, metalness: 0, flatShading: true })
      );
      stem.position.y = 0.275;
      stem.castShadow = false;
      g.add(stem);

      // 菌盖（半球，略微压扁）
      const cap = new T.Mesh(
        new T.SphereGeometry(0.5, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2),
        new T.MeshStandardMaterial({ color: capColor, roughness: 0.7, metalness: 0, flatShading: true })
      );
      cap.position.y = 0.55;
      cap.scale.y = 0.72;
      cap.castShadow = false;
      g.add(cap);

      // 菌盖白斑（毒蝇伞/红斑菇）
      if (spotted) {
        const spotMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0 });
        for (let i = 0; i < 5; i++) {
          const spot = new T.Mesh(new T.SphereGeometry(0.07, 6, 5), spotMat);
          const a = Math.random() * Math.PI * 2;
          const r = 0.16 + Math.random() * 0.24;
          spot.position.set(
            Math.cos(a) * r,
            0.55 + 0.28 + Math.random() * 0.1,
            Math.sin(a) * r
          );
          spot.scale.set(1, 0.4, 1);
          g.add(spot);
        }
      }

      g.userData = { kind: 'scenery' };
      return g;
    },

    update: function () { /* 静态装饰，无动画 */ }
  };
})(window);
