import { useAuth } from '../contexts/AuthContext';

export const usePermission = (key) => {
  const { hasPermission } = useAuth();
  const keys = Array.isArray(key) ? key : [key];
  return keys.some((permission) => permission && hasPermission(permission));
};

export const Can = ({ permission, children, fallback = null, disabled = false, disabledTitle }) => {
  const allowed = usePermission(permission);
  if (allowed) return children;
  if (!disabled) return fallback;
  if (typeof children === 'function') {
    return children({ disabled: true, title: disabledTitle || 'You do not have permission to perform this action.' });
  }
  return fallback;
};
