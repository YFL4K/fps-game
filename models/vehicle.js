/**
 * vehicle.js — 车辆模型（超级马里奥3D世界风格：卡丁车圆润造型）
 * 注册: window.MODELS.vehicle
 * config.variant: 'car' | 'truck' | 'jeep'（决定尺寸/颜色/造型）
 * config.color: 车身颜色覆盖
 * 默认: 车体中心在地面（position.y = 0），圆润车身 + 橡胶轮胎 + 亮色轮毂
 */
(function (global) {
  global.MODELS = global.MODELS || {};

  var VARIANTS = {
    car:   { bodyColor: 0xe63946, bodyLen: 4.2, bodyH: 0.7, bodyW: 1.8, cabinLen: 1.8, cabinH: 0.6, wheelY: 0.42 },
    truck: { bodyColor: 0xf4a261, bodyLen: 5.4, bodyH: 0.85, bodyW: 2.15, cabinLen: 1.5, cabinH: 0.72, wheelY: 0.5 },
    jeep:  { bodyColor: 0x2a9d8f, bodyLen: 3.4, bodyH: 0.62, bodyW: 1.7, cabinLen: 1.1, cabinH: 0.52, wheelY: 0.38 }
  };

  global.MODELS.vehicle = {
    name: 'vehicle',

    create: function (config) {
      const T = global.THREE;
      const cfg = config || {};
      const v = VARIANTS[cfg.variant] || VARIANTS.car;
      const g = new T.Group();

      const bodyColor = cfg.color || v.bodyColor;
      const bodyMat = new window.MARIO.mat({ color: bodyColor });
      const darkMat = new window.MARIO.mat({ color: 0x22262a });
      const glassMat = new window.MARIO.mat({ color: 0x9fd8ff, transparent: true, opacity: 0.75 });
      const wheelMat = new window.MARIO.mat({ color: 0x0d0d0f });
      const hubMat = new window.MARIO.mat({ color: 0xffd700, metalness: 0.6, roughness: 0.25 }); // 亮金轮毂

      const L = v.bodyLen, H = v.bodyH, W = v.bodyW;
      const baseY = v.wheelY + 0.25;

      // 圆润车身（胶囊形：横向圆柱 + 半球头尾）
      const body = new T.Mesh(new T.CylinderGeometry(W * 0.5, W * 0.5, L * 0.8, 18), bodyMat);
      body.rotation.x = Math.PI / 2;
      body.position.y = baseY + H / 2;
      body.castShadow = true;
      g.add(body);
      // 车头车尾半球
      const nose = new T.Mesh(new T.SphereGeometry(W * 0.5, 18, 14), bodyMat);
      nose.scale.set(1, H / W, 1);
      nose.position.set(0, baseY + H / 2, -L * 0.4);
      g.add(nose);
      const tail = nose.clone();
      tail.position.z = L * 0.4;
      g.add(tail);

      // 底盘
      const chassis = new T.Mesh(new T.BoxGeometry(W * 0.9, 0.18, L * 0.8), darkMat);
      chassis.position.y = v.wheelY + 0.12;
      g.add(chassis);

      // 圆润玻璃驾驶舱顶
      const cab = new T.Mesh(new T.SphereGeometry(W * 0.42, 18, 14), glassMat);
      cab.scale.set(1, v.cabinH / (W * 0.42), v.cabinLen / (W * 0.42));
      cab.position.set(0, baseY + H + v.cabinH * 0.4, L * 0.06);
      cab.castShadow = true;
      g.add(cab);

      // 前后圆润保险杠
      const bumperF = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, W * 1.02, 12), darkMat);
      bumperF.rotation.z = Math.PI / 2;
      bumperF.position.set(0, v.wheelY + 0.34, -L / 2 - 0.04);
      const bumperR = bumperF.clone();
      bumperR.position.z = L / 2 + 0.04;
      g.add(bumperF, bumperR);

      // 车灯（前白后红，圆球发光）
      const headMat = new window.MARIO.basic({ color: 0xfff6c0 });
      const lampF1 = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), headMat);
      lampF1.position.set(-W * 0.32, v.wheelY + 0.52, -L / 2 - 0.02);
      const lampF2 = lampF1.clone();
      lampF2.position.x = W * 0.32;
      const tailMat = new window.MARIO.basic({ color: 0xff4444 });
      const lampR1 = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), tailMat);
      lampR1.position.set(-W * 0.32, v.wheelY + 0.52, L / 2 + 0.02);
      const lampR2 = lampR1.clone();
      lampR2.position.x = W * 0.32;
      g.add(lampF1, lampF2, lampR1, lampR2);

      // 圆润橡胶轮胎 + 亮色轮毂
      const wheelGeo = new T.CylinderGeometry(0.4, 0.4, 0.32, 18);
      const hubGeo = new T.CylinderGeometry(0.2, 0.2, 0.34, 10);
      const wp = [
        [-W / 2 - 0.1, v.wheelY, -L * 0.34], [W / 2 + 0.1, v.wheelY, -L * 0.34],
        [-W / 2 - 0.1, v.wheelY, L * 0.34], [W / 2 + 0.1, v.wheelY, L * 0.34]
      ];
      wp.forEach(function (p) {
        const w = new T.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(p[0], p[1], p[2]);
        w.castShadow = true;
        g.add(w);
        const hub = new T.Mesh(hubGeo, hubMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(p[0], p[1], p[2]);
        g.add(hub);
      });

      return g;
    }
  };
})(window);
