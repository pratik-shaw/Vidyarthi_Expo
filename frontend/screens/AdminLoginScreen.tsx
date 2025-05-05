import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Platform,
  SafeAreaView,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useRef } from 'react';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// API URL with configurable timeout
const API_URL = 'http://192.168.29.148:5000/api'; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout

// Create an axios instance with timeout configuration
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
});

// Add an interceptor to inject the token for authenticated requests
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token for request:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

type Props = NativeStackScreenProps<RootStackParamList, 'AdminLogin'>;

const AdminLoginScreen: React.FC<Props> = ({ navigation }) => {
  // State for form inputs
  const [email, setEmail] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Network status
  const [isConnected, setIsConnected] = useState(true);

  // Refs for input fields (for focus management)
  const emailRef = useRef<TextInput>(null);
  const schoolCodeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Check for existing authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First, check for token and userRole
        const token = await AsyncStorage.getItem('token');
        const userRole = await AsyncStorage.getItem('userRole');
        
        console.log('Auth check - Token:', token ? 'exists' : 'not found');
        console.log('Auth check - User role:', userRole || 'not found');
        
        // Only proceed if both token and correct userRole exist
        if (token && userRole === 'admin') {
          try {
            // Validate the token by making a request to the validation endpoint
            const validationResponse = await apiClient.get('/admin/validate');
            if (validationResponse.status === 200) {
              console.log('Token validated, navigating to AdminHome');
              
              // If admin data was returned with validation, save it
              if (validationResponse.data && validationResponse.data.admin) {
                await AsyncStorage.setItem('adminData', JSON.stringify(validationResponse.data.admin));
                console.log('Admin data saved from validation response');
              }
              
              navigation.reset({
                index: 0,
                routes: [{ name: 'AdminHome' }],
              });
            }
          } catch (validationError) {
            console.error('Token validation error:', validationError);
            // If token is invalid, clear storage
            await AsyncStorage.multiRemove(['token', 'userRole', 'adminData']);
            console.log('Invalid token - storage cleared');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
    };
    
    checkAuth();
  }, [navigation]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Run entry animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  // Form validation
  const isFormValid = () => {
    if (!email || !schoolCode || !password) return false;
    if (!isEmailValid()) return false;
    return true;
  };

  // Email validation check
  const isEmailValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Show detailed error if API call fails
  const handleApiError = (error: any) => {
    console.error("Login error:", error);
    
    if (!isConnected) {
      Alert.alert(
        "Network Error", 
        "You appear to be offline. Please check your internet connection and try again."
      );
      return;
    }
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        Alert.alert(
          "Connection Timeout", 
          "The server took too long to respond. Please check your API URL and try again. Make sure your server is running at " + API_URL
        );
      } else if (error.response) {
        // Server responded with error status code
        if (error.response.status === 401) {
          Alert.alert(
            "Login Failed", 
            "Invalid credentials. Please check your email, school code, and password."
          );
        } else {
          Alert.alert(
            "Login Failed", 
            error.response.data?.message || `Server error (${error.response.status}). Please try again.`
          );
        }
      } else if (error.request) {
        // Request made but no response received
        Alert.alert(
          "Server Unreachable", 
          `Could not reach the server at ${API_URL}. Please verify the API URL is correct and the server is running.`
        );
      } else {
        Alert.alert(
          "Request Error", 
          "An error occurred while setting up the request. Please try again."
        );
      }
    } else {
      Alert.alert(
        "Unknown Error", 
        "An unexpected error occurred. Please try again later."
      );
    }
  };

  // Clear AsyncStorage for debugging if needed
  const clearStorageAndRetry = async () => {
    try {
      await AsyncStorage.multiRemove(['token', 'userRole', 'adminData']);
      console.log('AsyncStorage cleared');
      Alert.alert('Storage Cleared', 'Please try logging in again');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  // Handle login
  const handleLogin = async () => {
    if (!isFormValid()) {
      let errorMessage = "Please fill all required fields";
      
      if (!isEmailValid()) {
        errorMessage = "Please enter a valid email address";
      }
      
      Alert.alert("Error", errorMessage);
      return;
    }

    if (!isConnected) {
      Alert.alert("Network Error", "You appear to be offline. Please check your internet connection and try again.");
      return;
    }

    setIsLoading(true);

    try {
      console.log('Attempting login with:', { email, schoolCode });
      
      // Make the login request
      const response = await apiClient.post('/admin/login', {
        email,
        password,
        schoolCode
      });

      console.log('Login response received:', {
        status: response.status,
        hasToken: !!response.data?.token,
        hasAdminData: !!response.data?.admin
      });

      // If login is successful, save the token to AsyncStorage
      if (response.data && response.data.token) {
        try {
          // Clear any existing data first
          await AsyncStorage.multiRemove(['token', 'userRole', 'adminData']);
          
          // Save the token first
          await AsyncStorage.setItem('token', response.data.token);
          console.log('Token saved to AsyncStorage');
          
          // Save the user role
          await AsyncStorage.setItem('userRole', 'admin');
          console.log('User role saved to AsyncStorage');
          
          // Save admin data if it's provided in the login response
          if (response.data.admin) {
            await AsyncStorage.setItem('adminData', JSON.stringify(response.data.admin));
            console.log('Admin data saved from login response');
          }
          
          // Navigate to AdminHome
          console.log('Navigating to AdminHome screen');
          navigation.reset({
            index: 0,
            routes: [{ name: 'AdminHome' }],
          });
        } catch (storageError) {
          console.error('Error saving auth data:', storageError);
          Alert.alert(
            "Storage Error", 
            "Failed to save login information. Please try again.",
            [
              { text: "OK" },
              { text: "Clear Storage & Retry", onPress: clearStorageAndRetry }
            ]
          );
        }
      } else {
        console.warn('Login response missing token:', response.data);
        Alert.alert(
          "Login Error", 
          "Server response is missing authentication token."
        );
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to signup screen
  const navigateToSignup = () => {
    navigation.navigate('AdminSignup');
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    // You can implement forgot password functionality here
    // For now, just show an alert
    Alert.alert(
      "Reset Password", 
      "Please contact your system administrator to reset your password.",
      [{ text: "OK" }]
    );
  };

  // Debug function to check navigation state
  const debugNavigation = () => {
    const navState = navigation.getState();
    console.log('Navigation state:', JSON.stringify(navState, null, 2));
    Alert.alert(
      "Debug Options",
      "Choose an action:",
      [
        { text: "Clear Auth Data", onPress: clearStorageAndRetry },
        { text: "Check Navigation", onPress: () => Alert.alert("Nav Routes", `Routes: ${navState.routes.map(r => r.name).join(', ')}`) },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                disabled={isLoading}
              >
                <Ionicons name="arrow-back" size={24} color="#3A4276" />
              </TouchableOpacity>
              
              <Animated.View 
                style={[
                  styles.logoContainer, 
                  { 
                    opacity: fadeAnim, 
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <Image 
                  source={require('../assets/images/logo.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.appName}>Vidyarthi</Text>
              </Animated.View>
              
              <Animated.View 
                style={[
                  styles.titleContainer,
                  { 
                    opacity: fadeAnim, 
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <Text style={styles.title}>Administrator</Text>
                <Text style={styles.subtitle}>Login</Text>
              </Animated.View>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              <Text style={styles.formLabel}>Email Address</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="envelope" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  ref={emailRef}
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#B0B7C3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  onSubmitEditing={() => schoolCodeRef.current?.focus()}
                  returnKeyType="next"
                  editable={!isLoading}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>

              <Text style={styles.formLabel}>School Code</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="building" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  ref={schoolCodeRef}
                  style={styles.input}
                  placeholder="Enter school code"
                  placeholderTextColor="#B0B7C3"
                  value={schoolCode}
                  onChangeText={setSchoolCode}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  returnKeyType="next"
                  editable={!isLoading}
                  autoComplete="off"
                />
              </View>

              <Text style={styles.formLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="lock" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#B0B7C3"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  editable={!isLoading}
                  autoComplete="password"
                  textContentType="password"
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#8A94A6" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={handleForgotPassword}
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  (!isFormValid() || isLoading) && styles.loginButtonDisabled
                ]}
                onPress={handleLogin}
                disabled={!isFormValid() || isLoading}
              >
                <LinearGradient
                  colors={['#4E54C8', '#8F94FB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.loginButtonText}>Login</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.createAccountContainer}>
                <Text style={styles.createAccountText}>
                  Don't have an account? 
                </Text>
                <TouchableOpacity 
                  onPress={navigateToSignup}
                  disabled={isLoading}
                >
                  <Text style={styles.createAccountLink}>
                    Create new
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity 
                style={styles.helpButton}
                onPress={debugNavigation}
              >
                <Feather name="help-circle" size={16} color="#8A94A6" style={styles.helpIcon} />
                <Text style={styles.footerText}>Need help? Contact support</Text>
              </TouchableOpacity>
              <Text style={styles.version}>Version 2.4.1</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 24,
    position: 'relative',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginBottom: 20,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3A4276',
  },
  titleContainer: {
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '300',
    color: '#3A4276',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#3A4276',
  },
  formContainer: {
    flex: 1,
    paddingTop: 10,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  eyeIcon: {
    padding: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#3A4276',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#4E54C8',
    fontWeight: '600',
  },
  loginButton: {
    marginVertical: 10,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#4E54C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  createAccountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  createAccountText: {
    fontSize: 14,
    color: '#8A94A6',
  },
  createAccountLink: {
    fontSize: 14,
    color: '#4E54C8',
    fontWeight: '600',
    marginLeft: 4,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(138, 148, 166, 0.1)',
    marginBottom: 5,
  },
  helpIcon: {
    marginRight: 6,
  },
  footer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#8A94A6',
  },
  version: {
    fontSize: 12,
    color: '#B0B7C3',
    marginTop: 8,
  },
});

export default AdminLoginScreen;