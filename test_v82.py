#!/usr/bin/env python3
# v8.2 headless E2E test — 猪头佳强化(生命/自爆) · 激光俯角35~75 · 双手持枪 · 回归
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
    check("versionTag == v8.2", vtag.strip() == "v8.2", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- 回归：pigTrigger 需在无猪状态下跑（放在所有会创建猪的测试之前） ---
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills", pg["ok"], pg)

    # --- v8.2 需求1：猪生命 24000 ---
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("pig health 12000 -> 24000 (x2)", h["ok"], h)

    # --- v8.2 需求2：激光俯角 35°~75° ---
    ls = page.evaluate("window.__fpsTest.pigLaserPitchSweepTest()")
    check("laser pitch sweeps 35~75 deg", ls["ok"], ls)

    # --- v8.2 需求3：双手持枪 ---
    hs = page.evaluate("window.__fpsTest.handsTest()")
    check("all 6 guns two-handed (handR + handL)", hs["ok"], hs)

    # --- 枪模无残缺（手部 mesh 已跳过） ---
    gc = page.evaluate("window.__fpsTest.gunClipTest()")
    check("6 guns intact at hip FOV75", gc["ok"], gc)

    # --- 回归 ---
    s = page.evaluate("window.__fpsTest.shieldKillTest()")
    check("shield 15s base +0.5/kill cap 15", s["ok"], s)
    rk = page.evaluate("window.__fpsTest.gunStatsTest()")
    check("rocket dmg 210 / aoe 255", rk["ok"], rk)
    am = page.evaluate("window.__fpsTest.awardMilestoneTest()")
    check("air-support stacks to 3", am["ok"], am)
    ic = page.evaluate("window.__fpsTest.itemCapTest()")
    check("air cap 3 + nuke cap 1", ic["ok"], ic)
    bs = page.evaluate("window.__fpsTest.bossStatsTest()")
    check("boss L3 dmg 36 / speed 1.4", bs["ok"], bs)
    cb = page.evaluate("window.__fpsTest.collideBigTest()")
    check("big-enemy no-clip", cb["ok"], cb)

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)