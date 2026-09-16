/**
 * _mario.js — 超级马里奥3D世界风格材质工具（v10.6）
 * 高饱和明亮任天堂调色板 + 光滑塑胶玩具质感（MeshStandardMaterial 高光）
 * 注册: window.MARIO
 * 仅改变视觉渲染，不改动任何 userData/碰撞/逻辑
 */
(function (global) {
  var T = global.THREE;

  /** 任天堂高饱和明亮调色板：提升颜色的饱和度与亮度（高亮色保持明亮不失真） */
  function boostColor(hex) {
    var c = new T.Color(hex);
    var hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    // 饱和度提升
    hsl.s = Math.min(1, hsl.s * 1.35 + 0.05);
    // 亮度分段提升：暗色提亮，中亮温和提亮，高亮保持
    if (hsl.l < 0.45) {
      hsl.l = Math.min(0.7, hsl.l * 1.25 + 0.12);
    } else if (hsl.l < 0.8) {
      hsl.l = Math.min(0.86, hsl.l * 1.08 + 0.03);
    } else {
      hsl.l = Math.min(1.0, hsl.l);
    }
    c.setHSL(hsl.h, hsl.s, hsl.l);
    return c;
  }

  /** 塑胶玩具质感材质（替代 MeshLambertMaterial，带高光） */
  function mat(params) {
    params = params || {};
    var copy = {};
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) copy[k] = params[k];
    if (copy.color !== undefined) copy.color = boostColor(copy.color);
    // 圆润塑胶质感：低粗糙度（高光）、微弱金属
    copy.roughness = copy.roughness !== undefined ? Math.min(0.5, copy.roughness * 0.55) : 0.3;
    copy.metalness = copy.metalness !== undefined ? Math.min(0.25, copy.metalness) : 0.03;
    return new T.MeshStandardMaterial(copy);
  }

  /** 发光材质（替代 MeshBasicMaterial，用于灯/发光提示/眼睛） */
  function basic(params) {
    params = params || {};
    var copy = {};
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) copy[k] = params[k];
    if (copy.color !== undefined) copy.color = boostColor(copy.color);
    return new T.MeshBasicMaterial(copy);
  }

  /* v11.13 共享材质：静态场景模型（楼/树/草/墙/箱/台阶/道具…经核实在运行时绝不改自己的
   * 材质属性）按参数缓存复用 —— 基线实测 661 个唯一 MeshStandardMaterial，每帧都要各自上传
   * uniform；收敛后只剩几十份。标 __shared 后主程序销毁单个实体不会把它 dispose 掉。
   * 会改材质的模型（enemy 受击闪红、spider、target、gatling、gun、spawner）请继续用 mat/basic。 */
  var _matCache = {}, _basicCache = {};
  function keyOf(params) {
    var ks = Object.keys(params).sort(), s = '';
    for (var i = 0; i < ks.length; i++) {
      var v = params[ks[i]];
      if (v && v.isTexture) s += ks[i] + ':tex' + v.id + ',';
      else if (v && v.isColor) s += ks[i] + ':' + v.getHexString() + ',';
      else s += ks[i] + ':' + v + ',';
    }
    return s;
  }
  function matS(params) {
    params = params || {};
    var k = keyOf(params);
    var m = _matCache[k];
    if (!m) { m = _matCache[k] = mat(params); m.__shared = true; }
    return m;
  }
  function basicS(params) {
    params = params || {};
    var k = keyOf(params);
    var m = _basicCache[k];
    if (!m) { m = _basicCache[k] = basic(params); m.__shared = true; }
    return m;
  }

  global.MARIO = {
    mat: mat,
    basic: basic,
    matS: matS,
    basicS: basicS,
    boostColor: boostColor
  };
})(window);
