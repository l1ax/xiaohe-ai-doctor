import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';

const Login = observer(function Login() {
  const [phone, setPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (userStore.isLoggedIn) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      alert('请输入正确的手机号');
      return;
    }
    await userStore.sendCode(phone);
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    if (!phone || !verifyCode) {
      alert('请填写完整信息');
      return;
    }
    try {
      await userStore.login(phone, verifyCode);
      navigate('/', { replace: true });
    } catch (e: any) {
      alert(e.message || '登录失败');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-light dark:bg-background-dark">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <span className="material-symbols-outlined text-primary text-[48px] filled">medical_services</span>
          </div>
          <h1 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark">小禾AI医生</h1>
          <p className="text-text-sec-light dark:text-text-sec-dark mt-2">智能健康助手</p>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Phone Input */}
          <div>
            <label className="block text-sm font-medium text-text-main-light dark:text-text-main-dark mb-2">
              手机号
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sec-light dark:text-text-sec-dark">
                +86
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                className="w-full pl-16 pr-4 py-3 rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text-main-light dark:text-text-main-dark"
              />
            </div>
          </div>

          {/* Verify Code */}
          <div>
            <label className="block text-sm font-medium text-text-main-light dark:text-text-main-dark mb-2">
              验证码
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="请输入验证码"
                maxLength={6}
                className="flex-1 py-3 px-4 rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text-main-light dark:text-text-main-dark"
              />
              <button
                onClick={handleSendCode}
                disabled={countdown > 0 || !/^1[3-9]\d{9}$/.test(phone)}
                className="px-4 py-3 rounded-xl bg-primary text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
            <p className="text-xs text-text-sec-light dark:text-text-sec-dark mt-2">
              演示验证码：123456
            </p>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={userStore.loading || !phone || !verifyCode}
            className="w-full py-4 rounded-xl bg-primary text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
          >
            {userStore.loading ? '登录中...' : '登录 / 注册'}
          </button>

          {/* Agreement */}
          <p className="text-xs text-center text-text-sec-light dark:text-text-sec-dark">
            登录即同意《用户协议》和《隐私政策》
          </p>
        </div>
      </div>
    </div>
  );
});

export default Login;
