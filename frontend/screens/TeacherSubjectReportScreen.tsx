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

interface GradeDistributionItem {
  count?: number;
  marksRange?: string;
}

interface ExamPerformanceData {
  examInfo: {
    examId: string;
    examName: string;
    examCode: string;
    examDate: string;
  };
  subjectInfo: {
    subjectId: string;
    subjectName: string;
  };
  classInfo: {
    id: string;
    name: string;
    section: string;
  };
  statistics: {
    totalStudents: number;
    averageMarks: string;
    averagePercentage: string;
    medianMarks: number;
    medianPercentage: string;
    minMarks: number;
    maxMarks: number;
    minPercentage: string;
    maxPercentage: string;
    fullMarks: number;
    minPerformer: {
      studentId: string;
      studentName: string;
      studentNumber: string;
      marksScored: number;
      percentage: string;
      grade: string;
    };
    maxPerformer: {
      studentId: string;
      studentName: string;
      studentNumber: string;
      marksScored: number;
      percentage: string;
      grade: string;
    };
    passCount: number;
    failCount: number;
    gradeDistribution: {
      'A+': number | GradeDistributionItem;
      'A': number | GradeDistributionItem;
      'B+': number | GradeDistributionItem;
      'B': number | GradeDistributionItem;
      'C+': number | GradeDistributionItem;
      'C': number | GradeDistributionItem;
      'D': number | GradeDistributionItem;
      'F': number | GradeDistributionItem;
    };
  } | null;
  students: any[];
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
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [examPerformanceData, setExamPerformanceData] = useState<ExamPerformanceData | null>(null);
  const [examPerformanceModalVisible, setExamPerformanceModalVisible] = useState<boolean>(false);
  const [loadingExamPerformance, setLoadingExamPerformance] = useState<boolean>(false);


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

  const fetchExamPerformanceDetails = async (examId: string, subjectId: string, subjectName: string) => {
  setLoadingExamPerformance(true);
  try {
    if (!token) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'TeacherLogin' }],
      });
      return;
    }

    const apiClient = getAuthenticatedClient();
    const response = await apiClient.get(`/marks/class/${classId}/exam/${examId}/subject/${subjectId}/performance`);
    
    setExamPerformanceData(response.data);
    setExamPerformanceModalVisible(true);
    
    console.log('Exam performance details fetched:', response.data.totalStudents || 0, 'students');
  } catch (error) {
    console.error('Error fetching exam performance details:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        handleSessionExpired();
      } else if (error.response?.status === 403) {
        Alert.alert('Error', 'Not authorized to view exam performance details');
      } else {
        Alert.alert('Error', `Failed to fetch exam performance details: ${error.response?.data?.msg || 'Unknown error'}`);
      }
    } else {
      Alert.alert('Error', 'An unknown error occurred');
    }
  } finally {
    setLoadingExamPerformance(false);
  }
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

  const getGradePercentage = (grade: string): number => {
  switch (grade) {
    case 'A+': return 95;
    case 'A': return 85;
    case 'B+': return 75;
    case 'B': return 65;
    case 'C+': return 55;
    case 'C': return 45;
    case 'D': return 36;
    case 'F': return 20;
    default: return 0;
  }
};
  const getGradeCount = (gradeData: number | GradeDistributionItem): number => {
  if (typeof gradeData === 'number') {
    return gradeData;
  }
  return gradeData.count || 0;
};

const getGradeMarksRange = (gradeData: number | GradeDistributionItem): string | null => {
  if (typeof gradeData === 'object' && gradeData.marksRange) {
    return gradeData.marksRange;
  }
  return null;
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
    setLoadingDetails(true);
    setModalVisible(true);
    // Simulate loading delay
    setTimeout(() => setLoadingDetails(false), 500);
  };

  // Render subject card
  const renderSubjectCard = (subject: SubjectReport) => {
    const averagePerf = parseFloat(subject.summary.averagePerformance);
    const completionRate = parseFloat(subject.summary.completionRate);
    
    return (
      <View key={subject.subjectId} style={styles.subjectCard}>
        {/* Subject Header */}
        <View style={styles.subjectHeader}>
          <LinearGradient
            colors={['#667EEA', '#764BA2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.subjectHeaderGradient}
          >
            <FontAwesome5 name="book" size={24} color="#FFFFFF" />
            <Text style={styles.subjectTitle}>{subject.subjectName}</Text>
            <Text style={styles.subjectSubtitle}>
              {subject.summary.totalStudents} students • {subject.exams.length} exams
            </Text>
          </LinearGradient>
        </View>

        {/* Statistics Overview */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: getGradeColor(averagePerf) }]}>
              {averagePerf.toFixed(1)}%
            </Text>
            <Text style={styles.statLabel}>Average Score</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completionRate}%</Text>
            <Text style={styles.statLabel}>Completion Rate</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>
              {subject.summary.passCount}
            </Text>
            <Text style={styles.statLabel}>Pass Count</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>
              {subject.summary.failCount}
            </Text>
            <Text style={styles.statLabel}>Fail Count</Text>
          </View>
        </View>

        {/* Exam Performance Section */}
        <View style={styles.examSection}>
          <Text style={styles.sectionTitle}>Exam Performance</Text>
          <View style={styles.examTable}>
            <View style={styles.examTableHeader}>
              <Text style={[styles.examHeaderCell, styles.examNameHeader]}>Exam</Text>
              <Text style={[styles.examHeaderCell, styles.examScoreHeader]}>Avg Score</Text>
              <Text style={[styles.examHeaderCell, styles.examCompletedHeader]}>Completed</Text>
              <Text style={[styles.examHeaderCell, styles.examActionHeader]}>Details</Text>
            </View>
            {subject.exams.map((exam, index) => (
              <TouchableOpacity 
                key={exam.examId} 
                style={[styles.examTableRow, index % 2 === 0 && styles.evenRow]}
                onPress={() => fetchExamPerformanceDetails(exam.examId, subject.subjectId, subject.subjectName)}
                activeOpacity={0.7}
              >
                <View style={styles.examNameCell}>
                  <Text style={styles.examName}>{exam.examName}</Text>
                  <Text style={styles.examCode}>{exam.examCode}</Text>
                </View>
                <View style={styles.examScoreCell}>
                  <Text style={styles.examScore}>
                    {exam.averageScore.toFixed(1)}/{exam.fullMarks}
                  </Text>
                </View>
                <View style={styles.examCompletedCell}>
                  <Text style={styles.examCompleted}>{exam.studentsCompleted}</Text>
                </View>
                <View style={styles.examActionCell}>
                  <FontAwesome5 name="chart-line" size={14} color="#4299E1" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Student Performance Table */}
        <View style={styles.tableContainer}>
          <Text style={styles.sectionTitle}>Student Performance</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.studentHeaderCell]}>Student</Text>
            <Text style={[styles.headerCell, styles.examHeaderCell]}>Exams</Text>
            <Text style={[styles.headerCell, styles.performanceHeaderCell]}>Performance</Text>
            <Text style={[styles.headerCell, styles.actionHeaderCell]}>Action</Text>
          </View>
          
          <View style={styles.tableBody}>
            {subject.students.map((student, index) => (
              <TouchableOpacity
                key={student.studentId}
                style={[styles.tableRow, index % 2 === 0 && styles.evenRow]}
                onPress={() => handleStudentPress(student, subject)}
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
                  <Text style={styles.examCount}>
                    {student.overallPerformance.completedExams}/{student.overallPerformance.totalExams}
                  </Text>
                  <Text style={styles.examLabel}>Completed</Text>
                </View>
                
                <View style={styles.performanceCell}>
                  <Text style={[styles.percentage, { color: getGradeColor(student.overallPerformance.averagePercentage) }]}>
                    {student.overallPerformance.averagePercentage.toFixed(1)}%
                  </Text>
                  <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(student.overallPerformance.averagePercentage) }]}>
                    <Text style={styles.gradeText}>{student.overallPerformance.grade}</Text>
                  </View>
                </View>
                
                <View style={styles.actionCell}>
                  <FontAwesome5 name="eye" size={16} color="#4299E1" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderExamPerformanceModal = () => (
  <Modal
    animationType="slide"
    transparent={false}
    visible={examPerformanceModalVisible}
    onRequestClose={() => setExamPerformanceModalVisible(false)}
  >
    <SafeAreaView style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <TouchableOpacity
          style={styles.modalCloseButton}
          onPress={() => setExamPerformanceModalVisible(false)}
        >
          <FontAwesome5 name="times" size={20} color="#4A5568" />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>
          {examPerformanceData?.examInfo.examName} - Performance Details
        </Text>
        <View style={styles.placeholder} />
      </View>
      
      {loadingExamPerformance ? (
        <View style={styles.modalLoadingContainer}>
          <ActivityIndicator size="large" color="#4299E1" />
          <Text style={styles.loadingText}>Loading exam performance...</Text>
        </View>
      ) : (
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {examPerformanceData && examPerformanceData.statistics && (
            <>
              {/* Exam Info Card */}
              <View style={styles.examInfoCard}>
                <View style={styles.examInfoHeader}>
                  <FontAwesome5 name="file-alt" size={20} color="#4299E1" />
                  <Text style={styles.examInfoTitle}>{examPerformanceData.examInfo.examName}</Text>
                </View>
                <Text style={styles.examInfoCode}>Code: {examPerformanceData.examInfo.examCode}</Text>
                <Text style={styles.examInfoDate}>
                  Date: {new Date(examPerformanceData.examInfo.examDate).toLocaleDateString()}
                </Text>
                <Text style={styles.examInfoSubject}>
                  Subject: {examPerformanceData.subjectInfo.subjectName}
                </Text>
              </View>

              {/* Statistics Overview */}
              <View style={styles.statsOverviewCard}>
                <Text style={styles.cardTitle}>Performance Statistics</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridValue}>{examPerformanceData.statistics.totalStudents}</Text>
                    <Text style={styles.statGridLabel}>Total Students</Text>
                  </View>
                  <View style={styles.statGridItem}>
                    <Text style={[styles.statGridValue, { color: '#4299E1' }]}>
                      {examPerformanceData.statistics.averageMarks}
                    </Text>
                    <Text style={styles.statGridLabel}>Average Marks</Text>
                  </View>
                  <View style={styles.statGridItem}>
                    <Text style={[styles.statGridValue, { color: '#10B981' }]}>
                      {examPerformanceData.statistics.averagePercentage}%
                    </Text>
                    <Text style={styles.statGridLabel}>Average %</Text>
                  </View>
                  <View style={styles.statGridItem}>
                    <Text style={styles.statGridValue}>{examPerformanceData.statistics.medianMarks}</Text>
                    <Text style={styles.statGridLabel}>Median Marks</Text>
                  </View>
                </View>
              </View>

              {/* Top and Bottom Performers */}
              <View style={styles.performersCard}>
                <Text style={styles.cardTitle}>Top & Bottom Performers</Text>
                
                {/* Top Performer */}
                <View style={styles.performerSection}>
                  <View style={styles.performerHeader}>
                    <FontAwesome5 name="trophy" size={16} color="#F6AD55" />
                    <Text style={styles.performerTitle}>Highest Score</Text>
                  </View>
                  <View style={styles.performerInfo}>
                    <View style={styles.performerAvatar}>
                      <Text style={styles.performerAvatarText}>
                        {examPerformanceData.statistics.maxPerformer.studentName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.performerDetails}>
                      <Text style={styles.performerName}>
                        {examPerformanceData.statistics.maxPerformer.studentName}
                      </Text>
                      <Text style={styles.performerID}>
                        ID: {examPerformanceData.statistics.maxPerformer.studentNumber}
                      </Text>
                    </View>
                    <View style={styles.performerScore}>
                      <Text style={[styles.performerMarks, { color: '#10B981' }]}>
                        {examPerformanceData.statistics.maxPerformer.marksScored}/{examPerformanceData.statistics.fullMarks}
                      </Text>
                      <Text style={[styles.performerPercentage, { color: '#10B981' }]}>
                        {examPerformanceData.statistics.maxPerformer.percentage}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.performerDivider} />

                {/* Bottom Performer */}
                <View style={styles.performerSection}>
                  <View style={styles.performerHeader}>
                    <FontAwesome5 name="arrow-down" size={16} color="#F56565" />
                    <Text style={styles.performerTitle}>Lowest Score</Text>
                  </View>
                  <View style={styles.performerInfo}>
                    <View style={styles.performerAvatar}>
                      <Text style={styles.performerAvatarText}>
                        {examPerformanceData.statistics.minPerformer.studentName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.performerDetails}>
                      <Text style={styles.performerName}>
                        {examPerformanceData.statistics.minPerformer.studentName}
                      </Text>
                      <Text style={styles.performerID}>
                        ID: {examPerformanceData.statistics.minPerformer.studentNumber}
                      </Text>
                    </View>
                    <View style={styles.performerScore}>
                      <Text style={[styles.performerMarks, { color: '#F56565' }]}>
                        {examPerformanceData.statistics.minPerformer.marksScored}/{examPerformanceData.statistics.fullMarks}
                      </Text>
                      <Text style={[styles.performerPercentage, { color: '#F56565' }]}>
                        {examPerformanceData.statistics.minPerformer.percentage}%
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

                {/* Grade Distribution */}
                  <View style={styles.gradeDistributionCard}>
                    <Text style={styles.cardTitle}>Grade Distribution</Text>
                    <View style={styles.gradeGrid}>
                      {Object.entries(examPerformanceData.statistics.gradeDistribution).map(([grade, data]) => {
                        const count = getGradeCount(data);
                        const marksRange = getGradeMarksRange(data);
                        
                        return (
                          <View key={grade} style={styles.gradeItem}>
                            <View style={[styles.gradeBadgeDistribution, { backgroundColor: getGradeColor(getGradePercentage(grade)) }]}>
                              <Text style={styles.gradeTextDistribution}>{grade}</Text>
                            </View>
                            <Text style={styles.gradeCount}>{count}</Text>
                            {marksRange && (
                              <Text style={styles.gradeMarksRange}>({marksRange})</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>

              {/* Pass/Fail Summary */}
              <View style={styles.passFailCard}>
                <Text style={styles.cardTitle}>Pass/Fail Summary</Text>
                <View style={styles.passFailContainer}>
                  <View style={styles.passFailItem}>
                    <View style={[styles.passFailIcon, { backgroundColor: '#10B981' }]}>
                      <FontAwesome5 name="check" size={20} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={[styles.passFailValue, { color: '#10B981' }]}>
                        {examPerformanceData.statistics.passCount}
                      </Text>
                      <Text style={styles.passFailLabel}>Passed (≥40%)</Text>
                    </View>
                  </View>
                  
                  <View style={styles.passFailItem}>
                    <View style={[styles.passFailIcon, { backgroundColor: '#F56565' }]}>
                      <FontAwesome5 name="times" size={20} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={[styles.passFailValue, { color: '#F56565' }]}>
                        {examPerformanceData.statistics.failCount}
                      </Text>
                      <Text style={styles.passFailLabel}>Failed (≤40%)</Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}

          {examPerformanceData && !examPerformanceData.statistics && (
            <View style={styles.emptyPerformanceContainer}>
              <FontAwesome5 name="chart-line" size={48} color="#CBD5E0" />
              <Text style={styles.emptyPerformanceText}>No Performance Data</Text>
              <Text style={styles.emptyPerformanceSubtext}>
                No students have completed this exam yet
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  </Modal>
);

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
          <Text style={styles.modalTitle}>
            {selectedStudent?.studentName} - {selectedSubject?.subjectName}
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
            {selectedStudent && selectedSubject && (
              <>
                {/* Student Summary Card */}
                <View style={styles.studentSummaryCard}>
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

                {/* Exam Results */}
                {selectedStudent.exams.map((exam, examIndex) => (
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
                        <Text style={[styles.examPercentage, { color: getGradeColor(exam.percentage) }]}>
                          {exam.percentage.toFixed(1)}%
                        </Text>
                        <View style={[styles.examGradeBadge, { backgroundColor: getGradeColor(exam.percentage) }]}>
                          <Text style={styles.examGradeText}>{exam.grade}</Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.examStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{exam.marksScored}</Text>
                        <Text style={styles.statLabel}>Marks Scored</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{exam.fullMarks}</Text>
                        <Text style={styles.statLabel}>Total Marks</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {new Date(exam.scoredAt).toLocaleDateString()}
                        </Text>
                        <Text style={styles.statLabel}>Scored Date</Text>
                      </View>
                    </View>
                  </View>
                ))}

                {selectedStudent.exams.length === 0 && (
                  <View style={styles.emptyExamsContainer}>
                    <FontAwesome5 name="clipboard-list" size={48} color="#CBD5E0" />
                    <Text style={styles.emptyExamsText}>No exam results available</Text>
                    <Text style={styles.emptyExamsSubtext}>
                      This student hasn't completed any exams in this subject yet
                    </Text>
                  </View>
                )}
              </>
            )}
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
        <Text style={styles.loadingText}>Loading subject reports...</Text>
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
          onPress={() => fetchSubjectReports()}
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
            colors={['#667EEA', '#764BA2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <FontAwesome5 name="chart-bar" size={24} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Subject Performance Reports</Text>
            <Text style={styles.headerSubtitle}>
              {subjects.length} subjects
            </Text>
          </LinearGradient>
        </View>

        {subjects.length > 0 ? (
          subjects.map((subject) => renderSubjectCard(subject))
        ) : (
          <View style={styles.emptyStateContainer}>
            <FontAwesome5 name="book-open" size={48} color="#CBD5E0" />
            <Text style={styles.emptyStateText}>No Subject Reports Available</Text>
            <Text style={styles.emptyStateSubtext}>
              Subject reports will appear here once exams are conducted and marks are entered
            </Text>
          </View>
        )}
      </ScrollView>
      
      {/* Student Detail Modal */}
      {renderStudentDetailModal()}
      {renderExamPerformanceModal()}
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
  subjectCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  subjectHeader: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  subjectHeaderGradient: {
    padding: 16,
    alignItems: 'center',
  },
  subjectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    textAlign: 'center',
  },
  subjectSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3748',
    lineHeight: 20,
  },
  statLabel: {
    fontSize: 11,
    color: '#718096',
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  examSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
  },
  examTable: {
    marginHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    overflow: 'hidden',
  },
  examTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EDF2F7',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  examHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D3748',
  },
  examNameHeader: {
    flex: 2,
  },
  examScoreHeader: {
    flex: 1,
    textAlign: 'center',
  },
  examCompletedHeader: {
    flex: 1,
    textAlign: 'center',
  },
  examTableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  evenRow: {
    backgroundColor: '#F8F9FA',
  },
  examNameCell: {
    flex: 2,
  },
  examName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  examCode: {
    fontSize: 12,
    color: '#718096',
  },
  examScoreCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  examCompletedCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  examCompleted: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EDF2F7',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
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
  performanceHeaderCell: {
    flex: 1.3,
  },
  actionHeaderCell: {
    flex: 0.8,
  },
  tableBody: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  studentCell: {
    flex: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667EEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 12,
    color: '#718096',
  },
  examCountCell: {
    flex: 1.2,
    alignItems: 'center',
  },
  examCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  examLabel: {
    fontSize: 10,
    color: '#718096',
  },
  performanceCell: {
    flex: 1.3,
    alignItems: 'center',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  gradeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  actionCell: {
    flex: 0.8,
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F7FAFC',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 16,
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
  
  // Student Summary Card
  studentSummaryCard: {
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  largeAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  studentDetails: {
    flex: 1,
  },
  studentDetailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  studentDetailId: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 2,
  },
  subjectDetailName: {
    fontSize: 14,
    color: '#4299E1',
    fontWeight: '600',
  },
  performanceSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
  },
  gradeBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
    marginBottom: 4,
  },
  gradeTextLarge: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Exam Cards
  examCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
  },
  examHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  examInfo: {
    flex: 1,
    marginRight: 16,
  },
  examDate: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
  examSummary: {
    alignItems: 'flex-end',
  },
  examPercentage: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  examGradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    minWidth: 32,
    alignItems: 'center',
  },
  examGradeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  examStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  
  // Empty States
  emptyExamsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyExamsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyExamsSubtext: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  examActionHeader: {
  flex: 0.8,
  textAlign: 'center',
},
examActionCell: {
  flex: 0.8,
  alignItems: 'center',
  justifyContent: 'center',
},

// Exam Performance Modal Styles
examInfoCard: {
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
examInfoHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 12,
},
examInfoTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: '#2D3748',
  marginLeft: 8,
  flex: 1,
},
examInfoCode: {
  fontSize: 14,
  color: '#718096',
  marginBottom: 4,
},
examInfoDate: {
  fontSize: 14,
  color: '#718096',
  marginBottom: 4,
},
examInfoSubject: {
  fontSize: 14,
  color: '#4299E1',
  fontWeight: '600',
},
statsOverviewCard: {
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
cardTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#2D3748',
  marginBottom: 16,
},
statsGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
},
statGridItem: {
  width: '48%',
  alignItems: 'center',
  backgroundColor: '#F7FAFC',
  padding: 12,
  borderRadius: 8,
  marginBottom: 8,
},
statGridValue: {
  fontSize: 18,
  fontWeight: '700',
  color: '#2D3748',
  marginBottom: 4,
},
statGridLabel: {
  fontSize: 12,
  color: '#718096',
  textAlign: 'center',
},
performersCard: {
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
performerSection: {
  marginBottom: 8,
},
performerHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 12,
},
performerTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#2D3748',
  marginLeft: 8,
},
performerInfo: {
  flexDirection: 'row',
  alignItems: 'center',
},
performerAvatar: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#667EEA',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},
performerAvatarText: {
  color: '#FFFFFF',
  fontSize: 16,
  fontWeight: '700',
},
performerDetails: {
  flex: 1,
},
performerName: {
  fontSize: 14,
  fontWeight: '600',
  color: '#2D3748',
  marginBottom: 2,
},
performerID: {
  fontSize: 12,
  color: '#718096',
},
performerScore: {
  alignItems: 'flex-end',
},
performerMarks: {
  fontSize: 16,
  fontWeight: '700',
  marginBottom: 2,
},
performerPercentage: {
  fontSize: 12,
  fontWeight: '600',
},
performerDivider: {
  height: 1,
  backgroundColor: '#E2E8F0',
  marginVertical: 16,
},
gradeDistributionCard: {
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
gradeGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
},
gradeItem: {
  width: '23%',
  alignItems: 'center',
  marginBottom: 12,
},
gradeBadgeDistribution: {
  width: 32,
  height: 32,
  borderRadius: 16,
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 4,
},
gradeTextDistribution: {
  color: '#FFFFFF',
  fontSize: 12,
  fontWeight: '700',
},
gradeCount: {
  fontSize: 14,
  fontWeight: '600',
  color: '#2D3748',
},
passFailCard: {
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
passFailContainer: {
  flexDirection: 'row',
  justifyContent: 'space-around',
},
passFailItem: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
},
passFailIcon: {
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},
passFailValue: {
  fontSize: 20,
  fontWeight: '700',
  marginBottom: 2,
},
passFailLabel: {
  fontSize: 12,
  color: '#718096',
},
emptyPerformanceContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 64,
  paddingHorizontal: 32,
},
emptyPerformanceText: {
  fontSize: 18,
  fontWeight: '600',
  color: '#4A5568',
  marginTop: 16,
  textAlign: 'center',
},
emptyPerformanceSubtext: {
  fontSize: 14,
  color: '#718096',
  marginTop: 8,
  textAlign: 'center',
  lineHeight: 20,
},
gradeMarksRange: {
    fontSize: 10,
    color: '#718096',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '500',
  },
});

export default TeacherSubjectReportScreen;