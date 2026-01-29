import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

const VIPBanner = observer(function VIPBanner() {
  const navigate = useNavigate();

  return (
    <div
      className="w-full h-20 rounded-xl overflow-hidden relative shadow-sm group cursor-pointer mx-4 mt-4"
      onClick={() => navigate('/vip')}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-emerald-600"></div>
      <img
        alt="Soft medical background pattern"
        className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30"
        style={{ backgroundImage: 'url(https://lh3.googleusercontent.com/aida-public/AB6AXuBuE3yoiEX3YM9tM-15m0v35_pgxcSQ8UnsOHwu6g2ECW4d-D2csg66U5938P6JqvYtqKgurTXuaUNS7vic_GQ_7I0kYVBzuvzGz4cXGVKwqSpvKCOkqtdBm4y_kJaKQuCS5281g2vjakeZl7KRReLetlsvuBsEPrS2aGW7tJv2pUQR2pCFtE_7bMyYs5k8Woa5cY0innNYEz53YR0pq9Gupt41Th-o-U-fVpTPNaWQvdgqUSxzEKGjCSv-4RTarSeKtbbFaJjyWYiH)' }}
      />
      <div className="relative z-10 flex items-center justify-between h-full px-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-white font-bold text-base">小荷健康VIP季卡</h3>
          <p className="text-white/90 text-xs">无限次AI咨询 · 专家号优先约</p>
        </div>
        <button className="bg-white text-teal-600 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm">
          立即查看
        </button>
      </div>
    </div>
  );
});

export default VIPBanner;
