# 🎮 程序化 FPS 射击游戏

一个**零依赖、纯前端、程序化生成**的第一人称射击游戏。双击 `index.html` 即可游玩 —— 无服务器、无构建、无安装。

![GitHub License](https://img.shields.io/github/license/yourname/fps-game)

> 📌 所有模型（敌人、枪械、建筑、树木）全部由 three.js 代码程序化生成，**没有任何外部美术资源**。音效由 WebAudio 实时合成。

## ✨ 功能特性

- 🔫 **4 种武器**：手枪 / 步枪 / 霰弹枪 / 狙击枪
  - 每种武器伤害、射速、弹匣、换弹时间、射程、散射均不同
  - 数字键 `1-4` 切换；场景固定掉落 + 敌人死亡 **25% 概率**掉落随机武器
- 💥 **爆头机制**：命中头部伤害 ×3，带红色命中标记与专属音效
- 🗺️ **90×90 大地图**：8 栋程序化建筑、15 棵树木、箱子/油桶/灯柱掩体
- 🎯 **5 关任务关卡**：击杀目标递增（10 → 42），敌人数量/血量/伤害逐关增强
- ✨ **特效**：弹道曳光、发光子弹、命中火花 + 扩散环、枪口闪光、后坐力动画
- 🤖 **智能敌人**：双手持枪瞄准、靠近后站定射击、受击闪红、死亡倒地、重生
- 🔊 **程序化音效**：不同武器不同枪声，命中/爆头/拾取/换弹/受伤/过关音效全部实时合成
- 🛡️ **健壮性**：任何模块加载失败不崩溃，错误面板提示 + 占位模型兜底

## 🎮 操作说明

| 操作 | 按键 |
| --- | --- |
| 移动 | `W A S D` |
| 冲刺 | `Shift` |
| 跳跃 | `Space` |
| 射击（可连发） | 鼠标左键 |
| 换弹 | `R` |
| 切换武器 | `1 2 3 4` |
| 进入下一关 | `E` |
| 调试飞行模式 | `F9` |
| 暂停 | `Esc` |

## 🚀 运行方式

### 方式一：直接打开（推荐，零配置）
```bash
# 双击即可
open index.html    # macOS
# 或 Windows 双击 index.html
```

### 方式二：本地静态服务器
```bash
# 使用 Python
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000

# 或使用 Node（需先 npm install 无需任何依赖，仅脚本）
npm start          # 启动 http-server
```

### 方式三：GitHub Pages 在线游玩
推送到 GitHub 后，在仓库 **Settings → Pages** 选择 `main` 分支 `/` 目录部署即可，几分钟后即可通过 `https://<用户名>.github.io/<仓库名>/` 在线游玩。

## 🗂️ 项目结构

```
fps-game/
├── index.html          # 主程序（全部核心逻辑内联）
├── three.min.js        # three.js r147 UMD 本地库
├── scene-layout.js     # 场景布局（90×90 大地图）
├── DESIGN.md           # 设计文档
├── models/             # 程序化模型（每个文件一个独立模块）
│   ├── enemy.js        # 敌人（持枪 AI + 动画 + 子弹 + 爆头判定）
│   ├── gun.js          # 第一人称枪械（4 种武器外观 + 后坐力）
│   ├── weapon.js       # 武器拾取物
│   ├── building.js     # 建筑（房屋/仓库）
│   ├── tree.js         # 树木
│   ├── crate.js        # 箱子掩体
│   ├── wall.js         # 围墙
│   ├── floor.js        # 地板
│   ├── target.js       # 射击靶
│   ├── pickup.js       # 血包/弹药拾取物
│   ├── sky.js          # 天空盒
│   ├── lamp.js         # 灯柱
│   ├── obstacle.js     # 障碍物
│   └── spawner.js      # 刷怪点
```

## 🧰 技术栈

- **Three.js r147**（经典 script 引入，无打包器）
- **原生 JavaScript**（ES5/ES6 兼容，无框架）
- **WebAudio API**（程序化音效）
- **Pointer Lock API**（鼠标视角）

## 📝 开发约定

- 模型文件统一注册到 `window.MODELS[name]`，接口为 `{ create(config, ctx), update?(inst, dt, ctx), onHit?(inst, point, ctx) }`
- 场景布局通过 `window.SCENE_LAYOUT` 配置，支持自定义实体属性（`health`/`speed`/`kind`/`score` 等）
- 敌人 AI 全部封装在 `models/enemy.js`，主程序只做通用加载与渲染

## 📄 License

[MIT](LICENSE) © 2026

---

**试玩愉快！如果喜欢这个项目，欢迎 ⭐ Star。**
