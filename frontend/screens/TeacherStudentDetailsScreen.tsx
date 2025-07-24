import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState } from 'react';
import { FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Import the separated components
import PersonalDetailsTab from '../components/PersonalDetailsTab';
import AcademicDetailsTab from '../components/AcademicDetailsTab';
import ConductDetailsTab from '../components/ConductDetailsTab';
import SubmissionDetailsTab from '../components/SubmissionDetailsTab';

import { API_BASE_URL} from '../config/api';

const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

type TeacherStudentDetailsParams = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherStudentDetailsScreen'>;

interface StudentProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  studentId: string;
  uniqueId: string;
  className: string;
  section: string;
  schoolId: string;
  schoolName?: string;
  schoolCode?: string;
  classId: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface TeacherSubjectMark {
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName?: string;
  fullMarks: number;
  marksScored: number | null;
  percentage: number | null;
  grade: string | null;
  isCompleted: boolean;
  scoredBy: string | null;
  scoredAt: string | null;
}

interface TeacherExamResult {
  examId: string;
  examName: string;
  examCode: string;
  examDate: string;
  subjects: TeacherSubjectMark[];
  totalMarksScored: number;
  totalFullMarks: number;
  percentage: string;
  grade: string | null;
  isCompleted: boolean;
  completedSubjects: number;
  totalSubjects: number;
}

interface TeacherAcademicData {
  hasData: boolean;
  message?: string;
  exams: TeacherExamResult[];
  summary: {
    overallPercentage: string;
    overallGrade: string;
    totalExams: number;
    completedExams: number;
    totalSubjects: number;
    completedSubjects: number;
    completionRate: string;
    totalMarksScored: number;
    totalFullMarks: number;
    examCompletionRate: string;
  } | null;
  lastUpdated?: string;
}

interface ConductEntry {
  _id: string;
  studentId: string;
  teacherId: string;
  classId: string;
  schoolId: string;
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  date: string;
  isActive: boolean;
  severity: 'low' | 'medium' | 'high';
  actionTaken?: string;
  parentNotified: boolean;
  followUpRequired: boolean;
  followUpDate?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  teacherName?: string;
  studentName?: string;
}

interface ConductSummary {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  lastEntry: string | null;
}

interface ConductData {
  conducts: ConductEntry[];
  summary: ConductSummary;
  totalRecords: number;
}

const TeacherStudentDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { studentId, studentName, classId, className } = route.params as unknown as TeacherStudentDetailsParams;
  
  // States
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [academicData, setAcademicData] = useState<TeacherAcademicData | null>(null);
  const [conductData, setConductData] = useState<ConductData | null>(null);
  const [conductLoading, setConductLoading] = useState<boolean>(false);
  const [conductError, setConductError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'academic' | 'conduct' | 'submissions'>('personal');
  
  // Conduct modal states
  const [conductModalVisible, setConductModalVisible] = useState(false);
  const [newConductType, setNewConductType] = useState<'positive' | 'negative' | 'neutral'>('positive');
  const [newConductTitle, setNewConductTitle] = useState('');
  const [newConductDescription, setNewConductDescription] = useState('');
  const [newConductSeverity, setNewConductSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [newConductActionTaken, setNewConductActionTaken] = useState('');
  const [newConductParentNotified, setNewConductParentNotified] = useState(false);
  const [newConductFollowUpRequired, setNewConductFollowUpRequired] = useState(false);
  const [addingConduct, setAddingConduct] = useState(false);

  // Set header title
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: studentName || 'Student Details',
      headerShown: true,
      headerStyle: { backgroundColor: '#FFFFFF' },
      headerTintColor: '#3A4276',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
    });
  }, [navigation, studentName]);

  // Check network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('teacherToken');
        if (!storedToken) {
          navigation.reset({ index: 0, routes: [{ name: 'TeacherLogin' }] });
          return;
        }
        setToken(storedToken);
        fetchAllData(storedToken);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data');
        setLoading(false);
      }
    };
    loadData();
  }, [studentId]);

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

  const calculateGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C+';
    if (percentage >= 40) return 'C';
    if (percentage >= 33) return 'D';
    return 'F';
  };

  // Clean fetchConductData function
  const fetchConductData = async (authToken = token) => {
    setConductLoading(true);
    setConductError(null);
    
    try {
      if (!authToken) return;
      
      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/conduct/class/${classId}/student/${studentId}`);
      
      if (response.data) {
        const conducts = response.data.conducts || [];
        
        const calculateSummary = (conductRecords: ConductEntry[]): ConductSummary => {
          const summary = { positive: 0, negative: 0, neutral: 0, total: 0, lastEntry: null as string | null };
          
          if (conductRecords.length === 0) return summary;
          
          const activeRecords = conductRecords.filter(conduct => 
            conduct.isActive === undefined || conduct.isActive === null || conduct.isActive === true
          );
          
          activeRecords.forEach((conduct) => {
            const conductType = conduct.type ? conduct.type.toString().toLowerCase().trim() : '';
            switch (conductType) {
              case 'positive': summary.positive++; break;
              case 'negative': summary.negative++; break;
              case 'neutral': summary.neutral++; break;
            }
          });
          
          summary.total = summary.positive + summary.negative + summary.neutral;
          
          if (activeRecords.length > 0) {
            const sortedByDate = [...activeRecords].sort((a, b) => {
              const dateA = new Date(a.createdAt || a.date || a.updatedAt);
              const dateB = new Date(b.createdAt || b.date || b.updatedAt);
              return dateB.getTime() - dateA.getTime();
            });
            
            if (sortedByDate.length > 0) {
              summary.lastEntry = sortedByDate[0].createdAt || sortedByDate[0].date || sortedByDate[0].updatedAt;
            }
          }
          
          return summary;
        };
        
        let finalSummary;
        
        if (response.data.summary && typeof response.data.summary === 'object' && response.data.summary !== null) {
          const apiSummary = response.data.summary;
          const hasValidNumbers = 
            typeof apiSummary.positive === 'number' &&
            typeof apiSummary.negative === 'number' &&
            typeof apiSummary.neutral === 'number';
          
          if (hasValidNumbers) {
            finalSummary = {
              positive: Math.max(0, apiSummary.positive || 0),
              negative: Math.max(0, apiSummary.negative || 0),
              neutral: Math.max(0, apiSummary.neutral || 0),
              total: Math.max(0, apiSummary.total || (apiSummary.positive + apiSummary.negative + apiSummary.neutral)),
              lastEntry: apiSummary.lastEntry || null
            };
          } else {
            finalSummary = calculateSummary(conducts);
          }
        } else {
          finalSummary = calculateSummary(conducts);
        }
        
        const activeCount = conducts.filter((c: { isActive: boolean; }) => c.isActive !== false).length;
        if (finalSummary.total !== activeCount && activeCount > 0) {
          finalSummary = calculateSummary(conducts);
        }
        
        setConductData({
          conducts: conducts,
          summary: finalSummary,
          totalRecords: response.data.totalRecords || conducts.length
        });
        
      } else {
        setConductData({
          conducts: [],
          summary: { positive: 0, negative: 0, neutral: 0, total: 0, lastEntry: null },
          totalRecords: 0
        });
      }
      
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 401) {
          handleSessionExpired();
        } else if (err.response?.status === 403) {
          setConductError('Not authorized to view conduct records for this class');
        } else if (err.response?.status === 404) {
          setConductError('Student not found in this class');
        } else {
          setConductError(err.response?.data?.msg || 'Failed to fetch conduct records');
        }
      } else {
        setConductError('An unknown error occurred while fetching conduct records');
      }
    } finally {
      setConductLoading(false);
    }
  };

  // Fetch all student data
  const fetchAllData = async (authToken = token) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!authToken) {
        navigation.reset({ index: 0, routes: [{ name: 'TeacherLogin' }] });
        return;
      }

      if (!isConnected) {
        setError('No internet connection. Please check your network.');
        setLoading(false);
        return;
      }

      const apiClient = getAuthenticatedClient(authToken);

      // Fetch student profile
      try {
        console.log('Fetching student profile for ID:', studentId);
        const profileResponse = await apiClient.get(`/teacher/student/${studentId}/profile`);
        
        if (profileResponse.data) {
          setStudentProfile(profileResponse.data);
          console.log('Student profile loaded:', profileResponse.data);
        }
      } catch (err) {
        console.error('Error fetching student profile:', err);
        
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 401) {
            handleSessionExpired();
            return;
          } else if (err.response?.status === 404) {
            setError('Student not found');
            return;
          } else if (err.response?.status === 403) {
            setError('Not authorized to view this student\'s profile');
            return;
          } else {
            setError(`Failed to load student profile: ${err.response?.data?.message || 'Unknown error'}`);
            return;
          }
        } else {
          setError('Failed to load student profile');
          return;
        }
      }

      // Fetch academic data
      try {
        console.log('Fetching academic data for student:', studentId, 'in class:', classId);
        const academicResponse = await apiClient.get(`/marks/class/${classId}/student/${studentId}/details`);
        
        if (academicResponse.data) {
          const processedAcademicData: TeacherAcademicData = {
            hasData: academicResponse.data.exams && academicResponse.data.exams.length > 0,
            exams: academicResponse.data.exams || [],
            summary: null,
            message: academicResponse.data.exams?.length === 0 ? 'No academic records found for subjects you teach' : undefined
          };

          if (processedAcademicData.exams.length > 0) {
            let totalMarksScored = 0;
            let totalFullMarks = 0;
            let completedExams = 0;
            let totalSubjects = 0;
            let completedSubjects = 0;

            processedAcademicData.exams.forEach(exam => {
              totalMarksScored += exam.totalMarksScored;
              totalFullMarks += exam.totalFullMarks;
              totalSubjects += exam.totalSubjects;
              completedSubjects += exam.completedSubjects;
              if (exam.isCompleted) completedExams++;
            });

            const overallPercentage = totalFullMarks > 0 ? ((totalMarksScored / totalFullMarks) * 100) : 0;
            
            processedAcademicData.summary = {
              overallPercentage: overallPercentage.toFixed(2),
              overallGrade: calculateGrade(overallPercentage),
              totalExams: processedAcademicData.exams.length,
              completedExams: completedExams,
              totalSubjects: totalSubjects,
              completedSubjects: completedSubjects,
              completionRate: totalSubjects > 0 ? ((completedSubjects / totalSubjects) * 100).toFixed(2) : '0',
              totalMarksScored: totalMarksScored,
              totalFullMarks: totalFullMarks,
              examCompletionRate: processedAcademicData.exams.length > 0 ? ((completedExams / processedAcademicData.exams.length) * 100).toFixed(2) : '0'
            };
          }

          setAcademicData(processedAcademicData);
        }
      } catch (err) {
        console.log('Academic data fetch error:', err);
        setAcademicData({
          hasData: false,
          message: 'No academic records available or you do not teach any subjects for this student',
          exams: [],
          summary: null
        });
      }

      // Fetch conduct data
      await fetchConductData(authToken);

    } catch (error) {
      console.error('Error fetching student data:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else {
          setError(`Error: ${error.response?.data?.message || error.response?.data?.msg || 'Failed to fetch student data'}`);
        }
      } else {
        setError('An unknown error occurred while loading student data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  // Handle conduct refresh
  const onConductRefresh = () => {
    fetchConductData();
  };

  // Handle session expired
  const handleSessionExpired = () => {
    Alert.alert(
      "Session Expired",
      "Your session has expired. Please login again.",
      [{
        text: "OK",
        onPress: async () => {
          await AsyncStorage.removeItem('teacherToken');
          navigation.reset({ index: 0, routes: [{ name: 'TeacherLogin' }] });
        }
      }]
    );
  };

  // Add conduct entry
  const addConductEntry = async () => {
    if (!newConductTitle.trim() || !newConductDescription.trim()) {
      Alert.alert('Error', 'Please fill in title and description');
      return;
    }

    setAddingConduct(true);
    
    try {
      if (!token) {
        handleSessionExpired();
        return;
      }

      const apiClient = getAuthenticatedClient(token);
      
      const conductData = {
        type: newConductType,
        title: newConductTitle.trim(),
        description: newConductDescription.trim(),
        severity: newConductSeverity,
        actionTaken: newConductActionTaken.trim() || undefined,
        parentNotified: newConductParentNotified,
        followUpRequired: newConductFollowUpRequired,
      };

      console.log('Creating conduct entry:', conductData);
      
      const response = await apiClient.post(`/conduct/class/${classId}/student/${studentId}`, conductData);
      
      if (response.data) {
        resetConductForm();
        setConductModalVisible(false);
        await fetchConductData();
        Alert.alert('Success', 'Conduct entry added successfully');
      }
    } catch (error) {
      console.error('Error adding conduct entry:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else if (error.response?.status === 403) {
          Alert.alert('Error', 'Not authorized to add conduct records for this class');
        } else if (error.response?.status === 404) {
          Alert.alert('Error', 'Student not found in this class');
        } else {
          Alert.alert('Error', error.response?.data?.msg || 'Failed to add conduct entry');
        }
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setAddingConduct(false);
    }
  };

  // Delete conduct entry
  const deleteConductEntry = async (conductId: string) => {
    try {
      if (!token) {
        handleSessionExpired();
        return;
      }

      const apiClient = getAuthenticatedClient(token);
      await apiClient.delete(`/conduct/${conductId}`);
      await fetchConductData();
      Alert.alert('Success', 'Conduct entry deleted successfully');
    } catch (error) {
      console.error('Error deleting conduct entry:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else if (error.response?.status === 403) {
          Alert.alert('Error', 'Not authorized to delete this conduct record');
        } else if (error.response?.status === 404) {
          Alert.alert('Error', 'Conduct record not found');
        } else {
          Alert.alert('Error', error.response?.data?.msg || 'Failed to delete conduct entry');
        }
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    }
  };

  // Get conduct type color
  const getConductTypeColor = (type: string) => {
    switch (type) {
      case 'positive': return '#38EF7D';
      case 'negative': return '#F7685B';
      case 'neutral': return '#1CB5E0';
      default: return '#8A94A6';
    }
  };

  // Render tab buttons
  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      {[
        { key: 'personal', icon: 'user', label: 'Personal' },
        { key: 'academic', icon: 'graduation-cap', label: 'Academic' },
        { key: 'conduct', icon: 'star', label: 'Conduct' },
        { key: 'submissions', icon: 'file-alt', label: 'Submission' }
      ].map(({ key, icon, label }) => (
        <TouchableOpacity
          key={key}
          style={[styles.tabButton, activeTab === key && styles.activeTab]}
          onPress={() => setActiveTab(key as any)}
        >
          <FontAwesome5 name={icon} size={16} color={activeTab === key ? '#1CB5E0' : '#8A94A6'} />
          <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Reset conduct form
  const resetConductForm = () => {
    setNewConductTitle('');
    setNewConductDescription('');
    setNewConductType('positive');
    setNewConductSeverity('medium');
    setNewConductActionTaken('');
    setNewConductParentNotified(false);
    setNewConductFollowUpRequired(false);
  };

  // Show loading indicator
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#1CB5E0" />
        <Text style={styles.loadingText}>Loading student details...</Text>
      </SafeAreaView>
    );
  }

  // Show error message
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar hidden={true} />
        <FontAwesome5 name="exclamation-circle" size={48} color="#F7685B" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchAllData()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />
      
      {renderTabButtons()}
      
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#1CB5E0', '#38EF7D']}
          />
        }
      >
        {activeTab === 'personal' && (
          <PersonalDetailsTab 
            studentProfile={studentProfile} 
            loading={loading && !refreshing} 
          />
        )}
        
        {activeTab === 'academic' && (
          <AcademicDetailsTab academicData={academicData} />
        )}
        
        {activeTab === 'conduct' && (
          <ConductDetailsTab 
            conductData={conductData}
            loading={conductLoading}
            error={conductError}
            onAddConduct={() => setConductModalVisible(true)}
            onRefresh={onConductRefresh}
            onDeleteConduct={deleteConductEntry}
          />
        )}
        
        {activeTab === 'submissions' && (
          <SubmissionDetailsTab 
            studentId={studentId}
            classId={classId}
            loading={loading && !refreshing}
            onSessionExpired={handleSessionExpired}
          />
        )}
      </ScrollView>

      {/* Add Conduct Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={conductModalVisible}
        onRequestClose={() => {
          setConductModalVisible(false);
          resetConductForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Conduct Entry</Text>
              <TouchableOpacity onPress={() => {
                setConductModalVisible(false);
                resetConductForm();
              }}>
                <FontAwesome5 name="times" size={20} color="#8A94A6" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Type *</Text>
              <View style={styles.typeSelector}>
                {['positive', 'neutral', 'negative'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      newConductType === type && styles.selectedTypeButton,
                      { borderColor: getConductTypeColor(type) }
                    ]}
                    onPress={() => setNewConductType(type as 'positive' | 'negative' | 'neutral')}
                  >
                    <Text style={[
                      styles.typeButtonText,
                      newConductType === type && { color: getConductTypeColor(type) }
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={newConductTitle}
                onChangeText={setNewConductTitle}
                placeholder="Enter title..."
                maxLength={100}
              />
              
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newConductDescription}
                onChangeText={setNewConductDescription}
                placeholder="Enter description..."
                multiline
                numberOfLines={4}
                maxLength={500}
              />

              <Text style={styles.inputLabel}>Severity</Text>
              <View style={styles.severitySelector}>
                {['low', 'medium', 'high'].map((severity) => (
                  <TouchableOpacity
                    key={severity}
                    style={[
                      styles.severityButton,
                      newConductSeverity === severity && styles.selectedSeverityButton
                    ]}
                    onPress={() => setNewConductSeverity(severity as 'low' | 'medium' | 'high')}
                  >
                    <Text style={[
                      styles.severityButtonText,
                      newConductSeverity === severity && styles.selectedSeverityButtonText
                    ]}>
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Action Taken (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newConductActionTaken}
                onChangeText={setNewConductActionTaken}
                placeholder="Describe any action taken..."
                multiline
                numberOfLines={3}
                maxLength={300}
              />

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setNewConductParentNotified(!newConductParentNotified)}
                >
                  {newConductParentNotified && (
                    <FontAwesome5 name="check" size={12} color="#1CB5E0" />
                  )}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>Parent Notified</Text>
              </View>

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => setNewConductFollowUpRequired(!newConductFollowUpRequired)}
                >
                  {newConductFollowUpRequired && (
                    <FontAwesome5 name="check" size={12} color="#1CB5E0" />
                  )}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>Follow-up Required</Text>
              </View>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setConductModalVisible(false);
                    resetConductForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={addConductEntry}
                  disabled={addingConduct}
                >
                  {addingConduct ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Add Entry</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#F7685B',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1CB5E0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#E6F7FF',
  },
  tabText: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 4,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1CB5E0',
    fontWeight: '600',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
    marginTop: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  selectedTypeButton: {
    backgroundColor: '#F8F9FB',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A94A6',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#3A4276',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  severitySelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  selectedSeverityButton: {
    backgroundColor: '#1CB5E0',
    borderColor: '#1CB5E0',
  },
  severityButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8A94A6',
  },
  selectedSeverityButtonText: {
    color: '#FFFFFF',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A94A6',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#1CB5E0',
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default TeacherStudentDetailsScreen;