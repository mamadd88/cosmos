import { Navigate, useLocation } from 'react-router';
import { canonicalPath } from '../state/routing';
export default function Fallback() {
  const { pathname, search, hash } = useLocation();
  const target = canonicalPath(pathname);
  return <Navigate to={{ pathname: target === pathname ? '/cosmos' : target, search, hash }} replace />;
}
