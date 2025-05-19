import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar,
  Animated,
  Platform,
  SafeAreaView,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useCallback } from 'react';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API base URL - replace with your actual backend URL
const API_URL = 'http://192.168.29.148:5000/api';

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherLogin'>;

const TeacherLoginScreen: React.FC<Props> = ({ navigation }) => {
  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true); // New state to track token validation
  const [errorMessage, setErrorMessage] = useState('');

  // Animation states
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);

  // Check for existing token and navigate if found
  const checkExistingToken = useCallback(async () => {
    setIsCheckingToken(true);
    try {
      const token = await AsyncStorage.getItem('teacherToken');
      if (token) {
        console.log('Found existing token, validating...');
        try {
          const response = await axios.get(`${API_URL}/teacher/validate-token`, {
            headers: {
              'x-auth-token': token
            }
          });
          
          if (response.data.valid) {
            console.log('Token is valid, navigating to dashboard');
            // Store the teacher data if it's in the response
            if (response.data.teacher) {
              await AsyncStorage.setItem('teacherData', JSON.stringify(response.data.teacher));
            }
            // Navigate to dashboard
            navigation.replace('TeacherHome'); // Using replace to prevent going back to login
            return; // Return early to prevent further execution
          } else {
            console.log('Token is invalid, remaining on login screen');
            // Token is invalid, remove it
            await AsyncStorage.removeItem('teacherToken');
          }
        } catch (error) {
          console.log('Token validation failed:', error);
          // Token validation failed, remove the token
          await AsyncStorage.removeItem('teacherToken');
        }
      } else {
        console.log('No token found, remaining on login screen');
      }
    } catch (error) {
      console.log('Error checking token:', error);
    } finally {
      setIsCheckingToken(false);
    }
  }, [navigation]);

  useEffect(() => {
    // Start animations
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

    // Check for existing token
    checkExistingToken();
  }, [checkExistingToken]);

  // Login function
  const handleLogin = async () => {
    // Form validation
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await axios.post(`${API_URL}/teacher/login`, {
        email,
        password
      });

      // Store token and teacher data
      const { token, teacher } = response.data;
      await AsyncStorage.setItem('teacherToken', token);
      await AsyncStorage.setItem('teacherData', JSON.stringify(teacher));

      // Reset form
      setEmail('');
      setPassword('');
      setIsLoading(false);

      // Navigate to dashboard
      navigation.replace('TeacherHome'); // Using replace to prevent going back to login
      console.log('Login successful, navigated to dashboard');
    } catch (error) {
      setIsLoading(false);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Server responded with an error status code
          const responseData = error.response.data as { message?: string; msg?: string };
          setErrorMessage(responseData.message || responseData.msg || 'Login failed');
        } else if (error.request) {
          // Request was made but no response received
          setErrorMessage('Cannot connect to server. Please check your internet connection.');
        } else {
          // Something else happened while setting up the request
          setErrorMessage('An unexpected error occurred. Please try again.');
        }
      } else {
        // Handle non-axios errors
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
      
      console.error('Login error:', error);
    }
  };

  // Show loading indicator while checking token
  if (isCheckingToken) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1CB5E0" />
        <Text style={styles.loadingText}>Checking login status...</Text>
      </SafeAreaView>
    );
  }

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
                <Text style={styles.title}>Teacher</Text>
                <Text style={styles.subtitle}>Login</Text>
              </Animated.View>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              {errorMessage ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <Text style={styles.formLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="envelope" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#B0B7C3"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrorMessage(''); // Clear error when user types
                  }}
                />
              </View>

              <Text style={styles.formLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="lock" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#B0B7C3"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage(''); // Clear error when user types
                  }}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#8A94A6" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.forgotPassword}
                //onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.disabledButton]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#1CB5E0', '#38EF7D']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>Login</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.createAccountContainer}>
                <Text style={styles.createAccountText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('TeacherSignup')}>
                  <Text style={styles.createAccountLink}>Create new</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity 
                style={styles.helpButton}
                //onPress={() => navigation.navigate('Support')}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#3A4276',
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
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
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
    color: '#1CB5E0',
    fontWeight: '600',
  },
  loginButton: {
    marginVertical: 10,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1CB5E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: {
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
    color: '#1CB5E0',
    fontWeight: '600',
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

export default TeacherLoginScreen;