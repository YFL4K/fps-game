#!/usr/bin/env python3
# v7.8 headless E2E test — 空中支援/核弹 上限1·不累积·不重复拾取 + 回归
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
    check("versionTag == v7.8", vtag.strip() == "v7.8", vtag)

    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # --- v7.8：上限 1 / 不累积 / 不重复拾取 ---
    ic = page.evaluate("window.__fpsTest.itemCapTest()")
    check("nuke cap 1 & air-support cap 1 (no stack, no re-drop)", ic["ok"], ic)
    am = page.evaluate("window.__fpsTest.awardMilestoneTest()")
    check("5k milestone: bonus never stacks above 1, use resets", am["ok"], am)

    # --- 回归 ---
    pg = page.evaluate("window.__fpsTest.pigTriggerTest()")
    check("pig trigger at 10 kills (no pig yet)", pg["ok"], pg)
    h = page.evaluate("window.__fpsTest.enemyHealthTest()")
    check("helicopter 750 / pig 12000 / boss 22500", h["ok"], h)
    s = page.evaluate("window.__fpsTest.shieldKillTest()")
    check("shield +0.5s per kill (cap 60)", s["ok"], s)
    b = page.evaluate("window.__fpsTest.bgmVolumeTest()")
    check("bgm master 0.24 (+50%)", b["ok"], b)
    bs = page.evaluate("window.__fpsTest.bossStatsTest()")
    check("boss L3 dmg 36 / speed 1.4", bs["ok"], bs)

    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)