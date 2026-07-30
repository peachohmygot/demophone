/**
 * ============================================================================
 *  สคริปต์จัดการชีตเครื่อง DEMO — มี 2 ส่วน
 *
 *  PART 1: จัดรูปแบบชีตหลัก 'รวม'
 *  PART 2: สร้างหน้าค้นหา 'ดึงข้อมูลขอรูป'
 *
 *  ⚠️  คอลัมน์ A = Photo ID ของจริง
 *      สคริปต์นี้ไม่มีคำสั่งเขียนลงคอลัมน์ A แม้แต่บรรทัดเดียว
 *      ไม่ไล่เลขใหม่ ไม่เขียนทับ
 *      ตอนเรียงข้อมูลจะเรียง "ทั้งแถวพร้อมกันทุกคอลัมน์"
 *      ID ในคอลัมน์ A จึงติดไปกับแถวของมันเสมอ
 *
 *  วิธีใช้: Extensions > Apps Script > วางทับ > Save > รีเฟรชชีต
 *          จะมีเมนู "⚙️ จัดการสต๊อก" ขึ้นบนแถบเมนู (สั่งจาก iPad ได้เลย)
 * ============================================================================
 */

var SRC_SHEET = 'รวม';                 // ชีตข้อมูลหลัก
var OUT_SHEET = 'ดึงข้อมูลขอรูป';       // ชีตหน้าค้นหา
var START_ROW = 3;                     // ข้อมูลเริ่มแถวที่ 3 (แถว 1-2 = หัวตาราง)


/* ---------------------------------------------------------------------------
 * เมนูบนหน้าชีต
 * ------------------------------------------------------------------------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ จัดการสต๊อก')
    .addItem('▶️  รันทั้งหมด (Part 1 + 2)', 'runAll')
    .addSeparator()
    .addItem('1️⃣  จัดรูปแบบชีต รวม', 'formatMainSheet')
    .addItem('2️⃣  สร้างหน้าดึงข้อมูลขอรูป', 'buildSearchSheet')
    .addToUi();
}

function runAll() {
  formatMainSheet();
  buildSearchSheet();
  toast_('เสร็จเรียบร้อยทั้ง 2 ส่วน ✅');
}


/* ===========================================================================
 *  PART 1 — จัดรูปแบบชีต 'รวม'
 * ========================================================================= */
function formatMainSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SRC_SHEET);
  if (!sh) throw new Error('ไม่พบชีตชื่อ "' + SRC_SHEET + '"');

  var lastCol = Math.max(sh.getLastColumn(), 17);   // อย่างน้อยถึงคอลัมน์ Q

  // --- 1) ล้างสูตรใน M:Q ก่อน ---------------------------------------------
  // จำเป็นมาก: ถ้ายังมี ARRAYFORMULA ค้างอยู่ การ sort ทั้งช่วงจะ error
  // ว่า "กำลังพยายามแก้ไขบางส่วนของช่วงที่มีสูตรอาร์เรย์"
  // คอลัมน์ M-Q เป็นสูตรล้วน ลบทิ้งได้ เดี๋ยวใส่กลับหลังเรียงเสร็จ
  var lastRow = sh.getLastRow();
  if (lastRow >= START_ROW) {
    sh.getRange(START_ROW, 13, lastRow - START_ROW + 1, 5).clearContent();
  }

  // --- 2) ลบแถวคั่นเก่า ----------------------------------------------------
  // เพื่อให้รันสคริปต์ซ้ำได้โดยไม่มีแถวว่างสะสม
  removeBlankRows_(sh, lastCol);

  // --- 3) เรียงข้อมูล (สำคัญที่สุด) -----------------------------------------
  // ครอบทุกคอลัมน์ตั้งแต่ A ถึงคอลัมน์สุดท้าย ทั้งแถวจึงขยับไปพร้อมกัน
  // คอลัมน์ A ติดไปกับแถวของมันแน่นอน
  lastRow = sh.getLastRow();
  if (lastRow > START_ROW) {
    sh.getRange(START_ROW, 1, lastRow - 2, lastCol).sort([
      { column: 3,  ascending: true },   // C = รุ่น
      { column: 8,  ascending: true },   // H = วันที่
      { column: 12, ascending: true }    // L = ราคา
    ]);
  }

  // --- 4) ใส่สูตรกลับเข้าไป ------------------------------------------------
  sh.getRange('M3').setFormula('=ARRAYFORMULA(IF(L3:L="","", L3:L*0.3))');
  sh.getRange('N3').setFormula('=ARRAYFORMULA(IF(L3:L="","", L3:L-M3:M))');
  sh.getRange('O3').setFormula('=ARRAYFORMULA(IF(N3:N="","", N3:N/6))');
  sh.getRange('P3').setFormula('=ARRAYFORMULA(IF(N3:N="","", N3:N/12))');
  sh.getRange('Q3').setFormula('=ARRAYFORMULA(IF(N3:N="","", N3:N/18))');

  // --- 5) ตรึงแถว ----------------------------------------------------------
  sh.setFrozenRows(2);
  // หมายเหตุ: ไม่ตรึงคอลัมน์ เพราะหัวตารางมีเซลล์ที่ผสาน (merge) คร่อมอยู่
  // ถ้าเรียก setFrozenColumns(3) จะขึ้น error
  // "Cannot freeze columns containing only a portion of a merged cell"

  // --- 6) Drop-down --------------------------------------------------------
  // ใส่ก่อนแทรกแถวคั่น เพราะแถวคั่นต้องถูกล้าง validation ทีหลัง
  var vRows = sh.getMaxRows() - START_ROW + 1;

  var brandRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['APPLE', 'HUAWEI', 'OPPO', 'REAL ME', 'SAMSUNG',
                         'VIVO', 'XIAOMI', 'MI', 'ALLDOCUBE'], true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(START_ROW, 2, vRows, 1).setDataValidation(brandRule);

  var branchRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['สต๊อก', 'มวกเหล็ก', 'แก่งคอย', 'หนองแค', 'โลตัส'], true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(START_ROW, 7, vRows, 1).setDataValidation(branchRule);

  // --- 7) สีตามเงื่อนไข -----------------------------------------------------
  sh.clearConditionalFormatRules();

  var gRange = sh.getRange(START_ROW, 7, vRows, 1);   // G = สาขา
  var hRange = sh.getRange(START_ROW, 8, vRows, 1);   // H = วันที่

  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('มวกเหล็ก')
      .setBackground('#CFE2F3')                       // ฟ้าอ่อน
      .setRanges([gRange]).build(),

    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('แก่งคอย')
      .setBackground('#D9EAD3')                       // เขียวอ่อน
      .setRanges([gRange]).build(),

    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($H3<>"", $H3<TODAY()-365)')
      .setBackground('#F4CCCC')                       // แดงอ่อน = ค้างเกิน 1 ปี
      .setRanges([hRange]).build()
  ]);

  // --- 8) แทรกแถวคั่นเวลารุ่น (คอลัมน์ C) เปลี่ยน ---------------------------
  // ไล่จากล่างขึ้นบน เพื่อไม่ให้ตำแหน่งแถวที่ยังไม่ทำเลื่อน
  lastRow = sh.getLastRow();
  if (lastRow > START_ROW) {
    var n = lastRow - START_ROW + 1;
    var models = sh.getRange(START_ROW, 3, n, 1).getValues();

    for (var i = n - 1; i > 0; i--) {
      if (String(models[i][0]).trim() === String(models[i - 1][0]).trim()) continue;

      var row = START_ROW + i;
      sh.insertRowBefore(row);

      var sep = sh.getRange(row, 1, 1, lastCol);
      sep.setBackground('#F3F3F3');
      sep.clearDataValidations();
    }
  }

  // --- 9) ความสูงแถว 35px + จัดกลางแนวตั้ง (กดง่ายบน iPad) -----------------
  lastRow = sh.getLastRow();
  if (lastRow >= START_ROW) {
    var rows = lastRow - START_ROW + 1;
    sh.setRowHeights(START_ROW, rows, 35);
    sh.getRange(START_ROW, 1, rows, lastCol).setVerticalAlignment('middle');
  }

  toast_('จัดรูปแบบชีต ' + SRC_SHEET + ' เรียบร้อย ✅');
}


/**
 * ลบเฉพาะแถวที่ "ว่างทั้งแถว" (A ถึงคอลัมน์สุดท้าย)
 * ไม่แตะแถวที่มีข้อมูลแม้แต่ช่องเดียว และไม่ลบแถวแรกของข้อมูล
 */
function removeBlankRows_(sh, lastCol) {
  var lastRow = sh.getLastRow();
  if (lastRow < START_ROW) return;

  var n = lastRow - START_ROW + 1;
  var vals = sh.getRange(START_ROW, 1, n, lastCol).getValues();
  var end = -1;

  for (var i = n - 1; i >= -1; i--) {
    var blank = (i >= 1) && vals[i].every(function (v) {
      return v === '' || v === null;
    });

    if (blank && end < 0) end = i;
    if (!blank && end >= 0) {
      sh.deleteRows(START_ROW + i + 1, end - i);   // ลบทีละกลุ่มที่ติดกัน
      end = -1;
    }
  }
}


/* ===========================================================================
 *  PART 2 — สร้างหน้าค้นหา 'ดึงข้อมูลขอรูป'
 * ========================================================================= */
function buildSearchSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sh = ss.getSheetByName(OUT_SHEET);
  if (sh) {
    sh.clear();
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
    sh.clearConditionalFormatRules();
  } else {
    sh = ss.insertSheet(OUT_SHEET);
  }

  // --- A1: ป้ายหัวเรื่อง ---------------------------------------------------
  sh.getRange('A1')
    .setValue('พิมพ์เลขลำดับเครื่องที่นี่ ⬇️')
    .setFontWeight('bold')
    .setFontSize(14)
    .setBackground('#FFF2CC')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 42);

  // --- A2: ช่องกรอก --------------------------------------------------------
  sh.getRange('A2')
    .setBackground('#D9EAD3')
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false,
               '#666666', SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.setRowHeight(2, 52);

  // --- A4: ข้อความผลลัพธ์ --------------------------------------------------
  var S = "'" + SRC_SHEET + "'!";

  // ตารางค้นหาแปลงคอลัมน์ A เป็นข้อความก่อน
  // เพื่อให้ค้นเจอทั้งกรณี ID เก็บเป็นตัวเลข (5) และเป็นข้อความ ("2.1")
  var table = '{ARRAYFORMULA(TO_TEXT(' + S + '$A$3:$A)),' + S + '$B$3:$L}';

  var formula =
    '=IF($A$2="","",LET(' +
      'k, TO_TEXT($A$2),' +
      't, ' + table + ',' +
      'IFERROR(' +
        '"รบกวนขอรูปเครื่องเพื่ออัพลงเว็บหน่อยครับ"&CHAR(10)&' +
        '"📌 ลำดับเครื่อง: "&VLOOKUP(k,t,1,FALSE)&CHAR(10)&' +
        '"📱 ยี่ห้อ/รุ่น: "&VLOOKUP(k,t,2,FALSE)&" "&VLOOKUP(k,t,3,FALSE)&CHAR(10)&' +
        '"🎨 สี: "&VLOOKUP(k,t,4,FALSE)&" (ความจุ "&VLOOKUP(k,t,5,FALSE)&")"&CHAR(10)&' +
        '"🔢 IMEI: "&VLOOKUP(k,t,9,FALSE)&CHAR(10)&' +
        '"💰 ราคาขาย: "&TEXT(VLOOKUP(k,t,12,FALSE),"#,##0")&" บาท",' +
        '"❌ ไม่พบลำดับ "&$A$2&" ในชีต ' + SRC_SHEET + '"' +
      ')))';

  sh.getRange('A4')
    .setFormula(formula)
    .setFontSize(12)
    .setVerticalAlignment('top')
    .setHorizontalAlignment('left')
    .setWrap(true);
  sh.setRowHeight(4, 180);

  // --- ความกว้างคอลัมน์ 450px ให้อ่านสวยบน iPad ----------------------------
  sh.setColumnWidth(1, 450);

  ss.setActiveSheet(sh);
  sh.getRange('A2').activate();   // เคอร์เซอร์รออยู่ที่ช่องกรอกเลย

  toast_('สร้างหน้า ' + OUT_SHEET + ' เรียบร้อย ✅');
}


/* ---------------------------------------------------------------------------
 * ตัวช่วย
 * ------------------------------------------------------------------------- */
function toast_(msg) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'จัดการสต๊อก', 5);
}
