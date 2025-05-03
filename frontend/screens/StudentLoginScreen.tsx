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
  KeyboardAvoidingView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState } from 'react';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

type Props = NativeStackScreenProps<RootStackParamList, 'StudentLogin'>;

const StudentLoginScreen: React.FC<Props> = ({ navigation }) => {
  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Form state
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  const [email, setEmail] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Animation states
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);

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

  // Login function
  const handleLogin = () => {
    console.log('Student login with:', { name, className, section, email, schoolCode, uniqueId, password }), navigation.navigate('StudentHome');
    // Add login logic here
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
              <Text style={styles.formLabel}>Name</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="user" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#B0B7C3"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.rowContainer}>
                <View style={styles.halfColumn}>
                  <Text style={styles.formLabel}>Class</Text>
                  <View style={styles.inputContainer}>
                    <FontAwesome5 name="school" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input}
                      placeholder="Class"
                      placeholderTextColor="#B0B7C3"
                      value={className}
                      onChangeText={setClassName}
                    />
                  </View>
                </View>
                
                <View style={styles.halfColumn}>
                  <Text style={styles.formLabel}>Section</Text>
                  <View style={styles.inputContainer}>
                    <FontAwesome5 name="list-alt" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput 
                      style={styles.input}
                      placeholder="Section"
                      placeholderTextColor="#B0B7C3"
                      value={section}
                      onChangeText={setSection}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.formLabel}>Email (optional)</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="envelope" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#B0B7C3"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <Text style={styles.formLabel}>School Code</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="building" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Enter school code"
                  placeholderTextColor="#B0B7C3"
                  value={schoolCode}
                  onChangeText={setSchoolCode}
                />
              </View>

              <Text style={styles.formLabel}>Unique ID</Text>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="id-card" size={16} color="#8A94A6" style={styles.inputIcon} />
                <TextInput 
                  style={styles.input}
                  placeholder="Enter your unique ID"
                  placeholderTextColor="#B0B7C3"
                  value={uniqueId}
                  onChangeText={setUniqueId}
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
                  onChangeText={setPassword}
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
                onPress={() => console.log('Forgot password')}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
              >
                <LinearGradient
                  colors={['#4E54C8', '#8F94FB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginGradient}
                >
                  <Text style={styles.loginButtonText}>Login</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.createAccountContainer}>
                <Text style={styles.createAccountText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('StudentSignup')}>
                  <Text style={styles.createAccountLink}>Create new</Text>
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
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfColumn: {
    width: '48%',
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

export default StudentLoginScreen;