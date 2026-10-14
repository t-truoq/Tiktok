/*************************************************

 * TIKTOK AFFILIATE - WORKFLOW V9.1

 *************************************************/



const CFG = {
  SHEET: 'Trang tính2',
  TOTAL_ROW: 2,
  DATA_START_ROW: 3,

  COL: {
    NAME: 1,
    IMAGE: 2,
    REFUND_QTY: 3,
    PROGRESS: 4,
    PIC: 5,
    DATE: 6,
    STATUS: 7,
    PRICE: 8,
    END_PRICE: 9,
    WHOLESALE: 10,
    QTY: 11,
    SELL_END: 12,
    SELL_END_QTY: 13,
    PROFIT: 14,
    NOTE: 15,
    PAID_TOTAL: 16,
    UNPAID_TOTAL: 17,
    REFUND_TOTAL: 18
  },

  END_PIC: '',
  WAIT_HOURS: 24,
  END_REFUND_DAYS: 15,
  OUT_OF_STOCK_DAYS: 30,
  STORE_PREFIX: 'AFF_PRODUCT_',
  VERSION: '9.1'
};



/*************************************************

 * MAIN ON EDIT

 *************************************************/


function onEdit(e) {
  if (e && !e.triggerUid) return; // truonglt V9.1 start: ignore simple trigger duplicate
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== CFG.SHEET) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  if (
    row < CFG.DATA_START_ROW ||
    e.range.getNumRows() !== 1
  ) return;

  const lock = LockService.getDocumentLock();

  try {
    lock.waitLock(5000);

    // ROOT NAME
    if (col === CFG.COL.NAME) {
      handleRootName(sheet, row);
      updateProfitForRow(sheet, row);
      updateHeaderTotals(sheet);
      return;
    }

    const name = getRootName(sheet, row);
    if (!name) return;

    switch (col) {

      // TIẾN ĐỘ
      case CFG.COL.PROGRESS:
        handleProgressChange(
          sheet,
          row,
          e.oldValue || ''
        );

        saveCurrentRow(sheet, row);
        updateProfitForRow(sheet, row);
        updateHeaderTotals(sheet);
        return;

      // GIÁ SAMPLE
      case CFG.COL.PRICE:
        handlePriceEdit(sheet, row);

        finalizeUserEdit(
          sheet,
          row,
          'PRICE_EDIT'
        );

        updateHeaderTotals(sheet);
        return;

      // PIC
      case CFG.COL.PIC:
        handlePicEdit(sheet, row);

        finalizeUserEdit(
          sheet,
          row,
          'PIC_EDIT'
        );
        return;

      // NGÀY
      case CFG.COL.DATE:
        handleDateEdit(sheet, row);

        refreshStatusForRow(
          sheet,
          row
        );

        finalizeUserEdit(
          sheet,
          row,
          'DATE_EDIT'
        );
        return;

      // SL ĐƠN HOÀN
      case CFG.COL.REFUND_QTY:
        refreshStatusForRow(
          sheet,
          row
        );

        finalizeUserEdit(
          sheet,
          row,
          'REFUND_QTY_EDIT'
        );

        updateProfitForRow(sheet, row);
        return;

      // GIÁ MUA END
      case CFG.COL.END_PRICE:
        handleEndPriceEdit(sheet, row);

        finalizeUserEdit(
          sheet,
          row,
          'END_BUY_PRICE_EDIT'
        );

        updateProfitForRow(sheet, row);
        updateHeaderTotals(sheet);
        return;

      // GIÁ BÁN END
      case CFG.COL.SELL_END:
        handleSellEndEdit(sheet, row);

        finalizeUserEdit(
          sheet,
          row,
          'END_SELL_PRICE_EDIT'
        );

        updateProfitForRow(sheet, row);
        updateHeaderTotals(sheet);
        return;

      // SỐ LƯỢNG BÁN END
      case CFG.COL.SELL_END_QTY:
        handleSellEndQtyEdit(sheet, row);

        finalizeUserEdit(
          sheet,
          row,
          'END_SELL_QTY_EDIT'
        );

        updateProfitForRow(sheet, row);
        updateHeaderTotals(sheet);
        return;

      // STATUS USER EDIT
      case CFG.COL.STATUS:
        colorStatusCell(
          sheet,
          row
        );

        finalizeUserEdit(
          sheet,
          row,
          'STATUS_EDIT'
        );
        return;

      // GHI CHÚ
      case CFG.COL.NOTE:
        refreshStatusForRow(
          sheet,
          row
        );

        finalizeUserEdit(
          sheet,
          row,
          'NOTE_EDIT'
        );
        return;

      // GIÁ BÁN SỈ SAMPLE / SỐ LƯỢNG
      case CFG.COL.WHOLESALE:
      case CFG.COL.QTY:
        finalizeUserEdit(
          sheet,
          row,
          'FIELD_EDIT'
        );

        updateProfitForRow(sheet, row);
        updateHeaderTotals(sheet);
        return;

      default:
        saveCurrentRow(
          sheet,
          row
        );
    }

  } finally {
    try {
      lock.releaseLock();
    } catch (err) {}
  }
}





/*************************************************

 * ROOT NAME

 *************************************************/

function handleRootName(sheet, row) {

  const name = getRootName(sheet, row);

  if (!name) return;



  const record = loadRecord(name);



  if (record) {

    restoreRecord(

      sheet,

      row,

      record

    );



    refreshStatusForRow(

      sheet,

      row

    );



    SpreadsheetApp

      .getActive()

      .toast(

        `Đã tải lại dữ liệu của "${name}"`,

        'Tiktok Affiliate',

        4

      );



  } else {

    const newRecord =

      createEmptyRecord(name);



    saveRecord(

      name,

      newRecord

    );



    saveCurrentRow(

      sheet,

      row

    );

  }

}





/*************************************************

 * PROGRESS CHANGE

 *************************************************/

function handleProgressChange(sheet,row,oldRaw){const name=getRootName(sheet,row);if(!name)return;const r=loadRecord(name)||createEmptyRecord(name);ensureRecord(r);const next=normalizeProgress(sheet.getRange(row,CFG.COL.PROGRESS).getValue()),old=r.currentProgress||oldRaw;
 // Avoid capturing changed-progress cell as old-stage snapshot: original onEdit lost previous stage values.
 if(next){const s=parseAffiliateStage(next);if(s&&!s.done){let state=r.purchaseState[s.key];if(!state)state=r.purchaseState[s.key]={ordered:false,received:false,cancelled:false,verified:true,issue:''};if(s.received){if(!state.ordered){state.ordered=true;state.verified=false;state.issue='Nhận khi chưa ghi nhận Đặt';}state.received=true;}else{state.ordered=true;state.cancelled=false; /* viewing Đặt does not undo received */}}}
 if(old&&old!==next)appendHistory(r,'LEAVE_STAGE',old,{progress:old});
 if(!next){r.currentProgress='';sheet.getRange(row,CFG.COL.DATE).clearContent();saveRecord(name,r);return;}
 if(r.stageData[next])restoreStage(sheet,row,next,r);else initializeStage(sheet,row,next,r);
 r.currentProgress=next;refreshStatusForRow(sheet,row,r,false);recordStageSafe91(sheet,row,next,r);appendHistory(r,'ENTER_STAGE',next,buildSnapshot(sheet,row,next));saveRecord(name,r);}

function initializeStage(sheet,row,progress,record){const s=parseAffiliateStage(progress);if(!s||s.done)return;const c=CFG.COL;
 sheet.getRange(row,c.DATE).setValue(new Date());const pk=(s.group==='end'?'picEnd':'picMau')+s.index;
 sheet.getRange(row,c.PIC).setValue(record[pk]||'');const cfg=getPaymentPurchaseConfigs(Object.assign({},record,{currentProgress:progress})).find(x=>x.key===s.key);
 if(!record.purchaseState[s.key])record.purchaseState[s.key]={ordered:!s.received,received:s.received,verified:!s.received,cancelled:false,issue:s.received?'Nhận không có lượt Đặt trước':''};
 const state=record.purchaseState[s.key];if(!s.received){state.ordered=true;state.cancelled=false;}else if(!state.ordered){state.ordered=true;state.received=true;state.verified=false;state.issue='NHẬN không có lượt Đặt trước';}else state.received=true;
 sheet.getRange(row,c.PRICE).clearContent();sheet.getRange(row,c.END_PRICE).clearContent();sheet.getRange(row,c.SELL_END).clearContent();sheet.getRange(row,c.SELL_END_QTY).clearContent();
 if(s.group==='sample')loadPrice(sheet.getRange(row,c.PRICE),record['priceMau'+s.index]);else{loadPrice(sheet.getRange(row,c.END_PRICE),record['priceEnd'+s.index]);loadPrice(sheet.getRange(row,c.SELL_END),record['sellEnd'+s.index]);loadNumber(sheet.getRange(row,c.SELL_END_QTY),record['qtySellEnd'+s.index]);}
 record.stageData[progress]=buildSnapshot(sheet,row,progress);
}

function restoreStage(sheet,row,progress,record){const s=parseAffiliateStage(progress);if(!s||s.done)return;const c=CFG.COL,stage=record.stageData[progress]||{},picKey=(s.group==='end'?'picEnd':'picMau')+s.index;
 sheet.getRange(row,c.PIC).setValue(record[picKey]||stage.pic||'');if(stage.date)sheet.getRange(row,c.DATE).setValue(isoToDate(stage.date));else sheet.getRange(row,c.DATE).setValue(new Date());
 sheet.getRange(row,c.PRICE).clearContent();sheet.getRange(row,c.END_PRICE).clearContent();sheet.getRange(row,c.SELL_END).clearContent();sheet.getRange(row,c.SELL_END_QTY).clearContent();
 if(s.group==='sample')loadPrice(sheet.getRange(row,c.PRICE),record['priceMau'+s.index]);else{loadPrice(sheet.getRange(row,c.END_PRICE),record['priceEnd'+s.index]);loadPrice(sheet.getRange(row,c.SELL_END),record['sellEnd'+s.index]);loadNumber(sheet.getRange(row,c.SELL_END_QTY),record['qtySellEnd'+s.index]);}
}

function handlePriceEdit(sheet,row){return editBuy91(sheet,row,'sample');}

function getPriceSlot(p){const s=parseAffiliateStage(p);return s&&!s.done&&s.group==='sample'?'priceMau'+s.index:null;}

function getEndBuyPriceSlot(p){const s=parseAffiliateStage(p);return s&&!s.done&&s.group==='end'?'priceEnd'+s.index:null;}

function getEndBuyWriteSlot(p){const s=parseAffiliateStage(p);return s&&!s.done&&s.group==='end'&&!s.received?'priceEnd'+s.index:null;}

function getEndSellPriceSlot(p){const s=parseAffiliateStage(p);return s&&!s.done&&s.group==='end'?'sellEnd'+s.index:null;}

function getEndSellQtySlot(p){const s=parseAffiliateStage(p);return s&&!s.done&&s.group==='end'?'qtySellEnd'+s.index:null;}

function handleEndPriceEdit(sheet,row){return editBuy91(sheet,row,'end');}

function handleSellEndEdit(
  sheet,
  row
) {
  const name = getRootName(sheet, row);
  if (!name) return;

  const progress = getCurrentProgress(sheet, row);

  let record =
    loadRecord(name) ||
    createEmptyRecord(name);

  ensureRecord(record);

  const refundQty =
    sheet
      .getRange(
        row,
        CFG.COL.REFUND_QTY
      )
      .getValue();

  const slot =
    getEndSellPriceSlot(
      progress,
      refundQty
    );

  if (!slot) {
    SpreadsheetApp
      .getActive()
      .toast(
        'Giá bán End chỉ nhập ở Nhận mẫu 2 hoặc các stage End.',
        'Tiktok Affiliate',
        5
      );
    return;
  }

  const value =
    sheet
      .getRange(
        row,
        CFG.COL.SELL_END
      )
      .getValue();

  record[slot] =
    isNumericMoney(value)
      ? Number(value)
      : null;

  saveRecord(name, record);
}

function handleSellEndQtyEdit(sheet, row) {
  const name = getRootName(sheet, row);
  if (!name) return;

  const progress = getCurrentProgress(sheet, row);

  let record =
    loadRecord(name) ||
    createEmptyRecord(name);

  ensureRecord(record);

  const refundQty =
    sheet
      .getRange(
        row,
        CFG.COL.REFUND_QTY
      )
      .getValue();

  const slot =
    getEndSellQtySlot(
      progress,
      refundQty
    );

  if (!slot) {
    SpreadsheetApp.getActive().toast(
      'SL bán End chỉ nhập ở Nhận mẫu 2 hoặc các stage End.',
      'Tiktok Affiliate',
      5
    );
    return;
  }

  const value =
    sheet
      .getRange(
        row,
        CFG.COL.SELL_END_QTY
      )
      .getValue();

  record[slot] =
    isNumericMoney(value)
      ? Number(value)
      : null;

  saveRecord(name, record);
}

function getEndBuyTotal(r){return getPaymentSummaryForRecord(r).endTotal;}

function getEndSellRevenue(r){ensureRecord(r);return getPaymentPurchaseConfigs(r).filter(c=>c.group==='end'&&r.purchaseState[c.key]?.ordered&&!r.purchaseState[c.key]?.cancelled).reduce((sum,c)=>sum+(amount91(r['sellEnd'+c.index])||0)*(amount91(r['qtySellEnd'+c.index])||0),0);}

function getEndSellQtyTotal(r){ensureRecord(r);return getPaymentPurchaseConfigs(r).filter(c=>c.group==='end'&&r.purchaseState[c.key]?.ordered&&!r.purchaseState[c.key]?.cancelled).reduce((sum,c)=>sum+(amount91(r['qtySellEnd'+c.index])||0),0);}

function calculateProjectedProfit(record) {
  ensureRecord(record);

  const wholesale =
    toMoney(
      record.wholesale
    );

  const qty =
    Number(
      record.qty
    ) || 0;

  const sampleSaleRevenue =
    wholesale === null
      ? 0
      : wholesale * qty;

  const endSaleRevenue =
    getEndSellRevenue(
      record
    );

  const endBuyCost =
    getEndBuyTotal(
      record
    );

  // Profit dự kiến sau khi tiền Sample đã được hoàn.
  return (
    sampleSaleRevenue +
    endSaleRevenue -
    endBuyCost
  );
}

function updateProfitForRow(sheet,row,suppliedRecord){if(row<CFG.DATA_START_ROW)return;const name=getRootName(sheet,row);if(!name)return;const d=readRow(sheet,row),r=suppliedRecord||loadRecord(name)||createEmptyRecord(name);ensureRecord(r);r.wholesale=amount91(d.wholesale);r.qty=amount91(d.qty);const ledger=getPurchaseLedger(r);const hasMoney=r.wholesale!==null||r.qty!==null||ledger.some(x=>x.ordered&&x.amount!==null)||getEndSellQtyTotal(r)>0;const cell=sheet.getRange(row,CFG.COL.PROFIT);if(!hasMoney){cell.clearContent();r.profit=null;}else{r.profit=calculateProjectedProfit(r);cell.setValue(r.profit);}saveRecord(name,r);}

function handlePicEdit(sheet,row){const name=getRootName(sheet,row),s=parseAffiliateStage(getCurrentProgress(sheet,row));if(!name||!s||s.done)return;const r=loadRecord(name)||createEmptyRecord(name);ensureRecord(r);r[(s.group==='end'?'picEnd':'picMau')+s.index]=sheet.getRange(row,CFG.COL.PIC).getDisplayValue().trim();saveRecord(name,r);}

function handleDateEdit(

  sheet,

  row

) {

  const name =

    getRootName(

      sheet,

      row

    );



  const progress =

    getCurrentProgress(

      sheet,

      row

    );



  if (!name || !progress) return;



  const date =

    sheet

      .getRange(

        row,

        CFG.COL.DATE

      )

      .getValue();



  if (!(date instanceof Date)) return;



  let record =

    loadRecord(name) ||

    createEmptyRecord(name);



  ensureRecord(record);



  if (

    !record.stageData[

      progress

    ]

  ) {

    record.stageData[

      progress

    ] = {};

  }



  record.stageData[

    progress

  ].date =

    dateToISO(date);



  record.currentDate =

    dateToISO(date);



  saveRecord(

    name,

    record

  );

}





/*************************************************

 * STATUS LOGIC

 *************************************************/

function calculateStatus(progress,refundQty,date,currentStatus,note){const s=parseAffiliateStage(progress);if(!s)return statusResult(currentStatus||'');if(s.done)return statusResult('Hoàn tất');if(s.group==='sample'&&s.received&&isOutOfStock(note)){if(isFinalRefundStatus(currentStatus))return statusResult(currentStatus);if(!(date instanceof Date))return statusResult('Hết hàng • chưa có ngày nhận');// truonglt countdown integer start
 const remain=Math.ceil(CFG.OUT_OF_STOCK_DAYS-daysBetween(date,new Date()));
 // truonglt countdown integer end
 return statusResult(remain<=0?'⚠️ Cần check hoàn tiền':'Hết hàng • còn '+remain+' ngày hoàn');}
 if(!s.received)return statusResult('Chờ nhận '+(s.group==='sample'?'mẫu ':'End ')+s.index);
 if(s.group==='end'){if(isFinalRefundStatus(currentStatus))return statusResult(currentStatus);if(!(date instanceof Date))return statusResult('Chờ check hoàn');return statusResult(daysBetween(date,new Date())>=CFG.END_REFUND_DAYS?'⚠️ Cần check hoàn tiền':'Chờ check hoàn');}
 return statusResult(passedHours(date,new Date(),CFG.WAIT_HOURS)?'Có thể đặt lượt tiếp theo':'Chờ đủ 1 ngày');}

function refreshStatusForRow(

  sheet,

  row,

  suppliedRecord = null,

  saveHistory = true

) {

  if (

    row < CFG.DATA_START_ROW

  ) return;



  const name =

    getRootName(

      sheet,

      row

    );



  if (!name) return;



  const progress =

    getCurrentProgress(

      sheet,

      row

    );



  if (!progress) return;



  const rowData =

    readRow(

      sheet,

      row

    );



  const oldStatus =

    rowData.status;



  const result =

    calculateStatus(

      progress,

      Number(

        rowData.refundQty

      ) || 0,

      rowData.date,

      oldStatus,

      rowData.note

    );





  if (

    result.status !==

    oldStatus

  ) {



    const statusCell =

      sheet.getRange(

        row,

        CFG.COL.STATUS

      );



    statusCell.setValue(

      result.status

    );



    if (result.note) {

      statusCell.setNote(

        result.note

      );

    } else {

      statusCell.clearNote();

    }





    if (saveHistory) {

      let record =

        suppliedRecord ||

        loadRecord(name) ||

        createEmptyRecord(name);



      ensureRecord(record);



      snapshotStage(

        sheet,

        row,

        progress,

        record

      );



      appendHistory(

        record,

        'AUTO_STATUS',

        progress,

        buildSnapshot(

          sheet,

          row,

          progress

        )

      );



      record.status =

        result.status;



      saveRecord(

        name,

        record

      );

    }

  }



  colorStatusCell(

    sheet,

    row

  );

}





/*************************************************

 * SNAPSHOT STAGE

 *************************************************/

function snapshotStage(sheet,row,p,r){if(!p)return;ensureRecord(r);recordStageSafe91(sheet,row,p,r);}

function buildSnapshot(
  sheet,
  row,
  progress
) {
  const data =
    readRow(
      sheet,
      row
    );

  return {
    progress:
      progress,

    pic:
      data.pic,

    date:
      serializeDate(
        data.date
      ),

    price:
      data.price,

    endPrice:
      data.endPrice,

    sellEnd:
      data.sellEnd,

    sellEndQty:
      data.sellEndQty,

    refundQty:
      data.refundQty,

    status:
      data.status,

    wholesale:
      data.wholesale,

    qty:
      data.qty,

    profit:
      data.profit,

    note:
      data.note,

    capturedAt:
      dateToISO(
        new Date()
      )
  };
}





/*************************************************

 * SAVE CURRENT ROW

 *************************************************/

function saveCurrentRow(sheet,row){const d=readRow(sheet,row);if(!d.name)return;const r=loadRecord(d.name)||createEmptyRecord(d.name);ensureRecord(r);r.name=d.name;r.currentProgress=normalizeProgress(d.progress);r.currentDate=serializeDate(d.date);r.refundQty=d.refundQty;r.status=d.status;r.wholesale=amount91(d.wholesale);r.qty=amount91(d.qty);r.note=d.note;r.pic=d.pic;const s=parseAffiliateStage(r.currentProgress);
 if(s&&!s.done){const st=r.purchaseState[s.key]||{ordered:true,received:s.received,cancelled:false,verified:true,issue:''};st.ordered=true;if(s.received)st.received=true;r.purchaseState[s.key]=st;recordStageSafe91(sheet,row,r.currentProgress,r);}
 saveImageToRecord(sheet,row,r);r.profit=calculateProjectedProfit(r);saveRecord(d.name,r);}

function restoreRecord(
  sheet,
  row,
  record
) {
  ensureRecord(record);

  restoreImageFromRecord(
    sheet,
    row,
    record
  );

  setIfExists(
    sheet,
    row,
    CFG.COL.REFUND_QTY,
    record.refundQty
  );

  setIfExists(
    sheet,
    row,
    CFG.COL.PROGRESS,
    record.currentProgress
  );

  setIfExists(
    sheet,
    row,
    CFG.COL.WHOLESALE,
    record.wholesale
  );

  setIfExists(
    sheet,
    row,
    CFG.COL.QTY,
    record.qty
  );

  setIfExists(
    sheet,
    row,
    CFG.COL.NOTE,
    record.note
  );

  const progress =
    normalizeProgress(
      record.currentProgress ||
      ''
    );

  if (
    progress &&
    record.stageData[
      progress
    ]
  ) {
    restoreStage(
      sheet,
      row,
      progress,
      record
    );

  } else {

    setIfExists(
      sheet,
      row,
      CFG.COL.PIC,
      record.pic
    );

    if (record.currentDate) {
      setCell(
        sheet,
        row,
        CFG.COL.DATE,
        isoToDate(
          record.currentDate
        )
      );
    }

    setIfExists(
      sheet,
      row,
      CFG.COL.STATUS,
      record.status
    );

    const priceSlot =
      getPriceSlot(
        progress
      );

    if (priceSlot) {
      loadPrice(
        sheet.getRange(
          row,
          CFG.COL.PRICE
        ),
        record[priceSlot]
      );
    } else {
      sheet
        .getRange(
          row,
          CFG.COL.PRICE
        )
        .clearContent();
    }

    const endBuySlot =
      getEndBuyPriceSlot(
        progress
      );

    if (endBuySlot) {
      loadPrice(
        sheet.getRange(
          row,
          CFG.COL.END_PRICE
        ),
        record[endBuySlot]
      );
    } else {
      sheet
        .getRange(
          row,
          CFG.COL.END_PRICE
        )
        .clearContent();
    }

    const endSellSlot =
      getEndSellPriceSlot(
        progress,
        record.refundQty
      );

    if (endSellSlot) {
      loadPrice(
        sheet.getRange(
          row,
          CFG.COL.SELL_END
        ),
        record[endSellSlot]
      );
    } else {
      sheet
        .getRange(
          row,
          CFG.COL.SELL_END
        )
        .clearContent();
    }
  }

  updateProfitForRow(
    sheet,
    row,
    record
  );

  colorStatusCell(
    sheet,
    row
  );
}





/*************************************************

 * HISTORY

 *************************************************/

function finalizeUserEdit(

  sheet,

  row,

  type

) {

  saveCurrentRow(

    sheet,

    row

  );



  const name =

    getRootName(

      sheet,

      row

    );



  if (!name) return;



  const progress =

    getCurrentProgress(

      sheet,

      row

    );



  let record =

    loadRecord(name) ||

    createEmptyRecord(name);



  ensureRecord(record);



  appendHistory(

    record,

    type,

    progress,

    buildSnapshot(

      sheet,

      row,

      progress

    )

  );



  saveRecord(

    name,

    record

  );

}

function appendHistory(

  record,

  type,

  progress,

  data

) {

  ensureRecord(record);



  record.history.push({

    type:

      type,



    progress:

      progress,



    timestamp:

      dateToISO(

        new Date()

      ),



    data:

      data

  });

}





/*************************************************

 * TOTALS

 *************************************************/

// truonglt V9.1 FIX SYNC CURRENT PURCHASE start
// One shared source of truth for preview and persisted totals.
// Only the currently displayed ORDER stage can overwrite a buy price.
// A blank displayed price is handled by editBuy91 when the user explicitly deletes it.
function syncCurrentOrder91(record, data) {
  ensureRecord(record);
  const stage = parseAffiliateStage(data.progress);
  if (!stage || stage.done || stage.received) return false;
  const value = amount91(stage.group === 'sample' ? data.price : data.endPrice);
  if (value === null) return false;
  const priceKey = (stage.group === 'sample' ? 'priceMau' : 'priceEnd') + stage.index;
  const before = record.purchaseState[stage.key] || null;
  const changed = amount91(record[priceKey]) !== value ||
    !before || !before.ordered || before.cancelled || before.received;
  if (!changed) return false;
  const state = Object.assign({}, before || {});
  state.ordered = true;
  state.received = false;
  state.cancelled = false;
  if (!before || !before.verified) {
    state.verified = false;
    state.issue = state.issue || 'Đồng bộ lượt Đặt từ Sheet; cần đối soát';
  }
  record.purchaseState[stage.key] = state;
  record[priceKey] = value;
  return true;
}
// truonglt V9.1 FIX SYNC CURRENT PURCHASE end

function updateHeaderTotals(sheet){if(!sheet)return;const sums={paid:0,unpaid:0,sampleTotal:0,endTotal:0,profit:0,sampleQty:0,endQty:0,refund:0,missing:0,review:0};const seen=new Set();for(let row=CFG.DATA_START_ROW;row<=sheet.getLastRow();row++){const d=readRow(sheet,row);if(!d.name)continue;const k=normalizeRootName(d.name);if(seen.has(k))continue;seen.add(k);const r=loadRecord(d.name);if(!r)throw Error('Không đọc được record tại dòng '+row+': '+d.name);ensureRecord(r);if(syncCurrentOrder91(r,d))saveRecord(d.name,r);const p=getPaymentSummaryForRecord(r),refund=getRefundEligible91(r);['paid','unpaid','sampleTotal','endTotal','missing','review'].forEach(k=>sums[k]+=p[k]);sums.refund+=refund.total;sums.sampleQty+=Number(r.qty)||0;sums.endQty+=getEndSellQtyTotal(r);sums.profit+=calculateProjectedProfit(r);
 sheet.getRange(row,CFG.COL.PAID_TOTAL,1,3).setValues([[p.paid,p.unpaid,refund.total]]);sheet.getRange(row,CFG.COL.UNPAID_TOTAL).setNote(p.missing||p.review?'TẠM TÍNH: '+p.missing+' lượt thiếu giá, '+p.review+' lượt V9 cần đối soát':'');sheet.getRange(row,CFG.COL.REFUND_TOTAL).setNote(refund.missing?'Thiếu '+refund.missing+' giá Sample tương ứng End đã nhận':'');}
 const set=(c,v)=>sheet.getRange(CFG.TOTAL_ROW,c).setValue(v);set(1,sums.sampleTotal+sums.endTotal);set(CFG.COL.PRICE,sums.sampleTotal);set(CFG.COL.END_PRICE,sums.endTotal);set(CFG.COL.QTY,sums.sampleQty);set(CFG.COL.SELL_END_QTY,sums.endQty);set(CFG.COL.PROFIT,sums.profit);set(CFG.COL.PAID_TOTAL,sums.paid);set(CFG.COL.UNPAID_TOTAL,sums.unpaid);set(CFG.COL.REFUND_TOTAL,sums.refund);sheet.getRange(CFG.TOTAL_ROW,2).setValue('Total');stylePaymentSummary(sheet);sheet.getRange('P2').setNote(sums.missing||sums.review?'TẠM TÍNH: '+sums.missing+' lượt thiếu giá, '+sums.review+' lượt cần đối soát':'');}

function hasAffiliateStage(record, progress) {
  ensureRecord(record);

  progress = normalizeProgress(progress);

  if (
    normalizeProgress(record.currentProgress || '') === progress
  ) {
    return true;
  }

  if (
    record.stageData &&
    record.stageData[progress]
  ) {
    return true;
  }

  const history = Array.isArray(record.history)
    ? record.history
    : [];

  return history.some(item =>
    normalizeProgress(item && item.progress) === progress
  );
}


/*************************************************
 * PAYMENT SUMMARY V9
 *
 * NGUYÊN TẮC CỨNG:
 *
 * - Mỗi đợt mua được xử lý độc lập:
 *   Mẫu 1, Mẫu 2, End 1, End 2.
 *
 * - GIÁ luôn lấy từ bước ĐẶT tương ứng.
 *   Không lấy giá tại bước NHẬN.
 *
 * - Đã Đặt nhưng chưa Nhận => CHƯA THANH TOÁN.
 * - Đã Nhận => chính giá của bước Đặt đó vào ĐÃ THANH TOÁN.
 *
 * - paid và unpaid đều được CỘNG TRỰC TIẾP từng đợt.
 *   Tuyệt đối không dùng Total - Unpaid = Paid hay ngược lại.
 *************************************************/

function getAffiliateProgressRank(progress) {
  progress = normalizeProgress(progress);

  const rank = {
    'Đặt mẫu 1': 10,
    'Nhận mẫu 1': 20,
    'Đặt mẫu 2': 30,
    'Nhận mẫu 2': 40,
    'Đặt End 1': 50,
    'Nhận End 1': 60,
    'Đặt End 2': 70,
    'Nhận End 2': 80,
    'Done': 90
  };

  return rank[progress] || 0;
}

function getHistoryStageAmount(
  record,
  progress,
  valueField
) {
  ensureRecord(record);

  progress = normalizeProgress(progress);

  const history = Array.isArray(record.history)
    ? record.history
    : [];

  // Duyệt từ mới nhất về cũ nhất để lấy giá cuối cùng user đã nhập
  // khi đang đứng đúng stage Đặt đó.
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (!item) continue;

    if (
      normalizeProgress(item.progress) !== progress
    ) {
      continue;
    }

    const data = item.data || {};
    const value = data[valueField];

    if (isNumericMoney(value)) {
      return Number(value);
    }
  }

  return null;
}

function getStrictOrderedStageValue(
  record,
  orderedProgress,
  valueField
) {
  ensureRecord(record);

  orderedProgress =
    normalizeProgress(orderedProgress);

  const stage =
    record.stageData &&
    record.stageData[orderedProgress];

  if (
    stage &&
    isNumericMoney(stage[valueField])
  ) {
    return Number(stage[valueField]);
  }

  const historyValue =
    getHistoryStageAmount(
      record,
      orderedProgress,
      valueField
    );

  if (historyValue !== null) {
    return historyValue;
  }

  return null;
}

function getOrderStagePurchaseAmount(r,c){ensureRecord(r);return amount91(r[c.priceKey]);}

function isEnd1FlowRequired(record) {
  ensureRecord(record);

  // Nếu lịch sử thực tế có End 1 thì chắc chắn End 1 đã thuộc flow.
  if (
    hasAffiliateStage(record, 'Đặt End 1') ||
    hasAffiliateStage(record, 'Nhận End 1')
  ) {
    return true;
  }

  // Theo workflow hiện tại: SL đơn hoàn > 1 mới cần End 1.
  return Number(record.refundQty) > 1;
}

function didOrderStageOccur(r,c){ensureRecord(r);const x=r.purchaseState[c.key];return !!x&&x.ordered&&!x.cancelled;}

function didReceiveStageOccur(r,c){ensureRecord(r);const x=r.purchaseState[c.key];return !!x&&x.ordered&&x.received&&!x.cancelled;}

function getPaymentPurchaseConfigs(record){
 const keys=new Set(Object.keys(record?.purchaseState||{}));
 Object.keys(record?.stageData||{}).concat((record?.history||[]).map(h=>h.progress),[record?.currentProgress||'']).forEach(p=>{try{const s=parseAffiliateStage(p);if(s&&!s.done)keys.add(s.key);}catch(_){}});
 Object.keys(record||{}).forEach(k=>{const m=/^price(Mau|End)([1-9]\d*)$/.exec(k);if(m&&amount91(record[k])!==null)keys.add((m[1]==='Mau'?'sample:':'end:')+Number(m[2]));});
 return [...keys].map(key=>{const [group,n]=key.split(':'),index=Number(n);if(!['sample','end'].includes(group)||!Number.isSafeInteger(index)||index<1)return null;
 return {key,group,index,label:(group==='sample'?'Mẫu ':'End ')+index,priceKey:(group==='sample'?'priceMau':'priceEnd')+index,valueField:group==='sample'?'price':'endPrice',ordered:'Đặt '+(group==='sample'?'mẫu ':'End ')+index,received:'Nhận '+(group==='sample'?'mẫu ':'End ')+index};}).filter(Boolean).sort((a,b)=>a.group===b.group?a.index-b.index:a.group==='sample'?-1:1);
}

function getPurchaseLedger(r){ensureRecord(r);return getPaymentPurchaseConfigs(r).map(c=>{const s=r.purchaseState[c.key]||{},ordered=!!s.ordered&&!s.cancelled,received=ordered&&!!s.received,amount=ordered?amount91(r[c.priceKey]):0;return {key:c.key,group:c.group,index:c.index,label:c.label,ordered,received,amount,verified:s.verified===true,issue:s.issue||'',bucket:!ordered?'NOT_INCURRED':amount===null?'MISSING_ORDER_PRICE':received?'PAID':'UNPAID'};});}

function getPaymentSummaryForRecord(r){const details=getPurchaseLedger(r),v={paid:0,unpaid:0,incurred:0,sampleTotal:0,endTotal:0,missing:0,review:0,details:[]};details.forEach(x=>{if(x.ordered){if(!x.verified)v.review++;if(x.amount===null)v.missing++;else{v.incurred+=x.amount;v[x.group==='sample'?'sampleTotal':'endTotal']+=x.amount;v[x.received?'paid':'unpaid']+=x.amount;}}v.details.push(Object.assign({},x,{status:!x.ordered?'CHƯA PHÁT SINH / ĐÃ HỦY':x.amount===null?'THIẾU GIÁ ĐẶT':x.received?'ĐÃ THANH TOÁN':'CHƯA THANH TOÁN'}));});return v;}

// truonglt fix native table styling start
function stylePaymentSummary(sheet) {
  ensureAffiliateSummaryColumns(sheet);
  // Google Sheets native Tables can reject column-scoped formatting on P:R.
  // Values P/Q/R are written by updateHeaderTotals; no formatting here.
  const headers = [
    'Tổng tiền đã thanh toán',
    'Tổng tiền chưa thanh toán',
    'Tiền đủ điều kiện hoàn'
  ];
  for (let i = 0; i < headers.length; i++) {
    const cell = sheet.getRange(1, CFG.COL.PAID_TOTAL + i);
    if (cell.getDisplayValue() !== headers[i]) cell.setValue(headers[i]);
  }
}
// truonglt fix native table styling end

function ensureAffiliateSummaryColumns(sheet){if(sheet.getMaxColumns()<CFG.COL.REFUND_TOTAL)sheet.insertColumnsAfter(sheet.getMaxColumns(),CFG.COL.REFUND_TOTAL-sheet.getMaxColumns());}

function getSampleTotal(r){return getPaymentSummaryForRecord(r).sampleTotal;}

function colorStatusCell(

  sheet,

  row

) {

  const cell =

    sheet.getRange(

      row,

      CFG.COL.STATUS

    );



  const status =

    cell

      .getDisplayValue()

      .trim();





  cell

    .setBackground(null)

    .setFontColor(null)

    .setFontWeight(

      'normal'

    );





  if (!status) return;





  // RED

  if (

    status === '⚠️ Cần check hoàn tiền' ||

    status === 'Chưa hoàn' ||

    status === '⚠️ Không cần End 1' ||

    status === '⚠️ Flow này không cần End 1'

  ) {

    styleStatus(

      cell,

      '#F4CCCC',

      '#990000',

      true

    );



    return;

  }





  /**********************************************

   * HẾT HÀNG COUNTDOWN

   **********************************************/

  const remaining =

    extractRemainingDays(

      status

    );



  if (remaining !== null) {



    // truonglt countdown warning color start
    if (remaining <= 7) {

      styleStatus(

        cell,

        '#F4CCCC',

        '#990000',

        true

      );
    // truonglt countdown warning color end

    } else {

      styleStatus(

        cell,

        '#FFF2CC',

        '#7F6000',

        true

      );

    }



    return;

  }





  // ACTION

  if (

    status === 'Có thể đặt mẫu 2' ||

    status.startsWith(

      'Có thể đặt End 1'

    ) ||

    status.startsWith(

      'Có thể đặt End 2'

    )

  ) {

    styleStatus(

      cell,

      '#FCE5CD',

      '#B45F06',

      true

    );



    return;

  }





  // WAIT

  if (

    status === 'Chờ đủ 1 ngày' ||

    status === 'Chờ check hoàn' ||

    status === 'Hết hàng • chưa có ngày nhận'

  ) {

    styleStatus(

      cell,

      '#FFF2CC',

      '#7F6000'

    );



    return;

  }





  // WAIT RECEIVE

  if (

    status === 'Chờ nhận mẫu 1' ||

    status === 'Chờ nhận mẫu 2' ||

    status.startsWith(

      'Chờ nhận End 1'

    ) ||

    status.startsWith(

      'Chờ nhận End 2'

    )

  ) {

    styleStatus(

      cell,

      '#D9EAF7',

      '#134F5C'

    );



    return;

  }





  // DONE

  if (

    status === 'Đã hoàn' ||

    status === 'Hoàn tất'

  ) {

    styleStatus(

      cell,

      '#D9EAD3',

      '#274E13',

      true

    );

  }

}





/*************************************************

 * AUTO CHECK

 *************************************************/

function checkAffiliateStatus(){const sheet=getMainSheet();if(!sheet)return;for(let row=CFG.DATA_START_ROW;row<=sheet.getLastRow();row++){if(getRootName(sheet,row))refreshStatusForRow(sheet,row,null,false);} }

function refreshAllAffiliateStatus(){checkAffiliateStatus();recalculatePaymentSummary();}

function onOpen(){SpreadsheetApp.getUi().createMenu('Tiktok Affiliate V9.1').addItem('Xem thử công nợ (chỉ đọc)','previewAffiliateV91RootFix').addItem('Đối soát mua hàng (chỉ ghi audit)','auditPaymentSummary').addItem('Tính lại P/Q/R (từ record)','recalculatePaymentSummary').addItem('Xác minh lượt đang chọn','verifySelectedAffiliateStage91').addItem('Sửa nhầm: lượt chưa nhận','markSelectedUnreceived91').addItem('Hủy lượt đang chọn','cancelSelectedAffiliateStage91').addItem('Khôi phục lượt','restoreSelectedAffiliateStage91').addToUi();}

function repairAffiliateFinancialData() {
  const sheet = getMainSheet();
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  const repaired = new Set();
  let clearedAmbiguousEnd1 = 0;
  let clearedAmbiguousEnd2 = 0;

  for (let row = CFG.DATA_START_ROW; row <= lastRow; row++) {
    const data = readRow(sheet, row);
    if (!data.name) continue;

    const rootKey = normalizeRootName(data.name);
    if (repaired.has(rootKey)) continue;
    repaired.add(rootKey);

    let record =
      loadRecord(data.name) ||
      createEmptyRecord(data.name);

    ensureRecord(record);

    const progress = normalizeProgress(data.progress);

    // Chỉ tin giá mua End được ghi tại chính bước ĐẶT tương ứng.
    // Tuyệt đối không lấy từ Nhận End 1/2 vì ô Nhận có thể là giá
    // được hiển thị lại và dữ liệu legacy có thể đã mang giá stage trước.
    const end1 = getStrictOrderedStageValue(
      record,
      'Đặt End 1',
      'endPrice'
    );

    const end2 = getStrictOrderedStageValue(
      record,
      'Đặt End 2',
      'endPrice'
    );

    let priceEnd1 = end1;
    let priceEnd2 = end2;

    // Giá đang hiển thị chỉ được dùng nếu hiện tại đang đứng đúng bước ĐẶT.
    if (
      progress === 'Đặt End 1' &&
      isNumericMoney(data.endPrice)
    ) {
      priceEnd1 = Number(data.endPrice);
    }

    if (
      progress === 'Đặt End 2' &&
      isNumericMoney(data.endPrice)
    ) {
      priceEnd2 = Number(data.endPrice);
    }

    if (
      isNumericMoney(record.priceEnd1) &&
      priceEnd1 === null
    ) {
      clearedAmbiguousEnd1++;
    }

    if (
      isNumericMoney(record.priceEnd2) &&
      priceEnd2 === null
    ) {
      clearedAmbiguousEnd2++;
    }

    record.priceEnd1 = priceEnd1;
    record.priceEnd2 = priceEnd2;

    // Xóa field legacy chung. Một giá chung không thể xác định thuộc End 1 hay End 2.
    if (
      Object.prototype.hasOwnProperty.call(
        record,
        'endPrice'
      )
    ) {
      delete record.endPrice;
    }

    // Đồng bộ các field cấp sản phẩm.
    record.wholesale =
      isNumericMoney(data.wholesale)
        ? Number(data.wholesale)
        : record.wholesale;

    record.qty =
      isNumericMoney(data.qty)
        ? Number(data.qty)
        : record.qty;

    // Giá bán End/SL bán End được giữ theo slot riêng.
    // Nếu đang nhập sớm ở Nhận mẫu 2, xác định slot theo flow.
    const sellSlot =
      getEndSellPriceSlot(
        progress,
        data.refundQty
      );

    if (
      sellSlot &&
      isNumericMoney(data.sellEnd)
    ) {
      record[sellSlot] = Number(data.sellEnd);
    }

    const sellQtySlot =
      getEndSellQtySlot(
        progress,
        data.refundQty
      );

    if (
      sellQtySlot &&
      isNumericMoney(data.sellEndQty)
    ) {
      record[sellQtySlot] = Number(data.sellEndQty);
    }

    record.profit =
      calculateProjectedProfit(record);

    saveRecord(data.name, record);
    updateProfitForRow(sheet, row, record);
  }

  updateHeaderTotals(sheet);

  SpreadsheetApp
    .getActive()
    .toast(
      `Đã repair ${repaired.size} Root Name. ` +
      `Đã loại ${clearedAmbiguousEnd1} End 1 và ` +
      `${clearedAmbiguousEnd2} End 2 không có bằng chứng giá tại bước Đặt.`,
      'Affiliate V9',
      10
    );
}


/*************************************************

 * SETUP

 *************************************************/

function migrateAffiliateLayout() {
  const sheet = getMainSheet();
  if (!sheet) return;

  ensureAffiliateSummaryColumns(sheet);

  const headers = sheet
    .getRange(
      1,
      1,
      1,
      Math.min(
        sheet.getLastColumn(),
        CFG.COL.UNPAID_TOTAL
      )
    )
    .getDisplayValues()[0]
    .map(
      v =>
        String(v || '')
          .trim()
          .toLowerCase()
    );

  // Nếu A:O đã là layout hiện tại thì chỉ cần bổ sung summary P:Q.
  if (
    headers[3] === 'tiến độ' &&
    headers[12] === 'sl bán end'
  ) {
    applyAffiliateHeaders(sheet);
    updateHeaderTotals(sheet);

    SpreadsheetApp
      .getActive()
      .toast(
        'Layout workflow giữ nguyên A:O. Đã thêm summary thanh toán ở P:Q.',
        'Affiliate V9',
        5
      );

    return;
  }

  // Hỗ trợ migrate từ layout cũ.
  const isLegacyLayout =
    headers[5] === 'tiến độ' ||
    headers[11] === 'giá bán end' ||
    headers[11] === 'giá bán end/đv';

  if (!isLegacyLayout) {
    SpreadsheetApp
      .getUi()
      .alert(
        'Không tự nhận diện được layout hiện tại. Hãy kiểm tra header trước khi chạy migration.'
      );
    return;
  }

  // Layout cũ -> workflow hiện tại
  sheet.moveColumns(
    sheet.getRange(1, 6, sheet.getMaxRows(), 1),
    4
  );

  sheet.moveColumns(
    sheet.getRange(1, 6, sheet.getMaxRows(), 1),
    5
  );

  sheet.moveColumns(
    sheet.getRange(1, 7, sheet.getMaxRows(), 1),
    6
  );

  sheet.moveColumns(
    sheet.getRange(1, 9, sheet.getMaxRows(), 1),
    7
  );

  sheet.insertColumnBefore(13);

  ensureAffiliateSummaryColumns(sheet);
  applyAffiliateHeaders(sheet);
  updateHeaderTotals(sheet);

  SpreadsheetApp
    .getActive()
    .toast(
      'Đã chuyển layout và thêm Tổng đã thanh toán / Tổng chưa thanh toán.',
      'Migration V9 hoàn tất',
      7
    );
}

function applyAffiliateHeaders(sheet) {
  ensureAffiliateSummaryColumns(sheet);

  const headers = [
    'Tên sản phẩm',
    'Hình ảnh',
    'SL đơn hoàn',
    'Tiến độ',
    'PIC',
    'Ngày',
    'Status',
    'Giá Sample',
    'Giá mua End',
    'Giá bán sỉ Sample/đv',
    'SL Sample bán',
    'Giá bán End/đv',
    'SL bán End',
    'Profit',
    'Ghi chú'
  ];

  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers]);

  sheet
    .getRange(1, CFG.COL.PAID_TOTAL)
    .setValue('Tổng tiền đã thanh toán');

  sheet
    .getRange(1, CFG.COL.UNPAID_TOTAL)
    .setValue('Tổng tiền chưa thanh toán');

  stylePaymentSummary(sheet);
}

function setupAffiliateAutomation() {
  // truonglt V9.1 root fix start — V9 original, no automatic backup as requested.
  const sheet=getMainSheet();if(!sheet)throw Error('Không thấy Trang tính2');
  const props=PropertiesService.getDocumentProperties();
  if(props.getProperty('AFF_V91_SETUP_DONE'))throw Error('Đã kích hoạt V9.1; không chạy setup lần nữa.');
  const check=preflightAffiliateV91();
  if(!check.products||check.missing.length||check.invalid.length||check.duplicates.length)
    throw Error('DỪNG: kiểm tra preview trước; thiếu/lỗi/trùng record.');
  const pending=[];
  for(let row=CFG.DATA_START_ROW;row<=sheet.getLastRow();row++){
    const name=getRootName(sheet,row);if(!name)continue;
    const r=loadRecord(name);if(!r)throw Error('Thiếu '+name);
    const d=readRow(sheet,row),stage=parseAffiliateStage(d.progress);
    if(stage&&!stage.done){
      const st=r.purchaseState[stage.key]||{ordered:false,received:false,cancelled:false,verified:false,issue:''};
      st.ordered=true;
      if(stage.received)st.received=true;
      else if(st.received){st.received=false;st.issue='MÂU THUẪN: Sheet đang Đặt, lịch sử từng Nhận';st.verified=false;}
      r.purchaseState[stage.key]=st;
      const displayed=amount91(stage.group==='sample'?d.price:d.endPrice);
      if(!stage.received&&displayed!==null){
        const priceKey=(stage.group==='sample'?'priceMau':'priceEnd')+stage.index;
        r[priceKey]=displayed;
      }
    }
    pending.push({name,r});
  }
  // Only the active 24 products are migrated; stale AFF_PRODUCT_ records are left untouched.
  pending.forEach(x=>saveRecord(x.name,x.r));
  ensureAffiliateSummaryColumns(sheet);
  updateHeaderTotals(sheet);auditPaymentSummary();
  props.setProperty('AFF_V91_SETUP_DONE',new Date().toISOString());
  Logger.log('MIGRATED '+pending.length+' active records. No backup created.');
  // Create triggers only after successful migration.
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().filter(t=>['onEdit','checkAffiliateStatus'].includes(t.getHandlerFunction())).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('checkAffiliateStatus').timeBased().everyHours(1).create();
  // truonglt V9.1 root fix end
}

function recalculatePaymentSummary(){const sheet=getMainSheet();if(!sheet)throw Error('Không thấy tab dữ liệu');updateHeaderTotals(sheet);}

function auditPaymentSummary() {
  // truonglt fix audit native table start
  // An always-new, plain worksheet avoids touching any existing Google Sheets Table.
  // Financial records and Trang tính2 are READ ONLY in this function.
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getMainSheet();
  if (!sheet) throw new Error('Không tìm thấy Trang tính2');

  const headers = ['Dong','San pham','Tien do Sheet','Luot','Gia Dat','Thanh toan',
    'Xac minh','Canh bao','Da thanh toan','Chua thanh toan','Tien du hoan'];
  const rows = [];
  const seen = new Set();
  for (let row = CFG.DATA_START_ROW; row <= sheet.getLastRow(); row++) {
    const d = readRow(sheet, row);
    if (!d.name) continue;
    const k = normalizeRootName(d.name);
    if (seen.has(k)) continue;
    seen.add(k);
    const r = loadRecord(d.name);
    if (!r) {
      rows.push([row,d.name,d.progress,'KHONG CO RECORD','','','','MISSING RECORD',0,0,0]);
      continue;
    }
    const p = getPaymentSummaryForRecord(r);
    const refund = getRefundEligible91(r);
    for (const x of p.details) {
      rows.push([row,d.name,d.progress,x.label,x.amount === null ? '' : x.amount,x.status,
        x.verified ? 'Da xac minh' : 'Can doi soat',x.issue,
        x.bucket === 'PAID' ? (x.amount || 0) : 0,
        x.bucket === 'UNPAID' ? (x.amount || 0) : 0,
        refund.total]);
    }
  }

  // Do not clear, resize, format, or reuse a tab containing a native Table.
  // Always create a new tab; older audits remain untouched for comparison.
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMdd_HHmmss');
  const base = 'PAYMENT_AUDIT_V91_' + stamp;
  let auditName = base;
  let suffix = 1;
  while (ss.getSheetByName(auditName)) auditName = base + '_' + suffix++;
  const audit = ss.insertSheet(auditName);
  audit.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) audit.getRange(2, 1, rows.length, headers.length).setValues(rows);
  SpreadsheetApp.flush();
  Logger.log('AUDIT OK: ' + seen.size + ' sản phẩm, ' + rows.length + ' lượt, tab ' + auditName);
  ss.toast('Đã tạo audit: ' + rows.length + ' lượt', 'V9.1', 5);
  return {products:seen.size,stages:rows.length,sheet:auditName};
  // truonglt fix audit native table end
}

function createEmptyRecord(name){return {name,schemaVersion:'9.1',stageData:{},history:[],purchaseState:{},currentProgress:'',currentDate:'',refundQty:null,wholesale:null,qty:null,note:'',profit:null};}

// truonglt V9.1 root fix start — an explicit blank on the latest buy-price edit cancels that order's cost.
function lastBuyEdit91(record, cfg) {
  const arr = Array.isArray(record.history) ? record.history : [];
  const type = cfg.group === 'end' ? 'END_BUY_PRICE_EDIT' : 'PRICE_EDIT';
  for (let i = arr.length-1; i >= 0; i--) {
    const h = arr[i];
    if (!h || h.type !== type) continue;
    let p; try { p = normalizeProgress(h.progress); } catch (_) { continue; }
    if (p !== cfg.ordered) continue;
    const value = (h.data || {})[cfg.valueField];
    return {found:true, amount:amount91(value), cleared:value==='' || value===null || value===undefined};
  }
  return {found:false,amount:null,cleared:false};
}
function findStage91(record, label) {
  const k=Object.keys(record.stageData||{}).find(x=>{try{return normalizeProgress(x)===label;}catch(_){return false;}});
  return k ? record.stageData[k] : null;
}
// truonglt V9.1 root fix end

function ensureRecord(record) {
  // truonglt V9.1 root fix start
  record.stageData=record.stageData||{};
  record.history=Array.isArray(record.history)?record.history:[];
  record.purchaseState=record.purchaseState||{};
  if (record.schemaVersion==='9.1') return;
  Object.entries(record.progressDates||{}).forEach(([p,date])=>{
    if (!record.stageData[p]) record.stageData[p]={progress:p,date};
  });
  let current=null;
  try { current=parseAffiliateStage(record.currentProgress); } catch (_) {}
  getPaymentPurchaseConfigs(record).forEach(cfg=>{
    const order=findStage91(record,cfg.ordered);
    const receive=findStage91(record,cfg.received);
    const hOrder=record.history.filter(h=>{
      try{return normalizeProgress(h.progress)===cfg.ordered &&
        ['ENTER_STAGE','LEAVE_STAGE','PRICE_EDIT','END_BUY_PRICE_EDIT'].includes(h.type);}catch(_){return false;}
    });
    const hReceive=record.history.some(h=>{
      try{return normalizeProgress(h.progress)===cfg.received && h.type==='ENTER_STAGE';}catch(_){return false;}
    });
    const active=!!current&&!current.done&&current.key===cfg.key;
    const last=lastBuyEdit91(record,cfg);
    const received=!!receive||hReceive||(active&&current.received);
    // A removed price is not an active unpaid debt. Keep the event history untouched.
    const cleared=last.found&&last.cleared&&!received&&!(active&&!current.received&&amount91(record[cfg.priceKey])!==null);
    const ordered=(!!order||!!receive||hOrder.length>0||hReceive||active)&&!cleared;
    let amount=null;
    if (ordered) {
      if (last.found) amount=last.amount;
      else if (order&&Object.prototype.hasOwnProperty.call(order,cfg.valueField))amount=amount91(order[cfg.valueField]);
      else if (receive&&cfg.group==='sample')amount=amount91(receive[cfg.valueField]);
      else if (active)amount=amount91(record[cfg.priceKey]);
      else if (cfg.group==='sample')amount=amount91(record[cfg.priceKey]);
    }
    // Keep the independent historical slot untouched when a cancelled order was cleared;
    // accounting only looks at purchaseState. Future Đặt explicitly reactivates the slot.
    if (ordered) record[cfg.priceKey]=amount;
    const conflict=active&&!current.received&&received;
    record.purchaseState[cfg.key]={ordered,received:ordered&&received&&!conflict,cancelled:false,
      verified:false,issue:cleared?'Đã xóa giá tại bước Đặt: không tính công nợ':
      ordered?'CẦN ĐỐI SOÁT V9'+(conflict?' | Đặt hiện tại khác lịch sử Nhận':'')+
        (amount===null?' | THIẾU GIÁ ĐẶT':''):''};
  });
  record.schemaVersion='9.1';
  // truonglt V9.1 root fix end
}

function saveRecord(name,record) {
  // truonglt V9.1 root fix start — compress/chunk values; never silently trim history.
  ensureRecord(record);
  const props=PropertiesService.getDocumentProperties(),key=getStorageKey(name);
  const json=JSON.stringify(record);
  const compressed=Utilities.gzip(Utilities.newBlob(json,'application/json','affiliate.json'));
  const encoded=Utilities.base64Encode(compressed.getBytes());
  const parts=encoded.match(/[\s\S]{1,7300}/g)||[''];
  const old=props.getProperty(key);
  if(parts.length>150)throw Error('Record quá lớn; không lưu để tránh mất dữ liệu: '+name);
  // Write parts first, then atomically switch the manifest (single property update).
  const version=Utilities.getUuid().replace(/-/g,'').slice(0,12);
  const prefix=key+'__'+version+'_';
  parts.forEach((v,i)=>props.setProperty(prefix+i,v));
  const manifest='AFFZ91|'+version+'|'+parts.length+'|'+encoded.length;
  try { props.setProperty(key,manifest); }
  catch(e){parts.forEach((_,i)=>props.deleteProperty(prefix+i));throw e;}
  // Delete only obsolete generated chunks AFTER manifest has been committed.
  if(old&&old.startsWith('AFFZ91|')){
    const prev=old.split('|'),oldPrefix=key+'__'+prev[1]+'_';
    for(let i=0;i<Number(prev[2]);i++)props.deleteProperty(oldPrefix+i);
  }
  // truonglt V9.1 root fix end
}

function loadRecord(name) {
  // truonglt V9.1 root fix start — supports original V9 raw JSON + compressed V9.1.
  if(!name)return null;
  const props=PropertiesService.getDocumentProperties(),key=getStorageKey(name);
  const raw=props.getProperty(key);if(!raw)return null;
  let json=raw;
  if(raw.startsWith('AFFZ91|')){
    const x=raw.split('|'),version=x[1],count=Number(x[2]),size=Number(x[3]);
    if(!version||!Number.isSafeInteger(count)||count<1||count>150)throw Error('Manifest hỏng: '+name);
    let encoded='';
    for(let i=0;i<count;i++){
      const part=props.getProperty(key+'__'+version+'_'+i);
      if(part===null)throw Error('Thiếu part '+i+' của '+name);
      encoded+=part;
    }
    if(encoded.length!==size)throw Error('Số byte Base64 không khớp: '+name);
    try {
      json=Utilities.ungzip(Utilities.newBlob(
        Utilities.base64Decode(encoded),'application/x-gzip','affiliate.gz'
      )).getDataAsString('UTF-8');
    }catch(e){throw Error('Không giải nén được '+name+': '+e.message);}
  }
  let record;
  try{record=JSON.parse(json);}catch(e){throw Error('JSON lỗi của '+name+': '+e.message);}
  ensureRecord(record);
  return record;
  // truonglt V9.1 root fix end
}

function readRow(
  sheet,
  row
) {
  const v =
    sheet
      .getRange(
        row,
        1,
        1,
        CFG.COL.NOTE
      )
      .getValues()[0];

  const d =
    sheet
      .getRange(
        row,
        1,
        1,
        CFG.COL.NOTE
      )
      .getDisplayValues()[0];

  return {
    name:
      String(
        d[CFG.COL.NAME - 1] || ''
      ).trim(),

    refundQty:
      v[CFG.COL.REFUND_QTY - 1],

    price:
      v[CFG.COL.PRICE - 1],

    pic:
      String(
        d[CFG.COL.PIC - 1] || ''
      ).trim(),

    progress:
      String(
        d[CFG.COL.PROGRESS - 1] || ''
      ).trim(),

    date:
      v[CFG.COL.DATE - 1],

    endPrice:
      v[CFG.COL.END_PRICE - 1],

    status:
      String(
        d[CFG.COL.STATUS - 1] || ''
      ).trim(),

    wholesale:
      v[CFG.COL.WHOLESALE - 1],

    qty:
      v[CFG.COL.QTY - 1],

    sellEnd:
      v[CFG.COL.SELL_END - 1],

    sellEndQty:
      v[CFG.COL.SELL_END_QTY - 1],

    profit:
      v[CFG.COL.PROFIT - 1],

    note:
      String(
        d[CFG.COL.NOTE - 1] || ''
      ).trim()
  };
}





/*************************************************

 * IMAGE

 *************************************************/

function saveImageToRecord(

  sheet,

  row,

  record

) {

  const cell =

    sheet.getRange(

      row,

      CFG.COL.IMAGE

    );



  const formula =

    cell.getFormula();



  if (formula) {

    record.image = {

      type:

        'formula',

      value:

        formula

    };



    return;

  }





  const value =

    cell.getValue();



  if (

    typeof value === 'string' ||

    typeof value === 'number'

  ) {

    record.image = {

      type:

        'value',

      value:

        value

    };

  }

}

function restoreImageFromRecord(

  sheet,

  row,

  record

) {

  if (!record.image) return;



  const cell =

    sheet.getRange(

      row,

      CFG.COL.IMAGE

    );



  if (

    record.image.type ===

    'formula'

  ) {

    cell.setFormula(

      record.image.value

    );

  } else {

    cell.setValue(

      record.image.value

    );

  }

}





/*************************************************

 * HELPERS - WORKFLOW

 *************************************************/

function isSample1(p){const s=parseAffiliateStage(p);return !!s&&!s.done&&s.group==='sample'&&s.index===1;}

function isSample2(p){const s=parseAffiliateStage(p);return !!s&&!s.done&&s.group==='sample'&&s.index===2;}

function isReceivedSample(p){const s=parseAffiliateStage(p);return !!s&&!s.done&&s.group==='sample'&&s.received;}

function isEndProgress(p){const s=parseAffiliateStage(p);return !!s&&!s.done&&s.group==='end';}

function isFinalRefundStatus(

  status

) {

  return (

    status === 'Đã hoàn' ||

    status === 'Chưa hoàn'

  );

}

function isOutOfStock(note){return /(^|[\s.,;:])hết hàng(?=$|[\s.,;:])/i.test(String(note||''));}

function normalizeProgress(v){const s=parseAffiliateStage(v);return s?s.label:'';}

function passedHours(

  start,

  end,

  hours

) {

  return (

    start instanceof Date &&

    hoursBetween(

      start,

      end

    ) >= hours

  );

}

function hoursBetween(

  start,

  end

) {

  return (

    end.getTime() -

    start.getTime()

  ) /

  3600000;

}

function daysBetween(

  start,

  end

) {

  return (

    hoursBetween(

      start,

      end

    ) / 24

  );

}

function dateToISO(

  date

) {

  return Utilities

    .formatDate(

      date,

      Session

        .getScriptTimeZone(),

      'yyyy-MM-dd HH:mm:ss'

    );

}

function isoToDate(

  value

) {

  if (!value) return '';



  const match =

    String(value)

      .match(

        /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/

      );



  if (!match) {

    return new Date(value);

  }



  return new Date(

    Number(match[1]),

    Number(match[2]) - 1,

    Number(match[3]),

    Number(match[4] || 0),

    Number(match[5] || 0),

    Number(match[6] || 0)

  );

}

function serializeDate(

  value

) {

  return (

    value instanceof Date

  )

    ? dateToISO(value)

    : '';

}

function formatDate(

  date

) {

  return Utilities

    .formatDate(

      date,

      Session

        .getScriptTimeZone(),

      'dd/MM/yyyy'

    );

}





/*************************************************

 * HELPERS - STATUS

 *************************************************/

function statusResult(

  status,

  note = ''

) {

  return {

    status:

      status,

    note:

      note

  };

}

function extractRemainingDays(

  status

) {

  const match =

    String(status)

      .match(

        /^Hết hàng • còn (\d+) ngày hoàn$/

      );



  return match

    ? Number(match[1])

    : null;

}

function styleStatus(

  cell,

  background,

  fontColor,

  bold = false

) {

  cell

    .setBackground(

      background

    )

    .setFontColor(

      fontColor

    )

    .setFontWeight(

      bold

        ? 'bold'

        : 'normal'

    );

}





/*************************************************

 * HELPERS - GENERAL

 *************************************************/

function getMainSheet() {

  return SpreadsheetApp

    .getActiveSpreadsheet()

    .getSheetByName(

      CFG.SHEET

    );

}

function getRootName(

  sheet,

  row

) {

  return sheet

    .getRange(

      row,

      CFG.COL.NAME

    )

    .getDisplayValue()

    .trim();

}

function getCurrentProgress(

  sheet,

  row

) {

  return normalizeProgress(

    sheet

      .getRange(

        row,

        CFG.COL.PROGRESS

      )

      .getDisplayValue()

  );

}

function normalizeRootName(

  value

) {

  return normalizeText(

    value

  )

    .replace(

      /\s+/g,

      ' '

    );

}

function normalizeText(

  value

) {

  return String(

    value || ''

  )

    .trim()

    .toLowerCase();

}

function getStorageKey(

  name

) {

  return (

    CFG.STORE_PREFIX +

    normalizeRootName(name)

  );

}

function isNumericMoney(v){return v!==''&&v!==null&&v!==undefined&&typeof v!=='boolean'&&Number.isFinite(Number(v))&&Number(v)>=0;}

function toMoney(

  value

) {

  return isNumericMoney(

    value

  )

    ? Number(value)

    : null;

}

function loadPrice(

  cell,

  value

) {

  const money =

    toMoney(value);



  if (money === null) {

    cell.clearContent();

  } else {

    cell.setValue(

      money

    );

  }

}

function loadNumber(cell, value) {
  const number = toMoney(value);
  if (number === null) {
    cell.clearContent();
  } else {
    cell.setValue(number);
  }
}

function setCell(

  sheet,

  row,

  col,

  value

) {

  sheet

    .getRange(

      row,

      col

    )

    .setValue(

      value

    );

}

function setIfExists(

  sheet,

  row,

  col,

  value

) {

  if (

    value !== undefined &&

    value !== null

  ) {

    setCell(

      sheet,

      row,

      col,

      value

    );

  }

}





/*************************************************

 * FLOW VALIDATION

 *************************************************/

function validateFlow(

  sheet,

  row,

  progress

) {

  const refundQty =

    Number(

      sheet

        .getRange(

          row,

          CFG.COL.REFUND_QTY

        )

        .getValue()

    ) || 0;





  if (

    refundQty === 1 &&

    (

      progress === 'Đặt End 1' ||

      progress === 'Nhận End 1'

    )

  ) {

    SpreadsheetApp

      .getActive()

      .toast(

        'SL đơn để hoàn = 1 nên không cần End 1. Sau Nhận mẫu 2 đi thẳng End 2.',

        '⚠️ Workflow',

        7

      );

  }

}


/***** V9.1 EXTENSIONS *****/
function parseAffiliateStage(value){
 const s=String(value||'').trim().replace(/\s+/g,' ');if(!s)return null;
 if(/^done$/i.test(s))return {done:true,label:'Done'};
 const m=/^(đặt|nhận)\s+(mẫu|sample|end)\s+([1-9]\d*)$/i.exec(s);
 if(!m||!Number.isSafeInteger(Number(m[3])))throw new Error('Tiến độ không hợp lệ: Đặt/Nhận mẫu N hoặc Đặt/Nhận End N.');
 const group=m[2].toLowerCase()==='end'?'end':'sample',index=Number(m[3]),received=m[1].toLowerCase()==='nhận';
 return {group,index,received,key:group+':'+index,label:(received?'Nhận ':'Đặt ')+(group==='end'?'End ':'mẫu ')+index};
}

function amount91(v){return isNumericMoney(v)?Number(v):null;}

function stageExists91(record,label){return Object.keys(record.stageData||{}).some(p=>{try{return normalizeProgress(p)===label;}catch(_){return false;}})|| (record.history||[]).some(h=>{try{return normalizeProgress(h.progress)===label&&(['ENTER_STAGE','LEAVE_STAGE','PRICE_EDIT','END_BUY_PRICE_EDIT','DATE_EDIT','PIC_EDIT'].includes(h.type));}catch(_){return false;}});}

function getRefundEligible91(r){const d=getPurchaseLedger(r),m=new Map(d.filter(x=>x.group==='sample'&&x.ordered).map(x=>[x.index,x]));let total=0,missing=0;d.filter(x=>x.group==='end'&&x.received).forEach(x=>{const s=m.get(x.index);if(s&&s.amount!==null)total+=s.amount;else missing++;});return {total,missing};}

function recordStageSafe91(sheet,row,p,r){if(!p)return;const snap=buildSnapshot(sheet,row,p);r.stageData[p]=snap;const s=parseAffiliateStage(p);if(!s||s.done)return;const picKey=(s.group==='end'?'picEnd':'picMau')+s.index;r[picKey]=snap.pic||'';}

function editBuy91(sheet,row,group){const name=getRootName(sheet,row),p=getCurrentProgress(sheet,row),s=parseAffiliateStage(p),col=group==='sample'?CFG.COL.PRICE:CFG.COL.END_PRICE;if(!name)return;const r=loadRecord(name)||createEmptyRecord(name);ensureRecord(r);
 if(!s||s.done||s.group!==group||s.received){const key=s&&!s.done&&s.group===group?(group==='sample'?'priceMau':'priceEnd')+s.index:null;loadPrice(sheet.getRange(row,col),key?r[key]:null);throw new Error('Giá mua chỉ chỉnh tại bước Đặt cùng lượt.');}
 const v=sheet.getRange(row,col).getValue();if(v!==''&&!isNumericMoney(v))throw new Error('Giá mua không hợp lệ');const key=(group==='sample'?'priceMau':'priceEnd')+s.index;r[key]=amount91(v);
 let state=r.purchaseState[s.key]||{ordered:true,received:false,cancelled:false,verified:true,issue:''};state.ordered=true;state.cancelled=false;r.purchaseState[s.key]=state;if(!r.stageData[s.label])r.stageData[s.label]={};r.stageData[s.label][group==='sample'?'price':'endPrice']=r[key];saveRecord(name,r);}

function getPaymentPurchaseConfigsLegacy(){return [];}

function selectedStage91(){const sheet=getMainSheet(),row=sheet.getActiveRange().getRow(),name=getRootName(sheet,row);if(row<CFG.DATA_START_ROW||!name)throw Error('Chọn ô ở dòng sản phẩm');const p=getCurrentProgress(sheet,row),s=parseAffiliateStage(p);if(!s||s.done)throw Error('Chọn Đặt/Nhận mẫu N hoặc End N');const r=loadRecord(name);if(!r)throw Error('Không có record');ensureRecord(r);return {sheet,row,name,r,s};}

function changeSelectedStage91(fn,type){const x=selectedStage91(),r=x.r,st=r.purchaseState[x.s.key];if(!st)throw Error('Lượt chưa có dữ liệu');fn(st,x);appendHistory(r,type,x.s.label,{key:x.s.key});saveRecord(x.name,r);updateHeaderTotals(x.sheet);auditPaymentSummary();}

function verifySelectedAffiliateStage91(){changeSelectedStage91((st,x)=>{if(!st.ordered||amount91(x.r[(x.s.group==='sample'?'priceMau':'priceEnd')+x.s.index])===null)throw Error('Chưa Đặt hoặc thiếu giá.');st.verified=true;st.issue='';},'VERIFY_STAGE');}

function markSelectedUnreceived91(){changeSelectedStage91((st)=>{st.received=false;st.verified=true;st.issue='';},'CORRECT_UNRECEIVED');}

function cancelSelectedAffiliateStage91(){changeSelectedStage91(st=>{st.cancelled=true;},'CANCEL_STAGE');}

function restoreSelectedAffiliateStage91(){changeSelectedStage91(st=>{st.cancelled=false;},'RESTORE_STAGE');}
// truonglt V9.1 end


// truonglt V9.1 start — non-destructive backup/preflight
function preflightAffiliateV91() {
 const sheet=getMainSheet(); if(!sheet)throw Error('Không tìm thấy Trang tính2');
 const props=PropertiesService.getDocumentProperties();if(!props)throw Error('Thiếu DocumentProperties');
 const names=[],missing=[],invalid=[],dupes=[];const seen=new Set();
 for(let row=CFG.DATA_START_ROW;row<=sheet.getLastRow();row++){
  const name=getRootName(sheet,row);if(!name)continue;const key=normalizeRootName(name);
  if(seen.has(key)){dupes.push({row,name});continue;}seen.add(key);names.push({row,name});
  const raw=props.getProperty(getStorageKey(name));
  if(!raw){missing.push({row,name});continue;}
  // truonglt fix preflight AFFZ91 start
  try{const r=loadRecord(name);if(!r||typeof r!=='object')invalid.push({row,name,error:'Record trống'});}
  // truonglt fix preflight AFFZ91 end
  catch(e){invalid.push({row,name,error:String(e)});}
 }
 const result={sheet:sheet.getName(),products:names.length,records:names.length-missing.length-invalid.length,missing,invalid,duplicates:dupes,setupDone:!!props.getProperty('AFF_V91_SETUP_DONE')};
 Logger.log(JSON.stringify(result));
 SpreadsheetApp.getActive().toast('Có '+result.records+'/'+result.products+' record, thiếu '+missing.length+', lỗi '+invalid.length,'V9.1 PREFLIGHT',10);
 return result;
}
function backupAffiliateV9Properties91() {
 const check=preflightAffiliateV91();if(check.missing.length||check.invalid.length||check.duplicates.length)throw Error('DỪNG: thiếu/không đọc được record hoặc trùng tên; xem Execution log.');
 const ss=SpreadsheetApp.getActiveSpreadsheet(),props=PropertiesService.getDocumentProperties();
 const now=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd_HHmmss');
 const existing=Object.entries(props.getProperties());
 const grid=getMainSheet().copyTo(ss);grid.setName('BACKUP_V9_'+now);
 const out=ss.insertSheet('BACKUP_PROPS_'+now),rows=[['KEY','PART','TOTAL_PARTS','RAW_VALUE_PART']];
 // Cell can hold up to 50k chars; 7000-char chunks also keep each existing property exact.
 existing.forEach(([key,value])=>{const parts=value.match(/[\s\S]{1,7000}/g)||[''];parts.forEach((part,i)=>rows.push([key,i+1,parts.length,part]));});
 if(rows.length>out.getMaxRows())out.insertRowsAfter(out.getMaxRows(),rows.length-out.getMaxRows());
 out.getRange(1,1,rows.length,4).setNumberFormat('@').setValues(rows);
 const read=out.getRange(2,1,rows.length-1,4).getValues(),reloaded={};
 read.forEach(r=>{(reloaded[r[0]]||(reloaded[r[0]]=[]))[Number(r[1])-1]=String(r[3]);});
 existing.forEach(([k,v])=>{if(reloaded[k].join('')!==v)throw Error('Backup Properties mismatch: '+k);});
 props.setProperty('AFF_V91_BACKUP_'+now,'BACKUP_PROPS_'+now);
 Logger.log('BACKUP VERIFIED '+existing.length+' properties '+grid.getName()+' '+out.getName());
 return {backupSheet:grid.getName(),backupProperties:out.getName(),propertyCount:existing.length};
}
// truonglt V9.1 end

// truonglt V9.1 root fix start — preview excludes cleared End price orders before migration.
function previewAffiliateV91RootFix() {
 const sheet=getMainSheet();if(!sheet)throw Error('Không có Trang tính2');
 const list=[],missing=[];let paid=0,unpaid=0;
 for(let row=CFG.DATA_START_ROW;row<=sheet.getLastRow();row++){
  const name=getRootName(sheet,row);if(!name)continue;
  const rec=loadRecord(name);if(!rec){missing.push(name);continue;}
  const stage=parseAffiliateStage(sheet.getRange(row,CFG.COL.PROGRESS).getValue());
  if(stage&&!stage.done){
   const data=readRow(sheet,row);
   if(!stage.received){syncCurrentOrder91(rec,data);}
   else {const st=rec.purchaseState[stage.key]||{ordered:false,received:false,cancelled:false};st.ordered=true;st.received=true;rec.purchaseState[stage.key]=st;}
  }
  const sum=getPaymentSummaryForRecord(rec);paid+=sum.paid;unpaid+=sum.unpaid;
  sum.details.filter(d=>d.status==='CHƯA THANH TOÁN').forEach(d=>list.push({row,name,stage:d.label,money:d.amount}));
 }
 Logger.log(JSON.stringify({paid,unpaid,items:list,missing},null,2));
 if(missing.length)throw Error('Thiếu record, dừng trước setup: '+missing.join(', '));
 return {paid,unpaid,items:list};
}
// truonglt V9.1 root fix end


// truonglt fix complete setup without migration start
/**
 * Only run AFTER previewAffiliateV91RootFix and auditPaymentSummary succeed.
 * Does not migrate, rewrite purchaseState or recompute money.
 */
function finishAffiliateSetupWithoutMigration91() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getMainSheet();
  if (!sheet) throw Error('Không tìm thấy Trang tính2');
  const check = preflightAffiliateV91();
  if (!check.products || check.missing.length || check.invalid.length || check.duplicates.length) {
    throw Error('DỪNG: chưa đọc được đầy đủ record; xem preflight log.');
  }
  const existing = ScriptApp.getProjectTriggers();
  const known = new Set(['onEdit', 'checkAffiliateStatus']);
  // Remove duplicates of the two managed triggers only after successful preflight.
  existing.filter(t => known.has(t.getHandlerFunction())).forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('checkAffiliateStatus').timeBased().everyHours(1).create();
  PropertiesService.getDocumentProperties().setProperty('AFF_V91_SETUP_DONE', new Date().toISOString());
  Logger.log('SETUP TRIGGERS OK: ' + check.records + ' records. No migration or payment writes.');
  return {records:check.records, installed:['onEdit','checkAffiliateStatus']};
}
// truonglt fix complete setup without migration end
