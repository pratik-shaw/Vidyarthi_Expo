import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../config/api';

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherProfile'>;

// Define interfaces - Only fields shown in Admin Data
interface Teacher {
  _id: string;
  name: string;
  email: string;
  teacherId?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  subjects?: string[];
  joiningDate?: string;
  qualification?: string;
  experience?: number;
  status?: 'active' | 'inactive';
}

interface FormData {
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  subjects: string[];
  qualification: string;
  experience: string;
  status: 'active' | 'inactive';
}

const TeacherProfileScreen: React.FC<Props> = ({ navigation }) => {
  // States
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState<FormData>({
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    subjects: [],
    qualification: '',
    experience: '',
    status: 'active',
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Available subjects list
  const availableSubjects = [
    'Mathematics', 'English', 'Science', 'History', 'Geography',
    'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Art',
    'Music', 'Physical Education', 'Social Studies', 'Economics',
    'Psychology', 'Philosophy', 'Literature', 'Statistics'
  ];

  useEffect(() => {
    loadTeacherProfile();
  }, []);

  // Get authenticated API client
  const getAuthenticatedClient = async () => {
    const token = await AsyncStorage.getItem('teacherToken');
    return axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-auth-token': token,
        'Content-Type': 'application/json'
      }
    });
  };

  // Load teacher profile
  const loadTeacherProfile = async () => {
    try {
      setLoading(true);
      const apiClient = await getAuthenticatedClient();
      const response = await apiClient.get('/teacher/profile');
      
      const teacherData = response.data.teacher;
      setTeacher(teacherData);
      
      // Populate form data with only admin fields
      setFormData({
        phone: teacherData.phone || '',
        address: teacherData.address || '',
        city: teacherData.city || '',
        state: teacherData.state || '',
        zip: teacherData.zip || '',
        subjects: teacherData.subjects || [],
        qualification: teacherData.qualification || '',
        experience: teacherData.experience?.toString() || '',
        status: teacherData.status || 'active',
      });
    } catch (error) {
      console.error('Error loading teacher profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  // Update profile
  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      
      // Validate required fields
      if (formData.phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(formData.phone.replace(/\s/g, ''))) {
        Alert.alert('Validation Error', 'Please enter a valid phone number');
        return;
      }
      
      if (formData.experience && (parseInt(formData.experience) < 0 || parseInt(formData.experience) > 50)) {
        Alert.alert('Validation Error', 'Experience should be between 0 and 50 years');
        return;
      }

      const apiClient = await getAuthenticatedClient();
      const updateData = {
        ...formData,
        experience: formData.experience ? parseInt(formData.experience) : undefined,
      };

      const response = await apiClient.put('/teacher/profile', updateData);
      
      Alert.alert('Success', 'Profile updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            // Update AsyncStorage with new data
            AsyncStorage.setItem('teacherData', JSON.stringify(response.data.teacher));
            navigation.goBack();
          }
        }
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      if (axios.isAxiosError(error) && error.response?.data?.msg) {
        Alert.alert('Error', error.response.data.msg);
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    try {
      if (!passwordForm.currentPassword || !passwordForm.newPassword) {
        Alert.alert('Error', 'Please fill all password fields');
        return;
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        Alert.alert('Error', 'New passwords do not match');
        return;
      }

      if (passwordForm.newPassword.length < 6) {
        Alert.alert('Error', 'New password must be at least 6 characters long');
        return;
      }

      const apiClient = await getAuthenticatedClient();
      await apiClient.put('/teacher/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      Alert.alert('Success', 'Password updated successfully');
      setPasswordModalVisible(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      if (axios.isAxiosError(error) && error.response?.data?.msg) {
        Alert.alert('Error', error.response.data.msg);
      } else {
        Alert.alert('Error', 'Failed to change password. Please try again.');
      }
    }
  };

  // Add subject
  const handleAddSubject = () => {
    if (newSubject.trim() && !formData.subjects.includes(newSubject.trim())) {
      setFormData(prev => ({
        ...prev,
        subjects: [...prev.subjects, newSubject.trim()]
      }));
      setNewSubject('');
    }
  };

  // Remove subject
  const handleRemoveSubject = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter(s => s !== subject)
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#1CB5E0" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#3A4276" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => setPasswordModalVisible(true)}>
          <Feather name="key" size={20} color="#3A4276" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Non-editable Information */}
          <View style={styles.nonEditableSection}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name:</Text>
                <Text style={styles.infoValue}>{teacher?.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{teacher?.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Teacher ID:</Text>
                <Text style={styles.infoValue}>{teacher?.teacherId || 'Not assigned'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Joining Date:</Text>
                <Text style={styles.infoValue}>
                  {teacher?.joiningDate ? new Date(teacher.joiningDate).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>
                  {formData.status === 'active' ? 'Active' : 'Inactive'}
                </Text>
                <Switch
                  value={formData.status === 'active'}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, status: value ? 'active' : 'inactive' }))
                  }
                  trackColor={{ false: '#E8ECF4', true: '#1CB5E0' }}
                  thumbColor={formData.status === 'active' ? '#FFFFFF' : '#FFFFFF'}
                />
              </View>
            </View>
          </View>

          {/* Address Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.textInput}
                value={formData.address}
                onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
                placeholder="Enter your address"
                multiline
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.city}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, city: text }))}
                  placeholder="Enter city"
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.inputLabel}>ZIP Code</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.zip}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, zip: text }))}
                  placeholder="Enter ZIP code"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.textInput}
                value={formData.state}
                onChangeText={(text) => setFormData(prev => ({ ...prev, state: text }))}
                placeholder="Enter state"
              />
            </View>
          </View>

          {/* Professional Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Qualification</Text>
              <TextInput
                style={styles.textInput}
                value={formData.qualification}
                onChangeText={(text) => setFormData(prev => ({ ...prev, qualification: text }))}
                placeholder="Enter your highest qualification"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Experience (Years)</Text>
              <TextInput
                style={styles.textInput}
                value={formData.experience}
                onChangeText={(text) => setFormData(prev => ({ ...prev, experience: text }))}
                placeholder="Enter years of experience"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Subjects</Text>
              <TouchableOpacity 
                style={styles.subjectsButton}
                onPress={() => setShowSubjectsModal(true)}
              >
                <Text style={styles.subjectsButtonText}>
                  {formData.subjects.length > 0 ? `${formData.subjects.length} subjects selected` : 'Select subjects'}
                </Text>
                <Feather name="chevron-right" size={20} color="#8A94A6" />
              </TouchableOpacity>
              {formData.subjects.length > 0 && (
                <View style={styles.selectedItems}>
                  {formData.subjects.map((subject) => (
                    <View key={subject} style={styles.itemTag}>
                      <Text style={styles.itemTagText}>{subject}</Text>
                      <TouchableOpacity onPress={() => handleRemoveSubject(subject)}>
                        <Feather name="x" size={14} color="#8A94A6" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity 
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleUpdateProfile}
            disabled={saving}
          >
            <LinearGradient
              colors={saving ? ['#B0B7C3', '#B0B7C3'] : ['#1CB5E0', '#38EF7D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButtonGradient}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="save" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Profile</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Subjects Modal */}
      <Modal
        visible={showSubjectsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSubjectsModal(false)}>
              <Feather name="x" size={24} color="#3A4276" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Subjects</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.addItemContainer}>
              <TextInput
                style={styles.addItemInput}
                value={newSubject}
                onChangeText={setNewSubject}
                placeholder="Add custom subject"
              />
              <TouchableOpacity 
                style={styles.addItemButton}
                onPress={handleAddSubject}
              >
                <Feather name="plus" size={20} color="#1CB5E0" />
              </TouchableOpacity>
            </View>
            
            {availableSubjects.map((subject) => (
              <TouchableOpacity
                key={subject}
                style={[
                  styles.itemOption,
                  formData.subjects.includes(subject) && styles.itemOptionSelected
                ]}
                onPress={() => {
                  if (formData.subjects.includes(subject)) {
                    handleRemoveSubject(subject);
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      subjects: [...prev.subjects, subject]
                    }));
                  }
                }}
              >
                <Text style={[
                  styles.itemOptionText,
                  formData.subjects.includes(subject) && styles.itemOptionTextSelected
                ]}>
                  {subject}
                </Text>
                {formData.subjects.includes(subject) && (
                  <Feather name="check" size={20} color="#1CB5E0" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
              <Feather name="x" size={24} color="#3A4276" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Password</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.textInput}
                value={passwordForm.currentPassword}
                onChangeText={(text) => setPasswordForm(prev => ({ ...prev, currentPassword: text }))}
                placeholder="Enter current password"
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.textInput}
                value={passwordForm.newPassword}
                onChangeText={(text) => setPasswordForm(prev => ({ ...prev, newPassword: text }))}
                placeholder="Enter new password (min 6 characters)"
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.textInput}
                value={passwordForm.confirmPassword}
                onChangeText={(text) => setPasswordForm(prev => ({ ...prev, confirmPassword: text }))}
                placeholder="Confirm new password"
                secureTextEntry
              />
            </View>

            <TouchableOpacity 
              style={styles.changePasswordButton}
              onPress={handleChangePassword}
            >
              <LinearGradient
                colors={['#1CB5E0', '#38EF7D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.changePasswordGradient}
              >
                <Feather name="key" size={20} color="#FFFFFF" />
                <Text style={styles.changePasswordText}>Change Password</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    fontFamily: 'Inter-Medium',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3A4276',
    fontFamily: 'Inter-SemiBold',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  nonEditableSection: {
    margin: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 12,
    fontFamily: 'Inter-SemiBold',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  infoLabel: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  section: {
    margin: 20,
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3A4276',
    marginBottom: 6,
    fontFamily: 'Inter-Medium',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#3A4276',
    fontFamily: 'Inter-Regular',
  },
  statusContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#3A4276',
    fontFamily: 'Inter-Regular',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  subjectsButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectsButtonText: {
    fontSize: 16,
    color: '#8A94A6',
    fontFamily: 'Inter-Regular',
  },
  selectedItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  itemTag: {
    backgroundColor: '#E8F4FD',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  itemTagText: {
    fontSize: 12,
    color: '#1CB5E0',
    fontWeight: '500',
    marginRight: 6,
    fontFamily: 'Inter-Medium',
  },
  saveButton: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
    fontFamily: 'Inter-SemiBold',
  },
  bottomPadding: {
    height: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    fontFamily: 'Inter-SemiBold',
  },
  modalHeaderSpacer: {
    width: 24,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingHorizontal: 12,
  },
  addItemInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#3A4276',
    fontFamily: 'Inter-Regular',
  },
  addItemButton: {
    padding: 8,
    marginLeft: 8,
  },
  itemOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemOptionSelected: {
    backgroundColor: '#E8F4FD',
    borderColor: '#1CB5E0',
  },
  itemOptionText: {
    fontSize: 16,
    color: '#3A4276',
    fontFamily: 'Inter-Regular',
  },
  itemOptionTextSelected: {
    color: '#1CB5E0',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  changePasswordButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  changePasswordGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  changePasswordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
    fontFamily: 'Inter-SemiBold',
  },
});

export default TeacherProfileScreen;