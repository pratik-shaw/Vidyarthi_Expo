import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';

import AuthSplashScreen from '../components/AuthSplashScreen';
import { STUDENT_API, TEACHER_API, ADMIN_API, API_BASE_URL } from '../config/api'; // Add these to your config

type Props = NativeStackScreenProps<RootStackParamList, 'AuthController'>;

// API configurations - FIXED: Using consistent API structure
const API_CONFIGS = {
  student: {
    baseURL: STUDENT_API,
    validateEndpoint: '/api/student/validate',
    homeRoute: 'StudentHome' as keyof RootStackParamList,
    tokenKey: 'studentToken',
    dataKey: 'studentData'
  },
  teacher: {
    baseURL: TEACHER_API,
    validateEndpoint: '/api/teacher/validate-token',
    homeRoute: 'TeacherHome' as keyof RootStackParamList,
    tokenKey: 'teacherToken',
    dataKey: 'teacherData'
  },
  admin: {
    baseURL: API_BASE_URL, // Use the same base URL as admin login
    validateEndpoint: '/admin/validate', // Match the route from adminRoutes.js
    homeRoute: 'AdminHome' as keyof RootStackParamList,
    tokenKey: 'token', // Match the token key used in AdminLogin
    dataKey: 'adminData'
  }
};

type UserRole = 'student' | 'teacher' | 'admin';

interface AuthState {
  isChecking: boolean;
  showSplash: boolean;
  userRole: UserRole | null;
  isAuthenticated: boolean;
}

const AuthController: React.FC<Props> = ({ navigation }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isChecking: true,
    showSplash: true,
    userRole: null,
    isAuthenticated: false
  });

  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    // Start authentication check after a brief delay to show splash
    const timer = setTimeout(() => {
      checkAuthenticationStatus();
    }, 500); // Small delay to ensure splash shows

    return () => clearTimeout(timer);
  }, []);

  const createApiClient = (baseURL: string, timeout: number = 15000) => {
    return axios.create({
      baseURL,
      timeout,
    });
  };

  const validateToken = async (role: UserRole, token: string): Promise<boolean> => {
    try {
      const config = API_CONFIGS[role];
      const apiClient = createApiClient(config.baseURL);
      
      console.log(`Validating ${role} token with URL: ${config.baseURL}${config.validateEndpoint}`);
      
      const response = await apiClient.get(config.validateEndpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.status === 200) {
        console.log(`${role} token validated successfully`);
        
        // Save user data if returned - FIXED: Handle different response structures
        if (response.data) {
          let userData = null;
          
          if (role === 'admin' && response.data.admin) {
            userData = response.data.admin;
          } else if (response.data[role]) {
            userData = response.data[role];
          }
          
          if (userData) {
            await AsyncStorage.setItem(config.dataKey, JSON.stringify(userData));
            console.log(`${role} data saved from validation`);
          }
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error validating ${role} token:`, error);
      
      // Log more details for debugging
      if (axios.isAxiosError(error)) {
        console.error(`${role} validation error details:`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
      }
      
      return false;
    }
  };

  const checkAuthenticationStatus = async () => {
    try {
      // Check network connectivity first
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        console.log('No internet connection, checking offline auth state');
        await handleOfflineAuth();
        return;
      }

      console.log('Checking authentication status...');

      // FIXED: Check for tokens using the correct keys for each role
      const tokenChecks = [
        ['studentToken', 'student'],
        ['teacherToken', 'teacher'], 
        ['token', 'admin'] // Admin uses 'token' key, not 'adminToken'
      ];

      const tokens = await AsyncStorage.multiGet(tokenChecks.map(([key]) => key));
      
      const tokenMap = tokens.reduce((acc, [key, value], index) => {
        if (value) {
          const role = tokenChecks[index][1] as UserRole;
          acc[role] = value;
        }
        return acc;
      }, {} as Record<UserRole, string>);

      console.log('Found tokens for roles:', Object.keys(tokenMap));

      // Also check userRole to determine which role to validate first
      const storedUserRole = await AsyncStorage.getItem('userRole');
      console.log('Stored user role:', storedUserRole);

      // If no tokens found, show intro screen
      if (Object.keys(tokenMap).length === 0) {
        console.log('No tokens found, showing intro screen');
        await handleNoAuth();
        return;
      }

      // Validate tokens - prioritize the stored userRole if it exists and has a token
      let authenticatedRole: UserRole | null = null;
      let roleOrder: UserRole[] = ['student', 'teacher', 'admin'];
      
      // If we have a stored user role and a token for it, check that first
      if (storedUserRole && tokenMap[storedUserRole as UserRole]) {
        roleOrder = [storedUserRole as UserRole, ...roleOrder.filter(r => r !== storedUserRole)];
      }
      
      for (const role of roleOrder) {
        if (tokenMap[role]) {
          console.log(`Validating ${role} token...`);
          const isValid = await validateToken(role, tokenMap[role]);
          
          if (isValid) {
            authenticatedRole = role;
            console.log(`Successfully authenticated as ${role}`);
            
            // Update userRole in storage if it's different
            if (storedUserRole !== role) {
              await AsyncStorage.setItem('userRole', role);
              console.log(`Updated userRole to ${role}`);
            }
            
            break;
          } else {
            // Remove invalid token and related data
            const config = API_CONFIGS[role];
            await AsyncStorage.multiRemove([config.tokenKey, config.dataKey]);
            
            // Also remove userRole if it matches the invalid role
            if (storedUserRole === role) {
              await AsyncStorage.removeItem('userRole');
            }
            
            console.log(`Invalid ${role} token removed`);
          }
        }
      }

      if (authenticatedRole) {
        console.log(`Authenticated as ${authenticatedRole}`);
        setAuthState(prev => ({
          ...prev,
          userRole: authenticatedRole,
          isAuthenticated: true,
          isChecking: false
        }));
        
        // Wait for splash animation to complete, then navigate
        setTimeout(() => {
          navigateToUserDashboard(authenticatedRole);
        }, 1000); // Give splash time to complete
      } else {
        console.log('No valid tokens found, showing intro screen');
        await handleNoAuth();
      }

    } catch (error) {
      console.error('Error checking authentication status:', error);
      await handleNoAuth();
    }
  };

  const handleOfflineAuth = async () => {
    try {
      // In offline mode, check if we have stored user data and userRole
      const storedUserRole = await AsyncStorage.getItem('userRole');
      
      if (storedUserRole) {
        const config = API_CONFIGS[storedUserRole as UserRole];
        const userData = await AsyncStorage.getItem(config.dataKey);
        
        if (userData) {
          const parsedData = JSON.parse(userData);
          
          // Check if the user data indicates they have completed setup
          if (parsedData && (parsedData.hasClass !== false || storedUserRole !== 'student')) {
            console.log(`Offline authentication as ${storedUserRole}`);
            setAuthState(prev => ({
              ...prev,
              userRole: storedUserRole as UserRole,
              isAuthenticated: true,
              isChecking: false
            }));
            
            setTimeout(() => {
              navigateToUserDashboard(storedUserRole as UserRole);
            }, 1000);
            return;
          }
        }
      }
      
      // Fallback: check all user data
      const userData = await AsyncStorage.multiGet([
        'studentData',
        'teacherData',
        'adminData'
      ]);

      let offlineRole: UserRole | null = null;
      
      for (const [key, value] of userData) {
        if (value) {
          const role = key.replace('Data', '') as UserRole;
          const parsedData = JSON.parse(value);
          
          // Check if the user data indicates they have completed setup
          if (parsedData && (parsedData.hasClass !== false || role !== 'student')) {
            offlineRole = role;
            break;
          }
        }
      }

      if (offlineRole) {
        console.log(`Offline authentication as ${offlineRole}`);
        setAuthState(prev => ({
          ...prev,
          userRole: offlineRole,
          isAuthenticated: true,
          isChecking: false
        }));
        
        setTimeout(() => {
          navigateToUserDashboard(offlineRole);
        }, 1000);
      } else {
        await handleNoAuth();
      }
    } catch (error) {
      console.error('Error handling offline auth:', error);
      await handleNoAuth();
    }
  };

  const handleNoAuth = async () => {
    // MODIFIED: Always show intro screen when no token is found
    // Remove the check for hasSeenIntro - always show intro when no auth
    console.log('No authentication found, showing intro screen');
    
    setAuthState(prev => ({
      ...prev,
      isAuthenticated: false,
      isChecking: false
    }));

    setTimeout(() => {
      // Always navigate to intro screen when no tokens are found
      navigation.replace('Intro');
    }, 1000); // Wait for splash to complete
  };

  const navigateToUserDashboard = (role: UserRole) => {
    const config = API_CONFIGS[role];
    setAuthState(prev => ({
      ...prev,
      showSplash: false
    }));
    
    console.log(`Navigating to ${config.homeRoute} for ${role}`);
    
    // Small delay to ensure smooth transition
    setTimeout(() => {
      navigation.replace(config.homeRoute);
    }, 300);
  };

  const handleSplashComplete = () => {
    console.log('Splash animation completed');
    setAuthState(prev => ({
      ...prev,
      showSplash: false
    }));
  };

  // Always show splash screen initially
  if (authState.showSplash) {
    return <AuthSplashScreen onAnimationComplete={handleSplashComplete} />;
  }

  // This should not render anything as navigation should happen after splash
  return null;
};

export default AuthController;