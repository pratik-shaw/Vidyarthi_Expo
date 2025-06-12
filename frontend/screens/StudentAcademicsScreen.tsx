// StudentAcademicsScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  Animated,
  RefreshControl,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { RootStackParamList } from '../App';

const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#4F46E5';
const SECONDARY_COLOR = '#E0E7FF';

// API configuration
const API_URL = 'http://192.168.29.148:5000';
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Add token interceptor
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('studentToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token for request:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

interface SubjectData {
  subjectName: string;
  averagePercentage: string;
  averageGrade: string;
  completionRate: string;
  totalMarks: number;
  totalFullMarks: number;
  examCount: number;
  completedCount: number;
  grades: Array<{
    examName: string;
    marks: number;
    fullMarks: number;
    percentage: number;
    grade: string;
  }>;
}

interface ExamData {
  completedSubjects: any;
  examId: string;
  examName: string;
  examCode: string;
  examDate: string;
  subjects: Array<{
    subjectName: string;
    fullMarks: number;
    marksScored: number | null;
    percentage: string | null;
    grade: string | null;
    isCompleted: boolean;
    teacherName: string;
  }>;
  totalMarksScored: number;
  totalFullMarks: number;
  percentage: string;
  grade: string;
  isCompleted: boolean;
}

interface ExamTrend {
  examName: string;
  examCode: string;
  examDate: string;
  percentage: number;
  marksScored: number;
  fullMarks: number;
  isCompleted: boolean;
}

interface Summary {
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
}

interface AcademicData {
  studentInfo: {
    id: string;
    name: string;
    studentId: string;
    className: string;
    section: string;
  };
  hasData: boolean;
  exams: ExamData[];
  subjectSummary: SubjectData[];
  examTrends: ExamTrend[];
  summary: Summary;
  message?: string;
  lastUpdated: string;
}

const StudentAcademicsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const [academicData, setAcademicData] = useState<AcademicData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'subjects' | 'exams' | 'progress'>('overview');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    fetchAcademicData();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  };

  const fetchAcademicData = async () => {
    try {
      setError(null);
      const response = await apiClient.get('/api/marks/student/academic-report');
      setAcademicData(response.data);
    } catch (err: any) {
      console.error('Error fetching academic data:', err);
      if (err.response?.status === 401) {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: () => navigation.replace('StudentLogin') }
        ]);
      } else {
        setError(err.response?.data?.msg || 'Failed to load academic data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAcademicData();
    setRefreshing(false);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+': return '#10B981';
      case 'A': return '#059669';
      case 'B+': return '#3B82F6';
      case 'B': return '#2563EB';
      case 'C+': return '#F59E0B';
      case 'C': return '#D97706';
      case 'D': return '#EF4444';
      case 'F': return '#DC2626';
      default: return '#6B7280';
    }
  };

  // Get unique subjects from subject summary
  const getUniqueSubjects = () => {
    if (!academicData?.subjectSummary) return [];
    
    const uniqueSubjects = new Map();
    academicData.subjectSummary.forEach(subject => {
      if (!uniqueSubjects.has(subject.subjectName)) {
        uniqueSubjects.set(subject.subjectName, subject);
      }
    });
    return Array.from(uniqueSubjects.values());
  };

  const renderOverviewTab = () => {
    if (!academicData || !academicData.hasData) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="school-outline" size={64} color="#9CA3AF" />
          <Text style={styles.noDataTitle}>No Academic Records</Text>
          <Text style={styles.noDataText}>
            {academicData?.message || 'Your academic records will appear here once exams are conducted and marked.'}
          </Text>
        </View>
      );
    }

    const { summary } = academicData;
    const uniqueSubjects = getUniqueSubjects();

    return (
      <View style={styles.tabContent}>
        {/* Overall Performance Card */}
        <LinearGradient
          colors={[PRIMARY_COLOR, '#6366F1']}
          style={styles.performanceCard}
        >
          <View style={styles.performanceHeader}>
            <Text style={styles.performanceTitle}>Overall Performance</Text>
            <View style={[styles.gradeChip, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={styles.gradeChipText}>{summary.overallGrade}</Text>
            </View>
          </View>
          <Text style={styles.percentageText}>{summary.overallPercentage}%</Text>
          <Text style={styles.performanceSubtitle}>
            {uniqueSubjects.length} subjects • {summary.completedExams}/{summary.totalExams} exams completed
          </Text>
        </LinearGradient>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#10B981' + '15' }]}>
              <Ionicons name="book-outline" size={20} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{uniqueSubjects.length}</Text>
            <Text style={styles.statLabel}>Subjects</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#3B82F6' + '15' }]}>
              <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{summary.completedExams}/{summary.totalExams}</Text>
            <Text style={styles.statLabel}>Exams</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: '#F59E0B' + '15' }]}>
              <Ionicons name="trophy-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{summary.totalMarksScored}</Text>
            <Text style={styles.statLabel}>Total Marks</Text>
          </View>
        </View>

        {/* Performance Trend Chart */}
        {academicData.examTrends.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Performance Trend</Text>
              <Text style={styles.chartSubtitle}>All exam results</Text>
            </View>
            <LineChart
              data={{
                labels: academicData.examTrends.map(exam => 
                  exam.examCode.length > 6 ? exam.examCode.substring(0, 6) + '...' : exam.examCode
                ),
                datasets: [{
                  data: academicData.examTrends.map(exam => Math.round(exam.percentage)),
                  strokeWidth: 3,
                  color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`
                }]
              }}
              width={width - 80}
              height={200}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: '#FFFFFF',
                backgroundGradientTo: '#FFFFFF',
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
                style: { borderRadius: 16 },
                propsForDots: {
                  r: '5',
                  strokeWidth: '2',
                  stroke: PRIMARY_COLOR,
                  fill: '#FFFFFF'
                },
                propsForBackgroundLines: {
                  strokeDasharray: '',
                  stroke: '#E5E7EB',
                  strokeWidth: 1
                }
              }}
              bezier
              style={styles.chart}
              withVerticalLabels={true}
              withHorizontalLabels={true}
              withDots={true}
              withShadow={false}
              withVerticalLines={false}
              withHorizontalLines={true}
            />
          </View>
        )}

        {/* Recent Performance Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Recent Performance</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.examCompletionRate}%</Text>
              <Text style={styles.summaryLabel}>Completion Rate</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: getGradeColor(summary.overallGrade) }]}>
                {summary.overallGrade}
              </Text>
              <Text style={styles.summaryLabel}>Current Grade</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSubjectsTab = () => {
    if (!academicData?.hasData || academicData.subjectSummary.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="book-outline" size={64} color="#9CA3AF" />
          <Text style={styles.noDataTitle}>No Subject Data</Text>
          <Text style={styles.noDataText}>Subject performance will be shown here once marks are available.</Text>
        </View>
      );
    }

    const uniqueSubjects = getUniqueSubjects();

    return (
      <View style={styles.tabContent}>
        {/* Subject Performance Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Subject Performance</Text>
            <Text style={styles.chartSubtitle}>Average percentage by subject</Text>
          </View>
          <BarChart
            data={{
              labels: uniqueSubjects.map(subject => 
                subject.subjectName.length > 6 ? 
                subject.subjectName.substring(0, 6) + '...' : 
                subject.subjectName
              ),
              datasets: [{
                data: uniqueSubjects.map(subject => 
                  Math.round(parseFloat(subject.averagePercentage))
                )
              }]
            }}
            width={width - 80}
            height={220}
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: '#FFFFFF',
              backgroundGradientTo: '#FFFFFF',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
              style: { borderRadius: 16 },
              propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: '#E5E7EB',
                strokeWidth: 1
              }
            }}
            style={styles.chart}
            showValuesOnTopOfBars={true}
            yAxisLabel={''}
            yAxisSuffix={'%'}
            withVerticalLabels={false}
            withHorizontalLabels={true}
            fromZero={true}
          />
        </View>

        {/* Subject Details */}
        {uniqueSubjects.map((subject, index) => (
          <View key={index} style={styles.subjectCard}>
            <View style={styles.subjectHeader}>
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{subject.subjectName}</Text>
                <Text style={styles.subjectDetails}>
                  {subject.completedCount} of {subject.examCount} exams completed
                </Text>
              </View>
              <View style={[styles.gradeChip, { backgroundColor: getGradeColor(subject.averageGrade) + '20' }]}>
                <Text style={[styles.gradeChipText, { color: getGradeColor(subject.averageGrade) }]}>
                  {subject.averageGrade}
                </Text>
              </View>
            </View>
            
            <View style={styles.subjectProgress}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min(parseFloat(subject.averagePercentage), 100)}%`,
                      backgroundColor: getGradeColor(subject.averageGrade)
                    }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{subject.averagePercentage}%</Text>
            </View>

            <View style={styles.subjectStats}>
              <View style={styles.subjectStat}>
                <Text style={styles.subjectStatValue}>{subject.totalMarks}</Text>
                <Text style={styles.subjectStatLabel}>Total Marks</Text>
              </View>
              <View style={styles.subjectStat}>
                <Text style={styles.subjectStatValue}>{subject.completionRate}%</Text>
                <Text style={styles.subjectStatLabel}>Completion</Text>
              </View>
              <View style={styles.subjectStat}>
                <Text style={styles.subjectStatValue}>{subject.totalFullMarks}</Text>
                <Text style={styles.subjectStatLabel}>Full Marks</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderExamsTab = () => {
    if (!academicData?.hasData || academicData.exams.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="document-outline" size={64} color="#9CA3AF" />
          <Text style={styles.noDataTitle}>No Exam Records</Text>
          <Text style={styles.noDataText}>Your exam results will appear here once they are available.</Text>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {academicData.exams.map((exam, index) => (
          <TouchableOpacity key={index} style={styles.examCard} activeOpacity={0.7}>
            <View style={styles.examHeader}>
              <View style={styles.examInfo}>
                <Text style={styles.examName}>{exam.examName}</Text>
                <Text style={styles.examCode}>{exam.examCode}</Text>
                <Text style={styles.examDate}>
                  {new Date(exam.examDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              <View style={styles.examGrade}>
                <View style={[styles.gradeChip, { backgroundColor: getGradeColor(exam.grade) + '20' }]}>
                  <Text style={[styles.gradeChipText, { color: getGradeColor(exam.grade) }]}>
                    {exam.grade}
                  </Text>
                </View>
                <Text style={styles.examPercentage}>{exam.percentage}%</Text>
                <Text style={styles.examMarks}>
                  {exam.totalMarksScored}/{exam.totalFullMarks}
                </Text>
              </View>
            </View>
            
            <View style={styles.examProgress}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min(parseFloat(exam.percentage), 100)}%`,
                      backgroundColor: getGradeColor(exam.grade)
                    }
                  ]} 
                />
              </View>
              <Text style={styles.examStatus}>
                {exam.isCompleted ? 'Completed' : `${exam.completedSubjects}/${exam.subjects.length} subjects`}
              </Text>
            </View>

            {/* Subject breakdown */}
            <View style={styles.subjectBreakdown}>
              {exam.subjects.map((subject, subIndex) => (
                <View key={subIndex} style={styles.subjectItem}>
                  <Text style={styles.subjectItemName}>{subject.subjectName}</Text>
                  <View style={styles.subjectItemScore}>
                    <Text style={[
                      styles.subjectItemGrade,
                      { color: subject.isCompleted ? getGradeColor(subject.grade || 'F') : '#9CA3AF' }
                    ]}>
                      {subject.isCompleted ? subject.grade : 'Pending'}
                    </Text>
                    {subject.isCompleted && (
                      <Text style={styles.subjectItemMarks}>
                        {subject.marksScored}/{subject.fullMarks}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderProgressTab = () => {
    if (!academicData?.hasData) {
      return (
        <View style={styles.noDataContainer}>
          <Ionicons name="analytics-outline" size={64} color="#9CA3AF" />
          <Text style={styles.noDataTitle}>No Progress Data</Text>
          <Text style={styles.noDataText}>Progress analytics will be available once you have exam data.</Text>
        </View>
      );
    }

    const gradeDistribution = academicData.exams.reduce((acc, exam) => {
      if (exam.isCompleted) {
        acc[exam.grade] = (acc[exam.grade] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(gradeDistribution).map(([grade, count]) => ({
      name: grade,
      population: count,
      color: getGradeColor(grade),
      legendFontColor: '#374151',
      legendFontSize: 12
    }));

    return (
      <View style={styles.tabContent}>
        {/* Grade Distribution */}
        {pieData.length > 0 && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Grade Distribution</Text>
              <Text style={styles.chartSubtitle}>Across all completed exams</Text>
            </View>
            <PieChart
              data={pieData}
              width={width - 80}
              height={200}
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              hasLegend={true}
            />
          </View>
        )}

        {/* Progress Metrics */}
        <View style={styles.progressMetrics}>
          <View style={styles.metricCard}>
            <View style={[styles.statIcon, { backgroundColor: '#10B981' + '15' }]}>
              <Ionicons name="trending-up" size={24} color="#10B981" />
            </View>
            <Text style={styles.metricValue}>
              {academicData.summary.examCompletionRate}%
            </Text>
            <Text style={styles.metricLabel}>Exam Completion</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={[styles.statIcon, { backgroundColor: '#F59E0B' + '15' }]}>
              <Ionicons name="star" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.metricValue}>
              {academicData.summary.overallGrade}
            </Text>
            <Text style={styles.metricLabel}>Current Grade</Text>
          </View>
        </View>

        {/* Recent Performance */}
        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>Recent Performance</Text>
          {academicData.examTrends.reverse().map((exam, index) => (
            <View key={index} style={styles.recentItem}>
              <View style={styles.recentExamInfo}>
                <Text style={styles.recentExamName}>{exam.examName}</Text>
                <Text style={styles.recentExamDate}>
                  {new Date(exam.examDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
              </View>
              <View style={styles.recentScore}>
                <Text style={styles.recentPercentage}>{exam.percentage.toFixed(1)}%</Text>
                <Text style={styles.recentMarks}>{exam.marksScored}/{exam.fullMarks}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Loading academic data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Error Loading Data</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAcademicData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>My Academics</Text>
              <View style={styles.headerRight} />
            </View>
      {/* Tab Navigation */}
      <Animated.View style={[styles.tabContainer, { opacity: fadeAnim }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScrollView}>
          {[
            { key: 'overview', label: 'Overview', icon: 'analytics' },
            { key: 'subjects', label: 'Subjects', icon: 'book' },
            { key: 'exams', label: 'Exams', icon: 'document' },
            { key: 'progress', label: 'Progress', icon: 'trending-up' }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, selectedTab === tab.key && styles.tabButtonActive]}
              onPress={() => setSelectedTab(tab.key as any)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={18} 
                color={selectedTab === tab.key ? '#FFFFFF' : PRIMARY_COLOR} 
              />
              <Text style={[
                styles.tabButtonText, 
                selectedTab === tab.key && styles.tabButtonTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Content */}
      <Animated.View style={[
        styles.contentContainer, 
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}>
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY_COLOR]}
              tintColor={PRIMARY_COLOR}
            />
          }
        >
          {selectedTab === 'overview' && renderOverviewTab()}
          {selectedTab === 'subjects' && renderSubjectsTab()}
          {selectedTab === 'exams' && renderExamsTab()}
          {selectedTab === 'progress' && renderProgressTab()}
        </ScrollView>
      </Animated.View>
    </View>
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
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FC',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: SECONDARY_COLOR,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: SECONDARY_COLOR,
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabScrollView: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: SECONDARY_COLOR,
  },
  tabButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginLeft: 6,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  noDataTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  // Performance Card Styles
  performanceCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  performanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  gradeChipText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  percentageText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  performanceSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  // Stats Grid Styles
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Chart Styles
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  // Summary Card Styles
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  // Subject Card Styles
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subjectDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  subjectProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    minWidth: 40,
  },
  subjectStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subjectStat: {
    alignItems: 'center',
  },
  subjectStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subjectStatLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  // Exam Card Styles
  examCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
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
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  examCode: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  examDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  examGrade: {
    alignItems: 'flex-end',
  },
  examPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  examMarks: {
    fontSize: 14,
    color: '#6B7280',
  },
  examProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  examStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 12,
  },
  subjectBreakdown: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  subjectItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  subjectItemName: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  subjectItemScore: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectItemGrade: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  subjectItemMarks: {
    fontSize: 12,
    color: '#6B7280',
  },
  moreSubjects: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  // Progress Tab Styles
  progressMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginVertical: 12,
  },
  metricLabel: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  recentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  recentExamInfo: {
    flex: 1,
  },
  recentExamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  recentExamDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  recentScore: {
    alignItems: 'flex-end',
  },
  recentPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  recentMarks: {
    fontSize: 12,
    color: '#6B7280',
  },
  headerRight: {
    width: 40,
  },
});
export default StudentAcademicsScreen;

// fine tuning of this screen is required, this is just a basic implementation 