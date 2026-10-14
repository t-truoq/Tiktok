// truonglt Phase5 Vietnamese accessible React application bootstrap start
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 20000, refetchOnWindowFocus:false,
  retry: (count,error:any)=>count<1&&![401,403,404].includes(error.status) }, mutations: { retry:false } } });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ConfigProvider locale={viVN} theme={{ token:{ colorPrimary:'#177c70',colorInfo:'#177c70',
  colorBgLayout:'#f4f6f8',borderRadius:10,fontFamily:'Inter, "Segoe UI", system-ui, sans-serif',fontSize:14 },components:{Table:{headerBg:'#f7f9fb'},Menu:{itemBorderRadius:8}} }}>
  <AntApp><QueryClientProvider client={client}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></AntApp>
</ConfigProvider></React.StrictMode>);
// truonglt Phase5 Vietnamese accessible React application bootstrap end
