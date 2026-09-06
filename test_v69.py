#!/usr/bin/env python3
# v6.9 headless E2E test — 枪模修复 + 换弹/枪口喷火/抛壳动画 + 爆炸物&火箭筒群体伤害 + 直升机掉核弹 + 蘑菇云 + 金色护盾
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

    vtag = page.text_content("#versionTag")
    check("versionTag == v6.9", vtag.strip() == "v6.9", vtag)

    # 1. 枪模完整性：6 种枪都有 muzzle/eject/flash/anim/beginReload；喷火枪不抛壳
    for gun in ["pistol", "rifle", "shotgun", "sniper", "flamethrower", "rocket"]:
        r = page.evaluate("window.__fpsTest.gunAnimTest('%s')" % gun)
        ok = r["muzzle"] and r["eject"] and r["flash"] and r["anim"] and r["beginReload"]
        check("gun %s structure complete" % gun, ok, r)
        if gun == "flamethrower":
            check("flamethrower no casing", r["casing"] is False, r["casing"])
        else:
            check("gun %s casing enabled" % gun, r["casing"] is True, r["casing"])

    # 2. 换弹动画：弹匣/泵动/拉机柄/弹头 移动后复位
    for gun in ["pistol", "rifle", "shotgun", "sniper", "rocket"]:
        r = page.evaluate("window.__fpsTest.reloadAnimTest('%s')" % gun)
        check("reload anim %s moved+restored" % gun, r["moved"] and r["restored"], r)

    # 3. 进入游戏 → 开火抛壳
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1500)
    page.mouse.down()
    page.wait_for_timeout(400)
    page.mouse.up()
    page.wait_for_timeout(200)
    s = st()
    check("casing fx spawned on fire", (s["fxTypes"].get("casing") or 0) >= 1, s["fxTypes"])

    # 4. 爆炸物对敌 +150%（enemyDmgMul 2.5）
    r1 = page.evaluate("window.__fpsTest.explodeEnemyDmgTest(70, 1)")
    r2 = page.evaluate("window.__fpsTest.explodeEnemyDmgTest(70, 2.5)")
    check("explosive boost 2.5x on enemies", r1 != -1 and r2 != -1 and r2["dmg"] >= r1["dmg"] * 2.4, (r1, r2))

    # 5. 直升机 10% 掉核弹（60 次统计）
    n0 = st()["nukes"]
    got = page.evaluate("window.__fpsTest.helicopterNukeTest(60)")
    n1 = st()["nukes"]
    check("helicopter drops nuke ~10%", got >= 1, (n0, n1, got))

    # 6. 核弹：先闪光 + 蘑菇云
    page.evaluate("window.__fpsTest.giveNuke()")
    r = page.evaluate("window.__fpsTest.detonateNukeTest()")
    s = st()
    check("nuke flash first (sync)", r["flash"] == "1", r)
    check("nuke mushroom cloud spawned", (s["fxTypes"].get("mushroom") or 0) >= 1, s["fxTypes"])

    # 7. 金色盾牌：生成/拾取/减伤 90%/击杀+2秒/超时消失
    page.evaluate("window.__fpsTest.spawnShieldDropTest()")
    page.wait_for_timeout(300)
    s = st()
    check("shield drop spawned", s["scenery"]["shields"] >= 1, s["scenery"]["shields"])
    st0 = page.evaluate("window.__fpsTest.pickupShieldTest()")
    check("pickup shield = 30s", st0 == 30, st0)
    s = st()
    check("shield visible in HUD state", s["shieldTime"] > 29, s["shieldTime"])
    page.keyboard.press("KeyM")  # 满血
    page.wait_for_timeout(300)
    page.evaluate("window.__fpsTest.hitPlayerTest(100)")
    page.wait_for_timeout(150)
    s = st()
    check("shield reduces damage 90% (100→2)", s["hp"] == 98, s["hp"])
    # 击杀 +2 秒（护盾倒计时同时进行；20% 概率掉落新盾会刷新为 30）
    t0 = s["shieldTime"]
    k = page.evaluate("window.__fpsTest.shieldKillTest()")
    check("kill extends shield +2s", k["after"] > k["before"] and (abs(k["after"] - (k["before"] + 2)) < 0.5 or k["after"] == 30), k)
    # 超时消失（33 秒确保倒完）
    r = page.evaluate("window.__fpsTest.advanceShield(33)")
    s = st()
    check("shield expires after timeout", s["shieldTime"] == 0, s["shieldTime"])
    # 护盾结束后无减伤
    page.keyboard.press("KeyM")
    page.wait_for_timeout(300)
    page.evaluate("window.__fpsTest.hitPlayerTest(100)")
    page.wait_for_timeout(150)
    s = st()
    check("no shield reduction after expire", s["hp"] == 80, s["hp"])

    # 8. 运行时无 JS 错误
    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)
