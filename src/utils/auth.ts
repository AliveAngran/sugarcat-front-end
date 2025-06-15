export const checkAuth = (): { isAuth: boolean; role: string | null; id: string | null } => {
  if (typeof window === 'undefined') return { isAuth: false, role: null, id: null };
  const isAuth = localStorage.getItem('isAuthorized') === 'true';
  const role = localStorage.getItem('userRole');
  const id = localStorage.getItem('userId');
  return { isAuth, role, id };
};

export const setAuth = (role: string, id: string | null) => {
  localStorage.setItem('isAuthorized', 'true');
  localStorage.setItem('userRole', role);
  if (id) {
    localStorage.setItem('userId', id);
  }
};

export const clearAuth = () => {
  localStorage.removeItem('isAuthorized');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userId');
}

// Kept for compatibility if used elsewhere, but new logic should use checkAuth().id
export const getSalespersonId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const auth = checkAuth();
  if (auth.isAuth && auth.role === 'salesperson') {
    return auth.id;
  }
  return null;
}; 