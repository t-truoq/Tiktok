// truonglt each concurrent round has its own price and guided action start
import {Button,Card,Space,Tag} from 'antd';
import {PlusOutlined,CheckOutlined} from '@ant-design/icons';
import {decimalText,money,type Product,type Round} from './api';
import type {Edit} from './ProductDrawer';
import {RoundTags} from './Management';
export function RoundControls({product,writable,onEdit}:{product:Product;writable:boolean;onEdit:(edit:Edit)=>void}) {
  const order=(group:'SAMPLE'|'END')=>onEdit({operation:'ROUND_ACTION',title:`Đặt ${group==='SAMPLE'?'mẫu':'End'} ${product.suggestedRounds?.[group]||1}`,round:{action:'ORDER_NEXT',group}});
  const action=(round:Round,value:string,title:string)=>onEdit({operation:'ROUND_ACTION',title:`${title} · ${round.group==='SAMPLE'?'Mẫu':'End'} ${round.roundIndex}`,round:{action:value,group:round.group,roundIndex:round.roundIndex}});
  return <section className="round-management"><div className="round-heading"><div><h3>Lượt mua đang diễn ra</h3><RoundTags product={product}/></div>{writable?<Space wrap><Button type="primary" icon={<PlusOutlined/>} onClick={()=>order('SAMPLE')}>Đặt mẫu {product.suggestedRounds?.SAMPLE||1}</Button><Button icon={<PlusOutlined/>} onClick={()=>order('END')}>Đặt End {product.suggestedRounds?.END||1}</Button></Space>:null}</div>
    <p className="muted">Mỗi lượt có trạng thái riêng. Nhận mẫu không làm mất lượt End đang chờ nhận. Số lượt được chọn tự động.</p>
    <div className="round-card-grid">{(product.rounds||[]).filter(r=>r.ordered||r.received||r.cancelled||r.orderPrice!==null).map(r=><Card key={r.id} size="small" title={`${r.group==='SAMPLE'?'Mẫu':'End'} ${r.roundIndex}`} extra={<Tag color={r.cancelled?undefined:r.received?'green':r.ordered?'blue':undefined}>{r.cancelled?'Đã hủy':r.received?'Đã nhận':r.ordered?'Chờ nhận':'Chưa đặt'}</Tag>}>
      <div className="round-price"><small>Giá mua</small><strong>{money(r.orderPrice)}</strong></div>
      {r.group==='END'?<div className="round-price"><small>Giá bán / Số lượng</small><span>{money(r.sales?.unitPrice)} / {decimalText(r.sales?.soldQuantity)}</span></div>:null}
      <Tag color={r.verified?'green':'orange'}>{r.verified?'Đã xác minh':'Chưa xác minh'}</Tag>
      {writable?<Space wrap className="round-actions">{r.cancelled?<Button size="small" onClick={()=>action(r,'RESTORE_STAGE','Khôi phục lượt')}>Khôi phục</Button>:<>
        {r.ordered&&!r.received?<Button size="small" type="primary" icon={<CheckOutlined/>} onClick={()=>action(r,'RECEIVE','Xác nhận đã nhận')}>Đã nhận</Button>:null}
        {!r.received?<Button size="small" onClick={()=>action(r,'EDIT_BUY','Sửa giá mua')}>Giá mua</Button>:null}
        {r.group==='END'?<Button size="small" onClick={()=>action(r,'EDIT_SALES','Sửa bán End')}>Bán End</Button>:null}
        {!r.verified?<Button size="small" onClick={()=>action(r,'VERIFY_STAGE','Xác minh lượt')}>Xác minh</Button>:null}
      </>}</Space>:null}
    </Card>)}</div>
  </section>;
}
// truonglt each concurrent round has its own price and guided action end
