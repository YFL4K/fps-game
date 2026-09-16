/**
 * sky.js — 天空 / 昼夜系统（v11.12）
 * 注册: window.MODELS.sky ；并暴露 window.SKYCYCLE
 *
 * 能力：
 *  - 7 个氛围时段（午夜/日出/早晨/正午/下午/日落/黄昏）关键帧调色板，按时间连续插值，整轮 300s。
 *  - 进游戏 / 换关随机落在某一时段（SKYCYCLE.rollPhase()）。
 *  - 太阳东升西落（3D 受光球体：临边变暗 + 加色光晕）；日落后幽蓝月光自动亮起 + 月亮升起。
 *  - 整个世界跟着走：平行光颜色/强度/方向、环境光、半球光、雾色、scene.background、
 *    地形 shader（uLightDir/uLightColor/uAmbient/uFogColor）、水面色、云朵染色全部由同一调色板驱动。
 *  - 夜间星点（单个 Points，一次 draw call）+ 偶发流星（3 片加色面片）；白天整组 visible=false → 零开销。
 *  - 性能：穹顶为单个 ShaderMaterial（渐变+朝日暖辉在片元里算，无逐帧贴图重绘），
 *    每帧只改 uniform 数值与灯光属性，不新建对象、不重编译 shader。
 */
(function (global) {
  global.MODELS = global.MODELS || {};
  var T = global.THREE;

  var PERIOD = 300;          // 一整轮昼夜 = 300 秒
  var SUN_DIST = 175;        // 日/月天体距原点距离（穹顶半径 300 之内）

  function C(hex) { return new T.Color(hex); }
  // 把一条时段定义里的颜色统一转成 {name: [r,g,b]}（display sRGB 数值，直接写进自定义 shader）
  function prep(p) {
    var o = { t: p.t, label: p.label, night: p.night, keyI: p.keyI, ambI: p.ambI, hemiI: p.hemiI };
    ['top', 'hor', 'fog', 'cloud', 'glow', 'key', 'amb', 'hsky', 'hgnd'].forEach(function (k) {
      var c = C(p[k]); o[k] = [c.r, c.g, c.b];
    });
    return o;
  }

  /* ================= 7 时段关键帧 ================= */
  // 正午一组刻意沿用 v11.11 已验收的白天参数（key 0xfff0dd×1.15 / amb 0x8899bb×0.55），
  // 保证白天观感不回退；其余时段围绕它做氛围变化。
  var PHASES = [
    { t: 0.00, label: '🌙 午夜', night: 1.00,
      top: 0x03050d, hor: 0x0a1222, fog: 0x0b1424, cloud: 0x1d2740, glow: 0x0a1020,
      key: 0x89a6de, keyI: 0.34, amb: 0x2e3f63, ambI: 0.34, hsky: 0x16223c, hgnd: 0x0a0d12, hemiI: 0.24 },
    { t: 0.22, label: '🌅 日出', night: 0.14,
      top: 0x2c4a78, hor: 0xff9d5c, fog: 0xdcae82, cloud: 0xffbd8c, glow: 0xff8a4a,
      key: 0xffb374, keyI: 0.88, amb: 0x5d6b8c, ambI: 0.44, hsky: 0x46628f, hgnd: 0x3a2a22, hemiI: 0.36 },
    { t: 0.32, label: '🌄 早晨', night: 0.00,
      top: 0xa9cdf2, hor: 0xeef6ff, fog: 0xdfeefb, cloud: 0xffffff, glow: 0xffe9c9,
      key: 0xffe7bd, keyI: 1.06, amb: 0x8fa6c4, ambI: 0.50, hsky: 0xbfe3ff, hgnd: 0x5a4a38, hemiI: 0.46 },
    { t: 0.50, label: '☀️ 正午', night: 0.00,
      top: 0xa9cdf2, hor: 0xf6fbff, fog: 0xe6f2fb, cloud: 0xffffff, glow: 0xfff4dd,
      key: 0xfff0dd, keyI: 1.15, amb: 0x8899bb, ambI: 0.55, hsky: 0xbfe3ff, hgnd: 0x5a4a38, hemiI: 0.50 },
    { t: 0.64, label: '🌤 下午', night: 0.00,
      top: 0xa4c8ee, hor: 0xf2f4f6, fog: 0xdfe9f2, cloud: 0xf8f2e8, glow: 0xffe3b0,
      key: 0xffe3b6, keyI: 1.06, amb: 0x8b9bb8, ambI: 0.50, hsky: 0xbcdcf6, hgnd: 0x5c4a36, hemiI: 0.46 },
    { t: 0.78, label: '🌇 日落', night: 0.16,
      top: 0x3a5382, hor: 0xff8b4d, fog: 0xd0946c, cloud: 0xffb07a, glow: 0xff713a,
      key: 0xff9b56, keyI: 0.82, amb: 0x63698c, ambI: 0.43, hsky: 0x58709c, hgnd: 0x3a2a22, hemiI: 0.34 },
    { t: 0.87, label: '🌆 黄昏', night: 0.72,
      top: 0x16203c, hor: 0x6b5a86, fog: 0x4a4463, cloud: 0x5f5875, glow: 0xa06a8c,
      key: 0x93a6d8, keyI: 0.46, amb: 0x44506f, ambI: 0.37, hsky: 0x2f3d5e, hgnd: 0x1b1a22, hemiI: 0.27 }
  ].map(prep);

  function smooth(u) { return u * u * (3 - 2 * u); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function lerp3(a, b, u, out) {
    out[0] = lerp(a[0], b[0], u); out[1] = lerp(a[1], b[1], u); out[2] = lerp(a[2], b[2], u);
    return out;
  }

  // 采样当前时段氛围（循环插值），写入 SCRATCH
  var KEYS = ['top', 'hor', 'fog', 'cloud', 'glow', 'key', 'amb', 'hsky', 'hgnd'];
  var SCRATCH = {};
  KEYS.forEach(function (k) { SCRATCH[k] = [0, 0, 0]; });
  SCRATCH.night = 0; SCRATCH.keyI = 0; SCRATCH.ambI = 0; SCRATCH.hemiI = 0; SCRATCH.label = '';
  function sample(t, out) {
    var n = PHASES.length, i = 0;
    for (var k = 0; k < n; k++) {
      var a = PHASES[k], b = PHASES[(k + 1) % n];
      var bt = b.t > a.t ? b.t : b.t + 1;
      var tt = t < a.t ? t + 1 : t;
      if (tt >= a.t && tt <= bt) { i = k; break; }
    }
    var A = PHASES[i], B = PHASES[(i + 1) % n];
    var bt = B.t > A.t ? B.t : B.t + 1, tt = t < A.t ? t + 1 : t;
    var u = smooth(Math.max(0, Math.min(1, (tt - A.t) / (bt - A.t))));
    for (var j = 0; j < KEYS.length; j++) lerp3(A[KEYS[j]], B[KEYS[j]], u, out[KEYS[j]]);
    out.night = lerp(A.night, B.night, u);
    out.keyI = lerp(A.keyI, B.keyI, u);
    out.ambI = lerp(A.ambI, B.ambI, u);
    out.hemiI = lerp(A.hemiI, B.hemiI, u);
    out.label = u < 0.5 ? A.label : B.label;
    return out;
  }

  // 太阳方位角：日出 0.22 → 正午 → 日落 0.78 走完 0..π（东升西落）；夜间继续 π..2π 沉到地平线下
  function sunTheta(t) {
    if (t >= 0.22 && t <= 0.78) return Math.PI * (t - 0.22) / 0.56;
    var tt = t < 0.22 ? t + 1 : t;
    return Math.PI + Math.PI * (tt - 0.78) / 0.44;
  }

  var TILT_Z = -0.30;                       // 让日弧略微偏南，避免正午直射头顶
  function dirOf(theta, out) {
    var x = Math.cos(theta), y = Math.sin(theta), z = TILT_Z;
    var n = Math.sqrt(x * x + y * y + z * z) || 1;
    out[0] = x / n; out[1] = y / n; out[2] = z / n;
    return out;
  }
  function smooth01(a, b, v) {
    var u = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return u * u * (3 - 2 * u);
  }

  /* ================= 穹顶 / 天体 / 云 / 星点 构造 ================= */
  var DOME_VS = [
    'varying vec3 vDir;',
    'void main(){',
    '  vDir = normalize(position);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');
  var DOME_FS = [
    'uniform vec3 uTop, uHor, uGlow, uSunDir;',
    'uniform float uNight;',
    'varying vec3 vDir;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }',
    'void main(){',
    '  vec3 d = normalize(vDir);',
    '  float k = pow(clamp(1.0 - max(d.y, 0.0), 0.0, 1.0), 1.7);',   // 越接近地平线越偏 horizon 色
    '  vec3 col = mix(uTop, uHor, k);',
    // 地平线朝日暖辉（日出/日落最亮；夜间自动为 0）
    '  vec3 vxz = vec3(d.x, 0.0, d.z);',
    '  float az = 0.0;',
    '  if (dot(vxz, vxz) > 1e-4) az = max(dot(normalize(vxz), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);',
    '  float band = exp(-abs(d.y) * 3.2) * (1.0 - uNight * 0.55);',
    '  col += uGlow * pow(az, 5.0) * band * 0.85;',
    // 地平线以下略压暗，避免与地面交界发死白
    '  col *= mix(0.72, 1.0, smoothstep(-0.25, 0.05, d.y));',
    // 抖动去带状色阶（8bit 渐变大容易起横纹）
    '  col += (hash(gl_FragCoord.xy) - 0.5) * 0.008;',
    '  gl_FragColor = vec4(max(col, 0.0), 1.0);',
    '}'
  ].join('\n');

  var BODY_VS = [
    'varying vec3 vN;',
    'void main(){',
    '  vN = normalize(normalMatrix * normal);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');
  var BODY_FS = [
    'uniform vec3 uCore, uEdge;',
    'uniform float uCrater;',
    'varying vec3 vN;',
    'void main(){',
    '  vec3 n = normalize(vN);',
    '  float f = clamp(dot(n, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);',       // 面向相机程度 → 临边变暗
    '  float limb = pow(f, 0.62);',
    '  vec3 col = mix(uEdge, uCore, limb);',
    '  float sh = 1.0;',
    '  if (uCrater > 0.5) {',                                            // 月面环形山（球面法线定位，随自转移动）
    '    sh -= 0.20 * (1.0 - smoothstep(0.10, 0.19, distance(n, normalize(vec3( 0.35, 0.30, 0.88)))));',
    '    sh -= 0.16 * (1.0 - smoothstep(0.07, 0.15, distance(n, normalize(vec3(-0.42, 0.12, 0.90)))));',
    '    sh -= 0.14 * (1.0 - smoothstep(0.06, 0.13, distance(n, normalize(vec3( 0.10,-0.44, 0.89)))));',
    '  }',
    '  col *= sh;',
    '  col += uCore * 0.10 * pow(1.0 - f, 3.0);',                        // 边缘一点泛光
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function bodyMat(core, edge, crater) {
    return new T.ShaderMaterial({
      uniforms: {
        uCore: { value: new T.Vector3(core[0], core[1], core[2]) },
        uEdge: { value: new T.Vector3(edge[0], edge[1], edge[2]) },
        uCrater: { value: crater ? 1 : 0 }
      },
      vertexShader: BODY_VS, fragmentShader: BODY_FS, fog: false
    });
  }

  /* ---- 模块级昼夜状态（跨关卡重建保持连续）---- */
  var state = {
    t: 0.5, phaseIdx: 3, sunEl: 1, dayF: 1, nightF: 0, dt: 0,
    sunDir: [0, 1, 0], moonDir: [0, -1, 0], lightDir: [0, 1, 0],
    pal: SCRATCH, env: null, group: null, clock: 0, cam: new T.Vector3(0, 2, 0)
  };
  sample(state.t, SCRATCH);

  var SKY = global.SKYCYCLE = {
    PERIOD: PERIOD,
    phases: PHASES.map(function (p) { return { t: p.t, label: p.label }; }),
    // 主循环每帧调用（camPos 可选：用于让流星条始终朝向相机）
    update: function (dt, camPos) {
      if (!(dt > 0)) return;
      state.dt = Math.min(dt, 0.1);
      if (camPos) state.cam.copy(camPos);
      state.clock += state.dt;
      state.t = (state.t + state.dt / PERIOD) % 1;
      refresh();
    },
    // 直接设定时间（0..1）与某个时段，用于调试/截图
    setTime: function (t) { state.t = ((t % 1) + 1) % 1; refresh(); },
    setPhase: function (i) {
      i = ((i | 0) % PHASES.length + PHASES.length) % PHASES.length;
      state.phaseIdx = i;
      state.t = PHASES[i].t;
      refresh();
      return { idx: i, label: PHASES[i].label, t: state.t };
    },
    // 进游戏/换关：7 个时段随机挑一个（带 ±0.015 微抖，避免每次都卡在关键帧上）
    rollPhase: function () {
      var i = Math.floor(Math.random() * PHASES.length);
      state.phaseIdx = i;
      state.t = (PHASES[i].t + (Math.random() * 2 - 1) * 0.015 + 1) % 1;
      refresh();
      return PHASES[i].label;
    },
    label: function () { return SCRATCH.label; },
    setEnv: function (env) { state.env = env; applyEnv(SCRATCH); },
    getState: function () {
      return {
        t: Math.round(state.t * 1000) / 1000, label: SCRATCH.label,
        sunEl: Math.round(state.sunEl * 100) / 100,
        dayF: Math.round(state.dayF * 100) / 100, nightF: Math.round(state.nightF * 100) / 100,
        lightDir: state.lightDir.map(function (v) { return Math.round(v * 100) / 100; }),
        fogRGB: SCRATCH.fog.map(function (v) { return Math.round(v * 100) / 100; }),
        keyI: Math.round(SCRATCH.keyI * 100) / 100, ambI: Math.round(SCRATCH.ambI * 100) / 100,
        stars: state.group && state.group.userData.stars ? state.group.userData.stars.count : 0,
        meteorsOn: !!(state.group && state.group.userData.meteors &&
                      state.group.userData.meteors.visible),
        envWired: !!state.env
      };
    }
  };
  function refresh() {
    var pal = sample(state.t, SCRATCH);
    var th = sunTheta(state.t);
    dirOf(th, state.sunDir);
    for (var i = 0; i < 3; i++) state.moonDir[i] = -state.sunDir[i];
    state.sunEl = state.sunDir[1];
    state.dayF = smooth01(-0.03, 0.17, state.sunEl);
    state.nightF = pal.night;
    var useSun = state.sunEl > 0;
    var src = useSun ? state.sunDir : state.moonDir;
    state.lightDir[0] = src[0]; state.lightDir[1] = src[1]; state.lightDir[2] = src[2];
    applyVisuals(pal); applyEnv(pal);
  }

  /* ---- 驱动外部：雾 / 背景 / 三盏灯 / 地形 shader / 水面 ---- */
  var _c = null;
  function applyEnv(pal) {
    var env = state.env; if (!env) return;
    if (!_c) _c = new T.Color();
    if (env.fog) { env.fog.color.setRGB(pal.fog[0], pal.fog[1], pal.fog[2]); }
    if (env.bg && env.bg.setRGB) { env.bg.setRGB(pal.fog[0], pal.fog[1], pal.fog[2]); }
    if (env.dir) {
      env.dir.color.setRGB(pal.key[0], pal.key[1], pal.key[2]);
      env.dir.intensity = pal.keyI;
      env.dir.position.set(state.lightDir[0] * 120, state.lightDir[1] * 120, state.lightDir[2] * 120);
    }
    if (env.amb) {
      env.amb.color.setRGB(pal.amb[0], pal.amb[1], pal.amb[2]);
      env.amb.intensity = pal.ambI;
    }
    if (env.hemi) {
      env.hemi.color.setRGB(pal.hsky[0], pal.hsky[1], pal.hsky[2]);
      env.hemi.groundColor.setRGB(pal.hgnd[0], pal.hgnd[1], pal.hgnd[2]);
      env.hemi.intensity = pal.hemiI;
    }
    var te = global.TERRAIN && global.TERRAIN.env;
    if (te && te.mat && te.mat.uniforms) {
      var u = te.mat.uniforms;
      u.uLightDir.value.set(state.lightDir[0], state.lightDir[1], state.lightDir[2]);
      u.uLightColor.value.set(pal.key[0] * pal.keyI, pal.key[1] * pal.keyI, pal.key[2] * pal.keyI);
      u.uAmbient.value.set(pal.amb[0] * pal.ambI, pal.amb[1] * pal.ambI, pal.amb[2] * pal.ambI);
      u.uFogColor.value.set(pal.fog[0], pal.fog[1], pal.fog[2]);
    }
    if (te && te.waterMat) {
      _c.setRGB(pal.fog[0], pal.fog[1], pal.fog[2]);
      // 水面 = 基准水色随天光压暗 + 轻微反射天空/雾色
      te.waterMat.color.copy(te.baseWaterColor)
        .multiplyScalar(0.42 + 0.58 * state.dayF)
        .lerp(_c, 0.22 + 0.30 * state.nightF);
    }
  }

  /* ---- 天空本体 ---- */
  function applyVisuals(pal) {
    var g = state.group; if (!g) return;
    var ud = g.userData;
    ud.dome.material.uniforms.uTop.value.set(pal.top[0], pal.top[1], pal.top[2]);
    ud.dome.material.uniforms.uHor.value.set(pal.hor[0], pal.hor[1], pal.hor[2]);
    ud.dome.material.uniforms.uGlow.value.set(pal.glow[0], pal.glow[1], pal.glow[2]);
    ud.dome.material.uniforms.uNight.value = pal.night;
    ud.dome.material.uniforms.uSunDir.value.set(state.sunDir[0], state.sunDir[1], state.sunDir[2]);

    // 太阳：位置沿弧走，落到地平线下就隐藏；日面颜色随高度由橙红→炽白
    var sun = ud.sun, sunGlow = ud.sunGlow;
    sun.visible = state.sunEl > -0.10;
    sunGlow.visible = sun.visible;
    if (sun.visible) {
      var sx = state.sunDir[0] * SUN_DIST, sy = state.sunDir[1] * SUN_DIST, sz = state.sunDir[2] * SUN_DIST;
      sun.position.set(sx, sy, sz); sunGlow.position.set(sx, sy, sz);
      var hot = smooth01(0.0, 0.42, state.sunEl);           // 0=贴地平线(橙红) 1=高挂(炽白)
      var cr = lerp(1.00, 0.985, hot), cg = lerp(0.62, 0.955, hot), cb = lerp(0.26, 0.86, hot);
      sun.material.uniforms.uCore.value.set(cr, cg, cb);
      sun.material.uniforms.uEdge.value.set(cr * 0.86, cg * 0.66, cb * 0.42);
      var gop = 0.16 + 0.20 * (1 - hot * 0.5);
      sunGlow.material.opacity = gop;
      sunGlow.material.color.setRGB(cr, (cg + cb) * 0.45, cb * 0.8);
    }

    // 月亮：夜间自动升起 + 幽蓝；星点/流星只在夜间可见（白天整组隐藏 → 零开销）
    var moon = ud.moon, moonGlow = ud.moonGlow;
    var mv = pal.night > 0.05;
    moon.visible = mv; moonGlow.visible = mv;
    if (mv) {
      var mx = state.moonDir[0] * SUN_DIST, my = state.moonDir[1] * SUN_DIST, mz = state.moonDir[2] * SUN_DIST;
      moon.position.set(mx, my, mz); moonGlow.position.set(mx, my, mz);
      moonGlow.material.opacity = 0.10 + 0.10 * pal.night;
    }
    if (ud.starsGrp) {
      ud.starsGrp.visible = pal.night > 0.18;
      if (ud.starsGrp.visible) {
        ud.starMat.opacity = Math.min(1, (pal.night - 0.18) / 0.5) * 0.95;
      }
    }
    updateMeteors(ud, pal);

    // 云朵：受光色随时段染色（白天白、晨昏暖橙、夜里青灰），整环缓慢漂移
    var cm = ud.cloudMat;
    cm.color.setRGB(pal.cloud[0], pal.cloud[1], pal.cloud[2]);
    cm.emissive.setRGB(pal.cloud[0] * 0.30 + pal.glow[0] * 0.10,
                       pal.cloud[1] * 0.30 + pal.glow[1] * 0.08,
                       pal.cloud[2] * 0.30 + pal.glow[2] * 0.08);
    cm.emissiveIntensity = 0.55;
    if (ud.clouds) ud.clouds.rotation.y += state.dt * 0.0045;
  }

  // 流星条朝向：长轴（局部 Y）= 运动方向，面片正对相机 → 任何视角都能看到一条亮痕
  var _sv1 = new T.Vector3(), _sv2 = new T.Vector3(), _sv3 = new T.Vector3(),
      _sv4 = new T.Vector3(), _sm4 = new T.Matrix4();
  function orientStreak(mesh, dir, cam) {
    _sv1.set(dir[0], dir[1], dir[2]).normalize();
    _sv2.set(cam.x - mesh.position.x, cam.y - mesh.position.y, cam.z - mesh.position.z);
    _sv3.crossVectors(_sv1, _sv2);
    if (_sv3.lengthSq() < 1e-4) return;            // 近乎正对相机：保持上一帧朝向
    _sv3.normalize();
    _sv4.crossVectors(_sv3, _sv1).normalize();
    _sm4.makeBasis(_sv4, _sv1, _sv3);
    mesh.quaternion.setFromRotationMatrix(_sm4);
  }

  function updateMeteors(ud, pal) {
    var grp = ud.meteors; if (!grp) return;
    var on = pal.night > 0.45;
    grp.visible = on;
    if (!on) return;
    var arr = ud.meteorList;
    for (var i = 0; i < arr.length; i++) {
      var m = arr[i], per = m.period;
      var u = ((state.clock + m.off) % per) / per;          // 0..1 一轮
      var show = u < m.dur;                                  // 每轮只亮一小段
      if (!show) { m.mesh.visible = false; continue; }
      m.mesh.visible = true;
      var p = u / m.dur;                                     // 0..1 行程
      var s = p * m.len;
      m.mesh.position.set(m.start[0] + m.tang[0] * s, m.start[1] + m.tang[1] * s, m.start[2] + m.tang[2] * s);
      orientStreak(m.mesh, m.tang, state.cam);
      var env = Math.sin(Math.PI * p);
      m.mesh.material.opacity = 0.85 * env * Math.min(1, (pal.night - 0.45) / 0.35);
    }
  }

  /* ================= 注册为模型（由 scene-layout 的 sky 实体构建） ================= */
  global.MODELS.sky = {
    name: 'sky',
    create: function () {
      const g = new T.Group();

      // ---- 天穹 ----
      const dome = new T.Mesh(
        new T.SphereGeometry(300, 32, 20),
        new T.ShaderMaterial({
          uniforms: {
            uTop: { value: new T.Vector3(0.66, 0.80, 0.95) },
            uHor: { value: new T.Vector3(0.96, 0.98, 1.0) },
            uGlow: { value: new T.Vector3(1.0, 0.96, 0.87) },
            uSunDir: { value: new T.Vector3(0, 1, 0) },
            uNight: { value: 0 }
          },
          vertexShader: DOME_VS, fragmentShader: DOME_FS,
          side: T.BackSide, depthWrite: false, fog: false
        })
      );
      dome.renderOrder = -1000;
      g.add(dome);

      // ---- 太阳：立体受光球体（临边变暗）+ 加色光晕 ----
      const sun = new T.Mesh(new T.SphereGeometry(11, 32, 24), bodyMat([1, 0.96, 0.86], [1, 0.8, 0.45], false));
      sun.position.set(0, SUN_DIST * 0.7, SUN_DIST * 0.5);
      g.add(sun);
      const sunGlow = new T.Mesh(
        new T.SphereGeometry(24, 24, 16),
        new T.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.24, fog: false, depthWrite: false, blending: T.AdditiveBlending })
      );
      sunGlow.position.copy(sun.position);
      g.add(sunGlow);

      // ---- 月亮：幽白球体 + 环形山 + 冷色光晕 ----
      const moon = new T.Mesh(new T.SphereGeometry(8, 28, 20), bodyMat([0.92, 0.95, 1.0], [0.55, 0.62, 0.78], true));
      moon.position.set(0, -SUN_DIST, 0); moon.visible = false;
      g.add(moon);
      const moonGlow = new T.Mesh(
        new T.SphereGeometry(17, 20, 14),
        new T.MeshBasicMaterial({ color: 0xbcd2ff, transparent: true, opacity: 0.16, fog: false, depthWrite: false, blending: T.AdditiveBlending })
      );
      moonGlow.position.copy(moon.position); moonGlow.visible = false;
      g.add(moonGlow);

      // ---- 星点（单个 Points，一次 draw call）----
      const SN = 420;
      const sp = new Float32Array(SN * 3);
      for (var i = 0; i < SN; i++) {
        // 只铺上半球（y∈[0.03,1]），避免星星钻到地面以下
        var y = 0.03 + Math.random() * 0.97;
        var r = Math.sqrt(Math.max(0, 1 - y * y));
        var ang = Math.random() * Math.PI * 2;
        sp[i * 3] = Math.cos(ang) * r * 262; sp[i * 3 + 1] = y * 262; sp[i * 3 + 2] = Math.sin(ang) * r * 262;
      }
      const sgeo = new T.BufferGeometry();
      sgeo.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
      const starMat = new T.PointsMaterial({ color: 0xf2f6ff, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
      const stars = new T.Points(sgeo, starMat);
      stars.renderOrder = -999; stars.visible = false;
      g.add(stars);

      // ---- 流星（3 片加色细长面片，夜间偶发；沿切向划过天际并略下坠）----
      const meteors = new T.Group(); meteors.visible = false;
      const meteorList = [];
      for (var mi = 0; mi < 3; mi++) {
        var mm = new T.Mesh(
          new T.PlaneGeometry(0.7, 26),          // 长轴沿局部 Y → 与运动方向对齐
          new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide })
        );
        var az = Math.random() * Math.PI * 2, el = 0.34 + Math.random() * 0.62;
        var sx = Math.cos(az) * Math.cos(el), sy = Math.sin(el) + 0.18, sz = Math.sin(az) * Math.cos(el);
        var sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1; sx /= sl; sy /= sl; sz /= sl;
        var flip = Math.random() < 0.5 ? 1 : -1;
        var tx = -sz * flip, ty = -0.45, tz = sx * flip;
        var tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        mm.position.set(sx * 232, sy * 232, sz * 232);
        var msc = 0.6 + Math.random() * 0.8;
        mm.scale.set(msc, msc, msc);
        mm.visible = false;
        meteors.add(mm);
        meteorList.push({
          mesh: mm,
          start: [sx * 232, sy * 232, sz * 232],
          tang: [tx, ty, tz],
          len: 60 + Math.random() * 55,
          period: 9 + Math.random() * 9, off: Math.random() * 17, dur: 0.10 + Math.random() * 0.06
        });
      }
      g.add(meteors);

      // ---- 立体云朵：3D 蓬松球簇，整环缓慢漂移（共享一份材质，随时段染色）----
      const clouds = new T.Group();
      const cloudMat = new T.MeshStandardMaterial({
        color: 0xffffff, emissive: 0x223044, emissiveIntensity: 0.55, roughness: 1.0, metalness: 0.0, fog: false
      });
      const PUFF = [
        [0.0, 0.0, 0.0, 1.6], [1.6, 0.2, 0.2, 1.1], [-1.5, 0.25, -0.2, 1.15],
        [0.7, 0.7, 0.3, 0.95], [-0.7, 0.7, 0.1, 0.95], [0.1, 1.15, 0.0, 0.8],
        [2.4, -0.1, -0.3, 0.8], [-2.3, 0.0, 0.1, 0.85], [1.0, -0.4, 0.3, 0.7],
        [-1.0, -0.5, -0.2, 0.75]
      ];
      var puffs = [];
      for (var ci = 0; ci < PUFF.length; ci++) puffs.push(new T.SphereGeometry(PUFF[ci][3], 16, 12));
      for (var k = 0; k < 10; k++) {
        var cg = new T.Group();
        var s = 9 + Math.random() * 6;
        for (var pi = 0; pi < PUFF.length; pi++) {
          var p = PUFF[pi];
          var b = new T.Mesh(puffs[pi], cloudMat);
          b.scale.setScalar(s);
          b.position.set(p[0] * s, p[1] * s, p[2] * s);
          cg.add(b);
        }
        var ca = (k / 10) * Math.PI * 2 + Math.random() * 0.5;
        var cr = 150 + Math.random() * 60;
        cg.position.set(Math.cos(ca) * cr, 42 + Math.random() * 52, Math.sin(ca) * cr);
        cg.rotation.y = Math.random() * Math.PI;
        clouds.add(cg);
      }
      g.add(clouds);

      g.userData = {
        dome: dome, sun: sun, sunGlow: sunGlow, moon: moon, moonGlow: moonGlow,
        clouds: clouds, cloudMat: cloudMat, stars: stars, starMat: starMat,
        starsGrp: stars, meteors: meteors, meteorList: meteorList, lastDt: 0
      };
      state.group = g;                       // 接管：昼夜状态是模块级的，换关重建只需换引用
      refresh();
      return g;
    },
    update: function (inst, dt) {
      inst.userData.lastDt = dt;
    }
  };
})(window);
