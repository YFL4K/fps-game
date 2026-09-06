#!/usr/bin/env python3
# v7.1 headless E2E test — 按用户更新图鉴表调整全部敌人参数（血量/伤害/速度/射程/间隔/击杀分/掉落）
import sys
from playwright.sync_api import sync_playwright

URL = "file:///run/csi/mount-root/nas/4079184d856ecc166ed19d4887083405/workspaces/default/fps-game/index.html#test"
results = []

def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + ("  | " + str(extra) if extra else ""))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium",
                                args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                      "--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(2500)

    def st():
        return page.evaluate("window.__fpsTest.getState()")

    # 0. versionTag
    vtag = page.text_content("#versionTag")
    check("versionTag == v7.1", vtag.strip() == "v7.1", vtag)

    # 1. 进入游戏
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)
    s = st()
    check("game started L1", s["state"] == "playing" and s["levelIndex"] == 0, s)

    # 2. 普通敌人图鉴表参数（L1 无 stats 加成：human 60血/8伤/速度1/射程15/间隔3s；monster 90/10/1.25/20/4s；spider 40/20/2.8/1.5/4s）
    h = page.evaluate("window.__fpsTest.spawnEnemyParamTest('human')")
    check("human params 60/8/1/15/3", h and h["health"] == 60 and h["damage"] == 8 and h["speed"] == 1 and h["range"] == 15 and h["cd"] == 3.0, h)
    m = page.evaluate("window.__fpsTest.spawnEnemyParamTest('monster')")
    check("monster params 90/10/1.25/20/4", m and m["health"] == 90 and m["damage"] == 10 and m["speed"] == 1.25 and m["range"] == 20 and m["cd"] == 4.0, m)
    sp = page.evaluate("window.__fpsTest.spawnEnemyParamTest('spider')")
    check("spider params 40/20/2.8/explode1.5", sp and sp["health"] == 40 and sp["damage"] == 20 and sp["speed"] == 2.8 and sp["explodeRange"] == 1.5, sp)

    # 3. 普通敌人击杀分（human 100 / monster 150 / spider 150，L1 levelIndex=0）
    check("human score 100", h and h["score"] == 100, h)
    check("monster score 150", m and m["score"] == 150, m)
    check("spider score 150", sp and sp["score"] == 150, sp)

    # 4. 猪头佳：血量 1000、触发 10 杀、撞玩家 5~20、击杀掉落
    r = page.evaluate("window.__fpsTest.spawnPigTest()")
    s = st()
    check("spawn pig ok", r["spawned"] and s["pig"]["alive"] and s["pig"]["count"] == 1, (r, s["pig"]))
    ph = page.evaluate("window.__fpsTest.pigHp()")
    check("pig health 1000", ph == 1000, ph)
    r2 = page.evaluate("window.__fpsTest.pigRamPlayerTest()")
    check("pig ram player dmg 5~20", r2["ok"], r2)
    # 触发阈值：清计数后 9 杀不触发，第 10 杀触发
    page.evaluate("window.__fpsTest.setPlayerPos(0, 0.1, 20)")
    page.evaluate("window.__fpsTest.killPigTest()")
    page.evaluate("window.__fpsTest.advancePig(0.1)")
    page.evaluate("window.__fpsTest.resetCounters()")
    r9 = page.evaluate("window.__fpsTest.triggerPigCounter(9)")
    check("9 kills no pig yet", r9["alive"] is False and r9["kills"] == 9, r9)
    r10 = page.evaluate("window.__fpsTest.triggerPigCounter(1)")
    check("10th kill triggers pig", r10["alive"] is True, r10)
    # 猪头佳击杀掉落：各类至少出现一次（120 次循环，缺该类概率 ≈0）
    page.evaluate("window.__fpsTest.killPigTest()")
    page.evaluate("window.__fpsTest.advancePig(0.1)")
    pd = page.evaluate("window.__fpsTest.pigDropsTest(120)")
    d = pd["drops"]
    check("pig drops rocket 20%", d["weapon"] > 0, d["weapon"])
    check("pig drops ammo/flame 20%", d["ammo"] > 0, d["ammo"])
    check("pig drops walkie 10%", d["walkie"] > 0, d["walkie"])
    check("pig drops nuke 10%", pd["nukesDelta"] > 0, pd["nukesDelta"])
    check("pig drops health 30%", d["health"] > 0, d["health"])
    check("pig drops shield 10%", d["shield"] > 0, d["shield"])

    # 5. 机甲 BOSS：25 杀触发、1500 血/速度1/射程35/间隔1s/击杀分2000
    page.evaluate("window.__fpsTest.killPigTest()")
    page.evaluate("window.__fpsTest.advancePig(0.1)")
    page.evaluate("window.__fpsTest.resetCounters()")
    b24 = page.evaluate("window.__fpsTest.triggerBossCounter(24)")
    check("24 kills no boss yet", b24["alive"] is False and b24["kills"] == 24, b24)
    b25 = page.evaluate("window.__fpsTest.triggerBossCounter(1)")
    bs = page.evaluate("window.__fpsTest.bossState()")
    check("25th kill spawns boss", bs["alive"] is True and bs["health"] == 1500, bs)
    check("boss params speed1/range35/cd1/score2000", bs["speed"] == 1 and bs["range"] == 35 and bs["cd"] == 1.0 and bs["score"] == 2000, bs)
    # 击杀 BOSS：核弹+1、对讲机必掉
    kb = page.evaluate("window.__fpsTest.killBossTest()")
    check("kill boss gives nuke+1 & walkie & clears", kb.get("nukesDelta") == 1 and kb.get("walkieDropped") is True and kb.get("bossAlive") is False, kb)

    # 6. 直升机：血量 250、伤害 20、每关 2 次限制移除（可连续出现多架）
    hs = page.evaluate("window.__fpsTest.spawnHelicopterTest()")
    check("heli params health250/dmg20", hs and hs["health"] == 250 and hs["damage"] == 20, hs)
    hm = page.evaluate("window.__fpsTest.heliMultiTest(3)")
    check("heli no 2-per-level cap", hm["spawnedCount"] >= 2, hm)

    # 7. 普通敌人掉落（human/monster/spider 各 120 次）：弹药60/回血30/金盾10 + 蜘蛛额外火箭筒/喷火弹
    ed = page.evaluate("window.__fpsTest.enemyDropsTest(120)")
    a = ed["after"]
    check("normal drops ammo>0 health>0 shield>0", a["ammo"] > 0 and a["health"] > 0 and a["shield"] > 0, a)

    # 8. 运行时无 JS 错误
    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)
