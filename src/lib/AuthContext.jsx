import db, { supabase } from '@/api/base44Client';

import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const currentUser = await db.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      if (error && (error.status === 401 || error.status === 403)) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    }
  };

  useEffect(() => {
    // Check initial session
    checkUserAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session) {
          await checkUserAuth();
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setAuthChecked(true);
          setIsLoadingAuth(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      db.auth.logout('/login');
    } else {
      db.auth.logout();
    }
  };

  const getPostAuthPath = (currentUser) => {
    if (!currentUser) return '/';
    if (!currentUser.app_role) return '/role-select';
    if (currentUser.app_role === 'driver' && !currentUser.bus_id) return '/driver-code';
    if (currentUser.app_role === 'parent' && !currentUser.bus_id) return '/parent-link';
    if (currentUser.app_role === 'admin') return '/admin';
    if (currentUser.app_role === 'driver') return '/driver';
    if (currentUser.app_role === 'parent') return '/parent';
    return '/';
  };

  const navigateToLogin = () => {
    db.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      authChecked,
      logout,
      navigateToLogin,
      getPostAuthPath,
      checkUserAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
