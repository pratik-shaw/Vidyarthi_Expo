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
import DateTimePicker from '@react-native-community/datetimepicker';

// API Configuration
const API_URL = 'http://192.168.29.148:5000/api';
const API_TIMEOUT = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminExams'>;

// Interfaces
interface ExamSubject {
  subjectId: string;
  subjectName: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmail?: string;
  credits: number;
  fullMarks: number;
}

interface Exam {
  _id: string;
  examName: string;
  examCode: string;
  examDate: string;
  duration: number;
  isActive: boolean;
  subjects: ExamSubject[];
  classAdminId: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Subject {
  _id: string;
  name: string;
  code?: string;
  credits: number;
  teacherId?: {
    _id: string;
    name: string;
    email: string;
  };
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

interface ExamFormData {
  examName: string;
  examCode: string;
  examDate: Date;
  duration: string;
  subjects: ExamSubject[];
}

const TeacherAdminExamsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { classId, className } = route.params;

  // States
  const [exams, setExams] = useState<Exam[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showSubjectsModal, setShowSubjectsModal] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [managingExam, setManagingExam] = useState<Exam | null>(null);

  // Form states
  const [formData, setFormData] = useState<ExamFormData>({
    examName: '',
    examCode: '',
    examDate: new Date(),
    duration: '180',
    subjects: [],
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExamFormData, string>>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Set header options
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: `${className} - Exams`,
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
          onPress={handleAddExam}
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
      
      // Load exams and subjects
      await Promise.all([
        loadExams(storedToken),
        loadAvailableSubjects(storedToken)
      ]);
      
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

  // Load exams for the class
  const loadExams = async (authToken = token) => {
    if (!authToken) return;
    
    try {
      setLoading(true);
      const apiClient = getAuthenticatedClient(authToken);
      
      const response = await apiClient.get(`/exams/class/${classId}`);
      
      const { exams: fetchedExams, classInfo: fetchedClassInfo } = response.data;
      
      setExams(fetchedExams || []);
      setClassInfo(fetchedClassInfo);
      
      console.log('Exams loaded:', fetchedExams?.length || 0);
    } catch (error) {
      console.error('Error loading exams:', error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleLogout();
        } else if (!refreshing) {
          Alert.alert('Error', error.response?.data?.msg || 'Failed to load exams');
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load available subjects for the class
  const loadAvailableSubjects = async (authToken = token) => {
    if (!authToken) return;
    
    try {
      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/subjects/class/${classId}/get-or-init`);
      
      setAvailableSubjects(response.data.subjects || []);
      console.log('Subjects loaded:', response.data.subjects?.length || 0);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  // Add new exam
  const addExam = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      const apiClient = getAuthenticatedClient();
      
      const examData = {
        examName: formData.examName.trim(),
        examCode: formData.examCode.trim().toUpperCase(),
        examDate: formData.examDate.toISOString(),
        duration: parseInt(formData.duration),
        subjects: formData.subjects.map(sub => ({
          subjectId: sub.subjectId,
          subjectName: sub.subjectName,
          teacherId: sub.teacherId,
          credits: sub.credits,
          fullMarks: sub.fullMarks
        }))
      };
      
      const response = await apiClient.post(`/exams/class/${classId}`, examData);
      
      Alert.alert('Success', 'Exam created successfully');
      setShowAddModal(false);
      resetForm();
      await loadExams();
    } catch (error) {
      console.error('Error adding exam:', error);
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.msg || 'Failed to create exam');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Update exam
  const updateExam = async () => {
    if (!validateBasicForm() || !editingExam) return;
    
    try {
      setSubmitting(true);
      const apiClient = getAuthenticatedClient();
      
      const updateData = {
        examName: formData.examName.trim(),
        examCode: formData.examCode.trim().toUpperCase(),
        examDate: formData.examDate.toISOString(),
        duration: parseInt(formData.duration),
      };
      
      await apiClient.put(`/exams/class/${classId}/exam/${editingExam._id}`, updateData);
      
      Alert.alert('Success', 'Exam updated successfully');
      setShowEditModal(false);
      setEditingExam(null);
      resetForm();
      await loadExams();
    } catch (error) {
      console.error('Error updating exam:', error);
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.msg || 'Failed to update exam');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete exam
  const deleteExam = (exam: Exam) => {
    Alert.alert(
      'Delete Exam',
      `Are you sure you want to delete "${exam.examName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiClient = getAuthenticatedClient();
              await apiClient.delete(`/exams/class/${classId}/exam/${exam._id}`);
              
              Alert.alert('Success', 'Exam deleted successfully');
              await loadExams();
            } catch (error) {
              console.error('Error deleting exam:', error);
              if (axios.isAxiosError(error)) {
                Alert.alert('Error', error.response?.data?.msg || 'Failed to delete exam');
              }
            }
          }
        }
      ]
    );
  };

  // Add subjects to exam
  const addSubjectsToExam = async (examId: string, subjects: ExamSubject[]) => {
    try {
      setSubmitting(true);
      const apiClient = getAuthenticatedClient();
      
      await apiClient.post(`/exams/class/${classId}/exam/${examId}/subjects`, {
        subjects
      });
      
      Alert.alert('Success', 'Subjects added to exam successfully');
      setShowSubjectsModal(false);
      setManagingExam(null);
      await loadExams();
    } catch (error) {
      console.error('Error adding subjects to exam:', error);
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.msg || 'Failed to add subjects');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Remove subject from exam
  const removeSubjectFromExam = (examId: string, subjectId: string, subjectName: string) => {
    Alert.alert(
      'Remove Subject',
      `Remove "${subjectName}" from this exam?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const apiClient = getAuthenticatedClient();
              await apiClient.delete(`/exams/class/${classId}/exam/${examId}/subject/${subjectId}`);
              
              Alert.alert('Success', 'Subject removed successfully');
              await loadExams();
            } catch (error) {
              console.error('Error removing subject:', error);
              if (axios.isAxiosError(error)) {
                Alert.alert('Error', error.response?.data?.msg || 'Failed to remove subject');
              }
            }
          }
        }
      ]
    );
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ExamFormData, string>> = {};
    
    if (!formData.examName.trim()) {
      errors.examName = 'Exam name is required';
    }
    
    if (!formData.examCode.trim()) {
      errors.examCode = 'Exam code is required';
    }
    
    if (!formData.duration || isNaN(parseInt(formData.duration))) {
      errors.duration = 'Valid duration is required';
    }
    
    if (formData.subjects.length === 0) {
      errors.subjects = 'At least one subject is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateBasicForm = (): boolean => {
    const errors: Partial<Record<keyof ExamFormData, string>> = {};
    
    if (!formData.examName.trim()) {
      errors.examName = 'Exam name is required';
    }
    
    if (!formData.examCode.trim()) {
      errors.examCode = 'Exam code is required';
    }
    
    if (!formData.duration || isNaN(parseInt(formData.duration))) {
      errors.duration = 'Valid duration is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      examName: '',
      examCode: '',
      examDate: new Date(),
      duration: '180',
      subjects: [],
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
    loadExams(token);
  }, [token]);

  // Event handlers
  const handleAddExam = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setFormData({
      examName: exam.examName,
      examCode: exam.examCode,
      examDate: new Date(exam.examDate),
      duration: exam.duration.toString(),
      subjects: [],
    });
    setShowEditModal(true);
  };

  const handleManageSubjects = (exam: Exam) => {
    setManagingExam(exam);
    setShowSubjectsModal(true);
  };

  const handleAddSubjectToForm = (subject: Subject) => {
    const newSubject: ExamSubject = {
      subjectId: subject._id,
      subjectName: subject.name,
      teacherId: subject.teacherId?._id,
      teacherName: subject.teacherId?.name,
      teacherEmail: subject.teacherId?.email,
      credits: subject.credits,
      fullMarks: 100, // Default value
    };
    
    setFormData(prev => ({
      ...prev,
      subjects: [...prev.subjects, newSubject]
    }));
  };

  const handleRemoveSubjectFromForm = (subjectId: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.filter(sub => sub.subjectId !== subjectId)
    }));
  };

  const handleUpdateSubjectMarks = (subjectId: string, fullMarks: number) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.map(sub => 
        sub.subjectId === subjectId ? { ...sub, fullMarks } : sub
      )
    }));
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format duration for display
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Render exam card
  const renderExamCard = ({ item }: { item: Exam }) => (
    <View style={styles.examCard}>
      <LinearGradient
        colors={item.isActive ? ['#1CB5E0', '#38EF7D'] : ['#8A94A6', '#B0B7C3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.examGradientBorder}
      >
        <View style={styles.examCardContent}>
          <View style={styles.examHeader}>
            <View style={styles.examTitleContainer}>
              <Text style={styles.examName}>{item.examName}</Text>
              <Text style={styles.examCode}>Code: {item.examCode}</Text>
            </View>
            <View style={styles.examActions}>
              <TouchableOpacity
                onPress={() => handleEditExam(item)}
                style={styles.actionButton}
              >
                <Feather name="edit-2" size={16} color="#1CB5E0" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => deleteExam(item)}
                style={styles.actionButton}
              >
                <Feather name="trash-2" size={16} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.examDetails}>
            <View style={styles.examDetailItem}>
              <FontAwesome5 name="calendar-alt" size={12} color="#8A94A6" />
              <Text style={styles.examDetailText}>{formatDate(item.examDate)}</Text>
            </View>
            
            <View style={styles.examDetailItem}>
              <FontAwesome5 name="clock" size={12} color="#8A94A6" />
              <Text style={styles.examDetailText}>{formatDuration(item.duration)}</Text>
            </View>
            
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#38EF7D' : '#FF6B6B' }]} />
              <Text style={styles.statusText}>
                {item.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          
          <View style={styles.subjectsSection}>
            <View style={styles.subjectsSummary}>
              <Text style={styles.subjectsCount}>
                {item.subjects.length} Subject{item.subjects.length !== 1 ? 's' : ''}
              </Text>
              <TouchableOpacity
                onPress={() => handleManageSubjects(item)}
                style={styles.manageSubjectsButton}
              >
                <Text style={styles.manageSubjectsText}>Manage</Text>
              </TouchableOpacity>
            </View>
            
            {item.subjects.length > 0 && (
              <View style={styles.subjectsList}>
                {item.subjects.slice(0, 3).map((subject, index) => (
                  <View key={subject.subjectId} style={styles.subjectChip}>
                    <Text style={styles.subjectChipText}>{subject.subjectName}</Text>
                  </View>
                ))}
                {item.subjects.length > 3 && (
                  <View style={styles.subjectChip}>
                    <Text style={styles.subjectChipText}>+{item.subjects.length - 3}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  // Loading screen
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar backgroundColor="#1CB5E0" barStyle="light-content" />
        <ActivityIndicator size="large" color="#1CB5E0" />
        <Text style={styles.loadingText}>Loading exams...</Text>
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
                <FontAwesome5 name="clipboard-list" size={24} color="#FFFFFF" />
                <View style={styles.classInfoDetails}>
                  <Text style={styles.classInfoName}>{classInfo.name}</Text>
                  <Text style={styles.classInfoSection}>Section {classInfo.section}</Text>
                </View>
                <View style={styles.examCount}>
                  <Text style={styles.examCountNumber}>{exams.length}</Text>
                  <Text style={styles.examCountLabel}>Exams</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Exams List */}
        {exams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="clipboard-list" size={48} color="#B0B7C3" />
            <Text style={styles.emptyTitle}>No Exams Yet</Text>
            <Text style={styles.emptyText}>
              Start by creating exams for your class. Click the + button in the header to create your first exam.
            </Text>
          </View>
        ) : (
          <FlatList
            data={exams}
            renderItem={renderExamCard}
            keyExtractor={(item) => item._id}
            scrollEnabled={false}
            contentContainerStyle={styles.examsList}
          />
        )}
      </ScrollView>

      {/* Add Exam Modal */}
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
              <Text style={styles.modalTitle}>Create Exam</Text>
              <TouchableOpacity
                onPress={addExam}
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
                  <Text style={styles.formLabel}>Exam Name *</Text>
                  <View style={[styles.inputContainer, formErrors.examName && styles.inputContainerError]}>
                    <FontAwesome5 name="clipboard-list" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.examName}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, examName: text }))}
                      placeholder="Enter exam name"
                      autoCapitalize="words"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                  {formErrors.examName && (
                    <Text style={styles.errorText}>{formErrors.examName}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Exam Code *</Text>
                  <View style={[styles.inputContainer, formErrors.examCode && styles.inputContainerError]}>
                    <FontAwesome5 name="tag" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.examCode}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, examCode: text }))}
                      placeholder="Enter exam code"
                      autoCapitalize="characters"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                  {formErrors.examCode && (
                    <Text style={styles.errorText}>{formErrors.examCode}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Exam Date *</Text>
                  <TouchableOpacity
                    style={styles.inputContainer}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <FontAwesome5 name="calendar-alt" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <Text style={styles.dateText}>
                      {formData.examDate.toLocaleDateString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Duration (minutes) *</Text>
                  <View style={[styles.inputContainer, formErrors.duration && styles.inputContainerError]}>
                    <FontAwesome5 name="clock" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.duration}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, duration: text }))}
                      placeholder="Enter duration in minutes"
                      keyboardType="numeric"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                  {formErrors.duration && (
                    <Text style={styles.errorText}>{formErrors.duration}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Subjects *</Text>
                  {formErrors.subjects && (
                    <Text style={styles.errorText}>{formErrors.subjects}</Text>
                  )}
                  
                  <View style={styles.subjectsFormSection}>
                    <View style={styles.availableSubjects}>
                      <Text style={styles.sectionTitle}>Available Subjects</Text>
                      {availableSubjects.filter(sub => !formData.subjects.find(s => s.subjectId === sub._id)).map(subject => (
                        <TouchableOpacity
                          key={subject._id}
                          style={styles.availableSubjectItem}
                          onPress={() => handleAddSubjectToForm(subject)}
                        >
                          <View style={styles.subjectInfo}>
                            <Text style={styles.subjectName}>{subject.name}</Text>
                            <Text style={styles.subjectCredits}>{subject.credits} credits</Text>
                          </View>
                          <FontAwesome5 name="plus" size={14} color="#1CB5E0" />
                        </TouchableOpacity>
                      ))}
                    </View>

                    {formData.subjects.length > 0 && (
                      <View style={styles.selectedSubjects}>
                        <Text style={styles.sectionTitle}>Selected Subjects</Text>
                        {formData.subjects.map(subject => (
                          <View key={subject.subjectId} style={styles.selectedSubjectItem}>
                            <View style={styles.subjectItemContent}>
                              <View style={styles.subjectInfo}>
                                <Text style={styles.subjectName}>{subject.subjectName}</Text>
                                <Text style={styles.subjectCredits}>{subject.credits} credits</Text>
                                {subject.teacherName && (
                                  <Text style={styles.teacherName}>Teacher: {subject.teacherName}</Text>
                                )}
                              </View>
                              <View style={styles.marksInput}>
                                <Text style={styles.marksLabel}>Full Marks:</Text>
                                <TextInput
                                  style={styles.marksTextInput}
                                  value={subject.fullMarks.toString()}
                                  onChangeText={(text) => handleUpdateSubjectMarks(subject.subjectId, parseInt(text) || 0)}
                                  keyboardType="numeric"
                                  placeholderTextColor="#B0B7C3"
                                />
                              </View>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRemoveSubjectFromForm(subject.subjectId)}
                              style={styles.removeSubjectButton}
                            >
                              <FontAwesome5 name="trash" size={14} color="#FF6B6B" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </Modal>

      {/* Edit Exam Modal */}
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
                  setEditingExam(null);
                  resetForm();
                }}
                style={styles.modalHeaderButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Exam</Text>
              <TouchableOpacity
                onPress={updateExam}
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
                  <Text style={styles.formLabel}>Exam Name *</Text>
                  <View style={[styles.inputContainer, formErrors.examName && styles.inputContainerError]}>
                    <FontAwesome5 name="clipboard-list" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.examName}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, examName: text }))}
                      placeholder="Enter exam name"
                      autoCapitalize="words"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                  {formErrors.examName && (
                    <Text style={styles.errorText}>{formErrors.examName}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Exam Code *</Text>
                  <View style={[styles.inputContainer, formErrors.examCode && styles.inputContainerError]}>
                    <FontAwesome5 name="tag" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.examCode}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, examCode: text }))}
                      placeholder="Enter exam code"
                      autoCapitalize="characters"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                  {formErrors.examCode && (
                    <Text style={styles.errorText}>{formErrors.examCode}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Exam Date *</Text>
                  <TouchableOpacity
                    style={styles.inputContainer}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <FontAwesome5 name="calendar-alt" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <Text style={styles.dateText}>
                      {formData.examDate.toLocaleDateString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Duration (minutes) *</Text>
                  <View style={[styles.inputContainer, formErrors.duration && styles.inputContainerError]}>
                    <FontAwesome5 name="clock" size={16} color="#8A94A6" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.duration}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, duration: text }))}
                      placeholder="Enter duration in minutes"
                      keyboardType="numeric"
                      placeholderTextColor="#B0B7C3"
                    />
                  </View>
                  {formErrors.duration && (
                    <Text style={styles.errorText}>{formErrors.duration}</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </Modal>

      {/* Manage Subjects Modal */}
      <Modal
        visible={showSubjectsModal}
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
                  setShowSubjectsModal(false);
                  setManagingExam(null);
                }}
                style={styles.modalHeaderButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Manage Subjects</Text>
              <View style={styles.modalHeaderButton} />
            </View>
          </LinearGradient>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {managingExam && (
              <View style={styles.subjectsManagementContainer}>
                <View style={styles.examInfoHeader}>
                  <Text style={styles.examInfoTitle}>{managingExam.examName}</Text>
                  <Text style={styles.examInfoCode}>Code: {managingExam.examCode}</Text>
                </View>

                {/* Current Subjects */}
                <View style={styles.currentSubjectsSection}>
                  <Text style={styles.sectionTitle}>Current Subjects ({managingExam.subjects.length})</Text>
                  {managingExam.subjects.length === 0 ? (
                    <View style={styles.emptySubjectsContainer}>
                      <Text style={styles.emptySubjectsText}>No subjects added yet</Text>
                    </View>
                  ) : (
                    managingExam.subjects.map((subject) => (
                      <View key={subject.subjectId} style={styles.currentSubjectItem}>
                        <View style={styles.subjectItemContent}>
                          <View style={styles.subjectInfo}>
                            <Text style={styles.subjectName}>{subject.subjectName}</Text>
                            <Text style={styles.subjectCredits}>{subject.credits} credits</Text>
                            <Text style={styles.subjectMarks}>Full Marks: {subject.fullMarks}</Text>
                            {subject.teacherName && (
                              <Text style={styles.teacherName}>Teacher: {subject.teacherName}</Text>
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => removeSubjectFromExam(managingExam._id, subject.subjectId, subject.subjectName)}
                            style={styles.removeSubjectButton}
                          >
                            <FontAwesome5 name="trash" size={14} color="#FF6B6B" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                {/* Add More Subjects */}
                <View style={styles.addSubjectsSection}>
                  <Text style={styles.sectionTitle}>Add More Subjects</Text>
                  {availableSubjects.filter(sub => !managingExam.subjects.find(s => s.subjectId === sub._id)).length === 0 ? (
                    <View style={styles.emptySubjectsContainer}>
                      <Text style={styles.emptySubjectsText}>All subjects have been added</Text>
                    </View>
                  ) : (
                    availableSubjects
                      .filter(sub => !managingExam.subjects.find(s => s.subjectId === sub._id))
                      .map((subject) => (
                        <TouchableOpacity
                          key={subject._id}
                          style={styles.availableSubjectItem}
                          onPress={() => {
                            const newSubjects = [{
                              subjectId: subject._id,
                              subjectName: subject.name,
                              teacherId: subject.teacherId?._id,
                              credits: subject.credits,
                              fullMarks: 100
                            }];
                            addSubjectsToExam(managingExam._id, newSubjects);
                          }}
                        >
                          <View style={styles.subjectInfo}>
                            <Text style={styles.subjectName}>{subject.name}</Text>
                            <Text style={styles.subjectCredits}>{subject.credits} credits</Text>
                            {subject.teacherId && (
                              <Text style={styles.teacherName}>Teacher: {subject.teacherId.name}</Text>
                            )}
                          </View>
                          <FontAwesome5 name="plus" size={14} color="#1CB5E0" />
                        </TouchableOpacity>
                      ))
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={formData.examDate}
          mode="date"
          display="default"
          onChange={(event: any, selectedDate: any) => {
            setShowDatePicker(false);
            if (selectedDate) {
              setFormData(prev => ({ ...prev, examDate: selectedDate }));
            }
          }}
          minimumDate={new Date()}
        />
      )}

      {/* Network Status */}
      {!isConnected && (
        <View style={styles.networkStatus}>
          <MaterialIcons name="wifi-off" size={16} color="#FF6B6B" />
          <Text style={styles.networkStatusText}>No internet connection</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    fontWeight: '500',
  },
  headerButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
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
  examCount: {
    alignItems: 'center',
  },
  examCountNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  examCountLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  examsList: {
    paddingBottom: 20,
  },
  examCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  examGradientBorder: {
    borderRadius: 16,
    padding: 2,
  },
  examCardContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  examTitleContainer: {
    flex: 1,
  },
  examName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  examCode: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  examActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  examDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  examDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  examDetailText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  subjectsSection: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  subjectsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  manageSubjectsButton: {
    backgroundColor: '#1CB5E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  manageSubjectsText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  subjectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  subjectChipText: {
    fontSize: 12,
    color: '#3730A3',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeaderGradient: {
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalHeaderButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputContainerError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 12,
  },
  formInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  dateText: {
    fontSize: 16,
    color: '#1E293B',
    flex: 1,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '500',
  },
  subjectsFormSection: {
    marginTop: 8,
  },
  availableSubjects: {
    marginBottom: 20,
  },
  selectedSubjects: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  availableSubjectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  selectedSubjectItem: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 12,
  },
  subjectItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  subjectCredits: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  teacherName: {
    fontSize: 13,
    color: '#8A94A6',
    fontStyle: 'italic',
  },
  marksInput: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  marksLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  marksTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    color: '#1E293B',
    minWidth: 60,
    textAlign: 'center',
  },
  removeSubjectButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  subjectsManagementContainer: {
    padding: 20,
  },
  examInfoHeader: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  examInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  examInfoCode: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  currentSubjectsSection: {
    marginBottom: 24,
  },
  currentSubjectItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  addSubjectsSection: {
    marginTop: 8,
  },
  emptySubjectsContainer: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptySubjectsText: {
    fontSize: 14,
    color: '#8A94A6',
    fontStyle: 'italic',
  },
  subjectMarks: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  networkStatusText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
});

export default TeacherAdminExamsScreen;