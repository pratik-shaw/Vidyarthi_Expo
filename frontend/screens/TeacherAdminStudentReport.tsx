import React, { useEffect, useState } from 'react';
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
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_BASE_URL} from '../config/api';

const { width } = Dimensions.get('window');


// API URL with configurable timeout
const API_URL = API_BASE_URL; // Change this to your server IP/domain
const API_TIMEOUT = 15000; // 15 seconds timeout

type TeacherAdminStudentReportParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherAdminStudentReport'>;

interface StudentSummary {
  studentId: string;
  studentName: string;
  studentNumber: string;
  exams: ExamSummary[];
}

interface ExamSummary {
  examId: string;
  examName: string;
  examCode: string;
  examDate: string;
  totalMarksScored: number;
  totalFullMarks: number;
  percentage: number;
  completedSubjects: number;
  totalSubjects: number;
  isCompleted: boolean;
}

interface StudentDetails {
  studentInfo: {
    id: string;
    name: string;
    studentNumber: string;
  };
  classInfo: {
    id: string;
    name: string;
    section: string;
  };
  exams: DetailedExam[];
  totalExams: number;
}

interface DetailedExam {
  examId: string;
  examName: string;
  examCode: string;
  examDate: string;
  subjects: SubjectDetails[];
  totalMarksScored: number;
  totalFullMarks: number;
  percentage: string;
  completedSubjects: number;
  totalSubjects: number;
  isCompleted: boolean;
}

interface SubjectDetails {
  subjectId: string;
  subjectName: string;
  teacherId: string;
  fullMarks: number;
  marksScored: number | null;
  scoredBy: string | null;
  scoredAt: string | null;
}

const TeacherAdminStudentReportScreen: React.FC<Props> = ({ route, navigation }) => {
  const { classId, className } = route.params as unknown as TeacherAdminStudentReportParams;
  
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetails | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Set header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `Student Reports - ${className}`,
      headerShown: true,
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerTintColor: '#2D3748',
      headerShadowVisible: false,
      headerBackTitle: 'Back',
    });
  }, [navigation, className]);

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
        fetchClassMarksSummary(storedToken);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load data');
        setLoading(false);
      }
    };
    
    loadData();
  }, [classId]);

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

  // Fetch class marks summary
  const fetchClassMarksSummary = async (authToken = token) => {
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

      const apiClient = getAuthenticatedClient(authToken);
      const response = await apiClient.get(`/marks/class/${classId}/summary`);
      
      setStudents(response.data.students || []);
      console.log('Class marks summary fetched:', response.data.students?.length || 0, 'students');
    } catch (error) {
      console.error('Error fetching class marks summary:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else if (error.response?.status === 403) {
          setError('Not authorized to view this class reports');
        } else {
          setError(`Error: ${error.response?.data?.msg || 'Failed to fetch student reports'}`);
        }
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch detailed marks for a specific student
  const fetchStudentDetails = async (studentId: string) => {
    setLoadingDetails(true);
    
    try {
      if (!token) return;

      const apiClient = getAuthenticatedClient(token);
      const response = await apiClient.get(`/marks/class/${classId}/student/${studentId}/details`);
      
      setSelectedStudent(response.data);
      setModalVisible(true);
      console.log('Student detailed marks fetched');
    } catch (error) {
      console.error('Error fetching student details:', error);
      
      if (axios.isAxiosError(error)) {
        Alert.alert('Error', error.response?.data?.msg || 'Failed to fetch student details');
      } else {
        Alert.alert('Error', 'An unknown error occurred');
      }
    } finally {
      setLoadingDetails(false);
    }
  };


  const onRefresh = () => {
    setRefreshing(true);
    fetchClassMarksSummary();
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

  // Get grade based on percentage
  const getGrade = (percentage: number): string => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C+';
    if (percentage >= 40) return 'C';
    if (percentage >= 33) return 'D';
    return 'F';
  };

  // Get grade color
  const getGradeColor = (percentage: number): string => {
    if (percentage >= 90) return '#10B981';
    if (percentage >= 80) return '#059669';
    if (percentage >= 70) return '#3B82F6';
    if (percentage >= 60) return '#8B5CF6';
    if (percentage >= 50) return '#F59E0B';
    if (percentage >= 40) return '#EF4444';
    if (percentage >= 33) return '#DC2626';
    return '#991B1B';
  };

  // Calculate overall student performance
  const calculateOverallPerformance = (student: StudentSummary) => {
    const completedExams = student.exams.filter(exam => exam.isCompleted);
    if (completedExams.length === 0) return { percentage: 0, grade: 'N/A' };
    
    const totalPercentage = completedExams.reduce((sum, exam) => sum + exam.percentage, 0);
    const avgPercentage = totalPercentage / completedExams.length;
    
    return {
      percentage: Math.round(avgPercentage),
      grade: getGrade(avgPercentage)
    };
  };

  // Render student row in table
  const renderStudentRow = (student: StudentSummary, index: number) => {
    const overall = calculateOverallPerformance(student);
    const completedExams = student.exams.filter(exam => exam.isCompleted).length;
    
    return (
      <TouchableOpacity
        key={student.studentId}
        style={[styles.tableRow, index % 2 === 0 && styles.evenRow]}
        onPress={() => fetchStudentDetails(student.studentId)}
      >
        <View style={styles.studentCell}>
          <View style={styles.studentAvatar}>
            <Text style={styles.avatarText}>
              {student.studentName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName} numberOfLines={1} ellipsizeMode="tail">
              {student.studentName}
            </Text>
            <Text style={styles.studentId} numberOfLines={1}>
              ID: {student.studentNumber}
            </Text>
          </View>
        </View>
        
        <View style={styles.examCountCell}>
          <Text style={styles.examCount}>{completedExams}/{student.exams.length}</Text>
          <Text style={styles.examLabel}>Completed</Text>
        </View>
        
        <View style={styles.performanceCell}>
          <Text style={[styles.percentage, { color: getGradeColor(overall.percentage) }]}>
            {overall.percentage}%
          </Text>
          <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(overall.percentage) }]}>
            <Text style={styles.gradeText}>{overall.grade}</Text>
          </View>
        </View>
        
        <View style={styles.actionCell}>
          <FontAwesome5 name="eye" size={16} color="#4299E1" />
        </View>
      </TouchableOpacity>
    );
  };

  // Render detailed exam results modal
  const renderDetailedModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalVisible(false)}
          >
            <FontAwesome5 name="times" size={20} color="#4A5568" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {selectedStudent?.studentInfo.name} - Detailed Results
          </Text>
          <View style={styles.placeholder} />
        </View>
        
        {loadingDetails ? (
          <View style={styles.modalLoadingContainer}>
            <ActivityIndicator size="large" color="#4299E1" />
            <Text style={styles.loadingText}>Loading student details...</Text>
          </View>
        ) : (
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {selectedStudent?.exams.map((exam, examIndex) => (
              <View key={exam.examId} style={styles.examCard}>
                <View style={styles.examHeader}>
                  <View style={styles.examInfo}>
                    <Text style={styles.examName}>{exam.examName}</Text>
                    <Text style={styles.examCode}>Code: {exam.examCode}</Text>
                    <Text style={styles.examDate}>
                      Date: {new Date(exam.examDate).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.examSummary}>
                    <Text style={[styles.examPercentage, { color: getGradeColor(parseFloat(exam.percentage)) }]}>
                      {exam.percentage}%
                    </Text>
                    <View style={[styles.examGradeBadge, { backgroundColor: getGradeColor(parseFloat(exam.percentage)) }]}>
                      <Text style={styles.examGradeText}>{getGrade(parseFloat(exam.percentage))}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.examStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{exam.totalMarksScored}</Text>
                    <Text style={styles.statLabel}>Marks Scored</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{exam.totalFullMarks}</Text>
                    <Text style={styles.statLabel}>Total Marks</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{exam.completedSubjects}/{exam.totalSubjects}</Text>
                    <Text style={styles.statLabel}>Subjects</Text>
                  </View>
                </View>
                
                <View style={styles.subjectsContainer}>
                  <Text style={styles.subjectsTitle}>Subject-wise Breakdown:</Text>
                  {exam.subjects.map((subject, subjectIndex) => (
                    <View key={subject.subjectId} style={styles.subjectRow}>
                      <View style={styles.subjectInfo}>
                        <Text style={styles.subjectName}>{subject.subjectName}</Text>
                        <Text style={styles.subjectMarks}>
                          {subject.marksScored !== null ? `${subject.marksScored}/${subject.fullMarks}` : `--/${subject.fullMarks}`}
                        </Text>
                      </View>
                      <View style={styles.subjectStatus}>
                        {subject.marksScored !== null ? (
                          <View style={styles.completedStatus}>
                            <FontAwesome5 name="check-circle" size={14} color="#10B981" />
                            <Text style={styles.completedText}>Scored</Text>
                          </View>
                        ) : (
                          <View style={styles.pendingStatus}>
                            <FontAwesome5 name="clock" size={14} color="#F59E0B" />
                            <Text style={styles.pendingText}>Pending</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );

  // Show loading indicator
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar hidden={true} />
        <ActivityIndicator size="large" color="#4299E1" />
        <Text style={styles.loadingText}>Loading student reports...</Text>
      </SafeAreaView>
    );
  }

  // Show error message
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar hidden={true} />
        <FontAwesome5 name="exclamation-triangle" size={48} color="#F56565" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => fetchClassMarksSummary()}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />
      
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4299E1', '#48BB78']}
          />
        }
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <LinearGradient
            colors={['#4299E1', '#3182CE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <FontAwesome5 name="chart-line" size={24} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Student Performance Reports</Text>
            <Text style={styles.headerSubtitle}>
              {students.length} students 
            </Text>
          </LinearGradient>
        </View>

        {students.length > 0 ? (
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.studentHeaderCell]}>Student</Text>
              <Text style={[styles.headerCell, styles.examHeaderCell]}>Exams</Text>
              <Text style={[styles.headerCell, styles.performanceHeaderCell]}>Performance</Text>
              <Text style={[styles.headerCell, styles.actionHeaderCell]}>Action</Text>
            </View>
            
            {/* Table Rows */}
            <View style={styles.tableBody}>
              {students.map((student, index) => renderStudentRow(student, index))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyStateContainer}>
            <FontAwesome5 name="chart-line" size={48} color="#CBD5E0" />
            <Text style={styles.emptyStateText}>No Student Reports Available</Text>
            <Text style={styles.emptyStateSubtext}>
              Student reports will appear here once exams are conducted and marks are entered
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Detailed Results Modal */}
      {renderDetailedModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4299E1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerGradient: {
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  tableContainer: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EDF2F7',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3748',
    textAlign: 'center',
  },
  studentHeaderCell: {
    flex: 2.5,
    textAlign: 'left',
  },
  examHeaderCell: {
    flex: 1.2,
  },
  performanceHeaderCell: {
    flex: 1.3,
  },
  actionHeaderCell: {
    flex: 0.8,
  },
  tableBody: {
    backgroundColor: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    minHeight: 70,
  },
  evenRow: {
    backgroundColor: '#F8F9FA',
  },
  studentCell: {
    flex: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4299E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  studentInfo: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    lineHeight: 18,
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: '#718096',
    lineHeight: 16,
  },
  examCountCell: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    lineHeight: 18,
  },
  examLabel: {
    fontSize: 11,
    color: '#718096',
    marginTop: 2,
    lineHeight: 14,
  },
  performanceCell: {
    flex: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 18,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    minWidth: 28,
    alignItems: 'center',
  },
  gradeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
  },
  actionCell: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 36,
  },
  modalLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  examCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  examInfo: {
    flex: 1,
  },
  examName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  examCode: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 2,
  },
  examDate: {
    fontSize: 12,
    color: '#718096',
  },
  examSummary: {
    alignItems: 'flex-end',
  },
  examPercentage: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  examGradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  examGradeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  examStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  subjectsContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  subjectsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  subjectMarks: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  subjectStatus: {
    alignItems: 'flex-end',
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedText: {
    fontSize: 12,
    color: '#10B981',
    marginLeft: 4,
    fontWeight: '500',
  },
  pendingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingText: {
    fontSize: 12,
    color: '#F59E0B',
    marginLeft: 4,
    fontWeight: '500',
  },
});

export default TeacherAdminStudentReportScreen;