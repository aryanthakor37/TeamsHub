import { useContext } from 'react';
import { AuthContext } from '../components/auth/MicrosoftAuthProvider';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a MicrosoftAuthProvider');
  }
  return context;
};
