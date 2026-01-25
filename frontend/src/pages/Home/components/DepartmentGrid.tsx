import DepartmentItem from './DepartmentItem';
import { Department } from '../../../mock/data';

interface DepartmentGridProps {
  departments: Department[];
}

export default function DepartmentGrid({ departments }: DepartmentGridProps) {
  return (
    <div className="grid grid-cols-4 gap-y-4">
      {departments.map((dept) => (
        <DepartmentItem key={dept.id} department={dept} />
      ))}
    </div>
  );
}
