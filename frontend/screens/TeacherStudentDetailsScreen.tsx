import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  TextStyle,
  ViewStyle
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect, useState } from 'react';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// API base URL - replace with your actual backend URL
const API_URL = 'http://192.168.29.148:5000/api';
const API_TIMEOUT = 15000; // 15 seconds timeout

// Route params type
type TeacherStudentDetailsParams = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherStudentDetailsScreen'>;

// Define interfaces
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
  isActive: boolean;
}

interface SubjectMark {
  subjectId: string;
  subjectName: string;
  marks: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
}

interface ExamResult {
  examId: string;
  examName: string;
  examType: string;
  date: string;
  subjects: SubjectMark[];
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade?: string;
}

interface AcademicData {
  results: ExamResult[];
  overallPerformance?: {
    averagePercentage: number;
    totalExams: number;
    grade: string;
  };
}

interface ConductEntry {
  _id: string;
  date: string;
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  teacherName: string;
}

interface Submission {
  _id: string;
  title: string;
  subject: string;
  submittedDate: string;
  dueDate: string;
  status: 'submitted' | 'late' | 'pending';
  grade?: string;
  feedback?: string;
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

const TeacherStudentDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { studentId, studentName, classId, className } = route.params as unknown as TeacherStudentDetailsParams;
  
  // States
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [academicData, setAcademicData] = useState<TeacherAcademicData | null>(null);
  const [conductEntries, setConductEntries] = useState<ConductEntry[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
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
  const [addingConduct, setAddingConduct] = useState(false);

  // Set header title
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: studentName || 'Student Details',
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
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

    return () => {
      unsubscribe();
    };
  }, []);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
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
  // Fetch all student data
  const fetchAllData = async (authToken = token) => {
  setLoading(true);
  setError(null);
  
  try {
    if (!authToken) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
      return;
    }

    if (!isConnected) {
      setError('No internet connection. Please check your network.');
      setLoading(false);
      return;
    }

    const apiClient = getAuthenticatedClient(authToken);
    
    // Fetch student profile (mock for now - you can implement actual API later)
    const mockProfile: StudentProfile = {
      _id: studentId,
      name: studentName,
      email: 'student@example.com',
      phone: '+91 9876543210',
      studentId: 'ST001',
      uniqueId: 'UNIQUE001',
      className: className,
      section: 'A',
      schoolId: 'school123',
      isActive: true
    };
    setStudentProfile(mockProfile);

    // Fetch academic data from the new endpoint
    try {
      console.log('Fetching academic data for student:', studentId, 'in class:', classId);
      const academicResponse = await apiClient.get(`/marks/class/${classId}/student/${studentId}/details`);
      
      if (academicResponse.data) {
        const processedAcademicData: TeacherAcademicData = {
          hasData: academicResponse.data.exams && academicResponse.data.exams.length > 0,
          exams: academicResponse.data.exams || [],
          summary: null, // Will be calculated from exams data
          message: academicResponse.data.exams?.length === 0 ? 'No academic records found for subjects you teach' : undefined
        };

        // Calculate summary if we have exam data
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
            if (exam.isCompleted) {
              completedExams++;
            }
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
      
      // Set empty state with appropriate message
      setAcademicData({
        hasData: false,
        message: 'No academic records available or you do not teach any subjects for this student',
        exams: [],
        summary: null
      });
    }

      // Mock conduct entries (will be replaced with actual API)
      const mockConductEntries: ConductEntry[] = [
        {
          _id: '1',
          date: '2024-03-20',
          type: 'positive',
          title: 'Excellent Performance',
          description: 'Showed exceptional leadership during group project',
          teacherName: 'Ms. Smith'
        },
        {
          _id: '2',
          date: '2024-03-18',
          type: 'neutral',
          title: 'Regular Attendance',
          description: 'Good attendance record this month',
          teacherName: 'Mr. Johnson'
        }
      ];
      setConductEntries(mockConductEntries);

      // Mock submissions (will be replaced with actual API)
      const mockSubmissions: Submission[] = [
        {
          _id: '1',
          title: 'Math Assignment Chapter 5',
          subject: 'Mathematics',
          submittedDate: '2024-03-19',
          dueDate: '2024-03-20',
          status: 'submitted',
          grade: 'A',
          feedback: 'Excellent work!'
        },
        {
          _id: '2',
          title: 'Science Project Report',
          subject: 'Science',
          submittedDate: '2024-03-22',
          dueDate: '2024-03-21',
          status: 'late',
          grade: 'B+',
          feedback: 'Good content but submitted late'
        }
      ];
      setSubmissions(mockSubmissions);

    } catch (error) {
      console.error('Error fetching student data:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else {
          setError(`Error: ${error.response?.data?.msg || 'Failed to fetch student data'}`);
        }
      } else {
        setError('An unknown error occurred');
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

  // Handle session expired
  const handleSessionExpired = () => {
    Alert.alert(
      "Session Expired",
      "Your session has expired. Please login again.",
      [
        {
          text: "OK",
          onPress: async () => {
            await AsyncStorage.removeItem('teacherToken');
            navigation.reset({
              index: 0,
              routes: [{ name: 'TeacherLogin' }],
            });
          }
        }
      ]
    );
  };

  // Add conduct entry
  const addConductEntry = async () => {
    if (!newConductTitle.trim() || !newConductDescription.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setAddingConduct(true);
    
    try {
      // Here you would make an API call to add the conduct entry
      // For now, we'll add it locally
      const newEntry: ConductEntry = {
        _id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        type: newConductType,
        title: newConductTitle,
        description: newConductDescription,
        teacherName: 'Current Teacher' // You'd get this from the logged-in teacher's data
      };
      
      setConductEntries(prev => [newEntry, ...prev]);
      
      // Reset form
      setNewConductTitle('');
      setNewConductDescription('');
      setNewConductType('positive');
      setConductModalVisible(false);
      
      Alert.alert('Success', 'Conduct entry added successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to add conduct entry');
    } finally {
      setAddingConduct(false);
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

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return '#38EF7D';
      case 'late': return '#FFA726';
      case 'pending': return '#F7685B';
      default: return '#8A94A6';
    }
  };

  // Render tab buttons
  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'personal' && styles.activeTab]}
        onPress={() => setActiveTab('personal')}
      >
        <FontAwesome5 name="user" size={16} color={activeTab === 'personal' ? '#1CB5E0' : '#8A94A6'} />
        <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>Personal</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'academic' && styles.activeTab]}
        onPress={() => setActiveTab('academic')}
      >
        <FontAwesome5 name="graduation-cap" size={16} color={activeTab === 'academic' ? '#1CB5E0' : '#8A94A6'} />
        <Text style={[styles.tabText, activeTab === 'academic' && styles.activeTabText]}>Academic</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'conduct' && styles.activeTab]}
        onPress={() => setActiveTab('conduct')}
      >
        <FontAwesome5 name="star" size={16} color={activeTab === 'conduct' ? '#1CB5E0' : '#8A94A6'} />
        <Text style={[styles.tabText, activeTab === 'conduct' && styles.activeTabText]}>Conduct</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'submissions' && styles.activeTab]}
        onPress={() => setActiveTab('submissions')}
      >
        <FontAwesome5 name="file-alt" size={16} color={activeTab === 'submissions' ? '#1CB5E0' : '#8A94A6'} />
        <Text style={[styles.tabText, activeTab === 'submissions' && styles.activeTabText]}>Submissions</Text>
      </TouchableOpacity>
    </View>
  );

  // Render personal details section
  const renderPersonalDetails = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.detailCard}>
        <View style={styles.cardHeader}>
          <FontAwesome5 name="user-circle" size={24} color="#3A4276" />
          <Text style={styles.cardTitle}>Personal Information</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Full Name:</Text>
          <Text style={styles.detailValue}>{studentProfile?.name}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Student ID:</Text>
          <Text style={styles.detailValue}>{studentProfile?.studentId}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email:</Text>
          <Text style={styles.detailValue}>{studentProfile?.email}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Phone:</Text>
          <Text style={styles.detailValue}>{studentProfile?.phone || 'Not provided'}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Class:</Text>
          <Text style={styles.detailValue}>{studentProfile?.className} - {studentProfile?.section}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <View style={[styles.statusBadge, { backgroundColor: studentProfile?.isActive ? 'rgba(56, 239, 125, 0.1)' : 'rgba(247, 104, 91, 0.1)' }]}>
            <Text style={[styles.statusText, { color: studentProfile?.isActive ? '#38EF7D' : '#F7685B' }]}>
              {studentProfile?.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Render academic section
  // Replace the renderAcademicSection function with this fixed version:

// Replace your renderAcademicSection function with this fixed version:

const renderAcademicSection = () => {
  if (!academicData) {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="graduation-cap" size={36} color="#B0B7C3" />
          <Text style={styles.emptyStateText}>Loading academic data...</Text>
        </View>
      </View>
    );
  }

  if (!academicData.hasData) {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="graduation-cap" size={36} color="#B0B7C3" />
          <Text style={styles.emptyStateText}>No Academic Records</Text>
          <Text style={styles.emptyStateSubtext}>
            {academicData.message || 'No academic records found for subjects you teach'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sectionContainer}>
      {/* Overall Performance Card */}
      {academicData.summary && (
        <View style={styles.performanceCard}>
          <LinearGradient
            colors={['#1CB5E0', '#38EF7D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.performanceGradient}
          >
            <View style={styles.performanceContent}>
              <Text style={styles.performanceTitle}>Overall Performance</Text>
              <Text style={styles.performanceSubtitle}>Subjects You Teach</Text>
              <Text style={styles.performancePercentage}>
                {String(academicData.summary.overallPercentage)}%
              </Text>
              <Text style={styles.performanceGrade}>
                Grade: {String(academicData.summary.overallGrade)}
              </Text>
              <View style={styles.performanceStats}>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatValue}>
                    {String(academicData.summary.completedExams)}
                  </Text>
                  <Text style={styles.performanceStatLabel}>Completed Exams</Text>
                </View>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatValue}>
                    {String(academicData.summary.completedSubjects)}
                  </Text>
                  <Text style={styles.performanceStatLabel}>Completed Subjects</Text>
                </View>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatValue}>
                    {String(academicData.summary.completionRate)}%
                  </Text>
                  <Text style={styles.performanceStatLabel}>Completion Rate</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}
      
      {/* Exam Results */}
      {academicData.exams && academicData.exams.length > 0 && academicData.exams.map((exam, index) => (
        <View key={`exam-${exam.examId || index}`} style={styles.examCard}>
          <View style={styles.examHeader}>
            <View style={styles.examTitleContainer}>
              <Text style={styles.examName}>{String(exam.examName || 'Untitled Exam')}</Text>
              <Text style={styles.examCode}>({String(exam.examCode || 'No Code')})</Text>
            </View>
            <View style={styles.examDateContainer}>
              <Text style={styles.examDate}>
                {exam.examDate ? new Date(exam.examDate).toLocaleDateString() : 'No Date'}
              </Text>
              <View style={[
                styles.completionBadge, 
                { backgroundColor: exam.isCompleted ? 'rgba(56, 239, 125, 0.1)' : 'rgba(255, 167, 38, 0.1)' }
              ]}>
                <Text style={[
                  styles.completionText, 
                  { color: exam.isCompleted ? '#38EF7D' : '#FFA726' }
                ]}>
                  {exam.isCompleted ? 'Completed' : 'In Progress'}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.examSummary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {String(exam.totalMarksScored || 0)}
              </Text>
              <Text style={styles.summaryLabel}>Marks Scored</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {String(exam.totalFullMarks || 0)}
              </Text>
              <Text style={styles.summaryLabel}>Total Marks</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {String(exam.percentage || '0')}%
              </Text>
              <Text style={styles.summaryLabel}>Percentage</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {String(exam.grade || 'N/A')}
              </Text>
              <Text style={styles.summaryLabel}>Grade</Text>
            </View>
          </View>
          
          <View style={styles.subjectsContainer}>
            <Text style={styles.subjectsTitle}>Your Subjects Performance</Text>
            <Text style={styles.subjectsSubtitle}>
              {String(exam.completedSubjects || 0)} of {String(exam.totalSubjects || 0)} subjects completed
            </Text>
            
            {exam.subjects && exam.subjects.length > 0 && exam.subjects.map((subject, idx) => (
              <View key={`subject-${subject.subjectId || idx}`} style={styles.subjectRow}>
                <View style={styles.subjectHeader}>
                  <Text style={styles.subjectName}>
                    {String(subject.subjectName || 'Unknown Subject')}
                  </Text>
                  <View style={[
                    styles.subjectStatus,
                    { 
                      backgroundColor: subject.isCompleted 
                        ? 'rgba(56, 239, 125, 0.1)' 
                        : 'rgba(180, 183, 195, 0.1)' 
                    }
                  ]}>
                    <Text style={[
                      styles.subjectStatusText,
                      { 
                        color: subject.isCompleted ? '#38EF7D' : '#8A94A6'
                      }
                    ]}>
                      {subject.isCompleted ? 'Graded' : 'Pending'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.subjectDetails}>
                  <Text style={styles.subjectMarks}>
                    {subject.marksScored !== null ? String(subject.marksScored) : '-'}/{String(subject.fullMarks || 0)}
                  </Text>
                  <Text style={styles.subjectPercentage}>
                    {subject.percentage !== null ? `${String(subject.percentage)}%` : 'N/A'}
                  </Text>
                </View>
                
                {subject.scoredBy && (
                  <Text style={styles.scoredByText}>
                    Graded by: {String(subject.scoredBy)}
                  </Text>
                )}
              </View>
            ))}
          </View>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Completion Progress</Text>
              <Text style={styles.progressPercentage}>
                {exam.totalSubjects > 0 
                  ? String(Math.round((exam.completedSubjects / exam.totalSubjects) * 100))
                  : '0'}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  {
                    width: `${exam.totalSubjects > 0 
                      ? Math.round((exam.completedSubjects / exam.totalSubjects) * 100) 
                      : 0}%`
                  }
                ]}
              />
            </View>
          </View>
        </View>
      ))}
      
      {/* Last Updated Info */}
      {academicData.lastUpdated && (
        <View style={styles.lastUpdatedContainer}>
          <FontAwesome5 name="clock" size={14} color="#8A94A6" />
          <Text style={styles.lastUpdatedText}>
            Last updated: {new Date(academicData.lastUpdated).toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
};

  // Render conduct section
  const renderConductSection = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Conduct Records</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setConductModalVisible(true)}
        >
          <FontAwesome5 name="plus" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {conductEntries.length > 0 ? (
        <FlatList
          data={conductEntries}
          renderItem={({ item }) => (
            <View style={styles.conductCard}>
              <View style={styles.conductHeader}>
                <View style={[styles.conductTypeIndicator, { backgroundColor: getConductTypeColor(item.type) }]} />
                <View style={styles.conductInfo}>
                  <Text style={styles.conductTitle}>{item.title}</Text>
                  <Text style={styles.conductDate}>{new Date(item.date).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.conductType, { color: getConductTypeColor(item.type) }]}>
                  {item.type.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.conductDescription}>{item.description}</Text>
              <Text style={styles.conductTeacher}>- {item.teacherName}</Text>
            </View>
          )}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="clipboard-list" size={36} color="#B0B7C3" />
          <Text style={styles.emptyStateText}>No conduct records yet</Text>
          <Text style={styles.emptyStateSubtext}>Add conduct records to track student behavior</Text>
        </View>
      )}
    </View>
  );

  // Render submissions section
  const renderSubmissionsSection = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>Student Submissions</Text>
      
      {submissions.length > 0 ? (
        <FlatList
          data={submissions}
          renderItem={({ item }) => (
            <View style={styles.submissionCard}>
              <View style={styles.submissionHeader}>
                <Text style={styles.submissionTitle}>{item.title}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.submissionSubject}>{item.subject}</Text>
              
              <View style={styles.submissionDates}>
                <Text style={styles.submissionDate}>
                  Submitted: {new Date(item.submittedDate).toLocaleDateString()}
                </Text>
                <Text style={styles.submissionDate}>
                  Due: {new Date(item.dueDate).toLocaleDateString()}
                </Text>
              </View>
              
              {item.grade && (
                <View style={styles.gradeContainer}>
                  <Text style={styles.gradeLabel}>Grade: </Text>
                  <Text style={styles.gradeValue}>{item.grade}</Text>
                </View>
              )}
              
              {item.feedback && (
                <View style={styles.feedbackContainer}>
                  <Text style={styles.feedbackLabel}>Feedback:</Text>
                  <Text style={styles.feedbackText}>{item.feedback}</Text>
                </View>
              )}
            </View>
          )}
          keyExtractor={(item) => item._id}
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="file-alt" size={36} color="#B0B7C3" />
          <Text style={styles.emptyStateText}>No submissions yet</Text>
          <Text style={styles.emptyStateSubtext}>Student submissions will appear here</Text>
        </View>
      )}
    </View>
  );

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
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => fetchAllData()}
        >
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
        {activeTab === 'personal' && renderPersonalDetails()}
        {activeTab === 'academic' && renderAcademicSection()}
        {activeTab === 'conduct' && renderConductSection()}
        {activeTab === 'submissions' && renderSubmissionsSection()}
      </ScrollView>

      {/* Add Conduct Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={conductModalVisible}
        onRequestClose={() => setConductModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Conduct Entry</Text>
              <TouchableOpacity onPress={() => setConductModalVisible(false)}>
                <FontAwesome5 name="times" size={20} color="#8A94A6" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalContent}>
              <Text style={styles.inputLabel}>Type</Text>
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
              
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.textInput}
                value={newConductTitle}
                onChangeText={setNewConductTitle}
                placeholder="Enter title..."
                maxLength={50}
              />
              
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newConductDescription}
                onChangeText={setNewConductDescription}
                placeholder="Enter description..."
                multiline
                numberOfLines={4}
                maxLength={200}
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setConductModalVisible(false)}
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
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
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
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FC',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#1CB5E0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  
  // Tab Navigation Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: 'rgba(28, 181, 224, 0.1)',
  },
  tabText: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '500',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#1CB5E0',
    fontWeight: '600',
  },
  
  // Section Styles
  sectionContainer: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
  },
  addButton: {
    backgroundColor: '#1CB5E0',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  
  // Personal Details Styles
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginLeft: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  
  // Academic Performance Styles
  performanceCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  performanceGradient: {
    padding: 24,
  },
  performanceContent: {
    alignItems: 'center',
  },
  performanceTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginBottom: 8,
  },
  performancePercentage: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 4,
  },
  performanceGrade: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  // Exam Card Styles
  examCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  examName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    flex: 1,
  },
  examDate: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  examSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F9FC',
    borderRadius: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1CB5E0',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  subjectsContainer: {
    marginTop: 8,
  },
  subjectsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 12,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FC',
    borderRadius: 6,
    marginBottom: 6,
  },
  subjectName: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '500',
    flex: 2,
  },
  subjectMarks: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  subjectPercentage: {
    fontSize: 14,
    color: '#1CB5E0',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  
  // Conduct Entry Styles
  conductCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  conductHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  conductTypeIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  conductInfo: {
    flex: 1,
  },
  conductTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  conductDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  conductType: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  conductDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  conductTeacher: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'right',
  },
  
  // Submission Styles
  submissionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  submissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    flex: 1,
    marginRight: 12,
  },
  submissionSubject: {
    fontSize: 14,
    color: '#1CB5E0',
    fontWeight: '500',
    marginBottom: 12,
  },
  submissionDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  submissionDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  gradeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gradeLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  gradeValue: {
    fontSize: 16,
    color: '#1CB5E0',
    fontWeight: '700',
  },
  feedbackContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  feedbackLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  feedbackText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  
  // Empty State Styles
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A4276',
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  selectedTypeButton: {
    backgroundColor: 'rgba(28, 181, 224, 0.1)',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1CB5E0',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  performanceSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  performanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  performanceStatItem: {
    alignItems: 'center',
  },
  performanceStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  performanceStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  examTitleContainer: {
    flex: 1,
  },
  examCode: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 2,
  },
  examDateContainer: {
    alignItems: 'flex-end',
  },
  completionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  completionText: {
    fontSize: 10,
    fontWeight: '600',
  },
  subjectsSubtitle: {
    fontSize: 12,
    color: '#8A94A6',
    marginBottom: 12,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  subjectDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoredByText: {
    fontSize: 11,
    color: '#8A94A6',
    fontStyle: 'italic',
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7F0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    color: '#3A4276',
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 12,
    color: '#1CB5E0',
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1CB5E0',
    borderRadius: 3,
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 16,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 6,
  },

});

export default TeacherStudentDetailsScreen;
