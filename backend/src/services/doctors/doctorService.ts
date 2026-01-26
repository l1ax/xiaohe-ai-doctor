/**
 * 医生服务 (Mock 数据)
 *
 * MVP 阶段使用 Mock 数据快速验证产品逻辑
 */

export interface Doctor {
  id: string;
  name: string;
  title: string;
  department: string;
  hospital: string;
  avatarUrl?: string;
  introduction: string;
  consultationFee: number; // 分
  isAvailable: boolean;
  rating: number;
}

// Mock 医生数据
const mockDoctors: Doctor[] = [
  {
    id: 'doctor_001',
    name: '张医生',
    title: '主任医师',
    department: '心内科',
    hospital: '北京协和医院',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=doctor1',
    introduction: '从事心内科临床工作20年，擅长冠心病、高血压的诊断与治疗。',
    consultationFee: 5000, // 50元
    isAvailable: true,
    rating: 4.8,
  },
  {
    id: 'doctor_002',
    name: '李医生',
    title: '副主任医师',
    department: '呼吸内科',
    hospital: '北京朝阳医院',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=doctor2',
    introduction: '擅长慢性阻塞性肺疾病、哮喘等呼吸系统常见病的诊治。',
    consultationFee: 4000, // 40元
    isAvailable: true,
    rating: 4.7,
  },
  {
    id: 'doctor_003',
    name: '王医生',
    title: '主治医师',
    department: '消化内科',
    hospital: '北京友谊医院',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=doctor3',
    introduction: '擅长胃肠道疾病的诊治，对胃镜、肠镜检查有丰富经验。',
    consultationFee: 3000, // 30元
    isAvailable: false,
    rating: 4.9,
  },
  {
    id: 'doctor_004',
    name: '赵医生',
    title: '主任医师',
    department: '神经内科',
    hospital: '北京天坛医院',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=doctor4',
    introduction: '擅长脑血管病、头痛、癫痫等神经系统疾病的诊治。',
    consultationFee: 6000, // 60元
    isAvailable: true,
    rating: 4.6,
  },
];

/**
 * 获取医生列表
 */
export function getDoctorList(filters?: {
  department?: string;
  hospital?: string;
  available?: boolean;
}): Doctor[] {
  let result = [...mockDoctors];

  if (filters?.department) {
    result = result.filter((d) => d.department === filters.department);
  }

  if (filters?.hospital) {
    result = result.filter((d) => d.hospital === filters.hospital);
  }

  if (filters?.available !== undefined) {
    result = result.filter((d) => d.isAvailable === filters.available);
  }

  return result;
}

/**
 * 获取医生详情
 */
export function getDoctorById(id: string): Doctor | undefined {
  return mockDoctors.find((d) => d.id === id);
}

/**
 * 获取或创建医生记录
 * MVP 阶段：如果医生不存在，创建一个默认的医生记录
 * 只允许测试号码（13800138000-13800138003）注册为医生
 */
export function getOrCreateDoctor(id: string, phone?: string): Doctor | undefined {
  let doctor = mockDoctors.find((d) => d.id === id);
  if (!doctor) {
    // 安全检查：只允许测试号码创建医生账号
    const TEST_PHONE_PREFIX = '138001380';
    if (!phone || !phone.startsWith(TEST_PHONE_PREFIX)) {
      console.warn('[getOrCreateDoctor] 拒绝非测试号码创建医生账号', { id, phone });
      return undefined;
    }

    // 创建新的医生记录
    doctor = {
      id,
      name: '医生',
      title: '医师',
      department: '全科',
      hospital: '在线医院',
      introduction: '专业在线问诊服务',
      consultationFee: 3000,
      isAvailable: true,
      rating: 4.5,
    };
    mockDoctors.push(doctor);
  }
  return doctor;
}

/**
 * 获取所有科室
 */
export function getDepartments(): string[] {
  return Array.from(new Set(mockDoctors.map((d) => d.department))).sort();
}

/**
 * 获取所有医院
 */
export function getHospitals(): string[] {
  return Array.from(new Set(mockDoctors.map((d) => d.hospital))).sort();
}
