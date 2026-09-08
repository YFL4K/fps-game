# fps-game v8.4（2026-09-06）

## 需求（用户原话）
1. 增加喷气飞行器道具：击杀普通敌人 5% 掉落 + 每 5000 分自动获得（不累积上限1用完作废），蓝色飞机标志，按空格向上飞，高度到机甲BOSS头顶平齐，15秒超时掉落
2. 狙击步枪射速 1→3发/秒，换弹 2→1秒
3. 机甲BOSS 增加紫色激光武器，伤害同猪头佳激光
4. 霸王龙敌人：红眼黑灰皮肤、体型与BOSS相当、每1000分随机出现、喷火+踩踏无差别+毁坏物品、吃蘑菇、血量24000、60秒自爆
5. 删除持枪手型；枪模只显前半枪身(枪托不显示)；瞄准(除狙击)只显枪管+准星

## 实施
- **jetpack**：models/jetpack.js（蓝色喷气背包+双翼+信标）；spawnJetpackDrop/applyJetpack；onEnemyKilled 普通敌人 5% 掉落；checkScoreMilestone 5000分给1；updatePlayer 空格启动飞行（vel.y=12 上升）+ getJetpackCeiling 钳制 BOSS 头顶 + 15秒超时下落
- **狙击**：GUN_TYPES.sniper fireRate 1.0→3.0, reload 2.0→1.0
- **BOSS激光**：enemy.js u.laserTimer/laserBeams + update 机甲BOSS(weapon==='rocket')每4秒 fireMechLaser（头部向玩家穿透射线，玩家hitPlayer(30)、敌人takeDamage(50)、紫色光束）
- **霸王龙**：models/trex.js（黑灰+红眼+尾+腿+小前爪）；spawnTrex/checkTrexSpawn(每1000分随机50%)/onTrexSelfDestruct；onEnemyKilled 'trex' 分支；吃蘑菇(靠近移除)、喷火(fireCd 前方扇形)、踩踏(stompCd 脚下AOE)、60秒自爆
- **枪模改造**：注释 buildHands 删手；枪托 part='stock' 隐藏；枪管 part='barrel'/准星 part='sight'；主程序 render 循环瞄准(非狙击)隐藏 body

## 测试（test_v84.py 14/14 通过）
- gunStatsTest(狙击3/1)、jetpackTest(上限1)、trexTest(24000/60s)、handsTest(枪托隐藏+枪管tag)、gunClipTest(0残缺)
- 回归全过
- push 时远程有 "Create CNAME" 提交 → git pull --rebase 解决

## 发布
- commit 1003ae4「v8.4: jetpack item + sniper 3rps + boss laser + T-rex enemy + gun stock removal/aim slim」push 成功
- README 履历 v8.4 已加

## 当前数值口径
- 狙击 3发/秒/换弹1s；霸王龙 24000血/60s/喷火踩踏/吃蘑菇；jetpack 上限1/15秒/BOSS头顶高度
- BOSS激光 玩家30/敌人50（钳制后玩家20）；猪 24000/defense2/激光35~75