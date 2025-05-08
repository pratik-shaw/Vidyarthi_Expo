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

// UPDATED: API URL configuration
const API_URL = 'http://192.168.29.148:5000'; // Remove the '/api' part
const API_TIMEOUT = 15000; // 15 seconds timeout

// Create an axios instance with timeout configuration
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  }
});

type Props = NativeStackScreenProps<RootStackParamList, 'StudentSignup'>;

const StudentSignupScreen: React.FC<Props> = ({ navigation }) => {
  // Form state
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Input refs for focus management
  const nameRef = useRef<TextInput>(null);
  const classNameRef = useRef<TextInput>(null);
  const sectionRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneNumberRef = useRef<TextInput>(null);
  const schoolCodeRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Animation states
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
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

  // Email validation
  const isEmailValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !email || emailRegex.test(email); // Empty is ok since email is optional
  };

  // Password validation
  const isPasswordValid = () => {
    return password.length >= 8;
  };

  // Form validation
  const isFormValid = () => {
    if (!name || !schoolCode || !password || !confirmPassword || !email) return false;
    if (password !== confirmPassword) return false;
    if (!acceptTerms) return false;
    if (email && !isEmailValid()) return false;
    if (!isPasswordValid()) return false;
    return true;
  };

  // Handle API errors
  // Enhanced error handling
const handleApiError = (error: any) => {
  console.error("Signup error:", error);
  
  if (!isConnected) {
    Alert.alert(
      "Network Error", 
      "You appear to be offline. Please check your internet connection and try again."
    );
    return;
  }
  
  if (axios.isAxiosError(error)) {
    // Log detailed response information for debugging
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    }
    
    if (error.code === 'ECONNABORTED') {
      Alert.alert(
        "Connection Timeout", 
        "The server took too long to respond. Please check your API URL and try again. Make sure your server is running at " + API_URL
      );
    } else if (error.response) {
      // Server responded with error status code
      const errorMessage = error.response.data?.message || `Server error (${error.response.status}).`;
      Alert.alert(
        "Registration Failed", 
        `${errorMessage} Please try again.`
      );
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

  // Create a unique student ID
  const generateStudentId = () => {
    return (className && section) ? 
      className + section + Math.floor(100 + Math.random() * 900).toString() : 
      "STD" + Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Clear AsyncStorage for debugging if needed
  const clearStorageAndRetry = async () => {
    try {
      await AsyncStorage.multiRemove(['authToken', 'userType', 'userData']);
      console.log('AsyncStorage cleared');
      Alert.alert('Storage Cleared', 'Please try again');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  // Signup function
  // Fix for the API endpoint in StudentSignupScreen.tsx
const handleSignup = async () => {
  if (!isFormValid()) {
    let errorMessage = "Please fill all required fields";
    
    if (email && !isEmailValid()) {
      errorMessage = "Please enter a valid email address";
    } else if (!isPasswordValid()) {
      errorMessage = "Password must be at least 8 characters long";
    } else if (password !== confirmPassword) {
      errorMessage = "Passwords do not match";
    } else if (!acceptTerms) {
      errorMessage = "You must accept the Terms of Service";
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
    const studentId = generateStudentId();
    const uniqueId = `STD${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
    
    // Create the payload object
    const payload = {
      name,
      email,
      phone: phoneNumber,
      studentId,
      uniqueId,
      schoolCode,
      password
    };
    
    console.log('Attempting student registration with:', payload);
    
    // UPDATED: Use the correct API endpoint
    const response = await apiClient.post('/api/student/register', payload);

    console.log('Registration response received:', {
      status: response.status,
      data: response.data,  // Log the full response data
      hasToken: !!response.data?.token,
    });

    // If registration is successful
    if (response.data) {
      if (response.data.token) {
        try {
          // Clear any existing data first
          await AsyncStorage.multiRemove(['authToken', 'userType', 'userData']);
          
          // Save the token
          await AsyncStorage.setItem('authToken', response.data.token);
          console.log('Token saved to AsyncStorage');
          
          // Save the user type
          await AsyncStorage.setItem('userType', 'student');
          console.log('User type saved to AsyncStorage');
          
          // Save user data if available
          if (response.data.student) {
            await AsyncStorage.setItem('userData', JSON.stringify(response.data.student));
            console.log('User data saved to AsyncStorage');
          }
        } catch (storageError) {
          console.error('Error saving auth data:', storageError);
        }
      }
      
      Alert.alert(
        "Success", 
        "Student account created successfully!",
        [
          { 
            text: "OK", 
            onPress: () => navigation.navigate('StudentLogin')
          }
        ]
      );
    }
  } catch (error) {
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
                <Text style={styles.title}>Student</Text>
                <Text style={styles.subtitle}>Signup</Text>
              </Animated.View>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              <Text style={styles.formLabel}>Full Name <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="user" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  ref={nameRef}
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#B0B7C3"
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={() => classNameRef.current?.focus()}
                  returnKeyType="next"
                  editable={!isLoading}
                  autoComplete="name"
                />
              </View>

              <View style={styles.rowContainer}>
                <View style={styles.halfColumn}>
                  <Text style={styles.formLabel}>Class</Text>
                  <View style={styles.inputContainer}>
                    <FontAwesome5 name="school" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput 
                      ref={classNameRef}
                      style={styles.input}
                      placeholder="Class (optional)"
                      placeholderTextColor="#B0B7C3"
                      value={className}
                      onChangeText={setClassName}
                      onSubmitEditing={() => sectionRef.current?.focus()}
                      returnKeyType="next"
                      editable={!isLoading}
                    />
                  </View>
                </View>
                
                <View style={styles.halfColumn}>
                  <Text style={styles.formLabel}>Section</Text>
                  <View style={styles.inputContainer}>
                    <FontAwesome5 name="list-alt" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput 
                      ref={sectionRef}
                      style={styles.input}
                      placeholder="Section (optional)"
                      placeholderTextColor="#B0B7C3"
                      value={section}
                      onChangeText={setSection}
                      onSubmitEditing={() => emailRef.current?.focus()}
                      returnKeyType="next"
                      editable={!isLoading}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.formLabel}>Email <Text style={styles.required}>*</Text></Text>
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
                  onSubmitEditing={() => phoneNumberRef.current?.focus()}
                  returnKeyType="next"
                  editable={!isLoading}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>

              <Text style={styles.formLabel}>Phone Number</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="phone" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  ref={phoneNumberRef}
                  style={styles.input}
                  placeholder="Enter phone number"
                  placeholderTextColor="#B0B7C3"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  onSubmitEditing={() => schoolCodeRef.current?.focus()}
                  returnKeyType="next"
                  editable={!isLoading}
                  textContentType="telephoneNumber"
                />
              </View>

              <Text style={styles.formLabel}>School Code <Text style={styles.required}>*</Text></Text>
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

              <Text style={styles.formLabel}>Password <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="lock" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="Create password (min 8 characters)"
                  placeholderTextColor="#B0B7C3"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  returnKeyType="next"
                  editable={!isLoading}
                  autoComplete="off"
                  textContentType="oneTimeCode" // Prevents iOS from suggesting auto-fill
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#8A94A6" />
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Confirm Password <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="lock" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  ref={confirmPasswordRef}
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#B0B7C3"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  returnKeyType="done"
                  editable={!isLoading}
                  autoComplete="off"
                  textContentType="oneTimeCode" // Prevents iOS from suggesting auto-fill
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={18} color="#8A94A6" />
                </TouchableOpacity>
              </View>

              <View style={styles.termsContainer}>
                <TouchableOpacity 
                  style={styles.checkbox}
                  onPress={() => setAcceptTerms(!acceptTerms)}
                  disabled={isLoading}
                >
                  {acceptTerms ? (
                    <Ionicons name="checkmark-circle" size={20} color="#4E54C8" />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color="#8A94A6" />
                  )}
                </TouchableOpacity>
                <Text style={styles.termsText}>
                  I accept the <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.signupButton,
                  (!isFormValid() || isLoading) && styles.signupButtonDisabled
                ]}
                onPress={handleSignup}
                disabled={!isFormValid() || isLoading}
              >
                <LinearGradient
                  colors={['#4E54C8', '#8F94FB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.signupGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.signupButtonText}>Create Account</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('StudentLogin')}
                  disabled={isLoading}
                >
                  <Text style={styles.loginLink}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity 
                style={styles.helpButton}
                onPress={() => {
                  Alert.alert(
                    "Support",
                    "Contact support@vidyarthi.app for assistance",
                    [{ text: "OK" }]
                  );
                }}
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
  required: {
    color: '#FF5858',
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
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfColumn: {
    width: '48%',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  checkbox: {
    marginRight: 10,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#8A94A6',
  },
  termsLink: {
    color: '#4E54C8',
    fontWeight: '600',
  },
  signupButton: {
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
  signupButtonDisabled: {
    opacity: 0.7,
  },
  signupGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    color: '#8A94A6',
  },
  loginLink: {
    fontSize: 14,
    color: '#4E54C8',
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
  
export default StudentSignupScreen;