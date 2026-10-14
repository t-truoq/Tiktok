// truonglt Phase5 Vietnamese dashboard, product grid, review, audit and settings start
import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Checkbox, Collapse, Descriptions, Dropdown, Input, List, Pagination, Popover, Radio, Segmented, Select, Space, Spin, Table, Tag, Timeline, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRightOutlined, BellOutlined, CheckCircleOutlined, DownloadOutlined, EditOutlined, FilterOutlined, HistoryOutlined, LockOutlined, PictureOutlined, ReloadOutlined, SettingOutlined, ShopOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, decimalText, money, qs, type History, type Page, type Product, type Summary } from './api';
import { Currency, downloadFile, eventLabels, Failure, FinancialCards, NoData, PageHeading, ScopeTag, StatusTag, useDebounce, useWorkspace } from './ui';
import { EditDialog } from './ProductDrawer';
function useSummary(filters:Record<string,unknown>={}) {const{scope}=useWorkspace();return useQuery({queryKey:['summary',scope,filters],queryFn:()=>api<Summary>('/finance/summary'+qs({classification:scope,...filters}))});}
function useProducts(values:Record<string,unknown>){const{scope}=useWorkspace();return useQuery({queryKey:['products',scope,values],queryFn:()=>api<Page<Product>>('/products'+qs({classification:scope,...values}))});}
export function Dashboard(){
  const navigate=useNavigate(),{showProduct,scope}=useWorkspace(),summary=useSummary(),products=useProducts({limit:5}),review=useQuery({queryKey:['review-preview',scope],queryFn:()=>api<Page<Product>>('/finance/review'+qs({classification:scope,limit:3}))});
  return <><PageHeading title="Tổng quan kinh doanh" subtitle="Nắm rõ dòng tiền, theo dõi lượt mua và ưu tiên những khoản cần đối soát." action={<Button icon={<ReloadOutlined/>} onClick={()=>{summary.refetch();products.refetch();review.refetch();}}>Làm mới</Button>}/>
    {summary.error?<Failure error={summary.error} retry={()=>summary.refetch()}/>:<FinancialCards summary={summary.data} loading={summary.isPending} updatedAt={summary.dataUpdatedAt}/>}
    <div className="dashboard-columns"><Card className="section-card" title={<Space><ShopOutlined/>Sản phẩm trong phạm vi</Space>} extra={<Button type="link" onClick={()=>navigate('/products')}>Xem tất cả <ArrowRightOutlined/></Button>}>
      {products.error?<Failure error={products.error} retry={()=>products.refetch()}/>:<Table<Product> rowKey="id" loading={products.isPending} pagination={false} size="middle" dataSource={products.data?.items} columns={[
        {title:'Sản phẩm',dataIndex:'rootName',render:(name,p)=><button className="product-link" onClick={()=>showProduct(p.id)}>{name}</button>},
        {title:'Giai đoạn',dataIndex:'currentStageLabel',render:v=><span className="stage-text">{v||'—'}</span>},
        {title:'Chưa thanh toán',align:'right',render:(_,p)=><Currency value={p.finance?.payment.unpaid}/>}
      ]}/>}</Card>
      <Card className="section-card attention-card" title={<Space><BellOutlined/>Cần ưu tiên</Space>} extra={<Tag color="orange">{review.data?.total??'—'} sản phẩm</Tag>}>
        <Spin spinning={review.isPending}>{review.error?<Failure error={review.error} retry={()=>review.refetch()}/>:review.data?.items.length?<List dataSource={review.data.items} renderItem={p=><List.Item><button className="attention-item" onClick={()=>showProduct(p.id)}>
          <strong>{p.rootName}</strong><div><AttentionTags product={p}/></div></button></List.Item>}/>:<NoData description="Không có mục cần xử lý trong phạm vi này."/>}</Spin><Button block onClick={()=>navigate('/alerts')}>Mở danh sách cần xử lý</Button></Card></div>
    <div className="info-banner"><CheckCircleOutlined/><div><strong>Các tổng được tính từ dữ liệu thực</strong><p>Backend giữ công thức V9.1. Lịch sử, giá thiếu và trạng thái chưa xác minh luôn được hiển thị để bạn kiểm tra.</p></div><ScopeTag/></div>
  </>;
}
function AttentionTags({product:p}:{product:Product}){const a=p.attention;return <Space wrap size={4}>{a?.missingPrices?<Tag color="red">{a.missingPrices} lượt thiếu giá</Tag>:null}
  {a?.unverified?<Tag color="orange">{a.unverified} lượt chưa xác minh</Tag>:null}{a?.refundDue?<Tag color="gold">Đến hạn kiểm tra hoàn</Tag>:null}{a?.historyConflict?<Tag color="purple">Lịch sử cần đối soát</Tag>:null}{a?.dateIssue?<Tag color="red">Ngày chưa rõ</Tag>:null}</Space>;}
function thumb(product:Product){const reference=product.sourceView?.imageReference;const value=typeof reference==='string'?reference:reference&&typeof reference==='object'&&'url' in reference?String((reference as any).url):'';
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}}
function ResizeHead({children,width,onResizeWidth,...rest}:any){return <th {...rest} style={{...rest.style,width}}>{children}{onResizeWidth?<button className="resize-handle" aria-label="Điều chỉnh độ rộng cột" onClick={e=>e.stopPropagation()} onKeyDown={e=>{
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onResizeWidth(Math.max(80,width+(e.key==='ArrowLeft'?-16:16)));}}} onPointerDown={e=>{e.preventDefault();e.stopPropagation();const start=e.clientX,w=width,controller=new AbortController();
    document.addEventListener('pointermove',event=>onResizeWidth(Math.max(80,Math.min(700,w+event.clientX-start))),{signal:controller.signal});document.addEventListener('pointerup',()=>controller.abort(),{once:true,signal:controller.signal});}}/>:null}</th>;}
const defaultColumns=['rootName','stage','status','sampleBuy','endBuy','wholesale','qty','profit','paid','unpaid','refundEligible','note'];
const columnNames:Record<string,string>={rootName:'Sản phẩm',image:'Ảnh',refundQty:'Số lượng hoàn',stage:'Giai đoạn',pic:'Phụ trách',date:'Ngày nguồn',status:'Trạng thái',sampleBuy:'Giá mua mẫu',endBuy:'Giá mua End',
  wholesale:'Giá bán mẫu',qty:'SL mẫu đã bán',endSell:'Giá bán End',endSellQty:'SL End đã bán',profit:'LN dự kiến',note:'Ghi chú',paid:'Đã thanh toán',unpaid:'Chưa thanh toán',refundEligible:'Đủ điều kiện hoàn'};
function loadColumns(){try{const value=JSON.parse(localStorage.getItem('affiliate-columns')||'null');return Array.isArray(value)?[...new Set(['rootName',...value.filter(v=>columnNames[v])])]:defaultColumns;}catch{return defaultColumns;}}
type SavedFilter={name:string;scope:''|'XLSX_MATCHED'|'LEGACY_UNMATCHED';search:string;status?:string;stage?:string};
function loadFilters():SavedFilter[]{try{const data=JSON.parse(localStorage.getItem('affiliate-filters')||'[]');return Array.isArray(data)?data.filter(v=>typeof v.name==='string'&&['','XLSX_MATCHED','LEGACY_UNMATCHED'].includes(v.scope)&&typeof v.search==='string').slice(0,20):[];}catch{return [];}}
export function Products(){
  const{scope,setScope,search,setSearch,showProduct,capabilities}=useWorkspace();const debounced=useDebounce(search),[page,setPage]=useState(1),[limit,setLimit]=useState(25),[status,setStatus]=useState<string>(),[stage,setStage]=useState<string>();
  const [sort,setSort]=useState('rootName'),[direction,setDirection]=useState('asc'),[visible,setVisible]=useState<string[]>(loadColumns),[widths,setWidths]=useState<Record<string,number>>({});
  const [density,setDensity]=useState<'small'|'middle'>('middle'),[edit,setEdit]=useState<{product:Product;field:string}|null>(null),[mode,setMode]=useState<'grid'|'cards'>('grid');
  const [saved,setSaved]=useState<SavedFilter[]>(loadFilters),{modal,message}=App.useApp();
  function saveFilter(){let name='';modal.confirm({title:'Lưu bộ lọc',content:<Input maxLength={40} placeholder="Ví dụ: End đang chờ hoàn" onChange={e=>name=e.target.value}/>,onOk:()=>{
    if(!name.trim()){message.warning('Nhập tên bộ lọc.');return Promise.reject();}const next=[...saved.filter(f=>f.name!==name.trim()),{name:name.trim(),scope,search,status,stage}].slice(-20);
    setSaved(next);localStorage.setItem('affiliate-filters',JSON.stringify(next));message.success('Đã lưu bộ lọc trên thiết bị này.');}});}
  useEffect(()=>setPage(1),[scope,debounced,status,stage,limit]);useEffect(()=>localStorage.setItem('affiliate-columns',JSON.stringify(visible)),[visible]);
  const filters={search:debounced,status,stage};const q=useProducts({page,limit,sort,direction,...filters}),summary=useSummary(filters);
  const writable=(p:Product)=>!!capabilities?.canWrite&&p.classification==='XLSX_MATCHED'&&!p.archived;
  function editable(p:Product,field:string,value:unknown){return <Space size={4}><span>{field==='wholesale'?money(value):field==='qty'||field==='refundQty'?decimalText(value):String(value??'—')}</span>
    {writable(p)?<Button type="text" size="small" className="inline-edit" icon={<EditOutlined/>} aria-label={'Sửa '+(columnNames[field]||field)} onClick={e=>{e.stopPropagation();setEdit({product:p,field});}}/>:null}</Space>;}
  const definitions:ColumnsType<Product>=[{key:'rootName',title:'Sản phẩm',dataIndex:'rootName',fixed:'left',width:285,sorter:true,render:(value,p)=><div className="product-name-cell"><button className="product-link" onClick={()=>showProduct(p.id)}>{value}</button><div className="product-subline">
    {p.classification==='LEGACY_UNMATCHED'?<Tag color="purple"><LockOutlined/> Legacy</Tag>:null}{p.finance?.payment.missing?<span className="warning-text">Thiếu giá</span>:null}{p.finance?.payment.review?<span className="muted">Cần xác minh</span>:null}</div></div>},
    {key:'image',title:'Ảnh',width:70,render:(_,p)=>thumb(p)?<img className="product-thumb" src={thumb(p)} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<span className="thumb-placeholder"><PictureOutlined/></span>},
    {key:'refundQty',title:'SL hoàn',width:115,align:'right',render:(_,p)=>editable(p,'refundQty',p.refundQuantity)},
    {key:'stage',title:'Giai đoạn',dataIndex:'currentStageLabel',width:160,render:value=><Tag color="cyan">{value||'Chưa chọn'}</Tag>},
    {key:'pic',title:'Phụ trách',dataIndex:'pic',width:135,render:(v,p)=>editable(p,'pic',v)},
    {key:'date',title:'Ngày nguồn',dataIndex:'currentDateText',width:180,render:v=>v||'—'},
    {key:'status',title:'Trạng thái',dataIndex:'currentStatus',width:210,sorter:true,render:(_,p)=><StatusTag product={p}/>},
    {key:'sampleBuy',title:'Giá mua mẫu',width:155,align:'right',render:(_,p)=><Currency value={p.sourceView?.sampleBuy}/>},
    {key:'endBuy',title:'Giá mua End',width:155,align:'right',render:(_,p)=><Currency value={p.sourceView?.endBuy}/>},
    {key:'wholesale',title:'Giá bán mẫu',width:150,align:'right',render:(_,p)=>editable(p,'wholesale',p.wholesale)},
    {key:'qty',title:'SL mẫu bán',width:125,align:'right',render:(_,p)=>editable(p,'qty',p.sampleSalesQuantity)},
    {key:'endSell',title:'Giá bán End',width:150,align:'right',render:(_,p)=><Currency value={p.sourceView?.endSell}/>},
    {key:'endSellQty',title:'SL End bán',width:125,align:'right',render:(_,p)=>decimalText(p.sourceView?.endSellQty)},
    {key:'profit',title:<Tooltip title="Do backend tính theo V9.1; không đồng nghĩa lợi nhuận thực nhận.">LN dự kiến</Tooltip>,width:160,align:'right',render:(_,p)=><Currency value={p.finance?.projectedProfit}/>},
    {key:'note',title:'Ghi chú',dataIndex:'note',width:260,render:(v,p)=><Tooltip title={v}><span className="note-cell">{editable(p,'note',v)}</span></Tooltip>},
    {key:'paid',title:'Đã thanh toán',width:165,align:'right',render:(_,p)=><Currency value={p.finance?.payment.paid}/>},
    {key:'unpaid',title:'Chưa thanh toán',width:165,align:'right',render:(_,p)=><Currency value={p.finance?.payment.unpaid}/>},
    {key:'refundEligible',title:<Tooltip title="Đủ điều kiện hoàn không phải tiền đã hoàn.">Đủ điều kiện hoàn</Tooltip>,width:175,align:'right',render:(_,p)=><Currency value={p.finance?.refund.total}/>}];
  const columns=definitions.filter(c=>visible.includes(String(c.key))).map(c=>({...c,width:widths[String(c.key)]||c.width,onHeaderCell:()=>({width:widths[String(c.key)]||c.width,
    onResizeWidth:(width:number)=>setWidths(old=>({...old,[String(c.key)]:width}))} as any)}));
  function exportPage(){const headers=['Sản phẩm','Giai đoạn','Trạng thái','Đã thanh toán','Chưa thanh toán','Đủ điều kiện hoàn','Lợi nhuận dự kiến'];const cell=(v:unknown)=>'"'+String(v??'').replace(/^([=+@\t\r-])/,"'$1").replace(/"/g,'""')+'"';
    const rows=(q.data?.items||[]).map(p=>[p.rootName,p.currentStageLabel,p.currentStatus,p.finance.payment.paid,p.finance.payment.unpaid,p.finance.refund.total,p.finance.projectedProfit]);
    downloadFile('san-pham-trang-'+page+'.csv','\ufeff'+[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
  return <><PageHeading title="Sản phẩm" subtitle="Giữ toàn bộ sản phẩm và lịch sử. Dữ liệu legacy được đánh dấu riêng, không tự gộp hoặc xóa." action={<Button icon={<DownloadOutlined/>} onClick={exportPage} disabled={!q.data?.items.length}>Xuất trang hiện tại</Button>}/>
    {summary.error?<Failure error={summary.error} retry={()=>summary.refetch()}/>:<FinancialCards summary={summary.data} loading={summary.isPending} updatedAt={summary.dataUpdatedAt}/>}
    <Card className="grid-card"><div className="grid-toolbar"><Space wrap><FilterOutlined className="muted"/><Select allowClear placeholder="Trạng thái" value={status} onChange={setStatus} style={{width:190}}
      options={[...new Set((q.data?.items||[]).map(p=>p.currentStatus).filter(Boolean))].map(v=>({value:v,label:v}))}/>
      <Select allowClear placeholder="Giai đoạn" value={stage} onChange={setStage} style={{width:170}} options={[...new Set((q.data?.items||[]).map(p=>p.currentStageLabel).filter(Boolean))].map(v=>({value:v,label:v}))}/>
      {(debounced||status||stage)?<Button type="text" onClick={()=>{setStatus(undefined);setStage(undefined);setSearch('');}}>Xóa bộ lọc</Button>:null}
      <Dropdown disabled={!saved.length} menu={{items:saved.map((f,i)=>({key:String(i),label:f.name})),onClick:({key})=>{const f=saved[Number(key)];if(f){setScope(f.scope);setSearch(f.search);setStatus(f.status);setStage(f.stage);setPage(1);}}}}><Button>Bộ lọc đã lưu</Button></Dropdown><Button type="text" onClick={saveFilter}>Lưu bộ lọc</Button></Space>
      <Space><Popover placement="bottomRight" title="Cột hiển thị" content={<Checkbox.Group value={visible} onChange={v=>setVisible([...new Set(['rootName',...v as string[]])])} options={Object.entries(columnNames).map(([value,label])=>({value,label,disabled:value==='rootName'}))} className="column-options"/>} trigger="click"><Button icon={<SettingOutlined/>}>Cột</Button></Popover>
        <Segmented value={mode} options={[{label:'Bảng',value:'grid'},{label:'Thẻ',value:'cards'}]} onChange={v=>setMode(v as 'grid'|'cards')}/>
        <Tooltip title="Mật độ dòng"><Button onClick={()=>setDensity(v=>v==='small'?'middle':'small')}>{density==='small'?'Thoáng':'Gọn'}</Button></Tooltip></Space></div>
      {q.error?<Failure error={q.error} retry={()=>q.refetch()}/>:<><div className={mode==='cards'?'product-card-view forced':'product-card-view'}><Spin spinning={q.isPending}><div className="product-cards">{q.data?.items.map(p=><Card key={p.id} size="small" onClick={()=>showProduct(p.id)} className="product-mobile-card">
        <button className="product-link" onClick={()=>showProduct(p.id)}>{p.rootName}</button><Space wrap className="mobile-stage"><Tag color="cyan">{p.currentStageLabel||'Chưa chọn'}</Tag><StatusTag product={p}/>{p.classification==='LEGACY_UNMATCHED'?<Tag color="purple">Legacy · chỉ xem</Tag>:null}</Space>
        <div className="mobile-money"><span>Đã trả<strong>{money(p.finance?.payment.paid)}</strong></span><span>Chưa trả<strong>{money(p.finance?.payment.unpaid)}</strong></span><span>LN dự kiến<strong>{money(p.finance?.projectedProfit)}</strong></span></div><AttentionTags product={p}/></Card>)}</div></Spin></div>
        <div className={mode==='cards'?'desktop-grid hidden':'desktop-grid'}><Table<Product> components={{header:{cell:ResizeHead}}} rowKey="id" columns={columns} dataSource={q.data?.items} loading={q.isPending} size={density} pagination={false} scroll={{x:'max-content'}}
          onRow={p=>({onClick:e=>{if(!(e.target as HTMLElement).closest('button,input,[role="button"]'))showProduct(p.id);},tabIndex:0,onKeyDown:e=>{if(e.key==='Enter'&&e.target===e.currentTarget)showProduct(p.id);}})}
          onChange={(_p,_f,sorter)=>{const s=Array.isArray(sorter)?sorter[0]:sorter;if(s?.columnKey){setSort(s.columnKey==='status'?'currentStatus':'rootName');setDirection(s.order==='descend'?'desc':'asc');setPage(1);}}}/></div>
        {!q.isPending&&!q.data?.items.length?<NoData description="Không tìm thấy sản phẩm. Hãy đổi phạm vi hoặc bộ lọc."/>:null}<div className="table-footer"><span>{q.data?.total??'—'} sản phẩm · Giá thiếu hiển thị “—”</span>
          <Pagination current={page} pageSize={limit} total={q.data?.total||0} onChange={(p,size)=>{setPage(p);setLimit(size);}} showSizeChanger pageSizeOptions={[10,25,50,100]}/></div></>}
    </Card>{edit?<EditDialog product={edit.product} edit={{operation:'EDIT_FIELDS',field:edit.field,title:'Cập nhật '+columnNames[edit.field]}} onClose={()=>setEdit(null)}/>:null}</>;
}
export function Review({alerts=false}:{alerts?:boolean}){
  const{scope,showProduct}=useWorkspace(),[kind,setKind]=useState('all'),[page,setPage]=useState(1);useEffect(()=>setPage(1),[kind,scope]);
  const q=useQuery({queryKey:['review',scope,kind,page],queryFn:()=>api<Page<Product>>('/finance/review'+qs({classification:scope,kind,page,limit:15}))}),summary=useSummary();
  return <><PageHeading title={alerts?'Cần xử lý':'Công nợ & đối soát'} subtitle={alerts?'Kiểm tra giá thiếu, lượt chưa xác minh và các mốc hoàn tiền. Không tự sửa dữ liệu nguồn.':'Tách rõ đã thanh toán, đang chờ nhận và khoản đủ điều kiện hoàn.'}/>
    {!alerts?<FinancialCards summary={summary.data} loading={summary.isPending} updatedAt={summary.dataUpdatedAt}/>:null}
    <Card className="section-card"><Segmented block className="review-filter" value={kind} onChange={v=>setKind(String(v))} options={[{label:'Tất cả mục cần xem',value:'all'},{label:'Thiếu giá',value:'missing'},{label:'Chưa xác minh',value:'unverified'},{label:'Kiểm tra hoàn',value:'refund'},{label:'Lịch sử cần đối soát',value:'conflict'}]}/>
      {q.error?<Failure error={q.error} retry={()=>q.refetch()}/>:<Spin spinning={q.isPending}><List dataSource={q.data?.items} locale={{emptyText:<NoData/>}} renderItem={p=><List.Item className="review-item" actions={[<Button key="detail" onClick={()=>showProduct(p.id)}>Mở đối soát <ArrowRightOutlined/></Button>]}>
        <div className="review-product"><button className="product-link" onClick={()=>showProduct(p.id)}>{p.rootName}</button><p className="muted">{p.currentStageLabel||'Chưa chọn giai đoạn'} · {p.classification==='LEGACY_UNMATCHED'?'Legacy chỉ xem':'Đang vận hành'}</p><AttentionTags product={p}/>
          {p.attention?.refundDue?<p className="warning-text">{p.computedStatus}</p>:null}</div><div className="review-amount"><small>Chưa thanh toán</small><Currency value={p.finance.payment.unpaid}/></div></List.Item>}/></Spin>}
      <Pagination current={page} total={q.data?.total||0} pageSize={15} onChange={setPage} showSizeChanger={false} showTotal={n=>n+' sản phẩm cần kiểm tra'}/></Card></>;
}
export function HistoryPage(){
  const{scope,showProduct}=useWorkspace(),[page,setPage]=useState(1),[productId,setProductId]=useState<string>(),[eventType,setEventType]=useState<string>();
  const products=useProducts({limit:100});useEffect(()=>{setPage(1);setProductId(undefined);},[scope]);useEffect(()=>setPage(1),[productId,eventType]);
  const q=useQuery({queryKey:['history',scope,productId,eventType,page],queryFn:()=>api<Page<History&{product:{id:string;rootName:string}}>>('/history'+qs({classification:scope,productId,eventType,page,limit:20}))});
  return <><PageHeading title="Lịch sử thay đổi" subtitle="Mọi sự kiện được giữ nguyên. Lịch sử nhập từ nguồn và thay đổi mới đều có thể truy vết." action={<Button icon={<DownloadOutlined/>} disabled={!q.data} onClick={()=>downloadFile('lich-su-trang-'+page+'.json',JSON.stringify(q.data,null,2))}>Xuất trang</Button>}/>
    <Card className="section-card"><Space wrap className="history-filters"><Select showSearch optionFilterProp="label" allowClear value={productId} onChange={setProductId} placeholder="Tất cả sản phẩm" style={{width:330}} options={products.data?.items.map(p=>({value:p.id,label:p.rootName}))}/>
      <Select allowClear value={eventType} onChange={setEventType} placeholder="Loại sự kiện" style={{width:230}} options={Object.entries(eventLabels).map(([value,label])=>({value,label}))}/><ScopeTag/></Space>
      {q.error?<Failure error={q.error} retry={()=>q.refetch()}/>:<Spin spinning={q.isPending}>{q.data?.items.length?<Timeline items={q.data.items.map(h=>({key:h.id,color:h.actorId?'green':'gray',content:<div className="audit-event"><div className="timeline-title"><strong>{eventLabels[h.eventType]||h.eventType}</strong><Tag>{h.stageLabel||'Không có giai đoạn'}</Tag></div>
        <button className="product-link audit-product" onClick={()=>showProduct(h.product.id)}>{h.product.rootName}</button><div className="muted">{h.sourceTimestampText||h.occurredAtUtc||'Chưa có thời điểm'} · {h.actorId?'Actor '+h.actorId.slice(0,8):'Nguồn đã nhập · chưa ghi actor'}</div>
        {h.reason?<p>{h.reason}</p>:null}<Collapse ghost size="small" items={[{key:h.id,label:'Xem dữ liệu sự kiện',children:<pre className="raw-json">{JSON.stringify(h.originalPayload||{before:h.beforeJson,after:h.afterJson},null,2)}</pre>}]}/></div>}))}/>:<NoData description="Chưa có sự kiện phù hợp với bộ lọc."/>}</Spin>}
      <Pagination current={page} pageSize={20} total={q.data?.total||0} onChange={setPage} showSizeChanger={false} showTotal={n=>n+' sự kiện, không giới hạn lịch sử'}/></Card></>;
}
export function Reports(){
  const batches=useQuery({queryKey:['import-batches'],queryFn:()=>api<Page<any>>('/import-batches?limit=25')}),archives=useQuery({queryKey:['source-archives'],queryFn:()=>api<Page<any>>('/source-archives?limit=25')});
  return <><PageHeading title="Báo cáo & nguồn dữ liệu" subtitle="Theo dõi các lần nhập, checksum và mức độ bảo toàn. Không có thao tác import công khai."/>
    <Alert type="info" showIcon title="Nguồn HISTORY được lưu nguyên bản" description="Bản gốc, manifest, chunks, history và snapshots được giữ riêng với dữ liệu tính toán. Không tự xóa, gộp hoặc sửa các record legacy." className="page-alert"/>
    <Card title="Các lần nhập dữ liệu" className="section-card">{batches.error?<Failure error={batches.error} retry={()=>batches.refetch()}/>:<Table rowKey="id" loading={batches.isPending} dataSource={batches.data?.items} pagination={false} scroll={{x:700}} columns={[
      {title:'Trạng thái',dataIndex:'status',render:v=><Tag color={v==='COMMITTED'?'green':'orange'}>{v==='COMMITTED'?'Đã nhập và commit':v}</Tag>},{title:'Sản phẩm',dataIndex:'importedCount'},
      {title:'History',render:(_,r)=>r._count?.history??'—'},{title:'Snapshots',render:(_,r)=>r._count?.snapshots??'—'},
      {title:'Mapping',dataIndex:'mappingVersion'},{title:'Checksum kế hoạch',dataIndex:'planSha256',render:v=><Typography.Text copyable={{text:v}}>{String(v).slice(0,14)}…</Typography.Text>} ]}/>}</Card>
    <Card title="Bản nguồn được bảo toàn" className="section-card">{archives.error?<Failure error={archives.error} retry={()=>archives.refetch()}/>:<List loading={archives.isPending} dataSource={archives.data?.items} locale={{emptyText:<NoData/>}} renderItem={a=><List.Item><div><strong>{a.filename}</strong><p className="checksum"><Typography.Text copyable>{a.sha256}</Typography.Text></p>
      <Space wrap><Tag>{a.metadata?.propertyCount??'—'} properties</Tag><Tag color="green">Bảo toàn nguyên bản</Tag><Tag>Không ghi đè</Tag></Space></div></List.Item>}/>}</Card></>;
}
export function Settings({email}:{email?:string}){
  const{capabilities}=useWorkspace();return <><PageHeading title="Cài đặt không gian" subtitle="Quyền truy cập, múi giờ và các nguyên tắc bảo toàn dữ liệu."/>
    <div className="settings-grid"><Card title="Tài khoản & quyền"><Descriptions column={1} items={[{key:'email',label:'Email',children:email||'—'},{key:'role',label:'Quyền nghiệp vụ',children:<Tag color="cyan">{capabilities?.actor.role||'Chưa xác minh'}</Tag>},
      {key:'mode',label:'Cập nhật',children:capabilities?.canWrite?'Được phép trên sản phẩm vận hành':'Chỉ xem dữ liệu'},{key:'actor',label:'Identity',children:<Typography.Text copyable>{capabilities?.actor.subject||'—'}</Typography.Text>}]}/>
      <p className="muted">Quyền do quản trị viên cấp tại backend. Không có thao tác tự nâng quyền hoặc tạo tài khoản ở đây.</p></Card>
      <Card title="Nguyên tắc dữ liệu"><Descriptions column={1} items={[{key:'zone',label:'Múi giờ nguồn',children:'Asia/Ho_Chi_Minh · UTC+07:00'},{key:'engine',label:'Công thức chuẩn',children:'V9.1 · đối chiếu V9.2'},
        {key:'missing',label:'Giá thiếu',children:'Hiển thị —, khác giá trị 0'},{key:'legacy',label:'Dữ liệu legacy',children:'Chỉ xem, giữ toàn bộ raw và history'},{key:'history',label:'Lịch sử',children:'Append-only, không ghi đè'}]}/></Card></div>
    <Card className="section-card" title="Cách sử dụng"><List dataSource={['Chọn phạm vi Đang vận hành, Legacy hoặc Tất cả ở đầu trang.','Tùy chọn cột, mật độ dòng và kéo độ rộng cột trong bảng sản phẩm.','Mở sản phẩm để xem từng lượt mua, giải thích tiền và toàn bộ lịch sử.','Mọi sửa đổi tài chính có preview do backend tính; xác nhận rồi mới lưu.','Chưa hỗ trợ tạo/đổi tên/archive root, upload ảnh hoặc tự suy ra tiền hoàn thực nhận.']} renderItem={item=><List.Item>{item}</List.Item>}/></Card></>;
}
// truonglt Phase5 Vietnamese dashboard, product grid, review, audit and settings end
