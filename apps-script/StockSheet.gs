/**
 * ============================================================================
 *  สคริปต์ชีตเครื่อง DEMO — เวอร์ชัน "ดูอย่างเดียว"
 *
 *  แนวคิด: ไม่แตะชีต 'รวม' เลย
 *  ชีต 'รวม' = คลังข้อมูลจริง เก็บไว้เฉยๆ ไม่เรียง ไม่แทรกแถว ไม่ใส่ dropdown
 *  หน้าที่สร้างใหม่ = ดึงข้อมูลมาแสดงด้วยสูตร เลือกวิธีเรียงได้ กดเปลี่ยนได้ทันที
 *
 *  มี 3 คำสั่งในเมนู:
 *    1. หน้าดูข้อมูล      -> 'ดูข้อมูล'         เลือกเรียง/กรองสาขา/กรองยี่ห้อ
 *    2. หน้าขอรูป         -> 'ดึงข้อมูลขอรูป'    พิมพ์เลขลำดับแล้วได้ข้อความก๊อป
 *    3. ล้างของรกในชีตรวม -> ลบ dropdown กับแถวว่างที่สคริปต์เก่าใส่ไว้
 *
 *  ⚠️ ไม่มีคำสั่งเขียนทับข้อมูลในชีต 'รวม' แม้แต่บรรทัดเดียว
 *
 *  วิธีใช้: Extensions > Apps Script > วางทับ > Save > รีเฟรชชีต
 * ============================================================================
 */

var SRC_SHEET  = 'รวม';
var VIEW_SHEET = 'ดูข้อมูล';
var OUT_SHEET  = 'ดึงข้อมูลขอรูป';
var START_ROW  = 3;

/* ตัวเลือกการเรียง — ชื่อที่แสดง กับ คำสั่งเรียงจริง
 * Col2=ยี่ห้อ  Col3=รุ่น  Col7=สาขา  Col8=วันที่  Col12=ราคา            */
var SORTS = [
  ['① วันที่  เก่า → ใหม่',            'Col8 asc'],
  ['② วันที่  ใหม่ → เก่า',            'Col8 desc'],
  ['③ ราคา  ถูก → แพง',              'Col12 asc'],
  ['④ ราคา  แพง → ถูก',              'Col12 desc'],
  ['⑤ รุ่น  (A→Z) + วันที่เก่าก่อน',    'Col3 asc, Col8 asc'],
  ['⑥ รุ่น  (A→Z) + ราคาถูกก่อน',      'Col3 asc, Col12 asc'],
  ['⑦ ยี่ห้อ → รุ่น → ราคา',           'Col2 asc, Col3 asc, Col12 asc'],
  ['⑧ สาขา → รุ่น',                   'Col7 asc, Col3 asc']
];

var BRANCHES = ['ทั้งหมด', 'สต๊อก', 'มวกเหล็ก', 'แก่งคอย', 'หนองแค', 'โลตัส'];
var BRANDS   = ['ทั้งหมด', 'APPLE', 'IPHONE', 'HUAWEI', 'OPPO', 'REAL ME',
                'SAMSUNG', 'VIVO', 'XIAOMI', 'MI', 'ALLDOCUBE'];

var HEADERS  = ['ลำดับ', 'ยี่ห้อ', 'รุ่น', 'สี', 'ความจุ',
                'เครือข่าย', 'สาขา', 'วันที่รับ', 'ราคาขาย'];
var WIDTHS   = [60, 95, 180, 95, 90, 75, 95, 105, 100];


/* ---------------------------------------------------------------------------
 * เมนู
 * ------------------------------------------------------------------------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ จัดการสต๊อก')
    .addItem('▶️  สร้างใหม่ทั้งหมด', 'runAll')
    .addSeparator()
    .addItem('📋  หน้าดูข้อมูล', 'buildViewSheet')
    .addItem('🔍  หน้าขอรูป', 'buildSearchSheet')
    .addSeparator()
    .addItem('🧹  ล้างของรกในชีต รวม', 'cleanUpMainSheet')
    .addToUi();
}

function runAll() {
  buildViewSheet();
  buildSearchSheet();
  toast_('เสร็จเรียบร้อย ✅');
}


/* ===========================================================================
 *  หน้าดูข้อมูล 'ดูข้อมูล' — ดูอย่างเดียว เลือกวิธีเรียงได้
 * ========================================================================= */
function buildViewSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SRC_SHEET)) throw new Error('ไม่พบชีต "' + SRC_SHEET + '"');

  var sh = resetSheet_(ss, VIEW_SHEET);
  var S  = "'" + SRC_SHEET + "'!";

  // ------------------------------------------------------------------------
  // ตารางต้นทาง — บังคับคอลัมน์ A (ลำดับ) และ E (ความจุ) ให้เป็นข้อความ
  // เพราะสองคอลัมน์นี้มีทั้งตัวเลขและตัวอักษรปนกัน ('2.1' กับ 5, '6/128' กับ 128)
  // ถ้าไม่แปลง QUERY จะเลือกชนิดข้อมูลที่เจอเยอะกว่า แล้วทำอีกชนิดหายไปเป็นช่องว่าง
  // ------------------------------------------------------------------------
  var DATA = '{ARRAYFORMULA(TO_TEXT(' + S + '$A$3:$A)),' + S + '$B$3:$D,' +
             'ARRAYFORMULA(TO_TEXT(' + S + '$E$3:$E)),' + S + '$F$3:$L}';

  // ------------------------------------------------------------------------
  // แถว 1 = ป้ายชื่อ / แถว 2 = ช่องเลือก
  // ------------------------------------------------------------------------
  var labels = [['🔃 เรียงตาม', 'A1:C1'], ['🏬 สาขา', 'D1:E1'],
                ['📱 ยี่ห้อ', 'F1:G1'], ['📊 สรุป', 'H1:I1']];
  labels.forEach(function (l) {
    sh.getRange(l[1]).merge()
      .setValue(l[0]).setFontWeight('bold').setFontSize(10)
      .setBackground('#434343').setFontColor('#FFFFFF')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.setRowHeight(1, 26);

  var ctrl = [['A2:C2', SORTS.map(function (s) { return s[0]; })],
              ['D2:E2', BRANCHES],
              ['F2:G2', BRANDS]];
  ctrl.forEach(function (c) {
    var rg = sh.getRange(c[0]).merge();
    rg.setValue(c[1][0])
      .setBackground('#D9EAD3').setFontSize(12).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false,
                 '#38761D', SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
      .setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(c[1], true).setAllowInvalid(false).build());
  });

  sh.getRange('H2:I2').merge()
    .setFormula('=IF(COUNTA(A4:A)=0,"ไม่พบข้อมูล",' +
                'COUNTA(A4:A)&" เครื่อง"&CHAR(10)&' +
                '"รวม "&TEXT(SUM(I4:I),"#,##0")&" บาท")')
    .setBackground('#FFF2CC').setFontSize(10).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true);
  sh.setRowHeight(2, 44);

  // ------------------------------------------------------------------------
  // แถว 3 = หัวตาราง
  // ------------------------------------------------------------------------
  sh.getRange(3, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setFontSize(11)
    .setBackground('#0B5394').setFontColor('#FFFFFF')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(3, 34);
  sh.setFrozenRows(3);

  // ------------------------------------------------------------------------
  // แถว 4 = สูตรดึงข้อมูล (เรียง + กรอง ตามช่องด้านบน)
  // ------------------------------------------------------------------------
  var sw = 'SWITCH($A$2';
  SORTS.forEach(function (s) { sw += ',"' + s[0] + '","' + s[1] + '"'; });
  sw += ',"Col8 asc")';

  sh.getRange('A4').setFormula(
    '=IFERROR(QUERY(' + DATA + ',' +
      '"select Col1,Col2,Col3,Col4,Col5,Col6,Col7,Col8,Col12 ' +
      'where Col3 is not null"' +
      '&IF($D$2="ทั้งหมด",""," and Col7 = \'"&$D$2&"\'")' +
      '&IF($F$2="ทั้งหมด",""," and Col2 = \'"&$F$2&"\'")' +
      '&" order by "&' + sw + ',0),' +
    '"— ไม่พบเครื่องตามเงื่อนไขที่เลือก —")');

  // ------------------------------------------------------------------------
  // รูปแบบตัวเลข / ความกว้าง / สีสลับแถว
  // ------------------------------------------------------------------------
  var body = sh.getMaxRows() - 3;
  sh.getRange(4, 1, body, 1).setNumberFormat('@').setHorizontalAlignment('center');
  sh.getRange(4, 8, body, 1).setNumberFormat('dd/MM/yyyy').setHorizontalAlignment('center');
  sh.getRange(4, 9, body, 1).setNumberFormat('#,##0').setHorizontalAlignment('right');
  sh.getRange(4, 4, body, 4).setHorizontalAlignment('center');
  sh.getRange(4, 1, body, HEADERS.length).setFontSize(11).setVerticalAlignment('middle');

  for (var i = 0; i < WIDTHS.length; i++) sh.setColumnWidth(i + 1, WIDTHS[i]);

  var all = sh.getRange(4, 1, body, HEADERS.length);
  var gCol = sh.getRange(4, 7, body, 1);

  sh.setConditionalFormatRules([
    // ค้างเกิน 1 ปี = ทั้งแถวแดงอ่อน (กฎแรกชนะ)
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($H4<>"",$H4<TODAY()-365)')
      .setBackground('#F4CCCC').setRanges([all]).build(),
    // สาขา
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('มวกเหล็ก').setBackground('#CFE2F3')
      .setRanges([gCol]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('แก่งคอย').setBackground('#D9EAD3')
      .setRanges([gCol]).build(),
    // สลับสีแถวคู่ ให้กวาดตาตามง่าย
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($A4<>"",ISEVEN(ROW()))')
      .setBackground('#F5F5F5').setRanges([all]).build()
  ]);

  // ------------------------------------------------------------------------
  // ล็อกไม่ให้แก้ ยกเว้น 3 ช่องเลือกด้านบน
  // ------------------------------------------------------------------------
  try {
    var p = sh.protect().setDescription('หน้าดูอย่างเดียว');
    p.setUnprotectedRanges([sh.getRange('A2:G2')]);
    p.setWarningOnly(true);
  } catch (e) { /* ล็อกไม่ได้ก็ไม่เป็นไร ไม่ต้องหยุดสคริปต์ */ }

  ss.setActiveSheet(sh);
  toast_('สร้างหน้า ' + VIEW_SHEET + ' เรียบร้อย ✅');
}


/* ===========================================================================
 *  หน้าขอรูป 'ดึงข้อมูลขอรูป'
 * ========================================================================= */
function buildSearchSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SRC_SHEET)) throw new Error('ไม่พบชีต "' + SRC_SHEET + '"');

  var sh = resetSheet_(ss, OUT_SHEET);

  sh.getRange('A1')
    .setValue('พิมพ์เลขลำดับเครื่องที่นี่ ⬇️')
    .setFontWeight('bold').setFontSize(14)
    .setBackground('#FFF2CC')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 42);

  sh.getRange('A2')
    .setBackground('#D9EAD3').setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false,
               '#666666', SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.setRowHeight(2, 52);

  var S = "'" + SRC_SHEET + "'!";
  var table = '{ARRAYFORMULA(TO_TEXT(' + S + '$A$3:$A)),' + S + '$B$3:$L}';

  sh.getRange('A4').setFormula(
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
      ')))')
    .setFontSize(12).setVerticalAlignment('top')
    .setHorizontalAlignment('left').setWrap(true);
  sh.setRowHeight(4, 180);

  sh.setColumnWidth(1, 450);

  ss.setActiveSheet(sh);
  sh.getRange('A2').activate();
  toast_('สร้างหน้า ' + OUT_SHEET + ' เรียบร้อย ✅');
}


/* ===========================================================================
 *  ล้างของรกในชีต 'รวม' ที่สคริปต์เก่าใส่ไว้
 *  - ลบ drop-down ทั้งหมด (ต้นเหตุที่ดูเหมือนช่องให้แก้ข้อมูล)
 *  - ลบแถวว่างที่แทรกคั่นไว้
 *  ไม่แตะข้อมูลจริงแม้แต่ช่องเดียว
 * ========================================================================= */
function cleanUpMainSheet() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SRC_SHEET);
  if (!sh) throw new Error('ไม่พบชีต "' + SRC_SHEET + '"');

  var lastCol = Math.max(sh.getLastColumn(), 17);

  sh.getRange(START_ROW, 1, sh.getMaxRows() - START_ROW + 1, lastCol)
    .clearDataValidations();

  removeBlankRows_(sh, lastCol);

  toast_('ล้างชีต ' + SRC_SHEET + ' เรียบร้อย ✅');
}


/**
 * ลบเฉพาะแถวที่ว่างทั้งแถว (A ถึงคอลัมน์สุดท้าย)
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
      sh.deleteRows(START_ROW + i + 1, end - i);
      end = -1;
    }
  }
}


/* ---------------------------------------------------------------------------
 * ตัวช่วย
 * ------------------------------------------------------------------------- */

/** สร้างชีตใหม่ หรือถ้ามีอยู่แล้วก็ล้างให้เกลี้ยง (รวมทั้ง merge / ล็อก / สี) */
function resetSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return ss.insertSheet(name);

  var prots = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
  for (var i = 0; i < prots.length; i++) {
    if (prots[i].canEdit()) prots[i].remove();
  }

  var all = sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns());
  all.breakApart();
  all.clearDataValidations();
  sh.clearConditionalFormatRules();
  sh.setFrozenRows(0);
  sh.clear();

  return sh;
}

function toast_(msg) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'จัดการสต๊อก', 5);
}
