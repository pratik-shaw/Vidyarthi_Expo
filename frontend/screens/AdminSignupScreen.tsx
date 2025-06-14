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

import { API_BASE_URL} from '../config/api';

// API URL with configurable timeout
const API_URL = API_BASE_URL; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout

// Create an axios instance with timeout configuration
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
});

type Props = NativeStackScreenProps<RootStackParamList, 'AdminSignup'>;

const AdminSignupScreen: React.FC<Props> = ({ navigation }) => {
  // State for form inputs
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  // Network status
  const [isConnected, setIsConnected] = useState(true);

  // Refs for input fields (for focus management)
  const fullNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const schoolCodeRef = useRef<TextInput>(null);
  const schoolNameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // Animation values
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

  // Run entry animations the first time the component renders
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
    if (!fullName || !email || !schoolCode || !schoolName || !password || !confirmPassword) return false;
    if (password !== confirmPassword) return false;
    if (!acceptedTerms) return false;
    if (!isEmailValid()) return false;
    if (!isPasswordValid()) return false;
    return true;
  };

  // Password validation check
  const isPasswordValid = () => {
    return password.length >= 8;
  };

  // Email validation check
  const isEmailValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Show detailed error if API call fails
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
      if (error.code === 'ECONNABORTED') {
        Alert.alert(
          "Connection Timeout", 
          "The server took too long to respond. Please check your API URL and try again. Make sure your server is running at " + API_URL
        );
      } else if (error.response) {
        // Server responded with error status code
        Alert.alert(
          "Registration Failed", 
          error.response.data?.message || `Server error (${error.response.status}). Please try again.`
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

  // Clear AsyncStorage for debugging if needed
  const clearStorageAndRetry = async () => {
    try {
      await AsyncStorage.multiRemove(['token', 'userRole', 'adminData']);
      console.log('AsyncStorage cleared');
      Alert.alert('Storage Cleared', 'Please try again');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  // Handle signup
  const handleSignup = async () => {
    if (!isFormValid()) {
      let errorMessage = "Please fill all required fields";
      
      if (!isEmailValid()) {
        errorMessage = "Please enter a valid email address";
      } else if (!isPasswordValid()) {
        errorMessage = "Password must be at least 8 characters long";
      } else if (password !== confirmPassword) {
        errorMessage = "Passwords do not match";
      } else if (!acceptedTerms) {
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
      console.log('Attempting registration with:', { fullName, email, schoolCode, schoolName });
      
      // Remove health check attempt since endpoint doesn't exist
      // Directly proceed to registration

      // Call the API to register admin
      const response = await apiClient.post('/admin/register', {
        name: fullName,
        email,
        password,
        schoolName,
        schoolCode
      });

      console.log('Registration response received:', {
        status: response.status,
        hasToken: !!response.data?.token,
      });

      // If registration is successful, save the token to AsyncStorage (optional, can navigate to Login instead)
      if (response.data && response.data.token) {
        try {
          // Clear any existing data first
          await AsyncStorage.multiRemove(['token', 'userRole', 'adminData']);
          
          // Save the token
          await AsyncStorage.setItem('token', response.data.token);
          console.log('Token saved to AsyncStorage');
          
          // Save the user role
          await AsyncStorage.setItem('userRole', 'admin');
          console.log('User role saved to AsyncStorage');
          
          Alert.alert(
            "Success", 
            "Account created successfully!",
            [
              { 
                text: "OK", 
                onPress: () => navigation.navigate('AdminLogin') 
              }
            ]
          );
        } catch (storageError) {
          console.error('Error saving auth data:', storageError);
          Alert.alert(
            "Storage Error", 
            "Failed to save login information. You can still log in with your new account.",
            [
              { text: "OK", onPress: () => navigation.navigate('AdminLogin') },
              { text: "Clear Storage & Retry", onPress: clearStorageAndRetry }
            ]
          );
        }
      } else {
        // Even if no token is returned, the account might have been created
        console.log('Registration successful, but no token returned');
        Alert.alert(
          "Success", 
          "Account created successfully. Please login with your new credentials.",
          [
            { 
              text: "OK", 
              onPress: () => navigation.navigate('AdminLogin') 
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
                <Text style={styles.title}>Administrator</Text>
                <Text style={styles.subtitle}>Sign Up</Text>
              </Animated.View>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              <Text style={styles.formLabel}>Full Name</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="user" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  ref={fullNameRef}
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#B0B7C3"
                  value={fullName}
                  onChangeText={setFullName}
                  onSubmitEditing={() => emailRef.current?.focus()}
                  returnKeyType="next"
                  editable={!isLoading}
                  autoComplete="name"
                />
              </View>

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
                  onSubmitEditing={() => schoolNameRef.current?.focus()}
                  returnKeyType="next"
                  editable={!isLoading}
                  autoComplete="off"
                />
              </View>

              <Text style={styles.formLabel}>School Name</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="school" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput
                  ref={schoolNameRef}
                  style={styles.input}
                  placeholder="Enter school name"
                  placeholderTextColor="#B0B7C3"
                  value={schoolName}
                  onChangeText={setSchoolName}
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
                  placeholder="Create a password (min 8 characters)"
                  placeholderTextColor="#B0B7C3"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  returnKeyType="next"
                  editable={!isLoading}
                  autoComplete="off"
                  textContentType="oneTimeCode" // This prevents iOS from suggesting auto-fill
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <Feather name={showPassword ? "eye" : "eye-off"} size={18} color="#8A94A6" />
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Confirm Password</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="lock" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  ref={confirmPasswordRef}
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor="#B0B7C3"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  returnKeyType="done"
                  editable={!isLoading}
                  autoComplete="off"
                  textContentType="oneTimeCode" // This prevents iOS from suggesting auto-fill
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={18} color="#8A94A6" />
                </TouchableOpacity>
              </View>

              {/* Terms and Conditions Checkbox */}
              <TouchableOpacity 
                style={styles.termsContainer}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                disabled={isLoading}
              >
                <View style={styles.checkbox}>
                  {acceptedTerms && (
                    <Ionicons name="checkmark" size={16} color="#4E54C8" />
                  )}
                </View>
                <Text style={styles.termsText}>
                  I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>

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
                <Text style={styles.loginText}>
                  Already have an account? 
                </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate('AdminLogin')}
                  disabled={isLoading}
                >
                  <Text style={styles.loginLink}>
                    Login
                  </Text>
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
                    "Contact admin@vidyarthi.app for assistance",
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
    otpButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: 'rgba(78, 84, 200, 0.1)',
      borderRadius: 12,
      marginBottom: 20,
    },
    otpIcon: {
      marginRight: 8,
    },
    otpButtonText: {
      fontSize: 14,
      color: '#4E54C8',
      fontWeight: '600',
    },
    resendButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: 'rgba(78, 84, 200, 0.1)',
    },
    resendText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#4E54C8',
    },
    termsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      marginTop: 5,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#4E54C8',
      marginRight: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    termsText: {
      fontSize: 14,
      color: '#8A94A6',
      flex: 1,
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
  
  export default AdminSignupScreen;

