# 把 100 人榜單 ＋ 已對上的 UID map ＋ 待查清單，匯整成一份 Excel
# 用法：python alliance/build-uid-excel.py
import json
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent
snap = json.load(open(next(iter((ROOT / "transfer-scores").glob("*.json"))), encoding="utf-8"))
umap = json.load(open(ROOT / "uid-map.json", encoding="utf-8"))

# 建立 lookup：三種來源
exact = umap["players"]
renamed = umap["possibly_renamed"]
# alliance_mismatch 寫在 needs_your_check 裡但其實有 UID，提取出來
mismatch_names = {}
for s in umap["needs_your_check"].get("alliance_mismatch", []):
    name = s.split(" ")[0]
    mismatch_names[name] = s

wb = Workbook()
ws = wb.active
ws.title = "100 人 UID 對照"

# 顏色與樣式
header_font = Font(bold=True, color="FFFFFF", size=11)
header_fill = PatternFill("solid", fgColor="1F4E78")
qax_fill    = PatternFill("solid", fgColor="FFF2CC")  # 自己聯盟 highlight
need_fill   = PatternFill("solid", fgColor="FFCCCC")  # 需要填 UID
done_fill   = PatternFill("solid", fgColor="E2EFDA")  # 已有 UID
rename_fill = PatternFill("solid", fgColor="FFE699")  # 疑似改名
mismatch_fill = PatternFill("solid", fgColor="D9E1F2")  # 聯盟不符
thin = Side(border_style="thin", color="BFBFBF")
border = Border(left=thin, right=thin, top=thin, bottom=thin)
center = Alignment(horizontal="center", vertical="center")
left_wrap = Alignment(horizontal="left", vertical="center", wrap_text=True)

# Header
headers = ["#", "玩家名（榜上）", "聯盟（榜上）", "分數", "UID", "狀態", "試算表上的名字 / 備註"]
for col, h in enumerate(headers, 1):
    c = ws.cell(1, col, h); c.font = header_font; c.fill = header_fill; c.alignment = center; c.border = border

# Sort: qax 先、再其他聯盟
alliance_order = ["qax", "CAN", "Qzx", "TR1", "SKS"]
def sort_key(e):
    a = e["alliance"]
    return (alliance_order.index(a) if a in alliance_order else 99, e["rank"])
entries = sorted(snap["entries"], key=sort_key)

row = 2
for e in entries:
    name = e["player"]
    uid = ""
    status = ""
    note_cell = ""
    row_fill = None

    if name in exact:
        rec = exact[name]
        uid = rec["uid"]
        status = f"✅ 已對上（{rec['confidence']}）"
        note_cell = rec.get("note", "")
        row_fill = done_fill
    elif name in renamed:
        rec = renamed[name]
        uid = rec["candidate_uid"]
        status = "🔄 疑似改名（請核對）"
        note_cell = f"表上寫「{rec['candidate_name_sheet']}」({rec['alliance_sheet']}) — {rec['reason']}"
        row_fill = rename_fill
    elif name in mismatch_names:
        status = "⚠️ 聯盟對不上（可能轉盟）"
        note_cell = mismatch_names[name]
        row_fill = mismatch_fill
    else:
        status = "❓ 要你填"
        row_fill = need_fill

    # qax 聯盟統一上黃底（優先處理）—— 不覆蓋更強的狀態色
    if e["alliance"] == "qax" and row_fill in (need_fill, None):
        row_fill = qax_fill if row_fill is None else row_fill

    cells = [
        (e["rank"], center),
        (name, left_wrap),
        (e["alliance"], center),
        (f'{e["score"]:,}', Alignment(horizontal="right", vertical="center")),
        (uid, center),
        (status, left_wrap),
        (note_cell, left_wrap),
    ]
    for col, (val, align) in enumerate(cells, 1):
        c = ws.cell(row, col, val)
        c.alignment = align
        c.border = border
        if row_fill:
            c.fill = row_fill
    row += 1

# 欄寬
widths = [5, 30, 10, 14, 15, 20, 50]
for i, w in enumerate(widths, 1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.row_dimensions[1].height = 24
ws.freeze_panes = "A2"
ws.auto_filter.ref = ws.dimensions

# 第二頁：填 UID 操作提示
ws2 = wb.create_sheet("使用說明")
tips = [
    ["🏔️ 3209 轉州分數追蹤 — UID 對照表"],
    [""],
    ["目的：補完每個玩家的 UID，之後比對更穩（名字會改、UID 不會變）"],
    [""],
    ["顏色說明："],
    ["  🟨 黃底 = 自己聯盟 qax，優先補"],
    ["  🟩 綠底 = 已從 Google 試算表對上 UID（已自動填好）"],
    ["  🟧 橘底 = 疑似改名，請進遊戲核對是不是同一人"],
    ["  🟦 藍底 = 聯盟對不上（可能這陣子轉盟了）"],
    ["  🟥 紅底 = 試算表上沒資料，需要你去遊戲裡點那個人的頭像看 UID 補進去"],
    [""],
    ["填寫方式："],
    ["  1. 進遊戲地圖，點那個玩家的頭像"],
    ["  2. 彈窗上會看到「ID: 1234567890」之類的數字"],
    ["  3. 把 UID 填進第 5 欄「UID」"],
    ["  4. 如果這人其實是改名過的某個玩家（看聯盟＋分數可大致判斷），"],
    ["     可以在「試算表上的名字 / 備註」那欄註明"],
    [""],
    ["填完後：存檔，告訴 Claude「幫我把 UID 寫回 uid-map.json」"],
]
for i, row_data in enumerate(tips, 1):
    for j, v in enumerate(row_data, 1):
        c = ws2.cell(i, j, v)
        if i == 1:
            c.font = Font(bold=True, size=14, color="1F4E78")
ws2.column_dimensions["A"].width = 70

out = ROOT / "uid-fill-sheet.xlsx"
wb.save(out)
print(f"✅ Excel 已產出：{out}")
print(f"   總筆數：{row - 2}")
