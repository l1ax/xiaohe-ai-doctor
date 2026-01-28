import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';

interface DoctorRecommendCardProps {
  doctorId: string;
  doctorName: string;
  hospital: string;
  department: string;
  label: string;
}

/**
 * 医生推荐卡片组件
 * 显示医生基础信息和挂号按钮
 */
export const DoctorRecommendCard: React.FC<DoctorRecommendCardProps> = ({
  doctorId,
  doctorName,
  hospital,
  department,
  label,
}) => {
  const navigate = useNavigate();

  const handleBooking = () => {
    // 跳转到预约页面，携带医生信息参数
    const params = new URLSearchParams({
      doctorId,
      doctorName,
      hospital,
      department,
    });
    navigate(`/appointments/schedule?${params.toString()}`);
  };

  return (
    <Card className="mt-3 border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 医生图标 */}
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-primary" />
          </div>

          {/* 医生信息 */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base text-foreground truncate">
              {doctorName}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {hospital} · {department}
            </p>
          </div>
        </div>

        {/* 挂号按钮 */}
        <Button onClick={handleBooking} size="sm" className="flex-shrink-0">
          {label}
        </Button>
      </CardContent>
    </Card>
  );
};
