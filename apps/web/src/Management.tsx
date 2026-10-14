// truonglt product creation, private photos and concurrent round presentation start
import {useEffect,useRef,useState} from 'react';
import {Alert,App,Button,Form,Input,Modal,Space,Tag} from 'antd';
import {PictureOutlined,PlusOutlined,UploadOutlined} from '@ant-design/icons';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {api,apiImage,type Product} from './api';
import {useWorkspace} from './ui';
export function RoundTags({product}:{product:Product}) {
  return <Space wrap size={4}>{product.ongoingRounds?.length?product.ongoingRounds.map(r=><Tag key={r.key} color={r.group==='SAMPLE'?'cyan':'geekblue'}>{r.label} · Chờ nhận</Tag>):<Tag>{product.currentStageLabel||'Chưa có lượt mua'}</Tag>}</Space>;
}
export function ProductPhoto({product,large=false}:{product:Product;large?:boolean}) {
  const [src,setSrc]=useState<string>();
  useEffect(()=>{setSrc(undefined);const controller=new AbortController();let objectUrl:string|undefined;
    if(product.imageId)apiImage('/products/'+product.id+'/images/'+product.imageId+'/content',controller.signal).then(blob=>{if(!controller.signal.aborted){objectUrl=URL.createObjectURL(blob);setSrc(objectUrl);}}).catch(()=>{});
    else {const ref=product.sourceView?.imageReference;const raw=typeof ref==='string'?ref:ref&&typeof ref==='object'&&'url' in ref?String((ref as any).url):'';
      try{const url=new URL(raw);if(url.protocol==='https:'&&!url.username&&!url.password)setSrc(url.href);}catch{}}
    return()=>{controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[product.id,product.imageId,product.sourceView?.imageReference]);
  return src?<img className={large?'product-photo-large':'product-thumb'} src={src} alt={product.rootName} loading="lazy" referrerPolicy="no-referrer" onError={()=>setSrc(undefined)}/>:<span className={large?'product-photo-large photo-empty':'thumb-placeholder'}><PictureOutlined/>{large?<small>Chưa có ảnh</small>:null}</span>;
}
export function AddProduct() {
  const [open,setOpen]=useState(false),[form]=Form.useForm(),[error,setError]=useState('');const key=useRef(crypto.randomUUID());
  const {capabilities,showProduct,setScope}=useWorkspace(),query=useQueryClient(),{message}=App.useApp();
  const save=useMutation({mutationFn:async()=>api<{id:string}>('/products',{method:'POST',key:key.current,body:await form.validateFields()}),
    onSuccess:async r=>{await query.invalidateQueries();setOpen(false);setScope('ACTIVE');showProduct(r.id);message.success('Đã thêm sản phẩm. Giá và lượt mua đang để trống.');},onError:e=>setError(e instanceof Error?e.message:'Chưa thể tạo sản phẩm.')});
  if(!capabilities?.canCreate)return null;
  return <><Button type="primary" icon={<PlusOutlined/>} onClick={()=>{key.current=crypto.randomUUID();form.resetFields();setError('');setOpen(true);}}>Thêm sản phẩm</Button>
    <Modal open={open} title="Thêm sản phẩm" onCancel={()=>!save.isPending&&setOpen(false)} onOk={()=>save.mutate()} confirmLoading={save.isPending} okText="Thêm sản phẩm" cancelText="Đóng">
      <p className="muted">Sản phẩm mới được lưu riêng, chưa có giá hoặc lượt mua. Dữ liệu nguồn cũ được giữ nguyên.</p>
      <Form form={form} layout="vertical" onValuesChange={()=>{key.current=crypto.randomUUID();setError('');}}><Form.Item name="name" label="Tên sản phẩm" rules={[{required:true,whitespace:true,message:'Nhập tên sản phẩm.'}]}><Input maxLength={500}/></Form.Item>
        <Form.Item name="pic" label="Người phụ trách"><Input maxLength={2000}/></Form.Item><Form.Item name="note" label="Ghi chú"><Input.TextArea rows={3} maxLength={2000}/></Form.Item></Form>
      {error?<Alert type="error" showIcon title={error}/>:null}
    </Modal></>;
}
export function UploadPhoto({product}:{product:Product}) {
  const input=useRef<HTMLInputElement>(null),key=useRef(crypto.randomUUID()),[body,setBody]=useState<any>(),[error,setError]=useState('');const query=useQueryClient(),{message}=App.useApp();
  const save=useMutation({mutationFn:()=>api('/products/'+product.id+'/images',{method:'POST',key:key.current,body}),onSuccess:async()=>{setBody(undefined);await query.invalidateQueries();message.success('Đã thêm ảnh. Ảnh và lịch sử cũ được giữ nguyên.');},onError:e=>setError(e instanceof Error?e.message:'Không thể tải ảnh.')});
  async function select(file?:File){setError('');if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){setError('Chọn ảnh JPG, PNG hoặc WebP tối đa 2 MB.');return;}
    const reader=new FileReader();reader.onload=()=>{key.current=crypto.randomUUID();setBody({expectedVersion:product.version,filename:file.name,contentType:file.type,data:String(reader.result).split(',')[1]});};reader.onerror=()=>setError('Không đọc được ảnh.');reader.readAsDataURL(file);}
  return <><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>{select(e.target.files?.[0]);e.target.value='';}}/>
    <Button icon={<UploadOutlined/>} onClick={()=>input.current?.click()}>Thêm ảnh</Button>
    <Modal open={!!body} title="Thêm ảnh sản phẩm" onCancel={()=>!save.isPending&&setBody(undefined)} onOk={()=>save.mutate()} confirmLoading={save.isPending} okText="Lưu ảnh" cancelText="Đóng">
      {body?<img className="upload-preview" src={'data:'+body.contentType+';base64,'+body.data} alt="Ảnh đã chọn"/>:null}<p className="muted">{body?.filename} · Ảnh chỉ được truy cập sau đăng nhập.</p>{error?<Alert type="error" title={error}/>:null}
    </Modal>{error&&!body?<Alert type="error" title={error}/>:null}</>;
}
// truonglt product creation, private photos and concurrent round presentation end
