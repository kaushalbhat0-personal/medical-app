import { PackageOpen, Search, FileX, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: 'package' | 'search' | 'file' | LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const iconMap: Record<string, LucideIcon> = {
  package: PackageOpen,
  search: Search,
  file: FileX,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data found',
  description = 'There are no items to display at the moment.',
  icon = 'package',
  action,
}) => {
  const IconComponent = typeof icon === 'string' ? iconMap[icon] : icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        <IconComponent className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
