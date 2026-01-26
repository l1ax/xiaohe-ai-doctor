import { useNavigate, useLocation, NavigateOptions } from 'react-router-dom';

/**
 * 智能导航 Hook
 *
 * 提供智能导航功能，避免使用 navigate(-1) 导致的 404 问题
 * 当浏览器历史栈中没有上一页时，自动 fallback 到指定路径
 */
export function useSmartNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * 智能返回
   * 检查浏览器历史栈状态，如果有上一页则返回，否则跳转到 fallback 路径
   *
   * @param fallback - 回退路径，如 '/appointments/doctors'
   */
  const navigateBack = (fallback: string) => {
    try {
      // 检查浏览器历史栈状态
      // 如果 history.state.idx > 0，说明有上一页
      if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        // 没有上一页，使用 fallback
        navigate(fallback, { replace: true });
      }
    } catch (error) {
      // 发生错误时，确保至少能导航到 fallback
      console.error('[useSmartNavigation] Navigation error:', error);
      navigate(fallback, { replace: true });
    }
  };

  /**
   * 带来源信息的导航
   * 记录当前页面路径，方便目标页面返回
   *
   * @param to - 目标路径
   */
  const navigateWithReferrer = (to: string) => {
    navigate(to, { state: { from: location.pathname } });
  };

  /**
   * 导航到详情页
   * 自动记录 fallback 路径，方便详情页返回
   *
   * @param basePath - 基础路径，如 '/appointments'
   * @param id - 详情 ID
   * @param fallback - 回退路径，如 '/appointments'
   */
  const navigateToDetail = (basePath: string, id: string, fallback: string) => {
    navigate(`${basePath}/${id}`, { state: { fallback } });
  };

  return {
    navigateBack,
    navigateWithReferrer,
    navigateToDetail,
  };
};

/**
 * 获取安全的 fallback 路径
 * 优先使用路由状态中的 fallback，否则使用默认值
 *
 * @param defaultFallback - 默认回退路径
 * @returns 回退路径
 */
export function getSafeFallback(defaultFallback: string): string {
  // 检查路由状态中是否有 fallback
  const state = window.history.state;
  if (state?.fallback) {
    return state.fallback;
  }
  // 检查路由状态中是否有 from（来源页面）
  if (state?.from) {
    return state.from;
  }
  return defaultFallback;
}

/**
 * 导航到指定路径，并记录 fallback
 * 用于在组件外部（如 API 调用后）进行导航
 *
 * @param navigate - useNavigate 返回的 navigate 函数
 * @param to - 目标路径
 * @param fallback - 回退路径
 */
export function navigateWithFallback(
  navigate: (to: string, options?: NavigateOptions) => void,
  to: string,
  fallback: string
) {
  navigate(to, { state: { fallback } });
}
