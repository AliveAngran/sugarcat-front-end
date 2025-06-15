export const checkAuth = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('isAuthorized') === 'true';
};

export const setAuth = () => {
  localStorage.setItem('isAuthorized', 'true');
};

export const setSalespersonId = (id: string) => {
  localStorage.setItem('salespersonId', id);
};

export const getSalespersonId = (): string | null => {
  return localStorage.getItem('salespersonId');
}; 