export interface Department {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface NewsItem {
  id: string;
  title: string;
  category: string;
  time: string;
  imageUrl: string;
}

export const mockDepartments: Department[] = [
  { id: '1', name: '儿科', icon: 'child_care', color: 'blue' },
  { id: '2', name: '内科', icon: 'cardiology', color: 'orange' },
  { id: '3', name: '口腔科', icon: 'dentistry', color: 'purple' },
  { id: '4', name: '皮肤科', icon: 'face', color: 'rose' },
  { id: '5', name: '中医科', icon: 'spa', color: 'emerald' },
  { id: '6', name: '外科', icon: 'orthopedics', color: 'cyan' },
  { id: '7', name: '妇产科', icon: 'pregnant_woman', color: 'pink' },
  { id: '8', name: '更多', icon: 'grid_view', color: 'slate' },
];

export const mockNews: NewsItem[] = [
  {
    id: '1',
    title: '冬季如何有效增强免疫力？这里有5个妙招',
    category: '健康预防',
    time: '2小时前',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUIW8xxtiEjlKEuevFL4OKgXCBan_wD21tPP1wcQEq-LowmP6uE4y8FAwFRokOvXPsqGjWawSBry14pIeGSDamiM1n3uiB2_wppMiIdMNTxme2FnIzPKtDMWiuuArL78f7XddfakJWF0AS0rocxpIMQch9iyfFXvPwlZc8hI3LkZaXFomU3ANFAfwIgtWC3oSYCB2iOteZ6cHPEQOeGWMMMxEdHRW6pRjnGDGbVjnNlEzDYWMMkkcCSvKLOzZJU5EgNNmVelJdhk5E',
  },
  {
    id: '2',
    title: '65岁以上老年人年度体检发布新指南',
    category: '政策解读',
    time: '5小时前',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCK74cU8JwLNMwiwnYFVxhk3yjjsd35sZ958ukT8g6txu9mbdAntelwWL1Pqy4xH1_EOr4hjAb-OD3Waj4fHc_LYn2gIEkfLrYpC7JaDaKYfNz62cvmqK-vmKIms6h7FRc13zPOEZ1xVQ3Snc68VNCjXHloazEMJhZQaeb77T8OQYQDaXzD4PjmVQZcUcfau-Cjq1r8UZ15SUbeUmJIzho8BHhcifTTe6W7agC4lFPvS2Ib3-qhGcUgIs19RdE4PxSHOzabpOkY-1Ch',
  },
  {
    id: '3',
    title: '定期洗牙为何对心脏健康至关重要？',
    category: '口腔护理',
    time: '1天前',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2ZFtJ2IMiiz8FtcnCIcpfqh3f01xwovCjAMTS684JHDDdm2_XqvJSxUFWxQY1wleGpemPEb6XqgqAzGsfH3TWjqMcLBzp-8dN-kn7UekC-gQqA-ZxakOWjJIe7UHKYUuTZxrtU3T4S5S1zd6FkFX9K0oylWek3JR3VehlgZQzAk14mwSR36_zywptK83QbLUzQbUp_pK8HbDcuPZZDsmeJ47BuKPFhhqB9wCMd-TI_ZspCrrb0llQoo5W56984DcHvg7p3pqQv2ic',
  },
];

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-primary' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-500' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-500' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

export const getDepartmentColor = (color: string) => colorMap[color] || colorMap.slate;
