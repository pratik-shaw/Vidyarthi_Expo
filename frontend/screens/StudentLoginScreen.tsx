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
import ClassSelectionModal from '../components/ClassSelectionModal';

import { STUDENT_API } from '../config/api';

// API URL with configurable timeout
const API_URL = STUDENT_API; // Change this to your server IP/domain
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
      const token = await AsyncStorage.getItem('studentToken');
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

type Props = NativeStackScreenProps<RootStackParamList, 'StudentLogin'>;

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

const StudentLoginScreen: React.FC<Props> = ({ navigation }) => {
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Class selection modal state
  const [showClassModal, setShowClassModal] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<ClassOption[]>([]);
  
  // Student state
  const [studentData, setStudentData] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  // Network status
  const [isConnected, setIsConnected] = useState(true);

  // Refs for input fields (for focus management)
  const emailRef = useRef<TextInput>(null);
  const schoolCodeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Animation states
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Check if the user is already logged in
  useEffect(() => {
    const checkLoginStatus = async () => {
  try {
    console.log('Checking student login status...');
    const storedToken = await AsyncStorage.getItem('studentToken');
    if (storedToken) {
      setToken(storedToken);
      console.log('Student token found, validating...');
      
      try {
        // Updated validation endpoint - make sure this matches your backend API route
        const validationResponse = await apiClient.get('/api/student/validate', {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        
        if (validationResponse.status === 200) {
          console.log('Token validated successfully');
          
          // If student data was returned with validation, save it
          if (validationResponse.data && validationResponse.data.student) {
            await AsyncStorage.setItem('studentData', JSON.stringify(validationResponse.data.student));
            setStudentData(validationResponse.data.student);
            
            console.log('Checking if student has a class assigned');
            // Check if student already has a class assigned
            if (validationResponse.data.student.hasClass) {
              console.log('Student has class, navigating to home');
              navigation.replace('StudentHome');
            } else {
              console.log('Student needs to select class');
              // Make sure to use the school code from the validation response
              const schoolCode = validationResponse.data.student.schoolCode;
              if (schoolCode) {
                // Fetch available classes for the student's school
                fetchAvailableClasses(schoolCode, storedToken);
              } else {
                console.error('School code missing in student data');
                Alert.alert('Error', 'Could not determine your school. Please log in again.');
                await AsyncStorage.multiRemove(['studentToken', 'studentData']);
                setToken(null);
                setStudentData(null);
              }
            }
          }
        }
      } catch (validationError) {
        console.error('Token validation error:', validationError);
        
        // Check if we can recover the stored student data before clearing
        try {
          const storedStudentData = await AsyncStorage.getItem('studentData');
          if (storedStudentData) {
            const studentInfo = JSON.parse(storedStudentData);
            setStudentData(studentInfo);
            
            // If the student already has a class, we can try to continue
            if (studentInfo.hasClass) {
              console.log('Using stored student data to continue');
              navigation.replace('StudentHome');
              return; // Skip clearing storage
            }
          }
        } catch (recoveryError) {
          console.error('Failed to recover student data:', recoveryError);
        }
        
        // Clear storage only if we couldn't recover
        await AsyncStorage.multiRemove(['studentToken', 'studentData']);
        setToken(null);
        setStudentData(null);
        console.log('Invalid token - storage cleared');
      }
    } else {
      console.log('No student token found');
    }
  } catch (error) {
    console.error('Error checking login status:', error);
  }
};

    checkLoginStatus();
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


  // Login function
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
    const formattedSchoolCode = schoolCode.trim();
    
    const response = await apiClient.post('/api/student/login', {
      email,
      password,
      schoolCode: formattedSchoolCode
    });
    
    console.log('Login successful');
    
    // Save token and student data to AsyncStorage
    if (response.data && response.data.token) {
      const newToken = response.data.token;
      setToken(newToken);
      await AsyncStorage.setItem('studentToken', newToken);
      console.log('Student token saved to AsyncStorage');
      
      // Save student data if available
      if (response.data.student) {
        const studentInfo = response.data.student;
        setStudentData(studentInfo);
        await AsyncStorage.setItem('studentData', JSON.stringify(studentInfo));
        console.log('Student data saved to AsyncStorage');
        
        // Check if student needs to select a class
        if (studentInfo.hasClass) {
          console.log('Student has class assigned, navigating to home screen');
          navigation.replace('StudentHome');
        } else {
          console.log('Student needs to select class');
          // Pass the formattedSchoolCode from the request instead of relying on student data
          fetchAvailableClasses(formattedSchoolCode, newToken);
        }
      } else {
        console.warn('Student data not included in login response');
        navigation.replace('StudentHome'); // Navigate anyway as fallback
      }
    } else {
      console.error('Token not found in login response');
      Alert.alert('Login Error', 'Invalid server response. Please try again later.');
    }
    
  } catch (error) {
    console.error("Login attempt failed with formatted school code");
    handleApiError(error);
  } finally {
    setIsLoading(false);
  }
};

  // Fetch available classes
  const fetchAvailableClasses = async (schoolCode: string, authToken: string) => {
    setIsLoading(true);
    try {
      console.log(`Fetching available classes for school code: ${schoolCode}`);
      const response = await apiClient.get(
        `/api/student/available-classes/${schoolCode}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }
      );
      
      if (response.data && Array.isArray(response.data)) {
        console.log(`Found ${response.data.length} classes`);
        setAvailableClasses(response.data);
        setShowClassModal(true);
      } else {
        console.warn('Unexpected response format from available-classes endpoint');
        Alert.alert("Error", "Could not retrieve available classes. Please contact support.");
      }
    } catch (error) {
      console.error('Error fetching available classes:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle class selection
  const handleClassSelection = async (classId: string) => {
    if (!token) {
      console.error('No token available for class selection');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log(`Selecting class with id: ${classId}`);
      const response = await apiClient.post(
        '/api/student/select-class',
        { classId },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.data && response.data.classDetails) {
        console.log('Class selected successfully:', response.data.classDetails);
        
        // Update student data with class information
        if (studentData) {
          const updatedStudentData = {
            ...studentData,
            hasClass: true,
            classId: response.data.classDetails.id
          };
          await AsyncStorage.setItem('studentData', JSON.stringify(updatedStudentData));
          console.log('Updated student data saved');
        }
        
        // Close modal and navigate to home screen
        setShowClassModal(false);
        navigation.replace('StudentHome');
      } else {
        console.warn('Unexpected response format from select-class endpoint');
        Alert.alert("Error", "Could not complete class selection. Please try again.");
      }
    } catch (error) {
      console.error('Error selecting class:', error);
      handleApiError(error);
    } finally {
      setIsLoading(false);
    }
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
                onPress={() => navigation.navigate('RoleSelection')}
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
                <Text style={styles.title}>Student</Text>
                <Text style={styles.subtitle}>Login</Text>
              </Animated.View>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              <Text style={styles.formLabel}>Email</Text>
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
                onPress={() => Alert.alert("Reset Password", "Please contact your school administrator to reset your password.")}
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.loginButton, 
                  (!isFormValid() || isLoading) && styles.disabledButton
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
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.version}>Version 2.4.1</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Class Selection Modal */}
      <ClassSelectionModal
        visible={showClassModal}
        classes={availableClasses}
        onSelect={handleClassSelection}
        onClose={() => setShowClassModal(false)}
        isLoading={isLoading}
      />
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
  }
});

export default StudentLoginScreen;

// issues to be resolve :
// when student registers hes added to the particular school model using the school code fetch 