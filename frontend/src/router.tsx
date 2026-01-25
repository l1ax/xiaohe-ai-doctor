import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Layout from './components/Layout';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'chat', element: <div>问诊页面（开发中）</div> },
      { path: 'appointment', element: <div>挂号页面（开发中）</div> },
      { path: 'profile', element: <div>个人中心（开发中）</div> },
    ],
  },
]);
