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
  FlatList,
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
const API_URL = API_BASE_URL;
const API_TIMEOUT = 15000;

type TeacherSubjectReportParams = {
  classId: string;
  className: string;
};

type Props = NativeStackScreenProps<RootStackParamList, 'TeacherSubjectReport'>;

interface ExamData {
  examId: string;
  examName: string;
  examCode: string;
  examDate: string;
  fullMarks: number;
  studentsCompleted: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

interface StudentExamData {
  examId: string;
  examName: string;
  examCode: string;
  examDate: string;
  marksScored: number;
  fullMarks: number;
  percentage: number;
  grade: string;
  scoredAt: string;
}

interface StudentPerformance {
  studentId: string;
  studentName: string;
  studentNumber: string;
  exams: StudentExamData[];
  overallPerformance: {
    totalMarks: number;
    totalFullMarks: number;
    averagePercentage: number;
    grade: string;
    completedExams: number;
    totalExams: number;
  };
}

interface SubjectSummary {
  totalStudents: number;
  averagePerformance: string;
  completionRate: string;
  highestScore: number;
  lowestScore: number;
  passCount: number;
  failCount: number;
}

interface SubjectReport {
  subjectId: string;
  subjectName: string;
  students: StudentPerformance[];
  exams: ExamData[];
  summary: SubjectSummary;
}

interface ClassInfo {
  id: string;
  name: string;
  section: string;
}

interface TeacherInfo {
  id: string;
  name: string;
}

const TeacherSubjectReportScreen: React.FC<Props> = ({ route, navigation }) => {
  const { classId, className } = route.params as unknown as TeacherSubjectReportParams;
  
  const [subjects, setSubjects] = useState<SubjectReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectReport | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentPerformance | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // Set header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `Subject Reports - ${className}`,
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
        fetchSubjectReports(storedToken);
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

  // Fetch subject reports
  const fetchSubjectReports = async (authToken = token) => {
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
      const response = await apiClient.get(`/marks/class/${classId}/subject-report`);
      
      setSubjects(response.data.subjects || []);
      setClassInfo(response.data.classInfo);
      setTeacherInfo(response.data.teacherInfo);
      
      console.log('Subject reports fetched:', response.data.subjects?.length || 0, 'subjects');
    } catch (error) {
      console.error('Error fetching subject reports:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          handleSessionExpired();
        } else if (error.response?.status === 403) {
          setError('Not authorized to view subject reports for this class');
        } else {
          setError(`Error: ${error.response?.data?.msg || 'Failed to fetch subject reports'}`);
        }
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubjectReports();
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

  // Handle student selection
  const handleStudentPress = (student: StudentPerformance, subject: SubjectReport) => {
    setSelectedStudent(student);
    setSelectedSubject(subject);
    setModalVisible(true);
  };

  // Render subject overview cards
  const renderSubjectOverview = (subject: SubjectReport) => {
    const averagePerf = parseFloat(subject.summary.averagePerformance);
    const completionRate = parseFloat(subject.summary.completionRate);
    
    return (
      <View key={subject.subjectId} style={styles.subjectSection}>
        {/* Subject Header */}
        <View style={styles.subjectHeader}>
          <View style={styles.subjectTitleContainer}>
            <FontAwesome5 name="book" size={20} color="#667EEA" style={styles.subjectIcon} />
            <Text style={styles.subjectTitle}>{subject.subjectName}</Text>
          </View>
        </View>

        {/* Statistics Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{subject.summary.totalStudents}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{subject.exams.length}</Text>
            <Text style={styles.statLabel}>Total Exams</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: getGradeColor(averagePerf) }]}>
              {averagePerf.toFixed(1)}%
            </Text>
            <Text style={styles.statLabel}>Average</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completionRate}%</Text>
            <Text style={styles.statLabel}>Completion</Text>
          </View>
        </View>

        {/* Exam Performance Table */}
        <View style={styles.tableSection}>
          <Text style={styles.tableSectionTitle}>Exam Performance</Text>
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Exam</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Avg Score</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Completed</Text>
            </View>
            {subject.exams.map((exam, index) => (
              <View key={exam.examId} style={styles.tableRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.examName}>{exam.examName}</Text>
                  <Text style={styles.examCode}>{exam.examCode}</Text>
                </View>
                <Text style={[styles.tableText, { flex: 1 }]}>
                  {exam.averageScore.toFixed(1)}/{exam.fullMarks}
                </Text>
                <Text style={[styles.tableText, { flex: 1 }]}>
                  {exam.studentsCompleted}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Student Performance Table */}
        <View style={styles.tableSection}>
          <Text style={styles.tableSectionTitle}>Student Performance</Text>
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Student</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Exams</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Average</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Grade</Text>
            </View>
            <FlatList
              data={subject.students}
              keyExtractor={(item) => item.studentId}
              scrollEnabled={false}
              renderItem={({ item: student }) => (
                <TouchableOpacity
                  style={styles.tableRow}
                  onPress={() => handleStudentPress(student, subject)}
                >
                  <View style={{ flex: 2 }}>
                    <Text style={styles.studentName}>{student.studentName}</Text>
                    <Text style={styles.studentId}>ID: {student.studentNumber}</Text>
                  </View>
                  <Text style={[styles.tableText, { flex: 1 }]}>
                    {student.overallPerformance.completedExams}/{student.overallPerformance.totalExams}
                  </Text>
                  <Text style={[
                    styles.tableText,
                    { flex: 1, color: getGradeColor(student.overallPerformance.averagePercentage) }
                  ]}>
                    {student.overallPerformance.averagePercentage.toFixed(1)}%
                  </Text>
                  <View style={[styles.gradeContainer, { flex: 1 }]}>
                    <View style={[
                      styles.gradeBadge,
                      { backgroundColor: getGradeColor(student.overallPerformance.averagePercentage) }
                    ]}>
                      <Text style={styles.gradeText}>{student.overallPerformance.grade}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </View>
    );
  };

  // Render student detail modal
  const renderStudentDetailModal = () => (
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
          <View style={styles.modalTitleContainer}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedStudent?.studentName}
            </Text>
            <Text style={styles.modalSubtitle} numberOfLines={1}>
              {selectedSubject?.subjectName}
            </Text>
          </View>
          <View style={styles.placeholder} />
        </View>
        
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {selectedStudent && selectedSubject && (
            <>
              {/* Student Overview */}
              <View style={styles.studentOverviewCard}>
                <View style={styles.studentHeader}>
                  <View style={styles.largeAvatar}>
                    <Text style={styles.largeAvatarText}>
                      {selectedStudent.studentName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.studentDetails}>
                    <Text style={styles.studentDetailName}>{selectedStudent.studentName}</Text>
                    <Text style={styles.studentDetailId}>ID: {selectedStudent.studentNumber}</Text>
                    <Text style={styles.subjectDetailName}>{selectedSubject.subjectName}</Text>
                  </View>
                </View>
                
                <View style={styles.performanceSummary}>
                  <View style={styles.summaryItem}>
                    <Text style={[
                      styles.summaryValue,
                      { color: getGradeColor(selectedStudent.overallPerformance.averagePercentage) }
                    ]}>
                      {selectedStudent.overallPerformance.averagePercentage.toFixed(1)}%
                    </Text>
                    <Text style={styles.summaryLabel}>Overall Average</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {selectedStudent.overallPerformance.completedExams}/{selectedStudent.overallPerformance.totalExams}
                    </Text>
                    <Text style={styles.summaryLabel}>Exams Completed</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <View style={[
                      styles.gradeBadgeLarge,
                      { backgroundColor: getGradeColor(selectedStudent.overallPerformance.averagePercentage) }
                    ]}>
                      <Text style={styles.gradeTextLarge}>{selectedStudent.overallPerformance.grade}</Text>
                    </View>
                    <Text style={styles.summaryLabel}>Current Grade</Text>
                  </View>
                </View>
              </View>

              {/* Exam Results Table */}
              <View style={styles.examResultsCard}>
                <Text style={styles.sectionTitle}>Exam Results</Text>
                {selectedStudent.exams.length > 0 ? (
                  <View style={styles.tableContainer}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderText, { flex: 2 }]}>Exam</Text>
                      <Text style={[styles.tableHeaderText, { flex: 1 }]}>Score</Text>
                      <Text style={[styles.tableHeaderText, { flex: 1 }]}>%</Text>
                      <Text style={[styles.tableHeaderText, { flex: 1 }]}>Grade</Text>
                    </View>
                    {selectedStudent.exams.map((exam, index) => (
                      <View key={exam.examId} style={styles.tableRow}>
                        <View style={{ flex: 2 }}>
                          <Text style={styles.examName}>{exam.examName}</Text>
                          <Text style={styles.examCode}>{exam.examCode}</Text>
                          <Text style={styles.examDate}>
                            {new Date(exam.examDate).toLocaleDateString()}
                          </Text>
                        </View>
                        <Text style={[
                          styles.tableText,
                          { flex: 1, color: getGradeColor(exam.percentage) }
                        ]}>
                          {exam.marksScored}/{exam.fullMarks}
                        </Text>
                        <Text style={[
                          styles.tableText,
                          { flex: 1, color: getGradeColor(exam.percentage) }
                        ]}>
                          {exam.percentage.toFixed(1)}%
                        </Text>
                        <View style={[styles.gradeContainer, { flex: 1 }]}>
                          <View style={[
                            styles.gradeBadge,
                            { backgroundColor: getGradeColor(exam.percentage) }
                          ]}>
                            <Text style={styles.gradeText}>{exam.grade}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noExamsContainer}>
                    <FontAwesome5 name="clipboard-list" size={48} color="#CBD5E0" />
                    <Text style={styles.noExamsText}>No exam results available</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // Loading screen
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />
        <ActivityIndicator size="large" color="#667EEA" />
        <Text style={styles.loadingText}>Loading subject reports...</Text>
      </SafeAreaView>
    );
  }

  // Error screen
  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />
        <FontAwesome5 name="exclamation-triangle" size={48} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchSubjectReports()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Empty state
  if (subjects.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />
        <ScrollView
          contentContainerStyle={styles.emptyScrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <FontAwesome5 name="book-open" size={64} color="#CBD5E0" />
          <Text style={styles.emptyTitle}>No Subject Reports</Text>
          <Text style={styles.emptyMessage}>
            No subject reports are available for this class yet.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main render
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7FAFC" />
      
      {/* Header Info */}
      {classInfo && (
        <View style={styles.headerInfo}>
          <Text style={styles.className}>{classInfo.name}</Text>
          <Text style={styles.classSection}>Section: {classInfo.section}</Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {subjects.map((subject) => renderSubjectOverview(subject))}
      </ScrollView>

      {/* Student Detail Modal */}
      {renderStudentDetailModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
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
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    paddingHorizontal: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#667EEA',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  emptyScrollContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 24,
    fontSize: 24,
    fontWeight: '700',
    color: '#2D3748',
    textAlign: 'center',
  },
  emptyMessage: {
    marginTop: 8,
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 24,
  },
  headerInfo: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  className: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
  },
  classSection: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  
  // Subject Section Styles
  subjectSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  subjectHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subjectTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectIcon: {
    marginRight: 12,
  },
  subjectTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
    flex: 1,
  },
  
  // Statistics Overview
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667EEA',
  },
  statLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Table Styles
  tableSection: {
    padding: 20,
  },
  tableSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F7FAFC',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
    minHeight: 60,
  },
  tableText: {
    fontSize: 14,
    color: '#4A5568',
    textAlign: 'left',
  },
  examName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  examCode: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  examDate: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  studentId: {
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  gradeContainer: {
    alignItems: 'center',
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#667EEA',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  
  // Student Detail Modal Styles
  studentOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  largeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667EEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  largeAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentDetails: {
    flex: 1,
  },
  studentDetailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
  },
  studentDetailId: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
  },
  subjectDetailName: {
    fontSize: 14,
    color: '#667EEA',
    fontWeight: '600',
    marginTop: 4,
  },
  performanceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3748',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
    textAlign: 'center',
  },
  gradeBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeTextLarge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Exam Results Card
  examResultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 16,
  },
  noExamsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noExamsText: {
    fontSize: 16,
    color: '#718096',
    marginTop: 12,
    textAlign: 'center',
  },
});

export default TeacherSubjectReportScreen;