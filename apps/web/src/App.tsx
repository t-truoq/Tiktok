// truonglt Phase5 Supabase login and responsive workspace navigation start
import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { App as AntApp, Alert, Avatar, Badge, Button, Card, Drawer, Dropdown, Form, Input, Layout, Menu, Segmented, Space, Spin, Tag, Typography } from 'antd';
import { AppstoreOutlined, BarChartOutlined, BellOutlined, DashboardOutlined, HistoryOutlined, LogoutOutlined, MenuOutlined, SafetyCertificateOutlined, SearchOutlined,
  SettingOutlined, ShopOutlined, TeamOutlined, WalletOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, auth, type Capabilities, type Scope, type Summary } from './api';
import { WorkspaceContext } from './ui';
// Load protected tables/history only after login instead of burdening the login bundle.
const Dashboard=lazy(()=>import('./pages').then(m=>({default:m.Dashboard})));
const Products=lazy(()=>import('./pages').then(m=>({default:m.Products})));
const Review=lazy(()=>import('./pages').then(m=>({default:m.Review})));
const HistoryPage=lazy(()=>import('./pages').then(m=>({default:m.HistoryPage})));
const Reports=lazy(()=>import('./pages').then(m=>({default:m.Reports})));
const Settings=lazy(()=>import('./pages').then(m=>({default:m.Settings})));
const ProductDrawer=lazy(()=>import('./ProductDrawer'));
function Login(){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function login(values:{email:string;password:string}){
    if(!auth)return;setError('');setBusy(true);
    try{const result=await auth.auth.signInWithPassword(values);if(result.error)setError('Email hoặc mật khẩu chưa đúng, hoặc đăng nhập tạm thời bị giới hạn.');}
    catch{setError('Chưa kết nối được dịch vụ đăng nhập. Vui lòng thử lại.');}finally{setBusy(false);}
  }
  return <main className="login-page"><section className="login-story"><div className="brand brand-light"><span className="brand-icon"><ShopOutlined/></span><div>TikTok Affiliate<small>Quản lý kinh doanh</small></div></div>
    <div><span className="eyebrow">RÕ TỪNG LƯỢT. ĐÚNG TỪNG SỐ.</span><h1>Mọi con số đều<br/>có lịch sử.</h1><p>Sản phẩm, lượt mua và dòng tiền trong một không gian làm việc. Xem rõ khoản nào đã trả, khoản nào cần đối soát.</p>
      <div className="login-benefit"><SafetyCertificateOutlined/><span>Dữ liệu nguồn được bảo toàn</span></div><div className="login-benefit"><HistoryOutlined/><span>Mọi thay đổi đều có dấu vết</span></div></div><small>Không gian DEV · Asia/Ho_Chi_Minh</small></section>
    <section className="login-form"><Card variant="borderless"><span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span><Typography.Title level={2}>Đăng nhập hệ thống</Typography.Title><p className="muted">Dùng tài khoản đã được quản trị viên cấp quyền.</p>
      {!auth?<Alert type="warning" showIcon title="Kết nối chưa sẵn sàng" description="Liên hệ quản trị viên để hoàn tất cấu hình đăng nhập."/>:null}
      {error?<Alert type="error" showIcon title={error} className="form-alert"/>:null}
      <Form layout="vertical" onFinish={login} requiredMark={false}><Form.Item name="email" label="Email" rules={[{required:true,message:'Nhập email của bạn.'},{type:'email',message:'Email chưa hợp lệ.'}]}><Input size="large" autoComplete="username" placeholder="email@congty.vn"/></Form.Item>
        <Form.Item name="password" label="Mật khẩu" rules={[{required:true,message:'Nhập mật khẩu của bạn.'}]}><Input.Password size="large" autoComplete="current-password" placeholder="Mật khẩu tài khoản"/></Form.Item>
        <Button type="primary" size="large" htmlType="submit" block loading={busy} disabled={!auth}>Đăng nhập</Button></Form><p className="login-help">Tài khoản chưa được cấp quyền? Liên hệ người quản lý hệ thống.</p></Card></section></main>;
}
const navigation=[{key:'/',icon:<DashboardOutlined/>,label:'Tổng quan'},{key:'/products',icon:<ShopOutlined/>,label:'Sản phẩm'},
  {key:'/finance',icon:<WalletOutlined/>,label:'Công nợ & tài chính'},{key:'/alerts',icon:<BellOutlined/>,label:'Cần xử lý'},
  {key:'/history',icon:<HistoryOutlined/>,label:'Lịch sử'},{key:'/reports',icon:<BarChartOutlined/>,label:'Báo cáo'},
  {key:'/settings',icon:<SettingOutlined/>,label:'Cài đặt'}];
function Workspace({session}:{session:Session}){
  const navigate=useNavigate(),location=useLocation(),queryClient=useQueryClient();
  const [scope,setScope]=useState<Scope>(()=>{const s=localStorage.getItem('affiliate-scope');return s==='LEGACY_UNMATCHED'||s===''?s:'XLSX_MATCHED';});
  const [search,setSearch]=useState(''),[menuOpen,setMenuOpen]=useState(false),[selected,setSelected]=useState<string>();
  const caps=useQuery({queryKey:['session'],queryFn:()=>api<Capabilities>('/session')});
  const summary=useQuery({queryKey:['summary',scope],queryFn:()=>api<Summary>('/finance/summary'+(scope?'?classification='+scope:''))});
  const changeScope=(v:Scope)=>{setScope(v);localStorage.setItem('affiliate-scope',v);};
  const menu=<><div className="brand"><span className="brand-icon"><ShopOutlined/></span><div>TikTok Affiliate<small>Không gian làm việc</small></div></div><div className="nav-caption">QUẢN LÝ</div>
    <Menu mode="inline" selectedKeys={[location.pathname]} items={navigation} onClick={({key})=>{navigate(key);setMenuOpen(false);}}/>
    <div className="sidebar-footer"><SafetyCertificateOutlined/><div>Nguồn dữ liệu được giữ nguyên<small>Lịch sử không thể ghi đè</small></div></div></>;
  return <WorkspaceContext.Provider value={{scope,setScope:changeScope,search,setSearch,showProduct:setSelected,capabilities:caps.data}}><Layout className="workspace">
    <Layout.Sider width={232} className="desktop-sidebar" theme="light">{menu}</Layout.Sider><Drawer open={menuOpen} onClose={()=>setMenuOpen(false)} placement="left" width={270} title="Điều hướng">{menu}</Drawer>
    <Layout><header className="topbar"><div className="topbar-left"><Button className="mobile-menu" aria-label="Mở điều hướng" icon={<MenuOutlined/>} onClick={()=>setMenuOpen(true)}/><AppstoreOutlined className="workspace-mark"/><span>Không gian Affiliate</span><Tag color="cyan">DEV</Tag></div>
      <Input className="global-search" prefix={<SearchOutlined/>} placeholder="Tìm sản phẩm…" aria-label="Tìm sản phẩm" value={search} onChange={e=>setSearch(e.target.value)} onPressEnter={()=>navigate('/products')} allowClear/>
      <Space size={18}><Badge dot={!!summary.data&&(summary.data.missing>0||summary.data.review>0)}><Button type="text" aria-label="Xem các mục cần xử lý" icon={<BellOutlined/>} onClick={()=>navigate('/alerts')}/></Badge>
        <Dropdown menu={{items:[{key:'profile',label:session.user.email||'Tài khoản',disabled:true},{key:'role',label:caps.data?.actor.role||'Đang xác minh quyền',disabled:true},
          {key:'logout',label:'Đăng xuất',icon:<LogoutOutlined/>}],onClick:async({key})=>{if(key==='logout'){await auth?.auth.signOut();queryClient.clear();}}}}><Button type="text" className="profile-button"><Avatar size={30} style={{background:'#e1f0eb',color:'#177c70'}}>{(session.user.email||'U').slice(0,1).toUpperCase()}</Avatar><span>{caps.data?.actor.role||'Tài khoản'}</span></Button></Dropdown></Space></header>
      <Layout.Content className="main-content"><div className="scope-strip"><Space><span className="muted">Phạm vi dữ liệu</span><Segmented value={scope} options={[{label:'Đang vận hành',value:'XLSX_MATCHED'},{label:'Legacy',value:'LEGACY_UNMATCHED'},{label:'Tất cả',value:''}]} onChange={v=>changeScope(v as Scope)}/></Space>
        <Tag color={caps.data?.canWrite?'green':'default'}>{caps.data?.canWrite?'Có quyền cập nhật':'Chỉ xem'}</Tag></div>
        {caps.error?<Alert type="warning" showIcon title="Quyền truy cập chưa được xác minh" description={caps.error instanceof Error?caps.error.message:'Vui lòng tải lại sau.'} className="page-alert"/>:null}
        <Suspense fallback={<div className="drawer-loading"><Spin/><p>Đang mở màn hình…</p></div>}><Routes><Route path="/" element={<Dashboard/>}/><Route path="/products" element={<Products/>}/><Route path="/finance" element={<Review/>}/><Route path="/alerts" element={<Review alerts/>}/>
          <Route path="/history" element={<HistoryPage/>}/><Route path="/reports" element={<Reports/>}/><Route path="/settings" element={<Settings email={session.user.email}/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense>
        <footer className="page-footer"><span>TikTok Affiliate · Dữ liệu và lịch sử được bảo toàn</span><span>Giờ Việt Nam · UTC+07:00</span></footer></Layout.Content></Layout>
    {selected?<Suspense fallback={null}><ProductDrawer id={selected} onClose={()=>setSelected(undefined)}/></Suspense>:null}</Layout></WorkspaceContext.Provider>;
}
export default function App(){
  const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true);const client=useQueryClient();
  useEffect(()=>{if(!auth){setLoading(false);return;}let active=true;auth.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false);}});
    const{data}=auth.auth.onAuthStateChange((event,next)=>{if(active){setSession(next);setLoading(false);if(event==='SIGNED_OUT')client.clear();}});return()=>{active=false;data.subscription.unsubscribe();};},[client]);
  if(loading)return <div className="app-loading"><Spin size="large"/><p>Đang mở không gian làm việc…</p></div>;
  return session?<Workspace session={session}/>:<Login/>;
}
// truonglt Phase5 Supabase login and responsive workspace navigation end
