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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState, useCallback } from 'react';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { API_BASE_URL} from '../config/api';

// API URL with configurable timeout
const API_URL = API_BASE_URL; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminSubjects'>;

// Interfaces
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

  // States
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [assigningSubject, setAssigningSubject] = useState<Subject | null>(null);

  // Form states
  const [formData, setFormData] = useState<SubjectFormData>({
    name: '',
    code: '',
    description: '',
    credits: '1',
  });
  const [formErrors, setFormErrors] = useState<Partial<SubjectFormData>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Set header options
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: `${className} - Subjects`,
      headerStyle: {
        backgroundColor: '#1CB5E0',
      },
      headerTintColor: '#FFFFFF',
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
      },
      headerRight: () => (
        <TouchableOpacity
          onPress={handleAddSubject}
          style={styles.headerButton}
        >
          <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, className]);

  // Network connectivity check
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  // Initialize authentication and load data
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
      
      // Load subjects using the new endpoint that auto-initializes
      await loadSubjects(storedToken);
      
      // Load teachers
      await loadAvailableTeachers(storedToken);
      
      console.log('Screen initialized successfully');
    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize screen');
    }
  };

  // Get authenticated API client
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

  // Load subjects for the class - Updated to use the new endpoint
  const loadSubjects = async (authToken = token) => {
    if (!authToken) return;
    
    try {
      setLoading(true);
      const apiClient = getAuthenticatedClient(authToken);
      
      // Use the new endpoint that auto-initializes if not exists
      const response = await apiClient.get(`/subjects/class/${classId}/get-or-init`);
      
      const { 
        subjects: fetchedSubjects, 
        classInfo: fetchedClassInfo, 
        isNewlyInitialized,
        msg 
      } = response.data;
      
      setSubjects(fetchedSubjects || []);
      setClassInfo(fetchedClassInfo);
      
      // Show success message if newly initialized
      if (isNewlyInitialized && !refreshing) {
        console.log('Subjects auto-initialized for class');
      }
      
      console.log('Subjects loaded:', fetchedSubjects?.length || 0);
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

  // Load available teachers for assignment
  const loadAvailableTeachers = async (authToken = token) => {
    if (!authToken) return;
    
    try {
      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/subjects/class/${classId}/teachers`);
      
      setAvailableTeachers(response.data.teachers || []);
      console.log('Teachers loaded:', response.data.teachers?.length || 0);
    } catch (error) {
      console.error('Error loading teachers:', error);
      if (axios.isAxiosError(error)) {
        console.log('API Error:', error.response?.status, error.response?.data);
      }
    }
  };

  // Add new subject
  const addSubject = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      const apiClient = getAuthenticatedClient();
      const response = await apiClient.post(`/subjects/class/${classId}`, {
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

  // Update subject
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

  // Delete subject
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

  // Assign teacher to subject
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

  // Remove teacher from subject
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

  // Form validation
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

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      credits: '1',
    });
    setFormErrors({});
  };

  // Handle logout
  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['teacherToken', 'teacherData', 'userRole']);
    navigation.reset({
      index: 0,
      routes: [{ name: 'TeacherLogin' }],
    });
  };

  // Handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSubjects(token);
  }, [token]);

  // Event handlers - Simplified since no manual initialization needed
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

  // Render subject card
  const renderSubjectCard = ({ item }: { item: Subject }) => (
    <View style={styles.subjectCard}>
      <LinearGradient
        colors={item.isActive ? ['#1CB5E0', '#38EF7D'] : ['#8A94A6', '#B0B7C3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.subjectGradientBorder}
      >
        <View style={styles.subjectCardContent}>
          <View style={styles.subjectHeader}>
            <View style={styles.subjectTitleContainer}>
              <Text style={styles.subjectName}>{item.name}</Text>
              {item.code && (
                <Text style={styles.subjectCode}>({item.code})</Text>
              )}
            </View>
            <View style={styles.subjectActions}>
              <TouchableOpacity
                onPress={() => handleEditSubject(item)}
                style={styles.actionButton}
              >
                <Feather name="edit-2" size={16} color="#1CB5E0" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteSubject(item)}
                style={styles.actionButton}
              >
                <Feather name="trash-2" size={16} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          </View>
          
          {item.description && (
            <Text style={styles.subjectDescription}>{item.description}</Text>
          )}
          
          <View style={styles.subjectDetails}>
            <View style={styles.creditsContainer}>
              <FontAwesome5 name="award" size={12} color="#8A94A6" />
              <Text style={styles.creditsText}>{item.credits} Credits</Text>
            </View>
            
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#38EF7D' : '#FF6B6B' }]} />
              <Text style={styles.statusText}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          
          <View style={styles.teacherAssignment}>
            {item.teacherId ? (
              <View style={styles.assignedTeacher}>
                <View style={styles.teacherInfo}>
                  <FontAwesome5 name="user-tie" size={14} color="#1CB5E0" />
                  <Text style={styles.teacherName}>{item.teacherId.name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeTeacherFromSubject(item)}
                  style={styles.removeTeacherButton}
                >
                  <Text style={styles.removeTeacherText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleAssignTeacher(item)}
                style={styles.assignButton}
              >
                <FontAwesome5 name="user-plus" size={14} color="#FFFFFF" />
                <Text style={styles.assignButtonText}>Assign Teacher</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  // Render teacher selection item
  const renderTeacherItem = ({ item }: { item: Teacher }) => (
    <TouchableOpacity
      style={styles.teacherItem}
      onPress={() => assignTeacherToSubject(item._id)}
      disabled={submitting}
    >
      <View style={styles.teacherItemContent}>
        <View style={styles.teacherAvatar}>
          <Text style={styles.teacherInitial}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.teacherDetails}>
          <Text style={styles.teacherItemName}>{item.name}</Text>
          <Text style={styles.teacherItemEmail}>{item.email}</Text>
          {item.subject && (
            <Text style={styles.teacherSubject}>Subject: {item.subject}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Loading screen
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar backgroundColor="#1CB5E0" barStyle="light-content" />
        <ActivityIndicator size="large" color="#1CB5E0" />
        <Text style={styles.loadingText}>Loading subjects...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#1CB5E0" barStyle="light-content" />
      
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1CB5E0', '#38EF7D']}
          />
        }
      >
        {/* Class Info Header */}
        {classInfo && (
          <View style={styles.classInfoContainer}>
            <LinearGradient
              colors={['#1CB5E0', '#38EF7D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.classInfoGradient}
            >
              <View style={styles.classInfoContent}>
                <FontAwesome5 name="chalkboard-teacher" size={24} color="#FFFFFF" />
                <View style={styles.classInfoDetails}>
                  <Text style={styles.classInfoName}>{classInfo.name}</Text>
                  <Text style={styles.classInfoSection}>Section {classInfo.section}</Text>
                </View>
                <View style={styles.subjectCount}>
                  <Text style={styles.subjectCountNumber}>{subjects.length}</Text>
                  <Text style={styles.subjectCountLabel}>Subjects</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Subjects List - Simplified since auto-initialization handles empty states */}
        {subjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="book" size={48} color="#B0B7C3" />
            <Text style={styles.emptyTitle}>No Subjects Yet</Text>
            <Text style={styles.emptyText}>
              Start by adding subjects for your class. Click the + button in the header to add your first subject.
            </Text>
          </View>
        ) : (
          <FlatList
            data={subjects}
            renderItem={renderSubjectCard}
            keyExtractor={(item) => item._id}
            scrollEnabled={false}
            contentContainerStyle={styles.subjectsList}
          />
        )}
      </ScrollView>

      {/* Add Subject Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <LinearGradient
            colors={['#1CB5E0', '#38EF7D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalHeaderGradient}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                style={styles.modalHeaderButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Subject</Text>
              <TouchableOpacity
                onPress={addSubject}
                disabled={submitting}
                style={styles.modalHeaderButton}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>
          
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Subject Name *</Text>
                  <View style={[styles.inputContainer, formErrors.name && styles.inputContainerError]}>
                    <FontAwesome5 name="book" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.name}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                      placeholder="Enter subject name"
                      autoCapitalize="words"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                  {formErrors.name && (
                    <Text style={styles.errorText}>{formErrors.name}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Subject Code</Text>
                  <View style={styles.inputContainer}>
                    <FontAwesome5 name="tag" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.code}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, code: text }))}
                      placeholder="Enter subject code (optional)"
                      autoCapitalize="characters"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description</Text>
                  <View style={[styles.inputContainer, styles.textAreaContainer]}>
                    <FontAwesome5 name="align-left" size={16} color="#8A94A6" style={[styles.inputIcon, styles.textAreaIcon]} />
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      value={formData.description}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                      placeholder="Enter subject description (optional)"
                      multiline
                      numberOfLines={3}
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Credits</Text>
                  <View style={[styles.inputContainer, formErrors.credits && styles.inputContainerError]}>
                    <FontAwesome5 name="award" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.credits}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, credits: text }))}
                      placeholder="Enter credits"
                      keyboardType="numeric"
                      placeholderTextColor="#B0B7C3"
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
          <LinearGradient
            colors={['#1CB5E0', '#38EF7D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalHeaderGradient}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingSubject(null);
                  resetForm();
                }}
                style={styles.modalHeaderButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Subject</Text>
              <TouchableOpacity
                onPress={updateSubject}
                disabled={submitting}
                style={styles.modalHeaderButton}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </LinearGradient>
          
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Subject Name *</Text>
                  <View style={[styles.inputContainer, formErrors.name && styles.inputContainerError]}>
                    <FontAwesome5 name="book" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.name}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                      placeholder="Enter subject name"
                      autoCapitalize="words"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                  {formErrors.name && (
                    <Text style={styles.errorText}>{formErrors.name}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Subject Code</Text>
                  <View style={styles.inputContainer}>
                    <FontAwesome5 name="tag" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.code}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, code: text }))}
                      placeholder="Enter subject code (optional)"
                      autoCapitalize="characters"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description</Text>
                  <View style={[styles.inputContainer, styles.textAreaContainer]}>
                    <FontAwesome5 name="align-left" size={16} color="#8A94A6" style={[styles.inputIcon, styles.textAreaIcon]} />
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      value={formData.description}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                      placeholder="Enter subject description (optional)"
                      multiline
                      numberOfLines={3}
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Credits</Text>
                  <View style={[styles.inputContainer, formErrors.credits && styles.inputContainerError]}>
                    <FontAwesome5 name="award" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.credits}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, credits: text }))}
                      placeholder="Enter credits"
                      keyboardType="numeric"
                      placeholderTextColor="#B0B7C3"
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
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Assign Teacher</Text>
            <View style={{ width: 50 }} />
          </View>
          
          <View style={styles.modalContent}>
            {assigningSubject && (
              <View style={styles.assigningSubjectInfo}>
                <Text style={styles.assigningSubjectText}>
                  Assigning teacher to: {assigningSubject.name}
                </Text>
              </View>
            )}
            
            {availableTeachers.length === 0 ? (
              <View style={styles.noTeachersContainer}>
                <FontAwesome5 name="user-slash" size={48} color="#B0B7C3" />
                <Text style={styles.noTeachersText}>No Available Teachers</Text>
                <Text style={styles.noTeachersSubtext}>
                  No teachers are currently assigned to this class.
                </Text>
              </View>
            ) : (
              <FlatList
                data={availableTeachers}
                renderItem={renderTeacherItem}
                keyExtractor={(item) => item._id}
                style={styles.teachersList}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    fontWeight: '500',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  
  // Class Info Section
  classInfoContainer: {
    margin: 16,
    marginBottom: 8,
  },
  classInfoGradient: {
    borderRadius: 16,
    padding: 20,
  },
  classInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classInfoDetails: {
    flex: 1,
    marginLeft: 16,
  },
  classInfoName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  classInfoSection: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  subjectCount: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  subjectCountNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subjectCountLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  
  // Not Initialized State
  notInitializedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  notInitializedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3142',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  notInitializedText: {
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  initializeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1CB5E0',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#1CB5E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  initializeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3142',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Subjects List
  subjectsList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  subjectCard: {
    marginBottom: 16,
  },
  subjectGradientBorder: {
    borderRadius: 16,
    padding: 2,
  },
  subjectCardContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  subjectTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3142',
    marginBottom: 4,
  },
  subjectCode: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  subjectActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F9FC',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subjectDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  subjectDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  creditsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creditsText: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
    marginLeft: 6,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#8A94A6',
    fontWeight: '500',
  },
  teacherAssignment: {
    marginTop: 4,
  },
  assignedTeacher: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    padding: 12,
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teacherName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3142',
    marginLeft: 8,
  },
  removeTeacherButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeTeacherText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1CB5E0',
    paddingVertical: 12,
    borderRadius: 8,
  },
  assignButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeaderGradient: {
    paddingTop: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalHeaderButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#8A94A6',
    fontWeight: '500',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#1CB5E0',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Form Styles
  formContainer: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3142',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputContainerError: {
    borderColor: '#EF4444',
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  textAreaIcon: {
    marginTop: 4,
  },
  formInput: {
    flex: 1,
    fontSize: 16,
    color: '#2D3142',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  formInputError: {
    borderColor: '#EF4444',
  },
  formTextArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 6,
    fontWeight: '500',
  },
  
  // Teacher Assignment Modal
  assigningSubjectInfo: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    marginTop: 16,
    marginHorizontal: 20,
  },
  assigningSubjectText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0284C7',
    textAlign: 'center',
  },
  teachersList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  teacherItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  teacherItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  teacherAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1CB5E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  teacherInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  teacherDetails: {
    flex: 1,
  },
  teacherItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3142',
    marginBottom: 4,
  },
  teacherItemEmail: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 2,
  },
  teacherSubject: {
    fontSize: 12,
    color: '#1CB5E0',
    fontWeight: '500',
  },
  noTeachersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  noTeachersText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3142',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  noTeachersSubtext: {
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default TeacherAdminSubjectsScreen;