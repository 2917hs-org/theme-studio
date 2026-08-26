import { InfoIcon } from './icons';

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="toast" role="status">
      <InfoIcon size={14} className="toast-icon" />
      <span>{message}</span>
    </div>
  );
}
