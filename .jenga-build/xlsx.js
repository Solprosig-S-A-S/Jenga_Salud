// OOXML con cadenas explícitas: las respuestas nunca se interpretan como fórmulas.
(function(){
'use strict';
const encoder=new TextEncoder();
const xml=value=>String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function column(index){let result='';for(index++;index;index=Math.floor((index-1)/26))result=String.fromCharCode(65+(index-1)%26)+result;return result;}
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function zip(files){
 const parts=[],directory=[];let offset=0,size=0;
 for(const [name,content] of Object.entries(files)){
  const filename=encoder.encode(name),data=encoder.encode(content),checksum=crc(data),local=new Uint8Array(30),lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint32(14,checksum,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,filename.length,true);
  parts.push(local,filename,data);
  const central=new Uint8Array(46),cv=new DataView(central.buffer);
  cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,checksum,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,filename.length,true);cv.setUint32(42,offset,true);
  directory.push(central,filename);size+=central.length+filename.length;offset+=local.length+filename.length+data.length;
 }
 const end=new Uint8Array(22),view=new DataView(end.buffer),count=Object.keys(files).length;
 view.setUint32(0,0x06054b50,true);view.setUint16(8,count,true);view.setUint16(10,count,true);view.setUint32(12,size,true);view.setUint32(16,offset,true);
 return new Blob([...parts,...directory,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
window.JengaXlsx=rows=>{
 if(rows.length>1048576)throw new Error('La consulta supera el límite de filas de Excel. Filtra por fechas.');
 const sheet=rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((value,j)=>'<c r="'+column(j)+(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>').join('')+'</row>').join('');
 return zip({
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Respuestas" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><sheetData>'+sheet+'</sheetData><autoFilter ref="A1:'+column(rows[0].length-1)+rows.length+'"/></worksheet>'
 });
};
})();
