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
    Alert
  } from 'react-native';
  import { NativeStackScreenProps } from '@react-navigation/native-stack';
  import { RootStackParamList } from '../App';
  import React, { useEffect, useState, useRef } from 'react';
  import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
  import { LinearGradient } from 'expo-linear-gradient';
  
  type Props = NativeStackScreenProps<RootStackParamList, 'AdminSignup'>;
  
  const AdminSignupScreen: React.FC<Props> = ({ navigation }) => {
    // State for form inputs
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [schoolCode, setSchoolCode] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isOtpSent, setIsOtpSent] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
  
    // Refs for input fields (for focus management)
    const fullNameRef = useRef<TextInput>(null);
    const emailRef = useRef<TextInput>(null);
    const schoolCodeRef = useRef<TextInput>(null);
    const schoolNameRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);
    const confirmPasswordRef = useRef<TextInput>(null);
    const otpRef = useRef<TextInput>(null);
  
    // Animation values
    const fadeAnim = new Animated.Value(0);
    const slideAnim = new Animated.Value(30);
  
    // Hide the header
    React.useLayoutEffect(() => {
      navigation.setOptions({
        headerShown: false,
      });
    }, [navigation]);
  
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
    }, []);
  
    // Form validation
    const isFormValid = () => {
      if (!fullName || !email || !schoolCode || !schoolName || !password || !confirmPassword) return false;
      if (password !== confirmPassword) return false;
      if (isOtpSent && !otp) return false;
      if (!acceptedTerms) return false;
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
  
    // Handle send OTP
    const handleSendOtp = () => {
      if (!email || !isEmailValid()) {
        Alert.alert("Error", "Please enter a valid email address to receive OTP");
        return;
      }
      // Simulate OTP send
      setIsOtpSent(true);
      Alert.alert("Success", "OTP has been sent to your email");
    };
  
    // Handle signup
    const handleSignup = () => {
      if (!isFormValid()) {
        Alert.alert("Error", "Please fill all required fields");
        return;
      }
  
      if (password !== confirmPassword) {
        Alert.alert("Error", "Passwords do not match");
        return;
      }
  
      if (!isPasswordValid()) {
        Alert.alert("Error", "Password must be at least 8 characters long");
        return;
      }
  
      // Signup logic would go here
      Alert.alert("Success", "Account created successfully! Please check your email to verify your account.");
      navigation.navigate('AdminLogin');
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
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
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
                    returnKeyType={isOtpSent ? "next" : "done"}
                    onSubmitEditing={() => {
                      if (isOtpSent) {
                        otpRef.current?.focus();
                      }
                    }}
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={18} color="#8A94A6" />
                  </TouchableOpacity>
                </View>
  
                {/* OTP Section */}
                {isOtpSent ? (
                  <>
                    <Text style={styles.formLabel}>OTP Code</Text>
                    <View style={styles.inputContainer}>
                      <FontAwesome5 name="key" size={16} color="#8A94A6" style={styles.inputIcon} />
                      <TextInput
                        ref={otpRef}
                        style={styles.input}
                        placeholder="Enter OTP sent to your email"
                        placeholderTextColor="#B0B7C3"
                        keyboardType="number-pad"
                        value={otp}
                        onChangeText={setOtp}
                        returnKeyType="done"
                      />
                      <TouchableOpacity 
                        style={styles.resendButton}
                        onPress={handleSendOtp}
                      >
                        <Text style={styles.resendText}>Resend</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity 
                    style={styles.otpButton}
                    onPress={handleSendOtp}
                  >
                    <FontAwesome5 name="shield-alt" size={16} color="#4E54C8" style={styles.otpIcon} />
                    <Text style={styles.otpButtonText}>Send OTP for verification</Text>
                  </TouchableOpacity>
                )}
  
                {/* Terms and Conditions Checkbox */}
                <TouchableOpacity 
                  style={styles.termsContainer}
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
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
                    !isFormValid() && styles.signupButtonDisabled
                  ]}
                  onPress={handleSignup}
                  disabled={!isFormValid()}
                >
                  <LinearGradient
                    colors={['#4E54C8', '#8F94FB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signupGradient}
                  >
                    <Text style={styles.signupButtonText}>Create Account</Text>
                  </LinearGradient>
                </TouchableOpacity>
  
                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>
                    Already have an account? 
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('AdminLogin')}>
                    <Text style={styles.loginLink}>
                      Login
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
  
              {/* Footer */}
              <View style={styles.footer}>
                <TouchableOpacity style={styles.helpButton}>
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