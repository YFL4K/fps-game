#!/usr/bin/env python3
# v7.2 headless E2E test — 按用户更新武器道具表调整参数（武器数值/步枪初始自带/宝箱50%/宝箱道具概率/猪头佳掉落30%）
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

    # 0. versionTag
    vtag = page.text_content("#versionTag")
    check("versionTag == v7.2", vtag.strip() == "v7.2", vtag)

    # 1. 进入游戏
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1200)

    # 2. 武器参数（表：手枪60/6/0.5；步枪35/15/1；喷火100/35/1.5/射程60；狙击300/1/2/射程300；火箭筒射程200；加特林40/30/120）
    w = page.evaluate("window.__fpsTest.weaponParamTest()")
    check("pistol 60/6/0.5", w["pistol"]["damage"] == 60 and w["pistol"]["fireRate"] == 6.0 and w["pistol"]["reload"] == 0.5, w["pistol"])
    check("rifle 35/15/1", w["rifle"]["damage"] == 35 and w["rifle"]["fireRate"] == 15.0 and w["rifle"]["reload"] == 1.0, w["rifle"])
    check("flamethrower 100/35/1.5/range60", w["flamethrower"]["damage"] == 100 and w["flamethrower"]["fireRate"] == 35.0 and w["flamethrower"]["reload"] == 1.5 and w["flamethrower"]["range"] == 60, w["flamethrower"])
    check("sniper 300/1/2/range300", w["sniper"]["damage"] == 300 and w["sniper"]["fireRate"] == 1.0 and w["sniper"]["reload"] == 2.0 and w["sniper"]["range"] == 300, w["sniper"])
    check("rocket range200", w["rocket"]["range"] == 200, w["rocket"])
    check("gatling 40/30/120", w["gatling"]["damage"] == 40 and w["gatling"]["rate"] == 30 and w["gatling"]["range"] == 120, w["gatling"])

    # 3. 步枪初始自带：开局切换步枪即可用（弹匣30/备弹240）
    r = page.evaluate("window.__fpsTest.rifleInitialTest()")
    check("rifle initial switch ok", r["gun"] == "rifle" and r["ammo"] == 30 and r["reserve"] == 240, r)

    # 4. 宝箱道具概率（10/40/40/10）
    c = page.evaluate("window.__fpsTest.chestItemTest(400)")
    n = sum(c.values())
    speed_p, dmg_p, health_p, nuke_p = c["speed"] / n, c["damage"] / n, c["health"] / n, c["nuke"] / n
    check("chest item dist 10/40/40/10",
          abs(speed_p - 0.40) < 0.06 and abs(dmg_p - 0.40) < 0.06 and abs(health_p - 0.10) < 0.05 and abs(nuke_p - 0.10) < 0.05,
          {k: round(v / n, 3) for k, v in c.items()})

    # 5. 武器掉落分布（无步枪：火箭筒20%/狙击35%/喷火45%）
    d = page.evaluate("window.__fpsTest.weaponDropDistTest(300)")
    nd = sum(d.values())
    rk, sn, fl = d["rocket"] / nd, d["sniper"] / nd, d["flamethrower"] / nd
    check("weapon drop no rifle & 20/35/45", d["rifle"] == 0 and abs(rk - 0.20) < 0.06 and abs(sn - 0.35) < 0.06 and abs(fl - 0.45) < 0.06, {k: round(v / nd, 3) for k, v in d.items()})

    # 6. 猪头佳掉落：对讲机/核弹 30%（120 次循环统计明显高于原 10%）
    pd = page.evaluate("window.__fpsTest.pigDropsTest(200)")
    check("pig walkie/nuke drop 30%", pd["drops"]["walkie"] > 20 and pd["nukesDelta"] > 20, {"walkie": pd["drops"]["walkie"], "nukes": pd["nukesDelta"]})

    # 7. 运行时无 JS 错误
    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)
