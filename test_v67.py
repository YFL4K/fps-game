#!/usr/bin/env python3
# v6.7 headless E2E test — 场景美化 + 真实枪模 + 对讲机空袭 + 右键瞄准 + 滚轮切枪 + 敌伤平衡
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
    check("versionTag == v6.7", vtag.strip() == "v6.7", vtag)

    # 1. 过关模式 L1 → 新场景模型随机分布
    page.click("#modeStoryBtn")
    page.wait_for_timeout(1800)
    s = st()
    sc = s["scenery"]
    check("birds groups >= 2", sc["birds"] >= 2, sc)
    check("bigtree >= 2", sc["bigtree"] >= 2, sc)
    check("highwall >= 2", sc["highwall"] >= 2, sc)
    check("ferriswheel >= 1", sc["ferris"] >= 1, sc)
    check("grass >= 5", sc["grass"] >= 5, sc)
    check("boulder >= 3", sc["boulder"] >= 3, sc)

    # 2. 滚轮循环切换武器（无火箭筒时跳过 rocket）
    page.evaluate("document.dispatchEvent(new WheelEvent('wheel', {deltaY: 120, cancelable: true}))")
    page.wait_for_timeout(200)
    s = st()
    check("wheel next -> rifle", s["gun"] == "rifle", s["gun"])
    page.evaluate("document.dispatchEvent(new WheelEvent('wheel', {deltaY: 120, cancelable: true}))")
    page.wait_for_timeout(200)
    s = st()
    check("wheel next -> flamethrower", s["gun"] == "flamethrower", s["gun"])
    page.evaluate("document.dispatchEvent(new WheelEvent('wheel', {deltaY: -120, cancelable: true}))")
    page.wait_for_timeout(200)
    s = st()
    check("wheel prev -> rifle", s["gun"] == "rifle", s["gun"])
    # 连续滚 20 次也不应切到 rocket（未拥有）
    seen_rocket = False
    for _ in range(20):
        page.evaluate("document.dispatchEvent(new WheelEvent('wheel', {deltaY: 120, cancelable: true}))")
        page.wait_for_timeout(60)
        if st()["gun"] == "rocket":
            seen_rocket = True
            break
    check("wheel skips unowned rocket", not seen_rocket)

    # 3. 右键瞄准：步枪 FOV 缩小
    page.evaluate("document.dispatchEvent(new WheelEvent('wheel', {deltaY: -120, cancelable: true}))")  # 回到 pistol
    page.wait_for_timeout(200)
    page.mouse.down(button="right")
    page.wait_for_timeout(600)
    s = st()
    check("right-click aim on", s["aiming"] and s["fov"] < 75, (s["aiming"], s["fov"]))
    check("pistol aim fov ~50", abs(s["fov"] - 50) < 3, s["fov"])
    page.mouse.up(button="right")
    page.wait_for_timeout(600)
    s = st()
    check("right-click aim off, fov back", not s["aiming"] and s["fov"] > 70, (s["aiming"], s["fov"]))

    # 4. 狙击 4 倍镜：Digit4 切狙击 → 瞄准 → scopeOn + fov ~18
    page.keyboard.press("Digit4")
    page.wait_for_timeout(200)
    check("switch to sniper", st()["gun"] == "sniper", st()["gun"])
    page.mouse.down(button="right")
    page.wait_for_timeout(900)
    s = st()
    check("sniper scope overlay on", s["scopeOn"], (s["scopeOn"], s["fov"]))
    check("sniper 4x fov ~18", abs(s["fov"] - 18) < 3, s["fov"])
    page.mouse.up(button="right")
    page.wait_for_timeout(600)
    s = st()
    check("scope off after release", not s["scopeOn"])

    # 5. 对讲机：拾取（脚下刷出）→ walkie=true；重复拾取不累积
    page.keyboard.press("KeyQ")
    page.wait_for_timeout(400)
    s = st()
    check("walkie pickup sets flag", s["walkie"] and s["scenery"]["walkies"] == 0, (s["walkie"], s["scenery"]["walkies"]))
    page.keyboard.press("KeyQ")
    page.wait_for_timeout(400)
    s = st()
    check("re-pickup keeps single use (no stack)", s["walkie"], s["walkie"])

    # 6. 使用对讲机 → 空中支援导弹发射 → 用完作废
    page.keyboard.press("KeyU")
    page.wait_for_timeout(300)
    s = st()
    check("air support launched", s["airstrikes"] > 0, s["airstrikes"])
    check("walkie consumed", not s["walkie"], s["walkie"])
    # headless 帧率低：确定性推进 updateAirstrikes（等效 4 秒），导弹应全部命中爆炸
    impacted = page.evaluate("window.__fpsTest.advanceAirstrikes(80)")
    check("airstrikes all impacted", impacted == 0, impacted)
    page.keyboard.press("KeyU")
    page.wait_for_timeout(300)
    s = st()
    check("cannot use again (no walkie)", s["airstrikes"] == 0, s["airstrikes"])

    # 7. 敌人伤害钳制：hitPlayer(100) → 扣 20；hitPlayer(2) → 扣 5
    page.keyboard.press("KeyM")  # 满血
    page.wait_for_timeout(200)
    hp0 = st()["hp"]
    page.evaluate("window.__fpsTest.hitPlayerTest(100)")
    page.wait_for_timeout(200)
    s = st()
    check("clamp max 20 (hit 100)", hp0 - s["hp"] == 20, (hp0, s["hp"]))
    page.evaluate("window.__fpsTest.hitPlayerTest(2)")
    page.wait_for_timeout(200)
    s = st()
    check("clamp min 5 (hit 2)", hp0 - s["hp"] == 25, (hp0, s["hp"]))
    # 中弹不死：连续 10 发 100 伤害也只掉 200（需要满血 300 以上才不触发死亡，直接验证单发数值即可）
    page.evaluate("window.__fpsTest.hitPlayerTest(100)")
    page.evaluate("window.__fpsTest.hitPlayerTest(100)")
    s = st()
    check("no one-shot kill (two max hits)", s["state"] == "playing", s["state"])

    # 8. 鸟类/摩天轮动画无报错（已跑 4s+，无 pageerror 即通过）
    runtime_errs = [e for e in errs if "favicon" not in e.lower() and "net::" not in e.lower() and "403" not in e]
    check("no runtime errors", len(runtime_errs) == 0, runtime_errs[:5])

    browser.close()

fails = [r for r in results if not r[1]]
print("\n==== %d/%d passed ====" % (len(results) - len(fails), len(results)))
if fails:
    print("FAILED:", [f[0] for f in fails])
    sys.exit(1)
