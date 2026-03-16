import { useContext } from 'react';
import { AuthContext } from '@contexts/auth';

export const useAuth = () => useContext(AuthContext);
