// truonglt Phase5 shared Vietnamese financial presentation start
import { Alert, Button, Card, Empty, Space, Tag, Tooltip, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, InfoCircleOutlined, ReloadOutlined, WalletOutlined } from '@ant-design/icons';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Capabilities, Product, Scope, Summary } from './api';
import { money } from './api';
export const WorkspaceContext = createContext<{ scope:Scope;setScope:(v:Scope)=>void;search:string;setSearch:(v:string)=>void;
  showProduct:(id:string)=>void;capabilities?:Capabilities }>({ scope:'ACTIVE',setScope:()=>{},search:'',setSearch:()=>{},showProduct:()=>{} });
export const useWorkspace = ()=>useContext(WorkspaceContext);
export function useDebounce<T>(value:T,delay=350){const [out,setOut]=useState(value);useEffect(()=>{const id=setTimeout(()=>setOut(value),delay);return()=>clearTimeout(id);},[value,delay]);return out;}
export function PageHeading({title,subtitle,action}:{title:string;subtitle:string;action?:React.ReactNode}) {
  return <div className="page-heading"><div><Typography.Title level={2}>{title}</Typography.Title><p>{subtitle}</p></div>{action}</div>;
}
export function Failure({error,retry}:{error:unknown;retry:()=>void}) {
  return <Alert type="error" showIcon title="Chưa tải được dữ liệu" description={<Space wrap><span>{error instanceof Error?error.message:'Kết nối tạm thời gián đoạn.'}</span><Button icon={<ReloadOutlined/>} onClick={retry}>Thử lại</Button></Space>}/>;
}
export function NoData({description='Chưa có dữ liệu trong phạm vi này.'}:{description?:string}) {return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}/>;}
export function Currency({value}:{value:unknown}) {return <span className={'money '+(String(value??'').startsWith('-')?'negative':'')}>{money(value)}</span>;}
export function ScopeTag(){const {scope}=useWorkspace();return <Tag variant="filled" color={scope==='LEGACY_UNMATCHED'?'purple':'default'}>{scope==='ACTIVE'||scope==='XLSX_MATCHED'?'Đang vận hành':scope==='MANUAL'?'Sản phẩm mới':scope==='LEGACY_UNMATCHED'?'Legacy được bảo toàn':'Toàn bộ dữ liệu'}</Tag>;}
export function StatusTag({product}:{product:Product}) {
  const status=product.currentStatus;const attention=product.attention;
  const color=attention?.refundDue?'orange':status==='Hoàn tất'?'green':status?.includes('Chờ')?'blue':'default';
  return <Tooltip title={product.computedStatus&&product.computedStatus!==status?'Theo thời gian hiện tại: '+product.computedStatus:undefined}><Tag color={color}>{status||'Chưa có trạng thái'}</Tag></Tooltip>;
}
export function FinancialCards({summary,loading=false,updatedAt}:{summary?:Summary;loading?:boolean;updatedAt?:number}) {
  const cards=[{key:'paid' as const,title:'Đã thanh toán',text:'Giá mua của những lượt đã nhận.',icon:<CheckCircleOutlined/>,color:'green'},
    {key:'unpaid' as const,title:'Chưa thanh toán',text:'Giá mua của những lượt đang chờ nhận.',icon:<WalletOutlined/>,color:'blue'},
    {key:'refundEligible' as const,title:'Đủ điều kiện hoàn',text:'Đủ điều kiện không đồng nghĩa đã nhận tiền hoàn.',icon:<ArrowDownOutlined/>,color:'amber'},
    {key:'projectedProfit' as const,title:'Lợi nhuận dự kiến',text:'Theo doanh thu và chi phí của thuật toán V9.1.',icon:<ArrowUpOutlined/>,color:'purple'}];
  return <><div className="financial-cards">{cards.map(c=><Card key={c.key} loading={loading} className={'metric '+c.color}><div className="metric-label"><span>{c.title}</span><span className="metric-icon">{c.icon}</span></div>
    <div className="metric-value"><Currency value={summary?.[c.key]}/></div><div className="metric-caption">{c.text}</div></Card>)}</div>
    <div className="totals-meta"><Space><ScopeTag/><span>{summary?.count??'—'} sản phẩm</span><Tooltip title="Các tổng và cảnh báo được tính trên backend, theo bộ lọc đang chọn."><InfoCircleOutlined/></Tooltip></Space>
      {updatedAt?<span>Cập nhật {new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'}).format(updatedAt)}</span>:null}</div></>;
}
export const eventLabels:Record<string,string>={ENTER_STAGE:'Bắt đầu giai đoạn',LEAVE_STAGE:'Rời giai đoạn',PRICE_EDIT:'Sửa giá mua mẫu',END_BUY_PRICE_EDIT:'Sửa giá mua End',
  END_SELL_PRICE_EDIT:'Sửa giá bán End',END_SELL_QTY_EDIT:'Sửa số lượng bán End',REFUND_QTY_EDIT:'Sửa số lượng hoàn',WHOLESALE_EDIT:'Sửa giá bán mẫu',QTY_EDIT:'Sửa số lượng mẫu',
  NOTE_EDIT:'Cập nhật ghi chú',PIC_EDIT:'Cập nhật người phụ trách',DATE_EDIT:'Cập nhật ngày',STATUS_EDIT:'Cập nhật trạng thái',AUTO_STATUS:'Đồng bộ trạng thái',
  VERIFY_STAGE:'Xác minh lượt mua',CANCEL_STAGE:'Hủy lượt mua',RESTORE_STAGE:'Khôi phục lượt mua',CORRECT_UNRECEIVED:'Đánh dấu chưa nhận',PRODUCT_CREATED:'Thêm sản phẩm',PRODUCT_IMAGE_ADDED:'Thêm ảnh sản phẩm'};
export function downloadFile(filename:string,content:string,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
// truonglt Phase5 shared Vietnamese financial presentation end
