# fps-game v7.9（2026-09-06）

## 需求（用户原话）
1. 所有武器外观重新建模，参考 https://sketchfab.com/Emerald_Eel/collections/free-game-guns-8527f213e48947d8b19d4d0005b03e2e（PSX/LowPoly 游戏枪）
2. 枪械模型部分空缺残缺、仅右键瞄准正常 → 彻底修复
3. 火箭筒伤害 +50%
4. 猪头佳自爆 30s → 90s
5. 护盾 30s → 15s，击杀 +0.5s，上限不超过初始 15s
6. 电脑吃力 → 性能优化

## 实施
- **gun.js 全面重写**（models/gun.js）：6 把枪重新建模（沙漠之鹰/AK-47/泵动霰弹/喷火器/狙击/火箭筒），全部部件 z<0（相机前方），整体前移+上抬+微缩；材质提亮。**残缺根因**：旧版枪托/肩垫 z>0 位于相机后方 + 宽 FOV 屏幕裁切
- **index.html**：buildGun 加 `gunInst.scale.set(0.92,...)`；新增 gunClipTest 钩子（6 枪 NDC 视锥验证，全部 0 bad/0 behind）
- 火箭筒：GUN_TYPES.rocket damage 140→210、aoe.damage 170→255
- 猪自爆：spawnPig cfg.life 30→90 + toast/banner/注释
- 护盾：applyShield shieldTime=15；onEnemyKilled `Math.min(15, +0.5)`；help/toast 文案"15 秒…上限 15 秒"；shieldKillTest 钩子改为 10→10.5、59.9→cap15
- **性能优化**：pixelRatio 2→1.5；FX_MAX=450（updateFx 超出丢弃最老并释放）；spawnDebris 共享 `_debrisGeo` + castShadow=false；spawnCasing 共享 `_casingGeo`；collideEnemies 用 `_tempBoxA`、randomSpawnPos 用 `_tempBoxB`（复用全局 Box3）

## 测试（test_v79.py 13/13 通过）
- gunClipTest：6 把枪 total 9~19 mesh 全部 bad=0 behind=0（视锥内无残缺）
- gunStatsTest（rocket 210/255）、pigSpeedTest 扩展（speed 18.2 + life 90）、shieldKillTest（15s 语义）、perfTest（pixelRatio≤1.5、FX_MAX=450）
- 回归：awardMilestoneTest/itemCapTest（v7.8）、enemyHealth、bgmVolume、bossStats、collideBig（v7.7）全过
- 踩坑：`entities`/`renderer`/`gunInst`/`GUN_TYPES` 都是闭包变量，页面 evaluate 不可见 → 必须通过 __fpsTest 钩子读取

## 发布
- commit 16f868d「v7.9: gun models rebuilt (frustum clip fix) rocket+50% pig 90s fuse shield 15s cap perf optimizations」push 成功
- README 履历 v7.9 已加；线上 GitHub Pages 待验证 versionTag=v7.9

## 当前数值口径
- 火箭筒 210 直伤 / 255 爆炸；猪自爆 90s；护盾 15s（+0.5s/杀，cap 15）
- 渲染：pixelRatio ≤1.5、FX_MAX 450、碎片/弹壳共享几何、全局 Box3 复用