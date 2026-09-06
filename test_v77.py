#!/usr/bin/env python3
# v7.7 headless E2E test — 猪伤害+50%/速度+40% · BOSS伤害+50%/速度+40% · 大体积挡体穿模修复 · 加特林枪管显示 + 回归
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

    vtag = page.text_content("#versionTag")
    check("versionTag == v7.7", vtag.strip() == "v7.7", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- v7.4 回归：pigTrigger 需在无猪状态下跑（放在所有会创建猪的测试之前） ---
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills (no pig yet)", pg["ok"], pg)

    # --- v7.7 需求1：猪头佳伤害 +50% / 速度 +40% ---
    spd = page.evaluate("window.__fpsTest.pigSpeedTest()")
    check("pig speed 13 -> 18.2 (+40%)", spd["ok"], spd)
    pd = page.evaluate("window.__fpsTest.pigPlayerDmgTest()")
    check("pig charge dmg base x1.5 (8~30, clamped 8~20)", pd["ok"], {k: v for k, v in pd.items() if k != "ok"})
    ld = page.evaluate("window.__fpsTest.pigLaserDpsValueTest()")
    check("pig laser dps 20 -> 30 (clamped 20 on player)", ld["ok"], ld)

    # --- v7.7 需求2：BOSS 伤害 +50% / 速度 +40% ---
    bs = page.evaluate("window.__fpsTest.bossStatsTest()")
    check("boss L3 dmg 36 / speed 1.4 (+50%/+40%)", bs["ok"], bs)

    # --- v7.7 需求3：大体积敌人下方不再穿模 ---
    cb = page.evaluate("window.__fpsTest.collideBigTest()")
    check("player pushed out from under pig (no clip)", cb["ok"], cb)

    # --- v7.7 需求4：加特林开火显示枪管（隐藏玩家枪） ---
    gv = page.evaluate("window.__fpsTest.gatlingGunVisibleTest()")
    check("gatling active hides player gun, exit restores", gv["ok"], gv)

    # --- v7.6 回归 ---
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("helicopter 750 / pig 12000 / boss 22500", h["ok"], h)
    s = page.evaluate("window.__fpsTest.shieldKillTest()")
    check("shield +0.5s per kill (cap 60)", s["ok"], s)
    b = page.evaluate("window.__fpsTest.bgmVolumeTest()")
    check("bgm master 0.16 -> 0.24 (+50%)", b["ok"], b)
    sw = page.evaluate("window.__fpsTest.pigLaserPitchSweepTest()")
    check("laser pitch sweeps 30~50 deg", sw["ok"], {k: v for k, v in sw.items() if k != "ok"})
    b2 = page.evaluate("window.__fpsTest.berserkTest()")
    check("berserk 30% + instant on hit", b2["ok"])

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)