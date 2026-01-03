import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useCallback } from 'react';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL} from '../config/api';

const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminSubjects'>;

interface Subject {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  credits: number;
  isActive: boolean;
  teacherId?: {
    _id: string;
    name: string;
    email: string;
    subject?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Teacher {
  _id: string;
  name: string;
  email: string;
  subject?: string;
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

interface SubjectFormData {
  name: string;
  code: string;
  description: string;
  credits: string;
}

const TeacherAdminSubjectsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { classId, className } = route.params;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [assigningSubject, setAssigningSubject] = useState<Subject | null>(null);

  const [formData, setFormData] = useState<SubjectFormData>({
    name: '',
    code: '',
    description: '',
    credits: '1',
  });
  const [formErrors, setFormErrors] = useState<Partial<SubjectFormData>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `Subjects - ${className}`,
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2D3748',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
      headerRight: () => (
        <TouchableOpacity
          onPress={handleAddSubject}
          style={styles.headerButton}
        >
          <FontAwesome5 name="plus" size={16} color="#4299E1" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, className]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('teacherToken');
      if (!storedToken) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'TeacherLogin' }],
        });
        return;
      }
      
      setToken(storedToken);
      await loadSubjects(storedToken);
      await loadAvailableTeachers(storedToken);
    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize screen');
    }
  };

  const getAuthenticatedClient = (authToken = token) => {
    return axios.create({
      baseURL: API_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'x-auth-token': authToken,
        'Content-Type': 'application/json'
      }
    });
  };

  const loadSubjects = async (authToken = token) => {
    if (!authToken) return;
    
    try {
      setLoading(true);
      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/subjects/class/${classId}/get-or-init`);
      
      const { 
        subjects: fetchedSubjects, 
        classInfo: fetchedClassInfo, 
      } = response.data;
      
      setSubjects(fetchedSubjects || []);
      setClassInfo(fetchedClassInfo);
    } catch (error) {
      console.error('Error loading subjects:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleLogout();
        } else if (!refreshing) {
          Alert.alert('Error', error.response?.data?.msg || 'Failed to load subjects');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAvailableTeachers = async (authToken = token) => {
    if (!authToken) return;
    
    try {
      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/subjects/class/${classId}/teachers`);
      setAvailableTeachers(response.data.teachers || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
    }
  };

  const addSubject = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      const apiClient = getAuthenticatedClient();
      await apiClient.post(`/subjects/class/${classId}`, {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        description: formData.description.trim(),
        credits: parseInt(formData.credits) || 1,
      });
      
      Alert.alert('Success', 'Subject added successfully');
      setShowAddModal(false);
      resetForm();
      await loadSubjects();
    } catch (error) {
      console.error('Error adding subject:', error);
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.msg || 'Failed to add subject');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const updateSubject = async () => {
    if (!validateForm() || !editingSubject) return;
    
    try {
      setSubmitting(true);
      const apiClient = getAuthenticatedClient();
      await apiClient.put(`/subjects/class/${classId}/subject/${editingSubject._id}`, {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        description: formData.description.trim(),
        credits: parseInt(formData.credits) || 1,
      });
      
      Alert.alert('Success', 'Subject updated successfully');
      setShowEditModal(false);
      setEditingSubject(null);
      resetForm();
      await loadSubjects();
    } catch (error) {
      console.error('Error updating subject:', error);
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.msg || 'Failed to update subject');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSubject = (subject: Subject) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${subject.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiClient = getAuthenticatedClient();
              await apiClient.delete(`/subjects/class/${classId}/subject/${subject._id}`);
              
              Alert.alert('Success', 'Subject deleted successfully');
              await loadSubjects();
            } catch (error) {
              console.error('Error deleting subject:', error);
              if (axios.isAxiosError(error)) {
                Alert.alert('Error', error.response?.data?.msg || 'Failed to delete subject');
              }
            }
          }
        }
      ]
    );
  };

  const assignTeacherToSubject = async (teacherId: string) => {
    if (!assigningSubject) return;
    
    try {
      setSubmitting(true);
      const apiClient = getAuthenticatedClient();
      await apiClient.post(`/subjects/class/${classId}/subject/${assigningSubject._id}/assign`, {
        teacherId
      });
      
      Alert.alert('Success', 'Teacher assigned successfully');
      setShowAssignModal(false);
      setAssigningSubject(null);
      await loadSubjects();
    } catch (error) {
      console.error('Error assigning teacher:', error);
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.msg || 'Failed to assign teacher');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const removeTeacherFromSubject = (subject: Subject) => {
    Alert.alert(
      'Remove Teacher',
      `Remove ${subject.teacherId?.name} from "${subject.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiClient = getAuthenticatedClient();
              await apiClient.delete(`/subjects/class/${classId}/subject/${subject._id}/teacher`);
              
              Alert.alert('Success', 'Teacher removed successfully');
              await loadSubjects();
            } catch (error) {
              console.error('Error removing teacher:', error);
              if (axios.isAxiosError(error)) {
                Alert.alert('Error', error.response?.data?.msg || 'Failed to remove teacher');
              }
            }
          }
        }
      ]
    );
  };

  const validateForm = (): boolean => {
    const errors: Partial<SubjectFormData> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Subject name is required';
    }
    
    if (formData.credits && isNaN(parseInt(formData.credits))) {
      errors.credits = 'Credits must be a number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      credits: '1',
    });
    setFormErrors({});
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['teacherToken', 'teacherData', 'userRole']);
    navigation.reset({
      index: 0,
      routes: [{ name: 'TeacherLogin' }],
    });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSubjects(token);
  }, [token]);

  const handleAddSubject = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name,
      code: subject.code || '',
      description: subject.description || '',
      credits: subject.credits.toString(),
    });
    setShowEditModal(true);
  };

  const handleAssignTeacher = (subject: Subject) => {
    setAssigningSubject(subject);
    setShowAssignModal(true);
  };

  const renderSubjectCard = ({ item }: { item: Subject }) => (
  <View style={styles.subjectCard}>
    <View style={styles.subjectCardContent}>
      <View style={styles.subjectIconContainer}>
        <FontAwesome5 name="book" size={20} color="#4299E1" />
      </View>
      
      <View style={styles.subjectInfo}>
        <View style={styles.subjectHeader}>
          <Text style={styles.subjectName}>{item.name}</Text>
          {item.code && (
            <Text style={styles.subjectCode}>({item.code})</Text>
          )}
        </View>
        
        {item.description && (
          <Text style={styles.subjectDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.subjectMeta}>
          <View style={styles.metaItem}>
            <FontAwesome5 name="award" size={11} color="#718096" />
            <Text style={styles.metaText}>{item.credits} Credits</Text>
          </View>
          
          <View style={[styles.statusBadge, { 
            backgroundColor: item.isActive ? '#C6F6D5' : '#FED7D7' 
          }]}>
            <View style={[styles.statusDot, { 
              backgroundColor: item.isActive ? '#38A169' : '#E53E3E' 
            }]} />
            <Text style={[styles.statusText, {
              color: item.isActive ? '#22543D' : '#742A2A'
            }]}>
              {item.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
        
        {item.teacherId ? (
          <View style={styles.teacherAssigned}>
            <View style={styles.teacherBadge}>
              <FontAwesome5 name="user-tie" size={11} color="#4299E1" />
              <Text style={styles.teacherText}>{item.teacherId.name}</Text>
            </View>
            <TouchableOpacity
              onPress={() => removeTeacherFromSubject(item)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => handleAssignTeacher(item)}
            style={styles.assignTeacherButton}
          >
            <FontAwesome5 name="user-plus" size={12} color="#4299E1" />
            <Text style={styles.assignTeacherText}>Assign Teacher</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.subjectActions}>
        <TouchableOpacity
          onPress={() => handleEditSubject(item)}
          style={styles.iconButton}
        >
          <Feather name="edit-2" size={16} color="#4299E1" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => deleteSubject(item)}
          style={[styles.iconButton, { marginTop: 8 }]}
        >
          <Feather name="trash-2" size={16} color="#E53E3E" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

  const renderTeacherItem = ({ item }: { item: Teacher }) => (
  <TouchableOpacity
    style={styles.teacherItem}
    onPress={() => assignTeacherToSubject(item._id)}
    disabled={submitting}
    activeOpacity={0.7}
  >
    <View style={styles.teacherAvatar}>
      <Text style={styles.teacherInitial}>
        {item.name.charAt(0).toUpperCase()}
      </Text>
    </View>
    <View style={styles.teacherDetails}>
      <Text style={styles.teacherName}>{item.name}</Text>
      <Text style={styles.teacherEmail}>{item.email}</Text>
      {item.subject && (
        <Text style={styles.teacherSubject}>Subject: {item.subject}</Text>
      )}
    </View>
  </TouchableOpacity>
);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4299E1" />
          <Text style={styles.loadingText}>Loading subjects...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
      
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4299E1']}
            tintColor="#4299E1"
          />
        }
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Class Overview</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconContainer, { backgroundColor: '#EBF8FF' }]}>
                <FontAwesome5 name="chalkboard-teacher" size={20} color="#4299E1" />
              </View>
              <Text style={styles.summaryNumber}>{classInfo?.name || className}</Text>
              <Text style={styles.summaryLabel}>{classInfo?.section ? `Section ${classInfo.section}` : 'Class'}</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIconContainer, { backgroundColor: '#F0FFF4' }]}>
                <FontAwesome5 name="book" size={20} color="#38A169" />
              </View>
              <Text style={styles.summaryNumber}>{subjects.length}</Text>
              <Text style={styles.summaryLabel}>Total Subjects</Text>
            </View>
          </View>
        </View>

        {/* Subjects List */}
        {subjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="book-open" size={64} color="#CBD5E0" />
            <Text style={styles.emptyTitle}>No Subjects Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start by adding subjects for your class. Tap the + button in the header to add your first subject.
            </Text>
          </View>
        ) : (
          <View style={styles.subjectsSection}>
            <Text style={styles.sectionTitle}>Subjects</Text>
            <Text style={styles.sectionSubtitle}>
              Manage subjects and assign teachers
            </Text>
            <FlatList
              data={subjects}
              renderItem={renderSubjectCard}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.subjectsList}
            />
          </View>
        )}
      </ScrollView>

      {/* Add Subject Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false);
                resetForm();
              }}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={20} color="#2D3748" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Subject</Text>
            <TouchableOpacity
              onPress={addSubject}
              disabled={submitting}
              style={styles.modalSaveButton}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#4299E1" />
              ) : (
                <Ionicons name="checkmark" size={20} color="#4299E1" />
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Subject Name *</Text>
                  <View style={[styles.inputContainer, formErrors.name && styles.inputError]}>
                    <FontAwesome5 name="book" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.name}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                      placeholder="Enter subject name"
                      autoCapitalize="words"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                  {formErrors.name && (
                    <Text style={styles.errorText}>{formErrors.name}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Subject Code</Text>
                  <View style={styles.inputContainer}>
                    <FontAwesome5 name="tag" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.code}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, code: text }))}
                      placeholder="Enter subject code (optional)"
                      autoCapitalize="characters"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description</Text>
                  <View style={[styles.inputContainer, styles.textAreaContainer]}>
                    <FontAwesome5 name="align-left" size={14} color="#A0AEC0" style={[styles.inputIcon, styles.textAreaIcon]} />
                    <TextInput
                      style={[styles.formInput, styles.textArea]}
                      value={formData.description}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                      placeholder="Enter subject description (optional)"
                      multiline
                      numberOfLines={3}
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Credits</Text>
                  <View style={[styles.inputContainer, formErrors.credits && styles.inputError]}>
                    <FontAwesome5 name="award" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.credits}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, credits: text }))}
                      placeholder="Enter credits"
                      keyboardType="numeric"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                  {formErrors.credits && (
                    <Text style={styles.errorText}>{formErrors.credits}</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </Modal>

      {/* Edit Subject Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowEditModal(false);
                setEditingSubject(null);
                resetForm();
              }}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={20} color="#2D3748" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Subject</Text>
            <TouchableOpacity
              onPress={updateSubject}
              disabled={submitting}
              style={styles.modalSaveButton}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#4299E1" />
              ) : (
                <Ionicons name="checkmark" size={20} color="#4299E1" />
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Subject Name *</Text>
                  <View style={[styles.inputContainer, formErrors.name && styles.inputError]}>
                    <FontAwesome5 name="book" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.name}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                      placeholder="Enter subject name"
                      autoCapitalize="words"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                  {formErrors.name && (
                    <Text style={styles.errorText}>{formErrors.name}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Subject Code</Text>
                  <View style={styles.inputContainer}>
                    <FontAwesome5 name="tag" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.code}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, code: text }))}
                      placeholder="Enter subject code (optional)"
                      autoCapitalize="characters"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description</Text>
                  <View style={[styles.inputContainer, styles.textAreaContainer]}>
                    <FontAwesome5 name="align-left" size={14} color="#A0AEC0" style={[styles.inputIcon, styles.textAreaIcon]} />
                    <TextInput
                      style={[styles.formInput, styles.textArea]}
                      value={formData.description}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                      placeholder="Enter subject description (optional)"
                      multiline
                      numberOfLines={3}
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Credits</Text>
                  <View style={[styles.inputContainer, formErrors.credits && styles.inputError]}>
                    <FontAwesome5 name="award" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.credits}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, credits: text }))}
                      placeholder="Enter credits"
                      keyboardType="numeric"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                  {formErrors.credits && (
                    <Text style={styles.errorText}>{formErrors.credits}</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </Modal>

      {/* Assign Teacher Modal */}
      <Modal
        visible={showAssignModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowAssignModal(false);
                setAssigningSubject(null);
              }}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={20} color="#2D3748" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Assign Teacher</Text>
            <View style={{ width: 36 }} />
          </View>
          
          <View style={styles.modalContent}>
            {assigningSubject && (
              <View style={styles.assigningInfo}>
                <Text style={styles.assigningText}>
                  Assigning teacher to: <Text style={styles.assigningSubject}>{assigningSubject.name}</Text>
                </Text>
              </View>
            )}
            
            {availableTeachers.length === 0 ? (
              <View style={styles.emptyContainer}>
                <FontAwesome5 name="user-slash" size={64} color="#CBD5E0" />
                <Text style={styles.emptyTitle}>No Available Teachers</Text>
                <Text style={styles.emptySubtitle}>
                  No teachers are currently assigned to this class.
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableTeachers}
                renderItem={renderTeacherItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.teachersList}
              />
            )}
          </View></SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#718096',
    fontWeight: '500',
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EBF8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  
  // Summary Card
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Subjects Section
  subjectsSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 16,
  },
  subjectsList: {
    paddingTop: 8,
  },
  
  // Subject Card
  subjectCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 3,
  elevation: 1,
},
subjectCardContent: {
  padding: 16,
  flexDirection: 'row',
  alignItems: 'flex-start',
},
subjectIconContainer: {
  width: 44,
  height: 44,
  borderRadius: 10,
  backgroundColor: '#EBF8FF',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
  flexShrink: 0,
},
subjectInfo: {
  flex: 1,
  marginRight: 12,
},
subjectHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: 6,
},
subjectName: {
  fontSize: 16,
  fontWeight: '600',
  color: '#2D3748',
  marginRight: 6,
},
subjectCode: {
  fontSize: 14,
  color: '#718096',
  fontWeight: '500',
},
subjectDescription: {
  fontSize: 14,
  color: '#718096',
  lineHeight: 20,
  marginBottom: 12,
},
subjectMeta: {
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: 12,
},
metaItem: {
  flexDirection: 'row',
  alignItems: 'center',
  marginRight: 16,
},
metaText: {
  fontSize: 13,
  color: '#718096',
  fontWeight: '500',
  marginLeft: 6,
},
statusBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 6,
},
statusDot: {
  width: 6,
  height: 6,
  borderRadius: 3,
  marginRight: 4,
},
statusText: {
  fontSize: 12,
  fontWeight: '600',
},
teacherAssigned: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: '#EBF8FF',
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 8,
},
teacherBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},
teacherText: {
  fontSize: 13,
  color: '#2D3748',
  fontWeight: '500',
  marginLeft: 6,
},
removeButton: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  backgroundColor: '#FED7D7',
  borderRadius: 6,
},
removeText: {
  fontSize: 12,
  color: '#742A2A',
  fontWeight: '600',
},
assignTeacherButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#EBF8FF',
  paddingVertical: 10,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#4299E1',
  borderStyle: 'dashed',
},
assignTeacherText: {
  fontSize: 13,
  color: '#4299E1',
  fontWeight: '600',
  marginLeft: 6,
},
subjectActions: {
  justifyContent: 'flex-start',
  flexShrink: 0,
},
iconButton: {
  width: 32,
  height: 32,
  borderRadius: 8,
  backgroundColor: '#F7FAFC',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 1,
  borderColor: '#E2E8F0',
},
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
  },
  modalSaveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  
  // Form Styles
  formContainer: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  inputError: {
    borderColor: '#FC8181',
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  textAreaIcon: {
    marginTop: 2,
  },
  formInput: {
    flex: 1,
    fontSize: 15,
    color: '#2D3748',
    paddingVertical: 12,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#E53E3E',
    marginTop: 6,
    fontWeight: '500',
  },
  
  // Assign Teacher Modal
  assigningInfo: {
    backgroundColor: '#EBF8FF',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4299E1',
  },
  assigningText: {
    fontSize: 14,
    color: '#2D3748',
    fontWeight: '500',
  },
  assigningSubject: {
    fontWeight: '700',
    color: '#2C5282',
  },
  teachersList: {
    paddingHorizontal: 20,
  },
  teacherItem: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
  borderRadius: 10,
  padding: 16,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: '#E2E8F0',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
},
teacherAvatar: {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: '#4299E1',
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 14,
},
teacherInitial: {
  fontSize: 18,
  fontWeight: '700',
  color: '#FFFFFF',
},
teacherDetails: {
  flex: 1,
},
teacherName: {
  fontSize: 15,
  fontWeight: '600',
  color: '#2D3748',
  marginBottom: 3,
},
teacherEmail: {
  fontSize: 13,
  color: '#718096',
  marginBottom: 3,
},
teacherSubject: {
  fontSize: 12,
  color: '#4299E1',
  fontWeight: '500',
},
});

export default TeacherAdminSubjectsScreen;