# fps-game v8.3（2026-09-06）

## 需求（用户原话）
1. 猪头佳对玩家子弹造成伤害的防护增强 2 倍
2. 地图中有 BOSS 出现时猪头佳优先攻击 BOSS
3. 玩家所有枪械的枪管准星改成发绿光，狂暴模式时准星发红光
4. 玩家手持枪和换弹的模型太粗糙，不像人类手型，重新做

## 实施
- **猪防弹**：pig.js `defense: 1 → 2`（takeDamage 里 `u.health -= dmg/(u.defense||1)`，减伤 50%）
- **猪优先攻击 BOSS**：pig.js 目标选择——先扫描 BOSS（enemyType==='boss'），存在则 best 直接锁 BOSS，否则走原最近目标逻辑
- **准星绿/红**：HUD #crosshair CSS color 改 #33ff66 + text-shadow 绿光；render 循环 crosshairEl.style.color 按 player.berserk 切换 #ff3333/#33ff66；gun.js 新增 sightGlow 发光球（枪口上方），update 里按 berserk 变色
- **手型重做**：buildHands 的 makeHand 从 box 拳改为手掌(box 扁)+4 指(圆柱指节,抓握弯曲)+拇指(圆柱)+前臂，更接近人手

## 测试（test_v83.py 14/14 通过）
- pigSpeedTest 扩展 defense=2；pigBossPriorityTest（猪 dx>0 朝 BOSS）；crosshairTest（绿/红）；handsTest
- 回归全过
- 踩坑：pigTriggerTest 仍要放最前（pigSpeedTest/pigBossPriorityTest 会创建猪）

## 发布
- commit 待 push；README 履历 v8.3 已加
- 手型 mesh 增加 → gunClipTest kit 数变大（pistol 34 mesh 等），hip 仍 0 残缺

## 当前数值口径
- 猪：24000 血 / defense 2（减伤50%）/ 自爆半径20伤260 / 激光35~75 / 90s自爆 / 优先攻击BOSS
- 准星：绿 #33ff66（常态）/ 红 #ff3333（狂暴）