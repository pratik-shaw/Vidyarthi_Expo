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
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import DateTimePicker from '@react-native-community/datetimepicker';

import { API_BASE_URL} from '../config/api';

const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminExams'>;

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

  const [exams, setExams] = useState<Exam[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showSubjectsModal, setShowSubjectsModal] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [managingExam, setManagingExam] = useState<Exam | null>(null);

  const [formData, setFormData] = useState<ExamFormData>({
    examName: '',
    examCode: '',
    examDate: new Date(),
    duration: '180',
    subjects: [],
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExamFormData, string>>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `Exams - ${className}`,
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2D3748',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
      headerRight: () => (
        <TouchableOpacity
          onPress={handleAddExam}
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
      await Promise.all([
        loadExams(storedToken),
        loadAvailableSubjects(storedToken)
      ]);
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

  const loadExams = async (authToken = token) => {
    if (!authToken) return;
    
    try {
      setLoading(true);
      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/exams/class/${classId}`);
      
      const { exams: fetchedExams, classInfo: fetchedClassInfo } = response.data;
      setExams(fetchedExams || []);
      setClassInfo(fetchedClassInfo);
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

  const loadAvailableSubjects = async (authToken = token) => {
    if (!authToken) return;
    
    try {
      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/subjects/class/${classId}/get-or-init`);
      setAvailableSubjects(response.data.subjects || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

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
      
      await apiClient.post(`/exams/class/${classId}`, examData);
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

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['teacherToken', 'teacherData', 'userRole']);
    navigation.reset({
      index: 0,
      routes: [{ name: 'TeacherLogin' }],
    });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadExams(token);
  }, [token]);

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
      fullMarks: 100,
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const renderExamCard = ({ item }: { item: Exam }) => (
  <View style={styles.examCard}>
    <View style={styles.examCardHeader}>
      <View style={styles.examIconContainer}>
        <FontAwesome5 name="clipboard-list" size={20} color="#4299E1" />
      </View>
      
      <View style={styles.examHeaderInfo}>
        <View style={styles.examTitleRow}>
          <Text style={styles.examName}>{item.examName}</Text>
          {item.examCode && (
            <Text style={styles.examCode}>({item.examCode})</Text>
          )}
        </View>
        
        <View style={[styles.statusBadge, { 
          backgroundColor: item.isActive ? '#C6F6D5' : '#FED7D7',
          alignSelf: 'flex-start'
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

      <View style={styles.examActions}>
        <TouchableOpacity
          onPress={() => handleEditExam(item)}
          style={styles.iconButton}
        >
          <Feather name="edit-2" size={16} color="#4299E1" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => deleteExam(item)}
          style={[styles.iconButton, { marginTop: 8 }]}
        >
          <Feather name="trash-2" size={16} color="#E53E3E" />
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.examMeta}>
      <View style={styles.metaItem}>
        <FontAwesome5 name="calendar-alt" size={11} color="#718096" />
        <Text style={styles.metaText}>{formatDate(item.examDate)}</Text>
      </View>
      
      <View style={styles.metaItem}>
        <FontAwesome5 name="clock" size={11} color="#718096" />
        <Text style={styles.metaText}>{formatDuration(item.duration)}</Text>
      </View>
    </View>
    
    <View style={styles.subjectsInfo}>
      <View style={styles.subjectsSummary}>
        <FontAwesome5 name="book" size={11} color="#4299E1" />
        <Text style={styles.subjectsCountText}>
          {item.subjects.length} Subject{item.subjects.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleManageSubjects(item)}
        style={styles.manageButton}
      >
        <Text style={styles.manageText}>Manage</Text>
      </TouchableOpacity>
    </View>
  </View>
);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar hidden={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4299E1" />
          <Text style={styles.loadingText}>Loading exams...</Text>
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
                <FontAwesome5 name="clipboard-list" size={20} color="#38A169" />
              </View>
              <Text style={styles.summaryNumber}>{exams.length}</Text>
              <Text style={styles.summaryLabel}>Total Exams</Text>
            </View>
          </View>
        </View>

        {/* Exams List */}
        {exams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="clipboard-list" size={64} color="#CBD5E0" />
            <Text style={styles.emptyTitle}>No Exams Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start by creating exams for your class. Tap the + button in the header to create your first exam.
            </Text>
          </View>
        ) : (
          <View style={styles.examsSection}>
            <Text style={styles.sectionTitle}>Exams</Text>
            <Text style={styles.sectionSubtitle}>
              Manage exams and their subjects
            </Text>
            <FlatList
              data={exams}
              renderItem={renderExamCard}
              keyExtractor={(item) => item._id}
              scrollEnabled={false}
              contentContainerStyle={styles.examsList}
            />
          </View>
        )}
      </ScrollView>

      {/* Add Exam Modal */}
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
            <Text style={styles.modalTitle}>Create Exam</Text>
            <TouchableOpacity
              onPress={addExam}
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
                  <Text style={styles.formLabel}>Exam Name *</Text>
                  <View style={[styles.inputContainer, formErrors.examName && styles.inputError]}>
                    <FontAwesome5 name="clipboard-list" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.examName}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, examName: text }))}
                      placeholder="Enter exam name"
                      autoCapitalize="words"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                  {formErrors.examName && (
                    <Text style={styles.errorText}>{formErrors.examName}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Exam Code *</Text>
                  <View style={[styles.inputContainer, formErrors.examCode && styles.inputError]}>
                    <FontAwesome5 name="tag" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.examCode}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, examCode: text }))}
                      placeholder="Enter exam code"
                      autoCapitalize="characters"
                      placeholderTextColor="#A0AEC0"
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
                    <FontAwesome5 name="calendar-alt" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <Text style={styles.dateText}>
                      {formData.examDate.toLocaleDateString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Duration (minutes) *</Text>
                  <View style={[styles.inputContainer, formErrors.duration && styles.inputError]}>
                    <FontAwesome5 name="clock" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.duration}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, duration: text }))}
                      placeholder="Enter duration in minutes"
                      keyboardType="numeric"
                      placeholderTextColor="#A0AEC0"
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
                    {availableSubjects.filter(sub => !formData.subjects.find(s => s.subjectId === sub._id)).length > 0 && (
                      <View style={styles.availableSubjectsSection}>
                        <Text style={styles.subSectionTitle}>Available Subjects</Text>
                        {availableSubjects.filter(sub => !formData.subjects.find(s => s.subjectId === sub._id)).map(subject => (
                          <TouchableOpacity
                            key={subject._id}
                            style={styles.availableSubjectItem}
                            onPress={() => handleAddSubjectToForm(subject)}
                          >
                            <View style={styles.subjectItemInfo}>
                              <Text style={styles.subjectItemName}>{subject.name}</Text>
                              <Text style={styles.subjectItemCredits}>{subject.credits} credits</Text>
                            </View>
                            <FontAwesome5 name="plus" size={14} color="#4299E1" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {formData.subjects.length > 0 && (
                      <View style={styles.selectedSubjectsSection}>
                        <Text style={styles.subSectionTitle}>Selected Subjects ({formData.subjects.length})</Text>
                        {formData.subjects.map(subject => (
                          <View key={subject.subjectId} style={styles.selectedSubjectItem}>
                            <View style={styles.selectedSubjectContent}>
                              <View style={styles.subjectItemInfo}>
                                <Text style={styles.subjectItemName}>{subject.subjectName}</Text>
                                <Text style={styles.subjectItemCredits}>{subject.credits} credits</Text>
                                {subject.teacherName && (
                                  <Text style={styles.subjectTeacher}>Teacher: {subject.teacherName}</Text>
                                )}
                              </View>
                              <View style={styles.marksInputContainer}>
                                <Text style={styles.marksLabel}>Marks:</Text>
                                <TextInput
                                  style={styles.marksInput}
                                  value={subject.fullMarks.toString()}
                                  onChangeText={(text) => handleUpdateSubjectMarks(subject.subjectId, parseInt(text) || 0)}
                                  keyboardType="numeric"
                                  placeholderTextColor="#A0AEC0"
                                />
                              </View>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRemoveSubjectFromForm(subject.subjectId)}
                              style={styles.removeButton}
                            >
                              <FontAwesome5 name="trash" size={12} color="#742A2A" />
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
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {setShowEditModal(false);
                setEditingExam(null);
                resetForm();
              }}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={20} color="#2D3748" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Exam</Text>
            <TouchableOpacity
              onPress={updateExam}
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
                  <Text style={styles.formLabel}>Exam Name *</Text>
                  <View style={[styles.inputContainer, formErrors.examName && styles.inputError]}>
                    <FontAwesome5 name="clipboard-list" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.examName}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, examName: text }))}
                      placeholder="Enter exam name"
                      autoCapitalize="words"
                      placeholderTextColor="#A0AEC0"
                    />
                  </View>
                  {formErrors.examName && (
                    <Text style={styles.errorText}>{formErrors.examName}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Exam Code *</Text>
                  <View style={[styles.inputContainer, formErrors.examCode && styles.inputError]}>
                    <FontAwesome5 name="tag" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.examCode}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, examCode: text }))}
                      placeholder="Enter exam code"
                      autoCapitalize="characters"
                      placeholderTextColor="#A0AEC0"
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
                    <FontAwesome5 name="calendar-alt" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <Text style={styles.dateText}>
                      {formData.examDate.toLocaleDateString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Duration (minutes) *</Text>
                  <View style={[styles.inputContainer, formErrors.duration && styles.inputError]}>
                    <FontAwesome5 name="clock" size={14} color="#A0AEC0" style={styles.inputIcon} />
                    <TextInput
                      style={styles.formInput}
                      value={formData.duration}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, duration: text }))}
                      placeholder="Enter duration in minutes"
                      keyboardType="numeric"
                      placeholderTextColor="#A0AEC0"
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
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowSubjectsModal(false);
                setManagingExam(null);
              }}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={20} color="#2D3748" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Manage Subjects</Text>
          </View>
          
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {managingExam && (
              <View style={styles.subjectsManagementContainer}>
                <View style={styles.examInfoHeader}>
                  <Text style={styles.examInfoTitle}>{managingExam.examName}</Text>
                  <Text style={styles.examInfoCode}>Code: {managingExam.examCode}</Text>
                </View>

                {/* Current Subjects */}
                <View style={styles.currentSubjectsSection}>
                  <Text style={styles.subSectionTitle}>Current Subjects ({managingExam.subjects.length})</Text>
                  {managingExam.subjects.length === 0 ? (
                    <View style={styles.emptySubjectsContainer}>
                      <FontAwesome5 name="book-open" size={32} color="#CBD5E0" />
                      <Text style={styles.emptySubjectsText}>No subjects added yet</Text>
                    </View>
                  ) : (
                    managingExam.subjects.map((subject) => (
                      <View key={subject.subjectId} style={styles.currentSubjectItem}>
                        <View style={styles.subjectItemContent}>
                          <View style={styles.subjectItemInfo}>
                            <Text style={styles.subjectItemName}>{subject.subjectName}</Text>
                            <Text style={styles.subjectItemCredits}>{subject.credits} credits • {subject.fullMarks} marks</Text>
                            {subject.teacherName && (
                              <Text style={styles.subjectTeacher}>Teacher: {subject.teacherName}</Text>
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => removeSubjectFromExam(managingExam._id, subject.subjectId, subject.subjectName)}
                            style={styles.removeButton}
                          >
                            <FontAwesome5 name="trash" size={12} color="#742A2A" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                {/* Add More Subjects */}
                <View style={styles.addSubjectsSection}>
                  <Text style={styles.subSectionTitle}>Add More Subjects</Text>
                  {availableSubjects.filter(sub => !managingExam.subjects.find(s => s.subjectId === sub._id)).length === 0 ? (
                    <View style={styles.emptySubjectsContainer}>
                      <FontAwesome5 name="check-circle" size={32} color="#48BB78" />
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
                          <View style={styles.subjectItemInfo}>
                            <Text style={styles.subjectItemName}>{subject.name}</Text>
                            <Text style={styles.subjectItemCredits}>{subject.credits} credits</Text>
                            {subject.teacherId && (
                              <Text style={styles.subjectTeacher}>Teacher: {subject.teacherId.name}</Text>
                            )}
                          </View>
                          <FontAwesome5 name="plus" size={14} color="#4299E1" />
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
          <MaterialIcons name="wifi-off" size={14} color="#E53E3E" />
          <Text style={styles.networkStatusText}>No internet connection</Text>
        </View>
      )}
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
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBF8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 8,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
  examsSection: {
    marginTop: 8,
    paddingHorizontal: 16,
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
  examsList: {
    paddingBottom: 16,
  },
  examCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  marginBottom: 12,
  padding: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
},
  examCardHeader: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginBottom: 12,
},
  examIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  examInfo: {
    flex: 1,
  },
  examHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  examName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
    marginRight: 8,
  },
  examCode: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
  },
  examMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subjectsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  subjectsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectsCountText: {
    fontSize: 13,
    color: '#4299E1',
    fontWeight: '600',
  },
  manageButton: {
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  manageText: {
    fontSize: 13,
    color: '#4299E1',
    fontWeight: '600',
  },
 examActions: {
  marginLeft: 12,
},
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
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
    fontSize: 17,
    fontWeight: '600',
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
  },
  formContainer: {
    padding: 16,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: '#FC8181',
  },
  inputIcon: {
    marginRight: 10,
  },
  formInput: {
    flex: 1,
    fontSize: 15,
    color: '#2D3748',
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    color: '#2D3748',
  },
  errorText: {
    fontSize: 12,
    color: '#E53E3E',
    marginTop: 4,
    fontWeight: '500',
  },
  subjectsFormSection: {
    marginTop: 8,
  },
  availableSubjectsSection: {
    marginBottom: 20,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  availableSubjectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  subjectItemInfo: {
    flex: 1,
  },
  subjectItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  subjectItemCredits: {
    fontSize: 13,
    color: '#718096',
  },
  subjectTeacher: {
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 2,
    fontStyle: 'italic',
  },
  selectedSubjectsSection: {
    marginTop: 8,
  },
  selectedSubjectItem: {
    backgroundColor: '#EBF8FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BEE3F8',
    marginBottom: 12,
  },
  selectedSubjectContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  marksInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marksLabel: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
  },
  marksInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: '#2D3748',
    minWidth: 60,
    textAlign: 'center',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FED7D7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  subjectsManagementContainer: {
    padding: 16,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  examInfoCode: {
    fontSize: 13,
    color: '#718096',
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
  subjectItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  addSubjectsSection: {
    marginTop: 8,
  },
  emptySubjectsContainer: {
    backgroundColor: '#F7FAFC',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptySubjectsText: {
    fontSize: 13,
    color: '#A0AEC0',
    marginTop: 8,
    textAlign: 'center',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FED7D7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  networkStatusText: {
    fontSize: 12,
    color: '#742A2A',
    fontWeight: '500',
  },
  examHeaderInfo: {
  flex: 1,
  marginLeft: 12,
},
examTitleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: 8,
},
});

export default TeacherAdminExamsScreen;