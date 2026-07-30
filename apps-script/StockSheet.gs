/**
 * ============================================================================
 *  ระบบจัดการสต๊อกเครื่อง DEMO — Google Apps Script
 *  ชีต: 'รวม'  |  ข้อมูลเริ่มแถวที่ 3 (แถว 1-2 = หัวตาราง)
 *
 *  วิธีใช้: Extensions > Apps Script > วางโค้ดนี้ > Save > รีเฟรชชีต
 *           จะมีเมนู "⚙️ จัดการสต๊อก" โผล่ขึ้นมาบนแถบเมนู
 * ============================================================================
 */

/* ---------------------------------------------------------------------------
 * ตั้งค่า — แก้ตรงนี้ที่เดียวพอ
 * ------------------------------------------------------------------------- */
var CFG = {
  SHEET_NAME: 'รวม',
  START_ROW: 3,          // ข้อมูลเริ่มแถวนี้
  HEADER_ROW: 2,         // แถวหัวตาราง
  FREEZE_ROWS: 2,
  FREEZE_COLS: 3,
  ROW_HEIGHT: 35,        // สูง 35px กดง่ายบน iPad
  FONT_SIZE: 11,

  // --- สูตรผ่อน ---
  DOWN_PCT: 0.30,        // เงินดาวน์ 30%
  RATE_PER_MONTH: 0.07,  // ดอกเบี้ยคงที่ 7% ต่อเดือน  (ใส่ 0 = หารเฉยๆ ไม่มีดอก)
  TERMS: [6, 12, 18],    // งวดของคอลัมน์ O, P, Q
  CASH_KEYWORDS: ['ขายสด', 'สด'],  // ถ้าคอลัมน์ J เป็นคำพวกนี้ = ไม่คิดผ่อน

  // --- การเรียงข้อมูล ---
  // เรียง B(ยี่ห้อ) > C(รุ่น) > H(วันที่) > L(ราคา)
  // ถ้าอยากได้ตามพรอมต์เดิมเป๊ะๆ เปลี่ยนเป็น [3, 8, 12]
  SORT_BY: [2, 3, 8, 12],

  // --- แจ้งเตือนสต๊อกค้าง ---
  DEAD_DAYS: 365,        // แดง = ค้างเกิน 1 ปี
  WARN_DAYS: 180,        // เหลือง = เฝ้าระวัง

  // --- สวิตช์เปิด/ปิดฟีเจอร์ ---
  NORMALIZE_TEXT: true,  // จัดคำให้ตรงกัน เช่น "I PHONE" -> "APPLE"
  RENUMBER: true,        // ไล่เลขคอลัมน์ A ใหม่ (1, 2, 2.1, 2.2, 3 ...)
  HELPER_COLS: true,     // เพิ่มคอลัมน์ R = อายุสต๊อก, S = สถานะ
  AUTO_BACKUP: true,     // สำรองชีตอัตโนมัติก่อนรัน
  ADD_FILTER: true       // ใส่ตัวกรอง (Filter) ที่หัวตาราง
};

/* คอลัมน์ (เลขคอลัมน์) */
var COL = {
  NO: 1, BRAND: 2, MODEL: 3, COLOR: 4, CAP: 5, NET: 6, BRANCH: 7,
  DATE: 8, IMEI: 9, TERM: 10, COST: 11, PRICE: 12,
  DOWN: 13, REMAIN: 14, T1: 15, T2: 16, T3: 17,
  AGE: 18, STATUS: 19
};
var LAST_COL = 19;   // ถึงคอลัมน์ S

/* สีที่ใช้ */
var CLR = {
  PRICE: '#D9EAD3',      // L  เขียวอ่อน (ราคาขาย)
  T1: '#D9D2E9',         // O  ม่วงอ่อน
  T2: '#CFE2F3',         // P  ฟ้าอ่อน
  T3: '#FFF2CC',         // Q  เหลืองอ่อน
  SEP: '#F3F3F3',        // แถวคั่นรุ่น
  SEP_BRAND: '#D9D9D9',  // แถวคั่นยี่ห้อ (เข้มกว่า)
  HEADER: '#EFEFEF',
  MUAKLEK: '#CFE2F3',    // มวกเหล็ก = ฟ้าอ่อน
  KAENGKHOI: '#D9EAD3',  // แก่งคอย = เขียวอ่อน
  DEAD: '#F4CCCC',       // สต๊อกค้าง = แดงอ่อน
  WARN: '#FFF2CC',       // เฝ้าระวัง = เหลืองอ่อน
  DUP: '#F4CCCC'         // IMEI ซ้ำ
};

/* รายการ Drop-down */
var BRANDS = ['APPLE', 'HUAWEI', 'OPPO', 'REAL ME', 'SAMSUNG',
              'VIVO', 'XIAOMI', 'MI', 'ALLDOCUBE'];
var BRANCHES = ['สต๊อก', 'มวกเหล็ก', 'แก่งคอย', 'หนองแค', 'โลตัส'];

/* ตารางแปลงคำให้ตรงกัน (ซ้ายคือคำที่พิมพ์มา ขวาคือคำมาตรฐาน) */
var BRAND_ALIAS = {
  'IPHONE': 'APPLE', 'I PHONE': 'APPLE', 'APPLE': 'APPLE',
  'REALME': 'REAL ME', 'REAL ME': 'REAL ME', 'REAL_ME': 'REAL ME',
  'REDMI': 'MI', 'MI': 'MI', 'XIAOMI': 'XIAOMI',
  'OPPO': 'OPPO', 'VIVO': 'VIVO', 'SAMSUNG': 'SAMSUNG',
  'HUAWEI': 'HUAWEI', 'ALLDOCUBE': 'ALLDOCUBE'
};
var BRANCH_ALIAS = {
  'สต๊อก': 'สต๊อก', 'สตอก': 'สต๊อก', 'สต็อก': 'สต๊อก', 'stock': 'สต๊อก',
  'มวกเหล็ก': 'มวกเหล็ก', 'แก่งคอย': 'แก่งคอย',
  'หนองแค': 'หนองแค', 'โลตัส': 'โลตัส', 'lotus': 'โลตัส'
};


/* ===========================================================================
 * เมนูบนหน้าชีต
 * ========================================================================= */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ จัดการสต๊อก')
    .addItem('▶️  จัดรูปแบบทั้งหมด (รันตัวนี้พอ)', 'formatStockSheet')
    .addSeparator()
    .addItem('🔢  ใส่สูตรผ่อนใหม่', 'applyFormulas')
    .addItem('🔽  ทำ Drop-down', 'applyValidation')
    .addItem('🎨  ทำสีตามเงื่อนไข', 'applyConditionalFormatting')
    .addItem('↕️  เรียงข้อมูล + แบ่งกลุ่ม', 'sortAndSeparate')
    .addItem('🔁  ไล่เลขลำดับใหม่', 'renumberIndex')
    .addSeparator()
    .addItem('📊  สร้าง/อัปเดต ชีตสรุป', 'buildSummary')
    .addItem('💾  สำรองข้อมูลตอนนี้', 'backupSheet')
    .addItem('🧹  ลบแถวคั่นทั้งหมด', 'removeSeparatorRows')
    .addItem('🔒  ล็อกคอลัมน์สูตร (M:S)', 'protectFormulaColumns')
    .addToUi();
}


/* ===========================================================================
 * ฟังก์ชันหลัก — รันทีเดียวจบ (รันซ้ำได้ ไม่พัง)
 * ========================================================================= */
function formatStockSheet() {
  var sh = getSheet_();

  if (CFG.AUTO_BACKUP) backupSheet_(sh);

  removeFilter_(sh);
  removeSeparatorRows_(sh);            // ล้างแถวคั่นเก่าก่อน เพื่อให้รันซ้ำได้
  if (CFG.NORMALIZE_TEXT) normalizeText_(sh);

  applyLayout_(sh);
  applyFormulas_(sh);
  applyNumberFormats_(sh);
  applyValidation_(sh);
  applyConditionalFormatting_(sh);

  sortData_(sh);
  if (CFG.RENUMBER) renumberIndex_(sh);
  insertSeparators_(sh);

  if (CFG.ADD_FILTER) addFilter_(sh);

  toast_('จัดรูปแบบเรียบร้อยแล้ว ✅');
}


/* ===========================================================================
 * 1) หน้าตา / ตรึงแถว-คอลัมน์ / ความสูงแถว
 * ========================================================================= */
function applyLayout_(sh) {
  sh.setFrozenRows(CFG.FREEZE_ROWS);
  sh.setFrozenColumns(CFG.FREEZE_COLS);

  ensureColumns_(sh, LAST_COL);

  // หัวตาราง
  var head = sh.getRange(CFG.HEADER_ROW, 1, 1, LAST_COL);
  head.setFontWeight('bold')
      .setBackground(CLR.HEADER)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  sh.setRowHeight(CFG.HEADER_ROW, 40);

  if (CFG.HELPER_COLS) {
    sh.getRange(CFG.HEADER_ROW, COL.AGE).setValue('อายุสต๊อก (วัน)');
    sh.getRange(CFG.HEADER_ROW, COL.STATUS).setValue('สถานะ');
  }

  var last = sh.getLastRow();
  if (last < CFG.START_ROW) return;
  var n = last - CFG.START_ROW + 1;

  // สูง 35px + จัดกลางแนวตั้ง — กดง่ายบน iPad
  sh.setRowHeights(CFG.START_ROW, n, CFG.ROW_HEIGHT);

  var body = sh.getRange(CFG.START_ROW, 1, n, LAST_COL);
  body.setVerticalAlignment('middle')
      .setFontSize(CFG.FONT_SIZE)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
      .setBackground('#FFFFFF');   // ล้างสีเก่า แล้วค่อยลงสีใหม่ให้สม่ำเสมอ

  // แถบสีประจำคอลัมน์ (ให้เหมือนของเดิม)
  sh.getRange(CFG.START_ROW, COL.PRICE, n, 1).setBackground(CLR.PRICE);
  sh.getRange(CFG.START_ROW, COL.T1, n, 1).setBackground(CLR.T1);
  sh.getRange(CFG.START_ROW, COL.T2, n, 1).setBackground(CLR.T2);
  sh.getRange(CFG.START_ROW, COL.T3, n, 1).setBackground(CLR.T3);

  // การจัดวางข้อความ
  alignCols_(sh, n, 'center', [COL.NO, COL.COLOR, COL.CAP, COL.NET,
                               COL.BRANCH, COL.DATE, COL.TERM, COL.STATUS]);
  alignCols_(sh, n, 'left',   [COL.BRAND, COL.MODEL]);
  alignCols_(sh, n, 'right',  [COL.COST, COL.PRICE, COL.DOWN, COL.REMAIN,
                               COL.T1, COL.T2, COL.T3, COL.AGE]);
  sh.getRange(CFG.START_ROW, COL.IMEI, n, 1).setHorizontalAlignment('center');

  // ความกว้างคอลัมน์
  var widths = [45, 95, 175, 95, 80, 55, 95, 105, 155, 80,
                85, 90, 85, 95, 85, 85, 85, 85, 95];
  for (var i = 0; i < widths.length; i++) sh.setColumnWidth(i + 1, widths[i]);
}

function alignCols_(sh, n, align, cols) {
  for (var i = 0; i < cols.length; i++) {
    sh.getRange(CFG.START_ROW, cols[i], n, 1).setHorizontalAlignment(align);
  }
}


/* ===========================================================================
 * 2) สูตรอัตโนมัติ (ARRAYFORMULA แถวเดียว คุมทั้งคอลัมน์)
 *
 *    M = เงินดาวน์ 30%
 *    N = ยอดคงเหลือ
 *    O/P/Q = ค่างวด 6/12/18 เดือน  รวมดอกเบี้ยคงที่ 7% ต่อเดือน
 *            สูตร: คงเหลือ × (1 + 0.07 × จำนวนเดือน) ÷ จำนวนเดือน
 *    R = อายุสต๊อก (วัน)   S = สถานะ
 * ========================================================================= */
function applyFormulas() { applyFormulas_(getSheet_()); toast_('ใส่สูตรแล้ว ✅'); }

function applyFormulas_(sh) {
  var r = CFG.START_ROW;

  // ล้างค่าเก่าใน M:S ก่อน — ถ้ามีตัวเลขค้างอยู่ ARRAYFORMULA จะขึ้น #REF!
  // ("ผลลัพธ์อาร์เรย์ไม่ได้ขยายเพราะจะเขียนทับข้อมูล")
  var lastRow = sh.getLastRow();
  if (lastRow >= r) {
    sh.getRange(r, COL.DOWN, lastRow - r + 1, COL.STATUS - COL.DOWN + 1)
      .clearContent();
  }

  // เงื่อนไข "ขายสด" -> ไม่ต้องคิดผ่อน ปล่อยว่างไว้
  var cash = CFG.CASH_KEYWORDS
      .map(function (k) { return '(J' + r + ':J="' + k + '")'; })
      .join('+');
  var skip = '(L' + r + ':L="")' + (cash ? '+' + cash : '');

  sh.getRange(r, COL.DOWN).setFormula(
    '=ARRAYFORMULA(IF(' + skip + ',"",ROUND(L' + r + ':L*' + CFG.DOWN_PCT + ')))');

  sh.getRange(r, COL.REMAIN).setFormula(
    '=ARRAYFORMULA(IF(M' + r + ':M="","",L' + r + ':L-M' + r + ':M))');

  var cols = [COL.T1, COL.T2, COL.T3];
  for (var i = 0; i < CFG.TERMS.length; i++) {
    var t = CFG.TERMS[i];
    var mult = '(1+' + CFG.RATE_PER_MONTH + '*' + t + ')';
    sh.getRange(r, cols[i]).setFormula(
      '=ARRAYFORMULA(IF(N' + r + ':N="","",ROUND(N' + r + ':N*' + mult + '/' + t + ')))');
  }

  if (CFG.HELPER_COLS) {
    sh.getRange(r, COL.AGE).setFormula(
      '=ARRAYFORMULA(IF(H' + r + ':H="","",INT(TODAY()-H' + r + ':H)))');
    sh.getRange(r, COL.STATUS).setFormula(
      '=ARRAYFORMULA(IF(H' + r + ':H="","",' +
        'IF(TODAY()-H' + r + ':H>' + CFG.DEAD_DAYS + ',"สต๊อกค้าง",' +
        'IF(TODAY()-H' + r + ':H>' + CFG.WARN_DAYS + ',"เฝ้าระวัง","ปกติ"))))');
  }
}


/* ===========================================================================
 * 3) รูปแบบตัวเลข / วันที่ / IMEI
 * ========================================================================= */
function applyNumberFormats_(sh) {
  var last = sh.getLastRow();
  if (last < CFG.START_ROW) return;
  var n = last - CFG.START_ROW + 1;

  sh.getRange(CFG.START_ROW, COL.DATE, n, 1).setNumberFormat('dd/MM/yyyy');
  sh.getRange(CFG.START_ROW, COL.IMEI, n, 1).setNumberFormat('@');  // IMEI ต้องเป็นข้อความ
  sh.getRange(CFG.START_ROW, COL.NO, n, 1).setNumberFormat('@');

  for (var c = COL.COST; c <= COL.T3; c++) {
    sh.getRange(CFG.START_ROW, c, n, 1).setNumberFormat('#,##0');
  }
  if (CFG.HELPER_COLS) {
    sh.getRange(CFG.START_ROW, COL.AGE, n, 1).setNumberFormat('#,##0');
  }
}


/* ===========================================================================
 * 4) Drop-down (Data Validation)
 *    ใช้ setAllowInvalid(true) = ถ้ามีข้อมูลเก่าที่ไม่ตรงลิสต์ จะขึ้นสามเหลี่ยม
 *    เตือนเฉยๆ ไม่ block การพิมพ์ ทำให้ไม่รกจอ
 * ========================================================================= */
function applyValidation() { applyValidation_(getSheet_()); toast_('ทำ Drop-down แล้ว ✅'); }

function applyValidation_(sh) {
  var n = sh.getMaxRows() - CFG.START_ROW + 1;
  if (n < 1) return;

  sh.getRange(CFG.START_ROW, COL.BRAND, n, 1)
    .setDataValidation(listRule_(BRANDS));

  sh.getRange(CFG.START_ROW, COL.BRANCH, n, 1)
    .setDataValidation(listRule_(BRANCHES));
}

function listRule_(items) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(items, true)   // true = แสดงลูกศร drop-down
    .setAllowInvalid(true)
    .build();
}


/* ===========================================================================
 * 5) สีตามเงื่อนไข (Conditional Formatting)
 * ========================================================================= */
function applyConditionalFormatting() {
  applyConditionalFormatting_(getSheet_());
  toast_('ทำสีเงื่อนไขแล้ว ✅');
}

function applyConditionalFormatting_(sh) {
  sh.clearConditionalFormatRules();

  var n = sh.getMaxRows() - CFG.START_ROW + 1;
  if (n < 1) return;

  var gRange = sh.getRange(CFG.START_ROW, COL.BRANCH, n, 1);
  var hRange = sh.getRange(CFG.START_ROW, COL.DATE, n, 1);
  var iRange = sh.getRange(CFG.START_ROW, COL.IMEI, n, 1);
  var sRange = sh.getRange(CFG.START_ROW, COL.STATUS, n, 1);

  var rules = [];

  // --- สาขา (คอลัมน์ G) ---
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('มวกเหล็ก').setBackground(CLR.MUAKLEK)
    .setRanges([gRange]).build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('แก่งคอย').setBackground(CLR.KAENGKHOI)
    .setRanges([gRange]).build());

  // --- สต๊อกค้าง (คอลัมน์ H) — เรียงจากเข้มไปอ่อน กฎแรกที่ตรงจะชนะ ---
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($H3<>"",$H3<TODAY()-' + CFG.DEAD_DAYS + ')')
    .setBackground(CLR.DEAD).setFontColor('#990000')
    .setRanges([hRange]).build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($H3<>"",$H3<TODAY()-' + CFG.WARN_DAYS + ')')
    .setBackground(CLR.WARN)
    .setRanges([hRange]).build());

  // --- IMEI ซ้ำ (คอลัมน์ I) — กันลงเครื่องซ้ำ ---
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($I3<>"",COUNTIF($I$3:$I,$I3)>1)')
    .setBackground(CLR.DUP).setBold(true).setFontColor('#990000')
    .setRanges([iRange]).build());

  // --- คอลัมน์สถานะ (S) ---
  if (CFG.HELPER_COLS) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('สต๊อกค้าง').setBackground(CLR.DEAD).setFontColor('#990000')
      .setRanges([sRange]).build());

    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('เฝ้าระวัง').setBackground(CLR.WARN)
      .setRanges([sRange]).build());
  }

  sh.setConditionalFormatRules(rules);
}


/* ===========================================================================
 * 6) เรียงข้อมูล + แทรกแถวคั่น
 * ========================================================================= */
function sortAndSeparate() {
  var sh = getSheet_();
  removeFilter_(sh);
  removeSeparatorRows_(sh);
  sortData_(sh);
  if (CFG.RENUMBER) renumberIndex_(sh);
  insertSeparators_(sh);
  if (CFG.ADD_FILTER) addFilter_(sh);
  toast_('เรียงข้อมูลแล้ว ✅');
}

/**
 * เรียงเฉพาะ A:L เท่านั้น
 * เพราะ M:S เป็น ARRAYFORMULA ถ้าลากไปเรียงด้วยจะขึ้น error
 * "กำลังพยายามแก้ไขบางส่วนของช่วงที่มีสูตรอาร์เรย์"
 */
function sortData_(sh) {
  var last = sh.getLastRow();
  if (last <= CFG.START_ROW) return;

  var specs = CFG.SORT_BY.map(function (c) {
    return { column: c, ascending: true };
  });

  sh.getRange(CFG.START_ROW, 1, last - CFG.START_ROW + 1, COL.PRICE).sort(specs);
}

/**
 * ไล่จากล่างขึ้นบน — พอค่าคอลัมน์ C เปลี่ยน ก็แทรกแถวว่างคั่น
 * (ไล่จากล่างขึ้นบนเพื่อไม่ให้ index ของแถวที่ยังไม่ทำเลื่อน)
 */
function insertSeparators_(sh) {
  var last = sh.getLastRow();
  if (last <= CFG.START_ROW) return;

  var n = last - CFG.START_ROW + 1;
  var vals = sh.getRange(CFG.START_ROW, COL.BRAND, n, 2).getValues(); // B และ C

  for (var i = n - 1; i > 0; i--) {
    var curModel = String(vals[i][1]).trim();
    var prvModel = String(vals[i - 1][1]).trim();
    if (curModel === prvModel) continue;

    var row = CFG.START_ROW + i;
    sh.insertRowBefore(row);

    var brandChanged = String(vals[i][0]).trim() !== String(vals[i - 1][0]).trim();
    var sep = sh.getRange(row, 1, 1, LAST_COL);
    sep.setBackground(brandChanged ? CLR.SEP_BRAND : CLR.SEP);
    sep.clearDataValidations();   // แถวคั่นไม่ต้องมี drop-down
    sh.setRowHeight(row, brandChanged ? 12 : 8);
  }
}

/** ลบแถวคั่น (แถวที่ A:L ว่างหมด) เพื่อให้รันสคริปต์ซ้ำได้ไม่รก */
function removeSeparatorRows() {
  removeSeparatorRows_(getSheet_());
  toast_('ลบแถวคั่นแล้ว ✅');
}

function removeSeparatorRows_(sh) {
  var last = sh.getLastRow();
  if (last < CFG.START_ROW) return;

  var n = last - CFG.START_ROW + 1;
  var vals = sh.getRange(CFG.START_ROW, 1, n, COL.PRICE).getValues();

  // ไล่จากล่างขึ้นบน แล้วลบทีละกลุ่มที่ติดกัน (เร็วกว่าลบทีละแถว)
  // i >= 1 = ห้ามลบแถวที่ 3 เด็ดขาด เพราะเป็นที่อยู่ของ ARRAYFORMULA ทั้งหมด
  var end = -1;
  for (var i = n - 1; i >= -1; i--) {
    var blank = (i >= 1) && vals[i].every(function (v) {
      return v === '' || v === null;
    });

    if (blank && end < 0) end = i;
    if (!blank && end >= 0) {
      sh.deleteRows(CFG.START_ROW + i + 1, end - i);
      end = -1;
    }
  }
}


/* ===========================================================================
 * 7) ไล่เลขลำดับคอลัมน์ A
 *    รุ่นใหม่ = เลขเต็ม (1, 2, 3...)  รุ่นซ้ำ = .1, .2 (ตามที่ใช้อยู่เดิม)
 * ========================================================================= */
function renumberIndex() { renumberIndex_(getSheet_()); toast_('ไล่เลขใหม่แล้ว ✅'); }

function renumberIndex_(sh) {
  var last = sh.getLastRow();
  if (last < CFG.START_ROW) return;

  var n = last - CFG.START_ROW + 1;
  var models = sh.getRange(CFG.START_ROW, COL.MODEL, n, 1).getValues();

  var out = [];
  var main = 0, sub = 0, prev = null;

  for (var i = 0; i < n; i++) {
    var m = String(models[i][0]).trim();
    if (m === '') { out.push(['']); continue; }

    if (m !== prev) { main++; sub = 0; prev = m; }
    else { sub++; }

    out.push([sub === 0 ? String(main) : main + '.' + sub]);
  }

  sh.getRange(CFG.START_ROW, COL.NO, n, 1)
    .setNumberFormat('@')
    .setValues(out);
}


/* ===========================================================================
 * 8) จัดคำให้ตรงกัน (ยี่ห้อ / สาขา)
 *    เช่น "I PHONE" กับ "IPHONE" -> "APPLE" เพื่อให้ drop-down กับสรุปยอดตรงกัน
 *    ไม่อยากให้แก้ข้อมูล: ตั้ง CFG.NORMALIZE_TEXT = false
 * ========================================================================= */
function normalizeText_(sh) {
  var last = sh.getLastRow();
  if (last < CFG.START_ROW) return;
  var n = last - CFG.START_ROW + 1;

  // ยี่ห้อ (B)
  var bR = sh.getRange(CFG.START_ROW, COL.BRAND, n, 1);
  var b = bR.getValues();
  for (var i = 0; i < n; i++) {
    var k = String(b[i][0]).trim().toUpperCase().replace(/\s+/g, ' ');
    if (k === '') continue;
    b[i][0] = BRAND_ALIAS[k] || k;
  }
  bR.setValues(b);

  // สาขา (G)
  var gR = sh.getRange(CFG.START_ROW, COL.BRANCH, n, 1);
  var g = gR.getValues();
  for (var j = 0; j < n; j++) {
    var v = String(g[j][0]).trim();
    if (v === '') continue;
    g[j][0] = BRANCH_ALIAS[v] || BRANCH_ALIAS[v.toLowerCase()] || v;
  }
  gR.setValues(g);
}


/* ===========================================================================
 * 9) ชีตสรุป — แยกตามสาขา / ยี่ห้อ + รายการสต๊อกค้าง
 * ========================================================================= */
function buildSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = 'สรุป';
  var sh = ss.getSheetByName(name);
  if (sh) sh.clear(); else sh = ss.insertSheet(name);

  var src = "'" + CFG.SHEET_NAME + "'!A3:L";
  var dead = CFG.DEAD_DAYS;

  sh.getRange('A1').setValue('📊 สรุปสต๊อกเครื่อง DEMO')
    .setFontSize(16).setFontWeight('bold');
  sh.getRange('A2').setFormula('="อัปเดตล่าสุด: "&TEXT(NOW(),"dd/MM/yyyy HH:mm")')
    .setFontColor('#666666');

  sh.getRange('A4').setValue('จำนวนเครื่องทั้งหมด').setFontWeight('bold');
  sh.getRange('B4').setFormula('=COUNTA(' + src.replace('A3:L', 'C3:C') + ')');

  sh.getRange('A5').setValue('มูลค่าสต๊อกรวม').setFontWeight('bold');
  sh.getRange('B5').setFormula('=SUM(' + src.replace('A3:L', 'L3:L') + ')')
    .setNumberFormat('#,##0');

  sh.getRange('A6').setValue('สต๊อกค้างเกิน ' + dead + ' วัน').setFontWeight('bold');
  sh.getRange('B6').setFormula(
    '=COUNTIFS(' + src.replace('A3:L', 'H3:H') + ',"<"&TODAY()-' + dead + ',' +
    src.replace('A3:L', 'H3:H') + ',"<>")').setFontColor('#990000');

  sh.getRange('A8').setValue('▍ แยกตามสาขา').setFontWeight('bold');
  sh.getRange('A9').setFormula(
    '=QUERY(' + src + ',"select G, count(C), sum(L) ' +
    'where C is not null and G is not null group by G ' +
    "order by count(C) desc " +
    "label G 'สาขา', count(C) 'จำนวน', sum(L) 'มูลค่า'\",0)");

  sh.getRange('F8').setValue('▍ แยกตามยี่ห้อ').setFontWeight('bold');
  sh.getRange('F9').setFormula(
    '=QUERY(' + src + ',"select B, count(C), sum(L) ' +
    'where C is not null and B is not null group by B ' +
    "order by count(C) desc " +
    "label B 'ยี่ห้อ', count(C) 'จำนวน', sum(L) 'มูลค่า'\",0)");

  sh.getRange('A20').setValue('▍ รายการสต๊อกค้างเกิน ' + dead + ' วัน')
    .setFontWeight('bold').setFontColor('#990000');
  sh.getRange('A21').setFormula(
    '=QUERY(' + src + ',"select B,C,D,G,H,L where H is not null and H < date \'"' +
    '&TEXT(TODAY()-' + dead + ',"yyyy-mm-dd")&"\' order by H asc ' +
    "label B 'ยี่ห้อ', C 'รุ่น', D 'สี', G 'สาขา', H 'วันที่รับ', L 'ราคา'\",0)");

  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 110);
  sh.setColumnWidth(6, 160);
  sh.setColumnWidth(7, 110);
  sh.setColumnWidth(8, 110);

  ss.setActiveSheet(sh);
  toast_('สร้างชีตสรุปแล้ว ✅');
}


/* ===========================================================================
 * 10) เครื่องมือช่วย
 * ========================================================================= */
function backupSheet() { backupSheet_(getSheet_()); toast_('สำรองข้อมูลแล้ว ✅'); }

function backupSheet_(sh) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmm');
  var copy = sh.copyTo(ss).setName('BK_' + CFG.SHEET_NAME + '_' + stamp);
  copy.hideSheet();
  // หมายเหตุ: ลบชีต BK_ เก่าๆ ทิ้งบ้างเป็นระยะ ไม่งั้นไฟล์จะบวม
}

function protectFormulaColumns() {
  var sh = getSheet_();
  var n = sh.getMaxRows() - CFG.START_ROW + 1;
  var rng = sh.getRange(CFG.START_ROW, COL.DOWN, n, COL.STATUS - COL.DOWN + 1);

  // ลบการป้องกันเดิมของสคริปต์นี้ก่อน
  var olds = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (var i = 0; i < olds.length; i++) {
    if (olds[i].getDescription() === 'คอลัมน์สูตร (ห้ามพิมพ์ทับ)') olds[i].remove();
  }

  rng.protect()
     .setDescription('คอลัมน์สูตร (ห้ามพิมพ์ทับ)')
     .setWarningOnly(true);   // เตือนอย่างเดียว ไม่ล็อกตาย

  toast_('ล็อกคอลัมน์สูตรแล้ว 🔒');
}

function addFilter_(sh) {
  var last = sh.getLastRow();
  if (last < CFG.START_ROW) return;
  removeFilter_(sh);
  sh.getRange(CFG.HEADER_ROW, 1, last - CFG.HEADER_ROW + 1, LAST_COL).createFilter();
}

function removeFilter_(sh) {
  var f = sh.getFilter();
  if (f) f.remove();
}

function ensureColumns_(sh, need) {
  var have = sh.getMaxColumns();
  if (have < need) sh.insertColumnsAfter(have, need - have);
}

function getSheet_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.SHEET_NAME);
  if (!sh) throw new Error('ไม่พบชีตชื่อ "' + CFG.SHEET_NAME + '"');
  return sh;
}

function toast_(msg) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'จัดการสต๊อก', 5);
}
