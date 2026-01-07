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
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL } from '../config/api';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherProfile'>;

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

  const availableSubjects = [
    'Mathematics', 'English', 'Science', 'History', 'Geography',
    'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Art',
    'Music', 'Physical Education', 'Social Studies', 'Economics',
    'Psychology', 'Philosophy', 'Literature', 'Statistics'
  ];

  useEffect(() => {
    loadTeacherProfile();
  }, []);

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

  const loadTeacherProfile = async () => {
    try {
      setLoading(true);
      const apiClient = await getAuthenticatedClient();
      const response = await apiClient.get('/teacher/profile');
      
      const teacherData = response.data.teacher;
      setTeacher(teacherData);
      
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

  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      
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

  const handleAddSubject = () => {
    if (newSubject.trim() && !formData.subjects.includes(newSubject.trim())) {
      setFormData(prev => ({
        ...prev,
        subjects: [...prev.subjects, newSubject.trim()]
      }));
      setNewSubject('');
    }
  };

  const handleRemoveSubject = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter(s => s !== subject)
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FC" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Feather name="arrow-left" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity 
          onPress={() => setPasswordModalVisible(true)}
          style={styles.headerButton}
        >
          <Feather name="key" size={20} color="#2C3E50" />
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
          {/* Profile Header Card */}
          <View style={styles.profileHeaderCard}>
            <LinearGradient
              colors={['#3498DB', '#2ECC71']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileGradient}
            >
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <FontAwesome5 name="user-tie" size={36} color="#FFFFFF" />
                </View>
              </View>
              <Text style={styles.profileName}>{teacher?.name}</Text>
              <Text style={styles.profileEmail}>{teacher?.email}</Text>
              <View style={styles.profileBadges}>
                <View style={styles.badge}>
                  <FontAwesome5 name="id-card" size={12} color="#FFFFFF" />
                  <Text style={styles.badgeText}>{teacher?.teacherId || 'Not assigned'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: formData.status === 'active' ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)' }]}>
                  <FontAwesome5 
                    name={formData.status === 'active' ? 'check-circle' : 'times-circle'} 
                    size={12} 
                    color="#FFFFFF" 
                  />
                  <Text style={styles.badgeText}>{formData.status === 'active' ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Account Information Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <FontAwesome5 name="calendar-alt" size={16} color="#3498DB" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Joining Date</Text>
                  <Text style={styles.infoValue}>
                    {teacher?.joiningDate ? new Date(teacher.joiningDate).toLocaleDateString() : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            
            <View style={styles.inputCard}>
              <View style={styles.inputIconContainer}>
                <FontAwesome5 name="phone" size={16} color="#3498DB" />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.phone}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                  placeholder="Enter phone number"
                  placeholderTextColor="#BDC3C7"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputCard}>
              <View style={styles.inputIconContainer}>
                <FontAwesome5 name="map-marker-alt" size={16} color="#3498DB" />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.textInput, styles.textAreaInput]}
                  value={formData.address}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
                  placeholder="Enter your address"
                  placeholderTextColor="#BDC3C7"
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputCard, styles.halfWidth]}>
                <View style={styles.inputContent}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.city}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, city: text }))}
                    placeholder="Enter city"
                    placeholderTextColor="#BDC3C7"
                  />
                </View>
              </View>

              <View style={[styles.inputCard, styles.halfWidth]}>
                <View style={styles.inputContent}>
                  <Text style={styles.inputLabel}>ZIP Code</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.zip}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, zip: text }))}
                    placeholder="ZIP"
                    placeholderTextColor="#BDC3C7"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputCard}>
              <View style={styles.inputIconContainer}>
                <FontAwesome5 name="map" size={16} color="#3498DB" />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>State</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.state}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, state: text }))}
                  placeholder="Enter state"
                  placeholderTextColor="#BDC3C7"
                />
              </View>
            </View>
          </View>

          {/* Professional Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Information</Text>
            
            <View style={styles.inputCard}>
              <View style={styles.inputIconContainer}>
                <FontAwesome5 name="graduation-cap" size={16} color="#E67E22" />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Qualification</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.qualification}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, qualification: text }))}
                  placeholder="Enter your highest qualification"
                  placeholderTextColor="#BDC3C7"
                />
              </View>
            </View>

            <View style={styles.inputCard}>
              <View style={styles.inputIconContainer}>
                <FontAwesome5 name="briefcase" size={16} color="#E67E22" />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Experience (Years)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.experience}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, experience: text }))}
                  placeholder="Enter years of experience"
                  placeholderTextColor="#BDC3C7"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.subjectsCard}
              onPress={() => setShowSubjectsModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.subjectsIconContainer}>
                <FontAwesome5 name="book-open" size={16} color="#2ECC71" />
              </View>
              <View style={styles.subjectsContent}>
                <Text style={styles.inputLabel}>Subjects</Text>
                <Text style={styles.subjectsValue}>
                  {formData.subjects.length > 0 
                    ? `${formData.subjects.length} subject${formData.subjects.length > 1 ? 's' : ''} selected` 
                    : 'Tap to select subjects'
                  }
                </Text>
                {formData.subjects.length > 0 && (
                  <View style={styles.subjectTagsContainer}>
                    {formData.subjects.slice(0, 3).map((subject) => (
                      <View key={subject} style={styles.subjectMiniTag}>
                        <Text style={styles.subjectMiniTagText}>{subject}</Text>
                      </View>
                    ))}
                    {formData.subjects.length > 3 && (
                      <View style={styles.subjectMiniTag}>
                        <Text style={styles.subjectMiniTagText}>+{formData.subjects.length - 3}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
              <Feather name="chevron-right" size={20} color="#BDC3C7" />
            </TouchableOpacity>

            <View style={styles.statusCard}>
              <View style={styles.statusIconContainer}>
                <FontAwesome5 
                  name={formData.status === 'active' ? 'toggle-on' : 'toggle-off'} 
                  size={16} 
                  color={formData.status === 'active' ? '#2ECC71' : '#E74C3C'} 
                />
              </View>
              <View style={styles.statusContent}>
                <Text style={styles.inputLabel}>Account Status</Text>
                <Text style={styles.statusDescription}>
                  {formData.status === 'active' 
                    ? 'Your account is currently active' 
                    : 'Your account is currently inactive'
                  }
                </Text>
              </View>
              <Switch
                value={formData.status === 'active'}
                onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, status: value ? 'active' : 'inactive' }))
                }
                trackColor={{ false: '#E8ECF4', true: '#2ECC71' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E8ECF4"
              />
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleUpdateProfile}
              disabled={saving}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={saving ? ['#B0B7C3', '#B0B7C3'] : ['#3498DB', '#2ECC71']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButtonGradient}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <FontAwesome5 name="save" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

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
            <TouchableOpacity 
              onPress={() => setShowSubjectsModal(false)}
              style={styles.modalCloseButton}
            >
              <Feather name="x" size={24} color="#2C3E50" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Subjects</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.addSubjectCard}>
              <FontAwesome5 name="plus-circle" size={20} color="#3498DB" style={styles.addSubjectIcon} />
              <TextInput
                style={styles.addSubjectInput}
                value={newSubject}
                onChangeText={setNewSubject}
                placeholder="Add custom subject"
                placeholderTextColor="#BDC3C7"
              />
              <TouchableOpacity 
                style={styles.addSubjectButton}
                onPress={handleAddSubject}
                activeOpacity={0.7}
              >
                <Text style={styles.addSubjectButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.subjectsGrid}>
              {availableSubjects.map((subject) => (
                <TouchableOpacity
                  key={subject}
                  style={[
                    styles.subjectOption,
                    formData.subjects.includes(subject) && styles.subjectOptionSelected
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
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.subjectOptionText,
                    formData.subjects.includes(subject) && styles.subjectOptionTextSelected
                  ]}>
                    {subject}
                  </Text>
                  {formData.subjects.includes(subject) && (
                    <FontAwesome5 name="check-circle" size={18} color="#2ECC71" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
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
            <TouchableOpacity 
              onPress={() => setPasswordModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <Feather name="x" size={24} color="#2C3E50" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Password</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.passwordCard}>
              <View style={styles.passwordIconContainer}>
                <FontAwesome5 name="lock" size={16} color="#E74C3C" />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={passwordForm.currentPassword}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, currentPassword: text }))}
                  placeholder="Enter current password"
                  placeholderTextColor="#BDC3C7"
                  secureTextEntry
                />
              </View>
            </View>

            <View style={styles.passwordCard}>
              <View style={styles.passwordIconContainer}>
                <FontAwesome5 name="key" size={16} color="#2ECC71" />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={passwordForm.newPassword}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, newPassword: text }))}
                  placeholder="Enter new password (min 6 characters)"
                  placeholderTextColor="#BDC3C7"
                  secureTextEntry
                />
              </View>
            </View>

            <View style={styles.passwordCard}>
              <View style={styles.passwordIconContainer}>
                <FontAwesome5 name="check-circle" size={16} color="#3498DB" />
              </View>
              <View style={styles.inputContent}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.textInput}
                  value={passwordForm.confirmPassword}
                  onChangeText={(text) => setPasswordForm(prev => ({ ...prev, confirmPassword: text }))}
                  placeholder="Confirm new password"
                  placeholderTextColor="#BDC3C7"
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.changePasswordButton}
              onPress={handleChangePassword}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#E74C3C', '#C0392B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.changePasswordGradient}
              >
                <FontAwesome5 name="shield-alt" size={18} color="#FFFFFF" />
                <Text style={styles.changePasswordText}>Update Password</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
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
    color: '#7F8C8D',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },

  // Profile Header Card
  profileHeaderCard: {
    margin: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileGradient: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Section Styles
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },

  // Info Card
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '600',
  },

  // Input Card Styles
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inputContent: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '400',
    padding: 0,
  },
  textAreaInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Row Layout
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: (width - 48) / 2,
  },

  // Subjects Card
  subjectsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  subjectsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FFF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  subjectsContent: {
    flex: 1,
  },
  subjectsValue: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '400',
  },
  subjectTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  subjectMiniTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectMiniTagText: {
    fontSize: 11,
    color: '#2ECC71',
    fontWeight: '600',
  },

  // Status Card
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FFF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusContent: {
    flex: 1,
  },
  statusDescription: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '400',
  },

  // Button Styles
  buttonContainer: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
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
    gap: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
  },
  modalHeaderSpacer: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },

  // Add Subject Card
  addSubjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addSubjectIcon: {
    marginRight: 10,
  },
  addSubjectInput: {
    flex: 1,
    fontSize: 16,
    color: '#2C3E50',
    paddingVertical: 8,
  },
  addSubjectButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  addSubjectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Subjects Grid
  subjectsGrid: {
    gap: 8,
  },
  subjectOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF4',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  subjectOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2ECC71',
    borderWidth: 2,
  },
  subjectOptionText: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
  },
  subjectOptionTextSelected: {
    color: '#2ECC71',
    fontWeight: '600',
  },

  // Password Modal Styles
  passwordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  passwordIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  changePasswordButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  changePasswordGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 10,
  },
  changePasswordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Bottom Padding
  bottomPadding: {
    height: 24,
  },
});

export default TeacherProfileScreen ;