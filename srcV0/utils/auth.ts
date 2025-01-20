export const checkAuth = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('isAuthorized') === 'true';
};

export const setAuth = () => {
  localStorage.setItem('isAuthorized', 'true');
}; 