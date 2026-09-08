# fps-game v7.7（2026-09-06）

## 需求（用户原话）
1. 猪头佳对玩家攻击伤害 +50%、移动速度 +40%
2. BOSS 机甲伤害 +50%、移动速度 +40%
3. 玩家在猪头佳/BOSS 机甲下方严重穿模 → 修复
4. 加特林开火显示加特林枪管，不要显示玩家枪

## 实施
- **pig.js**：`LASER_DPS_PLAYER 20→30`；撞玩家 `hitPlayer(5+rand16)` → `Math.round(×1.5)` = 8~30；`index.html` spawnPig `speed: 13→18.2`
- **index.html**：关卡 BOSS——L3 `damage 24→36, speed 1.0→1.4`；L4 `30→45, 1.15→1.61`；L5 `36→54, 1.3→1.82`；spawnBoss `dmgTable → [36,36,36,45,54]`，`speed: 1` 改 `bossSpeed = b.speed || 1.4`（此前写死 1）
- **穿模**：新增 `collideBigEntities()`（在 collideWorld 之后每帧调用），对 model==='pig' 或 (model==='enemy' && enemyType==='boss') 用世界 AABB 挡体——玩家脚底 < 实体顶部且水平投影侵入 → 水平推挤到 AABB 外；玩家高于实体顶可从上方越过
- **加特林 bug 根因**：主循环 `if (gunInst) gunInst.visible = !scopeOn;` 每帧覆盖 enterGatling 的隐藏 → 改为 `!scopeOn && !(player.gatling && player.gatling.active)`

## 测试（test_v77.py 14/14 通过）
- 新增钩子：pigSpeedTest（18.2）、pigPlayerDmgTest（30 次撞击 min8/max20）、pigLaserDpsValueTest（钳制后 20）、bossStatsTest（L3 cfg.damage 36 / speed 1.4 且 spawnBoss 实体一致）、collideBigTest（猪 AABB 中心推出 dist 3.6 > 2.6）、gatlingGunVisibleTest（enter 后 gunInst.visible=false / 主循环表达式 false / exit 后 true）
- 回归：pigTrigger / enemyHealth / shieldKill / bgmVolume / pigLaserPitchSweep / berserk 全过
- **坑**：pigTriggerTest 断言 before===false，必须放在所有会创建猪的测试之前跑

## 发布
- commit c5cfdc6「v7.7: pig/boss dmg+50% speed+40% big-enemy no-clip gatling barrel view」push 成功
- README 更新履历 v7.7 已加；线上 GitHub Pages 验证 versionTag=v7.7（部署后 1~2 分钟）

## 当前数值口径
- 猪头佳：12000 血 / 撞 8~30（钳 8~20）/ 激光 30/s（钳 20）/ 速度 18.2
- BOSS：22500 血 / L3-L5 伤害 36/45/54（钳 20）/ 速度 1.4/1.61/1.82
- 钳制约束不变：hitPlayer 单次 5~20（核弹自伤 30% 不钳）