import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { PlusCircle, ShoppingCart } from 'lucide-react';

interface HeaderProps {
  title: string;
  actionText?: string;
  actionLink?: string;
  onActionClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  actionText,
  actionLink,
  onActionClick,
}) => {
  const { user } = useAuth();
  const canBill = user?.role === 'admin' || user?.role === 'billing_staff';

  return (
    <header className="app-header">
      <div className="header-left">
        <h1>{title}</h1>
      </div>
      <div className="header-right">
        {canBill && (
          <Link to="/billing" className="btn btn-primary btn-sm">
            <ShoppingCart size={15} />
            <span>New Sale</span>
          </Link>
        )}
        {actionText && actionLink && (
          <Link to={actionLink} className="btn btn-secondary btn-sm">
            <PlusCircle size={15} />
            <span>{actionText}</span>
          </Link>
        )}
        {actionText && onActionClick && (
          <button onClick={onActionClick} className="btn btn-secondary btn-sm">
            <PlusCircle size={15} />
            <span>{actionText}</span>
          </button>
        )}
      </div>
    </header>
  );
};
