# Parity A — comparing the sheets in Excel

A quick guide for reviewing `parity-sheet1-csv.csv` (source BEAM CSV values) against
`parity-sheet2-json.csv` (catalogue values) by hand in Excel, with green/red cells.

The harness (`schema/scripts/csv-json-parity.mjs`) already produces `parity-sheet3-diff.csv`
with the per-cell verdict — this guide is for verifying it independently, or for poking
at the data live.

## Setup (once)

Get both value sheets into **one** workbook as tabs, and rename them so formulas stay
clean (Excel needs single-quotes around hyphenated tab names like `'parity-sheet1-csv'`,
which is fiddly):

- Tab `csv` ← `parity-sheet1-csv.csv`
- Tab `json` ← `parity-sheet2-json.csv`
- Add a third tab `diff`

The harness writes both sheets in **identical row/column order**, so `B27` on `csv` and
`B27` on `json` are guaranteed to be the same record + field — which is what makes a
same-address comparison valid.

## The formula

On the `diff` tab, cell **B27**:

```
=IF(json!B27=csv!B27,"Match","Mismatch")
```

Drag-fill across and down to cover the whole grid. The cell shows the word; conditional
formatting (below) colors it.

If you keep the hyphenated tab names instead of renaming:

```
=IF('parity-sheet2-json'!B27='parity-sheet1-csv'!B27,"Match","Mismatch")
```

**Tolerant version** (recommended for number columns — mirrors the harness's ±0.5% so
tiny rounding doesn't flag red):

```
=IF(AND(ISNUMBER(csv!B27),ISNUMBER(json!B27)),
   IF(ABS(json!B27-csv!B27)<=0.005*MAX(ABS(csv!B27),ABS(json!B27))+0.01,"Match","Mismatch"),
   IF(TRIM(csv!B27)=TRIM(json!B27),"Match","Mismatch"))
```

## Green / red coloring (conditional formatting)

1. Select the filled `diff` range.
2. **Home → Conditional Formatting → New Rule → "Format only cells that contain"** →
   Cell Value **equal to** `Match` → Format → fill **green**.
3. Add a second rule: equal to `Mismatch` → fill **red**.

## One-click alternative (VBA macro)

Prefer a button to filling formulas? `Alt+F11` → Insert → Module → paste → run
`BuildParityDiff`. It compares tabs `csv` vs `json`, writes Match/Mismatch into `diff`,
and colors as it goes (±0.5% tolerance on numbers).

```vba
Sub BuildParityDiff()
    Dim wsA As Worksheet, wsB As Worksheet, wsD As Worksheet
    Set wsA = Sheets("csv"): Set wsB = Sheets("json")
    On Error Resume Next: Set wsD = Sheets("diff"): On Error GoTo 0
    If wsD Is Nothing Then Set wsD = Sheets.Add(After:=wsB): wsD.Name = "diff"

    Dim lastRow As Long, lastCol As Long, r As Long, c As Long, same As Boolean, a, b
    lastRow = wsA.Cells(wsA.Rows.Count, 1).End(xlUp).Row
    lastCol = wsA.Cells(1, wsA.Columns.Count).End(xlToLeft).Column

    For r = 1 To lastRow
        For c = 1 To lastCol
            If r = 1 Then
                wsD.Cells(r, c).Value = wsA.Cells(r, c).Value   ' header row
            Else
                a = wsA.Cells(r, c).Value: b = wsB.Cells(r, c).Value
                If IsNumeric(a) And IsNumeric(b) And a <> "" And b <> "" Then
                    same = Abs(CDbl(b) - CDbl(a)) <= 0.005 * Application.Max(Abs(CDbl(a)), Abs(CDbl(b))) + 0.01
                Else
                    same = (StrComp(Trim(CStr(a)), Trim(CStr(b)), vbTextCompare) = 0)
                End If
                With wsD.Cells(r, c)
                    .Value = IIf(same, "Match", "Mismatch")
                    .Interior.Color = IIf(same, RGB(198, 239, 206), RGB(255, 199, 206))
                    .Font.Color = IIf(same, RGB(0, 97, 0), RGB(156, 0, 6))
                End With
            End If
        Next c
    Next r
    wsD.Rows(1).Font.Bold = True
End Sub
```

## Notes

- Columns **A** (`beam_id`) and **B** (`epd_id`) are identical between the two sheets, so
  the meaningful comparisons start at column **C**. The formula/macro handle every column
  uniformly regardless.
- Rows are clustered by canonicalized `epd.id`, so all products from one EPD sit together —
  handy for reviewing a multi-product EPD as a set.
- "Derived" columns (Carbon content kgC/unit, Full C value) are *computed* in the catalogue,
  not copied from the CSV, so a red there is a QA signal (computed vs spreadsheet-stated),
  not an import bug. See `parity-summary.md`.
