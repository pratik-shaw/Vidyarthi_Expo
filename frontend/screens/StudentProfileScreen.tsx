// StudentProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  TextInput,
  Modal,
  KeyboardAvoidingView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';

import { STUDENT_API } from '../config/api';

// API configuration
const API_URL = STUDENT_API;
const API_TIMEOUT = 15000;

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

const PRIMARY_COLOR = '#4F46E5';

interface StudentData {
  _id: string;
  name: string;
  email: string;
  phone: string;
  studentId: string;
  uniqueId: string;
  schoolCode: string;
  schoolId: string;
  classId?: string;
  className: string;
  section: string;
  profileImage?: string;
  admissionDate?: string;
  dateOfBirth?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
}

interface EditableFields {
  dateOfBirth: string;
  address: string;
  admissionDate: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
}

const StudentProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isLoading, setIsLoading] = useState(true);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editableFields, setEditableFields] = useState<EditableFields>({
    dateOfBirth: '',
    address: '',
    admissionDate: '',
    parentName: '',
    parentPhone: '',
    parentEmail: ''
  });

  useEffect(() => {
    // Set up navigation options
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'My Profile',
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#3A4276',
      },
      headerStyle: {
        backgroundColor: '#F8F9FC',
      },
      headerShadowVisible: false,
      headerLeft: () => (
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#3A4276" />
        </TouchableOpacity>
      ),
      // headerRight: () => (
      //   <TouchableOpacity 
      //     style={styles.headerButton}
      //     onPress={handleEditProfile}
      //   >
      //     <Feather name="edit-2" size={20} color={PRIMARY_COLOR} />
      //   </TouchableOpacity>
      // ),
    });

    // Check network connectivity
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      if (state.isConnected && !isLoading && error) {
        fetchStudentData();
      }
    });

    // Fetch student data on mount
    fetchStudentData();

    return () => {
      unsubscribe();
    };
  }, [navigation]);

  const fetchStudentData = async () => {
    if (!isConnected) {
      setError("You're offline. Please check your internet connection.");
      setIsLoading(false);
      return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
      // First try to get data from storage
      const storedData = await AsyncStorage.getItem('studentData');
      if (storedData) {
        const data = JSON.parse(storedData);
        setStudentData(data);
        populateEditableFields(data);
      }

      // Then try to get latest data from API
      const response = await apiClient.get('/api/student/profile');
      
      if (response.data) {
        // Update state with fresh data
        setStudentData(response.data);
        populateEditableFields(response.data);
        
        // Update storage with fresh data
        await AsyncStorage.setItem('studentData', JSON.stringify(response.data));
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching student profile:', error);
      
      // If we failed to fetch but have stored data, don't show error
      if (studentData) {
        setIsLoading(false);
        return;
      }

      // Otherwise handle the error
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleUnauthorizedError();
        } else {
          setError(error.response?.data?.message || "Couldn't fetch profile data.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
      
      setIsLoading(false);
    }
  };

  const populateEditableFields = (data: StudentData) => {
    setEditableFields({
      dateOfBirth: data.dateOfBirth ? formatDateForInput(data.dateOfBirth) : '',
      address: data.address || '',
      admissionDate: data.admissionDate ? formatDateForInput(data.admissionDate) : '',
      parentName: data.parentName || '',
      parentPhone: data.parentPhone || '',
      parentEmail: data.parentEmail || ''
    });
  };

  const handleUnauthorizedError = async () => {
    try {
      await AsyncStorage.multiRemove(['studentToken', 'studentData']);
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please log in again.",
        [{ text: "OK", onPress: () => navigation.replace('StudentLogin') }]
      );
    } catch (err) {
      console.error("Error clearing storage:", err);
      navigation.replace('StudentLogin');
    }
  };

  const handleEditProfile = () => {
    setIsEditModalVisible(true);
  };

  const handleUpdateProfile = async () => {
    if (!isConnected) {
      Alert.alert("No Internet", "Please check your internet connection and try again.");
      return;
    }

    setIsUpdating(true);

    try {
      // Prepare update data
      const updateData = {
        dateOfBirth: editableFields.dateOfBirth.trim(),
        address: editableFields.address.trim(),
        admissionDate: editableFields.admissionDate.trim(),
        parentName: editableFields.parentName.trim(),
        parentPhone: editableFields.parentPhone.trim(),
        parentEmail: editableFields.parentEmail.trim()
      };

      const response = await apiClient.put('/api/student/profile', updateData);
      
      if (response.data && response.data.student) {
        // Update local state
        setStudentData(response.data.student);
        
        // Update storage
        await AsyncStorage.setItem('studentData', JSON.stringify(response.data.student));
        
        // Close modal
        setIsEditModalVisible(false);
        
        Alert.alert("Success", "Profile updated successfully!");
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleUnauthorizedError();
        } else {
          Alert.alert("Error", error.response?.data?.message || "Failed to update profile. Please try again.");
        }
      } else {
        Alert.alert("Error", "An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove(['studentToken', 'studentData']);
              navigation.reset({
                index: 0,
                routes: [{ name: 'RoleSelection' }],
              });
            } catch (error) {
              console.error("Error during logout:", error);
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          }
        }
      ]
    );
  };

  // Helper function to format date
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Not Available';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Helper function to format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      return '';
    }
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    if (!email.trim()) return true; // Empty email is allowed
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate date format
  const isValidDate = (dateString: string): boolean => {
    if (!dateString.trim()) return true; // Empty date is allowed
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };

  const validateFields = (): boolean => {
    if (editableFields.parentEmail && !isValidEmail(editableFields.parentEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid parent email address.");
      return false;
    }

    if (editableFields.dateOfBirth && !isValidDate(editableFields.dateOfBirth)) {
      Alert.alert("Invalid Date", "Please enter a valid date of birth.");
      return false;
    }

    if (editableFields.admissionDate && !isValidDate(editableFields.admissionDate)) {
      Alert.alert("Invalid Date", "Please enter a valid admission date.");
      return false;
    }

    // Check if date of birth is not in the future
    if (editableFields.dateOfBirth) {
      const birthDate = new Date(editableFields.dateOfBirth);
      if (birthDate > new Date()) {
        Alert.alert("Invalid Date", "Date of birth cannot be in the future.");
        return false;
      }
    }

    return true;
  };

  if (isLoading && !studentData) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </SafeAreaView>
    );
  }

  if (error && !studentData) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="cloud-offline" size={60} color="#8A94A6" />
        <Text style={styles.errorTitle}>Connection Problem</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={fetchStudentData}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Default values if studentData is missing
  const student = studentData || {
    _id: '',
    name: 'Student Name',
    email: 'email@example.com',
    phone: 'Not Available',
    studentId: 'Not Available',
    uniqueId: 'Not Available',
    schoolCode: 'Not Available',
    schoolId: '',
    className: 'Not Available',
    section: '',
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Profile Header Section */}
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            <Image 
              source={student.profileImage 
                ? { uri: student.profileImage } 
                : require('../assets/images/default-profile.png')} 
              style={styles.profileImage}
            />
            <TouchableOpacity style={styles.cameraButton}>
              <Feather name="camera" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.studentClass}>
            {student.className} {student.section}
          </Text>
          
          <View style={styles.idContainer}>
            <Text style={styles.idLabel}>Student ID:</Text>
            <Text style={styles.idValue}>{student.studentId}</Text>
          </View>
        </View>
        
        {/* Personal Information Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          
          <View style={styles.infoCard}>
            <InfoRow
              icon="mail"
              label="Email"
              value={student.email}
            />
            <InfoRow
              icon="phone"
              label="Phone Number"
              value={student.phone}
            />
            <InfoRow
              icon="calendar"
              label="Date of Birth"
              value={formatDate(student.dateOfBirth)}
              isEditable
            />
            <InfoRow
              icon="map-pin"
              label="Address"
              value={student.address || 'Not Available'}
              isLast
              isEditable
            />
          </View>
        </View>
        
        {/* Academic Information */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Academic Information</Text>
          </View>
          
          <View style={styles.infoCard}>
            <InfoRow
              icon="bookmark"
              label="School Code"
              value={student.schoolCode}
            />
            <InfoRow
              icon="users"
              label="Class"
              value={`${student.className} ${student.section}`}
            />
            <InfoRow
              icon="hash"
              label="Unique ID"
              value={student.uniqueId}
            />
            <InfoRow
              icon="calendar"
              label="Admission Date"
              value={formatDate(student.admissionDate)}
              isLast
              isEditable
            />
          </View>
        </View>
        
        {/* Parent Information */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Parent Information</Text>
          </View>
          
          <View style={styles.infoCard}>
            <InfoRow
              icon="user"
              label="Parent Name"
              value={student.parentName || 'Not Available'}
              isEditable
            />
            <InfoRow
              icon="phone"
              label="Parent Phone"
              value={student.parentPhone || 'Not Available'}
              isEditable
            />
            <InfoRow
              icon="mail"
              label="Parent Email"
              value={student.parentEmail || 'Not Available'}
              isLast
              isEditable
            />
          </View>
        </View>
        
        {/* Account Actions */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          
          <View style={styles.actionsCard}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleEditProfile}
            >
              <Feather name="edit-2" size={20} color={PRIMARY_COLOR} style={styles.actionIcon} />
              <Text style={styles.actionText}>Edit Profile</Text>
              <Feather name="chevron-right" size={20} color="#8A94A6" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
            >
              <Feather name="lock" size={20} color={PRIMARY_COLOR} style={styles.actionIcon} />
              <Text style={styles.actionText}>Change Password</Text>
              <Feather name="chevron-right" size={20} color="#8A94A6" />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.lastAction]}
              onPress={handleLogout}
            >
              <Feather name="log-out" size={20} color="#FF6B6B" style={styles.actionIcon} />
              <Text style={styles.logoutText}>Logout</Text>
              <Feather name="chevron-right" size={20} color="#8A94A6" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* App Version */}
        <Text style={styles.versionText}>Student Portal v2.4.1</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            style={styles.modalContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>Edit Profile</Text>
              
              <TouchableOpacity
                onPress={() => {
                  if (validateFields()) {
                    handleUpdateProfile();
                  }
                }}
                style={styles.modalSaveButton}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Date of Birth */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date of Birth</Text>
                <TextInput
                  style={styles.textInput}
                  value={editableFields.dateOfBirth}
                  onChangeText={(text) => setEditableFields(prev => ({...prev, dateOfBirth: text}))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#8A94A6"
                />
              </View>

              {/* Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  value={editableFields.address}
                  onChangeText={(text) => setEditableFields(prev => ({...prev, address: text}))}
                  placeholder="Enter your address"
                  placeholderTextColor="#8A94A6"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Admission Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Admission Date</Text>
                <TextInput
                  style={styles.textInput}
                  value={editableFields.admissionDate}
                  onChangeText={(text) => setEditableFields(prev => ({...prev, admissionDate: text}))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#8A94A6"
                />
              </View>

              {/* Parent Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Parent Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={editableFields.parentName}
                  onChangeText={(text) => setEditableFields(prev => ({...prev, parentName: text}))}
                  placeholder="Enter parent's name"
                  placeholderTextColor="#8A94A6"
                />
              </View>

              {/* Parent Phone */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Parent Phone</Text>
                <TextInput
                  style={styles.textInput}
                  value={editableFields.parentPhone}
                  onChangeText={(text) => setEditableFields(prev => ({...prev, parentPhone: text}))}
                  placeholder="Enter parent's phone number"
                  placeholderTextColor="#8A94A6"
                  keyboardType="phone-pad"
                />
              </View>

              {/* Parent Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Parent Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={editableFields.parentEmail}
                  onChangeText={(text) => setEditableFields(prev => ({...prev, parentEmail: text}))}
                  placeholder="Enter parent's email"
                  placeholderTextColor="#8A94A6"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// Component for consistent info rows
interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
  isLast?: boolean;
  isEditable?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, isLast, isEditable }) => (
  <View style={[styles.infoRow, isLast ? {} : styles.infoRowBorder]}>
    <Feather name={icon as any} size={18} color={PRIMARY_COLOR} style={styles.infoIcon} />
    <View style={styles.infoContent}>
      <View style={styles.infoLabelContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    backgroundColor: '#E1E5F2',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  studentName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 4,
  },
  studentClass: {
    fontSize: 16,
    color: '#8A94A6',
    marginBottom: 10,
  },
  idContainer: {
    flexDirection: 'row',
    backgroundColor: '#EFF0F7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  idLabel: {
    fontSize: 13,
    color: '#8A94A6',
    marginRight: 4,
  },
  idValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A4276',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFF0F7',
  },
  infoIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A4276',
    marginRight: 6,
  },
  infoValue: {
    fontSize: 15,
    color: '#8A94A6',
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF0F7',
  },
  lastAction: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    marginRight: 16,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#3A4276',
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    color: '#FF6B6B',
  },
  versionText: {
    fontSize: 12,
    color: '#B0B7C3',
    textAlign: 'center',
    marginTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#3A4276',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 30,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFF0F7',
    backgroundColor: '#FFFFFF',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#8A94A6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  modalSaveButton: {
    padding: 8,
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  modalScrollView: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  inputGroup: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3A4276',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#3A4276',
    borderWidth: 1,
    borderColor: '#EFF0F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
});

export default StudentProfileScreen;