// truonglt Phase5 product detail, immutable audit and server-previewed mutations start
import { useEffect, useRef, useState } from 'react';
import { Alert, App, AutoComplete, Button, Card, Collapse, Descriptions, Drawer, Form, Input, Modal, Pagination, Space, Spin, Table, Tabs, Tag, Timeline, Tooltip, Typography } from 'antd';
import { CheckCircleOutlined, EditOutlined, HistoryOutlined, LockOutlined, ReloadOutlined, SafetyCertificateOutlined, SwapOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, decimalText, money, type History, type Mutation, type Page, type Preview, type Product, type Round, type Snapshot } from './api';
// truonglt private product photos and automatic round controls start
import { ProductPhoto, RoundTags, UploadPhoto } from './Management';
import { RoundControls } from './RoundControls';
// truonglt private product photos and automatic round controls end
import { Currency, eventLabels, Failure, NoData, StatusTag, useWorkspace } from './ui';
const labels:Record<string,string>={wholesale:'Giá bán mẫu',qty:'Số lượng mẫu đã bán',refundQty:'Số lượng hoàn',note:'Ghi chú',pic:'Người phụ trách',date:'Ngày giờ',status:'Trạng thái'};
export type Edit = { operation:string; field?:string; title:string; round?:{action:string;group:'SAMPLE'|'END';roundIndex?:string} };
export function EditDialog({product,edit,onClose}:{product:Product;edit:Edit|null;onClose:()=>void}){
  const mode=edit?.round?.action || edit?.operation;
  const [form]=Form.useForm(),[preview,setPreview]=useState<Preview>(),[error,setError]=useState('');const query=useQueryClient(),{message}=App.useApp();
  const request=useRef<{dto:Mutation;key:string}|undefined>(undefined);
  useEffect(()=>{if(!edit)return;setPreview(undefined);setError('');request.current=undefined;const field=edit.field;const target=product.rounds?.find(r=>r.group===(edit.round?.group||(product.currentStageLabel?.includes('End')?'END':'SAMPLE'))&&r.roundIndex===(edit.round?.roundIndex||product.currentStageIndex));
    form.setFieldsValue({value:edit.operation==='SET_STAGE'?product.currentStageLabel||'':mode==='EDIT_BUY'?target?.orderPrice??'':
      field==='qty'?product.sampleSalesQuantity??'':field==='refundQty'?product.refundQuantity??'':field==='date'?product.currentDateText?.replace(' ','T')??'':field?(product as any)[field]??'':'',
      unitPrice:target?.sales?.unitPrice??'',
      quantity:target?.sales?.soldQuantity??'',reason:''});
  },[edit,product,form]);
  function dto(values:any):Mutation {return {expectedVersion:product.version,operation:edit!.operation,values:edit!.round?{...edit!.round,...(mode==='ORDER_NEXT'?(values.value?{value:values.value}:{}):mode==='EDIT_BUY'?{value:values.value}:mode==='EDIT_SALES'?{unitPrice:values.unitPrice,quantity:values.quantity}:{})}:edit!.operation==='SET_STAGE'?{progress:values.value}:
    edit!.operation==='EDIT_BUY'?{value:values.value}:edit!.operation==='EDIT_FIELDS'?{[edit!.field!]:values.value}:edit!.operation==='EDIT_SALES'?{unitPrice:values.unitPrice,quantity:values.quantity}:{},
    ...(values.reason?.trim()?{reason:values.reason.trim()}:{} )};}
  const previewAction=useMutation({mutationFn:async()=>{const values=await form.validateFields();const body=dto(values);const result=await api<Preview>('/products/'+product.id+'/preview',{method:'POST',body});
    request.current={dto:body,key:crypto.randomUUID()};return result;},onSuccess:data=>{setPreview(data);setError('');},onError:e=>setError(e instanceof Error?e.message:'Chưa thể xem trước.')});
  const save=useMutation({mutationFn:async()=>{if(!request.current)throw Error('Hãy xem trước thay đổi.');return api('/products/'+product.id+'/mutations',{method:'POST',body:request.current.dto,key:request.current.key});},
    onSuccess:async()=>{await query.invalidateQueries();message.success('Đã lưu. Lịch sử đã được ghi nhận.');onClose();},onError:e=>{setError(e instanceof Error?e.message:'Không thể lưu.');if(e instanceof ApiError&&e.status===409)query.invalidateQueries({queryKey:['product',product.id]});}});
  if(!edit)return null;
  const stageOptions=[...new Set(['',...(product.rounds||[]).flatMap(r=>[`Đặt ${r.group==='END'?'End':'mẫu'} ${r.roundIndex}`,`Nhận ${r.group==='END'?'End':'mẫu'} ${r.roundIndex}`]),'Đặt mẫu 1','Nhận mẫu 1','Đặt End 1','Nhận End 1','Done'])].map(value=>({value,label:value||'Bỏ chọn giai đoạn'}));
  const numeric=mode==='EDIT_BUY'||mode==='ORDER_NEXT'||['wholesale','qty','refundQty'].includes(edit.field||'');
  const decimalRule=(scale:number)=>({validator:(_:unknown,value:unknown)=>value===''||value===undefined||new RegExp('^\\d+(\\.\\d{1,'+scale+'})?$').test(String(value))?Promise.resolve():Promise.reject(new Error('Nhập số không âm, tối đa '+scale+' chữ số sau dấu chấm.'))});
  return <Modal open title={edit.title} onCancel={()=>{if(!save.isPending)onClose();}} width={680} destroyOnHidden footer={<Space><Button onClick={onClose} disabled={save.isPending}>Đóng</Button>
    {!preview?<Button type="primary" loading={previewAction.isPending} onClick={()=>previewAction.mutate()}>Xem trước thay đổi</Button>:<Button type="primary" loading={save.isPending} onClick={()=>save.mutate()}>{error?'Thử lưu lại':'Xác nhận và lưu'}</Button>}</Space>}>
    <p className="muted">{product.rootName}</p><Form form={form} layout="vertical" requiredMark={false} onValuesChange={()=>{setPreview(undefined);request.current=undefined;setError('');}}>
      {edit.operation==='SET_STAGE'?<><Alert type="info" showIcon title="Kiểm tra giai đoạn trước khi lưu" description="Chuyển về Đặt có giá có thể đánh dấu chưa nhận hoặc mở lại lượt bị hủy theo logic nguồn. Lịch sử cũ vẫn giữ nguyên."/>
        <Form.Item name="value" label="Giai đoạn" className="form-alert"><AutoComplete options={stageOptions} filterOption={(input,o)=>String(o?.value).toLowerCase().includes(input.toLowerCase())} placeholder="Ví dụ: Đặt mẫu 3 hoặc Nhận End 3"/></Form.Item></>:
      mode==='EDIT_SALES'?<Space className="sales-form" align="start"><Form.Item name="unitPrice" label="Giá bán End (VND)" rules={[decimalRule(2)]}><Input inputMode="decimal" placeholder="Để trống nếu chưa có giá"/></Form.Item>
        <Form.Item name="quantity" label="Số lượng bán End" rules={[decimalRule(3)]}><Input inputMode="decimal" placeholder="Để trống nếu chưa có số lượng"/></Form.Item></Space>:
      ['EDIT_BUY','EDIT_FIELDS','ORDER_NEXT'].includes(mode||'')?<Form.Item name="value" label={mode==='EDIT_BUY'||mode==='ORDER_NEXT'?'Giá mua (VND)':labels[edit.field!]||edit.field} rules={numeric?[decimalRule(edit.field==='qty'||edit.field==='refundQty'?3:2)]:[]}>
        {edit.field==='note'?<Input.TextArea rows={3} maxLength={2000}/>:<Input type={edit.field==='date'?'datetime-local':'text'} step={edit.field==='date'?1:undefined} inputMode={numeric?'decimal':undefined} placeholder={numeric?'Để trống nếu chưa có giá trị':undefined}/>}</Form.Item>:
      <Alert type="info" showIcon title="Thao tác sẽ được ghi vào lịch sử" description="Xem trước ảnh hưởng tài chính và xác nhận để lưu. Không ghi đè lịch sử nguồn."/>}
      <Form.Item name="reason" label="Lý do thay đổi (không bắt buộc)"><Input maxLength={500} placeholder="Ghi lại căn cứ đối soát hoặc thay đổi…"/></Form.Item></Form>
    {preview?<div className="mutation-preview"><h4>Ảnh hưởng do backend tính</h4><table><thead><tr><th>Chỉ tiêu</th><th>Trước</th><th>Sau</th></tr></thead><tbody>{[
      ['Đã thanh toán',preview.beforeFinance.payment.paid,preview.afterFinance.payment.paid],['Chưa thanh toán',preview.beforeFinance.payment.unpaid,preview.afterFinance.payment.unpaid],
      ['Đủ điều kiện hoàn',preview.beforeFinance.refund.total,preview.afterFinance.refund.total],['Lợi nhuận dự kiến',preview.beforeFinance.projectedProfit,preview.afterFinance.projectedProfit]
    ].map(([label,before,after])=><tr key={label}><td>{label}</td><td>{money(before)}</td><td>{money(after)}</td></tr>)}</tbody></table><small>Phiên bản {preview.expectedVersion} · {preview.eventTypes.length} sự kiện dự kiến. Chưa ghi dữ liệu.</small></div>:null}
    {error?<Alert className="form-alert" type="error" showIcon title="Chưa lưu thay đổi" description={error}/>:null}
  </Modal>;
}
function ProductHistory({id}:{id:string}){
  const [page,setPage]=useState(1);const q=useQuery({queryKey:['resource',id,'history',page],queryFn:()=>api<Page<History>>('/products/'+id+'/history?page='+page+'&limit=20&sort=legacyEventIndex&direction=desc')});
  if(q.error)return <Failure error={q.error} retry={()=>q.refetch()}/>;
  return <Spin spinning={q.isPending}>{q.data?.items.length?<Timeline items={q.data.items.map(h=>({key:h.id,color:h.actorId?'green':'gray',content:<div><div className="timeline-title"><strong>{eventLabels[h.eventType]||h.eventType}</strong><Tag>{h.stageLabel||'Không có giai đoạn'}</Tag></div>
    <small className="muted">{h.sourceTimestampText||h.occurredAtUtc||'Chưa có thời điểm'} · {h.actorId?'Actor '+h.actorId.slice(0,8):'Lịch sử nguồn · chưa ghi actor'}</small>{h.reason?<p>{h.reason}</p>:null}
    <Collapse ghost size="small" items={[{key:h.id,label:'Chi tiết dữ liệu được ghi nhận',children:<pre className="raw-json">{JSON.stringify(h.originalPayload||{before:h.beforeJson,after:h.afterJson},null,2)}</pre>}]}/></div>}))}/>:<NoData description="Sản phẩm chưa có sự kiện lịch sử."/>}
    <Pagination current={page} total={q.data?.total||0} pageSize={20} onChange={setPage} showSizeChanger={false} showTotal={n=>n+' sự kiện'}/></Spin>;
}
function ProductSnapshots({id}:{id:string}){
  const [page,setPage]=useState(1);const q=useQuery({queryKey:['resource',id,'snapshots',page],queryFn:()=>api<Page<Snapshot>>('/products/'+id+'/snapshots?page='+page+'&limit=12&sort=sourceLabel')});
  if(q.error)return <Failure error={q.error} retry={()=>q.refetch()}/>;
  return <Spin spinning={q.isPending}><div className="snapshot-grid">{q.data?.items.map(s=><Card key={s.id} size="small" title={s.sourceLabel}><p className="muted">{s.sourceDateText||'Chưa có ngày'}</p>
    <Descriptions column={1} size="small" items={[{key:'price',label:'Giá mẫu',children:money(s.snapshot.price)},{key:'end',label:'Giá End',children:money(s.snapshot.endPrice)},
      {key:'profit',label:'Profit tại snapshot',children:money(s.snapshot.profit)},{key:'pic',label:'Phụ trách',children:s.snapshot.pic||'—'}]}/>
    <Collapse ghost size="small" items={[{key:s.id,label:'Xem snapshot nguyên bản',children:<pre className="raw-json">{JSON.stringify(s.snapshot,null,2)}</pre>}]}/></Card>)}</div>
    {!q.data?.items.length?<NoData description="Chưa có snapshot."/>:null}<Pagination current={page} total={q.data?.total||0} pageSize={12} onChange={setPage} showSizeChanger={false}/></Spin>;
}
export default function ProductDrawer({id,onClose}:{id?:string;onClose:()=>void}){
  const {capabilities}=useWorkspace();const [edit,setEdit]=useState<Edit|null>(null);
  const q=useQuery({queryKey:['product',id],queryFn:()=>api<Product>('/products/'+id),enabled:!!id});const product=q.data;
  useEffect(()=>setEdit(null),[id]);
  const writable=!!product&&capabilities?.canWrite&&product.classification!=='LEGACY_UNMATCHED'&&!product.archived;
  const action=(operation:string,title:string,field?:string)=>setEdit({operation,title,field});
  return <Drawer open={!!id} onClose={onClose} width={860} title={<Space><ShopIcon/><span>Chi tiết sản phẩm</span></Space>} destroyOnHidden>
    {q.isPending?<div className="drawer-loading"><Spin/><p>Đang tải sản phẩm…</p></div>:q.error?<Failure error={q.error} retry={()=>q.refetch()}/>:product?<>
      <div className="detail-heading"><Typography.Title level={3}>{product.rootName}</Typography.Title><Space wrap><StatusTag product={product}/><Tag color={product.classification!=='LEGACY_UNMATCHED'?'cyan':'purple'}>{product.classification!=='LEGACY_UNMATCHED'?'Đang vận hành':'Legacy · chỉ xem'}</Tag><Tag>Phiên bản {product.version}</Tag></Space></div>
      {!writable?<Alert showIcon icon={<LockOutlined/>} type="info" title="Đang xem dữ liệu được bảo toàn" description="Legacy, record archived hoặc tài khoản chỉ xem không có thao tác sửa."/>:null}
      <Tabs defaultActiveKey="overview" items={[{key:'overview',label:'Tổng quan',children:<><div className="product-photo-section"><ProductPhoto product={product} large/><div><h3>Ảnh sản phẩm</h3><p className="muted">Ảnh và lịch sử cũ được giữ nguyên.</p>{writable&&capabilities?.canUpload?<UploadPhoto product={product}/>:null}</div></div><RoundControls product={product} writable={!!writable} onEdit={setEdit}/><div className="detail-metrics">{[['Đã thanh toán',product.finance.payment.paid],['Chưa thanh toán',product.finance.payment.unpaid],['Đủ điều kiện hoàn',product.finance.refund.total],['Lợi nhuận dự kiến',product.finance.projectedProfit]].map(([label,value])=><div key={label}><small>{label}</small><Currency value={value}/></div>)}</div>
        <Descriptions bordered size="small" column={{xs:1,sm:2}} items={[{key:'stage',label:'Lượt đang thao tác',children:product.currentStageLabel||'—'},{key:'date',label:'Ngày nguồn',children:product.currentDateText||'—'},
          {key:'pic',label:'Phụ trách',children:product.pic||'—'},{key:'qty',label:'Số lượng mẫu bán',children:decimalText(product.sampleSalesQuantity)},
          {key:'wholesale',label:'Giá bán mẫu',children:money(product.wholesale)},{key:'refundQty',label:'Số lượng hoàn',children:decimalText(product.refundQuantity)},
          {key:'note',label:'Ghi chú',span:2,children:product.note||'—'}]}/>
        {writable?<div className="detail-actions"><Button icon={<SwapOutlined/>} onClick={()=>action('SET_STAGE','Chuyển giai đoạn nâng cao')}>Giai đoạn nâng cao</Button>
          <Button icon={<EditOutlined/>} onClick={()=>action('EDIT_FIELDS','Sửa ghi chú','note')}>Ghi chú</Button><Button onClick={()=>action('EDIT_FIELDS','Sửa người phụ trách','pic')}>Phụ trách</Button>
          <Button onClick={()=>action('EDIT_FIELDS','Sửa ngày giờ','date')}>Ngày giờ</Button><Button onClick={()=>action('EDIT_FIELDS','Sửa trạng thái','status')}>Trạng thái</Button>
          <Button onClick={()=>action('EDIT_FIELDS','Sửa giá bán mẫu','wholesale')}>Giá bán mẫu</Button><Button onClick={()=>action('EDIT_FIELDS','Sửa số lượng mẫu','qty')}>Số lượng mẫu</Button><Button onClick={()=>action('EDIT_FIELDS','Sửa số lượng hoàn','refundQty')}>Số lượng hoàn</Button></div>:null}
        <Alert type="info" showIcon title="Đủ điều kiện hoàn khác tiền đã hoàn" description="Tổng đủ điều kiện là phép tính theo các lượt Sample/End. Hệ thống không tự suy ra tiền hoàn thực nhận." className="form-alert"/></>},
        {key:'rounds',label:'Lượt mua & bán',children:<><Table<Round> rowKey="id" dataSource={product.rounds||[]} pagination={false} size="small" scroll={{x:640}} columns={[
          {title:'Lượt',key:'round',render:(_,r)=><strong>{r.group==='SAMPLE'?'Mẫu':'End'} {r.roundIndex}</strong>},
          {title:'Giá mua',dataIndex:'orderPrice',align:'right',render:(v,r)=><span><Currency value={v}/>{r.orderPriceState==='MISSING'?<small className="missing-note">Thiếu trường nguồn</small>:null}</span>},
          {title:'Trạng thái',key:'state',render:(_,r)=><Space wrap>{r.cancelled?<Tag>Đã hủy</Tag>:r.received?<Tag color="green">Đã nhận</Tag>:r.ordered?<Tag color="blue">Đang chờ nhận</Tag>:<Tag>Chưa đặt</Tag>}<Tooltip title={r.issue||undefined}><Tag color={r.verified?'green':'orange'}>{r.verified?'Đã xác minh':'Chưa xác minh'}</Tag></Tooltip></Space>},
          {title:'Giá bán End',key:'sell',align:'right',render:(_,r)=>r.sales?<Currency value={r.sales.unitPrice}/>:'—'},
          {title:'SL bán',key:'qty',align:'right',render:(_,r)=>decimalText(r.sales?.soldQuantity)}]}/>
          {writable?<div className="detail-actions"><Button disabled={!product.currentStageLabel?.startsWith('Đặt')} onClick={()=>action('EDIT_BUY','Sửa giá mua của giai đoạn hiện tại')}>Sửa giá mua</Button>
            <Button disabled={!product.currentStageLabel?.includes('End')} onClick={()=>action('EDIT_SALES','Sửa giá và số lượng bán End')}>Sửa bán End</Button>
            <Button icon={<SafetyCertificateOutlined/>} onClick={()=>action('VERIFY_STAGE','Xác minh giai đoạn hiện tại')}>Xác minh</Button>
            <Button onClick={()=>action('CORRECT_UNRECEIVED','Đánh dấu chưa nhận')}>Chưa nhận</Button><Button danger onClick={()=>action('CANCEL_STAGE','Hủy lượt hiện tại')}>Hủy lượt</Button>
            <Button onClick={()=>action('RESTORE_STAGE','Khôi phục lượt hiện tại')}>Khôi phục lượt</Button></div>:null}</>},
        {key:'ledger',label:'Giải thích tài chính',children:<><Alert type="warning" showIcon title={product.finance.payment.missing+' lượt thiếu giá · '+product.finance.payment.review+' lượt cần xác minh'} description="Giá thiếu hiển thị dấu gạch, không được thay bằng 0. Khoản đang chờ nhận không phải khoản đã thanh toán."/>
          <Table rowKey="key" dataSource={product.finance.payment.details} pagination={false} size="small" className="form-alert" columns={[{title:'Lượt',dataIndex:'label'},{title:'Giá',dataIndex:'amount',align:'right',render:v=><Currency value={v}/>},
            {title:'Phân loại',dataIndex:'bucket',render:v=>v==='PAID'?<Tag color="green">Đã thanh toán</Tag>:v==='UNPAID'?<Tag color="blue">Chưa thanh toán</Tag>:<Tag color="orange">Thiếu giá</Tag>},
            {title:'Xác minh',dataIndex:'verified',render:v=>v?<CheckCircleOutlined style={{color:'#177c70'}}/>:<span className="warning-text">Cần đối soát</span>} ]}/>
          <Descriptions column={1} bordered size="small" className="form-alert" items={[{key:'sample',label:'Chi phí mẫu',children:money(product.finance.payment.sampleTotal)},
            {key:'end',label:'Chi phí End',children:money(product.finance.payment.endTotal)},{key:'revenue',label:'Doanh thu End',children:money(product.finance.endRevenue)},
            {key:'profit',label:'Lợi nhuận dự kiến',children:money(product.finance.projectedProfit)}]}/></>},
        {key:'snapshots',label:'Snapshots',children:<ProductSnapshots id={product.id}/>},{key:'history',label:<Space><HistoryOutlined/>Lịch sử</Space>,children:<ProductHistory id={product.id}/>} ]}/>
      <EditDialog product={product} edit={edit} onClose={()=>setEdit(null)}/>
    </>:null}</Drawer>;
}
function ShopIcon(){return <span className="detail-icon">A</span>;}
// truonglt Phase5 product detail, immutable audit and server-previewed mutations end
