/**
 * birds.js — 飞鸟模型（v6.7 场景美化，空中飞过效果）
 * 注册: window.MODELS.birds
 * 2 种飞鸟：'white'（白海鸥，翼尖深色）/ 'dark'（深灰猎鸟，腹部浅色）
 * 每群 3 只，绕地图上空圆形轨道飞行，翅膀扇动 + 轻微起伏
 * 配置: variant 'white'|'dark'；center/radius/height/speed 由布局随机
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  global.MODELS.birds = {
    name: 'birds',
    create: function (config) {
      const T = global.THREE;
      const g = new T.Group();
      const variant = (config && config.variant) || 'white';

      const bodyMat = new T.MeshStandardMaterial({
        color: variant === 'white' ? 0xf2f4f6 : 0x37414b,
        roughness: 0.8
      });
      const bellyMat = new T.MeshStandardMaterial({
        color: variant === 'white' ? 0xc9ced6 : 0xb9c2cc,
        roughness: 0.8
      });
      const wingTipMat = new T.MeshStandardMaterial({
        color: variant === 'white' ? 0x5c6670 : 0x14181d,
        roughness: 0.8
      });

      const birds = [];
      for (let b = 0; b < 3; b++) {
        const bird = new T.Group();
        const body = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), bodyMat);
        body.scale.set(1.5, 0.85, 0.9);
        bird.add(body);
        const belly = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), bellyMat);
        belly.position.y = -0.05;
        belly.scale.set(1.5, 0.8, 0.9);
        bird.add(belly);
        // 头 + 喙
        const head = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), bodyMat);
        head.position.set(0.24, 0.06, 0);
        bird.add(head);
        const beak = new T.Mesh(new T.ConeGeometry(0.035, 0.16, 5), bellyMat);
        beak.rotation.z = Math.PI / 2;
        beak.position.set(0.36, 0.04, 0);
        bird.add(beak);
        // 翅膀（双翼，绕轴扇动）
        const wingL = new T.Group();
        const wl = new T.Mesh(new T.BoxGeometry(0.62, 0.02, 0.24), bodyMat);
        wl.position.x = -0.31;
        wingL.add(wl);
        const wlTip = new T.Mesh(new T.BoxGeometry(0.3, 0.02, 0.18), wingTipMat);
        wlTip.position.x = -0.6;
        wingL.add(wlTip);
        wingL.position.set(0.02, 0.05, 0);
        bird.add(wingL);
        const wingR = wingL.clone();
        bird.add(wingR);

        const flapPhase = b * 1.3;
        birds.push({ wingL: wingL, wingR: wingR, flapPhase: flapPhase });
        bird.position.set((b - 1) * 0.9, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8);
        g.add(bird);
      }

      // 圆形轨道参数（布局或默认）
      const cx = (config && config.cx !== undefined) ? config.cx : 0;
      const cz = (config && config.cz !== undefined) ? config.cz : 0;
      const radius = (config && config.radius) || 35;
      const height = (config && config.height) || 22;
      const speed = (config && config.speed) || 2.2;

      g.userData = {
        kind: 'birds',
        birds: birds,
        cx: cx, cz: cz, radius: radius, height: height, speed: speed,
        angle: Math.random() * Math.PI * 2,
        phase: Math.random() * 6.28,
        flap: 9 + Math.random() * 3
      };
      return g;
    },
    update: function (inst, dt, ctx) {
      const u = inst.userData;
      u.phase += dt;
      u.angle += dt * u.speed;
      // 圆形轨道
      inst.position.x = u.cx + Math.cos(u.angle) * u.radius;
      inst.position.z = u.cz + Math.sin(u.angle) * u.radius;
      inst.position.y = u.height + Math.sin(u.phase * 0.8) * 1.6;
      // 面向飞行方向
      inst.rotation.y = -u.angle;
      // 翅膀扇动
      for (let i = 0; i < u.birds.length; i++) {
        const b = u.birds[i];
        const flap = Math.sin(u.phase * u.flap + b.flapPhase) * 0.7;
        b.wingL.rotation.z = flap;
        b.wingR.rotation.z = -flap;
      }
    }
  };
})(window);
